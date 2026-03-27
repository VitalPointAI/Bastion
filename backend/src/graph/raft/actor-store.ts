/**
 * Actor Store
 *
 * CRUD operations for Actor nodes in the Neo4j graph database.
 * Actors are entities that can take action in the operational environment:
 * nations, organizations, individuals, and non-state actors.
 *
 * Phase 47 Plan 03: Rewritten with JSON-LD-native property writes on all
 * create/update operations. All new entities carry jsonldType, jsonldContext,
 * provenance (assertedBy/Via/From), temporal (validFrom/validTo/halfLifeDays),
 * and confidence fields. Soft delete via validTo replaces hard delete.
 */

import { randomUUID } from 'crypto';
import { executeReadQuery, executeWriteQuery } from '../neo4j-client.js';
import type { Actor, ActorInput, ActorType } from './types.js';
import { ACTOR_TYPE_TO_CCO_MAP } from './types.js';
import type { SourceMethod } from '../provenance-types.js';
import { SOURCE_WEIGHTS } from '../confidence-calculator.js';

const BASTION_CONTEXT = 'https://bastion.vitalpoint.ai/ontology/context.jsonld';

/**
 * Convert Neo4j record to Actor object.
 * JSON-LD fields default to migration values when not yet present on nodes
 * (pre-migration backward compat — see Phase 47 migration script).
 */
function recordToActor(record: Record<string, unknown>): Actor {
  return {
    // Existing fields
    id: record.id as string,
    name: record.name as string,
    type: record.type as ActorType,
    aliases: record.aliases as string[] || [],
    attributes: record.attributes ? JSON.parse(record.attributes as string) : {},
    attributesJson: record.attributesJson as string | undefined,
    attributes_affiliation: record.attributes_affiliation as string | undefined,
    attributes_echelon: record.attributes_echelon as string | undefined,
    attributes_unitType: record.attributes_unitType as string | undefined,
    attributes_lat: record.attributes_lat as number | undefined,
    attributes_lng: record.attributes_lng as number | undefined,
    workspaceId: record.workspaceId as string | undefined,
    sourceDocumentIds: record.sourceDocumentIds as string[] || [],
    containerIds: record.containerIds as string[] || [],
    createdAt: new Date(record.createdAt as string),
    updatedAt: new Date(record.updatedAt as string),
    // JSON-LD fields (Phase 47) — defaults for pre-migration nodes
    jsonldType: (record.jsonldType as string) || 'cco:Agent',
    jsonldContext: (record.jsonldContext as string) || BASTION_CONTEXT,
    assertedBy: (record.assertedBy as string) || 'system:migration',
    assertedVia: (record.assertedVia as SourceMethod) || 'manual_entry',
    derivedFrom: (record.derivedFrom as string) || '[]',
    confidence: typeof record.confidence === 'number' ? record.confidence : 0.75,
    sourceWeight: typeof record.sourceWeight === 'number' ? record.sourceWeight : 0.75,
    validFrom: (record.validFrom as string) || (record.createdAt as string),
    validTo: (record.validTo as string | null) ?? null,
    halfLifeDays: typeof record.halfLifeDays === 'number' ? record.halfLifeDays : 180,
    natoSourceReliability: (record.natoSourceReliability as string) || undefined,
    natoInformationCredibility: typeof record.natoInformationCredibility === 'number' ? record.natoInformationCredibility : undefined,
  };
}

/**
 * ActorStore - CRUD operations for Actor nodes
 */
