/**
 * Sustainment Modeling Engine
 *
 * MDMP Step 3: COA Development (MDMP-3-07: Logistics feasibility analysis)
 * MDMP Step 5: COA Comparison (MDMP-5-03: Resource consumption comparison)
 *
 * References:
 * - ADP 4-0: Sustainment (sustainment principles, logistics operations)
 * - JP 4-0: Joint Logistics (joint sustainment planning)
 *
 * Purpose: Calculate resource consumption rates across COA execution phases,
 * identify shortfall points, assess logistics feasibility, enable COA comparison.
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Resource category types per ADP 4-0
 */
export type ResourceCategory =
  | 'ammunition'        // Class V: ammunition, explosives
  | 'fuel'             // Class III: petroleum products
  | 'food_water'       // Class I: subsistence, water
  | 'medical'          // Class VIII: medical supplies
  | 'maintenance_parts' // Class IX: repair parts
  | 'other';           // Other classes (II, IV, VI, VII, X)

/**
 * Risk level for sustainment assessment
 */
export type RiskLevel = 'green' | 'amber' | 'red';

/**
 * Resource entry with consumption and resupply rates
 */
export interface ResourceEntry {
  category: ResourceCategory;
  name: string;
  startingQuantity: number;
  unit: string;
  consumptionPerPhase: number[]; // Consumption per phase (indexed by phase)
  resupplyPerPhase: number[];    // Resupply per phase (indexed by phase)
  criticalThreshold: number;     // Below this = red
  warningThreshold: number;      // Below this = amber
}

/**
 * Single point on resource burndown chart
 */
export interface BurndownPoint {
  phase: number;
  phaseName: string;
  remaining: number;
  consumed: number;
  resupplied: number;
  riskLevel: RiskLevel;
}

/**
 * Burndown data for a single resource
 */
export interface ResourceBurndown {
  resourceName: string;
  category: ResourceCategory;
  unit: string;
  points: BurndownPoint[];
  exhaustionPhase: number | null; // Phase where resource hits zero (null if never)
  shortfallAmount: number;        // Max shortfall if exhausted
}

/**
 * Risk assessment for a single phase
 */
export interface PhaseRiskAssessment {
  phase: number;
  phaseName: string;
  overallRisk: RiskLevel;
  atRiskResources: string[];  // Names of resources at amber/red
  sustainable: boolean;       // True if all resources > critical threshold
}

/**
 * Overall feasibility assessment
 */
export type FeasibilityLevel = 'feasible' | 'marginal' | 'infeasible';

/**
 * Complete sustainment model result for a single COA
 */
export interface SustainmentModelResult {
  coaId: string;
  coaName: string;
  burndowns: ResourceBurndown[];
  phaseRisks: PhaseRiskAssessment[];
  overallFeasibility: FeasibilityLevel;
  criticalPhase: number | null;  // First phase with red risk (null if none)
  summary: string;
  recommendations: string[];
}

/**
 * Comparison of sustainment across multiple COAs
 */
export interface SustainmentComparison {
  results: SustainmentModelResult[];
  bestSustainedCoaId: string;
  worstSustainedCoaId: string;
  differentiatingResources: string[];  // Resources that differ most across COAs
  comparisonSummary: string;
}

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * Calculate resource risk level based on remaining quantity and thresholds
 */
function calculateRiskLevel(
  remaining: number,
  criticalThreshold: number,
  warningThreshold: number
): RiskLevel {
  if (remaining <= criticalThreshold) return 'red';
  if (remaining <= warningThreshold) return 'amber';
  return 'green';
}

/**
 * Calculate burndown for a single resource across all phases
 */
function calculateResourceBurndown(
  resource: ResourceEntry,
  phaseNames: string[]
): ResourceBurndown {
  const points: BurndownPoint[] = [];
  let remaining = resource.startingQuantity;
  let exhaustionPhase: number | null = null;
  let maxShortfall = 0;

  for (let i = 0; i < phaseNames.length; i++) {
    const consumed = resource.consumptionPerPhase[i] || 0;
    const resupplied = resource.resupplyPerPhase[i] || 0;

    // Update remaining quantity
    remaining = remaining - consumed + resupplied;

    // Track exhaustion
    if (remaining <= 0 && exhaustionPhase === null) {
      exhaustionPhase = i;
      maxShortfall = Math.abs(remaining);
    }

    // Calculate risk level
    const riskLevel = calculateRiskLevel(
      remaining,
      resource.criticalThreshold,
      resource.warningThreshold
    );

    points.push({
      phase: i,
      phaseName: phaseNames[i],
      remaining,
      consumed,
      resupplied,
      riskLevel
    });
  }

  return {
    resourceName: resource.name,
    category: resource.category,
    unit: resource.unit,
    points,
    exhaustionPhase,
    shortfallAmount: maxShortfall
  };
}

/**
 * Calculate phase risk assessment across all resources
 */
