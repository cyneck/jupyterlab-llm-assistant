/**
 * API service for communicating with the backend.
 */
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
        // Get base URL from JupyterLab's base URL
        const baseUrl = window.__jupyter_server_root_url || '';
        this.baseUrl = `${baseUrl}llm-assistant`;
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
}
//# sourceMappingURL=api.js.map