/**
 * Type definitions for the LLM Assistant extension.
 */

/**
 * Message role type
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * Text content part
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Image content part
 */
export interface ImageContent {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

/**
 * Message content can be a string or an array of content parts
 */
export type MessageContent = string | (TextContent | ImageContent)[];

// ============================================================
// Unified message types (new design: modes are handlers, not panels)
// ============================================================

export type MessageMode = 'chat' | 'agent' | 'plan';

/**
 * Tool call entry embedded in a message
 */
export interface MessageToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: {
    success: boolean;
    output: string;
  };
  startTime?: number;
  endTime?: number;
}

/**
 * Plan step embedded in a message
 */
export interface MessagePlanStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
}

/**
 * Unified message type - all modes share the same message list
 */
export interface UnifiedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  mode: MessageMode;  // Which mode/handler was used
  timestamp: number;
  isStreaming?: boolean;
  error?: string;
  // Agent-specific fields
  toolCalls?: MessageToolCall[];
  iteration?: { current: number; max: number };
  // Plan-specific fields
  planSteps?: MessagePlanStep[];
  // Images for user messages
  images?: ImageData[];
}

// Legacy types kept for backwards compatibility
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: MessageContent;
  timestamp: number;
  isStreaming?: boolean;
  error?: string;
}

/**
 * User message with potential images
 */
export interface UserMessage extends ChatMessage {
  role: 'user';
}

/**
 * Assistant message
 */
export interface AssistantMessage extends ChatMessage {
  role: 'assistant';
}

/**
 * LLM settings
 */
export interface LLMSettings {
  apiEndpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  enableStreaming: boolean;
  enableVision: boolean;
  hasApiKey?: boolean;
}

/**
 * API request body for chat
 */
export interface ChatRequest {
  messages: Array<{
    role: MessageRole;
    content: MessageContent;
  }>;
  images?: string[];
  stream?: boolean;
}

/**
 * API response for non-streaming chat
 */
export interface ChatResponse {
  content: string;
}

/**
 * SSE event data
 */
export interface SSEventData {
  content?: string;
  error?: string;
}

/**
 * Model info
 */
export interface ModelInfo {
  id: string;
  owned_by: string;
}

/**
 * Models list response
 */
export interface ModelsResponse {
  models: ModelInfo[];
  error?: string;
}

/**
 * Connection test result
 */
export interface ConnectionTestResult {
  success: boolean;
  model?: string;
  response?: string;
  error?: string;
}

/**
 * Image file data
 */
export interface ImageData {
  id: string;
  dataUrl: string;
  file: File;
  preview?: string;
}

/**
 * Chat state
 */
export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Settings panel props
 */
export interface SettingsPanelProps {
  settings: LLMSettings;
  onSettingsChange: (settings: Partial<LLMSettings>) => void;
  onClose: () => void;
  onTestConnection: () => Promise<ConnectionTestResult>;
  isTestingConnection: boolean;
}

// NOTE: ChatPanelProps is defined in ChatPanel.tsx where it is used;
// the copy that was here has been removed to avoid duplication.

/**
 * Message list props
 */
export interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

/**
 * Message item props
 */
export interface MessageItemProps {
  message: ChatMessage;
}

/**
 * Input area props
 */
export interface InputAreaProps {
  onSend: (text: string, images: ImageData[]) => void;
  disabled: boolean;
  enableVision: boolean;
}

/**
 * Markdown renderer props
 */
export interface MarkdownRendererProps {
  content: string;
}

/**
 * Code block props
 */
export interface CodeBlockProps {
  code: string;
  language: string;
}

// ============================================================
// Agent types
// ============================================================

/**
 * Agent tool call event from SSE
 */
export interface AgentToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

/**
 * Agent tool result event from SSE
 */
export interface AgentToolResult {
  id: string;
  name: string;
  success: boolean;
  output: string;
}

/**
 * Agent SSE event types
 */
export type AgentEventType =
  | 'text'
  | 'tool_call'
  | 'tool_result'
  | 'iteration'
  | 'done'
  | 'error';

/**
 * Agent SSE event payload
 */
export interface AgentEvent {
  type: AgentEventType;
  data: any;
}

/**
 * Tool call display state (for UI — tracks call + result together)
 */
export interface ToolCallEntry {
  id: string;
  name: string;
  args: Record<string, any>;
  result?: AgentToolResult;
  status: 'pending' | 'running' | 'success' | 'error';
  startTime: number;
  endTime?: number;
}

/**
 * Agent message types for the chat UI
 */
export type AgentMessageType = 'user' | 'agent_text' | 'tool_call' | 'system';

/**
 * An entry in the Agent conversation display
 */
export interface AgentDisplayMessage {
  id: string;
  type: AgentMessageType;
  content?: string;
  toolCall?: ToolCallEntry;
  timestamp: number;
  isStreaming?: boolean;
  iteration?: number;
}

/**
 * Agent panel props
 */
export interface AgentPanelProps {
  settings: LLMSettings;
  /** Formatted context string (file contents) to prepend to every message */
  contextText?: string;
  /** Number of selected context files (for display) */
  contextFileCount?: number;
}

// ============================================================
// Memory types
// ============================================================

/**
 * A persistent memory entry
 */
export interface MemoryEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

// ============================================================
// Context file types
// ============================================================

/**
 * A file included as context
 */
export interface ContextFile {
  path: string;
  content: string | null;
  lines: number;
  size: number;
  error: string | null;
}

/**
 * Active context state
 */
export interface ContextState {
  selectedPaths: string[];
  rootDir: string;
}

// ============================================================
// Plan mode types
// ============================================================

export type PlanStepStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

/**
 * A single step in an AI-generated plan
 */
export interface PlanStep {
  id: number;
  title: string;
  description: string;
  status: PlanStepStatus;
}