export class ActorStore {
  /**
   * Create a new Actor node.
   * Writes JSON-LD type, context, provenance, and temporal fields on every create.
   */
  async createActor(
    input: ActorInput,
    provenance?: {
      assertedBy?: string;
      assertedVia?: SourceMethod;
      derivedFrom?: string[];
      validFrom?: Date;
      halfLifeDays?: number;
      natoSourceReliability?: string;
      natoInformationCredibility?: number;
    },
  ): Promise<Actor> {
    const id = `ACT-${randomUUID()}`;
    const now = new Date().toISOString();

    // Resolve JSON-LD type from actor type using ACTOR_TYPE_TO_CCO_MAP
    const jsonldType = ACTOR_TYPE_TO_CCO_MAP[input.type] ?? ACTOR_TYPE_TO_CCO_MAP['default'];

    // Provenance fields with defaults
    const assertedBy = provenance?.assertedBy ?? 'system:unknown';
    const assertedVia: SourceMethod = provenance?.assertedVia ?? 'manual_entry';
    const derivedFrom = JSON.stringify(provenance?.derivedFrom ?? []);
    const sourceWeight = SOURCE_WEIGHTS[assertedVia];
    const confidence = sourceWeight;
    const validFrom = (provenance?.validFrom ?? new Date()).toISOString();
    const halfLifeDays = provenance?.halfLifeDays ?? 180;

    // Promote attributes to top-level queryable properties
    const attrs = input.attributes ?? {};
    const attributes_affiliation = (attrs['affiliation'] as string | undefined) ?? null;
    const attributes_echelon = (attrs['echelon'] as string | undefined) ?? null;
    const attributes_unitType = (attrs['unitType'] as string | undefined) ?? null;
    const attributes_lat = (attrs['lat'] as number | undefined) ?? null;
    const attributes_lng = (attrs['lng'] as number | undefined) ?? null;

    const result = await executeWriteQuery(`
      CREATE (a:Actor {
        id: $id,
        name: $name,
        type: $type,
        aliases: $aliases,
        attributes: $attributes,
        attributes_affiliation: $attributes_affiliation,
        attributes_echelon: $attributes_echelon,
        attributes_unitType: $attributes_unitType,
        attributes_lat: $attributes_lat,
        attributes_lng: $attributes_lng,
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
        halfLifeDays: $halfLifeDays,
        natoSourceReliability: $natoSourceReliability,
        natoInformationCredibility: $natoInformationCredibility
      })
      RETURN a
    `, {
      id,
      name: input.name,
      type: input.type,
      aliases: input.aliases || [],
      attributes: JSON.stringify(input.attributes || {}),
      attributes_affiliation,
      attributes_echelon,
      attributes_unitType,
      attributes_lat,
      attributes_lng,
      workspaceId: input.workspaceId || null,
      sourceDocumentIds: input.sourceDocumentIds || [],
      containerIds: input.containerIds || [],
      createdAt: now,
      updatedAt: now,
      jsonldType,
      jsonldContext: BASTION_CONTEXT,
      assertedBy,
      assertedVia,
      derivedFrom,
      confidence,
      sourceWeight,
      validFrom,
      halfLifeDays,
      natoSourceReliability: provenance?.natoSourceReliability ?? null,
      natoInformationCredibility: provenance?.natoInformationCredibility ?? null,
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
   * List all Actors, optionally filtered by workspace and/or type.
   *
   * @param workspaceId - Optional workspace filter
   * @param type        - Optional actor type filter
   * @param atTime      - Optional point-in-time filter: only actors valid at this time
   *                      (validFrom <= atTime AND (validTo IS NULL OR validTo > atTime))
   */
  async listActors(workspaceId?: string, type?: ActorType, atTime?: Date): Promise<Actor[]> {
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

    if (atTime) {
      conditions.push('a.validFrom <= $atTime AND (a.validTo IS NULL OR a.validTo > $atTime)');
      params.atTime = atTime.toISOString();
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' RETURN a ORDER BY a.name';

    const result = await executeReadQuery(query, params);
    return result.records.map(r => recordToActor(r.get('a').properties));
  }

  /**
   * Update an existing Actor.
   * Recalculates sourceWeight if assertedVia changes.
   * Writes updated JSON-LD and provenance fields.
   */
  async updateActor(
    id: string,
    updates: Partial<ActorInput>,
    provenance?: {
      assertedBy?: string;
      assertedVia?: SourceMethod;
      derivedFrom?: string[];
    },
  ): Promise<boolean> {
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
      // Update JSON-LD type when actor type changes
      const jsonldType = ACTOR_TYPE_TO_CCO_MAP[updates.type] ?? ACTOR_TYPE_TO_CCO_MAP['default'];
      setClauses.push('a.jsonldType = $jsonldType');
      params.jsonldType = jsonldType;
    }

    if (updates.aliases !== undefined) {
      setClauses.push('a.aliases = $aliases');
      params.aliases = updates.aliases;
    }

    if (updates.attributes !== undefined) {
      setClauses.push('a.attributes = $attributes');
      params.attributes = JSON.stringify(updates.attributes);

      // Re-promote attributes to top-level queryable properties
      const attrs = updates.attributes;
      setClauses.push('a.attributes_affiliation = $attributes_affiliation');
      params.attributes_affiliation = (attrs['affiliation'] as string | undefined) ?? null;
      setClauses.push('a.attributes_echelon = $attributes_echelon');
      params.attributes_echelon = (attrs['echelon'] as string | undefined) ?? null;
      setClauses.push('a.attributes_unitType = $attributes_unitType');
      params.attributes_unitType = (attrs['unitType'] as string | undefined) ?? null;
      setClauses.push('a.attributes_lat = $attributes_lat');
      params.attributes_lat = (attrs['lat'] as number | undefined) ?? null;
      setClauses.push('a.attributes_lng = $attributes_lng');
      params.attributes_lng = (attrs['lng'] as number | undefined) ?? null;
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

    // Update provenance fields if provided
    if (provenance?.assertedBy !== undefined) {
      setClauses.push('a.assertedBy = $assertedBy');
      params.assertedBy = provenance.assertedBy;
    }

    if (provenance?.assertedVia !== undefined) {
      setClauses.push('a.assertedVia = $assertedVia');
      params.assertedVia = provenance.assertedVia;
      // Recalculate sourceWeight when assertedVia changes
      const newWeight = SOURCE_WEIGHTS[provenance.assertedVia];
      setClauses.push('a.sourceWeight = $sourceWeight');
      params.sourceWeight = newWeight;
      setClauses.push('a.confidence = $confidence');
      params.confidence = newWeight;
    }

    if (provenance?.derivedFrom !== undefined) {
      setClauses.push('a.derivedFrom = $derivedFrom');
      params.derivedFrom = JSON.stringify(provenance.derivedFrom);
    }

    const result = await executeWriteQuery(`
      MATCH (a:Actor {id: $id})
      SET ${setClauses.join(', ')}
      RETURN a
    `, params);

    return result.records.length > 0;
  }

  /**
   * Soft delete an Actor by setting validTo = now.
   * Preserves temporal history — entity remains in graph but is marked expired.
   * Use purgeActor() for hard delete.
   */
  async deleteActor(id: string): Promise<boolean> {
    const result = await executeWriteQuery(`
      MATCH (a:Actor {id: $id})
      WHERE a.validTo IS NULL
      SET a.validTo = $validTo, a.updatedAt = $updatedAt
      RETURN a
    `, {
      id,
      validTo: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return result.records.length > 0;
  }

  /**
   * Hard delete an Actor by ID.
   * Also removes all relationships involving this actor.
   * Prefer deleteActor() (soft delete) for temporal history preservation.
   */
  async purgeActor(id: string): Promise<boolean> {
    const result = await executeWriteQuery(`
      MATCH (a:Actor {id: $id})
      DETACH DELETE a
      RETURN COUNT(a) as deleted
    `, { id });

    const deleted = result.records[0]?.get('deleted');
    return deleted && deleted.toNumber() > 0;
  }

  /**
   * List Actors valid at a specific point in time.
   * Applies temporal filter: validFrom <= atTime AND (validTo IS NULL OR validTo > atTime).
   *
   * @param workspaceId - Optional workspace filter
   * @param atTime      - Point in time for temporal validity check
   * @param type        - Optional actor type filter
   */
  async listActorsAtTime(workspaceId?: string, atTime?: Date, type?: ActorType): Promise<Actor[]> {
    return this.listActors(workspaceId, type, atTime);
  }

  /**
   * List Actors with on-read confidence decay applied.
   * Returns actors extended with a computed decayedConfidence property.
   * Uses Cypher to project the decay value: confidence * 0.5^(ageDays/halfLifeDays).
   *
   * @param workspaceId - Optional workspace filter
   * @param atTime      - Reference time for decay computation (default: now)
   */
  async listActorsWithDecay(
    workspaceId?: string,
    atTime: Date = new Date(),
  ): Promise<(Actor & { decayedConfidence: number })[]> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = { atTimeMs: atTime.getTime() };

    if (workspaceId) {
      conditions.push('a.workspaceId = $workspaceId');
      params.workspaceId = workspaceId;
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    // Project decay formula: confidence * 0.5^(ageDays/halfLifeDays)
    // ageDays = duration between validFrom and atTime in days
    const query = `
      MATCH (a:Actor)${whereClause}
      WITH a,
           (toFloat($atTimeMs) - toFloat(a.updatedAt)) / 86400000.0 AS ageDays
      WITH a,
           CASE WHEN a.halfLifeDays IS NOT NULL AND a.halfLifeDays > 0 AND a.confidence IS NOT NULL
                THEN a.confidence * (0.5 ^ (ageDays / a.halfLifeDays))
                ELSE a.confidence
           END AS decayedConf
      RETURN a, decayedConf as decayedConf
      ORDER BY a.name
    `;

    const result = await executeReadQuery(query, params);

    return result.records.map(r => {
      const actor = recordToActor(r.get('a').properties);
      const rawDecayed = r.get('decayedConf');
      const decayedConfidence = typeof rawDecayed === 'number' ? rawDecayed : actor.confidence;
      return { ...actor, decayedConfidence };
    });
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
   * The source actor is soft-deleted and all its relationships are transferred to target
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

    // Soft-delete the source actor (preserve temporal history)
    await this.deleteActor(sourceId);

    // Return the updated target
    return this.getActor(targetId);
  }
}

// Export singleton instance
export const actorStore = new ActorStore();
