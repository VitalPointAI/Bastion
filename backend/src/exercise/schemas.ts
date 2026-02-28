/**
 * Exercise Domain Zod Schemas
 *
 * Phase 14 Plan 01: Runtime validation for all exercise entity types.
 * Follows the z.object patterns established in backend/src/planning/schemas.ts.
 * Uses Zod v4 API: z.record(keySchema, valueSchema).
 */

import { z } from 'zod';

// ─── Enums / Primitives ───────────────────────────────────────────────────────

export const ExerciseRoleSchema = z
  .enum(['blue_staff', 'red_cell', 'exercise_control'])
  .describe('Exercise participant role controlling information barrier visibility');

export const ExerciseDocumentTypeSchema = z
  .enum(['ALERTORD', 'SITREP', 'CAMPAIGN_PLAN', 'FRAGO', 'OOB', 'COUNTRY_POLICY', 'PLANNING_MAP', 'DIRECTIVE', 'OTHER'])
  .describe('Type of exercise document');

export const TeamSchema = z
  .enum(['blue', 'red', 'controller'])
  .describe('Team assignment for information barrier enforcement');

export const BinaryTeamSchema = z
  .enum(['blue', 'red'])
  .describe('Operational team — blue or red');

// ─── Exercise Scenario ────────────────────────────────────────────────────────

export const CreateExerciseScenarioSchema = z.object({
  name: z.string().min(1).describe('Scenario name'),
  designation: z.enum(['training/exercise', 'operational']).describe('Whether this is a training exercise or operational scenario'),
  exercisePhases: z.array(z.string()).min(1).describe('Ordered list of exercise phase names'),
  currentPhaseIndex: z.number().int().min(0).default(0).describe('Index into exercisePhases for the current active phase'),
  status: z.enum(['draft', 'active', 'complete']).default('draft').describe('Scenario lifecycle status'),
  createdBy: z.string().min(1).describe('DID of creator'),
});

export const UpdateExerciseScenarioSchema = CreateExerciseScenarioSchema.partial().omit({ createdBy: true });

// ─── Scenario Document ────────────────────────────────────────────────────────

export const CreateScenarioDocumentSchema = z.object({
  scenarioId: z.string().min(1).describe('Parent scenario ID'),
  team: TeamSchema,
  exercisePhase: z.string().min(1).describe('Exercise phase this document belongs to'),
  documentType: ExerciseDocumentTypeSchema,
  filename: z.string().min(1).describe('Original filename'),
  mimeType: z.string().min(1).describe('MIME type of the document'),
  textContent: z.string().describe('Full extracted text content'),
  extractedData: z.record(z.string(), z.unknown()).default({}).describe('Structured data extracted by AI pipeline'),
  extractionConfidence: z.number().min(0).max(1).default(0).describe('Extraction confidence 0–1'),
});

export const UpdateScenarioDocumentSchema = CreateScenarioDocumentSchema.partial().omit({ scenarioId: true });

// ─── IPB Layer ────────────────────────────────────────────────────────────────

export const IPBLayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['unit', 'area', 'line', 'point']),
  team: BinaryTeamSchema,
  layerType: z.enum(['forces', 'key_terrain', 'avenue_of_approach', 'nai', 'engagement_area', 'obstacle']),
  geometry: z.record(z.string(), z.unknown()).describe('GeoJSON geometry object'),
  properties: z.record(z.string(), z.unknown()).default({}),
  sidc: z.string().optional().describe('MIL-STD-2525D symbol identification code'),
});

// ─── OAKOC Analysis ───────────────────────────────────────────────────────────

export const OAKOCAnalysisSchema = z.object({
  observation: z.string().describe('Observation and fields of fire'),
  avenues: z.string().describe('Avenues of approach'),
  keyTerrain: z.string().describe('Key terrain'),
  obstacles: z.string().describe('Obstacles'),
  coverAndConcealment: z.string().describe('Cover and concealment'),
});

// ─── Force Disposition ────────────────────────────────────────────────────────

export const ForceDispositionSchema = z.object({
  unitName: z.string(),
  unitType: z.string(),
  strength: z.string(),
  position: z.record(z.string(), z.unknown()).describe('GeoJSON Point'),
  readiness: z.enum(['ready', 'limited', 'degraded']),
  notes: z.string().optional(),
});

// ─── Named Area of Interest ───────────────────────────────────────────────────

export const NamedAreaOfInterestSchema = z.object({
  id: z.string(),
  name: z.string(),
  geometry: z.record(z.string(), z.unknown()).describe('GeoJSON geometry'),
  significance: z.string(),
  expectedActivity: z.string(),
});

// ─── IPB Assessment ───────────────────────────────────────────────────────────

export const CreateIPBAssessmentSchema = z.object({
  scenarioId: z.string().min(1),
  team: BinaryTeamSchema,
  perspective: z.enum(['own', 'enemy_assessment']).describe('own = own forces picture; enemy_assessment = assessment of opposing forces'),
  exercisePhase: z.string().min(1),
  areaOfOperations: z.record(z.string(), z.unknown()).describe('GeoJSON-compatible area of operations boundary'),
  terrainAnalysis: OAKOCAnalysisSchema,
  threatAssessment: z.string(),
  civilConsiderations: z.string(),
  namedAreasOfInterest: z.array(NamedAreaOfInterestSchema).default([]),
  forceDispositions: z.array(ForceDispositionSchema).default([]),
  overlayLayers: z.array(IPBLayerSchema).default([]).describe('IPB overlay layers for ValidityMap rendering'),
  version: z.number().int().min(1).default(1),
  parentVersionId: z.string().nullable().default(null),
  createdBy: z.string().min(1).describe('DID of creator'),
});

