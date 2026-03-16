/**
 * Provenance, Temporal, and Semantic Entity Type Definitions
 *
 * Shared types for W3C PROV-O aligned provenance tracking, per-assertion
 * temporal validity, and semantic entity representation used across the
 * JSON-LD-native RAFT graph.
 */

// ============================================================================
// Source Method
// ============================================================================

/**
 * Source method classification aligned with military intelligence reliability
 * ratings (A-F / 1-6 system). Used as prov:wasGeneratedBy value.
 */
export type SourceMethod =
  | 'manual_entry'
  | 'doc_intelligence'
  | 'osint'
  | 'vision_pipeline'
  | 'ai_inference'
  | 'sigint';

// ============================================================================
// Provenance Properties (W3C PROV-O aligned)
// ============================================================================

/**
 * W3C PROV-O aligned provenance properties stored inline on every RAFT node/edge.
 * Stored as flat properties on Neo4j nodes (not a separate provenance subgraph)
 * for query efficiency.
 */
export interface ProvenanceProps {
  /** prov:wasAttributedTo — DID or system identifier of the asserting agent/user */
  assertedBy: string;
  /** prov:wasGeneratedBy — method or activity that produced this assertion */
  assertedVia: SourceMethod;
  /** prov:wasDerivedFrom — JSON.stringify'd array of source document/event IDs */
  derivedFrom: string;
  /** Initial confidence value from source weight (0-1) */
  confidence: number;
  /** Base reliability weight of the assertedVia method (0-1) */
  sourceWeight: number;
}

// ============================================================================
// Temporal Properties
// ============================================================================

/**
 * Per-assertion temporal validity.
 * Every property/fact has its own validFrom/validTo independent of the entity,
 * enabling point-in-time queries at property level.
 */
export interface TemporalProps {
  /** ISO 8601 datetime string — when this assertion became valid */
  validFrom: string;
  /** ISO 8601 datetime string — when this assertion expired. null = currently valid */
  validTo: string | null;
  /** Half-life in days for confidence decay formula: conf(t) = conf_0 * 2^(-t/half_life) */
  halfLifeDays: number;
}

// ============================================================================
// Semantic Entity
// ============================================================================

/**
 * Typed entity returned from semantic graph queries.
 * Used as the shared format for passing entities to COP sub-agents,
 * brain visualization, and other consumers of the JSON-LD graph.
 */
export interface SemanticEntity {
  /** Internal entity identifier (e.g., ACT-{uuid}) */
  id: string;
  /** Primary display name */
  name: string;
  /** CCO/BFO class URI stored as jsonldType (e.g., 'cco:MilitaryOrganization') */
  jsonldType: string;
  /** Current confidence value (may be decayed from base) */
  confidence: number;
  /** Inline provenance properties */
  provenance: ProvenanceProps;
  /** Whether the assertion is currently temporally valid */
  temporalValid: boolean;
  /** All remaining entity properties */
  properties: Record<string, unknown>;
}

// ============================================================================
// Contradiction Record
// ============================================================================

/**
 * Record of a detected contradiction between two assertions about the
 * same entity property. Created when a new assertion conflicts with an
 * existing one on the same entity + same property key.
 *
 * Stored as a :CONTRADICTS relationship in Neo4j and surfaced in
 * brain visualization as a review queue item.
 */
export interface ContradictionRecord {
  /** Unique identifier for this contradiction record */
  id: string;
  /** ID of the entity both assertions are about */
  entityId: string;
  /** Property key where the contradiction was detected */
  propertyKey: string;
  /** ID of assertion A (the existing assertion) */
  assertionAId: string;
  /** ID of assertion B (the new/incoming assertion) */
  assertionBId: string;
  /** ISO 8601 datetime when the contradiction was detected */
  detectedAt: string;
  /** ISO 8601 datetime when the contradiction was resolved (if resolved) */
  resolvedAt?: string;
  /** Resolution choice made by staff */
  resolution?: 'accept_a' | 'accept_b' | 'both_valid' | 'flagged_for_intel';
}

// ============================================================================
// Confidence Tier
// ============================================================================

/**
 * Confidence tier classification used for visual encoding on COP and brain viz.
 * - high   > 0.85: solid symbols, full opacity
 * - medium 0.5-0.85: dashed outlines, amber badge, 70% opacity
 * - low    < 0.5: dotted/ghost, red badge, 40% opacity
 */
export type ConfidenceTier = 'high' | 'medium' | 'low';

/**
 * Classify a confidence value (0-1) into a visual tier.
 */
export function getConfidenceTier(confidence: number): ConfidenceTier {
  if (confidence > 0.85) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}
