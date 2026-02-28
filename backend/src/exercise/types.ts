/**
 * Exercise Domain Types
 *
 * Phase 14 Plan 01: Foundational data models for dual-perspective exercise planning
 * Supports blue/red/controller information barrier with dual-team IPB, COA scoring,
 * and order generation following doctrinal WARNORD/OPORD/FRAGO structure.
 */

import type {
  SituationParagraph,
  MissionStatement,
  ExecutionParagraph,
  SustainmentParagraph,
  CommandSignalParagraph
} from '../planning/types.js';

// ─── Exercise Role ────────────────────────────────────────────────────────────

/**
 * Exercise participant role controlling information barrier visibility
 */
export type ExerciseRole = 'blue_staff' | 'red_cell' | 'exercise_control';

// ─── Document Types ───────────────────────────────────────────────────────────

/**
 * Types of exercise documents extracted from scenario packages
 */
export type ExerciseDocumentType =
  | 'ALERTORD'
  | 'SITREP'
  | 'CAMPAIGN_PLAN'
  | 'FRAGO'
  | 'OOB'
  | 'COUNTRY_POLICY'
  | 'PLANNING_MAP'
  | 'DIRECTIVE'
  | 'OTHER';

// ─── Exercise Scenario ────────────────────────────────────────────────────────

/**
 * Top-level exercise scenario — the parent entity for all exercise data
 */
export interface ExerciseScenario {
  id: string;
  name: string;
  /** Whether this is a training exercise or operational scenario */
  designation: 'training/exercise' | 'operational';
  /**
   * Ordered list of exercise phase names
   * Default: Competition, Crisis, Conflict Day 4, Conflict Day 10, Conflict Day 22, Negotiation
   */
  exercisePhases: string[];
  /** Index into exercisePhases for the current active phase */
  currentPhaseIndex: number;
  status: 'draft' | 'active' | 'complete';
  createdBy: string; // DID
  createdAt: Date;
  updatedAt: Date;
}

export type CreateExerciseScenario = Omit<ExerciseScenario, 'id' | 'createdAt' | 'updatedAt'>;

// ─── Scenario Document ────────────────────────────────────────────────────────

/**
 * An ingested document belonging to a scenario, assigned to a team and phase
 */
