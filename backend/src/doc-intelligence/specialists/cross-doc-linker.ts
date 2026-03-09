/**
 * Cross-Document Linker Specialist
 *
 * Detects inter-document relationships by analyzing newly extracted facts
 * against existing knowledge graph entities. Uses the entity resolution
 * service for co-reference detection and LLM for semantic comparison of
 * claims across documents.
 *
 * Relationship types:
 * - Entity co-reference: Same entity in different documents (aliases, spelling variants)
 * - Temporal sequencing: Events across documents forming a timeline
 * - Corroboration: Same claim from independent sources (increases confidence)
 * - Contradiction: Conflicting claims from different sources (flags for analyst)
 *
 * Runs AFTER the Fact Extractor completes (dependency-gated in orchestrator).
 */

import { z } from 'zod';
import { SpecialistBase } from '../specialist-base.js';
import type { SpecialistConfig } from '../specialist-base.js';
import { CrossDocLinkSchema } from '../schemas.js';
import type { ProblemSetContext } from '../schemas.js';
import type { CrossDocLink, ExtractedFact, LinkType } from '../types.js';
import { SpecialistId } from '../types.js';
import type { BastionState } from '../../orchestration/state.js';
import { entityResolutionService } from '../../graph/resolution/resolution-service.js';
import { actorStore } from '../../graph/raft/actor-store.js';
import { createLLMForAgent } from '../../agents/langgraph/llm-factory.js';
import { getPool } from '../../lib/database.js';

// ============================================================================
// Constants
// ============================================================================

/** Minimum similarity for entity co-reference detection */
const CO_REFERENCE_THRESHOLD = 0.80;

/** Minimum strength to consider a cross-doc link significant */
const LINK_STRENGTH_THRESHOLD = 0.3;

/** Maximum number of existing documents to compare against */
const MAX_COMPARISON_DOCS = 50;

// ============================================================================
// Types
// ============================================================================

export interface CrossDocLinkerInput {
  /** Facts extracted from the current document */
  facts: ExtractedFact[];
  /** Problem set context for scoped analysis */
  problemSetContext: ProblemSetContext;
  /** Current document ID */
  documentId: string;
  /** Optional: workspace ID for entity scoping */
  workspaceId?: string;
  /** Optional: progress callback */
  onProgress?: (stage: string, detail: string) => void;
}

export interface CrossDocLinkerOutput {
  links: CrossDocLink[];
  coReferences: number;
  corroborations: number;
  contradictions: number;
  temporalLinks: number;
}

/** Schema for LLM semantic comparison response */
const SemanticComparisonSchema = z.object({
  comparisons: z.array(z.object({
    targetDocId: z.string(),
    linkType: z.enum(['corroborates', 'contradicts', 'extends', 'references']),
    strength: z.number().min(0).max(1),
    evidence: z.string(),
    reasoning: z.string(),
  })),
});

// ============================================================================
// Cross-Document Linker Specialist
// ============================================================================

/**
 * Detects corroboration, contradiction, entity co-reference, and temporal
 * sequencing across documents in the same problem set.
 */
export class CrossDocLinker extends SpecialistBase {
  constructor() {
    const config: SpecialistConfig = {
      specialistId: SpecialistId.CROSS_DOC_LINKER,
      name: 'Cross-Document Linker',
      description:
        'Detects inter-document relationships using entity resolution and ' +
        'semantic comparison. Identifies corroboration, contradiction, ' +
        'co-reference, and temporal sequencing across documents.',
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
      'You are an intelligence analyst specializing in cross-document analysis.',
      'Compare newly extracted facts with existing intelligence.',
      'Identify corroboration (same fact, independent sources), contradiction',
      '(conflicting claims), temporal sequences, and entity co-references.',
      'For contradictions, note which source is more recent and which has higher reliability.',
      '',
      `Problem context: ${context.coreProblem}`,
      `Geographic scope: ${context.geographicScope.regions.join(', ')}`,
      `Primary actors: ${context.actorFocus.primaryActors.join(', ')}`,
      `Temporal range: ${context.temporalRange.startDate ?? 'unspecified'} to ${context.temporalRange.endDate ?? 'unspecified'}`,
      '',
      'For each cross-document relationship found, provide:',
      '- targetDocId: the ID of the related document',
      '- linkType: "corroborates" | "contradicts" | "extends" | "references"',
      '- strength: 0-1 score (1.0 = definite, 0.5 = probable, <0.3 = weak)',
      '- evidence: specific claims from both documents supporting this link',
      '- reasoning: brief explanation of why this relationship exists',
      '',
      'Respond with ONLY valid JSON:',
      '{"comparisons": [{ targetDocId, linkType, strength, evidence, reasoning }]}',
    ].join('\n');
  }

