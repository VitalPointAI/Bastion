/**
 * Risk Calculator
 * Implements the 5x5 risk matrix per CJCSM 3105.01 and ATP 5-19
 */

import type { RiskLevel, Likelihood, Impact, RiskAssessment } from './types.js';

/**
 * Likelihood ordering for matrix indexing
 * Index 0 = lowest probability
 */
const LIKELIHOOD_ORDER: Likelihood[] = [
  'RARE',
  'UNLIKELY',
  'POSSIBLE',
  'LIKELY',
  'ALMOST_CERTAIN',
];

/**
 * Impact ordering for matrix indexing
 * Index 0 = lowest severity
 */
const IMPACT_ORDER: Impact[] = [
  'NEGLIGIBLE',
  'MARGINAL',
  'MODERATE',
  'CRITICAL',
  'CATASTROPHIC',
];

/**
 * 5x5 Risk Matrix
 * RISK_MATRIX[likelihood_index][impact_index] = risk level
 *
 *                     IMPACT
 *                 Negligible  Marginal  Moderate  Critical  Catastrophic
 * LIKELIHOOD
 * Rare              LOW         LOW       LOW       LOW       MEDIUM
 * Unlikely          LOW         LOW       LOW      MEDIUM      HIGH
 * Possible          LOW         LOW      MEDIUM     HIGH       HIGH
 * Likely            LOW        MEDIUM     HIGH      HIGH      EXTREME
 * Almost Certain    MEDIUM      HIGH      HIGH     EXTREME    EXTREME
 */
const RISK_MATRIX: RiskLevel[][] = [
  // RARE
  ['LOW', 'LOW', 'LOW', 'LOW', 'MEDIUM'],
  // UNLIKELY
  ['LOW', 'LOW', 'LOW', 'MEDIUM', 'HIGH'],
  // POSSIBLE
  ['LOW', 'LOW', 'MEDIUM', 'HIGH', 'HIGH'],
  // LIKELY
  ['LOW', 'MEDIUM', 'HIGH', 'HIGH', 'EXTREME'],
  // ALMOST_CERTAIN
  ['MEDIUM', 'HIGH', 'HIGH', 'EXTREME', 'EXTREME'],
];

/**
 * Risk level ordering for comparison
 */
const RISK_LEVEL_ORDER: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'];

/**
 * Calculate risk level from likelihood and impact using the 5x5 matrix
 * @param likelihood - Probability of occurrence
 * @param impact - Severity of consequences
 * @returns Calculated risk level
 */
export function calculateRiskLevel(likelihood: Likelihood, impact: Impact): RiskLevel {
  const likelihoodIndex = LIKELIHOOD_ORDER.indexOf(likelihood);
  const impactIndex = IMPACT_ORDER.indexOf(impact);

  if (likelihoodIndex === -1) {
    throw new Error(`Invalid likelihood: ${likelihood}`);
  }
  if (impactIndex === -1) {
    throw new Error(`Invalid impact: ${impact}`);
  }

  return RISK_MATRIX[likelihoodIndex][impactIndex];
}

/**
 * Get the decision authority required for a given risk level
 * Per military doctrine risk acceptance authority guidelines
 *
 * @param riskLevel - The risk level
 * @returns Role/position authorized to accept this risk
 */
export function getRiskDecisionAuthority(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case 'LOW':
      return 'Staff officer';
    case 'MEDIUM':
      return 'O-6/GS-15 or designated representative';
    case 'HIGH':
      return 'General/Flag Officer or SES';
    case 'EXTREME':
      return 'Commander or designated general/flag officer';
    default:
      throw new Error(`Invalid risk level: ${riskLevel}`);
  }
}

/**
 * Combine two risk levels, returning the higher of the two
 * Used to determine overall risk from risk-to-mission and risk-to-force
 *
 * @param riskToMission - Risk level for mission failure
 * @param riskToForce - Risk level for harm to forces
 * @returns The higher of the two risk levels
 */
export function combineRiskLevels(riskToMission: RiskLevel, riskToForce: RiskLevel): RiskLevel {
  const missionIndex = RISK_LEVEL_ORDER.indexOf(riskToMission);
  const forceIndex = RISK_LEVEL_ORDER.indexOf(riskToForce);

  if (missionIndex === -1) {
    throw new Error(`Invalid risk level: ${riskToMission}`);
  }
  if (forceIndex === -1) {
    throw new Error(`Invalid risk level: ${riskToForce}`);
  }

  return RISK_LEVEL_ORDER[Math.max(missionIndex, forceIndex)];
}

/**
 * Determine if an assessment should be auto-flagged for attention
 * Returns true for HIGH or EXTREME risk assessments
 *
 * @param assessment - Risk assessment to check (partial, only needs residualRisk)
 * @returns Whether the assessment should be flagged
 */
export function shouldAutoFlag(assessment: { residualRisk: RiskLevel }): boolean {
  return assessment.residualRisk === 'HIGH' || assessment.residualRisk === 'EXTREME';
}

/**
 * Compare two risk levels
 * @returns negative if a < b, positive if a > b, 0 if equal
 */
export function compareRiskLevels(a: RiskLevel, b: RiskLevel): number {
  return RISK_LEVEL_ORDER.indexOf(a) - RISK_LEVEL_ORDER.indexOf(b);
}

/**
 * Check if a risk level meets or exceeds a threshold
 */
export function riskMeetsThreshold(level: RiskLevel, threshold: RiskLevel): boolean {
  return compareRiskLevels(level, threshold) >= 0;
}

// Export constants for external use
export { LIKELIHOOD_ORDER, IMPACT_ORDER, RISK_LEVEL_ORDER };
