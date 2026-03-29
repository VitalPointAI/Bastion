/**
 * Objective Extractor Specialist
 *
 * Wraps the existing ExtractionService to extract strategic objectives
 * from documents, adding ProblemSetContext-aware filtering and relevance
 * scoring. Conditionally invoked only for document types that warrant
 * objective extraction: INTEL_ESTIMATE, CONOP, POLICY_PAPER, MILITARY_ORDER.
 *
 * Creates graph entities via GraphBuilder and writes entity_provenance
 * records for traceability.
 */

import { SpecialistBase } from '../specialist-base.js';
import type { SpecialistConfig } from '../specialist-base.js';
import type { ProblemSetContext } from '../schemas.js';
import type { DocumentType } from '../types.js';
import { ExtractionService } from '../../strategic/extraction/extractor.js';
import type { ExtractionResult, ExtractedObjective } from '../../strategic/extraction/types.js';
import { resolveProviderConfig } from '../../strategic/config/resolve-api-key.js';
import { graphBuilder } from '../../graph/construction/graph-builder.js';
import type { GraphBuildOptions, GraphEntityEvent } from '../../graph/construction/graph-builder.js';
import { getPool } from '../../lib/database.js';

// ============================================================================
// Constants
// ============================================================================

/** Document types that warrant objective extraction */
const OBJECTIVE_DOCUMENT_TYPES: DocumentType[] = [
  'INTEL_ESTIMATE',
  'CONOP',
  'POLICY_PAPER',
  'MILITARY_ORDER',
];

// ============================================================================
// Types
// ============================================================================

export interface ObjectiveExtractorInput {
  /** Document text */
  documentText: string;
  /** Problem set context for scoped extraction and relevance filtering */
  problemSetContext: ProblemSetContext;
  /** Source document ID for provenance tracking */
  documentId: string;
  /** Document type classification from the triage step */
  documentType: DocumentType;
  /** Optional: workspace ID for graph entity scoping */
  workspaceId?: string;
  /** Optional: callback for SSE streaming of entity creation events */
  onEntityCreated?: (event: GraphEntityEvent) => void;
  /** Optional: progress callback */
  onProgress?: (stage: string, detail: string) => void;
}

export interface ScoredObjective extends ExtractedObjective {
  /** Relevance score (0-1) against the problem set context */
  relevanceScore: number;
  /** Explanation of relevance scoring */
  relevanceReason: string;
}

export interface ObjectiveExtractorOutput {
  /** All extracted objectives with relevance scores */
  objectives: ScoredObjective[];
  /** Executive summary of the document */
  documentSummary: string;
  /** Overall extraction confidence */
  extractionConfidence: number;
  /** Document hierarchy level */
  documentLevel: string;
  /** Graph construction results */
  graphResult: {
    actorsCreated: number;
    relationshipsCreated: number;
    tensionsCreated: number;
    errors: string[];
  };
  /** Number of provenance records written */
  provenanceRecordsWritten: number;
}

// ============================================================================
// Objective Extractor Specialist
// ============================================================================

export class ObjectiveExtractor extends SpecialistBase {
  private _extractionService: ExtractionService | null = null;

  constructor() {
    const config: SpecialistConfig = {
      specialistId: 'objective-extractor',
      name: 'Objective Extractor',
      description:
        'Extracts strategic objectives from relevant document types using ' +
        'the existing ExtractionService, adding ProblemSetContext-aware ' +
        'filtering and graph integration.',
      systemPrompt: '', // Overridden by getSystemPrompt()
      tools: [],
      clearance: 'UNCLASS',
    };

    super(config);
  }

  /** Lazy-init ExtractionService with OAuth-aware provider config */
  private async getExtractionService(): Promise<ExtractionService> {
    if (!this._extractionService) {
      const providerConfig = await resolveProviderConfig('extraction');
      this._extractionService = new ExtractionService({ provider: providerConfig });
    }
    return this._extractionService;
  }

  // --------------------------------------------------------------------------
  // System Prompt
  // --------------------------------------------------------------------------

  getSystemPrompt(context: ProblemSetContext): string {
    return `You are a strategic planning analyst extracting objectives, goals, and strategic initiatives from documents. Prioritize objectives related to: ${context.coreProblem}

Assess each objective's alignment with the operational environment described by:
- Geographic scope: ${context.geographicScope.regions.join(', ')} (${context.geographicScope.countries.join(', ')})
- Actor focus: ${context.actorFocus.primaryActors.join(', ')}
- Temporal range: ${context.temporalRange.startDate ?? 'unspecified'} to ${context.temporalRange.endDate ?? 'unspecified'}
- Echelon: ${context.echelon}

For each extracted objective, provide a relevance score (0-1) indicating how closely it aligns with the problem set scope.`;
  }

  // --------------------------------------------------------------------------
  // Conditional Invocation Check
  // --------------------------------------------------------------------------

  /**
   * Check if this specialist should be invoked for the given document type.
   * Only certain document types warrant objective extraction.
   */
  static shouldInvoke(documentType: DocumentType): boolean {
    return OBJECTIVE_DOCUMENT_TYPES.includes(documentType);
  }

