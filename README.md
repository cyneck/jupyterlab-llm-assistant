# JupyterLab LLM Assistant

[English](./README.md) | [中文](./README.md)

JupyterLab LLM 助手扩展 - 在 JupyterLab 侧边栏中集成 AI 编程助手，支持普通聊天模式与自主 Coding Agent 模式。

## 功能特性

### 聊天模式
- 🤖 **多模型支持** - 支持 OpenAI、Claude、DeepSeek、Ollama、阿里云通义千问、智谱 AI、Moonshot、SiliconFlow 等
- 💬 **聊天界面** - 右侧边栏聊天面板，支持与 AI 对话
- 📝 **Markdown 渲染** - 支持 GitHub Flavored Markdown，代码高亮
- 📋 **代码复制** - 一键复制代码块内容
- 🖼️ **图片支持** - 支持上传和发送图片（Vision API）
- 🔄 **流式响应** - 实时显示 AI 响应
- 🎨 **主题适配** - 自动适配亮色/暗色主题

### Coding Agent 模式（新增）
- 🛠️ **自主工具调用** - Agent 可自主决策并调用文件读写、命令执行、目录列举、代码搜索等工具完成复杂编码任务
- 📂 **文件系统操作** - 读取、写入、精确编辑（str_replace）、列出目录内容，自动沙箱隔离在工作目录内
- 💻 **命令执行** - 在 JupyterLab 服务器端安全执行 shell 命令，支持超时控制
- 🔍 **代码搜索** - 基于正则表达式搜索文件内容，支持行号定位
- 📓 **Kernel 执行** - 直接在 Jupyter Kernel 中运行 Python 代码并捕获输出
- 🔁 **多轮 ReAct 循环** - 最多 20 轮自主思考→工具调用→观察→继续的 Agent 循环
- 📊 **工具调用可视化** - 前端实时展示每一步工具名称、参数与执行结果
- 💾 **会话持久化** - 对话历史自动保存至 localStorage，刷新页面后可完整恢复
- 📋 **任务历史面板** - 记录最近 20 次任务，点击即可恢复任意历史会话

## 支持的 API Provider

| Provider | API Endpoint | 说明 |
|----------|-------------|------|
| OpenAI | https://api.openai.com/v1 | GPT-4o, GPT-4, GPT-3.5 |
| Anthropic | https://api.anthropic.com/v1 | Claude 3 Opus/Sonnet/Haiku |
| Ollama | http://localhost:11434/v1 | 本地部署的 Llama、Mistral 等 |
| DeepSeek | https://api.deepseek.com/v1 | DeepSeek Chat/Coder |
| 阿里云通义千问 | https://dashscope.aliyuncs.com/compatible-mode/v1 | qwen-turbo 等 |
| 智谱 AI | https://open.bigmodel.cn/api/paas/v4 | glm-4 系列 |
| Moonshot | https://api.moonshot.cn/v1 | moonshot-v1 系列 |
| SiliconFlow | https://api.siliconflow.cn/v1 | 多种开源模型 |
| Custom | 自定义 | 支持任意 OpenAI 兼容 API |

## 安装

### 方式一：从 PyPI 安装（推荐）

```bash
pip install jupyterlab-llm-assistant
```

### 方式二：开发模式安装

```bash
# 克隆仓库
git clone https://github.com/your-repo/jupyterlab-llm-assistant.git
cd jupyterlab-llm-assistant

# 安装
pip install -e .

# 构建前端
jlpm install
jlpm run build

# 启动 JupyterLab
jupyter lab
```

## 配置

启动 JupyterLab 后，点击右侧边栏的 LLM Assistant 图标，打开设置面板进行配置：

1. **选择 API Provider** - 从下拉列表选择或使用自定义
2. **配置 API Endpoint** - API 提供商的 base URL
3. **输入 API Key** - 你的 API 密钥
4. **输入模型名称** - 如 `gpt-4o`、`llama3`、`qwen-turbo` 等
5. **调整参数** - Temperature、Max Tokens 等
6. **测试连接** - 验证配置是否正确

### Ollama 本地部署配置

如果使用本地 Ollama：

- **Provider**: Ollama (Local)
- **API Endpoint**: http://localhost:11434/v1
- **API Key**: 任意值（Ollama 本地无需认证）
- **Model**: 你下载的模型名，如 `llama3`、`mistral` 等

启动 Ollama：
```bash
ollama serve
ollama pull llama3
```

## 使用

### 聊天模式

1. 在 JupyterLab 右侧边栏找到 LLM Assistant 图标
2. 点击打开聊天面板（默认进入 Chat 模式）
3. 在输入框中输入问题或代码请求
4. 按 Enter 或点击发送按钮
5. 等待 AI 响应

### Coding Agent 模式

1. 在面板顶部切换 Tab 到 **Agent** 模式
2. 在输入框描述你的编码任务，例如：
   - `"创建一个 hello_world.py 并运行它"`
   - `"列出当前目录，并搜索所有 Python 文件中的 import 语句"`
   - `"帮我写一个单元测试文件 test_utils.py"`
