/**
 * Main panel component — three modes in one unified shell.
 *
 * Mode selector (Chat | Agent | Plan) lives in the header.
 * Memory and Context-file panels are shared across all modes.
 *
 * v0.5.0 changes:
 * - Chat mode merged into this file (no longer a separate ChatPanel shell)
 * - Agent mode rendered via AgentPanel
 * - Plan mode rendered via PlanPanel (new)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { LLMSettings, ImageData, ConnectionTestResult } from '../models/types';
import { ChatModel } from '../models/chat';
import { SettingsModel } from '../models/settings';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { SettingsPanel } from './SettingsPanel';
import { AgentPanel } from './AgentPanel';
import { PlanPanel } from './PlanPanel';
import { MemoryPanel } from './MemoryPanel';
import { ContextFilePanel, loadContextState, ContextState } from './ContextFilePanel';

export type AppMode = 'chat' | 'agent' | 'plan';

export interface ChatPanelProps {
  settings: LLMSettings;
  onOpenSettings: () => void;
}

const MODE_STORAGE_KEY = 'jlab-llm-mode';

function loadSavedMode(): AppMode {
  try {
    const raw = localStorage.getItem(MODE_STORAGE_KEY);
    if (raw === 'agent' || raw === 'plan' || raw === 'chat') return raw;
  } catch { /* ignore */ }
  return 'chat';
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ settings, onOpenSettings }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [currentSettings, setCurrentSettings] = useState<LLMSettings>(settings);
  const [mode, setMode] = useState<AppMode>(loadSavedMode);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Context state (shared across all modes)
  const [contextText, setContextText] = useState('');
  const [contextState, setContextState] = useState<ContextState | null>(() => loadContextState());

  // Chat model refs
  const chatModelRef = useRef<ChatModel | null>(null);
  const settingsModelRef = useRef<SettingsModel | null>(null);

  // Chat mode state
  const [messages, setMessages] = useState(chatModelRef.current?.messages || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Initialize models ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatModelRef.current) {
      chatModelRef.current = new ChatModel(currentSettings);
      settingsModelRef.current = new SettingsModel(currentSettings);

      settingsModelRef.current.loadSettings().then((loaded) => {
        setCurrentSettings(loaded);
        chatModelRef.current?.updateSettings(loaded);
      });

      chatModelRef.current.messagesChanged.connect((_, msgs) => setMessages([...msgs]));
      chatModelRef.current.loadingChanged.connect((_, loading) => setIsLoading(loading));
      chatModelRef.current.errorChanged.connect((_, err) => setError(err));
    }
  }, []);

  useEffect(() => {
    chatModelRef.current?.updateSettings(currentSettings);
  }, [currentSettings]);

  // ── Mode switching ─────────────────────────────────────────────────────────
  const handleModeChange = useCallback((m: AppMode) => {
    setMode(m);
    try { localStorage.setItem(MODE_STORAGE_KEY, m); } catch { /* ignore */ }
    // Close any open side panels when switching modes
    setShowSettings(false);
    setShowMemory(false);
    setShowContext(false);
  }, []);

  // ── Context ────────────────────────────────────────────────────────────────
  const handleContextChange = useCallback((text: string, state: ContextState) => {
    setContextText(text);
    setContextState(state);
  }, []);

  // ── Chat handlers ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text: string, images: ImageData[]) => {
    if (!chatModelRef.current) return;
    try {
      await chatModelRef.current.sendMessage(text, images, contextText || undefined);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }, [contextText]);

  const handleClear = useCallback(() => chatModelRef.current?.clear(), []);

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

  // ── Panel toggles ──────────────────────────────────────────────────────────
  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
    setShowMemory(false);
    setShowContext(false);
  }, []);

  const handleToggleMemory = useCallback(() => {
    setShowMemory(v => !v);
    setShowContext(false);
    setShowSettings(false);
  }, []);

  const handleToggleContext = useCallback(() => {
    setShowContext(v => !v);
    setShowMemory(false);
    setShowSettings(false);
  }, []);

  const contextFileCount = contextState?.selectedPaths.length ?? 0;

  // ── Header (defined before return to follow React best practices) ──────────
  const header = (
    <div className="llm-chat-header">
      <h3>LLM Assistant</h3>
      <div className="llm-header-actions">
        {/* Mode toggle: Chat | Agent | Plan */}
        <div className="llm-mode-toggle">
          <button
            className={`llm-mode-btn ${mode === 'chat' ? 'active' : ''}`}
            onClick={() => handleModeChange('chat')}
            title="Chat mode — direct conversation"
          >
            Chat
          </button>
          <button
            className={`llm-mode-btn ${mode === 'agent' ? 'active' : ''}`}
            onClick={() => handleModeChange('agent')}
            title="Agent mode — can read/write files and run commands"
          >
            Agent
          </button>
          <button
            className={`llm-mode-btn ${mode === 'plan' ? 'active' : ''}`}
            onClick={() => handleModeChange('plan')}
            title="Plan mode — generate a step-by-step plan, then execute"
          >
            Plan
          </button>
        </div>

        {/* Memory button */}
        <button
          className={`llm-header-btn ${showMemory ? 'active' : ''}`}
          onClick={handleToggleMemory}
          title="Memory — persistent context injected into every conversation"
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
          </svg>
        </button>

        {/* Context files button */}
        <button
          className={`llm-header-btn ${showContext ? 'active' : ''} ${contextFileCount > 0 ? 'llm-header-btn-has-context' : ''}`}
          onClick={handleToggleContext}
          title={`Context files${contextFileCount > 0 ? ` (${contextFileCount} selected)` : ''}`}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
          </svg>
          {contextFileCount > 0 && (
            <span className="llm-context-badge">{contextFileCount}</span>
          )}
        </button>

        {/* Clear (chat mode only) */}
        {mode === 'chat' && !showSettings && !showMemory && !showContext && (
          <button
            className="llm-header-btn"
            onClick={handleClear}
            title="Clear chat"
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </button>
        )}

        {/* Settings */}
        <button
          className={`llm-header-btn ${showSettings ? 'active' : ''}`}
          onClick={handleOpenSettings}
          title="Settings"
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
        </button>
      </div>
    </div>
  );

  // ── Render side panels (overlay) ──────────────────────────────────────────
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

  if (showContext) {
    return (
      <div className="llm-chat-panel">
        {header}
        <ContextFilePanel
          onContextChange={handleContextChange}
          initialState={contextState ?? undefined}
          onClose={() => setShowContext(false)}
        />
      </div>
    );
  }

  // ── Main content by mode ───────────────────────────────────────────────────
  return (
    <div className="llm-chat-panel">
      {header}

      {mode === 'agent' && (
        <AgentPanel
          settings={currentSettings}
          contextText={contextText}
          contextFileCount={contextFileCount}
        />
      )}

      {mode === 'plan' && (
        <PlanPanel
          settings={currentSettings}
          contextText={contextText}
          contextFileCount={contextFileCount}
        />
      )}

      {mode === 'chat' && (
        <>
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
          {contextFileCount > 0 && (
            <div className="llm-context-indicator" onClick={handleToggleContext} title="Click to manage context files">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
              </svg>
              <span>{contextFileCount} context file{contextFileCount !== 1 ? 's' : ''} active</span>
            </div>
          )}
          <div className="llm-model-indicator">
            <span className="llm-model-name">{currentSettings.model}</span>
            {!(currentSettings.hasApiKey || (currentSettings.apiKey && currentSettings.apiKey.length > 0)) && (
              <span className="llm-api-warning">API Key not set</span>
            )}
          </div>
          <MessageList messages={messages} isLoading={isLoading} />
          <InputArea
            onSend={handleSend}
            disabled={isLoading || !(currentSettings.hasApiKey || (currentSettings.apiKey && currentSettings.apiKey.length > 0))}
            enableVision={currentSettings.enableVision}
          />
        </>
      )}
    </div>
  );
};

export default ChatPanel;
