"""
LLM Assistant JupyterLab Extension

A JupyterLab extension that provides an LLM-powered coding assistant
with a chat interface in the right sidebar.
"""

from .handlers import setup_handlers
from .serverextension import load_jupyter_server_extension

__all__ = ["load_jupyter_server_extension", "setup_handlers"]