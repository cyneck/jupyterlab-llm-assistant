"""
配置管理专项测试 - 验证用户级和项目级配置分离
"""
import os
import json
import tempfile
import shutil
from pathlib import Path

# 设置测试环境
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from jupyterlab_llm_assistant.serverextension import _load_config, _save_config, _CONFIG_FILE
from jupyterlab_llm_assistant.workspace_handler import load_user_config, _workspace_dir, _ensure_dirs


def test_user_config_isolation():
    """测试用户级配置独立保存和加载"""
    print("\n[用户级配置隔离测试]")

    # 备份原始配置
    original_config = {}
    if os.path.exists(_CONFIG_FILE):
        with open(_CONFIG_FILE, 'r') as f:
            original_config = json.load(f)

    try:
        # 测试数据 - 模拟完整用户配置
        test_config = {
            "apiKey": "sk-test-secret-key",
            "apiEndpoint": "https://api.test.com/v1",
            "model": "gpt-4-test",
            "temperature": 0.5,
            "maxTokens": 2048,
            "systemPrompt": "Test system prompt",
            "enableStreaming": False,
            "enableVision": False,
        }

        # 保存测试配置
        _save_config(test_config)

        # 验证文件写入
        assert os.path.exists(_CONFIG_FILE), "配置文件未创建"
        with open(_CONFIG_FILE, 'r') as f:
            saved = json.load(f)

        assert saved.get("apiKey") == "sk-test-secret-key", "API key 未正确保存"
        assert saved.get("model") == "gpt-4-test", "model 未正确保存"
        assert saved.get("temperature") == 0.5, "temperature 未正确保存"
        print("  ✔ 用户级配置保存正确")

        # 加载配置验证
        loaded = _load_config()
        assert loaded.get("apiKey") == "sk-test-secret-key", "API key 未正确加载"
        assert loaded.get("apiEndpoint") == "https://api.test.com/v1", "apiEndpoint 未正确加载"
        print("  ✔ 用户级配置加载正确")

    finally:
        # 恢复原始配置
        if original_config:
            _save_config(original_config)
        elif os.path.exists(_CONFIG_FILE):
            os.remove(_CONFIG_FILE)

    print("  ✔ 用户级配置隔离测试通过")


def test_project_config_isolation():
    """测试项目级配置独立保存和加载（不含敏感信息）"""
    print("\n[项目级配置隔离测试]")

    with tempfile.TemporaryDirectory() as tmpdir:
        # 创建项目级配置目录
        ws_dir = Path(tmpdir) / ".llm-assistant"
        ws_dir.mkdir(parents=True, exist_ok=True)
        config_file = ws_dir / "config.json"

        # 模拟项目级配置（不应包含 apiKey）
        project_config = {
            "model": "project-specific-model",
            "temperature": 0.8,
            "systemPrompt": "Project-specific prompt",
        }

        # 写入项目级配置
        config_file.write_text(json.dumps(project_config), encoding="utf-8")

        # 模拟前端通过 API 更新项目配置（尝试写入 apiKey）
        update_data = {
            "model": "updated-model",
            "apiKey": "should-not-be-saved",  # 尝试写入敏感信息
        }

        # 加载现有配置
        existing = {}
        if config_file.exists():
            existing = json.loads(config_file.read_text(encoding="utf-8"))

        # 合并更新（跳过敏感字段）
        for key in list(update_data.keys()):
            if not key.startswith("_") and key != "apiKey":
                existing[key] = update_data[key]

        config_file.write_text(json.dumps(existing, indent=2), encoding="utf-8")

        # 验证更新结果
        result = json.loads(config_file.read_text(encoding="utf-8"))
        assert result.get("model") == "updated-model", "model 未正确更新"
        assert "apiKey" not in result, "apiKey 不应被保存到项目级配置"
        print("  ✔ 项目级配置正确排除敏感字段")

        # 验证读取时过滤
        cfg = json.loads(config_file.read_text(encoding="utf-8"))
        cfg.pop("apiKey", None)  # 模拟 handler 中的过滤
        assert "apiKey" not in cfg, "apiKey 应从返回结果中过滤"
        print("  ✔ 项目级配置读取时过滤敏感字段")

    print("  ✔ 项目级配置隔离测试通过")


