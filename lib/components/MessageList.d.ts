/**
 * Message list component.
 */
import React from 'react';
import { ChatMessage } from '../models/types';
export interface MessageListProps {
    messages: ChatMessage[];
    isLoading: boolean;
}
/**
 * Message list component with auto-scroll
 */
export declare const MessageList: React.FC<MessageListProps>;
export default MessageList;
//# sourceMappingURL=MessageList.d.ts.map