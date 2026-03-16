/**
 * Semantic Entity Query Module
 *
 * Provides ontology-typed Cypher queries against the JSON-LD-native RAFT graph.
 * Returns SemanticEntity[] with decayed confidence, provenance, and temporal validity.
 *
 * Used by the COP coordinator and API handlers to replace flat actorStore.listActors()
 * calls with typed, semantically-aware entity fetches.
 */

import { executeReadQuery } from '../../graph/neo4j-client.js';
import type { SemanticEntity, ProvenanceProps, SourceMethod } from '../../graph/provenance-types.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Default half-life in days when actor node has no halfLifeDays property */
const DEFAULT_HALF_LIFE_DAYS = 180;

/** Default confidence when actor node has no confidence property */
const DEFAULT_CONFIDENCE = 0.5;

/** Parse a Neo4j node's provenance fields into a ProvenanceProps object */
function parseProvenance(props: Record<string, unknown>): ProvenanceProps {
  const validMethods: SourceMethod[] = [
    'manual_entry',
    'doc_intelligence',
    'osint',
    'vision_pipeline',
    'ai_inference',
    'sigint',
  ];

  const rawMethod = props['prov_assertedVia'] ?? props['assertedVia'] ?? 'manual_entry';
  const assertedVia = validMethods.includes(rawMethod as SourceMethod)
    ? (rawMethod as SourceMethod)
    : 'manual_entry';

  return {
    assertedBy: String(props['prov_assertedBy'] ?? props['assertedBy'] ?? 'system'),
    assertedVia,
    derivedFrom: String(props['prov_derivedFrom'] ?? props['derivedFrom'] ?? '[]'),
    confidence: Number(props['prov_confidence'] ?? props['confidence'] ?? DEFAULT_CONFIDENCE),
    sourceWeight: Number(props['prov_sourceWeight'] ?? props['sourceWeight'] ?? 0.95),
  };
}

/**
 * Map a raw Neo4j record (with Actor node + computed currentConf) to SemanticEntity.
 * Extracts all known provenance/temporal fields from properties and puts the rest
 * in the `properties` bag.
 */
function mapRecordToSemanticEntity(
  nodeProps: Record<string, unknown>,
  currentConf: number,
): SemanticEntity {
  const KNOWN_KEYS = new Set([
    'id', 'name', 'workspaceId', 'jsonldType', 'confidence',
    'halfLifeDays', 'updatedAt', 'createdAt', 'validFrom', 'validTo',
    'prov_assertedBy', 'prov_assertedVia', 'prov_derivedFrom',
    'prov_confidence', 'prov_sourceWeight',
    'assertedBy', 'assertedVia', 'derivedFrom', 'sourceWeight',
  ]);

  const properties: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(nodeProps)) {
    if (!KNOWN_KEYS.has(k)) {
      properties[k] = v;
    }
  }

  const validTo = nodeProps['validTo'] as string | null | undefined;
  const temporalValid = validTo == null || new Date(validTo) > new Date();

  // currentConf comes from Cypher computation; fall back to decaying manually
  const confidence = Number.isFinite(currentConf) && currentConf >= 0
    ? currentConf
    : Number(nodeProps['confidence'] ?? DEFAULT_CONFIDENCE);

  return {
    id: String(nodeProps['id'] ?? ''),
    name: String(nodeProps['name'] ?? ''),
    jsonldType: String(nodeProps['jsonldType'] ?? 'cco:Agent'),
    confidence,
    provenance: parseProvenance(nodeProps),
    temporalValid,
    properties,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch semantic entities from Neo4j filtered by ontology type and optional affiliation.
 *
 * Applies temporal validity filter (validTo IS NULL OR validTo > now) and
 * exponential confidence decay: conf(t) = conf_0 * 0.5^(ageDays / halfLifeDays)
 *
 * @param workspaceId      Workspace (problem set) scope
 * @param typeFilters      Array of jsonldType values to include (e.g. ['cco:MilitaryOrganization'])
 * @param affiliationFilters Optional array of affiliation values (e.g. ['HOSTILE', 'NEUTRAL'])
 * @returns Array of SemanticEntity sorted by decayed confidence descending
 */
export async function fetchSemanticEntities(
  workspaceId: string,
  typeFilters: string[],
  affiliationFilters?: string[],
): Promise<SemanticEntity[]> {
  const hasAffiliation = affiliationFilters && affiliationFilters.length > 0;

  const cypher = `
    MATCH (a:Actor {workspaceId: $workspaceId})
    WHERE a.jsonldType IN $typeFilters
      AND (a.validTo IS NULL OR a.validTo > datetime())
      ${hasAffiliation ? 'AND a.attributes_affiliation IN $affiliations' : ''}
    WITH a,
      duration.between(
        datetime(COALESCE(a.updatedAt, a.createdAt, toString(datetime()))),
        datetime()
      ).days AS ageDays,
      COALESCE(a.halfLifeDays, ${DEFAULT_HALF_LIFE_DAYS}) AS halfLife,
      COALESCE(a.confidence, ${DEFAULT_CONFIDENCE}) AS baseConf
    RETURN a,
      baseConf * (0.5 ^ (toFloat(ageDays) / toFloat(halfLife))) AS currentConf
    ORDER BY currentConf DESC
  `;

  const params: Record<string, unknown> = {
    workspaceId,
    typeFilters,
  };
  if (hasAffiliation) {
    params['affiliations'] = affiliationFilters;
  }

  try {
    const result = await executeReadQuery(cypher, params);
    return result.records.map(record => {
      const nodeProps = record.get('a').properties as Record<string, unknown>;
      const currentConf = record.get('currentConf') as number;
      return mapRecordToSemanticEntity(nodeProps, currentConf);
    });
  } catch (error) {
    console.error('[COP] fetchSemanticEntities failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Fetch all temporally valid semantic entities for a workspace.
 *
 * Returns all Actor nodes regardless of jsonldType, sorted by decayed confidence.
 * Used by the COP coordinator when no specific type filter is needed — provides
 * the full entity context to all sub-agents.
 *
 * @param workspaceId  Workspace (problem set) scope
 * @returns Array of SemanticEntity sorted by decayed confidence descending
 */
export async function fetchAllSemanticEntities(workspaceId: string): Promise<SemanticEntity[]> {
  const cypher = `
    MATCH (a:Actor {workspaceId: $workspaceId})
    WHERE (a.validTo IS NULL OR a.validTo > datetime())
    WITH a,
      duration.between(
        datetime(COALESCE(a.updatedAt, a.createdAt, toString(datetime()))),
        datetime()
      ).days AS ageDays,
      COALESCE(a.halfLifeDays, ${DEFAULT_HALF_LIFE_DAYS}) AS halfLife,
      COALESCE(a.confidence, ${DEFAULT_CONFIDENCE}) AS baseConf
    RETURN a,
      baseConf * (0.5 ^ (toFloat(ageDays) / toFloat(halfLife))) AS currentConf
    ORDER BY currentConf DESC
  `;

  try {
    const result = await executeReadQuery(cypher, { workspaceId });
    return result.records.map(record => {
      const nodeProps = record.get('a').properties as Record<string, unknown>;
      const currentConf = record.get('currentConf') as number;
      return mapRecordToSemanticEntity(nodeProps, currentConf);
    });
  } catch (error) {
    console.error('[COP] fetchAllSemanticEntities failed:', error instanceof Error ? error.message : error);
    return [];
  }
}
