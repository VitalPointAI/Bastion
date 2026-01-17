/**
 * Strategic Planning Schemas
 * Zod schemas for strategic planning data model based on military doctrine
 *
 * Exports:
 * - DIME framework (Diplomatic, Informational, Military, Economic)
 * - Ends-Ways-Means doctrine
 * - Strategic objectives
 * - Risk assessments
 * - Commander's intent
 */

// DIME Framework
export {
  DIMEInstrumentSchema,
  DIMEFILInstrumentSchema,
  type DIMEInstrument,
  type DIMEFILInstrument,
} from './dime.js';

// Ends-Ways-Means Doctrine
export {
  EndsSchema,
  WaysSchema,
  MeansSchema,
  EndsWaysMeansSchema,
  type Ends,
  type Ways,
  type Means,
  type EndsWaysMeans,
} from './ends-ways-means.js';

// Strategic Objectives
export {
  PrioritySchema,
  ObjectiveStatusSchema,
  ExtractedBySchema,
  StrategicObjectiveSchema,
  type Priority,
  type ObjectiveStatus,
  type ExtractedBy,
  type StrategicObjective,
} from './strategic-objective.js';

// Risk Assessment
export {
  LikelihoodSchema,
  ImpactSchema,
  RiskLevelSchema,
  RiskDecisionSchema,
  RiskDimensionSchema,
  MitigationSchema,
  RiskAssessmentSchema,
  calculateRiskLevel,
  type Likelihood,
  type Impact,
  type RiskLevel,
  type RiskDecision,
  type RiskDimension,
  type Mitigation,
  type RiskAssessment,
} from './risk-assessment.js';

// Commander's Intent
export {
  CommanderIntentSchema,
  type CommanderIntent,
} from './commander-intent.js';
