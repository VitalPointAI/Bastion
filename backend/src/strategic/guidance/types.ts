/**
 * Strategic Guidance Domain Types
 *
 * Phase 36 Plan 01: Types for the 3-step strategic guidance workflow
 * (Strategic Assessment, Operational Approach, Commander's Directive).
 *
 * Follows JP 5-0 doctrine and project conventions (const objects, not enums).
 */

import type { StepStatus, CommandersIntent } from '../../planning/types.js';

// Re-export for convenience
export type { StepStatus } from '../../planning/types.js';
export type { CommandersIntent } from '../../planning/types.js';

// ---------------------------------------------------------------------------
// Strategic Guidance Steps
// ---------------------------------------------------------------------------

export const SG_STEPS = [
  'strategic_assessment',
  'operational_approach',
  'commander_directive',
] as const;

export type SGStepId = (typeof SG_STEPS)[number];

// ---------------------------------------------------------------------------
// Instance
// ---------------------------------------------------------------------------

export type SGStatus = 'active' | 'finalized' | 'archived';

export interface StrategicGuidanceInstance {
  id: string; // SG-{uuid}
  problemSetId: string;
  stepStatuses: Record<SGStepId, StepStatus>;
  currentDirectiveVersion: number;
  status: SGStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Constraints, Restraints, Assumptions, Limitations (CRAL)
// ---------------------------------------------------------------------------

/** JP 5-0 doctrinal taxonomy */
export type ConstraintType = 'constraint' | 'restraint' | 'assumption' | 'limitation';

export type ConstraintApplicability = 'standing' | 'phase_bounded';

export interface ConstraintEntry {
  id: string;
  type: ConstraintType;
  description: string;
  sourceAuthority: string; // e.g. 'SECDEF'
  applicability: ConstraintApplicability;
  applicablePhases?: string[];
  inheritedFrom?: string;
  canDelete: boolean; // false if inherited
}

export interface Assumption {
  id: string;
  description: string;
  validityConditions: string[];
  isValid: boolean;
  invalidatedAt?: Date;
  invalidatedReason?: string;
}

// ---------------------------------------------------------------------------
// Force Allocation
// ---------------------------------------------------------------------------

export type ForceAllocationPriority =
  | 'main_effort'
  | 'supporting_effort'
  | 'reserve'
  | 'economy_of_force';

export interface ForceAllocation {
  id: string;
  forceId: string; // Phase 27 resource ID or temp
  forceName: string;
  forceType: string;
  isRegistered: boolean;
  lineOfEffortId: string;
  priority: ForceAllocationPriority;
  allocationPct: number; // 0-100
  notes: string;
}

// ---------------------------------------------------------------------------
// Lines of Effort
// ---------------------------------------------------------------------------

export interface LineOfEffort {
  id: string;
  name: string;
  description: string;
  linkedObjectiveIds: string[];
  allocatedForces: ForceAllocation[];
}

// ---------------------------------------------------------------------------
// Step Content Interfaces
// ---------------------------------------------------------------------------

export interface COGAnalysis {
  cog: string;
  criticalCapabilities: string[];
  criticalRequirements: string[];
  criticalVulnerabilities: string[];
}

export interface StrategicAssessmentContent {
  strategicEnvironmentSummary: string;
  centerOfGravityAnalysis: {
    friendly: COGAnalysis;
    adversary: COGAnalysis;
  };
  keyAssumptions: Assumption[];
  strategicFactors: string[];
  sourceContainerIds: string[];
}

export interface ObjectiveNode {
  id: string;
  parentId?: string;
  title: string;
  description: string;
}

export interface OperationalApproachContent {
  linesOfEffort: LineOfEffort[];
  objectivesHierarchy: ObjectiveNode[];
  forceApportionment: ForceAllocation[];
  constraints: ConstraintEntry[];
  restraints: ConstraintEntry[];
  assumptions: Assumption[];
  limitations: ConstraintEntry[];
}

export type DirectiveStatus = 'draft' | 'review' | 'finalized';

export interface DirectiveSection {
  id: string;
  title: string;
  content: string;
}

export interface CommanderDirectiveContent {
  commandersIntent: CommandersIntent;
  planningGuidance: string;
  directiveSections: DirectiveSection[];
  additionalGuidance: string;
  status: DirectiveStatus;
  finalizedAt: Date | null;
  finalizedBy: string | null;
}

// ---------------------------------------------------------------------------
// Directive Versioning
// ---------------------------------------------------------------------------

export interface DirectiveVersion {
  id: string; // SGDV-{uuid}
  instanceId: string;
  version: number;
  content: CommanderDirectiveContent;
  constraints: ConstraintEntry[];
  assumptions: Assumption[];
  forceApportionment: ForceAllocation[];
  createdBy: string;
  createdAt: Date;
  changelog: string;
}
