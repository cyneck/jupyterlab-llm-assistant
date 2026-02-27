/**
 * Message item component.
 */

import React, { useMemo } from 'react';
import { ChatMessage } from '../models/types';
import { MarkdownRenderer } from './MarkdownRenderer';

export interface MessageItemProps {
  message: ChatMessage;
}

/**
 * Format timestamp to readable string
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Message item component
 */
export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isStreaming = message.isStreaming;

  // Parse message content
  const textContent = useMemo(() => {
    if (typeof message.content === 'string') {
      return message.content;
    }
    // Handle array content (text + images)
    const textParts = message.content.filter(
      (part) => part.type === 'text'
    ) as Array<{ type: 'text'; text: string }>;
    return textParts.map((part) => part.text).join('');
  }, [message.content]);

  // Extract images from content
  const images = useMemo(() => {
    if (typeof message.content === 'string') {
      return [];
    }
    return message.content.filter(
      (part) => part.type === 'image_url'
    ) as Array<{ type: 'image_url'; image_url: { url: string } }>;
  }, [message.content]);

  return (
    <div className={`llm-message-item llm-message-${message.role}`}>
      {/* Avatar */}
      <div className="llm-message-avatar">
        {isUser ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
            <path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" />
          </svg>
        )}
      </div>

      {/* Content */}
      <div className="llm-message-content">
        {/* Images (for user messages) */}
        {images.length > 0 && (
          <div className="llm-message-images">
            {images.map((img, index) => (
              <img
                key={index}
                src={img.image_url.url}
                alt={`Attached image ${index + 1}`}
                className="llm-message-image"
              />
            ))}
          </div>
        )}

        {/* Text content */}
        {isAssistant ? (
          <div className="llm-message-text">
            {textContent ? (
              <MarkdownRenderer content={textContent} />
            ) : (
              <span className="llm-message-placeholder">
                {isStreaming ? '...' : 'Empty response'}
              </span>
            )}
          </div>
        ) : (
          <div className="llm-message-text llm-message-user-text">
            {textContent}
          </div>
        )}

        {/* Timestamp */}
        <div className="llm-message-meta">
          <span className="llm-message-time">
            {formatTimestamp(message.timestamp)}
          </span>
          {isStreaming && (
            <span className="llm-message-streaming">
              <span className="llm-streaming-dot"></span>
              <span className="llm-streaming-dot"></span>
              <span className="llm-streaming-dot"></span>
            </span>
          )}
          {message.error && (
            <span className="llm-message-error">{message.error}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;