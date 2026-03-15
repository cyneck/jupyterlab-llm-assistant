/**
 * Input area component for chat / agent / plan messages.
 *
 * v0.6.0 additions:
 * - Mode selector dropdown (Chat | Agent | Plan) below the textarea
 * - @ mention support: typing "@" opens a file/directory picker
 *   resolved from the current Jupyter working directory via the backend
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

/** One item in the @ picker list */
interface FileSuggestion {
  path: string;      // relative path shown to user
  isDir: boolean;
  label: string;     // basename for display
}

// Singleton API service (shared with rest of app)
const _api = new LLMApiService();

// ── Props ─────────────────────────────────────────────────────────────────────

export interface InputAreaProps {
  onSend: (text: string, images: ImageData[]) => void;
  disabled: boolean;
  enableVision: boolean;
  /** Current mode — shown in the selector */
  mode: AppMode;
  /** Called when user picks a different mode */
  onModeChange: (mode: AppMode) => void;
  /** Working root dir for @ resolution (defaults to cwd on server) */
  rootDir?: string;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Return the index of the last "@" in a string that starts a mention query. */
function findAtTrigger(value: string, cursor: number): number {
  // Only look in the text before the cursor
  const before = value.slice(0, cursor);
  const idx = before.lastIndexOf('@');
  if (idx === -1) return -1;
  // If there is a whitespace right after "@" it is not a trigger
  const afterAt = before.slice(idx + 1);
  if (/\s/.test(afterAt)) return -1;
  return idx;
}

/** Extract the current query string after "@" */
function getAtQuery(value: string, cursor: number, atIdx: number): string {
  return value.slice(atIdx + 1, cursor);
}

// ── Component ─────────────────────────────────────────────────────────────────

export const InputArea: React.FC<InputAreaProps> = ({
  onSend,
  disabled,
  enableVision,
  mode,
  onModeChange,
  rootDir,
}) => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<ImageData[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── @ mention state ──────────────────────────────────────────────────────
  const [atIdx, setAtIdx] = useState<number>(-1);          // position of "@" in text
  const [atQuery, setAtQuery] = useState<string>('');       // text typed after "@"
  const [suggestions, setSuggestions] = useState<FileSuggestion[]>([]);
  const [suggestionIdx, setSuggestionIdx] = useState<number>(0);  // keyboard highlight
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const mentionMenuRef = useRef<HTMLDivElement>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [text]);

