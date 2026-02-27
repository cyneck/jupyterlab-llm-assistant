"use strict";
(self["webpackChunkjupyterlab_llm_assistant"] = self["webpackChunkjupyterlab_llm_assistant"] || []).push([["lib_index_js"],{

/***/ "./lib/components/ChatPanel.js"
/*!*************************************!*\
  !*** ./lib/components/ChatPanel.js ***!
  \*************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ChatPanel: () => (/* binding */ ChatPanel),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "./node_modules/react/jsx-runtime.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _models_chat__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../models/chat */ "./lib/models/chat.js");
/* harmony import */ var _models_settings__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../models/settings */ "./lib/models/settings.js");
/* harmony import */ var _MessageList__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./MessageList */ "./lib/components/MessageList.js");
/* harmony import */ var _InputArea__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./InputArea */ "./lib/components/InputArea.js");
/* harmony import */ var _SettingsPanel__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./SettingsPanel */ "./lib/components/SettingsPanel.js");

/**
 * Main chat panel component.
 */






/**
 * Main chat panel component
 */
const ChatPanel = ({ settings, onOpenSettings }) => {
    const [showSettings, setShowSettings] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [currentSettings, setCurrentSettings] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(settings);
    const [isTestingConnection, setIsTestingConnection] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    // Create model instances
    const chatModelRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
    const settingsModelRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
    // State for re-rendering
    const [messages, setMessages] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(chatModelRef.current?.messages || []);
    const [isLoading, setIsLoading] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    // Initialize models
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        if (!chatModelRef.current) {
            chatModelRef.current = new _models_chat__WEBPACK_IMPORTED_MODULE_2__.ChatModel(currentSettings);
            settingsModelRef.current = new _models_settings__WEBPACK_IMPORTED_MODULE_3__.SettingsModel(currentSettings);
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
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        chatModelRef.current?.updateSettings(currentSettings);
    }, [currentSettings]);
    // Handle send message
    const handleSend = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async (text, images) => {
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
    const handleClear = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
        if (!chatModelRef.current)
            return;
        chatModelRef.current.clear();
    }, []);
    // Handle settings change
    const handleSettingsChange = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async (newSettings) => {
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
    const handleTestConnection = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
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
    const handleCloseSettings = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
        setShowSettings(false);
    }, []);
    // Handle open settings
    const handleOpenSettingsPanel = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
        setShowSettings(true);
    }, []);
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-chat-panel", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-chat-header", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "LLM Assistant" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-header-actions", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { className: "llm-header-btn", onClick: handleClear, title: "Clear chat", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "currentColor", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" }) }) }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { className: "llm-header-btn", onClick: handleOpenSettingsPanel, title: "Settings", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "currentColor", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" }) }) })] })] }), showSettings ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_SettingsPanel__WEBPACK_IMPORTED_MODULE_6__.SettingsPanel, { settings: currentSettings, onSettingsChange: handleSettingsChange, onClose: handleCloseSettings, onTestConnection: handleTestConnection, isTestingConnection: isTestingConnection })) : ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment, { children: [error && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-error-banner", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: error }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { onClick: () => setError(null), children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "currentColor", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" }) }) })] })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-model-indicator", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "llm-model-name", children: currentSettings.model }), !(currentSettings.hasApiKey || (currentSettings.apiKey && currentSettings.apiKey.length > 0)) && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "llm-api-warning", children: "API Key not set" }))] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_MessageList__WEBPACK_IMPORTED_MODULE_4__.MessageList, { messages: messages, isLoading: isLoading }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_InputArea__WEBPACK_IMPORTED_MODULE_5__.InputArea, { onSend: handleSend, disabled: isLoading || !(currentSettings.hasApiKey || (currentSettings.apiKey && currentSettings.apiKey.length > 0)), enableVision: currentSettings.enableVision })] }))] }));
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ChatPanel);


/***/ },

/***/ "./lib/components/CodeBlock.js"
/*!*************************************!*\
  !*** ./lib/components/CodeBlock.js ***!
  \*************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CodeBlock: () => (/* binding */ CodeBlock),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "./node_modules/react/jsx-runtime.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var highlight_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! highlight.js */ "webpack/sharing/consume/default/highlight.js/highlight.js");

/**
 * Code block component with copy functionality.
 */


/**
 * Code block with syntax highlighting and copy button
 */
const CodeBlock = ({ code, language }) => {
    const [copied, setCopied] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const codeRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
    // Apply syntax highlighting
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        if (codeRef.current) {
            highlight_js__WEBPACK_IMPORTED_MODULE_2__["default"].highlightElement(codeRef.current);
        }
    }, [code, language]);
    // Handle copy to clipboard
    const handleCopy = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch (err) {
            console.error('Failed to copy:', err);
        }
    }, [code]);
    // Normalize language name
    const normalizedLanguage = language || 'plaintext';
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-code-block", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-code-header", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "llm-code-language", children: normalizedLanguage }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("button", { className: "llm-code-copy-btn", onClick: handleCopy, title: copied ? 'Copied!' : 'Copy code', children: [copied ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "currentColor", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" }) })) : ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "currentColor", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" }) })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: copied ? 'Copied!' : 'Copy' })] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("pre", { className: "llm-code-content", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("code", { ref: codeRef, className: `language-${normalizedLanguage}`, children: code }) })] }));
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CodeBlock);


/***/ },

/***/ "./lib/components/InputArea.js"
/*!*************************************!*\
  !*** ./lib/components/InputArea.js ***!
  \*************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   InputArea: () => (/* binding */ InputArea),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "./node_modules/react/jsx-runtime.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);

/**
 * Input area component for chat messages.
 */

/**
 * Generate unique ID
 */
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Input area component with text input and image upload
 */
