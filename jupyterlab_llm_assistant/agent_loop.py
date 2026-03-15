"""
Shared agent execution loop.

Both AgentHandler and PlanExecuteHandler delegate to this single
implementation to avoid duplication and guarantee consistent behaviour
(tool handling, temperature propagation, SSE event names, etc.).
"""

import json
from typing import Any, Callable, Coroutine, Dict, List

from openai import AsyncOpenAI

from .agent_tools import AGENT_TOOLS, AgentToolExecutor

# Default temperature used when not explicitly set in config_store
DEFAULT_TEMPERATURE = 0.7
# Default max_tokens used for each LLM call
DEFAULT_MAX_TOKENS = 4096


async def run_agent_loop(
    send_event: Callable[[str, Any], Coroutine],
    client: AsyncOpenAI,
    executor: AgentToolExecutor,
    api_messages: List[Dict[str, Any]],
    model: str,
    max_iterations: int,
    config_store: Dict[str, Any],
) -> None:
    """
    Core agentic execution loop shared by AgentHandler and PlanExecuteHandler.

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
    """
    temperature = config_store.get("temperature", DEFAULT_TEMPERATURE)
    max_tokens = config_store.get("maxTokens", DEFAULT_MAX_TOKENS)

    for iteration in range(1, max_iterations + 1):
        await send_event("iteration", {"current": iteration, "max": max_iterations})

        accumulated_text = ""
        tool_calls_raw: Dict[int, Dict] = {}

        try:
            stream = await client.chat.completions.create(
                model=model,
                messages=api_messages,
                tools=AGENT_TOOLS,
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

        except Exception as e:
            await send_event("error", {"message": f"LLM error: {str(e)}"})
            return

        # Build assistant message — use empty string (not None) for content
        # when only tool_calls are present; some providers reject null content.
        assistant_msg: Dict[str, Any] = {
            "role": "assistant",
            "content": accumulated_text or "",
        }

        if tool_calls_raw:
            tool_calls_list = []
            for idx in sorted(tool_calls_raw.keys()):
                tc = tool_calls_raw[idx]
                tool_calls_list.append({
                    "id": tc["id"],
                    "type": "function",
                    "function": {
                        "name": tc["name"],
                        "arguments": tc["arguments_str"],
                    },
                })

            assistant_msg["tool_calls"] = tool_calls_list
            api_messages.append(assistant_msg)

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

                success, result = await executor.execute_tool(tool_name, tool_args)

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
            await send_event("done", {
                "total_iterations": iteration,
                "message": "Task completed",
            })
            return

    # Exhausted max iterations without a terminal text-only response.
    await send_event("done", {
        "total_iterations": max_iterations,
        "message": f"Reached maximum iterations ({max_iterations})",
    })
