/**
 * InputArea — unified input block for Chat / Agent / Plan modes.
 *
 * v0.7.0 changes:
 * - Textarea grows from 120 px (min) to 400 px (max) — suitable for large inputs
 * - Toolbar row: image attach button + file/dir attach button + send button
 * - @ mention: now resolves BOTH files and directories;
 *   selecting a directory opens it inline in the picker (drill-down)
 * - Attachment chip list: selected @-referenced paths shown as dismissable chips
 * - Ctrl+Enter or Cmd+Enter to send (Enter = newline by default at 3+ lines,
 *   Enter still sends on single-line for quick use; configurable)
 * - enableVision is now always true from InputArea perspective — the image
 *   button is always shown (backend handles capability check)
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import { ImageData } from '../models/types';
import { LLMApiService } from '../services/api';
import type { AppMode } from './ChatPanel';

// ── @ mention helpers ─────────────────────────────────────────────────────────

interface FileSuggestion {
  path: string;
  isDir: boolean;
  label: string;
}

/** A path chip that the user has explicitly confirmed via the @ picker */
export interface AttachedPath {
  id: string;
  path: string;
  isDir: boolean;
}

const _api = new LLMApiService();

// ── Props ─────────────────────────────────────────────────────────────────────

export interface InputAreaProps {
  onSend: (text: string, images: ImageData[], attachedPaths: AttachedPath[]) => void;
  disabled: boolean;
  /** Still accepted so callers don't break, but image attach is always shown */
  enableVision?: boolean;
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  /** Working root dir for @ resolution (defaults to cwd on server) */
  rootDir?: string;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function findAtTrigger(value: string, cursor: number): number {
  const before = value.slice(0, cursor);
  const idx = before.lastIndexOf('@');
  if (idx === -1) return -1;
  const afterAt = before.slice(idx + 1);
  if (/\s/.test(afterAt)) return -1;
  return idx;
}

function getAtQuery(value: string, cursor: number, atIdx: number): string {
  return value.slice(atIdx + 1, cursor);
}

// ── Component ─────────────────────────────────────────────────────────────────

export const InputArea: React.FC<InputAreaProps> = ({
  onSend,
  disabled,
  mode,
  onModeChange,
  rootDir,
}) => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<ImageData[]>([]);
  const [attachedPaths, setAttachedPaths] = useState<AttachedPath[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── @ mention state ──────────────────────────────────────────────────────
  const [atIdx, setAtIdx] = useState<number>(-1);
  const [atQuery, setAtQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<FileSuggestion[]>([]);
  const [suggestionIdx, setSuggestionIdx] = useState<number>(0);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  /** Breadcrumb stack for directory drill-down */
  const [browseDir, setBrowseDir] = useState<string>('');
  const mentionMenuRef = useRef<HTMLDivElement>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);

  // ── Auto-resize textarea (min 120 px, max 400 px) ────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const next = Math.max(120, Math.min(ta.scrollHeight, 400));
    ta.style.height = `${next}px`;
  }, [text]);

  // ── Fetch file/dir suggestions ─────────────────────────────────────────
  useEffect(() => {
    if (atIdx === -1) {
      setSuggestions([]);
      return;
    }

    fetchAbortRef.current?.abort();
    fetchAbortRef.current = new AbortController();

    setLoadingSuggestions(true);

    const query = atQuery;
    const searchPath = browseDir || query || '.';

    const fetchSuggestions = async () => {
      try {
        const result = await _api.resolveContextPath(searchPath, rootDir || '');

        // Build suggestion list
        const items: FileSuggestion[] = [];

        if (result.isDir) {
          // If the resolved path is a directory, list its immediate children
          const childResult = await _api.listDirContents(searchPath, rootDir || '');
          for (const item of childResult.entries.slice(0, 30)) {
            items.push({
              path: item.path,
              isDir: item.isDir,
              label: item.name,
            });
          }
        } else {
          // Files matching pattern
          for (const p of result.paths.slice(0, 30)) {
            items.push({
              path: p,
              isDir: false,
              label: p.split('/').pop() || p,
            });
          }
        }

        // Filter by query if we have one and didn't drill into a dir
        const filtered = query && !browseDir
          ? items.filter(i =>
              i.label.toLowerCase().includes(query.toLowerCase()) ||
              i.path.toLowerCase().includes(query.toLowerCase())
            )
          : items;

        setSuggestions(filtered);
        setSuggestionIdx(0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 150);
    return () => clearTimeout(timer);
  }, [atIdx, atQuery, browseDir, rootDir]);

  // ── Close @ menu on outside click ─────────────────────────────────────────
  useEffect(() => {
    if (atIdx === -1) return;
    const handler = (e: MouseEvent) => {
      if (
        mentionMenuRef.current &&
        !mentionMenuRef.current.contains(e.target as Node) &&
        textareaRef.current !== e.target
      ) {
        setAtIdx(-1);
        setSuggestions([]);
        setBrowseDir('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [atIdx]);

  // ── Handle text change ────────────────────────────────────────────────────
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      const cursor = e.target.selectionStart ?? val.length;
      setText(val);

      const idx = findAtTrigger(val, cursor);
      if (idx !== -1) {
        const q = getAtQuery(val, cursor, idx);
        setAtIdx(idx);
        setAtQuery(q);
        // Reset drill-down when query changes
        setBrowseDir('');
      } else {
        setAtIdx(-1);
        setAtQuery('');
        setSuggestions([]);
        setBrowseDir('');
      }
    },
    []
  );

  // ── Select a suggestion ───────────────────────────────────────────────────
  const handleSelectSuggestion = useCallback(
    (suggestion: FileSuggestion) => {
      if (atIdx === -1) return;

      if (suggestion.isDir) {
        // Drill into directory — update browseDir, keep @ menu open
        setBrowseDir(suggestion.path);
        setSuggestions([]);
        setSuggestionIdx(0);
        textareaRef.current?.focus();
        return;
      }

      // File selected: replace @query with chip, remove from text
      const cursor = textareaRef.current?.selectionStart ?? text.length;
      const before = text.slice(0, atIdx);
      const after = text.slice(cursor);
      // Remove the @query part from text — the path becomes a chip
      const newText = before + after;
      setText(newText);

      // Add chip
      setAttachedPaths(prev => {
        if (prev.find(a => a.path === suggestion.path)) return prev;
        return [...prev, { id: genId(), path: suggestion.path, isDir: false }];
      });

      // Reset mention state
      setAtIdx(-1);
      setAtQuery('');
      setSuggestions([]);
      setBrowseDir('');

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newCursor = before.length;
          textareaRef.current.setSelectionRange(newCursor, newCursor);
        }
      });
    },
    [atIdx, text]
  );

  // ── Attach a whole directory as a chip (from toolbar) ─────────────────────
  const handleAttachDirAsChip = useCallback((suggestion: FileSuggestion) => {
    setAttachedPaths(prev => {
      if (prev.find(a => a.path === suggestion.path)) return prev;
      return [...prev, { id: genId(), path: suggestion.path, isDir: suggestion.isDir }];
    });
    setAtIdx(-1);
    setSuggestions([]);
    setBrowseDir('');
  }, []);

  // ── Remove a path chip ────────────────────────────────────────────────────
  const handleRemoveChip = useCallback(
    (id: string) => setAttachedPaths(prev => prev.filter(a => a.id !== id)),
    []
  );

  // ── Image handling ────────────────────────────────────────────────────────

  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const newImages: ImageData[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const dataUrl = await new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newImages.push({ id: genId(), dataUrl, file, preview: dataUrl });
      }
      setImages(prev => [...prev, ...newImages]);
      if (imageInputRef.current) imageInputRef.current.value = '';
    },
    []
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const newImages: ImageData[] = [];
      for (const item of Array.from(items)) {
        if (!item.type.startsWith('image/')) continue;
        const file = item.getAsFile();
        if (!file) continue;
        const dataUrl = await new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newImages.push({ id: genId(), dataUrl, file, preview: dataUrl });
      }
      if (newImages.length > 0) setImages(prev => [...prev, ...newImages]);
    },
    []
  );

  const handleRemoveImage = useCallback(
    (id: string) => setImages(prev => prev.filter(img => img.id !== id)),
    []
  );

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    if (disabled) return;
    if (!text.trim() && images.length === 0 && attachedPaths.length === 0) return;
    onSend(text.trim(), images, attachedPaths);
    setText('');
    setImages([]);
    setAttachedPaths([]);
    setAtIdx(-1);
    setSuggestions([]);
    setBrowseDir('');
    if (textareaRef.current) textareaRef.current.style.height = '120px';
  }, [text, images, attachedPaths, disabled, onSend]);

  // ── Keyboard navigation ───────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Navigate @ menu
      if (atIdx !== -1 && suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSuggestionIdx(i => Math.min(i + 1, suggestions.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSuggestionIdx(i => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          handleSelectSuggestion(suggestions[suggestionIdx]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setAtIdx(-1);
          setSuggestions([]);
          setBrowseDir('');
          return;
        }
        if (e.key === 'Backspace' && browseDir) {
          e.preventDefault();
          // Go up one level
          const parts = browseDir.split('/');
          parts.pop();
          setBrowseDir(parts.join('/'));
          return;
        }
      }

      // Ctrl+Enter or Cmd+Enter → always send
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
        return;
      }

      // Plain Enter on a short single-line text → send; otherwise newline
      if (e.key === 'Enter' && !e.shiftKey && atIdx === -1) {
        const lineCount = (text.match(/\n/g) || []).length + 1;
        if (lineCount <= 2) {
          e.preventDefault();
          handleSend();
        }
        // 3+ lines: Enter inserts newline (let default happen)
      }
    },
    [atIdx, suggestions, suggestionIdx, handleSelectSuggestion, handleSend, browseDir, text]
  );

  const canSend = !disabled && (
    text.trim().length > 0 || images.length > 0 || attachedPaths.length > 0
  );

  // ── Mode label ────────────────────────────────────────────────────────────
  const modeLabel = useMemo<string>(() => {
    if (mode === 'chat') return 'Chat';
    if (mode === 'agent') return 'Agent';
    return 'Plan';
  }, [mode]);

  // ── Breadcrumb display ────────────────────────────────────────────────────
  const browseDirDisplay = browseDir
    ? browseDir.split('/').filter(Boolean).join(' / ')
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="llm-input-area">
      {/* ── Attached path chips ─────────────────────────────────────────── */}
      {attachedPaths.length > 0 && (
        <div className="llm-attached-chips">
          {attachedPaths.map(a => (
            <div key={a.id} className={`llm-chip ${a.isDir ? 'llm-chip-dir' : 'llm-chip-file'}`}>
              <span className="llm-chip-icon">
                {a.isDir ? (
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                  </svg>
                )}
              </span>
              <span className="llm-chip-label" title={a.path}>
                {a.path.split('/').pop() || a.path}
              </span>
              <button
                className="llm-chip-remove"
                onMouseDown={e => { e.preventDefault(); handleRemoveChip(a.id); }}
                title="Remove"
              >
                <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Image previews ───────────────────────────────────────────────── */}
      {images.length > 0 && (
        <div className="llm-image-previews">
          {images.map(image => (
            <div key={image.id} className="llm-image-preview">
              <img src={image.preview} alt="Preview" />
              <button
                className="llm-image-remove"
                onClick={() => handleRemoveImage(image.id)}
                title="Remove image"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── @ mention popup ──────────────────────────────────────────────── */}
      {atIdx !== -1 && (
        <div className="llm-mention-menu" ref={mentionMenuRef}>
          {/* Breadcrumb when drilling into a directory */}
          {browseDirDisplay && (
            <div className="llm-mention-breadcrumb">
              <button
                className="llm-mention-breadcrumb-back"
                onMouseDown={e => {
                  e.preventDefault();
                  const parts = browseDir.split('/');
                  parts.pop();
                  setBrowseDir(parts.join('/'));
                }}
                title="Go up"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                </svg>
              </button>
              <span className="llm-mention-breadcrumb-path">{browseDirDisplay}</span>
            </div>
          )}

          {loadingSuggestions ? (
            <div className="llm-mention-loading">Loading…</div>
          ) : suggestions.length === 0 ? (
            <div className="llm-mention-empty">No matches</div>
          ) : (
            suggestions.map((s, i) => (
              <div
                key={s.path}
                className={`llm-mention-item ${i === suggestionIdx ? 'active' : ''}`}
                onMouseDown={e => {
                  e.preventDefault();
                  if (s.isDir) {
                    // Offer two actions: drill-down OR attach whole dir
                    // Single click → drill-down; the "attach dir" chip button on hover
                    handleSelectSuggestion(s);
                  } else {
                    handleSelectSuggestion(s);
                  }
                }}
                onMouseEnter={() => setSuggestionIdx(i)}
              >
                <span className="llm-mention-icon">
                  {s.isDir ? (
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                    </svg>
                  )}
                </span>
                <span className="llm-mention-label" title={s.path}>{s.label}</span>
                <span className="llm-mention-path">{s.path}</span>
                {/* Attach-whole-dir button for directories */}
                {s.isDir && (
                  <button
                    className="llm-mention-attach-dir"
                    onMouseDown={e => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleAttachDirAsChip(s);
                    }}
                    title="Attach entire directory"
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                      <path d="M19 13H13v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                    </svg>
                  </button>
                )}
              </div>
            ))
          )}
          <div className="llm-mention-hint">
            ↑↓ navigate · Enter/Tab select · Esc close · Backspace up{' '}
            {suggestions.some(s => s.isDir) && '· click folder to browse · + to attach dir'}
          </div>
        </div>
      )}

      {/* ── Main textarea ────────────────────────────────────────────────── */}
      <textarea
        ref={textareaRef}
        className="llm-text-input llm-text-input-large"
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={`Message (@ to reference files/dirs · paste images · Ctrl+Enter or Enter to send)`}
        disabled={disabled}
        rows={4}
      />

      {/* ── Bottom toolbar ────────────────────────────────────────────────── */}
      <div className="llm-input-toolbar">
        {/* Left: mode selector */}
        <div className="llm-mode-selector">
          <svg
            className="llm-mode-selector-icon"
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="currentColor"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z" />
          </svg>
          <select
            className="llm-mode-select"
            value={mode}
            onChange={e => onModeChange(e.target.value as AppMode)}
            disabled={disabled}
            title="Switch mode"
          >
            <option value="chat">Chat</option>
            <option value="agent">Agent</option>
            <option value="plan">Plan</option>
          </select>
          <svg
            className="llm-mode-select-chevron"
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="currentColor"
          >
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </div>

        {/* Hint */}
        <span className="llm-input-hint-text">
          {modeLabel} · Ctrl+Enter to send
        </span>

        {/* Right: action buttons */}
        <div className="llm-input-actions">
          {/* Image upload */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
          <button
            className="llm-toolbar-btn"
            onClick={() => imageInputRef.current?.click()}
            disabled={disabled}
            title="Attach image"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
            </svg>
          </button>

          {/* File / directory attach */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={async e => {
              const files = e.target.files;
              if (!files) return;
              for (const f of Array.from(files)) {
                if (f.type.startsWith('image/')) {
                  // Images → inline preview
                  const dataUrl = await new Promise<string>(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(f);
                  });
                  setImages(prev => [...prev, { id: genId(), dataUrl, file: f, preview: dataUrl }]);
                } else {
                  // Non-image files → attach as a path chip using the file name
                  // (browser File objects don't expose the full server path, so we
                  // attach by name; the @ picker is preferred for server-side paths)
                  const chipPath = f.name;
                  setAttachedPaths(prev => {
                    if (prev.find(a => a.path === chipPath)) return prev;
                    return [...prev, { id: genId(), path: chipPath, isDir: false }];
                  });
                }
              }
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            style={{ display: 'none' }}
          />
          <button
            className="llm-toolbar-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title="Attach file"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" />
            </svg>
          </button>

          {/* Send */}
          <button
            className="llm-send-btn"
            onClick={handleSend}
            disabled={!canSend}
            title="Send (Ctrl+Enter)"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default InputArea;