const InputArea = ({ onSend, disabled, enableVision, }) => {
    const [text, setText] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)('');
    const [images, setImages] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)([]);
    const textareaRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
    const fileInputRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
    // Auto-resize textarea
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [text]);
    // Handle text change
    const handleTextChange = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((e) => {
        setText(e.target.value);
    }, []);
    // Handle image file selection
    const handleImageSelect = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0)
            return;
        const newImages = [];
        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/'))
                continue;
            // Read file as data URL
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
            newImages.push({
                id: generateId(),
                dataUrl,
                file,
                preview: dataUrl,
            });
        }
        setImages((prev) => [...prev, ...newImages]);
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);
    // Handle paste event for images
    const handlePaste = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async (e) => {
        if (!enableVision)
            return;
        const items = e.clipboardData.items;
        const newImages = [];
        for (const item of Array.from(items)) {
            if (!item.type.startsWith('image/'))
                continue;
            const file = item.getAsFile();
            if (!file)
                continue;
            // Read file as data URL
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
            newImages.push({
                id: generateId(),
                dataUrl,
                file,
                preview: dataUrl,
            });
        }
        if (newImages.length > 0) {
            setImages((prev) => [...prev, ...newImages]);
        }
    }, [enableVision]);
    // Remove image
    const handleRemoveImage = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((id) => {
        setImages((prev) => prev.filter((img) => img.id !== id));
    }, []);
    // Handle send
    const handleSend = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
        if (disabled)
            return;
        if (!text.trim() && images.length === 0)
            return;
        onSend(text.trim(), images);
        setText('');
        setImages([]);
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [text, images, disabled, onSend]);
    // Handle keyboard shortcuts
    const handleKeyDown = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((e) => {
        // Send on Enter (without Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);
    // Handle image button click
    const handleImageButtonClick = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
        fileInputRef.current?.click();
    }, []);
    const canSend = !disabled && (text.trim().length > 0 || images.length > 0);
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-input-area", children: [images.length > 0 && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "llm-image-previews", children: images.map((image) => ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-image-preview", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("img", { src: image.preview, alt: "Preview" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { className: "llm-image-remove", onClick: () => handleRemoveImage(image.id), title: "Remove image", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("svg", { viewBox: "0 0 24 24", width: "14", height: "14", fill: "currentColor", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" }) }) })] }, image.id))) })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-input-row", children: [enableVision && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment, { children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { ref: fileInputRef, type: "file", accept: "image/*", multiple: true, onChange: handleImageSelect, style: { display: 'none' } }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { className: "llm-image-btn", onClick: handleImageButtonClick, disabled: disabled, title: "Attach image", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "currentColor", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" }) }) })] })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("textarea", { ref: textareaRef, className: "llm-text-input", value: text, onChange: handleTextChange, onKeyDown: handleKeyDown, onPaste: handlePaste, placeholder: enableVision ? "Send a message... (paste images supported)" : "Send a message...", disabled: disabled, rows: 1 }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { className: "llm-send-btn", onClick: handleSend, disabled: !canSend, title: "Send message (Enter)", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "currentColor", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" }) }) })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "llm-input-hint", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: "Enter to send, Shift+Enter for new line" }) })] }));
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (InputArea);


/***/ },

/***/ "./lib/components/MarkdownRenderer.js"
/*!********************************************!*\
  !*** ./lib/components/MarkdownRenderer.js ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MarkdownRenderer: () => (/* binding */ MarkdownRenderer),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "./node_modules/react/jsx-runtime.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_markdown__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-markdown */ "webpack/sharing/consume/default/react-markdown/react-markdown");
/* harmony import */ var remark_gfm__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! remark-gfm */ "webpack/sharing/consume/default/remark-gfm/remark-gfm");
/* harmony import */ var _CodeBlock__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./CodeBlock */ "./lib/components/CodeBlock.js");

/**
 * Markdown renderer component.
 */




/**
 * Custom paragraph component
 */
const Paragraph = ({ children }) => {
    return (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { className: "llm-md-paragraph", children: children });
};
/**
 * Custom link component
 */
const Link = ({ href, children }) => {
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("a", { href: href, target: "_blank", rel: "noopener noreferrer", className: "llm-md-link", children: children }));
};
/**
 * Custom code component
 */
