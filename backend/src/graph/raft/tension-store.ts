/**
 * Tension Store
 *
 * CRUD operations for Tension nodes in the Neo4j graph database.
 * Tensions represent points of friction or potential conflict between actors,
 * with intensity levels and domain classifications per PMESII framework.
 */

import { randomUUID } from 'crypto';
import { executeReadQuery, executeWriteQuery } from '../neo4j-client.js';
import type { Tension, TensionInput, TensionIntensity, TensionDomain } from './types.js';

/**
 * Convert Neo4j record to Tension object
 */
function recordToTension(record: Record<string, unknown>): Tension {
  return {
    id: record.id as string,
    actorIds: record.actorIds as string[] || [],
    description: record.description as string,
    intensity: record.intensity as TensionIntensity,
    domain: record.domain as TensionDomain,
    triggers: record.triggers as string[] || [],
    mitigators: record.mitigators as string[] || [],
    linkedObjectiveIds: record.linkedObjectiveIds as string[] || [],
    workspaceId: record.workspaceId as string | undefined,
    sourceDocumentIds: record.sourceDocumentIds as string[] || [],
    createdAt: new Date(record.createdAt as string),
    updatedAt: new Date(record.updatedAt as string),
  };
}

/**
 * TensionStore - CRUD operations for Tension nodes
 */
export class TensionStore {
  /**
   * Create a new Tension node and link it to involved Actors
   */
  async createTension(input: TensionInput): Promise<Tension> {
    const id = `TEN-${randomUUID()}`;
    const now = new Date().toISOString();

    // Create tension node
    const result = await executeWriteQuery(`
      CREATE (t:Tension {
        id: $id,
        actorIds: $actorIds,
        description: $description,
        intensity: $intensity,
        domain: $domain,
        triggers: $triggers,
        mitigators: $mitigators,
        linkedObjectiveIds: $linkedObjectiveIds,
        workspaceId: $workspaceId,
        sourceDocumentIds: $sourceDocumentIds,
        createdAt: $createdAt,
        updatedAt: $updatedAt
      })
      RETURN t
    `, {
      id,
      actorIds: input.actorIds,
      description: input.description,
      intensity: input.intensity,
      domain: input.domain,
      triggers: input.triggers || [],
      mitigators: input.mitigators || [],
      linkedObjectiveIds: input.linkedObjectiveIds || [],
      workspaceId: input.workspaceId || null,
      sourceDocumentIds: input.sourceDocumentIds || [],
      createdAt: now,
      updatedAt: now,
    });

    const tensionProps = result.records[0].get('t').properties;

    // Create edges from Tension to involved Actors
    for (const actorId of input.actorIds) {
      await executeWriteQuery(`
        MATCH (t:Tension {id: $tensionId})
        MATCH (a:Actor {id: $actorId})
        MERGE (t)-[:INVOLVES]->(a)
      `, { tensionId: id, actorId });
    }

    return recordToTension(tensionProps);
  }

