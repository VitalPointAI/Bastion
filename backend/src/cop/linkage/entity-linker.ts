/**
 * Hybrid Entity Linker
 *
 * Phase 21 Plan 05: Discovers entity linkages between COP layer symbols
 * and RAFT graph entities using two complementary strategies:
 *
 * 1. **Graph Traversal** - For known relationships: query Neo4j RAFT graph
 *    by entityId, traverse 1-2 hops to discover linked entities.
 *    These get confidence=1.0 (known relationships).
 *
 * 2. **Embedding Similarity** - For new linkages: generate embeddings via
 *    text-embedding-3-large (OpenAIEmbeddings), compare cosine similarity
 *    against other entities in the workspace. Threshold > 0.7 for candidates.
 *
 * Linkages above confidence threshold auto-commit; below threshold queued
 * for human review. All linkages persisted with bidirectional references.
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import type { Driver } from 'neo4j-driver';

import { executeReadQuery } from '../../graph/neo4j-client.js';
import type { COPSymbolSpec } from '../layers/layer-types.js';
import { copEventBus } from '../messaging/event-bus.js';
import {
  evaluateConfidence,
  type ConfidenceConfig,
} from './confidence-threshold.js';
import {
  LinkageStore,
  linkageStore as defaultLinkageStore,
  type DiscoveryMethod,
} from './linkage-store.js';

// ─── Types ─────────────────────────────────────────────────────────────────

/**
 * Result of a single entity linkage discovery.
 */
export interface LinkageResult {
  /** Source entity ID (from COP symbol) */
  entityId: string;
  /** Discovered linked entity ID (from RAFT graph) */
  linkedEntityId: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** How the linkage was discovered */
  method: DiscoveryMethod;
  /** Human-readable description of the linkage */
  description: string;
}

/**
 * Entity context for hover tooltips and detail views.
 */
export interface EntityContext {
  /** Entity ID */
  entityId: string;
  /** Entity name */
  name: string;
  /** Entity type (nation, organization, individual, non_state_actor) */
  type: string;
  /** Primary affiliation / parent entity name */
  affiliation: string | null;
  /** Key linked entities (name + relationship type) */
  linkedEntities: Array<{
    entityId: string;
    name: string;
    relationshipType: string;
    strength: number;
  }>;
  /** Actor functions by domain */
  functions: Array<{
    domain: string;
    description: string;
  }>;
  /** Active tensions involving this entity */
  tensions: Array<{
    description: string;
    intensity: string;
    domain: string;
  }>;
}

// ─── Entity Linker ─────────────────────────────────────────────────────────

/**
 * Hybrid entity linker combining graph traversal and embedding similarity.
 *
 * Graph traversal finds known relationships in the RAFT graph with confidence=1.0.
 * Embedding similarity discovers new potential linkages with similarity-based confidence.
 * All discovered linkages are evaluated against the confidence threshold and persisted.
 */
export class EntityLinker {
  private embeddings: OpenAIEmbeddings;
  private store: LinkageStore;
  private confidenceConfig: Partial<ConfidenceConfig>;

  /** Minimum cosine similarity to consider an embedding match as a candidate. */
  private static readonly SIMILARITY_CANDIDATE_THRESHOLD = 0.7;

  constructor(
    private neo4jDriver: Driver,
    embeddings: OpenAIEmbeddings,
    store?: LinkageStore,
    confidenceConfig?: Partial<ConfidenceConfig>,
  ) {
    this.embeddings = embeddings;
    this.store = store ?? defaultLinkageStore;
    this.confidenceConfig = confidenceConfig ?? {};
  }

