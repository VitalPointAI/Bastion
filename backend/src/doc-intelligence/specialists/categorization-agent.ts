/**
 * Categorization Agent Specialist
 *
 * Enriches extracted objectives with DIME/MIDLIFE theme categories and tags
 * documents with actor/container associations. Runs AFTER fact-extractor and
 * objective-extractor in the doc-intelligence pipeline.
 *
 * DIME categories: Diplomatic, Information, Military, Economic
 * MIDLIFE subcategories: Military, Infrastructure, Diplomatic, Legal, Intelligence, Financial, Economic
 *
 * This is enrichment-only — failures do not block the pipeline.
 */

import { z } from 'zod';
import { SpecialistBase } from '../specialist-base.js';
import type { SpecialistConfig } from '../specialist-base.js';
import type { ProblemSetContext } from '../schemas.js';
import { createLLMForAgent } from '../../agents/langgraph/llm-factory.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getPool } from '../../lib/database.js';

// ============================================================================
// Constants
// ============================================================================

/** DIME primary categories */
export const DIME_CATEGORIES = ['DIPLOMATIC', 'INFORMATION', 'MILITARY', 'ECONOMIC'] as const;
export type DimeCategory = (typeof DIME_CATEGORIES)[number];

/**
 * MIDLIFE subcategories (extended DIME framework used in BASTION).
 * Superset of DIME with Infrastructure, Legal, and Intelligence added.
 */
export const MIDLIFE_CATEGORIES = [
  'MILITARY',
  'INFRASTRUCTURE',
  'DIPLOMATIC',
  'LEGAL',
  'INTELLIGENCE',
  'FINANCIAL',
  'ECONOMIC',
] as const;
export type MidlifeCategory = (typeof MIDLIFE_CATEGORIES)[number];

// ============================================================================
// Schemas
// ============================================================================

const ObjectiveCategorizationSchema = z.object({
  objectiveId: z.string(),
  primaryDime: z.enum(DIME_CATEGORIES),
  midlifeCategories: z.array(z.enum(MIDLIFE_CATEGORIES)),
  rationale: z.string(),
});

const CategorizationResponseSchema = z.object({
  objectives: z.array(ObjectiveCategorizationSchema),
  documentActorAssociations: z.array(z.string()).describe('List of actor/container names this document primarily relates to'),
});

type CategorizationResponse = z.infer<typeof CategorizationResponseSchema>;

// ============================================================================
// Types
// ============================================================================

export interface CategorizationAgentInput {
  /** Source document ID */
  documentId: string;
  /** Document text (subset for context) */
  documentText: string;
  /** Problem set context for scoped analysis */
  problemSetContext: ProblemSetContext;
  /** Previously extracted objectives (from objective-extractor output in state) */
  extractedObjectives?: Array<{
    id: string;
    description: string;
    dimeCategory?: string;
    midlifeCategory?: string;
  }>;
  /** Previously extracted entity names (from fact-extractor output) */
  extractedEntityNames?: string[];
  /** Optional progress callback for SSE streaming */
  onProgress?: (stage: string, detail: string) => void;
}

export interface CategorizationAgentOutput {
  /** Updated objective categorizations */
  categorizations: Array<{
    objectiveId: string;
    primaryDime: DimeCategory;
    midlifeCategories: MidlifeCategory[];
    rationale: string;
  }>;
  /** Actor/container names this document primarily relates to */
  documentActorAssociations: string[];
  /** Number of objectives updated in DB */
  objectivesUpdated: number;
  /** Whether this ran successfully */
  succeeded: boolean;
}

// ============================================================================
// Categorization Agent Specialist
// ============================================================================

export class CategorizationAgent extends SpecialistBase {
  private _model: BaseChatModel | null = null;

