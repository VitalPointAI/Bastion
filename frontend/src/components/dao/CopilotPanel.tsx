/**
 * CopilotPanel Component
 *
 * AI assistant panel for proposal analysis, showing:
 * - Summary with key points
 * - Context analysis (related proposals, gaps)
 * - Voting guidance (eligibility, autonomy explanation, next steps)
 *
 * CRITICAL: Never shows recommendations for StrikeAuthorization proposals.
 * Strike authorization decisions require human judgment.
 */

import { useState, useEffect, useCallback } from 'react';
import { governanceService } from '../../lib/governance-service';
import { ProposalKind } from '../../types/dao';
import type { CopilotAnalysis } from '../../lib/governance-service';
import './CopilotPanel.css';

interface CopilotPanelProps {
  daoId: string;
  proposalId: number;
  proposalKind: string;
  /** Default expanded state */
  expanded?: boolean;
  /** Callback when toggle state changes */
  onToggle?: (expanded: boolean) => void;
  /** User roles for eligibility check */
  userRoles?: string[];
  /** User's party for coalition proposals */
  userParty?: string;
}

// Cache for analysis results to avoid re-fetching
const analysisCache = new Map<string, { analysis: CopilotAnalysis; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function CopilotPanel({
  daoId,
  proposalId,
  proposalKind,
  expanded: initialExpanded,
  onToggle,
  userRoles = [],
  userParty,
}: CopilotPanelProps) {
  // Determine default expanded state - expand for complex proposals
  const isComplex = proposalKind === ProposalKind.StrikeAuthorization ||
    proposalKind === ProposalKind.FunctionCall ||
    proposalKind === ProposalKind.MissionOrder;

  const [isExpanded, setIsExpanded] = useState(initialExpanded ?? isComplex);
  const [analysis, setAnalysis] = useState<CopilotAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStrikeAuth = proposalKind === ProposalKind.StrikeAuthorization;

  // Generate cache key
  const cacheKey = `${daoId}:${proposalId}:${userRoles.join(',')}:${userParty || ''}`;

  // Fetch analysis when expanded
  const fetchAnalysis = useCallback(async () => {
    // Check cache first
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setAnalysis(cached.analysis);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await governanceService.getCopilotAnalysis(daoId, proposalId, userRoles, userParty);
      setAnalysis(result);
      // Cache the result
      analysisCache.set(cacheKey, { analysis: result, timestamp: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  }, [daoId, proposalId, userRoles, userParty, cacheKey]);

  useEffect(() => {
    if (isExpanded && !analysis && !loading) {
      fetchAnalysis();
    }
  }, [isExpanded, analysis, loading, fetchAnalysis]);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onToggle?.(newExpanded);
  };

  return (
    <div className={`copilot-panel ${isExpanded ? 'expanded' : ''}`}>
      {/* Header - Always visible */}
      <div className="copilot-header" onClick={handleToggle}>
        <div className="copilot-branding">
          <span className="copilot-icon">AI</span>
          <span className="copilot-title">AI ASSISTANT</span>
        </div>
        <span className="copilot-toggle">{isExpanded ? '-' : '+'}</span>
      </div>

      {/* Content - Collapsible */}
      {isExpanded && (
        <div className="copilot-content">
          {/* Strike Authorization Notice - Always shown for strike auth */}
          {isStrikeAuth && (
            <div className="copilot-strike-notice">
              <span className="copilot-strike-icon">!</span>
              <div>
                <div className="copilot-strike-text">
                  STRIKE AUTHORIZATION REQUIRES HUMAN JUDGMENT
                </div>
                <div className="copilot-strike-subtext">
                  AI cannot provide recommendations for lethal action authorization.
                  This decision must be made by authorized human personnel only.
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="copilot-loading">
              <div className="copilot-spinner" />
              <span>Analyzing proposal...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="copilot-error">
              <span>!</span>
              <span>{error}</span>
            </div>
          )}

          {/* Analysis Content */}
          {analysis && !loading && (
            <>
              {/* Summary Section */}
              <div className="copilot-section">
                <div className="copilot-section-title">Summary</div>
                <p className="copilot-summary-text">{analysis.summary.summary}</p>

                {analysis.summary.keyPoints.length > 0 && (
                  <ul className="copilot-key-points">
                    {analysis.summary.keyPoints.map((point, idx) => (
                      <li key={idx} className="copilot-key-point">{point}</li>
                    ))}
                  </ul>
                )}

                {analysis.summary.impactAssessment && (
                  <div className="copilot-impact">{analysis.summary.impactAssessment}</div>
                )}

                {/* Warnings */}
                {analysis.summary.warnings.length > 0 && (
                  <div className="copilot-warnings">
                    {analysis.summary.warnings.map((warning, idx) => (
                      <div key={idx} className="copilot-warning">
                        <span className="copilot-warning-icon">!</span>
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Context Section */}
              {(analysis.context.relatedProposals.length > 0 ||
                analysis.context.contextGaps.length > 0 ||
                analysis.context.strategicAlignment) && (
                <div className="copilot-section">
                  <div className="copilot-section-title">Context</div>

                  {/* Strategic Alignment */}
                  {analysis.context.strategicAlignment && (
                    <p className="copilot-strategic-text">{analysis.context.strategicAlignment}</p>
                  )}

                  {/* Related Proposals */}
                  {analysis.context.relatedProposals.length > 0 && (
                    <ul className="copilot-related-proposals">
                      {analysis.context.relatedProposals.slice(0, 3).map((related, idx) => (
                        <li key={idx} className="copilot-related-item">
                          <span className="copilot-related-badge">{related.relationship}</span>
                          <span>#{related.proposalId}: {related.summary.slice(0, 60)}...</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Context Gaps */}
                  {analysis.context.contextGaps.length > 0 && (
                    <ul className="copilot-context-gaps">
                      {analysis.context.contextGaps.map((gap, idx) => (
                        <li key={idx} className="copilot-context-gap">{gap}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Voting Guidance Section */}
              <div className="copilot-section">
                <div className="copilot-section-title">Voting Guidance</div>

                {/* Eligibility */}
                <div className={`copilot-eligibility ${analysis.guidance.eligibility.canVote ? '' : 'not-eligible'}`}>
                  <span>{analysis.guidance.eligibility.canVote ? '[OK]' : '[X]'}</span>
                  <span>
                    {analysis.guidance.eligibility.canVote
                      ? 'You are eligible to vote on this proposal'
                      : analysis.guidance.eligibility.reason || 'You are not eligible to vote'}
                  </span>
                </div>

                {/* Autonomy Explanation */}
                <div className="copilot-autonomy-box">
                  <div className="copilot-autonomy-label">Execution Mode</div>
                  <p className="copilot-autonomy-text">{analysis.guidance.autonomyExplanation}</p>
                </div>

                {/* Coalition Requirements */}
                {analysis.guidance.coalitionRequirements && (
                  <div className="copilot-coalition-box">
                    <div className="copilot-coalition-label">Coalition Requirements</div>
                    <p className="copilot-coalition-text">
                      {analysis.guidance.coalitionRequirements.explanation}
                    </p>
                    <div className="copilot-coalition-parties">
                      {analysis.guidance.coalitionRequirements.requiredParties.map((party) => (
                        <span
                          key={party}
                          className={`copilot-party-badge ${party === userParty ? 'my-party' : ''}`}
                        >
                          {party}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Next Steps */}
                {analysis.guidance.nextSteps.length > 0 && (
                  <ul className="copilot-next-steps">
                    {analysis.guidance.nextSteps.map((step, idx) => (
                      <li key={idx} className="copilot-next-step">
                        <span className="copilot-step-number">{idx + 1}</span>
                        <span>{step.replace(/^\d+\.\s*/, '')}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Deadline Warning */}
                {analysis.guidance.deadlineWarning && (
                  <div className={`copilot-deadline-warning ${analysis.guidance.deadlineWarning.includes('URGENT') ? 'urgent' : ''}`}>
                    <span className="copilot-deadline-icon">!</span>
                    <span className="copilot-deadline-text">{analysis.guidance.deadlineWarning}</span>
                  </div>
                )}
              </div>

              {/* Recommendation Section - NEVER for StrikeAuth */}
              {!isStrikeAuth && analysis.summary.recommendation && (
                <div className="copilot-section">
                  <div className="copilot-section-title">Recommendation</div>
                  <p className="copilot-recommendation">{analysis.summary.recommendation}</p>
                </div>
              )}

              {/* Disclaimer */}
              <div className="copilot-disclaimer">
                <span className="copilot-disclaimer-icon">[i]</span>
                <span>AI analysis - verify information before making decisions</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
