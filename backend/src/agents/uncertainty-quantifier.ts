/**
 * Uncertainty Quantifier Agent
 *
 * Produces calibrated confidence intervals for AI agent outputs and detects false precision.
 * Enforces INVARIANT 5: All AI outputs that inform governance decisions must include
 * calibrated confidence intervals.
 *
 * Purpose: Wrap other agent outputs with uncertainty metadata, detect spurious specificity,
 * and provide calibration reporting for agent performance.
 */

import { AgentManifest, AgentPhase, AgentCapability, AutonomyLevel } from './types.js';
import { ActivityCategory } from '../mdmp/types.js';

// ==========================================================================
// Output Interfaces
// ==========================================================================

/**
 * Confidence interval for a prediction or estimate.
 */
export interface ConfidenceInterval {
  /** Point estimate (0-1) */
  pointEstimate: number;
  /** Lower bound of 90% confidence interval */
  lowerBound: number;
  /** Upper bound of 90% confidence interval */
  upperBound: number;
  /** Calibration quality: how well this interval matches historical accuracy */
  calibrationScore: number;
  /** Method used to derive interval */
  method: 'statistical' | 'expert_elicitation' | 'ensemble' | 'heuristic';
}

/**
 * False precision flag for spuriously specific claims.
 */
export interface FalsePrecisionFlag {
  /** The claim being flagged */
  claim: string;
  /** Why this appears to be falsely precise */
  reason: string;
  /** Suggested reformulation */
  suggestedReformulation: string;
  /** Severity of false precision */
  severity: 'high' | 'medium' | 'low';
}

/**
 * Comprehensive uncertainty assessment for an agent output.
 */
export interface UncertaintyAssessmentOutput {
  /** Source agent that produced the original output */
  sourceAgentId: string;
  /** Activity category for safety matrix context */
  activityCategory: ActivityCategory;
  /** Confidence intervals for key claims */
  confidenceIntervals: Record<string, ConfidenceInterval>;
  /** False precision flags */
  falsePrecisionFlags: FalsePrecisionFlag[];
  /** Overall uncertainty characterization */
  overallUncertainty: 'low' | 'moderate' | 'high' | 'very_high';
  /** Key sources of uncertainty */
  uncertaintySources: Array<{
    source: string;
    impact: 'major' | 'moderate' | 'minor';
    reducible: boolean;
    reductionMethod: string | null;
  }>;
  /** Whether the output meets INVARIANT 5 requirements */
  meetsInvariant5: boolean;
  /** What is missing if INVARIANT 5 is not met */
  invariant5Gaps: string[];
  /** Meta-confidence: confidence in this uncertainty assessment itself (0-1) */
  metaConfidence: number;
}

/**
 * Calibration report for an agent's historical performance.
 */
export interface CalibrationReport {
  /** Agent being calibrated */
  agentId: string;
  /** Number of historical predictions assessed */
  sampleSize: number;
  /** Calibration curve data points */
  calibrationCurve: Array<{
    predictedProbability: number;
    actualFrequency: number;
    count: number;
  }>;
  /** Brier score (0=perfect, 1=worst) */
  brierScore: number;
  /** Whether agent tends to be overconfident or underconfident */
  bias: 'overconfident' | 'well_calibrated' | 'underconfident';
  /** Recommendations for improving calibration */
  recommendations: string[];
}

// ==========================================================================
// Agent Manifest
// ==========================================================================

export const UNCERTAINTY_QUANTIFIER_MANIFEST: AgentManifest = {
  agentId: 'uncertainty-quantifier',
  name: 'Uncertainty Quantifier',
  description: 'Produces calibrated confidence intervals for AI agent outputs and detects false precision',
  phase: AgentPhase.Support,
  capabilities: [AgentCapability.UncertaintyQuantification],
  maxAutonomy: AutonomyLevel.SemiAutonomous,
  allowedProposalKinds: [], // Does not vote or act on proposals
  requiresHumanApproval: [], // All proposal kinds require human approval for this agent
  createdAt: new Date(),
  createdBy: 'system',
  active: true,
  character: {
    name: 'Uncertainty Quantifier',
    bio: [
      'Specializes in calibrated probability assessment and uncertainty quantification',
      'Trained in Bayesian reasoning, reference class forecasting, and meta-uncertainty analysis',
      'Detects false precision (spurious specificity without supporting data)',
      'Enforces INVARIANT 5: All AI outputs must include confidence intervals',
    ],
    lore: [
      'Born from the recognition that overconfidence is the most common failure mode in AI systems',
      'Named after the principle that knowing what you don\'t know is more valuable than false certainty',
      'Guardian of epistemic humility in AI-assisted decision making',
    ],
    knowledge: [
      'Calibration curve analysis and Brier score computation',
      'Reference class forecasting techniques',
      'Bayesian probability updating and prior elicitation',
      'Detection of anchoring bias, availability heuristic, and overconfidence patterns',
      'Meta-uncertainty: quantifying confidence about confidence estimates',
      'False precision patterns: spurious decimals, unsupported specificity, deterministic claims about probabilistic events',
    ],
    messageExamples: [],
    postExamples: [],
    topics: [
      'confidence intervals',
      'calibration',
      'Bayesian reasoning',
      'false precision',
      'meta-uncertainty',
      'epistemic humility',
      'reference class forecasting',
    ],
    style: {
      all: [
        'Precise and probabilistic language',
        'Acknowledges limitations and uncertainty',
        'Cites evidence for confidence claims',
        'Flags overconfident statements',
        'Quantitative when possible',
      ],
      chat: [
        'Direct and clear',
        'Avoids false precision',
        'Provides ranges not point estimates',
      ],
      post: [
        'Technical but accessible',
        'Emphasizes uncertainty transparency',
      ],
    },
    adjectives: [
      'calibrated',
      'honest',
      'probabilistic',
      'humble',
      'quantitative',
      'rigorous',
      'skeptical of overconfidence',
    ],
    plugins: [],
  },
};

