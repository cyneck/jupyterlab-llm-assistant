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

### Skill 系统

支持从多种来源安装 skill：

**1. Skill 市场（内置）**
- Anthropic Skills — 官方 Anthropic skills for Claude Code
- Community Skills — 社区贡献的 skills

**2. 从 URL/GitHub 安装**
```
github:user/repo/path/to/skill
https://github.com/user/repo/blob/branch/path/skill.yaml
https://raw.githubusercontent.com/user/repo/branch/path/skill.yaml
```

**3. 从 YAML 安装**
直接粘贴 skill manifest YAML 内容安装

**Skill Manifest 格式（兼容 Claude Code）**
```yaml
name: my-skill
version: "1.0.0"
description: "A description of the skill"
author: "Author Name"
system_prompt: |
  You have access to special tools and instructions...
enabled: true
tools:
  - name: my_tool
    description: "A custom tool"
    module: my_skill.tools
    function: run_tool
    parameters:
      type: object
      properties:
        input:
          type: string
      required: [input]
```

完整 REST API 由 `workspace_handler.py` 提供（11 个端点）。

---

## 支持的 API Provider

| Provider | API Endpoint | 默认模型 |
|----------|-------------|---------|
| OpenAI | https://api.openai.com/v1 | gpt-4o |
| Anthropic (Claude) | https://api.anthropic.com/v1 | claude-3-5-sonnet |
| Google (Gemini) | https://generativelanguage.googleapis.com/v1beta | gemini-3.0-flash |
| Groq | https://api.groq.com/openai/v1 | llama-3.3-70b |
| Mistral AI | https://api.mistral.ai/v1 | mistral-large |
| Cohere | https://api.cohere.ai/v2 | command-r-plus |
| DeepInfra | https://api.deepinfra.com/v1/openai | Llama-3.3-70B |
| Together AI | https://api.together.xyz/v1 | Llama-3.3-70B |
| DeepSeek | https://api.deepseek.com/v1 | deepseek-chat |
| MiniMax | https://api.minimax.chat/v1 | MiniMax-M2.5 |
| Kimi (Moonshot) | https://api.moonshot.cn/v1 | moonshot-v1-8k |
| 阿里云通义 (DashScope) | https://dashscope.aliyuncs.com/compatible-mode/v1 | qwen-plus |
| 阿里云 CodeQwen | https://coding.dashscope.com/v1 | qwen2.5-coder-32b |
| 智谱 GLM | https://open.bigmodel.cn/api/paas/v4 | glm-4 |
| Ollama (本地) | http://localhost:11434/v1 | qwen3.5 |
| Custom | 自定义 | — |

---

## 安装

### 方式一：从 PyPI 安装（推荐）

