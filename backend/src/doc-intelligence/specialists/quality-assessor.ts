/**
 * Quality Assessor Specialist
 *
 * Final quality gate in the document intelligence pipeline. Synthesizes
 * outputs from all previous specialists to produce a NATO Admiralty System
 * rating (STANAG 2511) for the document.
 *
 * Combines:
 * - Trust Agent output (source reliability baseline)
 * - Cross-Document Linker output (corroboration count)
 * - Bias Identifier output (bias severity adjustments)
 * - Internal consistency of extracted facts
 * - Document recency relative to temporal scope
 *
 * The rating is user-overridable: stored with assessedBy='quality-assessor'.
 * A future override API will preserve originalRating and log overriddenBy +
 * overrideReason for full audit trail.
 */

import { SpecialistBase } from '../specialist-base.js';
import type { SpecialistConfig } from '../specialist-base.js';
import { NATORatingSchema } from '../schemas.js';
import type { ProblemSetContext } from '../schemas.js';
import type {
  NATORating,
  SourceReliability,
  InformationCredibility,
} from '../source-registry/nato-ratings.js';
import { isHumanReviewRequired } from '../source-registry/nato-ratings.js';
import { SpecialistId } from '../types.js';
import type {
  ExtractedFact,
  BiasAssessment,
  CrossDocLink,
  BiasSeverity,
} from '../types.js';
import type { BastionState } from '../../orchestration/state.js';
import { getPool } from '../../lib/database.js';

// ============================================================================
// Types
// ============================================================================

export interface QualityAssessorInput {
  /** Document ID for updating NATO rating columns */
  documentId: string;
  /** Problem set context */
  problemSetContext: ProblemSetContext;
  /** Extracted facts from the Fact Extractor */
  facts: ExtractedFact[];
  /** Bias findings from the Bias Identifier */
  biasFindings: BiasAssessment[];
  /** Cross-document links from the Cross-Doc Linker */
  crossDocLinks: CrossDocLink[];
  /** Trust assessment from the Trust Agent */
  trustAssessment: {
    sourceReliability: SourceReliability;
    reasoning: string;
  };
  /** Document text for internal consistency check */
  documentText: string;
  /** Optional: progress callback */
  onProgress?: (stage: string, detail: string) => void;
}

