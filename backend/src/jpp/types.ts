/**
 * JPP Domain Types & Ends-Ways-Means Linkage Types
 *
 * Phase 33 Plan 01: Foundation types for the Joint Planning Process (JP 5-0)
 * and Ends-Ways-Means linkage framework.
 *
 * Reuses StepStatus from planning/types.ts. Defines 7 doctrinal JPP steps
 * (excludes plan_approval which is a governance state, not a planning step).
 */

import type { StepStatus } from '../planning/types.js';

// Re-export for convenience
export type { StepStatus } from '../planning/types.js';

// ---------------------------------------------------------------------------
// JPP Steps (7 doctrinal steps per JP 5-0)
// ---------------------------------------------------------------------------

/**
 * The 7 JP 5-0 planning steps. plan_approval is excluded because it is a
 * governance gate rather than a planning activity.
 */
export const JPP_STEPS = [
  'planning_initiation',
  'mission_analysis',
  'coa_development',
  'coa_analysis',
  'coa_comparison',
  'coa_approval',
  'plan_development',
] as const;

export type JPPStepId = (typeof JPP_STEPS)[number];

// ---------------------------------------------------------------------------
// JPP Instance
// ---------------------------------------------------------------------------

export type JPPEchelon = 'strategic' | 'operational' | 'tactical';
export type JPPStatus = 'active' | 'completed' | 'archived';

export interface JPPInstance {
  id: string; // JPP-{uuid}
  problemSetId: string;
  parentJppId: string | null; // For parent->child inheritance
  echelon: JPPEchelon;
  currentStep: JPPStepId;
  stepStatuses: Record<JPPStepId, StepStatus>;
  status: JPPStatus;
  createdBy: string; // DID
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// JPP Step Product
// ---------------------------------------------------------------------------

export type StepProductStatus = 'draft' | 'reviewed' | 'approved';

export interface JPPStepProduct {
  id: string;
  jppInstanceId: string;
  step: JPPStepId;
  roleId: string; // Staff role that authored
  content: Record<string, unknown>; // JSONB - flexible per-step structured content
  aiDraftedBy: string | null; // Agent ID, null if human-authored
  reviewedBy: string | null; // DID of reviewer
  status: StepProductStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Ends-Ways-Means Linkage Types
// ---------------------------------------------------------------------------

export type EWMPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface EWMEnd {
  objectiveId: string; // References strategic_objectives
  description: string;
  priority: EWMPriority;
}

export type EWMWayType = 'loe' | 'coa';

export interface EWMWay {
  id: string;
  type: EWMWayType;
  sourceId: string; // LOE ID from Design or COA ID from JPP
  name: string;
  linkedEndIds: string[];
}

export type EWMMeanType = 'force' | 'capability' | 'resource';

export interface EWMMean {
  id: string;
  type: EWMMeanType;
  name: string;
  allocation: number; // 0-100 percentage
  linkedWayIds: string[];
}

export interface EWMLinkage {
  id: string;
  jppInstanceId: string;
  endObjectiveId: string;
  wayId: string;
  wayType: EWMWayType;
  meanId: string | null;
  meanType: EWMMeanType | null;
  allocationPct: number; // Default 0
  createdAt: Date;
}

export type EWMGapType =
  | 'unlinked_end'
  | 'unsupported_way'
  | 'unallocated_mean'
  | 'over_allocated_mean';

export interface EWMGap {
  type: EWMGapType;
  entityId: string;
  entityName: string;
  details: string;
}

// ---------------------------------------------------------------------------
// JPP Step Configuration
// ---------------------------------------------------------------------------

export interface JPPStepConfigEntry {
  label: string;
  description: string;
  primaryRoles: string[];
  supportingRoles: string[];
  aiAgentId: string;
}

/**
 * Configuration mapping each JP 5-0 step to its label, description,
 * owning staff roles, supporting roles, and assigned AI agent.
 */
export const JPPStepConfig: Record<JPPStepId, JPPStepConfigEntry> = {
  planning_initiation: {
    label: 'Planning Initiation',
    description:
      'Receipt of a new mission or order triggers the planning process. Commander issues initial planning guidance.',
    primaryRoles: ['chief_of_staff', 'j5_plans'],
    supportingRoles: ['j3_operations'],
    aiAgentId: 'staff-coordinator',
  },
  mission_analysis: {
    label: 'Mission Analysis',
    description:
      'Analyze higher HQ order, determine specified/implied/essential tasks, identify constraints, develop initial IPB products.',
    primaryRoles: ['j2_intelligence', 'j5_plans'],
    supportingRoles: ['j3_operations', 'j4_logistics', 'j6_comms'],
    aiAgentId: 'mission-analyst',
  },
  coa_development: {
    label: 'COA Development',
    description:
      'Develop multiple viable COAs that accomplish the mission. Each COA includes scheme of maneuver, task organization, and risk assessment.',
    primaryRoles: ['j5_plans', 'j3_operations'],
    supportingRoles: ['j2_intelligence', 'j4_logistics', 'fires_coordinator'],
    aiAgentId: 'coa-developer',
  },
  coa_analysis: {
    label: 'COA Analysis (Wargaming)',
    description:
      'War-game each COA against adversary capabilities. Red team tests vulnerabilities. Identify strengths, weaknesses, and decision points.',
    primaryRoles: ['j5_plans', 'red_team'],
    supportingRoles: ['j2_intelligence', 'j3_operations'],
    aiAgentId: 'red-team-analyst',
  },
  coa_comparison: {
    label: 'COA Comparison',
    description:
      'Compare COAs using weighted evaluation criteria (feasibility, acceptability, suitability, distinguishability, completeness).',
    primaryRoles: ['j5_plans'],
    supportingRoles: ['chief_of_staff', 'j3_operations'],
    aiAgentId: 'coa-comparator',
  },
  coa_approval: {
    label: 'COA Approval',
    description:
      'Commander selects a COA based on staff recommendation. Decision brief and commander guidance finalize the selection.',
    primaryRoles: ['commander'],
    supportingRoles: ['chief_of_staff', 'j5_plans'],
    aiAgentId: 'decision-support',
  },
  plan_development: {
    label: 'Plan/Order Development',
    description:
      'Develop the approved COA into a full OPLAN or OPORD with all five paragraphs and annexes.',
    primaryRoles: ['j5_plans', 'j3_operations'],
    supportingRoles: ['j4_logistics', 'j6_comms', 'j1_personnel'],
    aiAgentId: 'plan-developer',
  },
} as const;
