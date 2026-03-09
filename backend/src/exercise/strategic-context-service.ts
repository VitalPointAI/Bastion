/**
 * Strategic Context Service
 *
 * Phase 25.3 Plan 04: Orchestrates cached documents and live graph summaries
 * into a token-budgeted context bundle for AI agents. Connects the cache
 * materializer (Plan 01) and graph summary service (Plan 03) into a single
 * context assembly flow.
 *
 * Priority order: graph summaries > extracted_data > truncated text_content.
 * All errors degrade gracefully -- never crashes the AI pipeline.
 */

import { getPool } from '../lib/database.js';
import type { ProblemSetSubscriptionStore, CachedDoc } from '../problem-set/problem-set-subscription-store.js';
import type { ContainerStore } from '../strategic/containers/store.js';
import type { GraphSummaryService, GraphSummary } from './graph-summary-service.js';
import { listDocuments } from '../strategic/ingestion/document-store.js';
import { ObjectiveStore } from '../strategic/objectives/store.js';

// =============================================================================
// Interfaces
// =============================================================================

export interface StrategicEnvironmentContext {
  graphSummaries: Record<string, GraphSummary>; // keyed by container name
  documentSummaries: Array<{
    title: string;
    docType: string;
    extractedData?: unknown;
    textContent?: string;
  }>;
  tokensUsed: number;
  tokenBudget: number;
}

// =============================================================================
// Constants
// =============================================================================

const TOKEN_BUDGET = 8000;

/** Approximate token estimation: ~4 chars per token */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// =============================================================================
// StrategicContextService
// =============================================================================

export class StrategicContextService {
  constructor(
    private subscriptionStore: ProblemSetSubscriptionStore,
    private containerStore: ContainerStore,
    private graphSummaryService: GraphSummaryService,
  ) {}