const Code = ({ inline, className, children }) => {
    const match = /language-(\w+)/.exec(className || '');
    const lang = match ? match[1] : '';
    const codeString = String(children).replace(/\n$/, '');
    if (inline) {
        return (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("code", { className: "llm-md-code-inline", children: children });
    }
    // Check if it's a code block with language
    if (lang || codeString.includes('\n')) {
        return (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_CodeBlock__WEBPACK_IMPORTED_MODULE_4__.CodeBlock, { code: codeString, language: lang });
    }
    // Single line code without language
    return (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("code", { className: "llm-md-code-inline", children: children });
};
/**
 * Custom pre component (we handle this in Code component)
 */
const Pre = ({ children }) => {
    return (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment, { children: children });
};
/**
 * Custom list components
 */
const Ul = ({ children }) => {
    return (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("ul", { className: "llm-md-list", children: children });
};
const Ol = ({ children }) => {
    return (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("ol", { className: "llm-md-list llm-md-list-ordered", children: children });
};
const Li = ({ children }) => {
    return (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("li", { className: "llm-md-list-item", children: children });
};
/**
 * Custom heading components
 */
const Heading = ({ level, children }) => {
    const Tag = `h${level}`;
    return (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(Tag, { className: `llm-md-heading llm-md-heading-${level}`, children: children });
};
/**
 * Custom blockquote component
 */
const Blockquote = ({ children }) => {
    return (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("blockquote", { className: "llm-md-blockquote", children: children });
};
/**
 * Custom table components
 */
const Table = ({ children }) => {
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "llm-md-table-wrapper", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("table", { className: "llm-md-table", children: children }) }));
};
const Th = ({ children }) => {
    return (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("th", { className: "llm-md-th", children: children });
};
const Td = ({ children }) => {
    return (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("td", { className: "llm-md-td", children: children });
};
/**
 * Markdown renderer component
 */
const MarkdownRenderer = ({ content }) => {
    // Memoize the components object
    const components = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => ({
        p: Paragraph,
        a: Link,
        code: Code,
        pre: Pre,
        ul: Ul,
        ol: Ol,
        li: Li,
        h1: ((props) => (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(Heading, { level: 1, ...props })),
        h2: ((props) => (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(Heading, { level: 2, ...props })),
        h3: ((props) => (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(Heading, { level: 3, ...props })),
        h4: ((props) => (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(Heading, { level: 4, ...props })),
        h5: ((props) => (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(Heading, { level: 5, ...props })),
        h6: ((props) => (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(Heading, { level: 6, ...props })),
        blockquote: Blockquote,
        table: Table,
        th: Th,
        td: Td,
    }), []);
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "llm-markdown-content", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(react_markdown__WEBPACK_IMPORTED_MODULE_2__["default"], { remarkPlugins: [remark_gfm__WEBPACK_IMPORTED_MODULE_3__["default"]], components: components, children: content }) }));
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MarkdownRenderer);


/***/ },

/***/ "./lib/components/MessageItem.js"
/*!***************************************!*\
  !*** ./lib/components/MessageItem.js ***!
  \***************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MessageItem: () => (/* binding */ MessageItem),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "./node_modules/react/jsx-runtime.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _MarkdownRenderer__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./MarkdownRenderer */ "./lib/components/MarkdownRenderer.js");

/**
 * Message item component.
 */


/**
 * Format timestamp to readable string
 */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });
}
/**
 * Message item component
 */
const MessageItem = ({ message }) => {
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';
    const isStreaming = message.isStreaming;
    // Parse message content
    const textContent = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
        if (typeof message.content === 'string') {
            return message.content;
        }
        // Handle array content (text + images)
        const textParts = message.content.filter((part) => part.type === 'text');
        return textParts.map((part) => part.text).join('');
    }, [message.content]);
    // Extract images from content
    const images = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
        if (typeof message.content === 'string') {
            return [];
        }
        return message.content.filter((part) => part.type === 'image_url');
    }, [message.content]);
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: `llm-message-item llm-message-${message.role}`, children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "llm-message-avatar", children: isUser ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "currentColor", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" }) })) : ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "currentColor", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" })] })) }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-message-content", children: [images.length > 0 && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "llm-message-images", children: images.map((img, index) => ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("img", { src: img.image_url.url, alt: `Attached image ${index + 1}`, className: "llm-message-image" }, index))) })), isAssistant ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "llm-message-text", children: textContent ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_MarkdownRenderer__WEBPACK_IMPORTED_MODULE_2__.MarkdownRenderer, { content: textContent })) : ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "llm-message-placeholder", children: isStreaming ? '...' : 'Empty response' })) })) : ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "llm-message-text llm-message-user-text", children: textContent })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-message-meta", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "llm-message-time", children: formatTimestamp(message.timestamp) }), isStreaming && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("span", { className: "llm-message-streaming", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "llm-streaming-dot" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "llm-streaming-dot" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "llm-streaming-dot" })] })), message.error && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "llm-message-error", children: message.error }))] })] })] }));
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MessageItem);


/***/ },

/***/ "./lib/components/MessageList.js"
/*!***************************************!*\
  !*** ./lib/components/MessageList.js ***!
  \***************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MessageList: () => (/* binding */ MessageList),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "./node_modules/react/jsx-runtime.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _MessageItem__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./MessageItem */ "./lib/components/MessageItem.js");

/**
 * Message list component.
 */


/**
 * Message list component with auto-scroll
 */
const MessageList = ({ messages, isLoading }) => {
    const listRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
    const bottomRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
    // Auto-scroll to bottom when new messages arrive
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);
    // Empty state
    if (messages.length === 0) {
        return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "llm-message-list llm-message-list-empty", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-empty-state", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "llm-empty-icon", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("svg", { viewBox: "0 0 24 24", width: "48", height: "48", fill: "currentColor", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" })] }) }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "LLM Coding Assistant" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { children: "Start a conversation to get help with your code." }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("ul", { className: "llm-empty-hints", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("li", { children: "Ask questions about code" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("li", { children: "Debug issues" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("li", { children: "Generate code snippets" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("li", { children: "Explain concepts" })] })] }) }));
    }
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-message-list", ref: listRef, children: [messages.map((message) => ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_MessageItem__WEBPACK_IMPORTED_MODULE_2__.MessageItem, { message: message }, message.id))), isLoading && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: "llm-loading-indicator", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-loading-dots", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", {}), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", {}), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", {})] }) })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { ref: bottomRef })] }));
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MessageList);


/***/ },

/***/ "./lib/components/SettingsPanel.js"
/*!*****************************************!*\
  !*** ./lib/components/SettingsPanel.js ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SettingsPanel: () => (/* binding */ SettingsPanel),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "./node_modules/react/jsx-runtime.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);

/**
 * Settings panel component.
 */

/**
 * API Provider options with default endpoints
 */