export interface ScenarioDocument {
  id: string;
  scenarioId: string;
  team: 'blue' | 'red' | 'controller';
  exercisePhase: string;
  documentType: ExerciseDocumentType;
  filename: string;
  mimeType: string;
  textContent: string;
  /** Structured data extracted by the ingestion pipeline */
  extractedData: Record<string, unknown>;
  /** Confidence of the extraction result, 0–1 */
  extractionConfidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateScenarioDocument = Omit<ScenarioDocument, 'id' | 'createdAt' | 'updatedAt'>;

// ─── IPB Layer ────────────────────────────────────────────────────────────────

/**
 * A single layer in an IPB overlay, compatible with ValidityMap rendering
 */
export interface IPBLayer {
  id: string;
  name: string;
  type: 'unit' | 'area' | 'line' | 'point';
  team: 'blue' | 'red';
  layerType:
    | 'forces'
    | 'key_terrain'
    | 'avenue_of_approach'
    | 'nai'
    | 'engagement_area'
    | 'obstacle';
  /** GeoJSON geometry object */
  geometry: Record<string, unknown>;
  /** Additional display and metadata properties */
  properties: Record<string, unknown>;
  /** Optional MIL-STD-2525D symbol identification code */
  sidc?: string;
}

/**
 * OAKOC terrain analysis structure for IPB
 */
export interface OAKOCAnalysis {
  observation: string;         // Observation and fields of fire
  avenues: string;             // Avenues of approach
  keyTerrain: string;          // Key terrain
  obstacles: string;           // Obstacles
  coverAndConcealment: string; // Cover and concealment
}

/**
 * A force unit entry in the order of battle with geographic position
 */
export interface ForceDisposition {
  unitName: string;
  unitType: string;
  strength: string;
  position: Record<string, unknown>; // GeoJSON Point
  readiness: 'ready' | 'limited' | 'degraded';
  notes?: string;
}

/**
 * Named Area of Interest for IPB analysis
 */
export interface NamedAreaOfInterest {
  id: string;
  name: string;
  geometry: Record<string, unknown>; // GeoJSON
  significance: string;
  expectedActivity: string;
}

// ─── IPB Assessment ───────────────────────────────────────────────────────────

/**
 * Intelligence Preparation of the Battlefield assessment for one team/perspective
 */
export interface IPBAssessment {
  id: string;
  scenarioId: string;
  team: 'blue' | 'red';
  /**
   * own = this team's picture of their own forces
   * enemy_assessment = this team's picture of the opposing forces
   */
  perspective: 'own' | 'enemy_assessment';
  exercisePhase: string;
  /** GeoJSON-compatible area of operations boundary */
  areaOfOperations: Record<string, unknown>;
  terrainAnalysis: OAKOCAnalysis;
  threatAssessment: string;
  civilConsiderations: string;
  namedAreasOfInterest: NamedAreaOfInterest[];
  forceDispositions: ForceDisposition[];
  /** IPB overlay layers for ValidityMap rendering */
  overlayLayers: IPBLayer[];
  /** Increments on each revision */
  version: number;
  /** Points to the previous version's ID for history chain */
  parentVersionId: string | null;
  createdBy: string; // DID
  createdAt: Date;
  updatedAt: Date;
}

export type CreateIPBAssessment = Omit<IPBAssessment, 'id' | 'createdAt' | 'updatedAt'>;

// ─── COA Scoring ──────────────────────────────────────────────────────────────

/**
 * Doctrinal evaluation criterion for a COA
 */
export interface COACriterionScore {
  score: number;
  rationale: string;
  wargameEvidence?: string;
}

/**
 * Full doctrinal COA evaluation scores (FASDC)
 */
export interface ExerciseCOAScore {
  feasibility: COACriterionScore;
  acceptability: COACriterionScore;
  suitability: COACriterionScore;
  distinguishability: COACriterionScore;
  completeness: COACriterionScore;
  combinedScore: number;
  narrative: string;
  /** Ties back to a wargaming session that generated supporting evidence */
  wargamingSessionId?: string;
}

// ─── Scenario COA ─────────────────────────────────────────────────────────────

/**
 * Commander decision types for COA approval workflow
 */
export type CommanderDecision = 'accepted' | 'rejected' | 'modified' | 'combined' | 'returned';

/**
 * A Course of Action developed within an exercise scenario
 */
export interface ScenarioCOA {
  id: string;
  scenarioId: string;
  team: 'blue' | 'red';
  exercisePhase: string;
  number: number;
  name: string;
  description: string;
  scheme: string;
  doctScores: ExerciseCOAScore | null;
  wargameEvidence: Record<string, unknown>;
  combinedScore: number | null;
  /** Staff-editable narrative synthesizing scores and wargaming results */
  narrative: string;
  commanderDecision: CommanderDecision | null;
  commanderDecisionNotes: string;
  /** SHA-256 hash of the decision record for tamper-evident audit */
  decisionHash: string | null;
  /** NEAR blockchain transaction anchoring the decision hash */
  blockchainTx: string | null;
  selected: boolean;
  createdBy: string; // DID
  createdAt: Date;
  updatedAt: Date;
}

export type CreateScenarioCOA = Omit<ScenarioCOA, 'id' | 'createdAt' | 'updatedAt'>;

// ─── Exercise Orders ──────────────────────────────────────────────────────────

/**
 * WARNORD content — Warning Order providing initial notice of an operation
 */
export interface WARNORDContent {
  situation: string;
  missionStatement: string;
  commandersIntent: string;
  initialTasks: Array<{
    assignedTo: string;
    task: string;
    purpose: string;
    deadline?: string;
  }>;
  timelineSummary: string;
  serviceAndSupport: string;
  commandAndSignal: string;
}

/**
 * Full 5-paragraph OPORD content
 */
export interface OPORDContent {
  situation: SituationParagraph;
  mission: MissionStatement;
  execution: ExecutionParagraph;
  serviceAndSupport: SustainmentParagraph;
  commandAndSignal: CommandSignalParagraph;
}

/**
 * FRAGO content — Fragmentary Order modifying an existing OPORD
 */
export interface FRAGOContent {
  /** Partial updates to specific OPORD paragraphs */
  changedParagraphs: Partial<OPORDContent>;
  effectiveTime: string;
  /** IDs of OPORD/FRAGO orders this FRAGO modifies */
  references: string[];
}

/**
 * An exercise order (WARNORD, OPORD, or FRAGO) for one team
 */
export interface ExerciseOrder {
  id: string;
  scenarioId: string;
  team: 'blue' | 'red';
  orderType: 'WARNORD' | 'OPORD' | 'FRAGO';
  exercisePhase: string;
  version: number;
  content: WARNORDContent | OPORDContent | FRAGOContent;
  status: 'draft' | 'published';
  publishedAt: Date | null;
  createdBy: string; // DID
  createdAt: Date;
  updatedAt: Date;
}

export type CreateExerciseOrder = Omit<ExerciseOrder, 'id' | 'createdAt' | 'updatedAt'>;

// ─── Planning Task ────────────────────────────────────────────────────────────

/**
 * An actionable task created from a published order, assigned to a planning role
 */
export interface PlanningTask {
  id: string;
  orderId: string;
  scenarioId: string;
  team: 'blue' | 'red' | 'controller';
  assignedRole: 'blue_staff' | 'red_cell' | 'exercise_control';
  title: string;
  description: string;
  deadline: Date | null;
  status: 'pending' | 'in_progress' | 'complete';
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreatePlanningTask = Omit<PlanningTask, 'id' | 'createdAt' | 'updatedAt'>;

// ─── Exercise Gate ────────────────────────────────────────────────────────────

/**
 * A gate that controls when phase transitions or information releases occur
 */
export interface ExerciseGate {
  id: string;
  scenarioId: string;
  exercisePhase: string;
  gateType: 'info_release' | 'phase_transition' | 'order_required';
  conditionDescription: string;
  isOpen: boolean;
  openedBy: string | null;
  openedAt: Date | null;
  createdAt: Date;
}

export type CreateExerciseGate = Omit<ExerciseGate, 'id' | 'createdAt'>;
