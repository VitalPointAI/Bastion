/**
 * Tension Store
 *
 * CRUD operations for Tension nodes in the Neo4j graph database.
 * Tensions represent points of friction or potential conflict between actors,
 * with intensity levels and domain classifications per PMESII framework.
 *
 * Phase 47 Plan 03: Rewritten with JSON-LD-native property writes on all
 * create/update operations. Soft delete via validTo replaces hard delete.
 */

import { randomUUID } from 'crypto';
import { executeReadQuery, executeWriteQuery } from '../neo4j-client.js';
import type { Tension, TensionInput, TensionIntensity, TensionDomain } from './types.js';
import type { SourceMethod } from '../provenance-types.js';
import { SOURCE_WEIGHTS } from '../confidence-calculator.js';

const BASTION_CONTEXT = 'https://bastion.vitalpoint.ai/ontology/context.jsonld';
const TENSION_JSONLD_TYPE = 'cco:InformationBearingEntity';

/**
 * Convert Neo4j record to Tension object.
 * JSON-LD fields default to migration values when not yet present on nodes
 * (pre-migration backward compat — see Phase 47 migration script).
 */
function recordToTension(record: Record<string, unknown>): Tension {
  return {
    // Existing fields
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
    containerIds: record.containerIds as string[] || [],
    createdAt: new Date(record.createdAt as string),
    updatedAt: new Date(record.updatedAt as string),
    // JSON-LD fields (Phase 47) — defaults for pre-migration nodes
    jsonldType: (record.jsonldType as string) || 'cco:Process',
    jsonldContext: (record.jsonldContext as string) || BASTION_CONTEXT,
    assertedBy: (record.assertedBy as string) || 'system:migration',
    assertedVia: (record.assertedVia as SourceMethod) || 'manual_entry',
    derivedFrom: (record.derivedFrom as string) || '[]',
    confidence: typeof record.confidence === 'number' ? record.confidence : 0.75,
    sourceWeight: typeof record.sourceWeight === 'number' ? record.sourceWeight : 0.75,
    validFrom: (record.validFrom as string) || (record.createdAt as string),
    validTo: (record.validTo as string | null) ?? null,
    halfLifeDays: typeof record.halfLifeDays === 'number' ? record.halfLifeDays : 90,
  };
}

/**
 * TensionStore - CRUD operations for Tension nodes
 */
export class TensionStore {
  /**
   * Create a new Tension node and link it to involved Actors.
   * Writes JSON-LD type, context, provenance, and temporal fields on every create.
   */
  async createTension(
    input: TensionInput,
    provenance?: {
      assertedBy?: string;
      assertedVia?: SourceMethod;
      derivedFrom?: string[];
      validFrom?: Date;
      halfLifeDays?: number;
    },
  ): Promise<Tension> {
    const id = `TEN-${randomUUID()}`;
    const now = new Date().toISOString();

    // Provenance fields with defaults
    const assertedBy = provenance?.assertedBy ?? 'system:unknown';
    const assertedVia: SourceMethod = provenance?.assertedVia ?? 'manual_entry';
    const derivedFrom = JSON.stringify(provenance?.derivedFrom ?? []);
    const sourceWeight = SOURCE_WEIGHTS[assertedVia];
    const confidence = sourceWeight;
    const validFrom = (provenance?.validFrom ?? new Date()).toISOString();
    // Tensions default to 90-day half-life (political fact type)
    const halfLifeDays = provenance?.halfLifeDays ?? 90;

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
      containerIds: input.containerIds || [],
      createdAt: now,
      updatedAt: now,
      jsonldType: TENSION_JSONLD_TYPE,
      jsonldContext: BASTION_CONTEXT,
      assertedBy,
      assertedVia,
      derivedFrom,
      confidence,
      sourceWeight,
      validFrom,
      halfLifeDays,
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
   * List all Tensions, optionally filtered by workspace, intensity, and/or domain.
   *
   * @param workspaceId - Optional workspace filter
   * @param intensity   - Optional intensity filter
   * @param domain      - Optional domain filter
   * @param atTime      - Optional point-in-time filter: only tensions valid at this time
   */
  async listTensions(
    workspaceId?: string,
    intensity?: TensionIntensity,
    domain?: TensionDomain,
    atTime?: Date,
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

    if (atTime) {
      conditions.push('t.validFrom <= $atTime AND (t.validTo IS NULL OR t.validTo > $atTime)');
      params.atTime = atTime.toISOString();
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' RETURN t ORDER BY t.intensity DESC, t.createdAt DESC';

    const result = await executeReadQuery(query, params);
    return result.records.map(r => recordToTension(r.get('t').properties));
  }

  /**
   * Update an existing Tension.
   * Recalculates sourceWeight if assertedVia changes.
   */
  async updateTension(
    id: string,
    updates: Partial<TensionInput>,
    provenance?: {
      assertedBy?: string;
      assertedVia?: SourceMethod;
      derivedFrom?: string[];
    },
  ): Promise<boolean> {
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

    if (updates.containerIds !== undefined) {
      setClauses.push('t.containerIds = $containerIds');
      params.containerIds = updates.containerIds;
    }

    // Update provenance fields if provided
    if (provenance?.assertedBy !== undefined) {
      setClauses.push('t.assertedBy = $assertedBy');
      params.assertedBy = provenance.assertedBy;
    }

    if (provenance?.assertedVia !== undefined) {
      setClauses.push('t.assertedVia = $assertedVia');
      params.assertedVia = provenance.assertedVia;
      // Recalculate sourceWeight when assertedVia changes
      const newWeight = SOURCE_WEIGHTS[provenance.assertedVia];
      setClauses.push('t.sourceWeight = $sourceWeight');
      params.sourceWeight = newWeight;
      setClauses.push('t.confidence = $confidence');
      params.confidence = newWeight;
    }

    if (provenance?.derivedFrom !== undefined) {
      setClauses.push('t.derivedFrom = $derivedFrom');
      params.derivedFrom = JSON.stringify(provenance.derivedFrom);
    }

    const result = await executeWriteQuery(`
      MATCH (t:Tension {id: $id})
      SET ${setClauses.join(', ')}
      RETURN t
    `, params);

    return result.records.length > 0;
  }

  /**
   * Soft delete a Tension by setting validTo = now.
   * Preserves temporal history — entity remains in graph but is marked expired.
   * Use purgeTension() for hard delete.
   */
  async deleteTension(id: string): Promise<boolean> {
    const result = await executeWriteQuery(`
      MATCH (t:Tension {id: $id})
      WHERE t.validTo IS NULL
      SET t.validTo = $validTo, t.updatedAt = $updatedAt
      RETURN t
    `, {
      id,
      validTo: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return result.records.length > 0;
  }

  /**
   * Hard delete a Tension by ID.
   * Also removes INVOLVES edges to Actors.
   * Prefer deleteTension() (soft delete) for temporal history preservation.
   */
  async purgeTension(id: string): Promise<boolean> {
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
