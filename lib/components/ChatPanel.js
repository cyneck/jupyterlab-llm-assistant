import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { useState, useCallback, useEffect, useRef } from 'react';
import { ChatModel } from '../models/chat';
import { SettingsModel } from '../models/settings';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { SettingsPanel } from './SettingsPanel';
import { AgentPanel } from './AgentPanel';
import { PlanPanel } from './PlanPanel';
import { MemoryPanel } from './MemoryPanel';
import { LLMApiService } from '../services/api';
const MODE_STORAGE_KEY = 'jlab-llm-mode';
function loadSavedMode() {
    try {
        const raw = localStorage.getItem(MODE_STORAGE_KEY);
        if (raw === 'agent' || raw === 'plan' || raw === 'chat')
            return raw;
    }
    catch { /* ignore */ }
    return 'chat';
}
const _api = new LLMApiService();
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Given a list of AttachedPath chips, fetch their content from the backend
 * and format as a context block to prepend to the message.
 */
async function buildContextFromAttachments(paths, rootDir) {
    if (paths.length === 0)
        return '';
    const allPaths = [];
    for (const a of paths) {
        if (a.isDir) {
            // Resolve directory to file list
            try {
                const res = await _api.resolveContextPath(a.path, rootDir);
                allPaths.push(...res.paths.slice(0, 20));
            }
            catch { /* skip */ }
        }
        else {
            allPaths.push(a.path);
        }
    }
    if (allPaths.length === 0)
        return '';
    try {
        const res = await _api.readContextFiles(allPaths, rootDir);
        const parts = [];
        for (const f of res.files) {
            if (f.error)
                continue;
            parts.push(`\`\`\`// ${f.path}\n${f.content}\n\`\`\``);
        }
        if (parts.length === 0)
            return '';
        return `<attached_files>\n${parts.join('\n\n')}\n</attached_files>\n\n`;
    }
    catch {
        return '';
    }
}
// ─── Component ────────────────────────────────────────────────────────────────
export const ChatPanel = ({ settings, onOpenSettings }) => {
    const [showSettings, setShowSettings] = useState(false);
    const [showMemory, setShowMemory] = useState(false);
    const [currentSettings, setCurrentSettings] = useState(settings);
    const [mode, setMode] = useState(loadSavedMode);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [rootDir, setRootDir] = useState('');
    // ── Per-mode "pending send" state ──────────────────────────────────────────
    // When mode ≠ 'chat', a sent message is queued here and picked up by the
    // active mode panel (AgentPanel / PlanPanel) via prop.
    const [pendingAgentSend, setPendingAgentSend] = useState(null);
    const [pendingPlanSend, setPendingPlanSend] = useState(null);
    // Chat model refs
    const chatModelRef = useRef(null);
    const settingsModelRef = useRef(null);
    // Chat mode state
    const [messages, setMessages] = useState(chatModelRef.current?.messages || []);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
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
    const handleModeChange = useCallback((m) => {
        setMode(m);
        try {
            localStorage.setItem(MODE_STORAGE_KEY, m);
        }
        catch { /* ignore */ }
        setShowSettings(false);
        setShowMemory(false);
    }, []);
    // ── Unified send handler — routes to the active mode ──────────────────────
    const handleSend = useCallback(async (text, images, attachedPaths) => {
        if (!chatModelRef.current)
            return;
        // Build context string from attached paths
        const contextText = await buildContextFromAttachments(attachedPaths, rootDir);
        const fullText = contextText ? `${contextText}${text}` : text;
        if (mode === 'chat') {
            try {
                await chatModelRef.current.sendMessage(fullText, images, undefined);
            }
            catch (err) {
                console.error('Failed to send message:', err);
            }
        }
        else if (mode === 'agent') {
            setPendingAgentSend(prev => ({
                text: fullText,
                contextText,
                seq: (prev?.seq ?? 0) + 1,
            }));
        }
        else if (mode === 'plan') {
            setPendingPlanSend(prev => ({
                text: fullText,
                contextText,
                seq: (prev?.seq ?? 0) + 1,
            }));
        }
    }, [mode, rootDir]);
    const handleClear = useCallback(() => chatModelRef.current?.clear(), []);
    // ── Settings handlers ──────────────────────────────────────────────────────
    const handleSettingsChange = useCallback(async (newSettings) => {
        if (!settingsModelRef.current)
            return;
        try {
            await settingsModelRef.current.saveSettings(newSettings);
            setCurrentSettings(prev => ({ ...prev, ...newSettings }));
        }
        catch (err) {
            console.error('Failed to save settings:', err);
        }
    }, []);
    const handleTestConnection = useCallback(async () => {
        if (!settingsModelRef.current)
            return { success: false, error: 'Not initialized' };
        setIsTestingConnection(true);
        try {
            await settingsModelRef.current.saveSettings(currentSettings);
            return await settingsModelRef.current.testConnection();
        }
        finally {
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
    const header = (_jsxs("div", { className: "llm-chat-header", children: [_jsx("h3", { children: "LLM Assistant" }), _jsxs("div", { className: "llm-header-actions", children: [_jsx("button", { className: `llm-header-btn ${showMemory ? 'active' : ''}`, onClick: handleToggleMemory, title: "Memory \u2014 persistent context injected into every conversation", children: _jsx("svg", { viewBox: "0 0 24 24", width: "17", height: "17", fill: "currentColor", children: _jsx("path", { d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" }) }) }), mode === 'chat' && !showSettings && !showMemory && (_jsx("button", { className: "llm-header-btn", onClick: handleClear, title: "Clear chat", children: _jsx("svg", { viewBox: "0 0 24 24", width: "17", height: "17", fill: "currentColor", children: _jsx("path", { d: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" }) }) })), _jsx("button", { className: `llm-header-btn ${showSettings ? 'active' : ''}`, onClick: handleOpenSettings, title: "Settings", children: _jsx("svg", { viewBox: "0 0 24 24", width: "17", height: "17", fill: "currentColor", children: _jsx("path", { d: "M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" }) }) })] })] }));
    // ── Side panel overlays ────────────────────────────────────────────────────
    if (showSettings) {
        return (_jsxs("div", { className: "llm-chat-panel", children: [header, _jsx(SettingsPanel, { settings: currentSettings, onSettingsChange: handleSettingsChange, onClose: () => setShowSettings(false), onTestConnection: handleTestConnection, isTestingConnection: isTestingConnection })] }));
    }
    if (showMemory) {
        return (_jsxs("div", { className: "llm-chat-panel", children: [header, _jsx(MemoryPanel, { onClose: () => setShowMemory(false) })] }));
    }
    // ── Main layout ────────────────────────────────────────────────────────────
    // All modes render the same InputArea at the bottom.
    // The message viewport above changes depending on mode.
    return (_jsxs("div", { className: "llm-chat-panel llm-unified-panel", children: [header, _jsxs("div", { className: "llm-mode-viewport", children: [mode === 'chat' && (_jsxs(_Fragment, { children: [error && (_jsxs("div", { className: "llm-error-banner", children: [_jsx("span", { children: error }), _jsx("button", { onClick: () => setError(null), children: _jsx("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "currentColor", children: _jsx("path", { d: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" }) }) })] })), _jsxs("div", { className: "llm-model-indicator", children: [_jsx("span", { className: "llm-model-name", children: currentSettings.model }), !hasApiKey && (_jsx("span", { className: "llm-api-warning", children: "API Key not set" }))] }), _jsx(MessageList, { messages: messages, isLoading: isLoading })] })), mode === 'agent' && (_jsx(AgentPanel, { settings: currentSettings, mode: mode, onModeChange: handleModeChange, pendingSend: pendingAgentSend, onPendingConsumed: () => setPendingAgentSend(null) })), mode === 'plan' && (_jsx(PlanPanel, { settings: currentSettings, mode: mode, onModeChange: handleModeChange, pendingSend: pendingPlanSend, onPendingConsumed: () => setPendingPlanSend(null) }))] }), _jsx(InputArea, { onSend: handleSend, disabled: (mode === 'chat' && isLoading) ||
                    !hasApiKey, mode: mode, onModeChange: handleModeChange, rootDir: rootDir })] }));
};
export default ChatPanel;
//# sourceMappingURL=ChatPanel.js.map