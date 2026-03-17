/**
 * UnifiedMessageList — Renders all message types (chat/agent/plan) in a unified stream.
 *
 * This component replaces the separate MessageList/AgentPanel/PlanPanel display
 * components. Each message renders according to its mode:
 * - chat: Simple text + images
 * - agent: Text with inline tool call visualization
 * - plan: Text with editable step cards
 */

import React, { useRef, useEffect } from 'react';
import { UnifiedMessage, MessageToolCall, MessagePlanStep } from '../models/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallDisplay } from './ToolCallDisplay';

export interface UnifiedMessageListProps {
  messages: UnifiedMessage[];
  isLoading: boolean;
  onEditPlanStep?: (messageId: string, stepId: number, title: string, desc: string) => void;
  onSkipPlanStep?: (messageId: string, stepId: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Plan Step Card ───────────────────────────────────────────────────────────

interface PlanStepCardProps {
  step: MessagePlanStep;
  onEdit: (id: number, title: string, desc: string) => void;
  onSkip: (id: number) => void;
}

const StatusIcon: React.FC<{ status: MessagePlanStep['status'] }> = ({ status }) => {
  switch (status) {
    case 'completed':
      return (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style={{ color: 'var(--jp-success-color1, #4caf50)' }}>
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      );
    case 'skipped':
      return (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style={{ color: 'var(--jp-content-font-color3)' }}>
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style={{ color: 'var(--jp-content-font-color3)' }}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      );
  }
};

const PlanStepCard: React.FC<PlanStepCardProps> = ({ step, onEdit, onSkip }) => {
  const [editing, setEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(step.title);
  const [editDesc, setEditDesc] = React.useState(step.description);

  const handleSave = () => {
    onEdit(step.id, editTitle.trim() || step.title, editDesc.trim() || step.description);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(step.title);
    setEditDesc(step.description);
    setEditing(false);
  };

  return (
    <div className={`plan-step-card plan-step-${step.status}`}>
      <div className="plan-step-header">
        <span className="plan-step-num">{step.id}</span>
        <StatusIcon status={step.status} />
        {editing ? (
          <div className="plan-step-edit-area">
            <input
              className="plan-step-edit-title"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder="Step title"
            />
            <textarea
              className="plan-step-edit-desc"
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={3}
              placeholder="Step description"
            />
            <div className="plan-step-edit-actions">
              <button className="plan-btn plan-btn-sm plan-btn-primary" onClick={handleSave}>Save</button>
              <button className="plan-btn plan-btn-sm" onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="plan-step-body">
            <span className="plan-step-title">{step.title}</span>
            <span className="plan-step-desc">{step.description}</span>
          </div>
        )}
        {!editing && step.status !== 'skipped' && (
          <div className="plan-step-actions">
            <button
              className="plan-step-action-btn"
              onClick={() => setEditing(true)}
              title="Edit step"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
              </svg>
            </button>
            <button
              className="plan-step-action-btn"
              onClick={() => onSkip(step.id)}
              title="Mark as skipped"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

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
          <span className="llm-iteration-badge">
            Iteration {message.iteration.current}/{message.iteration.max}
          </span>
        </div>
      )}
    </div>
  );
};

interface PlanMessageContentProps {
  message: UnifiedMessage;
  onEditStep?: (stepId: number, title: string, desc: string) => void;
  onSkipStep?: (stepId: number) => void;
}

const PlanMessageContent: React.FC<PlanMessageContentProps> = ({ message, onEditStep, onSkipStep }) => {
  return (
    <div className="llm-message-plan-content">
      {/* Plan description */}
      {message.content && (
        <div className="llm-message-text">
          <MarkdownRenderer content={message.content} />
        </div>
      )}

      {/* Plan steps */}
      {message.planSteps && message.planSteps.length > 0 && (
        <div className="llm-message-plan-steps">
          <div className="plan-review-bar">
            <span className="plan-review-hint">
              Review and edit steps. Use Agent mode to execute this plan.
            </span>
          </div>
          <div className="plan-steps-list">
            {message.planSteps.map(step => (
              <div key={step.id} className="plan-step-wrapper">
                <PlanStepCard
                  step={step}
                  onEdit={onEditStep || (() => {})}
                  onSkip={onSkipStep || (() => {})}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Unified Message Item ─────────────────────────────────────────────────────

interface UnifiedMessageItemProps {
  message: UnifiedMessage;
  onEditPlanStep?: (messageId: string, stepId: number, title: string, desc: string) => void;
  onSkipPlanStep?: (messageId: string, stepId: number) => void;
}

const UnifiedMessageItem: React.FC<UnifiedMessageItemProps> = ({
  message,
  onEditPlanStep,
  onSkipPlanStep,
}) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // Mode badge for assistant messages
  const ModeBadge = () => {
    if (isUser) return null;
    const labels: Record<string, string> = {
      chat: 'Chat',
      agent: 'Agent',
      plan: 'Plan',
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
      plan: (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
          <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
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
      case 'plan':
        return (
          <PlanMessageContent
            message={message}
            onEditStep={onEditPlanStep ? (id, title, desc) => onEditPlanStep(message.id, id, title, desc) : undefined}
            onSkipStep={onSkipPlanStep ? (id) => onSkipPlanStep(message.id, id) : undefined}
          />
        );
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
  onEditPlanStep,
  onSkipPlanStep,
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
            Select a mode (Chat, Agent, or Plan) and send a message.
            <br />
            Use @ to reference files and directories.
          </p>
        </div>
      )}

      {messages.map((message) => (
        <UnifiedMessageItem
          key={message.id}
          message={message}
          onEditPlanStep={onEditPlanStep}
          onSkipPlanStep={onSkipPlanStep}
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
