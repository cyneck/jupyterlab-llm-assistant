/**
 * Main panel component — three modes in one unified shell.
 *
 * Mode selector (Chat | Agent | Plan) lives in the **InputArea** footer
 * dropdown, keeping the header clean for utility buttons.
 * Memory and Context-file panels are shared across all modes.
 *
 * v0.6.0 changes:
 * - Moved mode selector from header buttons → InputArea dropdown
 * - InputArea now owns mode + onModeChange props
 * - @ file-reference support in InputArea
 * - Skill system TODO added (see bottom of file)
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