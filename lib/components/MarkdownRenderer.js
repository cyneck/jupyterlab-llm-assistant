import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Markdown renderer component.
 */
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
/**
 * Custom paragraph component
 */
const Paragraph = ({ children }) => {
    return _jsx("p", { className: "llm-md-paragraph", children: children });
};
/**
 * Custom link component
 */
const Link = ({ href, children }) => {
    return (_jsx("a", { href: href, target: "_blank", rel: "noopener noreferrer", className: "llm-md-link", children: children }));
};
/**
 * Custom code component
 */
const Code = ({ inline, className, children }) => {
    const match = /language-(\w+)/.exec(className || '');
    const lang = match ? match[1] : '';
    const codeString = String(children).replace(/\n$/, '');
    if (inline) {
        return _jsx("code", { className: "llm-md-code-inline", children: children });
    }
    // Check if it's a code block with language
    if (lang || codeString.includes('\n')) {
        return _jsx(CodeBlock, { code: codeString, language: lang });
    }
    // Single line code without language
    return _jsx("code", { className: "llm-md-code-inline", children: children });
};
/**
 * Custom pre component (we handle this in Code component)
 */
const Pre = ({ children }) => {
    return _jsx(_Fragment, { children: children });
};
/**
 * Custom list components
 */
const Ul = ({ children }) => {
    return _jsx("ul", { className: "llm-md-list", children: children });
};
const Ol = ({ children }) => {
    return _jsx("ol", { className: "llm-md-list llm-md-list-ordered", children: children });
};
const Li = ({ children }) => {
    return _jsx("li", { className: "llm-md-list-item", children: children });
};
/**
 * Custom heading components
 */
const Heading = ({ level, children }) => {
    const Tag = `h${level}`;
    return _jsx(Tag, { className: `llm-md-heading llm-md-heading-${level}`, children: children });
};
/**
 * Custom blockquote component
 */
const Blockquote = ({ children }) => {
    return _jsx("blockquote", { className: "llm-md-blockquote", children: children });
};
/**
 * Custom table components
 */
const Table = ({ children }) => {
    return (_jsx("div", { className: "llm-md-table-wrapper", children: _jsx("table", { className: "llm-md-table", children: children }) }));
};
const Th = ({ children }) => {
    return _jsx("th", { className: "llm-md-th", children: children });
};
const Td = ({ children }) => {
    return _jsx("td", { className: "llm-md-td", children: children });
};
/**
 * Think block component - collapsible thinking content
 */
const ThinkBlock = ({ content }) => {
    const [expanded, setExpanded] = React.useState(false);
    return (_jsxs("div", { className: "llm-think-block", children: [_jsxs("button", { className: "llm-think-header", onClick: () => setExpanded(v => !v), children: [_jsx("span", { className: "llm-think-icon", children: _jsx("svg", { viewBox: "0 0 24 24", width: "14", height: "14", fill: "currentColor", children: _jsx("path", { d: "M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z" }) }) }), _jsx("span", { className: "llm-think-label", children: "\u601D\u8003\u8FC7\u7A0B" }), _jsx("span", { className: "llm-think-chevron", children: expanded ? '▲' : '▼' })] }), expanded && (_jsx("div", { className: "llm-think-content", children: _jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], components: {
                        p: Paragraph,
                        a: Link,
                        code: Code,
                        pre: Pre,
                        ul: Ul,
                        ol: Ol,
                        li: Li,
                        h1: ((props) => _jsx(Heading, { level: 1, ...props })),
                        h2: ((props) => _jsx(Heading, { level: 2, ...props })),
                        h3: ((props) => _jsx(Heading, { level: 3, ...props })),
                        blockquote: Blockquote,
                    }, children: content }) }))] }));
};
/**
 * Preprocess content to handle <think> tags
 */
function preprocessThinkTags(content) {
    const result = [];
    let remaining = content;
    while (remaining.length > 0) {
        const thinkStart = remaining.indexOf('<think>');
        if (thinkStart === -1) {
            // No more <think> tags
            if (remaining.trim()) {
                result.push({ type: 'markdown', content: remaining });
            }
            break;
        }
        // Add content before <think>
        if (thinkStart > 0) {
            const before = remaining.slice(0, thinkStart);
            if (before.trim()) {
                result.push({ type: 'markdown', content: before });
            }
        }
        // Find closing </think>
        const thinkEnd = remaining.indexOf('</think>', thinkStart);
        if (thinkEnd === -1) {
            // Unclosed <think> tag - treat rest as think content
            const thinkContent = remaining.slice(thinkStart + 7); // 7 = len('<think>')
            if (thinkContent.trim()) {
                result.push({ type: 'think', content: thinkContent });
            }
            break;
        }
        // Extract think content
        const thinkContent = remaining.slice(thinkStart + 7, thinkEnd);
        if (thinkContent.trim()) {
            result.push({ type: 'think', content: thinkContent });
        }
        remaining = remaining.slice(thinkEnd + 8); // 8 = len('</think>')
    }
    return result;
}
/**
 * Markdown renderer component
 */
export const MarkdownRenderer = ({ content }) => {
    // Memoize the components object
    const components = useMemo(() => ({
        p: Paragraph,
        a: Link,
        code: Code,
        pre: Pre,
        ul: Ul,
        ol: Ol,
        li: Li,
        h1: ((props) => _jsx(Heading, { level: 1, ...props })),
        h2: ((props) => _jsx(Heading, { level: 2, ...props })),
        h3: ((props) => _jsx(Heading, { level: 3, ...props })),
        h4: ((props) => _jsx(Heading, { level: 4, ...props })),
        h5: ((props) => _jsx(Heading, { level: 5, ...props })),
        h6: ((props) => _jsx(Heading, { level: 6, ...props })),
        blockquote: Blockquote,
        table: Table,
        th: Th,
        td: Td,
    }), []);
    // Process <think> tags
    const segments = useMemo(() => preprocessThinkTags(content), [content]);
    // If no think tags, render normally
    if (segments.length === 1 && segments[0].type === 'markdown') {
        return (_jsx("div", { className: "llm-markdown-content", children: _jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], components: components, children: segments[0].content }) }));
    }
    // Render with think blocks
    return (_jsx("div", { className: "llm-markdown-content", children: segments.map((segment, index) => segment.type === 'think' ? (_jsx(ThinkBlock, { content: segment.content }, index)) : (_jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], components: components, children: segment.content }, index))) }));
};
export default MarkdownRenderer;
//# sourceMappingURL=MarkdownRenderer.js.map