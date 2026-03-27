# Config Reload API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 新增 `POST /llm-assistant/config/reload` 接口，允许外部程序修改 config.json 后通知扩展重新加载配置。

**Architecture:** 在 serverextension.py 中暴露配置重加载函数，在 handlers.py 中新增 ConfigReloadHandler，通过 BaseConfigHandler 访问 config_store。

**Tech Stack:** Python, Tornado, Jupyter Server extension

---

## Task 1: 在 serverextension.py 中添加 reload 函数

**Files:**
- Modify: `jupyterlab_llm_assistant/serverextension.py:73-97`

**Step 1: 添加 reload_config 函数**

在 `_load_config()` 函数后添加：

```python
def _reload_config() -> Dict[str, Any]:
    """Reload config from disk, updating global _config_store."""
    global _config_store
    logger.info("[_reload_config] Reloading config from disk")
    _config_store = _load_config()
    _config_store["_save_callback"] = _save_config
    api_key_set = bool(_config_store.get("apiKey") or os.environ.get("OPENAI_API_KEY"))
    logger.info(f"[_reload_config] Reloaded config: apiKey set={api_key_set}, model={_config_store.get('model')}")
    return _config_store
```

**Step 2: 验证语法正确**

Run: `python -c "from jupyterlab_llm_assistant.serverextension import _reload_config; print('OK')"`

---

## Task 2: 在 handlers.py 中添加 ConfigReloadHandler

**Files:**
- Modify: `jupyterlab_llm_assistant/handlers.py` (在 ConfigHandler 类后添加)

**Step 1: 添加 ConfigReloadHandler 类**

在 `ConfigHandler` 类后（第126行附近）添加：

```python
class ConfigReloadHandler(BaseConfigHandler):
    """
    Handler for reloading configuration from disk.

    POST: Reload configuration from config.json
    """

    @web.authenticated
    async def post(self):
        """Reload configuration from disk."""
        logger.info("[ConfigReloadHandler] POST /llm-assistant/config/reload")
        try:
            from .serverextension import _reload_config
            _reload_config()
            logger.info("[ConfigReloadHandler] Config reload successful")
            self.finish(json.dumps(self._build_safe_config()))
        except Exception as e:
            logger.error(f"[ConfigReloadHandler] Config reload failed: {e}")
            raise web.HTTPError(500, f"Failed to reload config: {e}")
```

**Step 2: 验证语法正确**

Run: `python -c "from jupyterlab_llm_assistant.handlers import ConfigReloadHandler; print('OK')"`

---

## Task 3: 注册路由

**Files:**
- Modify: `jupyterlab_llm_assistant/handlers.py:296-301`

**Step 1: 添加路由**

在 `routes` 列表中添加：

```python
(url_path_join(base_url, "/llm-assistant/config/reload"), ConfigReloadHandler),
```

放在 `/llm-assistant/config` 路由之后。

**Step 2: 验证路由注册**

Run: `python -c "from jupyterlab_llm_assistant.handlers import setup_handlers; print('OK')"`

---

## Task 4: 测试

**Files:**
- Test: 本地 JupyterLab 环境

**Step 1: 重启 JupyterLab**

```bash
docker restart <container_id>
sleep 10
```

**Step 2: 获取 token 并测试 reload 接口**

```bash
TOKEN=$(docker logs <container_id> 2>&1 | grep -oP 'token=\K[a-f0-9]+' | tail -1)

# 先修改 config.json
docker exec <container_id> sh -c 'echo '"'"'{"model":"qwen3.5-flash"}'"'"' > /root/.llm-assistant/config.json'

# 调用 reload
curl -X POST -H "Authorization: Token $TOKEN" http://localhost:8888/llm-assistant/config/reload

# 验证配置已更新
curl -s -H "Authorization: Token $TOKEN" http://localhost:8888/llm-assistant/config | grep model
```

**Expected:** 返回的 config 中 model 为 "qwen3.5-flash"

---

## Task 5: 更新文档

**Files:**
- Modify: `docs/build-and-publish.md`

**Step 1: 添加新 API 端点说明**

在 REST API 端点表格中添加：

```markdown
| `POST` | `/llm-assistant/config/reload` | 重新加载配置文件 |
```

---

## Task 6: 提交代码

```bash
git add jupyterlab_llm_assistant/serverextension.py jupyterlab_llm_assistant/handlers.py docs/build-and-publish.md
git commit -m "feat: add config reload API endpoint"
```
