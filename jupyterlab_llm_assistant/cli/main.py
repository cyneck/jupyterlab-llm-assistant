"""
Terminal AI Coding Agent -- main CLI entry point.

Provides a full-featured terminal AI coding agent experience, similar to
Pi (pi.dev) / Claude Code, reusing the project's existing backend modules.

Usage:
    llm-assistant               # Interactive REPL mode
    llm-assistant "ask a question"  # Single-shot mode
    llm-assistant --agent "write a unit test"  # Agent mode
    llm-assistant --list-sessions   # List saved sessions
"""

# ═══════════════════════════════════════════════════════════════════════════
# NOTE: Log level is set via LLM_ASSISTANT_LOG_LEVEL env var in the entry
# point module (cli/entry.py) BEFORE this module is imported. See entry.py.
# ═══════════════════════════════════════════════════════════════════════════

import argparse
import asyncio
import json
import logging
import os
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Rich terminal UI
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table
from rich.live import Live
from rich.layout import Layout
from rich.text import Text
from rich.syntax import Syntax
from rich.spinner import Spinner
from rich import box

# Prompt toolkit for interactive input
from prompt_toolkit import PromptSession
from prompt_toolkit.history import FileHistory
from prompt_toolkit.auto_suggest import AutoSuggestFromHistory
from prompt_toolkit.key_binding import KeyBindings

# Project modules (reuse existing backend)
from ..serverextension import _config_store, DEFAULT_SYSTEM_PROMPT
from ..llm_client import LLMClient, LLMConfig
from ..agent_tools import AgentToolExecutor, AGENT_TOOLS
from ..agent_loop import run_agent_loop
from ..workspace_handler import (
    _workspace_dir,
    _ensure_dirs,
    load_assistant_md,
    apply_skills_to_system_prompt,
    get_skill_tools_for_agent,
)
from ..memory_handler import get_memory_store

# Constants
WORKSPACE_DIR_NAME = ".llm-assistant"
SESSIONS_DIR_NAME = "sessions"
HISTORY_FILE = os.path.expanduser("~/.llm-assistant-cli-history")

console = Console()
logger = logging.getLogger("llm_assistant_cli")


def build_llm_config() -> LLMConfig:
    """Build LLMConfig from the shared config store."""
    config = _config_store

    # API key: config file takes priority, then environment variables
    api_key = config.get("apiKey") or ""
    if not api_key:
        api_key = os.environ.get("ANTHROPIC_API_KEY") or ""
    if not api_key:
        api_key = os.environ.get("OPENAI_API_KEY") or ""

    return LLMConfig(
        api_key=api_key or None,
        api_endpoint=config.get("apiEndpoint", "https://api.openai.com/v1"),
        model=config.get("model", "gpt-4o"),
        temperature=float(config.get("temperature", 0.7)),
        max_tokens=int(config.get("maxTokens", 4096)),
        system_prompt=config.get("systemPrompt", DEFAULT_SYSTEM_PROMPT),
        enable_streaming=bool(config.get("enableStreaming", True)),
        enable_vision=bool(config.get("enableVision", True)),
    )


def build_agent_system_prompt(root_dir: str = "") -> str:
    """Build enriched system prompt for agent mode."""
    base = _config_store.get("systemPrompt", DEFAULT_SYSTEM_PROMPT)
    # Inject ASSISTANT.md, skills, and memory
    enriched = apply_skills_to_system_prompt(base, root_dir, include_memory=True)
    return enriched


def generate_session_id() -> str:
    """Generate a unique session ID."""
    return datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:8]


def get_session_path(session_id: str, root_dir: str = "") -> Path:
    """Get the path to a session file."""
    ws = _workspace_dir(root_dir)
    return ws / SESSIONS_DIR_NAME / f"{session_id}.json"


def save_session(session_id: str, messages: List[Dict], root_dir: str = ""):
    """Save conversation to a session file."""
    ws = _workspace_dir(root_dir)
    _ensure_dirs(ws)
    session_path = get_session_path(session_id, root_dir)
    session_data = {
        "id": session_id,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "messages": messages,
        "mode": "agent",
    }
    session_path.parent.mkdir(parents=True, exist_ok=True)
    session_path.write_text(json.dumps(session_data, indent=2, ensure_ascii=False), encoding="utf-8")


def load_session(session_id: str, root_dir: str = "") -> Optional[Dict]:
    """Load a session from file."""
    session_path = get_session_path(session_id, root_dir)
    if not session_path.exists():
        return None
    try:
        return json.loads(session_path.read_text(encoding="utf-8"))
    except Exception:
        return None


