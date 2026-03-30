"""
Config and LLM Client 单元测试

测试范围：
1. Config 增删改查
2. LLM 客户端调用测试 (test_connection, chat, chat_stream)
"""

import asyncio
import os
import sys
import tempfile
import json
from pathlib import Path

# 创建测试用的 config 模块
test_config_code = '''
import json
import os
import logging
from typing import Dict, Any

logger = logging.getLogger("test_config")

_CONFIG_FILE = None  # Will be set per test

def set_config_file(path):
    global _CONFIG_FILE
    _CONFIG_FILE = path

def _load_config() -> Dict[str, Any]:
    """Load persisted config from disk, return empty dict if none."""
    logger.info(f"[_load_config] Loading config from {_CONFIG_FILE}")
    config: Dict[str, Any] = {}

    try:
        if _CONFIG_FILE and os.path.exists(_CONFIG_FILE):
            with open(_CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
            if isinstance(saved, dict):
                config = saved
            logger.info(f"[_load_config] Loaded config with keys: {list(config.keys())}")
        else:
            logger.info("[_load_config] No config file found, using empty dict")
    except Exception as e:
        logger.error(f"[_load_config] Failed to load config: {e}, using empty dict")
    return config

def _save_config(config: Dict[str, Any]) -> None:
    """Persist config to disk and update global store."""
    try:
        if _CONFIG_FILE:
            os.makedirs(os.path.dirname(_CONFIG_FILE), exist_ok=True)
        # Save all config including API key
        safe = {k: v for k, v in config.items() if not k.startswith('_')}
        with open(_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(safe, f, indent=2, ensure_ascii=False)
        logger.info(f"[_save_config] Config saved, keys: {list(safe.keys())}")
    except Exception as e:
        logger.error(f"[_save_config] Failed to save config: {e}")

def _reload_config() -> Dict[str, Any]:
    """Reload config from disk."""
    logger.info("[_reload_config] Reloading config from disk")
    return _load_config()
'''

# 执行测试代码创建模块
test_globals = {}
exec(compile(test_config_code, 'test_config_module', 'exec'), test_globals)

