/**
 * ContextFilePanel — select files/directories to include as context.
 *
 * Users can specify:
 *  - One or more specific file paths
 *  - A directory path (files are listed and selectable)
 *
 * Selected file contents are fetched from the backend and returned
 * as a formatted context string to be injected into the LLM prompt.
 *
 * v1.0:
 *  - Type a path and resolve it (file or directory)
 *  - Browse resolved directory contents with checkboxes
 *  - View total context size estimate
 *  - Persistent selection stored in sessionStorage
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { PageConfig } from '@jupyterlab/coreutils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ContextFile {
  path: string;        // relative or absolute path
  content: string;     // file text content
  lines: number;
  size: number;
  error: string | null;
}

export interface ContextState {
  /** paths the user has checked for inclusion */
  selectedPaths: string[];
  /** root directory for relative paths */
  rootDir: string;
}

interface ContextFilePanelProps {
  /** Callback: called whenever the active context changes. Returns formatted context string. */
  onContextChange: (context: string, state: ContextState) => void;
  /** Initial state to restore */
  initialState?: ContextState;
  onClose: () => void;
}

// ─── Storage key ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'jlab-llm-context-state';

function saveContextState(state: ContextState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function loadContextState(): ContextState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ─── API helpers ─────────────────────────────────────────────────────────────

function getXsrfToken(): string {
  const cookie = document.cookie.split(';').find(c => c.trim().startsWith('_xsrf='));
  return cookie ? decodeURIComponent(cookie.split('=')[1]) : '';
}

function getHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-XSRFToken': getXsrfToken() };
}

function contextApiBase(): string {
  const root = (PageConfig.getOption('baseUrl') || '/').replace(/\/$/, '');
  return `${root}/llm-assistant/context`;
}

async function apiResolvePath(
  path: string,
  rootDir: string,
): Promise<{ paths: string[]; isDir: boolean; totalFound: number }> {
  const r = await fetch(`${contextApiBase()}/resolve`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ path, rootDir }),
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

async function apiReadFiles(
  paths: string[],
  rootDir: string,
): Promise<{ files: ContextFile[]; totalChars: number; truncated: boolean }> {
  const r = await fetch(`${contextApiBase()}/read`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ paths, rootDir }),
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

// ─── Context formatter ────────────────────────────────────────────────────────

function buildContextString(files: ContextFile[]): string {
  const loaded = files.filter(f => f.content && !f.error);
  if (loaded.length === 0) return '';

  const parts: string[] = [
    `## Context Files (${loaded.length})\n`,
    'The following files have been provided as context. Use them to answer questions accurately.\n',
  ];

  for (const f of loaded) {
    const ext = f.path.split('.').pop() || '';
    parts.push(`### \`${f.path}\`\n`);
    parts.push(`\`\`\`${ext}\n${f.content}\n\`\`\`\n`);
  }

  return parts.join('\n');
}

// ─── ContextFilePanel ────────────────────────────────────────────────────────

