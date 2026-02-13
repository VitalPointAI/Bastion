/**
 * Branch and Sequel Planning Capability (MDMP-3-06)
 *
 * Supports contingency COAs with decision point triggers linked to wargaming outcomes.
 * Branches address potential deviations during execution; sequels extend the current operation.
 * Decision points extracted from wargaming become triggers for branch/sequel activation.
 */

import { randomUUID } from 'crypto';

/** Decision point on the execution timeline */
export interface DecisionPoint {
  /** Unique identifier */
  id: string;
  /** Position on timeline (phase number or time offset) */
  timelinePosition: number;
  /** Phase this decision point occurs in */
  phase: number;
  /** Description of the decision point */
  description: string;
  /** Trigger conditions that activate this decision point */
  triggerConditions: Array<{
    condition: string;
    type: 'observable' | 'intelligence' | 'time_based' | 'force_ratio';
    threshold?: string;
  }>;
  /** Options available at this decision point */
  options: Array<{
    id: string;
    description: string;
    branchPlanId?: string;
  }>;
  /** Priority: critical, important, routine */
  priority: 'critical' | 'important' | 'routine';
  /** Who decides (authority level) */
  decisionAuthority: string;
  /** Linked wargaming decision point ID (if derived from wargaming) */
  wargamingSourceId?: string;
  /** Time available for decision (e.g., "30 min", "immediate") */
  timeAvailable: string;
}

/** Type of contingency plan */
export type ContingencyType = 'branch' | 'sequel';

/** Branch or sequel plan */
export interface BranchPlan {
  /** Unique identifier */
  id: string;
  /** Parent COA this branches from */
  parentCoaId: string;
  /** Type: branch (deviation) or sequel (extension) */
  type: ContingencyType;
  /** Name */
  name: string;
  /** Description of the contingency */
  description: string;
  /** Decision point that triggers this branch */
  triggeredByDecisionPointId: string;
  /** Specific trigger condition that activates this branch */
  activationCondition: string;
  /** Key tasks in this branch */
  keyTasks: string[];
  /** Resources required (delta from parent COA) */
  additionalResources: Array<{ type: string; quantity: number; description: string }>;
  /** Timeline impact: how execution timeline changes */
  timelineImpact: string;
  /** Risk assessment for this branch */
  riskAssessment: string;
  /** Whether this branch has been fully planned vs just identified */
  planningStatus: 'identified' | 'outlined' | 'fully_planned';
  /** Priority for planning effort */
  planningPriority: 'high' | 'medium' | 'low';
}

/** Complete branch/sequel plan set for a COA */
export interface BranchSequelSet {
  /** Parent COA ID */
  coaId: string;
  /** All decision points on the timeline */
  decisionPoints: DecisionPoint[];
  /** All branch plans */
  branches: BranchPlan[];
  /** All sequel plans */
  sequels: BranchPlan[];
  /** Summary of contingency coverage */
  coverageSummary: string;
  /** Identified gaps (scenarios without branches) */
  coverageGaps: string[];
}

/** Create a decision point from a wargaming outcome */
export function createDecisionPointFromWargaming(
  wargamingDecisionPoint: { description: string; trigger: string; options: string[] },
  phase: number,
  timelinePosition: number,
): DecisionPoint {
  const id = randomUUID();

  // Parse trigger string to extract type and threshold
  const triggerType = detectTriggerType(wargamingDecisionPoint.trigger);
  const threshold = extractThreshold(wargamingDecisionPoint.trigger);

  // Determine priority based on trigger type and wording
  const priority = determinePriority(wargamingDecisionPoint.description, wargamingDecisionPoint.trigger);

  // Generate options from wargaming options
  const options = wargamingDecisionPoint.options.map((optionDesc, idx) => ({
    id: `${id}-opt-${idx}`,
    description: optionDesc,
    branchPlanId: undefined, // Will be linked when branch plan created
  }));

  return {
    id,
    timelinePosition,
    phase,
    description: wargamingDecisionPoint.description,
    triggerConditions: [
      {
        condition: wargamingDecisionPoint.trigger,
        type: triggerType,
        threshold,
      },
    ],
    options,
    priority,
    decisionAuthority: determineAuthority(priority),
    wargamingSourceId: undefined, // Caller can set if they have wargaming cycle ID
    timeAvailable: determineTimeAvailable(priority, triggerType),
  };
}

/** Create a branch plan linked to a decision point */
export function createBranchPlan(
  parentCoaId: string,
  decisionPointId: string,
  name: string,
  description: string,
  activationCondition: string,
): BranchPlan {
  return {
    id: randomUUID(),
    parentCoaId,
    type: 'branch',
    name,
    description,
    triggeredByDecisionPointId: decisionPointId,
    activationCondition,
    keyTasks: [],
    additionalResources: [],
    timelineImpact: 'To be determined during branch planning',
    riskAssessment: 'Pending risk analysis',
    planningStatus: 'identified',
    planningPriority: 'medium',
  };
}

