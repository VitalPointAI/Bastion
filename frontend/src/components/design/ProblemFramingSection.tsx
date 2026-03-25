/**
 * ProblemFramingSection
 *
 * Phase 25 Plan 02: Structured JP 5-0 problem framing form with auto-save,
 * auto-generated problem statement, and AI panel integration.
 */

import { useState, useEffect, useRef, useCallback, type TextareaHTMLAttributes } from 'react';
import Markdown from 'react-markdown';
import type { ProblemFramingData } from '../../lib/design-service.ts';

/** Auto-expanding textarea that grows to fit content */
function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 60)}px`;
  }, []);
  useEffect(() => { resize(); }, [props.value, resize]);
  return <textarea ref={ref} {...props} onInput={(e) => { resize(); props.onInput?.(e); }} style={{ ...props.style, overflow: 'hidden', minHeight: '60px' }} />;
}

/** Content field with loading indicator, rich-text/markdown toggle */
function ContentField({
  label, value, onChange, onFocus, onBlur, placeholder, isLoading,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  placeholder: string;
  isLoading?: boolean;
}) {
  const [viewMode, setViewMode] = useState<'rich' | 'markdown'>('rich');
  const [isEditing, setIsEditing] = useState(false);

  // Switch to edit mode on click in rich view
  const handleRichClick = () => {
    setIsEditing(true);
    setViewMode('markdown');
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <div className="flex items-center gap-2">
          {isLoading && (
            <span className="text-[10px] text-blue-400 animate-pulse flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </span>
          )}
          {value && (
            <div className="flex text-[10px] border border-slate-600 rounded overflow-hidden">
              <button
                type="button"
                onClick={() => { setViewMode('rich'); setIsEditing(false); }}
                className={`px-1.5 py-0.5 ${viewMode === 'rich' && !isEditing ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'}`}
              >Rich</button>
              <button
                type="button"
                onClick={() => { setViewMode('markdown'); setIsEditing(true); }}
                className={`px-1.5 py-0.5 ${viewMode === 'markdown' || isEditing ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'}`}
              >Markdown</button>
            </div>
          )}
        </div>
      </div>
      {isLoading && !value && (
        <div className="w-full bg-gray-700/50 border border-gray-600 rounded-md p-3 text-sm animate-pulse">
          <div className="h-3 bg-gray-600 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-600 rounded w-1/2" />
        </div>
      )}
      {viewMode === 'rich' && value && !isEditing ? (
        <div
          onClick={handleRichClick}
          className="w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-md p-2 text-sm
            cursor-text min-h-[60px] prose prose-sm prose-invert max-w-none
            prose-p:my-3 prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2 prose-strong:text-blue-300
            prose-headings:mt-4 prose-headings:mb-2 hover:border-blue-500/50 transition-colors"
        >
          <Markdown>{value.replace(/\n(?!\n)/g, '  \n')}</Markdown>
        </div>
      ) : (
        <AutoTextarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { onFocus(); setIsEditing(true); }}
          onBlur={() => { onBlur(); if (viewMode === 'rich') setIsEditing(false); }}
          placeholder={placeholder}
          className="w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      )}
    </div>
  );
}
import { useIronclawContext } from '../../context/IronclawContext.tsx';
import { useDesignInterview, getRoleColor } from '../../hooks/useDesignInterview.ts';
import { DesignInterviewProgress } from './DesignInterviewProgress.tsx';
import { DesignInterviewGate } from './DesignInterviewGate.tsx';

