"""
Server extension for JupyterLab LLM Assistant.

This module provides the entry point for the Jupyter Server extension.
Configuration is persisted to ~/.llm-assistant/config.json so that
settings (API endpoint, model, etc.) survive JupyterLab restarts.
"""

import json
import os
import logging
import logging.handlers
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

# ── Logging configuration ───────────────────────────────────────────

# Keys whose values are masked in log output (case-insensitive)
_SENSITIVE_KEYS = {"apikey", "api_key", "key", "authorization", "token", "password"}

# Default is console-only logging; set a log_dir (env or CLI) to enable file output
DEFAULT_LOG_DIR = None


def mask_secrets(data: Any) -> Any:
    """
    Recursively mask sensitive values in dicts/lists so they can be logged safely.

    API keys, tokens, etc. are replaced with '***'.
    """
    if isinstance(data, dict):
        return {
            k: ("***" if str(k).lower() in _SENSITIVE_KEYS and v else mask_secrets(v))
            for k, v in data.items()
        }
    if isinstance(data, list):
        return [mask_secrets(item) for item in data]
    return data


def _resolve_log_options(overrides: Optional[Dict[str, Any]] = None) -> tuple:
    """
    Resolve (level, log_dir) with priority: CLI overrides > env vars > defaults.

    - Level:   --LLMAssistant.log_level > LLM_ASSISTANT_LOG_LEVEL > INFO
    - Log dir: --LLMAssistant.log_dir   > LLM_ASSISTANT_LOG_DIR   > None (console only)
      File output is OFF by default; set log_dir to a directory to enable it.
    """
    overrides = overrides or {}

    level_name = str(
        overrides.get("log_level")
        or os.environ.get("LLM_ASSISTANT_LOG_LEVEL")
        or "INFO"
    ).upper()
    level = getattr(logging, level_name, logging.INFO)

    log_dir = (
        overrides.get("log_dir")
        or os.environ.get("LLM_ASSISTANT_LOG_DIR")
        or DEFAULT_LOG_DIR
    )
    if str(log_dir).lower() in ("none", "off", ""):
        log_dir = None

    return level, log_dir


def _configure_logging(overrides: Optional[Dict[str, Any]] = None, reconfigure: bool = False):
    """
    Configure logging for the extension.

    - Console (stderr) handler always attached.
    - File output disabled by default; when log_dir is configured, a rotating
      file handler (daily rotation, 30 days retention) is attached.
    - Called automatically at import; re-called from load_jupyter_server_extension
      when CLI options like --LLMAssistant.log_level=DEBUG are provided.
    """
    level, log_dir = _resolve_log_options(overrides)
    root_logger = logging.getLogger("jupyterlab_llm_assistant")

    # Idempotent: skip if already configured unless explicitly reconfiguring
    if root_logger.handlers and not reconfigure:
        return

    if reconfigure:
        for h in list(root_logger.handlers):
            root_logger.removeHandler(h)
            h.close()

    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(funcName)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root_logger.setLevel(level)

    console = logging.StreamHandler()
    console.setLevel(level)
    console.setFormatter(formatter)
    root_logger.addHandler(console)

    file_note = "disabled"
    if log_dir:
        try:
            os.makedirs(log_dir, exist_ok=True)
            file_handler = logging.handlers.TimedRotatingFileHandler(
                os.path.join(log_dir, "llm-assistant.log"),
                when="midnight",
                backupCount=30,
                encoding="utf-8",
            )
            file_handler.setLevel(level)
            file_handler.setFormatter(formatter)
            root_logger.addHandler(file_handler)
            file_note = os.path.join(log_dir, "llm-assistant.log")
        except Exception as e:
            root_logger.setLevel(logging.WARNING)
            for h in root_logger.handlers:
                h.setLevel(logging.WARNING)
            root_logger.warning(f"Cannot create log file in {log_dir!r}: {e}; using console-only logging")
            return

    root_logger.info(
        f"Logging configured at level {logging.getLevelName(level)}, "
        f"file={file_note}"
    )


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

    # Allow CLI overrides, e.g.:
    #   jupyter lab --LLMAssistant.log_level=DEBUG --LLMAssistant.log_dir=/tmp/lla-logs
    try:
        cli_overrides = dict(server_app.config.get("LLMAssistant", {}))
    except Exception:
        cli_overrides = {}
    if cli_overrides:
        _configure_logging(cli_overrides, reconfigure=True)
    server_app.log.info(f"Loading JupyterLab LLM Assistant extension v{__version__}")

    # Log config store state
    api_key_set = bool(_config_store.get("apiKey") or os.environ.get("OPENAI_API_KEY"))
    logger.info(f"[load_jupyter_server_extension] Config loaded: apiKey set={api_key_set}, model={_config_store.get('model')}")

    _get_handlers()(server_app.web_app, _config_store)
    logger.info("[load_jupyter_server_extension] Handlers registered successfully")

    server_app.log.info("JupyterLab LLM Assistant extension loaded successfully")
    logger.info("[load_jupyter_server_extension] Extension load complete")


