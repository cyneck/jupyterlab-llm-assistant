# 构建与发布指南

> 本文档适用于 v0.7.0 及以上版本。

## GitHub Actions 自动构建

项目配置了 GitHub Actions 自动化工作流，位于 `.github/workflows/` 目录。

### 触发条件

| Workflow 文件 | 触发条件 |
|---------------|----------|
| `build.yml` | 推送 main/master 分支 / PR 合并到 main/master |
| `publish.yml` | 推送 main/master / 创建 GitHub Release / 手动触发 |

### 运行环境

| 环境配置 | 值 |
|----------|-----|
| 操作系统 | Ubuntu 22.04 |
| Python | 3.11 |
| Node.js | 20 |

### 执行流程

```
代码推送 → 触发 Workflow → 分配虚拟机 → 按步骤执行 → 上传构建产物
```

**build.yml 执行顺序**：
1. Checkout（拉取代码）
2. Setup Python 3.11
3. Setup Node.js 20
4. 安装 Python 依赖（含 `pyyaml`、`openai`、`pydantic` 等）
5. 安装 Node.js 依赖（`jlpm install`）
6. Lint 代码检查
7. 前端构建（`jlpm run build:prod`）
8. Python 包构建（`python -m build`）
9. 运行后端测试（`python tests/test_new_features.py && python tests/test_v070_workspace.py`）
10. 验证安装（`jupyter labextension list`）
11. Upload artifacts（上传 dist/ 目录）

---

## 推送前本地验证（强制要求）

在执行 `git push` 之前，**必须**完成以下所有步骤：

### 1. 运行后端单元测试

```bash
# 测试 agent 工具（edit_file、notebook_execute 等）
python tests/test_new_features.py

# 测试 workspace 功能（.llm-assistant 目录、ASSISTANT.md、config.json）
python tests/test_v070_workspace.py
```

所有测试必须 **全部通过（0 失败）**，否则不允许推送。

### 2. 运行前端构建

```bash
# 开发构建（快速验证无 TypeScript 错误）
npm run build

# 生产构建（发布前必须）
npm run build:prod
```

构建必须以 **`compiled with 0 errors`** 结束（1 warning 关于 highlight.js 版本属已知问题，可忽略）。

### 3. 验证扩展注册

```bash
pip install -e .
jupyter labextension list | grep llm-assistant
# 期望输出：jupyterlab-llm-assistant v0.x.x  enabled  OK
```

---

## 环境准备

```bash
# 安装必要工具
pip install build twine jupyterlab pyyaml

# 安装 Node.js 依赖
jlpm install
```

---

## 构建步骤

### 1. 构建前端扩展

```bash
# 开发模式
jlpm run build

# 生产模式（推荐用于发布）
jlpm run build:prod
```

### 2. 构建 Python 包

```bash
# 清理旧的构建文件
rm -rf dist/

# 构建 wheel 和 sdist
python -m build

# 查看构建结果
ls -la dist/
```

构建完成后，`dist/` 目录应包含：
- `*.whl` — Wheel 二进制包
- `*.tar.gz` — 源码包

### 3. 本地验证（从 wheel 安装）

```bash
# 安装 wheel 包测试
pip install dist/*.whl

# 重要：启用服务器扩展（wheel 安装不会自动启用）
jupyter server extension enable jupyterlab_llm_assistant --user

# 检查扩展是否安装成功
jupyter labextension list
jupyter server extension list | grep llm-assistant
```

> **注意**：从 wheel 包安装时，必须手动启用服务器扩展，否则后端 API 会返回 404 错误。开发模式（`pip install -e .`）会自动启用扩展。

---

## 发布到 PyPI

### 方式一：使用 Twine（推荐）

```bash
# 上传到 Test PyPI（先测试）
twine upload --repository-url https://test.pypi.org/legacy/ dist/*

# 上传到正式 PyPI
twine upload dist/*
```

### 方式二：使用 Jupyter Releaser

```bash
pip install jupyter-releaser
jupyter-releaser prepare-branch --branch main
jupyter-releaser build
jupyter-releaser publish
```

---

## 版本管理

发布前请更新版本号：

```bash
# 1. 修改 package.json 中的 version 字段
# 2. 同步到 Python 包（_version.py 由 hatch-nodejs-version 自动生成）
jlpm run version:bump  # 或手动编辑 package.json

# 3. 构建并验证版本
npm run build:prod
python -m build
```

---

## v0.7.0 新增文件说明

v0.7.0 新增以下文件，构建时会自动包含在 wheel 包中：

| 文件 | 说明 |
|------|------|
| `jupyterlab_llm_assistant/workspace_handler.py` | `.llm-assistant/` 目录管理，11 个 REST API 端点 |
| `src/components/InputArea.tsx` | 完全重写：统一大文本框 + 模式选择器 + @ 引用选择器 |
| `tests/test_v070_workspace.py` | workspace_handler 单元测试（31 个测试用例） |

