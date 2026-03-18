/**
 * UnifiedMessageList — Renders all messages in a unified stream.
 *
 * Message types:
 * - chat: Simple text + images
 * - agent: Text with inline tool call visualization + iteration indicator
 */

import React, { useRef, useEffect } from 'react';
import { UnifiedMessage, MessageToolCall } from '../models/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallDisplay } from './ToolCallDisplay';

export interface UnifiedMessageListProps {
  messages: UnifiedMessage[];
  isLoading: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Message Content Renderers ────────────────────────────────────────────────

interface ChatMessageContentProps {
  message: UnifiedMessage;
}

const ChatMessageContent: React.FC<ChatMessageContentProps> = ({ message }) => {
  const isStreaming = message.isStreaming;

  return (
    <div className="llm-message-text">
      {message.content ? (
        <MarkdownRenderer content={message.content} />
      ) : (
        <span className="llm-message-placeholder">
          {isStreaming ? '...' : 'Empty response'}
        </span>
      )}
    </div>
  );
};

interface AgentMessageContentProps {
  message: UnifiedMessage;
}

const AgentMessageContent: React.FC<AgentMessageContentProps> = ({ message }) => {
  return (
    <div className="llm-message-agent-content">
      {/* Main text content */}
      {message.content && (
        <div className="llm-message-text">
          <MarkdownRenderer content={message.content} />
        </div>
      )}

      {/* Tool calls */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="llm-message-tool-calls">
          {message.toolCalls.map((toolCall) => (
            <ToolCallDisplay
              key={toolCall.id}
              entry={{
                id: toolCall.id,
                name: toolCall.name,
                args: toolCall.args,
                status: toolCall.status,
                result: toolCall.result ? {
                  id: toolCall.id,
                  name: toolCall.name,
                  success: toolCall.result.success,
                  output: toolCall.result.output,
                } : undefined,
                startTime: toolCall.startTime || Date.now(),
                endTime: toolCall.endTime,
              }}
            />
          ))}
        </div>
      )}

      {/* Iteration indicator */}
      {message.iteration && (
        <div className="llm-message-iteration">
          <span className={`llm-iteration-badge ${message.isStreaming ? 'llm-iteration-active' : 'llm-iteration-complete'}`}>
            {message.isStreaming ? (
              <>Thinking... ({message.iteration.current}/{message.iteration.max})</>
            ) : (
              <>Completed in {message.iteration.current} iterations</>
            )}
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Unified Message Item ─────────────────────────────────────────────────────

interface UnifiedMessageItemProps {
  message: UnifiedMessage;
}

const UnifiedMessageItem: React.FC<UnifiedMessageItemProps> = ({
  message,
}) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // Mode badge for assistant messages
  const ModeBadge = () => {
    if (isUser) return null;
    const labels: Record<string, string> = {
      chat: 'Chat',
      agent: 'Agent',
    };
    const icons: Record<string, React.ReactNode> = {
      chat: (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
        </svg>
      ),
      agent: (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
        </svg>
      ),
    };
    return (
      <span className={`llm-mode-badge llm-mode-badge-${message.mode}`}>
        {icons[message.mode]}
        {labels[message.mode]}
      </span>
    );
  };

  // Render content based on mode
  const renderContent = () => {
    switch (message.mode) {
      case 'chat':
        return <ChatMessageContent message={message} />;
      case 'agent':
        return <AgentMessageContent message={message} />;
      default:
        return <ChatMessageContent message={message} />;
    }
  };

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
        {isUser && message.images && message.images.length > 0 && (
          <div className="llm-message-images">
            {message.images.map((img, index) => (
              <img
                key={index}
                src={img.dataUrl}
                alt={`Attached image ${index + 1}`}
                className="llm-message-image"
              />
            ))}
          </div>
        )}

        {/* Main content */}
        {renderContent()}

        {/* Meta info */}
        <div className="llm-message-meta">
          <span className="llm-message-time">
            {formatTimestamp(message.timestamp)}
          </span>
          {isAssistant && <ModeBadge />}
          {message.isStreaming && (
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

// ─── Main Component ───────────────────────────────────────────────────────────

export const UnifiedMessageList: React.FC<UnifiedMessageListProps> = ({
  messages,
  isLoading,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or during streaming
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div className="llm-message-list" ref={scrollRef}>
      {messages.length === 0 && !isLoading && (
        <div className="llm-empty-state">
          <div className="llm-empty-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" opacity="0.3">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
            </svg>
          </div>
          <p className="llm-empty-title">Start a conversation</p>
          <p className="llm-empty-hint">
            Select a mode (Chat or Agent) and send a message.
            <br />
            Use @ to reference files and directories.
          </p>
        </div>
      )}

      {messages.map((message) => (
        <UnifiedMessageItem
          key={message.id}
          message={message}
        />
      ))}

      {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
        <div className="llm-message-item llm-message-assistant llm-message-loading">
          <div className="llm-message-avatar">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
              <path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" />
            </svg>
          </div>
          <div className="llm-message-content">
            <div className="llm-message-text">
              <span className="llm-thinking-dots">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};

export default UnifiedMessageList;
