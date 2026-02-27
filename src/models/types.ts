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

/**
 * Chat message
 */
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

/**
 * Chat panel props
 */
export interface ChatPanelProps {
  settings: LLMSettings;
  onOpenSettings: () => void;
}

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