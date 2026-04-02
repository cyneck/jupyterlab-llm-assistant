"""
Agent tools for the LLM coding assistant.

Implements core tools similar to Claude Code:
- read_file: Read file contents
- write_file: Write/create files
- bash: Execute shell commands
- list_dir: List directory contents
- grep_search: Search for patterns in files
"""

import os
import json
import asyncio
import subprocess
import fnmatch
from typing import Dict, Any, List, Optional, Tuple


# Tool definitions in OpenAI function-calling format
AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file at the given path. Use this to examine existing code, configs, or text files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The absolute or relative path to the file to read."
                    },
                    "start_line": {
                        "type": "integer",
                        "description": "Optional: 1-based line number to start reading from."
                    },
                    "end_line": {
                        "type": "integer",
                        "description": "Optional: 1-based line number to stop reading at (inclusive)."
                    }
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write content to a file, creating it if it doesn't exist or overwriting if it does. Use this to create new files or update existing ones.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The absolute or relative path to the file to write."
                    },
                    "content": {
                        "type": "string",
                        "description": "The content to write to the file."
                    },
                    "create_dirs": {
                        "type": "boolean",
                        "description": "If true, create parent directories if they don't exist. Default: true."
                    }
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "bash",
            "description": "Execute a shell command and return its output. Use for running tests, installing packages, building projects, git operations, etc. Commands run in the current working directory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The shell command to execute."
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds. Default: 30. Max: 120."
                    },
                    "cwd": {
                        "type": "string",
                        "description": "Working directory for the command. Defaults to the Jupyter root."
                    }
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_dir",
            "description": "List the contents of a directory. Shows files and subdirectories with basic metadata.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The directory path to list. Defaults to current directory."
                    },
                    "recursive": {
                        "type": "boolean",
                        "description": "If true, list recursively. Default: false."
                    },
                    "max_depth": {
                        "type": "integer",
                        "description": "Maximum depth for recursive listing. Default: 3."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "edit_file",
            "description": "Make precise edits to an existing file by replacing specific text. This is safer than write_file for targeted changes — use it to modify a function, fix a bug, or update a value without rewriting the entire file. Always read the file first to get the exact text to replace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The absolute or relative path to the file to edit."
                    },
                    "old_str": {
                        "type": "string",
                        "description": "The exact string to find and replace. Must match exactly (including whitespace/indentation). The string should be unique in the file to avoid ambiguous replacements."
                    },
                    "new_str": {
                        "type": "string",
                        "description": "The replacement string. Can be empty to delete the matched text."
                    },
                    "replace_all": {
                        "type": "boolean",
                        "description": "If true, replace all occurrences. Default: false (replace first occurrence only)."
                    }
                },
                "required": ["path", "old_str", "new_str"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "grep_search",
            "description": "Search for a pattern in files using grep. Returns matching lines with file paths and line numbers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "The search pattern (supports regex)."
                    },
                    "path": {
                        "type": "string",
                        "description": "Directory or file to search in. Defaults to current directory."
                    },
                    "file_pattern": {
                        "type": "string",
                        "description": "Glob pattern for files to search (e.g., '*.py', '*.ts'). Optional."
                    },
                    "case_sensitive": {
                        "type": "boolean",
                        "description": "Whether search is case sensitive. Default: false."
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of results to return. Default: 50."
                    }
                },
                "required": ["pattern"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "notebook_execute",
            "description": "Execute Python code directly in the Jupyter kernel and return the output (stdout, stderr, and rich outputs like DataFrames). Use this to run experiments, test snippets, verify data shapes, or call Python functions without creating a file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "The Python code to execute."
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds. Default: 30. Max: 120."
                    }
                },
                "required": ["code"]
            }
        }
    }
]


