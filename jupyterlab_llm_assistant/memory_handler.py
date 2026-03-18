"""
Memory management handler for the LLM Assistant extension.

Provides persistent memory storage that can be injected into conversations.
Memories are stored as key-value pairs with optional tags and metadata.

Endpoints:
  GET  /llm-assistant/memory        - List all memories
  POST /llm-assistant/memory        - Create a new memory
  PUT  /llm-assistant/memory/<id>   - Update a memory
  DELETE /llm-assistant/memory/<id> - Delete a memory
  GET  /llm-assistant/memory/export - Export all memories as text block
"""

import json
import os
import time
import uuid
from typing import Dict, Any, List, Optional, Tuple
from tornado import web
from jupyter_server.base.handlers import APIHandler


# Default storage path: ~/.jupyter/llm_assistant_memories.json
DEFAULT_MEMORY_FILE = os.path.join(
    os.path.expanduser("~"), ".jupyter", "llm_assistant_memories.json"
)


class MemoryStore:
    """
    Persistent key-value memory store backed by a JSON file.
    
    Each memory entry has:
      - id: unique identifier (UUID)
      - title: short title / key (required)
      - content: full text content (required)
      - tags: list of string tags for categorisation (optional)
      - enabled: whether to inject this memory into conversations
      - created_at: Unix timestamp
      - updated_at: Unix timestamp
    """

    def __init__(self, file_path: str = DEFAULT_MEMORY_FILE):
        self.file_path = file_path
        self._memories: List[Dict[str, Any]] = []
        self._load()

    # ── Persistence ───────────────────────────────────────────────────────────

    def _load(self):
        """Load memories from disk."""
        try:
            if os.path.exists(self.file_path):
                with open(self.file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._memories = data.get("memories", [])
        except Exception:
            self._memories = []

    def _save(self):
        """Persist memories to disk."""
        try:
            os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump({"memories": self._memories}, f, ensure_ascii=False, indent=2)
        except Exception as e:
            # Non-fatal — log but don't raise
            print(f"[llm-assistant] Warning: could not save memories: {e}")

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def list_all(self) -> List[Dict[str, Any]]:
        """Return all memory entries."""
        return list(self._memories)

    def get(self, memory_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific memory by id."""
        for m in self._memories:
            if m["id"] == memory_id:
                return m
        return None

    def create(
        self,
        title: str,
        content: str,
        tags: Optional[List[str]] = None,
        enabled: bool = True,
    ) -> Dict[str, Any]:
        """Create a new memory entry."""
        now = int(time.time() * 1000)
        entry = {
            "id": str(uuid.uuid4()),
            "title": title.strip(),
            "content": content.strip(),
            "tags": tags or [],
            "enabled": enabled,
            "created_at": now,
            "updated_at": now,
        }
        self._memories.insert(0, entry)  # newest first
        self._save()
        return entry

    def update(
        self,
        memory_id: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
        tags: Optional[List[str]] = None,
        enabled: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        """Update an existing memory entry."""
        for m in self._memories:
            if m["id"] == memory_id:
                if title is not None:
                    m["title"] = title.strip()
                if content is not None:
                    m["content"] = content.strip()
                if tags is not None:
                    m["tags"] = tags
                if enabled is not None:
                    m["enabled"] = enabled
                m["updated_at"] = int(time.time() * 1000)
                self._save()
                return m
        return None

    def delete(self, memory_id: str) -> bool:
        """Delete a memory entry. Returns True if found and deleted."""
        before = len(self._memories)
        self._memories = [m for m in self._memories if m["id"] != memory_id]
        if len(self._memories) < before:
            self._save()
            return True
        return False

    # ── Export ────────────────────────────────────────────────────────────────

    def export_as_text(self) -> str:
        """
        Export all *enabled* memories as a formatted text block
        suitable for injection into an LLM system prompt.
        """
        enabled = [m for m in self._memories if m.get("enabled", True)]
        if not enabled:
            return ""

        lines = ["## Persistent Memory\n"]
        lines.append("The following information has been stored in your long-term memory. "
                     "Use it to personalise your responses and avoid asking for information "
                     "the user has already provided.\n")
        for m in enabled:
            lines.append(f"### {m['title']}")
            lines.append(m["content"])
            if m.get("tags"):
                lines.append(f"*Tags: {', '.join(m['tags'])}*")
            lines.append("")  # blank line between entries

        return "\n".join(lines)

    def export_as_list(self) -> List[Dict[str, str]]:
        """
        Export enabled memories as a simple list of {title, content} dicts.
        """
        return [
            {"title": m["title"], "content": m["content"]}
            for m in self._memories
            if m.get("enabled", True)
        ]


# ─── Singleton ────────────────────────────────────────────────────────────────

# One global MemoryStore shared across all handler instances for this process
_memory_store: Optional[MemoryStore] = None


def get_memory_store() -> MemoryStore:
    global _memory_store
    if _memory_store is None:
        _memory_store = MemoryStore()
    return _memory_store


# ─── Tornado Handlers ─────────────────────────────────────────────────────────

class MemoryListHandler(APIHandler):
    """
    GET  /llm-assistant/memory  → list all memories
    POST /llm-assistant/memory  → create a memory
    """

    @web.authenticated
    async def get(self):
        store = get_memory_store()
        self.finish(json.dumps({"memories": store.list_all()}))

    @web.authenticated
    async def post(self):
        try:
            body = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        title = body.get("title", "").strip()
        content = body.get("content", "").strip()
        if not title:
            raise web.HTTPError(400, "title is required")
        if not content:
            raise web.HTTPError(400, "content is required")

        tags = body.get("tags", [])
        enabled = body.get("enabled", True)

        store = get_memory_store()
        entry = store.create(title=title, content=content, tags=tags, enabled=enabled)
        self.set_status(201)
        self.finish(json.dumps(entry))


class MemoryItemHandler(APIHandler):
    """
    PUT    /llm-assistant/memory/<id> → update
    DELETE /llm-assistant/memory/<id> → delete
    """

    @web.authenticated
    async def put(self, memory_id: str):
        try:
            body = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        store = get_memory_store()
        updated = store.update(
            memory_id=memory_id,
            title=body.get("title"),
            content=body.get("content"),
            tags=body.get("tags"),
            enabled=body.get("enabled"),
        )
        if updated is None:
            raise web.HTTPError(404, f"Memory not found: {memory_id}")
        self.finish(json.dumps(updated))

    @web.authenticated
    async def delete(self, memory_id: str):
        store = get_memory_store()
        if not store.delete(memory_id):
            raise web.HTTPError(404, f"Memory not found: {memory_id}")
        self.set_status(204)
        self.finish()


class MemoryExportHandler(APIHandler):
    """
    GET /llm-assistant/memory/export → export enabled memories as text
    """

    @web.authenticated
    async def get(self):
        store = get_memory_store()
        self.finish(json.dumps({
            "text": store.export_as_text(),
            "list": store.export_as_list(),
            "count": len([m for m in store.list_all() if m.get("enabled", True)]),
        }))
