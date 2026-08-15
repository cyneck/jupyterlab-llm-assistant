"""
P0优化测试：上下文压缩和Tool Result截断

测试范围：
1. compress_message_history - 消息历史压缩
2. truncate_tool_result - 工具结果截断
"""

import os
import sys

# 直接在测试文件中内联被测函数，避免复杂的导入问题

# 导入真实实现（与生产代码一致）
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from jupyterlab_llm_assistant.agent_loop import (
    compress_message_history,
    evict_old_tool_results,
    _estimate_context_chars,
    _last_round_tool_call_ids,
    CONTEXT_COMPRESSION_THRESHOLD,
)

from jupyterlab_llm_assistant.agent_tools import truncate_tool_result

PASS = '[PASS]'
FAIL = '[FAIL]'

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

def _pi_like_history(rounds: int = 40, result_chars: int = 1500):
    """Simulate the pi.dev incident: several user messages followed by a long
    autonomous research run of many tool rounds."""
    messages = [
        {"role": "system", "content": "System prompt"},
        {"role": "user", "content": "你是谁？当时是什么运行环境"},
        {"role": "assistant", "content": "我是资深软件工程师..."},
        {"role": "user", "content": "写一个claude"},
        {"role": "assistant", "content": "澄清问题..."},
        {"role": "user", "content": "Pi is a minimal agent harness，网站是https://pi.dev/"},
    ]
    for r in range(rounds):
        messages.append({
            "role": "assistant", "content": "",
            "tool_calls": [{"id": f"tc{r}", "function": {"name": "read_file", "arguments": '{"path": "x.py"}'}}],
        })
        messages.append({"role": "tool", "tool_call_id": f"tc{r}", "content": "D" * result_chars})
    return messages


def test_user_messages_never_dropped():
    """压缩永不丢弃 user 消息（pi.dev 事故回归）"""
    print("\n[1] 消息历史压缩 - user 消息永不丢弃（pi.dev 回归）")

    messages = _pi_like_history()
    result = compress_message_history(messages, keep_last_messages=16)

    user_contents = [m["content"] for m in result if m["role"] == "user"]
    report("保留全部 user 消息", len(user_contents) == 3, f"got {len(user_contents)}")
    report("保留当前任务消息", "pi.dev" in user_contents[-1])
    report("生成压缩摘要", any(m["role"] == "system" and "已压缩" in m.get("content", "") for m in result))
    report("摘要列出工具", any("read_file" in str(m.get("content", "")) for m in result if m["role"] == "system"))


def test_tool_calls_never_orphaned():
    """压缩后不应出现孤儿 tool 消息或孤儿 tool_calls"""
    print("\n[2] 消息历史压缩 - 消息结构完整")

    messages = _pi_like_history(rounds=10)
    result = compress_message_history(messages, keep_last_messages=4)

    call_ids = set()
    for m in result:
        for tc in m.get("tool_calls", []):
            call_ids.add(tc["id"])
    resp_ids = {m["tool_call_id"] for m in result if m["role"] == "tool"}
    report("tool 响应有对应调用", resp_ids <= call_ids, f"orphan responses: {resp_ids - call_ids}")
    # 每个保留的 tool_calls 至少有一条响应紧跟其后（未被拆散）
    ok = True
    for idx, m in enumerate(result):
        if m.get("tool_calls"):
            if idx + 1 >= len(result) or result[idx + 1].get("role") != "tool":
                ok = False
    report("tool_calls 与响应对完整", ok)


def test_below_threshold_no_compression():
    """低于尺寸阈值时完全不压缩（运行中保持完整思考链）"""
    print("\n[3] 尺寸安全阀 - 低于阈值不压缩")

    # 列表整体落在 head+tail 范围内 -> 原样返回
    small = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "q1"},
        {"role": "assistant", "content": "a1", "tool_calls": [{"id": "1", "function": {"name": "bash"}}]},
        {"role": "tool", "tool_call_id": "1", "content": "ok"},
        {"role": "assistant", "content": "done"},
    ]
    report("小列表原样返回", compress_message_history(small, keep_last_messages=16) == small)

    # pi.dev 场景（几十轮但总量低于阈值）
    messages = _pi_like_history(rounds=20, result_chars=500)
    report("pi场景低于阈值", _estimate_context_chars(messages) < CONTEXT_COMPRESSION_THRESHOLD,
           f"estimated={_estimate_context_chars(messages)}")