class AgentToolExecutor:
    """
    Executes agent tools safely.
    """

    def __init__(self, root_dir: Optional[str] = None):
        """
        Initialize the tool executor.

        Args:
            root_dir: Root directory for file operations. Defaults to cwd.
        """
        self.root_dir = root_dir or os.getcwd()
        # Registry of skill tool functions: { tool_name: callable }
        self._skill_tools: Dict[str, callable] = {}

    def register_skill_tool(self, tool_name: str, func: callable) -> None:
        """
        Register a skill tool function.

        Args:
            tool_name: Name of the tool
            func: Callable that takes tool_args dict and returns (success, result)
        """
        self._skill_tools[tool_name] = func

    def _resolve_path(self, path: str) -> str:
        """Resolve a path relative to the root directory.

        Absolute paths are anchored inside root_dir to prevent path traversal.
        """
        if os.path.isabs(path):
            # Strip leading slash so absolute paths are treated as relative to root_dir
            rel = os.path.relpath(path, '/')
            resolved = os.path.realpath(os.path.join(self.root_dir, rel))
        else:
            resolved = os.path.realpath(os.path.join(self.root_dir, path))
        # Allow the resolved path only if it stays within root_dir
        # (symlinks are already resolved by realpath above)
        root_real = os.path.realpath(self.root_dir)
        if not resolved.startswith(root_real):
            # Fall back to treating the original path as-is (for system tools like /usr/bin/python3)
            # but only for reads — callers that write should enforce this.
            # Return the raw resolution and let the caller decide.
            return os.path.abspath(path) if os.path.isabs(path) else os.path.join(self.root_dir, path)
        return resolved

    async def execute_tool(self, tool_name: str, tool_args: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Execute a tool and return (success, result_string).

        Args:
            tool_name: Name of the tool to execute
            tool_args: Arguments for the tool

        Returns:
            Tuple of (success, result)
        """
        try:
            # Check if it's a registered skill tool
            if tool_name in self._skill_tools:
                func = self._skill_tools[tool_name]
                try:
                    result = func(tool_args)
                    # Handle both sync and async functions
                    if hasattr(result, '__await__'):
                        result = await result
                    if isinstance(result, tuple) and len(result) == 2:
                        return result
                    else:
                        return True, str(result)
                except Exception as e:
                    return False, f"Skill tool error: {str(e)}"

            if tool_name == "read_file":
                return await self._read_file(**tool_args)
            elif tool_name == "write_file":
                return await self._write_file(**tool_args)
            elif tool_name == "edit_file":
                return await self._edit_file(**tool_args)
            elif tool_name == "bash":
                return await self._bash(**tool_args)
            elif tool_name == "list_dir":
                return await self._list_dir(**tool_args)
            elif tool_name == "grep_search":
                return await self._grep_search(**tool_args)
            elif tool_name == "notebook_execute":
                return await self._notebook_execute(**tool_args)
            else:
                return False, f"Unknown tool: {tool_name}"
        except Exception as e:
            return False, f"Tool execution error: {str(e)}"

    async def _read_file(
        self,
        path: str,
        start_line: Optional[int] = None,
        end_line: Optional[int] = None
    ) -> Tuple[bool, str]:
        """Read file contents."""
        resolved = self._resolve_path(path)

        if not os.path.exists(resolved):
            return False, f"File not found: {path}"

        if not os.path.isfile(resolved):
            return False, f"Path is not a file: {path}"

        # Check file size (limit to 1MB)
        size = os.path.getsize(resolved)
        if size > 1024 * 1024:
            return False, f"File too large ({size} bytes). Max 1MB."

        try:
            with open(resolved, 'r', encoding='utf-8', errors='replace') as f:
                lines = f.readlines()

            # Apply line range if specified
            if start_line is not None or end_line is not None:
                start = (start_line - 1) if start_line else 0
                end = end_line if end_line else len(lines)
                lines = lines[start:end]
                line_offset = start + 1
            else:
                line_offset = 1

            # Format with line numbers
            numbered = []
            for i, line in enumerate(lines):
                numbered.append(f"{line_offset + i:4d}: {line}")

            content = "".join(numbered)
            total_lines = len(lines)
            header = f"File: {path} ({total_lines} lines shown)\n{'─' * 50}\n"
            return True, header + content

        except Exception as e:
            return False, f"Error reading file: {str(e)}"

    async def _write_file(
        self,
        path: str,
        content: str,
        create_dirs: bool = True
    ) -> Tuple[bool, str]:
        """Write content to a file."""
        resolved = self._resolve_path(path)

        if create_dirs:
            os.makedirs(os.path.dirname(resolved) if os.path.dirname(resolved) else '.', exist_ok=True)

        action = "Updated" if os.path.exists(resolved) else "Created"

        try:
            with open(resolved, 'w', encoding='utf-8') as f:
                f.write(content)

            lines = content.count('\n') + 1
            return True, f"{action} file: {path} ({lines} lines, {len(content)} bytes)"

        except Exception as e:
            return False, f"Error writing file: {str(e)}"

    async def _bash(
        self,
        command: str,
        timeout: int = 30,
        cwd: Optional[str] = None
    ) -> Tuple[bool, str]:
        """Execute a shell command."""
        # Clamp timeout
        timeout = min(max(timeout, 1), 120)

        work_dir = cwd or self.root_dir

        # Ensure work_dir exists, fallback to current working directory
        if not os.path.isdir(work_dir):
            work_dir = os.getcwd()

        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=work_dir,
                env={**os.environ}
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()  # Reap the zombie process
                return False, f"Command timed out after {timeout}s: {command}"

            stdout_str = stdout.decode('utf-8', errors='replace')
            stderr_str = stderr.decode('utf-8', errors='replace')

            # Limit output size
            max_output = 8000
            combined = ""
            if stdout_str:
                combined += stdout_str
            if stderr_str:
                combined += f"\n[stderr]\n{stderr_str}" if stdout_str else stderr_str

            if len(combined) > max_output:
                combined = combined[:max_output] + f"\n... (truncated, {len(combined)} total chars)"

            exit_code = proc.returncode
            header = f"$ {command}\n[in: {work_dir}] [exit: {exit_code}]\n{'─' * 40}\n"

            if exit_code == 0:
                return True, header + (combined or "(no output)")
            else:
                return False, header + (combined or "(no output)")

        except Exception as e:
            return False, f"Error executing command: {str(e)}"

    async def _list_dir(
        self,
        path: str = ".",
        recursive: bool = False,
        max_depth: int = 3
    ) -> Tuple[bool, str]:
        """List directory contents."""
        resolved = self._resolve_path(path)

        if not os.path.exists(resolved):
            return False, f"Directory not found: {path}"

        if not os.path.isdir(resolved):
            return False, f"Path is not a directory: {path}"

        try:
            lines = [f"Directory: {path}\n{'─' * 40}"]

            def _list_recursive(dir_path: str, prefix: str = "", depth: int = 0):
                if depth > max_depth:
                    return
                try:
                    entries = sorted(os.scandir(dir_path), key=lambda e: (not e.is_dir(), e.name))
                except PermissionError:
                    lines.append(f"{prefix}[Permission Denied]")
                    return

                for i, entry in enumerate(entries):
                    # Skip hidden files and common noise dirs
                    if entry.name.startswith('.') and entry.name not in ['.env', '.gitignore']:
                        continue
                    if entry.name in ['node_modules', '__pycache__', '.git', 'dist', 'build', 'lib']:
                        if entry.is_dir():
                            lines.append(f"{prefix}{'└── ' if i == len(entries)-1 else '├── '}{entry.name}/ [skipped]")
                            continue

                    is_last = (i == len(entries) - 1)
                    connector = "└── " if is_last else "├── "
                    child_prefix = prefix + ("    " if is_last else "│   ")

                    if entry.is_dir():
                        lines.append(f"{prefix}{connector}{entry.name}/")
                        if recursive:
                            _list_recursive(entry.path, child_prefix, depth + 1)
                    else:
                        size = entry.stat().st_size
                        size_str = f"{size:,}" if size < 1024 else f"{size//1024:,}KB"
                        lines.append(f"{prefix}{connector}{entry.name} ({size_str})")

            _list_recursive(resolved)
            return True, "\n".join(lines)

        except Exception as e:
            return False, f"Error listing directory: {str(e)}"

    async def _edit_file(
        self,
        path: str,
        old_str: str,
        new_str: str,
        replace_all: bool = False,
    ) -> Tuple[bool, str]:
        """Make a precise str_replace edit to a file."""
        resolved = self._resolve_path(path)

        if not os.path.exists(resolved):
            return False, f"File not found: {path}"
        if not os.path.isfile(resolved):
            return False, f"Path is not a file: {path}"

        try:
            with open(resolved, 'r', encoding='utf-8', errors='replace') as f:
                original = f.read()
        except Exception as e:
            return False, f"Error reading file: {str(e)}"

        count = original.count(old_str)
        if count == 0:
            # Provide a helpful snippet of the file for debugging
            preview = original[:300].replace('\n', '↵')
            return False, (
                f"String not found in {path}.\n"
                f"Make sure the text matches exactly (including whitespace).\n"
                f"File preview (first 300 chars): {preview}"
            )

        if not replace_all and count > 1:
            return False, (
                f"Found {count} occurrences of the search string in {path}. "
                f"Provide a more specific/unique string, or set replace_all=true."
            )

        if replace_all:
            updated = original.replace(old_str, new_str)
            replacements = count
        else:
            updated = original.replace(old_str, new_str, 1)
            replacements = 1

        try:
            with open(resolved, 'w', encoding='utf-8') as f:
                f.write(updated)
        except Exception as e:
            return False, f"Error writing file: {str(e)}"

        lines_before = original.count('\n') + 1
        lines_after = updated.count('\n') + 1
        return True, (
            f"Edited {path}: replaced {replacements} occurrence(s). "
            f"Lines: {lines_before} → {lines_after}"
        )

    async def _notebook_execute(
        self,
        code: str,
        timeout: int = 30,
    ) -> Tuple[bool, str]:
        """
        Execute Python code using the current Jupyter kernel via jupyter_client.

        Falls back to subprocess execution if no kernel is available.
        """
        timeout = min(max(timeout, 1), 120)

        # Try jupyter_client KernelManager approach first
        try:
            import jupyter_client
            # Try to connect to a running kernel via the connection files
            cf_dir = jupyter_client.find_connection_file()
            km = jupyter_client.BlockingKernelClient(connection_file=cf_dir)
            km.load_connection_file()
            km.start_channels()
            try:
                km.wait_for_ready(timeout=10)
                msg_id = km.execute(code)
                outputs = []
                while True:
                    try:
                        msg = km.get_iopub_msg(timeout=timeout)
                        msg_type = msg['msg_type']
                        content = msg.get('content', {})
                        if msg_type == 'stream':
                            outputs.append(content.get('text', ''))
                        elif msg_type == 'execute_result':
                            data = content.get('data', {})
                            outputs.append(data.get('text/plain', ''))
                        elif msg_type == 'display_data':
                            data = content.get('data', {})
                            outputs.append(data.get('text/plain', '[display data]'))
                        elif msg_type == 'error':
                            tb = '\n'.join(content.get('traceback', []))
                            # Strip ANSI color codes
                            import re
                            tb = re.sub(r'\x1b\[[0-9;]*m', '', tb)
                            return False, f"Kernel error:\n{tb}"
                        elif msg_type == 'status' and content.get('execution_state') == 'idle':
                            break
                    except Exception:
                        break
                result = ''.join(outputs)
                return True, result or "(no output)"
            finally:
                km.stop_channels()
        except Exception:
            pass

        # Fallback: write code to a temp file and execute it with python3.
        #
        # WHY NOT python3 -c:
        #   When LLM-generated code is passed via JSON, real newlines inside the
        #   code string become literal \n in the shell command line. Python's -c
        #   flag then sees \n as an escaped backslash + 'n' (line-continuation
        #   character), causing an immediate SyntaxError for any multi-line code.
        #
        # WHY NOT shell (json.dumps path):
        #   json.dumps produces a double-quoted string. If the temp path ever
        #   contains embedded double quotes (rare but possible), the shell would
        #   mis-parse the command. Using create_subprocess_exec avoids the shell
        #   entirely — no quoting issues, no injection surface.
        import sys
        import tempfile
        tmp_path = None  # ensure defined even if NamedTemporaryFile raises
        try:
            with tempfile.NamedTemporaryFile(
                mode='w', suffix='.py', delete=False, encoding='utf-8'
            ) as tmp:
                tmp.write(code)
                tmp_path = tmp.name

            # Use create_subprocess_exec (no shell) so the path is passed as a
            # raw argument — immune to any shell quoting / injection issues.
            python_exe = sys.executable or 'python3'
            try:
                proc = await asyncio.create_subprocess_exec(
                    python_exe, tmp_path,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=self.root_dir,
                )
                try:
                    stdout, stderr = await asyncio.wait_for(
                        proc.communicate(), timeout=timeout
                    )
                except asyncio.TimeoutError:
                    proc.kill()
                    await proc.wait()
                    return False, f"Code execution timed out after {timeout}s"

                stdout_str = stdout.decode('utf-8', errors='replace')
                stderr_str = stderr.decode('utf-8', errors='replace')
                output = stdout_str
                if stderr_str:
                    output += f"\n[stderr]\n{stderr_str}" if stdout_str else stderr_str
                if proc.returncode != 0:
                    return False, output or "(no output)"
                return True, output or "(no output)"

            except Exception as e:
                return False, f"Error executing code: {str(e)}"

        finally:
            if tmp_path is not None:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

    async def _grep_search(
        self,
        pattern: str,
        path: str = ".",
        file_pattern: Optional[str] = None,
        case_sensitive: bool = False,
        max_results: int = 50
    ) -> Tuple[bool, str]:
        """Search for pattern in files."""
        resolved = self._resolve_path(path)

        if not os.path.exists(resolved):
            return False, f"Path not found: {path}"

        # Build grep command
        flags = [] if case_sensitive else ["-i"]
        flags += ["-n", "-r"] if os.path.isdir(resolved) else ["-n"]

        if file_pattern and os.path.isdir(resolved):
            flags += ["--include", file_pattern]

        cmd = ["grep"] + flags + [pattern, resolved]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15)
            output = stdout.decode('utf-8', errors='replace')

            lines = output.strip().split('\n') if output.strip() else []
            total = len(lines)

            if total == 0:
                return True, f"No matches found for pattern: '{pattern}'"

            # Limit results
            shown = lines[:max_results]
            result = "\n".join(shown)
            if total > max_results:
                result += f"\n... ({total - max_results} more matches not shown)"

            header = f"Found {total} match(es) for '{pattern}'\n{'─' * 40}\n"
            return True, header + result

        except asyncio.TimeoutError:
            return False, "Search timed out"
        except FileNotFoundError:
            # grep not available, use Python fallback
            return await self._python_grep(pattern, resolved, file_pattern, case_sensitive, max_results)
        except Exception as e:
            return False, f"Search error: {str(e)}"

    async def _python_grep(
        self,
        pattern: str,
        path: str,
        file_pattern: Optional[str],
        case_sensitive: bool,
        max_results: int
    ) -> Tuple[bool, str]:
        """Python-based grep fallback."""
        import re

        flags = 0 if case_sensitive else re.IGNORECASE
        try:
            regex = re.compile(pattern, flags)
        except re.error as e:
            return False, f"Invalid regex pattern: {e}"

        results = []

        def search_file(file_path: str):
            try:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    for lineno, line in enumerate(f, 1):
                        if regex.search(line):
                            rel = os.path.relpath(file_path, path)
                            results.append(f"{rel}:{lineno}: {line.rstrip()}")
                            if len(results) >= max_results:
                                return True  # Stop searching
            except (PermissionError, IsADirectoryError):
                pass
            return False

        if os.path.isfile(path):
            search_file(path)
        else:
            for root, dirs, files in os.walk(path):
                # Skip noise dirs
                dirs[:] = [d for d in dirs if d not in ['node_modules', '__pycache__', '.git', 'dist', 'lib']]
                for fname in files:
                    if file_pattern and not fnmatch.fnmatch(fname, file_pattern):
                        continue
                    fpath = os.path.join(root, fname)
                    if search_file(fpath):
                        break

        if not results:
            return True, f"No matches found for pattern: '{pattern}'"

        header = f"Found {len(results)} match(es) for '{pattern}'\n{'─' * 40}\n"
        return True, header + "\n".join(results)
