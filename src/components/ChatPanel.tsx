/**
 * ChatPanel — Unified message stream with mode-based handlers.
 *
 * New design (v0.8.0):
 * - Single unified message list (no mode switching panels)
 * - Chat/Agent are message HANDLERS, not separate panels
 * - Mode selector only controls how the NEXT message is processed
 * - All messages persist in one history (survives mode switches)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { LLMSettings, ImageData, ConnectionTestResult, UnifiedMessage, MessageMode, MessageToolCall } from '../models/types';
import { SettingsModel } from '../models/settings';
import { InputArea, AttachedPath } from './InputArea';
import { SettingsPanel } from './SettingsPanel';
import { MemoryPanel } from './MemoryPanel';
import { SessionPanel } from './SessionPanel';
import { UnifiedMessageList } from './UnifiedMessageList';
import { LLMApiService } from '../services/api';

export interface ChatPanelProps {
  settings: LLMSettings;
  onOpenSettings: () => void;
}

// Session storage - using backend .llm-assistant/sessions/ directory
const DEFAULT_SESSION_ID = 'default';
let currentSessionId = DEFAULT_SESSION_ID;

async function loadSessionFromBackend(rootDir: string): Promise<{ messages: UnifiedMessage[]; id: string }> {
  try {
    const sessions = await _api.listSessions(rootDir);
    if (sessions.length > 0) {
      const latest = sessions[0];
      const session = await _api.loadSession(latest.id, rootDir);
      return { messages: session.messages || [], id: session.id };
    }
  } catch { /* no session found, start fresh */ }
  return { messages: [], id: DEFAULT_SESSION_ID };
}

async function saveSessionToBackend(
  rootDir: string,
  messages: UnifiedMessage[],
  mode: MessageMode,
  sessionId: string = currentSessionId
): Promise<void> {
  // Generate summary from first user message
  const firstUserMsg = messages.find(m => m.role === 'user');
  const summary = firstUserMsg
    ? firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
    : 'New conversation';

  try {
    const result = await _api.saveSession({
      id: sessionId,
      summary,
      mode,
      messages: messages.slice(-100), // keep last 100 messages
      history: [],
      rootDir,
    });
    currentSessionId = result.id;
  } catch (err) {
    console.error('Failed to save session:', err);
  }
}

