/**
 * Exercise Frontend Types
 *
 * Phase 14 Plan 06: Frontend-facing TypeScript interfaces for all exercise domain types.
 * These mirror the backend types (backend/src/exercise/types.ts) as plain interfaces —
 * no Zod schema validation needed on the frontend.
 *
 * Covers: ExerciseScenario, ScenarioDocument, IPBAssessment, IPBLayer, ScenarioCOA,
 * ExerciseCOAScore, ExerciseOrder, WARNORDContent, OPORDContent, FRAGOContent,
 * PlanningTask, ExerciseGate, BoardSummary, COAComparisonResult, all input types,
 * and SITREPDeltaPreview for the SITREP delta preview flow.
 */

// ─── Exercise Role ─────────────────────────────────────────────────────────────

export type ExerciseRole = 'blue_staff' | 'red_cell' | 'exercise_control';

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
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScenarioInput {
  name: string;
  designation?: 'training/exercise' | 'operational';
  exercisePhases?: string[];
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
