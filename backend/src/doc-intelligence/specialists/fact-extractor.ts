/**
 * Fact Extractor Specialist
 *
 * Extracts structured facts from documents with source attribution,
 * entity references, and temporal/geospatial context. Creates graph
 * entities via GraphBuilder and writes entity_provenance records for
 * full traceability.
 *
 * Each fact includes: claim, type classification, confidence score,
 * source reference (page/paragraph/quote), and entity names for
 * downstream cross-document linking.
 */

import { z } from 'zod';
import { SpecialistBase } from '../specialist-base.js';
import type { SpecialistConfig } from '../specialist-base.js';
import { ExtractedFactSchema } from '../schemas.js';
import type { ProblemSetContext } from '../schemas.js';
import type { ExtractedFact } from '../types.js';
import { graphBuilder } from '../../graph/construction/graph-builder.js';
import type { GraphBuildOptions, GraphEntityEvent } from '../../graph/construction/graph-builder.js';
import { createLLMForAgent } from '../../agents/langgraph/llm-factory.js';
import { DocumentParser } from '../../strategic/ingestion/document-parser.js';
import { getPool } from '../../lib/database.js';

// ============================================================================
// Constants
// ============================================================================

/** Chunk size matching ExtractionService default to avoid context overflow */
const DEFAULT_CHUNK_SIZE = 8000;

/** Zod schema for validating LLM fact extraction output */
const FactExtractionResponseSchema = z.object({
  facts: z.array(ExtractedFactSchema),
});

// ============================================================================
// Types
// ============================================================================

export interface FactExtractorInput {
  /** Document text (may be chunked externally or handled internally) */
  documentText: string;
  /** Problem set context for scoped extraction */
  problemSetContext: ProblemSetContext;
  /** Source document ID for provenance tracking */
  documentId: string;
  /** Optional: workspace ID for graph entity scoping */
  workspaceId?: string;
  /** Optional: callback for SSE streaming of entity creation events */
  onEntityCreated?: (event: GraphEntityEvent) => void;
  /** Optional: progress callback */
  onProgress?: (stage: string, detail: string) => void;
}

export interface FactExtractorOutput {
  facts: ExtractedFact[];
  graphResult: {
    actorsCreated: number;
    relationshipsCreated: number;
    tensionsCreated: number;
    errors: string[];
  };
  provenanceRecordsWritten: number;
}

// ============================================================================
// Fact Extractor Specialist
// ============================================================================

export class FactExtractor extends SpecialistBase {
  private documentParser: DocumentParser;

  constructor() {
    const config: SpecialistConfig = {
      specialistId: 'fact-extractor',
      name: 'Fact Extractor',
      description:
        'Extracts structured facts from documents with source attribution, ' +
        'entity references, and temporal/geospatial context. Creates graph ' +
        'entities and writes provenance records.',
      systemPrompt: '', // Overridden by getSystemPrompt()
      tools: [],
      clearance: 'UNCLASS',
    };

    super(config);
    this.documentParser = new DocumentParser();
  }

  // --------------------------------------------------------------------------
  // System Prompt
  // --------------------------------------------------------------------------

  getSystemPrompt(context: ProblemSetContext): string {
    return `You are an intelligence analyst extracting structured facts from documents. For each fact, identify the exact claim, classify its type, assess confidence (0-1), and cite the source passage.

Focus on entities, relationships, and claims relevant to: ${context.coreProblem}
Geographic focus: ${context.geographicScope.regions.join(', ')} (${context.geographicScope.countries.join(', ')})
Temporal focus: ${context.temporalRange.startDate ?? 'unspecified'} to ${context.temporalRange.endDate ?? 'unspecified'}
Primary actors: ${context.actorFocus.primaryActors.join(', ')}

Extract the following fact types:
- entity: Named entities (people, organizations, countries, military units)
- date: Dates, timelines, deadlines, temporal markers
- location: Geographic locations, coordinates, regions, bases
- quantity: Numbers, force sizes, budgets, distances, capabilities
- assertion: Claims, assessments, judgments, conclusions
- capability: Military capabilities, technological capabilities, capacity descriptions

For each fact provide:
1. claim: The exact factual claim as stated or directly implied
2. type: One of entity/date/location/quantity/assertion/capability
3. confidence: 0-1 score (1.0 = directly quoted, 0.5 = implied, <0.3 = speculative)
4. sourceReference: { page (if known), paragraph (if known), quote (exact passage) }
5. entities: Array of entity names mentioned in or relevant to this claim
6. temporalContext: Time period or date context (if applicable)
7. geospatialContext: Geographic context (if applicable)

You MUST respond with ONLY valid JSON matching this structure:
{"facts": [{ claim, type, confidence, sourceReference: { page?, paragraph?, quote }, entities, temporalContext?, geospatialContext? }]}

Be thorough but precise. Extract all substantive facts; do not fabricate.`;
  }

