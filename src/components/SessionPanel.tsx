/**
 * SessionPanel — Session history management panel
 *
 * Displays a list of saved sessions from .llm-assistant/sessions/
 * Allows loading, deleting, and creating new sessions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LLMApiService } from '../services/api';

interface Session {
  id: string;
  summary: string;
  mode: string;
  savedAt: number;
  messageCount: number;
}

interface SessionPanelProps {
  onClose: () => void;
  onLoadSession: (sessionId: string) => void;
  onNewSession: () => void;
  rootDir: string;
  onRootDirChange?: (newRootDir: string) => void;
}

const _api = new LLMApiService();

export const SessionPanel: React.FC<SessionPanelProps> = ({
  onClose,
  onLoadSession,
  onNewSession,
  rootDir,
  onRootDirChange,
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showRootDirEdit, setShowRootDirEdit] = useState(false);
  const [rootDirInput, setRootDirInput] = useState(rootDir);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await _api.listSessions(rootDir);
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, [rootDir]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    setRootDirInput(rootDir);
  }, [rootDir]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await _api.deleteSession(id, rootDir);
      await loadSessions();
    } catch (err) {
      console.error('Failed to delete session:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleRootDirSave = () => {
    if (onRootDirChange && rootDirInput !== rootDir) {
      onRootDirChange(rootDirInput);
    }
    setShowRootDirEdit(false);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="llm-session-panel">
      <div className="llm-session-header">
        <h4>Session History</h4>
        <div className="llm-session-header-actions">
          <button
            className="llm-header-btn llm-new-session-btn"
            onClick={onNewSession}
            title="New Session"
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
          <button className="llm-close-btn" onClick={onClose} title="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Project Directory Section */}
      <div className="llm-rootdir-section">
        <div className="llm-rootdir-header">
          <span className="llm-rootdir-label">Project Directory</span>
          <button
            className="llm-rootdir-edit-btn"
            onClick={() => setShowRootDirEdit(!showRootDirEdit)}
            title="Edit project directory"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </button>
        </div>
        {showRootDirEdit ? (
          <div className="llm-rootdir-edit">
            <input
              type="text"
              className="llm-rootdir-input"
              value={rootDirInput}
              onChange={(e) => setRootDirInput(e.target.value)}
              placeholder="Enter project directory path..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRootDirSave();
                if (e.key === 'Escape') setShowRootDirEdit(false);
              }}
              autoFocus
            />
            <div className="llm-rootdir-actions">
              <button className="llm-rootdir-save" onClick={handleRootDirSave}>
                Save
              </button>
              <button className="llm-rootdir-cancel" onClick={() => setShowRootDirEdit(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="llm-rootdir-path" title={rootDir}>
            {rootDir || 'Using current working directory'}
          </div>
        )}
      </div>

      <div className="llm-session-content">
        {isLoading && <div className="llm-loading">Loading sessions...</div>}

        {error && (
          <div className="llm-session-error">
            <span>{error}</span>
            <button onClick={loadSessions}>Retry</button>
          </div>
        )}

        {!isLoading && !error && sessions.length === 0 && (
          <div className="llm-session-empty">
            <p>No saved sessions</p>
            <p className="llm-hint">Chat history is automatically saved to .llm-assistant/sessions/</p>
          </div>
        )}

        {!isLoading && !error && sessions.length > 0 && (
          <div className="llm-session-list">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="llm-session-item"
                onClick={() => onLoadSession(session.id)}
              >
                <div className="llm-session-info">
                  <div className="llm-session-title">
                    {session.summary || 'Untitled session'}
                  </div>
                  <div className="llm-session-meta">
                    <span className={`llm-session-mode llm-mode-${session.mode}`}>
                      {session.mode}
                    </span>
                    <span className="llm-session-count">
                      {session.messageCount} messages
                    </span>
                    <span className="llm-session-date">
                      {formatDate(session.savedAt)}
                    </span>
                  </div>
                </div>
                <button
                  className="llm-session-delete"
                  onClick={(e) => handleDelete(session.id, e)}
                  disabled={deletingId === session.id}
                  title="Delete session"
                >
                  {deletingId === session.id ? (
                    <span className="llm-spinner" />
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
