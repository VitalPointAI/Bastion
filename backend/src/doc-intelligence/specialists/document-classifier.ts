/**
 * Document Classifier Specialist
 *
 * LLM-driven classification of document type, relevance to problem set scope,
 * and suggested container placement. Extends SpecialistBase for LangGraph node
 * registration and progress reporting.
 *
 * Replaces the keyword-based MidlifeCategorizer approach with LLM-driven
 * classification that uses the full DOCUMENT_TYPES taxonomy from types.ts.
 */

import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createLLMForAgent } from '../../agents/langgraph/llm-factory.js';

import { SpecialistBase, type SpecialistConfig } from '../specialist-base.js';
import { SpecialistId, DocumentType } from '../types.js';
import { DocumentTypeSchema } from '../schemas.js';
import type { ProblemSetContext } from '../schemas.js';
import type { SpecialistResult } from '../types.js';

// ============================================================================
// Output Schema
// ============================================================================

export const DocumentClassifierOutputSchema = z.object({
  documentType: DocumentTypeSchema,
  classificationLevel: z.string(),
  relevanceScore: z.number().min(0).max(1),
  suggestedContainers: z.array(z.string()),
  suggestedActorCategory: z.string(),
  keyTopics: z.array(z.string()),
});

export type DocumentClassifierOutput = z.infer<typeof DocumentClassifierOutputSchema>;

// ============================================================================
// System Prompt
// ============================================================================

const CLASSIFIER_SYSTEM_PROMPT = `You are a military intelligence document classifier. Given the document excerpt and problem set context, classify the document type, assess relevance, and suggest container placement.

Document Type Taxonomy:
- INTEL_ESTIMATE: Intelligence estimates, threat assessments, intelligence summaries
- CONOP: Concept of operations, operational plans, campaign plans
- POLICY_PAPER: Policy documents, white papers, strategy documents, national security memos
- NEWS_ARTICLE: News reports, media coverage, press releases
- ACADEMIC_RESEARCH: Research papers, academic publications, think tank reports
- MILITARY_ORDER: Orders, directives, fragmentary orders, warning orders
- DIPLOMATIC_CABLE: Diplomatic communications, embassy reports, state department cables
- OSINT_REPORT: Open source intelligence reports, social media analysis
- OTHER: Documents not fitting above categories

Container Categories (for perspective analysis routing):
- Friendly: Documents primarily about own forces, allies, coalition capabilities
- Adversary: Documents primarily about opposing forces, threats, enemy capabilities
- Neutral: Documents about non-aligned actors, international organizations
- Partner: Documents about partner nations, cooperation frameworks

Classification Levels:
- UNCLASSIFIED
- CUI (Controlled Unclassified Information)
- CONFIDENTIAL
- SECRET
- TOP SECRET

Relevance Scoring:
Score 0-1 based on overlap with problem set scope:
- Geographic overlap (document discusses regions in scope)
- Temporal relevance (document timeframe matches problem set range)
- Actor relevance (document discusses actors in focus)
- Topical relevance (document addresses core problem or related issues)

Return your classification as JSON.`;

// ============================================================================
// Document Classifier Specialist
// ============================================================================

/**
 * Document Classifier specialist agent.
 *
 * Uses LLM-driven classification to determine document type, assess
 * relevance against the problem set scope, and suggest container
 * placement for perspective analysis routing.
 */
export class DocumentClassifier extends SpecialistBase {
  private _model: BaseChatModel | null;

  constructor(config?: { model?: BaseChatModel }) {
    const specialistConfig: SpecialistConfig = {
      specialistId: SpecialistId.DOCUMENT_CLASSIFIER,
      name: 'Document Classifier',
      description: 'LLM-driven classification of document type, relevance, and container placement',
      systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
      tools: [],
      clearance: 'SECRET',
    };

    super(specialistConfig);

    this._model = config?.model ?? null;
  }