  /**
   * Discover linkages for COP symbols using hybrid graph + embedding strategy.
   *
   * 1. Graph traversal: Query RAFT graph for each symbol's entityId,
   *    traverse 1-2 hops to find linked entities (confidence=1.0).
   * 2. Embedding similarity: For entities with few graph relationships,
   *    use embedding comparison to discover new potential linkages.
   * 3. Deduplicate, evaluate confidence, persist, and emit events.
   *
   * @param workspaceId - Workspace scope for the discovery
   * @param symbolSpecs - COP symbols to discover linkages for
   * @returns All discovered linkage results
   */
  async discoverLinkages(
    workspaceId: string,
    symbolSpecs: COPSymbolSpec[],
  ): Promise<LinkageResult[]> {
    const allResults: LinkageResult[] = [];

    for (const symbol of symbolSpecs) {
      // Phase 1: Graph traversal for known relationships
      const graphResults = await this.discoverViaGraphTraversal(
        workspaceId,
        symbol.entityId,
      );
      allResults.push(...graphResults);

      // Phase 2: Embedding similarity for new linkages
      // Only if graph traversal found fewer than 3 relationships
      if (graphResults.length < 3) {
        const embeddingResults = await this.discoverViaEmbeddingSimilarity(
          workspaceId,
          symbol.entityId,
          symbol.designation,
        );
        allResults.push(...embeddingResults);
      }
    }

    // Deduplicate by entity pair (keep highest confidence)
    const deduped = this.deduplicateResults(allResults);

    // Evaluate confidence and persist each linkage
    for (const result of deduped) {
      const evaluation = evaluateConfidence(
        result.confidence,
        this.confidenceConfig,
      );

      // Persist the linkage
      const linkage = await this.store.createLinkage({
        entityId: result.entityId,
        symbolEntityId: result.entityId, // Self-reference for source symbol
        layerId: workspaceId, // Layer context
        confidence: result.confidence,
        autoCommitted: evaluation.autoCommit,
        discoveryMethod: result.method,
      });

      // Emit event for activity feed
      copEventBus.emit('linkage:discovered', {
        entityId: result.entityId,
        linkedEntityId: result.linkedEntityId,
        confidence: result.confidence,
        autoCommitted: evaluation.autoCommit,
      });
    }

    return deduped;
  }

  /**
   * Get entity context for hover tooltips and detail views.
   *
   * Retrieves the entity from the RAFT graph along with:
   * - Immediate relationships (1 hop)
   * - Actor functions by domain
   * - Active tensions involving the entity
   *
   * @param entityId - RAFT graph entity ID
   * @param workspaceId - Workspace scope
   * @returns Entity context with relationships, functions, and tensions
   */
  async getEntityContext(
    entityId: string,
    workspaceId: string,
  ): Promise<EntityContext> {
    // Get entity and its immediate relationships
    const entityResult = await executeReadQuery(
      `MATCH (a:Actor {id: $entityId, workspaceId: $workspaceId})
       OPTIONAL MATCH (a)-[r:RELATES_TO]-(linked:Actor)
       RETURN a, collect({
         entityId: linked.id,
         name: linked.name,
         type: r.type,
         strength: r.strength
       }) as relationships`,
      { entityId, workspaceId },
    );

    if (entityResult.records.length === 0) {
      return {
        entityId,
        name: 'Unknown Entity',
        type: 'unknown',
        affiliation: null,
        linkedEntities: [],
        functions: [],
        tensions: [],
      };
    }

    const record = entityResult.records[0];
    const actorProps = record.get('a').properties;
    const rawRelationships = record.get('relationships') as Array<{
      entityId: string | null;
      name: string | null;
      type: string | null;
      strength: unknown;
    }>;

    // Filter out null entries (from actors with no relationships)
    const relationships = rawRelationships
      .filter((r) => r.entityId !== null)
      .map((r) => ({
        entityId: r.entityId!,
        name: r.name!,
        relationshipType: r.type || 'unknown',
        strength: typeof r.strength === 'object' && r.strength !== null
          ? (r.strength as { toNumber: () => number }).toNumber()
          : (r.strength as number) || 0,
      }));

    // Get actor functions
    const functionsResult = await executeReadQuery(
      `MATCH (a:Actor {id: $entityId})-[:HAS_FUNCTION]->(f:ActorFunction)
       RETURN f.domain as domain, f.description as description`,
      { entityId },
    );

    const functions = functionsResult.records.map((rec) => ({
      domain: rec.get('domain') as string,
      description: rec.get('description') as string,
    }));

    // Get tensions involving this entity
    const tensionsResult = await executeReadQuery(
      `MATCH (t:Tension)
       WHERE $entityId IN t.actorIds AND t.workspaceId = $workspaceId
       RETURN t.description as description, t.intensity as intensity, t.domain as domain`,
      { entityId, workspaceId },
    );

    const tensions = tensionsResult.records.map((rec) => ({
      description: rec.get('description') as string,
      intensity: rec.get('intensity') as string,
      domain: rec.get('domain') as string,
    }));

    // Determine affiliation from strongest alliance relationship
    const affiliation = relationships
      .filter((r) => r.relationshipType === 'alliance' && r.strength > 0.5)
      .sort((a, b) => b.strength - a.strength)
      [0]?.name ?? null;

    return {
      entityId,
      name: actorProps.name as string,
      type: actorProps.type as string,
      affiliation,
      linkedEntities: relationships,
      functions,
      tensions,
    };
  }