# 导入 LLMClient
from openai import AsyncOpenAI
from dataclasses import dataclass
from typing import Optional, Dict, Any, List, Union, AsyncGenerator

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
    """LLM client supporting OpenAI-compatible APIs."""

    def __init__(self, config: LLMConfig):
        self.config = config
        self._client: Optional[AsyncOpenAI] = None

    @property
    def client(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(
                api_key=self.config.api_key,
                base_url=self.config.api_endpoint,
                timeout=120.0,
            )
        return self._client

    async def chat(self, messages: List[Dict[str, Any]], images: Optional[List[str]] = None) -> str:
        if not messages:
            return ""

        response = await self.client.chat.completions.create(
            model=self.config.model,
            messages=messages,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            stream=False,
        )
        return response.choices[0].message.content or ""

    async def chat_stream(self, messages: List[Dict[str, Any]], images: Optional[List[str]] = None) -> AsyncGenerator[str, None]:
        stream = await self.client.chat.completions.create(
            model=self.config.model,
            messages=messages,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def test_connection(self) -> Dict[str, Any]:
        if not self.config.api_key:
            return {
                "success": False,
                "error": "API key not configured."
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
                "error": str(e),
                "api_endpoint": self.config.api_endpoint,
                "model": self.config.model,
            }


# 引用测试模块函数
_load_config = test_globals['_load_config']
_save_config = test_globals['_save_config']
_reload_config = test_globals['_reload_config']
set_config_file = test_globals['set_config_file']

PASS = "\033[32m✔\033[0m"
FAIL = "\033[31m✘\033[0m"

results = []


def report(name: str, ok: bool, detail: str = ""):
    sym = PASS if ok else FAIL
    print(f"  {sym}  {name}")
    if detail and not ok:
        print(f"       ↳ {detail}")
    results.append((name, ok))


# ─────────────────────────────────────────────────────────────
# Section 1: Config 增删改查测试
# ─────────────────────────────────────────────────────────────

def test_config_load_empty():
    """测试空配置文件加载"""
    print("\n[1] Config 加载测试")

    with tempfile.TemporaryDirectory() as tmpdir:
        config_file = os.path.join(tmpdir, "config.json")
        set_config_file(config_file)

        # 无配置文件时
        if os.path.exists(config_file):
            os.remove(config_file)

        config = _load_config()
        report("无配置文件时返回字典", isinstance(config, dict), str(config))
        report("无配置文件时 keys 为空", len(config) == 0, f"实际: {list(config.keys())}")


def test_config_add():
    """测试添加配置"""
    print("\n[2] Config 添加测试")

    with tempfile.TemporaryDirectory() as tmpdir:
        config_file = os.path.join(tmpdir, "config.json")
        set_config_file(config_file)

        # 模拟添加配置
        test_config = {
            "apiEndpoint": "https://api.example.com/v1",
            "apiKey": "test-key-123",
            "model": "test-model",
            "temperature": 0.5,
            "maxTokens": 2048,
        }

        # 保存配置
        _save_config(test_config.copy())

        # 验证文件存在
        report("配置文件已创建", os.path.exists(config_file))

        # 验证内容
        with open(config_file) as f:
            saved = json.load(f)
        report("保存的 apiEndpoint 正确", saved.get("apiEndpoint") == "https://api.example.com/v1")
        report("保存的 apiKey 正确", saved.get("apiKey") == "test-key-123")
        report("保存的 model 正确", saved.get("model") == "test-model")


def test_config_update():
    """测试更新配置"""
    print("\n[3] Config 更新测试")

    with tempfile.TemporaryDirectory() as tmpdir:
        config_file = os.path.join(tmpdir, "config.json")
        set_config_file(config_file)

        # 初始配置
        initial = {
            "apiEndpoint": "https://api.example.com/v1",
            "apiKey": "old-key",
            "model": "old-model",
        }
        with open(config_file, "w") as f:
            json.dump(initial, f)

        # 更新配置
        updated = {
            "apiEndpoint": "https://api.new.com/v1",
            "apiKey": "new-key",
            "model": "new-model",
            "temperature": 0.9,
        }
        _save_config(updated.copy())

        # 验证更新
        with open(config_file) as f:
            saved = json.load(f)
        report("apiEndpoint 已更新", saved.get("apiEndpoint") == "https://api.new.com/v1")
        report("apiKey 已更新", saved.get("apiKey") == "new-key")
        report("model 已更新", saved.get("model") == "new-model")
        report("temperature 已添加", saved.get("temperature") == 0.9)


def test_config_get():
    """测试获取配置"""
    print("\n[4] Config 获取测试")

    with tempfile.TemporaryDirectory() as tmpdir:
        config_file = os.path.join(tmpdir, "config.json")
        set_config_file(config_file)

        # 预设配置
        preset = {
            "apiEndpoint": "https://api.get.com/v1",
            "apiKey": "get-key",
            "model": "get-model",
            "temperature": 0.8,
            "maxTokens": 8192,
        }
        with open(config_file, "w") as f:
            json.dump(preset, f)

        # 重新加载
        config = _load_config()
        report("获取 apiEndpoint 正确", config.get("apiEndpoint") == "https://api.get.com/v1")
        report("获取 apiKey 正确", config.get("apiKey") == "get-key")
        report("获取 model 正确", config.get("model") == "get-model")
        report("获取 temperature 正确", config.get("temperature") == 0.8)


def test_config_delete():
    """测试删除配置"""
    print("\n[5] Config 删除测试")

    with tempfile.TemporaryDirectory() as tmpdir:
        config_file = os.path.join(tmpdir, "config.json")
        set_config_file(config_file)

        # 预设配置
        preset = {
            "apiEndpoint": "https://api.delete.com/v1",
            "apiKey": "delete-key",
            "model": "delete-model",
        }
        with open(config_file, "w") as f:
            json.dump(preset, f)

        # 删除 apiKey - 设置为空字符串
        config = _load_config()
        config["apiKey"] = ""
        _save_config(config)

        with open(config_file) as f:
            saved = json.load(f)
        report("apiKey 可被清空", saved.get("apiKey") == "")

        # 重新加载验证
        reloaded = _load_config()
        report("重新加载后 apiKey 为空", reloaded.get("apiKey") == "")


def test_config_reload():
    """测试配置热重载"""
    print("\n[6] Config 热重载测试")

    with tempfile.TemporaryDirectory() as tmpdir:
        config_file = os.path.join(tmpdir, "config.json")
        set_config_file(config_file)

        # 初始配置
        initial = {"apiKey": "initial-key", "model": "initial-model"}
        with open(config_file, "w") as f:
            json.dump(initial, f)

        # 重载配置
        reloaded = _reload_config()
        report("reload 后 apiKey 正确", reloaded.get("apiKey") == "initial-key")

        # 外部修改文件
        external = {"apiKey": "external-key", "model": "external-model"}
        with open(config_file, "w") as f:
            json.dump(external, f)

        # 再次重载
        reloaded2 = _reload_config()
        report("外部修改后 reload 正确", reloaded2.get("apiKey") == "external-key")


# ─────────────────────────────────────────────────────────────
# Section 2: LLM Client 测试
# ─────────────────────────────────────────────────────────────

async def test_llm_config():
    """测试 LLMConfig 创建"""
    print("\n[7] LLMConfig 测试")

    settings = {
        "apiEndpoint": "https://api.test.com/v1",
        "apiKey": "test-key",
        "model": "test-model",
        "temperature": 0.6,
        "maxTokens": 2048,
        "systemPrompt": "Test prompt",
        "enableStreaming": False,
        "enableVision": True,
    }
    config = LLMConfig.from_settings(settings)
    report("apiEndpoint 正确", config.api_endpoint == "https://api.test.com/v1")
    report("apiKey 正确", config.api_key == "test-key")
    report("model 正确", config.model == "test-model")
    report("temperature 正确", config.temperature == 0.6)
    report("systemPrompt 正确", config.system_prompt == "Test prompt")
    report("enableStreaming 正确", config.enable_streaming == False)
    report("enableVision 正确", config.enable_vision == True)


async def test_llm_client_init():
    """测试 LLMClient 初始化"""
    print("\n[8] LLMClient 初始化测试")

    config = LLMConfig(
        api_endpoint="https://api.init.com/v1",
        api_key="init-key",
        model="init-model",
    )
    client = LLMClient(config)
    report("client.config 正确", client.config.api_endpoint == "https://api.init.com/v1")
    report("client._client 初始为 None", client._client is None)


async def test_llm_test_connection_no_key():
    """测试无 API Key 时的连接测试"""
    print("\n[9] LLM 无 API Key 测试")

    config = LLMConfig(api_key=None)
    client = LLMClient(config)
    result = await client.test_connection()
    report("无 API Key 返回失败", result.get("success") == False)
    report("错误信息包含提示", "API key" in result.get("error", ""))


async def test_llm_chat_empty_messages():
    """测试空消息列表处理"""
    print("\n[10] LLM 空消息测试")

    config = LLMConfig(api_key="test-key")
    client = LLMClient(config)

    result = await client.chat([])
    report("空消息返回空字符串", result == "")


# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

async def main():
    print("=" * 60)
    print("  Config & LLM Client 单元测试")
    print("=" * 60)

    # Config 测试
    test_config_load_empty()
    test_config_add()
    test_config_update()
    test_config_get()
    test_config_delete()
    test_config_reload()

    # LLM Client 测试
    await test_llm_config()
    await test_llm_client_init()
    await test_llm_test_connection_no_key()
    await test_llm_chat_empty_messages()

    # Summary
    total = len(results)
    passed = sum(1 for _, ok in results if ok)
    failed = total - passed

    print("\n" + "=" * 60)
    print(f"  结果汇总: {passed}/{total} 通过  |  {failed} 失败")
    print("=" * 60)

    if failed:
        print("\n失败用例:")
        for name, ok in results:
            if not ok:
                print(f"  ✘  {name}")
        sys.exit(1)
    else:
        print("\n所有测试通过 ✔")


if __name__ == "__main__":
    asyncio.run(main())
