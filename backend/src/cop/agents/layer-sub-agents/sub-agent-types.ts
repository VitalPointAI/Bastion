/**
 * Shared types for COP layer sub-agents.
 *
 * All sub-agents follow the same pattern: accept SubAgentInput,
 * extract domain-specific entities, and return a COPLayerSpec fragment.
 */

import type { COPSymbolSpec, COPLayerSpec } from '../../layers/layer-types.js';
import type { SemanticEntity } from '../../../graph/provenance-types.js';

// ---------------------------------------------------------------------------
// Legacy type alias (backward compat)
// ---------------------------------------------------------------------------

/**
 * Legacy flat entity shape used before JSON-LD/semantic upgrade.
 * Kept as a type alias for backward compatibility with any existing code
 * that references the old graphEntities element type directly.
 */
export type LegacyGraphEntity = {
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
};

// Re-export SemanticEntity for sub-agent convenience
export type { SemanticEntity };

// ---------------------------------------------------------------------------
// Entity type matching helper
// ---------------------------------------------------------------------------

/**
 * Check if a SemanticEntity matches a set of type keyword strings.
 *
 * Checks in order:
 * 1. `properties.type` (flat legacy field, stored on RAFT actors as attributes_type or type)
 * 2. `jsonldType` (CCO/BFO URI) — checks if any keyword appears as a case-insensitive substring
 *
 * This allows sub-agents to filter entities regardless of whether they came from
 * legacy flat storage or the new JSON-LD-native graph.
 *
 * @param entity       SemanticEntity to test
 * @param typeKeywords Array of type keyword strings to match against (e.g. ['organization', 'military_unit'])
 * @returns true if the entity matches any of the given type keywords
 */
export function matchesEntityType(entity: SemanticEntity, typeKeywords: string[]): boolean {
  // Check legacy flat type field stored in properties
  const flatType = (
    entity.properties['type'] ??
    entity.properties['attributes_type'] ??
    entity.properties['unitType'] ??
    ''
  ) as string;

  if (flatType && typeKeywords.some(k => flatType.toLowerCase() === k.toLowerCase())) {
    return true;
  }

  // Check CCO/BFO jsonldType URI for keyword match
  const jsonldTypeLower = entity.jsonldType.toLowerCase();
  return typeKeywords.some(k => jsonldTypeLower.includes(k.toLowerCase().replace(/_/g, '')));
}

/**
 * Get the affiliation of a SemanticEntity.
 *
 * Checks properties.affiliation, properties.attributes_affiliation, and
 * properties.attributes_affiliation in order.
 */
export function getEntityAffiliation(entity: SemanticEntity): string {
  return String(
    entity.properties['affiliation'] ??
    entity.properties['attributes_affiliation'] ??
    '',
  ).toLowerCase();
}

/**
 * Input provided to every sub-agent by the coordinator.
 */
export interface SubAgentInput {
  workspaceId: string;
  sectionId: string;
  documents: Array<{
    id: string;
    content: string;
    type: string;
  }>;
  /**
   * Ontology-typed entities from the JSON-LD semantic graph.
   * Each entity carries jsonldType (CCO/BFO class), confidence (decayed),
   * and W3C PROV-O provenance metadata.
   */
  graphEntities: SemanticEntity[];
  /** Symbols from other sub-agents if running sequentially */
  existingSymbols?: COPSymbolSpec[];
}

/**
 * Sub-agent function signature.
 */
export type SubAgentFn = (input: SubAgentInput) => Promise<COPLayerSpec>;

/**
 * Create an empty COPLayerSpec for error/fallback scenarios.
 */
export function createEmptyLayerSpec(
  input: SubAgentInput,
  layerType: COPLayerSpec['layerType'],
  agentId: string,
  errorMessage?: string,
): COPLayerSpec {
  return {
    layerId: `${layerType}-${input.sectionId}-${Date.now()}`,
    layerType,
    workspaceId: input.workspaceId,
    sectionId: input.sectionId,
    symbols: [],
    controlMeasures: [],
    customAnnotations: [],
    temporalPhases: [],
    metadata: {
      generatedBy: agentId,
      generatedAt: new Date().toISOString(),
      sourceDocumentIds: input.documents.map(d => d.id),
      ccoValidated: false,
      ...(errorMessage ? { error: errorMessage } as Record<string, string> : {}),
    },
  };
}
