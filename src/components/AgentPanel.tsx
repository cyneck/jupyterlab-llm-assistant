/**
 * AgentPanel component.
 *
 * A Claude Code-style coding agent panel for JupyterLab.
 * Shows the agent's reasoning (text), tool calls, and results in real time.
 *
 * v0.3.0 additions:
 * - Session persistence via localStorage (survives page refresh)
 * - Task history panel (list of past sessions, click to restore)
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { LLMSettings, AgentDisplayMessage, ToolCallEntry } from '../models/types';
import { LLMApiService } from '../services/api';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallDisplay } from './ToolCallDisplay';

export interface AgentPanelProps {
  settings: LLMSettings;
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

const STORAGE_KEY_SESSION = 'jlab-llm-agent-session';
const STORAGE_KEY_HISTORY = 'jlab-llm-agent-history';
const MAX_HISTORY_ITEMS = 20;

interface PersistedSession {
  messages: AgentDisplayMessage[];
  history: Array<{ role: string; content: string }>;
  rootDir: string;
  savedAt: number;
}

interface HistoryItem {
  id: string;
  summary: string;
  savedAt: number;
  messages: AgentDisplayMessage[];
  history: Array<{ role: string; content: string }>;
  rootDir: string;
}

function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: PersistedSession) {
  try {
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
  } catch { /* quota exceeded – silently skip */ }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY_SESSION);
}

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
  } catch { /* ignore */ }
}

function sessionSummary(messages: AgentDisplayMessage[]): string {
  const first = messages.find(m => m.type === 'user');
  return first?.content?.slice(0, 80) || 'Empty session';
}

// ─── uid helper ──────────────────────────────────────────────────────────────

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── AgentPanel ──────────────────────────────────────────────────────────────

/**
 * AgentPanel — the main coding agent UI
 */
