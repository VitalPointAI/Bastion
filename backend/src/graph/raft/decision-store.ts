/**
 * Decision Store
 *
 * CRUD operations for Decision nodes in the Neo4j graph database.
 * Decisions capture planning choices, their evidence basis, and
 * knowledge gaps — enabling traceability of decision pathways
 * and surfacing where intuition fills evidence gaps.
 *
 * Phase 47 Plan 03: Rewritten with JSON-LD-native property writes on all
 * create/update operations. Soft delete via validTo replaces hard delete.
 */

import { randomUUID } from 'crypto';
import { executeReadQuery, executeWriteQuery } from '../neo4j-client.js';
import type { Decision, DecisionInput, DecisionBasis } from './types.js';
import type { SourceMethod } from '../provenance-types.js';
import { SOURCE_WEIGHTS } from '../confidence-calculator.js';

const BASTION_CONTEXT = 'https://bastion.vitalpoint.ai/ontology/context.jsonld';
const DECISION_JSONLD_TYPE = 'cco:ActOfDecisionMaking';

/**
 * Convert Neo4j node properties to Decision object.
 * JSON-LD fields default to migration values when not yet present on nodes
 * (pre-migration backward compat — see Phase 47 migration script).
 */
function recordToDecision(props: Record<string, unknown>): Decision {
  return {
    // Existing fields
    id: props.id as string,
    gateId: props.gateId as string | undefined,
    decisionType: props.decisionType as string,
    title: props.title as string,
    description: props.description as string,
    outcome: props.outcome as string,
    rationale: props.rationale as string,
    basis: props.basis as DecisionBasis,
    affectedActorIds: props.affectedActorIds as string[] || [],
    supportingDocumentIds: props.supportingDocumentIds as string[] || [],
    linkedObjectiveIds: props.linkedObjectiveIds as string[] || [],
    predecessorDecisionIds: props.predecessorDecisionIds as string[] || [],
    knowledgeGaps: props.knowledgeGaps as string[] || [],
    decidedBy: props.decidedBy as string,
    problemSetId: props.problemSetId as string,
    workspaceId: props.workspaceId as string | undefined,
    containerIds: props.containerIds as string[] || [],
    createdAt: new Date(props.createdAt as string),
    updatedAt: new Date(props.updatedAt as string),
    // JSON-LD fields (Phase 47) — defaults for pre-migration nodes
    jsonldType: (props.jsonldType as string) || 'cco:InformationContentEntity',
    jsonldContext: (props.jsonldContext as string) || BASTION_CONTEXT,
    assertedBy: (props.assertedBy as string) || 'system:migration',
    assertedVia: (props.assertedVia as SourceMethod) || 'manual_entry',
    derivedFrom: (props.derivedFrom as string) || '[]',
    confidence: typeof props.confidence === 'number' ? props.confidence : 0.75,
    sourceWeight: typeof props.sourceWeight === 'number' ? props.sourceWeight : 0.75,
    validFrom: (props.validFrom as string) || (props.createdAt as string),
    validTo: (props.validTo as string | null) ?? null,
    halfLifeDays: typeof props.halfLifeDays === 'number' ? props.halfLifeDays : 365,
  };
}

/**
 * Extract Decision objects from a Neo4j QueryResult, reading node 'd' (or 'n').
 */
function extractDecisions(result: { records: Array<{ get: (key: string) => { properties: Record<string, unknown> } }> }, nodeKey = 'd'): Decision[] {
  return result.records.map(rec => recordToDecision(rec.get(nodeKey).properties));
}

/**
 * DecisionStore - CRUD operations for Decision nodes in the knowledge graph
 */
