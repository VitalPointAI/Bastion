import { useState } from 'react';
import './EscalationLadder.css';

// ==========================================================================
// Frontend Types (mirror backend escalation-modeler.ts)
// ==========================================================================

export interface EscalationRungData {
  level: number;
  name: string;
  description: string;
  characteristicActions: string[];
  triggers: string[];
  thresholds: string[];
  deescalationConditions: string[];
  kinetic: boolean;
  nuclearRelevant: boolean;
}

export interface EscalationLadderData {
  id: string;
  framework: string;
  rungs: EscalationRungData[];
  currentPosition: number;
  positionConfidence: number;
  positionConfidenceBounds: { lower: number; upper: number };
}

export interface EscalationRiskAssessmentData {
  actionDescription: string;
  coaId: string;
  currentRung: number;
  projectedRung: number;
  escalationType: 'vertical' | 'horizontal' | 'cross_domain';
  escalationProbability: number;
  probabilityBounds: { lower: number; upper: number };
  riskLevel: 'low' | 'moderate' | 'high' | 'extreme';
  pathways: Array<{
    description: string;
    probability: number;
    consequence: string;
  }>;
  deescalationOptions: string[];
  adversaryResponse: string;
}

// ==========================================================================
// Component
// ==========================================================================

interface EscalationLadderProps {
  ladder: EscalationLadderData;
  riskAssessments?: EscalationRiskAssessmentData[];
  onRungClick?: (rung: EscalationRungData) => void;
}

export function EscalationLadder({
  ladder,
  riskAssessments = [],
  onRungClick,
}: EscalationLadderProps) {
  const [expandedRungLevel, setExpandedRungLevel] = useState<number | null>(null);

  const handleRungClick = (rung: EscalationRungData) => {
    // Toggle expansion
    setExpandedRungLevel(expandedRungLevel === rung.level ? null : rung.level);
    // Notify parent if callback provided
    if (onRungClick) {
      onRungClick(rung);
    }
  };

  const getRungColorClass = (level: number): string => {
    if (level <= 3) return 'rung-green';
    if (level <= 6) return 'rung-amber';
    return 'rung-red';
  };

  const isCurrentPosition = (level: number): boolean => {
    return level === ladder.currentPosition;
  };

  const getProjectedRungs = (): Set<number> => {
    const projected = new Set<number>();
    riskAssessments.forEach((assessment) => {
      projected.add(assessment.projectedRung);
    });
    return projected;
  };

  const projectedRungs = getProjectedRungs();

  const getProjectionsForRung = (level: number): EscalationRiskAssessmentData[] => {
    return riskAssessments.filter((assessment) => assessment.projectedRung === level);
  };

  // Sort rungs bottom to top (lowest level at bottom)
  const sortedRungs = [...ladder.rungs].sort((a, b) => b.level - a.level);

  return (
    <div className="escalation-ladder-container">
      <div className="escalation-ladder-header">
        <h3>Escalation Ladder</h3>
        <div className="escalation-ladder-meta">
          <span className="framework-name">{ladder.framework}</span>
          <span className="current-position-indicator">
            Current Position: Level {ladder.currentPosition} (
            {Math.round(ladder.positionConfidence * 100)}% confidence)
          </span>
        </div>
      </div>

      <div className="escalation-ladder">
        {sortedRungs.map((rung) => {
          const colorClass = getRungColorClass(rung.level);
          const isCurrent = isCurrentPosition(rung.level);
          const isExpanded = expandedRungLevel === rung.level;
          const isProjected = projectedRungs.has(rung.level);
          const projections = getProjectionsForRung(rung.level);

          return (
            <div key={rung.level} className="rung-container">
              <div
                className={`rung ${colorClass} ${isCurrent ? 'rung-current' : ''} ${
                  isProjected ? 'rung-projected' : ''
                } ${isExpanded ? 'rung-expanded' : ''}`}
                onClick={() => handleRungClick(rung)}
              >
                <div className="rung-level">{rung.level}</div>
                <div className="rung-content">
                  <div className="rung-name">{rung.name}</div>
                  <div className="rung-description">{rung.description}</div>
                  <div className="rung-indicators">
                    {rung.kinetic && (
                      <span className="rung-indicator kinetic" title="Kinetic action">
                        K
                      </span>
                    )}
                    {rung.nuclearRelevant && (
                      <span className="rung-indicator nuclear" title="Nuclear-relevant">
                        N
                      </span>
                    )}
                    {isCurrent && <span className="current-label">CURRENT</span>}
                    {isProjected && projections.length > 0 && (
                      <span className="projected-label">
                        {projections.length} COA{projections.length > 1 ? 's' : ''} →
                      </span>
                    )}
                  </div>
                </div>

                {rung.thresholds.length > 0 && (
                  <div className="rung-threshold-marker" title="Escalation threshold">
                    ─ ─ ─
                  </div>
                )}
              </div>

              {isExpanded && (
                <div className="rung-detail-panel">
                  <div className="rung-detail-section">
                    <h4>Triggers (escalate TO this level)</h4>
                    <ul>
                      {rung.triggers.map((trigger, idx) => (
                        <li key={idx}>{trigger}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rung-detail-section">
                    <h4>Characteristic Actions</h4>
                    <ul>
                      {rung.characteristicActions.map((action, idx) => (
                        <li key={idx}>{action}</li>
                      ))}
                    </ul>
                  </div>

                  {rung.thresholds.length > 0 && (
                    <div className="rung-detail-section">
                      <h4>Thresholds (red lines)</h4>
                      <ul>
                        {rung.thresholds.map((threshold, idx) => (
                          <li key={idx}>{threshold}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="rung-detail-section">
                    <h4>De-escalation Conditions</h4>
                    <ul>
                      {rung.deescalationConditions.map((condition, idx) => (
                        <li key={idx}>{condition}</li>
                      ))}
                    </ul>
                  </div>

                  {projections.length > 0 && (
                    <div className="rung-detail-section">
                      <h4>Projected by COAs</h4>
                      <ul>
                        {projections.map((assessment, idx) => (
                          <li key={idx} className={`risk-${assessment.riskLevel}`}>
                            <strong>COA {assessment.coaId}:</strong> {assessment.actionDescription}
                            <br />
                            <span className="risk-details">
                              Risk: {assessment.riskLevel} (
                              {Math.round(assessment.escalationProbability * 100)}% probability)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="escalation-ladder-legend">
        <div className="legend-item">
          <span className="legend-color rung-green"></span>
          <span>Levels 1-3: Peaceful/Competitive</span>
        </div>
        <div className="legend-item">
          <span className="legend-color rung-amber"></span>
          <span>Levels 4-6: Crisis/Confrontation</span>
        </div>
        <div className="legend-item">
          <span className="legend-color rung-red"></span>
          <span>Levels 7+: Conflict/War</span>
        </div>
        <div className="legend-item">
          <span className="legend-indicator kinetic">K</span>
          <span>Kinetic action</span>
        </div>
        <div className="legend-item">
          <span className="legend-indicator nuclear">N</span>
          <span>Nuclear-relevant</span>
        </div>
      </div>
    </div>
  );
}
