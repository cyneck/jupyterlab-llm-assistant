/**
 * Chat model for managing chat state.
 */
import { Signal } from '@lumino/signaling';
import { LLMApiService } from '../services/api';
/**
 * Generate a unique ID
 */
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Chat model class
 */
export class ChatModel {
    constructor(settings) {
        this._messages = [];
        this._isLoading = false;
        this._error = null;
        /**
         * Signal emitted when messages change
         */
        this.messagesChanged = new Signal(this);
        /**
         * Signal emitted when loading state changes
         */
        this.loadingChanged = new Signal(this);
        /**
         * Signal emitted when error changes
         */
        this.errorChanged = new Signal(this);
        this._settings = settings;
        this._apiService = new LLMApiService();
    }
    /**
     * Get all messages
     */
    get messages() {
        return this._messages;
    }
    /**
     * Get loading state
     */
    get isLoading() {
        return this._isLoading;
    }
    /**
     * Get current error
     */
    get error() {
        return this._error;
    }
    /**
     * Get current settings
     */
    get settings() {
        return this._settings;
    }
    /**
     * Update settings
     */
    updateSettings(settings) {
        this._settings = { ...this._settings, ...settings };
    }
    /**
     * Add a user message
     */
    addUserMessage(text, images) {
        const message = {
            id: generateId(),
            role: 'user',
            content: text,
            timestamp: Date.now(),
        };
        this._messages = [...this._messages, message];
        this.messagesChanged.emit(this._messages);
        // Process images if provided and vision is enabled
        if (images && images.length > 0 && this._settings.enableVision) {
            // Images will be sent separately to the API
            // For now, just store the text message
        }
        return message;
    }
    /**
     * Add an assistant message
     */
    addAssistantMessage(content = '', isStreaming = false) {
        const message = {
            id: generateId(),
            role: 'assistant',
            content,
            timestamp: Date.now(),
            isStreaming,
        };
        this._messages = [...this._messages, message];
        this.messagesChanged.emit(this._messages);
        return message;
    }
    /**
     * Update an existing message
     */
    updateMessage(id, updates) {
        this._messages = this._messages.map(msg => msg.id === id ? { ...msg, ...updates } : msg);
        this.messagesChanged.emit(this._messages);
    }
    /**
     * Append content to the last assistant message
     */
    appendToLastAssistant(content) {
        const messages = [...this._messages];
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
                const currentContent = messages[i].content;
                messages[i] = {
                    ...messages[i],
                    content: typeof currentContent === 'string'
                        ? currentContent + content
                        : currentContent,
                };
                break;
            }
        }
        this._messages = messages;
        this.messagesChanged.emit(this._messages);
    }
    /**
     * Set loading state
     */
    setLoading(loading) {
        this._isLoading = loading;
        this.loadingChanged.emit(loading);
    }
    /**
     * Set error
     */
    setError(error) {
        this._error = error;
        this.errorChanged.emit(error);
    }
    /**
     * Clear all messages
     */
    clearMessages() {
        this._messages = [];
        this._error = null;
        this.messagesChanged.emit(this._messages);
        this.errorChanged.emit(null);
    }
    /**
     * Send a message and get a response
     */
    async sendMessage(text, images = []) {
        // Add user message
        this.addUserMessage(text, images);
        // Set loading state
        this.setLoading(true);
        this.setError(null);
        // Prepare messages for API
        const apiMessages = this._messages
            .filter(msg => msg.role !== 'system')
            .map(msg => ({
            role: msg.role,
            content: msg.content,
        }));
        // Extract image data URLs
        const imageDataUrls = images.map(img => img.dataUrl);
        try {
            if (this._settings.enableStreaming) {
                // Create assistant message placeholder
                const assistantMsg = this.addAssistantMessage('', true);
                // Stream response
                await this._apiService.streamChat(apiMessages, imageDataUrls.length > 0 ? imageDataUrls : undefined, (chunk) => {
                    this.appendToLastAssistant(chunk);
                }, this._settings);
                // Mark streaming complete
                this.updateMessage(assistantMsg.id, { isStreaming: false });
            }
            else {
                // Non-streaming response
                const response = await this._apiService.chat(apiMessages, imageDataUrls.length > 0 ? imageDataUrls : undefined, this._settings);
                this.addAssistantMessage(response.content);
            }
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            this.setError(errorMessage);
            // Add error message
            this.addAssistantMessage(`Error: ${errorMessage}`);
            this.updateMessage(this._messages[this._messages.length - 1].id, {
                error: errorMessage
            });
        }
        finally {
            this.setLoading(false);
        }
    }
    /**
     * Clear chat history
     */
    clear() {
        this.clearMessages();
    }
}
//# sourceMappingURL=chat.js.map