const PROVIDER_OPTIONS = [
    { value: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
    { value: 'anthropic', label: 'Anthropic (Claude)', endpoint: 'https://api.anthropic.com/v1', defaultModel: 'claude-3-sonnet-20240229' },
    { value: 'ollama', label: 'Ollama (Local)', endpoint: 'http://localhost:11434/v1', defaultModel: 'llama3' },
    { value: 'deepseek', label: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
    { value: 'qianwen', label: '阿里云通义千问', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-turbo' },
    { value: 'zhipu', label: '智谱AI', endpoint: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4' },
    { value: 'moonshot', label: 'Moonshot (月之暗面)', endpoint: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
    { value: 'siliconflow', label: 'SiliconFlow', endpoint: 'https://api.siliconflow.cn/v1', defaultModel: 'Qwen/Qwen2-7B-Instruct' },
    { value: 'custom', label: 'Custom (自定义)', endpoint: '', defaultModel: '' },
];
/**
 * Settings panel component
 */
const SettingsPanel = ({ settings, onSettingsChange, onClose, onTestConnection, isTestingConnection, }) => {
    // Find current provider based on endpoint
    const getCurrentProvider = () => {
        const provider = PROVIDER_OPTIONS.find(p => {
            if (p.value === 'custom')
                return false;
            return settings.apiEndpoint.includes(p.endpoint.replace('https://', '').replace('http://', '').split('/')[0]);
        });
        return provider || PROVIDER_OPTIONS.find(p => p.value === 'custom');
    };
    const [localSettings, setLocalSettings] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({
        ...settings,
        apiKey: settings.apiKey || '',
    });
    const [currentProvider, setCurrentProvider] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(getCurrentProvider());
    const [testResult, setTestResult] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [hasChanges, setHasChanges] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [showApiKey, setShowApiKey] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    // Update local settings when props change
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        setLocalSettings({
            ...settings,
            apiKey: settings.apiKey || '',
        });
        setCurrentProvider(getCurrentProvider());
    }, [settings]);
    // Check for changes
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
        const changed = JSON.stringify(localSettings) !== JSON.stringify(settings);
        setHasChanges(changed);
    }, [localSettings, settings]);
    // Handle input change
    const handleChange = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((key, value) => {
        setLocalSettings((prev) => ({
            ...prev,
            [key]: value,
        }));
    }, []);
    // Handle provider change
    const handleProviderChange = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((providerValue) => {
        const provider = PROVIDER_OPTIONS.find(p => p.value === providerValue);
        setCurrentProvider(provider);
        if (provider.value === 'custom') {
            // Custom: keep current endpoint and model
            setLocalSettings((prev) => ({
                ...prev,
                apiEndpoint: prev.apiEndpoint,
                model: prev.model,
            }));
        }
        else {
            // Predefined provider: auto-fill endpoint and default model
            setLocalSettings((prev) => ({
                ...prev,
                apiEndpoint: provider.endpoint,
                model: provider.defaultModel,
            }));
        }
    }, []);
    // Handle model change
    const handleModelChange = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((value) => {
        handleChange('model', value);
    }, [handleChange]);
    // Handle endpoint change
    const handleEndpointChange = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((value) => {
        setLocalSettings((prev) => ({
            ...prev,
            apiEndpoint: value,
        }));
        // If custom endpoint, mark as custom provider
        const isKnownProvider = PROVIDER_OPTIONS.some(p => p.value !== 'custom' && value.includes(p.endpoint.replace('https://', '').replace('http://', '').split('/')[0]));
        if (!isKnownProvider) {
            setCurrentProvider(PROVIDER_OPTIONS.find(p => p.value === 'custom'));
        }
    }, []);
    // Handle save
    const handleSave = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
        onSettingsChange(localSettings);
        setHasChanges(false);
    }, [localSettings, onSettingsChange]);
    // Handle test connection
    const handleTestConnection = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
        setTestResult(null);
        try {
            // First save the current settings to ensure test uses latest values
            await onSettingsChange(localSettings);
            setHasChanges(false);
            // Then test the connection
            const result = await onTestConnection();
            setTestResult(result);
        }
        catch (err) {
            setTestResult({
                success: false,
                error: err instanceof Error ? err.message : 'Connection test failed',
            });
        }
    }, [localSettings, onSettingsChange, onTestConnection]);
    // Check if API key is available
    const isApiKeyAvailable = localSettings.apiKey.trim().length > 0;
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-panel", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-header", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h3", { children: "Settings" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { className: "llm-close-btn", onClick: onClose, title: "Close settings", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "currentColor", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" }) }) })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-content", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-section", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h4", { className: "llm-section-title", children: "API Provider" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-field", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("label", { htmlFor: "provider", children: "Select Provider" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("select", { id: "provider", value: currentProvider.value, onChange: (e) => handleProviderChange(e.target.value), children: PROVIDER_OPTIONS.map((option) => ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("option", { value: option.value, children: option.label }, option.value))) })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-field", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("label", { htmlFor: "apiEndpoint", children: "API Endpoint" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { id: "apiEndpoint", type: "text", value: localSettings.apiEndpoint, onChange: (e) => handleEndpointChange(e.target.value), placeholder: "https://api.openai.com/v1" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { className: "llm-settings-hint", children: "The base URL for the API endpoint" })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-field", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("label", { htmlFor: "apiKey", children: "API Key" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-input-with-button", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { id: "apiKey", type: showApiKey ? 'text' : 'password', value: localSettings.apiKey, onChange: (e) => handleChange('apiKey', e.target.value), placeholder: currentProvider.value === 'ollama' ? 'any-value (Ollama local no auth)' : 'sk-...', className: "llm-api-key-input" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { className: "llm-toggle-visibility-btn", onClick: () => setShowApiKey(!showApiKey), title: showApiKey ? 'Hide API key' : 'Show API key', children: showApiKey ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "currentColor", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" }) })) : ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "currentColor", children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" }) })) })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { className: "llm-settings-hint", children: currentProvider.value === 'ollama'
                                            ? 'Ollama 本地部署无需认证，填写任意值即可'
                                            : 'Enter your API key' })] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-section", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h4", { className: "llm-section-title", children: "Model Configuration" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-field", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("label", { htmlFor: "model", children: "Model Name" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { id: "model", type: "text", value: localSettings.model, onChange: (e) => handleModelChange(e.target.value), placeholder: currentProvider.defaultModel || 'e.g., gpt-4o, llama3, qwen-turbo' }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { className: "llm-settings-hint", children: "Enter the model name supported by your API provider" })] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-section", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h4", { className: "llm-section-title", children: "Generation Parameters" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-field", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("label", { htmlFor: "temperature", children: ["Temperature: ", (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "llm-value", children: localSettings.temperature })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { id: "temperature", type: "range", min: "0", max: "2", step: "0.1", value: localSettings.temperature, onChange: (e) => handleChange('temperature', parseFloat(e.target.value)) }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { className: "llm-settings-hint", children: "Higher values (0-2) produce more creative outputs" })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-field", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("label", { htmlFor: "maxTokens", children: "Max Tokens" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { id: "maxTokens", type: "number", min: "1", max: "128000", value: localSettings.maxTokens, onChange: (e) => handleChange('maxTokens', parseInt(e.target.value, 10)) }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { className: "llm-settings-hint", children: "Maximum number of tokens in the response" })] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-section", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h4", { className: "llm-section-title", children: "System Prompt" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-field", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("textarea", { id: "systemPrompt", value: localSettings.systemPrompt, onChange: (e) => handleChange('systemPrompt', e.target.value), rows: 4, placeholder: "You are a helpful AI coding assistant..." }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { className: "llm-settings-hint", children: "Instructions that define the assistant's behavior" })] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-section", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("h4", { className: "llm-section-title", children: "Features" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-field llm-settings-toggle", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("label", { children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { type: "checkbox", checked: localSettings.enableStreaming, onChange: (e) => handleChange('enableStreaming', e.target.checked) }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: "Enable streaming responses" })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { className: "llm-settings-hint", children: "Stream responses in real-time" })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-field llm-settings-toggle", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("label", { children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", { type: "checkbox", checked: localSettings.enableVision, onChange: (e) => handleChange('enableVision', e.target.checked) }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { children: "Enable image input (Vision)" })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", { className: "llm-settings-hint", children: "Allow sending images to vision-capable models" })] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-section", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { className: "llm-test-btn", onClick: handleTestConnection, disabled: isTestingConnection || !isApiKeyAvailable, children: isTestingConnection ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment, { children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", { className: "llm-spinner" }), "Testing..."] })) : ('Test Connection') }), testResult && ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", { className: `llm-test-result ${testResult.success ? 'llm-test-success' : 'llm-test-error'}`, children: testResult.success ? ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("p", { children: ["\u2713 Connection successful! Model: ", testResult.model] })) : ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("p", { children: ["\u2717 Error: ", testResult.error] })) }))] })] }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", { className: "llm-settings-footer", children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { className: "llm-cancel-btn", onClick: onClose, children: "Cancel" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("button", { className: "llm-save-btn", onClick: handleSave, disabled: !hasChanges, children: "Save Changes" })] })] }));
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SettingsPanel);


