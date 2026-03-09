/**
 * Exercise Frontend Types
 *
 * Phase 14 Plan 06: Frontend-facing TypeScript interfaces for all exercise domain types.
 * Phase 15 Plan 02: Added StaffProduct, StaffNotification, staff role config constants.
 *
 * These mirror the backend types (backend/src/exercise/types.ts) as plain interfaces —
 * no Zod schema validation needed on the frontend.
 *
 * Covers: ExerciseScenario, ScenarioDocument, IPBAssessment, IPBLayer, ScenarioCOA,
 * ExerciseCOAScore, ExerciseOrder, WARNORDContent, OPORDContent, FRAGOContent,
 * PlanningTask, ExerciseGate, BoardSummary, COAComparisonResult, all input types,
 * SITREPDeltaPreview for the SITREP delta preview flow, and Phase 15 staff workspace types.
 */

// ─── Exercise Role ─────────────────────────────────────────────────────────────

export type ExerciseRole = 'blue_staff' | 'red_cell' | 'exercise_control';

// ─── Staff Role Config (Phase 15) ──────────────────────────────────────────────

/**
 * Categories for grouping staff roles in the sidebar.
 * Mirrors backend StaffRoleCategory — duplicated here as pure data (no backend import).
 */
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
}

/**
 * Data-driven configuration for all 31 JPP staff roles.
 * Duplicated from backend/src/exercise/types.ts — pure data, no import possible.
 */