```bash
pip install jupyterlab-llm-assistant

# 重要：启用 Jupyter 服务器扩展
jupyter server extension enable jupyterlab_llm_assistant --users
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

### 🔐 密钥安全说明

- **配置存储位置**: API Key 保存在 Jupyter 用户数据目录：
  - Linux/macOS: `~/.local/share/jupyter/lab/jupyterlab-llm-assistant.json`
  - Windows: `%APPDATA%\jupyter\lab\jupyterlab-llm-assistant.json`

- **安全提示**:
  - 密钥仅保存在本地，不会上传到任何第三方服务器
  - 请勿将配置文件提交到 Git 仓库
  - 建议使用项目级配置（`.llm-assistant/config.json`）覆盖敏感设置，并将其加入 `.gitignore`

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
├── src/                              # TypeScript 前端源码（开发时编辑）
│   ├── index.ts                      # JupyterLab 插件入口，注册侧边栏
│   ├── widgets/
│   │   └── LLMAssistantPanel.tsx     # 侧边栏面板组件
│   ├── components/                   # React UI 组件
│   │   ├── ChatPanel.tsx             # 统一面板 Shell（Chat/Agent 模式切换）
│   │   ├── UnifiedMessageList.tsx    # 统一消息列表（Chat/Agent 消息渲染）
│   │   ├── InputArea.tsx             # 底部大文本输入框 + @文件选择器
│   │   ├── ToolCallDisplay.tsx       # Agent 工具调用可视化
│   │   ├── SettingsPanel.tsx         # 设置面板（Provider 选择、API 配置）
│   │   ├── MemoryPanel.tsx            # Memory 持久化面板
│   │   ├── SessionPanel.tsx          # 会话历史管理面板
│   │   ├── ContextFilePanel.tsx      # @引用文件/目录上下文面板
│   │   ├── MarkdownRenderer.tsx      # Markdown 渲染（GFM + 代码高亮）
│   │   ├── CodeBlock.tsx             # 代码块组件
│   │   ├── MessageItem.tsx           # 单条消息渲染
│   │   └── icons.ts                  # SVG 图标
│   ├── models/                       # TypeScript 类型和状态管理
│   │   ├── types.ts                  # 所有类型定义（LLMSettings, ProviderInfo 等）
│   │   ├── settings.ts               # SettingsModel 类，配置加载/保存逻辑
│   │   └── chat.ts                   # Chat 状态类型
│   └── services/
│       └── api.ts                    # 前端 API 客户端（调用所有后端 REST 接口）
├── jupyterlab_llm_assistant/         # Python 后端（Jupyter Server 扩展）
│   ├── __init__.py                   # 包初始化
│   ├── _version.py                   # 版本号
│   ├── serverextension.py             # 扩展入口，加载配置，注册路由
│   ├── handlers.py                    # 路由注册总入口，所有 API Handler 映射
│   ├── llm_client.py                  # LLM 客户端封装（OpenAI 兼容 API）
│   ├── agent_handler.py               # Agent SSE 流式响应（ReAct 循环入口）
│   ├── agent_loop.py                  # Agent ReAct 循环核心逻辑
│   ├── agent_tools.py                 # Agent 工具实现（7 个工具）
│   ├── context_handler.py             # 文件内容读取 / 目录列表 API
│   ├── workspace_handler.py           # .llm-assistant 目录管理（9 个端点）
│   ├── memory_handler.py             # Memory 持久化 API
│   ├── providers.json                 # Provider 配置列表（LLM 厂商定义）
│   └── labextension/                 # ⚠️ 构建产物目录（由 jlpm run build 自动生成）
│       └── static/                    # ⚠️ 构建后的 JS/CSS（无需编辑，pip install 时自动部署）
├── lib/                               # ⚠️ 构建产物目录（TypeScript 编译输出）
│   ├── index.js                       # ⚠️ 编译后的扩展入口
│   ├── services/api.js                # ⚠️ 编译后的 API 客户端
│   └── components/*.js               # ⚠️ 编译后的 React 组件
├── style/                             # CSS 样式源码
│   ├── index.css                     # 样式入口
│   ├── chat.css                      # Chat 模式样式
│   ├── agent.css                     # Agent 模式样式
│   └── memory.css                    # Memory 样式
├── tests/                             # Python 测试
│   ├── test_new_features.py          # Agent 工具测试（edit_file, notebook_execute 等）
│   ├── test_v070_workspace.py         # Workspace API 测试
│   ├── test_config_llm.py             # 配置管理测试
│   ├── test_backend_loading.py        # 后端加载测试
│   ├── test_api_key_persistence.py   # API Key 持久化测试
│   ├── test_api_key_full.py          # API Key 完整流程测试
│   └── test_save_config_direct.py    # 直接保存配置测试
├── docs/                              # 文档
│   ├── QUICKSTART.md                 # 快速上手指南
│   ├── build-and-publish.md          # 构建与发布指南
│   ├── SECURITY.md                   # 安全说明
│   └── plans/                        # 设计文档
├── schema/                            # JupyterLab 设置 Schema
├── scripts/                           # 构建脚本
├── pyproject.toml                    # Python 包配置（hatchling 构建后端）
├── package.json                      # Node.js 包配置（JupyterLab builder 前端）
├── tsconfig.json                     # TypeScript 配置
├── yarn.lock / package-lock.json     # 依赖锁文件
└── dockerfile                        # Docker 镜像构建文件
```

### ⚠️ 构建产物说明

以下目录/文件是 **构建时自动生成** 的，**无需提交到 Git**：

| 目录/文件 | 说明 |
|----------|------|
| `lib/` | TypeScript 编译输出的 JavaScript（`.gitignore` 忽略） |
| `jupyterlab_llm_assistant/labextension/` | `jlpm run build` 生成的 labextension 包 |
| `dist/` | `python -m build` 生成的 wheel/sdist 包 |
| `node_modules/` | `jlpm install` 安装的 npm 依赖 |

**安装流程**：`pip install -e .` 时会：
1. 安装 Python 包到 site-packages
2. 自动构建并复制 labextension 到 Jupyter 数据目录
3. 启用 Jupyter Server 扩展

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
jupyter server extension enable jupyterlab_llm_assistant --sys-prefix

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
