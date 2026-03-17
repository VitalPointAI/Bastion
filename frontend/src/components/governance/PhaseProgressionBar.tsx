/**
 * PhaseProgressionBar Component
 *
 * Generalized gate workflow progression indicator.
 * Supports both:
 * - Legacy MDMP phase progression (9 phases with gate completion counts)
 * - New DecisionGate[] progression (gates as workflow steps with status coloring)
 *
 * Status color coding:
 * - Green: approved
 * - Amber: submitted/pending
 * - Red: rejected
 * - Purple: escalated
 * - Gray: overridden
 */

import { useMemo } from 'react';
import type { DecisionGate } from '../../lib/gate-service';
import './PhaseProgressionBar.css';

// Legacy phase progression data (backward compatible)
export interface PhaseProgressionData {
  phase: string;
  label: string;
  gatesTotal: number;
  gatesSatisfied: number;
}

interface PhaseProgressionBarProps {
  /** Legacy: current active phase */
  currentPhase?: string;
  /** Legacy: phase progression data array */
  phases?: PhaseProgressionData[];
  /** Legacy: callback when phase is clicked */
  onPhaseClick?: (phase: string) => void;
  /** New: array of DecisionGates to show as progression steps */
  gates?: DecisionGate[];
  /** New: callback when a gate step is clicked */
  onGateClick?: (gate: DecisionGate) => void;
}

// Status to CSS class mapping for gate steps
const STATUS_CLASS_MAP: Record<string, string> = {
  pending: 'step-pending',
  submitted: 'step-submitted',
  approved: 'step-approved',
  rejected: 'step-rejected',
  escalated: 'step-escalated',
  overridden: 'step-overridden',
};

// Status display labels
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  escalated: 'Escalated',
  overridden: 'Overridden',
};

// Gate type short labels
const GATE_TYPE_SHORT: Record<string, string> = {
  mdmp: 'MDMP',
  jpp: 'JPP',
  targeting: 'TGT',
  assessment: 'ASMT',
  resource: 'RES',
  design_revision: 'DSN-REV',
};

export function PhaseProgressionBar({
  currentPhase,
  phases,
  onPhaseClick,
  gates,
  onGateClick,
}: PhaseProgressionBarProps) {
  // Determine rendering mode
  const useGateMode = gates && gates.length > 0;

  // === Legacy MDMP rendering ===
  if (!useGateMode && phases) {
    return <LegacyPhaseBar currentPhase={currentPhase || ''} phases={phases} onPhaseClick={onPhaseClick} />;
  }

  // === New DecisionGate rendering ===
  if (useGateMode && gates) {
    return <GateProgressionBar gates={gates} onGateClick={onGateClick} />;
  }

  // No data
  return null;
}

// ==========================================================================
// GateProgressionBar: New generalized gate workflow progression
// ==========================================================================

