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
from .workspace_handler import apply_skills_to_system_prompt, get_skill_tools_for_agent, load_skills, _workspace_dir


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

## How to Work (ReAct Loop)
You operate in an autonomous ReAct loop:
1. **Understand** - Analyze the user's request carefully
2. **Explore** - Use list_dir, grep_search, and read_file to understand the codebase structure and existing code
3. **Plan** - Formulate a plan (internally, don't just list steps - execute them)
4. **Execute** - Use tools to make changes, run commands, verify results
5. **Iterate** - If something doesn't work, fix it. Keep going until the task is complete.
6. **Report** - Explain what you did and why

## Important Rules
- **ALWAYS explore first** - Before making changes, read relevant files and understand the codebase
- **Read before writing** - Always read a file before modifying it
- **WRITE FILES, don't just output code** - When the user asks you to "write/create/generate a file" or "write code", you MUST use `write_file` to actually create the file on disk. Never just output code blocks in your response - always write to the actual file.
- **Be autonomous** - Don't ask the user for confirmation. Make decisions and execute them.
- **Verify your work** - Run tests, check syntax, verify changes work as expected
- **DON'T run blocking servers** - Never run commands that start long-running servers (e.g., `python app.py` for FastAPI/Flask, `npm start`, `uvicorn main:app`). These will hang indefinitely. Instead:
  - Use syntax check: `python -m py_compile app.py`
  - Or run with timeout: `timeout 3 python app.py` (just to verify it starts)
  - Or check with: `uvicorn main:app --help` to verify the command works
  - For log verification: use `nohup command > output.log 2>&1 &`, then `sleep 2 && cat output.log`, and finally `kill $(pgrep -f "command pattern")` to clean up
- **SAFETY FIRST** - Avoid destructive operations without explicit confirmation:
  - **NEVER use** `rm -rf /`, `rm -rf ~`, `rm -rf /*` or wildcard deletions like `rm *.py` without checking what matches first
  - **NEVER use** `sed -i` for in-place edits without backup - use `edit_file` tool instead, it's safer
  - **NEVER kill** system processes (pid 1, sshd, jupyter, init, systemd) or processes you didn't start
  - **NEVER modify** `/etc`, system config files, or other users' files
  - **ALWAYS use** the specific `edit_file` or `write_file` tools instead of `sed`/`awk` in-place edits
  - **Before deleting**, list what will be affected: `ls pattern` before `rm pattern`
- **Report clearly** - Explain what you did, what files you changed, and why
- **Keep going** - Continue iterating until the task is fully complete. Don't stop after one attempt if it didn't work.

## When to Stop
Only stop when:
- The task is fully completed AND verified
- You've made the requested changes AND confirmed they work
- You've explained what was done

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
        # Apply skills (including system prompts and custom tools)
        system_content = apply_skills_to_system_prompt(
            AGENT_SYSTEM_PROMPT,
            root_dir=root_dir,
            include_memory=True,
        )

        # Get skill tools for agent execution
        skill_tools = get_skill_tools_for_agent(root_dir=root_dir)

        # Register skill tools with executor
        if skill_tools:
            from .skill_resolver import get_skill_tool_loader
            ws = _workspace_dir(root_dir)
            skills_dir = ws / SKILLS_DIR_NAME
            loader = get_skill_tool_loader(skills_dir)

            # Get skill tool functions and register them
            skills = load_skills(root_dir)
            for skill in skills:
                tool_funcs = loader.load_skill_tools(skill.name)
                for tool_def in tool_funcs:
                    tool_name = tool_def.get('function', {}).get('name')
                    if tool_name:
                        func = loader.get_tool_function(skill.name, tool_name)
                        if func:
                            executor.register_skill_tool(tool_name, func)

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
                skill_tools=skill_tools if skill_tools else None,
            )
        except Exception as e:
            await self._send_event("error", {"message": str(e)})
        finally:
            self.write("data: [DONE]\n\n")
            await self.flush()
            self.finish()
