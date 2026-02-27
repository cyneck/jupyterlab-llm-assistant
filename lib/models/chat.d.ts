/**
 * Chat model for managing chat state.
 */
import { Signal } from '@lumino/signaling';
import { ChatMessage, LLMSettings, ImageData } from './types';
/**
 * Chat model class
 */
export declare class ChatModel {
    private _messages;
    private _isLoading;
    private _error;
    private _settings;
    private _apiService;
    /**
     * Signal emitted when messages change
     */
    readonly messagesChanged: Signal<this, ChatMessage[]>;
    /**
     * Signal emitted when loading state changes
     */
    readonly loadingChanged: Signal<this, boolean>;
    /**
     * Signal emitted when error changes
     */
    readonly errorChanged: Signal<this, string | null>;
    constructor(settings: LLMSettings);
    /**
     * Get all messages
     */
    get messages(): ChatMessage[];
    /**
     * Get loading state
     */
    get isLoading(): boolean;
    /**
     * Get current error
     */
    get error(): string | null;
    /**
     * Get current settings
     */
    get settings(): LLMSettings;
    /**
     * Update settings
     */
    updateSettings(settings: Partial<LLMSettings>): void;
    /**
     * Add a user message
     */
    addUserMessage(text: string, images?: ImageData[]): ChatMessage;
    /**
     * Add an assistant message
     */
    addAssistantMessage(content?: string, isStreaming?: boolean): ChatMessage;
    /**
     * Update an existing message
     */
    updateMessage(id: string, updates: Partial<ChatMessage>): void;
    /**
     * Append content to the last assistant message
     */
    appendToLastAssistant(content: string): void;
    /**
     * Set loading state
     */
    setLoading(loading: boolean): void;
    /**
     * Set error
     */
    setError(error: string | null): void;
    /**
     * Clear all messages
     */
    clearMessages(): void;
    /**
     * Send a message and get a response
     */
    sendMessage(text: string, images?: ImageData[]): Promise<void>;
    /**
     * Clear chat history
     */
    clear(): void;
}
//# sourceMappingURL=chat.d.ts.map