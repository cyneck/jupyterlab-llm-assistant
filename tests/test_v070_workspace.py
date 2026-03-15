"""
v0.7.0 workspace_handler + context_handler 单元测试

测试范围：
1. _workspace_dir 路径计算
2. _ensure_dirs 目录创建
3. load_assistant_md 读取逻辑
4. load_project_config 读取逻辑
5. YAML skill manifest 加载
6. ContextListDirHandler 逻辑（直接调用 os.listdir）
7. ContextListDirHandler SKIP_NAMES 过滤
"""

import asyncio
import json
import os
import sys
import tempfile
import importlib.util
from pathlib import Path

# ── Load modules directly (no jupyter_server dependency) ──────────────────────

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def _load(name, relpath):
    spec = importlib.util.spec_from_file_location(name, os.path.join(_root, relpath))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

# workspace_handler needs yaml; make sure it's importable
try:
    import yaml  # noqa: F401
except ImportError:
    print("ERROR: PyYAML is not installed. Run: pip install pyyaml")
    sys.exit(1)

ws_mod = _load("workspace_handler", "jupyterlab_llm_assistant/workspace_handler.py")
ctx_mod = _load("context_handler", "jupyterlab_llm_assistant/context_handler.py")

load_assistant_md = ws_mod.load_assistant_md
load_project_config = ws_mod.load_project_config
_workspace_dir = ws_mod._workspace_dir
_ensure_dirs = ws_mod._ensure_dirs

SKIP_NAMES = ctx_mod.ContextListDirHandler.SKIP_NAMES

# ── Test harness ──────────────────────────────────────────────────────────────

PASS = "\033[32m✔\033[0m"
FAIL = "\033[31m✘\033[0m"
results = []


def report(name: str, ok: bool, detail: str = ""):
    sym = PASS if ok else FAIL
    print(f"  {sym}  {name}")
    if detail and not ok:
        print(f"       ↳ {detail}")
    results.append((name, ok))


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_workspace_dir_path():
    print("\n[1] _workspace_dir 路径计算")
    with tempfile.TemporaryDirectory() as tmp:
        ws = _workspace_dir(tmp)
        report("路径末尾为 .llm-assistant", ws.name == ".llm-assistant")
        report("父目录是给定 root", ws.parent == Path(tmp))

    # No root → uses os.getcwd()
    ws2 = _workspace_dir("")
    report("空 root 使用 cwd", ws2.parent == Path(os.getcwd()))


def test_ensure_dirs():
    print("\n[2] _ensure_dirs 目录创建")
    with tempfile.TemporaryDirectory() as tmp:
        ws = _workspace_dir(tmp)
        _ensure_dirs(ws)
        report(".llm-assistant/ 已创建", ws.exists())
        report("sessions/ 已创建", (ws / "sessions").exists())
        report("skills/ 已创建", (ws / "skills").exists())

        # idempotent
        _ensure_dirs(ws)
        report("幂等性：重复调用不报错", ws.exists())


def test_load_assistant_md():
    print("\n[3] load_assistant_md 读取")
    with tempfile.TemporaryDirectory() as tmp:
        result = load_assistant_md(tmp)
        report("文件不存在返回空串", result == "")

        ws = _workspace_dir(tmp)
        _ensure_dirs(ws)
        (ws / "ASSISTANT.md").write_text("# My Project\n\nHello.", encoding="utf-8")
        result2 = load_assistant_md(tmp)
        report("文件存在时正确读取", result2 == "# My Project\n\nHello.", result2)

        # Unreadable (simulate corrupt — write binary bytes that are invalid UTF-8)
        try:
            (ws / "ASSISTANT.md").write_bytes(b"\xff\xfe INVALID")
            result3 = load_assistant_md(tmp)
            report("无效 UTF-8 返回空串或部分内容（不崩溃）", True)
        except Exception as e:
            report("无效 UTF-8 处理（异常捕获）", False, str(e))


