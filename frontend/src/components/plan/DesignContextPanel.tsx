/**
 * DesignContextPanel
 *
 * Phase 49 Plan 02: Reusable read-only panel for displaying Design tab artifacts
 * inside JPP steps. Provides visual distinction (blue tint) to make clear that
 * content is sourced from the Design tab, not editable within the Plan tab.
 *
 * Phase 49 Plan 04: Wired "Propose Revision" button to open RevisionProposalModal.
 */

import { useState } from 'react';
import './DesignContextPanel.css';
import type {
  SectionStatus,
  ProblemFramingData,
  CoGAnalysis,
  LineOfEffort,
  OperationalApproach,
} from '../../lib/design-service.ts';
import type { RevisionArtifactType } from '../../lib/design-revision-service.ts';
import { RevisionProposalModal } from './RevisionProposalModal.tsx';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DesignArtifact = 'problem-statement' | 'cog-analysis' | 'lines-of-effort' | 'phases';

export interface DesignContextPanelProps {
  title: string;
  artifact: DesignArtifact;
  data: ProblemFramingData | CoGAnalysis | LineOfEffort[] | OperationalApproach | undefined | null;
  sectionStatus: SectionStatus;
  problemSetId: string;
  loading?: boolean;
  onRevisionProposed?: () => void;
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SectionStatus }) {
  const map: Record<SectionStatus, { label: string; className: string }> = {
    'not-started': { label: 'Not Started', className: 'design-ctx-badge design-ctx-badge--not-started' },
    'in-progress': { label: 'In Progress', className: 'design-ctx-badge design-ctx-badge--in-progress' },
    complete: { label: 'Complete', className: 'design-ctx-badge design-ctx-badge--complete' },
  };
  const { label, className } = map[status] ?? map['not-started'];
  return <span className={className}>{label}</span>;
}

// ─── Skeleton loading ─────────────────────────────────────────────────────────

