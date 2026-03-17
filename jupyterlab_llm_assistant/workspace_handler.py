"""
Workspace handler — manages the per-project .llm-assistant/ hidden directory.

Inspired by Claude Code's .claude/ directory, this module provides:

1. ASSISTANT.md  — project-level instruction file injected into every
                    conversation (like Claude Code's CLAUDE.md).
2. sessions/     — conversation history as JSON files, one per session.
3. config.json   — per-project overrides for model, temperature, system prompt.
4. skills/       — installed skill manifests (YAML/JSON) for the skill system.
5. cache/        — lightweight cache for resolved file trees, etc.

Directory layout:
    <project_root>/
    └── .llm-assistant/
        ├── ASSISTANT.md       # Project instructions for the LLM
        ├── config.json        # Per-project LLM config overrides
        ├── sessions/
        │   ├── <session_id>.json
        │   └── ...
        └── skills/
            ├── <skill_name>.yaml  (installed skill manifests)
            └── ...

Endpoints:
    GET  /llm-assistant/workspace/info
         → { rootDir, hasAssistantMd, sessionCount, skillCount }

    GET  /llm-assistant/workspace/assistant-md
         → { content: "..." }  (or "" if not present)

    PUT  /llm-assistant/workspace/assistant-md
         body: { content: "..." }
         → { ok: true }

    GET  /llm-assistant/workspace/config
         → { model: ..., temperature: ..., systemPrompt: ... }

    PUT  /llm-assistant/workspace/config
         body: { model?, temperature?, maxTokens?, systemPrompt? }
         → { ok: true }

    GET  /llm-assistant/workspace/sessions
         → { sessions: [{ id, summary, savedAt, mode, messageCount }] }

    POST /llm-assistant/workspace/sessions
         body: { id, summary, mode, messages: [...], history: [...] }
         → { ok: true, id }

    GET  /llm-assistant/workspace/sessions/<id>
         → { session }

    DELETE /llm-assistant/workspace/sessions/<id>
         → { ok: true }

    GET  /llm-assistant/workspace/skills
         → { skills: [{ name, description, version, enabled }] }

    POST /llm-assistant/workspace/skills/install
         body: { name, url, manifest? }
         → { ok: true }

    DELETE /llm-assistant/workspace/skills/<name>
         → { ok: true }

TODO (Skill System):
    Each skill manifest (YAML) follows this schema:
    ─────────────────────────────────────────────────
    name: my_skill
    version: "1.0.0"
    description: "Does something useful"
    author: "Your Name"
    # Optional: extra system prompt fragment injected before the conversation
    system_prompt: |
      You have access to a special tool ...
    # Optional: list of tool definitions (Python callables)
    tools:
      - name: my_tool
        description: "A custom tool"
        module: my_skill.tools   # Python module path inside skills/<name>/
        function: run
    ─────────────────────────────────────────────────
    Skills are loaded from .llm-assistant/skills/<name>/skill.yaml
    or as a single-file .llm-assistant/skills/<name>.yaml.
"""

import json
import os
import shutil
import uuid
import yaml
import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from tornado import web
from jupyter_server.base.handlers import APIHandler


# ── Constants ─────────────────────────────────────────────────────────────────

WORKSPACE_DIR_NAME = ".llm-assistant"
ASSISTANT_MD_NAME = "ASSISTANT.md"
CONFIG_FILE_NAME = "config.json"
SESSIONS_DIR_NAME = "sessions"
SKILLS_DIR_NAME = "skills"

MAX_SESSION_SIZE = 2 * 1024 * 1024   # 2 MB per session file
MAX_SESSIONS = 200


# ── Helpers ───────────────────────────────────────────────────────────────────

def _workspace_dir(root_dir: str = "") -> Path:
    """Return the Path to the .llm-assistant directory for the given root."""
    base = Path(root_dir) if root_dir else Path(os.getcwd())
    return base / WORKSPACE_DIR_NAME


def _ensure_dirs(ws: Path) -> None:
    """Create the workspace directory structure if missing."""
    ws.mkdir(parents=True, exist_ok=True)
    (ws / SESSIONS_DIR_NAME).mkdir(exist_ok=True)
    (ws / SKILLS_DIR_NAME).mkdir(exist_ok=True)


