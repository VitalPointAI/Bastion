/**
 * Force Ratio Analysis - Correlation of Forces and Means (COFM)
 *
 * Provides quantitative force comparison accounting for combat power factors
 * beyond simple head count. Implements correlation of forces methodology
 * per FM 3-90-1 (Offense and Defense Volume 1).
 *
 * COFM goes beyond raw ratios by weighting:
 * - Combat power factors (training, technology, morale, terrain, logistics, intelligence, leadership)
 * - Force category weights (armor heavier than infantry, etc.)
 * - Doctrinal thresholds for operation types
 *
 * Used in MDMP Phase 2 (Mission Analysis) to inform COA development.
 */

// ==========================================================================
// Type Definitions
// ==========================================================================

/** Force category for ratio comparison */
export interface ForceCategory {
  /** Category name (e.g., "Infantry", "Armor", "Artillery", "Air Defense", "Aviation", "Logistics") */
  name: string;
  /** Friendly count/strength */
  friendlyStrength: number;
  /** Adversary count/strength */
  adversaryStrength: number;
  /** Unit of measurement (e.g., "battalions", "platforms", "batteries") */
  unit: string;
  /** Combat power weighting factor (default 1.0, armor typically 1.5-2.0) */
  combatPowerWeight: number;
}

/** Combat power modifiers that adjust raw ratios */
export interface CombatPowerModifiers {
  /** Training advantage (-1 to 1, positive = friendly advantage) */
  training: number;
  /** Technology advantage (-1 to 1) */
  technology: number;
  /** Morale advantage (-1 to 1) */
  morale: number;
  /** Terrain advantage (-1 to 1) */
  terrain: number;
  /** Logistics readiness (-1 to 1) */
  logistics: number;
  /** Intelligence advantage (-1 to 1) */
  intelligence: number;
  /** Leadership quality (-1 to 1) */
  leadership: number;
}

/** Doctrinal threshold for an operation type */
export interface DoctrinalThreshold {
  /** Operation type (e.g., "Attack", "Defense", "Delay", "Retrograde") */
  operationType: string;
  /** Required friendly:adversary ratio (e.g., 3.0 means 3:1) */
  requiredRatio: number;
  /** Doctrinal source */
  source: string;
}

/** Force ratio result for a single category */
export interface CategoryRatio {
  /** Category name */
  name: string;
  /** Raw ratio (friendly/adversary) */
  rawRatio: number;
  /** Weighted ratio (after combat power weight) */
  weightedRatio: number;
  /** Friendly effective strength */
  friendlyEffective: number;
  /** Adversary effective strength */
  adversaryEffective: number;
  /** Unit */
  unit: string;
}

/** Complete force ratio analysis result */
export interface ForceRatioResult {
  /** Overall weighted force ratio */
  overallRatio: number;
  /** Per-category ratios */
  categoryRatios: CategoryRatio[];
  /** Combat power modifiers applied */
  modifiers: CombatPowerModifiers;
  /** Modifier effect on overall ratio (multiplier applied to base ratio) */
  modifierEffect: number;
  /** Doctrinal threshold assessments */
  thresholdAssessments: Array<{
    threshold: DoctrinalThreshold;
    met: boolean;
    currentRatio: number;
    gap: number;
  }>;
  /** Categories where adversary has advantage */
  adversaryAdvantages: string[];
  /** Categories where friendly has advantage */
  friendlyAdvantages: string[];
  /** Overall assessment: favorable, marginal, unfavorable */
  overallAssessment: 'favorable' | 'marginal' | 'unfavorable';
  /** Recommendations for force allocation */
  recommendations: string[];
}

// ==========================================================================
// Doctrinal Thresholds
// ==========================================================================

/**
 * Standard doctrinal force ratio thresholds from FM 3-90-1.
 *
 * These represent minimum friendly:adversary ratios for operation types:
 * - Attack: 3:1 ratio required for both hasty and deliberate attack
 * - Defense: 1:1 for prepared defense, 1.5:1 for hasty defense
 * - Delay: 0.5:1 (can delay with inferior force)
 * - Exploitation/Pursuit: 4:1 and 3:1 for rapid tempo operations
 */
export const DOCTRINAL_THRESHOLDS: DoctrinalThreshold[] = [
  { operationType: 'Attack (Hasty)', requiredRatio: 3.0, source: 'FM 3-90-1' },
  { operationType: 'Attack (Deliberate)', requiredRatio: 3.0, source: 'FM 3-90-1' },
  { operationType: 'Defense (Prepared)', requiredRatio: 1.0, source: 'FM 3-90-1' },
  { operationType: 'Defense (Hasty)', requiredRatio: 1.5, source: 'FM 3-90-1' },
  { operationType: 'Delay', requiredRatio: 0.5, source: 'FM 3-90-1' },
  { operationType: 'Exploitation', requiredRatio: 4.0, source: 'FM 3-90-1' },
  { operationType: 'Pursuit', requiredRatio: 3.0, source: 'FM 3-90-1' },
];

// ==========================================================================
// Core Calculation Function
// ==========================================================================