  // --------------------------------------------------------------------------
  // Core Extraction
  // --------------------------------------------------------------------------

  /**
   * Extract strategic objectives, score for relevance, create graph entities,
   * and write provenance records.
   */
  async extract(input: ObjectiveExtractorInput): Promise<ObjectiveExtractorOutput> {
    const {
      documentText,
      problemSetContext,
      documentId,
      documentType,
      workspaceId,
      onEntityCreated,
      onProgress,
    } = input;

    this.setProblemSetContext(problemSetContext);

    // Guard: only process appropriate document types
    if (!ObjectiveExtractor.shouldInvoke(documentType)) {
      console.log(
        `[objective-extractor] Skipping document ${documentId} (type: ${documentType}) — not an objective-bearing document type`,
      );
      return {
        objectives: [],
        documentSummary: '',
        extractionConfidence: 0,
        documentLevel: 'OTHER',
        graphResult: { actorsCreated: 0, relationshipsCreated: 0, tensionsCreated: 0, errors: [] },
        provenanceRecordsWritten: 0,
      };
    }

    // Step 1: Use existing ExtractionService for DIME/MIDLIFE extraction
    this.reportProgress(
      'extracting',
      `Extracting objectives from ${documentType} document`,
      onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
    );

    const extractionService = await this.getExtractionService();
    const extractionResult = await extractionService.extractFromDocument(documentText);

    // Step 2: Score objectives for relevance against problem set
    this.reportProgress(
      'scoring',
      `Scoring ${extractionResult.objectives.length} objectives for relevance`,
      onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
    );

    const scoredObjectives = this.scoreObjectives(extractionResult, problemSetContext);

    // Step 3: Create graph entities via GraphBuilder
    this.reportProgress(
      'graph-building',
      `Creating graph entities from ${scoredObjectives.length} objectives`,
      onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
    );

    const graphResult = await this.buildGraphEntities(scoredObjectives, {
      sourceDocumentId: documentId,
      workspaceId,
      onEntityCreated,
    });

    // Step 4: Write entity_provenance records
    const provenanceCount = await this.writeProvenanceRecords(
      documentId,
      graphResult.entityIds,
    );

    this.reportProgress(
      'complete',
      `Extracted ${scoredObjectives.length} objectives, created ${graphResult.actorsCreated} graph actors, wrote ${provenanceCount} provenance records`,
      onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
    );

    return {
      objectives: scoredObjectives,
      documentSummary: extractionResult.documentSummary,
      extractionConfidence: extractionResult.extractionConfidence,
      documentLevel: extractionResult.documentLevel,
      graphResult: {
        actorsCreated: graphResult.actorsCreated,
        relationshipsCreated: graphResult.relationshipsCreated,
        tensionsCreated: graphResult.tensionsCreated,
        errors: graphResult.errors,
      },
      provenanceRecordsWritten: provenanceCount,
    };
  }

  // --------------------------------------------------------------------------
  // Relevance Scoring
  // --------------------------------------------------------------------------

  /**
   * Score each extracted objective for relevance against the problem set context.
   * Filters and prioritizes objectives related to the core problem, geographic
   * scope, and actor focus.
   */
  private scoreObjectives(
    extractionResult: ExtractionResult,
    context: ProblemSetContext,
  ): ScoredObjective[] {
    const contextTerms = this.buildContextTerms(context);

    return extractionResult.objectives.map((objective) => {
      const { score, reason } = this.computeRelevanceScore(objective, contextTerms, context);
      return {
        ...objective,
        relevanceScore: score,
        relevanceReason: reason,
      };
    });
  }

  /**
   * Build a set of normalized terms from the problem set context
   * for relevance matching.
   */
  private buildContextTerms(context: ProblemSetContext): Set<string> {
    const terms = new Set<string>();

    // Core problem terms
    for (const word of context.coreProblem.toLowerCase().split(/\s+/)) {
      if (word.length > 3) terms.add(word);
    }

    // Geographic terms
    for (const region of context.geographicScope.regions) {
      terms.add(region.toLowerCase());
    }
    for (const country of context.geographicScope.countries) {
      terms.add(country.toLowerCase());
    }
    if (context.geographicScope.specificAreas) {
      for (const area of context.geographicScope.specificAreas) {
        terms.add(area.toLowerCase());
      }
    }

    // Actor terms
    for (const actor of context.actorFocus.primaryActors) {
      terms.add(actor.toLowerCase());
    }
    if (context.actorFocus.alliances) {
      for (const alliance of context.actorFocus.alliances) {
        terms.add(alliance.name.toLowerCase());
        for (const member of alliance.members) {
          terms.add(member.toLowerCase());
        }
      }
    }

    return terms;
  }

