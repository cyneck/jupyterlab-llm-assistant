# Quick Start Guide

## 安装和使用

### 1. 安装

```bash
pip install jupyterlab-llm-assistant

# 重要：启用 Jupyter 服务器扩展（从 wheel 安装必须执行）
# 注意：不要使用 --py 标志，该标志只检查配置文件，不检查 entry points
jupyter server extension enable jupyterlab_llm_assistant --user
```

或从源码安装（开发模式会自动启用扩展）：

```bash
git clone https://github.com/cyneck/jupyterlab-llm-assistant.git
cd jupyterlab-llm-assistant
pip install -e .
jlpm install
jlpm run build
```

> **故障排除**：如果从 PyPI/wheel 安装后配置 LLM 时报 404 错误，说明服务器扩展未启用，请运行上述 `jupyter server extension enable` 命令。

### 2. 启动 JupyterLab

```bash
jupyter lab
```

### 3. 配置

1. 在右侧边栏找到 LLM Assistant 图标
2. 点击打开，点击右上角 ⚙ 设置按钮
3. 选择 API Provider
4. 输入 API Key 和模型名称
5. 点击"测试连接"验证
6. 点击"保存修改"

---

## 使用统一面板（v0.7.0）

v0.7.0 将 Chat / Agent 两种模式合并到**同一个面板**。底部的输入区域始终可见，左下角下拉框用于在两种模式间切换。

### 快捷键

| 按键 | 行为 |
|------|------|
| `Ctrl+Enter` / `Cmd+Enter` | 发送消息（任意模式） |
| `Enter`（单行/双行） | 发送消息 |
| `Enter`（3 行以上） | 换行 |
| `Shift+Enter` | 强制换行 |

---

## 使用 Chat 模式

Chat 模式适合快速问答、代码解释、文档生成等场景。

1. 在底部下拉框选择 **Chat**
2. 在输入框输入问题，按 `Ctrl+Enter` 或 `Enter` 发送
3. 支持粘贴或上传图片（Vision API）
4. 支持 `@` 引用文件/目录（详见下方"@ 引用功能"）

---

## 使用 Coding Agent 模式

Agent 模式允许 AI 自主调用工具完成复杂的多步骤编码任务。

### 切换方式

在底部工具栏的下拉框中选择 **Agent**。

### 使用示例

在输入框描述任务，Agent 会自主决策并逐步执行：

```
创建一个 fibonacci.py 文件，实现斐波那契数列，并运行验证输出
```

```
列出当前项目的所有 Python 文件，找出所有使用 import numpy 的地方
```

```
读取 utils.py 并添加一个新函数 format_date，然后写一个对应的单元测试
```

### Agent 可用工具

| 工具 | 功能说明 |
|------|----------|
| `read_file` | 读取指定路径的文件内容（支持行范围） |
| `write_file` | 创建或覆盖写入文件 |
| `edit_file` | 精确 str_replace 编辑：仅替换文件中的指定字符串 |
| `list_dir` | 列出目录结构（支持递归） |
| `bash` | 执行 shell 命令（30 秒超时） |
| `grep_search` | 用正则表达式搜索文件内容 |
| `notebook_execute` | 直接在 Jupyter Kernel 执行 Python 代码 |

---

## @ 引用文件 / 目录（v0.7.0 新功能）

在输入框中输入 `@` 即可打开文件/目录选择器。

| 操作 | 行为 |
|------|------|
| 输入 `@` | 打开选择器，列出项目根目录内容 |
| 点击文件夹 | 进入该目录（drill-down） |
| 点击文件 | 附加该文件为 chip |
| 点击文件夹旁的 `+` 按钮 | 将整个目录附加为 chip |
| `Backspace` | 返回上级目录 |
| `Esc` | 关闭选择器 |
| `↑` / `↓` | 在列表中导航 |
| `Enter` / `Tab` | 确认选择当前项 |

附加的文件/目录以 chip 形式显示在输入框上方，发送时其内容会作为上下文注入到消息中。

---

