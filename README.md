# JupyterLab LLM Assistant

JupyterLab LLM 助手扩展 — 在 JupyterLab 侧边栏中集成 AI 编程助手，支持 Chat / Agent 两种统一模式。

## 功能特性

### 统一面板

Chat、Agent 两种模式合并到同一个面板。底部始终可见的大文本输入框承载所有输入，左下角下拉框切换模式，无需页面跳转。

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

### @ 引用文件 / 目录

在输入框输入 `@` 打开文件/目录选择器：

- 支持目录逐级钻取（drill-down）
- 点击文件附加为 chip；点击 `+` 附加整个目录
- `Backspace` 返回上级；`Esc` 关闭
- 附加路径在发送时由后端解析为文件内容注入上下文

### .llm-assistant 工作区目录

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

# 重要：启用 Jupyter 服务器扩展
jupyter server extension enable --py jupyterlab_llm_assistant --sys-prefix
```

> **注意**：从 wheel 包安装时，服务器扩展不会自动启用，必须手动运行上述 enable 命令，否则后端 API 会返回 404 错误。

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
│   │   ├── ChatPanel.tsx             # 统一面板 Shell
│   │   ├── InputArea.tsx             # 统一大文本输入框
│   │   ├── AgentPanel.tsx            # Coding Agent 显示面板
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
│   ├── workspace_handler.py          # .llm-assistant 目录 API
│   ├── memory_handler.py             # Memory API
│   ├── llm_client.py                 # LLM 客户端封装
│   └── serverextension.py            # Jupyter 扩展入口
├── style/
│   ├── chat.css                      # 面板样式
│   ├── agent.css                     # Agent 样式
│   ├── memory.css                    # Memory 样式
│   └── index.css                     # 样式入口
├── tests/
│   ├── test_new_features.py          # Agent 工具测试
│   └── test_v070_workspace.py        # Workspace 测试
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

# 4. 构建（开发版本，带 source map）
jlpm run build

# 5. 构建（生产版本，minimized）
jlpm run build:prod

# 6. 验证扩展注册
pip install -e .
jupyter labextension list | grep llm-assistant
jupyter server extension list | grep llm-assistant  # 验证服务器扩展

# 7. 验证服务器扩展可导入（捕获导入错误）
python -c "from jupyterlab_llm_assistant.serverextension import load_jupyter_server_extension"
```

### 构建说明

- `jlpm run build` — 开发构建，包含 source map，便于调试
- `jlpm run build:prod` — 生产构建，代码压缩，体积更小

构建脚本使用跨平台的 Node.js 脚本，支持 Linux、macOS 和 Windows。

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

## 故障排除

### API 404 错误（配置保存失败）

**症状**: 点击"保存修改"时显示 "Failed to set config: Not Found" 或 "API 404"

**原因**: 服务器扩展（Server Extension）未启用。从 PyPI/wheel 包安装时不会自动启用。

**解决**:

```bash
# 启用服务器扩展
jupyter server extension enable --py jupyterlab_llm_assistant --sys-prefix

# 验证
jupyter server extension list | grep llm-assistant
# 应显示: jupyterlab_llm_assistant enabled OK
```

### 扩展未显示在侧边栏

```bash
# 重新构建前端
jlpm run build

# 检查扩展状态
jupyter labextension list
jupyter server extension list
```

详见完整故障排除指南：[docs/QUICKSTART.md#故障排除](./docs/QUICKSTART.md#故障排除)

---

## 许可证

BSD 3-Clause License — 详见 [LICENSE](./LICENSE) 文件。

---

## 更新日志

### 主要更新

- **统一面板** — Chat / Agent 两模式合并，共用底部大文本输入框和模式选择器，无需页面切换
- **@ 引用选择器** — 支持文件和目录的逐级钻取选择；目录可整体附加为 chip；发送时自动解析为文件内容上下文
- **`.llm-assistant/` 工作区目录** — 参考 Claude Code `.claude/` 设计，支持 ASSISTANT.md 项目指令、sessions/ 会话持久化、config.json 项目级配置
- **Agent 工具** — edit_file 精确编辑、notebook_execute Kernel 执行、bash 命令执行等
- **多模型支持** — OpenAI、Claude、DeepSeek、Ollama、通义千问、智谱 AI 等