def list_sessions(root_dir: str = "") -> List[Dict]:
    """List all saved sessions."""
    ws = _workspace_dir(root_dir)
    sessions_dir = ws / SESSIONS_DIR_NAME
    if not sessions_dir.exists():
        return []
    sessions = []
    for f in sorted(sessions_dir.glob("*.json"), reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            sessions.append({
                "id": data.get("id", f.stem),
                "created_at": data.get("created_at", ""),
                "message_count": len(data.get("messages", [])),
                "mode": data.get("mode", "unknown"),
                "preview": str(data.get("messages", [{}])[0].get("content", ""))[:80] if data.get("messages") else "",
            })
        except Exception:
            sessions.append({"id": f.stem, "created_at": "", "message_count": 0, "mode": "unknown", "preview": ""})
    return sessions


def delete_session(session_id: str, root_dir: str = ""):
    """Delete a session file."""
    session_path = get_session_path(session_id, root_dir)
    if session_path.exists():
        session_path.unlink()


async def chat_mode(user_input: str, messages: List[Dict] = None) -> Dict:
    """Simple chat mode (no tool calls) with streaming output."""
    if messages is None:
        messages = []

    config = build_llm_config()
    client = LLMClient(config)

    # Add user message
    messages.append({"role": "user", "content": user_input})

    try:
        # Stream the response
        full_response = ""
        async for chunk in client.chat_stream(messages):
            full_response += chunk
            # Print inline
            console.print(chunk, end="")

        console.print()  # newline after streaming

        if full_response:
            messages.append({"role": "assistant", "content": full_response})

        return {"success": True, "response": full_response, "messages": messages}
    except Exception as e:
        error_msg = f"Error: {str(e)}"
        console.print(f"\n[red]{error_msg}[/red]")
        return {"success": False, "error": str(e), "messages": messages}


async def agent_mode(user_input: str, messages: List[Dict] = None) -> Dict:
    """Agent mode with tool calls using the existing agent loop."""
    if messages is None:
        messages = []

    config = build_llm_config()
    root_dir = os.getcwd()

    # Build enriched system prompt
    system_prompt = build_agent_system_prompt(root_dir)

    # Create OpenAI client
    from openai import AsyncOpenAI
    openai_client = AsyncOpenAI(
        api_key=config.api_key,
        base_url=config.api_endpoint,
        timeout=120.0,
    )

    # Create tool executor
    executor = AgentToolExecutor(root_dir=root_dir)

    # Get skill tools
    skill_tools = get_skill_tools_for_agent(root_dir)

    # Build message list with system prompt
    api_messages = [{"role": "system", "content": system_prompt}]
    api_messages.extend(messages)
    api_messages.append({"role": "user", "content": user_input})

    # Track tool calls for display
    tool_results = []

    async def send_event(event_type: str, data: Any):
        """Handle events from the agent loop."""
        if event_type == "tool_start":
            tool_name = data.get("name", "unknown")
            tool_args = data.get("arguments", {})
            console.print(f"\n[bold cyan]🔧 Using tool:[/bold cyan] [yellow]{tool_name}[/yellow]")
            console.print(f"  [dim]Arguments: {json.dumps(tool_args, ensure_ascii=False)[:200]}[/dim]")
        elif event_type == "tool_result":
            tool_name = data.get("name", "unknown")
            result = data.get("result", "")
            success = data.get("success", False)
            status = "[green]✓[/green]" if success else "[red]✗[/red]"
            console.print(f"  {status} [dim]{result[:300]}[/dim]")
            tool_results.append(data)
        elif event_type == "iteration":
            current = data.get("current", 0)
            max_iter = data.get("max", 0)
            if current > 1:
                console.print(f"\n[dim]Iteration {current}/{max_iter}...[/dim]")
        elif event_type == "error":
            console.print(f"\n[red]Error: {data.get('message', '')}[/red]")
        elif event_type == "done":
            completed = data.get("completed", False)
            iterations = data.get("total_iterations", 0)
            if completed:
                console.print(f"\n[green]✓ Task completed in {iterations} iterations[/green]")
            else:
                console.print(f"\n[yellow]⚠ Task stopped after {iterations} iterations[/yellow]")

    try:
        console.print("\n[bold cyan]🤖 Agent mode activated[/bold cyan]\n")

        await run_agent_loop(
            send_event=send_event,
            client=openai_client,
            executor=executor,
            api_messages=api_messages,
            model=config.model,
            max_iterations=int(_config_store.get("maxIterations", 50)),
            config_store=_config_store,
            skill_tools=skill_tools,
        )

        # Display the final assistant response
        if api_messages and api_messages[-1]["role"] == "assistant":
            final_content = api_messages[-1].get("content", "")
            if final_content and final_content.strip():
                console.print(f"\n[bold]Response:[/bold]\n{final_content}")

        return {"success": True, "messages": api_messages, "tool_results": tool_results}
    except Exception as e:
        error_msg = f"Agent error: {str(e)}"
        console.print(f"\n[red]{error_msg}[/red]")
        return {"success": False, "error": str(e), "messages": messages}


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Terminal AI Coding Agent — JupyterLab LLM Assistant CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  llm-assistant                     # Interactive REPL mode
  llm-assistant "What is Python?"   # Single-shot chat mode
  llm-assistant --agent "Refactor this file"  # Agent mode
  llm-assistant --list-sessions     # Show saved sessions
  llm-assistant --session 20250101_120000  # Resume session
        """,
    )
    parser.add_argument("query", nargs="?", help="Single query to run (non-interactive)")
    parser.add_argument("--agent", "-a", action="store_true", help="Run in agent mode (with tool access)")
    parser.add_argument("--list-sessions", "-l", action="store_true", help="List saved sessions")
    parser.add_argument("--session", "-s", help="Session ID to resume")
    parser.add_argument("--model", "-m", help="Override model name")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")
    return parser.parse_args()


async def run_single(args: argparse.Namespace):
    """Run a single query and exit."""
    if not args.query:
        console.print("[yellow]No query provided. Use -h for help.[/yellow]")
        return

    messages = []
    session_id = args.session or generate_session_id()

    # Load existing session if resuming
    if args.session:
        session_data = load_session(args.session)
        if session_data:
            messages = session_data.get("messages", [])
            console.print(f"[dim]Resumed session: {args.session}[/dim]")

    if args.agent:
        result = await agent_mode(args.query, messages)
        if result.get("messages") and result["messages"][-1]["role"] == "assistant":
            final = result["messages"][-1].get("content", "")
            if final and final.strip():
                console.print(f"\n[bold]Response:[/bold]\n{final}")
    else:
        result = await chat_mode(args.query, messages)

    # Save session
    if result.get("messages"):
        save_session(session_id, result["messages"])


async def interactive_repl():
    """Interactive REPL mode with prompt_toolkit."""
    # Show welcome banner
    from .._version import __version__ as backend_version
    from . import __version__ as cli_version

    console.print(Panel.fit(
        "[bold cyan]🤖 JupyterLab LLM Assistant — Terminal Agent[/bold cyan]\n"
        f"[dim]CLI v{cli_version} | Backend v{backend_version}[/dim]\n\n"
        "[green]Chat mode[/green] — Ask questions, get answers\n"
        "[yellow]Agent mode[/yellow] — Use /agent to activate tools (read/write/bash)\n\n"
        "[dim]Commands:[/dim] [bold]/agent[/bold] [dim]<query>[/dim]  [bold]/chat[/bold] [dim]<query>[/dim]  "
        "[bold]/clear[/bold]  [bold]/sessions[/bold]  [bold]/help[/bold]  [bold]/exit[/bold]",
        border_style="cyan",
    ))

    # Mode state
    mode = "chat"  # "chat" or "agent"
    messages = []
    session_id = generate_session_id()

    # Create prompt session
    kb = KeyBindings()

    @kb.add("c-c")
    def _(event):
        """Ctrl+C to exit."""
        event.app.exit()

    session = PromptSession(
        history=FileHistory(HISTORY_FILE),
        auto_suggest=AutoSuggestFromHistory(),
        key_bindings=kb,
    )

    while True:
        try:
            # Show mode prompt
            prompt_text = "C> " if mode == "chat" else "A> "

            user_input = await session.prompt_async(prompt_text)

            if not user_input:
                continue

            user_input = user_input.strip()

            # Handle commands
            if user_input.startswith("/"):
                cmd_parts = user_input[1:].split(maxsplit=1)
                cmd = cmd_parts[0].lower()
                cmd_arg = cmd_parts[1] if len(cmd_parts) > 1 else ""

                if cmd in ("exit", "quit", "q"):
                    console.print("[dim]Goodbye![/dim]")
                    break

                elif cmd == "clear":
                    console.clear()
                    continue

                elif cmd == "help":
                    console.print(Panel.fit(
                        "[bold]Commands:[/bold]\n"
                        "  /chat <query>    — Switch to chat mode and send query\n"
                        "  /agent <query>   — Switch to agent mode and send query\n"
                        "  /clear           — Clear screen\n"
                        "  /sessions        — List saved sessions\n"
                        "  /session <id>    — Resume a session\n"
                        "  /help            — Show this help\n"
                        "  /exit, /quit     — Exit\n\n"
                        "[bold]Modes:[/bold]\n"
                        "  [green]Chat mode[/green]  — Direct Q&A, no tool access\n"
                        "  [yellow]Agent mode[/yellow] — Full tool access (files, bash, grep, etc.)\n\n"
                        "Type your query directly to send in current mode.",
                        border_style="green",
                        title="Help",
                    ))
                    continue

                elif cmd == "chat":
                    mode = "chat"
                    if cmd_arg:
                        user_input = cmd_arg
                    else:
                        console.print("[green]Switched to Chat mode[/green]")
                        continue

                elif cmd == "agent":
                    mode = "agent"
                    if cmd_arg:
                        user_input = cmd_arg
                    else:
                        console.print("[yellow]Switched to Agent mode[/yellow]")
                        continue

                elif cmd == "sessions":
                    sessions = list_sessions()
                    if not sessions:
                        console.print("[dim]No saved sessions.[/dim]")
                    else:
                        table = Table(title="Saved Sessions", box=box.ROUNDED)
                        table.add_column("ID", style="cyan")
                        table.add_column("Date", style="dim")
                        table.add_column("Mode", style="yellow")
                        table.add_column("Messages", style="green")
                        table.add_column("Preview", style="white")
                        for s in sessions[:20]:
                            created = s.get("created_at", "")[:19] if s.get("created_at") else ""
                            table.add_row(
                                s["id"][:20],
                                created,
                                s.get("mode", "?"),
                                str(s.get("message_count", 0)),
                                s.get("preview", "")[:50],
                            )
                        console.print(table)
                    continue

                elif cmd == "session":
                    if cmd_arg:
                        session_data = load_session(cmd_arg)
                        if session_data:
                            messages = session_data.get("messages", [])
                            session_id = cmd_arg
                            console.print(f"[green]Resumed session: {cmd_arg}[/green] "
                                          f"({len(messages)} messages)")
                        else:
                            console.print(f"[red]Session not found: {cmd_arg}[/red]")
                    else:
                        console.print("[yellow]Usage: /session <session_id>[/yellow]")
                    continue

                else:
                    console.print(f"[red]Unknown command: /{cmd}. Type /help for commands.[/red]")
                    continue

            # Process user input in current mode
            if mode == "agent":
                # Agent mode has its own rich progress display (tool calls, etc.)
                result = await agent_mode(user_input, messages)
            else:
                # Chat mode: stream output directly
                result = await chat_mode(user_input, messages)

            # Update conversation history
            if result.get("messages"):
                messages = result["messages"]
                save_session(session_id, messages)

            if not result.get("success"):
                console.print(f"\n[red]Error: {result.get('error', 'Unknown error')}[/red]")

        except KeyboardInterrupt:
            console.print("\n[dim]Goodbye![/dim]")
            break
        except EOFError:
            console.print("\n[dim]Goodbye![/dim]")
            break
        except Exception as e:
            console.print(f"\n[red]Unexpected error: {str(e)}[/red]")
            logger.exception("REPL error")


def list_sessions_table():
    """Display saved sessions as a rich table."""
    sessions = list_sessions()
    if not sessions:
        console.print("[yellow]No saved sessions found.[/yellow]")
        return

    table = Table(title="Saved Sessions", box=box.ROUNDED)
    table.add_column("ID", style="cyan", no_wrap=True)
    table.add_column("Date", style="dim")
    table.add_column("Mode", style="yellow")
    table.add_column("Messages", style="green")
    table.add_column("Preview", style="white")

    for s in sessions[:20]:
        created = s.get("created_at", "")[:19] if s.get("created_at") else ""
        table.add_row(
            s["id"],
            created,
            s.get("mode", "?"),
            str(s.get("message_count", 0)),
            s.get("preview", "")[:60],
        )
    console.print(table)


def main():
    """Main entry point."""
    args = parse_args()

    # Configure logging
    log_level = logging.DEBUG if args.verbose else logging.WARNING
    logging.basicConfig(level=log_level, format="%(levelname)s: %(message)s")

    if args.list_sessions:
        list_sessions_table()
        return

    # Override model if specified
    if args.model:
        _config_store["model"] = args.model

    # Run
    if args.query:
        asyncio.run(run_single(args))
    else:
        asyncio.run(interactive_repl())


if __name__ == "__main__":
    main()
