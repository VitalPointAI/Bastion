/**
 * Trust Agent Specialist
 *
 * Evaluates information sources at the SOURCE level (not per-entity)
 * using NATO standards. Maintains the source registry, blocks untrusted
 * sources, and flags questionable sources for human review.
 *
 * Key design decision (from RESEARCH.md Pitfall 4): Trust evaluation
 * happens at the source level. Entities from flagged sources do NOT
 * auto-ingest into the knowledge graph.
 *
 * Flow:
 * 1. Check source_registry for known source
 * 2. If blocked -> immediately flag, stop processing
 * 3. If known -> use default_reliability
 * 4. If unknown -> LLM assessment of source type/reputation
 * 5. Apply NATO rating threshold -> trusted/pending/flagged
 * 6. Flag D/E/F reliability or 4/5/6 credibility for human review
 */

import { z } from 'zod';
import { SpecialistBase } from '../specialist-base.js';
import type { SpecialistConfig } from '../specialist-base.js';
import type { ProblemSetContext } from '../schemas.js';
import { NATORatingSchema } from '../schemas.js';
import type { NATORating } from '../source-registry/nato-ratings.js';
import { isHumanReviewRequired } from '../source-registry/nato-ratings.js';
import type { SourceReliability } from '../source-registry/nato-ratings.js';
import { SpecialistId } from '../types.js';
import type { BastionState } from '../../orchestration/state.js';
import { sourceStore } from '../source-registry/source-store.js';
import type { DocumentTrustStatus } from '../source-registry/source-store.js';
import { createLLMForAgent } from '../../agents/langgraph/llm-factory.js';

// ============================================================================
// Types
// ============================================================================

export interface TrustAgentInput {
  /** Document ID for trust status tracking */
  documentId: string;
  /** Source name (publication, organization, author) */
  sourceName: string;
  /** Source type (news_agency, government, academic, etc.) */
  sourceType: string;
  /** Optional: origin URL */
  originUrl?: string;
  /** Optional: publication date */
  publicationDate?: string;
  /** Problem set context for scoped evaluation */
  problemSetContext: ProblemSetContext;
  /** Optional: progress callback */
  onProgress?: (stage: string, detail: string) => void;
}

export interface TrustAgentOutput {
  trustStatus: DocumentTrustStatus;
  natoRating: NATORating;
  requiresHumanReview: boolean;
  reasoning: string;
  sourceIsNew: boolean;
  sourceIsBlocked: boolean;
}

/** Schema for LLM source assessment response */
const SourceAssessmentSchema = z.object({
  sourceReliability: z.enum(['A', 'B', 'C', 'D', 'E', 'F']),
  informationCredibility: z.number().int().min(1).max(6),
  reasoning: z.string(),
});

// ============================================================================
// Trust Agent Specialist
// ============================================================================

/**
 * Evaluates source reliability at the source level using NATO standards.
 * Maintains source registry, blocks untrusted sources, and flags
 * questionable sources for human review.
 */
export class TrustAgent extends SpecialistBase {
  constructor() {
    const config: SpecialistConfig = {
      specialistId: SpecialistId.TRUST_AGENT,
      name: 'Trust Agent',
      description:
        'Evaluates information source reliability using NATO standards. ' +
        'Maintains source registry, blocks untrusted sources, and flags ' +
        'questionable sources for human review.',
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
      'You are an intelligence source evaluation specialist.',
      'Assess the reliability of this information source using NATO standards.',
      '',
      'Consider:',
      '- Publication type and editorial standards',
      '- Known track record and history of accuracy',
      '- Potential biases (state-affiliated, partisan, commercial interests)',
      '- Geographic origin relative to the operational area',
      '- Relationship to actors in the problem set',
      '- Timeliness and currency of information',
      '',
      `Problem context: ${context.coreProblem}`,
      `Geographic scope: ${context.geographicScope.regions.join(', ')}`,
      `Primary actors: ${context.actorFocus.primaryActors.join(', ')}`,
      '',
      'NATO Source Reliability (A-F):',
      '  A = Completely Reliable (verified government/military sources)',
      '  B = Usually Reliable (major news agencies, reputable journals)',
      '  C = Fairly Reliable (known but unverified sources)',
      '  D = Not Usually Reliable (sources with known accuracy issues)',
      '  E = Unreliable (propaganda outlets, known disinformation sources)',
      '  F = Reliability Cannot Be Judged (new/unknown sources)',
      '',
      'NATO Information Credibility (1-6):',
      '  1 = Confirmed by Other Sources',
      '  2 = Probably True (consistent with known facts)',
      '  3 = Possibly True (consistent but not confirmed)',
      '  4 = Doubtfully True (possible but not consistent)',
      '  5 = Improbable (contradicts known facts)',
      '  6 = Truth Cannot Be Judged (insufficient basis)',
      '',
      'Respond with ONLY valid JSON:',
      '{ "sourceReliability": "A-F", "informationCredibility": 1-6, "reasoning": "..." }',
    ].join('\n');
  }

  // --------------------------------------------------------------------------
  // Core Evaluation
  // --------------------------------------------------------------------------

