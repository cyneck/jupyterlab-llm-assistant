/**
 * MemoryPanel — persistent memory management UI.
 *
 * Allows users to create, edit, enable/disable, and delete named memory entries
 * that are automatically injected into every LLM conversation as extra context.
 *
 * Features:
 *  - List all memories with enable/disable toggle
 *  - Create new memory (title + content + optional tags)
 *  - Inline editing of existing memories
 *  - Delete individual memories
 *  - Auto-reload on open
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PageConfig } from '@jupyterlab/coreutils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

interface MemoryPanelProps {
  onClose: () => void;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

function getXsrfToken(): string {
  const cookie = document.cookie.split(';').find(c => c.trim().startsWith('_xsrf='));
  return cookie ? decodeURIComponent(cookie.split('=')[1]) : '';
}

function getHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-XSRFToken': getXsrfToken() };
}

function memoryApiBase(): string {
  const root = (PageConfig.getOption('baseUrl') || '/').replace(/\/$/, '');
  return `${root}/llm-assistant/memory`;
}

async function fetchMemories(): Promise<MemoryEntry[]> {
  const r = await fetch(memoryApiBase(), { headers: getHeaders() });
  if (!r.ok) throw new Error(`Failed to load memories: ${r.statusText}`);
  const d = await r.json();
  return d.memories || [];
}

async function createMemory(
  title: string,
  content: string,
  tags: string[],
): Promise<MemoryEntry> {
  const r = await fetch(memoryApiBase(), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ title, content, tags }),
  });
  if (!r.ok) throw new Error(`Failed to create memory: ${r.statusText}`);
  return r.json();
}

async function updateMemory(
  id: string,
  patch: Partial<Pick<MemoryEntry, 'title' | 'content' | 'tags' | 'enabled'>>,
): Promise<MemoryEntry> {
  const r = await fetch(`${memoryApiBase()}/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`Failed to update memory: ${r.statusText}`);
  return r.json();
}

async function deleteMemory(id: string): Promise<void> {
  const r = await fetch(`${memoryApiBase()}/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!r.ok && r.status !== 204) throw new Error(`Failed to delete memory: ${r.statusText}`);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface MemoryFormProps {
  initial?: Partial<MemoryEntry>;
  onSave: (title: string, content: string, tags: string[]) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

const MemoryForm: React.FC<MemoryFormProps> = ({ initial, onSave, onCancel, saving }) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [tagsStr, setTagsStr] = useState((initial?.tags ?? []).join(', '));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsStr
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    await onSave(title.trim(), content.trim(), tags);
  };

  return (
    <form className="memory-form" onSubmit={handleSubmit}>
      <div className="memory-form-field">
        <label className="memory-form-label">Title *</label>
        <input
          className="memory-form-input"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. My preferred language"
          required
          autoFocus
        />
      </div>
      <div className="memory-form-field">
        <label className="memory-form-label">Content *</label>
        <textarea
          className="memory-form-textarea"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="e.g. Always respond in Python unless told otherwise."
          required
          rows={4}
        />
      </div>
      <div className="memory-form-field">
        <label className="memory-form-label">Tags (comma-separated, optional)</label>
        <input
          className="memory-form-input"
          type="text"
          value={tagsStr}
          onChange={e => setTagsStr(e.target.value)}
          placeholder="e.g. coding, style"
        />
      </div>
      <div className="memory-form-actions">
        <button
          type="button"
          className="memory-btn memory-btn-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="memory-btn memory-btn-primary"
          disabled={saving || !title.trim() || !content.trim()}
        >
          {saving ? 'Saving…' : initial?.id ? 'Update' : 'Add Memory'}
        </button>
      </div>
    </form>
  );
};

// ─── Main MemoryPanel ────────────────────────────────────────────────────────

export const MemoryPanel: React.FC<MemoryPanelProps> = ({ onClose }) => {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mems = await fetchMemories();
      setMemories(mems);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (title: string, content: string, tags: string[]) => {
    setSaving(true);
    try {
      const entry = await createMemory(title, content, tags);
      setMemories(prev => [entry, ...prev]);
      setShowAddForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, title: string, content: string, tags: string[]) => {
    setSaving(true);
    try {
      const updated = await updateMemory(id, { title, content, tags });
      setMemories(prev => prev.map(m => m.id === id ? updated : m));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      const updated = await updateMemory(id, { enabled });
      setMemories(prev => prev.map(m => m.id === id ? updated : m));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMemory(id);
      setMemories(prev => prev.filter(m => m.id !== id));
      setConfirmDeleteId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const enabledCount = memories.filter(m => m.enabled).length;

  return (
    <div className="memory-panel">
      {/* Header */}
      <div className="memory-header">
        <div className="memory-header-left">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="memory-header-icon">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
          </svg>
          <span className="memory-header-title">Memory</span>
          {enabledCount > 0 && (
            <span className="memory-count-badge">{enabledCount} active</span>
          )}
        </div>
        <div className="memory-header-actions">
          <button
            className="memory-icon-btn"
            onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
            title="Add memory"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
          <button className="memory-icon-btn" onClick={load} title="Refresh">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </button>
          <button className="memory-icon-btn" onClick={onClose} title="Close">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="memory-info-bar">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" style={{flexShrink: 0, opacity: 0.6}}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        <span>Active memories are injected into every conversation as context.</span>
      </div>

      {/* Error */}
      {error && (
        <div className="memory-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="memory-form-wrapper">
          <MemoryForm
            onSave={handleCreate}
            onCancel={() => setShowAddForm(false)}
            saving={saving}
          />
        </div>
      )}

      {/* List */}
      <div className="memory-list">
        {loading ? (
          <div className="memory-loading">Loading…</div>
        ) : memories.length === 0 ? (
          <div className="memory-empty">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" opacity="0.25">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
            <p>No memories yet.</p>
            <button
              className="memory-btn memory-btn-primary"
              onClick={() => setShowAddForm(true)}
            >
              Add your first memory
            </button>
          </div>
        ) : (
          memories.map(m => (
            <div key={m.id} className={`memory-item ${m.enabled ? '' : 'memory-item-disabled'}`}>
              {editingId === m.id ? (
                <div className="memory-form-wrapper">
                  <MemoryForm
                    initial={m}
                    onSave={(t, c, tags) => handleUpdate(m.id, t, c, tags)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                </div>
              ) : (
                <>
                  <div className="memory-item-header">
                    {/* Enable toggle */}
                    <button
                      className={`memory-toggle ${m.enabled ? 'memory-toggle-on' : 'memory-toggle-off'}`}
                      onClick={() => handleToggleEnabled(m.id, !m.enabled)}
                      title={m.enabled ? 'Disable memory' : 'Enable memory'}
                    >
                      <span className="memory-toggle-thumb" />
                    </button>

                    <span className="memory-item-title">{m.title}</span>

                    <div className="memory-item-actions">
                      <button
                        className="memory-item-btn"
                        onClick={() => { setEditingId(m.id); setShowAddForm(false); }}
                        title="Edit"
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                      </button>
                      {confirmDeleteId === m.id ? (
                        <span className="memory-confirm-delete">
                          <button
                            className="memory-item-btn memory-item-btn-danger"
                            onClick={() => handleDelete(m.id)}
                            title="Confirm delete"
                          >✓</button>
                          <button
                            className="memory-item-btn"
                            onClick={() => setConfirmDeleteId(null)}
                            title="Cancel"
                          >✕</button>
                        </span>
                      ) : (
                        <button
                          className="memory-item-btn"
                          onClick={() => setConfirmDeleteId(m.id)}
                          title="Delete"
                        >
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="memory-item-content">{m.content}</div>

                  {m.tags.length > 0 && (
                    <div className="memory-item-tags">
                      {m.tags.map(tag => (
                        <span key={tag} className="memory-tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MemoryPanel;
