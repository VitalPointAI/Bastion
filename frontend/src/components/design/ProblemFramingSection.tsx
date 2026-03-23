/**
 * ProblemFramingSection
 *
 * Phase 25 Plan 02: Structured JP 5-0 problem framing form with auto-save,
 * auto-generated problem statement, and AI panel integration.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ProblemFramingData } from '../../lib/design-service.ts';
import { useIronclawContext } from '../../context/IronclawContext.tsx';
import { useDesignInterview } from '../../hooks/useDesignInterview.ts';
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

export function ProblemFramingSection({ problemSetId, initialData, onUpdate }: ProblemFramingSectionProps) {
  const { sendMessage: ironclawSendMessage, toggleDrawer } = useIronclawContext();
  const designInterview = useDesignInterview(problemSetId);
  const [formData, setFormData] = useState<ProblemFramingData>(() => ({
    ...initialData,
    problemStatement: initialData.problemStatement || generateProblemStatement(initialData),
  }));
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Track focus state to avoid overwriting user edits with interview-sourced data
  const inputFocusedRef = useRef(false);
  const [pendingInterviewUpdate, setPendingInterviewUpdate] = useState<ProblemFramingData | null>(null);
  const [showPendingNotice, setShowPendingNotice] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  // Auto-generate problem statement when relevant fields change
  useEffect(() => {
    const generated = generateProblemStatement(formData);
    if (generated && generated !== formData.problemStatement) {
      setFormData((prev) => ({ ...prev, problemStatement: generated }));
    }
    // Only depend on the fields that affect the statement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.currentState, formData.desiredEndState, formData.obstacles.length, formData.constraints.length]);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateField = useCallback((field: keyof ProblemFramingData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

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
            {/* Guide Me button */}
            <button
              onClick={handleGuideMe}
              disabled={designInterview.isLoading}
              className="text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Start guided problem framing interview with Ironclaw"
            >
              Guide Me
            </button>
            <button
              onClick={() => {
                ironclawSendMessage("Analyze: " + JSON.stringify(formData));
                toggleDrawer();
              }}
              className="px-3 py-1.5 text-xs font-medium rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              Ask Ironclaw to Analyze
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
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">Current State</label>
          <textarea
            value={formData.currentState}
            onChange={(e) => updateField('currentState', e.target.value)}
            onFocus={() => { inputFocusedRef.current = true; }}
            onBlur={() => { inputFocusedRef.current = false; applyPendingUpdate(); }}
            placeholder="Describe the current operational environment..."
            rows={3}
            className="w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-y"
          />
        </div>

        {/* Desired End State */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">Desired End State</label>
          <textarea
            value={formData.desiredEndState}
            onChange={(e) => updateField('desiredEndState', e.target.value)}
            onFocus={() => { inputFocusedRef.current = true; }}
            onBlur={() => { inputFocusedRef.current = false; applyPendingUpdate(); }}
            placeholder="Describe the desired conditions..."
            rows={3}
            className="w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-y"
          />
        </div>

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
