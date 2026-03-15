/**
 * ChatPanel — Unified shell for Chat / Agent / Plan modes.
 *
 * v0.7.0 redesign:
 * - All three modes share a SINGLE unified context: the InputArea at the
 *   bottom is always visible regardless of mode.  Switching mode just changes
 *   the message-display viewport above — no page navigation required.
 * - ContextFilePanel removed; file/dir references are handled inline via the
 *   @ mention picker and path chips in InputArea.
 * - Attached paths (from @ picker) are forwarded to the active mode handler
 *   which reads the file contents before sending to the LLM.
 * - .llm-assistant workspace directory support added (session history,
 *   ASSISTANT.md, per-project config, future skill loading).
 */
import React from 'react';
import { LLMSettings } from '../models/types';
export type AppMode = 'chat' | 'agent' | 'plan';
export interface ChatPanelProps {
    settings: LLMSettings;
    onOpenSettings: () => void;
}
export declare const ChatPanel: React.FC<ChatPanelProps>;
export default ChatPanel;
//# sourceMappingURL=ChatPanel.d.ts.map