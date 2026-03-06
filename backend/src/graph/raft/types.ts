/**
 * RAFT (Relationships, Actors, Functions, Tensions) Type Definitions
 *
 * Core data model for strategic environment analysis based on ATP 5-0.1.
 * These types represent the fundamental entities in operational environment modeling.
 */

// ============================================================================
// Actor Types
// ============================================================================

/**
 * Actor type classification per ATP 5-0.1
 * - nation: Sovereign states and their governments
 * - organization: International orgs, NGOs, corporations
 * - individual: Key leaders, decision makers
 * - non_state_actor: Terrorist groups, insurgencies, militias
 */
export type ActorType = 'nation' | 'organization' | 'individual' | 'non_state_actor';

/**
 * Actor - An entity that can take action in the operational environment
 */
export interface Actor {
  /** Unique identifier (ACT-{uuid}) */
  id: string;
  /** Primary name of the actor */
  name: string;
  /** Classification of actor type */
  type: ActorType;
  /** Alternative names for entity resolution */
  aliases: string[];
  /** Flexible key-value attributes */
  attributes: Record<string, unknown>;
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
 * Relationship - A connection between two actors
 * Strength ranges from -1.0 (hostile) to 1.0 (allied)
 */
export interface Relationship {
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
 * ActorFunction - A capability or role an actor performs
 */
export interface ActorFunction {
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
 * Tension - A point of friction or potential conflict between actors
 */
export interface Tension {
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
