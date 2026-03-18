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
    }>, images?: string[], settings?: LLMSettings, signal?: AbortSignal): Promise<ChatResponse>;
    /**
     * Send a streaming chat request
     */
    streamChat(messages: Array<{
        role: MessageRole;
        content: MessageContent;
    }>, images: string[] | undefined, onChunk: (chunk: string) => void, settings?: LLMSettings, signal?: AbortSignal): Promise<void>;
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
     * List the immediate children of a directory (one level only).
     * Returns both files and subdirectories.
     */
    listDirContents(dirPath: string, rootDir?: string): Promise<{
        entries: Array<{
            name: string;
            path: string;
            isDir: boolean;
        }>;
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
    }) => void, contextText?: string, settings?: LLMSettings, signal?: AbortSignal): Promise<void>;
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
    /** Get workspace info for the current project */
    getWorkspaceInfo(rootDir?: string): Promise<{
        rootDir: string;
        workspaceDir: string;
        hasAssistantMd: boolean;
        sessionCount: number;
        skillCount: number;
        exists: boolean;
    }>;
    /** Get ASSISTANT.md content */
    getAssistantMd(rootDir?: string): Promise<{
        content: string;
        path: string;
        exists: boolean;
        defaultContent: string;
    }>;
    /** Save ASSISTANT.md content */
    saveAssistantMd(content: string, rootDir?: string): Promise<void>;
    /** Get workspace config (per-project settings in .llm-assistant/config.json) */
    getWorkspaceConfig(rootDir?: string): Promise<{
        config: Record<string, any>;
        path: string;
    }>;
    /** Save workspace config (per-project settings in .llm-assistant/config.json) */
    setWorkspaceConfig(config: Record<string, any>, rootDir?: string): Promise<void>;
    /** List saved sessions */
    listSessions(rootDir?: string): Promise<Array<{
        id: string;
        summary: string;
        savedAt: number;
        mode: string;
        messageCount: number;
    }>>;
    /** Save a session */
    saveSession(session: {
        id?: string;
        summary: string;
        mode: string;
        messages: any[];
        history: any[];
        rootDir?: string;
    }): Promise<{
        id: string;
    }>;
    /** Load a specific session */
    loadSession(id: string, rootDir?: string): Promise<{
        id: string;
        summary: string;
        mode: string;
        messages: any[];
        history: any[];
        savedAt: number;
    }>;
    /** Delete a session */
    deleteSession(id: string, rootDir?: string): Promise<void>;
    /** List installed skills */
    listSkills(rootDir?: string): Promise<Array<{
        name: string;
        description: string;
        version: string;
        enabled: boolean;
        type: string;
    }>>;
    /** Internal SSE stream reader */
    private _readSSEStream;
}
//# sourceMappingURL=api.d.ts.map