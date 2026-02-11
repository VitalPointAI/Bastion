/**
 * Decision Brief Generator
 *
 * Produces structured decision briefs for MDMP Phase 6 (COA Approval) gate.
 * Synthesizes COA comparison, risk assessment, assumptions, and red team data.
 * Per safety matrix: DECISION_SUPPORT is HYBRID_AI_LED - AI builds, human decides.
 *
 * INVARIANT 5: All AI-generated elements include confidence intervals.
 */

import { assessUncertainty, ConfidenceInterval } from '../agents/uncertainty-quantifier.js';
import { ActivityCategory } from './types.js';

// ==========================================================================
// Output Interfaces
// ==========================================================================

/**
 * COA comparison entry with scores and confidence intervals
 */
export interface COAComparisonEntry {
  /** COA unique identifier */
  coaId: string;
  /** COA display name */
  coaName: string;
  /** Per-criterion scoring with confidence intervals */
  criteria: Record<
    string,
    {
      score: number;
      rationale: string;
      confidence: number;
      confidenceBounds: { lower: number; upper: number };
    }
  >;
  /** Overall weighted score (0-100) */
  overallScore: number;
  /** Rank among all COAs (1 = best) */
  rank: number;
  /** Key strengths of this COA */
  strengths: string[];
  /** Key weaknesses of this COA */
  weaknesses: string[];
  /** Associated risks */
  risks: string[];
}

/**
 * Risk assessment with probability and impact
 */
export interface RiskAssessment {
  /** Risk unique identifier */
  riskId: string;
  /** Risk description */
  description: string;
  /** Probability level */
  probability: 'very_likely' | 'likely' | 'possible' | 'unlikely' | 'rare';
  /** Impact level */
  impact: 'catastrophic' | 'critical' | 'marginal' | 'negligible';
  /** Mitigation strategies */
  mitigations: string[];
  /** Residual risk after mitigations */
  residualRisk: string;
  /** Confidence in this assessment (0-1) */
  assessmentConfidence: number;
}

/**
 * Assumption summary entry
 */
export interface AssumptionSummary {
  /** Assumption unique identifier */
  id: string;
  /** Assumption description */
  description: string;
  /** Sensitivity level */
  sensitivity: string;
  /** Current status */
  status: string;
  /** Impact if assumption proves wrong */
  impactIfWrong: string;
}

/**
 * Red team challenge and response
 */
export interface RedTeamSummary {
  /** Challenge question */
  challenge: string;
  /** Staff response */
  response: string;
  /** Response adequacy assessment */
  responseAdequacy: 'adequate' | 'partial' | 'needs_work';
}

/**
 * Staff recommendation section
 */
export interface StaffRecommendation {
  /** Recommended COA ID */
  recommendedCOA: string;
  /** Reasoning for recommendation */
  reasoning: string;
  /** Dissenting views */
  dissent: string[];
  /** Recommendation confidence (0-1) */
  recommendationConfidence: number;
  /** Confidence interval bounds */
  confidenceBounds: { lower: number; upper: number };
}

/**
 * Governance linkage to DAO proposals and gates
 */
export interface GovernanceLinks {
  /** Phase 5 COA comparison proposal ID */
  phase5ComparisonProposalId: number | null;
  /** Phase 6 COA approval gate ID */
  phase6ApprovalGateId: string;
  /** Assumption proposal IDs */
  assumptionProposalIds: number[];
}

/**
 * Complete decision brief for COA Approval gate
 */
export interface DecisionBrief {
  /** Brief metadata */
  missionId: string;
  generatedAt: number;
  currentPhase: string;
  briefVersion: number;

  /** Situation summary */
  situationSummary: string;

  /** Commander's intent restatement */
  commanderIntent: string;

  /** COA comparison matrix */
  coaComparison: COAComparisonEntry[];

  /** Evaluation criteria used */
  evaluationCriteria: Array<{
    name: string;
    weight: number;
    description: string;
  }>;

  /** Risk assessment summary */
  risks: RiskAssessment[];

  /** Active assumptions with sensitivity levels */
  assumptions: AssumptionSummary[];

