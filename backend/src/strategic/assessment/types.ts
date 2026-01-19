/**
 * Risk Assessment Types
 * Extended types for AI-assisted risk assessment
 */

import type {
  RiskAssessment,
  RiskLevel,
  Likelihood,
  Impact,
  Mitigation,
} from '../schemas/risk-assessment.js';

/**
 * Risk matrix entry for lookup table
 */
export interface RiskMatrixEntry {
  likelihood: Likelihood;
  impact: Impact;
  level: RiskLevel;
}

/**
 * Result from risk calculation
 */
export interface RiskCalculatorResult {
  riskLevel: RiskLevel;
  factors: string[];
  recommendations: string[];
}

/**
 * Auto-flag for high-risk assessments
 */
export interface AutoFlag {
  flag: string;
  reason: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

/**
 * AI-generated risk assessment with metadata
 * Extends base RiskAssessment with AI-specific fields
 */
export interface AIRiskAssessment extends RiskAssessment {
  /** Identifies this as AI-generated */
  generatedBy: 'AI_AGENT';
  /** Confidence in the assessment (0-1) */
  confidenceScore: number;
  /** Questions the human reviewer should consider */
  questionsForReviewer: string[];
  /** Auto-generated flags for attention items */
  autoFlags: AutoFlag[];
  /** Assumptions underlying this assessment */
  assumptions: string[];
  /** Areas of uncertainty */
  uncertainties: string[];
}

/**
 * Input for AI risk generation (before derived fields calculated)
 */
export interface AIRiskInput {
  riskToMission: {
    likelihood: Likelihood;
    impact: Impact;
    factors: string[];
  };
  riskToForce: {
    likelihood: Likelihood;
    impact: Impact;
    factors: string[];
  };
  mitigations: Array<{
    description: string;
    effectiveness: 'HIGH' | 'MEDIUM' | 'LOW';
    resourceCost: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  assumptions: string[];
  uncertainties: string[];
  questionsForReviewer: string[];
  confidenceScore: number;
}

/**
 * Re-export base types for convenience
 */
export type {
  RiskAssessment,
  RiskLevel,
  Likelihood,
  Impact,
  Mitigation,
};
