"""
Agent handler for the LLM coding assistant.

Implements an agentic execution loop:
1. User sends a task
2. LLM decides which tools to call
3. Tools are executed and results fed back
4. Loop continues until LLM produces final answer

SSE events are streamed to the frontend in real-time showing:
- text chunks from the LLM
- tool calls being made
- tool results
- final completion
"""

import json
import asyncio
import os
from typing import Dict, Any, List, Optional, AsyncGenerator
from tornado import web
from jupyter_server.base.handlers import APIHandler
from openai import AsyncOpenAI

from .agent_tools import AGENT_TOOLS, AgentToolExecutor


# Agent system prompt
AGENT_SYSTEM_PROMPT = """You are an expert AI coding assistant with access to tools that let you read, write, and execute code — similar to Claude Code. You operate in a JupyterLab environment.

## Your Capabilities
- **read_file**: Read any file to understand existing code
- **write_file**: Create or overwrite files with new content
- **edit_file**: Make precise str_replace edits to existing files (safer than write_file for targeted changes)
- **bash**: Execute shell commands (run tests, install packages, git operations, etc.)
- **list_dir**: Explore directory structures
- **grep_search**: Search for patterns across files
- **notebook_execute**: Execute Python code directly in the Jupyter kernel and capture output

## How to Work
1. Understand the task fully before acting
2. Explore relevant files/directories first
3. Make targeted, precise changes
4. Verify your changes work (run tests, check syntax)
5. Explain what you did and why

## Important Rules
- Always read a file before modifying it
- Prefer small, focused changes
- When writing code, follow the existing style and conventions
- Report errors clearly if something fails
- Be concise in your explanations but thorough in your work

You are working in the Jupyter notebook environment. The current working directory is the Jupyter root."""


