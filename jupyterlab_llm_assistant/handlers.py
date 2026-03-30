"""
HTTP handlers for the LLM Assistant extension.

Provides REST API endpoints for chat and configuration management.
"""

import json
import os
import asyncio
import logging
from typing import Dict, Any, Optional, List
from tornado import web
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join

from .llm_client import LLMClient, LLMConfig
from .serverextension import DEFAULT_SYSTEM_PROMPT
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

# Module-level logger
logger = logging.getLogger("jupyterlab_llm_assistant.handlers")


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

    def _build_safe_config(self) -> dict:
        """Build safe config dict excluding sensitive data."""
        config = self._get_config()
        return {
            "provider": config.get("provider", "openai"),
            "providerName": config.get("providerName", "OpenAI"),
            "apiEndpoint": config.get("apiEndpoint", ""),
            "apiKey": "",  # Never return actual API key
            "model": config.get("model", ""),
            "temperature": config.get("temperature", 0.7),
            "maxTokens": config.get("maxTokens", 4096),
            "systemPrompt": config.get("systemPrompt") or DEFAULT_SYSTEM_PROMPT,
            "enableStreaming": config.get("enableStreaming", True),
            "enableVision": config.get("enableVision", True),
            "hasApiKey": bool(self._get_api_key()),
        }


class ConfigHandler(BaseConfigHandler):
    """
    Handler for configuration management.

    GET: Retrieve current configuration
    POST: Update configuration
    """

    @web.authenticated
    async def get(self):
        """Get current configuration (excluding sensitive data)."""
        logger.info("[ConfigHandler] GET /llm-assistant/config")
        self.finish(json.dumps(self._build_safe_config()))

    @web.authenticated
    async def post(self):
        """Update configuration."""
        logger.info("[ConfigHandler] POST /llm-assistant/config")
        try:
            data = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            logger.warning("[ConfigHandler] Invalid JSON in request body")
            raise web.HTTPError(400, "Invalid JSON")

        # Debug: log request body (mask apiKey)
        debug_data = {k: (v if k != "apiKey" else "***") for k, v in data.items()}
        logger.debug(f"[ConfigHandler] request_body: {json.dumps(debug_data, ensure_ascii=False)[:500]}")

        # Check if provider changed - if so, reload provider defaults
        provider_changed = "provider" in data and data["provider"] != self.config_store.get("provider")
        if provider_changed:
            logger.info(f"[ConfigHandler] Provider changed to {data['provider']}, reloading provider defaults")
            # Get fresh provider defaults
            from .serverextension import get_provider_defaults
            provider_defaults = get_provider_defaults(data["provider"])
            # Update config_store with new provider defaults
            for key, value in provider_defaults.items():
                if key not in ["models"]:  # Don't override user's model choice
                    self.config_store[key] = value
            self.config_store["provider"] = data["provider"]

        # Update config store with new values from frontend
        # These override provider defaults (user's choices)
        allowed_keys = [
            "provider", "apiEndpoint", "model", "temperature", "maxTokens",
            "systemPrompt", "enableStreaming", "enableVision"
        ]

        updated_keys = []
        for key in allowed_keys:
            if key in data:
                self.config_store[key] = data[key]
                updated_keys.append(key)

        # Handle API key - always save to config.json
        if "apiKey" in data:
            self.config_store["apiKey"] = data["apiKey"]
            updated_keys.append("apiKey")

        logger.info(f"[ConfigHandler] Updated config keys: {updated_keys}")
        logger.info(f"[ConfigHandler] Final config: provider={self.config_store.get('provider')}, model={self.config_store.get('model')}, apiEndpoint={self.config_store.get('apiEndpoint')}")

        # Persist configuration to disk
        save_cb = self.config_store.get("_save_callback")
        if callable(save_cb):
            save_cb(self.config_store)
            logger.info("[ConfigHandler] Config persisted to disk")

        # Fix: do NOT call await self.get() — build response directly
        self.finish(json.dumps(self._build_safe_config()))