function calculatePhaseRisks(
  burndowns: ResourceBurndown[],
  phaseNames: string[]
): PhaseRiskAssessment[] {
  const phaseRisks: PhaseRiskAssessment[] = [];

  for (let i = 0; i < phaseNames.length; i++) {
    const atRiskResources: string[] = [];
    let hasRed = false;
    let hasAmber = false;

    // Check all resources for this phase
    for (const burndown of burndowns) {
      const point = burndown.points[i];
      if (point.riskLevel === 'red') {
        hasRed = true;
        atRiskResources.push(burndown.resourceName);
      } else if (point.riskLevel === 'amber') {
        hasAmber = true;
        atRiskResources.push(burndown.resourceName);
      }
    }

    // Determine overall risk
    const overallRisk: RiskLevel = hasRed ? 'red' : hasAmber ? 'amber' : 'green';
    const sustainable = !hasRed;

    phaseRisks.push({
      phase: i,
      phaseName: phaseNames[i],
      overallRisk,
      atRiskResources,
      sustainable
    });
  }

  return phaseRisks;
}

/**
 * Determine overall feasibility level
 */
function calculateFeasibility(phaseRisks: PhaseRiskAssessment[]): {
  level: FeasibilityLevel;
  criticalPhase: number | null;
} {
  let criticalPhase: number | null = null;
  let hasEarlyRed = false;
  let _hasLateRed = false;

  const totalPhases = phaseRisks.length;
  const earlyPhaseThreshold = Math.floor(totalPhases * 0.5); // First 50% are "early"

  for (const risk of phaseRisks) {
    if (risk.overallRisk === 'red') {
      if (criticalPhase === null) {
        criticalPhase = risk.phase;
      }
      if (risk.phase < earlyPhaseThreshold) {
        hasEarlyRed = true;
      } else {
        _hasLateRed = true;
      }
    }
  }

  let level: FeasibilityLevel;
  if (criticalPhase === null) {
    level = 'feasible';
  } else if (hasEarlyRed) {
    level = 'infeasible';
  } else {
    level = 'marginal';
  }

  return { level, criticalPhase };
}

/**
 * Generate summary and recommendations
 */
function generateSummaryAndRecommendations(
  burndowns: ResourceBurndown[],
  phaseRisks: PhaseRiskAssessment[],
  feasibility: FeasibilityLevel,
  criticalPhase: number | null
): { summary: string; recommendations: string[] } {
  const recommendations: string[] = [];

  // Generate summary
  let summary: string;
  if (feasibility === 'feasible') {
    summary = 'COA is logistically sustainable throughout all phases.';
  } else if (feasibility === 'marginal') {
    summary = `COA becomes logistically strained in later phases (starting Phase ${criticalPhase}).`;
  } else {
    summary = `COA is logistically infeasible with critical shortfalls in Phase ${criticalPhase}.`;
  }

  // Generate recommendations
  if (feasibility !== 'feasible') {
    // Identify exhausted resources
    const exhaustedResources = burndowns.filter(b => b.exhaustionPhase !== null);
    for (const resource of exhaustedResources) {
      recommendations.push(
        `Increase ${resource.resourceName} resupply in Phase ${resource.exhaustionPhase} by at least ${resource.shortfallAmount.toFixed(0)} ${resource.unit}`
      );
    }

    // Identify amber resources
    for (const phaseRisk of phaseRisks) {
      if (phaseRisk.overallRisk === 'amber' || phaseRisk.overallRisk === 'red') {
        for (const resourceName of phaseRisk.atRiskResources) {
          const burndown = burndowns.find(b => b.resourceName === resourceName);
          if (burndown) {
            const point = burndown.points[phaseRisk.phase];
            if (point.riskLevel === 'amber' && point.phase > 0) {
              recommendations.push(
                `Establish resupply for ${resourceName} before ${phaseRisk.phaseName}`
              );
            }
          }
        }
      }
    }

    // General recommendations
    if (exhaustedResources.length > 2) {
      recommendations.push('Consider reducing operational tempo to decrease consumption rates');
    }
    if (criticalPhase !== null && criticalPhase < 3) {
      recommendations.push('COA may require pre-positioning additional resources before execution');
    }
  }

  return { summary, recommendations };
}

/**
 * Calculate complete sustainment model for a single COA
 *
 * @param coaId - COA identifier
 * @param coaName - COA name
 * @param resources - Array of resource entries with consumption/resupply data
 * @param phaseNames - Names of execution phases
 * @returns Complete sustainment model result
 */
export function calculateSustainment(
  coaId: string,
  coaName: string,
  resources: ResourceEntry[],
  phaseNames: string[]
): SustainmentModelResult {
  // Calculate burndown for each resource
  const burndowns = resources.map(resource =>
    calculateResourceBurndown(resource, phaseNames)
  );

  // Calculate phase risks
  const phaseRisks = calculatePhaseRisks(burndowns, phaseNames);

  // Determine overall feasibility
  const { level: overallFeasibility, criticalPhase } = calculateFeasibility(phaseRisks);

  // Generate summary and recommendations
  const { summary, recommendations } = generateSummaryAndRecommendations(
    burndowns,
    phaseRisks,
    overallFeasibility,
    criticalPhase
  );

  return {
    coaId,
    coaName,
    burndowns,
    phaseRisks,
    overallFeasibility,
    criticalPhase,
    summary,
    recommendations
  };
}