export interface ProblemFramingSectionProps {
  problemSetId: string;
  initialData: ProblemFramingData;
  onUpdate: (data: ProblemFramingData) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function summarize(text: string, maxLen = 60): string {
  if (!text) return '...';
  return text.length <= maxLen ? text : text.slice(0, maxLen).trimEnd() + '...';
}

function generateProblemStatement(data: ProblemFramingData): string {
  if (!data.currentState && !data.desiredEndState) return '';
  const current = summarize(data.currentState);
  const desired = summarize(data.desiredEndState);
  const obstacleCount = data.obstacles.filter(Boolean).length;
  const constraintCount = data.constraints.filter(Boolean).length;
  let stmt = `How to transition from [${current}] to [${desired}]`;
  if (obstacleCount > 0 || constraintCount > 0) {
    const parts: string[] = [];
    if (obstacleCount > 0) parts.push(`${obstacleCount} obstacle${obstacleCount > 1 ? 's' : ''}`);
    if (constraintCount > 0) parts.push(`${constraintCount} constraint${constraintCount > 1 ? 's' : ''}`);
    stmt += ` given ${parts.join(' and ')}`;
  }
  return stmt + '.';
}

// ─── Dynamic List Component ─────────────────────────────────────────────────

function DynamicList({
  label,
  items,
  onUpdate,
  placeholder,
}: {
  label: string;
  items: string[];
  onUpdate: (items: string[]) => void;
  placeholder?: string;
}) {
  const handleChange = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onUpdate(next);
  };