### 新增 REST API 端点（workspace）

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/llm-assistant/workspace/info` | 工作区信息（是否有 ASSISTANT.md 等） |
| `GET/PUT` | `/llm-assistant/workspace/assistant-md` | 读写 ASSISTANT.md |
| `GET/PUT` | `/llm-assistant/workspace/config` | 读写项目级 LLM 配置 |
| `POST` | `/llm-assistant/config/reload` | 重新加载配置文件 |
| `GET/POST` | `/llm-assistant/workspace/sessions` | 会话列表 / 保存会话 |
| `GET/DELETE` | `/llm-assistant/workspace/sessions/<id>` | 读取/删除单个会话 |
| `GET` | `/llm-assistant/workspace/skills` | 已安装 skill 列表 |
| `POST` | `/llm-assistant/workspace/skills/install` | 安装 skill manifest |
| `DELETE` | `/llm-assistant/workspace/skills/<name>` | 删除 skill |
| `POST` | `/llm-assistant/context/read` | 读取文件内容（支持多文件） |
| `POST` | `/llm-assistant/context/resolve` | 解析 glob 模式或路径 |
| `POST` | `/llm-assistant/context/listdir` | 目录单级列表（@ 选择器用） |

---

## 运行时依赖变更（v0.7.0）

`pyproject.toml` 新增：

```toml
"pyyaml>=6.0",   # workspace_handler.py 中 skill manifest 加载需要
```

升级安装时请确保：

```bash
pip install --upgrade jupyterlab-llm-assistant
# 或在开发模式下：
pip install -e .
```

---

## 故障排除

### 构建失败

```bash
# 清理并重新安装
rm -rf node_modules lib
jlpm install
jlpm run build:prod
```

### Python 包构建失败

```bash
# 确保 labextension 已生成
ls jupyterlab_llm_assistant/labextension/

# 确保 pyyaml 已安装
python -c "import yaml; print('yaml ok:', yaml.__version__)"
```

### PyPI 上传失败

1. **版本已存在** — 更新 `package.json` 中的版本号后重新构建
2. **认证失败** — 配置 `~/.pypirc`：
   ```ini
   [pypi]
   username = __token__
   password = pypi-xxxxxxxxxxxx
   ```

---

## 运行时故障排除

### API 404 错误（测试连接失败）

**症状**: 前端显示 "✗ Error: Failed to set config: Not Found"，浏览器网络请求返回 404。

**原因**: 服务器扩展（Server Extension）未正确加载。

**诊断步骤**:

```bash
# 1. 检查服务器扩展状态
jupyter server extension list | grep llm-assistant
# 应显示: jupyterlab_llm_assistant enabled OK

# 2. 验证扩展可导入（捕获 ImportError）
python -c "from jupyterlab_llm_assistant.serverextension import load_jupyter_server_extension"
# 如果失败，查看具体错误

# 3. 查看 Jupyter 启动日志
grep -i llm /path/to/jupyter.log
# 应看到:
# - jupyterlab_llm_assistant | extension was successfully linked
# - Loading JupyterLab LLM Assistant extension v0.x.x
```

**修复方法**:

```bash
# 方法1: 自动启用
jupyter server extension enable jupyterlab_llm_assistant --user

# 方法2: 手动创建配置文件
mkdir -p $(jupyter --config-dir)/jupyter_server_config.d
cat > $(jupyter --config-dir)/jupyter_server_config.d/jupyterlab_llm_assistant.json << 'EOF'
{
  "ServerApp": {
    "jpserver_extensions": {
      "jupyterlab_llm_assistant": true
    }
  }
}
EOF

# 重启 JupyterLab
pkill -f "jupyter-lab"
jupyter lab
```

### 导入错误导致扩展加载失败

**症状**: Jupyter 启动无报错，但扩展未加载，API 返回 404。

**原因**: 代码中存在导入错误（如导入未声明的依赖），导致 `jupyterlab_llm_assistant` 模块加载失败。

**示例**:
```python
# llm_client.py 中导入未使用的模块
import aiohttp  # 不在 pyproject.toml 依赖中
```

**修复**:
1. 移除未使用的导入
2. 重新安装: `pip install -e . --force-reinstall --no-deps`
3. 重启 JupyterLab

### 扩展加载但前端无法访问

**症状**: `jupyter server extension list` 显示 enabled，但前端报错。

**检查**:
```bash
# 测试 API 是否可达（需替换 token）
curl http://localhost:8888/llm-assistant/config?token=YOUR_TOKEN

# 应返回 JSON 配置，而非 404
```
