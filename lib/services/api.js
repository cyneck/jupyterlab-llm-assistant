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
     * Set configuration
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
    async chat(messages, images, settings) {
        const response = await fetch(`${this.baseUrl}/chat`, {
            method: 'POST',
            headers: getHeaders(),
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
    async streamChat(messages, images, onChunk, settings) {
        const response = await fetch(`${this.baseUrl}/chat`, {
            method: 'POST',
            headers: getHeaders(),
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
                maxIterations: maxIterations ?? 20,
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
    // ── Plan API ──────────────────────────────────────────────────────────────
    /**
     * Generate a plan for a task (SSE streaming)
     */
    async generatePlan(task, onEvent, contextText, signal) {
        const response = await fetch(`${this.baseUrl}/plan/generate`, {
            method: 'POST',
            headers: getHeaders(),
            signal,
            body: JSON.stringify({ task, contextText }),
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(err.error || `Plan generation failed: ${response.statusText}`);
        }
        await this._readSSEStream(response, onEvent);
    }
    /**
     * Execute one plan step through the agent loop (SSE streaming)
     */
    async executePlanStep(step, history, onEvent, rootDir, contextText, settings, signal) {
        const response = await fetch(`${this.baseUrl}/plan/execute`, {
            method: 'POST',
            headers: getHeaders(),
            signal,
            body: JSON.stringify({
                step,
                history,
                rootDir,
                contextText,
                maxIterations: 15,
                ...settings && {
                    model: settings.model,
                    temperature: settings.temperature,
                    maxTokens: settings.maxTokens,
                },
            }),
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(err.error || `Plan execution failed: ${response.statusText}`);
        }
        await this._readSSEStream(response, onEvent);
    }
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