  const handleRemove = (index: number) => {
    onUpdate(items.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    onUpdate([...items, '']);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => handleChange(index, e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-gray-700 border border-gray-600 text-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={() => handleRemove(index)}
              className="text-gray-500 hover:text-red-400 text-sm px-1 transition-colors"
              title="Remove"
            >
              x
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={handleAdd}
        className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
      >
        + Add {label.replace(/s$/, '')}
      </button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

// Design field names that map to ProblemFramingData keys
const FIELD_MAP: Record<string, keyof ProblemFramingData> = {
  currentState: 'currentState',
  current_state: 'currentState',
  desiredEndState: 'desiredEndState',
  desired_end_state: 'desiredEndState',
  problemStatement: 'problemStatement',
  problem_statement: 'problemStatement',
};

export function ProblemFramingSection({ problemSetId, initialData, onUpdate }: ProblemFramingSectionProps) {
  const { toggleDrawer, onFieldWrite } = useIronclawContext();
  const designInterview = useDesignInterview(problemSetId);
  const { participants, isCollaborative, isMyTurn } = designInterview;
  const [formData, setFormData] = useState<ProblemFramingData>(() => ({
    ...initialData,
    problemStatement: initialData.problemStatement || generateProblemStatement(initialData),
  }));
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [generatingFields, setGeneratingFields] = useState<Set<string>>(new Set());
  const synthesizeAttempted = useRef(false);

  // Track focus state to avoid overwriting user edits with interview-sourced data
  const inputFocusedRef = useRef(false);
  const [pendingInterviewUpdate, setPendingInterviewUpdate] = useState<ProblemFramingData | null>(null);
  const [showPendingNotice, setShowPendingNotice] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  // Subscribe to Ironclaw field write events — drafts go directly into form fields
  useEffect(() => {
    const handleFieldWrite = (e: Event) => {
      const { targetField, value } = (e as CustomEvent).detail as { targetField: string; value: string | string[] };
      const fieldKey = FIELD_MAP[targetField];
      if (fieldKey && typeof value === 'string') {
        setFormData((prev) => ({ ...prev, [fieldKey]: value }));
        setGeneratingFields((prev) => { const next = new Set(prev); next.delete(fieldKey); return next; });
      }
      // Handle array fields (keyTensions, obstacles)
      if (targetField === 'keyTensions' || targetField === 'key_tensions') {
        const items = Array.isArray(value) ? value : (value as string).split('\n').filter(Boolean);
        setFormData((prev) => ({ ...prev, keyTensions: items }));
      }
      if (targetField === 'obstacles') {
        const items = Array.isArray(value) ? value : (value as string).split('\n').filter(Boolean);
        setFormData((prev) => ({ ...prev, obstacles: items }));
      }
    };
    // Listen for "generating" signal (interview is processing, fields incoming)
    const handleGenerating = (e: Event) => {
      const fields = (e as CustomEvent).detail?.fields as string[] | undefined;
      if (fields) {
        setGeneratingFields(new Set(fields.map((f) => FIELD_MAP[f] ?? f)));
      }
    };
    // Listen to both the context bus and custom event
    const unsubContext = onFieldWrite((event) => {
      handleFieldWrite(new CustomEvent('', { detail: event }));
    });
    window.addEventListener('ironclaw:field-write', handleFieldWrite);
    window.addEventListener('ironclaw:generating', handleGenerating);
    return () => {
      unsubContext();
      window.removeEventListener('ironclaw:field-write', handleFieldWrite);
      window.removeEventListener('ironclaw:generating', handleGenerating);
    };
  }, [onFieldWrite]);

  // Auto-generate problem statement when relevant fields change
  useEffect(() => {
    const generated = generateProblemStatement(formData);
    if (generated && generated !== formData.problemStatement) {
      setFormData((prev) => ({ ...prev, problemStatement: generated }));
    }
    // Only depend on the fields that affect the statement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.currentState, formData.desiredEndState, formData.obstacles.length, formData.constraints.length]);

  // Auto-synthesize current state from knowledge graph when field is empty
  const synthesizeCurrentState = useCallback(async () => {
    setIsSynthesizing(true);
    try {
      const res = await fetch(`/api/design/${problemSetId}/synthesize-current-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json() as { currentState?: string };
      if (data.currentState) {
        setFormData((prev) => ({ ...prev, currentState: data.currentState! }));
      }
    } catch {
      // Non-fatal
    } finally {
      setIsSynthesizing(false);
    }
  }, [problemSetId]);

  // Auto-trigger synthesis on first load if currentState is empty
  useEffect(() => {
    if (!formData.currentState && !synthesizeAttempted.current) {
      synthesizeAttempted.current = true;
      synthesizeCurrentState();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-save
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    setSaveStatus('saving');
    debounceRef.current = setTimeout(() => {
      onUpdate(formData);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [formData, onUpdate]);

  const updateField = useCallback((field: keyof ProblemFramingData, value: unknown) => {
    setFormData((prev) => {
      // Emit field-changed event for Ironclaw observation (only for string fields, only during interview)
      if (typeof value === 'string' && designInterview.isActive) {
        const prevValue = typeof prev[field] === 'string' ? prev[field] as string : '';
        window.dispatchEvent(new CustomEvent('ironclaw:field-changed', {
          detail: { field, value, previousValue: prevValue },
        }));
      }
      return { ...prev, [field]: value };
    });
  }, [designInterview.isActive]);

  // Handle Guide Me button click
  const handleGuideMe = useCallback(async () => {
    const hasData = formData.currentState || formData.desiredEndState || formData.problemStatement;
    const mode = hasData ? 'revision' : 'new';
    await designInterview.startInterview(mode);
    toggleDrawer();
  }, [formData, designInterview, toggleDrawer]);

  // Listen for interview last message and apply if no active input focus
  useEffect(() => {
    if (!designInterview.lastMessage) return;
    // The interview service sends section updates via WebSocket (design.section_updated)
    // This effect watches for updates signaled by lastMessage changing
    // Actual field population is handled server-side via section update events
  }, [designInterview.lastMessage]);

  // Apply pending interview update when user releases focus
  const applyPendingUpdate = useCallback(() => {
    if (pendingInterviewUpdate && !inputFocusedRef.current) {
      setFormData(pendingInterviewUpdate);
      setPendingInterviewUpdate(null);
      setShowPendingNotice(false);
    }
  }, [pendingInterviewUpdate]);

  useEffect(() => {
    if (!inputFocusedRef.current && pendingInterviewUpdate) {
      applyPendingUpdate();
    }
  }, [pendingInterviewUpdate, applyPendingUpdate]);

  // Determine if gate should show for this section
  const showGate = designInterview.awaitingConfirm &&
    designInterview.interviewState?.currentSection === 'problem-framing';

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Interview progress indicator — shown when interview is active */}
        {designInterview.interviewState && (
          <div className="mb-4">
            <DesignInterviewProgress interviewState={designInterview.interviewState} />
          </div>
        )}

        {/* Header with save status and action buttons */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-200">Problem Framing</h2>
            {saveStatus === 'saving' && (
              <span className="text-xs text-amber-400">Saving...</span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-xs text-green-400">Saved</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Participant awareness bar — shown when collaborative interview is active */}
            {designInterview.isActive && isCollaborative && (
              <div className="flex items-center gap-1.5 mr-1" title="Active participants">
                {Array.from(participants.entries()).map(([did, role]) => (
                  <div key={did} className="flex flex-col items-center" title={role}>
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getRoleColor(role) }}
                    />
                    <span className="text-gray-500" style={{ fontSize: '9px', lineHeight: '1.2' }}>{role}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Guide Me button — pulses when it's this user's turn */}
            <button
              onClick={handleGuideMe}
              disabled={designInterview.isLoading}
              className={`text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors${isMyTurn ? ' ring-2 ring-blue-400 animate-pulse' : ''}`}
              title={isMyTurn ? "Ironclaw is directing a question to you" : "Start guided problem framing interview with Ironclaw"}
            >
              {isMyTurn ? 'Your Turn' : 'Guide Me'}
            </button>
          </div>
        </div>

        {/* Pending interview data notice */}
        {showPendingNotice && (
          <div className="mb-4 px-3 py-2 bg-blue-900/30 border border-blue-500/30 rounded text-xs text-blue-300 flex items-center justify-between">
            <span>New data from interview available</span>
            <button
              onClick={applyPendingUpdate}
              className="text-blue-400 hover:text-blue-300 ml-2 underline"
            >
              Apply
            </button>
          </div>
        )}

        {/* Review gate — shown when current section awaits confirmation */}
        {showGate && designInterview.lastMessage && (
          <div className="mb-4">
            <DesignInterviewGate
              section="problem-framing"
              summary={designInterview.lastMessage}
              onConfirm={designInterview.confirmSection}
              onRevise={(feedback) => {
                toggleDrawer();
                designInterview.sendMessage(feedback);
              }}
              isLoading={designInterview.isLoading}
            />
          </div>
        )}

        {/* Current State */}
        <ContentField
          label="Current State"
          value={formData.currentState}
          onChange={(v) => updateField('currentState', v)}
          onFocus={() => { inputFocusedRef.current = true; }}
          onBlur={() => { inputFocusedRef.current = false; applyPendingUpdate(); }}
          placeholder="Describe the current operational environment..."
          isLoading={isSynthesizing || generatingFields.has('currentState')}
        />

        {/* Desired End State */}
        <ContentField
          label="Desired End State"
          value={formData.desiredEndState}
          onChange={(v) => updateField('desiredEndState', v)}
          onFocus={() => { inputFocusedRef.current = true; }}
          onBlur={() => { inputFocusedRef.current = false; applyPendingUpdate(); }}
          placeholder="Describe the desired conditions..."
          isLoading={generatingFields.has('desiredEndState')}
        />

        {/* Problem Statement (auto-generated, read-only) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Problem Statement (Auto-generated)
          </label>
          <textarea
            value={formData.problemStatement}
            readOnly
            rows={2}
            className="w-full bg-gray-600 border border-gray-600 text-gray-300 rounded-md p-2 text-sm cursor-not-allowed resize-none"
          />
        </div>

        {/* Dynamic Lists */}
        <DynamicList
          label="Key Tensions"
          items={formData.keyTensions}
          onUpdate={(items) => updateField('keyTensions', items)}
          placeholder="Describe a key tension or contradiction..."
        />

        <DynamicList
          label="Obstacles"
          items={formData.obstacles}
          onUpdate={(items) => updateField('obstacles', items)}
          placeholder="Describe an obstacle..."
        />

        <DynamicList
          label="Opportunities"
          items={formData.opportunities}
          onUpdate={(items) => updateField('opportunities', items)}
          placeholder="Describe an opportunity..."
        />

        <DynamicList
          label="Assumptions"
          items={formData.assumptions}
          onUpdate={(items) => updateField('assumptions', items)}
          placeholder="State an assumption..."
        />

        <DynamicList
          label="Constraints"
          items={formData.constraints}
          onUpdate={(items) => updateField('constraints', items)}
          placeholder="Describe a constraint or restraint..."
        />
      </div>
    </div>
  );
}