export const UpdateIPBAssessmentSchema = CreateIPBAssessmentSchema.partial().omit({ scenarioId: true, createdBy: true });

// ─── COA Score ────────────────────────────────────────────────────────────────

export const COACriterionScoreSchema = z.object({
  score: z.number().min(0).max(10),
  rationale: z.string(),
  wargameEvidence: z.string().optional(),
});

export const ExerciseCOAScoreSchema = z.object({
  feasibility: COACriterionScoreSchema,
  acceptability: COACriterionScoreSchema,
  suitability: COACriterionScoreSchema,
  distinguishability: COACriterionScoreSchema,
  completeness: COACriterionScoreSchema,
  combinedScore: z.number().min(0).max(10),
  narrative: z.string(),
  wargamingSessionId: z.string().optional(),
});

// ─── Scenario COA ─────────────────────────────────────────────────────────────

export const CreateScenarioCOASchema = z.object({
  scenarioId: z.string().min(1),
  team: BinaryTeamSchema,
  exercisePhase: z.string().min(1),
  number: z.number().int().min(1),
  name: z.string().min(1),
  description: z.string(),
  scheme: z.string(),
  doctScores: ExerciseCOAScoreSchema.nullable().default(null),
  wargameEvidence: z.record(z.string(), z.unknown()).default({}),
  combinedScore: z.number().nullable().default(null),
  narrative: z.string().default(''),
  commanderDecision: z.enum(['accepted', 'rejected', 'modified', 'combined', 'returned']).nullable().default(null),
  commanderDecisionNotes: z.string().default(''),
  decisionHash: z.string().nullable().default(null),
  blockchainTx: z.string().nullable().default(null),
  selected: z.boolean().default(false),
  createdBy: z.string().min(1),
});

export const UpdateScenarioCOASchema = CreateScenarioCOASchema.partial().omit({ scenarioId: true, createdBy: true });

// ─── Order Content ────────────────────────────────────────────────────────────

export const WARNORDContentSchema = z.object({
  situation: z.string(),
  missionStatement: z.string(),
  commandersIntent: z.string(),
  initialTasks: z.array(z.object({
    assignedTo: z.string(),
    task: z.string(),
    purpose: z.string(),
    deadline: z.string().optional(),
  })).default([]),
  timelineSummary: z.string(),
  serviceAndSupport: z.string(),
  commandAndSignal: z.string(),
});

export const OPORDContentSchema = z.object({
  situation: z.record(z.string(), z.unknown()),
  mission: z.record(z.string(), z.unknown()),
  execution: z.record(z.string(), z.unknown()),
  serviceAndSupport: z.record(z.string(), z.unknown()),
  commandAndSignal: z.record(z.string(), z.unknown()),
});

export const FRAGOContentSchema = z.object({
  changedParagraphs: z.record(z.string(), z.unknown()),
  effectiveTime: z.string(),
  references: z.array(z.string()).default([]),
});

// ─── Exercise Order ───────────────────────────────────────────────────────────

export const CreateExerciseOrderSchema = z.object({
  scenarioId: z.string().min(1),
  team: BinaryTeamSchema,
  orderType: z.enum(['WARNORD', 'OPORD', 'FRAGO']),
  exercisePhase: z.string().min(1),
  version: z.number().int().min(1).default(1),
  content: z.union([WARNORDContentSchema, OPORDContentSchema, FRAGOContentSchema]),
  status: z.enum(['draft', 'published']).default('draft'),
  publishedAt: z.date().nullable().default(null),
  createdBy: z.string().min(1),
});

export const UpdateExerciseOrderSchema = CreateExerciseOrderSchema.partial().omit({ scenarioId: true, createdBy: true });

// ─── Planning Task ────────────────────────────────────────────────────────────

export const CreatePlanningTaskSchema = z.object({
  orderId: z.string().min(1),
  scenarioId: z.string().min(1),
  team: TeamSchema,
  assignedRole: ExerciseRoleSchema,
  title: z.string().min(1),
  description: z.string(),
  deadline: z.date().nullable().default(null),
  status: z.enum(['pending', 'in_progress', 'complete']).default('pending'),
  completedAt: z.date().nullable().default(null),
});

export const UpdatePlanningTaskSchema = CreatePlanningTaskSchema.partial().omit({ orderId: true, scenarioId: true });

// ─── Exercise Gate ────────────────────────────────────────────────────────────

export const CreateExerciseGateSchema = z.object({
  scenarioId: z.string().min(1),
  exercisePhase: z.string().min(1),
  gateType: z.enum(['info_release', 'phase_transition', 'order_required']),
  conditionDescription: z.string().min(1),
  isOpen: z.boolean().default(false),
  openedBy: z.string().nullable().default(null),
  openedAt: z.date().nullable().default(null),
});

export const UpdateExerciseGateSchema = CreateExerciseGateSchema.partial().omit({ scenarioId: true });
