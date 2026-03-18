"""
Plan handler — two-phase planning + execution mode.

Phase 1 — Generate Plan  (POST /llm-assistant/plan/generate)
  Streams a step-by-step plan as SSE text chunks.  The plan is returned as a
  JSON list of {id, title, description} objects inside a fenced ```json block.

Phase 2 — Execute Step   (POST /llm-assistant/plan/execute)
  Executes a single plan step through the agent loop (same as AgentHandler)
  and streams SSE events.  The frontend calls this once per confirmed step.
"""

import json
import os
import re
from typing import Dict, Any, List, Optional

from tornado import web
from jupyter_server.base.handlers import APIHandler
from openai import AsyncOpenAI

from .agent_tools import AgentToolExecutor
from .agent_loop import run_agent_loop
from .memory_handler import get_memory_store

# ─── Shared base ─────────────────────────────────────────────────────────────

DEFAULT_API_ENDPOINT = "https://api.openai.com/v1"
DEFAULT_MODEL = "gpt-4o"


class BasePlanHandler(APIHandler):
    """Minimal base that provides config_store injection and _get_api_key."""

    def initialize(self, config_store: Dict[str, Any]):
        self.config_store = config_store

    def _get_config(self) -> Dict[str, Any]:
        """Get current config from memory store."""
        return dict(self.config_store)

    def _get_api_key(self) -> Optional[str]:
        """Get API key from config_store or environment."""
        return self.config_store.get("apiKey") or os.environ.get("OPENAI_API_KEY")

    async def _send_event(self, event_type: str, data: Any):
        payload = json.dumps({"type": event_type, "data": data})
        self.write(f"data: {payload}\n\n")
        await self.flush()


# ─── Prompts ──────────────────────────────────────────────────────────────────

PLAN_GENERATE_SYSTEM = """You are an expert AI project planner embedded in JupyterLab.

Your job is to break down the user's task into a clear, ordered set of discrete steps
that can be executed one at a time by a coding agent.

Output ONLY a JSON array (no prose, no markdown wrapping) of step objects in this exact format:
[
  {"id": 1, "title": "Short action title (≤60 chars)", "description": "Detailed description of what will be done in this step, including relevant file names, commands, etc."},
  ...
]

Rules:
- Between 2 and 10 steps (use as few as needed).
- Each step should be independently executable by the agent.
- "title" is displayed as a headline — keep it short and verb-first (e.g. "Create config file").
- "description" explains exactly what the agent should do (the agent will receive it verbatim).
- Do NOT include steps like "Review" or "Test" unless the user explicitly asks for them.
- Output ONLY the JSON array, nothing else."""


PLAN_EXECUTE_SYSTEM = """You are an expert AI coding assistant with access to tools that let you read, write, and execute code.
You are executing ONE specific step from a larger plan.

## Available Tools
- **read_file**: Read any file
- **write_file**: Create or overwrite files
- **edit_file**: Make precise str_replace edits to existing files
- **bash**: Execute shell commands
- **list_dir**: Explore directory structures
- **grep_search**: Search for patterns across files
- **notebook_execute**: Execute Python code in the Jupyter kernel

## Rules
- Focus ONLY on the current step — do not try to do other steps.
- Always read a file before modifying it.
- Be concise but thorough.
- Report what you did at the end."""


class PlanGenerateHandler(BasePlanHandler):
    """
    POST /llm-assistant/plan/generate

    Generate a step-by-step plan for a task.
    Streams SSE events:
      - text  : raw JSON array fragment (streaming)
      - plan  : parsed plan array {steps: [...]}
      - error : {message}
    """

    @web.authenticated
    async def post(self):
        try:
            body = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        task = body.get("task", "").strip()
        context_text = body.get("contextText", "")

        if not task:
            raise web.HTTPError(400, "task is required")
        if not self._get_api_key():
            raise web.HTTPError(401, "API key not configured")

        # SSE setup
        self.set_header("Content-Type", "text/event-stream")
        self.set_header("Cache-Control", "no-cache")
        self.set_header("Connection", "keep-alive")
        self.set_header("X-Accel-Buffering", "no")

        # Build system prompt (with optional memories)
        memory_text = get_memory_store().export_as_text()
        system_content = PLAN_GENERATE_SYSTEM
        if memory_text:
            system_content = system_content + "\n\n" + memory_text

        user_content = task
        if context_text:
            user_content = f"{context_text}\n\n---\n\nTask: {task}"

        # Use config from memory store, with per-request overrides from body
        config = self._get_config()
        for key in ("model", "temperature", "maxTokens", "apiEndpoint"):
            if key in body:
                config[key] = body[key]

        client = AsyncOpenAI(
            api_key=self._get_api_key(),
            base_url=config.get("apiEndpoint", DEFAULT_API_ENDPOINT),
            timeout=120.0,
        )
        model = config.get("model", DEFAULT_MODEL)

        accumulated = ""
        try:
            stream = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_content},
                    {"role": "user", "content": user_content},
                ],
                stream=True,
                max_tokens=2048,
                temperature=0.3,
            )
            async for chunk in stream:
                choice = chunk.choices[0] if chunk.choices else None
                if not choice:
                    continue
                delta = choice.delta
                if delta.content:
                    accumulated += delta.content
                    await self._send_event("text", {"content": delta.content})

            # Try to parse the accumulated JSON
            steps = _parse_plan_json(accumulated)
            await self._send_event("plan", {"steps": steps})

        except Exception as e:
            await self._send_event("error", {"message": str(e)})
        finally:
            self.write("data: [DONE]\n\n")
            await self.flush()
            self.finish()