export class DecisionStore {
  /**
   * Create a new Decision node and link it to related actors/decisions.
   * Writes JSON-LD type, context, provenance, and temporal fields on every create.
   */
  async createDecision(
    input: DecisionInput,
    provenance?: {
      assertedBy?: string;
      assertedVia?: SourceMethod;
      derivedFrom?: string[];
      validFrom?: Date;
      halfLifeDays?: number;
    },
  ): Promise<Decision> {
    const id = `DEC-${randomUUID()}`;
    const now = new Date().toISOString();

    // Provenance fields with defaults
    const assertedBy = provenance?.assertedBy ?? 'system:unknown';
    const assertedVia: SourceMethod = provenance?.assertedVia ?? 'manual_entry';
    const derivedFrom = JSON.stringify(provenance?.derivedFrom ?? []);
    const sourceWeight = SOURCE_WEIGHTS[assertedVia];
    const confidence = sourceWeight;
    const validFrom = (provenance?.validFrom ?? new Date()).toISOString();
    // Decisions default to 365-day half-life (capability/strategic fact type)
    const halfLifeDays = provenance?.halfLifeDays ?? 365;

    const query = `
      CREATE (d:Decision {
        id: $id,
        gateId: $gateId,
        decisionType: $decisionType,
        title: $title,
        description: $description,
        outcome: $outcome,
        rationale: $rationale,
        basis: $basis,
        affectedActorIds: $affectedActorIds,
        supportingDocumentIds: $supportingDocumentIds,
        linkedObjectiveIds: $linkedObjectiveIds,
        predecessorDecisionIds: $predecessorDecisionIds,
        knowledgeGaps: $knowledgeGaps,
        decidedBy: $decidedBy,
        problemSetId: $problemSetId,
        workspaceId: $workspaceId,
        containerIds: $containerIds,
        createdAt: $now,
        updatedAt: $now,
        jsonldType: $jsonldType,
        jsonldContext: $jsonldContext,
        assertedBy: $assertedBy,
        assertedVia: $assertedVia,
        derivedFrom: $derivedFrom,
        confidence: $confidence,
        sourceWeight: $sourceWeight,
        validFrom: $validFrom,
        validTo: null,
        halfLifeDays: $halfLifeDays
      })
      RETURN d
    `;

    const result = await executeWriteQuery(query, {
      id,
      gateId: input.gateId || null,
      decisionType: input.decisionType,
      title: input.title,
      description: input.description,
      outcome: input.outcome,
      rationale: input.rationale,
      basis: input.basis,
      affectedActorIds: input.affectedActorIds || [],
      supportingDocumentIds: input.supportingDocumentIds || [],
      linkedObjectiveIds: input.linkedObjectiveIds || [],
      predecessorDecisionIds: input.predecessorDecisionIds || [],
      knowledgeGaps: input.knowledgeGaps || [],
      decidedBy: input.decidedBy,
      problemSetId: input.problemSetId,
      workspaceId: input.workspaceId || null,
      containerIds: input.containerIds || [],
      now,
      jsonldType: DECISION_JSONLD_TYPE,
      jsonldContext: BASTION_CONTEXT,
      assertedBy,
      assertedVia,
      derivedFrom,
      confidence,
      sourceWeight,
      validFrom,
      halfLifeDays,
    });

    const props = result.records[0].get('d').properties;
    const decision = recordToDecision(props);

    // Create PRECEDED_BY edges to predecessor decisions
    if (input.predecessorDecisionIds?.length) {
      for (const predId of input.predecessorDecisionIds) {
        await executeWriteQuery(
          `MATCH (d:Decision {id: $id}), (pred:Decision {id: $predId})
           MERGE (d)-[:PRECEDED_BY]->(pred)`,
          { id, predId },
        );
      }
    }

    // Create AFFECTS edges to actors
    if (input.affectedActorIds?.length) {
      for (const actorId of input.affectedActorIds) {
        await executeWriteQuery(
          `MATCH (d:Decision {id: $id}), (a:Actor {id: $actorId})
           MERGE (d)-[:AFFECTS]->(a)`,
          { id, actorId },
        );
      }
    }

    return decision;
  }

  /**
   * Get a Decision by ID
   */
  async getDecision(id: string): Promise<Decision | null> {
    const result = await executeReadQuery(
      `MATCH (d:Decision {id: $id}) RETURN d`,
      { id },
    );
    if (result.records.length === 0) return null;
    return recordToDecision(result.records[0].get('d').properties);
  }

