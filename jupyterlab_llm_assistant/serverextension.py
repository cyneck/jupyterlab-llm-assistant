"""
Server extension for JupyterLab LLM Assistant.

This module provides the entry point for the Jupyter Server extension.
Configuration is persisted to ~/.llm-assistant/config.json so that
settings (API endpoint, model, etc.) survive JupyterLab restarts.
"""

import json
import os
import logging
from typing import Dict, Any, Optional
from ._version import __version__

# Lazy import for handlers to avoid circular dependencies and ease testing
def _get_handlers():
    from .handlers import setup_handlers
    return setup_handlers

# Module-level logger
logger = logging.getLogger("jupyterlab_llm_assistant")

# Default system prompt - single source of truth
DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful AI coding assistant. "
    "Help users with programming questions, explain code, debug issues, "
    "and provide code examples. Be concise and accurate."
)

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
        "%(asctime)s - %(name)s - %(levelname)s - %(funcName)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    handler.setFormatter(formatter)

    # Configure root logger for the extension
    root_logger = logging.getLogger("jupyterlab_llm_assistant")
    root_logger.setLevel(level)
    # Only add handler if not already added to avoid duplicates on reload
    if not root_logger.handlers:
        root_logger.addHandler(handler)

    # Child loggers inherit from root via propagate, no need to add separate handlers

    root_logger.info(f"Logging configured at level {logging.getLevelName(level)}")


# Auto-configure logging on module import
_configure_logging()


# ─── Provider defaults ────────────────────────────────────────────────────────

_PROVIDERS_FILE = os.path.join(os.path.dirname(__file__), "providers.json")

def _load_providers() -> Dict[str, Any]:
    """Load providers configuration from JSON file."""
    try:
        if os.path.exists(_PROVIDERS_FILE):
            with open(_PROVIDERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"[_load_providers] Failed to load providers: {e}")
    return {"providers": {}, "defaultProvider": "openai"}

_providers_config = _load_providers()

def get_providers() -> Dict[str, Any]:
    """Return the providers configuration."""
    return _providers_config

def get_provider_defaults(provider_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Get default settings for a provider.

    Args:
        provider_id: Provider ID (e.g., 'openai', 'qwen'). If None, uses default provider.

    Returns:
        Dict with default apiEndpoint, defaultModel, models, etc.
    """
    providers = _providers_config.get("providers", {})

    if provider_id is None:
        provider_id = _providers_config.get("defaultProvider", "openai")

    provider = providers.get(provider_id, {})
    return {
        "provider": provider_id,
        "providerName": provider.get("name", ""),
        "apiEndpoint": provider.get("apiEndpoint", ""),
        "model": provider.get("defaultModel", ""),
        "enableStreaming": provider.get("enableStreaming", True),
        "enableVision": provider.get("enableVision", False),
    }


# ─── Persistence helpers ──────────────────────────────────────────────────────

_CONFIG_FILE = os.path.expanduser("~/.llm-assistant/config.json")


def _load_config() -> Dict[str, Any]:
    """Load persisted config from disk."""
    logger.info(f"[_load_config] Loading config from {_CONFIG_FILE}")
    config: Dict[str, Any] = {}

    try:
        if os.path.exists(_CONFIG_FILE):
            with open(_CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
            if isinstance(saved, dict):
                config = saved
            logger.info(f"[_load_config] Loaded config with keys: {list(config.keys())}, provider={config.get('provider')}, model={config.get('model')}")
        else:
            logger.info("[_load_config] No config file found, using empty dict")
    except Exception as e:
        logger.error(f"[_load_config] Failed to load config: {e}, using empty dict")
    return config


def _reload_config() -> Dict[str, Any]:
    """Reload config from disk, updating global _config_store in-place."""
    global _config_store
    logger.info("[_reload_config] Reloading config from disk")
    new_config = _load_config()
    # Update in-place to preserve reference held by handlers
    _config_store.clear()
    _config_store.update(new_config)
    _config_store["_save_callback"] = _save_config
    api_key_set = bool(_config_store.get("apiKey") or os.environ.get("OPENAI_API_KEY"))
    logger.info(f"[_reload_config] Reloaded config: apiKey set={api_key_set}, model={_config_store.get('model')}")
    return _config_store


def _save_config(config: Dict[str, Any]) -> None:
    """
    Persist config to disk.

    Saves complete config including apiEndpoint, model, etc.
    to ensure config.json and _config_store are always in sync.
    """
    try:
        # CRITICAL: config may be _config_store itself, so copy data first
        config_data = dict(config)

        os.makedirs(os.path.dirname(_CONFIG_FILE), exist_ok=True)

        # Filter out internal keys (starting with underscore)
        to_save = {k: v for k, v in config_data.items() if not k.startswith('_')}

        with open(_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(to_save, f, indent=2, ensure_ascii=False)

        # Update global config store in-place
        global _config_store
        _config_store.clear()
        _config_store.update(config_data)
        _config_store["_save_callback"] = _save_config
        logger.info(f"[_save_config] Config saved, keys: {list(to_save.keys())}")
    except Exception as e:
        logger.error(f"[_save_config] Failed to save config: {e}")


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

    _get_handlers()(server_app.web_app, _config_store)
    logger.info("[load_jupyter_server_extension] Handlers registered successfully")

    server_app.log.info("JupyterLab LLM Assistant extension loaded successfully")
    logger.info("[load_jupyter_server_extension] Extension load complete")


