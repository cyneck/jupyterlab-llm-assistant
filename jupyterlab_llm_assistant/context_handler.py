"""
Context file handler for the LLM Assistant extension.

Allows users to include specific files or directory listings as context
that will be prepended to LLM requests.

Endpoints:
  POST /llm-assistant/context/read   - Read one or more files and return content
  POST /llm-assistant/context/resolve - Resolve a glob / directory listing
"""

import json
import os
import glob as _glob
from typing import List, Optional, Dict, Any
from tornado import web
from jupyter_server.base.handlers import APIHandler


MAX_FILE_SIZE = 512 * 1024   # 512 KB per file
MAX_FILES = 20               # Max files per request
MAX_TOTAL_CHARS = 200_000    # Approx 50k tokens budget for context


class ContextReadHandler(APIHandler):
    """
    POST /llm-assistant/context/read

    Request body:
    {
        "paths": ["/absolute/path/to/file", "relative/path"],
        "rootDir": "/optional/root"   // relative paths resolved from here
    }

    Response:
    {
        "files": [
            {
                "path": "...",
                "content": "...",
                "lines": 42,
                "size": 1234,
                "error": null
            },
            ...
        ],
        "totalChars": 12345,
        "truncated": false
    }
    """

    @web.authenticated
    async def post(self):
        try:
            body = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        paths: List[str] = body.get("paths", [])
        root_dir: str = body.get("rootDir") or os.getcwd()

        if not paths:
            raise web.HTTPError(400, "paths is required")

        # Limit number of files
        paths = paths[:MAX_FILES]

        files = []
        total_chars = 0
        truncated = False

        for raw_path in paths:
            resolved = _resolve(raw_path, root_dir)
            entry: Dict[str, Any] = {"path": raw_path, "content": None, "lines": 0, "size": 0, "error": None}

            if not os.path.exists(resolved):
                entry["error"] = f"File not found: {raw_path}"
                files.append(entry)
                continue

            if not os.path.isfile(resolved):
                entry["error"] = f"Not a file: {raw_path}"
                files.append(entry)
                continue

            size = os.path.getsize(resolved)
            entry["size"] = size

            if size > MAX_FILE_SIZE:
                entry["error"] = f"File too large ({size // 1024} KB). Max {MAX_FILE_SIZE // 1024} KB."
                files.append(entry)
                continue

            if total_chars >= MAX_TOTAL_CHARS:
                entry["error"] = "Context budget exceeded — file skipped."
                truncated = True
                files.append(entry)
                continue

            try:
                with open(resolved, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()

                # Trim if we'd exceed total budget
                remaining = MAX_TOTAL_CHARS - total_chars
                if len(content) > remaining:
                    content = content[:remaining] + "\n... [truncated]"
                    truncated = True

                entry["content"] = content
                entry["lines"] = content.count("\n") + 1
                total_chars += len(content)

            except Exception as e:
                entry["error"] = str(e)

            files.append(entry)

        self.finish(json.dumps({
            "files": files,
            "totalChars": total_chars,
            "truncated": truncated,
        }))


class ContextResolveHandler(APIHandler):
    """
    POST /llm-assistant/context/resolve

    Resolve a directory path or glob pattern to a list of file paths.
    Useful for the frontend to enumerate files before reading them.

    Request body:
    {
        "path": "/some/directory",        // dir or glob
        "rootDir": "/optional/root",
        "maxFiles": 50                    // optional, default 50
    }

    Response:
    {
        "paths": ["file1.py", "file2.ts", ...],
        "isDir": true,
        "totalFound": 12
    }
    """

    # Directories to skip when listing
    SKIP_DIRS = frozenset([
        "node_modules", "__pycache__", ".git", "dist", "build",
        "lib", ".venv", "venv", ".mypy_cache", ".pytest_cache",
        "coverage", ".next", "out",
    ])

    # File extensions considered "text" and safe to read
    TEXT_EXTENSIONS = frozenset([
        ".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
        ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
        ".md", ".txt", ".rst", ".sh", ".bash", ".zsh", ".env",
        ".css", ".scss", ".less", ".html", ".htm", ".xml", ".svg",
        ".sql", ".graphql", ".proto", ".go", ".rs", ".rb", ".java",
        ".c", ".cpp", ".h", ".hpp", ".cs", ".kt", ".swift", ".r",
        ".ipynb", ".dockerfile", "Dockerfile", ".gitignore",
        ".editorconfig", "Makefile", "requirements.txt", "Pipfile",
        "package.json", "tsconfig.json", "pyproject.toml",
    ])

    @web.authenticated
    async def post(self):
        try:
            body = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        path: str = body.get("path", ".")
        root_dir: str = body.get("rootDir") or os.getcwd()
        max_files: int = min(int(body.get("maxFiles", 50)), 200)

        resolved = _resolve(path, root_dir)

        if not os.path.exists(resolved):
            raise web.HTTPError(404, f"Path not found: {path}")

        paths: List[str] = []

        if os.path.isfile(resolved):
            paths = [path]
            is_dir = False
        elif os.path.isdir(resolved):
            is_dir = True
            for root, dirs, files in os.walk(resolved):
                # Skip noise directories in-place
                dirs[:] = [d for d in dirs if d not in self.SKIP_DIRS and not d.startswith(".")]
                for fname in sorted(files):
                    ext = os.path.splitext(fname)[1].lower()
                    # Include files with known text extensions
                    if ext in self.TEXT_EXTENSIONS or fname in self.TEXT_EXTENSIONS:
                        fpath = os.path.join(root, fname)
                        # Return paths relative to root_dir
                        try:
                            rel = os.path.relpath(fpath, root_dir)
                        except ValueError:
                            rel = fpath
                        paths.append(rel)
                        if len(paths) >= max_files:
                            break
                if len(paths) >= max_files:
                    break
        else:
            # Treat as glob
            is_dir = False
            matched = _glob.glob(resolved, recursive=True)
            for fpath in sorted(matched)[:max_files]:
                if os.path.isfile(fpath):
                    try:
                        rel = os.path.relpath(fpath, root_dir)
                    except ValueError:
                        rel = fpath
                    paths.append(rel)

        self.finish(json.dumps({
            "paths": paths[:max_files],
            "isDir": is_dir,
            "totalFound": len(paths),
        }))


class ContextListDirHandler(APIHandler):
    """
    POST /llm-assistant/context/listdir

    List immediate children (one level) of a directory.
    Returns both files and subdirectories so the frontend can
    render a drill-down tree for the @ mention picker.

    Request body:
    {
        "path": "src",              // relative or absolute path to a directory
        "rootDir": "/optional/root"
    }

    Response:
    {
        "entries": [
            {"name": "index.ts",  "path": "src/index.ts",  "isDir": false},
            {"name": "components","path": "src/components","isDir": true},
            ...
        ]
    }
    """

    SKIP_NAMES = frozenset([
        "node_modules", "__pycache__", ".git", "dist", "build",
        "lib", ".venv", "venv", ".mypy_cache", ".pytest_cache",
        "coverage", ".next", "out",
    ])

    @web.authenticated
    async def post(self):
        try:
            body = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        path: str = body.get("path", ".")
        root_dir: str = body.get("rootDir") or os.getcwd()

        resolved = _resolve(path, root_dir)

        if not os.path.exists(resolved):
            raise web.HTTPError(404, f"Path not found: {path}")

        entries = []

        if os.path.isfile(resolved):
            # Single file — return it as the only entry
            try:
                rel = os.path.relpath(resolved, root_dir)
            except ValueError:
                rel = resolved
            entries = [{"name": os.path.basename(resolved), "path": rel, "isDir": False}]

        elif os.path.isdir(resolved):
            try:
                names = sorted(os.listdir(resolved))
            except PermissionError:
                names = []

            for name in names:
                if name.startswith(".") or name in self.SKIP_NAMES:
                    continue
                full = os.path.join(resolved, name)
                try:
                    rel = os.path.relpath(full, root_dir)
                except ValueError:
                    rel = full
                entries.append({
                    "name": name,
                    "path": rel,
                    "isDir": os.path.isdir(full),
                })

        self.finish(json.dumps({"entries": entries}))


# ─── Helper ───────────────────────────────────────────────────────────────────

def _resolve(path: str, root_dir: str) -> str:
    """Resolve a path relative to root_dir (absolute paths kept as-is)."""
    if os.path.isabs(path):
        return path
    return os.path.normpath(os.path.join(root_dir, path))