class AgentHandler(APIHandler):
    """
    Handler for the coding agent.

    POST /llm-assistant/agent
    Streams SSE events as the agent works:

    Event types:
    - text: LLM text chunk
    - tool_call: Agent is calling a tool {name, args}
    - tool_result: Tool execution result {name, success, output}
    - iteration: Agent loop iteration number
    - done: Agent completed {total_iterations}
    - error: Error occurred {message}
    """

    def initialize(self, config_store: Dict[str, Any]):
        self.config_store = config_store

    def _get_api_key(self) -> Optional[str]:
        return self.config_store.get("apiKey") or os.environ.get("OPENAI_API_KEY")

    def _create_client(self) -> AsyncOpenAI:
        return AsyncOpenAI(
            api_key=self._get_api_key(),
            base_url=self.config_store.get("apiEndpoint", "https://api.openai.com/v1"),
        )

    async def _send_event(self, event_type: str, data: Any):
        """Send an SSE event."""
        payload = json.dumps({"type": event_type, "data": data})
        self.write(f"data: {payload}\n\n")
        await self.flush()

    @web.authenticated
    async def post(self):
        """Handle agent request."""
        try:
            body = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        messages = body.get("messages", [])
        max_iterations = min(body.get("maxIterations", 20), 30)
        root_dir = body.get("rootDir") or os.getcwd()

        if not messages:
            raise web.HTTPError(400, "Messages are required")

        if not self._get_api_key():
            raise web.HTTPError(401, "API key not configured")

        # Set up SSE
        self.set_header("Content-Type", "text/event-stream")
        self.set_header("Cache-Control", "no-cache")
        self.set_header("Connection", "keep-alive")
        self.set_header("X-Accel-Buffering", "no")

        client = self._create_client()
        executor = AgentToolExecutor(root_dir=root_dir)
        model = self.config_store.get("model", "gpt-4o")

        # Build initial message list with system prompt
        api_messages = [
            {"role": "system", "content": AGENT_SYSTEM_PROMPT}
        ] + [{"role": m["role"], "content": m["content"]} for m in messages]

        try:
            await self._run_agent_loop(
                client=client,
                executor=executor,
                api_messages=api_messages,
                model=model,
                max_iterations=max_iterations,
            )
        except Exception as e:
            await self._send_event("error", {"message": str(e)})
        finally:
            self.write("data: [DONE]\n\n")
            await self.flush()
            self.finish()

    async def _run_agent_loop(
        self,
        client: AsyncOpenAI,
        executor: AgentToolExecutor,
        api_messages: List[Dict[str, Any]],
        model: str,
        max_iterations: int,
    ):
        """
        Core agentic loop.

        Repeatedly:
        1. Call LLM with current messages
        2. If LLM calls tools → execute them, append results, continue
        3. If LLM produces text-only → we're done
        """
        for iteration in range(1, max_iterations + 1):
            await self._send_event("iteration", {"current": iteration, "max": max_iterations})

            # Call LLM with streaming
            accumulated_text = ""
            tool_calls_raw = {}  # id -> {name, arguments_str}

            try:
                stream = await client.chat.completions.create(
                    model=model,
                    messages=api_messages,
                    tools=AGENT_TOOLS,
                    tool_choice="auto",
                    stream=True,
                    max_tokens=4096,
                    temperature=self.config_store.get("temperature", 0.7),
                )

                finish_reason = None

                async for chunk in stream:
                    choice = chunk.choices[0] if chunk.choices else None
                    if not choice:
                        continue

                    delta = choice.delta
                    finish_reason = choice.finish_reason or finish_reason

                    # Accumulate text
                    if delta.content:
                        accumulated_text += delta.content
                        await self._send_event("text", {"content": delta.content})

                    # Accumulate tool calls
                    if delta.tool_calls:
                        for tc in delta.tool_calls:
                            idx = tc.index
                            if idx not in tool_calls_raw:
                                tool_calls_raw[idx] = {
                                    "id": tc.id or "",
                                    "name": tc.function.name or "" if tc.function else "",
                                    "arguments_str": ""
                                }
                            if tc.id:
                                tool_calls_raw[idx]["id"] = tc.id
                            if tc.function:
                                if tc.function.name:
                                    tool_calls_raw[idx]["name"] = tc.function.name
                                if tc.function.arguments:
                                    tool_calls_raw[idx]["arguments_str"] += tc.function.arguments

            except Exception as e:
                await self._send_event("error", {"message": f"LLM error: {str(e)}"})
                return

            # Build the assistant message to append
            # Use empty string (not None) for content when only tool_calls are present —
            # some API providers reject null content fields.
            assistant_message: Dict[str, Any] = {"role": "assistant", "content": accumulated_text or ""}

            # If there are tool calls, process them
            if tool_calls_raw:
                # Attach tool_calls to assistant message
                tool_calls_list = []
                for idx in sorted(tool_calls_raw.keys()):
                    tc = tool_calls_raw[idx]
                    tool_calls_list.append({
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": tc["name"],
                            "arguments": tc["arguments_str"]
                        }
                    })

                assistant_message["tool_calls"] = tool_calls_list
                api_messages.append(assistant_message)

                # Execute each tool call
                for tc_item in tool_calls_list:
                    tool_name = tc_item["function"]["name"]
                    tool_id = tc_item["id"]

                    # Parse arguments
                    try:
                        tool_args = json.loads(tc_item["function"]["arguments"] or "{}")
                    except json.JSONDecodeError:
                        tool_args = {}

                    # Notify frontend: tool is being called
                    await self._send_event("tool_call", {
                        "id": tool_id,
                        "name": tool_name,
                        "args": tool_args,
                    })

                    # Execute the tool
                    success, result = await executor.execute_tool(tool_name, tool_args)

                    # Notify frontend: tool result
                    await self._send_event("tool_result", {
                        "id": tool_id,
                        "name": tool_name,
                        "success": success,
                        "output": result,
                    })

                    # Append tool result to messages
                    api_messages.append({
                        "role": "tool",
                        "tool_call_id": tool_id,
                        "content": result,
                    })

                # Continue the loop to let the LLM process tool results
                continue

            else:
                # No tool calls → agent is done
                api_messages.append(assistant_message)
                await self._send_event("done", {
                    "total_iterations": iteration,
                    "message": "Task completed"
                })
                return

        # Hit max iterations
        await self._send_event("done", {
            "total_iterations": max_iterations,
            "message": f"Reached maximum iterations ({max_iterations})"
        })