  // ── Fetch file suggestions when atQuery changes ───────────────────────────
  useEffect(() => {
    if (atIdx === -1) {
      setSuggestions([]);
      return;
    }

    // Cancel previous request
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = new AbortController();

    setLoadingSuggestions(true);
    const query = atQuery;
    const root = rootDir || '';

    const fetchSuggestions = async () => {
      try {
        // Resolve the query as a path prefix — list the directory if it ends
        // with "/" or enumerate files matching the prefix otherwise.
        const searchPath = query || '.';
        const result = await _api.resolveContextPath(searchPath, root);

        const items: FileSuggestion[] = result.paths.slice(0, 20).map(p => ({
          path: p,
          isDir: false,
          label: p.split('/').pop() || p,
        }));

        // If no query, also add "." as a directory option
        if (!query) {
          items.unshift({ path: '.', isDir: true, label: '. (current dir)' });
        }

        setSuggestions(items);
        setSuggestionIdx(0);
      } catch {
        // If resolve fails, just show nothing
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    // Debounce 150 ms
    const timer = setTimeout(fetchSuggestions, 150);
    return () => clearTimeout(timer);
  }, [atIdx, atQuery, rootDir]);

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
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [atIdx]);

  // ── Handle text change — detect "@" trigger ───────────────────────────────
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
      } else {
        setAtIdx(-1);
        setAtQuery('');
        setSuggestions([]);
      }
    },
    []
  );

  // ── Insert chosen file path into text ─────────────────────────────────────
  const handleSelectSuggestion = useCallback(
    (suggestion: FileSuggestion) => {
      if (atIdx === -1) return;
      const cursor = textareaRef.current?.selectionStart ?? text.length;
      const before = text.slice(0, atIdx);
      const after = text.slice(cursor);
      const inserted = `@${suggestion.path} `;
      const newText = before + inserted + after;
      setText(newText);

      // Reset mention state
      setAtIdx(-1);
      setAtQuery('');
      setSuggestions([]);

      // Restore focus and position cursor after inserted text
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newCursor = before.length + inserted.length;
          textareaRef.current.setSelectionRange(newCursor, newCursor);
        }
      });
    },
    [atIdx, text]
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
        newImages.push({ id: generateId(), dataUrl, file, preview: dataUrl });
      }
      setImages(prev => [...prev, ...newImages]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    []
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      if (!enableVision) return;
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
        newImages.push({ id: generateId(), dataUrl, file, preview: dataUrl });
      }
      if (newImages.length > 0) setImages(prev => [...prev, ...newImages]);
    },
    [enableVision]
  );

  const handleRemoveImage = useCallback(
    (id: string) => setImages(prev => prev.filter(img => img.id !== id)),
    []
  );

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    if (disabled) return;
    if (!text.trim() && images.length === 0) return;
    onSend(text.trim(), images);
    setText('');
    setImages([]);
    setAtIdx(-1);
    setSuggestions([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, images, disabled, onSend]);

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
          return;
        }
      }

      // Send on Enter (without Shift), only when no mention menu open
      if (e.key === 'Enter' && !e.shiftKey && atIdx === -1) {
        e.preventDefault();
        handleSend();
      }
    },
    [atIdx, suggestions, suggestionIdx, handleSelectSuggestion, handleSend]
  );

  const handleImageButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const canSend = !disabled && (text.trim().length > 0 || images.length > 0);

  // ── Mode label helper ─────────────────────────────────────────────────────
  const modeLabel = useMemo<string>(() => {
    if (mode === 'chat') return 'Chat';
    if (mode === 'agent') return 'Agent';
    return 'Plan';
  }, [mode]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="llm-input-area">
      {/* Image previews */}
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

      {/* @ mention popup — positioned above the input row */}
      {atIdx !== -1 && (
        <div className="llm-mention-menu" ref={mentionMenuRef}>
          {loadingSuggestions ? (
            <div className="llm-mention-loading">Loading files…</div>
          ) : suggestions.length === 0 ? (
            <div className="llm-mention-empty">No matching files</div>
          ) : (
            suggestions.map((s, i) => (
              <div
                key={s.path}
                className={`llm-mention-item ${i === suggestionIdx ? 'active' : ''}`}
                onMouseDown={e => {
                  e.preventDefault(); // keep focus on textarea
                  handleSelectSuggestion(s);
                }}
                onMouseEnter={() => setSuggestionIdx(i)}
              >
                {/* Icon: folder vs file */}
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
                <span className="llm-mention-label" title={s.path}>
                  {s.label}
                </span>
                <span className="llm-mention-path">{s.path}</span>
              </div>
            ))
          )}
          <div className="llm-mention-hint">
            ↑↓ navigate · Tab/Enter select · Esc close
          </div>
        </div>
      )}

      {/* Input row */}
      <div className="llm-input-row">
        {/* Image upload button */}
        {enableVision && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <button
              className="llm-image-btn"
              onClick={handleImageButtonClick}
              disabled={disabled}
              title="Attach image"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
              </svg>
            </button>
          </>
        )}

        {/* Text input */}
        <textarea
          ref={textareaRef}
          className="llm-text-input"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            enableVision
              ? 'Send a message… (paste images · @ to reference files)'
              : 'Send a message… (@ to reference files)'
          }
          disabled={disabled}
          rows={1}
        />

        {/* Send button */}
        <button
          className="llm-send-btn"
          onClick={handleSend}
          disabled={!canSend}
          title="Send message (Enter)"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>

      {/* ── Bottom toolbar: mode selector + hint ──────────────────────────── */}
      <div className="llm-input-footer">
        {/* Mode selector */}
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
            <option value="chat">Chat — direct conversation</option>
            <option value="agent">Agent — reads/writes files & runs commands</option>
            <option value="plan">Plan — generate a plan, then execute step by step</option>
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

        {/* Hint text */}
        <div className="llm-input-hint">
          <span>Enter · Shift+Enter for newline · @ for files</span>
        </div>
      </div>
    </div>
  );
};

export default InputArea;
