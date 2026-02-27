/**
 * Message list component.
 */

import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../models/types';
import { MessageItem } from './MessageItem';

export interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

/**
 * Message list component with auto-scroll
 */
export const MessageList: React.FC<MessageListProps> = ({ messages, isLoading }) => {
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Empty state
  if (messages.length === 0) {
    return (
      <div className="llm-message-list llm-message-list-empty">
        <div className="llm-empty-state">
          <div className="llm-empty-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
              <path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" />
            </svg>
          </div>
          <h3>LLM Coding Assistant</h3>
          <p>Start a conversation to get help with your code.</p>
          <ul className="llm-empty-hints">
            <li>Ask questions about code</li>
            <li>Debug issues</li>
            <li>Generate code snippets</li>
            <li>Explain concepts</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="llm-message-list" ref={listRef}>
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <div className="llm-loading-indicator">
          <div className="llm-loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;