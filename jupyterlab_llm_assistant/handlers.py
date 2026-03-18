"""
HTTP handlers for the LLM Assistant extension.

Provides REST API endpoints for chat and configuration management.
"""

import json
import os
import asyncio
from typing import Dict, Any, Optional, List
from tornado import web
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join

from .llm_client import LLMClient, LLMConfig
from .agent_handler import AgentHandler
from .memory_handler import MemoryListHandler, MemoryItemHandler, MemoryExportHandler
from .context_handler import ContextReadHandler, ContextResolveHandler, ContextListDirHandler
from .workspace_handler import (
    WorkspaceInfoHandler,
    AssistantMdHandler,
    WorkspaceConfigHandler,
    SessionListHandler,
    SessionItemHandler,
    SkillListHandler,
    SkillInstallHandler,
    SkillDeleteHandler,
)


class BaseConfigHandler(APIHandler):
    """
    Base class for all handlers that need access to the config store.

    Provides a single, canonical implementation of _get_api_key() so that
    every subclass shares exactly the same logic without duplication.
    """

    def initialize(self, config_store: Dict[str, Any]):
        self.config_store = config_store

    def _get_config(self) -> Dict[str, Any]:
        """Get current config from memory store."""
        return dict(self.config_store)

    def _get_api_key(self) -> Optional[str]:
        """Return the API key from config file (priority) or environment variable."""
        # Priority: config file > environment variable
        return self.config_store.get("apiKey") or os.environ.get("OPENAI_API_KEY")


class ConfigHandler(BaseConfigHandler):
    """
    Handler for configuration management.

    GET: Retrieve current configuration
    POST: Update configuration
    """

    def _build_safe_config(self) -> dict:
        """Build safe config dict excluding sensitive data."""
        config = self._get_config()
        return {
            "apiEndpoint": config.get("apiEndpoint", "https://api.openai.com/v1"),
            "apiKey": "",  # Never return actual API key
            "model": config.get("model", "gpt-4o"),
            "temperature": config.get("temperature", 0.7),
            "maxTokens": config.get("maxTokens", 4096),
            "systemPrompt": config.get("systemPrompt", ""),
            "enableStreaming": config.get("enableStreaming", True),
            "enableVision": config.get("enableVision", True),
            "hasApiKey": bool(self._get_api_key()),
        }

    @web.authenticated
    async def get(self):
        """Get current configuration (excluding sensitive data)."""
        self.finish(json.dumps(self._build_safe_config()))

    @web.authenticated
    async def post(self):
        """Update configuration."""
        try:
            data = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        # Update config store
        allowed_keys = [
            "apiEndpoint", "model", "temperature", "maxTokens",
            "systemPrompt", "enableStreaming", "enableVision"
        ]

        for key in allowed_keys:
            if key in data:
                self.config_store[key] = data[key]

        # Handle API key - always save to config.json
        if "apiKey" in data:
            self.config_store["apiKey"] = data["apiKey"]

        # Persist configuration to disk (including API key)
        save_cb = self.config_store.get("_save_callback")
        if callable(save_cb):
            save_cb(self.config_store)

        # Fix: do NOT call await self.get() — build response directly
        self.finish(json.dumps(self._build_safe_config()))


class ChatHandler(BaseConfigHandler):
    """
    Handler for chat completion requests.

    Supports both regular and streaming responses.
    """

    def _create_client(self) -> LLMClient:
        """Create LLM client with current config."""
        config = self._get_config()
        return LLMClient(LLMConfig(
            api_endpoint=config.get("apiEndpoint", "https://api.openai.com/v1"),
            api_key=self._get_api_key(),
            model=config.get("model", "gpt-4o"),
            temperature=config.get("temperature", 0.7),
            max_tokens=config.get("maxTokens", 4096),
            system_prompt=config.get("systemPrompt", ""),
            enable_streaming=config.get("enableStreaming", True),
            enable_vision=config.get("enableVision", True),
        ))

    @web.authenticated
    async def post(self):
        """
        Handle chat request.

        Request body:
        {
            "messages": [{"role": "user", "content": "..."}],
            "images": ["data:image/png;base64,..."],  // optional
            "stream": true  // optional, default true
        }
        """
        try:
            data = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        messages = data.get("messages", [])
        images = data.get("images")
        stream = data.get("stream", True)

        if not messages:
            raise web.HTTPError(400, "Messages are required")

        # Check for API key
        if not self._get_api_key():
            raise web.HTTPError(401, "API key not configured. Set OPENAI_API_KEY environment variable.")

        client = self._create_client()

        if stream:
            # Streaming response using SSE
            self.set_header("Content-Type", "text/event-stream")
            self.set_header("Cache-Control", "no-cache")
            self.set_header("Connection", "keep-alive")
            self.set_header("X-Accel-Buffering", "no")

            try:
                async for chunk in client.chat_stream(messages, images):
                    # Send SSE event
                    self.write(f"data: {json.dumps({'content': chunk})}\n\n")
                    await self.flush()

                # Send done event
                self.write("data: [DONE]\n\n")
                await self.flush()
            except Exception as e:
                self.write(f"data: {json.dumps({'error': str(e)})}\n\n")
                await self.flush()
            finally:
                self.finish()
        else:
            # Non-streaming response
            try:
                response = await client.chat(messages, images)
                self.finish(json.dumps({"content": response}))
            except Exception as e:
                raise web.HTTPError(500, str(e))


