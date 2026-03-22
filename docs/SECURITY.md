# 密钥安全说明

本文档说明 JupyterLab LLM Assistant 扩展如何处理 API 密钥，以及用户应采取的安全措施。

---

## 目录

- [密钥存储机制](#密钥存储机制)
- [安全风险与防护措施](#安全风险与防护措施)
- [最佳实践](#最佳实践)
- [多用户环境注意事项](#多用户环境注意事项)
- [密钥泄露应急处理](#密钥泄露应急处理)

---

## 密钥存储机制

### 1. 密钥来源优先级

扩展按以下优先级获取 API 密钥：

```
config.json 文件 > 环境变量
```

具体逻辑（见 `handlers.py`）：

```python
def _get_api_key(self) -> Optional[str]:
    """Return the API key from config file (priority) or environment variable."""
    # Priority: config file > environment variable
    return self.config_store.get("apiKey") or os.environ.get("OPENAI_API_KEY")
```

### 2. 存储位置

| 来源 | 存储位置 | 格式 |
|------|----------|------|
| 前端设置面板 | `~/.jupyter/llm-assistant/config.json` | JSON 明文 |
| 环境变量 | Shell 环境变量 | 字符串 |

### 3. 配置文件示例

```json
// ~/.jupyter/llm-assistant/config.json
{
  "apiEndpoint": "https://api.openai.com/v1",
  "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 4096
}
```

> ⚠️ **注意**：API 密钥以**明文形式**存储在本地文件系统中。

---

## 安全风险与防护措施

### 风险 1：明文存储

**风险描述**：API 密钥以明文形式存储在 `config.json` 文件中，任何能访问该文件的用户或程序都能读取。

**防护措施**：

```bash
# 设置配置文件权限为仅所有者可读写
chmod 600 ~/.jupyter/llm-assistant/config.json

# 确保目录权限正确
chmod 700 ~/.jupyter/llm-assistant
```

### 风险 2：版本控制泄露

**风险描述**：如果不小心将配置文件提交到 Git 仓库，API 密钥会被公开。

**防护措施**：

确保 `.gitignore` 包含以下内容：

```gitignore
# Jupyter config
.jupyter/
*.json

# LLM Assistant config
.llm-assistant/
```

### 风险 3：日志泄露

**风险描述**：扩展可能在日志中输出包含敏感信息的错误消息。

**防护措施**：

扩展已实现以下保护：
- 配置 API 返回时**不返回实际 API 密钥**（见 `handlers.py`）：

```python
def _build_safe_config(self) -> dict:
    """Build safe config dict excluding sensitive data."""
    config = self._get_config()
    return {
        "apiEndpoint": config.get("apiEndpoint", "https://api.openai.com/v1"),
        "apiKey": "",  # Never return actual API key
        "model": config.get("model", "gpt-4o"),
        # ...
        "hasApiKey": bool(self._get_api_key()),  # 只返回是否有密钥
    }
```

### 风险 4：共享服务器环境

**风险描述**：在多用户服务器上，其他用户可能读取你的配置文件。

**防护措施**：

1. 使用环境变量而非配置文件
2. 确保主目录权限正确：

```bash
chmod 700 ~
```

---

## 最佳实践

### ✅ 推荐做法

#### 1. 使用环境变量（最安全）

```bash
# 在 ~/.bashrc 或 ~/.zshrc 中设置
export OPENAI_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 或者在启动 JupyterLab 时设置
OPENAI_API_KEY="sk-xxx" jupyter lab
```

**优点**：
- 不存储在文件中
- 进程结束后自动清除
- 不会被提交到版本控制

#### 2. 使用 .env 文件（开发环境）

```bash
# 创建 .env 文件（确保在 .gitignore 中）
echo "OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx" > ~/.jupyter/.env

# 在启动脚本中加载
source ~/.jupyter/.env && jupyter lab
```

#### 3. 限制文件权限

```bash
# 创建安全目录
mkdir -p ~/.jupyter/llm-assistant
chmod 700 ~/.jupyter/llm-assistant

# 创建配置文件
touch ~/.jupyter/llm-assistant/config.json
chmod 600 ~/.jupyter/llm-assistant/config.json
```

#### 4. 定期轮换 API 密钥

- 定期在 API 提供商处重新生成 API 密钥
- 删除旧密钥，更新新密钥
- 检查 API 使用日志，确认无异常使用

### ❌ 避免的做法

1. **不要**在代码中硬编码 API 密钥
2. **不要**将 `config.json` 提交到 Git 仓库
3. **不要**在共享服务器上使用配置文件存储密钥
4. **不要**在截图或日志中暴露 API 密钥
5. **不要**通过不安全的渠道（如邮件、聊天软件）传输 API 密钥

---

## 多用户环境注意事项

### JupyterHub 环境

在 JupyterHub 多用户环境中，每个用户的配置文件应存储在各自的 home 目录中：

```
/home/user1/.jupyter/llm-assistant/config.json  # 用户1的配置
/home/user2/.jupyter/llm-assistant/config.json  # 用户2的配置
```

**管理员建议**：

1. 确保每个用户的 home 目录权限为 `700`
2. 考虑使用环境变量注入方式为用户配置密钥
3. 监控 API 使用量，设置告警

### Docker 容器环境

使用 Docker 运行 JupyterLab 时：

```bash
# 方式1：环境变量传递（推荐）
docker run -e OPENAI_API_KEY="sk-xxx" jupyterlab-llm-assistant

# 方式2：挂载配置文件（注意权限）
docker run -v ~/.jupyter/llm-assistant:/home/jovyan/.jupyter/llm-assistant:ro \
    jupyterlab-llm-assistant
```

---

## 密钥泄露应急处理

如果你怀疑 API 密钥已泄露，请立即采取以下措施：

### 1. 立即撤销泄露的密钥

**OpenAI**：
1. 访问 https://platform.openai.com/api-keys
2. 点击 "Revoke" 删除泄露的密钥
3. 创建新的 API 密钥

**其他提供商**：
- Anthropic: https://console.anthropic.com/
- DeepSeek: https://platform.deepseek.com/
- 阿里云: https://dashscope.console.aliyun.com/

### 2. 清理本地痕迹

```bash
# 删除包含密钥的配置文件
rm -f ~/.jupyter/llm-assistant/config.json

# 清理 Shell 历史（如果曾在命令行输入）
history -c  # 清除当前会话历史
# 或编辑 ~/.bash_history 删除包含密钥的行
```

### 3. 检查 Git 历史

如果密钥曾被提交到 Git 仓库：

```bash
# 使用 git filter-branch 或 BFG Repo-Cleaner 清理历史
# 警告：这会重写 Git 历史

# 使用 BFG（推荐）
bfg --replace-text passwords.txt my-repo.git

# 或使用 git filter-branch
git filter-branch --force --index-filter \
    'git rm --cached --ignore-unmatch path/to/config.json' \
    --prune-empty --tag-name-filter cat -- --all
```

### 4. 强制推送清理后的仓库

```bash
git push origin --force --all
git push origin --force --tags
```

### 5. 通知相关人员

如果仓库是公开的或有协作者：
- 通知所有协作者重新克隆仓库
- 如果是公开仓库，考虑联系 GitHub 支持删除缓存的敏感信息

---

## 安全检查清单

定期执行以下检查：

- [ ] API 密钥存储在安全位置（环境变量或权限受限的文件）
- [ ] 配置文件权限为 `600` 或更严格
- [ ] `.gitignore` 包含 `*.json` 和 `.jupyter/` 等敏感路径
- [ ] 未在代码、日志或截图中暴露 API 密钥
- [ ] 定期轮换 API 密钥
- [ ] 已启用 API 提供商的使用量监控和告警

---

## 联系方式

如果你发现本扩展存在安全漏洞，请通过以下方式报告：

- 提交 GitHub Issue（请勿在 Issue 中包含敏感信息）
- 发送邮件至项目维护者

---

## 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 0.1.0 | 2024-01 | 初始安全文档 |