"""
LLM API client for the JupyterLab LLM Assistant extension.

Supports OpenAI-compatible APIs with streaming responses and vision capabilities.
"""

import os
import json
import asyncio
from typing import AsyncGenerator, List, Dict, Any, Optional, Union
from dataclasses import dataclass, field
from openai import AsyncOpenAI

from .serverextension import DEFAULT_SYSTEM_PROMPT


@dataclass
class Message:
    """Represents a chat message."""
    role: str  # 'system', 'user', 'assistant'
    content: Union[str, List[Dict[str, Any]]]

    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary format."""
        return {
            "role": self.role,
            "content": self.content
        }


@dataclass
class LLMConfig:
    """Configuration for LLM client."""
    api_endpoint: str = "https://api.openai.com/v1"
    api_key: Optional[str] = None
    model: str = "gpt-4o"
    temperature: float = 0.7
    max_tokens: int = 4096
    system_prompt: str = DEFAULT_SYSTEM_PROMPT
    enable_streaming: bool = True
    enable_vision: bool = True

    @classmethod
    def from_settings(cls, settings: Dict[str, Any]) -> "LLMConfig":
        """Create config from settings dictionary.

        Priority: settings["apiKey"] > environment variable > None
        """
        # API key: config file takes priority over environment variable
        api_key = settings.get("apiKey") or os.environ.get("OPENAI_API_KEY")

        return cls(
            api_endpoint=settings.get("apiEndpoint", cls.api_endpoint),
            api_key=api_key,
            model=settings.get("model", cls.model),
            temperature=settings.get("temperature", cls.temperature),
            max_tokens=settings.get("maxTokens", cls.max_tokens),
            system_prompt=settings.get("systemPrompt", cls.system_prompt),
            enable_streaming=settings.get("enableStreaming", cls.enable_streaming),
            enable_vision=settings.get("enableVision", cls.enable_vision),
        )


class LLMClient:
    """
    LLM client supporting OpenAI-compatible APIs.
    """

    def __init__(self, config: LLMConfig):
        self.config = config
        self._client: Optional[AsyncOpenAI] = None

    @property
    def client(self) -> AsyncOpenAI:
        """Get or create OpenAI client."""
        if self._client is None:
            self._client = AsyncOpenAI(
                api_key=self.config.api_key,
                base_url=self.config.api_endpoint,
                timeout=120.0,  # 120 seconds timeout for API calls
            )
        return self._client

    def _build_messages(
        self,
        messages: List[Dict[str, Any]],
        include_system: bool = True
    ) -> List[Dict[str, Any]]:
        """Build the message list for the API call.
        
        Active memories are automatically appended to the system prompt so that
        the LLM always has access to persistent context without the user having
        to repeat it each time.
        """
        from .memory_handler import get_memory_store  # lazy import to avoid circular

        result = []

        if include_system:
            system_content = self.config.system_prompt or DEFAULT_SYSTEM_PROMPT
            # Append active memories to the system prompt
            memory_text = get_memory_store().export_as_text()
            if memory_text:
                system_content = system_content + "\n\n" + memory_text
            result.append({
                "role": "system",
                "content": system_content
            })

        result.extend(messages)
        return result

    def _build_content(
        self,
        text: str,
        images: Optional[List[str]] = None
    ) -> Union[str, List[Dict[str, Any]]]:
        """
        Build message content with optional images.

        Args:
            text: The text content
            images: List of base64-encoded image strings (with data URI prefix)

        Returns:
            Either a string (text only) or a list of content parts (text + images)
        """
        if not images or not self.config.enable_vision:
            return text

        content = [{"type": "text", "text": text}]

        for image_data in images:
            # Image data should already be in format: data:image/xxx;base64,...
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": image_data
                }
            })

        return content

    async def chat(
        self,
        messages: List[Dict[str, Any]],
        images: Optional[List[str]] = None
    ) -> str:
        """
        Send a chat completion request (non-streaming).

        Args:
            messages: List of message dictionaries
            images: Optional list of base64-encoded images

        Returns:
            The assistant's response text
        """
        # Build the messages with the last user message potentially including images
        api_messages = self._build_messages(messages)

        # If there are images and the last message is from the user, update it
        if images and api_messages[-1]["role"] == "user":
            last_msg = api_messages[-1]
            last_msg["content"] = self._build_content(
                last_msg["content"] if isinstance(last_msg["content"], str) else last_msg["content"],
                images
            )

        response = await self.client.chat.completions.create(
            model=self.config.model,
            messages=api_messages,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            stream=False,
        )

        return response.choices[0].message.content or ""

    async def chat_stream(
        self,
        messages: List[Dict[str, Any]],
        images: Optional[List[str]] = None
    ) -> AsyncGenerator[str, None]:
        """
        Send a streaming chat completion request.

        Args:
            messages: List of message dictionaries
            images: Optional list of base64-encoded images

        Yields:
            Chunks of the assistant's response
        """
        # Build the messages with the last user message potentially including images
        api_messages = self._build_messages(messages)

        # If there are images and the last message is from the user, update it
        if images and api_messages[-1]["role"] == "user":
            last_msg = api_messages[-1]
            last_msg["content"] = self._build_content(
                last_msg["content"] if isinstance(last_msg["content"], str) else last_msg["content"],
                images
            )

        stream = await self.client.chat.completions.create(
            model=self.config.model,
            messages=api_messages,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def test_connection(self) -> Dict[str, Any]:
        """
        Test the API connection.

        Returns:
            Dictionary with connection status and details
        """
        if not self.config.api_key:
            return {
                "success": False,
                "error": "API key not configured. Set apiKey in config or OPENAI_API_KEY environment variable."
            }

        try:
            response = await self.client.chat.completions.create(
                model=self.config.model,
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=10,
            )
            return {
                "success": True,
                "model": self.config.model,
                "response": response.choices[0].message.content
            }
        except Exception as e:
            error_str = str(e)
            # Provide more helpful error messages for common issues
            if "timeout" in error_str.lower() or "timed out" in error_str.lower():
                error_detail = f"Connection timeout. API endpoint: {self.config.api_endpoint}. Check network/firewall."
            elif "authentication" in error_str.lower() or "auth" in error_str.lower() or "api key" in error_str.lower():
                error_detail = f"Authentication failed. API endpoint: {self.config.api_endpoint}. Verify API key is valid."
            elif "connection" in error_str.lower():
                error_detail = f"Connection failed. API endpoint: {self.config.api_endpoint}. Check network connectivity."
            else:
                error_detail = error_str
            return {
                "success": False,
                "error": error_detail,
                "error_type": type(e).__name__,
                "api_endpoint": self.config.api_endpoint,
                "model": self.config.model,
            }