class PlanExecuteHandler(BasePlanHandler):
    """
    POST /llm-assistant/plan/execute

    Execute one plan step through the agent loop.
    Request body:
      {
        "step": {"id": 1, "title": "...", "description": "..."},
        "history": [...],          // conversation history so far
        "rootDir": "/path",        // optional
        "contextText": "..."       // optional
      }
    Streams the same SSE events as AgentHandler.
    """

    @web.authenticated
    async def post(self):
        try:
            body = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        step = body.get("step", {})
        history = body.get("history", [])
        root_dir = body.get("rootDir") or os.getcwd()
        context_text = body.get("contextText", "")
        max_iterations = min(body.get("maxIterations", 15), 30)

        if not step or not step.get("description"):
            raise web.HTTPError(400, "step.description is required")
        if not self._get_api_key():
            raise web.HTTPError(401, "API key not configured")

        # SSE setup
        self.set_header("Content-Type", "text/event-stream")
        self.set_header("Cache-Control", "no-cache")
        self.set_header("Connection", "keep-alive")
        self.set_header("X-Accel-Buffering", "no")

        # Merge per-request overrides (model, temperature, maxTokens) into a
        # shallow copy of config_store so the server-wide store is not mutated.
        effective_config = dict(self.config_store)
        for key in ("model", "temperature", "maxTokens"):
            if key in body:
                effective_config[key] = body[key]

        # Build system prompt
        memory_text = get_memory_store().export_as_text()
        system_content = PLAN_EXECUTE_SYSTEM
        if memory_text:
            system_content = system_content + "\n\n" + memory_text

        # Build the step instruction message
        step_id = step.get("id", "?")
        step_title = step.get("title", "")
        step_desc = step.get("description", "")

        step_msg = f"## Step {step_id}: {step_title}\n\n{step_desc}"
        if context_text and not history:
            # Inject context only on the very first step
            step_msg = f"{context_text}\n\n---\n\n{step_msg}"

        # Build message list: prior history + this step
        api_messages = [{"role": "system", "content": system_content}]
        api_messages += [{"role": m["role"], "content": m["content"]} for m in history]
        api_messages.append({"role": "user", "content": step_msg})

        client = AsyncOpenAI(
            api_key=self._get_api_key(),
            base_url=effective_config.get("apiEndpoint", DEFAULT_API_ENDPOINT),
            timeout=120.0,
        )
        model = effective_config.get("model", DEFAULT_MODEL)
        executor = AgentToolExecutor(root_dir=root_dir)

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


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_plan_json(raw: str) -> List[Dict[str, Any]]:
    """
    Extract and parse the JSON plan array from raw LLM output.
    Handles both bare JSON and ```json fenced blocks.
    """
    raw = raw.strip()

    # Strip code fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)

    # Find the outermost JSON array
    start = raw.find("[")
    end = raw.rfind("]")
    if start != -1 and end != -1 and end > start:
        raw = raw[start:end + 1]

    try:
        steps = json.loads(raw)
        if not isinstance(steps, list):
            raise ValueError("Expected a JSON array")
        # Validate and normalize
        result = []
        for i, s in enumerate(steps):
            result.append({
                "id": s.get("id", i + 1),
                "title": str(s.get("title", f"Step {i + 1}")),
                "description": str(s.get("description", "")),
                "status": "pending",
            })
        return result
    except Exception:
        # Fallback: return a single step with the raw content as description
        return [{"id": 1, "title": "Execute task", "description": raw, "status": "pending"}]
