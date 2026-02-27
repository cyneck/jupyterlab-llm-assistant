# JupyterLab LLM Assistant

[English](./README.md) | [中文](./README.md)

JupyterLab LLM 助手扩展 - 在 JupyterLab 侧边栏中集成 AI 编程助手。

## 功能特性

- 🤖 **多模型支持** - 支持 OpenAI、Claude、DeepSeek、Ollama、阿里云通义千问、智谱 AI、Moonshot、SiliconFlow 等
- 💬 **聊天界面** - 右侧边栏聊天面板，支持与 AI 对话
- 📝 **Markdown 渲染** - 支持 GitHub Flavored Markdown，代码高亮
- 📋 **代码复制** - 一键复制代码块内容
- 🖼️ **图片支持** - 支持上传和发送图片（Vision API）
- 🔄 **流式响应** - 实时显示 AI 响应
- 🎨 **主题适配** - 自动适配亮色/暗色主题

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

1. 在 JupyterLab 右侧边栏找到 LLM Assistant 图标
2. 点击打开聊天面板
3. 在输入框中输入问题或代码请求
4. 按 Enter 或点击发送按钮
5. 等待 AI 响应

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
│   │   ├── SettingsPanel.tsx         # 设置面板
│   │   ├── MarkdownRenderer.tsx      # Markdown 渲染
│   │   └── ...
│   ├── widgets/                      # Lumino Widgets
│   └── services/                     # API 服务
├── jupyterlab_llm_assistant/         # Python 后端
│   ├── handlers.py                   # HTTP 处理器
│   ├── llm_client.py                 # LLM 客户端
│   └── serverextension.py            # Jupyter 扩展
├── style/                            # 样式文件
├── schema/                           # 设置 Schema
└── pyproject.toml                    # 项目配置
```

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

### v0.1.0

- 初始版本
- 支持多 API Provider
- 聊天界面和设置面板
- Markdown 渲染和代码高亮
- 图片上传支持
- 流式响应