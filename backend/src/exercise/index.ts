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

// ─── AI Workspace Stores ──────────────────────────────────────────────────────

export { AIRunStore } from './ai-run-store.js';
export { AIChannelStore } from './ai-channel-store.js';
export { ProductVersionStore } from './product-version-store.js';
export { AIContextStore } from './ai-context-store.js';
export type { AIContextEntry } from './ai-context-store.js';
export { AICoordinationStore } from './ai-coordination-store.js';
export type { AICoordinationEntry } from './ai-coordination-store.js';

// ─── AI Workspace Runner & Graph ──────────────────────────────────────────────

export type { AgentRunner } from './ai-role-runner.js';
export { LangGraphAgentRunner } from './ai-role-runner.js';
export { createAIRoleGraph, runAIRoleGraph } from './ai-role-graph.js';
export type { StoreContext as AIRoleStoreContext } from './ai-role-graph.js';
export { TriggerRouter, registerAIRoleWorker } from './trigger-router.js';

// ─── Agent Library ────────────────────────────────────────────────────────────

export { getDefaultAgentsForRole, DEFAULT_AGENT_LIBRARY } from './agent-library.js';

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

// ─── IPB Service ──────────────────────────────────────────────────────────────

export type { DeltaSummary } from './ipb-service.js';
export { IPBService } from './ipb-service.js';

// ─── Training Infrastructure (Phase 22) ──────────────────────────────────────

export { aarStore } from './aar-store.js';
export type { AAREvent } from './aar-store.js';
export { checkpointStore } from './checkpoint-store.js';
export type { ExerciseCheckpoint } from './checkpoint-store.js';

// ─── COA Scoring Service ──────────────────────────────────────────────────────

export type { COAComparisonResult } from './coa-scoring-service.js';
export { COAScoringService } from './coa-scoring-service.js';

// ─── Order Generator & Planning Board ─────────────────────────────────────────

export type { OrderGeneratorLLMConfig } from './order-generator.js';
export { ExerciseOrderGenerator } from './order-generator.js';
export type { BoardSummary } from './planning-board-service.js';
export { PlanningBoardService } from './planning-board-service.js';
