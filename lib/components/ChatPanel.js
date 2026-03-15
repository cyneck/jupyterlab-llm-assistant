import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Main panel component — three modes in one unified shell.
 *
 * Mode selector (Chat | Agent | Plan) lives in the **InputArea** footer
 * dropdown, keeping the header clean for utility buttons.
 * Memory and Context-file panels are shared across all modes.
 *
 * v0.6.0 changes:
 * - Moved mode selector from header buttons → InputArea dropdown
 * - InputArea now owns mode + onModeChange props
 * - @ file-reference support in InputArea
 * - Skill system TODO added (see bottom of file)
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
import { ContextFilePanel, loadContextState } from './ContextFilePanel';
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
export const ChatPanel = ({ settings, onOpenSettings }) => {
    const [showSettings, setShowSettings] = useState(false);
    const [showMemory, setShowMemory] = useState(false);
    const [showContext, setShowContext] = useState(false);
    const [currentSettings, setCurrentSettings] = useState(settings);
    const [mode, setMode] = useState(loadSavedMode);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    // Context state (shared across all modes)
    const [contextText, setContextText] = useState('');
    const [contextState, setContextState] = useState(() => loadContextState());
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
        // Close any open side panels when switching modes
        setShowSettings(false);
        setShowMemory(false);
        setShowContext(false);
    }, []);
    // ── Context ────────────────────────────────────────────────────────────────
    const handleContextChange = useCallback((text, state) => {
        setContextText(text);
        setContextState(state);
    }, []);
    // ── Chat handlers ──────────────────────────────────────────────────────────
    const handleSend = useCallback(async (text, images) => {
        if (!chatModelRef.current)
            return;
        try {
            await chatModelRef.current.sendMessage(text, images, contextText || undefined);
        }
        catch (err) {
            console.error('Failed to send message:', err);
        }
    }, [contextText]);
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
    // NOTE: Mode selector moved to InputArea footer dropdown (v0.6.0)
    const header = (_jsxs("div", { className: "llm-chat-header", children: [_jsx("h3", { children: "LLM Assistant" }), _jsxs("div", { className: "llm-header-actions", children: [_jsx("button", { className: `llm-header-btn ${showMemory ? 'active' : ''}`, onClick: handleToggleMemory, title: "Memory \u2014 persistent context injected into every conversation", children: _jsx("svg", { viewBox: "0 0 24 24", width: "17", height: "17", fill: "currentColor", children: _jsx("path", { d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" }) }) }), _jsxs("button", { className: `llm-header-btn ${showContext ? 'active' : ''} ${contextFileCount > 0 ? 'llm-header-btn-has-context' : ''}`, onClick: handleToggleContext, title: `Context files${contextFileCount > 0 ? ` (${contextFileCount} selected)` : ''}`, children: [_jsx("svg", { viewBox: "0 0 24 24", width: "17", height: "17", fill: "currentColor", children: _jsx("path", { d: "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" }) }), contextFileCount > 0 && (_jsx("span", { className: "llm-context-badge", children: contextFileCount }))] }), mode === 'chat' && !showSettings && !showMemory && !showContext && (_jsx("button", { className: "llm-header-btn", onClick: handleClear, title: "Clear chat", children: _jsx("svg", { viewBox: "0 0 24 24", width: "17", height: "17", fill: "currentColor", children: _jsx("path", { d: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" }) }) })), _jsx("button", { className: `llm-header-btn ${showSettings ? 'active' : ''}`, onClick: handleOpenSettings, title: "Settings", children: _jsx("svg", { viewBox: "0 0 24 24", width: "17", height: "17", fill: "currentColor", children: _jsx("path", { d: "M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" }) }) })] })] }));
    // ── Render side panels (overlay) ──────────────────────────────────────────
    if (showSettings) {
        return (_jsxs("div", { className: "llm-chat-panel", children: [header, _jsx(SettingsPanel, { settings: currentSettings, onSettingsChange: handleSettingsChange, onClose: () => setShowSettings(false), onTestConnection: handleTestConnection, isTestingConnection: isTestingConnection })] }));
    }
    if (showMemory) {
        return (_jsxs("div", { className: "llm-chat-panel", children: [header, _jsx(MemoryPanel, { onClose: () => setShowMemory(false) })] }));
    }
    if (showContext) {
        return (_jsxs("div", { className: "llm-chat-panel", children: [header, _jsx(ContextFilePanel, { onContextChange: handleContextChange, initialState: contextState ?? undefined, onClose: () => setShowContext(false) })] }));
    }
    // ── Main content by mode ───────────────────────────────────────────────────
    return (_jsxs("div", { className: "llm-chat-panel", children: [header, mode === 'agent' && (_jsx(AgentPanel, { settings: currentSettings, contextText: contextText, contextFileCount: contextFileCount, mode: mode, onModeChange: handleModeChange })), mode === 'plan' && (_jsx(PlanPanel, { settings: currentSettings, contextText: contextText, contextFileCount: contextFileCount, mode: mode, onModeChange: handleModeChange })), mode === 'chat' && (_jsxs(_Fragment, { children: [error && (_jsxs("div", { className: "llm-error-banner", children: [_jsx("span", { children: error }), _jsx("button", { onClick: () => setError(null), children: _jsx("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "currentColor", children: _jsx("path", { d: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" }) }) })] })), contextFileCount > 0 && (_jsxs("div", { className: "llm-context-indicator", onClick: handleToggleContext, title: "Click to manage context files", children: [_jsx("svg", { viewBox: "0 0 24 24", width: "11", height: "11", fill: "currentColor", children: _jsx("path", { d: "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" }) }), _jsxs("span", { children: [contextFileCount, " context file", contextFileCount !== 1 ? 's' : '', " active"] })] })), _jsxs("div", { className: "llm-model-indicator", children: [_jsx("span", { className: "llm-model-name", children: currentSettings.model }), !(currentSettings.hasApiKey || (currentSettings.apiKey && currentSettings.apiKey.length > 0)) && (_jsx("span", { className: "llm-api-warning", children: "API Key not set" }))] }), _jsx(MessageList, { messages: messages, isLoading: isLoading }), _jsx(InputArea, { onSend: handleSend, disabled: isLoading || !(currentSettings.hasApiKey || (currentSettings.apiKey && currentSettings.apiKey.length > 0)), enableVision: currentSettings.enableVision, mode: mode, onModeChange: handleModeChange })] }))] }));
};
export default ChatPanel;
//# sourceMappingURL=ChatPanel.js.map