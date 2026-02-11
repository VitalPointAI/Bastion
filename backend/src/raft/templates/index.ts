/**
 * MDMP RAFT Templates Barrel Export
 *
 * Phase 5.1 Plan 13: Centralized exports for all MDMP RAFT templates.
 * Import templates via: import { TASK_EXTRACTION_TEMPLATE } from '../raft/templates/index.js'
 */

// Task Extraction Template (MDMP-1-02)
export {
  TASK_EXTRACTION_TEMPLATE,
  TASK_EXTRACTION_INPUT_SCHEMA,
  TASK_EXTRACTION_OUTPUT_SCHEMA,
  type TaskExtractionInput,
  type TaskExtractionOutput,
  type ExtractedTask,
  type ExtractedConstraint,
} from './mdmp-task-extraction.js';

// CCIR Generation Template (MDMP-2-07)
export {
  CCIR_GENERATION_TEMPLATE,
  CCIR_INPUT_SCHEMA,
  CCIR_OUTPUT_SCHEMA,
  type CCIRInput,
  type CCIRGenerationOutput,
  type CCIR,
} from './mdmp-ccir-generation.js';

// OPORD Generation Template (MDMP-7-01)
export {
  OPORD_GENERATION_TEMPLATE,
  OPORD_INPUT_SCHEMA,
  OPORD_OUTPUT_SCHEMA,
  type OPORDGenerationInput,
  type OPORDGenerationOutput,
} from './mdmp-opord-generation.js';

// IPB Analysis Template (MDMP-2-03)
export {
  IPB_ANALYSIS_TEMPLATE,
  IPB_INPUT_SCHEMA,
  IPB_OUTPUT_SCHEMA,
  type IPBAnalysisInput,
  type IPBAnalysisOutput,
  type OAKOCAnalysis,
  type WeatherEffects,
  type ASCOPEAnalysis,
  type ThreatAssessment,
  type NAI,
} from './mdmp-ipb-analysis.js';

// Wargame Extraction Template (MDMP-4-04)
export {
  WARGAME_EXTRACTION_TEMPLATE,
  WARGAME_INPUT_SCHEMA,
  WARGAME_OUTPUT_SCHEMA,
  type WargameExtractionInput,
  type WargameExtractionOutput,
  type DecisionPoint,
  type HighPayoffTarget,
  type IntelligenceRequirement,
  type Branch,
  type Sequel,
} from './mdmp-wargame-extraction.js';