def test_load_project_config():
    print("\n[4] load_project_config 读取")
    with tempfile.TemporaryDirectory() as tmp:
        result = load_project_config(tmp)
        report("文件不存在返回空 dict", result == {})

        ws = _workspace_dir(tmp)
        _ensure_dirs(ws)
        cfg = {"model": "gpt-4o", "temperature": 0.5, "maxTokens": 8192}
        (ws / "config.json").write_text(json.dumps(cfg), encoding="utf-8")
        result2 = load_project_config(tmp)
        report("model 字段读取正确", result2.get("model") == "gpt-4o")
        report("temperature 字段读取正确", result2.get("temperature") == 0.5)
        report("maxTokens 字段读取正确", result2.get("maxTokens") == 8192)

        # Invalid JSON
        (ws / "config.json").write_text("NOT_VALID_JSON{{{", encoding="utf-8")
        result3 = load_project_config(tmp)
        report("无效 JSON 返回空 dict", result3 == {})


def test_yaml_skill_manifest():
    print("\n[5] YAML skill manifest 结构验证")
    import yaml  # noqa: F811

    with tempfile.TemporaryDirectory() as tmp:
        ws = _workspace_dir(tmp)
        _ensure_dirs(ws)
        skills_dir = ws / "skills"

        manifest = {
            "name": "demo_skill",
            "description": "A demo skill for testing",
            "version": "1.0.0",
            "enabled": True,
            "system_prompt": "You have access to demo tools.",
        }
        skill_path = skills_dir / "demo_skill.yaml"
        skill_path.write_text(yaml.dump(manifest), encoding="utf-8")

        loaded = yaml.safe_load(skill_path.read_text())
        report("name 字段正确", loaded.get("name") == "demo_skill")
        report("description 字段正确", loaded.get("description") == "A demo skill for testing")
        report("version 字段正确", loaded.get("version") == "1.0.0")
        report("enabled 字段正确", loaded.get("enabled") is True)
        report("system_prompt 字段正确", "demo tools" in loaded.get("system_prompt", ""))


def test_listdir_skip_names():
    print("\n[6] ContextListDirHandler SKIP_NAMES 过滤")
    report("node_modules 在 SKIP_NAMES 中", "node_modules" in SKIP_NAMES)
    report("__pycache__ 在 SKIP_NAMES 中", "__pycache__" in SKIP_NAMES)
    report(".git 在 SKIP_NAMES 中", ".git" in SKIP_NAMES)
    report("dist 在 SKIP_NAMES 中", "dist" in SKIP_NAMES)

    # Simulate the filter logic used in ContextListDirHandler
    with tempfile.TemporaryDirectory() as tmp:
        # Create a mix of real files and noise dirs
        (Path(tmp) / "src").mkdir()
        (Path(tmp) / "node_modules").mkdir()
        (Path(tmp) / "__pycache__").mkdir()
        (Path(tmp) / "index.ts").write_text("export {}", encoding="utf-8")
        (Path(tmp) / ".gitignore").write_text("dist/", encoding="utf-8")

        all_names = sorted(os.listdir(tmp))
        filtered = [
            n for n in all_names
            if not n.startswith(".") and n not in SKIP_NAMES
        ]
        report("src 目录保留", "src" in filtered)
        report("index.ts 文件保留", "index.ts" in filtered)
        report("node_modules 被过滤", "node_modules" not in filtered)
        report("__pycache__ 被过滤", "__pycache__" not in filtered)
        report(".gitignore 被过滤（dot 前缀）", ".gitignore" not in filtered)


def test_session_size_limit():
    print("\n[7] Session size 常量校验")
    report("MAX_SESSION_SIZE = 2 MB", ws_mod.MAX_SESSION_SIZE == 2 * 1024 * 1024)
    report("MAX_SESSIONS = 200", ws_mod.MAX_SESSIONS == 200)


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  jupyterlab-llm-assistant v0.7.0 workspace 测试")
    print("=" * 60)

    test_workspace_dir_path()
    test_ensure_dirs()
    test_load_assistant_md()
    test_load_project_config()
    test_yaml_skill_manifest()
    test_listdir_skip_names()
    test_session_size_limit()

    total = len(results)
    passed = sum(1 for _, ok in results if ok)
    failed = total - passed

    print()
    print("=" * 60)
    print(f"  结果汇总: {passed}/{total} 通过  |  {failed} 失败")
    print("=" * 60)

    if failed:
        print("\n失败用例:")
        for name, ok in results:
            if not ok:
                print(f"  ✘  {name}")
        sys.exit(1)
    else:
        print("\n  所有测试通过 ✔")
