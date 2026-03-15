/**
 * PlanPanel — two-phase Plan mode.
 *
 * Phase 1  Generate: the user types a high-level task and the LLM returns a
 *          numbered step list.  Steps are rendered as editable cards.
 *
 * Phase 2  Execute:  after the user confirms the plan, each step runs through
 *          the coding agent one by one.  The user may skip any step or abort
 *          the whole run.  Each step shows live streaming output (text +
 *          tool calls) collapsed under the step card.
 *
 * History persistence: same localStorage pattern as AgentPanel.
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { LLMSettings, PlanStep, AgentDisplayMessage, ToolCallEntry } from '../models/types';
import { LLMApiService } from '../services/api';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallDisplay } from './ToolCallDisplay';
import type { AppMode } from './ChatPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanPanelProps {
  settings: LLMSettings;
  contextText?: string;
  contextFileCount?: number;
  /** Current app mode — passed down so the mode selector stays in sync */
  mode?: AppMode;
  /** Called when user switches mode via the selector */
  onModeChange?: (mode: AppMode) => void;
}

interface StepExecution {
  stepId: number;
  messages: AgentDisplayMessage[];
  isRunning: boolean;
  isExpanded: boolean;
  finalText: string;
}

type PanelPhase = 'input' | 'generating' | 'review' | 'executing' | 'done';

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'jlab-llm-plan-session';

interface PersistedPlan {
  task: string;
  steps: PlanStep[];
  executions: Record<number, { messages: AgentDisplayMessage[]; finalText: string }>;
  savedAt: number;
}

function savePlan(p: PersistedPlan) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

function loadPlan(): PersistedPlan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearPlan() { localStorage.removeItem(STORAGE_KEY); }

// ─── uid ──────────────────────────────────────────────────────────────────────

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

// ─── StepCard ─────────────────────────────────────────────────────────────────

interface StepCardProps {
  step: PlanStep;
  exec?: StepExecution;
  isCurrent: boolean;
  phase: PanelPhase;
  onEdit: (id: number, title: string, desc: string) => void;
  onSkip: (id: number) => void;
  onToggleExpand: (id: number) => void;
}

const StatusIcon: React.FC<{ status: PlanStep['status'] }> = ({ status }) => {
  switch (status) {
    case 'completed':
      return (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style={{ color: 'var(--jp-success-color1, #4caf50)' }}>
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      );
    case 'running':
      return <span className="plan-step-spinner" />;
    case 'error':
      return (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style={{ color: 'var(--jp-error-color1, #f44336)' }}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      );
    case 'skipped':
      return (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style={{ color: 'var(--jp-content-font-color3)' }}>
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style={{ color: 'var(--jp-content-font-color3)' }}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      );
  }
};

