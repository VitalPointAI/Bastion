/**
 * RevisionProposalModal
 *
 * Phase 49 Plan 04: Modal for proposing revisions to Design Tab artifacts from
 * within the Plan Tab. Staff can edit the proposed data, provide a rationale,
 * then submit — which creates a revision record and a DAO governance gate.
 *
 * Modal pattern follows GateProposalModal.tsx (fixed overlay, centered card,
 * header/body/footer sections).
 */

import { useState, useCallback } from 'react';
import type {
  ProblemFramingData,
  CoGAnalysis,
  LineOfEffort,
  OperationalApproach,
} from '../../lib/design-service.ts';
import {
  designRevisionService,
  type RevisionArtifactType,
} from '../../lib/design-revision-service.ts';
import { useDecisionGates } from '../../context/DecisionGateContext.tsx';
import { RevisionDiffView } from './RevisionDiffView.tsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const ARTIFACT_LABELS: Record<RevisionArtifactType, string> = {
  'problem-framing': 'Problem Framing',
  'cog-analysis': 'Center of Gravity Analysis',
  'lines-of-effort': 'Lines of Effort',
  'operational-approach': 'Operational Approach (Phases)',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RevisionProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  artifactType: RevisionArtifactType;
  originalData: unknown;
  problemSetId: string;
  onSubmitted?: () => void;
}

// ─── Artifact-specific editors ────────────────────────────────────────────────

function ProblemFramingEditor({
  value,
  onChange,
}: {
  value: ProblemFramingData;
  onChange: (updated: ProblemFramingData) => void;
}) {
  return (
    <div className="rpm-editor">
      <div className="rpm-editor-field">
        <label htmlFor="rpm-problem-statement">Problem Statement</label>
        <textarea
          id="rpm-problem-statement"
          rows={4}
          value={value.problemStatement || ''}
          onChange={(e) => onChange({ ...value, problemStatement: e.target.value })}
          placeholder="Describe the updated problem statement..."
        />
      </div>
      <div className="rpm-editor-field">
        <label htmlFor="rpm-current-state">Current State</label>
        <textarea
          id="rpm-current-state"
          rows={3}
          value={value.currentState || ''}
          onChange={(e) => onChange({ ...value, currentState: e.target.value })}
          placeholder="Describe the current state..."
        />
      </div>
      <div className="rpm-editor-field">
        <label htmlFor="rpm-end-state">Desired End State</label>
        <textarea
          id="rpm-end-state"
          rows={3}
          value={value.desiredEndState || ''}
          onChange={(e) => onChange({ ...value, desiredEndState: e.target.value })}
          placeholder="Describe the desired end state..."
        />
      </div>
    </div>
  );
}

function CoGAnalysisEditor({
  value,
  onChange,
}: {
  value: CoGAnalysis;
  onChange: (updated: CoGAnalysis) => void;
}) {
  function getLabel(tree: CoGAnalysis['friendly']): string {
    return tree?.root?.label || '';
  }

  function setCoGLabel(side: 'friendly' | 'adversary', label: string) {
    const updated = structuredClone(value) as CoGAnalysis;
    if (!updated[side]) updated[side] = { root: null };
    if (!updated[side].root) {
      updated[side].root = {
        id: crypto.randomUUID(),
        type: 'cog',
        label,
        description: '',
        children: [],
      };
    } else {
      updated[side].root!.label = label;
    }
    onChange(updated);
  }

  return (
    <div className="rpm-editor">
      <p className="rpm-editor-hint">
        Edit Center of Gravity labels. Full tree editing is available in the Design Tab.
      </p>
      <div className="rpm-cog-editor-grid">
        <div className="rpm-editor-field">
          <label htmlFor="rpm-friendly-cog">Friendly Center of Gravity</label>
          <input
            id="rpm-friendly-cog"
            type="text"
            value={getLabel(value?.friendly)}
            onChange={(e) => setCoGLabel('friendly', e.target.value)}
            placeholder="Friendly CoG label..."
          />
        </div>
        <div className="rpm-editor-field">
          <label htmlFor="rpm-adversary-cog">Adversary Center of Gravity</label>
          <input
            id="rpm-adversary-cog"
            type="text"
            value={getLabel(value?.adversary)}
            onChange={(e) => setCoGLabel('adversary', e.target.value)}
            placeholder="Adversary CoG label..."
          />
        </div>
      </div>
    </div>
  );
}

