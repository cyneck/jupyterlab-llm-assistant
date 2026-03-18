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
import os
from typing import Dict, Any, List, Optional
from tornado import web
from jupyter_server.base.handlers import APIHandler
from openai import AsyncOpenAI

from .agent_tools import AGENT_TOOLS, AgentToolExecutor
from .agent_loop import run_agent_loop
from .memory_handler import get_memory_store


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

DEFAULT_API_ENDPOINT = "https://api.openai.com/v1"
DEFAULT_MODEL = "gpt-4o"


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
        """Get API key from config_store or environment."""
        return self.config_store.get("apiKey") or os.environ.get("OPENAI_API_KEY")

    def _get_config(self) -> Dict[str, Any]:
        """Get current config from memory store."""
        return dict(self.config_store)

    def _create_client(self) -> AsyncOpenAI:
        config = self._get_config()
        return AsyncOpenAI(
            api_key=self._get_api_key(),
            base_url=config.get("apiEndpoint", DEFAULT_API_ENDPOINT),
            timeout=120.0,
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

        # Build an effective config that merges server config with any
        # per-request overrides sent by the frontend (model, temperature, maxTokens).
        effective_config = self._get_config()
        for key in ("model", "temperature", "maxTokens"):
            if key in body:
                effective_config[key] = body[key]

        model = effective_config.get("model", DEFAULT_MODEL)

        client = AsyncOpenAI(
            api_key=self._get_api_key(),
            base_url=effective_config.get("apiEndpoint", DEFAULT_API_ENDPOINT),
            timeout=120.0,
        )
        executor = AgentToolExecutor(root_dir=root_dir)

        # Build initial message list with system prompt
        # Inject active memories into the system prompt
        memory_store = get_memory_store()
        memory_text = memory_store.export_as_text()

        system_content = AGENT_SYSTEM_PROMPT
        if memory_text:
            system_content = AGENT_SYSTEM_PROMPT + "\n\n" + memory_text

        api_messages = [
            {"role": "system", "content": system_content}
        ] + [{"role": m["role"], "content": m["content"]} for m in messages]

        try:
            await run_agent_loop(
                send_event=self._send_event,
                client=client,
                executor=executor,
                api_messages=api_messages,
                model=model,
                max_iterations=max_iterations,
                config_store=effective_config,
            )
        except Exception as e:
            await self._send_event("error", {"message": str(e)})
        finally:
            self.write("data: [DONE]\n\n")
            await self.flush()
            self.finish()