  /** Red team challenges and responses */
  redTeamSummary: RedTeamSummary[];

  /** Staff recommendation (AI-generated, human decides) */
  staffRecommendation: StaffRecommendation;

  /** Decision required from commander */
  decisionRequired: string;

  /** Overall brief confidence (0-1) per INVARIANT 5 */
  briefConfidence: number;

  /** Links to supporting governance artifacts */
  governanceLinks: GovernanceLinks;
}

/**
 * Evaluation criteria with doctrinal defaults per JP 5-0
 */
export const DEFAULT_EVALUATION_CRITERIA = [
  {
    name: 'suitability',
    weight: 0.3,
    description: 'Does the COA accomplish the mission and achieve the end state?',
  },
  {
    name: 'feasibility',
    weight: 0.25,
    description: 'Can we accomplish the mission with available resources?',
  },
  {
    name: 'acceptability',
    weight: 0.25,
    description: 'Are casualties and risk acceptable for the expected outcome?',
  },
  {
    name: 'distinguishability',
    weight: 0.1,
    description: 'Is this COA sufficiently different from other COAs?',
  },
  {
    name: 'completeness',
    weight: 0.1,
    description: 'Does the COA address all specified and implied tasks?',
  },
];

// ==========================================================================
// Decision Brief Generator
// ==========================================================================

/**
 * Decision Brief Generator
 *
 * Synthesizes COA comparison, risk assessment, assumptions, and red team data
 * into a structured brief for commander decision at Phase 6 COA Approval gate.
 */
export class DecisionBriefGenerator {
  /**
   * Generate a decision brief from planning products.
   *
   * Synthesizes COA comparison, risk assessment, assumptions, and red team data.
   * All AI-generated elements wrapped with uncertainty assessment (INVARIANT 5).
   *
   * @param missionId - Mission unique identifier
   * @param coaData - Array of COA data with details
   * @param evaluationCriteria - Criteria for COA evaluation (defaults to JP 5-0)
   * @param commanderIntent - Commander's intent statement
   * @returns Complete decision brief
   */
  async generateBrief(
    missionId: string,
    coaData: Array<{ coaId: string; coaName: string; coaDetails: unknown }>,
    evaluationCriteria: Array<{ name: string; weight: number; description: string }> = DEFAULT_EVALUATION_CRITERIA,
    commanderIntent: string
  ): Promise<DecisionBrief> {
    // Use default criteria if not provided
    const criteria = evaluationCriteria.length > 0 ? evaluationCriteria : DEFAULT_EVALUATION_CRITERIA;

    // Generate COA comparison entries
    const coaComparison = await this.generateCOAComparison(coaData, criteria);

    // Generate risk assessments
    const risks = await this.generateRiskAssessments(coaData);

    // Generate assumption summary (placeholder - would pull from assumption registry)
    const assumptions = await this.generateAssumptionSummary(missionId);

    // Generate red team summary (placeholder - would pull from red team challenges)
    const redTeamSummary = await this.generateRedTeamSummary(missionId);

    // Generate staff recommendation
    const staffRecommendation = await this.generateStaffRecommendation(coaComparison, risks);

    // Calculate overall brief confidence
    const briefConfidence = this.calculateOverallConfidence(
      coaComparison,
      risks,
      staffRecommendation
    );

    // Governance links (placeholder - would pull from workflow state)
    const governanceLinks: GovernanceLinks = {
      phase5ComparisonProposalId: null,
      phase6ApprovalGateId: 'MDMP-6-01',
      assumptionProposalIds: [],
    };

    const brief: DecisionBrief = {
      missionId,
      generatedAt: Date.now(),
      currentPhase: 'phase_6_coa_approval',
      briefVersion: 1,
      situationSummary: this.generateSituationSummary(coaData),
      commanderIntent,
      coaComparison,
      evaluationCriteria: criteria,
      risks,
      assumptions,
      redTeamSummary,
      staffRecommendation,
      decisionRequired:
        'Commander decision required: Approve one COA for orders production, request staff revision, or reject all COAs and return to Phase 3.',
      briefConfidence,
      governanceLinks,
    };

    return brief;
  }

