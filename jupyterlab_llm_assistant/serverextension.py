"""
Server extension for JupyterLab LLM Assistant.

This module provides the entry point for the Jupyter Server extension.
Configuration is persisted to ~/.llm-assistant/config.json so that
settings (API endpoint, model, etc.) survive JupyterLab restarts.
"""

import json
import os
import logging
from typing import Dict, Any
from .handlers import setup_handlers
from ._version import __version__

# Module-level logger
logger = logging.getLogger("jupyterlab_llm_assistant")

# ─── Logging configuration ─────────────────────────────────────────────────────

def _configure_logging():
    """
    Configure logging for the extension.

    Reads log level from LLM_ASSISTANT_LOG_LEVEL environment variable.
    Defaults to INFO if not set or invalid.
    """
    level_name = os.environ.get("LLM_ASSISTANT_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    handler = logging.StreamHandler()
    handler.setLevel(level)
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    handler.setFormatter(formatter)

    # Configure root logger for the extension
    root_logger = logging.getLogger("jupyterlab_llm_assistant")
    root_logger.setLevel(level)
    root_logger.addHandler(handler)

    # Propagate to child loggers
    logging.getLogger("jupyterlab_llm_assistant.handlers").addHandler(handler)
    logging.getLogger("jupyterlab_llm_assistant.handlers").setLevel(level)

    root_logger.info(f"Logging configured at level {logging.getLevelName(level)}")


# Auto-configure logging on module import
_configure_logging()


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
    logger.info(f"[_load_config] Loading config from {_CONFIG_FILE}")
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
            logger.info(f"[_load_config] Loaded config with keys: {list(config.keys())}")
        else:
            logger.info("[_load_config] No config file found, using defaults")
    except Exception as e:
        logger.error(f"[_load_config] Failed to load config: {e}, using defaults")
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
        # Save all config including API key
        safe = {k: v for k, v in config.items() if not k.startswith('_')}
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
    logger.info(f"[load_jupyter_server_extension] Starting extension load v{__version__}")
    server_app.log.info(f"Loading JupyterLab LLM Assistant extension v{__version__}")

    # Log config store state
    api_key_set = bool(_config_store.get("apiKey") or os.environ.get("OPENAI_API_KEY"))
    logger.info(f"[load_jupyter_server_extension] Config loaded: apiKey set={api_key_set}, model={_config_store.get('model')}")

    setup_handlers(server_app.web_app, _config_store)
    logger.info("[load_jupyter_server_extension] Handlers registered successfully")

    server_app.log.info("JupyterLab LLM Assistant extension loaded successfully")
    logger.info("[load_jupyter_server_extension] Extension load complete")


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
