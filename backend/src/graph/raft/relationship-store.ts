/**
 * Relationship Store
 *
 * CRUD operations for relationships between Actors in the Neo4j graph database.
 * Relationships connect actors with typed edges (alliance, conflict, dependency, etc.)
 * and include strength values from -1.0 (hostile) to 1.0 (allied).
 *
 * Phase 47 Plan 03: Rewritten with JSON-LD-native property writes on all
 * create/update operations. Soft delete via validTo replaces hard delete.
 */

import { randomUUID } from 'crypto';
import { executeReadQuery, executeWriteQuery } from '../neo4j-client.js';
import type { Relationship, RelationshipInput, RelationshipType } from './types.js';
import type { SourceMethod } from '../provenance-types.js';
import { SOURCE_WEIGHTS } from '../confidence-calculator.js';

const BASTION_CONTEXT = 'https://bastion.vitalpoint.ai/ontology/context.jsonld';
const RELATIONSHIP_JSONLD_TYPE = 'cco:ActOfRelating';

/**
 * Convert Neo4j relationship record to Relationship object.
 * JSON-LD fields default to migration values when not yet present on nodes
 * (pre-migration backward compat — see Phase 47 migration script).
 */
function recordToRelationship(
  relProps: Record<string, unknown>,
  sourceId: string,
  targetId: string
): Relationship {
  return {
    // Existing fields
    id: relProps.id as string,
    sourceActorId: sourceId,
    targetActorId: targetId,
    type: relProps.type as RelationshipType,
    strength: typeof relProps.strength === 'object'
      ? (relProps.strength as { toNumber: () => number }).toNumber()
      : relProps.strength as number,
    description: relProps.description as string | undefined,
    evidence: relProps.evidence as string[] || [],
    temporalStart: relProps.temporalStart ? new Date(relProps.temporalStart as string) : undefined,
    temporalEnd: relProps.temporalEnd ? new Date(relProps.temporalEnd as string) : undefined,
    workspaceId: relProps.workspaceId as string | undefined,
    sourceDocumentIds: relProps.sourceDocumentIds as string[] || [],
    containerIds: relProps.containerIds as string[] || [],
    createdAt: new Date(relProps.createdAt as string),
    updatedAt: new Date(relProps.updatedAt as string),
    // JSON-LD fields (Phase 47) — defaults for pre-migration nodes
    jsonldType: (relProps.jsonldType as string) || 'cco:Process',
    jsonldContext: (relProps.jsonldContext as string) || BASTION_CONTEXT,
    assertedBy: (relProps.assertedBy as string) || 'system:migration',
    assertedVia: (relProps.assertedVia as SourceMethod) || 'manual_entry',
    derivedFrom: (relProps.derivedFrom as string) || '[]',
    confidence: typeof relProps.confidence === 'number' ? relProps.confidence : 0.75,
    sourceWeight: typeof relProps.sourceWeight === 'number' ? relProps.sourceWeight : 0.75,
    validFrom: (relProps.validFrom as string) || (relProps.createdAt as string),
    validTo: (relProps.validTo as string | null) ?? null,
    halfLifeDays: typeof relProps.halfLifeDays === 'number' ? relProps.halfLifeDays : 365,
  };
}

/**
 * RelationshipStore - CRUD operations for Actor relationships
 */
export class RelationshipStore {
  /**
   * Create a new Relationship between two Actors.
   * Writes JSON-LD type, context, provenance, and temporal fields on every create.
   */
  async createRelationship(
    input: RelationshipInput,
    provenance?: {
      assertedBy?: string;
      assertedVia?: SourceMethod;
      derivedFrom?: string[];
      validFrom?: Date;
      halfLifeDays?: number;
    },
  ): Promise<Relationship> {
    const id = `REL-${randomUUID()}`;
    const now = new Date().toISOString();

    // Provenance fields with defaults
    const assertedBy = provenance?.assertedBy ?? 'system:unknown';
    const assertedVia: SourceMethod = provenance?.assertedVia ?? 'manual_entry';
    const derivedFrom = JSON.stringify(provenance?.derivedFrom ?? []);
    const sourceWeight = SOURCE_WEIGHTS[assertedVia];
    const confidence = sourceWeight;
    const validFrom = (provenance?.validFrom ?? new Date()).toISOString();
    const halfLifeDays = provenance?.halfLifeDays ?? 365;

    // Create relationship edge between actors
    // We use a generic RELATES_TO relationship type in Neo4j
    // and store the semantic type as a property
    const result = await executeWriteQuery(`
      MATCH (source:Actor {id: $sourceActorId})
      MATCH (target:Actor {id: $targetActorId})
      CREATE (source)-[r:RELATES_TO {
        id: $id,
        type: $type,
        strength: $strength,
        description: $description,
        evidence: $evidence,
        temporalStart: $temporalStart,
        temporalEnd: $temporalEnd,
        workspaceId: $workspaceId,
        sourceDocumentIds: $sourceDocumentIds,
        containerIds: $containerIds,
        createdAt: $createdAt,
        updatedAt: $updatedAt,
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
      }]->(target)
      RETURN r, source.id as sourceId, target.id as targetId
    `, {
      id,
      sourceActorId: input.sourceActorId,
      targetActorId: input.targetActorId,
      type: input.type,
      strength: input.strength,
      description: input.description || null,
      evidence: input.evidence || [],
      temporalStart: input.temporalStart?.toISOString() || null,
      temporalEnd: input.temporalEnd?.toISOString() || null,
      workspaceId: input.workspaceId || null,
      sourceDocumentIds: input.sourceDocumentIds || [],
      containerIds: input.containerIds || [],
      createdAt: now,
      updatedAt: now,
      jsonldType: RELATIONSHIP_JSONLD_TYPE,
      jsonldContext: BASTION_CONTEXT,
      assertedBy,
      assertedVia,
      derivedFrom,
      confidence,
      sourceWeight,
      validFrom,
      halfLifeDays,
    });

    if (result.records.length === 0) {
      throw new Error('Failed to create relationship - actors may not exist');
    }

    const record = result.records[0];
    const relProps = record.get('r').properties;
    return recordToRelationship(
      relProps,
      record.get('sourceId'),
      record.get('targetId')
    );
  }