  /**
   * Update an existing brief with new data.
   *
   * @param existingBrief - Current brief
   * @param updates - Partial updates to apply
   * @returns Updated brief
   */
  async updateBrief(
    existingBrief: DecisionBrief,
    updates: Partial<DecisionBrief>
  ): Promise<DecisionBrief> {
    const updatedBrief: DecisionBrief = {
      ...existingBrief,
      ...updates,
      briefVersion: existingBrief.briefVersion + 1,
      generatedAt: Date.now(),
    };

    // Recalculate overall confidence if relevant fields updated
    if (updates.coaComparison || updates.risks || updates.staffRecommendation) {
      updatedBrief.briefConfidence = this.calculateOverallConfidence(
        updatedBrief.coaComparison,
        updatedBrief.risks,
        updatedBrief.staffRecommendation
      );
    }

    return updatedBrief;
  }

  /**
   * Validate brief completeness before presenting to commander.
   *
   * @param brief - Brief to validate
   * @returns Validation result with missing elements and warnings
   */
  validateBriefCompleteness(brief: DecisionBrief): {
    complete: boolean;
    missingElements: string[];
    warnings: string[];
  } {
    const missingElements: string[] = [];
    const warnings: string[] = [];

    // Check required sections
    if (!brief.situationSummary || brief.situationSummary.trim().length === 0) {
      missingElements.push('Situation summary is missing or empty');
    }

    if (!brief.commanderIntent || brief.commanderIntent.trim().length === 0) {
      missingElements.push("Commander's intent is missing or empty");
    }

    if (brief.coaComparison.length === 0) {
      missingElements.push('No COAs provided for comparison');
    }

    if (brief.coaComparison.length < 3) {
      warnings.push('Fewer than 3 COAs provided (JP 5-0 recommends minimum 3)');
    }

    if (brief.evaluationCriteria.length === 0) {
      missingElements.push('No evaluation criteria defined');
    }

    if (!brief.staffRecommendation || !brief.staffRecommendation.recommendedCOA) {
      missingElements.push('Staff recommendation is missing');
    }

    // Check INVARIANT 5 compliance
    if (brief.briefConfidence === undefined || brief.briefConfidence === null) {
      missingElements.push('Overall brief confidence missing (INVARIANT 5 violation)');
    }

    // Check for confidence intervals in COA comparison
    for (const coa of brief.coaComparison) {
      for (const [criterion, scores] of Object.entries(coa.criteria)) {
        if (!scores.confidenceBounds || scores.confidence === undefined) {
          warnings.push(
            `COA ${coa.coaName} criterion ${criterion} missing confidence intervals (INVARIANT 5)`
          );
        }
      }
    }

    // Check staff recommendation confidence
    if (
      !brief.staffRecommendation.confidenceBounds ||
      brief.staffRecommendation.recommendationConfidence === undefined
    ) {
      warnings.push('Staff recommendation missing confidence intervals (INVARIANT 5)');
    }

    // Warnings for low confidence
    if (brief.briefConfidence < 0.5) {
      warnings.push(
        'Overall brief confidence is low (<0.5). Consider requesting additional analysis.'
      );
    }

    if (brief.staffRecommendation.recommendationConfidence < 0.6) {
      warnings.push(
        'Staff recommendation confidence is low (<0.6). Staff may need more time to analyze COAs.'
      );
    }

    const complete = missingElements.length === 0;

    return { complete, missingElements, warnings };
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Generate COA comparison with scoring per criteria
   */
  private async generateCOAComparison(
    coaData: Array<{ coaId: string; coaName: string; coaDetails: unknown }>,
    criteria: Array<{ name: string; weight: number; description: string }>
  ): Promise<COAComparisonEntry[]> {
    // Stub implementation - would use AI agent to score each COA against criteria
    const coaComparison: COAComparisonEntry[] = coaData.map((coa, index) => {
      const criteriaScores: COAComparisonEntry['criteria'] = {};

      // Generate scores for each criterion (placeholder - would be AI-generated)
      for (const criterion of criteria) {
        // Simulate scoring: random for demonstration
        const baseScore = 60 + Math.random() * 30; // 60-90 range
        const confidence = 0.7 + Math.random() * 0.2; // 0.7-0.9 range
        const margin = (1 - confidence) * 15; // Confidence interval margin

        criteriaScores[criterion.name] = {
          score: Math.round(baseScore),
          rationale: `Assessed ${criterion.name} for ${coa.coaName} based on mission analysis and wargaming results.`,
          confidence,
          confidenceBounds: {
            lower: Math.round(baseScore - margin),
            upper: Math.round(baseScore + margin),
          },
        };
      }

      // Calculate overall weighted score
      let overallScore = 0;
      for (const criterion of criteria) {
        overallScore += criteriaScores[criterion.name].score * criterion.weight;
      }

      return {
        coaId: coa.coaId,
        coaName: coa.coaName,
        criteria: criteriaScores,
        overallScore: Math.round(overallScore),
        rank: 0, // Will be set after all COAs scored
        strengths: [
          `Strong performance in key mission-critical criteria`,
          `Efficient use of available resources`,
        ],
        weaknesses: [`Some risk in execution timeline`, `Resource constraints in sustainment`],
        risks: [`Logistics coordination complexity`, `Weather dependency`],
      };
    });

    // Assign ranks based on overall score (descending)
    coaComparison.sort((a, b) => b.overallScore - a.overallScore);
    coaComparison.forEach((coa, index) => {
      coa.rank = index + 1;
    });

    return coaComparison;
  }

  /**
   * Generate risk assessments from COA data
   */
  private async generateRiskAssessments(
    coaData: Array<{ coaId: string; coaName: string; coaDetails: unknown }>
  ): Promise<RiskAssessment[]> {
    // Stub implementation - would pull from risk assessment framework
    const risks: RiskAssessment[] = [
      {
        riskId: 'RISK-001',
        description: 'Logistics resupply may be delayed due to weather conditions',
        probability: 'possible',
        impact: 'marginal',
        mitigations: [
          'Pre-position supplies at forward locations',
          'Establish alternate resupply routes',
        ],
        residualRisk: 'Low - mitigations reduce likelihood to unlikely',
        assessmentConfidence: 0.75,
      },
      {
        riskId: 'RISK-002',
        description: 'Enemy reinforcements could arrive earlier than anticipated',
        probability: 'likely',
        impact: 'critical',
        mitigations: [
          'Accelerate timeline to seize key terrain before reinforcements',
          'Allocate additional ISR assets for early warning',
        ],
        residualRisk: 'Medium - mitigations reduce impact to marginal',
        assessmentConfidence: 0.65,
      },
    ];

    return risks;
  }

  /**
   * Generate assumption summary
   */
  private async generateAssumptionSummary(missionId: string): Promise<AssumptionSummary[]> {
    // Stub implementation - would query assumption registry
    const assumptions: AssumptionSummary[] = [
      {
        id: 'ASMP-001',
        description: 'Enemy forces will not reinforce within 48 hours',
        sensitivity: 'Critical',
        status: 'Accepted',
        impactIfWrong: 'COA timeline becomes infeasible, requires return to Phase 3',
      },
      {
        id: 'ASMP-002',
        description: 'Host nation support will be available for logistics',
        sensitivity: 'High',
        status: 'Accepted',
        impactIfWrong: 'Increased logistics burden on organic assets',
      },
    ];

    return assumptions;
  }

  /**
   * Generate red team summary
   */
  private async generateRedTeamSummary(missionId: string): Promise<RedTeamSummary[]> {
    // Stub implementation - would query red team challenges from workflow
    const redTeamSummary: RedTeamSummary[] = [
      {
        challenge: 'Have we adequately considered enemy deception operations?',
        response:
          'IPB analysis includes assessment of enemy deception capabilities. Wargaming incorporated deception scenarios.',
        responseAdequacy: 'adequate',
      },
      {
        challenge: 'What second-order effects might coalition partner caveats create?',
        response:
          'Coalition coordination plan addresses national caveats. Some uncertainty remains regarding specific mission execution.',
        responseAdequacy: 'partial',
      },
    ];

    return redTeamSummary;
  }

  /**
   * Generate staff recommendation
   */
  private async generateStaffRecommendation(
    coaComparison: COAComparisonEntry[],
    risks: RiskAssessment[]
  ): Promise<StaffRecommendation> {
    // Staff recommendation is top-ranked COA
    const topCOA = coaComparison[0];

    // Calculate recommendation confidence based on score separation and risk profile
    const scoreSeparation = coaComparison.length > 1 ? topCOA.overallScore - coaComparison[1].overallScore : 20;
    const highRisks = risks.filter((r) => r.impact === 'catastrophic' || r.impact === 'critical').length;

    // Confidence decreases if top COA is close to second, or if high risks present
    let recommendationConfidence = 0.8;
    if (scoreSeparation < 5) recommendationConfidence -= 0.15;
    if (highRisks > 2) recommendationConfidence -= 0.1;

    recommendationConfidence = Math.max(0.5, Math.min(0.95, recommendationConfidence));

    const margin = (1 - recommendationConfidence) * 0.3;

    const recommendation: StaffRecommendation = {
      recommendedCOA: topCOA.coaId,
      reasoning: `${topCOA.coaName} achieves the highest overall score (${topCOA.overallScore}) across all evaluation criteria. Particularly strong in suitability and feasibility. Acceptable risk profile with effective mitigations in place.`,
      dissent: [],
      recommendationConfidence,
      confidenceBounds: {
        lower: Math.round((recommendationConfidence - margin) * 100) / 100,
        upper: Math.round((recommendationConfidence + margin) * 100) / 100,
      },
    };

    // Add dissent if second COA is very close
    if (coaComparison.length > 1 && scoreSeparation < 5) {
      recommendation.dissent.push(
        `Some staff members note ${coaComparison[1].coaName} (score: ${coaComparison[1].overallScore}) is nearly equivalent and may have advantages in execution risk.`
      );
    }

    return recommendation;
  }

  /**
   * Generate situation summary
   */
  private generateSituationSummary(
    coaData: Array<{ coaId: string; coaName: string; coaDetails: unknown }>
  ): string {
    // Stub implementation - would synthesize from mission analysis products
    return `Mission analysis complete. ${coaData.length} COAs developed and analyzed through wargaming. All COAs assessed against doctrinal criteria. Red team challenges addressed. Key planning assumptions accepted by commander. Ready for COA approval decision.`;
  }

  /**
   * Calculate overall brief confidence
   */
  private calculateOverallConfidence(
    coaComparison: COAComparisonEntry[],
    risks: RiskAssessment[],
    staffRecommendation: StaffRecommendation
  ): number {
    // Average confidence across COA criteria
    let totalCriteriaConfidence = 0;
    let criteriaCount = 0;

    for (const coa of coaComparison) {
      for (const scores of Object.values(coa.criteria)) {
        totalCriteriaConfidence += scores.confidence;
        criteriaCount++;
      }
    }

    const avgCriteriaConfidence = criteriaCount > 0 ? totalCriteriaConfidence / criteriaCount : 0.5;

    // Average risk assessment confidence
    const avgRiskConfidence =
      risks.length > 0
        ? risks.reduce((sum, r) => sum + r.assessmentConfidence, 0) / risks.length
        : 0.7;

    // Weighted average: criteria 40%, risks 30%, recommendation 30%
    const overallConfidence =
      avgCriteriaConfidence * 0.4 +
      avgRiskConfidence * 0.3 +
      staffRecommendation.recommendationConfidence * 0.3;

    return Math.round(overallConfidence * 100) / 100;
  }
}

// ==========================================================================
// Export
// ==========================================================================

/**
 * Singleton instance
 */
let generatorInstance: DecisionBriefGenerator | null = null;

/**
 * Get Decision Brief Generator instance
 */
export function getDecisionBriefGenerator(): DecisionBriefGenerator {
  if (!generatorInstance) {
    generatorInstance = new DecisionBriefGenerator();
  }
  return generatorInstance;
}

/**
 * Export class and singleton getter
 */
export default DecisionBriefGenerator;