/***/ },

/***/ "./lib/components/icons.js"
/*!*********************************!*\
  !*** ./lib/components/icons.js ***!
  \*********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   chatIcon: () => (/* binding */ chatIcon),
/* harmony export */   checkIcon: () => (/* binding */ checkIcon),
/* harmony export */   clearIcon: () => (/* binding */ clearIcon),
/* harmony export */   copyIcon: () => (/* binding */ copyIcon),
/* harmony export */   imageIcon: () => (/* binding */ imageIcon),
/* harmony export */   sendIcon: () => (/* binding */ sendIcon),
/* harmony export */   settingsIcon: () => (/* binding */ settingsIcon),
/* harmony export */   spinnerIcon: () => (/* binding */ spinnerIcon)
/* harmony export */ });
/* harmony import */ var _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/ui-components */ "webpack/sharing/consume/default/@jupyterlab/ui-components");
/* harmony import */ var _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_0__);
/**
 * Icons for the LLM Assistant extension.
 */

// Chat icon (SVG path)
const chatIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
  <path fill="currentColor" d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/>
</svg>`;
// Settings icon
const settingsIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
</svg>`;
// Send icon
const sendIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
</svg>`;
// Clear icon
const clearIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
</svg>`;
// Image icon
const imageIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
</svg>`;
// Copy icon
const copyIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
</svg>`;
// Check icon
const checkIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
</svg>`;
// Spinner icon
const spinnerIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" opacity="0.3"/>
  <path fill="currentColor" d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.42 3.58-8 8-8z"/>
</svg>`;
// Export icons
const chatIcon = new _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_0__.LabIcon({
    name: 'llm-assistant:chat',
    svgstr: chatIconSvg,
});
const settingsIcon = new _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_0__.LabIcon({
    name: 'llm-assistant:settings',
    svgstr: settingsIconSvg,
});
const sendIcon = new _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_0__.LabIcon({
    name: 'llm-assistant:send',
    svgstr: sendIconSvg,
});
const clearIcon = new _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_0__.LabIcon({
    name: 'llm-assistant:clear',
    svgstr: clearIconSvg,
});
const imageIcon = new _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_0__.LabIcon({
    name: 'llm-assistant:image',
    svgstr: imageIconSvg,
});
const copyIcon = new _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_0__.LabIcon({
    name: 'llm-assistant:copy',
    svgstr: copyIconSvg,
});
const checkIcon = new _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_0__.LabIcon({
    name: 'llm-assistant:check',
    svgstr: checkIconSvg,
});
const spinnerIcon = new _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_0__.LabIcon({
    name: 'llm-assistant:spinner',
    svgstr: spinnerIconSvg,
});


/***/ },

/***/ "./lib/index.js"
/*!**********************!*\
  !*** ./lib/index.js ***!
  \**********************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ChatModel: () => (/* reexport safe */ _models_chat__WEBPACK_IMPORTED_MODULE_5__.ChatModel),
/* harmony export */   LLMApiService: () => (/* reexport safe */ _services_api__WEBPACK_IMPORTED_MODULE_7__.LLMApiService),
/* harmony export */   LLMAssistantPanel: () => (/* reexport safe */ _widgets_LLMAssistantPanel__WEBPACK_IMPORTED_MODULE_4__.LLMAssistantPanel),
/* harmony export */   SettingsModel: () => (/* reexport safe */ _models_settings__WEBPACK_IMPORTED_MODULE_6__.SettingsModel),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/settingregistry */ "webpack/sharing/consume/default/@jupyterlab/settingregistry");
/* harmony import */ var _jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _jupyterlab_application__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @jupyterlab/application */ "webpack/sharing/consume/default/@jupyterlab/application");
/* harmony import */ var _jupyterlab_application__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_application__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @jupyterlab/apputils */ "webpack/sharing/consume/default/@jupyterlab/apputils");
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _components_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./components/icons */ "./lib/components/icons.js");
/* harmony import */ var _widgets_LLMAssistantPanel__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./widgets/LLMAssistantPanel */ "./lib/widgets/LLMAssistantPanel.js");
/* harmony import */ var _models_chat__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./models/chat */ "./lib/models/chat.js");
/* harmony import */ var _models_settings__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./models/settings */ "./lib/models/settings.js");
/* harmony import */ var _services_api__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./services/api */ "./lib/services/api.js");
/**
 * JupyterLab LLM Assistant Extension
 *
 * Main entry point for the extension.
 */