def _get_root_dir(body: dict) -> str:
    return body.get("rootDir", "") or ""


# ── WorkspaceInfoHandler ───────────────────────────────────────────────────────

class WorkspaceInfoHandler(APIHandler):
    """GET /llm-assistant/workspace/info"""

    @web.authenticated
    async def get(self):
        root_dir = self.get_argument("rootDir", "")
        ws = _workspace_dir(root_dir)

        has_assistant_md = (ws / ASSISTANT_MD_NAME).exists()
        session_count = 0
        skill_count = 0

        if ws.exists():
            sessions_dir = ws / SESSIONS_DIR_NAME
            if sessions_dir.exists():
                session_count = len(list(sessions_dir.glob("*.json")))
            skills_dir = ws / SKILLS_DIR_NAME
            if skills_dir.exists():
                skill_count = (
                    len(list(skills_dir.glob("*.yaml")))
                    + len(list(skills_dir.glob("*.yml")))
                    + len([d for d in skills_dir.iterdir() if d.is_dir()])
                )

        self.finish(json.dumps({
            "rootDir": str(ws.parent),
            "workspaceDir": str(ws),
            "hasAssistantMd": has_assistant_md,
            "sessionCount": session_count,
            "skillCount": skill_count,
            "exists": ws.exists(),
        }))


# ── AssistantMdHandler ─────────────────────────────────────────────────────────

class AssistantMdHandler(APIHandler):
    """
    GET  /llm-assistant/workspace/assistant-md  → { content }
    PUT  /llm-assistant/workspace/assistant-md  ← { content }
    """

    DEFAULT_CONTENT = """\
# Project Instructions for LLM Assistant

<!-- This file is automatically read before every conversation in this project. -->
<!-- Add project-specific context, conventions, and instructions below.        -->

## Project Overview

<!-- Describe the project briefly -->

## Coding Conventions

<!-- Language, framework, style guides, etc. -->

## Key Files

<!-- List important files / directories the assistant should know about -->

## Preferences

<!-- Preferred approaches, forbidden patterns, etc. -->
"""

    @web.authenticated
    async def get(self):
        root_dir = self.get_argument("rootDir", "")
        ws = _workspace_dir(root_dir)
        md_path = ws / ASSISTANT_MD_NAME

        if md_path.exists():
            content = md_path.read_text(encoding="utf-8")
        else:
            content = ""

        self.finish(json.dumps({
            "content": content,
            "path": str(md_path),
            "exists": md_path.exists(),
            "defaultContent": self.DEFAULT_CONTENT,
        }))

    @web.authenticated
    async def put(self):
        try:
            body = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        root_dir = body.get("rootDir", "")
        content: str = body.get("content", "")

        ws = _workspace_dir(root_dir)
        _ensure_dirs(ws)
        md_path = ws / ASSISTANT_MD_NAME
        md_path.write_text(content, encoding="utf-8")

        self.finish(json.dumps({"ok": True, "path": str(md_path)}))


# ── WorkspaceConfigHandler ─────────────────────────────────────────────────────

class WorkspaceConfigHandler(APIHandler):
    """
    GET  /llm-assistant/workspace/config  → per-project overrides
    PUT  /llm-assistant/workspace/config  ← partial update
    """

    ALLOWED_KEYS = {"model", "temperature", "maxTokens", "systemPrompt", "apiEndpoint"}

    @web.authenticated
    async def get(self):
        root_dir = self.get_argument("rootDir", "")
        ws = _workspace_dir(root_dir)
        cfg_path = ws / CONFIG_FILE_NAME

        cfg: Dict[str, Any] = {}
        if cfg_path.exists():
            try:
                cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
            except Exception:
                cfg = {}

        self.finish(json.dumps({"config": cfg, "path": str(cfg_path)}))

    @web.authenticated
    async def put(self):
        try:
            body = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        root_dir = body.get("rootDir", "")
        ws = _workspace_dir(root_dir)
        cfg_path = ws / CONFIG_FILE_NAME

        # Load existing
        existing: Dict[str, Any] = {}
        if cfg_path.exists():
            try:
                existing = json.loads(cfg_path.read_text(encoding="utf-8"))
            except Exception:
                pass

        # Merge allowed keys
        for key in self.ALLOWED_KEYS:
            if key in body:
                existing[key] = body[key]

        _ensure_dirs(ws)
        cfg_path.write_text(json.dumps(existing, indent=2), encoding="utf-8")

        self.finish(json.dumps({"ok": True, "config": existing}))


