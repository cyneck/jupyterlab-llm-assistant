# 手工构建与发布指南

## GitHub Actions 自动构建

项目配置了 GitHub Actions 自动化工作流，位于 `.github/workflows/` 目录。

### 触发条件

| Workflow 文件 | 触发条件 |
|---------------|----------|
| `build.yml` | 推送 main/master 分支 / PR 合并到 main/master |
| `publish.yml` | 推送 main/master / 创建 GitHub Release / 手动触发 |

### 运行环境

GitHub 提供的免费托管虚拟机：

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
4. 安装 Python 依赖（pip install jupyterlab 等）
5. 安装 Node.js 依赖（jlpm install）
6. Lint 代码检查
7. 前端构建（jlpm run build:prod）
8. Python 包构建（python -m build）
9. 验证安装
10. Upload artifacts（上传 dist/ 目录）

**产物传递**：build job 通过 `actions/upload-artifact` 上传，test job 通过 `actions/download-artifact` 下载。

### 手动触发

在 GitHub 仓库页面：**Actions** → 选择 workflow → **Run workflow**

---

## 环境准备

```bash
# 安装必要工具
pip install build twine jupyterlab

# 安装 Node.js 依赖
jlpm install
```

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
- `*.whl` - Wheel 二进制包
- `*.tar.gz` - 源码包

### 3. 本地验证

```bash
# 安装 wheel 包测试
pip install dist/*.whl

# 检查扩展是否安装成功
jupyter labextension list
```

## 发布到 PyPI

### 方式一：使用 Twine（推荐）

```bash
# 安装 twine
pip install twine

# 上传到 Test PyPI（先测试）
twine upload --repository-url https://test.pypi.org/legacy/ dist/*

# 上传到正式 PyPI
twine upload dist/*
```

### 方式二：使用 Jupyter Releaser

```bash
# 安装 jupyter-releaser
pip install jupyter-releaser

# 准备发布分支
jupyter-releaser prepare-branch --branch main

# 构建
jupyter-releaser build

# 发布
jupyter-releaser publish
```

## 版本管理

发布前请更新版本号：

```bash
# 更新 package.json 中的版本
# 然后同步到 Python 包
python -c "import json; v = json.load(open('package.json'))['version']; open('jupyterlab_llm_assistant/_version.py', 'w').write(f'__version__ = \"{v}\"\n')"
```

## 故障排除

### 构建失败

1. **前端构建失败**
   ```bash
   # 清理并重新安装
   rm -rf node_modules lib
   jlpm install
   jlpm run build:prod
   ```

2. **Python 包构建失败**
   ```bash
   # 确保 labextension 已生成
   ls jupyterlab_llm_assistant/labextension/

   # 如果没有，手动复制
   mkdir -p jupyterlab_llm_assistant/labextension
   cp -r jupyterlab_llm_assistant/labextension/* jupyterlab_llm_assistant/labextension/ 2>/dev/null || true
   ```

3. **wheel 文件未生成**
   ```bash
   # 检查 pyproject.toml
   pip install build
   python -m build --wheel
   ```

### 上传失败

1. **版本已存在**
   - PyPI 不允许重复上传相同版本
   - 需要先更新版本号

2. **认证失败**
   ```bash
   # 配置 PyPI API Token
   vim ~/.pypirc
   ```

   内容示例：
   ```ini
   [pypi]
   username = __token__
   password = pypi-xxxxxxxxxxxx
   ```
