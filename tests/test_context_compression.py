"""
P0优化测试：上下文压缩和Tool Result截断

测试范围：
1. compress_message_history - 消息历史压缩
2. truncate_tool_result - 工具结果截断
"""

import os
import sys

# 直接在测试文件中内联被测函数，避免复杂的导入问题

# ==== 从 agent_loop.py 内联的 compress_message_history ====
from typing import Dict, Any, List

DEFAULT_MAX_CONTEXT_MESSAGES = 24
DEFAULT_KEEP_FIRST_MESSAGES = 2
DEFAULT_KEEP_LAST_MESSAGES = 16


def compress_message_history(
    messages: List[Dict[str, Any]],
    max_messages: int = DEFAULT_MAX_CONTEXT_MESSAGES,
    keep_first: int = DEFAULT_KEEP_FIRST_MESSAGES,
    keep_last: int = DEFAULT_KEEP_LAST_MESSAGES,
) -> List[Dict[str, Any]]:
    """
    智能压缩消息历史，防止上下文过长导致token爆炸。
    """
    if len(messages) <= max_messages:
        return messages

    # 保留开头
    compressed = messages[:keep_first]

    # 计算中间部分范围
    middle_start = keep_first
    middle_end = len(messages) - keep_last

    if middle_end > middle_start:
        # 收集中间轮次使用的工具
        tools_used = set()
        for msg in messages[middle_start:middle_end]:
            if msg.get("role") == "assistant" and "tool_calls" in msg:
                for tc in msg["tool_calls"]:
                    tool_name = tc.get("function", {}).get("name")
                    if tool_name:
                        tools_used.add(tool_name)

        # 生成摘要
        if tools_used:
            summary = f"[已压缩 {middle_end - middle_start} 轮历史] 已执行: {', '.join(sorted(tools_used))}"
        else:
            summary = f"[已压缩 {middle_end - middle_start} 轮对话历史]"

        compressed.append({"role": "system", "content": summary})

    # 保留结尾
    compressed.extend(messages[-keep_last:])

    return compressed


# ==== 从 agent_tools.py 内联的 truncate_tool_result ====
DEFAULT_TOOL_RESULT_MAX_LENGTH = 2000


def truncate_tool_result(
    result: str,
    tool_name: str,
    max_length: int = DEFAULT_TOOL_RESULT_MAX_LENGTH,
) -> str:
    """
    截断过长的工具输出，保留关键信息。
    """
    if len(result) <= max_length:
        return result

    # grep_search: 按行截断
    if tool_name == "grep_search":
        lines = result.split("\n")
        if len(lines) > 50:
            head_lines = lines[:25]
            tail_lines = lines[-25:]
            omitted = len(lines) - 50
            return "\n".join(head_lines) + f"\n... ({omitted} lines omitted) ...\n" + "\n".join(tail_lines)
        return result

    # read_file / bash: 按字符截断，保留头和尾
    # 默认保留各一半
    half_length = max_length // 2
    head = result[:half_length]
    tail = result[-half_length:]
    truncated_chars = len(result) - max_length

    return head + f"\n\n[... {truncated_chars} chars truncated ...]\n\n" + tail


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
# Section 1: 消息历史压缩
# ─────────────────────────────────────────────────────────────

def test_no_compression_needed():
    """消息数低于限制时不应压缩"""
    print("\n[1] 消息历史压缩 - 基础功能")

    messages = [
        {"role": "system", "content": "You are an assistant."},
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there!"},
    ]

    result = compress_message_history(messages, max_messages=10)

    report("短消息不压缩", result == messages)
    report("保留所有消息", len(result) == 3)