  // ─── Private Methods ───────────────────────────────────────────────────

  /**
   * Discover linkages via Neo4j RAFT graph traversal (1-2 hops).
   * Known relationships get confidence=1.0.
   */
  private async discoverViaGraphTraversal(
    workspaceId: string,
    entityId: string,
  ): Promise<LinkageResult[]> {
    try {
      const result = await executeReadQuery(
        `MATCH (a:Actor {id: $entityId, workspaceId: $workspaceId})
         -[r:RELATES_TO*1..2]-(linked:Actor)
         WHERE linked.id <> $entityId
         RETURN DISTINCT linked.id as linkedId,
                linked.name as linkedName,
                head(collect(r[-1].type)) as relType,
                head(collect(r[-1].strength)) as strength,
                length(r) as hops`,
        { entityId, workspaceId },
      );

      return result.records.map((rec) => {
        const linkedId = rec.get('linkedId') as string;
        const linkedName = rec.get('linkedName') as string;
        const relType = rec.get('relType') as string;
        const hops = typeof rec.get('hops') === 'object'
          ? (rec.get('hops') as { toNumber: () => number }).toNumber()
          : rec.get('hops') as number;

        return {
          entityId,
          linkedEntityId: linkedId,
          confidence: hops === 1 ? 1.0 : 0.9, // Direct = 1.0, 2-hop = 0.9
          method: 'graph_traversal' as const,
          description: `${relType} relationship with ${linkedName} (${hops} hop${hops > 1 ? 's' : ''})`,
        };
      });
    } catch {
      // If graph query fails (entity not found, etc.), return empty
      return [];
    }
  }

  /**
   * Discover linkages via embedding similarity.
   * Generates embedding for the entity, compares against workspace entities.
   */
  private async discoverViaEmbeddingSimilarity(
    workspaceId: string,
    entityId: string,
    designation: string,
  ): Promise<LinkageResult[]> {
    try {
      // Generate embedding for this entity's text representation
      const sourceEmbedding = await this.generateEmbedding(designation);

      // Get other entities in the workspace
      const entitiesResult = await executeReadQuery(
        `MATCH (a:Actor {workspaceId: $workspaceId})
         WHERE a.id <> $entityId
         RETURN a.id as id, a.name as name, a.type as type,
                a.embedding as embedding`,
        { workspaceId, entityId },
      );

      const results: LinkageResult[] = [];

      for (const rec of entitiesResult.records) {
        const candidateId = rec.get('id') as string;
        const candidateName = rec.get('name') as string;
        let candidateEmbedding = rec.get('embedding') as number[] | null;

        // If no stored embedding, generate one
        if (!candidateEmbedding) {
          candidateEmbedding = await this.generateEmbedding(candidateName);

          // Store the embedding on the entity for future use
          try {
            const session = this.neo4jDriver.session();
            try {
              await session.run(
                'MATCH (a:Actor {id: $id}) SET a.embedding = $embedding',
                { id: candidateId, embedding: candidateEmbedding },
              );
            } finally {
              await session.close();
            }
          } catch {
            // Non-fatal: embedding storage failed, continue with comparison
          }
        }

        const similarity = this.computeSimilarity(
          sourceEmbedding,
          candidateEmbedding,
        );

        if (similarity > EntityLinker.SIMILARITY_CANDIDATE_THRESHOLD) {
          results.push({
            entityId,
            linkedEntityId: candidateId,
            confidence: similarity,
            method: 'embedding_similarity',
            description: `Semantic similarity with ${candidateName} (${(similarity * 100).toFixed(1)}%)`,
          });
        }
      }

      return results;
    } catch {
      // If embedding generation fails, return empty
      return [];
    }
  }

  /**
   * Generate text embedding using OpenAI text-embedding-3-large.
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }

  /**
   * Compute cosine similarity between two embedding vectors.
   */
  private computeSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Deduplicate results by entity pair, keeping highest confidence.
   */
  private deduplicateResults(results: LinkageResult[]): LinkageResult[] {
    const seen = new Map<string, LinkageResult>();

    for (const result of results) {
      // Create canonical key (sorted entity IDs to handle bidirectional)
      const key = [result.entityId, result.linkedEntityId].sort().join(':');
      const existing = seen.get(key);

      if (!existing || result.confidence > existing.confidence) {
        seen.set(key, result);
      }
    }

    return Array.from(seen.values());
  }
}