const StepCard: React.FC<StepCardProps> = ({ step, exec, isCurrent, phase, onEdit, onSkip, onToggleExpand }) => {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(step.title);
  const [editDesc, setEditDesc] = useState(step.description);

  const canEdit = phase === 'review';
  const showOutput = !!exec && exec.messages.length > 0;

  const handleSave = () => {
    onEdit(step.id, editTitle.trim() || step.title, editDesc.trim() || step.description);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(step.title);
    setEditDesc(step.description);
    setEditing(false);
  };

  return (
    <div className={`plan-step-card plan-step-${step.status} ${isCurrent ? 'plan-step-current' : ''}`}>
      <div className="plan-step-header">
        <span className="plan-step-num">{step.id}</span>
        <StatusIcon status={step.status} />
        {editing ? (
          <div className="plan-step-edit-area">
            <input
              className="plan-step-edit-title"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder="Step title"
            />
            <textarea
              className="plan-step-edit-desc"
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={3}
              placeholder="Step description"
            />
            <div className="plan-step-edit-actions">
              <button className="plan-btn plan-btn-sm plan-btn-primary" onClick={handleSave}>Save</button>
              <button className="plan-btn plan-btn-sm" onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="plan-step-body">
            <span className="plan-step-title">{step.title}</span>
            <span className="plan-step-desc">{step.description}</span>
          </div>
        )}
        {canEdit && !editing && (
          <div className="plan-step-actions">
            <button
              className="plan-step-action-btn"
              onClick={() => setEditing(true)}
              title="Edit step"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
              </svg>
            </button>
            <button
              className="plan-step-action-btn"
              onClick={() => onSkip(step.id)}
              title="Skip this step"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>
        )}
        {(phase === 'executing' || phase === 'done') && step.status !== 'pending' && showOutput && (
          <button
            className="plan-step-action-btn"
            onClick={() => onToggleExpand(step.id)}
            title="Toggle output"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>
        )}
      </div>

      {/* Streaming output for this step */}
      {showOutput && exec?.isExpanded && (
        <div className="plan-step-output">
          {exec.messages.map(msg => (
            <div key={msg.id} className={`plan-step-msg plan-step-msg-${msg.type}`}>
              {msg.type === 'agent_text' && (
                <div className="plan-step-text">
                  <MarkdownRenderer content={msg.content || ''} />
                  {msg.isStreaming && <span className="agent-cursor" />}
                </div>
              )}
              {msg.type === 'tool_call' && msg.toolCall && (
                <ToolCallDisplay entry={msg.toolCall} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── PlanPanel ────────────────────────────────────────────────────────────────

export const PlanPanel: React.FC<PlanPanelProps> = ({
  settings,
  contextText,
  contextFileCount = 0,
  mode = 'plan',
  onModeChange,
}) => {
  const [phase, setPhase] = useState<PanelPhase>('input');
  const [taskInput, setTaskInput] = useState('');
  const [steps, setSteps] = useState<PlanStep[]>([]);
  const [generatingText, setGeneratingText] = useState('');
  const [executions, setExecutions] = useState<Record<number, StepExecution>>({});
  const [currentStepId, setCurrentStepId] = useState<number | null>(null);
  const [rootDir, setRootDir] = useState('');
  const [showDirInput, setShowDirInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRun, setAutoRun] = useState(false);

  const apiService = useRef(new LLMApiService());
  const abortRef = useRef<AbortController | null>(null);
  const historyRef = useRef<Array<{ role: string; content: string }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restore from localStorage on mount
  useEffect(() => {
    const saved = loadPlan();
    if (saved && saved.steps.length > 0) {
      setTaskInput(saved.task);
      setSteps(saved.steps);
      const restored: Record<number, StepExecution> = {};
      for (const [k, v] of Object.entries(saved.executions || {})) {
        restored[Number(k)] = {
          stepId: Number(k),
          messages: v.messages,
          isRunning: false,
          isExpanded: false,
          finalText: v.finalText,
        };
      }
      setExecutions(restored);
      const anyRunning = saved.steps.some(s => s.status === 'running');
      const allDone = saved.steps.every(s => s.status !== 'pending' && s.status !== 'running');
      setPhase(allDone ? 'done' : anyRunning ? 'executing' : 'review');
    }
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps, executions, generatingText]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [taskInput]);

  // ── upsertExecMessage ──────────────────────────────────────────────────────
  const upsertExecMessage = useCallback((
    stepId: number,
    msgId: string,
    updater: (prev: AgentDisplayMessage | undefined) => AgentDisplayMessage,
  ) => {
    setExecutions(prev => {
      const exec = prev[stepId] ?? { stepId, messages: [], isRunning: true, isExpanded: true, finalText: '' };
      const idx = exec.messages.findIndex(m => m.id === msgId);
      const newMessages = [...exec.messages];
      if (idx === -1) newMessages.push(updater(undefined));
      else newMessages[idx] = updater(newMessages[idx]);
      return { ...prev, [stepId]: { ...exec, messages: newMessages } };
    });
  }, []);

  const updateExecToolCall = useCallback((stepId: number, msgId: string, toolUpdater: (tc: ToolCallEntry) => ToolCallEntry) => {
    setExecutions(prev => {
      const exec = prev[stepId];
      if (!exec) return prev;
      const newMessages = exec.messages.map(m =>
        m.id === msgId && m.toolCall ? { ...m, toolCall: toolUpdater(m.toolCall) } : m
      );
      return { ...prev, [stepId]: { ...exec, messages: newMessages } };
    });
  }, []);

  // ── Generate Plan ──────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    const task = taskInput.trim();
    if (!task) return;

    setPhase('generating');
    setGeneratingText('');
    setError(null);
    setSteps([]);
    historyRef.current = [];

    abortRef.current = new AbortController();

    let accText = '';
    try {
      await apiService.current.generatePlan(
        task,
        (event) => {
          if (event.type === 'text') {
            accText += event.data?.content || '';
            setGeneratingText(accText);
          } else if (event.type === 'plan') {
            const parsed: PlanStep[] = event.data?.steps ?? [];
            setSteps(parsed);
            setPhase('review');
            setGeneratingText('');
            savePlan({ task, steps: parsed, executions: {}, savedAt: Date.now() });
          } else if (event.type === 'error') {
            setError(event.data?.message || 'Plan generation failed');
            setPhase('input');
          }
        },
        contextText,
        abortRef.current.signal,
      );
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
      setPhase('input');
    }
  }, [taskInput, contextText]);

  // ── Execute single step ────────────────────────────────────────────────────
  const executeStep = useCallback(async (step: PlanStep): Promise<string> => {
    setCurrentStepId(step.id);
    setSteps(prev => prev.map(s => s.id === step.id ? { ...s, status: 'running' } : s));
    setExecutions(prev => ({
      ...prev,
      [step.id]: {
        stepId: step.id,
        messages: [],
        isRunning: true,
        isExpanded: true,
        finalText: '',
      },
    }));

    abortRef.current = new AbortController();

    let currentTextId = uid();
    let currentTextContent = '';
    let textMsgCreated = false;
    const toolMsgMap: Record<string, string> = {};
    let finalAssistantText = '';

    try {
      await apiService.current.executePlanStep(
        step,
        historyRef.current,
        (event) => {
          switch (event.type) {
            case 'text': {
              const chunk: string = event.data?.content || '';
              currentTextContent += chunk;
              finalAssistantText += chunk;
              if (!textMsgCreated) {
                textMsgCreated = true;
                upsertExecMessage(step.id, currentTextId, () => ({
                  id: currentTextId, type: 'agent_text', content: currentTextContent,
                  timestamp: Date.now(), isStreaming: true,
                }));
              } else {
                upsertExecMessage(step.id, currentTextId, prev => ({
                  ...prev!, content: currentTextContent, isStreaming: true,
                }));
              }
              break;
            }
            case 'tool_call': {
              const { id: toolId, name, args } = event.data;
              const msgId = uid();
              toolMsgMap[toolId] = msgId;
              if (textMsgCreated) {
                upsertExecMessage(step.id, currentTextId, prev => ({ ...prev!, isStreaming: false }));
                currentTextId = uid();
                currentTextContent = '';
                textMsgCreated = false;
              }
              const entry: ToolCallEntry = { id: toolId, name, args, status: 'running', startTime: Date.now() };
              upsertExecMessage(step.id, msgId, () => ({
                id: msgId, type: 'tool_call', toolCall: entry, timestamp: Date.now(),
              }));
              break;
            }
            case 'tool_result': {
              const { id: toolId, name, success, output } = event.data;
              const msgId = toolMsgMap[toolId];
              if (msgId) {
                updateExecToolCall(step.id, msgId, tc => ({
                  ...tc, status: success ? 'success' : 'error', endTime: Date.now(),
                  result: { id: toolId, name, success, output },
                }));
              }
              break;
            }
            case 'done': {
              if (textMsgCreated) {
                upsertExecMessage(step.id, currentTextId, prev => ({ ...prev!, isStreaming: false }));
              }
              break;
            }
            case 'error': {
              setError(event.data?.message || 'Step execution error');
              if (textMsgCreated) {
                upsertExecMessage(step.id, currentTextId, prev => ({ ...prev!, isStreaming: false }));
              }
              break;
            }
          }
        },
        rootDir || undefined,
        // Only pass contextText on the very first step (no history yet)
        historyRef.current.length === 0 ? contextText : undefined,
        settings,
        abortRef.current.signal,
      );

      // Append this step's turn to history for the next step
      const stepInstruction = `## Step ${step.id}: ${step.title}\n\n${step.description}`;
      historyRef.current.push({ role: 'user', content: stepInstruction });
      if (finalAssistantText) {
        historyRef.current.push({ role: 'assistant', content: finalAssistantText });
      }

      setSteps(prev => prev.map(s => s.id === step.id ? { ...s, status: 'completed' } : s));
      setExecutions(prev => ({
        ...prev,
        [step.id]: { ...prev[step.id], isRunning: false, finalText: finalAssistantText },
      }));
      return finalAssistantText;
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (!isAbort) {
        setSteps(prev => prev.map(s => s.id === step.id ? { ...s, status: 'error' } : s));
      }
      setExecutions(prev => ({
        ...prev,
        [step.id]: { ...prev[step.id], isRunning: false },
      }));
      throw err;
    } finally {
      setCurrentStepId(null);
    }
  }, [settings, rootDir, contextText, upsertExecMessage, updateExecToolCall]);

  // ── Run all steps sequentially ─────────────────────────────────────────────
  // When autoRun is true  → execute every pending step one after another.
  // When autoRun is false → execute only the *first* pending step, then pause
  //                         so the user can review before continuing.
  const handleRunAll = useCallback(async () => {
    setPhase('executing');
    setError(null);
    historyRef.current = [];

    const pendingSteps = steps.filter(s => s.status === 'pending');

    for (const step of pendingSteps) {
      try {
        await executeStep(step);
        // Persist state after each step using the functional updater
        // to access the latest steps rather than the stale closure snapshot.
        // executions are also captured from state to preserve step outputs.
        setSteps(current => {
          setExecutions(currentExecs => {
            const persistedExecs: Record<number, { messages: AgentDisplayMessage[]; finalText: string }> = {};
            for (const [k, v] of Object.entries(currentExecs)) {
              persistedExecs[Number(k)] = { messages: v.messages, finalText: v.finalText };
            }
            savePlan({
              task: taskInput,
              steps: current,
              executions: persistedExecs,
              savedAt: Date.now(),
            });
            return currentExecs;
          });
          return current;
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User stopped — mark remaining as pending, stay in executing phase
          break;
        }
        // On error, stop the chain
        break;
      }

      // In manual mode (autoRun=false) pause after each step and let the user
      // trigger the next one by clicking "Run step N" or "Continue".
      if (!autoRun) break;
    }

    // Use functional updater to read the *current* steps state (not the stale
    // closure value captured when handleRunAll was created).
    setSteps(current => {
      const allFinished = current.every(s => s.status !== 'pending' && s.status !== 'running');
      if (allFinished) setPhase('done');
      return current;
    });
  }, [steps, autoRun, executeStep, taskInput]);

  // ── Run single step (manual) ───────────────────────────────────────────────
  const handleRunStep = useCallback(async (step: PlanStep) => {
    if (phase !== 'review' && phase !== 'executing') return;
    setPhase('executing');
    try {
      await executeStep(step);
    } catch { /* errors handled inside */ }
    setSteps(current => {
      const allFinished = current.every(s => s.status !== 'pending' && s.status !== 'running');
      if (allFinished) setPhase('done');
      return current;
    });
  }, [phase, executeStep]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const handleSkipStep = useCallback((id: number) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status: 'skipped' } : s));
  }, []);

  const handleToggleExpand = useCallback((id: number) => {
    setExecutions(prev => {
      const exec = prev[id];
      if (!exec) return prev;
      return { ...prev, [id]: { ...exec, isExpanded: !exec.isExpanded } };
    });
  }, []);

  const handleEditStep = useCallback((id: number, title: string, desc: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, title, description: desc } : s));
  }, []);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    clearPlan();
    setPhase('input');
    setTaskInput('');
    setSteps([]);
    setExecutions({});
    setGeneratingText('');
    setError(null);
    historyRef.current = [];
  }, []);

  const hasApiKey = !!(settings.hasApiKey || (settings.apiKey && settings.apiKey.length > 0));
  const isRunning = phase === 'executing' && currentStepId !== null;
  const pendingCount = steps.filter(s => s.status === 'pending').length;

  return (
    <div className="plan-panel">
      {/* ── Panel header ─────────────────────────────── */}
      <div className="agent-header">
        <div className="agent-header-left">
          <span className="agent-header-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
            </svg>
          </span>
          <span className="agent-header-title">Plan Mode</span>
          {steps.length > 0 && (
            <span className="agent-model-badge">{steps.length} steps</span>
          )}
        </div>
        <div className="agent-header-actions">
          {/* Working dir */}
          <button
            className="agent-header-btn"
            onClick={() => setShowDirInput(v => !v)}
            title="Set working directory"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            </svg>
          </button>
          {/* Auto-run toggle */}
          {(phase === 'review' || phase === 'executing') && (
            <button
              className={`agent-header-btn ${autoRun ? 'active' : ''}`}
              onClick={() => setAutoRun(v => !v)}
              title={autoRun
                ? 'Auto-run ON: steps execute one after another automatically — click to switch to manual'
                : 'Auto-run OFF: pauses after each step for review — click to run all automatically'}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}
          {/* Reset */}
          <button
            className="agent-header-btn"
            onClick={handleReset}
            title="Reset — start new plan"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Working dir input */}
      {showDirInput && (
        <div className="agent-dir-input-row">
          <span className="agent-dir-label">Working dir:</span>
          <input
            className="agent-dir-input"
            type="text"
            value={rootDir}
            onChange={e => setRootDir(e.target.value)}
            placeholder="/path/to/project"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="agent-error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ── Content ───────────────────────────────────── */}
      <div className="plan-body" ref={scrollRef}>

        {/* Phase: input */}
        {phase === 'input' && (
          <div className="plan-empty-state">
            <div className="agent-empty-icon">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" opacity="0.3">
                <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
              </svg>
            </div>
            <p className="agent-empty-title">Plan Mode</p>
            <p className="agent-empty-hint">
              Describe your task and the AI will generate a step-by-step plan.
              Review and edit each step before execution.
            </p>
            <div className="agent-example-prompts">
              {[
                'Add unit tests for all Python files in src/',
                'Refactor the API client to use async/await',
                'Create a REST API with FastAPI and SQLite',
                'Set up a CI pipeline with GitHub Actions',
              ].map(p => (
                <button
                  key={p}
                  className="agent-example-btn"
                  onClick={() => setTaskInput(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Phase: generating */}
        {phase === 'generating' && (
          <div className="plan-generating">
            <div className="agent-thinking">
              <span className="agent-thinking-dots"><span /><span /><span /></span>
              <span className="agent-thinking-label">Generating plan…</span>
            </div>
            {generatingText && (
              <div className="plan-generating-preview">
                <pre>{generatingText}</pre>
              </div>
            )}
          </div>
        )}

        {/* Phase: review / executing / done — show step cards */}
        {(phase === 'review' || phase === 'executing' || phase === 'done') && steps.length > 0 && (
          <>
            {/* Task summary */}
            <div className="plan-task-header">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style={{ opacity: 0.6, flexShrink: 0 }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
              <span className="plan-task-text">{taskInput}</span>
            </div>

            {phase === 'review' && (
              <div className="plan-review-bar">
                <span className="plan-review-hint">
                  Review and edit steps, then run the plan.
                </span>
              </div>
            )}

            {/* Step cards */}
            <div className="plan-steps-list">
              {steps.map(step => (
                <div key={step.id} className="plan-step-wrapper">
                  <StepCard
                    step={step}
                    exec={executions[step.id]}
                    isCurrent={currentStepId === step.id}
                    phase={phase}
                    onEdit={handleEditStep}
                    onSkip={handleSkipStep}
                    onToggleExpand={handleToggleExpand}
                  />
                  {/* In review mode: "Run just this step" button */}
                  {phase === 'review' && step.status === 'pending' && (
                    <button
                      className="plan-run-step-btn"
                      onClick={() => handleRunStep(step)}
                      title="Execute only this step"
                    >
                      Run this step
                    </button>
                  )}
                  {/* In executing mode, show "Run" for pending steps if not auto-run */}
                  {phase === 'executing' && step.status === 'pending' && !isRunning && (
                    <button
                      className="plan-run-step-btn"
                      onClick={() => handleRunStep(step)}
                    >
                      Run step {step.id}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Done summary */}
            {phase === 'done' && (
              <div className="plan-done-banner">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                <span>All steps completed</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Input / action bar ───────────────────────────── */}
      <div className="agent-input-area">
        {(phase === 'input' || phase === 'generating') && (
          <>
            <textarea
              ref={textareaRef}
              className="agent-input-textarea"
              value={taskInput}
              onChange={e => setTaskInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (taskInput.trim() && hasApiKey && phase === 'input') handleGenerate();
                }
              }}
              placeholder={
                !hasApiKey
                  ? 'API key not configured — go to settings'
                  : 'Describe your task… (Enter to generate plan)'
              }
              disabled={phase === 'generating' || !hasApiKey}
              rows={1}
            />
            <div className="agent-input-actions">
              {phase === 'generating' ? (
                <button className="agent-stop-btn" onClick={handleStop} title="Cancel">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M6 6h12v12H6z" />
                  </svg>
                </button>
              ) : (
                <button
                  className="agent-send-btn"
                  onClick={handleGenerate}
                  disabled={!taskInput.trim() || !hasApiKey}
                  title="Generate plan (Enter)"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                  </svg>
                </button>
              )}
            </div>
            <div className="agent-input-hint">
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
                  onChange={e => onModeChange?.(e.target.value as AppMode)}
                  disabled={phase === 'generating' || isRunning}
                  title="Switch mode"
                >
                  <option value="chat">Chat — direct conversation</option>
                  <option value="agent">Agent — reads/writes files &amp; runs commands</option>
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
              {contextFileCount > 0 && (
                <span className="agent-cwd-label">📄 {contextFileCount} file{contextFileCount !== 1 ? 's' : ''}</span>
              )}
            </div>
          </>
        )}

        {phase === 'review' && (
          <div className="plan-action-bar">
            <button
              className="plan-btn plan-btn-primary plan-btn-run"
              onClick={handleRunAll}
              disabled={pendingCount === 0}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Run all {pendingCount} step{pendingCount !== 1 ? 's' : ''}
            </button>
            <button className="plan-btn" onClick={handleReset}>
              Start over
            </button>
          </div>
        )}

        {phase === 'executing' && (
          <div className="plan-action-bar">
            {isRunning ? (
              <button className="agent-stop-btn" onClick={handleStop} title="Stop current step">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M6 6h12v12H6z" />
                </svg>
                Stop
              </button>
            ) : (
              <button
                className="plan-btn plan-btn-primary plan-btn-run"
                onClick={handleRunAll}
                disabled={pendingCount === 0}
              >
                Continue ({pendingCount} remaining)
              </button>
            )}
            <button className="plan-btn" onClick={handleReset} disabled={isRunning}>
              Reset
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="plan-action-bar">
            <button className="plan-btn plan-btn-primary" onClick={handleReset}>
              New plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanPanel;