export const STAFF_ROLE_CONFIG: Record<string, StaffRoleEntry> = {
  // ── Command (2) ────────────────────────────────────────────────────────────
  commander: {
    key: 'commander',
    label: 'Commander',
    category: 'Command',
    doctrinalFocus: "Strategic direction, COA decision, and commander's intent",
    defaultProducts: ['commander_intent', 'coa_decision', 'strategic_guidance', 'warnord_approval'],
  },
  dcom: {
    key: 'dcom',
    label: 'Deputy Commander (DCOM)',
    category: 'Command',
    doctrinalFocus: 'Commander support, staff coordination, and battle rhythm',
    defaultProducts: ['strategic_guidance'],
  },
  // ── J-Staff (11) ──────────────────────────────────────────────────────────
  cos: {
    key: 'cos',
    label: 'Chief of Staff (CoS)',
    category: 'J-Staff',
    doctrinalFocus: 'Staff management, battle rhythm, and synchronization',
    defaultProducts: ['staff_estimate'],
  },
  j1: {
    key: 'j1',
    label: 'J1 (Personnel)',
    category: 'J-Staff',
    doctrinalFocus: 'Personnel readiness, manning, and casualty management',
    defaultProducts: ['personnel_estimate', 'manning_status', 'casualty_tracking'],
  },
  j2: {
    key: 'j2',
    label: 'J2 (Intelligence)',
    category: 'J-Staff',
    doctrinalFocus: 'IPB, threat assessment, and intelligence collection',
    defaultProducts: ['ipb_assessment', 'threat_assessment', 'oob', 'intel_summary', 'pir'],
  },
  j3: {
    key: 'j3',
    label: 'J3 (Operations)',
    category: 'J-Staff',
    doctrinalFocus: 'Current operations, synchronization, and execution',
    defaultProducts: ['sync_matrix', 'coa_sketch', 'task_org', 'roe', 'execute_order'],
  },
  j35: {
    key: 'j35',
    label: 'J35 (Future Plans)',
    category: 'J-Staff',
    doctrinalFocus: 'COA development, analysis, and campaign planning',
    defaultProducts: ['coa_development', 'coa_analysis', 'staff_estimate', 'campaign_plan'],
  },
  j4: {
    key: 'j4',
    label: 'J4 (Logistics)',
    category: 'J-Staff',
    doctrinalFocus: 'Logistics estimate, CSS planning, and supply',
    defaultProducts: ['logistics_estimate', 'css_annex', 'supply_plan'],
  },
  j5: {
    key: 'j5',
    label: 'J5 (Strategic Plans)',
    category: 'J-Staff',
    doctrinalFocus: 'Strategic analysis, policy integration, and campaign objectives',
    defaultProducts: ['strategic_estimate', 'strategic_direction', 'campaign_objectives'],
  },
  j6: {
    key: 'j6',
    label: 'J6 (Communications)',
    category: 'J-Staff',
    doctrinalFocus: 'C2 architecture, communications planning, and network design',
    defaultProducts: ['comms_plan', 'c2_architecture', 'network_diagram'],
  },
  j7: {
    key: 'j7',
    label: 'J7 (Training)',
    category: 'J-Staff',
    doctrinalFocus: 'Training management and exercise coordination',
    defaultProducts: ['staff_estimate'],
  },
  j8: {
    key: 'j8',
    label: 'J8 (Resource Management)',
    category: 'J-Staff',
    doctrinalFocus: 'Budget, resource allocation, and fiscal management',
    defaultProducts: ['staff_estimate'],
  },
  j9: {
    key: 'j9',
    label: 'J9 (Civil-Military)',
    category: 'J-Staff',
    doctrinalFocus: 'Civil-military operations and interagency coordination',
    defaultProducts: ['staff_estimate'],
  },
  // ── Special Staff (4) ─────────────────────────────────────────────────────
  sja: {
    key: 'sja',
    label: 'Staff Judge Advocate (SJA)',
    category: 'Special Staff',
    doctrinalFocus: 'Legal advice, ROE, and law of armed conflict',
    defaultProducts: ['roe', 'staff_estimate'],
  },
  polad: {
    key: 'polad',
    label: 'Political Advisor (POLAD)',
    category: 'Special Staff',
    doctrinalFocus: 'Political-military analysis and interagency liaison',
    defaultProducts: ['strategic_estimate', 'staff_estimate'],
  },
  pao: {
    key: 'pao',
    label: 'Public Affairs Officer (PAO)',
    category: 'Special Staff',
    doctrinalFocus: 'Strategic communication and media operations',
    defaultProducts: ['staff_estimate'],
  },
  surgeon: {
    key: 'surgeon',
    label: 'Command Surgeon',
    category: 'Special Staff',
    doctrinalFocus: 'Medical readiness, CASEVAC, and force health protection',
    defaultProducts: ['staff_estimate'],
  },
  // ── Supporting Elements (7) ───────────────────────────────────────────────
  cyber: {
    key: 'cyber',
    label: 'Cyber',
    category: 'Supporting Elements',
    doctrinalFocus: 'Cyberspace operations and defensive cyber',
    defaultProducts: ['staff_estimate'],
  },
  space: {
    key: 'space',
    label: 'Space',
    category: 'Supporting Elements',
    doctrinalFocus: 'Space operations and satellite support',
    defaultProducts: ['staff_estimate'],
  },
  transcom: {
    key: 'transcom',
    label: 'TRANSCOM',
    category: 'Supporting Elements',
    doctrinalFocus: 'Strategic airlift, sealift, and transportation coordination',
    defaultProducts: ['logistics_estimate', 'staff_estimate'],
  },
  socom: {
    key: 'socom',
    label: 'SOCOM / SOF',
    category: 'Supporting Elements',
    doctrinalFocus: 'Special operations forces integration and employment',
    defaultProducts: ['staff_estimate', 'task_org'],
  },
  io: {
    key: 'io',
    label: 'Information Operations (IO)',
    category: 'Supporting Elements',
    doctrinalFocus: 'Information environment operations and influence',
    defaultProducts: ['staff_estimate'],
  },
  fires: {
    key: 'fires',
    label: 'Fires',
    category: 'Supporting Elements',
    doctrinalFocus: 'Joint fires, targeting, and fire support coordination',
    defaultProducts: ['sync_matrix', 'staff_estimate'],
  },
  ew: {
    key: 'ew',
    label: 'Electronic Warfare (EW)',
    category: 'Supporting Elements',
    doctrinalFocus: 'Electronic attack, protection, and warfare integration',
    defaultProducts: ['staff_estimate'],
  },
  // ── Component Commands (4) ────────────────────────────────────────────────
  jfacc: {
    key: 'jfacc',
    label: 'JFACC (Air)',
    category: 'Component Commands',
    doctrinalFocus: 'Air operations, ATO, and airspace management',
    defaultProducts: ['staff_estimate', 'task_org'],
  },
  jflcc: {
    key: 'jflcc',
    label: 'JFLCC (Land)',
    category: 'Component Commands',
    doctrinalFocus: 'Land component operations and ground force employment',
    defaultProducts: ['staff_estimate', 'task_org'],
  },
  jfmcc: {
    key: 'jfmcc',
    label: 'JFMCC (Maritime)',
    category: 'Component Commands',
    doctrinalFocus: 'Maritime component operations and sea control',
    defaultProducts: ['staff_estimate', 'task_org'],
  },
  jfsocc: {
    key: 'jfsocc',
    label: 'JFSOCC (Special Ops)',
    category: 'Component Commands',
    doctrinalFocus: 'Special operations component and SOF integration',
    defaultProducts: ['staff_estimate', 'task_org'],
  },
  // ── Additional Elements (3) ───────────────────────────────────────────────
  engineer: {
    key: 'engineer',
    label: 'Engineer',
    category: 'Additional Elements',
    doctrinalFocus: 'Engineer support, obstacle planning, and infrastructure',
    defaultProducts: ['staff_estimate'],
  },
  cbrn: {
    key: 'cbrn',
    label: 'CBRN',
    category: 'Additional Elements',
    doctrinalFocus: 'Chemical, biological, radiological, and nuclear defense',
    defaultProducts: ['staff_estimate'],
  },
  knowledge_mgmt: {
    key: 'knowledge_mgmt',
    label: 'Knowledge Management',
    category: 'Additional Elements',
    doctrinalFocus: 'Information sharing, common operating picture, and data management',
    defaultProducts: ['staff_estimate'],
  },
};