class ModelsHandler(BaseConfigHandler):
    """
    Handler for listing available models.
    """

    @web.authenticated
    async def get(self):
        """List available models from the API."""
        from openai import AsyncOpenAI

        api_key = self._get_api_key()
        if not api_key:
            raise web.HTTPError(401, "API key not configured")

        try:
            client = AsyncOpenAI(
                api_key=api_key,
                base_url=self.config_store.get("apiEndpoint", "https://api.openai.com/v1"),
                timeout=120.0,
            )
            models = await client.models.list()
            model_list = [{"id": m.id, "owned_by": m.owned_by} for m in models.data]
            self.finish(json.dumps({"models": model_list}))
        except Exception as e:
            # Return default models if API call fails
            default_models = [
                {"id": "gpt-4o", "owned_by": "openai"},
                {"id": "gpt-4o-mini", "owned_by": "openai"},
                {"id": "gpt-4-turbo", "owned_by": "openai"},
                {"id": "gpt-4", "owned_by": "openai"},
                {"id": "gpt-3.5-turbo", "owned_by": "openai"},
            ]
            self.finish(json.dumps({"models": default_models, "error": str(e)}))


class TestConnectionHandler(BaseConfigHandler):
    """
    Handler for testing API connection.
    """

    @web.authenticated
    async def get(self):
        """Test the API connection."""
        config = self._get_config()
        client = LLMClient(LLMConfig(
            api_endpoint=config.get("apiEndpoint", "https://api.openai.com/v1"),
            api_key=self._get_api_key(),
            model=config.get("model", "gpt-4o"),
        ))

        result = await client.test_connection()
        self.finish(json.dumps(result))


def setup_handlers(web_app, config_store: Dict[str, Any]):
    """
    Set up the HTTP handlers for the extension.

    Args:
        web_app: The JupyterServer web application
        config_store: Dictionary to store configuration
    """
    host_pattern = ".*"
    base_url = web_app.settings["base_url"]

    # Define routes
    routes = [
        (url_path_join(base_url, "/llm-assistant/chat"), ChatHandler, {"config_store": config_store}),
        (url_path_join(base_url, "/llm-assistant/config"), ConfigHandler, {"config_store": config_store}),
        (url_path_join(base_url, "/llm-assistant/models"), ModelsHandler, {"config_store": config_store}),
        (url_path_join(base_url, "/llm-assistant/test"), TestConnectionHandler, {"config_store": config_store}),
    ]

    # Add agent route
    routes.append(
        (url_path_join(base_url, "/llm-assistant/agent"), AgentHandler, {"config_store": config_store}),
    )

    # Memory management routes
    routes += [
        (url_path_join(base_url, "/llm-assistant/memory"), MemoryListHandler),
        (url_path_join(base_url, "/llm-assistant/memory/export"), MemoryExportHandler),
        (url_path_join(base_url, r"/llm-assistant/memory/([^/]+)"), MemoryItemHandler),
    ]

    # Context / file-reference routes
    routes += [
        (url_path_join(base_url, "/llm-assistant/context/read"), ContextReadHandler),
        (url_path_join(base_url, "/llm-assistant/context/resolve"), ContextResolveHandler),
        (url_path_join(base_url, "/llm-assistant/context/listdir"), ContextListDirHandler),
    ]

    # .llm-assistant workspace routes (sessions, ASSISTANT.md, skills, per-project config)
    routes += [
        (url_path_join(base_url, "/llm-assistant/workspace/info"), WorkspaceInfoHandler),
        (url_path_join(base_url, "/llm-assistant/workspace/assistant-md"), AssistantMdHandler),
        (url_path_join(base_url, "/llm-assistant/workspace/config"), WorkspaceConfigHandler),
        (url_path_join(base_url, "/llm-assistant/workspace/sessions"), SessionListHandler),
        (url_path_join(base_url, r"/llm-assistant/workspace/sessions/([^/]+)"), SessionItemHandler),
        (url_path_join(base_url, "/llm-assistant/workspace/skills"), SkillListHandler),
        (url_path_join(base_url, "/llm-assistant/workspace/skills/install"), SkillInstallHandler),
        (url_path_join(base_url, r"/llm-assistant/workspace/skills/([^/]+)"), SkillDeleteHandler),
    ]

    for route_pattern, handler, *handler_args_list in routes:
        handler_args = handler_args_list[0] if handler_args_list else {}
        web_app.add_handlers(host_pattern, [(route_pattern, handler, handler_args)])