/**
 * The extension ID
 */
const PLUGIN_ID = 'jupyterlab-llm-assistant:plugin';
/**
 * The command IDs
 */
var CommandIDs;
(function (CommandIDs) {
    CommandIDs.openAssistant = 'llm-assistant:open';
    CommandIDs.clearChat = 'llm-assistant:clear';
})(CommandIDs || (CommandIDs = {}));
/**
 * The JupyterLab plugin
 */
const plugin = {
    id: PLUGIN_ID,
    autoStart: true,
    requires: [_jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_0__.ISettingRegistry],
    optional: [_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_2__.ICommandPalette, _jupyterlab_application__WEBPACK_IMPORTED_MODULE_1__.ILayoutRestorer],
    activate: activatePlugin,
};
/**
 * Activate the plugin
 */
async function activatePlugin(app, settingRegistry, palette, restorer) {
    console.log('JupyterLab LLM Assistant extension is activated!');
    // Create the sidebar panel
    const panel = new _widgets_LLMAssistantPanel__WEBPACK_IMPORTED_MODULE_4__.LLMAssistantPanel();
    panel.id = 'llm-assistant-panel';
    panel.title.icon = _components_icons__WEBPACK_IMPORTED_MODULE_3__.chatIcon;
    panel.title.caption = 'LLM Assistant';
    // Load settings
    let settings = {
        apiEndpoint: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: 'You are a helpful AI coding assistant. Help users with programming questions, explain code, debug issues, and provide code examples. Be concise and accurate.',
        enableStreaming: true,
        enableVision: true,
    };
    try {
        const settingValues = await settingRegistry.load(PLUGIN_ID);
        settings = {
            ...settings,
            ...settingValues.composite,
        };
        // Listen for settings changes
        settingRegistry.pluginChanged.connect(async () => {
            const newSettings = await settingRegistry.load(PLUGIN_ID);
            settings = {
                ...settings,
                ...newSettings.composite,
            };
        });
    }
    catch (error) {
        console.warn('Failed to load settings, using defaults:', error);
    }
    // Add to right sidebar
    app.shell.add(panel, 'right', { rank: 100 });
    // Restore panel state
    if (restorer) {
        restorer.add(panel, 'llm-assistant-panel');
    }
    // Add commands
    app.commands.addCommand(CommandIDs.openAssistant, {
        label: 'Open LLM Assistant',
        icon: _components_icons__WEBPACK_IMPORTED_MODULE_3__.chatIcon,
        execute: () => {
            app.shell.activateById(panel.id);
        },
    });
    app.commands.addCommand(CommandIDs.clearChat, {
        label: 'Clear LLM Assistant Chat',
        execute: () => {
            // This will be handled by the panel
            panel.node.dispatchEvent(new CustomEvent('llm-clear-chat'));
        },
    });
    // Add to command palette
    if (palette) {
        palette.addItem({
            command: CommandIDs.openAssistant,
            category: 'LLM Assistant',
        });
    }
    console.log('JupyterLab LLM Assistant extension activated successfully!');
}
/**
 * Export the plugin
 */
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (plugin);
/**
 * Export components and models for external use
 */






/***/ },

/***/ "./lib/models/chat.js"
/*!****************************!*\
  !*** ./lib/models/chat.js ***!
  \****************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ChatModel: () => (/* binding */ ChatModel)
/* harmony export */ });
/* harmony import */ var _lumino_signaling__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @lumino/signaling */ "webpack/sharing/consume/default/@lumino/signaling");
/* harmony import */ var _lumino_signaling__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_lumino_signaling__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _services_api__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../services/api */ "./lib/services/api.js");
/**
 * Chat model for managing chat state.
 */


/**
 * Generate a unique ID
 */
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Chat model class
 */