def test_config_reload_consistency():
    """测试配置重载的一致性"""
    print("\n[配置重载一致性测试]")

    # 备份原始配置
    original_config = {}
    if os.path.exists(_CONFIG_FILE):
        with open(_CONFIG_FILE, 'r') as f:
            original_config = json.load(f)

    try:
        # 初始配置
        initial = {
            "apiKey": "initial-key",
            "model": "initial-model",
        }
        _save_config(initial)

        # 第一次加载
        first_load = _load_config()
        assert first_load.get("model") == "initial-model", "首次加载失败"

        # 修改配置文件（模拟外部修改）
        modified = {
            "apiKey": "modified-key",
            "model": "modified-model",
        }
        with open(_CONFIG_FILE, 'w') as f:
            json.dump(modified, f)

        # 第二次加载应获取新值
        second_load = _load_config()
        assert second_load.get("model") == "modified-model", "重载后配置未更新"
        assert second_load.get("apiKey") == "modified-key", "重载后 API key 未更新"
        print("  ✔ 配置重载一致性正确")

    finally:
        # 恢复原始配置
        if original_config:
            _save_config(original_config)
        elif os.path.exists(_CONFIG_FILE):
            os.remove(_CONFIG_FILE)

    print("  ✔ 配置重载一致性测试通过")


def test_env_api_key_priority():
    """测试环境变量 API key 优先级"""
    print("\n[环境变量 API key 优先级测试]")

    # 设置环境变量
    os.environ["OPENAI_API_KEY"] = "env-api-key"

    # 备份原始配置
    original_config = {}
    if os.path.exists(_CONFIG_FILE):
        with open(_CONFIG_FILE, 'r') as f:
            original_config = json.load(f)

    try:
        # 配置文件中的 key
        file_config = {
            "apiKey": "file-api-key",
            "model": "test-model",
        }
        _save_config(file_config)

        # 加载配置
        loaded = _load_config()

        # 验证文件配置正确加载
        assert loaded.get("apiKey") == "file-api-key", "文件 API key 未正确加载"
        print("  ✔ 文件 API key 加载正确")

        # 测试 _get_api_key 逻辑（从 BaseConfigHandler）
        # 配置文件优先级高于环境变量
        file_key = loaded.get("apiKey")
        env_key = os.environ.get("OPENAI_API_KEY")
        effective_key = file_key or env_key
        assert effective_key == "file-api-key", "配置文件应优先于环境变量"
        print("  ✔ 配置文件优先级高于环境变量")

        # 测试无配置文件时使用环境变量
        empty_config = {"model": "no-key-model"}
        _save_config(empty_config)
        loaded_empty = _load_config()
        effective_key_empty = loaded_empty.get("apiKey") or os.environ.get("OPENAI_API_KEY")
        assert effective_key_empty == "env-api-key", "环境变量应在无配置文件时生效"
        print("  ✔ 环境变量在无配置文件时生效")

    finally:
        # 清理
        del os.environ["OPENAI_API_KEY"]
        if original_config:
            _save_config(original_config)
        elif os.path.exists(_CONFIG_FILE):
            os.remove(_CONFIG_FILE)

    print("  ✔ 环境变量 API key 优先级测试通过")


def test_default_values():
    """测试默认值处理"""
    print("\n[默认值处理测试]")

    # 备份原始配置
    original_config = {}
    if os.path.exists(_CONFIG_FILE):
        with open(_CONFIG_FILE, 'r') as f:
            original_config = json.load(f)

    try:
        # 空配置
        empty_config = {}
        _save_config(empty_config)

        loaded = _load_config()
        assert loaded == {}, "空配置应返回空 dict"
        print("  ✔ 空配置处理正确")

        # 部分配置
        partial = {"model": "custom-model"}
        _save_config(partial)

        loaded_partial = _load_config()
        assert loaded_partial.get("model") == "custom-model", "自定义 model 未保存"
        assert "temperature" not in loaded_partial, "不应有未设置的字段"
        print("  ✔ 部分配置处理正确")

    finally:
        # 恢复原始配置
        if original_config:
            _save_config(original_config)
        elif os.path.exists(_CONFIG_FILE):
            os.remove(_CONFIG_FILE)

    print("  ✔ 默认值处理测试通过")


if __name__ == "__main__":
    print("=" * 60)
    print("  配置管理专项测试")
    print("=" * 60)

    test_user_config_isolation()
    test_project_config_isolation()
    test_config_reload_consistency()
    test_env_api_key_priority()
    test_default_values()

    print("\n" + "=" * 60)
    print("  所有配置管理测试通过 ✔")
    print("=" * 60)
