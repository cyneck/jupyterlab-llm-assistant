import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Message item component.
 */
import { useMemo } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
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
export const MessageItem = ({ message }) => {
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';
    const isStreaming = message.isStreaming;
    // Parse message content
    const textContent = useMemo(() => {
        if (typeof message.content === 'string') {
            return message.content;
        }
        // Handle array content (text + images)
        const textParts = message.content.filter((part) => part.type === 'text');
        return textParts.map((part) => part.text).join('');
    }, [message.content]);
    // Extract images from content
    const images = useMemo(() => {
        if (typeof message.content === 'string') {
            return [];
        }
        return message.content.filter((part) => part.type === 'image_url');
    }, [message.content]);
    return (_jsxs("div", { className: `llm-message-item llm-message-${message.role}`, children: [_jsx("div", { className: "llm-message-avatar", children: isUser ? (_jsx("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "currentColor", children: _jsx("path", { d: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" }) })) : (_jsxs("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "currentColor", children: [_jsx("path", { d: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" }), _jsx("path", { d: "M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" })] })) }), _jsxs("div", { className: "llm-message-content", children: [images.length > 0 && (_jsx("div", { className: "llm-message-images", children: images.map((img, index) => (_jsx("img", { src: img.image_url.url, alt: `Attached image ${index + 1}`, className: "llm-message-image" }, index))) })), isAssistant ? (_jsx("div", { className: "llm-message-text", children: textContent ? (_jsx(MarkdownRenderer, { content: textContent })) : (_jsx("span", { className: "llm-message-placeholder", children: isStreaming ? '...' : 'Empty response' })) })) : (_jsx("div", { className: "llm-message-text llm-message-user-text", children: textContent })), _jsxs("div", { className: "llm-message-meta", children: [_jsx("span", { className: "llm-message-time", children: formatTimestamp(message.timestamp) }), isStreaming && (_jsxs("span", { className: "llm-message-streaming", children: [_jsx("span", { className: "llm-streaming-dot" }), _jsx("span", { className: "llm-streaming-dot" }), _jsx("span", { className: "llm-streaming-dot" })] })), message.error && (_jsx("span", { className: "llm-message-error", children: message.error }))] })] })] }));
};
export default MessageItem;
//# sourceMappingURL=MessageItem.js.map