  /**
   * Assemble a token-budgeted strategic context bundle for a problem set.
   * Orchestrates cached docs + live graph summaries into a single context.
   *
   * Priority order:
   *   1. Graph summaries (highest priority)
   *   2. Extracted data from cached documents
   *   3. Truncated text content from cached documents
   *
   * @param problemSetId - The problem set to assemble context for
   * @param scenarioPhase - Optional current scenario phase for temporal boosting
   * @returns StrategicEnvironmentContext with token usage tracking
   */
  async assembleContext(
    problemSetId: string,
    scenarioPhase?: string,
  ): Promise<StrategicEnvironmentContext> {
    const emptyContext: StrategicEnvironmentContext = {
      graphSummaries: {},
      documentSummaries: [],
      tokensUsed: 0,
      tokenBudget: TOKEN_BUDGET,
    };

    try {
      let tokensUsed = 0;
      const graphSummaries: Record<string, GraphSummary> = {};
      const documentSummaries: Array<{
        title: string;
        docType: string;
        extractedData?: unknown;
        textContent?: string;
      }> = [];

      // -----------------------------------------------------------------------
      // Step A: Get containers for this problem set (read-only, no auto-create)
      // -----------------------------------------------------------------------
      const pool = getPool();
      const mappingResult = await pool.query(
        `SELECT environment_id FROM problem_set_environments WHERE problem_set_id = $1`,
        [problemSetId],
      );

      let containers: Array<{ id: string; name: string }> = [];

      if (mappingResult.rows.length > 0) {
        const environmentId = (mappingResult.rows[0] as { environment_id: string }).environment_id;
        const groups = await this.containerStore.getContainersGroupedByCategory(environmentId);
        containers = groups.flatMap(g => g.containers.map(c => ({ id: c.id, name: c.name })));
      }

      // -----------------------------------------------------------------------
      // Step B: Priority 1 -- Graph summaries (highest priority)
      // -----------------------------------------------------------------------
      for (const container of containers) {
        const summary = await this.graphSummaryService.getGraphSummary(
          container.id,
          scenarioPhase,
        );

        if (!summary) continue;

        const summaryTokens = estimateTokens(JSON.stringify(summary));
        if (tokensUsed + summaryTokens > TOKEN_BUDGET) break;

        graphSummaries[container.name] = summary;
        tokensUsed += summaryTokens;
      }

      // -----------------------------------------------------------------------
      // Step C: Priority 2 -- Own strategic documents + extracted objectives
      // -----------------------------------------------------------------------
      // Query documents uploaded directly to this problem set (workspaceId = problemSetId)
      const objectiveStore = new ObjectiveStore();
      try {
        const ownDocs = await listDocuments('', 50, 0, problemSetId);
        for (const doc of ownDocs) {
          if (tokensUsed >= TOKEN_BUDGET) break;

          const entry: {
            title: string;
            docType: string;
            extractedData?: unknown;
            textContent?: string;
          } = {
            title: doc.title,
            docType: doc.level,
          };

          // Include extracted objectives as structured data
          try {
            const objectives = await objectiveStore.getObjectivesForDocument(doc.id);
            if (objectives.length > 0) {
              const objectiveSummary = objectives.slice(0, 20).map(obj => ({
                description: obj.description,
                instrument: obj.primaryInstrument || 'unknown',
                priority: obj.priority || 'MEDIUM',
                assumptions: obj.assumptions || [],
                risks: obj.risks || [],
                constraints: obj.constraints || [],
              }));
              const objStr = JSON.stringify(objectiveSummary);
              const objTokens = estimateTokens(objStr);
              if (tokensUsed + objTokens <= TOKEN_BUDGET) {
                entry.extractedData = {
                  classification: doc.classification,
                  objectiveCount: objectives.length,
                  objectives: objectiveSummary,
                };
                tokensUsed += objTokens;
              }
            }
          } catch {
            // Objectives table may not exist yet
          }

          // Include truncated text summary if budget permits and no extracted data
          if (!entry.extractedData) {
            const summaryText = `${doc.title} (${doc.level}, ${doc.classification}) - ${doc.pageCount || '?'} pages, ${doc.objectiveCount || 0} objectives extracted`;
            const summaryTokens = estimateTokens(summaryText);
            if (tokensUsed + summaryTokens <= TOKEN_BUDGET) {
              entry.textContent = summaryText;
              tokensUsed += summaryTokens;
            }
          }

          documentSummaries.push(entry);
        }
      } catch (docErr) {
        console.error('[StrategicContextService] Own documents query failed (degraded):', docErr);
      }

      // -----------------------------------------------------------------------
      // Step D: Priority 3 -- Cached subscription documents
      // -----------------------------------------------------------------------
      const cachedDocs = await this.subscriptionStore.getCachedDocs(problemSetId);

      for (const doc of cachedDocs) {
        if (tokensUsed >= TOKEN_BUDGET) break;

        const payload = doc.payload as {
          documents?: Array<{
            title?: string;
            text_content?: string;
            extracted_data?: unknown;
          }>;
        };

        // Each cached row may contain an array of documents grouped by type
        const documents = Array.isArray(payload?.documents)
          ? payload.documents
          : (Array.isArray(payload) ? payload : [payload]);

        for (const docEntry of documents) {
          if (tokensUsed >= TOKEN_BUDGET) break;

          const entry: {
            title: string;
            docType: string;
            extractedData?: unknown;
            textContent?: string;
          } = {
            title: (docEntry as Record<string, unknown>)?.title as string || doc.dataType,
            docType: doc.dataType,
          };

          // Priority 3a: extracted_data first
          const extractedData = (docEntry as Record<string, unknown>)?.extracted_data;
          if (extractedData) {
            const extractedStr = JSON.stringify(extractedData);
            const extractedTokens = estimateTokens(extractedStr);
            if (tokensUsed + extractedTokens <= TOKEN_BUDGET) {
              entry.extractedData = extractedData;
              tokensUsed += extractedTokens;
            }
          }

          // Priority 3b: truncated text_content if budget permits
          const textContent = (docEntry as Record<string, unknown>)?.text_content as string | undefined;
          if (textContent && tokensUsed < TOKEN_BUDGET) {
            const remainingTokens = TOKEN_BUDGET - tokensUsed;
            const remainingChars = remainingTokens * 4;
            const truncated = textContent.length > remainingChars
              ? textContent.slice(0, remainingChars) + '...'
              : textContent;
            const textTokens = estimateTokens(truncated);
            if (tokensUsed + textTokens <= TOKEN_BUDGET) {
              entry.textContent = truncated;
              tokensUsed += textTokens;
            }
          }

          documentSummaries.push(entry);
        }
      }

      return {
        graphSummaries,
        documentSummaries,
        tokensUsed,
        tokenBudget: TOKEN_BUDGET,
      };
    } catch (err) {
      console.error(
        '[StrategicContextService] Context assembly failed (degraded):',
        err instanceof Error ? err.message : String(err),
      );
      return emptyContext;
    }
  }
}