class ConfigReloadHandler(BaseConfigHandler):
    """
    Handler for reloading configuration from disk.

    POST: Reload configuration from config.json
    """

    @web.authenticated
    async def post(self):
        """Reload configuration from disk."""
        logger.info("[ConfigReloadHandler] POST /llm-assistant/config/reload")
        try:
            from .serverextension import _reload_config
            _reload_config()
            logger.info("[ConfigReloadHandler] Config reload successful")
            self.finish(json.dumps(self._build_safe_config()))
        except Exception as e:
            logger.error(f"[ConfigReloadHandler] Config reload failed: {e}")
            raise web.HTTPError(500, f"Failed to reload config: {e}")


class ChatHandler(BaseConfigHandler):
    """
    Handler for chat completion requests.

    Supports both regular and streaming responses.
    """

    def _create_client(self) -> LLMClient:
        """Create LLM client with current config."""
        config = self._get_config()
        return LLMClient(LLMConfig(
            api_endpoint=config.get("apiEndpoint") or "https://api.openai.com/v1",
            api_key=self._get_api_key(),
            model=config.get("model") or "gpt-4o",
            temperature=config.get("temperature") or 0.7,
            max_tokens=config.get("maxTokens") or 4096,
            system_prompt=config.get("systemPrompt") or "",
            enable_streaming=config.get("enableStreaming") if config.get("enableStreaming") is not None else True,
            enable_vision=config.get("enableVision") if config.get("enableVision") is not None else True,
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
        logger.info("[ChatHandler] POST /llm-assistant/chat")
        try:
            data = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            logger.warning("[ChatHandler] Invalid JSON in request body")
            raise web.HTTPError(400, "Invalid JSON")

        messages = data.get("messages", [])
        images = data.get("images")
        stream = data.get("stream", True)

        logger.info(f"[ChatHandler] stream={stream}, message_count={len(messages)}, has_images={bool(images)}")
        logger.debug(f"[ChatHandler] request_body: {json.dumps(data, ensure_ascii=False)[:1000]}")

        if not messages:
            logger.warning("[ChatHandler] No messages provided")
            raise web.HTTPError(400, "Messages are required")

        # Check for API key
        if not self._get_api_key():
            logger.warning("[ChatHandler] API key not configured")
            raise web.HTTPError(401, "API key not configured. Set OPENAI_API_KEY environment variable.")

        client = self._create_client()

        if stream:
            # Streaming response using SSE
            logger.info("[ChatHandler] Starting streaming response")
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
                logger.info("[ChatHandler] Streaming completed successfully")
            except Exception as e:
                logger.error(f"[ChatHandler] Streaming error: {e}")
                self.write(f"data: {json.dumps({'error': str(e)})}\n\n")
                await self.flush()
            finally:
                self.finish()
        else:
            # Non-streaming response
            logger.info("[ChatHandler] Starting non-streaming response")
            try:
                response = await client.chat(messages, images)
                logger.info(f"[ChatHandler] Non-streaming response completed, length={len(response)}")
                self.finish(json.dumps({"content": response}))
            except Exception as e:
                logger.error(f"[ChatHandler] Non-streaming error: {e}")
                raise web.HTTPError(500, str(e))


class ModelsHandler(BaseConfigHandler):
    """
    Handler for listing available models.
    """

    @web.authenticated
    async def get(self):
        """List available models from the API."""
        logger.info("[ModelsHandler] GET /llm-assistant/models")
        from openai import AsyncOpenAI

        api_key = self._get_api_key()
        if not api_key:
            logger.warning("[ModelsHandler] API key not configured")
            raise web.HTTPError(401, "API key not configured")

        try:
            client = AsyncOpenAI(
                api_key=api_key,
                base_url=self.config_store.get("apiEndpoint") or "https://api.openai.com/v1",
                timeout=120.0,
            )
            models = await client.models.list()
            model_list = [{"id": m.id, "owned_by": m.owned_by} for m in models.data]
            logger.info(f"[ModelsHandler] Retrieved {len(model_list)} models from API")
            self.finish(json.dumps({"models": model_list}))
        except Exception as e:
            logger.error(f"[ModelsHandler] Failed to fetch models: {e}")
            # Return default models if API call fails
            default_models = [
                {"id": "gpt-4o", "owned_by": "openai"},
                {"id": "gpt-4o-mini", "owned_by": "openai"},
                {"id": "gpt-4-turbo", "owned_by": "openai"},
                {"id": "gpt-4", "owned_by": "openai"},
                {"id": "gpt-3.5-turbo", "owned_by": "openai"},
            ]
            logger.info(f"[ModelsHandler] Returning {len(default_models)} default models")
            self.finish(json.dumps({"models": default_models, "error": str(e)}))


class ProvidersHandler(BaseConfigHandler):
    """
    Handler for listing available LLM providers.
    """

    @web.authenticated
    async def get(self):
        """Get list of available providers and their models."""
        logger.info("[ProvidersHandler] GET /llm-assistant/providers")
        from .serverextension import get_providers, get_provider_defaults

        providers = get_providers()
        provider_list = []

        for pid, pdata in providers.get("providers", {}).items():
            provider_list.append({
                "id": pid,
                "name": pdata.get("name", ""),
                "apiEndpoint": pdata.get("apiEndpoint", ""),
                "defaultModel": pdata.get("defaultModel", ""),
                "supportsStreaming": pdata.get("supportsStreaming", True),
                "supportsVision": pdata.get("supportsVision", False),
            })

        logger.info(f"[ProvidersHandler] Returning {len(provider_list)} providers")
        self.finish(json.dumps({"providers": provider_list}))


class TestConnectionHandler(BaseConfigHandler):
    """
    Handler for testing API connection.
    """

    @web.authenticated
    async def get(self):
        """Test the API connection."""
        logger.info("[TestConnectionHandler] GET /llm-assistant/test")
        config = self._get_config()
        api_endpoint = config.get("apiEndpoint") or "https://api.openai.com/v1"
        api_key = self._get_api_key()
        model = config.get("model") or "gpt-4o"

        logger.info(f"[TestConnectionHandler] config_store keys: {list(config.keys())}")
        logger.info(f"[TestConnectionHandler] Using: api_endpoint={api_endpoint}, api_key={'***' if api_key else 'None'}, model={model}")

        client = LLMClient(LLMConfig(
            api_endpoint=api_endpoint,
            api_key=api_key,
            model=model,
        ))

        logger.info("[TestConnectionHandler] Testing API connection...")
        result = await client.test_connection()
        logger.info(f"[TestConnectionHandler] Connection test result: {result.get('success', False)}")
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
        (url_path_join(base_url, "/llm-assistant/config/reload"), ConfigReloadHandler, {"config_store": config_store}),
        (url_path_join(base_url, "/llm-assistant/models"), ModelsHandler, {"config_store": config_store}),
        (url_path_join(base_url, "/llm-assistant/providers"), ProvidersHandler, {"config_store": config_store}),
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
        (url_path_join(base_url, "/llm-assistant/workspace/config"), WorkspaceConfigHandler, {"config_store": config_store}),
        (url_path_join(base_url, "/llm-assistant/workspace/sessions"), SessionListHandler),
        (url_path_join(base_url, r"/llm-assistant/workspace/sessions/([^/]+)"), SessionItemHandler),
        (url_path_join(base_url, "/llm-assistant/workspace/skills"), SkillListHandler),
        (url_path_join(base_url, "/llm-assistant/workspace/skills/install"), SkillInstallHandler),
        (url_path_join(base_url, r"/llm-assistant/workspace/skills/([^/]+)"), SkillDeleteHandler),
    ]

    for route_pattern, handler, *handler_args_list in routes:
        handler_args = handler_args_list[0] if handler_args_list else {}
        web_app.add_handlers(host_pattern, [(route_pattern, handler, handler_args)])