function SkeletonLines({ count = 3 }: { count?: number }) {
  return (
    <div className="design-ctx-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="design-ctx-skeleton-line"
          style={{ width: i === count - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

// ─── Artifact renderers ───────────────────────────────────────────────────────

function ProblemStatementRenderer({ data }: { data: ProblemFramingData }) {
  const statement = data.problemStatement || data.currentState || '';
  if (!statement) {
    return (
      <p className="design-ctx-empty-data">
        No problem statement written yet in the Design tab.
      </p>
    );
  }
  return <p className="design-ctx-text">{statement}</p>;
}

function CoGAnalysisRenderer({ data }: { data: CoGAnalysis }) {
  function renderTree(tree: CoGAnalysis['friendly'] | CoGAnalysis['adversary'], label: string) {
    const root = tree?.root;
    if (!root) {
      return (
        <div className="design-ctx-cog-side">
          <h4 className="design-ctx-cog-label">{label}</h4>
          <p className="design-ctx-empty-data">Not defined</p>
        </div>
      );
    }

    const byType = (type: string) =>
      (root.children ?? []).filter((c) => c.type === type);

    return (
      <div className="design-ctx-cog-side">
        <h4 className="design-ctx-cog-label">{label}</h4>
        <div className="design-ctx-cog-row">
          <span className="design-ctx-cog-type">CoG</span>
          <span className="design-ctx-cog-value">{root.label}</span>
        </div>
        {byType('critical-capability').length > 0 && (
          <div className="design-ctx-cog-row">
            <span className="design-ctx-cog-type">CC</span>
            <span className="design-ctx-cog-value">
              {byType('critical-capability').map((n) => n.label).join(', ')}
            </span>
          </div>
        )}
        {byType('critical-requirement').length > 0 && (
          <div className="design-ctx-cog-row">
            <span className="design-ctx-cog-type">CR</span>
            <span className="design-ctx-cog-value">
              {byType('critical-requirement').map((n) => n.label).join(', ')}
            </span>
          </div>
        )}
        {byType('critical-vulnerability').length > 0 && (
          <div className="design-ctx-cog-row">
            <span className="design-ctx-cog-type">CV</span>
            <span className="design-ctx-cog-value">
              {byType('critical-vulnerability').map((n) => n.label).join(', ')}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="design-ctx-cog-grid">
      {renderTree(data.friendly, 'Friendly')}
      {renderTree(data.adversary, 'Adversary')}
    </div>
  );
}

function LinesOfEffortRenderer({ data }: { data: LineOfEffort[] }) {
  if (!data || data.length === 0) {
    return (
      <p className="design-ctx-empty-data">No lines of effort defined yet.</p>
    );
  }

  return (
    <ol className="design-ctx-loe-list">
      {data.map((loe, i) => (
        <li key={loe.id} className="design-ctx-loe-item">
          <span className="design-ctx-loe-number">{i + 1}</span>
          <div className="design-ctx-loe-content">
            <span className="design-ctx-loe-name">{loe.name}</span>
            {loe.description && (
              <span className="design-ctx-loe-objective">{loe.description}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function PhasesRenderer({ data }: { data: OperationalApproach }) {
  const phases = data.phases ?? [];

  if (phases.length === 0) {
    return (
      <p className="design-ctx-empty-data">No phases defined yet.</p>
    );
  }

  const sorted = [...phases].sort((a, b) => a.order - b.order);

  return (
    <ol className="design-ctx-phases-list">
      {sorted.map((phase, i) => {
        const transition = (data.transitions ?? []).find(
          (t) => t.fromPhaseId === phase.id,
        );
        return (
          <li key={phase.id} className="design-ctx-phase-item">
            <span className="design-ctx-phase-number">{i + 1}</span>
            <div className="design-ctx-phase-content">
              <span className="design-ctx-phase-name">{phase.name}</span>
              {phase.description && (
                <span className="design-ctx-phase-desc">{phase.description}</span>
              )}
              {transition && transition.conditions.length > 0 && (
                <span className="design-ctx-phase-transition">
                  Transition: {transition.conditions.join('; ')}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Artifact type mapping ────────────────────────────────────────────────────

const ARTIFACT_TYPE_MAP: Record<DesignArtifact, RevisionArtifactType> = {
  'problem-statement': 'problem-framing',
  'cog-analysis': 'cog-analysis',
  'lines-of-effort': 'lines-of-effort',
  'phases': 'operational-approach',
};

// ─── Main component ───────────────────────────────────────────────────────────

export function DesignContextPanel({
  title,
  artifact,
  data,
  sectionStatus,
  problemSetId,
  loading = false,
  onRevisionProposed,
}: DesignContextPanelProps) {
  const isEmpty = sectionStatus === 'not-started';
  const [showRevisionModal, setShowRevisionModal] = useState(false);

  const revisionArtifactType = ARTIFACT_TYPE_MAP[artifact];

  return (
    <div className="design-ctx-panel">
      {/* Header */}
      <div className="design-ctx-header">
        <div className="design-ctx-header-left">
          <span className="design-ctx-lock-icon" aria-hidden="true">&#128274;</span>
          <span className="design-ctx-title">{title}</span>
        </div>
        <div className="design-ctx-header-right">
          <span className="design-ctx-source-label">Sourced from Design Tab</span>
          <StatusBadge status={sectionStatus} />
        </div>
      </div>

      {/* Body */}
      <div className="design-ctx-body">
        {loading ? (
          <SkeletonLines />
        ) : isEmpty ? (
          <p className="design-ctx-not-started">
            This section has not been started in the Design tab yet.
            Complete it in the Design tab to see it here.
          </p>
        ) : (
          <>
            {sectionStatus === 'in-progress' && (
              <div className="design-ctx-in-progress-notice">
                Design section still in progress — content may change.
              </div>
            )}
            {artifact === 'problem-statement' && data && (
              <ProblemStatementRenderer data={data as ProblemFramingData} />
            )}
            {artifact === 'cog-analysis' && data && (
              <CoGAnalysisRenderer data={data as CoGAnalysis} />
            )}
            {artifact === 'lines-of-effort' && (
              <LinesOfEffortRenderer data={(data as LineOfEffort[]) ?? []} />
            )}
            {artifact === 'phases' && data && (
              <PhasesRenderer data={data as OperationalApproach} />
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="design-ctx-footer">
        <button
          className="design-ctx-propose-btn"
          disabled={sectionStatus !== 'complete'}
          title={
            sectionStatus !== 'complete'
              ? 'Section must be complete in the Design Tab before proposing a revision'
              : 'Propose a revision to this Design artifact'
          }
          onClick={() => setShowRevisionModal(true)}
        >
          Propose Revision
        </button>
      </div>

      {/* Revision Proposal Modal */}
      {showRevisionModal && (
        <RevisionProposalModal
          isOpen={showRevisionModal}
          onClose={() => setShowRevisionModal(false)}
          artifactType={revisionArtifactType}
          originalData={data}
          problemSetId={problemSetId}
          onSubmitted={() => {
            setShowRevisionModal(false);
            onRevisionProposed?.();
          }}
        />
      )}
    </div>
  );
}