function LinesOfEffortEditor({
  value,
  onChange,
}: {
  value: LineOfEffort[];
  onChange: (updated: LineOfEffort[]) => void;
}) {
  const addLoe = () => {
    const newLoe: LineOfEffort = {
      id: crypto.randomUUID(),
      name: '',
      description: '',
      decisivePoints: [],
      order: value.length,
    };
    onChange([...value, newLoe]);
  };

  const removeLoe = (id: string) => {
    onChange(value.filter((l) => l.id !== id));
  };

  const updateLoe = (id: string, field: keyof LineOfEffort, val: string) => {
    onChange(value.map((l) => (l.id === id ? { ...l, [field]: val } : l)));
  };

  return (
    <div className="rpm-editor">
      {value.map((loe, i) => (
        <div key={loe.id} className="rpm-loe-entry">
          <div className="rpm-loe-entry-header">
            <span className="rpm-loe-num">{i + 1}</span>
            <button
              className="rpm-loe-remove"
              type="button"
              onClick={() => removeLoe(loe.id)}
              aria-label="Remove line of effort"
            >
              Remove
            </button>
          </div>
          <div className="rpm-editor-field">
            <label htmlFor={`rpm-loe-name-${loe.id}`}>Name</label>
            <input
              id={`rpm-loe-name-${loe.id}`}
              type="text"
              value={loe.name}
              onChange={(e) => updateLoe(loe.id, 'name', e.target.value)}
              placeholder="Line of effort name..."
            />
          </div>
          <div className="rpm-editor-field">
            <label htmlFor={`rpm-loe-desc-${loe.id}`}>Description</label>
            <input
              id={`rpm-loe-desc-${loe.id}`}
              type="text"
              value={loe.description}
              onChange={(e) => updateLoe(loe.id, 'description', e.target.value)}
              placeholder="Brief description..."
            />
          </div>
        </div>
      ))}
      <button className="rpm-add-btn" type="button" onClick={addLoe}>
        + Add Line of Effort
      </button>
    </div>
  );
}

