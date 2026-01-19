/**
 * Risk Assessment Module
 * AI-assisted risk assessment with 5x5 matrix and human review workflow
 */

// Types
export type {
  RiskMatrixEntry,
  RiskCalculatorResult,
  AutoFlag,
  AIRiskAssessment,
  AIRiskInput,
  RiskAssessment,
  RiskLevel,
  Likelihood,
  Impact,
  Mitigation,
} from './types.js';

// Risk calculator utilities
export {
  calculateRiskLevel,
  getRiskDecisionAuthority,
  combineRiskLevels,
  shouldAutoFlag,
  compareRiskLevels,
  riskMeetsThreshold,
  LIKELIHOOD_ORDER,
  IMPACT_ORDER,
  RISK_LEVEL_ORDER,
} from './risk-calculator.js';

// Store
export { RiskAssessmentStore, riskAssessmentStore, initRiskAssessmentTable } from './store.js';

// Service
export {
  RiskAssessmentService,
  getRiskAssessmentService,
  type RiskAssessmentServiceConfig,
} from './service.js';
