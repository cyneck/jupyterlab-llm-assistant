/**
 * API service for communicating with the backend.
 */
import { LLMSettings, ChatResponse, ConnectionTestResult, ModelsResponse, MessageRole, MessageContent, MemoryEntry, ContextFile, PlanStep } from '../models/types';
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
    /**
     * Run the coding agent with streaming SSE
     *
     * Events are streamed as: data: {"type": "...", "data": {...}}
     *
     * @param messages  Conversation history (user/assistant turns)
     * @param onEvent   Callback for each parsed SSE event
     * @param rootDir   Optional working directory for file tools
     */
    runAgent(messages: Array<{
        role: string;
        content: string;
    }>, onEvent: (event: {
        type: string;
        data: any;
    }) => void, rootDir?: string, settings?: LLMSettings, maxIterations?: number, signal?: AbortSignal): Promise<void>;
    /**
     * List all memory entries
     */
    listMemories(): Promise<MemoryEntry[]>;
    /**
     * Create a new memory entry
     */
    createMemory(title: string, content: string, tags?: string[]): Promise<MemoryEntry>;
    /**
     * Update an existing memory entry
     */
    updateMemory(id: string, patch: Partial<Pick<MemoryEntry, 'title' | 'content' | 'tags' | 'enabled'>>): Promise<MemoryEntry>;
    /**
     * Delete a memory entry
     */
    deleteMemory(id: string): Promise<void>;
    /**
     * Export enabled memories as formatted text
     */
    exportMemories(): Promise<{
        text: string;
        count: number;
    }>;
    /**
     * Resolve a path (file or directory) to a list of file paths
     */
    resolveContextPath(path: string, rootDir?: string): Promise<{
        paths: string[];
        isDir: boolean;
        totalFound: number;
    }>;
    /**
     * Read one or more files and return their contents
     */
    readContextFiles(paths: string[], rootDir?: string): Promise<{
        files: ContextFile[];
        totalChars: number;
        truncated: boolean;
    }>;
    /**
     * Generate a plan for a task (SSE streaming)
     */
    generatePlan(task: string, onEvent: (event: {
        type: string;
        data: any;
    }) => void, contextText?: string, signal?: AbortSignal): Promise<void>;
    /**
     * Execute one plan step through the agent loop (SSE streaming)
     */
    executePlanStep(step: PlanStep, history: Array<{
        role: string;
        content: string;
    }>, onEvent: (event: {
        type: string;
        data: any;
    }) => void, rootDir?: string, contextText?: string, settings?: LLMSettings, signal?: AbortSignal): Promise<void>;
    /** Internal SSE stream reader */
    private _readSSEStream;
}
//# sourceMappingURL=api.d.ts.map