  /**
   * Get a Relationship by ID
   */
  async getRelationship(id: string): Promise<Relationship | null> {
    const result = await executeReadQuery(`
      MATCH (source:Actor)-[r:RELATES_TO {id: $id}]->(target:Actor)
      RETURN r, source.id as sourceId, target.id as targetId
    `, { id });

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    const relProps = record.get('r').properties;
    return recordToRelationship(
      relProps,
      record.get('sourceId'),
      record.get('targetId')
    );
  }

  /**
   * Get all Relationships between two specific Actors
   */
  async getRelationshipsBetween(actor1Id: string, actor2Id: string): Promise<Relationship[]> {
    // Get relationships in both directions
    const result = await executeReadQuery(`
      MATCH (a1:Actor {id: $actor1Id})-[r:RELATES_TO]->(a2:Actor {id: $actor2Id})
      RETURN r, a1.id as sourceId, a2.id as targetId
      UNION
      MATCH (a2:Actor {id: $actor2Id})-[r:RELATES_TO]->(a1:Actor {id: $actor1Id})
      RETURN r, a2.id as sourceId, a1.id as targetId
    `, { actor1Id, actor2Id });

    return result.records.map(record => {
      const relProps = record.get('r').properties;
      return recordToRelationship(
        relProps,
        record.get('sourceId'),
        record.get('targetId')
      );
    });
  }

  /**
   * Get all Relationships involving a specific Actor
   * @param actorId   - Actor to query
   * @param direction - 'in' (incoming), 'out' (outgoing), or 'both' (default)
   * @param atTime    - Optional point-in-time filter
   */
  async getActorRelationships(
    actorId: string,
    direction: 'in' | 'out' | 'both' = 'both',
    atTime?: Date,
  ): Promise<Relationship[]> {
    const temporalClause = atTime
      ? ' AND r.validFrom <= $atTime AND (r.validTo IS NULL OR r.validTo > $atTime)'
      : '';
    const params: Record<string, unknown> = { actorId };
    if (atTime) params.atTime = atTime.toISOString();

    let query: string;

    switch (direction) {
      case 'out':
        query = `
          MATCH (source:Actor {id: $actorId})-[r:RELATES_TO]->(target:Actor)
          WHERE true${temporalClause}
          RETURN r, source.id as sourceId, target.id as targetId
        `;
        break;
      case 'in':
        query = `
          MATCH (source:Actor)-[r:RELATES_TO]->(target:Actor {id: $actorId})
          WHERE true${temporalClause}
          RETURN r, source.id as sourceId, target.id as targetId
        `;
        break;
      default: // 'both'
        query = `
          MATCH (source:Actor)-[r:RELATES_TO]->(target:Actor)
          WHERE (source.id = $actorId OR target.id = $actorId)${temporalClause}
          RETURN r, source.id as sourceId, target.id as targetId
        `;
    }

    const result = await executeReadQuery(query, params);

    return result.records.map(record => {
      const relProps = record.get('r').properties;
      return recordToRelationship(
        relProps,
        record.get('sourceId'),
        record.get('targetId')
      );
    });
  }

  /**
   * List all Relationships, optionally filtered by workspace.
   *
   * @param workspaceId - Optional workspace filter
   * @param atTime      - Optional point-in-time filter: only relationships valid at this time
   */
  async listRelationships(workspaceId?: string, atTime?: Date): Promise<Relationship[]> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (workspaceId) {
      conditions.push('r.workspaceId = $workspaceId');
      params.workspaceId = workspaceId;
    }

