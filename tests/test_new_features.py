"""
v0.3.0 新特性测试套件

测试范围：
1. edit_file  — str_replace 精确编辑
2. notebook_execute — Python 代码执行（subprocess fallback）
3. 工具定义完整性检查
"""

import asyncio
import os
import sys
import tempfile
import json
import importlib.util

# 直接加载 agent_tools.py，绕过依赖 jupyter_server 的 __init__.py
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location(
    "agent_tools",
    os.path.join(_root, "jupyterlab_llm_assistant", "agent_tools.py"),
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
AgentToolExecutor = _mod.AgentToolExecutor
AGENT_TOOLS = _mod.AGENT_TOOLS

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
# Section 1: 工具定义完整性
# ─────────────────────────────────────────────────────────────

def test_tool_definitions():
    print("\n[1] 工具定义完整性")
    required_tools = {"read_file", "write_file", "edit_file", "bash", "list_dir", "grep_search", "notebook_execute"}
    names = {t["function"]["name"] for t in AGENT_TOOLS}

    report("共定义 7 个工具", len(AGENT_TOOLS) == 7, f"实际数量: {len(AGENT_TOOLS)}")
    report("包含全部必需工具", required_tools == names, f"缺少: {required_tools - names}")

    # edit_file 参数检查
    edit_def = next((t for t in AGENT_TOOLS if t["function"]["name"] == "edit_file"), None)
    report("edit_file 定义存在", edit_def is not None)
    if edit_def:
        params = edit_def["function"]["parameters"]["properties"]
        report("edit_file 有 path 参数", "path" in params)
        report("edit_file 有 old_str 参数", "old_str" in params)
        report("edit_file 有 new_str 参数", "new_str" in params)
        report("edit_file 有 replace_all 参数", "replace_all" in params)
        required = edit_def["function"]["parameters"].get("required", [])
        report("edit_file required=[path,old_str,new_str]", set(required) == {"path", "old_str", "new_str"})

    # notebook_execute 参数检查
    nb_def = next((t for t in AGENT_TOOLS if t["function"]["name"] == "notebook_execute"), None)
    report("notebook_execute 定义存在", nb_def is not None)
    if nb_def:
        params = nb_def["function"]["parameters"]["properties"]
        report("notebook_execute 有 code 参数", "code" in params)
        report("notebook_execute 有 timeout 参数", "timeout" in params)


# ─────────────────────────────────────────────────────────────
# Section 2: edit_file 功能测试
# ─────────────────────────────────────────────────────────────

async def test_edit_file():
    print("\n[2] edit_file 工具")

    with tempfile.TemporaryDirectory() as tmpdir:
        executor = AgentToolExecutor(root_dir=tmpdir)
        test_file = os.path.join(tmpdir, "sample.py")

        original = "def hello():\n    return 'world'\n\ndef goodbye():\n    return 'bye'\n"
        with open(test_file, "w") as f:
            f.write(original)

        # ── 2.1 正常替换（单次）
        ok, msg = await executor.execute_tool("edit_file", {
            "path": "sample.py",
            "old_str": "return 'world'",
            "new_str": "return 'Hello, World!'",
        })
        report("正常替换成功", ok, msg)
        with open(test_file) as f:
            content = f.read()
        report("替换内容写入文件", "return 'Hello, World!'" in content)
        report("其他内容未被修改", "return 'bye'" in content)

        # ── 2.2 文件不存在
        ok2, msg2 = await executor.execute_tool("edit_file", {
            "path": "nonexistent.py",
            "old_str": "x",
            "new_str": "y",
        })
        report("文件不存在返回失败", not ok2)
        report("错误信息含 'not found'", "not found" in msg2.lower(), msg2)

        # ── 2.3 字符串不存在
        ok3, msg3 = await executor.execute_tool("edit_file", {
            "path": "sample.py",
            "old_str": "THIS_DOES_NOT_EXIST_XYZ",
            "new_str": "replacement",
        })
        report("字符串不存在返回失败", not ok3)
        report("错误信息含提示信息", "not found" in msg3.lower() or "string" in msg3.lower(), msg3)

        # ── 2.4 多次出现但未设 replace_all
        dup_file = os.path.join(tmpdir, "dup.py")
        with open(dup_file, "w") as f:
            f.write("x = 1\nx = 1\n")

        ok4, msg4 = await executor.execute_tool("edit_file", {
            "path": "dup.py",
            "old_str": "x = 1",
            "new_str": "x = 2",
        })
        report("多次出现且未 replace_all 返回失败", not ok4)
        report("错误信息含 occurrence 计数", "2" in msg4, msg4)

        # ── 2.5 replace_all=True 批量替换
        ok5, msg5 = await executor.execute_tool("edit_file", {
            "path": "dup.py",
            "old_str": "x = 1",
            "new_str": "x = 99",
            "replace_all": True,
        })
        report("replace_all=True 成功", ok5, msg5)
        with open(dup_file) as f:
            dup_content = f.read()
        report("所有出现均已替换", dup_content.count("x = 99") == 2, dup_content)

        # ── 2.6 new_str 为空（删除操作）
        del_file = os.path.join(tmpdir, "del_test.py")
        with open(del_file, "w") as f:
            f.write("line1\nDELETE_ME\nline3\n")
        ok6, msg6 = await executor.execute_tool("edit_file", {
            "path": "del_test.py",
            "old_str": "DELETE_ME\n",
            "new_str": "",
        })
        report("删除操作（new_str=空）成功", ok6, msg6)
        with open(del_file) as f:
            del_content = f.read()
        report("目标行已被删除", "DELETE_ME" not in del_content, del_content)


# ─────────────────────────────────────────────────────────────
# Section 3: notebook_execute 功能测试
# ─────────────────────────────────────────────────────────────

async def test_notebook_execute():
    print("\n[3] notebook_execute 工具（subprocess fallback）")

    with tempfile.TemporaryDirectory() as tmpdir:
        executor = AgentToolExecutor(root_dir=tmpdir)

        # ── 3.1 基础 print
        ok, out = await executor.execute_tool("notebook_execute", {
            "code": "print('hello from kernel')"
        })
        report("基础 print 执行成功", ok, out)
        report("输出包含预期文本", "hello from kernel" in out, out)

        # ── 3.2 数学运算
        ok2, out2 = await executor.execute_tool("notebook_execute", {
            "code": "print(2 ** 10)"
        })
        report("数学运算执行成功", ok2, out2)
        report("输出包含 1024", "1024" in out2, out2)

        # ── 3.3 多行代码
        code = "x = [i**2 for i in range(5)]\nprint(x)"
        ok3, out3 = await executor.execute_tool("notebook_execute", {"code": code})
        report("多行代码执行成功", ok3, out3)
        report("输出包含列表", "[0, 1, 4, 9, 16]" in out3, out3)

        # ── 3.4 import 标准库
        ok4, out4 = await executor.execute_tool("notebook_execute", {
            "code": "import json; print(json.dumps({'status': 'ok'}))"
        })
        report("import 标准库成功", ok4, out4)
        report("JSON 输出正确", '"status"' in out4, out4)

        # ── 3.5 超时限制生效
        ok5, out5 = await executor.execute_tool("notebook_execute", {
            "code": "import time; time.sleep(200)",
            "timeout": 2,
        })
        report("超时限制生效（应返回失败或超时）", not ok5 or "timeout" in out5.lower(), out5[:200])

        # ── 3.6 语法错误处理
        ok6, out6 = await executor.execute_tool("notebook_execute", {
            "code": "def broken(:"
        })
        report("语法错误被捕获（返回失败）", not ok6, out6[:200])


# ─────────────────────────────────────────────────────────────
# Section 4: 工具路由分发完整性
# ─────────────────────────────────────────────────────────────

async def test_tool_routing():
    print("\n[4] 工具路由分发")
    with tempfile.TemporaryDirectory() as tmpdir:
        executor = AgentToolExecutor(root_dir=tmpdir)

        # 验证所有工具名均被路由
        test_file = os.path.join(tmpdir, "route_test.txt")
        with open(test_file, "w") as f:
            f.write("route test\n")

        tests = [
            ("read_file",       {"path": "route_test.txt"}),
            ("write_file",      {"path": "route_test_out.txt", "content": "hello"}),
            ("edit_file",       {"path": "route_test.txt", "old_str": "route test", "new_str": "edited"}),
            ("bash",            {"command": "echo routing_ok"}),
            ("list_dir",        {}),
            ("grep_search",     {"pattern": "edited", "path": "."}),
            ("notebook_execute",{"code": "print('route')"}),
        ]
        for tool_name, args in tests:
            ok, out = await executor.execute_tool(tool_name, args)
            report(f"路由 {tool_name}", ok, out[:120])

        # 未知工具
        ok_unk, _ = await executor.execute_tool("unknown_tool", {})
        report("未知工具返回失败", not ok_unk)


# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

async def main():
    print("=" * 60)
    print("  jupyterlab-llm-assistant v0.3.0 特性测试")
    print("=" * 60)

    test_tool_definitions()
    await test_edit_file()
    await test_notebook_execute()
    await test_tool_routing()

    # ── Summary
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