function PhasesEditor({
  value,
  onChange,
}: {
  value: OperationalApproach;
  onChange: (updated: OperationalApproach) => void;
}) {
  const phases = value?.phases ?? [];

  const addPhase = () => {
    const newPhase = {
      id: crypto.randomUUID(),
      name: '',
      description: '',
      order: phases.length,
    };
    onChange({ ...value, phases: [...phases, newPhase] });
  };

  const removePhase = (id: string) => {
    onChange({
      ...value,
      phases: phases
        .filter((p) => p.id !== id)
        .map((p, i) => ({ ...p, order: i })),
    });
  };

  const updatePhase = (id: string, field: string, val: string) => {
    onChange({
      ...value,
      phases: phases.map((p) => (p.id === id ? { ...p, [field]: val } : p)),
    });
  };

  const sorted = [...phases].sort((a, b) => a.order - b.order);

  return (
    <div className="rpm-editor">
      {sorted.map((phase, i) => (
        <div key={phase.id} className="rpm-phase-entry">
          <div className="rpm-loe-entry-header">
            <span className="rpm-loe-num">Phase {i + 1}</span>
            <button
              className="rpm-loe-remove"
              type="button"
              onClick={() => removePhase(phase.id)}
              aria-label="Remove phase"
            >
              Remove
            </button>
          </div>
          <div className="rpm-editor-field">
            <label htmlFor={`rpm-phase-name-${phase.id}`}>Name</label>
            <input
              id={`rpm-phase-name-${phase.id}`}
              type="text"
              value={phase.name}
              onChange={(e) => updatePhase(phase.id, 'name', e.target.value)}
              placeholder="Phase name..."
            />
          </div>
          <div className="rpm-editor-field">
            <label htmlFor={`rpm-phase-desc-${phase.id}`}>Description</label>
            <input
              id={`rpm-phase-desc-${phase.id}`}
              type="text"
              value={phase.description}
              onChange={(e) => updatePhase(phase.id, 'description', e.target.value)}
              placeholder="Phase description..."
            />
          </div>
        </div>
      ))}
      <button className="rpm-add-btn" type="button" onClick={addPhase}>
        + Add Phase
      </button>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function RevisionProposalModal({
  isOpen,
  onClose,
  artifactType,
  originalData,
  problemSetId,
  onSubmitted,
}: RevisionProposalModalProps) {
  const { createGate } = useDecisionGates('plan');

  const [proposedData, setProposedData] = useState<unknown>(() =>
    // Deep clone so edits don't mutate original
    originalData !== null && originalData !== undefined
      ? structuredClone(originalData)
      : originalData
  );
  const [rationale, setRationale] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const artifactLabel = ARTIFACT_LABELS[artifactType] || artifactType;

  const handleSubmit = useCallback(async () => {
    if (!rationale.trim()) {
      setError('Rationale is required — explain what planning revealed that requires this change.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create revision record in backend
      const revision = await designRevisionService.create(problemSetId, {
        artifactType,
        proposedData,
        originalData,
        rationale: rationale.trim(),
      });

      // 2. Create DAO governance gate linked to this revision
      await createGate({
        problem_set_id: problemSetId,
        gate_type: 'design_revision',
        tab: 'plan',
        target_item_id: revision.id,
        target_item_type: artifactType,
        target_item_title: `Revision: ${artifactLabel}`,
        mode: 'operational',
      });

      onSubmitted?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [
    rationale,
    problemSetId,
    artifactType,
    proposedData,
    originalData,
    artifactLabel,
    createGate,
    onSubmitted,
    onClose,
  ]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !submitting) {
        onClose();
      }
    },
    [onClose, submitting]
  );

  if (!isOpen) return null;

  return (
    <div className="rpm-overlay" onClick={handleOverlayClick}>
      <div className="rpm-modal">
        {/* Header */}
        <div className="rpm-header">
          <div>
            <h2 className="rpm-title">Propose Revision</h2>
            <span className="rpm-artifact-label">{artifactLabel}</span>
          </div>
          <button
            className="rpm-close"
            onClick={onClose}
            aria-label="Close"
            disabled={submitting}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="rpm-body">
          {error && <div className="rpm-error">{error}</div>}

          {/* Diff preview (updates in real-time as user edits) */}
          <section className="rpm-section">
            <h3 className="rpm-section-title">Changes Preview</h3>
            <RevisionDiffView
              artifactType={artifactType}
              originalData={originalData}
              proposedData={proposedData}
            />
          </section>

          {/* Editable proposed data */}
          <section className="rpm-section">
            <h3 className="rpm-section-title">Edit Proposed Changes</h3>
            {artifactType === 'problem-framing' && (
              <ProblemFramingEditor
                value={(proposedData as ProblemFramingData) ?? ({} as ProblemFramingData)}
                onChange={setProposedData}
              />
            )}
            {artifactType === 'cog-analysis' && (
              <CoGAnalysisEditor
                value={
                  (proposedData as CoGAnalysis) ?? {
                    friendly: { root: null },
                    adversary: { root: null },
                  }
                }
                onChange={setProposedData}
              />
            )}
            {artifactType === 'lines-of-effort' && (
              <LinesOfEffortEditor
                value={(proposedData as LineOfEffort[]) ?? []}
                onChange={setProposedData}
              />
            )}
            {artifactType === 'operational-approach' && (
              <PhasesEditor
                value={
                  (proposedData as OperationalApproach) ?? {
                    phases: [],
                    transitions: [],
                    decisionPoints: [],
                    narrative: '',
                  }
                }
                onChange={setProposedData}
              />
            )}
          </section>

          {/* Rationale — required */}
          <section className="rpm-section">
            <h3 className="rpm-section-title">Rationale</h3>
            <div className="rpm-editor-field">
              <label htmlFor="rpm-rationale">
                Why is this revision needed? What did planning reveal?{' '}
                <span className="rpm-required">*</span>
              </label>
              <textarea
                id="rpm-rationale"
                rows={4}
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                disabled={submitting}
                placeholder="Describe what planning analysis revealed that requires updating the Design artifact..."
              />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="rpm-footer">
          <button
            className="rpm-cancel"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="rpm-submit"
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !rationale.trim()}
          >
            {submitting ? 'Submitting...' : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