/**
 * Named preset templates for role selection in the Create Scenario modal.
 * Mirrors STAFF_PRESET_TEMPLATES from backend types.
 */
export const STAFF_PRESET_TEMPLATES: Record<string, string[]> = {
  full_joint_staff: [
    'commander', 'dcom',
    'cos', 'j1', 'j2', 'j3', 'j35', 'j4', 'j5', 'j6', 'j7', 'j8', 'j9',
    'sja', 'polad', 'pao', 'surgeon',
    'cyber', 'space', 'transcom', 'socom', 'io', 'fires', 'ew',
    'jfacc', 'jflcc', 'jfmcc', 'jfsocc',
    'engineer', 'cbrn', 'knowledge_mgmt',
  ],
  core_staff: [
    'commander', 'cos', 'j1', 'j2', 'j3', 'j35', 'j4', 'j5', 'j6',
  ],
  intel_focus: [
    'commander', 'j2', 'j35', 'j3', 'jfacc', 'fires',
  ],
};

/**
 * Ordered list of role categories for sidebar rendering.
 */
export const STAFF_ROLE_CATEGORIES: StaffRoleCategory[] = [
  'Command',
  'J-Staff',
  'Special Staff',
  'Supporting Elements',
  'Component Commands',
  'Additional Elements',
];

// ─── Staff Products (Phase 15) ─────────────────────────────────────────────────

