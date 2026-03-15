# Quick Start Guide

## 安装和使用

### 1. 安装

```bash
pip install jupyterlab-llm-assistant
```

或从源码安装：

```bash
git clone https://github.com/your-repo/jupyterlab-llm-assistant.git
cd jupyterlab-llm-assistant
pip install -e .
jlpm install
jlpm run build
```

### 2. 启动 JupyterLab

```bash
jupyter lab
```

### 3. 配置

1. 在右侧边栏找到 LLM Assistant 图标
2. 点击打开设置面板
3. 选择 API Provider
4. 输入 API Key 和模型名称
5. 点击"测试连接"验证
6. 点击"保存修改"

---

## 使用 Chat 模式

Chat 模式适合快速问答、代码解释、文档生成等场景。

1. 切换到面板顶部的 **Chat** 标签
2. 在输入框输入问题，按 `Enter` 发送
3. 支持粘贴或上传图片（Vision API）
4. 支持 `Shift+Enter` 换行

---

## 使用 Coding Agent 模式（新功能）

Agent 模式允许 AI 自主调用工具完成复杂的多步骤编码任务，无需手动干预。

### 切换方式

点击面板顶部 **Agent** 标签即可切换到 Agent 模式。

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
| `edit_file` | **精确 str_replace 编辑**：仅替换文件中的指定字符串，比 write_file 更安全 |
| `list_dir` | 列出目录结构（支持递归） |
| `bash` | 执行 shell 命令（30 秒超时） |
| `grep_search` | 用正则表达式搜索文件内容 |
| `notebook_execute` | 直接在 Jupyter Kernel 执行 Python 代码 |

### 工作流程

Agent 采用 **ReAct（推理 + 行动）** 循环，最多执行 10 轮：

```
用户任务 → 思考 → 选择工具 → 执行工具 → 观察结果 → 继续思考 → ... → 最终回答
```

面板中会实时显示每一步的工具名称、传入参数与执行结果，方便追踪进度。

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

# 开发模式（自动重载）
jlpm run watch

# 构建生产版本
jlpm run build:prod

# 运行测试
jlpm test
```

---

## 发布新版本

### 方式一：使用 GitHub Actions（推荐）

1. 在 GitHub 上创建 Release
2. 工作流会自动构建并发布到 PyPI

### 方式二：手动发布

```bash
pip install jupyter-releaser
jupyter-releaser prepare-branch --branch main
jupyter-releaser build
jupyter-releaser publish
```

### 方式三：手动构建发布

```bash
# 安装 build
pip install build

# 构建
python -m build

# 发布到 PyPI
twine upload dist/*
```

---

## 配置 PyPI 访问令牌

在 GitHub 仓库设置中添加 secrets：

- `PYPI_TOKEN` - PyPI API Token
- `TEST_PYPI_TOKEN` - Test PyPI API Token（可选）

获取 Token：
1. 登录 PyPI.org
2. 进入 Account Settings -> API Tokens
3. 创建新 Token
4. 添加到 GitHub Secrets

---

## 故障排除

### 扩展未显示
```bash
# 重新构建
jlpm run build

# 检查扩展状态
jupyter labextension list
```

### Agent 面板不出现

确认 server extension 已启用：
```bash
jupyter server extension list | grep llm
# 如果未启用：
jupyter server extension enable --py jupyterlab_llm_assistant
```

### Agent 工具调用失败

- 检查 API Key 和模型是否支持 `tool_use`（function calling）
- OpenAI gpt-4o 和 Claude 3 系列均支持；部分本地模型可能不支持
- 查看 JupyterLab 后端日志了解具体错误

### API 连接失败
- 检查 API Key 是否正确
- 检查网络连接
- 确认 API Endpoint 是否正确

### 样式问题
- 清除浏览器缓存
- 重启 JupyterLab