def test_loop_keeps_full_chain_below_threshold():
    """循环层回归：低于阈值时每轮 LLM 请求都包含完整历史和全部 user 消息"""
    import asyncio, copy
    from jupyterlab_llm_assistant.agent_loop import run_agent_loop
    print("\n[3b] 循环层 - 低于阈值不触发压缩")

    captured = []
    state = {"calls": 0}
    ROUNDS = 6

    class Ch: pass
    class Choice: pass
    class Delta: pass

    def chunk(text=None, tool=None, idx=None, finish=None):
        d = Delta(); d.content = text; d.tool_calls = None
        if tool:
            class TC: pass
            class F: pass
            tc = TC(); f = F()
            tc.index = idx; tc.id = tool["id"]; tc.function = f
            f.name = tool["name"]; f.arguments = tool["args"]
            d.tool_calls = [tc]
        c = Choice(); c.delta = d; c.finish_reason = finish
        ch = Ch(); ch.choices = [c]
        return ch

    async def create(**kw):
        captured.append(copy.deepcopy(kw["messages"]))
        n = state["calls"]; state["calls"] += 1
        async def agen():
            yield chunk()
            if n < ROUNDS:
                yield chunk(tool={"id": f"t{n}", "name": "bash", "args": "{}"}, idx=0)
                yield chunk(finish="tool_calls")
            else:
                yield chunk(text="final")
                yield chunk(finish="stop")
        return agen()

    class FakeClient:
        pass
    FakeClient.chat = type("Chat", (), {})
    FakeClient.chat.completions = type("Completions", (), {"create": staticmethod(create)})

    class FakeExecutor:
        async def execute_tool(self, name, args):
            return True, "R" * 500

    async def send_event(t, d): pass

    asyncio.run(run_agent_loop(
        send_event=send_event, client=FakeClient(), executor=FakeExecutor(),
        api_messages=[
            {"role": "system", "content": "sys"},
            {"role": "user", "content": "Pi is a minimal agent harness pi.dev"},
        ],
        model="test", max_iterations=20, config_store={},
    ))

    report("请求轮数正确", len(captured) == ROUNDS + 1, f"got {len(captured)}")
    last_msgs = captured[-1]
    user_texts = [m["content"] for m in last_msgs if m["role"] == "user"]
    report("最后一轮仍含用户任务", any("pi.dev" in t for t in user_texts))
    tool_count = sum(1 for m in last_msgs if m["role"] == "tool")
    report("最后一轮含全部工具结果", tool_count == ROUNDS, f"got {tool_count}")


def test_eviction_keeps_last_round():
    """驱逐仅作用于已消费结果，保留最后一轮"""
    print("\n[4] 工具结果驱逐 - 保留最后一轮")

    messages = _pi_like_history(rounds=5, result_chars=1000)
    keep = _last_round_tool_call_ids(messages)
    report("识别最后一轮", keep == {"tc4"}, f"got {keep}")

    evicted = evict_old_tool_results(messages, keep)
    report("驱逐 4 条旧结果", evicted == 4, f"got {evicted}")
    last = [m for m in messages if m.get("tool_call_id") == "tc4"][0]
    old = [m for m in messages if m.get("tool_call_id") == "tc0"][0]
    report("最后一轮完整", len(last["content"]) == 1000)
    report("旧结果变存根", str(old["content"]).startswith("[tool-result-evicted"))


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

    test_user_messages_never_dropped()
    test_tool_calls_never_orphaned()
    test_below_threshold_no_compression()
    test_loop_keeps_full_chain_below_threshold()
    test_eviction_keeps_last_round()
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
