/**
 * DecisionBriefView Component
 *
 * Decision brief viewer for MDMP Phase 6 (COA Approval) gate.
 * Displays COA comparison matrix, risk assessment, assumptions, and staff recommendation.
 * Provides commander decision actions: approve, request revision, reject.
 */

import { useState, useMemo } from 'react';
import './DecisionBriefView.css';

// ==========================================================================
// Interfaces (matching backend types)
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
// Component Props
// ==========================================================================

interface DecisionBriefViewProps {
  brief: DecisionBrief;
  onApprove: (coaId: string) => void;
  onRequestRevision: (feedback: string) => void;
  onReject: () => void;
}

// ==========================================================================
// DecisionBriefView Component
// ==========================================================================

export function DecisionBriefView({
  brief,
  onApprove,
  onRequestRevision,
  onReject,
}: DecisionBriefViewProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [selectedCOA, setSelectedCOA] = useState<string | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [sortCriterion, setSortCriterion] = useState<string | null>(null);

  // Get recommended COA
  const recommendedCOA = useMemo(() => {
    return brief.coaComparison.find((coa) => coa.coaId === brief.staffRecommendation.recommendedCOA);
  }, [brief.coaComparison, brief.staffRecommendation.recommendedCOA]);

  // Toggle section collapse
  const toggleSection = (section: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(section)) {
      newCollapsed.delete(section);
    } else {
      newCollapsed.add(section);
    }
    setCollapsedSections(newCollapsed);
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  // Get score color class
  const getScoreColorClass = (score: number): string => {
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-medium';
    return 'score-low';
  };

  // Get sensitivity color class
  const getSensitivityClass = (sensitivity: string): string => {
    const map: Record<string, string> = {
      Critical: 'critical',
      High: 'high',
      Medium: 'medium',
      Low: 'low',
    };
    return map[sensitivity] || 'default';
  };

  // Get adequacy badge class
  const getAdequacyClass = (adequacy: string): string => {
    const map: Record<string, string> = {
      adequate: 'adequate',
      partial: 'partial',
      needs_work: 'needs-work',
    };
    return map[adequacy] || 'default';
  };

  // Get confidence bar width
  const getConfidenceBarWidth = (confidence: number): string => {
    return `${confidence * 100}%`;
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'var(--success, #10b981)';
    if (confidence >= 0.6) return 'var(--warning, #f59e0b)';
    return 'var(--danger, #ef4444)';
  };

  // Render COA comparison matrix
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
                    <span className="recommended-badge">★ Recommended</span>
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

  // Render risk matrix
  const renderRiskMatrix = () => {
    const probabilityLevels = ['very_likely', 'likely', 'possible', 'unlikely', 'rare'];
    const impactLevels = ['catastrophic', 'critical', 'marginal', 'negligible'];

    // Map risks to matrix cells
    const riskMap: Record<string, RiskAssessment[]> = {};
    brief.risks.forEach((risk) => {
      const key = `${risk.probability}_${risk.impact}`;
      if (!riskMap[key]) riskMap[key] = [];
      riskMap[key].push(risk);
    });

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

  // Get risk cell class based on probability and impact
  const getRiskCellClass = (probability: string, impact: string): string => {
    // High risk: catastrophic or critical impact with likely/very_likely probability
    if ((impact === 'catastrophic' || impact === 'critical') &&
        (probability === 'very_likely' || probability === 'likely')) {
      return 'risk-cell high-risk';
    }
    // Medium risk
    if ((impact === 'critical' && probability === 'possible') ||
        (impact === 'marginal' && (probability === 'very_likely' || probability === 'likely'))) {
      return 'risk-cell medium-risk';
    }
    // Low risk
    return 'risk-cell low-risk';
  };

  // Handle approve action
  const handleApprove = () => {
    if (selectedCOA) {
      onApprove(selectedCOA);
      setShowApprovalDialog(false);
      setSelectedCOA(null);
    }
  };

  // Handle revision request
  const handleRevisionRequest = () => {
    if (revisionFeedback.trim()) {
      onRequestRevision(revisionFeedback);
      setShowRevisionDialog(false);
      setRevisionFeedback('');
    }
  };

  // Handle reject
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
            ✓ Approve COA
          </button>
          <button className="revise-btn" onClick={() => setShowRevisionDialog(true)}>
            ↻ Request Revision
          </button>
          <button className="reject-btn" onClick={() => setShowRejectDialog(true)}>
            ✗ Reject All COAs
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
