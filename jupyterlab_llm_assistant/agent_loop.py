"""
Shared agent execution loop.

AgentHandler delegates to this single implementation to ensure consistent
behaviour (tool handling, temperature propagation, SSE event names, etc.).
"""

import json
import time
import asyncio
import logging
from typing import Any, Callable, Coroutine, Dict, List, Optional

from openai import AsyncOpenAI

from .agent_tools import AGENT_TOOLS, AgentToolExecutor, truncate_tool_result
from .serverextension import mask_secrets

logger = logging.getLogger(__name__)

# Default temperature used when not explicitly set in config_store
DEFAULT_TEMPERATURE = 0.7

# Progress self-check: once the agent reaches this many iterations, inject a
# reminder into the conversation urging it to improve efficiency and wrap up.
PROGRESS_REMINDER_ITERATION = 100
# Default max_tokens used for each LLM call
DEFAULT_MAX_TOKENS = 4096
# Default number of messages to keep from end when compression triggers
DEFAULT_KEEP_LAST_MESSAGES = 16
# Estimated context size (chars) that triggers the compression safety valve.
# Below this, a run keeps its full chain of thought - no compression at all.
# ~300k chars is roughly 100k+ tokens, safely below typical model windows.
CONTEXT_COMPRESSION_THRESHOLD = 300_000


def _estimate_context_chars(messages: List[Dict[str, Any]]) -> int:
    """Rough content-size estimate of a message list, in characters."""
    total = 0
    for msg in messages:
        total += len(str(msg.get("content") or ""))
        for tc in msg.get("tool_calls") or []:
            total += len(str(tc.get("function", {}).get("arguments") or ""))
    return total


def _last_round_tool_call_ids(messages: List[Dict[str, Any]]) -> set:
    """
    tool_call_ids of the most recent assistant(tool_calls) message.

    Those results have not been consumed by the LLM yet (the upcoming call is
    their consumer), so they must stay intact during any compression.
    """
    for msg in reversed(messages):
        if msg.get("role") == "assistant" and msg.get("tool_calls"):
            return {tc["id"] for tc in msg["tool_calls"]}
    return set()


def compress_message_history(
    messages: List[Dict[str, Any]],
    keep_last_messages: int = DEFAULT_KEEP_LAST_MESSAGES,
) -> List[Dict[str, Any]]:
    """
    Context compression that NEVER drops user messages.

    Messages are grouped into atomic units:
    - a user message,
    - a plain assistant/system message,
    - an assistant(tool_calls) message together with its tool responses
      (these must never be split apart, or the API rejects the history).

    When called (only when the caller detects the context is too large):
    - all user messages are preserved verbatim (they carry the user's intent),
    - the most recent `keep_last_messages` messages are preserved verbatim,
    - older assistant/tool units are replaced by a compact summary.

    Returns a new list; the input list is not modified.
    """
    # Group messages into atomic units
    units = []  # (kind, [messages])
    i = 0
    while i < len(messages):
        msg = messages[i]
        if msg.get("role") == "assistant" and msg.get("tool_calls"):
            group = [msg]
            i += 1
            while i < len(messages) and messages[i].get("role") == "tool":
                group.append(messages[i])
                i += 1
            units.append(("assistant_tools", group))
        else:
            units.append((msg.get("role", "other"), [msg]))
            i += 1

    # Tail: the last `keep_last_messages` messages, boundary-aligned to units
    tail = []
    tail_count = 0
    for unit in reversed(units):
        tail.insert(0, unit)
        tail_count += len(unit[1])
        if tail_count >= keep_last_messages:
            break

    # If the tail already covers everything (small history), return unchanged
    if len(tail) >= len(units) - 1:
        return messages

    head = units[:1]  # system prompt
    middle = units[1:len(units) - len(tail)]

    # Build the compressed middle:
    # - user messages: kept verbatim (they carry the user's intent)
    # - assistant narration text: kept (the model's working memory -
    #   intermediate findings, conclusions and plans)
    # - tool_calls scaffolding + tool responses: dropped (the bulk of the
    #   volume; replaced by the summary below)
    tools_used = set()
    dropped_rounds = 0
    kept_middle = []
    for kind, group in middle:
        if kind == "user":
            kept_middle.extend(group)
            continue
        dropped_rounds += 1
        for msg in group:
            for tc in msg.get("tool_calls") or []:
                name = tc.get("function", {}).get("name")
                if name:
                    tools_used.add(name)
            # keep narration text of assistant messages (without tool_calls)
            if msg.get("role") == "assistant" and msg.get("content"):
                kept_middle.append({
                    "role": "assistant",
                    "content": msg["content"],
                })

    result = [m for _, group in head for m in group]
    if dropped_rounds:
        summary = (
            f"[已压缩 {dropped_rounds} 轮工具调用过程] "
            + (f"使用工具: {', '.join(sorted(tools_used))}" if tools_used else "")
            + " (工具结果已省略，如需原始内容请重新执行工具)"
        )
        result.append({"role": "system", "content": summary})
    result.extend(kept_middle)
    for _, group in tail:
        result.extend(group)
    return result


