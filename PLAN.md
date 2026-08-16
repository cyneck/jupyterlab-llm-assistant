# 终端智能体 (Terminal Agent) 实现计划

## 目标
在 `feat/terminal-agent` 分支上，复用项目现有后端模块，实现一个**独立终端 AI 编码代理 CLI 工具**，类似 Pi/Claude Code 的终端体验。

## 架构决策
- **复用现有模块**：`agent_loop.py`、`agent_tools.py`、`llm_client.py`、`workspace_handler.py`、`memory_handler.py`、`skill_resolver.py` 等直接复用，不改动
- **CLI 入口**：`jupyterlab_llm_assistant/cli/main.py` — 主入口模块
- **终端 UI**：使用 `rich` 库实现彩色输出，`prompt_toolkit` 实现交互式输入
- **配置**：读取 `~/.llm-assistant/config.json`（与 JupyterLab 扩展共享配置）
- **注册为 console_scripts**：通过 `pyproject.toml` 注册 `llm-assistant` 命令

## 任务清单
- [x] 创建分支 `feat/terminal-agent`
- [x] 实现 CLI 入口 `jupyterlab_llm_assistant/cli/main.py`
  - [x] 命令行参数解析（argparse）
  - [x] 配置加载（共享 config.json）
  - [x] 交互式 REPL 循环（prompt_toolkit）
  - [x] 非交互单次执行模式
  - [x] Chat 模式（流式输出 + Markdown 渲染）
  - [x] Agent 模式（复用 run_agent_loop，工具调用可视化）
  - [x] 会话管理（保存/加载/列表/删除）
  - [x] 内置命令：/chat, /agent, /clear, /sessions, /session, /help, /exit
- [x] 注册 console_scripts 入口（pyproject.toml）
- [x] 添加依赖（rich, prompt_toolkit）
- [x] 验证：语法检查 + 导入测试 + 现有模块不受影响

## 文件变更
| 文件 | 变更 |
|------|------|
| `jupyterlab_llm_assistant/cli/__init__.py` | 新增 - CLI 包初始化 |
| `jupyterlab_llm_assistant/cli/main.py` | 新增 - CLI 主模块（~550 行） |
| `jupyterlab_llm_assistant/cli/entry.py` | 新增 - 入口包装模块，先设 `LLM_ASSISTANT_LOG_LEVEL=WARNING` 再导入 main |
| `jupyterlab_llm_assistant/__init__.py` | 修改 - 包级设置 `LLM_ASSISTANT_LOG_LEVEL=WARNING`，静默模块级日志 |
| `pyproject.toml` | 修改 - 添加依赖和 console_scripts 入口 |
| `README.md` | 修改 - 新增"终端 CLI 工具"完整文档章节 |
| `docs/QUICKSTART.md` | 修改 - 新增 CLI 使用方式说明 |

## 未改动
- 所有现有后端模块：未修改任何一行代码
- 前端 TypeScript 代码：未修改
- 测试文件：未修改

## 后续待办
- [x] 安装到 venv 验证 `llm-assistant` 命令可用
- [x] 静默启动时模块级日志（`__init__.py` 设 `LLM_ASSISTANT_LOG_LEVEL=WARNING`）
- [x] 更新文档（README.md + QUICKSTART.md）
- [ ] 补充 CLI 单元测试