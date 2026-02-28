/**
 * ExerciseTimeline
 *
 * Phase 14 Plan 10: Visual timeline for exercise phase progression.
 * Uses a custom flexbox timeline (gantt-task-react has CSS module conflicts
 * in this project's build config) with color-coded phase segments:
 *
 *   - Past phases: green (complete)
 *   - Current phase: blue with pulse animation
 *   - Future phases: gray (not started)
 *
 * Clicking a phase segment calls onPhaseSelect to navigate the dashboard
 * to that phase's context.
 */

import { useState } from 'react';
import type { ExerciseScenario } from '../../types/exercise';
import './ExerciseTimeline.css';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ExerciseTimelineProps {
  scenario: ExerciseScenario;
  currentPhaseIndex: number;
  onPhaseSelect: (phase: string) => void;
}

// ─── Phase Status ──────────────────────────────────────────────────────────────

type PhaseStatus = 'complete' | 'current' | 'future';

function phaseStatus(index: number, currentPhaseIndex: number): PhaseStatus {
  if (index < currentPhaseIndex) return 'complete';
  if (index === currentPhaseIndex) return 'current';
  return 'future';
}

function phaseProgress(index: number, currentPhaseIndex: number): number {
  if (index < currentPhaseIndex) return 100;
  if (index === currentPhaseIndex) return 50;
  return 0;
}

// ─── Phase Segment ─────────────────────────────────────────────────────────────

interface PhaseSegmentProps {
  phase: string;
  index: number;
  totalPhases: number;
  currentPhaseIndex: number;
  browsedPhaseIndex: number;
  onClick: () => void;
}

function PhaseSegment({
  phase,
  index,
  currentPhaseIndex,
  browsedPhaseIndex,
  onClick,
}: PhaseSegmentProps) {
  const status = phaseStatus(index, currentPhaseIndex);
  const progress = phaseProgress(index, currentPhaseIndex);
  const isBrowsed = index === browsedPhaseIndex;

  const statusColors: Record<PhaseStatus, string> = {
    complete: '#22c55e',
    current: '#3b82f6',
    future: '#4b5563',
  };

  const progressColors: Record<PhaseStatus, string> = {
    complete: '#16a34a',
    current: '#2563eb',
    future: '#374151',
  };

  const barColor = statusColors[status];
  const progressColor = progressColors[status];

  return (
    <div
      className={`timeline-phase-wrap ${isBrowsed ? 'timeline-phase-wrap--browsed' : ''}`}
      onClick={onClick}
      title={`Phase ${index + 1}: ${phase} — ${status === 'complete' ? 'Complete' : status === 'current' ? 'In Progress' : 'Not Started'}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      {/* Phase number badge */}
      <div className="timeline-phase-number">{index + 1}</div>

      {/* Bar */}
      <div className="timeline-bar-wrap">
        <div
          className={`timeline-bar ${status === 'current' ? 'timeline-bar--pulse' : ''}`}
          style={{ backgroundColor: barColor }}
        >
          {/* Progress fill */}
          <div
            className="timeline-bar-progress"
            style={{
              width: `${progress}%`,
              backgroundColor: progressColor,
            }}
          />

          {/* Current indicator arrow */}
          {status === 'current' && (
            <div className="timeline-current-marker" title="Current phase" />
          )}
        </div>

        {/* Status label */}
        <div className={`timeline-status-label timeline-status-label--${status}`}>
          {status === 'complete' ? 'Complete' : status === 'current' ? 'In Progress' : 'Pending'}
        </div>
      </div>

      {/* Phase name */}
      <div className="timeline-phase-name">{phase}</div>
    </div>
  );
}

// ─── ExerciseTimeline ──────────────────────────────────────────────────────────

export function ExerciseTimeline({
  scenario,
  currentPhaseIndex,
  onPhaseSelect,
}: ExerciseTimelineProps) {
  const { exercisePhases } = scenario;

  // Track which phase is currently "browsed" (selected via click)
  const [browsedPhaseIndex, setBrowsedPhaseIndex] = useState<number>(currentPhaseIndex);

  const handlePhaseClick = (phase: string, index: number) => {
    setBrowsedPhaseIndex(index);
    onPhaseSelect(phase);
  };

  // Summary stats
  const completedCount = exercisePhases.filter((_, i) => i < currentPhaseIndex).length;
  const remainingCount = exercisePhases.filter((_, i) => i > currentPhaseIndex).length;
  const currentPhaseName = exercisePhases[currentPhaseIndex] ?? 'Unknown';

  return (
    <div className="exercise-timeline">

      {/* Summary header */}
      <div className="timeline-summary">
        <div className="timeline-summary-item timeline-summary-item--complete">
          <span className="timeline-summary-num">{completedCount}</span>
          <span className="timeline-summary-label">Complete</span>
        </div>
        <div className="timeline-summary-divider" />
        <div className="timeline-summary-item timeline-summary-item--current">
          <span className="timeline-summary-label">Current Phase:</span>
          <span className="timeline-summary-phase">{currentPhaseName}</span>
          <span className="timeline-summary-idx">({currentPhaseIndex + 1}/{exercisePhases.length})</span>
        </div>
        <div className="timeline-summary-divider" />
        <div className="timeline-summary-item timeline-summary-item--future">
          <span className="timeline-summary-num">{remainingCount}</span>
          <span className="timeline-summary-label">Remaining</span>
        </div>
      </div>

      {/* Legend */}
      <div className="timeline-legend">
        <span className="timeline-legend-item">
          <span className="timeline-legend-swatch timeline-legend-swatch--complete" />
          Complete
        </span>
        <span className="timeline-legend-item">
          <span className="timeline-legend-swatch timeline-legend-swatch--current" />
          In Progress
        </span>
        <span className="timeline-legend-item">
          <span className="timeline-legend-swatch timeline-legend-swatch--future" />
          Pending
        </span>
        <span className="timeline-legend-item timeline-legend-item--hint">
          Click a phase to view its data
        </span>
      </div>

      {/* Timeline rail */}
      <div className="timeline-rail">
        {/* Connection line */}
        <div className="timeline-connector" />

        {/* Phase segments */}
        <div className="timeline-phases">
          {exercisePhases.map((phase, index) => (
            <PhaseSegment
              key={`${phase}-${index}`}
              phase={phase}
              index={index}
              totalPhases={exercisePhases.length}
              currentPhaseIndex={currentPhaseIndex}
              browsedPhaseIndex={browsedPhaseIndex}
              onClick={() => handlePhaseClick(phase, index)}
            />
          ))}
        </div>
      </div>

      {/* Phase detail panel for browsed phase */}
      {browsedPhaseIndex !== currentPhaseIndex && (
        <div className="timeline-browsed-notice">
          <span className="timeline-browsed-icon">i</span>
          Viewing Phase {browsedPhaseIndex + 1}: <strong>{exercisePhases[browsedPhaseIndex]}</strong>
          {browsedPhaseIndex < currentPhaseIndex
            ? ' (past phase — historical data)'
            : ' (future phase — not yet started)'}
          <button
            className="timeline-browsed-return"
            onClick={() => {
              setBrowsedPhaseIndex(currentPhaseIndex);
              onPhaseSelect(currentPhaseName);
            }}
          >
            Return to Current
          </button>
        </div>
      )}
    </div>
  );
}