# Below this length, stubbing a tool result saves nothing meaningful
_TOOL_RESULT_STUB_THRESHOLD = 200
# Marker prefix identifying an already-stubbed tool result
_TOOL_STUB_MARKER = "[tool-result-evicted"


def evict_old_tool_results(
    messages: List[Dict[str, Any]],
    keep_tool_call_ids: Optional[set] = None,
) -> int:
    """
    Promptly shrink stale tool results to stubs to keep context small.

    Rationale: a tool result only needs to be seen in full by the LLM once
    (the round right after it was produced). Once the model has consumed it
    and moved on to new tool calls, the full content no longer earns its
    context cost. Tool messages cannot be removed entirely (the API requires
    every tool_call to have a matching tool response), so their content is
    replaced with a compact stub; the model can re-run the tool if it ever
    needs the full content again.

    Parameters
    ----------
    messages          : mutable message list; tool messages are updated in-place.
    keep_tool_call_ids: tool_call_ids whose results stay intact (typically the
                        most recent round, which the LLM has not consumed yet).

    Returns
    -------
    Number of tool results evicted.
    """
    keep = keep_tool_call_ids or set()

    # Map tool_call_id -> tool name from assistant tool_calls messages
    names = {}
    for msg in messages:
        if msg.get("role") == "assistant" and "tool_calls" in msg:
            for tc in msg["tool_calls"]:
                names[tc["id"]] = tc.get("function", {}).get("name", "tool")

    evicted = 0
    for msg in messages:
        if msg.get("role") != "tool":
            continue
        tc_id = msg.get("tool_call_id")
        if tc_id in keep:
            continue
        content = msg.get("content") or ""
        if not isinstance(content, str) or len(content) < _TOOL_RESULT_STUB_THRESHOLD:
            continue
        if content.startswith(_TOOL_STUB_MARKER):
            continue  # already stubbed

        msg["content"] = (
            f"{_TOOL_STUB_MARKER} | tool={names.get(tc_id, 'unknown')} | "
            f"original_len={len(content)} | head={content[:120]} | "
            f"re-run the tool if you need the full content again]"
        )
        evicted += 1
    return evicted