/**
 * Calculate force ratio using correlation of forces and means methodology.
 *
 * Algorithm:
 * 1. Compute raw ratio per category (friendly/adversary)
 * 2. Apply combat power weights to get effective strength
 * 3. Compute weighted ratio per category
 * 4. Sum all weighted strengths for overall ratio
 * 5. Apply combat power modifiers as multiplier (converts -1 to 1 range to 0.5 to 1.5 multiplier)
 * 6. Assess against doctrinal thresholds
 * 7. Identify advantages/disadvantages
 * 8. Generate overall assessment and recommendations
 *
 * @param categories - Force categories with friendly/adversary strengths
 * @param modifiers - Combat power modifiers (-1 to 1 for each factor)
 * @param operationType - Optional operation type to assess against specific threshold
 * @returns Complete force ratio analysis result
 */
export function calculateForceRatio(
  categories: ForceCategory[],
  modifiers: CombatPowerModifiers,
  operationType?: string,
): ForceRatioResult {
  // Step 1: Compute category ratios with weights
  const categoryRatios: CategoryRatio[] = categories.map((cat) => {
    const friendlyEffective = cat.friendlyStrength * cat.combatPowerWeight;
    const adversaryEffective = cat.adversaryStrength * cat.combatPowerWeight;
    const rawRatio = cat.adversaryStrength === 0 ? Infinity : cat.friendlyStrength / cat.adversaryStrength;
    const weightedRatio = adversaryEffective === 0 ? Infinity : friendlyEffective / adversaryEffective;

    return {
      name: cat.name,
      rawRatio,
      weightedRatio,
      friendlyEffective,
      adversaryEffective,
      unit: cat.unit,
    };
  });

  // Step 2: Compute overall weighted ratio (sum all effective strengths)
  const totalFriendlyEffective = categoryRatios.reduce((sum, cat) => sum + cat.friendlyEffective, 0);
  const totalAdversaryEffective = categoryRatios.reduce((sum, cat) => sum + cat.adversaryEffective, 0);
  const baseRatio = totalAdversaryEffective === 0 ? Infinity : totalFriendlyEffective / totalAdversaryEffective;

  // Step 3: Apply combat power modifiers as multiplier
  // Convert each modifier (-1 to 1) to a multiplier effect
  // Sum all modifiers and scale: -7 to 7 range maps to 0.5x to 1.5x
  const modifierSum =
    modifiers.training +
    modifiers.technology +
    modifiers.morale +
    modifiers.terrain +
    modifiers.logistics +
    modifiers.intelligence +
    modifiers.leadership;

  // Scale to 0.5 - 1.5 range: 1.0 + (modifierSum / 14)
  // -7 → 0.5, 0 → 1.0, +7 → 1.5
  const modifierEffect = 1.0 + modifierSum / 14;
  const overallRatio = baseRatio * modifierEffect;

  // Step 4: Assess against doctrinal thresholds
  const thresholdAssessments = DOCTRINAL_THRESHOLDS.map((threshold) => {
    const met = overallRatio >= threshold.requiredRatio;
    const gap = threshold.requiredRatio - overallRatio;
    return {
      threshold,
      met,
      currentRatio: overallRatio,
      gap,
    };
  });

  // Step 5: Identify advantages and disadvantages
  const adversaryAdvantages = categoryRatios
    .filter((cat) => cat.weightedRatio < 1.0)
    .map((cat) => cat.name);

  const friendlyAdvantages = categoryRatios
    .filter((cat) => cat.weightedRatio > 1.5)
    .map((cat) => cat.name);

  // Step 6: Generate overall assessment
  let overallAssessment: 'favorable' | 'marginal' | 'unfavorable';
  if (overallRatio >= 3.0) {
    overallAssessment = 'favorable';
  } else if (overallRatio >= 1.5) {
    overallAssessment = 'marginal';
  } else {
    overallAssessment = 'unfavorable';
  }

  // Step 7: Generate recommendations
  const recommendations: string[] = [];

  if (adversaryAdvantages.length > 0) {
    recommendations.push(
      `Adversary has advantage in: ${adversaryAdvantages.join(', ')}. Consider reinforcing these areas.`
    );
  }

  if (overallRatio < 3.0 && operationType?.includes('Attack')) {
    recommendations.push(
      `Attack operations typically require 3:1 ratio. Current ratio ${overallRatio.toFixed(1)}:1 is below doctrinal threshold. Consider additional forces or shift to defensive posture.`
    );
  }

  if (overallRatio < 1.5 && operationType?.includes('Defense')) {
    recommendations.push(
      `Defense with ratio ${overallRatio.toFixed(1)}:1 may be challenging. Consider defensive preparation, obstacle emplacement, and reserve positioning.`
    );
  }

  if (friendlyAdvantages.length > 0) {
    recommendations.push(
      `Exploit friendly advantages in: ${friendlyAdvantages.join(', ')}. Design COAs to maximize these strengths.`
    );
  }

  if (modifierSum < 0) {
    recommendations.push(
      `Combat power modifiers are negative (${modifierSum.toFixed(1)}). Address training, morale, logistics, or intelligence gaps before commitment.`
    );
  }

  return {
    overallRatio,
    categoryRatios,
    modifiers,
    modifierEffect,
    thresholdAssessments,
    adversaryAdvantages,
    friendlyAdvantages,
    overallAssessment,
    recommendations,
  };
}

// ==========================================================================
// Helper Functions
// ==========================================================================

/**
 * Returns neutral combat power modifiers (all zeros).
 *
 * Use this as a baseline when no specific intelligence is available
 * about training, technology, morale, etc.
 */
export function defaultModifiers(): CombatPowerModifiers {
  return {
    training: 0,
    technology: 0,
    morale: 0,
    terrain: 0,
    logistics: 0,
    intelligence: 0,
    leadership: 0,
  };
}