## ASSISTANT.md 项目指令文件（v0.7.0 新功能）

在项目根目录下创建 `.llm-assistant/ASSISTANT.md`，文件内容会在每次对话前自动注入为系统上下文：

```bash
mkdir -p .llm-assistant
cat > .llm-assistant/ASSISTANT.md << 'EOF'
# My Project

## 项目概述
这是一个 Python FastAPI 后端项目。

## 编码规范
- 使用 Black 格式化代码
- 类型注解全覆盖
- 测试文件前缀 test_

## 关键文件
- src/main.py — 入口
- src/models/ — 数据模型
EOF
```

---

## 会话历史持久化（v0.7.0）

会话历史可以保存到项目目录的 `.llm-assistant/sessions/` 下（后端持久化），也会同时备份在 localStorage（浏览器端）。

---

## 支持的模型

### OpenAI
- gpt-4o, gpt-4o-mini
- gpt-4-turbo, gpt-4
- gpt-3.5-turbo

### Anthropic
- claude-3-opus-20240229
- claude-3-sonnet-20240229
- claude-3-haiku-20240307

### Ollama (本地)
- llama3, llama3.1, llama3.2
- mistral, mixtral
- qwen2, qwen2.5
- phi3, gemma2

### 其他
- deepseek-chat, deepseek-coder
- qwen-turbo (阿里云)
- glm-4 (智谱AI)
- moonshot-v1-8k (月之暗面)

---

## 本地开发

```bash
# 安装开发依赖
pip install -e ".[test]"
jlpm install

# 开发模式（自动重载前端，需刷新浏览器）
jlpm run watch

# 完整构建（开发）
jlpm run build

# 构建生产版本
jlpm run build:prod

# 运行后端单元测试
python tests/test_new_features.py        # Agent 工具测试 (edit_file, notebook_execute 等)
python tests/test_v070_workspace.py     # Workspace 测试 (.llm-assistant 目录)
python tests/test_backend_loading.py    # 后端加载测试 (entry points, 路由注册, 配置加载)
```

---

## 发布新版本

### 方式一：使用 GitHub Actions（推荐）

1. 在 GitHub 上创建 Release
2. 工作流会自动构建并发布到 PyPI

### 方式二：手动发布

```bash
pip install build twine
python -m build
twine upload dist/*
```

详见 [build-and-publish.md](./build-and-publish.md)。

---

## 故障排除

### 扩展未显示

```bash
# 重新构建
jlpm run build

# 检查扩展状态
jupyter labextension list
```

### Agent 面板不出现 / API 404 错误

**症状**: 配置 LLM 时显示 "Failed to set config: Not Found"，或 Agent 模式无法使用。

**原因**: 服务器扩展（Server Extension）未启用。从 wheel 包安装时不会自动启用。

**修复**:

```bash
# 启用服务器扩展（注意：不要使用 --py 标志，--py 只检查配置文件，不检查 entry points）
jupyter server extension enable jupyterlab_llm_assistant --user

# 验证是否启用
jupyter server extension list | grep llm-assistant
# 应显示: jupyterlab_llm_assistant enabled OK
```

如果显示 `X The module 'jupyterlab_llm_assistant' could not be found`，说明包未安装，请重新安装：

```bash
pip install jupyterlab-llm-assistant
jupyter server extension enable jupyterlab_llm_assistant --user
```

### @ 选择器无文件列表

- 检查 JupyterLab 后端日志，确认 `/llm-assistant/context/listdir` 路由返回 200
- 确认项目根目录非空，且不全是被过滤的目录（node_modules、\_\_pycache\_\_ 等）

### .llm-assistant/ 目录写入失败

- 确认 JupyterLab 进程对项目目录有写权限
- 确认 `pyyaml>=6.0` 已安装：`python -c "import yaml; print(yaml.__version__)"`

### API 连接失败

- 检查 API Key 是否正确
- 检查网络连接
- 确认 API Endpoint 是否正确

### 样式问题

- 清除浏览器缓存
- 重启 JupyterLab
