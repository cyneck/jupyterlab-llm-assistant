"""
Agent handler for the LLM coding assistant.

Implements an agentic execution loop:
1. User sends a task
2. LLM decides which tools to call
3. Tools are executed and results fed back
4. Loop continues until LLM produces final answer

SSE events are streamed to the frontend in real-time showing:
- text chunks from the LLM
- tool calls being made
- tool results
- final completion
"""

import json
import os
from typing import Dict, Any, List, Optional
from tornado import web
from jupyter_server.base.handlers import APIHandler
from openai import AsyncOpenAI

from .agent_tools import AGENT_TOOLS, AgentToolExecutor
from .agent_loop import run_agent_loop
from .memory_handler import get_memory_store
from .serverextension import DEFAULT_SYSTEM_PROMPT
from .workspace_handler import apply_skills_to_system_prompt, get_skill_tools_for_agent, load_skills, _workspace_dir, SKILLS_DIR_NAME


# Agent system prompt
AGENT_SYSTEM_PROMPT = """你是一位资深的软件工程师（Senior Software Engineer），拥有工具可以读写和执行代码，工作于 JupyterLab 环境。你以严谨、规范、简洁、优雅为工程准则，能够独立完成从新项目搭建到存量功能扩展的完整开发任务。

## 核心工程准则
- **严谨规范**：遵守项目既有代码风格与约定，产出高质量、可维护的代码
- **简洁优雅**：及时按工程设计原则精简冗余、优化结构，代码清晰直白
- **最小侵入**：新增功能时严格基于现有架构扩展，不改动与需求无关的既有代码
- **先理解再动手**：任何修改前必须先探索代码库，读文件后再编辑

## 典型场景与应对
- **新建项目**：先明确需求，规划清晰的项目结构与模块边界，遵循标准工程规范（目录组织、命名、依赖管理、测试），产出可运行的最小骨架后再逐步完善
- **新增功能**：优先复用现有模块与约定，在原有架构内扩展；保持变更聚焦，避免连带重构
- **重构/优化**：识别冗余、重复、不合理设计，在保证行为不变的前提下精简优雅；一次改动一个关注点，并及时验证
- **缺陷修复**：先定位根因再修复，补充或更新测试，避免"打补丁式"掩盖问题

## 工作流程（逐步迭代）
1. **理解需求** - 仔细分析用户请求，明确目标与验收标准
2. **探索代码** - 用 list_dir、grep_search、read_file 摸清现有结构、风格与相关实现
3. **制定计划** - 形成简短执行计划；复杂任务的关键信息（架构决策、任务清单、注意事项）写入小型计划手册 `PLAN.md`（置于工作目录），并在迭代中持续更新，便于中途断点续作
4. **执行与验证** - 用工具修改代码、运行测试/语法检查，确认改动正确
5. **汇报总结** - 说明做了什么、改了哪些文件、为什么

## 信息管理
- **不重要的信息及时压缩**：长输出、中间探索结果等只需保留结论与关键线索，不必原样保留
- **重要信息写入计划手册**：架构决策、任务进度、关键约定、后续待办等写入 `PLAN.md`，逐步迭代、持续跟踪
- **跟踪进展，及时同步**：每个完成阶段向用户简要同步进展与下一步，避免长时间静默

## 子智能体分工
- 可使用 `spawn_subagent` 工具将**相互独立、边界清晰**的子任务委派给子代理独立完成，各自返回结果后由你汇总整合
- 适合委派的场景：独立模块的调研/实现、某文件的代码审查、生成测试用例等；不适用的场景：需要即时交互、强依赖上下文、边界模糊的任务
- 子任务描述要**自包含**（含文件路径、约束、期望输出），因为子代理无法反问
- 多个互不依赖的子任务可连续发起多个 `spawn_subagent` 调用并行推进
- 无法委派或不宜委派时，按顺序自主逐步完成，不等待外部指令

## 自主推进，减少打扰
- **避免频繁确认**：常规决策自行判断并执行；仅在涉及破坏性操作或需求存在重大歧义时才向用户确认
- **避免用户久等**：优先给出阶段性产出，先交付可用结果再持续优化
- 明确给出"重要节点提醒"而不是事无巨细的请示

## 可用工具
- **read_file**: 读取任意文件以理解现有代码
- **write_file**: 创建或覆盖文件（完整写入）
- **edit_file**: 对既有文件做精确的 str_replace 局部修改（比 write_file 更安全，优先使用）
- **bash**: 执行 shell 命令（运行测试、安装依赖、git 操作等）
- **list_dir**: 浏览目录结构
- **grep_search**: 跨文件搜索模式
- **notebook_execute**: 直接在 Jupyter kernel 中执行 Python 并捕获输出
- **install_skill**: 从 URL 安装 skill 到 `.llm-assistant/skills/`（支持 GitHub blob/raw、目录型 skill），安装后下一轮会话即可用
- **spawn_subagent**: 委派一个自包含子任务给独立子代理执行并返回结果（子代理有独立上下文与迭代预算，可读写文件）

## 跨平台原则（Windows / Linux / macOS）
- 本环境可能运行于 Windows、Linux 或 macOS，执行任何命令前先判断操作系统：用 `python -c "import platform; print(platform.system())"` 或观察 `bash` 输出的提示符/报错。
- 只使用当前操作系统实际存在的命令与语法；不要假设 Unix 工具在 Windows 可用，反之亦然。
- 路径统一用正斜杠或 `Path`，避免硬编码盘符或 `/home`、`/usr` 等特定布局；跨盘符/跨分区路径需用绝对路径。
- 需要跨平台运行 Python 时，用 `python` 或 `sys.executable`，不要写死 `python3`。

## 安全规则
- **禁止阻塞型服务**：不要运行长时间挂起的服务器命令（如 `python app.py`、`npm start`、`uvicorn main:app`）。改为：
  - 语法检查：`python -m py_compile app.py`
  - 带超时启动验证：Unix 用 `timeout 3 python app.py`；Windows（PowerShell）用 `Start-Process` + `Start-Sleep` + `Stop-Process`，或直接用 `python -c "import app"` 验证导入
  - 后台运行查看日志：Unix 用 `nohup cmd > out.log 2>&1 &` 后 `sleep 2 && cat out.log`；Windows 用 `Start-Process -NoNewWindow -RedirectStandardOutput out.log` 后读取日志，验证后清理进程
- **禁止破坏性操作**：
  - 绝不使用 `rm -rf /`、`rm -rf ~`、`rm -rf /*` 或未核对匹配项的 `rm *.py` 通配删除（Windows 下同理：绝不用 `Remove-Item -Recurse` 删除根目录或通配删除）
  - 绝不使用 `sed -i` 原地修改（无备份）；一律用 `edit_file`/`write_file`
  - 绝不 kill 系统进程（pid 1、sshd、jupyter、init、systemd）或非自己启动的进程
  - 绝不修改系统配置文件或他人文件（如 `/etc`、Windows 的 `C:\\Windows` 等）
  - 删除前先列出受影响内容（Unix 用 `ls`，Windows 用 `Get-ChildItem` 或 `dir`）
- **读取后修改**：修改任何文件前必须先读取其当前内容

## 何时停止
仅当任务完成并验证通过时停止：
- 需求已实现且通过测试/语法检查
- 已向用户清晰汇报改动与结果
- 若任务中途被中断，计划手册 `PLAN.md` 已记录进度，便于续作

当前工作目录为 Jupyter 根目录。"""


