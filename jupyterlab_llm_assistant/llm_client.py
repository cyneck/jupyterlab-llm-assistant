"""
LLM API client for the JupyterLab LLM Assistant extension.

Supports OpenAI-compatible APIs with streaming responses and vision capabilities.
"""

import os
import json
import asyncio
from typing import AsyncGenerator, List, Dict, Any, Optional, Union
from dataclasses import dataclass, field
import aiohttp
from openai import AsyncOpenAI


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
    system_prompt: str = "You are a helpful AI coding assistant."
    enable_streaming: bool = True
    enable_vision: bool = True

    @classmethod
    def from_settings(cls, settings: Dict[str, Any]) -> "LLMConfig":
        """Create config from settings dictionary."""
        # API key from environment variable
        api_key = os.environ.get("OPENAI_API_KEY")

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
            )
        return self._client

    def _build_messages(
        self,
        messages: List[Dict[str, Any]],
        include_system: bool = True
    ) -> List[Dict[str, Any]]:
        """Build the message list for the API call."""
        result = []

        if include_system and self.config.system_prompt:
            result.append({
                "role": "system",
                "content": self.config.system_prompt
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
            Dictionary with connection status
        """
        if not self.config.api_key:
            return {
                "success": False,
                "error": "API key not configured. Set OPENAI_API_KEY environment variable."
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
            return {
                "success": False,
                "error": str(e)
            }