  /**
   * Compute a relevance score (0-1) for a single objective
   * based on term overlap with problem set context.
   */
  private computeRelevanceScore(
    objective: ExtractedObjective,
    contextTerms: Set<string>,
    context: ProblemSetContext,
  ): { score: number; reason: string } {
    const objectiveText = [
      objective.description,
      objective.ends.description,
      ...objective.ways.strategies,
      ...objective.ways.concepts,
      ...objective.means.capabilities,
    ]
      .join(' ')
      .toLowerCase();

    const _objectiveWords = new Set(objectiveText.split(/\s+/).filter((w) => w.length > 3));
    const reasons: string[] = [];

    // Calculate term overlap
    let matchCount = 0;
    const matchedTerms: string[] = [];

    for (const term of contextTerms) {
      if (objectiveText.includes(term)) {
        matchCount++;
        matchedTerms.push(term);
      }
    }

    const overlapScore = contextTerms.size > 0 ? Math.min(matchCount / contextTerms.size, 1.0) : 0.5;

    if (matchedTerms.length > 0) {
      reasons.push(`Matches context terms: ${matchedTerms.slice(0, 5).join(', ')}`);
    }

    // Priority boost: higher priority objectives get a small relevance boost
    const priorityBoost =
      objective.priority === 'CRITICAL' ? 0.1
        : objective.priority === 'HIGH' ? 0.05
          : 0;

    if (priorityBoost > 0) {
      reasons.push(`Priority boost: ${objective.priority}`);
    }

    // DIME category alignment: military objectives get a slight boost for military contexts
    const dimeBoost = this.getDimeAlignmentBoost(objective.dimeCategory, context);
    if (dimeBoost > 0) {
      reasons.push(`DIME alignment: ${objective.dimeCategory}`);
    }

    const rawScore = overlapScore + priorityBoost + dimeBoost;
    const score = Math.min(Math.max(rawScore, 0), 1);

    return {
      score: Math.round(score * 100) / 100,
      reason: reasons.length > 0 ? reasons.join('; ') : 'No direct context overlap found',
    };
  }

  /**
   * Get DIME category alignment boost based on problem set echelon.
   */
  private getDimeAlignmentBoost(
    dimeCategory: string,
    context: ProblemSetContext,
  ): number {
    if (context.echelon === 'strategic') {
      if (dimeCategory === 'DIPLOMATIC' || dimeCategory === 'ECONOMIC') return 0.05;
    } else if (context.echelon === 'operational' || context.echelon === 'tactical') {
      if (dimeCategory === 'MILITARY') return 0.05;
    }
    return 0;
  }

  // --------------------------------------------------------------------------
  // Graph Building
  // --------------------------------------------------------------------------

  /**
   * Create graph entities from extracted objectives using GraphBuilder.
   */
  private async buildGraphEntities(
    objectives: ScoredObjective[],
    options: {
      sourceDocumentId: string;
      workspaceId?: string;
      onEntityCreated?: (event: GraphEntityEvent) => void;
    },
  ): Promise<{
    actorsCreated: number;
    relationshipsCreated: number;
    tensionsCreated: number;
    errors: string[];
    entityIds: string[];
  }> {
    if (objectives.length === 0) {
      return { actorsCreated: 0, relationshipsCreated: 0, tensionsCreated: 0, errors: [], entityIds: [] };
    }

    const entityIds: string[] = [];
    const objectivesForGraph = objectives.map((o) => ({
      id: o.id,
      description: o.description,
    }));

    const graphOptions: Omit<GraphBuildOptions, 'sourceDocumentId'> = {
      workspaceId: options.workspaceId,
      containerIds: options.workspaceId ? [options.workspaceId] : [],
      runEntityResolution: true,
      onEntityCreated: (event) => {
        if (event.data.id) {
          entityIds.push(event.data.id);
        }
        options.onEntityCreated?.(event);
      },
    };

    try {
      const result = await graphBuilder.buildFromDocument(
        options.sourceDocumentId,
        objectivesForGraph,
        graphOptions,
      );

      return {
        actorsCreated: result.actorsCreated,
        relationshipsCreated: result.relationshipsCreated,
        tensionsCreated: result.tensionsCreated,
        errors: result.errors,
        entityIds,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[objective-extractor] Graph building error:', message);
      return {
        actorsCreated: 0,
        relationshipsCreated: 0,
        tensionsCreated: 0,
        errors: [message],
        entityIds: [],
      };
    }
  }

  // --------------------------------------------------------------------------
  // Provenance Records
  // --------------------------------------------------------------------------

  /**
   * Write entity_provenance records linking graph entities to this document.
   */
  private async writeProvenanceRecords(
    documentId: string,
    entityIds: string[],
  ): Promise<number> {
    if (entityIds.length === 0) return 0;

    const pool = getPool();
    let written = 0;

    for (const entityId of entityIds) {
      try {
        await pool.query(
          `INSERT INTO entity_provenance (entity_id, source_document_id, extracted_by, extraction_context)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (entity_id, source_document_id) DO NOTHING`,
          [
            entityId,
            documentId,
            'objective-extractor',
            JSON.stringify({
              extractedAt: new Date().toISOString(),
            }),
          ],
        );
        written++;
      } catch (error) {
        console.error(`[objective-extractor] Failed to write provenance for entity ${entityId}:`, error);
      }
    }

    return written;
  }
}