/**
 * Compare sustainment across multiple COAs
 *
 * @param results - Array of sustainment model results
 * @returns Comparison with best/worst COAs and differentiating resources
 */
export function compareSustainment(
  results: SustainmentModelResult[]
): SustainmentComparison {
  if (results.length === 0) {
    throw new Error('Cannot compare empty results array');
  }

  // Rank COAs by feasibility and critical phase
  const ranked = [...results].sort((a, b) => {
    // Feasible > Marginal > Infeasible
    const feasibilityScore = (r: SustainmentModelResult) => {
      if (r.overallFeasibility === 'feasible') return 3;
      if (r.overallFeasibility === 'marginal') return 2;
      return 1;
    };

    const scoreA = feasibilityScore(a);
    const scoreB = feasibilityScore(b);

    if (scoreA !== scoreB) return scoreB - scoreA;

    // If same feasibility, later critical phase is better
    if (a.criticalPhase === null && b.criticalPhase === null) return 0;
    if (a.criticalPhase === null) return -1;
    if (b.criticalPhase === null) return 1;
    return b.criticalPhase - a.criticalPhase;
  });

  const bestSustainedCoaId = ranked[0].coaId;
  const worstSustainedCoaId = ranked[ranked.length - 1].coaId;

  // Find differentiating resources (resources with high variance across COAs)
  const resourceVariance: Map<string, number> = new Map();

  if (results.length > 1) {
    // Get all unique resource names
    const resourceNames = new Set<string>();
    for (const result of results) {
      for (const burndown of result.burndowns) {
        resourceNames.add(burndown.resourceName);
      }
    }

    // Calculate variance for each resource
    for (const resourceName of resourceNames) {
      const exhaustionPhases: number[] = [];
      for (const result of results) {
        const burndown = result.burndowns.find(b => b.resourceName === resourceName);
        if (burndown) {
          exhaustionPhases.push(burndown.exhaustionPhase ?? 999);
        }
      }

      // Calculate variance
      const mean = exhaustionPhases.reduce((a, b) => a + b, 0) / exhaustionPhases.length;
      const variance = exhaustionPhases.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / exhaustionPhases.length;
      resourceVariance.set(resourceName, variance);
    }
  }

  // Get top 3 differentiating resources
  const differentiatingResources = Array.from(resourceVariance.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  // Generate comparison summary
  let comparisonSummary: string;
  if (results.length === 1) {
    comparisonSummary = `Single COA analyzed: ${results[0].coaName} (${results[0].overallFeasibility})`;
  } else {
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    comparisonSummary = `Best: ${best.coaName} (${best.overallFeasibility}). Worst: ${worst.coaName} (${worst.overallFeasibility}).`;
    if (differentiatingResources.length > 0) {
      comparisonSummary += ` Key differences: ${differentiatingResources.join(', ')}.`;
    }
  }

  return {
    results,
    bestSustainedCoaId,
    worstSustainedCoaId,
    differentiatingResources,
    comparisonSummary
  };
}

/**
 * Get default resource template for common military resource categories
 *
 * @param phaseCount - Number of phases
 * @returns Array of default resource entries
 */
export function getDefaultResources(phaseCount: number): ResourceEntry[] {
  // Create default consumption/resupply arrays (all zeros)
  const defaultConsumption = new Array(phaseCount).fill(0);
  const defaultResupply = new Array(phaseCount).fill(0);

  return [
    {
      category: 'ammunition',
      name: 'Small Arms Ammunition',
      startingQuantity: 10000,
      unit: 'rounds',
      consumptionPerPhase: [...defaultConsumption],
      resupplyPerPhase: [...defaultResupply],
      criticalThreshold: 2000,
      warningThreshold: 4000
    },
    {
      category: 'fuel',
      name: 'Diesel Fuel',
      startingQuantity: 5000,
      unit: 'gallons',
      consumptionPerPhase: [...defaultConsumption],
      resupplyPerPhase: [...defaultResupply],
      criticalThreshold: 1000,
      warningThreshold: 2000
    },
    {
      category: 'food_water',
      name: 'MREs',
      startingQuantity: 500,
      unit: 'meals',
      consumptionPerPhase: [...defaultConsumption],
      resupplyPerPhase: [...defaultResupply],
      criticalThreshold: 100,
      warningThreshold: 200
    },
    {
      category: 'medical',
      name: 'Combat Lifesaver Kits',
      startingQuantity: 50,
      unit: 'kits',
      consumptionPerPhase: [...defaultConsumption],
      resupplyPerPhase: [...defaultResupply],
      criticalThreshold: 10,
      warningThreshold: 20
    },
    {
      category: 'maintenance_parts',
      name: 'Vehicle Repair Parts',
      startingQuantity: 100,
      unit: 'parts',
      consumptionPerPhase: [...defaultConsumption],
      resupplyPerPhase: [...defaultResupply],
      criticalThreshold: 20,
      warningThreshold: 40
    }
  ];
}
