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
  /**
   * Controls which staff workspaces are available for this scenario.
   * Defaults to all 31 roles if not specified.
   */
  enabledRoles: string[];
  createdBy: string; // DID
  createdAt: Date;
  updatedAt: Date;
}

export type CreateExerciseScenario = Omit<ExerciseScenario, 'id' | 'createdAt' | 'updatedAt' | 'enabledRoles'> & {
  enabledRoles?: string[];
};

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

// ─── Staff Workspace Types ────────────────────────────────────────────────────

/**
 * A staff product: any workspace-produced artifact created by a JPP staff role.
 * Products start as drafts and are published to trigger cross-staff notifications.
 */
export interface StaffProduct {
  id: string;
  scenarioId: string;
  roleKey: string;
  productType: string;
  title: string;
  status: 'draft' | 'published';
  /** Typed structured fields — schema varies by productType (see PRODUCT_TYPE_REGISTRY) */
  structured: Record<string, unknown>;
  /** Freeform rich text / markdown narrative */
  content: string;
  /** Per-product agent team override. null = use role default from STAFF_ROLE_CONFIG */
  agentTeamId: string | null;
  /** Incremented each time the product is published */
  version: number;
  publishedAt: Date | null;
  publishedBy: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new staff product
 */
export interface CreateStaffProductInput {
  scenarioId: string;
  roleKey: string;
  productType: string;
  title: string;
  structured?: Record<string, unknown>;
  content?: string;
  createdBy: string;
}

/**
 * Input for updating a staff product's draft content
 */
export interface UpdateStaffProductInput {
  title?: string;
  structured?: Record<string, unknown>;
  content?: string;
}

/**
 * Snapshot of what changed when a product was published.
 * Used for cross-staff notifications and the notification feed.
 */
export interface DiffSnapshot {
  structuredChanges: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  contentChanged: boolean;
  contentSummary?: string;
}

/**
 * A cross-role notification generated when a product is published.
 * One notification row per (product publish, target_role) pair.
 */
export interface StaffNotification {
  id: string;
  scenarioId: string;
  sourceProductId: string;
  sourceRole: string;
  targetRole: string;
  notificationType: 'product_published' | 'product_updated';
  diffSnapshot: DiffSnapshot;
  isRead: boolean;
  isIntegrated: boolean;
  createdAt: Date;
}

/**
 * Per-role (and optionally per-product-type) agent team configuration
 */
export interface AgentTeamConfig {
  id: string;
  scenarioId: string;
  roleKey: string;
  /** null = role default; non-null = override for this product type only */
  productType: string | null;
  agentTeamId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Staff Role Configuration ─────────────────────────────────────────────────

export type StaffRoleCategory =
  | 'Command'
  | 'J-Staff'
  | 'Special Staff'
  | 'Supporting Elements'
  | 'Component Commands'
  | 'Additional Elements';

export interface StaffRoleEntry {
  key: string;
  label: string;
  category: StaffRoleCategory;
  doctrinalFocus: string;
  defaultProducts: string[];
  agentTeamId: string | null;
}

/**
 * Data-driven configuration for all 31 JPP staff roles.
 * Single source of truth for role definitions.
 *
 * Count breakdown:
 * - Command: 2 (commander, dcom)
 * - J-Staff: 11 (cos, j1, j2, j3, j35, j4, j5, j6, j7, j8, j9)
 * - Special Staff: 4 (sja, polad, pao, surgeon)
 * - Supporting Elements: 7 (cyber, space, transcom, socom, io, fires, ew)
 * - Component Commands: 4 (jfacc, jflcc, jfmcc, jfsocc)
 * - Additional Elements: 3 (engineer, cbrn, knowledge_mgmt)
 * Total: 31
 */
export const STAFF_ROLE_CONFIG: Record<string, StaffRoleEntry> = {
  // ── Command (2) ──────────────────────────────────────────────────────────
  commander: {
    key: 'commander',
    label: 'Commander',
    category: 'Command',
    doctrinalFocus: 'Strategic direction, COA decision, and commander\'s intent',
    defaultProducts: ['commander_intent', 'coa_decision', 'strategic_guidance', 'warnord_approval'],
    agentTeamId: null,
  },
  dcom: {
    key: 'dcom',
    label: 'Deputy Commander (DCOM)',
    category: 'Command',
    doctrinalFocus: 'Commander support, staff coordination, and battle rhythm',
    defaultProducts: ['strategic_guidance'],
    agentTeamId: null,
  },

  // ── J-Staff (11) ─────────────────────────────────────────────────────────
  cos: {
    key: 'cos',
    label: 'Chief of Staff (CoS)',
    category: 'J-Staff',
    doctrinalFocus: 'Staff management, battle rhythm, and synchronization',
    defaultProducts: ['staff_estimate'],
    agentTeamId: null,
  },
  j1: {
    key: 'j1',
    label: 'J1 (Personnel)',
    category: 'J-Staff',
    doctrinalFocus: 'Personnel readiness, manning, and casualty management',
    defaultProducts: ['personnel_estimate', 'manning_status', 'casualty_tracking'],
    agentTeamId: null,
  },
  j2: {
    key: 'j2',
    label: 'J2 (Intelligence)',
    category: 'J-Staff',
    doctrinalFocus: 'IPB, threat assessment, and intelligence collection',
    defaultProducts: ['ipb_assessment', 'threat_assessment', 'oob', 'intel_summary', 'pir'],
    agentTeamId: null,
  },
  j3: {
    key: 'j3',
    label: 'J3 (Operations)',
    category: 'J-Staff',
    doctrinalFocus: 'Current operations, synchronization, and execution',
    defaultProducts: ['sync_matrix', 'coa_sketch', 'task_org', 'roe', 'execute_order'],
    agentTeamId: null,
  },
  j35: {
    key: 'j35',
    label: 'J35 (Future Plans)',
    category: 'J-Staff',
    doctrinalFocus: 'COA development, analysis, and campaign planning',
    defaultProducts: ['coa_development', 'coa_analysis', 'staff_estimate', 'campaign_plan'],
    agentTeamId: null,
  },
  j4: {
    key: 'j4',
    label: 'J4 (Logistics)',
    category: 'J-Staff',
    doctrinalFocus: 'Logistics estimate, CSS planning, and supply',
    defaultProducts: ['logistics_estimate', 'css_annex', 'supply_plan'],
    agentTeamId: null,
  },
  j5: {
    key: 'j5',
    label: 'J5 (Strategic Plans)',
    category: 'J-Staff',
    doctrinalFocus: 'Strategic analysis, policy integration, and campaign objectives',
    defaultProducts: ['strategic_estimate', 'strategic_direction', 'campaign_objectives'],
    agentTeamId: null,
  },
  j6: {
    key: 'j6',
    label: 'J6 (Communications)',
    category: 'J-Staff',
    doctrinalFocus: 'C2 architecture, communications planning, and network design',
    defaultProducts: ['comms_plan', 'c2_architecture', 'network_diagram'],
    agentTeamId: null,
  },
  j7: {
    key: 'j7',
    label: 'J7 (Training)',
    category: 'J-Staff',
    doctrinalFocus: 'Training management and exercise coordination',
    defaultProducts: ['staff_estimate'],
    agentTeamId: null,
  },
  j8: {
    key: 'j8',
    label: 'J8 (Resource Management)',
    category: 'J-Staff',
    doctrinalFocus: 'Budget, resource allocation, and fiscal management',
    defaultProducts: ['staff_estimate'],
    agentTeamId: null,
  },
  j9: {
    key: 'j9',
    label: 'J9 (Civil-Military)',
    category: 'J-Staff',
    doctrinalFocus: 'Civil-military operations and interagency coordination',
    defaultProducts: ['staff_estimate'],
    agentTeamId: null,
  },

  // ── Special Staff (4) ─────────────────────────────────────────────────────
  sja: {
    key: 'sja',
    label: 'Staff Judge Advocate (SJA)',
    category: 'Special Staff',
    doctrinalFocus: 'Legal advice, ROE, and law of armed conflict',
    defaultProducts: ['roe', 'staff_estimate'],
    agentTeamId: null,
  },
  polad: {
    key: 'polad',
    label: 'Political Advisor (POLAD)',
    category: 'Special Staff',
    doctrinalFocus: 'Political-military analysis and interagency liaison',
    defaultProducts: ['strategic_estimate', 'staff_estimate'],
    agentTeamId: null,
  },
  pao: {
    key: 'pao',
    label: 'Public Affairs Officer (PAO)',
    category: 'Special Staff',
    doctrinalFocus: 'Strategic communication and media operations',
    defaultProducts: ['staff_estimate'],
    agentTeamId: null,
  },
  surgeon: {
    key: 'surgeon',
    label: 'Command Surgeon',
    category: 'Special Staff',
    doctrinalFocus: 'Medical readiness, CASEVAC, and force health protection',
    defaultProducts: ['staff_estimate'],
    agentTeamId: null,
  },

  // ── Supporting Elements (7) ───────────────────────────────────────────────
  cyber: {
    key: 'cyber',
    label: 'Cyber',
    category: 'Supporting Elements',
    doctrinalFocus: 'Cyberspace operations and defensive cyber',
    defaultProducts: ['staff_estimate'],
    agentTeamId: null,
  },
  space: {
    key: 'space',
    label: 'Space',
    category: 'Supporting Elements',
    doctrinalFocus: 'Space operations and satellite support',
    defaultProducts: ['staff_estimate'],
    agentTeamId: null,
  },
  transcom: {
    key: 'transcom',
    label: 'TRANSCOM',
    category: 'Supporting Elements',
    doctrinalFocus: 'Strategic airlift, sealift, and transportation coordination',
    defaultProducts: ['logistics_estimate', 'staff_estimate'],
    agentTeamId: null,
  },
  socom: {
    key: 'socom',
    label: 'SOCOM / SOF',
    category: 'Supporting Elements',
    doctrinalFocus: 'Special operations forces integration and employment',
    defaultProducts: ['staff_estimate', 'task_org'],
    agentTeamId: null,
  },
  io: {
    key: 'io',
    label: 'Information Operations (IO)',
    category: 'Supporting Elements',
    doctrinalFocus: 'Information environment operations and influence',
    defaultProducts: ['staff_estimate'],
    agentTeamId: null,
  },
  fires: {
    key: 'fires',
    label: 'Fires',
    category: 'Supporting Elements',
    doctrinalFocus: 'Joint fires, targeting, and fire support coordination',
    defaultProducts: ['sync_matrix', 'staff_estimate'],
    agentTeamId: null,
  },
  ew: {
    key: 'ew',
    label: 'Electronic Warfare (EW)',
    category: 'Supporting Elements',
    doctrinalFocus: 'Electronic attack, protection, and warfare integration',
    defaultProducts: ['staff_estimate'],
    agentTeamId: null,
  },

  // ── Component Commands (4) ────────────────────────────────────────────────
  jfacc: {
    key: 'jfacc',
    label: 'JFACC (Air)',
    category: 'Component Commands',
    doctrinalFocus: 'Air operations, ATO, and airspace management',
    defaultProducts: ['staff_estimate', 'task_org'],
    agentTeamId: null,
  },
  jflcc: {
    key: 'jflcc',
    label: 'JFLCC (Land)',
    category: 'Component Commands',
    doctrinalFocus: 'Land component operations and ground force employment',
    defaultProducts: ['staff_estimate', 'task_org'],
    agentTeamId: null,
  },
  jfmcc: {
    key: 'jfmcc',
    label: 'JFMCC (Maritime)',
    category: 'Component Commands',
    doctrinalFocus: 'Maritime component operations and sea control',
    defaultProducts: ['staff_estimate', 'task_org'],
    agentTeamId: null,
  },
  jfsocc: {
    key: 'jfsocc',
    label: 'JFSOCC (Special Ops)',
    category: 'Component Commands',
    doctrinalFocus: 'Special operations component and SOF integration',
    defaultProducts: ['staff_estimate', 'task_org'],
    agentTeamId: null,
  },

  // ── Additional Elements (3) ───────────────────────────────────────────────
  engineer: {
    key: 'engineer',
    label: 'Engineer',
    category: 'Additional Elements',
    doctrinalFocus: 'Engineer support, obstacle planning, and infrastructure',
    defaultProducts: ['staff_estimate'],
    agentTeamId: null,
  },
  cbrn: {
    key: 'cbrn',
    label: 'CBRN',
    category: 'Additional Elements',
    doctrinalFocus: 'Chemical, biological, radiological, and nuclear defense',
    defaultProducts: ['staff_estimate'],
    agentTeamId: null,
  },
  knowledge_mgmt: {
    key: 'knowledge_mgmt',
    label: 'Knowledge Management',
    category: 'Additional Elements',
    doctrinalFocus: 'Information sharing, common operating picture, and data management',
    defaultProducts: ['staff_estimate'],
    agentTeamId: null,
  },
} as const;

// ─── Staff Preset Templates ────────────────────────────────────────────────────

/**
 * Named presets for quickly configuring which staff roles are enabled for a scenario.
 */
export const STAFF_PRESET_TEMPLATES: Record<string, string[]> = {
  /** All 31 JPP staff roles — full joint staff */
  full_joint_staff: [
    'commander', 'dcom',
    'cos', 'j1', 'j2', 'j3', 'j35', 'j4', 'j5', 'j6', 'j7', 'j8', 'j9',
    'sja', 'polad', 'pao', 'surgeon',
    'cyber', 'space', 'transcom', 'socom', 'io', 'fires', 'ew',
    'jfacc', 'jflcc', 'jfmcc', 'jfsocc',
    'engineer', 'cbrn', 'knowledge_mgmt',
  ],
  /** Core planning staff — Commander, CoS, J1-J6, J35 (10 roles) */
  core_staff: [
    'commander', 'cos', 'j1', 'j2', 'j3', 'j35', 'j4', 'j5', 'j6',
  ],
  /** Intelligence-focused configuration (6 roles) */
  intel_focus: [
    'commander', 'j2', 'j35', 'j3', 'jfacc', 'fires',
  ],
};

// ─── Product Type Registry ─────────────────────────────────────────────────────

export type StructuredFieldType = 'text' | 'textarea' | 'select' | 'number' | 'date' | 'unit_table';

export interface StructuredFieldDef {
  name: string;
  type: StructuredFieldType;
  options?: string[];
}

export interface ProductTypeDef {
  label: string;
  roles: string[];
  structuredFields: StructuredFieldDef[];
}

/**
 * Registry of all product types with their labels, owning roles, and structured fields.
 * Populated per the doctrinal products table from RESEARCH.md.
 */
export const PRODUCT_TYPE_REGISTRY: Record<string, ProductTypeDef> = {
  // ── Commander products ──────────────────────────────────────────────────
  commander_intent: {
    label: "Commander's Intent",
    roles: ['commander'],
    structuredFields: [
      { name: 'purpose', type: 'textarea' },
      { name: 'keyTasks', type: 'textarea' },
      { name: 'endState', type: 'textarea' },
      { name: 'expandedPurpose', type: 'textarea' },
      { name: 'rationale', type: 'textarea' },
    ],
  },
  coa_decision: {
    label: 'COA Decision Brief',
    roles: ['commander'],
    structuredFields: [
      { name: 'selectedCOA', type: 'text' },
      { name: 'decisionRationale', type: 'textarea' },
      { name: 'modifications', type: 'textarea' },
    ],
  },
  strategic_guidance: {
    label: 'Strategic Guidance',
    roles: ['commander', 'dcom', 'j5'],
    structuredFields: [
      { name: 'objectiveCount', type: 'number' },
      { name: 'objectives', type: 'textarea' },
      { name: 'priority', type: 'select', options: ['primary', 'secondary', 'tertiary'] },
    ],
  },
  warnord_approval: {
    label: 'WARNORD Approval',
    roles: ['commander'],
    structuredFields: [
      { name: 'approvalStatus', type: 'select', options: ['approved', 'approved_with_changes', 'returned'] },
      { name: 'notes', type: 'textarea' },
    ],
  },

  // ── J2 Intelligence products ─────────────────────────────────────────────
  ipb_assessment: {
    label: 'IPB Assessment',
    roles: ['j2'],
    structuredFields: [
      { name: 'threatLevel', type: 'select', options: ['low', 'moderate', 'high', 'severe'] },
      { name: 'areaOfOperations', type: 'textarea' },
      { name: 'namedAreasOfInterest', type: 'textarea' },
    ],
  },
  threat_assessment: {
    label: 'Threat Assessment',
    roles: ['j2'],
    structuredFields: [
      { name: 'threatActor', type: 'text' },
      { name: 'capabilitySummary', type: 'textarea' },
      { name: 'mostLikelyCOA', type: 'textarea' },
      { name: 'mostDangerousCOA', type: 'textarea' },
    ],
  },
  oob: {
    label: 'Order of Battle',
    roles: ['j2'],
    structuredFields: [
      { name: 'forceComposition', type: 'unit_table' },
      { name: 'keyCapabilities', type: 'textarea' },
      { name: 'equipmentSummary', type: 'textarea' },
    ],
  },
  intel_summary: {
    label: 'Intelligence Summary (INTSUM)',
    roles: ['j2'],
    structuredFields: [
      { name: 'reportingPeriod', type: 'text' },
      { name: 'significantActivity', type: 'textarea' },
      { name: 'assessments', type: 'textarea' },
    ],
  },
  pir: {
    label: 'Priority Intelligence Requirements (PIR)',
    roles: ['j2'],
    structuredFields: [
      { name: 'requirements', type: 'textarea' },
      { name: 'collectionPlan', type: 'textarea' },
    ],
  },

  // ── J3 Operations products ───────────────────────────────────────────────
  sync_matrix: {
    label: 'Synchronization Matrix',
    roles: ['j3', 'fires'],
    structuredFields: [
      { name: 'phases', type: 'textarea' },
      { name: 'tasks', type: 'textarea' },
      { name: 'resources', type: 'textarea' },
    ],
  },
  coa_sketch: {
    label: 'COA Sketch',
    roles: ['j3'],
    structuredFields: [
      { name: 'conceptOfOperation', type: 'textarea' },
      { name: 'mainEffort', type: 'text' },
      { name: 'supportingEfforts', type: 'textarea' },
    ],
  },
  task_org: {
    label: 'Task Organization',
    roles: ['j3', 'socom', 'jfacc', 'jflcc', 'jfmcc', 'jfsocc'],
    structuredFields: [
      { name: 'commandElement', type: 'text' },
      { name: 'attachments', type: 'textarea' },
      { name: 'detachments', type: 'textarea' },
    ],
  },
  roe: {
    label: 'Rules of Engagement (ROE)',
    roles: ['j3', 'sja'],
    structuredFields: [
      { name: 'authorizedActions', type: 'textarea' },
      { name: 'restrictedActions', type: 'textarea' },
      { name: 'legalReview', type: 'textarea' },
    ],
  },
  execute_order: {
    label: 'Execute Order (EXORD)',
    roles: ['j3'],
    structuredFields: [
      { name: 'effectiveDateTime', type: 'date' },
      { name: 'tasks', type: 'textarea' },
      { name: 'coordinatingInstructions', type: 'textarea' },
    ],
  },

  // ── J35 Future Plans products ────────────────────────────────────────────
  coa_development: {
    label: 'COA Development',
    roles: ['j35'],
    structuredFields: [
      { name: 'coaNumber', type: 'number' },
      { name: 'coaName', type: 'text' },
      { name: 'conceptOfOperation', type: 'textarea' },
      { name: 'schemeOfManeuver', type: 'textarea' },
    ],
  },
  coa_analysis: {
    label: 'COA Analysis (Wargame)',
    roles: ['j35'],
    structuredFields: [
      { name: 'methodology', type: 'select', options: ['belt', 'avenue', 'box'] },
      { name: 'advantages', type: 'textarea' },
      { name: 'disadvantages', type: 'textarea' },
      { name: 'recommendation', type: 'textarea' },
    ],
  },
  staff_estimate: {
    label: 'Staff Estimate',
    roles: ['cos', 'j35', 'j7', 'j8', 'j9', 'sja', 'polad', 'pao', 'surgeon',
            'cyber', 'space', 'transcom', 'socom', 'io', 'fires', 'ew',
            'jfacc', 'jflcc', 'jfmcc', 'jfsocc', 'engineer', 'cbrn', 'knowledge_mgmt'],
    structuredFields: [
      { name: 'missionImpact', type: 'textarea' },
      { name: 'currentStatus', type: 'textarea' },
      { name: 'considerations', type: 'textarea' },
      { name: 'recommendation', type: 'textarea' },
    ],
  },
  campaign_plan: {
    label: 'Campaign Plan',
    roles: ['j35'],
    structuredFields: [
      { name: 'campaignObjective', type: 'textarea' },
      { name: 'phases', type: 'textarea' },
      { name: 'endState', type: 'textarea' },
    ],
  },

  // ── J4 Logistics products ────────────────────────────────────────────────
  logistics_estimate: {
    label: 'Logistics Estimate',
    roles: ['j4', 'transcom'],
    structuredFields: [
      { name: 'supplyStatus', type: 'select', options: ['green', 'amber', 'red'] },
      { name: 'sustainmentConcept', type: 'textarea' },
      { name: 'criticalShortfalls', type: 'textarea' },
    ],
  },
  css_annex: {
    label: 'CSS Annex',
    roles: ['j4'],
    structuredFields: [
      { name: 'cssOrganization', type: 'textarea' },
      { name: 'supplyClasses', type: 'textarea' },
      { name: 'maintenancePlan', type: 'textarea' },
    ],
  },
  supply_plan: {
    label: 'Supply Plan',
    roles: ['j4'],
    structuredFields: [
      { name: 'supplyClasses', type: 'textarea' },
      { name: 'distributionPlan', type: 'textarea' },
      { name: 'prepositioningRequirements', type: 'textarea' },
    ],
  },

  // ── J5 Strategic Plans products ──────────────────────────────────────────
  strategic_estimate: {
    label: 'Strategic Estimate',
    roles: ['j5', 'polad'],
    structuredFields: [
      { name: 'situation', type: 'textarea' },
      { name: 'missionAnalysis', type: 'textarea' },
      { name: 'courses', type: 'textarea' },
    ],
  },
  strategic_direction: {
    label: 'Strategic Direction',
    roles: ['j5', 'commander'],
    structuredFields: [
      { name: 'nationalObjectives', type: 'textarea' },
      { name: 'militaryObjectives', type: 'textarea' },
      { name: 'constraints', type: 'textarea' },
      { name: 'restraints', type: 'textarea' },
    ],
  },
  campaign_objectives: {
    label: 'Campaign Objectives',
    roles: ['j5'],
    structuredFields: [
      { name: 'primaryObjective', type: 'textarea' },
      { name: 'secondaryObjectives', type: 'textarea' },
      { name: 'conditions', type: 'textarea' },
    ],
  },

  // ── J6 Communications products ───────────────────────────────────────────
  comms_plan: {
    label: 'Communications Plan',
    roles: ['j6'],
    structuredFields: [
      { name: 'primaryFrequencies', type: 'textarea' },
      { name: 'backupProcedures', type: 'textarea' },
      { name: 'networkArchitecture', type: 'textarea' },
    ],
  },
  c2_architecture: {
    label: 'C2 Architecture',
    roles: ['j6'],
    structuredFields: [
      { name: 'c2Nodes', type: 'textarea' },
      { name: 'commandRelationships', type: 'textarea' },
      { name: 'liaisons', type: 'textarea' },
    ],
  },
  network_diagram: {
    label: 'Network Diagram',
    roles: ['j6'],
    structuredFields: [
      { name: 'networkTopology', type: 'textarea' },
      { name: 'keyNodes', type: 'textarea' },
      { name: 'redundancy', type: 'textarea' },
    ],
  },

  // ── J1 Personnel products ────────────────────────────────────────────────
  personnel_estimate: {
    label: 'Personnel Estimate',
    roles: ['j1'],
    structuredFields: [
      { name: 'authorizedStrength', type: 'number' },
      { name: 'presentForDuty', type: 'number' },
      { name: 'shortfalls', type: 'textarea' },
    ],
  },
  manning_status: {
    label: 'Manning Status Report',
    roles: ['j1'],
    structuredFields: [
      { name: 'reportDate', type: 'date' },
      { name: 'totalStrength', type: 'number' },
      { name: 'byUnit', type: 'unit_table' },
    ],
  },
  casualty_tracking: {
    label: 'Casualty Tracking',
    roles: ['j1'],
    structuredFields: [
      { name: 'killed', type: 'number' },
      { name: 'wounded', type: 'number' },
      { name: 'missing', type: 'number' },
      { name: 'notes', type: 'textarea' },
    ],
  },
};

// ─── Extracted Exercise Data ───────────────────────────────────────────────────

/**
 * Structured data extracted by the exercise extraction pipeline from a scenario document.
 * Fields are populated based on the document type (OOB, SITREP, CAMPAIGN_PLAN, etc.).
 */
export interface ExtractedExerciseData {
  /** One-paragraph summary of the document */
  summary: string;