  /**
   * Evaluate a source and determine trust status.
   */
  async evaluate(input: TrustAgentInput): Promise<TrustAgentOutput> {
    const {
      documentId,
      sourceName,
      sourceType,
      originUrl,
      publicationDate,
      problemSetContext,
      onProgress,
    } = input;

    this.setProblemSetContext(problemSetContext);

    // Step 1: Check source registry for known source
    this.reportProgress(
      'registry-check',
      `Checking source registry for "${sourceName}"`,
      onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
    );

    const existingSource = await sourceStore.getSourceByName(sourceName);

    // Step 2: If blocked, immediately flag and stop
    if (existingSource?.isBlocked) {
      this.reportProgress(
        'blocked',
        `Source "${sourceName}" is on the blocklist`,
        onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
      );

      const blockedRating: NATORating = {
        sourceReliability: 'E',
        informationCredibility: 5,
        assessedBy: 'trust-agent',
        assessedAt: new Date().toISOString(),
        reasoning: `Source "${sourceName}" is blocked in the source registry. ` +
          `Trust notes: ${existingSource.trustNotes ?? 'No notes available.'}`,
      };

      await sourceStore.updateDocumentTrustStatus(documentId, 'flagged', 'trust-agent');

      return {
        trustStatus: 'flagged',
        natoRating: blockedRating,
        requiresHumanReview: true,
        reasoning: blockedRating.reasoning,
        sourceIsNew: false,
        sourceIsBlocked: true,
      };
    }

    // Step 3: For known sources, use default reliability; for unknown, assess via LLM
    let reliability: SourceReliability;
    let credibility: number;
    let reasoning: string;
    let sourceIsNew = false;

    if (existingSource?.defaultReliability) {
      this.reportProgress(
        'known-source',
        `Using known reliability ${existingSource.defaultReliability} for "${sourceName}"`,
        onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
      );

      reliability = existingSource.defaultReliability;
      // For known sources, default credibility to 3 (Possibly True) unless LLM says otherwise
      const llmAssessment = await this.assessWithLLM(
        sourceName,
        sourceType,
        originUrl,
        publicationDate,
        problemSetContext,
      );
      credibility = llmAssessment?.informationCredibility ?? 3;
      reasoning = llmAssessment?.reasoning ??
        `Known source with default reliability ${reliability}. ` +
        `${existingSource.trustNotes ?? ''}`;
    } else {
      // Unknown source -- full LLM assessment
      this.reportProgress(
        'assessing',
        `Assessing unknown source "${sourceName}" via LLM`,
        onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
      );

      sourceIsNew = !existingSource;

      const llmAssessment = await this.assessWithLLM(
        sourceName,
        sourceType,
        originUrl,
        publicationDate,
        problemSetContext,
      );

      if (llmAssessment) {
        reliability = llmAssessment.sourceReliability as SourceReliability;
        credibility = llmAssessment.informationCredibility;
        reasoning = llmAssessment.reasoning;
      } else {
        // LLM failed -- default to F/6 (cannot be judged)
        reliability = 'F';
        credibility = 6;
        reasoning = `Unable to assess source "${sourceName}" -- LLM evaluation failed. ` +
          'Defaulting to F/6 (cannot be judged).';
      }

      // Step 5: Create entry in source_registry for new sources
      if (sourceIsNew) {
        await sourceStore.upsertSource({
          sourceName,
          sourceType,
          defaultReliability: reliability,
          trustNotes: `Auto-assessed by trust-agent: ${reasoning.substring(0, 500)}`,
        });
      }
    }

    // Step 4: Build NATO rating and determine trust status
    const natoRating: NATORating = {
      sourceReliability: reliability,
      informationCredibility: credibility,
      assessedBy: 'trust-agent',
      assessedAt: new Date().toISOString(),
      reasoning,
    };

    const requiresHumanReview = isHumanReviewRequired(natoRating);

    let trustStatus: DocumentTrustStatus;
    if (requiresHumanReview) {
      trustStatus = 'flagged';
    } else {
      trustStatus = 'trusted';
    }

    // Update document trust status
    await sourceStore.updateDocumentTrustStatus(documentId, trustStatus, 'trust-agent');

    this.reportProgress(
      'complete',
      `Source "${sourceName}": ${reliability}/${credibility} -> ${trustStatus}` +
        (requiresHumanReview ? ' (human review required)' : ''),
      onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
    );

    return {
      trustStatus,
      natoRating,
      requiresHumanReview,
      reasoning,
      sourceIsNew,
      sourceIsBlocked: false,
    };
  }

  // --------------------------------------------------------------------------
  // LLM Assessment
  // --------------------------------------------------------------------------

  /**
   * Use LLM to assess an unknown source's reliability and credibility.
   */
  private async assessWithLLM(
    sourceName: string,
    sourceType: string,
    originUrl: string | undefined,
    publicationDate: string | undefined,
    context: ProblemSetContext,
  ): Promise<{ sourceReliability: string; informationCredibility: number; reasoning: string } | null> {
    try {
      const llm = await createLLMForAgent({ agentId: `doc-${this.specialistId}` });
      const systemPrompt = this.getSystemPrompt(context);

      const userMessage = [
        `Assess this information source:`,
        `- Source name: ${sourceName}`,
        `- Source type: ${sourceType}`,
        originUrl ? `- Origin URL: ${originUrl}` : '',
        publicationDate ? `- Publication date: ${publicationDate}` : '',
        '',
        'Provide a NATO reliability rating (A-F) and credibility rating (1-6).',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await llm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ]);

      const parsed = this.parseJsonResponse(response.content);
      if (!parsed) return null;

      const result = SourceAssessmentSchema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }

      console.warn('[trust-agent] LLM assessment validation failed:', result.error);
      return null;
    } catch (error) {
      console.error('[trust-agent] LLM assessment error:', error);
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // JSON Parsing
  // --------------------------------------------------------------------------

  /**
   * Parse JSON from LLM response, handling markdown code blocks.
   */
  private parseJsonResponse(content: unknown): unknown {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      // Try extraction
    }

    const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {
        // Fall through
      }
    }

    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Fall through
      }
    }

    console.error('[trust-agent] Failed to parse JSON from LLM response:', cleaned.substring(0, 200));
    return null;
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