  /**
   * List decisions for a problem set, optionally filtered.
   *
   * @param problemSetId - Required problem set scope
   * @param options      - Optional filters: decisionType, basis, limit, atTime
   */
  async listDecisions(
    problemSetId: string,
    options?: { decisionType?: string; basis?: DecisionBasis; limit?: number; atTime?: Date },
  ): Promise<Decision[]> {
    let query = `MATCH (d:Decision {problemSetId: $problemSetId})`;
    const params: Record<string, unknown> = { problemSetId };
    const conditions: string[] = [];

    if (options?.decisionType) {
      conditions.push('d.decisionType = $decisionType');
      params.decisionType = options.decisionType;
    }
    if (options?.basis) {
      conditions.push('d.basis = $basis');
      params.basis = options.basis;
    }
    if (options?.atTime) {
      conditions.push('d.validFrom <= $atTime AND (d.validTo IS NULL OR d.validTo > $atTime)');
      params.atTime = options.atTime.toISOString();
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` RETURN d ORDER BY d.createdAt DESC`;

    if (options?.limit) {
      query += ` LIMIT $limit`;
      params.limit = options.limit;
    }

    const result = await executeReadQuery(query, params);
    return extractDecisions(result);
  }

  /**
   * Update an existing Decision.
   * Recalculates sourceWeight if assertedVia changes.
   */
  async updateDecision(
    id: string,
    updates: Partial<DecisionInput>,
    provenance?: {
      assertedBy?: string;
      assertedVia?: SourceMethod;
      derivedFrom?: string[];
    },
  ): Promise<boolean> {
    const setClauses: string[] = ['d.updatedAt = $updatedAt'];
    const params: Record<string, unknown> = {
      id,
      updatedAt: new Date().toISOString(),
    };

    if (updates.title !== undefined) {
      setClauses.push('d.title = $title');
      params.title = updates.title;
    }

    if (updates.description !== undefined) {
      setClauses.push('d.description = $description');
      params.description = updates.description;
    }

    if (updates.outcome !== undefined) {
      setClauses.push('d.outcome = $outcome');
      params.outcome = updates.outcome;
    }

    if (updates.rationale !== undefined) {
      setClauses.push('d.rationale = $rationale');
      params.rationale = updates.rationale;
    }

    if (updates.basis !== undefined) {
      setClauses.push('d.basis = $basis');
      params.basis = updates.basis;
    }

    if (updates.knowledgeGaps !== undefined) {
      setClauses.push('d.knowledgeGaps = $knowledgeGaps');
      params.knowledgeGaps = updates.knowledgeGaps;
    }

    if (updates.supportingDocumentIds !== undefined) {
      setClauses.push('d.supportingDocumentIds = $supportingDocumentIds');
      params.supportingDocumentIds = updates.supportingDocumentIds;
    }

    if (updates.linkedObjectiveIds !== undefined) {
      setClauses.push('d.linkedObjectiveIds = $linkedObjectiveIds');
      params.linkedObjectiveIds = updates.linkedObjectiveIds;
    }

    if (updates.affectedActorIds !== undefined) {
      setClauses.push('d.affectedActorIds = $affectedActorIds');
      params.affectedActorIds = updates.affectedActorIds;
    }

    // Update provenance fields if provided
    if (provenance?.assertedBy !== undefined) {
      setClauses.push('d.assertedBy = $assertedBy');
      params.assertedBy = provenance.assertedBy;
    }

    if (provenance?.assertedVia !== undefined) {
      setClauses.push('d.assertedVia = $assertedVia');
      params.assertedVia = provenance.assertedVia;
      // Recalculate sourceWeight when assertedVia changes
      const newWeight = SOURCE_WEIGHTS[provenance.assertedVia];
      setClauses.push('d.sourceWeight = $sourceWeight');
      params.sourceWeight = newWeight;
      setClauses.push('d.confidence = $confidence');
      params.confidence = newWeight;
    }

    if (provenance?.derivedFrom !== undefined) {
      setClauses.push('d.derivedFrom = $derivedFrom');
      params.derivedFrom = JSON.stringify(provenance.derivedFrom);
    }

    const result = await executeWriteQuery(
      `MATCH (d:Decision {id: $id})
       SET ${setClauses.join(', ')}
       RETURN d`,
      params,
    );

    return result.records.length > 0;
  }

  /**
   * Soft delete a Decision by setting validTo = now.
   * Preserves temporal history — entity remains in graph but is marked expired.
   * Use purgeDecision() for hard delete.
   */
  async deleteDecision(id: string): Promise<boolean> {
    const result = await executeWriteQuery(
      `MATCH (d:Decision {id: $id})
       WHERE d.validTo IS NULL
       SET d.validTo = $validTo, d.updatedAt = $updatedAt
       RETURN d`,
      {
        id,
        validTo: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    );

    return result.records.length > 0;
  }

  /**
   * Hard delete a Decision by ID.
   * Prefer deleteDecision() (soft delete) for temporal history preservation.
   */
  async purgeDecision(id: string): Promise<boolean> {
    const result = await executeWriteQuery(
      `MATCH (d:Decision {id: $id})
       DETACH DELETE d
       RETURN COUNT(d) as deleted`,
      { id },
    );

    const deleted = result.records[0]?.get('deleted');
    return deleted && deleted.toNumber() > 0;
  }

  /**
   * Get the decision chain (predecessors) leading to a decision
   */
  async getDecisionChain(decisionId: string): Promise<Decision[]> {
    const result = await executeReadQuery(
      `MATCH path = (d:Decision {id: $decisionId})-[:PRECEDED_BY*0..10]->(pred:Decision)
       UNWIND nodes(path) AS n
       WITH DISTINCT n
       RETURN n ORDER BY n.createdAt ASC`,
      { decisionId },
    );
    return extractDecisions(result, 'n');
  }

  /**
   * Find decisions with intuition-based basis (knowledge gaps)
   */
  async findKnowledgeGaps(problemSetId: string): Promise<Decision[]> {
    const result = await executeReadQuery(
      `MATCH (d:Decision {problemSetId: $problemSetId})
       WHERE d.basis = 'intuition_based' OR size(d.knowledgeGaps) > 0
       RETURN d ORDER BY d.createdAt DESC`,
      { problemSetId },
    );
    return extractDecisions(result);
  }

  /**
   * Find decisions that affect a specific actor
   */
  async getDecisionsAffectingActor(actorId: string): Promise<Decision[]> {
    const result = await executeReadQuery(
      `MATCH (d:Decision)-[:AFFECTS]->(a:Actor {id: $actorId})
       RETURN d ORDER BY d.createdAt DESC`,
      { actorId },
    );
    return extractDecisions(result);
  }

  /**
   * Get decisions linked to a specific document
   */
  async getDecisionsForDocument(documentId: string): Promise<Decision[]> {
    const result = await executeReadQuery(
      `MATCH (d:Decision)
       WHERE $documentId IN d.supportingDocumentIds
       RETURN d ORDER BY d.createdAt DESC`,
      { documentId },
    );
    return extractDecisions(result);
  }
}

// Export singleton instance
export const decisionStore = new DecisionStore();
