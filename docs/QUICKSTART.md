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

## 配置 PyPI 访问令牌

在 GitHub 仓库设置中添加 secrets：

- `PYPI_TOKEN` - PyPI API Token
- `TEST_PYPI_TOKEN` - Test PyPI API Token（可选）

获取 Token：
1. 登录 PyPI.org
2. 进入 Account Settings -> API Tokens
3. 创建新 Token
4. 添加到 GitHub Secrets

## 故障排除

### 扩展未显示
```bash
# 重新构建
jlpm run build

# 检查扩展状态
jupyter labextension list
```

### API 连接失败
- 检查 API Key 是否正确
- 检查网络连接
- 确认 API Endpoint 是否正确

### 样式问题
- 清除浏览器缓存
- 重启 JupyterLab