3. Agent 会自主执行多轮工具调用，前端实时展示每一步的工具名称、参数和执行结果
4. 任务完成后显示最终回答

### 快捷键

- `Enter` - 发送消息
- `Shift + Enter` - 换行

### 功能

- 支持上传图片（点击图片按钮或粘贴）
- 代码块自动高亮
- 一键复制代码
- 流式响应显示
- 清除聊天记录

## 项目结构

```
jupyterlab-llm-assistant/
├── src/                              # TypeScript 前端源码
│   ├── index.ts                      # 扩展入口
│   ├── components/                   # React 组件
│   │   ├── ChatPanel.tsx             # 主聊天面板
│   │   ├── AgentPanel.tsx            # Coding Agent 面板（新增）
│   │   ├── ToolCallDisplay.tsx       # 工具调用可视化（新增）
│   │   ├── SettingsPanel.tsx         # 设置面板
│   │   ├── MarkdownRenderer.tsx      # Markdown 渲染
│   │   └── ...
│   ├── widgets/                      # Lumino Widgets
│   └── services/                     # API 服务
├── jupyterlab_llm_assistant/         # Python 后端
│   ├── handlers.py                   # HTTP 处理器（含 /llm-assistant/agent 路由）
│   ├── agent_handler.py              # Agent ReAct 循环处理器（新增）
│   ├── agent_tools.py                # Agent 工具集实现（新增）
│   ├── llm_client.py                 # LLM 客户端
│   └── serverextension.py            # Jupyter 扩展
├── style/                            # 样式文件
│   ├── base.css
│   └── agent.css                     # Agent 面板样式（新增）
├── schema/                           # 设置 Schema
└── pyproject.toml                    # 项目配置
```

## Agent 工具说明

Coding Agent 内置以下工具，LLM 可自主选择调用：

| 工具名 | 功能 | 关键参数 |
|--------|------|----------|
| `read_file` | 读取文件内容（支持行范围） | `path`, `start_line`, `end_line` |
| `write_file` | 写入/创建文件（完整内容） | `path`, `content` |
| `edit_file` | **精确 str_replace 编辑**（仅替换指定字符串） | `path`, `old_str`, `new_str` |
| `list_dir` | 列出目录内容 | `path`, `recursive` |
| `bash` | 执行 shell 命令 | `command`, `timeout` |
| `grep_search` | 正则搜索文件内容 | `pattern`, `path`, `recursive` |
| `notebook_execute` | **在 Jupyter Kernel 执行 Python 代码** | `code`, `timeout` |

> **安全说明**：`write_file`、`edit_file` 和 `bash` 操作均限制在 JupyterLab 根目录内，`bash` / `notebook_execute` 默认超时 30 秒。

## 开发

### 环境要求

- Python >= 3.8
- Node.js >= 18
- JupyterLab >= 4.0

### 构建命令

```bash
# 安装开发依赖
pip install -e ".[test]"
jlpm install

# 构建
jlpm run build

# 开发模式（自动重载）
jlpm run watch

# 运行测试
jlpm test

# 代码检查
jlpm lint
```

## 发布

使用 jupyter-releaser 进行发布：

```bash
pip install jupyter-releaser
jupyter-releaser prepare-branch --branch main
jupyter-releaser build
jupyter-releaser publish
```

或使用 GitHub Actions 自动发布（详见 `.github/workflows/`）。

## 许可证

BSD 3-Clause License - 详见 [LICENSE](./LICENSE) 文件。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v0.3.0（当前）

- **新增 `edit_file` 工具**：str_replace 精确编辑，仅替换目标字符串，避免大文件全量覆写；含唯一性校验和详细错误提示
- **新增 `notebook_execute` 工具**：直接在 Jupyter Kernel 执行 Python 代码并捕获 stdout/stderr/rich 输出，无需写临时文件
- **Agent 会话持久化**：对话历史与工具调用记录自动存入 localStorage，页面刷新后完整恢复
- **任务历史面板**：点击 Header 上的历史按钮可查看最近 20 次任务，支持一键恢复或删除
- 最大迭代轮次从 10 提升至 20

### v0.2.0

- **新增 Coding Agent 模式**：支持自主工具调用完成复杂编码任务
- 新增 5 个 Agent 工具：`read_file`、`write_file`、`list_dir`、`bash`、`grep_search`
- 新增 AgentPanel 前端组件，实时展示工具调用过程
- 新增 `ToolCallDisplay` 组件，可视化每一步工具调用参数与结果
- 后端新增 `/llm-assistant/agent` HTTP 端点
- 新增 `agent_handler.py`（ReAct 循环）和 `agent_tools.py`（工具实现）

### v0.1.0

- 初始版本
- 支持多 API Provider
- 聊天界面和设置面板
- Markdown 渲染和代码高亮
- 图片上传支持
- 流式响应