/**
 * Risk Assessment Schema
 * Zod schema for risk assessment per CJCSM 3105.01 and ATP 5-19
 *
 * Implements the standard 5x5 risk matrix:
 * - Likelihood: Rare → Almost Certain
 * - Impact: Negligible → Catastrophic
 * - Risk Level: Derived from matrix intersection
 *
 * @see https://www.jcs.mil/Portals/36/Documents/Library/Manuals/CJCSM%203105.01B.pdf
 * @see https://www.armyresilience.army.mil/ard/images/pdf/Policy/ATP%205-19%20Risk%20Management.pdf
 */

import { z } from 'zod';

/**
 * Likelihood levels for risk assessment (5-point scale)
 */
export const LikelihoodSchema = z.enum([
  'ALMOST_CERTAIN',
  'LIKELY',
  'POSSIBLE',
  'UNLIKELY',
  'RARE',
]).describe('Probability that the risk will occur');

export type Likelihood = z.infer<typeof LikelihoodSchema>;

/**
 * Impact levels for risk assessment (5-point scale)
 */
export const ImpactSchema = z.enum([
  'CATASTROPHIC',
  'CRITICAL',
  'MODERATE',
  'MARGINAL',
  'NEGLIGIBLE',
]).describe('Severity of consequences if risk occurs');

export type Impact = z.infer<typeof ImpactSchema>;

/**
 * Overall risk levels derived from 5x5 matrix
 */
export const RiskLevelSchema = z.enum([
  'EXTREME',
  'HIGH',
  'MEDIUM',
  'LOW',
]).describe('Overall risk level derived from likelihood × impact matrix');

export type RiskLevel = z.infer<typeof RiskLevelSchema>;

/**
 * Risk decision options per military doctrine
 */
export const RiskDecisionSchema = z.enum([
  'ACCEPT',
  'AVOID',
  'TRANSFER',
  'MITIGATE',
]).describe('Risk treatment decision');

export type RiskDecision = z.infer<typeof RiskDecisionSchema>;

/**
 * 5x5 Risk Matrix
 * Maps Likelihood × Impact to Risk Level
 *
 *                     IMPACT
 *                 Negligible  Marginal  Moderate  Critical  Catastrophic
 * LIKELIHOOD
 * Almost Certain    MEDIUM      HIGH      HIGH     EXTREME    EXTREME
 * Likely            LOW        MEDIUM     HIGH      HIGH      EXTREME
 * Possible          LOW         LOW      MEDIUM     HIGH       HIGH
 * Unlikely          LOW         LOW       LOW      MEDIUM      HIGH
 * Rare              LOW         LOW       LOW       LOW       MEDIUM
 */
const RISK_MATRIX: Record<Likelihood, Record<Impact, RiskLevel>> = {
  ALMOST_CERTAIN: {
    NEGLIGIBLE: 'MEDIUM',
    MARGINAL: 'HIGH',
    MODERATE: 'HIGH',
    CRITICAL: 'EXTREME',
    CATASTROPHIC: 'EXTREME',
  },
  LIKELY: {
    NEGLIGIBLE: 'LOW',
    MARGINAL: 'MEDIUM',
    MODERATE: 'HIGH',
    CRITICAL: 'HIGH',
    CATASTROPHIC: 'EXTREME',
  },
  POSSIBLE: {
    NEGLIGIBLE: 'LOW',
    MARGINAL: 'LOW',
    MODERATE: 'MEDIUM',
    CRITICAL: 'HIGH',
    CATASTROPHIC: 'HIGH',
  },
  UNLIKELY: {
    NEGLIGIBLE: 'LOW',
    MARGINAL: 'LOW',
    MODERATE: 'LOW',
    CRITICAL: 'MEDIUM',
    CATASTROPHIC: 'HIGH',
  },
  RARE: {
    NEGLIGIBLE: 'LOW',
    MARGINAL: 'LOW',
    MODERATE: 'LOW',
    CRITICAL: 'LOW',
    CATASTROPHIC: 'MEDIUM',
  },
};

/**
 * Calculate risk level from likelihood and impact using the 5x5 matrix
 * @param likelihood - Probability of occurrence
 * @param impact - Severity of consequences
 * @returns Calculated risk level
 */
export function calculateRiskLevel(likelihood: Likelihood, impact: Impact): RiskLevel {
  return RISK_MATRIX[likelihood][impact];
}

/**
 * Risk Dimension Schema
 * A single dimension of risk (e.g., risk-to-mission or risk-to-force)
 */
export const RiskDimensionSchema = z.object({
  likelihood: LikelihoodSchema.describe('Probability that the risk will occur'),
  impact: ImpactSchema.describe('Severity of consequences if risk occurs'),
  riskLevel: RiskLevelSchema.describe('Derived from 5x5 matrix (likelihood × impact)'),
  factors: z.array(z.string()).describe('Contributing factors to this risk'),
});

export type RiskDimension = z.infer<typeof RiskDimensionSchema>;

/**
 * Mitigation Schema
 * A potential mitigation measure for a risk
 */
export const MitigationSchema = z.object({
  description: z.string().describe('Description of the mitigation measure'),
  effectiveness: z.enum(['HIGH', 'MEDIUM', 'LOW'])
    .describe('Expected effectiveness of mitigation'),
  resourceCost: z.enum(['HIGH', 'MEDIUM', 'LOW'])
    .describe('Resource cost to implement mitigation'),
  accepted: z.boolean().default(false)
    .describe('Whether this mitigation has been accepted'),
});

export type Mitigation = z.infer<typeof MitigationSchema>;

/**
 * Risk Assessment Schema
 * Complete risk assessment per military doctrine
 */
export const RiskAssessmentSchema = z.object({
  id: z.string().describe('Unique identifier for this risk assessment'),
  objectiveId: z.string().describe('Strategic objective this risk is associated with'),
  riskToMission: RiskDimensionSchema
    .describe('Risk of failing to achieve the mission objective'),
  riskToForce: RiskDimensionSchema
    .describe('Risk of harm to forces, resources, or personnel'),
  mitigations: z.array(MitigationSchema).default([])
    .describe('Potential mitigation measures'),
  riskDecision: RiskDecisionSchema
    .describe('Decision on how to handle this risk'),
  riskDecisionAuthority: z.string()
    .describe('Role/person authorized to accept this risk level'),
  residualRisk: RiskLevelSchema
    .describe('Risk level remaining after mitigations applied'),
  assessedBy: z.string().describe('Who performed this assessment'),
  assessedAt: z.date().describe('When assessment was performed'),
  reviewedBy: z.string().optional().describe('Who reviewed the assessment'),
  reviewedAt: z.date().optional().describe('When review was completed'),
});

export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;
