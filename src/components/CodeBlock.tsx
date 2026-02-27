/**
 * Code block component with copy functionality.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import hljs from 'highlight.js';

export interface CodeBlockProps {
  code: string;
  language: string;
}

/**
 * Code block with syntax highlighting and copy button
 */
export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  // Apply syntax highlighting
  useEffect(() => {
    if (codeRef.current) {
      hljs.highlightElement(codeRef.current);
    }
  }, [code, language]);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [code]);

  // Normalize language name
  const normalizedLanguage = language || 'plaintext';

  return (
    <div className="llm-code-block">
      <div className="llm-code-header">
        <span className="llm-code-language">{normalizedLanguage}</span>
        <button
          className="llm-code-copy-btn"
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
            </svg>
          )}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="llm-code-content">
        <code
          ref={codeRef}
          className={`language-${normalizedLanguage}`}
        >
          {code}
        </code>
      </pre>
    </div>
  );
};

export default CodeBlock;