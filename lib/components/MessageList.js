import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Message list component.
 */
import { useEffect, useRef } from 'react';
import { MessageItem } from './MessageItem';
/**
 * Message list component with auto-scroll
 */
export const MessageList = ({ messages, isLoading }) => {
    const listRef = useRef(null);
    const bottomRef = useRef(null);
    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);
    // Empty state
    if (messages.length === 0) {
        return (_jsx("div", { className: "llm-message-list llm-message-list-empty", children: _jsxs("div", { className: "llm-empty-state", children: [_jsx("div", { className: "llm-empty-icon", children: _jsxs("svg", { viewBox: "0 0 24 24", width: "48", height: "48", fill: "currentColor", children: [_jsx("path", { d: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" }), _jsx("path", { d: "M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" })] }) }), _jsx("h3", { children: "LLM Coding Assistant" }), _jsx("p", { children: "Start a conversation to get help with your code." }), _jsxs("ul", { className: "llm-empty-hints", children: [_jsx("li", { children: "Ask questions about code" }), _jsx("li", { children: "Debug issues" }), _jsx("li", { children: "Generate code snippets" }), _jsx("li", { children: "Explain concepts" })] })] }) }));
    }
    return (_jsxs("div", { className: "llm-message-list", ref: listRef, children: [messages.map((message) => (_jsx(MessageItem, { message: message }, message.id))), isLoading && (_jsx("div", { className: "llm-loading-indicator", children: _jsxs("div", { className: "llm-loading-dots", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] }) })), _jsx("div", { ref: bottomRef })] }));
};
export default MessageList;
//# sourceMappingURL=MessageList.js.map