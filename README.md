# JupyterLab LLM Assistant

JupyterLab LLM 助手扩展 — 在 JupyterLab 侧边栏中集成 AI 编程助手，支持 Chat / Agent / Plan 三种统一模式。

## 功能特性

### 统一面板（v0.7.0）

Chat、Agent、Plan 三种模式合并到同一个面板。底部始终可见的大文本输入框承载所有输入，左下角下拉框切换模式，无需页面跳转。

### Chat 模式

- **多模型支持** — OpenAI、Claude、DeepSeek、Ollama、通义千问、智谱 AI 等
- **Markdown 渲染** — GitHub Flavored Markdown，代码高亮
- **图片支持** — 上传、粘贴图片（Vision API）
- **流式响应** — 实时显示 AI 响应
- **主题适配** — 自动适配亮色 / 暗色主题

### Coding Agent 模式

- **自主工具调用** — 文件读写、精确编辑、命令执行、目录列举、代码搜索、Kernel 执行
- **多轮 ReAct 循环** — 最多 20 轮自主思考 → 工具调用 → 观察 → 继续
- **工具调用可视化** — 实时展示每一步工具名称、参数与执行结果
- **会话持久化** — localStorage + `.llm-assistant/sessions/` 双重备份

### Plan 模式

- **自动拆解任务** — LLM 将高层任务分解为带标题和描述的步骤列表
- **可编辑步骤** — 发送后可修改任何步骤再执行
- **逐步 / 全量执行** — 支持逐步审查或一键全量运行
- **步骤内 Agent 循环** — 每一步独立调用 Coding Agent，实时展示工具调用

### @ 引用文件 / 目录（v0.7.0）

在输入框输入 `@` 打开文件/目录选择器：

- 支持目录逐级钻取（drill-down）
- 点击文件附加为 chip；点击 `+` 附加整个目录
- `Backspace` 返回上级；`Esc` 关闭
- 附加路径在发送时由后端解析为文件内容注入上下文

### .llm-assistant 工作区目录（v0.7.0）

受 Claude Code 的 `.claude/` 设计启发，每个项目根目录下可以维护：

```
<project_root>/
└── .llm-assistant/
    ├── ASSISTANT.md       # 项目级 LLM 指令，每次对话自动注入
    ├── config.json        # 项目级 LLM 配置覆盖（模型、温度等）
    ├── sessions/          # 对话历史 JSON 文件
    └── skills/            # 已安装的 skill manifest（YAML）
```

完整 REST API 由 `workspace_handler.py` 提供（9 个端点）。

---

## 支持的 API Provider

| Provider | API Endpoint | 说明 |
|----------|-------------|------|
| OpenAI | https://api.openai.com/v1 | GPT-4o, GPT-4, GPT-3.5 |
| Anthropic | https://api.anthropic.com/v1 | Claude 3 Opus/Sonnet/Haiku |
| Ollama | http://localhost:11434/v1 | 本地 Llama、Mistral 等 |
| DeepSeek | https://api.deepseek.com/v1 | DeepSeek Chat/Coder |
| 阿里云通义千问 | https://dashscope.aliyuncs.com/compatible-mode/v1 | qwen-turbo 等 |
| 智谱 AI | https://open.bigmodel.cn/api/paas/v4 | glm-4 系列 |
| Moonshot | https://api.moonshot.cn/v1 | moonshot-v1 系列 |
| SiliconFlow | https://api.siliconflow.cn/v1 | 多种开源模型 |
| Custom | 自定义 | 支持任意 OpenAI 兼容 API |

---

## 安装

### 方式一：从 PyPI 安装（推荐）

```bash
pip install jupyterlab-llm-assistant
```

### 方式二：开发模式安装

```bash
git clone https://github.com/cyneck/jupyterlab-llm-assistant.git
cd jupyterlab-llm-assistant

pip install -e .
jlpm install
jlpm run build

jupyter lab
```

---

## 配置

启动 JupyterLab 后，点击右侧边栏的 LLM Assistant 图标，然后点击右上角 ⚙ 按钮进入设置面板：

1. **选择 API Provider** — 从下拉列表选择或使用自定义
2. **配置 API Endpoint** — API 提供商的 base URL
3. **输入 API Key** — 你的 API 密钥
4. **输入模型名称** — 如 `gpt-4o`、`llama3`、`qwen-turbo` 等
5. **调整参数** — Temperature、Max Tokens 等
6. **测试连接** — 验证配置是否正确