# System prompt for spawned sub-agents. Kept intentionally focused and
# self-contained: a sub-agent receives a single task and cannot ask follow-ups,
# so it must explore, act, and return a concise result on its own.
SUBAGENT_SYSTEM_PROMPT = """你是一个专注于单一子任务的子代理（sub-agent）。你会收到一个自包含的任务描述，需要独立完成并返回结果。

## 工作准则
- 先用工具（list_dir、grep_search、read_file）了解与任务相关的代码与环境
- 直接执行任务（可读写文件、运行命令），不要反问，不要等待确认
- 控制范围：只做任务明确要求的事，不擅自扩大改动
- 完成后返回简洁、结构化、可被主代理直接整合的文本结果（结论 + 关键改动 + 注意事项）
- 若遇到无法自行解决的阻塞，简要说明原因与已尝试的做法后停止

## 安全准则
- 不运行长时间挂起的阻塞型服务；用语法检查或超时启动验证替代
- 不执行破坏性命令（rm -rf 根目录/通配删除、sed -i、kill 系统进程等）
- 修改文件前先读取其当前内容"""

DEFAULT_API_ENDPOINT = "https://api.openai.com/v1"
DEFAULT_MODEL = "gpt-4o"


class AgentHandler(APIHandler):
    """
    Handler for the coding agent.

    POST /llm-assistant/agent
    Streams SSE events as the agent works:

    Event types:
    - text: LLM text chunk
    - tool_call: Agent is calling a tool {name, args}
    - tool_result: Tool execution result {name, success, output}
    - iteration: Agent loop iteration number
    - done: Agent completed {total_iterations}
    - error: Error occurred {message}
    """

    def initialize(self, config_store: Dict[str, Any]):
        self.config_store = config_store

    def _get_api_key(self) -> Optional[str]:
        """Get API key from config_store or environment."""
        return self.config_store.get("apiKey") or os.environ.get("OPENAI_API_KEY")

    def _get_config(self) -> Dict[str, Any]:
        """Get current config from memory store."""
        return dict(self.config_store)

    def _create_client(self) -> AsyncOpenAI:
        config = self._get_config()
        return AsyncOpenAI(
            api_key=self._get_api_key(),
            base_url=config.get("apiEndpoint", DEFAULT_API_ENDPOINT),
            timeout=120.0,
        )

    async def _send_event(self, event_type: str, data: Any):
        """Send an SSE event."""
        payload = json.dumps({"type": event_type, "data": data})
        self.write(f"data: {payload}\n\n")
        await self.flush()

    @web.authenticated
    async def post(self):
        """Handle agent request."""
        try:
            body = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            raise web.HTTPError(400, "Invalid JSON")

        messages = body.get("messages", [])
        max_iterations = min(body.get("maxIterations", 200), 300)
        root_dir = body.get("rootDir") or os.getcwd()

        if not messages:
            raise web.HTTPError(400, "Messages are required")

        if not self._get_api_key():
            raise web.HTTPError(401, "API key not configured")

        # Set up SSE
        self.set_header("Content-Type", "text/event-stream")
        self.set_header("Cache-Control", "no-cache")
        self.set_header("Connection", "keep-alive")
        self.set_header("X-Accel-Buffering", "no")

        # Build an effective config that merges server config with any
        # per-request overrides sent by the frontend (model, temperature, maxTokens).
        effective_config = self._get_config()
        for key in ("model", "temperature", "maxTokens"):
            if key in body:
                effective_config[key] = body[key]

        model = effective_config.get("model", DEFAULT_MODEL)

        client = AsyncOpenAI(
            api_key=self._get_api_key(),
            base_url=effective_config.get("apiEndpoint", DEFAULT_API_ENDPOINT),
            timeout=120.0,
        )
        executor = AgentToolExecutor(root_dir=root_dir)

        # Build initial message list with system prompt
        # Allow the user-configured systemPrompt (from the frontend Settings
        # panel) to override the default agent prompt. The backend persists
        # DEFAULT_SYSTEM_PROMPT whenever settings are saved without customizing
        # it, so only treat a genuinely customized (non-empty, non-default)
        # value as an override.
        user_prompt = effective_config.get("systemPrompt") or ""
        agent_base_prompt = (
            user_prompt
            if user_prompt and user_prompt != DEFAULT_SYSTEM_PROMPT
            else AGENT_SYSTEM_PROMPT
        )
        # Apply skills (including system prompts and custom tools)
        system_content = apply_skills_to_system_prompt(
            agent_base_prompt,
            root_dir=root_dir,
            include_memory=True,
        )

        # Get skill tools for agent execution
        skill_tools = get_skill_tools_for_agent(root_dir=root_dir)

        # Register skill tools with executor
        if skill_tools:
            from .skill_resolver import get_skill_tool_loader
            ws = _workspace_dir(root_dir)
            skills_dir = ws / SKILLS_DIR_NAME
            loader = get_skill_tool_loader(skills_dir)

            # Get skill tool functions and register them
            skills = load_skills(root_dir)
            for skill in skills:
                tool_funcs = loader.load_skill_tools(skill.name)
                for tool_def in tool_funcs:
                    tool_name = tool_def.get('function', {}).get('name')
                    if tool_name:
                        func = loader.get_tool_function(skill.name, tool_name)
                        if func:
                            executor.register_skill_tool(tool_name, func)

        # Inject sub-agent context so the spawn_subagent tool can recursively
        # run the agent loop with the same client/model/config but an isolated
        # executor and message history.
        executor.set_subagent_context({
            "client": client,
            "model": model,
            "config_store": effective_config,
            "skill_tools": skill_tools if skill_tools else None,
            "subagent_system_prompt": SUBAGENT_SYSTEM_PROMPT,
        })

        api_messages = [
            {"role": "system", "content": system_content}
        ] + [{"role": m["role"], "content": m["content"]} for m in messages]

        try:
            await run_agent_loop(
                send_event=self._send_event,
                client=client,
                executor=executor,
                api_messages=api_messages,
                model=model,
                max_iterations=max_iterations,
                config_store=effective_config,
                skill_tools=skill_tools if skill_tools else None,
            )
        except Exception as e:
            await self._send_event("error", {"message": str(e)})
        finally:
            self.write("data: [DONE]\n\n")
            await self.flush()
            self.finish()
