/**
 * API service for communicating with the backend.
 */
import { LLMSettings, ChatResponse, ConnectionTestResult, ModelsResponse, MessageRole, MessageContent } from '../models/types';
/**
 * LLM API Service
 */
export declare class LLMApiService {
    private baseUrl;
    constructor();
    /**
     * Get current configuration
     */
    getConfig(): Promise<LLMSettings>;
    /**
     * Set configuration
     */
    setConfig(settings: Partial<LLMSettings>): Promise<void>;
    /**
     * Send a chat request (non-streaming)
     */
    chat(messages: Array<{
        role: MessageRole;
        content: MessageContent;
    }>, images?: string[], settings?: LLMSettings): Promise<ChatResponse>;
    /**
     * Send a streaming chat request
     */
    streamChat(messages: Array<{
        role: MessageRole;
        content: MessageContent;
    }>, images: string[] | undefined, onChunk: (chunk: string) => void, settings?: LLMSettings): Promise<void>;
    /**
     * Test the API connection
     */
    testConnection(): Promise<ConnectionTestResult>;
    /**
     * Get available models
     */
    getModels(): Promise<ModelsResponse>;
}
//# sourceMappingURL=api.d.ts.map