async def run_agent_loop(
    send_event: Callable[[str, Any], Coroutine],
    client: AsyncOpenAI,
    executor: AgentToolExecutor,
    api_messages: List[Dict[str, Any]],
    model: str,
    max_iterations: int,
    config_store: Dict[str, Any],
    skill_tools: Optional[List[Dict[str, Any]]] = None,
) -> None:
    """
    Core agentic execution loop.

    Repeatedly:
    1. Call the LLM with the current message list (streaming).
    2. If the LLM issues tool calls  → execute them, append results, continue.
    3. If the LLM produces text only → emit 'done' and return.

    Parameters
    ----------
    send_event      : async callable(event_type, data) that writes an SSE frame.
    client          : configured AsyncOpenAI client.
    executor        : AgentToolExecutor bound to the target working directory.
    api_messages    : mutable message list; updated in-place each iteration.
    model           : model identifier string (e.g. "gpt-4o").
    max_iterations  : maximum number of agent turns before giving up.
    config_store    : server-side config dict; used to read temperature/maxTokens.
                      The *caller* is responsible for ensuring that any
                      user-supplied settings overrides have already been applied
                      to config_store before calling this function.
    skill_tools     : optional list of additional tool definitions from skills.
    """
    temperature = config_store.get("temperature", DEFAULT_TEMPERATURE)
    max_tokens = config_store.get("maxTokens", DEFAULT_MAX_TOKENS)

    # Merge default tools with skill tools
    all_tools = list(AGENT_TOOLS)
    if skill_tools:
        all_tools.extend(skill_tools)

    for iteration in range(1, max_iterations + 1):
        await send_event("iteration", {"current": iteration, "max": max_iterations})
        logger.info(f"[agent_loop] === Iteration {iteration}/{max_iterations} ===")

        # Progress self-check: at the reminder iteration, nudge the model to
        # accelerate and converge instead of drifting through low-value turns.
        # A user-role message is used so context compression never drops it.
        if iteration == PROGRESS_REMINDER_ITERATION:
            reminder = (
                f"[进度自检提醒] 已执行到第 {iteration} 轮，请立即自查："
                "当前任务的核心目标是否已基本完成？请提高效率、聚焦最关键剩余的步骤，"
                "避免低价值的反复探索与重复调用，并尽快在接下来几轮内收敛收尾，"
                "给出最终总结，不要无限延长迭代。"
            )
            api_messages.append({"role": "user", "content": reminder})
            logger.info(f"[agent_loop] Injected progress reminder at iteration {iteration}")

        # Safety valve: a run in progress represents one complete unit of
        # thought, so normally NO compression happens mid-run and the LLM
        # keeps its full chain. Only when the context is actually large do we
        # shrink old tool results (never user messages).
        estimated_chars = _estimate_context_chars(api_messages)
        if estimated_chars > CONTEXT_COMPRESSION_THRESHOLD:
            keep_ids = _last_round_tool_call_ids(api_messages)
            evicted = evict_old_tool_results(api_messages, keep_ids)
            compressed_messages = compress_message_history(api_messages)
            logger.info(
                f"[agent_loop] Context safety valve: estimated_chars={estimated_chars}, "
                f"evicted={evicted} tool result(s)"
            )
        else:
            compressed_messages = api_messages
        logger.debug(
            f"[agent_loop] LLM request: model={model}, tools={len(all_tools)}, "
            "messages=" + json.dumps(mask_secrets(compressed_messages), ensure_ascii=False)
        )

        accumulated_text = ""
        tool_calls_raw: Dict[int, Dict] = {}
        finish_reason = None

        try:
            stream = await client.chat.completions.create(
                model=model,
                messages=compressed_messages,
                tools=all_tools,
                tool_choice="auto",
                stream=True,
                max_tokens=max_tokens,
                temperature=temperature,
            )

            async for chunk in stream:
                choice = chunk.choices[0] if chunk.choices else None
                if not choice:
                    continue

                delta = choice.delta

                if delta is None:
                    if choice.finish_reason:
                        finish_reason = choice.finish_reason
                    continue

                if delta.content:
                    accumulated_text += delta.content
                    await send_event("text", {"content": delta.content})

                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_raw:
                            tool_calls_raw[idx] = {
                                "id": tc.id or "",
                                "name": tc.function.name or "" if tc.function else "",
                                "arguments_str": "",
                            }
                        if tc.id:
                            tool_calls_raw[idx]["id"] = tc.id
                        if tc.function:
                            if tc.function.name:
                                tool_calls_raw[idx]["name"] = tc.function.name
                            if tc.function.arguments:
                                tool_calls_raw[idx]["arguments_str"] += tc.function.arguments

                if choice.finish_reason:
                    finish_reason = choice.finish_reason

        except Exception as e:
            logger.error(f"[agent_loop] LLM error at iteration {iteration}: {e}", exc_info=True)
            await send_event("error", {"message": f"LLM error: {str(e)}"})
            return

        logger.info(
            f"[agent_loop] Iteration {iteration} response: finish_reason={finish_reason}, "
            f"text_len={len(accumulated_text)}, tool_calls={len(tool_calls_raw)}"
        )
        logger.debug(f"[agent_loop] Iteration {iteration} text: {accumulated_text}")

        # Build assistant message — use empty string (not None) for content
        # when only tool_calls are present; some providers reject null content.
        assistant_msg: Dict[str, Any] = {
            "role": "assistant",
            "content": accumulated_text or "",
        }

        if tool_calls_raw:
            # If the response was truncated by max_tokens mid-tool-call, the
            # arguments may be incomplete JSON. Don't keep the broken assistant
            # message in history (causes API 400 on subsequent turns); ask the
            # model to re-issue the complete tool call instead.
            if finish_reason == "length":
                api_messages.append({
                    "role": "user",
                    "content": "Your previous tool call was truncated by max_tokens. Please re-issue the complete tool call.",
                })
                continue

            tool_calls_list = []
            for idx in sorted(tool_calls_raw.keys()):
                tc = tool_calls_raw[idx]
                arguments_str = tc["arguments_str"]
                # Ensure arguments is valid JSON to avoid API 400 on future turns
                try:
                    json.loads(arguments_str or "{}")
                except json.JSONDecodeError:
                    arguments_str = "{}"
                tool_calls_list.append({
                    "id": tc["id"],
                    "type": "function",
                    "function": {
                        "name": tc["name"],
                        "arguments": arguments_str,
                    },
                })

            assistant_msg["tool_calls"] = tool_calls_list
            api_messages.append(assistant_msg)

            # Parse arguments and emit tool_call events for all calls first,
            # so the UI can show the full batch of queued calls immediately.
            prepared = []
            for tc_item in tool_calls_list:
                tool_name = tc_item["function"]["name"]
                tool_id = tc_item["id"]

                try:
                    tool_args = json.loads(tc_item["function"]["arguments"] or "{}")
                except json.JSONDecodeError:
                    tool_args = {}

                await send_event("tool_call", {
                    "id": tool_id,
                    "name": tool_name,
                    "args": tool_args,
                })
                logger.debug(
                    f"[agent_loop] Tool call {tool_name}: "
                    + json.dumps(mask_secrets(tool_args), ensure_ascii=False)
                )
                prepared.append((tool_id, tool_name, tool_args))

            async def _execute_and_log(name: str, args: Dict[str, Any]):
                start = time.monotonic()
                success, result = await executor.execute_tool(name, args)
                logger.info(
                    f"[agent_loop] Tool {name} -> success={success}, "
                    f"duration={time.monotonic() - start:.2f}s, result_len={len(result)}"
                )
                logger.debug(f"[agent_loop] Tool {name} result: {result}")
                return success, result

            # Execute the batch concurrently: the model is instructed to only
            # batch independent calls, so they can safely run in parallel.
            batch_start = time.monotonic()
            if len(prepared) == 1:
                results = [await _execute_and_log(prepared[0][1], prepared[0][2])]
            else:
                outcomes = await asyncio.gather(
                    *(_execute_and_log(name, args) for _, name, args in prepared)
                )
                results = list(outcomes)
            logger.info(
                f"[agent_loop] Tool batch of {len(prepared)} finished in "
                f"{time.monotonic() - batch_start:.2f}s"
            )

            # Emit results and extend history in the original call order.
            for (tool_id, tool_name, _), (success, result) in zip(prepared, results):
                await send_event("tool_result", {
                    "id": tool_id,
                    "name": tool_name,
                    "success": success,
                    "output": result,
                })
                api_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_id,
                    "content": result,
                })

            # Continue the loop so the LLM can process tool results.
            continue

        else:
            # No tool calls — the agent has produced its final answer.
            api_messages.append(assistant_msg)
            logger.info(f"[agent_loop] Agent completed in {iteration} iterations")
            await send_event("done", {
                "total_iterations": iteration,
                "completed": True,
                "message": "Task completed",
            })
            return

    # Exhausted max iterations without a terminal text-only response.
    await send_event("done", {
        "total_iterations": max_iterations,
        "completed": False,
        "reason": "max_iterations",
        "message": f"Reached maximum iterations ({max_iterations})",
    })