function GateProgressionBar({
  gates,
  onGateClick,
}: {
  gates: DecisionGate[];
  onGateClick?: (gate: DecisionGate) => void;
}) {
  // Summary stats
  const stats = useMemo(() => {
    const total = gates.length;
    const approved = gates.filter((g) => g.status === 'approved').length;
    const pending = gates.filter((g) => g.status === 'pending' || g.status === 'submitted').length;
    const rejected = gates.filter((g) => g.status === 'rejected').length;
    const escalated = gates.filter((g) => g.status === 'escalated').length;
    return { total, approved, pending, rejected, escalated };
  }, [gates]);

  const overallPercent = stats.total > 0 ? (stats.approved / stats.total) * 100 : 0;

  return (
    <div className="phase-progression-bar">
      {/* Overall progress summary */}
      <div className="progression-summary">
        <div className="summary-bar">
          <div
            className="summary-fill summary-fill--approved"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
        <span className="summary-text">
          {stats.approved}/{stats.total} gates approved
        </span>
      </div>

      {/* Gate steps */}
      <div className="progression-steps">
        {gates.map((gate, index) => {
          const statusClass = STATUS_CLASS_MAP[gate.status] || 'step-pending';
          const statusLabel = STATUS_LABELS[gate.status] || gate.status;
          const typeLabel = GATE_TYPE_SHORT[gate.gate_type] || gate.gate_type;
          const title = gate.target_item_title || `${typeLabel} Gate`;

          return (
            <div key={gate.id} className="progression-step-wrapper">
              {/* Connector line between steps */}
              {index > 0 && (
                <div
                  className={`progression-connector ${
                    gate.status === 'approved' ? 'connector-approved' :
                    gate.status === 'rejected' ? 'connector-rejected' :
                    gate.status === 'escalated' ? 'connector-escalated' :
                    gate.status === 'overridden' ? 'connector-overridden' :
                    'inactive'
                  }`}
                />
              )}

              {/* Gate step */}
              <div
                className={`progression-step ${statusClass}`}
                onClick={() => onGateClick?.(gate)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => e.key === 'Enter' && onGateClick?.(gate)}
                title={`${title} - ${statusLabel}`}
              >
                <div className="step-indicator">
                  <span className={`step-icon ${statusClass}`}>
                    {gate.status === 'approved' && '\u2713'}
                    {gate.status === 'rejected' && '\u2717'}
                    {gate.status === 'escalated' && '!'}
                    {gate.status === 'overridden' && '\u2014'}
                    {(gate.status === 'pending' || gate.status === 'submitted') && '\u2022'}
                  </span>
                </div>
                <div className="step-content">
                  <div className="step-label">{title}</div>
                  <div className="step-gates">
                    <span className={`step-status-label ${statusClass}`}>{statusLabel}</span>
                  </div>
                  {gate.mode === 'training' && (
                    <div className="step-training-tag">TRAINING</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================================================
// LegacyPhaseBar: Original MDMP phase progression (preserved)
// ==========================================================================

function LegacyPhaseBar({
  currentPhase,
  phases,
  onPhaseClick,
}: {
  currentPhase: string;
  phases: PhaseProgressionData[];
  onPhaseClick?: (phase: string) => void;
}) {
  const getPhaseStatus = (phase: PhaseProgressionData): 'completed' | 'current' | 'locked' => {
    const currentIndex = phases.findIndex((p) => p.phase === currentPhase);
    const phaseIndex = phases.findIndex((p) => p.phase === phase.phase);

    if (phaseIndex < currentIndex) {
      return 'completed';
    } else if (phaseIndex === currentIndex) {
      return 'current';
    } else {
      return 'locked';
    }
  };

  const getPhaseCompletionPercent = (phase: PhaseProgressionData): number => {
    if (phase.gatesTotal === 0) return 100;
    return (phase.gatesSatisfied / phase.gatesTotal) * 100;
  };

  return (
    <div className="phase-progression-bar">
      <div className="progression-steps">
        {phases.map((phase, index) => {
          const status = getPhaseStatus(phase);
          const completionPercent = getPhaseCompletionPercent(phase);
          const isCompleted = status === 'completed';
          const isCurrent = status === 'current';
          const isLocked = status === 'locked';

          return (
            <div key={phase.phase} className="progression-step-wrapper">
              {/* Connector line between steps */}
              {index > 0 && (
                <div
                  className={`progression-connector ${
                    isCompleted || isCurrent ? 'active' : 'inactive'
                  }`}
                />
              )}

              {/* Phase step */}
              <div
                className={`progression-step ${status}`}
                onClick={() => onPhaseClick?.(phase.phase)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => e.key === 'Enter' && onPhaseClick?.(phase.phase)}
                title={`${phase.label} - ${phase.gatesSatisfied}/${phase.gatesTotal} gates satisfied`}
              >
                <div className="step-indicator">
                  {isCompleted && <span className="step-icon completed">{'\u2713'}</span>}
                  {isCurrent && (
                    <span className="step-icon current">{phase.phase.split('_')[1]}</span>
                  )}
                  {isLocked && <span className="step-icon locked">{'\uD83D\uDD12'}</span>}
                </div>
                <div className="step-content">
                  <div className="step-label">{phase.label}</div>
                  <div className="step-gates">
                    {phase.gatesSatisfied}/{phase.gatesTotal} gates
                  </div>
                  {!isLocked && (
                    <div className="step-progress-bar">
                      <div
                        className={`step-progress-fill ${status}`}
                        style={{ width: `${completionPercent}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