  // --------------------------------------------------------------------------
  // Core Extraction
  // --------------------------------------------------------------------------

  /**
   * Extract structured facts from a document, create graph entities,
   * and write provenance records.
   */
  async extract(input: FactExtractorInput): Promise<FactExtractorOutput> {
    const { documentText, problemSetContext, documentId, workspaceId, onEntityCreated, onProgress } = input;

    this.setProblemSetContext(problemSetContext);

    // Step 1: Chunk the document to respect context window limits
    const chunks = this.documentParser.chunkDocument(documentText, DEFAULT_CHUNK_SIZE);
    this.reportProgress('chunking', `Split document into ${chunks.length} chunks`, onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined);

    // Step 2: Extract facts from each chunk via LLM
    const allFacts: ExtractedFact[] = [];

    for (let i = 0; i < chunks.length; i++) {
      this.reportProgress(
        'extracting',
        `Processing chunk ${i + 1} of ${chunks.length}`,
        onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
      );

      const chunkFacts = await this.extractFromChunk(chunks[i], i, problemSetContext);
      allFacts.push(...chunkFacts);
    }

    // Step 3: Deduplicate facts across chunks
    const deduplicatedFacts = this.deduplicateFacts(allFacts);

    // Step 4: Create graph entities via GraphBuilder
    this.reportProgress(
      'graph-building',
      `Creating graph entities from ${deduplicatedFacts.length} facts`,
      onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
    );

    const graphResult = await this.buildGraphEntities(deduplicatedFacts, {
      sourceDocumentId: documentId,
      workspaceId,
      onEntityCreated,
    });

    // Step 5: Write entity_provenance records
    const provenanceCount = await this.writeProvenanceRecords(
      deduplicatedFacts,
      documentId,
      graphResult.entityIds,
    );

    this.reportProgress(
      'complete',
      `Extracted ${deduplicatedFacts.length} facts, created ${graphResult.actorsCreated} actors, wrote ${provenanceCount} provenance records`,
      onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
    );

    return {
      facts: deduplicatedFacts,
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
  // Chunk Extraction
  // --------------------------------------------------------------------------

  /**
   * Extract facts from a single text chunk using LLM.
   */
  private async extractFromChunk(
    chunkText: string,
    chunkIndex: number,
    context: ProblemSetContext,
  ): Promise<ExtractedFact[]> {
    try {
      const llm = await createLLMForAgent({ agentId: `doc-${this.specialistId}` });
      const systemPrompt = this.getSystemPrompt(context);

      const response = await llm.invoke([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Extract all structured facts from the following text chunk (chunk ${chunkIndex + 1}).\n\nTEXT:\n${chunkText}`,
        },
      ]);

      // Parse LLM response
      const parsed = this.parseJsonResponse(response.content);
      if (!parsed) {
        console.warn(`[fact-extractor] Chunk ${chunkIndex}: Failed to parse JSON response`);
        return [];
      }

      // Validate against schema
      const result = FactExtractionResponseSchema.safeParse(parsed);
      if (result.success) {
        console.log(`[fact-extractor] Chunk ${chunkIndex}: Extracted ${result.data.facts.length} facts`);
        return result.data.facts;
      }

      // Try parsing as array directly (some models return array without wrapper)
      if (Array.isArray(parsed)) {
        const arrayResult = z.array(ExtractedFactSchema).safeParse(parsed);
        if (arrayResult.success) {
          return arrayResult.data;
        }
      }

      console.warn(`[fact-extractor] Chunk ${chunkIndex}: Validation failed:`, result.error);
      return [];
    } catch (error) {
      console.error(`[fact-extractor] Chunk ${chunkIndex} extraction error:`, error);
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // Deduplication
  // --------------------------------------------------------------------------

  /**
   * Deduplicate facts across chunks using claim similarity.
   * Keeps the fact with higher confidence when duplicates found.
   */
  private deduplicateFacts(facts: ExtractedFact[]): ExtractedFact[] {
    const seen = new Map<string, ExtractedFact>();

    for (const fact of facts) {
      const key = this.normalizeClaim(fact.claim);
      const existing = seen.get(key);

      if (!existing || fact.confidence > existing.confidence) {
        seen.set(key, fact);
      } else if (existing && fact.confidence === existing.confidence) {
        // Merge entity lists from duplicate facts
        const mergedEntities = [...new Set([...existing.entities, ...fact.entities])];
        existing.entities = mergedEntities;
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Normalize a claim string for deduplication comparison.
   */
  private normalizeClaim(claim: string): string {
    return claim
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // --------------------------------------------------------------------------
  // Graph Building
  // --------------------------------------------------------------------------

  /**
   * Create graph entities from extracted facts using GraphBuilder.
   * Collects all unique entities from facts and processes them as a
   * synthetic "objective" text to leverage GraphBuilder's extraction pipeline.
   */
  private async buildGraphEntities(
    facts: ExtractedFact[],
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
    const entityIds: string[] = [];

    // Build a composite text from facts for entity extraction
    const factsText = facts
      .map((f) => `${f.claim} (entities: ${f.entities.join(', ')})`)
      .join('\n');

    if (!factsText.trim()) {
      return { actorsCreated: 0, relationshipsCreated: 0, tensionsCreated: 0, errors: [], entityIds: [] };
    }

    const graphOptions: GraphBuildOptions = {
      sourceDocumentId: options.sourceDocumentId,
      workspaceId: options.workspaceId,
      runEntityResolution: true,
      onEntityCreated: (event) => {
        if (event.data.id) {
          entityIds.push(event.data.id);
        }
        options.onEntityCreated?.(event);
      },
    };

    try {
      const result = await graphBuilder.buildFromObjective(
        `facts-${options.sourceDocumentId}`,
        factsText,
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
      console.error('[fact-extractor] Graph building error:', message);
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
   * Returns the number of records written.
   */
  private async writeProvenanceRecords(
    facts: ExtractedFact[],
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
            'fact-extractor',
            JSON.stringify({
              factCount: facts.length,
              entityCount: entityIds.length,
              extractedAt: new Date().toISOString(),
            }),
          ],
        );
        written++;
      } catch (error) {
        console.error(`[fact-extractor] Failed to write provenance for entity ${entityId}:`, error);
      }
    }

    return written;
  }

  // --------------------------------------------------------------------------
  // JSON Parsing
  // --------------------------------------------------------------------------

  /**
   * Parse JSON from LLM response, handling markdown code blocks and
   * various response formats.
   */
  private parseJsonResponse(content: unknown): unknown {
    const text = typeof content === 'string' ? content : JSON.stringify(content);

    // Strip thinking tags (Qwen3, DeepSeek, etc.)
    const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // Try direct parse
    try {
      return JSON.parse(cleaned);
    } catch {
      // Continue to extraction methods
    }

    // Try markdown code block
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {
        // Fall through
      }
    }

    // Try finding JSON object in text
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Fall through
      }
    }

    // Try finding JSON array
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        // Fall through
      }
    }

    console.error('[fact-extractor] Failed to parse JSON from LLM response:', cleaned.substring(0, 200));
    return null;
  }
}
