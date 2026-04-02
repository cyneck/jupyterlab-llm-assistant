/**
 * ChatPanel — Unified message stream with mode-based handlers.
 *
 * New design (v0.8.0):
 * - Single unified message list (no mode switching panels)
 * - Chat/Agent are message HANDLERS, not separate panels
 * - Mode selector only controls how the NEXT message is processed
 * - All messages persist in one history (survives mode switches)
 */
import React from 'react';
import { LLMSettings } from '../models/types';
export interface ChatPanelProps {
    settings: LLMSettings;
    onOpenSettings: () => void;
    onSettingsChange?: (settings: Partial<LLMSettings>) => Promise<void>;
}
export declare const ChatPanel: React.FC<ChatPanelProps>;
export default ChatPanel;
//# sourceMappingURL=ChatPanel.d.ts.map