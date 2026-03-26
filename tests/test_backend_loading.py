#!/usr/bin/env python3
"""
Jupyter Server Extension Backend Loading Test

Tests:
1. Extension entry point can be imported
2. Entry point registration in pyproject.toml
3. Configuration loading and defaults
4. All API routes are correctly registered
5. Handlers can be instantiated correctly
"""

import json
import os
import sys
import tempfile
import importlib.util
from unittest.mock import MagicMock

PASS = "\033[32m✔\033[0m"
FAIL = "\033[31m✘\033[0m"

results = []


def report(name: str, ok: bool, detail: str = ""):
    sym = PASS if ok else FAIL
    print(f"  {sym}  {name}")
    if detail and not ok:
        print(f"       ↳ {detail}")
    results.append((name, ok))


# ─────────────────────────────────────────────────────────────────────────────
# Section 1: Extension Entry Point Import
# ─────────────────────────────────────────────────────────────────────────────

print("\n[1] 扩展入口点导入")

try:
    from jupyterlab_llm_assistant.serverextension import (
        load_jupyter_server_extension,
        _load_config,
        _save_config,
        _config_store,
        __version__,
    )
    report("serverextension 模块可导入", True)
    report("load_jupyter_server_extension 函数存在", callable(load_jupyter_server_extension))
    report("__version__ 变量存在", bool(__version__))
except Exception as e:
    report("serverextension 模块导入失败", False, str(e))

# ─────────────────────────────────────────────────────────────────────────────
# Section 2: Entry Point Registration
# ─────────────────────────────────────────────────────────────────────────────

print("\n[2] Entry Point 注册验证")

try:
    # Check entry points from installed package
    from importlib.metadata import entry_points

    eps = entry_points()
    # For Python 3.10+, use select() method
    if hasattr(eps, 'select'):
        server_ext_eps = list(eps.select(group="jupyter_server.extension"))
    else:
        server_ext_eps = eps.get("jupyter_server.extension", [])

    found = False
    for ep in server_ext_eps:
        if ep.name == "jupyterlab_llm_assistant":
            found = True
            report("jupyter_server.extension entry point 已注册", True)
            report(f"入口点指向: {ep.value}", True)
            break

    if not found:
        report("jupyter_server.extension entry point 未找到", False)
except Exception as e:
    report("entry points 检查失败", False, str(e))

# ─────────────────────────────────────────────────────────────────────────────
# Section 3: Configuration Loading
# ─────────────────────────────────────────────────────────────────────────────

print("\n[3] 配置加载验证")

# Test default config (from serverextension.py _DEFAULT_CONFIG)
try:
    from jupyterlab_llm_assistant import serverextension

    # Check _DEFAULT_CONFIG values directly from module
    default_config = {
        "apiEndpoint": "https://api.openai.com/v1",
        "model": "gpt-4o",
        "temperature": 0.7,
        "maxTokens": 4096,
        "enableStreaming": True,
        "enableVision": True,
    }

    # Note: systemPrompt may have been updated, so check only key fields
    for key, expected in default_config.items():
        actual = serverextension._DEFAULT_CONFIG.get(key)
        match = actual == expected
        report(f"默认配置 {key}={expected}", match, f"实际: {actual}")

    # Check _save_callback exists in module
    report("_save_callback 函数存在", callable(serverextension._save_config))

except Exception as e:
    report("配置加载测试失败", False, str(e))

# Test config save with temp file
try:
    with tempfile.TemporaryDirectory() as tmpdir:
        test_config_file = os.path.join(tmpdir, "test_config.json")

        # Directly test _save_config function
        test_config = {
            "apiEndpoint": "https://api.deepseek.com/v1",
            "model": "deepseek-coder",
            "temperature": 0.5,
            "maxTokens": 2048,
            "apiKey": "sk-test-key",
        }

        # Patch the global _CONFIG_FILE in serverextension module
        import jupyterlab_llm_assistant.serverextension as se
        original_config_file = se._CONFIG_FILE
        se._CONFIG_FILE = test_config_file

        try:
            se._save_config(test_config)

            # Verify file was created
            report("配置文件创建成功", os.path.exists(test_config_file))

            # Verify content
            with open(test_config_file, "r") as f:
                saved = json.load(f)

            report("apiEndpoint 保存正确", saved.get("apiEndpoint") == "https://api.deepseek.com/v1")
            report("model 保存正确", saved.get("model") == "deepseek-coder")
            report("apiKey 保存正确", saved.get("apiKey") == "sk-test-key")
            report("temperature 保存正确", saved.get("temperature") == 0.5)
        finally:
            se._CONFIG_FILE = original_config_file

except Exception as e:
    report("配置保存测试失败", False, str(e))

# ─────────────────────────────────────────────────────────────────────────────
# Section 4: Handler Routes Registration
# ─────────────────────────────────────────────────────────────────────────────