export interface StaffProduct {
  id: string;
  scenarioId: string;
  roleKey: string;
  productType: string;
  title: string;
  status: 'draft' | 'published' | 'pending_review';
  structured: Record<string, unknown>;
  content: string;
  version: number;
  publishedAt: string | null;
  publishedBy: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStaffProductInput {
  roleKey: string;
  productType: string;
  title: string;
  structured?: Record<string, unknown>;
  content?: string;
}

export interface UpdateStaffProductInput {
  title?: string;
  structured?: Record<string, unknown>;
  content?: string;
}

// ─── Staff Notifications (Phase 15) ───────────────────────────────────────────

export interface StaffNotification {
  id: string;
  scenarioId: string;
  sourceProductId: string;
  sourceRole: string;
  targetRole: string;
  notificationType: string;
  diffSnapshot: Record<string, unknown> | null;
  isRead: boolean;
  isIntegrated: boolean;
  createdAt: string;
}

// ─── Agent Team Config (Phase 15) ─────────────────────────────────────────────

export interface AgentTeamConfig {
  id: string;
  scenarioId: string;
  roleKey: string;
  /** null = role default; non-null = override for this product type only */
  productType: string | null;
  agentTeamId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Agent Suggestion (Phase 15) ──────────────────────────────────────────────

export type SuggestionBlockStatus = 'pending' | 'accepted' | 'rejected';

export interface SuggestionBlock {
  id: string;
  type: 'structured_field' | 'narrative';
  fieldName?: string;
  content: string;
  status: SuggestionBlockStatus;
}

export interface AgentSuggestion {
  blocks: SuggestionBlock[];
}

// ─── Product Type Registry (Phase 15) ─────────────────────────────────────────

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
 * Duplicated from backend/src/exercise/types.ts — pure data, no import possible.
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

// ─── Document Types ────────────────────────────────────────────────────────────

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

// ─── Exercise Scenario ─────────────────────────────────────────────────────────

export interface ExerciseScenario {
  id: string;
  name: string;
  designation: 'training/exercise' | 'operational';
  /**
   * Ordered list of exercise phase names.
   * Default: Competition, Crisis, Conflict Day 4, Conflict Day 10, Conflict Day 22, Negotiation
   */
  exercisePhases: string[];
  currentPhaseIndex: number;
  status: 'draft' | 'active' | 'complete';
  /** Array of enabled staff role keys for this scenario. Phase 15 addition. */
  enabledRoles: string[];
  /** Per-role assignment mode. Phase 16 addition. Defaults to 'human' if absent. */
  roleAssignments?: Record<string, RoleAssignment>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScenarioInput {
  name: string;
  designation?: 'training/exercise' | 'operational';
  exercisePhases?: string[];
  enabledRoles?: string[];
  createdBy?: string;
}

// ─── Scenario Document ─────────────────────────────────────────────────────────

export interface ScenarioDocument {
  id: string;
  scenarioId: string;
  team: 'blue' | 'red' | 'controller';
  exercisePhase: string;
  documentType: ExerciseDocumentType;
  filename: string;
  mimeType: string;
  textContent: string;
  extractedData: Record<string, unknown>;
  extractionConfidence: number;
  extractionStatus: 'pending' | 'extracting' | 'complete' | 'failed';
  extractionError: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── IPB Layer ─────────────────────────────────────────────────────────────────

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
  geometry: Record<string, unknown>;
  properties: Record<string, unknown>;
  sidc?: string;
}

export interface OAKOCAnalysis {
  observation: string;
  avenues: string;
  keyTerrain: string;
  obstacles: string;
  coverAndConcealment: string;
}

export interface ForceDisposition {
  unitName: string;
  unitType: string;
  strength: string;
  position: Record<string, unknown>;
  readiness: 'ready' | 'limited' | 'degraded';
  notes?: string;
}

export interface NamedAreaOfInterest {
  id: string;
  name: string;
  geometry: Record<string, unknown>;
  significance: string;
  expectedActivity: string;
}

// ─── IPB Assessment ────────────────────────────────────────────────────────────

export interface IPBAssessment {
  id: string;
  scenarioId: string;
  team: 'blue' | 'red';
  perspective: 'own' | 'enemy_assessment';
  exercisePhase: string;
  areaOfOperations: Record<string, unknown>;
  terrainAnalysis: OAKOCAnalysis;
  threatAssessment: string;
  civilConsiderations: string;
  namedAreasOfInterest: NamedAreaOfInterest[];
  forceDispositions: ForceDisposition[];
  overlayLayers: IPBLayer[];
  version: number;
  parentVersionId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── COA Scoring ───────────────────────────────────────────────────────────────

export interface COACriterionScore {
  score: number;
  rationale: string;
  wargameEvidence?: string;
}

export interface ExerciseCOAScore {
  feasibility: COACriterionScore;
  acceptability: COACriterionScore;
  suitability: COACriterionScore;
  distinguishability: COACriterionScore;
  completeness: COACriterionScore;
  combinedScore: number;
  narrative: string;
  wargamingSessionId?: string;
}

// ─── Scenario COA ──────────────────────────────────────────────────────────────

export type CommanderDecision = 'accepted' | 'rejected' | 'modified' | 'combined' | 'returned';

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
  narrative: string;
  commanderDecision: CommanderDecision | null;
  commanderDecisionNotes: string;
  decisionHash: string | null;
  blockchainTx: string | null;
  selected: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCOAInput {
  team: 'blue' | 'red';
  exercisePhase: string;
  number: number;
  name: string;
  description: string;
  scheme: string;
  createdBy?: string;
}

// ─── COA Comparison ────────────────────────────────────────────────────────────

export interface COAComparisonResult {
  rankings: Array<{
    coaId: string;
    coaName: string;
    rank: number;
    combinedScore: number;
    rationale: string;
  }>;
  recommendedCOAId: string;
  comparisonNarrative: string;
  criteria: string[];
}

// ─── Exercise Orders ───────────────────────────────────────────────────────────

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

export interface OPORDContent {
  situation: Record<string, unknown>;
  mission: Record<string, unknown>;
  execution: Record<string, unknown>;
  serviceAndSupport: Record<string, unknown>;
  commandAndSignal: Record<string, unknown>;
}

export interface FRAGOContent {
  changedParagraphs: Partial<OPORDContent>;
  effectiveTime: string;
  references: string[];
}

export interface ExerciseOrder {
  id: string;
  scenarioId: string;
  team: 'blue' | 'red';
  orderType: 'WARNORD' | 'OPORD' | 'FRAGO';
  exercisePhase: string;
  version: number;
  content: WARNORDContent | OPORDContent | FRAGOContent;
  status: 'draft' | 'published';
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateOrderInput {
  team: 'blue' | 'red';
  orderType: 'WARNORD' | 'OPORD' | 'FRAGO';
  exercisePhase: string;
  coaId?: string;
  referencedOrderId?: string;
  createdBy?: string;
}

export interface CreateDraftInput {
  team: 'blue' | 'red';
  orderType: 'WARNORD' | 'OPORD' | 'FRAGO';
  exercisePhase: string;
  content: WARNORDContent | OPORDContent | FRAGOContent;
  createdBy?: string;
}

// ─── Planning Task ─────────────────────────────────────────────────────────────

export interface PlanningTask {
  id: string;
  orderId: string;
  scenarioId: string;
  team: 'blue' | 'red' | 'controller';
  assignedRole: 'blue_staff' | 'red_cell' | 'exercise_control';
  title: string;
  description: string;
  deadline: string | null;
  status: 'pending' | 'in_progress' | 'complete';
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoardSummary {
  total: number;
  pending: number;
  inProgress: number;
  complete: number;
  byRole: Record<string, { total: number; pending: number; inProgress: number; complete: number }>;
  overdueTasks: PlanningTask[];
}

// ─── Exercise Gate ─────────────────────────────────────────────────────────────

export interface ExerciseGate {
  id: string;
  scenarioId: string;
  exercisePhase: string;
  gateType: 'info_release' | 'phase_transition' | 'order_required';
  conditionDescription: string;
  isOpen: boolean;
  openedBy: string | null;
  openedAt: string | null;
  createdAt: string;
}

export interface CreateGateInput {
  exercisePhase: string;
  gateType: 'info_release' | 'phase_transition' | 'order_required';
  conditionDescription: string;
}

// ─── SITREP Delta Preview ──────────────────────────────────────────────────────

/**
 * Preview of IPB changes that would result from incorporating a SITREP document.
 * Returned by the previewIPBFromSITREP endpoint — does NOT commit any changes.
 * Staff reviews this before calling updateIPBFromSITREP to confirm the delta.
 */
export interface SITREPDeltaPreview {
  changedFields: Array<{
    section: string;        // e.g., "threatAssessment", "forceDispositions"
    fieldPath: string;      // dot-notation path to changed field
    oldValue: unknown;
    newValue: unknown;
    changeType: 'added' | 'modified' | 'removed';
  }>;
  affectedCOAs: Array<{
    coaId: string;
    coaName: string;
    impactReason: string;   // why this COA is affected
  }>;
  sitrepSummary: string;    // brief summary of the SITREP content
}

// ─── Tag Inference ─────────────────────────────────────────────────────────────

/**
 * Inferred tags from a file path — computed client-side for preview before upload.
 * Server-side inference uses inferTagsFromPath (backend/src/exercise/package-parser.ts).
 */
export interface InferredFileTags {
  team: 'blue' | 'red' | 'controller' | 'unknown';
  exercisePhase: string;
  documentType: ExerciseDocumentType;
  confidence: number; // 0–1
}

// ─── AI Workspace Types (Phase 16) ────────────────────────────────────────────

export type RoleAssignment = 'human' | 'ai' | 'disabled';

export interface StaffAgentDef {
  id: string;
  roleKey: string;
  name: string;
  rank: string;
  branch: string;
  specialty: string;
  focus: string;
  tools: string[];
  personality: string[];
  systemPromptHint: string;
  isDefault: boolean;
}

export interface AIRoleRun {
  id: string;
  scenarioId: string;
  roleKey: string;
  triggerType: 'manual' | 'opord_upload' | 'phase_change' | 'upstream_publish' | 'commander_directive';
  triggerContext: Record<string, unknown>;
  status: 'queued' | 'running' | 'paused' | 'awaiting_review' | 'complete' | 'failed';
  pausedAt?: string;
  resumedAt?: string;
  completedAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type AIChannelEventType =
  | 'task_started' | 'task_progress' | 'draft_ready' | 'review_required'
  | 'revision_requested' | 'approved' | 'rejected' | 'waiting_on_role'
  | 'ai_to_ai_request' | 'ai_to_ai_response' | 'error' | 'paused' | 'resumed';

export interface AIChannelEvent {
  id: string;
  scenarioId: string;
  roleKey: string;
  runId?: string;
  eventType: AIChannelEventType;
  payload: Record<string, unknown>;
  agentName?: string;
  createdAt: string;
}

export interface ReviewFeedback {
  action: 'approve' | 'edit_approve' | 'request_revision' | 'edit_request_revision' | 'reject';
  notes?: string;
  annotations?: Array<{
    paragraphIndex: number;
    startChar: number;
    endChar: number;
    highlightedText: string;
    comment: string;
  }>;
  edits?: Record<string, string>;
}

export interface StaffProductVersion {
  id: string;
  productId: string;
  version: number;
  content: string;
  structured: Record<string, unknown>;
  createdBy: string;
  revisionNotes?: string;
  createdAt: string;
}
