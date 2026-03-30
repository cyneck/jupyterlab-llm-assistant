"""
Workspace handler — manages the per-project .llm-assistant/ hidden directory.

Inspired by Claude Code's .claude/ directory, this module provides:

1. ASSISTANT.md  — project-level instruction file injected into every
                    conversation (like Claude Code's CLAUDE.md).
2. sessions/     — conversation history as JSON files, one per session.
3. skills/       — installed skill manifests (YAML/JSON) for the skill system.
4. cache/        — lightweight cache for resolved file trees, etc.

Note: Configuration (config.json) is now stored at USER level (~/.llm-assistant/)
to avoid accidentally committing sensitive values (API keys) to git repositories.
See WorkspaceConfigHandler for user-level config management.

Directory layout:
    <project_root>/
    └── .llm-assistant/
        ├── ASSISTANT.md       # Project instructions for the LLM
        ├── sessions/          # Saved conversation history
        │   ├── <session_id>.json
        │   └── ...
        └── skills/            # Installed skill manifests
            ├── <skill_name>.yaml
            └── ...

User-level config location:
    ~/.llm-assistant/config.json  # Per-user LLM config (model, temperature, etc.)

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
SESSIONS_DIR_NAME = "sessions"
SKILLS_DIR_NAME = "skills"

# User-level config location (not project-level, to avoid committing secrets)
USER_CONFIG_DIR = Path.home() / ".llm-assistant"
USER_CONFIG_FILE = USER_CONFIG_DIR / "config.json"

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
    GET  /llm-assistant/workspace/config  → user-level config from ~/.llm-assistant/config.json
    PUT  /llm-assistant/workspace/config  ← partial update

    Note: Config is stored at user level (~/.llm-assistant/config.json) instead of
    project level to avoid accidentally committing sensitive values (API keys) to git.
    """

    ALLOWED_KEYS = {"model", "temperature", "maxTokens", "systemPrompt", "apiEndpoint"}

    def initialize(self, config_store: Dict[str, Any]):
        self.config_store = config_store

    @web.authenticated
    async def get(self):
        # Always read from user-level config
        cfg: Dict[str, Any] = {}
        if USER_CONFIG_FILE.exists():
            try:
                cfg = json.loads(USER_CONFIG_FILE.read_text(encoding="utf-8"))
            except Exception:
                cfg = {}

        self.finish(json.dumps({"config": cfg, "path": str(USER_CONFIG_FILE)}))

    @web.authenticated
    async def put(self):
        try:
            body = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        # Ensure user config directory exists
        USER_CONFIG_DIR.mkdir(parents=True, exist_ok=True)

        # Load existing user-level config
        existing: Dict[str, Any] = {}
        if USER_CONFIG_FILE.exists():
            try:
                existing = json.loads(USER_CONFIG_FILE.read_text(encoding="utf-8"))
            except Exception:
                pass

        # Merge allowed keys
        for key in self.ALLOWED_KEYS:
            if key in body:
                existing[key] = body[key]

        USER_CONFIG_FILE.write_text(json.dumps(existing, indent=2), encoding="utf-8")

        # Sync to in-memory config_store and persist (keeps config.json and config_store in sync)
        for key in self.ALLOWED_KEYS:
            if key in existing:
                self.config_store[key] = existing[key]

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
    body: { name?, url?, manifest? }

    Supports three installation methods:
    1. From manifest dict: { name: "my-skill", manifest: { name: "...", ... } }
    2. From URL: { url: "https://github.com/..." }
    3. From GitHub shorthand: { url: "github:user/repo/skill-name" }
    """

    @web.authenticated
    async def post(self):
        try:
            body = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        root_dir = body.get("rootDir", "")
        ws = _workspace_dir(root_dir)
        _ensure_dirs(ws)
        skills_dir = ws / SKILLS_DIR_NAME

        url = body.get("url", "").strip()
        name = body.get("name", "").strip()
        manifest_raw = body.get("manifest")

        if url:
            # Install from URL
            try:
                from .skill_resolver import install_skill_from_url, is_github_url

                # Handle GitHub shorthand syntax: github:user/repo/skill-name
                if url.startswith('github:'):
                    parts = url[7:].split('/')
                    if len(parts) >= 3:
                        user, repo, skill_name = parts[0], parts[1], '/'.join(parts[2:])
                        url = f"https://github.com/{user}/{repo}/tree/main/{skill_name}"
                    else:
                        raise web.HTTPError(400, "Invalid GitHub shorthand format. Use: github:user/repo/skill-name")

                # Resolve GitHub URLs
                if is_github_url(url):
                    from .skill_resolver import GitHubURLResolver
                    resolved_url, _ = GitHubURLResolver.resolve(url)
                    if not resolved_url:
                        # It's a directory URL, resolve_skill_from_url will handle it
                        resolved_url = url

                final_name, path = install_skill_from_url(
                    skill_url=url,
                    target_dir=skills_dir,
                    skill_name=name or None,
                )

                self.finish(json.dumps({
                    "ok": True,
                    "path": str(path),
                    "name": final_name,
                    "source": "url" if not is_github_url(url) else "github",
                }))
                return

            except Exception as e:
                raise web.HTTPError(500, f"Failed to install skill from URL: {e}")

        # Install from manifest
        if manifest_raw is None:
            raise web.HTTPError(400, "Either 'url' or 'manifest' is required")

        if not name:
            raise web.HTTPError(400, "name is required when installing from manifest")

        if isinstance(manifest_raw, dict):
            manifest_str = yaml.dump(manifest_raw)
        else:
            manifest_str = str(manifest_raw)

        path = skills_dir / f"{name}.yaml"
        path.write_text(manifest_str, encoding="utf-8")

        self.finish(json.dumps({"ok": True, "path": str(path), "name": name}))


# ── SkillItemHandler ────────────────────────────────────────────────────────────

class SkillItemHandler(APIHandler):
    """
    DELETE /llm-assistant/workspace/skills/<name>  — delete a skill
    PATCH /llm-assistant/workspace/skills/<name>  — update a skill (enable/disable/system_prompt)
    """

    def _find_skill_path(self, skills_dir: Path, skill_name: str) -> Optional[tuple]:
        """Find the skill file path and return (path, type) or None."""
        # Check single-file skills
        for ext in (".yaml", ".yml"):
            path = skills_dir / f"{skill_name}{ext}"
            if path.exists():
                return (path, "file")

        # Check directory skills
        dir_path = skills_dir / skill_name
        if dir_path.is_dir():
            for manifest_name in ("skill.yaml", "skill.yml"):
                manifest_path = dir_path / manifest_name
                if manifest_path.exists():
                    return (manifest_path, "directory")

        return None

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

    @web.authenticated
    async def patch(self, skill_name: str):
        root_dir = self.get_argument("rootDir", "")
        ws = _workspace_dir(root_dir)
        skills_dir = ws / SKILLS_DIR_NAME

        # Find the skill file
        result = self._find_skill_path(skills_dir, skill_name)
        if not result:
            raise web.HTTPError(404, f"Skill not found: {skill_name}")

        skill_path, skill_type = result

        # Load current manifest
        try:
            manifest = yaml.safe_load(skill_path.read_text(encoding="utf-8")) or {}
        except Exception as e:
            raise web.HTTPError(500, f"Failed to read skill manifest: {e}")

        # Parse request body
        try:
            body = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        # Update fields
        if "enabled" in body:
            manifest["enabled"] = bool(body["enabled"])
        if "system_prompt" in body:
            manifest["system_prompt"] = str(body["system_prompt"])
        if "description" in body:
            manifest["description"] = str(body["description"])

        # Write back
        try:
            skill_path.write_text(yaml.dump(manifest), encoding="utf-8")
        except Exception as e:
            raise web.HTTPError(500, f"Failed to write skill manifest: {e}")

        # Return updated skill info
        skill = SkillManifest.from_yaml(manifest, str(skill_path), skill_type)
        self.finish(json.dumps({"ok": True, "skill": skill.to_dict()}))


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


def load_user_config() -> Dict[str, Any]:
    """
    Load user-level config overrides from ~/.llm-assistant/config.json.
    Returns empty dict if not present.

    Note: This replaces the old project-level config to avoid committing
    sensitive values (API keys) to git repositories.
    """
    if USER_CONFIG_FILE.exists():
        try:
            return json.loads(USER_CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


# ── Skill Loading & Application ─────────────────────────────────────────────────

class SkillManifest:
    """Represents a loaded skill manifest."""

    def __init__(
        self,
        name: str,
        version: str = "",
        description: str = "",
        author: str = "",
        enabled: bool = True,
        system_prompt: str = "",
        tools: Optional[List[Dict[str, Any]]] = None,
        path: str = "",
        skill_type: str = "file",
    ):
        self.name = name
        self.version = version
        self.description = description
        self.author = author
        self.enabled = enabled
        self.system_prompt = system_prompt
        self.tools = tools or []
        self.path = path
        self.type = skill_type

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "author": self.author,
            "enabled": self.enabled,
            "systemPrompt": self.system_prompt,
            "tools": self.tools,
            "path": self.path,
            "type": self.type,
        }

    @classmethod
    def from_yaml(cls, data: Dict[str, Any], path: str, skill_type: str = "file") -> "SkillManifest":
        return cls(
            name=data.get("name", Path(path).stem),
            version=data.get("version", ""),
            description=data.get("description", ""),
            author=data.get("author", ""),
            enabled=data.get("enabled", True),
            system_prompt=data.get("system_prompt", ""),
            tools=data.get("tools", []),
            path=path,
            skill_type=skill_type,
        )


def load_skills(root_dir: str = "") -> List[SkillManifest]:
    """
    Load all skill manifests from the .llm-assistant/skills/ directory.

    Supports two formats:
    - Single-file: skills/<name>.yaml
    - Directory: skills/<name>/skill.yaml

    Returns only enabled skills.
    """
    ws = _workspace_dir(root_dir)
    skills_dir = ws / SKILLS_DIR_NAME
    skills: List[SkillManifest] = []

    if not skills_dir.exists():
        return skills

    # Load single-file skills
    for f in skills_dir.glob("*.yaml"):
        try:
            manifest = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
            skill = SkillManifest.from_yaml(manifest, str(f), "file")
            if skill.enabled:
                skills.append(skill)
        except Exception:
            continue

    for f in skills_dir.glob("*.yml"):
        try:
            manifest = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
            skill = SkillManifest.from_yaml(manifest, str(f), "file")
            if skill.enabled:
                skills.append(skill)
        except Exception:
            continue

    # Load directory skills
    for d in skills_dir.iterdir():
        if not d.is_dir():
            continue
        for manifest_name in ("skill.yaml", "skill.yml"):
            manifest_path = d / manifest_name
            if manifest_path.exists():
                try:
                    manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8")) or {}
                    skill = SkillManifest.from_yaml(manifest, str(d), "directory")
                    if skill.enabled:
                        skills.append(skill)
                except Exception:
                    continue
                break

    return skills


def load_skill_manifests(root_dir: str = "") -> List[SkillManifest]:
    """
    Load all skill manifests (including disabled) from the .llm-assistant/skills/ directory.
    Returns all skills regardless of enabled status.
    """
    ws = _workspace_dir(root_dir)
    skills_dir = ws / SKILLS_DIR_NAME
    skills: List[SkillManifest] = []

    if not skills_dir.exists():
        return skills

    # Load single-file skills
    for f in skills_dir.glob("*.yaml"):
        try:
            manifest = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
            skill = SkillManifest.from_yaml(manifest, str(f), "file")
            skills.append(skill)
        except Exception:
            continue

    for f in skills_dir.glob("*.yml"):
        try:
            manifest = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
            skill = SkillManifest.from_yaml(manifest, str(f), "file")
            skills.append(skill)
        except Exception:
            continue

    # Load directory skills
    for d in skills_dir.iterdir():
        if not d.is_dir():
            continue
        for manifest_name in ("skill.yaml", "skill.yml"):
            manifest_path = d / manifest_name
            if manifest_path.exists():
                try:
                    manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8")) or {}
                    skill = SkillManifest.from_yaml(manifest, str(d), "directory")
                    skills.append(skill)
                except Exception:
                    continue
                break

    return skills


def apply_skills_to_system_prompt(
    base_system_prompt: str,
    root_dir: str = "",
    include_memory: bool = True,
) -> str:
    """
    Build an enriched system prompt by injecting enabled skill system_prompts.

    Format:
    <base_system_prompt>

    <!-- Skill: <skill_name> -->
    <skill_system_prompt>
    <!-- EndSkill: <skill_name> -->

    ... for each enabled skill

    Also injects skill tools as JSON in a comment block for the LLM to use.
    """
    skills = load_skills(root_dir)

    if not skills and not include_memory:
        return base_system_prompt

    # Load memory if requested
    memory_text = ""
    if include_memory:
        try:
            from .memory_handler import get_memory_store
            memory_store = get_memory_store()
            memory_text = memory_store.export_as_text()
        except Exception:
            memory_text = ""

    # Build enriched system prompt
    result = base_system_prompt

    # Collect skill tools for injection
    all_skill_tools = []

    # Inject skill system prompts and collect tools
    for skill in skills:
        if skill.system_prompt:
            result += f"\n\n<!-- Skill: {skill.name} -->\n{skill.system_prompt}\n<!-- EndSkill: {skill.name} -->"

        # Collect tool definitions from skill
        if skill.tools:
            for tool in skill.tools:
                if tool.get('name'):
                    all_skill_tools.append(tool)

    # Inject skill tools as JSON (for LLM to understand available functions)
    if all_skill_tools:
        tools_json = json.dumps(all_skill_tools, indent=2)
        result += f"\n\n<!-- Skill Tools -->\n{tools_json}\n<!-- EndSkillTools -->"

    # Inject memory
    if memory_text:
        result += f"\n\n<!-- Memory -->\n{memory_text}\n<!-- EndMemory -->"

    return result


def get_skill_tools_for_agent(root_dir: str = "") -> List[Dict[str, Any]]:
    """
    Get all tool definitions from enabled skills.

    Returns list of tool definitions in OpenAI function format.
    """
    from .skill_resolver import get_skill_tool_loader

    skills = load_skills(root_dir)
    all_tools = []

    # Get skill tool loader
    ws = _workspace_dir(root_dir)
    skills_dir = ws / SKILLS_DIR_NAME

    if not skills_dir.exists():
        return all_tools

    loader = get_skill_tool_loader(skills_dir)

    # Load tools from each enabled skill
    for skill in skills:
        tools = loader.load_skill_tools(skill.name)
        all_tools.extend(tools)

    return all_tools
