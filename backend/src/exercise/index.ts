/**
 * Exercise Module — Public API
 *
 * Phase 14 Plan 01: Barrel export for all exercise types, schemas, stores,
 * and information barrier utilities.
 *
 * Usage:
 *   import { ScenarioStore, getVisibleTeams, withExerciseBarrier } from './exercise/index.js';
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type {
  ExerciseRole,
  ExerciseDocumentType,
  ExerciseScenario,
  CreateExerciseScenario,
  ScenarioDocument,
  CreateScenarioDocument,
  IPBLayer,
  OAKOCAnalysis,
  ForceDisposition,
  NamedAreaOfInterest,
  IPBAssessment,
  CreateIPBAssessment,
  COACriterionScore,
  ExerciseCOAScore,
  CommanderDecision,
  ScenarioCOA,
  CreateScenarioCOA,
  WARNORDContent,
  OPORDContent,
  FRAGOContent,
  ExerciseOrder,
  CreateExerciseOrder,
  PlanningTask,
  CreatePlanningTask,
  ExerciseGate,
  CreateExerciseGate,
  ExtractedExerciseData,
} from './types.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────

export {
  ExerciseRoleSchema,
  ExerciseDocumentTypeSchema,
  TeamSchema,
  BinaryTeamSchema,
  CreateExerciseScenarioSchema,
  UpdateExerciseScenarioSchema,
  CreateScenarioDocumentSchema,
  UpdateScenarioDocumentSchema,
  IPBLayerSchema,
  OAKOCAnalysisSchema,
  ForceDispositionSchema,
  NamedAreaOfInterestSchema,
  CreateIPBAssessmentSchema,
  UpdateIPBAssessmentSchema,
  COACriterionScoreSchema,
  ExerciseCOAScoreSchema,
  CreateScenarioCOASchema,
  UpdateScenarioCOASchema,
  WARNORDContentSchema,
  OPORDContentSchema,
  FRAGOContentSchema,
  CreateExerciseOrderSchema,
  UpdateExerciseOrderSchema,
  CreatePlanningTaskSchema,
  UpdatePlanningTaskSchema,
  CreateExerciseGateSchema,
  UpdateExerciseGateSchema,
} from './schemas.js';

// ─── Information Barrier ──────────────────────────────────────────────────────

export {
  getVisibleTeams,
  withExerciseBarrier,
} from './information-barrier.js';

// ─── Stores ───────────────────────────────────────────────────────────────────

export { ScenarioStore } from './scenario-store.js';
export { ScenarioDocumentStore } from './document-store.js';
export { IPBStore } from './ipb-store.js';
export { COAStore } from './coa-store.js';
export { OrderStore } from './order-store.js';
export { TaskStore } from './task-store.js';
export { GateStore } from './gate-store.js';

// ─── Package Parser & Extraction Service ──────────────────────────────────────

export type { PackageTags, ScenarioPackageFile, TaggedScenarioFile } from './package-parser.js';
export {
  TEAM_HEURISTICS,
  PHASE_HEURISTICS,
  TYPE_HEURISTICS,
  inferTagsFromPath,
  parseScenarioPackage,
} from './package-parser.js';
export { ExerciseExtractionService } from './extraction-service.js';
