/**
 * Main chat panel component.
 */
import React from 'react';
import { LLMSettings } from '../models/types';
export interface ChatPanelProps {
    settings: LLMSettings;
    onOpenSettings: () => void;
}
/**
 * Main chat panel component
 */
export declare const ChatPanel: React.FC<ChatPanelProps>;
export default ChatPanel;
//# sourceMappingURL=ChatPanel.d.ts.map