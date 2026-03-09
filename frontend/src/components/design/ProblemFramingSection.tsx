/**
 * ProblemFramingSection
 *
 * Phase 25 Plan 02: Structured JP 5-0 problem framing form with auto-save,
 * auto-generated problem statement, and AI panel integration.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ProblemFramingData } from '../../lib/design-service.ts';
import { DesignAIPanel } from './DesignAIPanel.tsx';
import type { AlternativeFraming } from './AIFramingCard.tsx';

interface ProblemFramingSectionProps {
  problemSetId: string;
  initialData: ProblemFramingData;
  onUpdate: (data: ProblemFramingData) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiCache?: Map<string, Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAiCacheUpdate?: (cache: Map<string, Record<string, any>>) => void;
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

// ─── Merge Modal ─────────────────────────────────────────────────────────────

interface MergeField {
  key: string;
  label: string;
  checked: boolean;
}

function MergeModal({
  framing,
  onConfirm,
  onCancel,
}: {
  framing: AlternativeFraming;
  onConfirm: (fields: string[]) => void;
  onCancel: () => void;
}) {
  const availableFields: MergeField[] = [
    { key: 'problemStatement', label: 'Problem Statement', checked: false },
    { key: 'rootCauses', label: 'Root Causes -> Key Tensions', checked: false },
    { key: 'assumptions', label: 'Assumptions', checked: false },
    { key: 'blindSpots', label: 'Blind Spots -> Obstacles', checked: false },
    { key: 'interventionPoints', label: 'Intervention Points -> Opportunities', checked: false },
  ];

  const [fields, setFields] = useState(availableFields);

  const toggle = (index: number) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, checked: !f.checked } : f)));
  };

  // Suppress unused variable warning - framing is used implicitly for context
  void framing;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 w-80">
        <h4 className="text-sm font-semibold text-gray-200 mb-3">Select Fields to Merge</h4>
        <div className="space-y-2 mb-4">
          {fields.map((field, i) => (
            <label key={field.key} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={field.checked}
                onChange={() => toggle(i)}
                className="rounded border-gray-600 bg-gray-700 text-blue-500"
              />
              {field.label}
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(fields.filter((f) => f.checked).map((f) => f.key))}
            className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            Merge Selected
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ProblemFramingSection({ problemSetId, initialData, onUpdate, aiCache, onAiCacheUpdate }: ProblemFramingSectionProps) {
  const [formData, setFormData] = useState<ProblemFramingData>(() => ({
    ...initialData,
    problemStatement: initialData.problemStatement || generateProblemStatement(initialData),
  }));
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [mergeFraming, setMergeFraming] = useState<AlternativeFraming | null>(null);

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

  // ─── AI Adopt/Merge Handlers ────────────────────────────────────────

  const handleAdopt = useCallback((framing: AlternativeFraming) => {
    setFormData((prev) => ({
      currentState: prev.currentState,
      desiredEndState: prev.desiredEndState,
      problemStatement: framing.framingStatement,
      keyTensions: framing.rootCauses.length > 0 ? [...framing.rootCauses] : prev.keyTensions,
      obstacles: framing.blindSpots.length > 0 ? [...framing.blindSpots] : prev.obstacles,
      opportunities: framing.interventionPoints.length > 0 ? [...framing.interventionPoints] : prev.opportunities,
      assumptions: framing.assumptions.length > 0 ? [...framing.assumptions] : prev.assumptions,
      constraints: prev.constraints,
    }));
  }, []);

  const handleMerge = useCallback((framing: AlternativeFraming) => {
    setMergeFraming(framing);
  }, []);

  const handleMergeConfirm = useCallback(
    (selectedFields: string[]) => {
      if (!mergeFraming) return;

      setFormData((prev) => {
        const next = { ...prev };
        for (const field of selectedFields) {
          switch (field) {
            case 'problemStatement':
              next.problemStatement = mergeFraming.framingStatement;
              break;
            case 'rootCauses':
              next.keyTensions = [...new Set([...prev.keyTensions.filter(Boolean), ...mergeFraming.rootCauses])];
              break;
            case 'assumptions':
              next.assumptions = [...new Set([...prev.assumptions.filter(Boolean), ...mergeFraming.assumptions])];
              break;
            case 'blindSpots':
              next.obstacles = [...new Set([...prev.obstacles.filter(Boolean), ...mergeFraming.blindSpots])];
              break;
            case 'interventionPoints':
              next.opportunities = [...new Set([...prev.opportunities.filter(Boolean), ...mergeFraming.interventionPoints])];
              break;
          }
        }
        return next;
      });
      setMergeFraming(null);
    },
    [mergeFraming]
  );

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Left Side: Form */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Header with save status and AI toggle */}
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
          <button
            onClick={() => setAiPanelOpen(!aiPanelOpen)}
            className="px-3 py-1.5 text-xs font-medium rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors flex items-center gap-1"
          >
            <span>AI Assistant</span>
            <span className={`transition-transform ${aiPanelOpen ? 'rotate-180' : ''}`}>&#9656;</span>
          </button>
        </div>

        {/* Current State */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">Current State</label>
          <textarea
            value={formData.currentState}
            onChange={(e) => updateField('currentState', e.target.value)}
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

      {/* Right Side: AI Panel */}
      <DesignAIPanel
        problemSetId={problemSetId}
        activeSection="problem-framing"
        sectionData={formData}
        isOpen={aiPanelOpen}
        onToggle={() => setAiPanelOpen(!aiPanelOpen)}
        onAdopt={handleAdopt}
        onMerge={handleMerge}
        externalCache={aiCache}
        onCacheUpdate={onAiCacheUpdate}
      />

      {/* Merge Modal */}
      {mergeFraming && (
        <MergeModal
          framing={mergeFraming}
          onConfirm={handleMergeConfirm}
          onCancel={() => setMergeFraming(null)}
        />
      )}
    </div>
  );
}