  // --------------------------------------------------------------------------
  // Core Analysis
  // --------------------------------------------------------------------------

  /**
   * Analyze cross-document relationships for newly extracted facts.
   */
  async analyze(input: CrossDocLinkerInput): Promise<CrossDocLinkerOutput> {
    const { facts, problemSetContext, documentId, workspaceId, onProgress } = input;

    this.setProblemSetContext(problemSetContext);

    const allLinks: CrossDocLink[] = [];

    // Step 1: Find entity co-references using the resolution service
    this.reportProgress(
      'co-reference',
      'Detecting entity co-references across documents',
      onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
    );

    const coRefLinks = await this.detectCoReferences(facts, documentId, workspaceId);
    allLinks.push(...coRefLinks);

    // Step 2: Load existing document facts for semantic comparison
    this.reportProgress(
      'loading',
      'Loading existing document facts for comparison',
      onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
    );

    const existingDocs = await this.loadExistingDocumentFacts(
      problemSetContext.problemSetId,
      documentId,
    );

    // Step 3: Use LLM for semantic comparison of claims
    if (existingDocs.length > 0 && facts.length > 0) {
      this.reportProgress(
        'comparing',
        `Comparing against ${existingDocs.length} existing documents`,
        onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
      );

      const semanticLinks = await this.semanticComparison(
        facts,
        existingDocs,
        documentId,
        problemSetContext,
      );
      allLinks.push(...semanticLinks);
    }

    // Step 4: Detect temporal sequencing
    const temporalLinks = this.detectTemporalSequencing(facts, existingDocs, documentId);
    allLinks.push(...temporalLinks);

    // Step 5: Update entity confidence based on corroboration count
    const corroborations = allLinks.filter((l) => l.linkType === 'corroborates');
    if (corroborations.length > 0) {
      await this.updateCorroborationConfidence(corroborations, documentId);
    }

    // Deduplicate links (same source-target-type)
    const deduped = this.deduplicateLinks(allLinks);

    // Filter weak links
    const significantLinks = deduped.filter((l) => l.strength >= LINK_STRENGTH_THRESHOLD);

    this.reportProgress(
      'complete',
      `Found ${significantLinks.length} cross-document links`,
      onProgress ? (evt) => onProgress(evt.data.stage as string, evt.data.detail as string) : undefined,
    );

    // Validate each link against schema
    const validatedLinks: CrossDocLink[] = [];
    for (const link of significantLinks) {
      const validation = this.validateOutput(link, CrossDocLinkSchema);
      if (validation.success) {
        validatedLinks.push(validation.data);
      }
    }

    return {
      links: validatedLinks,
      coReferences: coRefLinks.length,
      corroborations: corroborations.length,
      contradictions: validatedLinks.filter((l) => l.linkType === 'contradicts').length,
      temporalLinks: temporalLinks.length,
    };
  }

  // --------------------------------------------------------------------------
  // Entity Co-Reference Detection
  // --------------------------------------------------------------------------

