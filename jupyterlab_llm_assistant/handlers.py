"""
HTTP handlers for the LLM Assistant extension.

Provides REST API endpoints for chat and configuration management.
"""

import json
import asyncio
from typing import Dict, Any, Optional, List
from tornado import web
from tornado.web import RequestHandler, stream_request_body
from tornado.iostream import IOStream
from jupyter_server.base.handlers import JupyterHandler, APIHandler
from jupyter_server.utils import url_path_join, ensure_async

from .llm_client import LLMClient, LLMConfig


class ConfigHandler(APIHandler):
    """
    Handler for configuration management.

    GET: Retrieve current configuration
    POST: Update configuration
    """

    def initialize(self, config_store: Dict[str, Any]):
        """Initialize with config store."""
        self.config_store = config_store

    @web.authenticated
    async def get(self):
        """Get current configuration (excluding sensitive data)."""
        # Return config without sensitive data
        safe_config = {
            "apiEndpoint": self.config_store.get("apiEndpoint", "https://api.openai.com/v1"),
            "apiKey": "",  # Never return actual API key
            "model": self.config_store.get("model", "gpt-4o"),
            "temperature": self.config_store.get("temperature", 0.7),
            "maxTokens": self.config_store.get("maxTokens", 4096),
            "systemPrompt": self.config_store.get("systemPrompt", ""),
            "enableStreaming": self.config_store.get("enableStreaming", True),
            "enableVision": self.config_store.get("enableVision", True),
            "hasApiKey": bool(self._get_api_key()),
        }
        self.finish(json.dumps(safe_config))

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

        # Handle API key
        if "apiKey" in data and data["apiKey"]:
            self.config_store["apiKey"] = data["apiKey"]

        await self.get()

    def _get_api_key(self) -> Optional[str]:
        """Get API key from config store or environment variable."""
        import os
        return self.config_store.get("apiKey") or os.environ.get("OPENAI_API_KEY")


class ChatHandler(APIHandler):
    """
    Handler for chat completion requests.

    Supports both regular and streaming responses.
    """

    def initialize(self, config_store: Dict[str, Any]):
        """Initialize with config store."""
        self.config_store = config_store

    def _get_api_key(self) -> Optional[str]:
        """Get API key from config store or environment variable."""
        import os
        return self.config_store.get("apiKey") or os.environ.get("OPENAI_API_KEY")

    def _create_client(self) -> LLMClient:
        """Create LLM client with current config."""
        config = LLMConfig(
            api_endpoint=self.config_store.get("apiEndpoint", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
            api_key=self._get_api_key(),
            model=self.config_store.get("model", "kimi-k2-thinking"),
            temperature=self.config_store.get("temperature", 0.7),
            max_tokens=self.config_store.get("maxTokens", 4096),
            system_prompt=self.config_store.get("systemPrompt", ""),
            enable_streaming=self.config_store.get("enableStreaming", True),
            enable_vision=self.config_store.get("enableVision", True),
        )
        return LLMClient(config)

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


class ModelsHandler(APIHandler):
    """
    Handler for listing available models.
    """

    def initialize(self, config_store: Dict[str, Any]):
        """Initialize with config store."""
        self.config_store = config_store

    def _get_api_key(self) -> Optional[str]:
        """Get API key from config store or environment variable."""
        import os
        return self.config_store.get("apiKey") or os.environ.get("OPENAI_API_KEY")

    @web.authenticated
    async def get(self):
        """List available models from the API."""
        import os
        from openai import AsyncOpenAI

        api_key = self._get_api_key()
        if not api_key:
            raise web.HTTPError(401, "API key not configured")

        try:
            client = AsyncOpenAI(
                api_key=api_key,
                base_url=self.config_store.get("apiEndpoint", "https://api.openai.com/v1"),
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


class TestConnectionHandler(APIHandler):
    """
    Handler for testing API connection.
    """

    def initialize(self, config_store: Dict[str, Any]):
        """Initialize with config store."""
        self.config_store = config_store

    def _get_api_key(self) -> Optional[str]:
        """Get API key from config store or environment variable."""
        import os
        return self.config_store.get("apiKey") or os.environ.get("OPENAI_API_KEY")

    @web.authenticated
    async def get(self):
        """Test the API connection."""
        client = LLMClient(LLMConfig(
            api_endpoint=self.config_store.get("apiEndpoint", "https://api.openai.com/v1"),
            api_key=self._get_api_key(),
            model=self.config_store.get("model", "gpt-4o"),
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

    for route_pattern, handler, handler_args in routes:
        web_app.add_handlers(host_pattern, [(route_pattern, handler, handler_args)])