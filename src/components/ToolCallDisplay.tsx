/**
 * ToolCallDisplay component.
 *
 * Shows a single tool call with its arguments and result,
 * collapsible, styled like Claude Code's tool execution view.
 */

import React, { useState } from 'react';
import { ToolCallEntry } from '../models/types';

export interface ToolCallDisplayProps {
  entry: ToolCallEntry;
}

/**
 * Icon for each tool
 */
function ToolIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    read_file: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
      </svg>
    ),
    write_file: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
      </svg>
    ),
    edit_file: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L14.06 9.94l-3.75-3.75z" />
      </svg>
    ),
    bash: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zM6 9.5l1.5 1.5L6 12.5l1 1 2.5-2.5L7 8.5 6 9.5zm5 4h6v-1.5h-6V13.5z" />
      </svg>
    ),
    notebook_execute: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M8 5v14l11-7z" />
      </svg>
    ),
    list_dir: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
      </svg>
    ),
    grep_search: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
      </svg>
    ),
  };
  return <span className="agent-tool-icon">{icons[name] || icons['bash']}</span>;
}

/**
 * Human-readable label for tool name
 */
function toolLabel(name: string, args: Record<string, any>): string {
  switch (name) {
    case 'read_file':
      return `Read ${args.path || 'file'}`;
    case 'write_file':
      return `Write ${args.path || 'file'}`;
    case 'edit_file':
      return `Edit ${args.path || 'file'}`;
    case 'bash':
      return `Run: ${(args.command || '').slice(0, 60)}${(args.command || '').length > 60 ? '…' : ''}`;
    case 'notebook_execute':
      return `Execute: ${(args.code || '').split('\n')[0].slice(0, 55)}${(args.code || '').length > 55 ? '…' : ''}`;
    case 'list_dir':
      return `List ${args.path || '.'}`;
    case 'grep_search':
      return `Search "${args.pattern || ''}"${args.path ? ` in ${args.path}` : ''}`;
    default:
      return name;
  }
}

/**
 * Status indicator dot
 */
function StatusDot({ status }: { status: ToolCallEntry['status'] }) {
  const colors: Record<string, string> = {
    pending: '#888',
    running: '#f0a500',
    success: '#22c55e',
    error: '#ef4444',
  };
  return (
    <span
      className={`agent-tool-status agent-tool-status-${status}`}
      style={{ backgroundColor: colors[status] }}
    />
  );
}

/**
 * Format args as a compact summary
 */
function ArgsSummary({ name, args }: { name: string; args: Record<string, any> }) {
  if (name === 'write_file') {
    const lines = (args.content || '').split('\n').length;
    return <span className="agent-tool-args">{args.path} ({lines} lines)</span>;
  }
  if (name === 'edit_file') {
    const preview = (args.old_str || '').split('\n')[0].slice(0, 50);
    return <span className="agent-tool-args">{args.path} · replace: "{preview}{(args.old_str||'').length > 50 ? '…' : ''}"</span>;
  }
  if (name === 'bash') {
    return <code className="agent-tool-args-code">{args.command}</code>;
  }
  if (name === 'notebook_execute') {
    return <code className="agent-tool-args-code">{(args.code || '').slice(0, 120)}{(args.code||'').length > 120 ? '\n…' : ''}</code>;
  }
  const primary = args.path || args.pattern || '';
  return primary ? <span className="agent-tool-args">{primary}</span> : null;
}

export const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);
  const duration = entry.endTime
    ? ((entry.endTime - entry.startTime) / 1000).toFixed(1)
    : null;

  const hasOutput = !!entry.result?.output;

  return (
    <div className={`agent-tool-call agent-tool-call-${entry.status}`}>
      {/* Header row — always visible */}
      <button
        className="agent-tool-header"
        onClick={() => hasOutput && setExpanded(v => !v)}
        disabled={!hasOutput}
        title={hasOutput ? 'Click to expand/collapse' : undefined}
      >
        <StatusDot status={entry.status} />
        <ToolIcon name={entry.name} />
        <span className="agent-tool-label">{toolLabel(entry.name, entry.args)}</span>
        {duration && <span className="agent-tool-duration">{duration}s</span>}
        {entry.status === 'running' && (
          <span className="agent-tool-spinner">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" className="agent-spinning">
              <path d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.41 3.59-8 8-8z" />
            </svg>
          </span>
        )}
        {hasOutput && (
          <span className="agent-tool-chevron">
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </button>

      {/* Args summary (always shown if not bash/notebook_execute) */}
      {entry.name !== 'bash' && entry.name !== 'notebook_execute' && (
        <div className="agent-tool-args-row">
          <ArgsSummary name={entry.name} args={entry.args} />
        </div>
      )}
      {/* For bash and notebook_execute, show code block args inline */}
      {(entry.name === 'bash' || entry.name === 'notebook_execute') && (
        <div className="agent-tool-args-row">
          <ArgsSummary name={entry.name} args={entry.args} />
        </div>
      )}

      {/* Expanded output */}
      {expanded && entry.result && (
        <div className={`agent-tool-output ${entry.result.success ? '' : 'agent-tool-output-error'}`}>
          <pre>{entry.result.output}</pre>
        </div>
      )}
    </div>
  );
};

export default ToolCallDisplay;