const _api = new LLMApiService();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildContextFromAttachments(
  paths: AttachedPath[],
  rootDir: string,
): Promise<string> {
  if (paths.length === 0) return '';

  const allPaths: string[] = [];
  for (const a of paths) {
    if (a.isDir) {
      try {
        const res = await _api.resolveContextPath(a.path, rootDir);
        allPaths.push(...res.paths.slice(0, 20));
      } catch { /* skip */ }
    } else {
      allPaths.push(a.path);
    }
  }

  if (allPaths.length === 0) return '';

  try {
    const res = await _api.readContextFiles(allPaths, rootDir);
    const parts: string[] = [];
    for (const f of res.files) {
      if (f.error) continue;
      parts.push(`\`\`\`// ${f.path}\n${f.content}\n\`\`\``);
    }
    if (parts.length === 0) return '';
    return `<attached_files>\n${parts.join('\n\n')}\n</attached_files>\n\n`;
  } catch {
    return '';
  }
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ChatPanel: React.FC<ChatPanelProps> = ({ settings, onOpenSettings }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showSession, setShowSession] = useState(false);
  const [currentSettings, setCurrentSettings] = useState<LLMSettings>(settings);
  const [sendMode, setSendMode] = useState<MessageMode>('agent');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [rootDir, setRootDir] = useState('');
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Unified message state
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const settingsModelRef = useRef<SettingsModel | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const rootDirRef = useRef<string>('');

  // ── Initialize ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!settingsModelRef.current) {
      settingsModelRef.current = new SettingsModel(currentSettings);
      settingsModelRef.current.loadSettings().then((loaded) => {
        setCurrentSettings(loaded);
      });
    }

    // Load workspace and session
    _api.getWorkspaceInfo('').then(info => {
      const dir = info.rootDir || '';
      setRootDir(dir);
      rootDirRef.current = dir;
      // Set rootDir for workspace config
      if (settingsModelRef.current) {
        settingsModelRef.current.setRootDir(dir);
      }
      // Load session from backend
      return loadSessionFromBackend(dir);
    }).then(sessionData => {
      if (sessionData.messages.length > 0) {
        setMessages(sessionData.messages);
        currentSessionId = sessionData.id;
      }
    }).catch(() => {
      setRootDir('');
    }).finally(() => {
      setIsLoadingSession(false);
    });
  }, []);

  // Persist messages to backend when changed
  useEffect(() => {
    if (isLoadingSession || !rootDirRef.current || messages.length === 0) return;
    const timeoutId = setTimeout(() => {
      saveSessionToBackend(rootDirRef.current, messages, sendMode);
    }, 1000); // Debounce 1 second
    return () => clearTimeout(timeoutId);
  }, [messages, sendMode, isLoadingSession]);

  // ── Mode switching (only affects send handler) ────────────────────────────
  const handleModeChange = useCallback((m: MessageMode) => {
    // Cancel any ongoing request when switching modes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setSendMode(m);
    // Persist mode to session
    if (rootDirRef.current && messages.length > 0) {
      saveSessionToBackend(rootDirRef.current, messages, m);
    }
  }, [messages]);

  // ── Message handlers ───────────────────────────────────────────────────────
  const addMessage = useCallback((msg: Omit<UnifiedMessage, 'id' | 'timestamp'>): UnifiedMessage => {
    const fullMsg: UnifiedMessage = {
      ...msg,
      id: uid(),
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, fullMsg]);
    return fullMsg;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<UnifiedMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }, []);

  // ── Chat handler ───────────────────────────────────────────────────────────
  const handleChatSend = useCallback(async (text: string, images: ImageData[], contextText: string) => {
    const fullText = contextText ? `${contextText}${text}` : text;

    // Add user message
    addMessage({ role: 'user', content: text, mode: 'chat', images });

    setIsProcessing(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Build API messages from history
    const apiMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));
    apiMessages.push({ role: 'user', content: fullText });

    const imageDataUrls = images.map(img => img.dataUrl);

    try {
      if (currentSettings.enableStreaming) {
        const assistantMsg = addMessage({ role: 'assistant', content: '', mode: 'chat', isStreaming: true });

        await _api.streamChat(
          apiMessages,
          imageDataUrls.length > 0 ? imageDataUrls : undefined,
          (chunk: string) => {
            if (controller.signal.aborted) return;
            setMessages(prev => {
              const idx = prev.findIndex(m => m.id === assistantMsg.id);
              if (idx === -1) return prev;
              const next = [...prev];
              next[idx] = { ...next[idx], content: next[idx].content + chunk };
              return next;
            });
          },
          currentSettings,
          controller.signal,
        );

        if (!controller.signal.aborted) {
          updateMessage(assistantMsg.id, { isStreaming: false });
        }
      } else {
        const response = await _api.chat(
          apiMessages,
          imageDataUrls.length > 0 ? imageDataUrls : undefined,
          currentSettings,
          controller.signal,
        );

        if (!controller.signal.aborted) {
          addMessage({ role: 'assistant', content: response.content, mode: 'chat' });
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : 'An error occurred';
        setError(msg);
        addMessage({ role: 'assistant', content: `Error: ${msg}`, mode: 'chat', error: msg });
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsProcessing(false);
    }
  }, [messages, currentSettings, addMessage, updateMessage]);

  // ── Agent handler ──────────────────────────────────────────────────────────
  const handleAgentSend = useCallback(async (text: string, contextText: string) => {
    const fullText = contextText ? `${contextText}${text}` : text;

    // Add user message
    addMessage({ role: 'user', content: text, mode: 'agent' });

    setIsProcessing(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Build conversation history
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: fullText });

    let assistantMsgId = uid();
    let currentContent = '';
    const toolMsgMap: Record<string, string> = {};

    try {
      await _api.runAgent(
        history,
        (event) => {
          switch (event.type) {
            case 'text': {
              const chunk = event.data?.content || '';
              currentContent += chunk;
              setMessages(prev => {
                const idx = prev.findIndex(m => m.id === assistantMsgId);
                if (idx === -1) {
                  return [...prev, {
                    id: assistantMsgId,
                    role: 'assistant',
                    content: currentContent,
                    mode: 'agent',
                    timestamp: Date.now(),
                    isStreaming: true,
                    toolCalls: [],
                  }];
                }
                const next = [...prev];
                next[idx] = { ...next[idx], content: currentContent, isStreaming: true };
                return next;
              });
              break;
            }

            case 'tool_call': {
              const { id: toolId, name, args } = event.data;
              const toolUid = uid();
              toolMsgMap[toolId] = toolUid;

              setMessages(prev => {
                const assistantIdx = prev.findIndex(m => m.id === assistantMsgId);
                const toolCall: MessageToolCall = {
                  id: toolUid,
                  name,
                  args,
                  status: 'running',
                  startTime: Date.now(),
                };

                if (assistantIdx === -1) {
                  // Create assistant message with tool call
                  return [...prev, {
                    id: assistantMsgId,
                    role: 'assistant',
                    content: currentContent,
                    mode: 'agent',
                    timestamp: Date.now(),
                    toolCalls: [toolCall],
                  }];
                } else {
                  const next = [...prev];
                  const existing = next[assistantIdx].toolCalls || [];
                  next[assistantIdx] = { ...next[assistantIdx], toolCalls: [...existing, toolCall] };
                  return next;
                }
              });
              break;
            }

            case 'tool_result': {
              const { id: toolId, success, output } = event.data;
              const msgId = toolMsgMap[toolId];
              if (!msgId) break;

              setMessages(prev => {
                const assistantIdx = prev.findIndex(m => m.id === assistantMsgId);
                if (assistantIdx === -1) return prev;

                const next = [...prev];
                const toolCalls = next[assistantIdx].toolCalls || [];
                next[assistantIdx] = {
                  ...next[assistantIdx],
                  toolCalls: toolCalls.map(tc =>
                    tc.id === msgId
                      ? { ...tc, status: success ? 'success' : 'error', result: { success, output }, endTime: Date.now() }
                      : tc
                  ),
                };
                return next;
              });
              break;
            }

            case 'iteration': {
              const { current, max } = event.data;
              setMessages(prev => {
                const assistantIdx = prev.findIndex(m => m.id === assistantMsgId);
                if (assistantIdx === -1) return prev;

                const next = [...prev];
                next[assistantIdx] = {
                  ...next[assistantIdx],
                  iteration: { current, max },
                };
                return next;
              });
              break;
            }

            case 'done': {
              updateMessage(assistantMsgId, { isStreaming: false });
              break;
            }

            case 'error': {
              setError(event.data?.message || 'An error occurred');
              updateMessage(assistantMsgId, { isStreaming: false });
              break;
            }
          }
        },
        rootDir || undefined,
        currentSettings,
        20,
        controller.signal,
      );
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [messages, currentSettings, rootDir, addMessage, updateMessage]);

  // ── Unified send handler ───────────────────────────────────────────────────
  const handleSend = useCallback(async (
    text: string,
    images: ImageData[],
    attachedPaths: AttachedPath[],
  ) => {
    const contextText = await buildContextFromAttachments(attachedPaths, rootDir);

    switch (sendMode) {
      case 'chat':
        await handleChatSend(text, images, contextText);
        break;
      case 'agent':
        await handleAgentSend(text, contextText);
        break;
    }
  }, [sendMode, rootDir, handleChatSend, handleAgentSend]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
  }, []);

  const handleClear = useCallback(async () => {
    setMessages([]);
    setError(null);
    currentSessionId = DEFAULT_SESSION_ID;
    // Delete session from backend
    try {
      await _api.deleteSession(DEFAULT_SESSION_ID, rootDirRef.current);
    } catch { /* ignore if no session to delete */ }
  }, []);

  const handleNewSession = useCallback(() => {
    // Clear current messages and reset session id to create a new session
    setMessages([]);
    currentSessionId = DEFAULT_SESSION_ID;
    setShowSession(false);
  }, []);

  const handleRootDirChange = useCallback((newRootDir: string) => {
    setRootDir(newRootDir);
    rootDirRef.current = newRootDir;
    // Reload sessions from new directory
    setShowSession(false);
    setTimeout(() => setShowSession(true), 0);
  }, []);

  const handleLoadSession = useCallback(async (sessionId: string) => {
    try {
      const session = await _api.loadSession(sessionId, rootDirRef.current);
      if (session.messages && session.messages.length > 0) {
        setMessages(session.messages);
        currentSessionId = sessionId;
        if (session.mode) {
          setSendMode(session.mode as MessageMode);
        }
      }
      setShowSession(false);
    } catch (err) {
      console.error('Failed to load session:', err);
      setError('Failed to load session');
    }
  }, []);

  // ── Settings handlers ──────────────────────────────────────────────────────
  const handleSettingsChange = useCallback(async (newSettings: Partial<LLMSettings>) => {
    if (!settingsModelRef.current) return;
    try {
      await settingsModelRef.current.saveSettings(newSettings);
      setCurrentSettings(prev => ({ ...prev, ...newSettings }));
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }, []);

  const handleTestConnection = useCallback(async (): Promise<ConnectionTestResult> => {
    if (!settingsModelRef.current) return { success: false, error: 'Not initialized' };
    setIsTestingConnection(true);
    try {
      await settingsModelRef.current.saveSettings(currentSettings);
      return await settingsModelRef.current.testConnection();
    } finally {
      setIsTestingConnection(false);
    }
  }, [currentSettings]);

  const hasApiKey = currentSettings.hasApiKey ||
    (currentSettings.apiKey && currentSettings.apiKey.length > 0);

  // ── Header ─────────────────────────────────────────────────────────────────
  const header = (
    <div className="llm-chat-header">
      <h3>LLM Assistant</h3>
      <div className="llm-header-actions">
        <button
          className={`llm-header-btn ${showSession ? 'active' : ''}`}
          onClick={() => setShowSession(v => !v)}
          title="Sessions"
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
            <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.22 10.51 20 13 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
          </svg>
        </button>
        <button
          className={`llm-header-btn ${showMemory ? 'active' : ''}`}
          onClick={() => setShowMemory(v => !v)}
          title="Memory"
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
          </svg>
        </button>
        {!showSettings && !showMemory && !showSession && (
          <button className="llm-header-btn" onClick={handleClear} title="Clear chat">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </button>
        )}
        <button
          className={`llm-header-btn ${showSettings ? 'active' : ''}`}
          onClick={() => setShowSettings(true)}
          title="Settings"
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
        </button>
      </div>
    </div>
  );

  // ── Side panels ────────────────────────────────────────────────────────────
  if (showSettings) {
    return (
      <div className="llm-chat-panel">
        {header}
        <SettingsPanel
          settings={currentSettings}
          onSettingsChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
          onTestConnection={handleTestConnection}
          isTestingConnection={isTestingConnection}
        />
      </div>
    );
  }

  if (showMemory) {
    return (
      <div className="llm-chat-panel">
        {header}
        <MemoryPanel onClose={() => setShowMemory(false)} />
      </div>
    );
  }

  if (showSession) {
    return (
      <div className="llm-chat-panel">
        {header}
        <SessionPanel
          onClose={() => setShowSession(false)}
          onLoadSession={handleLoadSession}
          onNewSession={handleNewSession}
          rootDir={rootDir}
          onRootDirChange={handleRootDirChange}
        />
      </div>
    );
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <div className="llm-chat-panel llm-unified-panel">
      {header}

      <div className="llm-mode-viewport">
        {error && (
          <div className="llm-error-banner">
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        )}

        <div className="llm-model-indicator">
          <span className="llm-model-name">{currentSettings.model}</span>
          <span className="llm-mode-badge">{sendMode === 'chat' ? 'Chat' : 'Agent'}</span>
          {!hasApiKey && <span className="llm-api-warning">API Key not set</span>}
        </div>

        <UnifiedMessageList
          messages={messages}
          isLoading={isProcessing}
        />
      </div>

      {/* Running indicator */}
      {isProcessing && (
        <div className="agent-running-bar">
          <span className="agent-thinking-dots"><span /><span /><span /></span>
          <span className="agent-thinking-label">Processing...</span>
          <button className="agent-stop-btn" onClick={handleStop}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M6 6h12v12H6z" />
            </svg>
            Stop
          </button>
        </div>
      )}

      <InputArea
        onSend={handleSend}
        disabled={isProcessing || !hasApiKey}
        mode={sendMode}
        onModeChange={handleModeChange}
        rootDir={rootDir}
      />
    </div>
  );
};

export default ChatPanel;
