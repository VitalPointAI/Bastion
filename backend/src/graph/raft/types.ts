/**
 * RAFT (Relationships, Actors, Functions, Tensions) Type Definitions
 *
 * Core data model for strategic environment analysis based on ATP 5-0.1.
 * These types represent the fundamental entities in operational environment modeling.
 *
 * Phase 47: Extended with JSON-LD-native fields (jsonldType, jsonldContext),
 * W3C PROV-O provenance (ProvenanceProps), and temporal validity (TemporalProps)
 * on all entity interfaces. All existing fields preserved for backward compatibility.
 */

import type { ProvenanceProps, TemporalProps } from '../provenance-types.js';

// ============================================================================
// JSON-LD Entity Base
// ============================================================================

/**
 * Base interface for all JSON-LD-native RAFT entities.
 * Provides ontology typing, context reference, provenance, and temporal validity.
 *
 * jsonldType stores the CCO/BFO class URI (e.g., 'cco:MilitaryOrganization').
 * jsonldContext stores the canonical context URL for interop signaling — the
 * bundled bastion-context.jsonld is used at runtime (never fetched from URL).
 */
export interface JsonLdEntityBase extends ProvenanceProps, TemporalProps {
  /** CCO/BFO class URI, e.g. 'cco:MilitaryOrganization'. Stored as Neo4j property. */
  jsonldType: string;
  /** Canonical @context URL — 'https://bastion.vitalpoint.ai/ontology/context.jsonld' */
  jsonldContext: string;
}

// ============================================================================
// Actor Types
// ============================================================================

/**
 * Actor type classification per ATP 5-0.1
 * - nation: Sovereign states and their governments
 * - organization: International orgs, NGOs, corporations
 * - individual: Key leaders, decision makers
 * - non_state_actor: Terrorist groups, insurgencies, militias
 * - information_source: Journalists, authors, news agencies — provenance/confidence chain, not primary actors
 */
export type ActorType = 'nation' | 'organization' | 'individual' | 'non_state_actor' | 'information_source';

/**
 * Actor - An entity that can take action in the operational environment.
 *
 * Phase 47: Extended with JsonLdEntityBase (jsonldType, jsonldContext,
 * provenance, temporal validity) and promoted attribute fields for
 * Cypher queryability. Existing attributes blob preserved as attributesJson
 * for backward compat during migration.
 */
export interface Actor extends JsonLdEntityBase {
  /** Unique identifier (ACT-{uuid}) */
  id: string;
  /** Primary name of the actor */
  name: string;
  /** Classification of actor type */
  type: ActorType;
  /** Alternative names for entity resolution */
  aliases: string[];
  /** Flexible key-value attributes — kept for backward compat reads during migration */
  attributes: Record<string, unknown>;
  /**
   * Raw attributes blob as JSON string — kept for backward compat during migration.
   * After migration complete, consumed code updates to use promoted fields.
   */
  attributesJson?: string;
  /** Promoted attribute: force affiliation (hostile, friendly, neutral, suspect, unknown) */
  attributes_affiliation?: string;
  /** Promoted attribute: echelon level (team, squad, platoon, company, battalion, etc.) */
  attributes_echelon?: string;
  /** Promoted attribute: unit type classification */
  attributes_unitType?: string;
  /** Promoted attribute: latitude (WGS84) */
  attributes_lat?: number;
  /** Promoted attribute: longitude (WGS84) */
  attributes_lng?: number;
  /** Workspace isolation for multi-tenant support */
  workspaceId?: string;
  /** Document IDs this actor was extracted from */
  sourceDocumentIds: string[];
  /** Container IDs this actor is scoped to */
  containerIds: string[];
  /** When this record was created */
  createdAt: Date;
  /** When this record was last updated */
  updatedAt: Date;
  /** NATO STANAG 2022 source reliability rating (A-F) from doc-intelligence Trust Agent */
  natoSourceReliability?: string;
  /** NATO STANAG 2022 information credibility rating (1-6) from doc-intelligence Trust Agent */
  natoInformationCredibility?: number;
}

// ============================================================================
// Relationship Types
// ============================================================================

/**
 * Relationship classification between actors
 * - alliance: Formal or informal cooperative agreement
 * - conflict: Active hostility or opposition
 * - dependency: One actor relies on another
 * - competition: Vying for same resources/influence
 * - cooperation: Working together on specific issues
 */
export type RelationshipType = 'alliance' | 'conflict' | 'dependency' | 'competition' | 'cooperation';

