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

### 3. 本地验证

```bash
# 安装 wheel 包测试
pip install dist/*.whl

# 检查扩展是否安装成功
jupyter labextension list
```

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
| `GET/POST` | `/llm-assistant/workspace/sessions` | 会话列表 / 保存会话 |
| `GET/DELETE` | `/llm-assistant/workspace/sessions/<id>` | 读取/删除单个会话 |
| `GET` | `/llm-assistant/workspace/skills` | 已安装 skill 列表 |
| `POST` | `/llm-assistant/workspace/skills/install` | 安装 skill manifest |
| `DELETE` | `/llm-assistant/workspace/skills/<name>` | 删除 skill |
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