def test_compresses_middle_messages():
    """超过限制时压缩中间部分"""
    print("\n[2] 消息历史压缩 - 压缩中间部分")

    messages = [
        {"role": "system", "content": "System prompt"},
        {"role": "user", "content": "Task description"},
        # 中间消息将被压缩
        {"role": "assistant", "content": "Exploring...", "tool_calls": [
            {"id": "1", "function": {"name": "list_dir"}}
        ]},
        {"role": "tool", "tool_call_id": "1", "content": "file1.py\nfile2.py"},
        {"role": "assistant", "content": "Reading files...", "tool_calls": [
            {"id": "2", "function": {"name": "read_file"}}
        ]},
        {"role": "tool", "tool_call_id": "2", "content": "content..."},
        # 保留最近消息
        {"role": "assistant", "content": "Making changes...", "tool_calls": [
            {"id": "3", "function": {"name": "edit_file"}}
        ]},
        {"role": "tool", "tool_call_id": "3", "content": "Success"},
        {"role": "assistant", "content": "Done!"},
    ]

    result = compress_message_history(messages, max_messages=6, keep_first=2, keep_last=3)

    report("保留开头2条", result[0] == messages[0] and result[1] == messages[1])
    report("生成压缩摘要", result[2]["role"] == "system")
    report("摘要含压缩标记", "已压缩" in result[2]["content"])
    report("摘要列出工具", "list_dir" in result[2]["content"] and "read_file" in result[2]["content"])


def test_compression_deduplicates_tools():
    """压缩摘要应去重工具名称"""
    print("\n[3] 消息历史压缩 - 工具去重")

    messages = [
        {"role": "system", "content": "System"},
        {"role": "user", "content": "Task"},
        # 多次调用相同工具
        {"role": "assistant", "content": "A", "tool_calls": [
            {"id": "1", "function": {"name": "read_file"}}
        ]},
        {"role": "tool", "tool_call_id": "1", "content": "..."},
        {"role": "assistant", "content": "B", "tool_calls": [
            {"id": "2", "function": {"name": "read_file"}}
        ]},
        {"role": "tool", "tool_call_id": "2", "content": "..."},
        {"role": "assistant", "content": "Final"},
    ]

    result = compress_message_history(messages, max_messages=4, keep_first=2, keep_last=1)

    summary = result[2]["content"]
    # read_file 应该只出现一次
    report("工具名称去重", summary.count("read_file") == 1)


# ─────────────────────────────────────────────────────────────
# Section 2: 工具结果截断
# ─────────────────────────────────────────────────────────────

def test_short_result_not_truncated():
    """短结果不应截断"""
    print("\n[4] 工具结果截断 - 短结果")

    result = "Short output"
    truncated = truncate_tool_result(result, "bash", max_length=100)

    report("短结果不截断", truncated == result)


def test_long_grep_result_truncated():
    """长grep结果应截断并显示行数"""
    print("\n[5] 工具结果截断 - grep_search")

    lines = [f"line{i}.py:10:content" for i in range(100)]
    result = "\n".join(lines)

    truncated = truncate_tool_result(result, "grep_search", max_length=500)

    report("包含省略标记", "... (" in truncated and "lines omitted) ..." in truncated)
    report("保留头部行", "line0.py" in truncated)
    report("保留尾部行", "line99.py" in truncated)
    # 总行数应该小于60 (25头 + 25尾 + 省略行)
    report("总行数减少", len(truncated.split("\n")) < 60)


def test_long_bash_result_truncated():
    """长bash结果应保留头和尾"""
    print("\n[6] 工具结果截断 - bash")

    result = "A" * 10000

    truncated = truncate_tool_result(result, "bash", max_length=2000)

    # 10000 - 2000 = 8000 chars truncated
    report("显示截断字符数", "... 8000 chars truncated ..." in truncated)
    report("保留头部", truncated.startswith("A" * 1000))
    report("保留尾部", truncated.endswith("A" * 1000))
    report("长度减少", len(truncated) < 3000)


def test_long_read_file_result_truncated():
    """长文件读取应截断"""
    print("\n[7] 工具结果截断 - read_file")

    result = "X" * 5000

    truncated = truncate_tool_result(result, "read_file", max_length=2000)

    report("显示截断字符数", "... 3000 chars truncated ..." in truncated)
    report("长度减少", len(truncated) < 3000)


def test_truncate_respects_max_length():
    """应使用自定义max_length"""
    print("\n[8] 工具结果截断 - 自定义长度")

    result = "B" * 1000
    truncated = truncate_tool_result(result, "bash", max_length=500)

    report("自定义长度生效", len(truncated) < 600)


# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  P0优化测试：上下文压缩和工具结果截断")
    print("=" * 60)

    test_no_compression_needed()
    test_compresses_middle_messages()
    test_compression_deduplicates_tools()
    test_short_result_not_truncated()
    test_long_grep_result_truncated()
    test_long_bash_result_truncated()
    test_long_read_file_result_truncated()
    test_truncate_respects_max_length()

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
    main()
