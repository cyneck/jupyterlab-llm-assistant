"""
Server extension for JupyterLab LLM Assistant.

This module provides the entry point for the Jupyter Server extension.
Configuration is persisted to ~/.llm-assistant/config.json so that
settings (API endpoint, model, etc.) survive JupyterLab restarts.
"""

import json
import os
from typing import Dict, Any
from .handlers import setup_handlers
from ._version import __version__


# ─── Persistence helpers ──────────────────────────────────────────────────────

_CONFIG_FILE = os.path.expanduser("~/.llm-assistant/config.json")

_DEFAULT_CONFIG: Dict[str, Any] = {
    "apiEndpoint": "https://api.openai.com/v1",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 4096,
    "systemPrompt": (
        "You are a helpful AI coding assistant. Help users with programming questions, "
        "explain code, debug issues, and provide code examples. Be concise and accurate."
    ),
    "enableStreaming": True,
    "enableVision": True,
}


def _load_config() -> Dict[str, Any]:
    """Load persisted config from disk, merging with defaults."""
    config = dict(_DEFAULT_CONFIG)

    # Migration: move old config from ~/.jupyter/llm_assistant_config.json if present
    _migrate_old_config()

    try:
        if os.path.exists(_CONFIG_FILE):
            with open(_CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
            # Only overlay keys we know about (ignore stale/unknown keys)
            for key in _DEFAULT_CONFIG:
                if key in saved:
                    config[key] = saved[key]
            # Preserve API key if saved
            if "apiKey" in saved:
                config["apiKey"] = saved["apiKey"]
    except Exception:
        pass  # Fall back to defaults silently
    return config


def _migrate_old_config():
    """Migrate config from old location ~/.jupyter/llm_assistant_config.json to new location."""
    old_path = os.path.expanduser("~/.jupyter/llm_assistant_config.json")
    if os.path.exists(old_path) and not os.path.exists(_CONFIG_FILE):
        try:
            os.makedirs(os.path.dirname(_CONFIG_FILE), exist_ok=True)
            with open(old_path, "r", encoding="utf-8") as f:
                old_config = json.load(f)
            with open(_CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(old_config, f, indent=2, ensure_ascii=False)
            # Remove old config file after successful migration
            os.remove(old_path)
        except Exception:
            pass  # Silent fail - will use defaults


def _save_config(config: Dict[str, Any]) -> None:
    """Persist config to disk (non-blocking best-effort)."""
    try:
        os.makedirs(os.path.dirname(_CONFIG_FILE), exist_ok=True)
        # Never persist the raw API key to disk for security.
        # Users should rely on OPENAI_API_KEY env var for that.
        safe = {k: v for k, v in config.items() if k != "apiKey"}
        # But do persist a flag that an API key was set in memory so the UI
        # can show "key configured" after restart (user must re-enter key each session).
        with open(_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(safe, f, indent=2, ensure_ascii=False)
    except Exception:
        pass  # Non-fatal — just skip persistence


# ─── Global config store ──────────────────────────────────────────────────────

# Loaded once at import time.  Handlers mutate this dict in-place.
_config_store: Dict[str, Any] = _load_config()

# Attach save callback so ConfigHandler can trigger disk persistence
_config_store["_save_callback"] = _save_config


# ─── Extension entry points ───────────────────────────────────────────────────

def load_jupyter_server_extension(server_app):
    """
    Called when the extension is loaded.

    Args:
        server_app: The JupyterServer application instance
    """
    server_app.log.info(f"Loading JupyterLab LLM Assistant extension v{__version__}")
    setup_handlers(server_app.web_app, _config_store)
    server_app.log.info("JupyterLab LLM Assistant extension loaded successfully")


# For Jupyter Server 2.x
def _jupyter_server_extension_points():
    """
    Returns a list of dictionaries with metadata describing
    where to find the `_load_jupyter_server_extension` function.
    """
    return [{
        "module": "jupyterlab_llm_assistant",
        "app": JupyterLabLLMAssistantExtension,
    }]


class JupyterLabLLMAssistantExtension:
    """Extension class for Jupyter Server 2.x."""

    def __init__(self):
        self.config_store = _config_store

    def _load_jupyter_server_extension(self, server_app):
        """Load the server extension."""
        load_jupyter_server_extension(server_app)
