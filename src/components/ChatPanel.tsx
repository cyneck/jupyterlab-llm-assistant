/**
 * ChatPanel — Unified shell for Chat / Agent / Plan modes.
 *
 * v0.7.0 redesign:
 * - All three modes share a SINGLE unified context: the InputArea at the
 *   bottom is always visible regardless of mode.  Switching mode just changes
 *   the message-display viewport above — no page navigation required.
 * - ContextFilePanel removed; file/dir references are handled inline via the
 *   @ mention picker and path chips in InputArea.
 * - Attached paths (from @ picker) are forwarded to the active mode handler
 *   which reads the file contents before sending to the LLM.
 * - .llm-assistant workspace directory support added (session history,
 *   ASSISTANT.md, per-project config, future skill loading).
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { LLMSettings, ImageData, ConnectionTestResult } from '../models/types';
import { ChatModel } from '../models/chat';
import { SettingsModel } from '../models/settings';
import { MessageList } from './MessageList';
import { InputArea, AttachedPath } from './InputArea';
import { SettingsPanel } from './SettingsPanel';
import { AgentPanel } from './AgentPanel';
import { PlanPanel } from './PlanPanel';
import { MemoryPanel } from './MemoryPanel';
import { LLMApiService } from '../services/api';

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

const _api = new LLMApiService();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Given a list of AttachedPath chips, fetch their content from the backend
 * and format as a context block to prepend to the message.
 */
async function buildContextFromAttachments(
  paths: AttachedPath[],
  rootDir: string,
): Promise<string> {
  if (paths.length === 0) return '';

  const allPaths: string[] = [];
  for (const a of paths) {
    if (a.isDir) {
      // Resolve directory to file list
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

// ─── Component ────────────────────────────────────────────────────────────────

export const ChatPanel: React.FC<ChatPanelProps> = ({ settings, onOpenSettings }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [currentSettings, setCurrentSettings] = useState<LLMSettings>(settings);
  const [mode, setMode] = useState<AppMode>(loadSavedMode);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [rootDir, setRootDir] = useState('');

  // ── Per-mode "pending send" state ──────────────────────────────────────────
  // When mode ≠ 'chat', a sent message is queued here and picked up by the
  // active mode panel (AgentPanel / PlanPanel) via prop.
  const [pendingAgentSend, setPendingAgentSend] = useState<{
    text: string;
    contextText: string;
    seq: number;
  } | null>(null);
  const [pendingPlanSend, setPendingPlanSend] = useState<{
    text: string;
    contextText: string;
    seq: number;
  } | null>(null);

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

    // Fetch the server's cwd for @ mention root via workspace info
    _api.getWorkspaceInfo('').then(info => {
      setRootDir(info.rootDir || '');
    }).catch(() => {
      // Fallback: empty string means backend uses os.getcwd()
      setRootDir('');
    });
  }, []);

  useEffect(() => {
    chatModelRef.current?.updateSettings(currentSettings);
  }, [currentSettings]);

  // ── Mode switching ─────────────────────────────────────────────────────────
  const handleModeChange = useCallback((m: AppMode) => {
    setMode(m);
    try { localStorage.setItem(MODE_STORAGE_KEY, m); } catch { /* ignore */ }
    setShowSettings(false);
    setShowMemory(false);
  }, []);

  // ── Unified send handler — routes to the active mode ──────────────────────
  const handleSend = useCallback(async (
    text: string,
    images: ImageData[],
    attachedPaths: AttachedPath[],
  ) => {
    if (!chatModelRef.current) return;

    // Build context string from attached paths
    const contextText = await buildContextFromAttachments(attachedPaths, rootDir);
    const fullText = contextText ? `${contextText}${text}` : text;

    if (mode === 'chat') {
      try {
        await chatModelRef.current.sendMessage(fullText, images, undefined);
      } catch (err) {
        console.error('Failed to send message:', err);
      }
    } else if (mode === 'agent') {
      setPendingAgentSend(prev => ({
        text: fullText,
        contextText,
        seq: (prev?.seq ?? 0) + 1,
      }));
    } else if (mode === 'plan') {
      setPendingPlanSend(prev => ({
        text: fullText,
        contextText,
        seq: (prev?.seq ?? 0) + 1,
      }));
    }
  }, [mode, rootDir]);

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
  }, []);

  const handleToggleMemory = useCallback(() => {
    setShowMemory(v => !v);
    setShowSettings(false);
  }, []);

  const hasApiKey = currentSettings.hasApiKey ||
    (currentSettings.apiKey && currentSettings.apiKey.length > 0);

  // ── Header ─────────────────────────────────────────────────────────────────
  const header = (
    <div className="llm-chat-header">
      <h3>LLM Assistant</h3>
      <div className="llm-header-actions">
        {/* Memory */}
        <button
          className={`llm-header-btn ${showMemory ? 'active' : ''}`}
          onClick={handleToggleMemory}
          title="Memory — persistent context injected into every conversation"
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
          </svg>
        </button>

        {/* Clear (chat mode only) */}
        {mode === 'chat' && !showSettings && !showMemory && (
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

  // ── Side panel overlays ────────────────────────────────────────────────────
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

  // ── Main layout ────────────────────────────────────────────────────────────
  // All modes render the same InputArea at the bottom.
  // The message viewport above changes depending on mode.

  return (
    <div className="llm-chat-panel llm-unified-panel">
      {header}

      {/* ── Mode viewport ──────────────────────────────────────────────── */}
      <div className="llm-mode-viewport">
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
            <div className="llm-model-indicator">
              <span className="llm-model-name">{currentSettings.model}</span>
              {!hasApiKey && (
                <span className="llm-api-warning">API Key not set</span>
              )}
            </div>
            <MessageList messages={messages} isLoading={isLoading} />
          </>
        )}

        {mode === 'agent' && (
          <AgentPanel
            settings={currentSettings}
            mode={mode}
            onModeChange={handleModeChange}
            pendingSend={pendingAgentSend}
            onPendingConsumed={() => setPendingAgentSend(null)}
          />
        )}

        {mode === 'plan' && (
          <PlanPanel
            settings={currentSettings}
            mode={mode}
            onModeChange={handleModeChange}
            pendingSend={pendingPlanSend}
            onPendingConsumed={() => setPendingPlanSend(null)}
          />
        )}
      </div>

      {/* ── Unified InputArea — always visible ────────────────────────── */}
      <InputArea
        onSend={handleSend}
        disabled={
          (mode === 'chat' && isLoading) ||
          !hasApiKey
        }
        mode={mode}
        onModeChange={handleModeChange}
        rootDir={rootDir}
      />
    </div>
  );
};

