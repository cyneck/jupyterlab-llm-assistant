"""
Entry point for the llm-assistant CLI command.

This module exists as a thin wrapper that sets LLM_ASSISTANT_LOG_LEVEL=WARNING
BEFORE importing the main CLI module. This is necessary because:

- serverextension.py calls _configure_logging() at module level during import
  (triggered via __init__.py), which emits INFO logs to stderr.
- Setting the env var here ensures _resolve_log_options() sees WARNING level
  before any project module is imported, filtering out noisy INFO messages.
"""

import os

# Must happen before any project imports
os.environ.setdefault("LLM_ASSISTANT_LOG_LEVEL", "WARNING")

from jupyterlab_llm_assistant.cli.main import main

if __name__ == "__main__":
    main()
