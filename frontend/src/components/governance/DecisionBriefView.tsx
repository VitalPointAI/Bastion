/**
 * DecisionBriefView Component
 *
 * Generalized decision brief viewer for any gate type.
 * Supports both:
 * - Legacy MDMP Phase 6 (COA Approval) brief with full comparison matrix
 * - New DecisionGate-based brief for any gate type (context, recommendation, outcome)
 *
 * Training mode gates display a prominent TRAINING badge.
 */

import { useState, useMemo } from 'react';
import { GateStatusBadge } from './GateStatusBadge';
import type { DecisionGate } from '../../lib/gate-service';
import './DecisionBriefView.css';

// ==========================================================================
// Legacy MDMP Interfaces (preserved for backward compatibility)
// ==========================================================================

interface COAComparisonEntry {
  coaId: string;
  coaName: string;
  criteria: Record<
    string,
    {
      score: number;
      rationale: string;
      confidence: number;
      confidenceBounds: { lower: number; upper: number };
    }
  >;
  overallScore: number;
  rank: number;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
}

interface RiskAssessment {
  riskId: string;
  description: string;
  probability: 'very_likely' | 'likely' | 'possible' | 'unlikely' | 'rare';
  impact: 'catastrophic' | 'critical' | 'marginal' | 'negligible';
  mitigations: string[];
  residualRisk: string;
  assessmentConfidence: number;
}

interface AssumptionSummary {
  id: string;
  description: string;
  sensitivity: string;
  status: string;
  impactIfWrong: string;
}

interface RedTeamSummary {
  challenge: string;
  response: string;
  responseAdequacy: 'adequate' | 'partial' | 'needs_work';
}

interface StaffRecommendation {
  recommendedCOA: string;
  reasoning: string;
  dissent: string[];
  recommendationConfidence: number;
  confidenceBounds: { lower: number; upper: number };
}

interface GovernanceLinks {
  phase5ComparisonProposalId: number | null;
  phase6ApprovalGateId: string;
  assumptionProposalIds: number[];
}

export interface DecisionBrief {
  missionId: string;
  generatedAt: number;
  currentPhase: string;
  briefVersion: number;
  situationSummary: string;
  commanderIntent: string;
  coaComparison: COAComparisonEntry[];
  evaluationCriteria: Array<{
    name: string;
    weight: number;
    description: string;
  }>;
  risks: RiskAssessment[];
  assumptions: AssumptionSummary[];
  redTeamSummary: RedTeamSummary[];
  staffRecommendation: StaffRecommendation;
  decisionRequired: string;
  briefConfidence: number;
  governanceLinks: GovernanceLinks;
}

// ==========================================================================
// Gate type display labels
// ==========================================================================

const GATE_TYPE_LABELS: Record<string, string> = {
  mdmp: 'MDMP',
  jpp: 'JPP',
  targeting: 'Targeting',
  assessment: 'Assessment',
  resource: 'Resource',
};

// ==========================================================================
// Component Props
// ==========================================================================

interface DecisionBriefViewProps {
  /** Legacy MDMP brief data */
  brief?: DecisionBrief;
  /** New: DecisionGate to display brief for */
  gate?: DecisionGate;
  /** Legacy callbacks */
  onApprove?: (coaId: string) => void;
  onRequestRevision?: (feedback: string) => void;
  onReject?: () => void;
  /** New: generic action callbacks */
  onGateAction?: (action: 'approve' | 'reject' | 'escalate' | 'override', gateId: string) => void;
}

// ==========================================================================
// DecisionBriefView Component
// ==========================================================================

export function DecisionBriefView({
  brief,
  gate,
  onApprove,
  onRequestRevision,
  onReject,
  onGateAction,
}: DecisionBriefViewProps) {
  // If gate is provided (new mode), render gate brief
  if (gate) {
    return (
      <GateBriefView
        gate={gate}
        onGateAction={onGateAction}
      />
    );
  }

  // Otherwise render legacy MDMP brief
  if (brief && onApprove && onRequestRevision && onReject) {
    return (
      <LegacyMDMPBriefView
        brief={brief}
        onApprove={onApprove}
        onRequestRevision={onRequestRevision}
        onReject={onReject}
      />
    );
  }

  return (
    <div className="decision-brief-view">
      <div className="brief-empty">
        <p>No decision brief data available.</p>
      </div>
    </div>
  );
}