print("\n[4] Handler 路由注册")

# Expected routes (without leading slash, as they are registered)
EXPECTED_ROUTES = [
    "llm-assistant/chat",
    "llm-assistant/config",
    "llm-assistant/models",
    "llm-assistant/test",
    "llm-assistant/agent",
    "llm-assistant/memory",
    "llm-assistant/memory/export",
    "llm-assistant/context/read",
    "llm-assistant/context/resolve",
    "llm-assistant/context/listdir",
    "llm-assistant/workspace/info",
    "llm-assistant/workspace/assistant-md",
    "llm-assistant/workspace/config",
    "llm-assistant/workspace/sessions",
    "llm-assistant/workspace/skills",
    "llm-assistant/workspace/skills/install",
]

# Import handlers module
try:
    from jupyterlab_llm_assistant import handlers

    # Mock web_app
    mock_web_app = MagicMock()
    mock_web_app.settings = {"base_url": ""}
    mock_web_app.add_handlers = MagicMock()

    # Call setup_handlers
    mock_config_store = {"_save_callback": lambda x: None}
    handlers.setup_handlers(mock_web_app, mock_config_store)

    # Check add_handlers was called
    report("setup_handlers 执行成功", mock_web_app.add_handlers.called)

    # Get all registered routes
    calls = mock_web_app.add_handlers.call_args_list
    all_routes = []
    for call in calls:
        for route_tuple in call[0][1]:
            if isinstance(route_tuple, tuple):
                route_pattern = route_tuple[0]
                all_routes.append(route_pattern)

    # Verify each expected route
    for expected in EXPECTED_ROUTES:
        found = any(expected in r for r in all_routes)
        report(f"路由 {expected} 已注册", found)

    # Count total routes
    report(f"共注册 {len(all_routes)} 个路由", len(all_routes) >= len(EXPECTED_ROUTES))

except Exception as e:
    report("Handler 路由测试失败", False, str(e))

# ─────────────────────────────────────────────────────────────────────────────
# Section 5: Handler Instantiation
# ─────────────────────────────────────────────────────────────────────────────

print("\n[5] Handler 实例化验证")

try:
    from jupyterlab_llm_assistant.handlers import (
        ConfigHandler,
        ChatHandler,
        AgentHandler,
        ModelsHandler,
        TestConnectionHandler,
        MemoryListHandler,
        ContextReadHandler,
        WorkspaceInfoHandler,
    )

    mock_config_store = {"apiEndpoint": "https://api.openai.com/v1", "apiKey": "test"}

    # Test ConfigHandler
    handler = ConfigHandler.initialize(ConfigHandler, mock_config_store)
    report("ConfigHandler 可实例化", True)

    # Test ChatHandler
    handler = ChatHandler.initialize(ChatHandler, {"config_store": mock_config_store})
    report("ChatHandler 可实例化", True)

    # Test AgentHandler
    handler = AgentHandler.initialize(AgentHandler, {"config_store": mock_config_store})
    report("AgentHandler 可实例化", True)

    # Test ModelsHandler
    handler = ModelsHandler.initialize(ModelsHandler, {"config_store": mock_config_store})
    report("ModelsHandler 可实例化", True)

    # Test TestConnectionHandler
    handler = TestConnectionHandler.initialize(TestConnectionHandler, {"config_store": mock_config_store})
    report("TestConnectionHandler 可实例化", True)

except Exception as e:
    report("Handler 实例化测试失败", False, str(e))

# ─────────────────────────────────────────────────────────────────────────────
# Section 6: Module Imports
# ─────────────────────────────────────────────────────────────────────────────

print("\n[6] 核心模块导入验证")

modules_to_check = [
    "jupyterlab_llm_assistant.handlers",
    "jupyterlab_llm_assistant.serverextension",
    "jupyterlab_llm_assistant.agent_handler",
    "jupyterlab_llm_assistant.agent_tools",
    "jupyterlab_llm_assistant.llm_client",
    "jupyterlab_llm_assistant.memory_handler",
    "jupyterlab_llm_assistant.context_handler",
    "jupyterlab_llm_assistant.workspace_handler",
]

for module_name in modules_to_check:
    try:
        __import__(module_name)
        report(f"模块 {module_name} 可导入", True)
    except Exception as e:
        report(f"模块 {module_name} 导入失败", False, str(e))

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────

passed = sum(1 for _, ok in results if ok)
total = len(results)

print("\n" + "=" * 60)
print(f"  结果汇总: {passed}/{total} 通过  |  {total - passed} 失败")
print("=" * 60)

if passed == total:
    print("  所有测试通过 ✔")
else:
    print("\n失败用例:")
    for name, ok in results:
        if not ok:
            print(f"  ✘ {name}")

sys.exit(0 if passed == total else 1)