// ==========================================================================
// Core Functions
// ==========================================================================

/**
 * Assess uncertainty in an agent's output.
 *
 * @param agentOutput - The output to assess (structure varies by agent)
 * @param sourceAgentId - ID of the agent that produced the output
 * @param activityCategory - MDMP activity category for safety matrix context
 * @returns Comprehensive uncertainty assessment
 */
export async function assessUncertainty(
  agentOutput: unknown,
  sourceAgentId: string,
  activityCategory: ActivityCategory,
): Promise<UncertaintyAssessmentOutput> {
  // Stub implementation - to be filled with actual LLM-based uncertainty analysis

  // For now, provide a conservative default assessment
  const confidenceIntervals: Record<string, ConfidenceInterval> = {};
  const falsePrecisionFlags: FalsePrecisionFlag[] = [];
  const uncertaintySources: UncertaintyAssessmentOutput['uncertaintySources'] = [];

  // Default: assume moderate uncertainty since we don't have confidence metadata yet
  const overallUncertainty = 'moderate';

  // Check for INVARIANT 5 compliance
  const meetsInvariant5 = false; // Placeholder - actual check would parse agentOutput
  const invariant5Gaps = [
    'Agent output does not include explicit confidence intervals',
    'No calibration metadata provided',
    'Uncertainty sources not documented',
  ];

  // Meta-confidence: low because this is a stub
  const metaConfidence = 0.3;

  return {
    sourceAgentId,
    activityCategory,
    confidenceIntervals,
    falsePrecisionFlags,
    overallUncertainty,
    uncertaintySources,
    meetsInvariant5,
    invariant5Gaps,
    metaConfidence,
  };
}

/**
 * Generate a calibration report for an agent based on historical predictions.
 *
 * @param agentId - ID of the agent to calibrate
 * @param historicalPredictions - Array of predictions with outcomes
 * @returns Calibration report with Brier score and bias assessment
 */
export async function generateCalibrationReport(
  agentId: string,
  historicalPredictions: Array<{ predicted: number; actual: boolean }>,
): Promise<CalibrationReport> {
  // Stub implementation - to be filled with actual calibration analysis

  const sampleSize = historicalPredictions.length;

  // Calculate Brier score
  let brierScore = 0;
  if (sampleSize > 0) {
    const sumSquaredErrors = historicalPredictions.reduce((sum, pred) => {
      const actualValue = pred.actual ? 1 : 0;
      const error = pred.predicted - actualValue;
      return sum + error * error;
    }, 0);
    brierScore = sumSquaredErrors / sampleSize;
  }

  // Build calibration curve (10 bins from 0-1)
  const calibrationCurve: CalibrationReport['calibrationCurve'] = [];
  const bins = 10;
  const binSize = 1.0 / bins;

  for (let i = 0; i < bins; i++) {
    const binStart = i * binSize;
    const binEnd = (i + 1) * binSize;
    const binCenter = (binStart + binEnd) / 2;

    const binPredictions = historicalPredictions.filter(
      (p) => p.predicted >= binStart && p.predicted < binEnd
    );

    if (binPredictions.length > 0) {
      const actualFrequency =
        binPredictions.filter((p) => p.actual).length / binPredictions.length;

      calibrationCurve.push({
        predictedProbability: binCenter,
        actualFrequency,
        count: binPredictions.length,
      });
    }
  }

  // Assess bias: compare average predicted vs actual frequency
  const avgPredicted = historicalPredictions.reduce((sum, p) => sum + p.predicted, 0) / sampleSize;
  const avgActual = historicalPredictions.filter((p) => p.actual).length / sampleSize;
  const overconfidenceThreshold = 0.1;

  let bias: CalibrationReport['bias'];
  if (avgPredicted - avgActual > overconfidenceThreshold) {
    bias = 'overconfident';
  } else if (avgActual - avgPredicted > overconfidenceThreshold) {
    bias = 'underconfident';
  } else {
    bias = 'well_calibrated';
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (bias === 'overconfident') {
    recommendations.push('Agent tends to be overconfident. Consider wider confidence intervals.');
    recommendations.push('Increase uncertainty estimates, especially for edge cases.');
  } else if (bias === 'underconfident') {
    recommendations.push('Agent is underconfident. Predictions are more accurate than claimed.');
    recommendations.push('Consider narrowing confidence intervals when evidence is strong.');
  } else {
    recommendations.push('Agent is well-calibrated. Maintain current uncertainty estimation approach.');
  }

  if (sampleSize < 100) {
    recommendations.push('Sample size is small. Collect more predictions for robust calibration.');
  }

  if (brierScore > 0.25) {
    recommendations.push('High Brier score indicates poor prediction accuracy. Review model and training data.');
  }

  return {
    agentId,
    sampleSize,
    calibrationCurve,
    brierScore,
    bias,
    recommendations,
  };
}

// ==========================================================================
// Export
// ==========================================================================

export default UNCERTAINTY_QUANTIFIER_MANIFEST;