/**
 * Relationship - A connection between two actors.
 * Strength ranges from -1.0 (hostile) to 1.0 (allied).
 *
 * Phase 47: Extended with JsonLdEntityBase.
 */
export interface Relationship extends JsonLdEntityBase {
  /** Unique identifier (REL-{uuid}) */
  id: string;
  /** Actor ID where relationship originates */
  sourceActorId: string;
  /** Actor ID where relationship points */
  targetActorId: string;
  /** Classification of relationship */
  type: RelationshipType;
  /** Relationship strength: -1.0 (hostile) to 1.0 (allied) */
  strength: number;
  /** Optional description of the relationship */
  description?: string;
  /** Supporting evidence/references */
  evidence: string[];
  /** When the relationship began */
  temporalStart?: Date;
  /** When the relationship ended (null = ongoing) */
  temporalEnd?: Date;
  /** Workspace isolation */
  workspaceId?: string;
  /** Document IDs this relationship was extracted from */
  sourceDocumentIds: string[];
  /** Container IDs this relationship is scoped to */
  containerIds: string[];
  /** When this record was created */
  createdAt: Date;
  /** When this record was last updated */
  updatedAt: Date;
}

// ============================================================================
// Function Types (DIME expanded to DIMEFIL)
// ============================================================================

/**
 * Function domain classification (DIME expanded)
 * - diplomatic: Foreign policy, negotiations, treaties
 * - informational: Propaganda, media, public affairs
 * - military: Armed forces, defense capabilities
 * - economic: Trade, sanctions, development
 * - legal: International law, treaties, courts
 * - intelligence: Espionage, surveillance, analysis
 * - financial: Banking, monetary policy, assets
 */
export type FunctionDomain = 'diplomatic' | 'informational' | 'military' | 'economic' | 'legal' | 'intelligence' | 'financial';

/**
 * ActorFunction - A capability or role an actor performs.
 *
 * Phase 47: Extended with JsonLdEntityBase.
 */
export interface ActorFunction extends JsonLdEntityBase {
  /** Unique identifier (FUN-{uuid}) */
  id: string;
  /** Actor this function belongs to */
  actorId: string;
  /** Domain of the function */
  domain: FunctionDomain;
  /** Description of the function/capability */
  description: string;
  /** What the actor can do */
  capabilities: string[];
  /** Known constraints or weaknesses */
  limitations: string[];
  /** Workspace isolation */
  workspaceId?: string;
  /** Document IDs this function was extracted from */
  sourceDocumentIds: string[];
  /** When this record was created */
  createdAt: Date;
  /** When this record was last updated */
  updatedAt: Date;
}

// ============================================================================
// Tension Types
// ============================================================================

/**
 * Tension intensity levels
 * - low: Background friction, minimal risk
 * - medium: Active disagreement, moderate concern
 * - high: Significant conflict potential
 * - critical: Imminent crisis or ongoing conflict
 */
export type TensionIntensity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Tension domain classification (PMESII without infrastructure)
 * - political: Government, power, governance issues
 * - military: Armed conflict, defense postures
 * - economic: Trade disputes, resource competition
 * - social: Cultural, demographic, ideological
 * - information: Media, narratives, disinformation
 */
export type TensionDomain = 'political' | 'military' | 'economic' | 'social' | 'information';

/**
 * Tension - A point of friction or potential conflict between actors.
 *
 * Phase 47: Extended with JsonLdEntityBase.
 */
export interface Tension extends JsonLdEntityBase {
  /** Unique identifier (TEN-{uuid}) */
  id: string;
  /** Actor IDs involved in this tension (2+) */
  actorIds: string[];
  /** Description of the tension/conflict */
  description: string;
  /** Current intensity level */
  intensity: TensionIntensity;
  /** Primary domain of the tension */
  domain: TensionDomain;
  /** Factors that could escalate the tension */
  triggers: string[];
  /** Factors that could de-escalate the tension */
  mitigators: string[];
  /** Strategic objectives affected by this tension */
  linkedObjectiveIds: string[];
  /** Workspace isolation */
  workspaceId?: string;
  /** Document IDs this tension was extracted from */
  sourceDocumentIds: string[];
  /** Container IDs this tension is scoped to */
  containerIds: string[];
  /** When this record was created */
  createdAt: Date;
  /** When this record was last updated */
  updatedAt: Date;
}

// ============================================================================
// Decision Types — captures decision pathways in the knowledge graph
// ============================================================================