class ChatModel {
    constructor(settings) {
        this._messages = [];
        this._isLoading = false;
        this._error = null;
        /**
         * Signal emitted when messages change
         */
        this.messagesChanged = new _lumino_signaling__WEBPACK_IMPORTED_MODULE_0__.Signal(this);
        /**
         * Signal emitted when loading state changes
         */
        this.loadingChanged = new _lumino_signaling__WEBPACK_IMPORTED_MODULE_0__.Signal(this);
        /**
         * Signal emitted when error changes
         */
        this.errorChanged = new _lumino_signaling__WEBPACK_IMPORTED_MODULE_0__.Signal(this);
        this._settings = settings;
        this._apiService = new _services_api__WEBPACK_IMPORTED_MODULE_1__.LLMApiService();
    }
    /**
     * Get all messages
     */
    get messages() {
        return this._messages;
    }
    /**
     * Get loading state
     */
    get isLoading() {
        return this._isLoading;
    }
    /**
     * Get current error
     */
    get error() {
        return this._error;
    }
    /**
     * Get current settings
     */
    get settings() {
        return this._settings;
    }
    /**
     * Update settings
     */
    updateSettings(settings) {
        this._settings = { ...this._settings, ...settings };
    }
    /**
     * Add a user message
     */
    addUserMessage(text, images) {
        const message = {
            id: generateId(),
            role: 'user',
            content: text,
            timestamp: Date.now(),
        };
        this._messages = [...this._messages, message];
        this.messagesChanged.emit(this._messages);
        // Process images if provided and vision is enabled
        if (images && images.length > 0 && this._settings.enableVision) {
            // Images will be sent separately to the API
            // For now, just store the text message
        }
        return message;
    }
    /**
     * Add an assistant message
     */
    addAssistantMessage(content = '', isStreaming = false) {
        const message = {
            id: generateId(),
            role: 'assistant',
            content,
            timestamp: Date.now(),
            isStreaming,
        };
        this._messages = [...this._messages, message];
        this.messagesChanged.emit(this._messages);
        return message;
    }
    /**
     * Update an existing message
     */
    updateMessage(id, updates) {
        this._messages = this._messages.map(msg => msg.id === id ? { ...msg, ...updates } : msg);
        this.messagesChanged.emit(this._messages);
    }
    /**
     * Append content to the last assistant message
     */
    appendToLastAssistant(content) {
        const messages = [...this._messages];
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
                const currentContent = messages[i].content;
                messages[i] = {
                    ...messages[i],
                    content: typeof currentContent === 'string'
                        ? currentContent + content
                        : currentContent,
                };
                break;
            }
        }
        this._messages = messages;
        this.messagesChanged.emit(this._messages);
    }
    /**
     * Set loading state
     */
    setLoading(loading) {
        this._isLoading = loading;
        this.loadingChanged.emit(loading);
    }
    /**
     * Set error
     */
    setError(error) {
        this._error = error;
        this.errorChanged.emit(error);
    }
    /**
     * Clear all messages
     */
    clearMessages() {
        this._messages = [];
        this._error = null;
        this.messagesChanged.emit(this._messages);
        this.errorChanged.emit(null);
    }
    /**
     * Send a message and get a response
     */
    async sendMessage(text, images = []) {
        // Add user message
        this.addUserMessage(text, images);
        // Set loading state
        this.setLoading(true);
        this.setError(null);
        // Prepare messages for API
        const apiMessages = this._messages
            .filter(msg => msg.role !== 'system')
            .map(msg => ({
            role: msg.role,
            content: msg.content,
        }));
        // Extract image data URLs
        const imageDataUrls = images.map(img => img.dataUrl);
        try {
            if (this._settings.enableStreaming) {
                // Create assistant message placeholder
                const assistantMsg = this.addAssistantMessage('', true);
                // Stream response
                await this._apiService.streamChat(apiMessages, imageDataUrls.length > 0 ? imageDataUrls : undefined, (chunk) => {
                    this.appendToLastAssistant(chunk);
                }, this._settings);
                // Mark streaming complete
                this.updateMessage(assistantMsg.id, { isStreaming: false });
            }
            else {
                // Non-streaming response
                const response = await this._apiService.chat(apiMessages, imageDataUrls.length > 0 ? imageDataUrls : undefined, this._settings);
                this.addAssistantMessage(response.content);
            }
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            this.setError(errorMessage);
            // Add error message
            this.addAssistantMessage(`Error: ${errorMessage}`);
            this.updateMessage(this._messages[this._messages.length - 1].id, {
                error: errorMessage
            });
        }
        finally {
            this.setLoading(false);
        }
    }
    /**
     * Clear chat history
     */
    clear() {
        this.clearMessages();
    }
}


/***/ },

/***/ "./lib/models/settings.js"
/*!********************************!*\
  !*** ./lib/models/settings.js ***!
  \********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DEFAULT_SETTINGS: () => (/* binding */ DEFAULT_SETTINGS),
/* harmony export */   SettingsModel: () => (/* binding */ SettingsModel)
/* harmony export */ });
/* harmony import */ var _lumino_signaling__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @lumino/signaling */ "webpack/sharing/consume/default/@lumino/signaling");
/* harmony import */ var _lumino_signaling__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_lumino_signaling__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _services_api__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../services/api */ "./lib/services/api.js");
/**
 * Settings model for managing LLM settings.
 */


/**
 * Default settings
 */
const DEFAULT_SETTINGS = {
    apiEndpoint: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: 'You are a helpful AI coding assistant. Help users with programming questions, explain code, debug issues, and provide code examples. Be concise and accurate.',
    enableStreaming: true,
    enableVision: true,
};
/**
 * Settings model class
 */
class SettingsModel {
    constructor(initialSettings) {
        /**
         * Signal emitted when settings change
         */
        this.settingsChanged = new _lumino_signaling__WEBPACK_IMPORTED_MODULE_0__.Signal(this);
        this._settings = { ...DEFAULT_SETTINGS, ...initialSettings };
        this._apiService = new _services_api__WEBPACK_IMPORTED_MODULE_1__.LLMApiService();
    }
    /**
     * Get current settings
     */
    get settings() {
        return { ...this._settings };
    }
    /**
     * Update settings
     */
    updateSettings(updates) {
        this._settings = { ...this._settings, ...updates };
        this.settingsChanged.emit(this._settings);
    }
    /**
     * Load settings from server
     */
    async loadSettings() {
        try {
            const settings = await this._apiService.getConfig();
            this._settings = { ...DEFAULT_SETTINGS, ...settings };
            this.settingsChanged.emit(this._settings);
            return this._settings;
        }
        catch (err) {
            console.error('Failed to load settings:', err);
            return this._settings;
        }
    }
    /**
     * Save settings to server
     */
    async saveSettings(settings) {
        try {
            await this._apiService.setConfig(settings);
            this._settings = { ...this._settings, ...settings };
            this.settingsChanged.emit(this._settings);
        }
        catch (err) {
            console.error('Failed to save settings:', err);
            throw err;
        }
    }
    /**
     * Test connection
     */
    async testConnection() {
        return this._apiService.testConnection();
    }
    /**
     * Get available models
     */
    async getModels() {
        return this._apiService.getModels();
    }
}


/***/ },

/***/ "./lib/services/api.js"
/*!*****************************!*\
  !*** ./lib/services/api.js ***!
  \*****************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LLMApiService: () => (/* binding */ LLMApiService)
/* harmony export */ });
/**
 * API service for communicating with the backend.
 */
/**
 * Get XSRF token from cookie
 */
function getXsrfToken() {
    const cookie = document.cookie
        .split(';')
        .find(c => c.trim().startsWith('_xsrf='));
    return cookie ? decodeURIComponent(cookie.split('=')[1]) : '';
}
/**
 * Get base headers for API requests
 */
