/**
 * OperationalApproachSection
 *
 * Phase 25 Plan 05: Synthesis section that brings together problem framing,
 * CoG analysis, and LOEs into a coherent operational approach narrative.
 *
 * Phase 49 Plan 02: Removed manual "Push to Plan Tab" button — Design artifacts
 * now flow automatically to Plan tab JPP steps via fetch-on-render.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { designService } from '../../lib/design-service.ts';
import type {
  OperationalApproach,
  OperationalDesign,
  CoGNode,
} from '../../lib/design-service.ts';
import { DesignAIPanel } from './DesignAIPanel.tsx';

interface OperationalApproachSectionProps {
  problemSetId: string;
  initialData: OperationalApproach;
  designData: OperationalDesign;
  onUpdate: (data: OperationalApproach) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiCache?: Map<string, Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAiCacheUpdate?: (cache: Map<string, Record<string, any>>) => void;
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function countCoGNodes(node: CoGNode | null): number {
  if (!node) return 0;
  return 1 + (node.children ?? []).reduce((sum, c) => sum + countCoGNodes(c), 0);
}

function countCVLinks(loes: OperationalDesign['linesOfEffort']): number {
  let count = 0;
  for (const loe of loes) {
    for (const dp of loe.decisivePoints ?? []) {
      count += (dp.cogLinks ?? []).length;
    }
  }
  return count;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OperationalApproachSection({
  problemSetId,
  initialData,
  designData,
  onUpdate,
  aiCache,
  onAiCacheUpdate,
}: OperationalApproachSectionProps) {
  const [approach, setApproach] = useState<OperationalApproach>(() => ({
    phases: initialData.phases ?? [],
    transitions: initialData.transitions ?? [],
    decisionPoints: initialData.decisionPoints ?? [],
    narrative: initialData.narrative ?? '',
  }));
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save with 2-second debounce
  const triggerSave = useCallback(
    (data: OperationalApproach) => {
      setSaveStatus('saving');
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdate(data);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 1500);
      }, 2000);
    },
    [onUpdate]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const updateApproach = useCallback(
    (updater: (prev: OperationalApproach) => OperationalApproach) => {
      setApproach((prev) => {
        const next = updater(prev);
        triggerSave(next);
        return next;
      });
    },
    [triggerSave]
  );

  // ─── Transition handlers ─────────────────────────────────────────────────

  const addTransition = () => {
    updateApproach((prev) => ({
      ...prev,
      transitions: [
        ...prev.transitions,
        { fromPhaseId: '', toPhaseId: '', conditions: [''] },
      ],
    }));
  };

  const updateTransition = (index: number, field: string, value: string) => {
    updateApproach((prev) => ({
      ...prev,
      transitions: prev.transitions.map((t, i) =>
        i === index ? { ...t, [field]: value } : t
      ),
    }));
  };

  const updateTransitionCondition = (tIdx: number, cIdx: number, value: string) => {
    updateApproach((prev) => ({
      ...prev,
      transitions: prev.transitions.map((t, i) =>
        i === tIdx
          ? { ...t, conditions: t.conditions.map((c, j) => (j === cIdx ? value : c)) }
          : t
      ),
    }));
  };

  const addTransitionCondition = (tIdx: number) => {
    updateApproach((prev) => ({
      ...prev,
      transitions: prev.transitions.map((t, i) =>
        i === tIdx ? { ...t, conditions: [...t.conditions, ''] } : t
      ),
    }));
  };

  const removeTransitionCondition = (tIdx: number, cIdx: number) => {
    updateApproach((prev) => ({
      ...prev,
      transitions: prev.transitions.map((t, i) =>
        i === tIdx
          ? { ...t, conditions: t.conditions.filter((_, j) => j !== cIdx) }
          : t
      ),
    }));
  };

  const removeTransition = (index: number) => {
    updateApproach((prev) => ({
      ...prev,
      transitions: prev.transitions.filter((_, i) => i !== index),
    }));
  };

  // ─── Decision Point handlers ──────────────────────────────────────────────

  const addDecisionPoint = () => {
    updateApproach((prev) => ({
      ...prev,
      decisionPoints: [
        ...prev.decisionPoints,
        { id: generateId(), label: '', phaseId: '', criteria: [''] },
      ],
    }));
  };

  const updateDecisionPoint = (index: number, field: string, value: string) => {
    updateApproach((prev) => ({
      ...prev,
      decisionPoints: prev.decisionPoints.map((dp, i) =>
        i === index ? { ...dp, [field]: value } : dp
      ),
    }));
  };

  const updateDecisionPointCriterion = (dpIdx: number, cIdx: number, value: string) => {
    updateApproach((prev) => ({
      ...prev,
      decisionPoints: prev.decisionPoints.map((dp, i) =>
        i === dpIdx
          ? { ...dp, criteria: dp.criteria.map((c, j) => (j === cIdx ? value : c)) }
          : dp
      ),
    }));
  };

  const addDecisionPointCriterion = (dpIdx: number) => {
    updateApproach((prev) => ({
      ...prev,
      decisionPoints: prev.decisionPoints.map((dp, i) =>
        i === dpIdx ? { ...dp, criteria: [...dp.criteria, ''] } : dp
      ),
    }));
  };

  const removeDecisionPointCriterion = (dpIdx: number, cIdx: number) => {
    updateApproach((prev) => ({
      ...prev,
      decisionPoints: prev.decisionPoints.map((dp, i) =>
        i === dpIdx
          ? { ...dp, criteria: dp.criteria.filter((_, j) => j !== cIdx) }
          : dp
      ),
    }));
  };

  const removeDecisionPoint = (index: number) => {
    updateApproach((prev) => ({
      ...prev,
      decisionPoints: prev.decisionPoints.filter((_, i) => i !== index),
    }));
  };

  // ─── Narrative handler ────────────────────────────────────────────────────

  const updateNarrative = (value: string) => {
    updateApproach((prev) => ({ ...prev, narrative: value }));
  };

  const handleApplyNarrative = useCallback((narrative: string) => {
    updateApproach((prev) => ({ ...prev, narrative }));
  }, [updateApproach]);

  // ─── Available phases (from LOEs or operationalApproach) ──────────────────

  const availablePhases = approach.phases.length > 0
    ? approach.phases
    : (designData.linesOfEffort ?? []).length > 0
      ? (() => {
          // Extract unique phases from decisive points
          const phaseSet = new Set<string>();
          for (const loe of designData.linesOfEffort) {
            for (const dp of loe.decisivePoints ?? []) {
              if (dp.phase) phaseSet.add(dp.phase);
            }
          }
          return Array.from(phaseSet).map((name, i) => ({
            id: `phase-${i}`,
            name,
            description: '',
            order: i,
          }));
        })()
      : [];

  // ─── Synthesis data for summary cards ─────────────────────────────────────

  const problemStatement = designData.problemFraming?.problemStatement ?? '';
  const friendlyCoGLabel = designData.cogAnalysis?.friendly?.root?.label ?? '';
  const adversaryCoGLabel = designData.cogAnalysis?.adversary?.root?.label ?? '';
  const loeCount = (designData.linesOfEffort ?? []).length;
  const totalDPs = (designData.linesOfEffort ?? []).reduce(
    (sum, loe) => sum + (loe.decisivePoints?.length ?? 0),
    0
  );
  const cvLinkCount = countCVLinks(designData.linesOfEffort ?? []);

  return (
    <div className="flex gap-0 flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 min-w-0 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-100">Operational Approach</h2>
          <p className="text-sm text-gray-400 mt-1">
            Synthesize problem framing, CoG analysis, and lines of effort into a coherent operational approach.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus !== 'idle' && (
            <span className="text-xs text-gray-500">
              {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
            </span>
          )}
        </div>
      </div>

      {/* ─── Summary Cards Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Problem Statement Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Problem Statement</h3>
          {problemStatement ? (
            <p className="text-sm text-gray-400 line-clamp-3">{problemStatement}</p>
          ) : (
            <p className="text-sm text-gray-500 italic">No problem statement defined</p>
          )}
        </div>

        {/* CoG Summary Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">CoG Summary</h3>
          {friendlyCoGLabel || adversaryCoGLabel ? (
            <div className="space-y-1 text-sm text-gray-400">
              {friendlyCoGLabel && <p>Friendly CoG: {friendlyCoGLabel}</p>}
              {adversaryCoGLabel && <p>Adversary CoG: {adversaryCoGLabel}</p>}
              <p className="text-xs text-gray-500 mt-1">
                {countCoGNodes(designData.cogAnalysis?.friendly?.root) +
                  countCoGNodes(designData.cogAnalysis?.adversary?.root)}{' '}
                total nodes
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No CoG analysis yet</p>
          )}
        </div>

        {/* LOE Summary Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Lines of Effort</h3>
          {loeCount > 0 ? (
            <div className="space-y-1 text-sm text-gray-400">
              <p>
                {loeCount} LOE{loeCount !== 1 ? 's' : ''}, {totalDPs} decisive point
                {totalDPs !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-gray-500">{cvLinkCount} CoG link{cvLinkCount !== 1 ? 's' : ''}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No lines of effort yet</p>
          )}
        </div>
      </div>

      {/* ─── Phase Transitions ─────────────────────────────────────────────── */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-gray-200">Phase Transitions</h3>
          <button
            onClick={addTransition}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            + Add Transition
          </button>
        </div>

        {approach.transitions.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            No transitions defined. Add transitions to describe how the operation moves between phases.
          </p>
        ) : (
          <div className="space-y-4">
            {approach.transitions.map((transition, tIdx) => (
              <div key={tIdx} className="bg-gray-900/50 rounded p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <select
                    value={transition.fromPhaseId}
                    onChange={(e) => updateTransition(tIdx, 'fromPhaseId', e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 flex-1"
                  >
                    <option value="">From Phase...</option>
                    {availablePhases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-gray-500 text-sm">&rarr;</span>
                  <select
                    value={transition.toPhaseId}
                    onChange={(e) => updateTransition(tIdx, 'toPhaseId', e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 flex-1"
                  >
                    <option value="">To Phase...</option>
                    {availablePhases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeTransition(tIdx)}
                    className="text-red-400 hover:text-red-300 text-sm"
                    title="Remove transition"
                  >
                    Remove
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Transition Conditions</label>
                  {transition.conditions.map((cond, cIdx) => (
                    <div key={cIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={cond}
                        onChange={(e) =>
                          updateTransitionCondition(tIdx, cIdx, e.target.value)
                        }
                        placeholder="Condition for transition..."
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 flex-1"
                      />
                      <button
                        onClick={() => removeTransitionCondition(tIdx, cIdx)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        X
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addTransitionCondition(tIdx)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    + Add Condition
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Decision Points ───────────────────────────────────────────────── */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-gray-200">Decision Points</h3>
          <button
            onClick={addDecisionPoint}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            + Add Decision Point
          </button>
        </div>

        {approach.decisionPoints.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            No decision points defined. Add key decisions that must be made during execution.
          </p>
        ) : (
          <div className="space-y-4">
            {approach.decisionPoints.map((dp, dpIdx) => (
              <div key={dp.id} className="bg-gray-900/50 rounded p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={dp.label}
                    onChange={(e) => updateDecisionPoint(dpIdx, 'label', e.target.value)}
                    placeholder="Decision point label..."
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 flex-1"
                  />
                  <select
                    value={dp.phaseId}
                    onChange={(e) => updateDecisionPoint(dpIdx, 'phaseId', e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200"
                  >
                    <option value="">Phase...</option>
                    {availablePhases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeDecisionPoint(dpIdx)}
                    className="text-red-400 hover:text-red-300 text-sm"
                    title="Remove decision point"
                  >
                    Remove
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Decision Criteria</label>
                  {dp.criteria.map((criterion, cIdx) => (
                    <div key={cIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={criterion}
                        onChange={(e) =>
                          updateDecisionPointCriterion(dpIdx, cIdx, e.target.value)
                        }
                        placeholder="Criterion..."
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 flex-1"
                      />
                      <button
                        onClick={() => removeDecisionPointCriterion(dpIdx, cIdx)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        X
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addDecisionPointCriterion(dpIdx)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    + Add Criterion
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Operational Narrative ──────────────────────────────────────────── */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
        <h3 className="text-base font-medium text-gray-200 mb-3">Operational Narrative</h3>
        <textarea
          value={approach.narrative}
          onChange={(e) => updateNarrative(e.target.value)}
          placeholder="Describe the overall operational approach -- how the lines of effort combine to achieve the desired end state through the identified phases..."
          rows={8}
          className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-3 text-sm text-gray-200 placeholder-gray-500 resize-y"
        />
      </div>

      </div>

      {/* AI Panel */}
      <DesignAIPanel
        problemSetId={problemSetId}
        activeSection="operational-approach"
        sectionData={{ ...approach, designData }}
        isOpen={aiPanelOpen}
        onToggle={() => setAiPanelOpen(!aiPanelOpen)}
        onApplyNarrative={handleApplyNarrative}
        externalCache={aiCache}
        onCacheUpdate={onAiCacheUpdate}
      />
    </div>
  );
}
