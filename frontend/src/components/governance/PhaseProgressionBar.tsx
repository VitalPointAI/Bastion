/**
 * PhaseProgressionBar Component
 *
 * Visual MDMP phase progression indicator.
 * Shows all 9 MDMP phases (0-8) with gate completion status and current phase highlighting.
 */

import './PhaseProgressionBar.css';

export interface PhaseProgressionData {
  phase: string;
  label: string;
  gatesTotal: number;
  gatesSatisfied: number;
}

interface PhaseProgressionBarProps {
  currentPhase: string;
  phases: PhaseProgressionData[];
  onPhaseClick: (phase: string) => void;
}

export function PhaseProgressionBar({
  currentPhase,
  phases,
  onPhaseClick,
}: PhaseProgressionBarProps) {
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
                onClick={() => onPhaseClick(phase.phase)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => e.key === 'Enter' && onPhaseClick(phase.phase)}
                title={`${phase.label} - ${phase.gatesSatisfied}/${phase.gatesTotal} gates satisfied`}
              >
                <div className="step-indicator">
                  {isCompleted && <span className="step-icon completed">✓</span>}
                  {isCurrent && (
                    <span className="step-icon current">{phase.phase.split('_')[1]}</span>
                  )}
                  {isLocked && <span className="step-icon locked">🔒</span>}
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
