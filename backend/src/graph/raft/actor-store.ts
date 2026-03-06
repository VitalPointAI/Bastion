/**
 * Actor Store
 *
 * CRUD operations for Actor nodes in the Neo4j graph database.
 * Actors are entities that can take action in the operational environment:
 * nations, organizations, individuals, and non-state actors.
 */

import { randomUUID } from 'crypto';
import { executeReadQuery, executeWriteQuery } from '../neo4j-client.js';
import type { Actor, ActorInput, ActorType } from './types.js';

/**
 * Convert Neo4j record to Actor object
 */
function recordToActor(record: Record<string, unknown>): Actor {
  return {
    id: record.id as string,
    name: record.name as string,
    type: record.type as ActorType,
    aliases: record.aliases as string[] || [],
    attributes: record.attributes ? JSON.parse(record.attributes as string) : {},
    workspaceId: record.workspaceId as string | undefined,
    sourceDocumentIds: record.sourceDocumentIds as string[] || [],
    containerIds: record.containerIds as string[] || [],
    createdAt: new Date(record.createdAt as string),
    updatedAt: new Date(record.updatedAt as string),
  };
}

/**
 * ActorStore - CRUD operations for Actor nodes
 */
export class ActorStore {
  /**
   * Create a new Actor node
   */
  async createActor(input: ActorInput): Promise<Actor> {
    const id = `ACT-${randomUUID()}`;
    const now = new Date().toISOString();

    const result = await executeWriteQuery(`
      CREATE (a:Actor {
        id: $id,
        name: $name,
        type: $type,
        aliases: $aliases,
        attributes: $attributes,
        workspaceId: $workspaceId,
        sourceDocumentIds: $sourceDocumentIds,
        containerIds: $containerIds,
        createdAt: $createdAt,
        updatedAt: $updatedAt
      })
      RETURN a
    `, {
      id,
      name: input.name,
      type: input.type,
      aliases: input.aliases || [],
      attributes: JSON.stringify(input.attributes || {}),
      workspaceId: input.workspaceId || null,
      sourceDocumentIds: input.sourceDocumentIds || [],
      containerIds: input.containerIds || [],
      createdAt: now,
      updatedAt: now,
    });

    const record = result.records[0].get('a').properties;
    return recordToActor(record);
  }