# ── SessionListHandler ─────────────────────────────────────────────────────────

class SessionListHandler(APIHandler):
    """
    GET  /llm-assistant/workspace/sessions  → list summaries
    POST /llm-assistant/workspace/sessions  ← save a session
    """

    @web.authenticated
    async def get(self):
        root_dir = self.get_argument("rootDir", "")
        ws = _workspace_dir(root_dir)
        sessions_dir = ws / SESSIONS_DIR_NAME

        summaries = []
        if sessions_dir.exists():
            # Sort by modification time (newest first)
            for f in sorted(sessions_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
                try:
                    data = json.loads(f.read_text(encoding="utf-8"))
                    # Use filename (without .json) as id
                    summaries.append({
                        "id": f.stem,  # e.g., "20250318_143022_123"
                        "summary": data.get("summary", "(no summary)"),
                        "savedAt": data.get("savedAt", 0),
                        "mode": data.get("mode", "chat"),
                        "messageCount": len(data.get("messages", [])),
                    })
                except Exception:
                    continue

        self.finish(json.dumps({"sessions": summaries[:MAX_SESSIONS]}))

    @web.authenticated
    async def post(self):
        try:
            body = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        root_dir = body.get("rootDir", "")
        ws = _workspace_dir(root_dir)
        _ensure_dirs(ws)
        sessions_dir = ws / SESSIONS_DIR_NAME

        now = datetime.datetime.now()
        provided_id = body.get("id")

        # Check if we're updating an existing session
        # "default" is a special value meaning "create new session"
        if provided_id and provided_id != "default":
            existing_path = sessions_dir / f"{provided_id}.json"
            if existing_path.exists():
                # Update existing session file (keep original filename)
                filename = provided_id
            else:
                # Provided id doesn't exist, create new with that id as filename
                filename = provided_id
        else:
            # Generate timestamp-based filename for new session
            filename = now.strftime("%Y%m%d_%H%M%S")
            filename += f"_{now.microsecond // 1000:03d}"

        payload = {
            "id": filename,
            "summary": body.get("summary", "(no summary)"),
            "savedAt": body.get("savedAt", int(now.timestamp() * 1000)),
            "mode": body.get("mode", "chat"),
            "messages": body.get("messages", []),
            "history": body.get("history", []),
        }

        raw = json.dumps(payload)
        if len(raw) > MAX_SESSION_SIZE:
            raise web.HTTPError(413, "Session too large (max 2 MB)")

        # Save to file (update existing or create new)
        path = sessions_dir / f"{filename}.json"
        path.write_text(raw, encoding="utf-8")

        self.finish(json.dumps({"ok": True, "id": filename}))


# ── SessionItemHandler ─────────────────────────────────────────────────────────

class SessionItemHandler(APIHandler):
    """
    GET    /llm-assistant/workspace/sessions/<id>
    DELETE /llm-assistant/workspace/sessions/<id>
    """

    @web.authenticated
    async def get(self, session_id: str):
        # Guard against path traversal (e.g. "../config")
        if ".." in session_id or "/" in session_id or "\\" in session_id:
            raise web.HTTPError(400, f"Invalid session id: {session_id}")

        root_dir = self.get_argument("rootDir", "")
        ws = _workspace_dir(root_dir)
        path = ws / SESSIONS_DIR_NAME / f"{session_id}.json"

        if not path.exists():
            raise web.HTTPError(404, f"Session not found: {session_id}")

        self.set_header("Content-Type", "application/json")
        self.finish(path.read_text(encoding="utf-8"))

    @web.authenticated
    async def delete(self, session_id: str):
        # Guard against path traversal
        if ".." in session_id or "/" in session_id or "\\" in session_id:
            raise web.HTTPError(400, f"Invalid session id: {session_id}")

        root_dir = self.get_argument("rootDir", "")
        ws = _workspace_dir(root_dir)
        path = ws / SESSIONS_DIR_NAME / f"{session_id}.json"

        if path.exists():
            path.unlink()

        self.finish(json.dumps({"ok": True}))


# ── SkillListHandler ───────────────────────────────────────────────────────────

class SkillListHandler(APIHandler):
    """
    GET  /llm-assistant/workspace/skills  → list installed skills
    """

    @web.authenticated
    async def get(self):
        root_dir = self.get_argument("rootDir", "")
        ws = _workspace_dir(root_dir)
        skills_dir = ws / SKILLS_DIR_NAME
        skills = []

        if skills_dir.exists():
            # Single-file skills: skills/<name>.yaml
            for f in skills_dir.glob("*.yaml"):
                try:
                    manifest = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
                    skills.append({
                        "name": manifest.get("name", f.stem),
                        "description": manifest.get("description", ""),
                        "version": manifest.get("version", ""),
                        "enabled": manifest.get("enabled", True),
                        "path": str(f),
                        "type": "file",
                    })
                except Exception:
                    continue

            # Directory skills: skills/<name>/skill.yaml
            for d in skills_dir.iterdir():
                if not d.is_dir():
                    continue
                manifest_path = d / "skill.yaml"
                if not manifest_path.exists():
                    manifest_path = d / "skill.yml"
                if manifest_path.exists():
                    try:
                        manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8")) or {}
                        skills.append({
                            "name": manifest.get("name", d.name),
                            "description": manifest.get("description", ""),
                            "version": manifest.get("version", ""),
                            "enabled": manifest.get("enabled", True),
                            "path": str(d),
                            "type": "directory",
                        })
                    except Exception:
                        continue

        self.finish(json.dumps({"skills": skills}))


# ── SkillInstallHandler ────────────────────────────────────────────────────────

class SkillInstallHandler(APIHandler):
    """
    POST /llm-assistant/workspace/skills/install
    body: { name, manifest }   — manifest is a YAML string or dict
    """

    @web.authenticated
    async def post(self):
        try:
            body = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        root_dir = body.get("rootDir", "")
        name: str = body.get("name", "").strip()
        if not name:
            raise web.HTTPError(400, "name is required")

        manifest_raw = body.get("manifest", "")
        if isinstance(manifest_raw, dict):
            manifest_str = yaml.dump(manifest_raw)
        else:
            manifest_str = str(manifest_raw)

        ws = _workspace_dir(root_dir)
        _ensure_dirs(ws)
        skills_dir = ws / SKILLS_DIR_NAME

        path = skills_dir / f"{name}.yaml"
        path.write_text(manifest_str, encoding="utf-8")

        self.finish(json.dumps({"ok": True, "path": str(path)}))


# ── SkillDeleteHandler ─────────────────────────────────────────────────────────

class SkillDeleteHandler(APIHandler):
    """DELETE /llm-assistant/workspace/skills/<name>"""

    @web.authenticated
    async def delete(self, skill_name: str):
        root_dir = self.get_argument("rootDir", "")
        ws = _workspace_dir(root_dir)
        skills_dir = ws / SKILLS_DIR_NAME
        deleted = False

        for ext in (".yaml", ".yml"):
            path = skills_dir / f"{skill_name}{ext}"
            if path.exists():
                path.unlink()
                deleted = True

        dir_path = skills_dir / skill_name
        if dir_path.is_dir():
            shutil.rmtree(dir_path)
            deleted = True

        if not deleted:
            raise web.HTTPError(404, f"Skill not found: {skill_name}")

        self.finish(json.dumps({"ok": True}))


# ── AssistantMdLoaderMixin ─────────────────────────────────────────────────────

def load_assistant_md(root_dir: str = "") -> str:
    """
    Load the ASSISTANT.md content for the given project root.

    This is called by agent_handler and chat_handler to prepend project
    instructions to every conversation.

    Returns empty string if the file doesn't exist.
    """
    ws = _workspace_dir(root_dir)
    md_path = ws / ASSISTANT_MD_NAME
    if md_path.exists():
        try:
            return md_path.read_text(encoding="utf-8")
        except Exception:
            return ""
    return ""


def load_project_config(root_dir: str = "") -> Dict[str, Any]:
    """
    Load per-project config overrides from .llm-assistant/config.json.
    Returns empty dict if not present.
    """
    ws = _workspace_dir(root_dir)
    cfg_path = ws / CONFIG_FILE_NAME
    if cfg_path.exists():
        try:
            return json.loads(cfg_path.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}