// ==========================================================================
// GateBriefView: New generalized view for any DecisionGate
// ==========================================================================

function GateBriefView({
  gate,
  onGateAction,
}: {
  gate: DecisionGate;
  onGateAction?: (action: 'approve' | 'reject' | 'escalate' | 'override', gateId: string) => void;
}) {
  const context = gate.decision_context as Record<string, unknown>;
  const title = (context?.title as string) || gate.target_item_title || 'Decision Gate';
  const description = (context?.description as string) || '';
  const metadata = (context?.metadata as Record<string, unknown>) || {};
  const recommendation = (context?.recommendation as string) || '';

  const formatTimestamp = (ts: string | null): string => {
    if (!ts) return 'N/A';
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  return (
    <div className="decision-brief-view">
      {/* Header */}
      <header className="brief-header">
        <div className="header-content">
          <div className="brief-header-top">
            <h2>{title}</h2>
            {gate.mode === 'training' && (
              <span className="training-badge-large">TRAINING</span>
            )}
          </div>
          <div className="brief-meta">
            <span className="gate-type-label">
              {GATE_TYPE_LABELS[gate.gate_type] || gate.gate_type}
            </span>
            <span className="meta-separator">|</span>
            <span className="tab-label">{gate.tab}</span>
            <span className="meta-separator">|</span>
            <span className="enforcement-label">{gate.enforcement}</span>
          </div>
        </div>
        <div className="overall-confidence">
          <div className="confidence-label">Status</div>
          <GateStatusBadge status={gate.status} />
        </div>
      </header>

      {/* Context Section */}
      <section className="brief-section">
        <div className="section-header">
          <h3>Decision Context</h3>
        </div>
        <div className="section-content">
          {description && <p>{description}</p>}
          {Object.keys(metadata).length > 0 && (
            <div className="context-metadata">
              <h4>Details</h4>
              <dl className="metadata-list">
                {Object.entries(metadata).map(([key, value]) => (
                  <div key={key} className="metadata-item">
                    <dt>{key}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </section>

      {/* Recommendation Section */}
      {recommendation && (
        <section className="brief-section staff-recommendation">
          <div className="section-header">
            <h3>Recommendation</h3>
          </div>
          <div className="section-content highlighted">
            <p className="reasoning">{recommendation}</p>
          </div>
        </section>
      )}

      {/* Outcome Section */}
      <section className="brief-section">
        <div className="section-header">
          <h3>Outcome</h3>
        </div>
        <div className="section-content">
          <div className="outcome-grid">
            <div className="outcome-item">
              <span className="outcome-label">Status</span>
              <GateStatusBadge status={gate.status} />
            </div>
            <div className="outcome-item">
              <span className="outcome-label">Enforcement</span>
              <span className={`enforcement-value enforcement-${gate.enforcement}`}>
                {gate.enforcement}
              </span>
            </div>
            {gate.decided_by && (
              <div className="outcome-item">
                <span className="outcome-label">Decided By</span>
                <span className="outcome-value">{gate.decided_by}</span>
              </div>
            )}
            {gate.decided_at && (
              <div className="outcome-item">
                <span className="outcome-label">Decided At</span>
                <span className="outcome-value">{formatTimestamp(gate.decided_at)}</span>
              </div>
            )}
            {gate.submitted_by && (
              <div className="outcome-item">
                <span className="outcome-label">Submitted By</span>
                <span className="outcome-value">{gate.submitted_by}</span>
              </div>
            )}
            {gate.submitted_at && (
              <div className="outcome-item">
                <span className="outcome-label">Submitted At</span>
                <span className="outcome-value">{formatTimestamp(gate.submitted_at)}</span>
              </div>
            )}
            {gate.deadline_at && (
              <div className="outcome-item">
                <span className="outcome-label">Deadline</span>
                <span className="outcome-value">{formatTimestamp(gate.deadline_at)}</span>
              </div>
            )}
            {gate.proposal_id !== null && (
              <div className="outcome-item">
                <span className="outcome-label">Proposal</span>
                <span className="outcome-value proposal-link">#{gate.proposal_id}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Training Config (if training mode) */}
      {gate.mode === 'training' && gate.training_config && (
        <section className="brief-section training-section">
          <div className="section-header training-header">
            <h3>Training Configuration</h3>
            <span className="training-badge-small">TRAINING</span>
          </div>
          <div className="section-content">
            <dl className="metadata-list">
              {Object.entries(gate.training_config).map(([key, value]) => (
                <div key={key} className="metadata-item">
                  <dt>{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* Action Buttons (for pending/submitted gates) */}
      {onGateAction && (gate.status === 'pending' || gate.status === 'submitted') && (
        <section className="decision-actions">
          <div className="action-buttons">
            <button
              className="approve-btn"
              onClick={() => onGateAction('approve', gate.id)}
            >
              Approve
            </button>
            <button
              className="reject-btn"
              onClick={() => onGateAction('reject', gate.id)}
            >
              Reject
            </button>
            <button
              className="revise-btn"
              onClick={() => onGateAction('escalate', gate.id)}
            >
              Escalate
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

// ==========================================================================
// LegacyMDMPBriefView: Original MDMP COA Approval brief (preserved)
// ==========================================================================

function LegacyMDMPBriefView({
  brief,
  onApprove,
  onRequestRevision,
  onReject,
}: {
  brief: DecisionBrief;
  onApprove: (coaId: string) => void;
  onRequestRevision: (feedback: string) => void;
  onReject: () => void;
}) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [selectedCOA, setSelectedCOA] = useState<string | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [sortCriterion, setSortCriterion] = useState<string | null>(null);

  const recommendedCOA = useMemo(() => {
    return brief.coaComparison.find((coa) => coa.coaId === brief.staffRecommendation.recommendedCOA);
  }, [brief.coaComparison, brief.staffRecommendation.recommendedCOA]);

  const toggleSection = (section: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(section)) {
      newCollapsed.delete(section);
    } else {
      newCollapsed.add(section);
    }
    setCollapsedSections(newCollapsed);
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getScoreColorClass = (score: number): string => {
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-medium';
    return 'score-low';
  };

  const getSensitivityClass = (sensitivity: string): string => {
    const map: Record<string, string> = {
      Critical: 'critical',
      High: 'high',
      Medium: 'medium',
      Low: 'low',
    };
    return map[sensitivity] || 'default';
  };

  const getAdequacyClass = (adequacy: string): string => {
    const map: Record<string, string> = {
      adequate: 'adequate',
      partial: 'partial',
      needs_work: 'needs-work',
    };
    return map[adequacy] || 'default';
  };

  const getConfidenceBarWidth = (confidence: number): string => {
    return `${confidence * 100}%`;
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'var(--success, #10b981)';
    if (confidence >= 0.6) return 'var(--warning, #f59e0b)';
    return 'var(--danger, #ef4444)';
  };

  const renderCOAComparisonMatrix = () => {
    const sortedCOAs = sortCriterion
      ? [...brief.coaComparison].sort((a, b) => {
          return b.criteria[sortCriterion].score - a.criteria[sortCriterion].score;
        })
      : brief.coaComparison;

    return (
      <div className="comparison-matrix">
        <table>
          <thead>
            <tr>
              <th>COA</th>
              {brief.evaluationCriteria.map((criterion) => (
                <th
                  key={criterion.name}
                  onClick={() => setSortCriterion(criterion.name)}
                  className={sortCriterion === criterion.name ? 'sorted' : ''}
                  style={{ cursor: 'pointer' }}
                >
                  {criterion.name.charAt(0).toUpperCase() + criterion.name.slice(1)}
                  <br />
                  <span className="weight">({Math.round(criterion.weight * 100)}%)</span>
                </th>
              ))}
              <th>Overall</th>
              <th>Rank</th>
            </tr>
          </thead>
          <tbody>
            {sortedCOAs.map((coa) => (
              <tr
                key={coa.coaId}
                className={coa.coaId === brief.staffRecommendation.recommendedCOA ? 'recommended' : ''}
              >
                <td className="coa-name">
                  {coa.coaName}
                  {coa.coaId === brief.staffRecommendation.recommendedCOA && (
                    <span className="recommended-badge">Recommended</span>
                  )}
                </td>
                {brief.evaluationCriteria.map((criterion) => {
                  const criterionData = coa.criteria[criterion.name];
                  return (
                    <td key={criterion.name} className={getScoreColorClass(criterionData.score)}>
                      <div className="score-cell">
                        <div className="score-value">{criterionData.score}</div>
                        <div className="confidence-indicator" title={`Confidence: ${Math.round(criterionData.confidence * 100)}%`}>
                          <div
                            className="confidence-bar"
                            style={{
                              width: getConfidenceBarWidth(criterionData.confidence),
                              backgroundColor: getConfidenceColor(criterionData.confidence),
                            }}
                          />
                        </div>
                        <div className="confidence-bounds">
                          [{criterionData.confidenceBounds.lower}-{criterionData.confidenceBounds.upper}]
                        </div>
                      </div>
                    </td>
                  );
                })}
                <td className={getScoreColorClass(coa.overallScore)}>
                  <strong>{coa.overallScore}</strong>
                </td>
                <td>
                  <span className="rank-badge">#{coa.rank}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderRiskMatrix = () => {
    const probabilityLevels = ['very_likely', 'likely', 'possible', 'unlikely', 'rare'];
    const impactLevels = ['catastrophic', 'critical', 'marginal', 'negligible'];

    const riskMap: Record<string, RiskAssessment[]> = {};
    brief.risks.forEach((risk) => {
      const key = `${risk.probability}_${risk.impact}`;
      if (!riskMap[key]) riskMap[key] = [];
      riskMap[key].push(risk);
    });

    const getRiskCellClass = (probability: string, impact: string): string => {
      if ((impact === 'catastrophic' || impact === 'critical') &&
          (probability === 'very_likely' || probability === 'likely')) {
        return 'risk-cell high-risk';
      }
      if ((impact === 'critical' && probability === 'possible') ||
          (impact === 'marginal' && (probability === 'very_likely' || probability === 'likely'))) {
        return 'risk-cell medium-risk';
      }
      return 'risk-cell low-risk';
    };

    return (
      <div className="risk-matrix">
        <table>
          <thead>
            <tr>
              <th>Probability \ Impact</th>
              {impactLevels.map((impact) => (
                <th key={impact}>{impact.charAt(0).toUpperCase() + impact.slice(1)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {probabilityLevels.map((probability) => (
              <tr key={probability}>
                <td className="probability-label">
                  {probability.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </td>
                {impactLevels.map((impact) => {
                  const key = `${probability}_${impact}`;
                  const risks = riskMap[key] || [];
                  const cellClass = getRiskCellClass(probability, impact);
                  return (
                    <td key={impact} className={cellClass}>
                      {risks.length > 0 && (
                        <div className="risk-count">{risks.length}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="risk-details">
          {brief.risks.map((risk) => (
            <div key={risk.riskId} className="risk-card">
              <div className="risk-header">
                <span className={`risk-badge ${risk.impact}`}>{risk.impact.toUpperCase()}</span>
                <span className="risk-probability">{risk.probability.split('_').join(' ')}</span>
              </div>
              <p className="risk-description">{risk.description}</p>
              <div className="risk-mitigations">
                <strong>Mitigations:</strong>
                <ul>
                  {risk.mitigations.map((mitigation, idx) => (
                    <li key={idx}>{mitigation}</li>
                  ))}
                </ul>
              </div>
              <p className="residual-risk">
                <strong>Residual Risk:</strong> {risk.residualRisk}
              </p>
              <div className="assessment-confidence">
                Confidence: {Math.round(risk.assessmentConfidence * 100)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleApprove = () => {
    if (selectedCOA) {
      onApprove(selectedCOA);
      setShowApprovalDialog(false);
      setSelectedCOA(null);
    }
  };

  const handleRevisionRequest = () => {
    if (revisionFeedback.trim()) {
      onRequestRevision(revisionFeedback);
      setShowRevisionDialog(false);
      setRevisionFeedback('');
    }
  };

  const handleReject = () => {
    onReject();
    setShowRejectDialog(false);
  };

  return (
    <div className="decision-brief-view">
      {/* Header */}
      <header className="brief-header">
        <div className="header-content">
          <h2>Decision Brief: COA Approval</h2>
          <div className="brief-meta">
            <span className="mission-label">Mission:</span>
            <span className="mission-id">{brief.missionId}</span>
            <span className="version">Version {brief.briefVersion}</span>
            <span className="timestamp">{formatTimestamp(brief.generatedAt)}</span>
          </div>
        </div>
        <div className="overall-confidence">
          <div className="confidence-label">Overall Confidence</div>
          <div className="confidence-value" style={{ color: getConfidenceColor(brief.briefConfidence) }}>
            {Math.round(brief.briefConfidence * 100)}%
          </div>
        </div>
      </header>

      {/* Situation Summary */}
      <section className="brief-section">
        <div className="section-header" onClick={() => toggleSection('situation')}>
          <h3>Situation Summary</h3>
          <span className="toggle-icon">{collapsedSections.has('situation') ? '▼' : '▲'}</span>
        </div>
        {!collapsedSections.has('situation') && (
          <div className="section-content">
            <p>{brief.situationSummary}</p>
          </div>
        )}
      </section>

      {/* Commander's Intent */}
      <section className="brief-section commanders-intent">
        <div className="section-header">
          <h3>Commander's Intent</h3>
        </div>
        <div className="section-content highlighted">
          <p>{brief.commanderIntent}</p>
        </div>
      </section>

      {/* COA Comparison Matrix */}
      <section className="brief-section">
        <div className="section-header" onClick={() => toggleSection('comparison')}>
          <h3>COA Comparison Matrix</h3>
          <span className="toggle-icon">{collapsedSections.has('comparison') ? '▼' : '▲'}</span>
        </div>
        {!collapsedSections.has('comparison') && (
          <div className="section-content">
            {renderCOAComparisonMatrix()}
            {recommendedCOA && (
              <div className="coa-details">
                <h4>Recommended COA: {recommendedCOA.coaName}</h4>
                <div className="coa-strengths">
                  <strong>Strengths:</strong>
                  <ul>
                    {recommendedCOA.strengths.map((strength, idx) => (
                      <li key={idx}>{strength}</li>
                    ))}
                  </ul>
                </div>
                <div className="coa-weaknesses">
                  <strong>Weaknesses:</strong>
                  <ul>
                    {recommendedCOA.weaknesses.map((weakness, idx) => (
                      <li key={idx}>{weakness}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Risk Assessment */}
      <section className="brief-section">
        <div className="section-header" onClick={() => toggleSection('risks')}>
          <h3>Risk Assessment</h3>
          <span className="toggle-icon">{collapsedSections.has('risks') ? '▼' : '▲'}</span>
        </div>
        {!collapsedSections.has('risks') && (
          <div className="section-content">
            {renderRiskMatrix()}
          </div>
        )}
      </section>

      {/* Assumption Summary */}
      <section className="brief-section">
        <div className="section-header" onClick={() => toggleSection('assumptions')}>
          <h3>Assumption Summary</h3>
          <span className="toggle-icon">{collapsedSections.has('assumptions') ? '▼' : '▲'}</span>
        </div>
        {!collapsedSections.has('assumptions') && (
          <div className="section-content">
            <table className="assumptions-table">
              <thead>
                <tr>
                  <th>Assumption</th>
                  <th>Sensitivity</th>
                  <th>Status</th>
                  <th>Impact if Wrong</th>
                </tr>
              </thead>
              <tbody>
                {brief.assumptions.map((assumption) => (
                  <tr key={assumption.id}>
                    <td>{assumption.description}</td>
                    <td>
                      <span className={`sensitivity-badge ${getSensitivityClass(assumption.sensitivity)}`}>
                        {assumption.sensitivity}
                      </span>
                    </td>
                    <td>
                      <span className="status-badge">{assumption.status}</span>
                    </td>
                    <td>{assumption.impactIfWrong}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Red Team Summary */}
      <section className="brief-section">
        <div className="section-header" onClick={() => toggleSection('redteam')}>
          <h3>Red Team Summary</h3>
          <span className="toggle-icon">{collapsedSections.has('redteam') ? '▼' : '▲'}</span>
        </div>
        {!collapsedSections.has('redteam') && (
          <div className="section-content">
            {brief.redTeamSummary.map((item, idx) => (
              <div key={idx} className="redteam-card">
                <div className="redteam-header">
                  <strong>Challenge:</strong>
                  <span className={`adequacy-badge ${getAdequacyClass(item.responseAdequacy)}`}>
                    {item.responseAdequacy.split('_').join(' ')}
                  </span>
                </div>
                <p className="redteam-challenge">{item.challenge}</p>
                <div className="redteam-response">
                  <strong>Response:</strong>
                  <p>{item.response}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Staff Recommendation */}
      <section className="brief-section staff-recommendation">
        <div className="section-header">
          <h3>Staff Recommendation</h3>
        </div>
        <div className="section-content highlighted">
          <div className="recommendation-header">
            <h4>Recommended: {recommendedCOA?.coaName || 'N/A'}</h4>
            <div className="recommendation-confidence">
              <span>Confidence: {Math.round(brief.staffRecommendation.recommendationConfidence * 100)}%</span>
              <div className="confidence-bar-container">
                <div
                  className="confidence-bar"
                  style={{
                    width: getConfidenceBarWidth(brief.staffRecommendation.recommendationConfidence),
                    backgroundColor: getConfidenceColor(brief.staffRecommendation.recommendationConfidence),
                  }}
                />
              </div>
              <span className="confidence-bounds">
                [{Math.round(brief.staffRecommendation.confidenceBounds.lower * 100)}% - {Math.round(brief.staffRecommendation.confidenceBounds.upper * 100)}%]
              </span>
            </div>
          </div>
          <p className="reasoning">{brief.staffRecommendation.reasoning}</p>
          {brief.staffRecommendation.dissent.length > 0 && (
            <div className="dissent-section">
              <strong>Dissenting Views:</strong>
              <ul>
                {brief.staffRecommendation.dissent.map((dissent, idx) => (
                  <li key={idx}>{dissent}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Decision Actions */}
      <section className="decision-actions">
        <div className="decision-required">
          <strong>Decision Required:</strong>
          <p>{brief.decisionRequired}</p>
        </div>
        <div className="action-buttons">
          <button className="approve-btn" onClick={() => setShowApprovalDialog(true)}>
            Approve COA
          </button>
          <button className="revise-btn" onClick={() => setShowRevisionDialog(true)}>
            Request Revision
          </button>
          <button className="reject-btn" onClick={() => setShowRejectDialog(true)}>
            Reject All COAs
          </button>
        </div>
      </section>

      {/* Governance Gate Link */}
      <section className="governance-link">
        <p>
          <strong>Governance Gate:</strong> {brief.governanceLinks.phase6ApprovalGateId}
        </p>
      </section>

      {/* Approval Dialog */}
      {showApprovalDialog && (
        <div className="dialog-overlay" onClick={() => setShowApprovalDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Approve COA</h3>
            <p>Select the COA to approve for orders production:</p>
            <select
              value={selectedCOA || ''}
              onChange={(e) => setSelectedCOA(e.target.value)}
              className="coa-selector"
            >
              <option value="">-- Select COA --</option>
              {brief.coaComparison.map((coa) => (
                <option key={coa.coaId} value={coa.coaId}>
                  {coa.coaName} (Rank #{coa.rank}, Score: {coa.overallScore})
                </option>
              ))}
            </select>
            <div className="dialog-actions">
              <button onClick={handleApprove} disabled={!selectedCOA} className="confirm-btn">
                Approve
              </button>
              <button onClick={() => setShowApprovalDialog(false)} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revision Dialog */}
      {showRevisionDialog && (
        <div className="dialog-overlay" onClick={() => setShowRevisionDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Request Revision</h3>
            <p>Provide feedback for staff to revise the COA analysis:</p>
            <textarea
              value={revisionFeedback}
              onChange={(e) => setRevisionFeedback(e.target.value)}
              placeholder="Describe specific concerns or areas requiring additional analysis..."
              rows={6}
              className="revision-textarea"
            />
            <div className="dialog-actions">
              <button onClick={handleRevisionRequest} disabled={!revisionFeedback.trim()} className="confirm-btn">
                Submit Feedback
              </button>
              <button onClick={() => setShowRevisionDialog(false)} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="dialog-overlay" onClick={() => setShowRejectDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Reject All COAs</h3>
            <p className="warning-text">
              This will return planning to Phase 3 for COA redevelopment. This is a significant decision that will delay the planning timeline.
            </p>
            <p>Are you sure you want to reject all COAs?</p>
            <div className="dialog-actions">
              <button onClick={handleReject} className="reject-confirm-btn">
                Reject All COAs
              </button>
              <button onClick={() => setShowRejectDialog(false)} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