/** Create a sequel plan */
export function createSequelPlan(
  parentCoaId: string,
  decisionPointId: string,
  name: string,
  description: string,
): BranchPlan {
  return {
    id: randomUUID(),
    parentCoaId,
    type: 'sequel',
    name,
    description,
    triggeredByDecisionPointId: decisionPointId,
    activationCondition: 'Upon completion of primary operation',
    keyTasks: [],
    additionalResources: [],
    timelineImpact: 'Extends timeline beyond current operation end state',
    riskAssessment: 'Pending risk analysis',
    planningStatus: 'identified',
    planningPriority: 'medium',
  };
}

/** Compile all branches and decision points for a COA into a BranchSequelSet */
export function compileBranchSequelSet(
  coaId: string,
  decisionPoints: DecisionPoint[],
  branches: BranchPlan[],
  sequels: BranchPlan[],
): BranchSequelSet {
  // Sort decision points by timeline position
  const sortedDecisionPoints = [...decisionPoints].sort(
    (a, b) => a.timelinePosition - b.timelinePosition,
  );

  // Identify coverage gaps: critical decision points without branch plans
  const coverageGaps: string[] = [];
  for (const dp of sortedDecisionPoints) {
    if (dp.priority === 'critical') {
      const hasBranches = branches.some(
        (b) => b.triggeredByDecisionPointId === dp.id,
      );
      if (!hasBranches) {
        coverageGaps.push(
          `Critical decision point "${dp.description}" has no branch plans`,
        );
      }
    }
  }

  // Generate coverage summary
  const totalBranches = branches.length + sequels.length;
  const fullyPlannedCount = [...branches, ...sequels].filter(
    (b) => b.planningStatus === 'fully_planned',
  ).length;
  const criticalDPCount = sortedDecisionPoints.filter(
    (dp) => dp.priority === 'critical',
  ).length;
  const criticalWithBranches = sortedDecisionPoints.filter(
    (dp) =>
      dp.priority === 'critical' &&
      branches.some((b) => b.triggeredByDecisionPointId === dp.id),
  ).length;

  const coverageSummary = [
    `${totalBranches} total contingency plans (${branches.length} branches, ${sequels.length} sequels)`,
    `${fullyPlannedCount}/${totalBranches} fully planned`,
    `${criticalWithBranches}/${criticalDPCount} critical decision points have branches`,
  ].join('; ');

  return {
    coaId,
    decisionPoints: sortedDecisionPoints,
    branches,
    sequels,
    coverageSummary,
    coverageGaps,
  };
}

// Helper functions

function detectTriggerType(
  trigger: string,
): 'observable' | 'intelligence' | 'time_based' | 'force_ratio' {
  const lowerTrigger = trigger.toLowerCase();
  if (
    lowerTrigger.includes('observed') ||
    lowerTrigger.includes('detected') ||
    lowerTrigger.includes('visible')
  ) {
    return 'observable';
  }
  if (
    lowerTrigger.includes('intelligence') ||
    lowerTrigger.includes('report') ||
    lowerTrigger.includes('intercept')
  ) {
    return 'intelligence';
  }
  if (
    lowerTrigger.includes('ratio') ||
    lowerTrigger.includes('strength') ||
    lowerTrigger.includes('force')
  ) {
    return 'force_ratio';
  }
  if (
    lowerTrigger.includes('hour') ||
    lowerTrigger.includes('time') ||
    lowerTrigger.includes('after')
  ) {
    return 'time_based';
  }
  return 'observable'; // default
}

function extractThreshold(trigger: string): string | undefined {
  // Look for numeric thresholds in the trigger text
  const ratioMatch = trigger.match(/(\d+):(\d+)/);
  if (ratioMatch) return ratioMatch[0];

  const percentMatch = trigger.match(/(\d+)%/);
  if (percentMatch) return percentMatch[0];

  const numberMatch = trigger.match(/(\d+)/);
  if (numberMatch) return numberMatch[0];

  return undefined;
}

function determinePriority(
  description: string,
  trigger: string,
): 'critical' | 'important' | 'routine' {
  const combined = (description + ' ' + trigger).toLowerCase();

  if (
    combined.includes('critical') ||
    combined.includes('decisive') ||
    combined.includes('catastrophic') ||
    combined.includes('fail')
  ) {
    return 'critical';
  }

  if (
    combined.includes('significant') ||
    combined.includes('major') ||
    combined.includes('important')
  ) {
    return 'important';
  }

  return 'routine';
}

function determineAuthority(priority: 'critical' | 'important' | 'routine'): string {
  switch (priority) {
    case 'critical':
      return 'Commander';
    case 'important':
      return 'Deputy Commander or S3';
    case 'routine':
      return 'On-scene Commander';
    default:
      return 'Commander';
  }
}

function determineTimeAvailable(
  priority: 'critical' | 'important' | 'routine',
  triggerType: 'observable' | 'intelligence' | 'time_based' | 'force_ratio',
): string {
  if (priority === 'critical') {
    return triggerType === 'observable' ? 'Immediate' : '15 min';
  }
  if (priority === 'important') {
    return triggerType === 'time_based' ? '1 hour' : '30 min';
  }
  return '2 hours';
}