### 项目级配置（可选）

在项目根目录创建 `.llm-assistant/config.json` 可覆盖全局配置：

```json
{
  "model": "gpt-4o",
  "temperature": 0.3,
  "systemPrompt": "你是一名 Python 专家，回答简洁。"
}
```

### ASSISTANT.md 项目指令（可选）

```bash
mkdir -p .llm-assistant
cat > .llm-assistant/ASSISTANT.md << 'EOF'
# 项目名称

## 项目概述
描述项目...

## 编码规范
- 使用 Black 格式化
- 类型注解全覆盖

## 关键文件
- src/main.py — 入口
EOF
```

---

## 使用

### 快捷键

| 按键 | 行为 |
|------|------|
| `Ctrl+Enter` / `Cmd+Enter` | 发送消息（任意模式） |
| `Enter`（单行/双行） | 发送消息 |
| `Enter`（3 行以上） | 换行 |

### Chat 模式

1. 底部下拉框选择 **Chat**
2. 在输入框输入问题，按 `Ctrl+Enter` 发送
3. 支持粘贴或上传图片

### Coding Agent 模式

1. 底部下拉框切换到 **Agent**
2. 描述编码任务（例：`"创建一个 hello_world.py 并运行它"`）
3. Agent 自主执行多轮工具调用，前端实时展示每一步

### Plan 模式

1. 底部下拉框切换到 **Plan**
2. 描述高层任务（例：`"给 API 服务添加用户认证模块"`）
3. LLM 生成步骤列表，可逐步或全量执行

### @ 引用上下文

在任意模式的输入框中输入 `@` 选择文件或目录作为上下文附件：

- **文件** — 附加为 chip，发送时内容注入
- **目录** — 点击 `+` 附加整个目录（自动递归解析所有文本文件）
- **钻取** — 点击文件夹进入子目录，`Backspace` 返回上级

---

## Agent 工具说明

| 工具名 | 功能 | 关键参数 |
|--------|------|----------|
| `read_file` | 读取文件内容（支持行范围） | `path`, `start_line`, `end_line` |
| `write_file` | 写入/创建文件（完整内容） | `path`, `content` |
| `edit_file` | str_replace 精确编辑 | `path`, `old_str`, `new_str`, `replace_all` |
| `list_dir` | 列出目录内容 | `path`, `recursive` |
| `bash` | 执行 shell 命令 | `command`, `timeout` |
| `grep_search` | 正则搜索文件内容 | `pattern`, `path`, `recursive` |
| `notebook_execute` | 在 Jupyter Kernel 执行 Python 代码 | `code`, `timeout` |

> **安全说明**：`write_file`、`edit_file`、`bash` 操作均限制在 JupyterLab 工作目录内，`bash` / `notebook_execute` 默认超时 30 秒。

---

## 项目结构

```
jupyterlab-llm-assistant/
├── src/                              # TypeScript 前端源码
│   ├── index.ts                      # 扩展入口
│   ├── components/
│   │   ├── ChatPanel.tsx             # 统一面板 Shell（v0.7.0 重写）
│   │   ├── InputArea.tsx             # 统一大文本输入框（v0.7.0 重写）
│   │   ├── AgentPanel.tsx            # Coding Agent 显示面板
│   │   ├── PlanPanel.tsx             # Plan 显示面板
│   │   ├── MessageList.tsx           # Chat 消息列表
│   │   ├── ToolCallDisplay.tsx       # 工具调用可视化
│   │   ├── SettingsPanel.tsx         # 设置面板
│   │   ├── MemoryPanel.tsx           # Memory 面板
│   │   └── MarkdownRenderer.tsx      # Markdown 渲染
│   └── services/
│       └── api.ts                    # 前端 API 客户端
├── jupyterlab_llm_assistant/         # Python 后端
│   ├── handlers.py                   # 路由注册总入口
│   ├── agent_handler.py              # Agent ReAct 循环
│   ├── agent_tools.py                # Agent 工具实现
│   ├── context_handler.py            # 文件内容 / 目录列表 API
│   ├── workspace_handler.py          # .llm-assistant 目录 API（v0.7.0）
│   ├── plan_handler.py               # Plan 生成 / 执行 API
│   ├── memory_handler.py             # Memory API
│   ├── llm_client.py                 # LLM 客户端封装
│   └── serverextension.py            # Jupyter 扩展入口
├── style/
│   └── chat.css                      # 全部样式
├── tests/
│   ├── test_new_features.py          # Agent 工具测试（42 用例）
│   └── test_v070_workspace.py        # Workspace 测试（31 用例）
├── docs/
│   ├── QUICKSTART.md                 # 快速上手指南
│   └── build-and-publish.md          # 构建与发布指南
├── schema/                           # 设置 Schema
├── pyproject.toml                    # Python 包配置
└── package.json                      # Node.js 包配置
```