  /**
   * Get an Actor by ID
   */
  async getActor(id: string): Promise<Actor | null> {
    const result = await executeReadQuery(`
      MATCH (a:Actor {id: $id})
      RETURN a
    `, { id });

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0].get('a').properties;
    return recordToActor(record);
  }

  /**
   * Find Actors by name (exact or fuzzy match)
   */
  async findActorsByName(name: string, fuzzy: boolean = false): Promise<Actor[]> {
    let result;

    if (fuzzy) {
      // Use full-text index for fuzzy matching
      result = await executeReadQuery(`
        CALL db.index.fulltext.queryNodes('actor_name_fulltext', $name)
        YIELD node
        RETURN node as a
      `, { name: `${name}~` });
    } else {
      // Exact match or case-insensitive contains
      result = await executeReadQuery(`
        MATCH (a:Actor)
        WHERE a.name = $name OR toLower(a.name) CONTAINS toLower($name)
           OR ANY(alias IN a.aliases WHERE toLower(alias) CONTAINS toLower($name))
        RETURN a
      `, { name });
    }

    return result.records.map(r => recordToActor(r.get('a').properties));
  }

  /**
   * List all Actors, optionally filtered by workspace and/or type
   */
  async listActors(workspaceId?: string, type?: ActorType): Promise<Actor[]> {
    let query = 'MATCH (a:Actor)';
    const params: Record<string, unknown> = {};
    const conditions: string[] = [];

    if (workspaceId) {
      conditions.push('a.workspaceId = $workspaceId');
      params.workspaceId = workspaceId;
    }

    if (type) {
      conditions.push('a.type = $type');
      params.type = type;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' RETURN a ORDER BY a.name';

    const result = await executeReadQuery(query, params);
    return result.records.map(r => recordToActor(r.get('a').properties));
  }

  /**
   * Update an existing Actor
   */
  async updateActor(id: string, updates: Partial<ActorInput>): Promise<boolean> {
    const setClauses: string[] = ['a.updatedAt = $updatedAt'];
    const params: Record<string, unknown> = {
      id,
      updatedAt: new Date().toISOString(),
    };

    if (updates.name !== undefined) {
      setClauses.push('a.name = $name');
      params.name = updates.name;
    }

    if (updates.type !== undefined) {
      setClauses.push('a.type = $type');
      params.type = updates.type;
    }

    if (updates.aliases !== undefined) {
      setClauses.push('a.aliases = $aliases');
      params.aliases = updates.aliases;
    }

    if (updates.attributes !== undefined) {
      setClauses.push('a.attributes = $attributes');
      params.attributes = JSON.stringify(updates.attributes);
    }

    if (updates.workspaceId !== undefined) {
      setClauses.push('a.workspaceId = $workspaceId');
      params.workspaceId = updates.workspaceId;
    }

    if (updates.sourceDocumentIds !== undefined) {
      setClauses.push('a.sourceDocumentIds = $sourceDocumentIds');
      params.sourceDocumentIds = updates.sourceDocumentIds;
    }

    if (updates.containerIds !== undefined) {
      setClauses.push('a.containerIds = $containerIds');
      params.containerIds = updates.containerIds;
    }

    const result = await executeWriteQuery(`
      MATCH (a:Actor {id: $id})
      SET ${setClauses.join(', ')}
      RETURN a
    `, params);

    return result.records.length > 0;
  }

  /**
   * Delete an Actor by ID
   * Note: This will also delete all relationships involving this actor
   */
  async deleteActor(id: string): Promise<boolean> {
    const result = await executeWriteQuery(`
      MATCH (a:Actor {id: $id})
      DETACH DELETE a
      RETURN COUNT(a) as deleted
    `, { id });

    const deleted = result.records[0]?.get('deleted');
    return deleted && deleted.toNumber() > 0;
  }

  /**
   * Add an alias to an existing Actor
   */
  async addAlias(actorId: string, alias: string): Promise<boolean> {
    const result = await executeWriteQuery(`
      MATCH (a:Actor {id: $actorId})
      WHERE NOT $alias IN a.aliases
      SET a.aliases = a.aliases + $alias, a.updatedAt = $updatedAt
      RETURN a
    `, {
      actorId,
      alias,
      updatedAt: new Date().toISOString(),
    });

    return result.records.length > 0;
  }

  /**
   * Merge two Actors - source is merged into target
   * The source actor is deleted and all its relationships are transferred to target
   */
  async mergeActors(sourceId: string, targetId: string): Promise<Actor | null> {
    // First, get both actors to merge their data
    const source = await this.getActor(sourceId);
    const target = await this.getActor(targetId);

    if (!source || !target) {
      return null;
    }

    // Merge aliases (combine unique values)
    const mergedAliases = [...new Set([
      ...target.aliases,
      ...source.aliases,
      source.name, // Add source name as an alias
    ])].filter(a => a !== target.name); // Don't include target name as alias

    // Merge source document IDs
    const mergedSourceDocs = [...new Set([
      ...target.sourceDocumentIds,
      ...source.sourceDocumentIds,
    ])];

    // Merge attributes (target takes precedence)
    const mergedAttributes = {
      ...source.attributes,
      ...target.attributes,
    };

    // Transfer all relationships from source to target
    await executeWriteQuery(`
      MATCH (source:Actor {id: $sourceId})-[r]->(other)
      MATCH (target:Actor {id: $targetId})
      CREATE (target)-[newRel:RELATES_TO]->(other)
      SET newRel = properties(r)
      DELETE r
    `, { sourceId, targetId });

    await executeWriteQuery(`
      MATCH (other)-[r]->(source:Actor {id: $sourceId})
      MATCH (target:Actor {id: $targetId})
      CREATE (other)-[newRel:RELATES_TO]->(target)
      SET newRel = properties(r)
      DELETE r
    `, { sourceId, targetId });

    // Update target with merged data
    await executeWriteQuery(`
      MATCH (a:Actor {id: $targetId})
      SET a.aliases = $aliases,
          a.sourceDocumentIds = $sourceDocumentIds,
          a.attributes = $attributes,
          a.updatedAt = $updatedAt
    `, {
      targetId,
      aliases: mergedAliases,
      sourceDocumentIds: mergedSourceDocs,
      attributes: JSON.stringify(mergedAttributes),
      updatedAt: new Date().toISOString(),
    });

    // Delete the source actor
    await this.deleteActor(sourceId);

    // Return the updated target
    return this.getActor(targetId);
  }
}

// Export singleton instance
export const actorStore = new ActorStore();
