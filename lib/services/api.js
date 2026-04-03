/**
 * API service for communicating with the backend.
 */
import { PageConfig } from '@jupyterlab/coreutils';
/**
 * Get XSRF token from cookie
 */
function getXsrfToken() {
    const cookie = document.cookie
        .split(';')
        .find(c => c.trim().startsWith('_xsrf='));
    return cookie ? decodeURIComponent(cookie.split('=')[1]) : '';
}
/**
 * Get base headers for API requests
 */
function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-XSRFToken': getXsrfToken(),
    };
}
/**
 * LLM API Service
 */
export class LLMApiService {
    constructor() {
        // PageConfig.getOption('baseUrl') reads the raw 'baseUrl' value injected by
        // the Jupyter server into the page (e.g. "/" or "/jupyter/").
        // This is the server root, NOT the app UI route (which would include /lab/tree/).
        // Using getBaseUrl() or window.__jupyter_server_root_url can return wrong paths.
        const serverRoot = PageConfig.getOption('baseUrl') || '/';
        this.baseUrl = serverRoot.replace(/\/$/, '') + '/llm-assistant';
    }
    /**
     * Get current configuration
     */
    async getConfig() {
        const response = await fetch(`${this.baseUrl}/config`, {
            method: 'GET',
            headers: getHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Failed to get config: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Set configuration - sends partial settings directly (backend merges with current)
     */
    async setConfig(settings) {
        const response = await fetch(`${this.baseUrl}/config`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(settings),
        });
        if (!response.ok) {
            throw new Error(`Failed to set config: ${response.statusText}`);
        }
    }
    /**
     * Send a chat request (non-streaming)
     */
    async chat(messages, images, settings, signal) {
        const response = await fetch(`${this.baseUrl}/chat`, {
            method: 'POST',
            headers: getHeaders(),
            signal,
            body: JSON.stringify({
                messages,
                images,
                stream: false,
                ...settings && {
                    model: settings.model,
                    temperature: settings.temperature,
                    maxTokens: settings.maxTokens,
                },
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || `Request failed: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Send a streaming chat request
     */
    async streamChat(messages, images, onChunk, settings, signal) {
        const response = await fetch(`${this.baseUrl}/chat`, {
            method: 'POST',
            headers: getHeaders(),
            signal,
            body: JSON.stringify({
                messages,
                images,
                stream: true,
                ...settings && {
                    model: settings.model,
                    temperature: settings.temperature,
                    maxTokens: settings.maxTokens,
                },
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || `Request failed: ${response.statusText}`);
        }
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }
        const decoder = new TextDecoder();
        let buffer = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.error) {
                                throw new Error(parsed.error);
                            }
                            if (parsed.content) {
                                onChunk(parsed.content);
                            }
                        }
                        catch (e) {
                            // Skip invalid JSON
                            if (e instanceof SyntaxError) {
                                continue;
                            }
                            throw e;
                        }
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    /**
     * Test the API connection
     */
    async testConnection() {
        const response = await fetch(`${this.baseUrl}/test`, {
            method: 'GET',
            headers: getHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Test failed: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Get available models
     */
    async getModels() {
        const response = await fetch(`${this.baseUrl}/models`, {
            method: 'GET',
            headers: getHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Failed to get models: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Get available providers
     */
    async getProviders() {
        const response = await fetch(`${this.baseUrl}/providers`, {
            method: 'GET',
            headers: getHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Failed to get providers: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Run the coding agent with streaming SSE
     *
     * Events are streamed as: data: {"type": "...", "data": {...}}
     *
     * @param messages  Conversation history (user/assistant turns)
     * @param onEvent   Callback for each parsed SSE event
     * @param rootDir   Optional working directory for file tools
     */
    async runAgent(messages, onEvent, rootDir, settings, maxIterations, signal) {
        const response = await fetch(`${this.baseUrl}/agent`, {
            method: 'POST',
            headers: getHeaders(),
            signal,
            body: JSON.stringify({
                messages,
                rootDir,
                maxIterations: maxIterations ?? 50,
                ...settings && {
                    model: settings.model,
                    temperature: settings.temperature,
                    maxTokens: settings.maxTokens,
                },
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || `Agent request failed: ${response.statusText}`);
        }
        await this._readSSEStream(response, onEvent);
    }
    // ── Memory API ────────────────────────────────────────────────────────────
    /**
     * List all memory entries
     */
    async listMemories() {
        const r = await fetch(`${this.baseUrl}/memory`, { headers: getHeaders() });
        if (!r.ok)
            throw new Error(`Failed to list memories: ${r.statusText}`);
        const d = await r.json();
        return d.memories ?? [];
    }
    /**
     * Create a new memory entry
     */
    async createMemory(title, content, tags = []) {
        const r = await fetch(`${this.baseUrl}/memory`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ title, content, tags }),
        });
        if (!r.ok)
            throw new Error(`Failed to create memory: ${r.statusText}`);
        return r.json();
    }
    /**
     * Update an existing memory entry
     */
    async updateMemory(id, patch) {
        const r = await fetch(`${this.baseUrl}/memory/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(patch),
        });
        if (!r.ok)
            throw new Error(`Failed to update memory: ${r.statusText}`);
        return r.json();
    }
    /**
     * Delete a memory entry
     */
    async deleteMemory(id) {
        const r = await fetch(`${this.baseUrl}/memory/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!r.ok && r.status !== 204)
            throw new Error(`Failed to delete memory: ${r.statusText}`);
    }
    /**
     * Export enabled memories as formatted text
     */
    async exportMemories() {
        const r = await fetch(`${this.baseUrl}/memory/export`, { headers: getHeaders() });
        if (!r.ok)
            throw new Error(`Failed to export memories: ${r.statusText}`);
        return r.json();
    }
    // ── Context File API ──────────────────────────────────────────────────────
    /**
     * Resolve a path (file or directory) to a list of file paths
     */
    async resolveContextPath(path, rootDir = '') {
        const r = await fetch(`${this.baseUrl}/context/resolve`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path, rootDir }),
        });
        if (!r.ok)
            throw new Error(`Failed to resolve path: ${r.statusText}`);
        return r.json();
    }
    /**
     * List the immediate children of a directory (one level only).
     * Returns both files and subdirectories.
     */
    async listDirContents(dirPath, rootDir = '') {
        const r = await fetch(`${this.baseUrl}/context/listdir`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path: dirPath, rootDir }),
        });
        if (!r.ok) {
            // Fallback: use resolve which only returns files
            const fallback = await this.resolveContextPath(dirPath, rootDir);
            return {
                entries: fallback.paths.map(p => ({
                    name: p.split('/').pop() || p,
                    path: p,
                    isDir: false,
                })),
            };
        }
        return r.json();
    }
    /**
     * Read one or more files and return their contents
     */
    async readContextFiles(paths, rootDir = '') {
        const r = await fetch(`${this.baseUrl}/context/read`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ paths, rootDir }),
        });
        if (!r.ok)
            throw new Error(`Failed to read context files: ${r.statusText}`);
        return r.json();
    }
    // ── Workspace (.llm-assistant directory) API ─────────────────────────────
    /** Get workspace info for the current project */
    async getWorkspaceInfo(rootDir = '') {
        const params = rootDir ? `?rootDir=${encodeURIComponent(rootDir)}` : '';
        const r = await fetch(`${this.baseUrl}/workspace/info${params}`, {
            headers: getHeaders(),
        });
        if (!r.ok)
            throw new Error(`Failed to get workspace info: ${r.statusText}`);
        return r.json();
    }
    /** Get ASSISTANT.md content */
    async getAssistantMd(rootDir = '') {
        const params = rootDir ? `?rootDir=${encodeURIComponent(rootDir)}` : '';
        const r = await fetch(`${this.baseUrl}/workspace/assistant-md${params}`, {
            headers: getHeaders(),
        });
        if (!r.ok)
            throw new Error(`Failed to get ASSISTANT.md: ${r.statusText}`);
        return r.json();
    }
    /** Save ASSISTANT.md content */
    async saveAssistantMd(content, rootDir = '') {
        const r = await fetch(`${this.baseUrl}/workspace/assistant-md`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ content, rootDir }),
        });
        if (!r.ok)
            throw new Error(`Failed to save ASSISTANT.md: ${r.statusText}`);
    }
    /** Get workspace config (per-project settings in .llm-assistant/config.json) */
    async getWorkspaceConfig(rootDir = '') {
        const params = rootDir ? `?rootDir=${encodeURIComponent(rootDir)}` : '';
        const r = await fetch(`${this.baseUrl}/workspace/config${params}`, {
            headers: getHeaders(),
        });
        if (!r.ok)
            throw new Error(`Failed to get workspace config: ${r.statusText}`);
        return r.json();
    }
    /** List saved sessions */
    async listSessions(rootDir = '') {
        const params = rootDir ? `?rootDir=${encodeURIComponent(rootDir)}` : '';
        const r = await fetch(`${this.baseUrl}/workspace/sessions${params}`, {
            headers: getHeaders(),
        });
        if (!r.ok)
            throw new Error(`Failed to list sessions: ${r.statusText}`);
        const d = await r.json();
        return d.sessions ?? [];
    }
    /** Save a session */
    async saveSession(session) {
        const r = await fetch(`${this.baseUrl}/workspace/sessions`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(session),
        });
        if (!r.ok)
            throw new Error(`Failed to save session: ${r.statusText}`);
        return r.json();
    }
    /** Load a specific session */
    async loadSession(id, rootDir = '') {
        const params = rootDir ? `?rootDir=${encodeURIComponent(rootDir)}` : '';
        const r = await fetch(`${this.baseUrl}/workspace/sessions/${encodeURIComponent(id)}${params}`, { headers: getHeaders() });
        if (!r.ok)
            throw new Error(`Failed to load session: ${r.statusText}`);
        return r.json();
    }
    /** Delete a session */
    async deleteSession(id, rootDir = '') {
        const params = rootDir ? `?rootDir=${encodeURIComponent(rootDir)}` : '';
        const r = await fetch(`${this.baseUrl}/workspace/sessions/${encodeURIComponent(id)}${params}`, { method: 'DELETE', headers: getHeaders() });
        if (!r.ok && r.status !== 404)
            throw new Error(`Failed to delete session: ${r.statusText}`);
    }
    /** List installed skills */
    async listSkills(rootDir = '') {
        const params = rootDir ? `?rootDir=${encodeURIComponent(rootDir)}` : '';
        const r = await fetch(`${this.baseUrl}/workspace/skills${params}`, {
            headers: getHeaders(),
        });
        if (!r.ok)
            throw new Error(`Failed to list skills: ${r.statusText}`);
        const d = await r.json();
        return d.skills ?? [];
    }
    /** Install a skill from manifest */
    async installSkill(name, manifest, rootDir = '') {
        const r = await fetch(`${this.baseUrl}/workspace/skills/install`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name, manifest, rootDir }),
        });
        if (!r.ok)
            throw new Error(`Failed to install skill: ${r.statusText}`);
        return r.json();
    }
    /** Update a skill (enable/disable/system_prompt) */
    async updateSkill(name, patch, rootDir = '') {
        const params = rootDir ? `?rootDir=${encodeURIComponent(rootDir)}` : '';
        const r = await fetch(`${this.baseUrl}/workspace/skills/${encodeURIComponent(name)}${params}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(patch),
        });
        if (!r.ok)
            throw new Error(`Failed to update skill: ${r.statusText}`);
        return r.json();
    }
    /** Delete a skill */
    async deleteSkill(name, rootDir = '') {
        const params = rootDir ? `?rootDir=${encodeURIComponent(rootDir)}` : '';
        const r = await fetch(`${this.baseUrl}/workspace/skills/${encodeURIComponent(name)}${params}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!r.ok && r.status !== 404)
            throw new Error(`Failed to delete skill: ${r.statusText}`);
    }
    // ── Skill Registry (Marketplace) API ───────────────────────────────────
    /** List available skill registries/marketplaces */
    async listRegistries() {
        const r = await fetch(`${this.baseUrl}/workspace/registries`, {
            headers: getHeaders(),
        });
        if (!r.ok)
            throw new Error(`Failed to list registries: ${r.statusText}`);
        const d = await r.json();
        return d.registries ?? [];
    }
    /** Get skills from a specific registry */
    async getRegistrySkills(registryId, refresh = false) {
        const params = refresh ? '?refresh=true' : '';
        const r = await fetch(`${this.baseUrl}/workspace/registries/${encodeURIComponent(registryId)}${params}`, { headers: getHeaders() });
        if (!r.ok)
            throw new Error(`Failed to get registry skills: ${r.statusText}`);
        return r.json();
    }
    /** Install a skill from a GitHub URL or raw manifest URL */
    async installSkillFromUrl(name, url, rootDir = '') {
        // Fetch the raw content from the URL
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch skill manifest from URL: ${response.statusText}`);
        }
        const content = await response.text();
        // Parse as YAML (simple regex-based extraction)
        // In a real implementation, you'd use a YAML parser
        const manifest = {};
        const lines = content.split('\n');
        let inSystemPrompt = false;
        let systemPromptLines = [];
        for (const line of lines) {
            if (inSystemPrompt) {
                if (line.startsWith('    ') || line.startsWith('\t')) {
                    systemPromptLines.push(line);
                }
                else if (line.trim() === '') {
                    inSystemPrompt = false;
                    manifest['system_prompt'] = systemPromptLines.join('\n').trim();
                }
                else {
                    inSystemPrompt = false;
                }
            }
            if (line.startsWith('name:')) {
                manifest['name'] = line.substring(4).trim().replace(/^["']|["']$/g, '');
            }
            else if (line.startsWith('version:')) {
                manifest['version'] = line.substring(8).trim().replace(/^["']|["']$/g, '');
            }
            else if (line.startsWith('description:')) {
                manifest['description'] = line.substring(12).trim().replace(/^["']|["']$/g, '');
            }
            else if (line.startsWith('author:')) {
                manifest['author'] = line.substring(7).trim().replace(/^["']|["']$/g, '');
            }
            else if (line.startsWith('system_prompt:')) {
                const rest = line.substring(14).trim();
                if (rest === '|' || rest === '>' || rest === '|-' || rest === '>-') {
                    inSystemPrompt = true;
                    systemPromptLines = [];
                }
                else {
                    manifest['system_prompt'] = rest.replace(/^["']|["']$/g, '');
                }
            }
            else if (line.startsWith('enabled:')) {
                manifest['enabled'] = line.substring(8).trim().toLowerCase() === 'true';
            }
        }
        manifest['enabled'] = manifest['enabled'] !== false;
        return this.installSkill(name, manifest, rootDir);
    }
    // ── Internal SSE stream reader ────────────────────────────────────────────
    /** Internal SSE stream reader */
    async _readSSEStream(response, onEvent) {
        const reader = response.body?.getReader();
        if (!reader)
            throw new Error('No response body');
        const decoder = new TextDecoder();
        let buffer = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const raw = line.slice(6).trim();
                        if (raw === '[DONE]')
                            return;
                        try {
                            onEvent(JSON.parse(raw));
                        }
                        catch { /* skip malformed */ }
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
}
//# sourceMappingURL=api.js.map