  /**
   * Use entity resolution service to find co-references between entities
   * in the current document and existing graph entities.
   */
  private async detectCoReferences(
    facts: ExtractedFact[],
    documentId: string,
    workspaceId?: string,
  ): Promise<CrossDocLink[]> {
    const links: CrossDocLink[] = [];

    try {
      // Get existing actors from the graph
      const existingActors = await actorStore.listActors(workspaceId);
      if (existingActors.length === 0) return links;

      // Collect unique entity names from new facts
      const newEntityNames = new Set<string>();
      for (const fact of facts) {
        for (const entity of fact.entities) {
          newEntityNames.add(entity);
        }
      }

      // Run entity resolution to find duplicates
      const resolutionResult = await entityResolutionService.findDuplicates(workspaceId);

      // Extract links from auto-merge and needs-review candidates
      for (const candidate of [...resolutionResult.autoMerge, ...resolutionResult.needsReview]) {
        // Check if one of the actors is from the current document's entities
        const actor1InNew = newEntityNames.has(candidate.actor1Name);
        const actor2InNew = newEntityNames.has(candidate.actor2Name);

        if (actor1InNew || actor2InNew) {
          // Find which documents the other actor came from
          const otherActor = actor1InNew ? candidate.actor2Id : candidate.actor1Id;
          const existingActor = existingActors.find((a) => a.id === otherActor);

          if (existingActor && existingActor.sourceDocumentIds) {
            for (const sourceDocId of existingActor.sourceDocumentIds) {
              if (sourceDocId !== documentId) {
                links.push({
                  sourceDocId: documentId,
                  targetDocId: sourceDocId,
                  linkType: 'references',
                  strength: candidate.score.score,
                  evidence: `Entity co-reference: "${candidate.actor1Name}" and "${candidate.actor2Name}" ` +
                    `(similarity: ${candidate.score.score.toFixed(3)})`,
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[cross-doc-linker] Co-reference detection error:', error);
    }

    return links;
  }

  // --------------------------------------------------------------------------
  // Load Existing Document Facts
  // --------------------------------------------------------------------------

  /**
   * Load fact summaries from existing documents in the same problem set.
   * Used for semantic comparison by the LLM.
   */
  private async loadExistingDocumentFacts(
    problemSetId: string,
    currentDocId: string,
  ): Promise<Array<{ documentId: string; summary: string; createdAt: string }>> {
    try {
      const pool = getPool();
      const result = await pool.query(
        `SELECT id, title, ai_summary, created_at
         FROM strategic_documents
         WHERE problem_set_id = $1 AND id != $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [problemSetId, currentDocId, MAX_COMPARISON_DOCS],
      );

      return result.rows.map((row: { id: string; title: string; ai_summary: string | null; created_at: string }) => ({
        documentId: row.id,
        summary: row.ai_summary ?? row.title ?? 'No summary available',
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error('[cross-doc-linker] Failed to load existing documents:', error);
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // Semantic Comparison via LLM
  // --------------------------------------------------------------------------

  /**
   * Use LLM to find semantic relationships between current document facts
   * and existing document summaries.
   */
  private async semanticComparison(
    facts: ExtractedFact[],
    existingDocs: Array<{ documentId: string; summary: string; createdAt: string }>,
    documentId: string,
    context: ProblemSetContext,
  ): Promise<CrossDocLink[]> {
    const links: CrossDocLink[] = [];

    try {
      const llm = await createLLMForAgent({ agentId: `doc-${this.specialistId}` });
      const systemPrompt = this.getSystemPrompt(context);

      // Build the comparison prompt
      const factsText = facts
        .map((f, i) => `Fact ${i + 1} [${f.type}] (confidence: ${f.confidence}): ${f.claim}`)
        .join('\n');

      const docsText = existingDocs
        .map((d) => `Document ${d.documentId} (${d.createdAt}): ${d.summary}`)
        .join('\n\n');

      const userMessage = [
        'Compare these newly extracted facts against existing documents.',
        '',
        'NEW FACTS (from current document):',
        factsText,
        '',
        'EXISTING DOCUMENTS:',
        docsText,
        '',
        'Identify corroborations, contradictions, extensions, and references.',
        'Only report relationships with strength >= 0.3.',
      ].join('\n');

      const response = await llm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ]);

      // Parse LLM response
      const parsed = this.parseJsonResponse(response.content);
      if (!parsed) return links;

      const result = SemanticComparisonSchema.safeParse(parsed);
      if (result.success) {
        for (const comparison of result.data.comparisons) {
          links.push({
            sourceDocId: documentId,
            targetDocId: comparison.targetDocId,
            linkType: comparison.linkType,
            strength: comparison.strength,
            evidence: comparison.evidence,
          });
        }
      } else {
        console.warn('[cross-doc-linker] Semantic comparison validation failed:', result.error);
      }
    } catch (error) {
      console.error('[cross-doc-linker] Semantic comparison error:', error);
    }

    return links;
  }

  // --------------------------------------------------------------------------
  // Temporal Sequencing
  // --------------------------------------------------------------------------

  /**
   * Detect temporal relationships between facts across documents.
   * Looks for events that form a timeline or sequence.
   */
  private detectTemporalSequencing(
    facts: ExtractedFact[],
    existingDocs: Array<{ documentId: string; summary: string; createdAt: string }>,
    documentId: string,
  ): CrossDocLink[] {
    const links: CrossDocLink[] = [];

    // Extract date-type facts from current document
    const dateFacts = facts.filter((f) => f.type === 'date' && f.temporalContext);

    if (dateFacts.length === 0 || existingDocs.length === 0) return links;

    // For each existing document, check if temporal contexts overlap or sequence
    for (const doc of existingDocs) {
      for (const fact of dateFacts) {
        // Simple heuristic: if the existing doc summary mentions dates or events
        // that could relate to the current fact's temporal context
        if (
          fact.temporalContext &&
          doc.summary.toLowerCase().includes(fact.temporalContext.toLowerCase())
        ) {
          links.push({
            sourceDocId: documentId,
            targetDocId: doc.documentId,
            linkType: 'extends',
            strength: 0.5,
            evidence: `Temporal overlap: "${fact.temporalContext}" referenced in both documents`,
          });
        }
      }
    }

    return links;
  }

  // --------------------------------------------------------------------------
  // Confidence Updates
  // --------------------------------------------------------------------------

  /**
   * Update entity confidence scores in the graph based on corroboration.
   * More corroborating sources = higher confidence.
   */
  private async updateCorroborationConfidence(
    corroborations: CrossDocLink[],
    _documentId: string,
  ): Promise<void> {
    try {
      const pool = getPool();

      // Count corroborations per target document
      const docCorroborationCount = new Map<string, number>();
      for (const link of corroborations) {
        const count = docCorroborationCount.get(link.targetDocId) ?? 0;
        docCorroborationCount.set(link.targetDocId, count + 1);
      }

      // Update corroboration_count on strategic_documents
      for (const [targetDocId, count] of docCorroborationCount) {
        await pool.query(
          `UPDATE strategic_documents
           SET corroboration_count = COALESCE(corroboration_count, 0) + $1
           WHERE id = $2`,
          [count, targetDocId],
        );
      }
    } catch (error) {
      console.error('[cross-doc-linker] Failed to update corroboration confidence:', error);
    }
  }

  // --------------------------------------------------------------------------
  // Deduplication
  // --------------------------------------------------------------------------

  /**
   * Deduplicate links by source-target-type, keeping the strongest.
   */
  private deduplicateLinks(links: CrossDocLink[]): CrossDocLink[] {
    const seen = new Map<string, CrossDocLink>();

    for (const link of links) {
      const key = `${link.sourceDocId}:${link.targetDocId}:${link.linkType}`;
      const existing = seen.get(key);
      if (!existing || link.strength > existing.strength) {
        seen.set(key, link);
      }
    }

    return Array.from(seen.values());
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
      // Try code block
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

    console.error('[cross-doc-linker] Failed to parse JSON from LLM response:', cleaned.substring(0, 200));
    return null;
  }

  // --------------------------------------------------------------------------
  // LangGraph Node
  // --------------------------------------------------------------------------

  /**
   * Create a LangGraph node function for the cross-document linker.
   */
  override createNode(): (state: BastionState) => Promise<Partial<BastionState>> {
    return async (state: BastionState): Promise<Partial<BastionState>> => {
      const baseNode = this.wrapper.createNode();
      return baseNode(state);
    };
  }
}