  private async getModel(): Promise<BaseChatModel> {
    if (!this._model) {
      this._model = await createLLMForAgent({
        agentId: 'doc-classifier',
        overrides: { temperature: 0, maxTokens: 2048 },
      });
    }
    return this._model;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Classify a document.
   *
   * @param documentText - Document text (first 3000 chars used)
   * @param problemSetContext - Problem set scope for relevance scoring
   * @param onProgress - Optional progress callback for SSE streaming
   * @returns SpecialistResult with DocumentClassifierOutput
   */
  async classify(
    documentText: string,
    problemSetContext: ProblemSetContext | null,
    onProgress?: (event: { type: string; data: Record<string, unknown> }) => void,
  ): Promise<SpecialistResult> {
    const startTime = Date.now();

    try {
      this.reportProgress('starting', 'Beginning document classification', onProgress);

      const excerpt = documentText.slice(0, 3000);

      // Build context-aware prompt
      const contextInfo = problemSetContext
        ? this.buildContextBlock(problemSetContext)
        : 'No problem set context available. Classify based on document content alone.';

      this.reportProgress('classifying', 'Analyzing document type and relevance', onProgress);

      const messages = [
        new SystemMessage(this.getSystemPrompt(
          problemSetContext ?? this.getDefaultContext(),
        )),
        new HumanMessage(
          `Problem Set Context:\n${contextInfo}\n\nDocument Excerpt (first 3000 chars):\n${excerpt}\n\nReturn your classification as JSON with keys: documentType, classificationLevel, relevanceScore, suggestedContainers, suggestedActorCategory, keyTopics`
        ),
      ];

      const model = await this.getModel();
      const response = await model.invoke(messages);
      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Parse JSON from LLM response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Classifier LLM did not return valid JSON');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate output against Zod schema
      const validation = this.validateOutput(parsed, DocumentClassifierOutputSchema);
      if (!validation.success) {
        // Attempt to coerce common issues
        const coerced = this.coerceOutput(parsed);
        const retryValidation = this.validateOutput(coerced, DocumentClassifierOutputSchema);
        if (!retryValidation.success) {
          throw new Error(`Classifier output validation failed: ${JSON.stringify(retryValidation.error)}`);
        }

        this.reportProgress('complete', `Classified as ${retryValidation.data.documentType} with relevance ${retryValidation.data.relevanceScore}`, onProgress);

        return {
          specialistId: SpecialistId.DOCUMENT_CLASSIFIER,
          status: 'success',
          output: retryValidation.data,
          duration: Date.now() - startTime,
        };
      }

      this.reportProgress('complete', `Classified as ${validation.data.documentType} with relevance ${validation.data.relevanceScore}`, onProgress);

      return {
        specialistId: SpecialistId.DOCUMENT_CLASSIFIER,
        status: 'success',
        output: validation.data,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.reportProgress('error', `Classification failed: ${error instanceof Error ? error.message : 'unknown'}`, onProgress);

      return {
        specialistId: SpecialistId.DOCUMENT_CLASSIFIER,
        status: 'error',
        output: null,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Specialist Base Implementation
  // --------------------------------------------------------------------------

  getSystemPrompt(context: ProblemSetContext): string {
    return `${CLASSIFIER_SYSTEM_PROMPT}

Current Problem Set Scope:
- Geographic regions: ${context.geographicScope.regions.join(', ')}
- Countries of interest: ${context.geographicScope.countries.join(', ')}
- Temporal range: ${context.temporalRange.startDate ?? 'open'} to ${context.temporalRange.endDate ?? 'open'}
- Primary actors: ${context.actorFocus.primaryActors.join(', ')}
- Core problem: ${context.coreProblem}
- Echelon: ${context.echelon}
- Classification ceiling: ${context.classificationCeiling}`;
  }

  // --------------------------------------------------------------------------
  // Internal Methods
  // --------------------------------------------------------------------------

  /**
   * Build a context block string from ProblemSetContext for the LLM prompt.
   */
  private buildContextBlock(context: ProblemSetContext): string {
    const parts: string[] = [];

    parts.push(`Geographic Scope: ${context.geographicScope.regions.join(', ')}`);
    parts.push(`Countries: ${context.geographicScope.countries.join(', ')}`);

    if (context.temporalRange.startDate || context.temporalRange.endDate) {
      parts.push(`Temporal Range: ${context.temporalRange.startDate ?? 'open'} to ${context.temporalRange.endDate ?? 'open'}`);
    }

    parts.push(`Primary Actors: ${context.actorFocus.primaryActors.join(', ')}`);

    if (context.actorFocus.alliances?.length) {
      const allianceStr = context.actorFocus.alliances
        .map(a => `${a.name} (${a.members.join(', ')})`)
        .join('; ');
      parts.push(`Alliances: ${allianceStr}`);
    }

    parts.push(`Core Problem: ${context.coreProblem}`);
    parts.push(`Echelon: ${context.echelon}`);
    parts.push(`Classification Ceiling: ${context.classificationCeiling}`);

    if (context.additionalNuance) {
      parts.push(`Additional Context: ${context.additionalNuance}`);
    }

    return parts.join('\n');
  }

  /**
   * Attempt to coerce LLM output into valid schema format.
   * Handles common LLM output variations (e.g., lowercase document types).
   */
  private coerceOutput(parsed: Record<string, unknown>): Record<string, unknown> {
    const coerced = { ...parsed };

    // Coerce documentType to uppercase enum value
    if (typeof coerced.documentType === 'string') {
      const upper = coerced.documentType.toUpperCase().replace(/\s+/g, '_');
      const validTypes = Object.values(DocumentType);
      if (validTypes.includes(upper as typeof validTypes[number])) {
        coerced.documentType = upper;
      } else {
        coerced.documentType = DocumentType.OTHER;
      }
    }

    // Ensure relevanceScore is a number
    if (typeof coerced.relevanceScore === 'string') {
      coerced.relevanceScore = parseFloat(coerced.relevanceScore as string);
    }

    // Ensure arrays
    if (!Array.isArray(coerced.suggestedContainers)) {
      coerced.suggestedContainers = [];
    }
    if (!Array.isArray(coerced.keyTopics)) {
      coerced.keyTopics = [];
    }

    // Default classification level
    if (!coerced.classificationLevel) {
      coerced.classificationLevel = 'UNCLASSIFIED';
    }

    // Default actor category
    if (!coerced.suggestedActorCategory) {
      coerced.suggestedActorCategory = 'neutral';
    }

    return coerced;
  }

  /**
   * Provide a default ProblemSetContext when none is available.
   * Used to generate a generic system prompt for classification
   * without scope context.
   */
  private getDefaultContext(): ProblemSetContext {
    return {
      problemSetId: 'unknown',
      geographicScope: {
        regions: ['Global'],
        countries: [],
      },
      temporalRange: {},
      actorFocus: {
        primaryActors: [],
      },
      coreProblem: 'General intelligence analysis',
      classificationCeiling: 'UNCLASSIFIED',
      echelon: 'strategic',
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }
}