function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-XSRFToken': getXsrfToken(),
    };
}
/**
 * LLM API Service
 */
class LLMApiService {
    constructor() {
        // Get base URL from JupyterLab's base URL
        const baseUrl = window.__jupyter_server_root_url || '';
        this.baseUrl = `${baseUrl}llm-assistant`;
    }
    /**
     * Get current configuration
     */
    async getConfig() {
        const response = await fetch(`${this.baseUrl}/config`, {
            method: 'GET',
            headers: getHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Failed to get config: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Set configuration
     */
    async setConfig(settings) {
        const response = await fetch(`${this.baseUrl}/config`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(settings),
        });
        if (!response.ok) {
            throw new Error(`Failed to set config: ${response.statusText}`);
        }
    }
    /**
     * Send a chat request (non-streaming)
     */
    async chat(messages, images, settings) {
        const response = await fetch(`${this.baseUrl}/chat`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                messages,
                images,
                stream: false,
                ...settings && {
                    model: settings.model,
                    temperature: settings.temperature,
                    maxTokens: settings.maxTokens,
                },
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || `Request failed: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Send a streaming chat request
     */
    async streamChat(messages, images, onChunk, settings) {
        const response = await fetch(`${this.baseUrl}/chat`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                messages,
                images,
                stream: true,
                ...settings && {
                    model: settings.model,
                    temperature: settings.temperature,
                    maxTokens: settings.maxTokens,
                },
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || `Request failed: ${response.statusText}`);
        }
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }
        const decoder = new TextDecoder();
        let buffer = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.error) {
                                throw new Error(parsed.error);
                            }
                            if (parsed.content) {
                                onChunk(parsed.content);
                            }
                        }
                        catch (e) {
                            // Skip invalid JSON
                            if (e instanceof SyntaxError) {
                                continue;
                            }
                            throw e;
                        }
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    /**
     * Test the API connection
     */
    async testConnection() {
        const response = await fetch(`${this.baseUrl}/test`, {
            method: 'GET',
            headers: getHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Test failed: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Get available models
     */
    async getModels() {
        const response = await fetch(`${this.baseUrl}/models`, {
            method: 'GET',
            headers: getHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Failed to get models: ${response.statusText}`);
        }
        return response.json();
    }
}


/***/ },

/***/ "./lib/widgets/LLMAssistantPanel.js"
/*!******************************************!*\
  !*** ./lib/widgets/LLMAssistantPanel.js ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LLMAssistantPanel: () => (/* binding */ LLMAssistantPanel),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "./node_modules/react/jsx-runtime.js");
/* harmony import */ var _lumino_widgets__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @lumino/widgets */ "webpack/sharing/consume/default/@lumino/widgets");
/* harmony import */ var _lumino_widgets__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_lumino_widgets__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @jupyterlab/apputils */ "webpack/sharing/consume/default/@jupyterlab/apputils");
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _lumino_signaling__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @lumino/signaling */ "webpack/sharing/consume/default/@lumino/signaling");
/* harmony import */ var _lumino_signaling__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_lumino_signaling__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _components_ChatPanel__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../components/ChatPanel */ "./lib/components/ChatPanel.js");
/* harmony import */ var _models_settings__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../models/settings */ "./lib/models/settings.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_6__);

/**
 * LLM Assistant sidebar panel widget.
 */





/**
 * LLM Assistant sidebar panel
 */
class LLMAssistantPanel extends _lumino_widgets__WEBPACK_IMPORTED_MODULE_1__.Panel {
    /**
     * Create a new LLM Assistant panel
     */
    constructor() {
        super();
        /**
         * Signal emitted when settings change
         */
        this.settingsChanged = new _lumino_signaling__WEBPACK_IMPORTED_MODULE_3__.Signal(this);
        this.addClass('llm-assistant-panel');
        this._settingsModel = new _models_settings__WEBPACK_IMPORTED_MODULE_5__.SettingsModel();
        // Create the main content widget
        const content = this._createContent();
        this.addWidget(content);
    }
    /**
     * Create the main content widget
     */
    _createContent() {
        const content = _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_2__.ReactWidget.create((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(ChatPanelWrapper, { settingsModel: this._settingsModel, onSettingsChange: (settings) => this.settingsChanged.emit(settings) }));
        content.addClass('llm-assistant-content');
        return content;
    }
    /**
     * Get current settings
     */
    getSettings() {
        return this._settingsModel.settings;
    }
    /**
     * Update settings
     */
    async updateSettings(settings) {
        await this._settingsModel.saveSettings(settings);
    }
}

const ChatPanelWrapper = ({ settingsModel, onSettingsChange, }) => {
    const [settings, setSettings] = (0,react__WEBPACK_IMPORTED_MODULE_6__.useState)(settingsModel.settings);
    (0,react__WEBPACK_IMPORTED_MODULE_6__.useEffect)(() => {
        // Load settings on mount
        settingsModel.loadSettings().then((loaded) => {
            setSettings(loaded);
        });
        // Subscribe to settings changes
        settingsModel.settingsChanged.connect((_, newSettings) => {
            setSettings(newSettings);
        });
        return () => {
            // Cleanup
        };
    }, [settingsModel]);
    const handleSettingsChange = (0,react__WEBPACK_IMPORTED_MODULE_6__.useCallback)(async (newSettings) => {
        await settingsModel.saveSettings(newSettings);
        onSettingsChange({ ...settings, ...newSettings });
    }, [settingsModel, settings, onSettingsChange]);
    const handleOpenSettings = (0,react__WEBPACK_IMPORTED_MODULE_6__.useCallback)(() => {
        // Settings panel is managed internally by ChatPanel
    }, []);
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ChatPanel__WEBPACK_IMPORTED_MODULE_4__.ChatPanel, { settings: settings, onOpenSettings: handleOpenSettings }));
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LLMAssistantPanel);


/***/ }

}]);
//# sourceMappingURL=lib_index_js.9f9c1724b575e51788b3.js.map