export const ContextFilePanel: React.FC<ContextFilePanelProps> = ({
  onContextChange,
  initialState,
  onClose,
}) => {
  const [pathInput, setPathInput] = useState('');
  const [rootDir, setRootDir] = useState(initialState?.rootDir ?? '');
  const [resolvedPaths, setResolvedPaths] = useState<string[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    new Set(initialState?.selectedPaths ?? [])
  );
  const [isDir, setIsDir] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalChars, setTotalChars] = useState(0);
  const [truncated, setTruncated] = useState(false);

  // The last loaded context files (for display / size info)
  const loadedFiles = useRef<ContextFile[]>([]);

  // Notify parent when selection changes
  const emitContext = useCallback(async (paths: string[], dir: string) => {
    if (paths.length === 0) {
      onContextChange('', { selectedPaths: [], rootDir: dir });
      setTotalChars(0);
      setTruncated(false);
      saveContextState({ selectedPaths: [], rootDir: dir });
      return;
    }

    setLoadingContext(true);
    try {
      const result = await apiReadFiles(paths, dir);
      loadedFiles.current = result.files;
      setTotalChars(result.totalChars);
      setTruncated(result.truncated);
      const ctx = buildContextString(result.files);
      const state: ContextState = { selectedPaths: paths, rootDir: dir };
      saveContextState(state);
      onContextChange(ctx, state);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingContext(false);
    }
  }, [onContextChange]);

  // On mount: restore state and reload context
  useEffect(() => {
    const saved = initialState || loadContextState();
    if (saved && saved.selectedPaths.length > 0) {
      setSelectedPaths(new Set(saved.selectedPaths));
      setRootDir(saved.rootDir);
      setResolvedPaths(saved.selectedPaths);
      emitContext(saved.selectedPaths, saved.rootDir);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResolve = useCallback(async () => {
    const trimmed = pathInput.trim();
    if (!trimmed) return;

    setResolving(true);
    setError(null);
    try {
      const result = await apiResolvePath(trimmed, rootDir);
      setResolvedPaths(result.paths);
      setIsDir(result.isDir);

      if (!result.isDir && result.paths.length === 1) {
        // Single file — auto-select
        const newSel = new Set<string>(result.paths);
        setSelectedPaths(newSel);
        await emitContext(result.paths, rootDir);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setResolving(false);
    }
  }, [pathInput, rootDir, emitContext]);

  const togglePath = useCallback(async (path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      // Emit asynchronously after state update
      setTimeout(() => emitContext([...next], rootDir), 0);
      return next;
    });
  }, [rootDir, emitContext]);

  const handleSelectAll = useCallback(async () => {
    const next = new Set(resolvedPaths);
    setSelectedPaths(next);
    await emitContext([...next], rootDir);
  }, [resolvedPaths, rootDir, emitContext]);

  const handleClearAll = useCallback(async () => {
    setSelectedPaths(new Set());
    await emitContext([], rootDir);
  }, [rootDir, emitContext]);

  const handleRemovePath = useCallback(async (path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      next.delete(path);
      setTimeout(() => emitContext([...next], rootDir), 0);
      return next;
    });
    setResolvedPaths(prev => prev.filter(p => p !== path));
  }, [rootDir, emitContext]);

  const selectedCount = selectedPaths.size;
  const kbEstimate = Math.round(totalChars / 1024);

  return (
    <div className="context-panel">
      {/* Header */}
      <div className="context-header">
        <div className="context-header-left">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" className="context-header-icon">
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
          </svg>
          <span className="context-header-title">Context Files</span>
          {selectedCount > 0 && (
            <span className="context-count-badge">{selectedCount} file{selectedCount !== 1 ? 's' : ''}</span>
          )}
        </div>
        <button className="memory-icon-btn" onClick={onClose} title="Close">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="memory-info-bar">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" style={{flexShrink: 0, opacity: 0.6}}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        <span>Selected files are included as context in every message you send.</span>
      </div>

      {/* Root dir input */}
      <div className="context-section">
        <label className="context-label">Root directory (optional)</label>
        <input
          className="context-input"
          type="text"
          value={rootDir}
          onChange={e => setRootDir(e.target.value)}
          placeholder="/path/to/project (leave empty for Jupyter root)"
        />
      </div>

      {/* Path resolver */}
      <div className="context-section">
        <label className="context-label">Add file or directory</label>
        <div className="context-path-row">
          <input
            className="context-input context-input-grow"
            type="text"
            value={pathInput}
            onChange={e => setPathInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleResolve(); } }}
            placeholder="src/index.ts  or  src/"
          />
          <button
            className="context-resolve-btn"
            onClick={handleResolve}
            disabled={resolving || !pathInput.trim()}
          >
            {resolving ? '…' : 'Add'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="memory-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* File list */}
      {resolvedPaths.length > 0 && (
        <div className="context-file-list-wrapper">
          <div className="context-file-list-header">
            <span className="context-label">
              {isDir ? 'Files in directory' : 'Files'} ({resolvedPaths.length})
            </span>
            <div className="context-list-actions">
              <button className="context-text-btn" onClick={handleSelectAll}>All</button>
              <button className="context-text-btn" onClick={handleClearAll}>None</button>
            </div>
          </div>

          <div className="context-file-list">
            {resolvedPaths.map(p => {
              const checked = selectedPaths.has(p);
              const fileInfo = loadedFiles.current.find(f => f.path === p);
              const hasError = fileInfo?.error;
              return (
                <label
                  key={p}
                  className={`context-file-item ${hasError ? 'context-file-error' : ''} ${checked ? 'context-file-checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePath(p)}
                    className="context-file-checkbox"
                  />
                  <span className="context-file-path" title={p}>
                    {p}
                  </span>
                  {fileInfo && !hasError && (
                    <span className="context-file-meta">
                      {fileInfo.lines}L
                    </span>
                  )}
                  {hasError && (
                    <span className="context-file-err-badge" title={fileInfo.error ?? ''}>!</span>
                  )}
                  <button
                    className="context-file-remove"
                    onClick={e => { e.preventDefault(); handleRemovePath(p); }}
                    title="Remove from list"
                  >×</button>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Status bar */}
      {selectedCount > 0 && (
        <div className="context-status-bar">
          {loadingContext ? (
            <span>Loading context…</span>
          ) : (
            <>
              <span>{selectedCount} file{selectedCount !== 1 ? 's' : ''} · ~{kbEstimate} KB</span>
              {truncated && <span className="context-truncated-badge">truncated</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ContextFilePanel;
