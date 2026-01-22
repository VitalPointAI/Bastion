/**
 * Relationship Store
 *
 * CRUD operations for relationships between Actors in the Neo4j graph database.
 * Relationships connect actors with typed edges (alliance, conflict, dependency, etc.)
 * and include strength values from -1.0 (hostile) to 1.0 (allied).
 */

import { randomUUID } from 'crypto';
import { executeReadQuery, executeWriteQuery } from '../neo4j-client.js';
import type { Relationship, RelationshipInput, RelationshipType } from './types.js';

/**
 * Convert Neo4j relationship record to Relationship object
 */
function recordToRelationship(
  relProps: Record<string, unknown>,
  sourceId: string,
  targetId: string
): Relationship {
  return {
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
    createdAt: new Date(relProps.createdAt as string),
    updatedAt: new Date(relProps.updatedAt as string),
  };
}

/**
 * RelationshipStore - CRUD operations for Actor relationships
 */
export class RelationshipStore {
  /**
   * Create a new Relationship between two Actors
   */
  async createRelationship(input: RelationshipInput): Promise<Relationship> {
    const id = `REL-${randomUUID()}`;
    const now = new Date().toISOString();

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
        createdAt: $createdAt,
        updatedAt: $updatedAt
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
      createdAt: now,
      updatedAt: now,
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
   * @param direction - 'in' (incoming), 'out' (outgoing), or 'both' (default)
   */
  async getActorRelationships(
    actorId: string,
    direction: 'in' | 'out' | 'both' = 'both'
  ): Promise<Relationship[]> {
    let query: string;

    switch (direction) {
      case 'out':
        query = `
          MATCH (source:Actor {id: $actorId})-[r:RELATES_TO]->(target:Actor)
          RETURN r, source.id as sourceId, target.id as targetId
        `;
        break;
      case 'in':
        query = `
          MATCH (source:Actor)-[r:RELATES_TO]->(target:Actor {id: $actorId})
          RETURN r, source.id as sourceId, target.id as targetId
        `;
        break;
      default: // 'both'
        query = `
          MATCH (source:Actor)-[r:RELATES_TO]->(target:Actor)
          WHERE source.id = $actorId OR target.id = $actorId
          RETURN r, source.id as sourceId, target.id as targetId
        `;
    }

    const result = await executeReadQuery(query, { actorId });

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
   * Update an existing Relationship
   */
  async updateRelationship(id: string, updates: Partial<RelationshipInput>): Promise<boolean> {
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

    const result = await executeWriteQuery(`
      MATCH ()-[r:RELATES_TO {id: $id}]->()
      SET ${setClauses.join(', ')}
      RETURN r
    `, params);

    return result.records.length > 0;
  }

  /**
   * Delete a Relationship by ID
   */
  async deleteRelationship(id: string): Promise<boolean> {
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
