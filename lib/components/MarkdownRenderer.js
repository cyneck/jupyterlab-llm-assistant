import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Markdown renderer component.
 */
import { useMemo } from 'react';
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
    return (_jsx("div", { className: "llm-markdown-content", children: _jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], components: components, children: content }) }));
};
export default MarkdownRenderer;
//# sourceMappingURL=MarkdownRenderer.js.map