    if (atTime) {
      conditions.push('r.validFrom <= $atTime AND (r.validTo IS NULL OR r.validTo > $atTime)');
      params.atTime = atTime.toISOString();
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      MATCH (source:Actor)-[r:RELATES_TO]->(target:Actor)${whereClause}
      RETURN r, source.id as sourceId, target.id as targetId
      ORDER BY r.createdAt DESC
    `;

    const result = await executeReadQuery(query, params);

    return result.records.map(record => {
      const relProps = record.get('r').properties;
      return recordToRelationship(
        relProps,
        record.get('sourceId'),
        record.get('targetId')
      );
    });
  }

  /**
   * Update an existing Relationship.
   * Recalculates sourceWeight if assertedVia changes.
   * Writes updated JSON-LD and provenance fields.
   */
  async updateRelationship(
    id: string,
    updates: Partial<RelationshipInput>,
    provenance?: {
      assertedBy?: string;
      assertedVia?: SourceMethod;
      derivedFrom?: string[];
    },
  ): Promise<boolean> {
    const setClauses: string[] = ['r.updatedAt = $updatedAt'];
    const params: Record<string, unknown> = {
      id,
      updatedAt: new Date().toISOString(),
    };

    if (updates.type !== undefined) {
      setClauses.push('r.type = $type');
      params.type = updates.type;
    }

    if (updates.strength !== undefined) {
      setClauses.push('r.strength = $strength');
      params.strength = updates.strength;
    }

    if (updates.description !== undefined) {
      setClauses.push('r.description = $description');
      params.description = updates.description;
    }

    if (updates.evidence !== undefined) {
      setClauses.push('r.evidence = $evidence');
      params.evidence = updates.evidence;
    }

    if (updates.temporalStart !== undefined) {
      setClauses.push('r.temporalStart = $temporalStart');
      params.temporalStart = updates.temporalStart?.toISOString() || null;
    }

    if (updates.temporalEnd !== undefined) {
      setClauses.push('r.temporalEnd = $temporalEnd');
      params.temporalEnd = updates.temporalEnd?.toISOString() || null;
    }

    if (updates.workspaceId !== undefined) {
      setClauses.push('r.workspaceId = $workspaceId');
      params.workspaceId = updates.workspaceId;
    }

    if (updates.sourceDocumentIds !== undefined) {
      setClauses.push('r.sourceDocumentIds = $sourceDocumentIds');
      params.sourceDocumentIds = updates.sourceDocumentIds;
    }

    if (updates.containerIds !== undefined) {
      setClauses.push('r.containerIds = $containerIds');
      params.containerIds = updates.containerIds;
    }

    // Update provenance fields if provided
    if (provenance?.assertedBy !== undefined) {
      setClauses.push('r.assertedBy = $assertedBy');
      params.assertedBy = provenance.assertedBy;
    }

    if (provenance?.assertedVia !== undefined) {
      setClauses.push('r.assertedVia = $assertedVia');
      params.assertedVia = provenance.assertedVia;
      // Recalculate sourceWeight when assertedVia changes
      const newWeight = SOURCE_WEIGHTS[provenance.assertedVia];
      setClauses.push('r.sourceWeight = $sourceWeight');
      params.sourceWeight = newWeight;
      setClauses.push('r.confidence = $confidence');
      params.confidence = newWeight;
    }

    if (provenance?.derivedFrom !== undefined) {
      setClauses.push('r.derivedFrom = $derivedFrom');
      params.derivedFrom = JSON.stringify(provenance.derivedFrom);
    }

    const result = await executeWriteQuery(`
      MATCH ()-[r:RELATES_TO {id: $id}]->()
      SET ${setClauses.join(', ')}
      RETURN r
    `, params);

    return result.records.length > 0;
  }

  /**
   * Soft delete a Relationship by setting validTo = now.
   * Preserves temporal history — relationship remains in graph but is marked expired.
   * Use purgeRelationship() for hard delete.
   */
  async deleteRelationship(id: string): Promise<boolean> {
    const result = await executeWriteQuery(`
      MATCH ()-[r:RELATES_TO {id: $id}]->()
      WHERE r.validTo IS NULL
      SET r.validTo = $validTo, r.updatedAt = $updatedAt
      RETURN r
    `, {
      id,
      validTo: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return result.records.length > 0;
  }

  /**
   * Hard delete a Relationship by ID.
   * Prefer deleteRelationship() (soft delete) for temporal history preservation.
   */
  async purgeRelationship(id: string): Promise<boolean> {
    const result = await executeWriteQuery(`
      MATCH ()-[r:RELATES_TO {id: $id}]->()
      DELETE r
      RETURN COUNT(r) as deleted
    `, { id });

    const deleted = result.records[0]?.get('deleted');
    return deleted && deleted.toNumber() > 0;
  }
}

// Export singleton instance
export const relationshipStore = new RelationshipStore();