---

## 开发

### 环境要求

- Python >= 3.8
- Node.js >= 18
- JupyterLab >= 4.0

### 开发流程

```bash
# 1. 安装开发依赖
pip install -e ".[test]"
jlpm install

# 2. 开发模式（自动重载前端，刷新浏览器生效）
jlpm run watch

# 3. 运行后端测试（推送前必须）
python tests/test_new_features.py
python tests/test_v070_workspace.py

# 4. 完整构建验证（推送前必须）
npm run build

# 5. 验证扩展注册
pip install -e .
jupyter labextension list | grep llm-assistant
jupyter server extension list | grep llm-assistant  # 验证服务器扩展

# 6. 验证服务器扩展可导入（捕获导入错误）
python -c "from jupyterlab_llm_assistant.serverextension import load_jupyter_server_extension"
```

### 推送规范

每次 `git push` 前必须完成：

1. 所有后端测试全部通过（`0 失败`）
2. 前端构建无 TypeScript 错误
3. `jupyter labextension list` 显示 `enabled OK`
4. `jupyter server extension list` 显示 `jupyterlab_llm_assistant enabled OK`
5. `python -c "from jupyterlab_llm_assistant.serverextension import load_jupyter_server_extension"` 执行成功（无导入错误）
6. 同步更新 `docs/` 及 `README.md` 中涉及的功能变更

---

## 发布

```bash
# 清理旧产物
rm -rf dist/

# 生产构建
jlpm run build:prod

# 构建 Python 包
python -m build

# 发布到 PyPI
twine upload dist/*
```

详见 [docs/build-and-publish.md](./docs/build-and-publish.md)。

---

## 许可证

BSD 3-Clause License — 详见 [LICENSE](./LICENSE) 文件。

---

## 更新日志

### v0.7.0（当前）

- **统一面板** — Chat / Agent / Plan 三模式合并，共用底部大文本输入框和模式选择器，无需页面切换
- **@ 引用选择器** — 支持文件和目录的逐级钻取选择；目录可整体附加为 chip；发送时自动解析为文件内容上下文
- **移除 ContextFilePanel** — 上下文管理完全通过 @ chip 实现，界面更简洁
- **`.llm-assistant/` 工作区目录** — 参考 Claude Code `.claude/` 设计，支持 ASSISTANT.md 项目指令、sessions/ 会话持久化、config.json 项目级配置、skills/ skill 仓库（为 Skill 系统预留）
- **新增 workspace REST API** — 9 个端点，完整管理工作区资源
- **新增 context/listdir API** — 目录单级列表，供 @ 选择器使用
- **pyyaml 依赖** — 新增为运行时依赖（workspace_handler skill manifest 加载需要）
- **新增测试** — `tests/test_v070_workspace.py`（31 个用例，全部通过）
- **Code Review 修复** — fileInputRef 非图片文件改为 chip、rootDir 通过 workspace/info 正确初始化

### v0.3.0

- 新增 `edit_file` 工具（str_replace 精确编辑）
- 新增 `notebook_execute` 工具（直接在 Jupyter Kernel 执行 Python）
- Agent 会话持久化（localStorage）
- 任务历史面板（最近 20 次）
- 最大迭代轮次从 10 提升至 20

### v0.2.0

- 新增 Coding Agent 模式（5 个工具）
- AgentPanel 前端组件 + ToolCallDisplay 工具调用可视化
- 后端 `/llm-assistant/agent` 端点

### v0.1.0

- 初始版本：多模型 Chat、Markdown 渲染、图片上传、流式响应