  /** Force units and dispositions — primarily from OOB documents */
  forceDispositions?: Array<{
    unitName: string;
    echelon: string;
    sidc?: string;
    location?: { lat: number; lng: number } | string;
    strength?: string;
    equipment?: string[];
  }>;

  /** Objectives with priority tiers — primarily from CAMPAIGN_PLAN and SITREP */
  objectives?: Array<{
    id: string;
    description: string;
    priority: 'primary' | 'secondary' | 'tertiary';
  }>;

  /** Timeline of events — from SITREP, ALERTORD, and FRAGO */
  timeline?: Array<{
    event: string;
    time: string;
    phase: string;
  }>;

  /** Key events and their operational significance — from SITREP */
  keyEvents?: Array<{
    event: string;
    significance: string;
  }>;

  /** Access/basing/overflight data — from COUNTRY_POLICY documents */
  accessBasingOverflight?: {
    access: string;
    basing: string;
    overflight: string;
    conditions: string;
  };

  /** Task assignments — from ALERTORD and FRAGO */
  tasks?: Array<{
    assignedTo: string;
    task: string;
    purpose: string;
  }>;

  /** Changed items (FRAGO deltas) — from FRAGO documents */
  changedItems?: Array<{
    field: string;
    oldValue?: string;
    newValue: string;
  }>;

  /** Full raw LLM extraction output for audit/debugging */
  rawExtraction: Record<string, unknown>;
}