export interface QualityAssessorOutput {
  natoRating: NATORating;
  requiresHumanReview: boolean;
  qualityFactors: {
    sourceReliabilityBasis: string;
    corroborationFactor: string;
    biasFactor: string;
    consistencyFactor: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Credibility adjustments based on corroboration count.
 * More corroboration = higher credibility.
 */
const CORROBORATION_BOOST: Record<number, number> = {
  0: 0,   // No corroboration: no adjustment
  1: -1,  // 1 corroborating source: improve by 1 level
  2: -1,  // 2 sources: improve by 1
  3: -2,  // 3+ sources: improve by 2
};

/**
 * Credibility penalty based on highest bias severity found.
 */
const BIAS_PENALTY: Record<BiasSeverity, number> = {
  low: 0,
  medium: 0,
  high: 1,
  critical: 2,
};

// ============================================================================
// Quality Assessor Specialist
// ============================================================================

/**
 * Final quality gate that synthesizes all specialist outputs into a
 * NATO Admiralty System rating (STANAG 2511).
 */
export class QualityAssessor extends SpecialistBase {
  constructor() {
    const config: SpecialistConfig = {
      specialistId: SpecialistId.QUALITY_ASSESSOR,
      name: 'Quality Assessor',
      description:
        'Synthesizes all specialist outputs into a NATO Admiralty System ' +
        'rating. Assesses source reliability and information credibility ' +
        'per STANAG 2511.',
      systemPrompt: '', // Overridden by getSystemPrompt()
      tools: [],
      clearance: 'UNCLASS',
    };
    super(config);
  }

  // --------------------------------------------------------------------------
  // System Prompt
  // --------------------------------------------------------------------------

  getSystemPrompt(context: ProblemSetContext): string {
    return [
      'You are a quality assessment specialist applying NATO Admiralty System standards.',
      'Evaluate the overall quality of intelligence derived from a document.',
      '',
      `Problem context: ${context.coreProblem}`,
      `Geographic scope: ${context.geographicScope.regions.join(', ')}`,
      '',
      'Your assessment must follow STANAG 2511 / AJP-2.1 Edition B exactly.',
      'Source reliability (A-F) reflects the SOURCE, not the information.',
      'Information credibility (1-6) reflects the INFORMATION, not the source.',
      '',
      'These are independent dimensions -- a reliable source can report',
      'unconfirmed information, and an unreliable source can report confirmed facts.',
    ].join('\n');
  }

  // --------------------------------------------------------------------------
  // Core Assessment
  // --------------------------------------------------------------------------

  /**
   * Produce a NATO quality rating for the document.
   */
  async assess(input: QualityAssessorInput): Promise<QualityAssessorOutput> {
    const {
      documentId,
      problemSetContext,
      facts,
      biasFindings,
      crossDocLinks,
      trustAssessment,
      onProgress,
    } = input;

    this.setProblemSetContext(problemSetContext);

    // Step 1: Source reliability from Trust Agent
    this.reportProgress(
      'reliability',
      'Assessing source reliability',
      onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
    );

    const sourceReliability = trustAssessment.sourceReliability;
    const sourceReliabilityBasis = `Trust Agent assessed source as ${sourceReliability}: ${trustAssessment.reasoning}`;

    // Step 2: Base credibility from cross-document corroboration
    this.reportProgress(
      'credibility',
      'Assessing information credibility',
      onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
    );

    const corroborations = crossDocLinks.filter((l) => l.linkType === 'corroborates');
    const contradictions = crossDocLinks.filter((l) => l.linkType === 'contradicts');

    // Start with base credibility of 3 (Possibly True) and adjust
    let credibilityScore = 3;

    // Corroboration boost
    const corroborationCount = Math.min(corroborations.length, 3);
    const corroborationAdjustment = CORROBORATION_BOOST[corroborationCount] ?? -2;
    credibilityScore += corroborationAdjustment;

    const corroborationFactor = corroborations.length > 0
      ? `${corroborations.length} corroborating source(s) found: credibility improved by ${Math.abs(corroborationAdjustment)} level(s)`
      : 'No corroboration from other sources';

    // Contradiction penalty
    if (contradictions.length > 0) {
      credibilityScore += 1; // Worsen by 1 level for any contradictions
    }

    // Step 3: Bias severity adjustment
    const highestBiasSeverity = this.getHighestBiasSeverity(biasFindings);
    const biasPenalty = BIAS_PENALTY[highestBiasSeverity];
    credibilityScore += biasPenalty;

    const biasFactor = biasFindings.length > 0
      ? `${biasFindings.length} bias finding(s), highest severity: ${highestBiasSeverity}` +
        (biasPenalty > 0 ? ` (credibility penalized by ${biasPenalty})` : '')
      : 'No significant biases detected';

    // Step 4: Internal consistency check
    const consistencyScore = this.assessInternalConsistency(facts);
    if (consistencyScore < 0.5) {
      credibilityScore += 1; // Worsen for low consistency
    }

    const consistencyFactor = `Internal consistency: ${(consistencyScore * 100).toFixed(0)}%` +
      (consistencyScore < 0.5 ? ' (low consistency penalized credibility)' : '');

    // Clamp credibility to valid range [1, 6]
    credibilityScore = Math.max(1, Math.min(6, credibilityScore)) as InformationCredibility;

    // Build reasoning
    const reasoning = [
      `Source reliability: ${sourceReliability} - ${sourceReliabilityBasis}`,
      `Information credibility: ${credibilityScore}`,
      corroborationFactor,
      biasFactor,
      consistencyFactor,
      contradictions.length > 0
        ? `WARNING: ${contradictions.length} contradiction(s) found with other documents`
        : '',
    ]
      .filter(Boolean)
      .join('. ');

    // Build NATO rating
    const natoRating: NATORating = {
      sourceReliability,
      informationCredibility: credibilityScore,
      assessedBy: 'quality-assessor',
      assessedAt: new Date().toISOString(),
      reasoning,
    };

    // Validate against schema
    const validation = this.validateOutput(natoRating, NATORatingSchema);
    const validatedRating = validation.success ? validation.data : natoRating;

    // Step 5: Update strategic_documents with NATO rating columns
    await this.updateDocumentRating(documentId, validatedRating);

    const requiresHumanReview = isHumanReviewRequired(validatedRating);

    this.reportProgress(
      'complete',
      `Quality assessment complete: ${sourceReliability}/${credibilityScore}` +
        (requiresHumanReview ? ' (human review required)' : ''),
      onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
    );

    return {
      natoRating: validatedRating,
      requiresHumanReview,
      qualityFactors: {
        sourceReliabilityBasis,
        corroborationFactor,
        biasFactor,
        consistencyFactor,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Internal Consistency
  // --------------------------------------------------------------------------

  /**
   * Assess internal consistency of extracted facts.
   * Returns 0-1 score (1 = fully consistent).
   */
  private assessInternalConsistency(facts: ExtractedFact[]): number {
    if (facts.length === 0) return 1.0;

    // Check for self-contradictions: facts with low confidence vs high confidence
    // about the same entities
    const entityClaims = new Map<string, ExtractedFact[]>();
    for (const fact of facts) {
      for (const entity of fact.entities) {
        const key = entity.toLowerCase();
        const existing = entityClaims.get(key) ?? [];
        existing.push(fact);
        entityClaims.set(key, existing);
      }
    }

    let consistentPairs = 0;
    let totalPairs = 0;

    for (const [, claims] of entityClaims) {
      if (claims.length < 2) continue;

      for (let i = 0; i < claims.length; i++) {
        for (let j = i + 1; j < claims.length; j++) {
          totalPairs++;
          // If both facts about the same entity have similar confidence,
          // they are likely consistent
          const confidenceDiff = Math.abs(claims[i].confidence - claims[j].confidence);
          if (confidenceDiff < 0.5) {
            consistentPairs++;
          }
        }
      }
    }

    if (totalPairs === 0) return 1.0;
    return consistentPairs / totalPairs;
  }

  // --------------------------------------------------------------------------
  // Bias Severity
  // --------------------------------------------------------------------------

  /**
   * Get the highest bias severity from findings.
   */
  private getHighestBiasSeverity(findings: BiasAssessment[]): BiasSeverity {
    if (findings.length === 0) return 'low';

    const severityOrder: BiasSeverity[] = ['low', 'medium', 'high', 'critical'];
    let highest: BiasSeverity = 'low';

    for (const finding of findings) {
      const currentIndex = severityOrder.indexOf(finding.severity);
      const highestIndex = severityOrder.indexOf(highest);
      if (currentIndex > highestIndex) {
        highest = finding.severity;
      }
    }

    return highest;
  }

  // --------------------------------------------------------------------------
  // Database Updates
  // --------------------------------------------------------------------------

  /**
   * Update strategic_documents with NATO rating columns.
   */
  private async updateDocumentRating(
    documentId: string,
    rating: NATORating,
  ): Promise<void> {
    try {
      const pool = getPool();
      await pool.query(
        `UPDATE strategic_documents
         SET nato_reliability = $1,
             nato_credibility = $2,
             quality_assessed_by = $3,
             quality_assessed_at = $4
         WHERE id = $5`,
        [
          rating.sourceReliability,
          rating.informationCredibility,
          rating.assessedBy,
          rating.assessedAt,
          documentId,
        ],
      );
    } catch (error) {
      console.error('[quality-assessor] Failed to update document rating:', error);
    }
  }

  // --------------------------------------------------------------------------
  // LangGraph Node
  // --------------------------------------------------------------------------

  override createNode(): (state: BastionState) => Promise<Partial<BastionState>> {
    return async (state: BastionState): Promise<Partial<BastionState>> => {
      const baseNode = this.wrapper.createNode();
      return baseNode(state);
    };
  }
}
