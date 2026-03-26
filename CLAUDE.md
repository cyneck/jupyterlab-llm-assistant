# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JupyterLab LLM Assistant is a JupyterLab 4 extension that provides an AI coding assistant in the sidebar with Chat and Agent modes. The frontend is TypeScript/React and the backend is Python/Tornado integrated with Jupyter Server.

## Architecture

### Frontend (TypeScript/React)

- **Entry point**: `src/index.ts` - Registers the JupyterLab plugin and creates the sidebar panel
- **Components**: `src/components/` - React components including ChatPanel, AgentPanel, and unified InputArea (v0.7.0)
- **Services**: `src/services/api.ts` - Frontend API client for all REST endpoints
- **Models**: `src/models/` - TypeScript types and state management
- **Build output**: `lib/` (compiled JS), `jupyterlab_llm_assistant/labextension/` (bundled extension)

### Backend (Python/Tornado)

- **Entry point**: `jupyterlab_llm_assistant/serverextension.py` - Jupyter Server extension loader
- **Route registration**: `jupyterlab_llm_assistant/handlers.py` - All API endpoints registered here via `setup_handlers()`
- **Handler modules**:
  - `agent_handler.py` - ReAct agent loop with SSE streaming
  - `agent_tools.py` - 7 tool implementations (read_file, write_file, edit_file, bash, list_dir, grep_search, notebook_execute)
  - `workspace_handler.py` - `.llm-assistant/` directory management (ASSISTANT.md, sessions, config.json, skills)
  - `context_handler.py` - File content reading and directory listing
  - `memory_handler.py` - Conversation memory persistence
  - `llm_client.py` - OpenAI-compatible API client wrapper

### Extension Architecture

The extension follows the JupyterLab 4 prebuilt extension pattern:
- Python package metadata in `pyproject.toml` with hatchling build backend
- Node.js dependencies in `package.json` with JupyterLab builder
- Shared data mapping in `pyproject.toml` places the labextension in Jupyter's data directory

## Common Commands

### Development Setup

```bash
# Install Python package in editable mode
pip install -e ".[test]"

# Install Node.js dependencies
jlpm install
```

### Building

```bash
# Development build (fast, includes source maps)
jlpm run build

# Production build (minified, for release)
jlpm run build:prod

# Watch mode for development (auto-rebuild on changes)
jlpm run watch
```

### Testing

```bash
# Agent tool tests (edit_file, notebook_execute, etc.)
python tests/test_new_features.py

# Workspace tests (.llm-assistant directory, ASSISTANT.md, config.json)
python tests/test_v070_workspace.py

# Run both before pushing (must pass 0 failures)
python tests/test_new_features.py && python tests/test_v070_workspace.py
```

### Linting

```bash
# ESLint (TypeScript/React)
jlpm run eslint

# Check only
jlpm run eslint:check
```

### Installation Verification

```bash
# Install extension and verify registration
pip install -e .

# Verify frontend labextension
jupyter labextension list | grep llm-assistant
# Expected: jupyterlab-llm-assistant v0.x.x enabled OK

# Verify server extension
jupyter server extension list | grep llm-assistant
# Expected: jupyterlab_llm_assistant enabled OK
```

**Important**: Server extension must be enabled for API routes to work. If not enabled, manually create config:

```bash
# Create server extension config
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
```

### Building Python Package

```bash
# Clean old builds
rm -rf dist/

# Build wheel and sdist
python -m build

# Verify contents
ls -la dist/
```

## Key Patterns

### Adding New API Endpoints

1. Create handler class in appropriate module (or new module)
2. Import in `handlers.py` and add route in `setup_handlers()`
3. Add corresponding frontend API method in `src/services/api.ts`
4. All handlers should extend `APIHandler` and use `@web.authenticated`

### Agent Tool Development

Tools are defined in `agent_tools.py`:
- Tool schemas in `AGENT_TOOLS` list (OpenAI function format)
- Implementation as methods in `AgentToolExecutor` class
- All file operations are sandboxed to `root_dir` (Jupyter working directory)

### Frontend Component Structure

The v0.8.0 unified panel uses a single message stream:
- `ChatPanel.tsx` - Shell component managing all modes with unified message state
- `InputArea.tsx` - Unified text input with mode selector and @ file picker
- `UnifiedMessageList.tsx` - Renders all message types (chat/agent) in a single stream
- `ToolCallDisplay.tsx` - Visualizes agent tool calls in real-time

### Workspace Directory (`.llm-assistant/`)

Similar to `.claude/`, each project can have:
- `ASSISTANT.md` - Project instructions auto-injected into context
- `config.json` - Project-level LLM settings (override global)
- `sessions/` - Persisted conversation history
- `skills/` - Skill manifests (YAML files)

Managed entirely by `workspace_handler.py` with 9 REST endpoints.

## Pre-push Checklist

All items must pass before pushing:

1. **Backend tests**: `python tests/test_new_features.py` (0 failures)
2. **Workspace tests**: `python tests/test_v070_workspace.py` (0 failures)
3. **Frontend build**: `npm run build` (compiled with 0 errors, 1 highlight.js warning is expected)
4. **Extension registration**: `jupyter labextension list` shows `enabled OK`
5. **Server extension import**: `python -c "from jupyterlab_llm_assistant.serverextension import load_jupyter_server_extension"` must succeed

## Dependencies

### Runtime
- Python: `jupyterlab>=4.0.0`, `jupyter_server>=2.0.0`, `openai>=1.0.0`, `pydantic>=2.0.0`, `pyyaml>=6.0`, `tornado>=6.0`
- Node: `@jupyterlab/*^4.0.0`, `react^18.2.0`, `react-markdown^9.0.1`

### Development
- Python: `build`, `pytest`, `pytest-asyncio`, `coverage`
- Node: `typescript~5.2.0`, `eslint`, `css-loader`, `style-loader`

## Troubleshooting

### API 404 Errors (Not Found)

If frontend显示 "Failed to set config: Not Found" 或 API 测试返回 404:

```bash
# 1. 检查服务器扩展是否加载
jupyter server extension list | grep llm-assistant
# 应该显示: jupyterlab_llm_assistant enabled OK

# 2. 验证扩展能否正确导入
python -c "from jupyterlab_llm_assistant.serverextension import load_jupyter_server_extension; print('OK')"

# 3. 如果导入失败，检查依赖或导入错误
python -c "import jupyterlab_llm_assistant" 2>&1

# 4. 手动启用服务器扩展
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

# 5. 重启 JupyterLab
pkill -f "jupyter-lab"
jupyter lab
```

### Import Errors

后端导入错误（如 `ModuleNotFoundError`）会导致服务器扩展加载失败但 Jupyter 仍启动，表现为所有 API 404。常见原因:
- 代码中导入未使用的模块（如 `aiohttp`）但未在依赖中声明
- 循环导入问题

修复后必须重新安装:
```bash
pip install -e . --force-reinstall --no-deps
```

### Extension Loading Logs

启动时查看扩展加载状态:
```bash
jupyter lab 2>&1 | grep -i llm
# 期望看到:
# jupyterlab_llm_assistant | extension was successfully linked
# Loading JupyterLab LLM Assistant extension v0.x.x
# JupyterLab LLM Assistant extension loaded successfully
```