export default ChatPanel;

// ─────────────────────────────────────────────────────────────────────────────
// TODO: Skill System (future feature)
// ─────────────────────────────────────────────────────────────────────────────
//
// Planned implementation inspired by Claude Code's skill / tool registry:
//
// 1. Skill Registry Panel (new component: SkillsPanel.tsx)
//    - Fetches the official Claude Code skill repository index from:
//      https://github.com/anthropics/claude-code/tree/main/skills  (or similar)
//    - Displays a marketplace-style list: name, description, author, install button
//    - Installed skills persisted in ~/.jupyter/llm_assistant_skills.json
//
// 2. Backend endpoint (skill_handler.py)
//    POST /llm-assistant/skills/install   { name, url }  → clone / fetch YAML
//    GET  /llm-assistant/skills           → list installed skills
//    DELETE /llm-assistant/skills/:name   → remove
//
// 3. Skill execution
//    - Each skill is a YAML manifest: { name, description, tools: [...], prompt: "..." }
//    - On "use skill X" command in chat/agent, inject the skill's system-prompt fragment
//      and register its custom tools with the agent_loop before the run starts.
//    - Skills can extend the tool registry with arbitrary Python callables (sandboxed).
//
// 4. UI entry point
//    - New header button "Skills" (⚡ icon) opens SkillsPanel overlay.
//    - In the @ mention menu, skills appear as a special category: @skill:<name>
//
// ─────────────────────────────────────────────────────────────────────────────