  /**
   * Get a Tension by ID
   */
  async getTension(id: string): Promise<Tension | null> {
    const result = await executeReadQuery(`
      MATCH (t:Tension {id: $id})
      RETURN t
    `, { id });

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0].get('t').properties;
    return recordToTension(record);
  }

  /**
   * Get all Tensions involving a specific Actor
   */
  async getTensionsForActor(actorId: string): Promise<Tension[]> {
    const result = await executeReadQuery(`
      MATCH (t:Tension)-[:INVOLVES]->(a:Actor {id: $actorId})
      RETURN t
    `, { actorId });

    return result.records.map(r => recordToTension(r.get('t').properties));
  }

  /**
   * List all Tensions, optionally filtered by workspace and/or intensity
   */
  async listTensions(
    workspaceId?: string,
    intensity?: TensionIntensity,
    domain?: TensionDomain
  ): Promise<Tension[]> {
    let query = 'MATCH (t:Tension)';
    const params: Record<string, unknown> = {};
    const conditions: string[] = [];

    if (workspaceId) {
      conditions.push('t.workspaceId = $workspaceId');
      params.workspaceId = workspaceId;
    }

    if (intensity) {
      conditions.push('t.intensity = $intensity');
      params.intensity = intensity;
    }

    if (domain) {
      conditions.push('t.domain = $domain');
      params.domain = domain;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' RETURN t ORDER BY t.intensity DESC, t.createdAt DESC';

    const result = await executeReadQuery(query, params);
    return result.records.map(r => recordToTension(r.get('t').properties));
  }

  /**
   * Update an existing Tension
   */
  async updateTension(id: string, updates: Partial<TensionInput>): Promise<boolean> {
    const setClauses: string[] = ['t.updatedAt = $updatedAt'];
    const params: Record<string, unknown> = {
      id,
      updatedAt: new Date().toISOString(),
    };

    if (updates.actorIds !== undefined) {
      setClauses.push('t.actorIds = $actorIds');
      params.actorIds = updates.actorIds;

      // Update the INVOLVES relationships
      // First remove existing relationships
      await executeWriteQuery(`
        MATCH (t:Tension {id: $id})-[r:INVOLVES]->()
        DELETE r
      `, { id });

      // Then create new ones
      for (const actorId of updates.actorIds) {
        await executeWriteQuery(`
          MATCH (t:Tension {id: $tensionId})
          MATCH (a:Actor {id: $actorId})
          MERGE (t)-[:INVOLVES]->(a)
        `, { tensionId: id, actorId });
      }
    }

    if (updates.description !== undefined) {
      setClauses.push('t.description = $description');
      params.description = updates.description;
    }

    if (updates.intensity !== undefined) {
      setClauses.push('t.intensity = $intensity');
      params.intensity = updates.intensity;
    }

    if (updates.domain !== undefined) {
      setClauses.push('t.domain = $domain');
      params.domain = updates.domain;
    }

    if (updates.triggers !== undefined) {
      setClauses.push('t.triggers = $triggers');
      params.triggers = updates.triggers;
    }

    if (updates.mitigators !== undefined) {
      setClauses.push('t.mitigators = $mitigators');
      params.mitigators = updates.mitigators;
    }

    if (updates.linkedObjectiveIds !== undefined) {
      setClauses.push('t.linkedObjectiveIds = $linkedObjectiveIds');
      params.linkedObjectiveIds = updates.linkedObjectiveIds;
    }

    if (updates.workspaceId !== undefined) {
      setClauses.push('t.workspaceId = $workspaceId');
      params.workspaceId = updates.workspaceId;
    }

    if (updates.sourceDocumentIds !== undefined) {
      setClauses.push('t.sourceDocumentIds = $sourceDocumentIds');
      params.sourceDocumentIds = updates.sourceDocumentIds;
    }

    const result = await executeWriteQuery(`
      MATCH (t:Tension {id: $id})
      SET ${setClauses.join(', ')}
      RETURN t
    `, params);

    return result.records.length > 0;
  }

  /**
   * Delete a Tension by ID
   * Also removes INVOLVES edges to Actors
   */
  async deleteTension(id: string): Promise<boolean> {
    const result = await executeWriteQuery(`
      MATCH (t:Tension {id: $id})
      DETACH DELETE t
      RETURN COUNT(t) as deleted
    `, { id });

    const deleted = result.records[0]?.get('deleted');
    return deleted && deleted.toNumber() > 0;
  }

  /**
   * Link a Tension to a Strategic Objective
   */
  async linkToObjective(tensionId: string, objectiveId: string): Promise<boolean> {
    const result = await executeWriteQuery(`
      MATCH (t:Tension {id: $tensionId})
      WHERE NOT $objectiveId IN t.linkedObjectiveIds
      SET t.linkedObjectiveIds = t.linkedObjectiveIds + $objectiveId,
          t.updatedAt = $updatedAt
      RETURN t
    `, {
      tensionId,
      objectiveId,
      updatedAt: new Date().toISOString(),
    });

    return result.records.length > 0;
  }

  /**
   * Unlink a Tension from a Strategic Objective
   */
  async unlinkFromObjective(tensionId: string, objectiveId: string): Promise<boolean> {
    const result = await executeWriteQuery(`
      MATCH (t:Tension {id: $tensionId})
      SET t.linkedObjectiveIds = [x IN t.linkedObjectiveIds WHERE x <> $objectiveId],
          t.updatedAt = $updatedAt
      RETURN t
    `, {
      tensionId,
      objectiveId,
      updatedAt: new Date().toISOString(),
    });

    return result.records.length > 0;
  }

  /**
   * Get Tensions linked to a specific Strategic Objective
   */
  async getTensionsForObjective(objectiveId: string): Promise<Tension[]> {
    const result = await executeReadQuery(`
      MATCH (t:Tension)
      WHERE $objectiveId IN t.linkedObjectiveIds
      RETURN t
    `, { objectiveId });

    return result.records.map(r => recordToTension(r.get('t').properties));
  }
}

// Export singleton instance
export const tensionStore = new TensionStore();
