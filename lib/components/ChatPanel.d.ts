/**
 * Main panel component — three modes in one unified shell.
 *
 * Mode selector (Chat | Agent | Plan) lives in the header.
 * Memory and Context-file panels are shared across all modes.
 *
 * v0.5.0 changes:
 * - Chat mode merged into this file (no longer a separate ChatPanel shell)
 * - Agent mode rendered via AgentPanel
 * - Plan mode rendered via PlanPanel (new)
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