  constructor() {
    const config: SpecialistConfig = {
      specialistId: 'categorization-agent' as any, // eslint-disable-line
      name: 'Categorization Agent',
      description:
        'Assigns DIME/MIDLIFE theme categories to extracted objectives and tags ' +
        'documents with actor/container associations for DIME clustering mode.',
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
    return `You are a strategic intelligence analyst specializing in DIME/MIDLIFE framework categorization.

Problem set context:
- Core problem: ${context.coreProblem}
- Geographic scope: ${context.geographicScope.regions.join(', ')} (${context.geographicScope.countries.join(', ')})
- Primary actors: ${context.actorFocus.primaryActors.join(', ')}
- Echelon: ${context.echelon}

DIME Primary Categories:
- DIPLOMATIC: Engagements, negotiations, alliances, sanctions, formal agreements
- INFORMATION: Messaging, propaganda, intelligence operations, cyber information
- MILITARY: Force deployment, combat operations, military exercises, weapons
- ECONOMIC: Trade, finance, sanctions, investment, infrastructure development

MIDLIFE Extended Subcategories:
- MILITARY: Direct military force
- INFRASTRUCTURE: Physical infrastructure (ports, railways, energy, communications)
- DIPLOMATIC: Formal diplomatic actions
- LEGAL: Laws, treaties, international law, jurisdiction
- INTELLIGENCE: Collection, covert operations, surveillance
- FINANCIAL: Currency, banking, financial instruments
- ECONOMIC: Trade, commerce, resources, sanctions

For each objective, assign the primary DIME category and any relevant MIDLIFE subcategories.
Also identify which actors/containers from the problem set this document primarily relates to.

Respond with ONLY valid JSON.`;
  }

  // --------------------------------------------------------------------------
  // LLM Access
  // --------------------------------------------------------------------------

  private async getModel(): Promise<BaseChatModel> {
    if (!this._model) {
      this._model = await createLLMForAgent({
        agentId: 'doc-categorization-agent',
        overrides: { temperature: 0, maxTokens: 4096 },
      });
    }
    return this._model;
  }

  // --------------------------------------------------------------------------
  // Core Categorization
  // --------------------------------------------------------------------------

  /**
   * Categorize extracted objectives with DIME/MIDLIFE themes and identify
   * actor/container associations for the document.
   *
   * Failures are non-blocking — log and return empty result.
   */
  async categorize(input: CategorizationAgentInput): Promise<CategorizationAgentOutput> {
    const {
      documentId,
      documentText,
      problemSetContext,
      extractedObjectives = [],
      extractedEntityNames = [],
      onProgress,
    } = input;

    this.setProblemSetContext(problemSetContext);

    const empty: CategorizationAgentOutput = {
      categorizations: [],
      documentActorAssociations: [],
      objectivesUpdated: 0,
      succeeded: false,
    };

    // Skip if nothing to categorize
    if (extractedObjectives.length === 0) {
      console.log(`[categorization-agent] No objectives to categorize for document ${documentId}`);
      return { ...empty, succeeded: true };
    }

    try {
      this.reportProgress(
        'categorizing',
        `Assigning DIME/MIDLIFE categories to ${extractedObjectives.length} objectives`,
        onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
      );

      const categorizations = await this.runLLMCategorization(
        documentText,
        extractedObjectives,
        extractedEntityNames,
        problemSetContext,
      );

      // Persist category updates to the DB
      const objectivesUpdated = await this.persistCategorizations(categorizations.objectives);

      this.reportProgress(
        'complete',
        `Categorized ${categorizations.objectives.length} objectives, updated ${objectivesUpdated} DB records`,
        onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
      );

      return {
        categorizations: categorizations.objectives,
        documentActorAssociations: categorizations.documentActorAssociations,
        objectivesUpdated,
        succeeded: true,
      };
    } catch (err) {
      // Non-blocking: log warning and continue pipeline
      console.warn(
        `[categorization-agent] Categorization failed for document ${documentId} (non-blocking):`,
        err instanceof Error ? err.message : String(err),
      );
      return empty;
    }
  }

  // --------------------------------------------------------------------------
  // LLM Categorization
  // --------------------------------------------------------------------------

  private async runLLMCategorization(
    documentText: string,
    objectives: CategorizationAgentInput['extractedObjectives'] = [],
    entityNames: string[],
    context: ProblemSetContext,
  ): Promise<CategorizationResponse> {
    const systemPrompt = this.getSystemPrompt(context);

    // Build a compact prompt — include objective IDs and descriptions
    const objectiveList = objectives
      .map((o) => `- ID: ${o.id}\n  Description: ${o.description}`)
      .join('\n');

    const entityContext = entityNames.length > 0
      ? `\nMentioned entities: ${entityNames.slice(0, 30).join(', ')}`
      : '';

    const documentPreview = documentText.slice(0, 1500);

    const userMessage = `Document context (first 1500 chars):\n${documentPreview}${entityContext}

Objectives to categorize:
${objectiveList}

Primary actors in problem set: ${context.actorFocus.primaryActors.join(', ')}

Respond with JSON:
{
  "objectives": [
    { "objectiveId": "...", "primaryDime": "MILITARY|DIPLOMATIC|INFORMATION|ECONOMIC", "midlifeCategories": ["..."], "rationale": "..." }
  ],
  "documentActorAssociations": ["actor1", "actor2"]
}`;

    const model = await this.getModel();
    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage),
    ]);

    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Categorization LLM did not return valid JSON');
    }

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    const validated = CategorizationResponseSchema.parse(parsed);
    return validated;
  }

  // --------------------------------------------------------------------------
  // DB Persistence
  // --------------------------------------------------------------------------

  /**
   * Persist DIME/MIDLIFE categorizations back to the strategic_objectives table.
   * Uses ON CONFLICT DO UPDATE to safely update existing records.
   */
  private async persistCategorizations(
    categorizations: CategorizationResponse['objectives'],
  ): Promise<number> {
    if (categorizations.length === 0) return 0;

    const pool = getPool();
    let updated = 0;

    for (const cat of categorizations) {
      try {
        const result = await pool.query(
          `UPDATE strategic_objectives
           SET dime_category = $1,
               midlife_category = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [
            cat.primaryDime,
            cat.midlifeCategories[0] ?? cat.primaryDime, // primary midlife category
            cat.objectiveId,
          ],
        );
        if ((result.rowCount ?? 0) > 0) updated++;
      } catch (err) {
        // Individual update failure should not abort batch
        console.warn(
          `[categorization-agent] Failed to persist categorization for objective ${cat.objectiveId}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return updated;
  }
}
