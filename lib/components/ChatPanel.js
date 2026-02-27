import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Main chat panel component.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { ChatModel } from '../models/chat';
import { SettingsModel } from '../models/settings';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { SettingsPanel } from './SettingsPanel';
/**
 * Main chat panel component
 */
export const ChatPanel = ({ settings, onOpenSettings }) => {
    const [showSettings, setShowSettings] = useState(false);
    const [currentSettings, setCurrentSettings] = useState(settings);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    // Create model instances
    const chatModelRef = useRef(null);
    const settingsModelRef = useRef(null);
    // State for re-rendering
    const [messages, setMessages] = useState(chatModelRef.current?.messages || []);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    // Initialize models
    useEffect(() => {
        if (!chatModelRef.current) {
            chatModelRef.current = new ChatModel(currentSettings);
            settingsModelRef.current = new SettingsModel(currentSettings);
            // Load saved settings
            settingsModelRef.current.loadSettings().then((loadedSettings) => {
                setCurrentSettings(loadedSettings);
                chatModelRef.current?.updateSettings(loadedSettings);
            });
            // Subscribe to model changes
            chatModelRef.current.messagesChanged.connect((_, newMessages) => {
                setMessages([...newMessages]);
            });
            chatModelRef.current.loadingChanged.connect((_, loading) => {
                setIsLoading(loading);
            });
            chatModelRef.current.errorChanged.connect((_, err) => {
                setError(err);
            });
        }
        return () => {
            // Cleanup
        };
    }, []);
    // Update chat model when settings change
    useEffect(() => {
        chatModelRef.current?.updateSettings(currentSettings);
    }, [currentSettings]);
    // Handle send message
    const handleSend = useCallback(async (text, images) => {
        if (!chatModelRef.current)
            return;
        try {
            await chatModelRef.current.sendMessage(text, images);
        }
        catch (err) {
            console.error('Failed to send message:', err);
        }
    }, []);
    // Handle clear chat
    const handleClear = useCallback(() => {
        if (!chatModelRef.current)
            return;
        chatModelRef.current.clear();
    }, []);
    // Handle settings change
    const handleSettingsChange = useCallback(async (newSettings) => {
        if (!settingsModelRef.current)
            return;
        try {
            await settingsModelRef.current.saveSettings(newSettings);
            setCurrentSettings((prev) => ({ ...prev, ...newSettings }));
        }
        catch (err) {
            console.error('Failed to save settings:', err);
        }
    }, []);
    // Handle test connection
    const handleTestConnection = useCallback(async () => {
        if (!settingsModelRef.current) {
            return { success: false, error: 'Settings not initialized' };
        }
        setIsTestingConnection(true);
        try {
            // Save current settings first
            await settingsModelRef.current.saveSettings(currentSettings);
            const result = await settingsModelRef.current.testConnection();
            return result;
        }
        finally {
            setIsTestingConnection(false);
        }
    }, [currentSettings]);
    // Handle close settings
    const handleCloseSettings = useCallback(() => {
        setShowSettings(false);
    }, []);
    // Handle open settings
    const handleOpenSettingsPanel = useCallback(() => {
        setShowSettings(true);
    }, []);
    return (_jsxs("div", { className: "llm-chat-panel", children: [_jsxs("div", { className: "llm-chat-header", children: [_jsx("h3", { children: "LLM Assistant" }), _jsxs("div", { className: "llm-header-actions", children: [_jsx("button", { className: "llm-header-btn", onClick: handleClear, title: "Clear chat", children: _jsx("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "currentColor", children: _jsx("path", { d: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" }) }) }), _jsx("button", { className: "llm-header-btn", onClick: handleOpenSettingsPanel, title: "Settings", children: _jsx("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "currentColor", children: _jsx("path", { d: "M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" }) }) })] })] }), showSettings ? (_jsx(SettingsPanel, { settings: currentSettings, onSettingsChange: handleSettingsChange, onClose: handleCloseSettings, onTestConnection: handleTestConnection, isTestingConnection: isTestingConnection })) : (_jsxs(_Fragment, { children: [error && (_jsxs("div", { className: "llm-error-banner", children: [_jsx("span", { children: error }), _jsx("button", { onClick: () => setError(null), children: _jsx("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "currentColor", children: _jsx("path", { d: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" }) }) })] })), _jsxs("div", { className: "llm-model-indicator", children: [_jsx("span", { className: "llm-model-name", children: currentSettings.model }), !(currentSettings.hasApiKey || (currentSettings.apiKey && currentSettings.apiKey.length > 0)) && (_jsx("span", { className: "llm-api-warning", children: "API Key not set" }))] }), _jsx(MessageList, { messages: messages, isLoading: isLoading }), _jsx(InputArea, { onSend: handleSend, disabled: isLoading || !(currentSettings.hasApiKey || (currentSettings.apiKey && currentSettings.apiKey.length > 0)), enableVision: currentSettings.enableVision })] }))] }));
};
export default ChatPanel;
//# sourceMappingURL=ChatPanel.js.map