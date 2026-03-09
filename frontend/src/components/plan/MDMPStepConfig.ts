/**
 * MDMPStepConfig
 *
 * Phase 34 Plan 02: MDMP step definitions, role mappings, agent IDs,
 * governance gate configs, and status derivation for tactical planning.
 */

/** The 8 MDMP steps in doctrinal order (FM 6-0) */
export const MDMP_STEPS = [
  'receipt_of_mission',
  'mission_analysis',
  'coa_development',
  'coa_analysis_wargaming',
  'coa_comparison',
  'coa_approval',
  'orders_production',
  'transition',
] as const;

export type MDMPStepId = (typeof MDMP_STEPS)[number];

export interface MDMPStepConfigEntry {
  label: string;
  description: string;
  primaryRoles: string[];
  supportingRoles: string[];
  aiAgentId: string;
  governanceGate?: { gateType: string; description: string };
}

/** Configuration for all 8 MDMP steps */
export const MDMPStepConfig: Record<MDMPStepId, MDMPStepConfigEntry> = {
  receipt_of_mission: {
    label: 'Receipt of Mission',
    description: 'Commander and staff receive the mission, conduct initial assessment, and issue warning order.',
    primaryRoles: ['commander', 's3_operations'],
    supportingRoles: ['xo', 's1_personnel'],
    aiAgentId: 'staff-coordinator',
  },
  mission_analysis: {
    label: 'Mission Analysis',
    description: 'Staff analyzes higher headquarters order, identifies specified/implied tasks, and develops restated mission.',
    primaryRoles: ['s2_intelligence', 's3_operations'],
    supportingRoles: ['commander', 'xo', 'fire_support'],
    aiAgentId: 'mission-analyst',
    governanceGate: {
      gateType: 'mission_analysis_approval',
      description: 'Restated mission approval by commander',
    },
  },
  coa_development: {
    label: 'COA Development',
    description: 'Staff develops multiple courses of action that are suitable, feasible, acceptable, distinguishable, and complete.',
    primaryRoles: ['s3_operations', 'xo'],
    supportingRoles: ['s2_intelligence', 'fire_support', 'engineer'],
    aiAgentId: 'coa-developer',
  },
  coa_analysis_wargaming: {
    label: 'COA Analysis (Wargaming)',
    description: 'Staff wargames each COA against likely enemy actions to identify strengths, weaknesses, and decision points.',
    primaryRoles: ['s3_operations', 'xo'],
    supportingRoles: ['s2_intelligence', 'fire_support', 'engineer'],
    aiAgentId: 'red-team-analyst',
  },
  coa_comparison: {
    label: 'COA Comparison',
    description: 'Staff compares COAs using evaluation criteria to identify the COA with highest probability of success.',
    primaryRoles: ['s3_operations', 'xo'],
    supportingRoles: ['commander', 's2_intelligence'],
    aiAgentId: 'coa-comparator',
  },
  coa_approval: {
    label: 'COA Approval',
    description: 'Commander selects the COA to be developed into an operation order.',
    primaryRoles: ['commander'],
    supportingRoles: ['xo', 's3_operations'],
    aiAgentId: 'decision-support',
    governanceGate: {
      gateType: 'coa_approval',
      description: 'Commander selects COA',
    },
  },
  orders_production: {
    label: 'Orders Production',
    description: 'Staff converts the approved COA into an OPORD with all required annexes.',
    primaryRoles: ['s3_operations', 'xo'],
    supportingRoles: ['s1_personnel', 's4_logistics', 'fire_support'],
    aiAgentId: 'plan-developer',
    governanceGate: {
      gateType: 'opord_approval',
      description: 'OPORD approval by commander',
    },
  },
  transition: {
    label: 'Transition',
    description: 'Staff conducts rehearsals and transitions from planning to execution.',
    primaryRoles: ['commander', 's3_operations'],
    supportingRoles: ['xo', 's1_personnel', 's4_logistics'],
    aiAgentId: 'staff-coordinator',
  },
};

/** Map backend phase IDs to frontend MDMP step IDs */
export const BACKEND_PHASE_MAP: Record<string, MDMPStepId> = {
  phase_1_receipt_of_mission: 'receipt_of_mission',
  phase_2_mission_analysis: 'mission_analysis',
  phase_3_coa_development: 'coa_development',
  phase_4_coa_analysis: 'coa_analysis_wargaming',
  phase_5_coa_comparison: 'coa_comparison',
  phase_6_coa_approval: 'coa_approval',
  phase_7_orders_production: 'orders_production',
  phase_8_assessment: 'transition',
};

/**
 * Derive step statuses from the backend's currentPhase string.
 * Steps before current = 'complete', current = 'in-progress', after = 'not-started'.
 * If currentPhase not in map (e.g. 'phase_0_continuous'), all steps are 'not-started'.
 */
export function deriveStepStatuses(
  currentPhase: string,
): Record<MDMPStepId, 'not-started' | 'in-progress' | 'complete'> {
  const result = {} as Record<MDMPStepId, 'not-started' | 'in-progress' | 'complete'>;
  const currentStepId = BACKEND_PHASE_MAP[currentPhase];
  const currentIndex = currentStepId ? MDMP_STEPS.indexOf(currentStepId) : -1;

  for (let i = 0; i < MDMP_STEPS.length; i++) {
    const stepId = MDMP_STEPS[i];
    if (currentIndex < 0) {
      result[stepId] = 'not-started';
    } else if (i < currentIndex) {
      result[stepId] = 'complete';
    } else if (i === currentIndex) {
      result[stepId] = 'in-progress';
    } else {
      result[stepId] = 'not-started';
    }
  }

  return result;
}
