"""
Server extension for JupyterLab LLM Assistant.

This module provides the entry point for the Jupyter Server extension.
"""

from typing import Dict, Any
from .handlers import setup_handlers
from ._version import __version__


# Global configuration store
_config_store: Dict[str, Any] = {
    "apiEndpoint": "https://api.openai.com/v1",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 4096,
    "systemPrompt": "You are a helpful AI coding assistant. Help users with programming questions, explain code, debug issues, and provide code examples. Be concise and accurate.",
    "enableStreaming": True,
    "enableVision": True,
}


def load_jupyter_server_extension(server_app):
    """
    Called when the extension is loaded.

    Args:
        server_app: The JupyterServer application instance
    """
    server_app.log.info(f"Loading JupyterLab LLM Assistant extension v{__version__}")

    # Set up handlers
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