/**
 * Decision basis — how the decision was informed
 * - document_based: Decision directly supported by document evidence
 * - analysis_based: Decision informed by AI or staff analysis
 * - intuition_based: Decision made without clear evidence trail (knowledge gap)
 * - mixed: Combination of evidence and judgment
 */
export type DecisionBasis = 'document_based' | 'analysis_based' | 'intuition_based' | 'mixed';

/**
 * Decision — A recorded decision point in the planning process.
 * Captures the what, why, and evidence basis for decisions made,
 * enabling traceability and surfacing where intuition fills knowledge gaps.
 *
 * Phase 47: Extended with JsonLdEntityBase.
 */
export interface Decision extends JsonLdEntityBase {
  /** Unique identifier (DEC-{uuid}) */
  id: string;
  /** Gate ID from decision_gates table (if from a formal gate) */
  gateId?: string;
  /** Type of decision (mirrors GateType or free-form for informal decisions) */
  decisionType: string;
  /** Human-readable title */
  title: string;
  /** What was decided */
  description: string;
  /** The outcome chosen */
  outcome: string;
  /** Rationale provided by the decision maker */
  rationale: string;
  /** How was this decision informed? */
  basis: DecisionBasis;
  /** Actor IDs (from graph) affected by or involved in this decision */
  affectedActorIds: string[];
  /** Document IDs that informed this decision */
  supportingDocumentIds: string[];
  /** Objective IDs this decision relates to */
  linkedObjectiveIds: string[];
  /** IDs of prior decisions that led to this one (decision chain) */
  predecessorDecisionIds: string[];
  /** Knowledge gaps identified — where evidence was missing */
  knowledgeGaps: string[];
  /** Who made the decision (DID) */
  decidedBy: string;
  /** Problem set scope */
  problemSetId: string;
  /** Workspace isolation */
  workspaceId?: string;
  /** Container IDs for graph scoping */
  containerIds: string[];
  /** When the decision was made */
  createdAt: Date;
  /** When this record was last updated */
  updatedAt: Date;
}

// ============================================================================
// Input Types (for creation/updates - no id/timestamps)
// ============================================================================

/** Input for creating a new Actor */
export interface ActorInput {
  name: string;
  type: ActorType;
  aliases?: string[];
  attributes?: Record<string, unknown>;
  workspaceId?: string;
  sourceDocumentIds?: string[];
  containerIds?: string[];
}

/** Input for creating a new Relationship */
export interface RelationshipInput {
  sourceActorId: string;
  targetActorId: string;
  type: RelationshipType;
  strength: number;
  description?: string;
  evidence?: string[];
  temporalStart?: Date;
  temporalEnd?: Date;
  workspaceId?: string;
  sourceDocumentIds?: string[];
  containerIds?: string[];
}

/** Input for creating a new ActorFunction */
export interface ActorFunctionInput {
  actorId: string;
  domain: FunctionDomain;
  description: string;
  capabilities?: string[];
  limitations?: string[];
  workspaceId?: string;
  sourceDocumentIds?: string[];
}

/** Input for creating a new Tension */
export interface TensionInput {
  actorIds: string[];
  description: string;
  intensity: TensionIntensity;
  domain: TensionDomain;
  triggers?: string[];
  mitigators?: string[];
  linkedObjectiveIds?: string[];
  workspaceId?: string;
  sourceDocumentIds?: string[];
  containerIds?: string[];
}

/** Input for recording a new Decision */
export interface DecisionInput {
  gateId?: string;
  decisionType: string;
  title: string;
  description: string;
  outcome: string;
  rationale: string;
  basis: DecisionBasis;
  affectedActorIds?: string[];
  supportingDocumentIds?: string[];
  linkedObjectiveIds?: string[];
  predecessorDecisionIds?: string[];
  knowledgeGaps?: string[];
  decidedBy: string;
  problemSetId: string;
  workspaceId?: string;
  containerIds?: string[];
}

// ============================================================================
// Actor Type to CCO URI Mapping
// ============================================================================

/**
 * Maps existing Actor.type values to their CCO class URIs.
 * Used by migration scripts and entity classification utilities to
 * populate jsonldType when creating or migrating Actor nodes.
 */
export const ACTOR_TYPE_TO_CCO_MAP: Record<string, string> = {
  nation:           'cco:GovernmentOrganization',
  organization:     'cco:Organization',
  individual:       'cco:Person',
  non_state_actor:  'cco:Organization',
  information_source: 'cco:InformationBearingEntity',
  military_unit:    'cco:MilitaryOrganization',
  facility:         'jc3:Facility',
  equipment:        'cco:Artifact',
  default:          'cco:Agent',
};
