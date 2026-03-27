# Config Reload API 设计

## 概述

新增 `POST /llm-assistant/config/reload` 接口，允许外部程序修改 `config.json` 后主动通知扩展重新加载配置到内存，无需重启 JupyterLab。

## 背景问题

当前配置加载机制：
- JupyterLab 启动时，`_load_config()` 将 `config.json` 加载到内存 (`_config_store`)
- 之后通过 UI 修改配置会同时更新内存和文件
- 但外部程序直接修改 `config.json` 后，内存中的配置不会自动更新

## 解决方案

### 新增接口

| Method | Path | 说明 |
|--------|------|------|
| `POST` | `/llm-assistant/config/reload` | 重新加载配置文件到内存 |

### 行为

1. 接收 POST 请求
2. 调用 `_load_config()` 重新读取 `config.json`
3. 更新全局 `_config_store` 字典
4. 返回新配置（不含 apiKey 明文）
5. 记录日志：`Config reload requested, reloaded model=<model>`

### API 响应

**成功：**
```json
{
  "success": true,
  "apiEndpoint": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "model": "qwen3.5-flash",
  "temperature": 0.7,
  "maxTokens": 4096,
  "systemPrompt": "...",
  "enableStreaming": true,
  "enableVision": true,
  "hasApiKey": true
}
```

**失败：**
```json
{
  "success": false,
  "error": "Failed to reload config: <error_message>"
}
```

## 实现变更

### serverextension.py

- 将 `_load_config()` 移到模块级别可调用
- 或新增 `_reload_config()` 函数专门处理 reload

### handlers.py

新增 `ConfigReloadHandler` 类：

```python
class ConfigReloadHandler(BaseConfigHandler):
    @web.authenticated
    async def post(self):
        # 重新加载配置
        # 返回新配置
```

### 路由注册

在 `setup_handlers()` 中添加：
```python
(url_path_join(base_url, "/llm-assistant/config/reload"), ConfigReloadHandler),
```

## 外部使用示例

```bash
# 外部程序修改 config.json 后
curl -X POST -H "Authorization: Token $TOKEN" \
  http://localhost:8888/llm-assistant/config/reload
```

## 注意事项

- apiKey 不会在响应中明文返回
- Reload 会覆盖所有内存配置，包括未保存的修改
- 建议外部程序修改前先通过 GET /config 获取最新状态
