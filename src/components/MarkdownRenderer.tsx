/**
 * Markdown renderer component.
 */

import React, { useMemo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';

export interface MarkdownRendererProps {
  content: string;
}

/**
 * Custom paragraph component
 */
const Paragraph: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <p className="llm-md-paragraph">{children}</p>;
};

/**
 * Custom link component
 */
const Link: React.FC<{ href?: string; children: React.ReactNode }> = ({ href, children }) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="llm-md-link"
    >
      {children}
    </a>
  );
};

/**
 * Custom code component
 */
const Code: React.FC<{
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ inline, className, children }) => {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');

  if (inline) {
    return <code className="llm-md-code-inline">{children}</code>;
  }

  // Check if it's a code block with language
  if (lang || codeString.includes('\n')) {
    return <CodeBlock code={codeString} language={lang} />;
  }

  // Single line code without language
  return <code className="llm-md-code-inline">{children}</code>;
};

/**
 * Custom pre component (we handle this in Code component)
 */
const Pre: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

/**
 * Custom list components
 */
const Ul: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ul className="llm-md-list">{children}</ul>;
};

const Ol: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ol className="llm-md-list llm-md-list-ordered">{children}</ol>;
};

const Li: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <li className="llm-md-list-item">{children}</li>;
};

/**
 * Custom heading components
 */
const Heading: React.FC<{ level: number; children: React.ReactNode }> = ({ level, children }) => {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return <Tag className={`llm-md-heading llm-md-heading-${level}`}>{children}</Tag>;
};

/**
 * Custom blockquote component
 */
const Blockquote: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <blockquote className="llm-md-blockquote">{children}</blockquote>;
};

/**
 * Custom table components
 */
const Table: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="llm-md-table-wrapper">
      <table className="llm-md-table">{children}</table>
    </div>
  );
};

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <th className="llm-md-th">{children}</th>;
};

const Td: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <td className="llm-md-td">{children}</td>;
};

/**
 * Think block component - collapsible thinking content
 */
const ThinkBlock: React.FC<{ content: string }> = ({ content }) => {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="llm-think-block">
      <button
        className="llm-think-header"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="llm-think-icon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/>
          </svg>
        </span>
        <span className="llm-think-label">思考过程</span>
        <span className="llm-think-chevron">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="llm-think-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            p: Paragraph as Components['p'],
            a: Link as Components['a'],
            code: Code as Components['code'],
            pre: Pre as Components['pre'],
            ul: Ul as Components['ul'],
            ol: Ol as Components['ol'],
            li: Li as Components['li'],
            h1: ((props: any) => <Heading level={1} {...props} />) as Components['h1'],
            h2: ((props: any) => <Heading level={2} {...props} />) as Components['h2'],
            h3: ((props: any) => <Heading level={3} {...props} />) as Components['h3'],
            blockquote: Blockquote as Components['blockquote'],
          }}>
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

/**
 * Preprocess content to handle <think> tags
 */
function preprocessThinkTags(content: string): Array<{ type: 'markdown' | 'think'; content: string }> {
  const result: Array<{ type: 'markdown' | 'think'; content: string }> = [];
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
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Memoize the components object
  const components = useMemo<Components>(
    () => ({
      p: Paragraph as Components['p'],
      a: Link as Components['a'],
      code: Code as Components['code'],
      pre: Pre as Components['pre'],
      ul: Ul as Components['ul'],
      ol: Ol as Components['ol'],
      li: Li as Components['li'],
      h1: ((props: any) => <Heading level={1} {...props} />) as Components['h1'],
      h2: ((props: any) => <Heading level={2} {...props} />) as Components['h2'],
      h3: ((props: any) => <Heading level={3} {...props} />) as Components['h3'],
      h4: ((props: any) => <Heading level={4} {...props} />) as Components['h4'],
      h5: ((props: any) => <Heading level={5} {...props} />) as Components['h5'],
      h6: ((props: any) => <Heading level={6} {...props} />) as Components['h6'],
      blockquote: Blockquote as Components['blockquote'],
      table: Table as Components['table'],
      th: Th as Components['th'],
      td: Td as Components['td'],
    }),
    []
  );

  // Process <think> tags
  const segments = useMemo(() => preprocessThinkTags(content), [content]);

  // If no think tags, render normally
  if (segments.length === 1 && segments[0].type === 'markdown') {
    return (
      <div className="llm-markdown-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {segments[0].content}
        </ReactMarkdown>
      </div>
    );
  }

  // Render with think blocks
  return (
    <div className="llm-markdown-content">
      {segments.map((segment, index) =>
        segment.type === 'think' ? (
          <ThinkBlock key={index} content={segment.content} />
        ) : (
          <ReactMarkdown key={index} remarkPlugins={[remarkGfm]} components={components}>
            {segment.content}
          </ReactMarkdown>
        )
      )}
    </div>
  );
};

export default MarkdownRenderer;