export const AgentPanel: React.FC<AgentPanelProps> = ({ settings }) => {
  const [messages, setMessages] = useState<AgentDisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iteration, setIteration] = useState<{ current: number; max: number } | null>(null);
  const [rootDir, setRootDir] = useState('');
  const [showDirInput, setShowDirInput] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const apiService = useRef(new LLMApiService());
  const abortRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Conversation history for the backend (only user/assistant text turns)
  const historyRef = useRef<Array<{ role: string; content: string }>>([]);

  // ── Restore session on mount ────────────────────────────────────────────
  useEffect(() => {
    const saved = loadSession();
    if (saved && saved.messages.length > 0) {
      setMessages(saved.messages);
      historyRef.current = saved.history;
      setRootDir(saved.rootDir || '');
    }
    setHistoryItems(loadHistory());
  }, []);

  // ── Persist session whenever messages change ────────────────────────────
  useEffect(() => {
    if (messages.length === 0) return;
    saveSession({
      messages,
      history: historyRef.current,
      rootDir,
      savedAt: Date.now(),
    });
  }, [messages, rootDir]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  /**
   * Append or update a display message by id
   */
  const upsertMessage = useCallback((id: string, updater: (prev: AgentDisplayMessage | undefined) => AgentDisplayMessage) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === id);
      if (idx === -1) {
        return [...prev, updater(undefined)];
      }
      const next = [...prev];
      next[idx] = updater(prev[idx]);
      return next;
    });
  }, []);

  /**
   * Update a tool call entry inside the messages list
   */
  const updateToolCall = useCallback((msgId: string, toolUpdater: (tc: ToolCallEntry) => ToolCallEntry) => {
    setMessages(prev =>
      prev.map(m =>
        m.id === msgId && m.toolCall
          ? { ...m, toolCall: toolUpdater(m.toolCall) }
          : m
      )
    );
  }, []);

  /**
   * Archive current session to history, then start a new one
   */
  const archiveAndClear = useCallback((currentMessages: AgentDisplayMessage[]) => {
    if (currentMessages.length > 0) {
      const item: HistoryItem = {
        id: uid(),
        summary: sessionSummary(currentMessages),
        savedAt: Date.now(),
        messages: currentMessages,
        history: historyRef.current,
        rootDir,
      };
      const updated = [item, ...loadHistory()].slice(0, MAX_HISTORY_ITEMS);
      saveHistory(updated);
      setHistoryItems(updated);
    }
  }, [rootDir]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isRunning) return;

    setInput('');
    setError(null);
    abortRef.current = false;

    // Create a fresh AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Add user message to display
    const userMsgId = uid();
    const userMsg: AgentDisplayMessage = {
      id: userMsgId,
      type: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Add to history
    historyRef.current = [...historyRef.current, { role: 'user', content: text }];

    setIsRunning(true);

    // Track current agent text message id
    let currentTextId = uid();
    let currentTextContent = '';
    let textMsgCreated = false;

    // Map from tool_call id → display message id
    const toolMsgMap: Record<string, string> = {};

    try {
      await apiService.current.runAgent(
        historyRef.current,
        (event) => {
          if (abortRef.current) return;

          switch (event.type) {
            case 'text': {
              const chunk: string = event.data?.content || '';
              currentTextContent += chunk;
              if (!textMsgCreated) {
                textMsgCreated = true;
                upsertMessage(currentTextId, () => ({
                  id: currentTextId,
                  type: 'agent_text',
                  content: currentTextContent,
                  timestamp: Date.now(),
                  isStreaming: true,
                }));
              } else {
                upsertMessage(currentTextId, prev => ({
                  ...prev!,
                  content: currentTextContent,
                  isStreaming: true,
                }));
              }
              break;
            }

            case 'tool_call': {
              const { id: toolId, name, args } = event.data;
              const msgId = uid();
              toolMsgMap[toolId] = msgId;

              // Finalize any current text message first
              if (textMsgCreated) {
                upsertMessage(currentTextId, prev => ({ ...prev!, isStreaming: false }));
                // Reset for next text segment
                currentTextId = uid();
                currentTextContent = '';
                textMsgCreated = false;
              }

              const entry: ToolCallEntry = {
                id: toolId,
                name,
                args,
                status: 'running',
                startTime: Date.now(),
              };
              upsertMessage(msgId, () => ({
                id: msgId,
                type: 'tool_call',
                toolCall: entry,
                timestamp: Date.now(),
              }));
              break;
            }

            case 'tool_result': {
              const { id: toolId, name, success, output } = event.data;
              const msgId = toolMsgMap[toolId];
              if (msgId) {
                updateToolCall(msgId, tc => ({
                  ...tc,
                  status: success ? 'success' : 'error',
                  endTime: Date.now(),
                  result: { id: toolId, name, success, output },
                }));
              }
              break;
            }

            case 'iteration': {
              setIteration({ current: event.data.current, max: event.data.max });
              break;
            }

            case 'done': {
              // Finalize streaming text
              if (textMsgCreated) {
                upsertMessage(currentTextId, prev => ({ ...prev!, isStreaming: false }));
              }
              setIteration(null);

              // Add final agent response to history
              if (currentTextContent) {
                historyRef.current = [...historyRef.current, { role: 'assistant', content: currentTextContent }];
              }
              break;
            }

            case 'error': {
              setError(event.data?.message || 'An error occurred');
              if (textMsgCreated) {
                upsertMessage(currentTextId, prev => ({ ...prev!, isStreaming: false }));
              }
              break;
            }
          }
        },
        rootDir || undefined,
        settings,
        20,
        controller.signal,
      );
    } catch (err) {
      // AbortError is expected when the user clicks Stop — don't show it as an error
      if (err instanceof Error && err.name === 'AbortError') {
        // silently ignored
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      }
    } finally {
      setIsRunning(false);
      setIteration(null);
    }
  }, [input, isRunning, settings, rootDir, upsertMessage, updateToolCall]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
    // Actually cancel the in-flight fetch — this terminates the SSE stream immediately
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRunning(false);
    setIteration(null);
  }, []);

  const handleClear = useCallback(() => {
    // Archive current session before clearing
    setMessages(prev => {
      archiveAndClear(prev);
      return [];
    });
    setError(null);
    historyRef.current = [];
    setIteration(null);
    clearSession();
  }, [archiveAndClear]);

  /**
   * Restore a history item into the current session
   */
  const handleRestoreHistory = useCallback((item: HistoryItem) => {
    // Archive current session first
    setMessages(prev => {
      archiveAndClear(prev);
      return item.messages;
    });
    historyRef.current = item.history;
    setRootDir(item.rootDir || '');
    setShowHistory(false);
    setError(null);
  }, [archiveAndClear]);

  /**
   * Delete a history item
   */
  const handleDeleteHistory = useCallback((id: string) => {
    const updated = historyItems.filter(h => h.id !== id);
    setHistoryItems(updated);
    saveHistory(updated);
  }, [historyItems]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const hasApiKey = !!(settings.hasApiKey || (settings.apiKey && settings.apiKey.length > 0));

  return (
    <div className="agent-panel">
      {/* Header */}
      <div className="agent-header">
        <div className="agent-header-left">
          <span className="agent-header-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zM6 9.5l1.5 1.5L6 12.5l1 1 2.5-2.5L7 8.5 6 9.5zm5 4h6v-1.5h-6V13.5z" />
            </svg>
          </span>
          <span className="agent-header-title">Coding Agent</span>
          <span className="agent-model-badge">{settings.model}</span>
        </div>
        <div className="agent-header-actions">
          {/* History toggle */}
          <button
            className={`agent-header-btn ${showHistory ? 'active' : ''}`}
            onClick={() => setShowHistory(v => !v)}
            title="Task history"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
            </svg>
          </button>
          <button
            className="agent-header-btn"
            onClick={() => setShowDirInput(v => !v)}
            title="Set working directory"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            </svg>
          </button>
          <button
            className="agent-header-btn"
            onClick={handleClear}
            title="New session (archives current)"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="agent-history-panel">
          <div className="agent-history-header">
            <span>Task History</span>
            <span className="agent-history-count">{historyItems.length} sessions</span>
          </div>
          {historyItems.length === 0 ? (
            <div className="agent-history-empty">No history yet</div>
          ) : (
            <div className="agent-history-list">
              {historyItems.map(item => (
                <div key={item.id} className="agent-history-item">
                  <button
                    className="agent-history-restore"
                    onClick={() => handleRestoreHistory(item)}
                    title="Restore this session"
                  >
                    <span className="agent-history-summary">{item.summary}</span>
                    <span className="agent-history-time">
                      {new Date(item.savedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                  <button
                    className="agent-history-delete"
                    onClick={() => handleDeleteHistory(item.id)}
                    title="Delete"
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Working directory input (optional) */}
      {showDirInput && (
        <div className="agent-dir-input-row">
          <span className="agent-dir-label">Working dir:</span>
          <input
            className="agent-dir-input"
            type="text"
            value={rootDir}
            onChange={e => setRootDir(e.target.value)}
            placeholder="/path/to/project (leave empty for Jupyter root)"
          />
        </div>
      )}

      {/* Iteration indicator */}
      {iteration && (
        <div className="agent-iteration-bar">
          <div
            className="agent-iteration-progress"
            style={{ width: `${(iteration.current / iteration.max) * 100}%` }}
          />
          <span className="agent-iteration-label">
            Step {iteration.current} / {iteration.max}
          </span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="agent-error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Messages */}
      <div className="agent-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="agent-empty-state">
            <div className="agent-empty-icon">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" opacity="0.3">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zM6 9.5l1.5 1.5L6 12.5l1 1 2.5-2.5L7 8.5 6 9.5zm5 4h6v-1.5h-6V13.5z" />
              </svg>
            </div>
            <p className="agent-empty-title">Coding Agent</p>
            <p className="agent-empty-hint">
              Ask me to write code, debug issues, refactor files, run tests, or explore your project.
            </p>
            <div className="agent-example-prompts">
              {[
                'List the files in this directory',
                'Read package.json and explain the project',
                'Create a Python utility script',
                'Find all TODO comments in the code',
              ].map(p => (
                <button
                  key={p}
                  className="agent-example-btn"
                  onClick={() => setInput(p)}
                  disabled={isRunning}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`agent-message agent-message-${msg.type}`}>
            {msg.type === 'user' && (
              <div className="agent-user-bubble">
                <span className="agent-user-avatar">You</span>
                <div className="agent-user-content">{msg.content}</div>
              </div>
            )}

            {msg.type === 'agent_text' && (
              <div className="agent-text-block">
                <span className="agent-assistant-avatar">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                  </svg>
                </span>
                <div className="agent-text-content">
                  <MarkdownRenderer content={msg.content || ''} />
                  {msg.isStreaming && <span className="agent-cursor" />}
                </div>
              </div>
            )}

            {msg.type === 'tool_call' && msg.toolCall && (
              <ToolCallDisplay entry={msg.toolCall} />
            )}
          </div>
        ))}

        {isRunning && !iteration && (
          <div className="agent-thinking">
            <span className="agent-thinking-dots">
              <span /><span /><span />
            </span>
            <span className="agent-thinking-label">Thinking…</span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="agent-input-area">
        <textarea
          ref={textareaRef}
          className="agent-input-textarea"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            !hasApiKey
              ? 'API key not configured — go to settings'
              : 'Ask the agent to write, edit, or run code… (Enter to send)'
          }
          disabled={isRunning || !hasApiKey}
          rows={1}
        />
        <div className="agent-input-actions">
          {isRunning ? (
            <button className="agent-stop-btn" onClick={handleStop} title="Stop">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M6 6h12v12H6z" />
              </svg>
            </button>
          ) : (
            <button
              className="agent-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || !hasApiKey}
              title="Send (Enter)"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          )}
        </div>
        <div className="agent-input-hint">
          <span>Enter to send · Shift+Enter for newline</span>
          {rootDir && <span className="agent-cwd-label" title={rootDir}>📁 {rootDir.split('/').pop()}</span>}
        </div>
      </div>
    </div>
  );
};

export default AgentPanel;
