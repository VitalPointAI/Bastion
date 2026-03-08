/**
 * StrategicGuidanceStepConfig
 *
 * Phase 36 Plan 02: Strategic guidance step definitions, role mappings,
 * agent IDs, governance gate configs for strategic-echelon planning.
 */

/** The 3 strategic guidance steps in doctrinal order */
export const SG_STEPS = [
  'strategic_assessment',
  'operational_approach',
  'commander_directive',
] as const;

export type SGStepId = (typeof SG_STEPS)[number];

export interface SGStepConfigEntry {
  label: string;
  description: string;
  primaryRoles: string[];
  supportingRoles: string[];
  aiAgentId: string;
  governanceGate?: { gateType: string; description: string };
}

/** Configuration for all 3 strategic guidance steps */
export const SGStepConfig: Record<SGStepId, SGStepConfigEntry> = {
  strategic_assessment: {
    label: 'Strategic Assessment',
    description:
      'Review strategic environment, conduct center of gravity analysis, validate key assumptions.',
    primaryRoles: ['commander', 'strategic_analyst'],
    supportingRoles: ['j2_intelligence', 'j5_plans'],
    aiAgentId: 'strategic-analyst',
  },
  operational_approach: {
    label: 'Operational Approach',
    description:
      'Define lines of effort, objectives hierarchy, force apportionment, and constraints.',
    primaryRoles: ['commander', 'j5_plans'],
    supportingRoles: ['j3_operations', 'j4_logistics'],
    aiAgentId: 'operational-planner',
  },
  commander_directive: {
    label: "Commander's Planning Guidance",
    description:
      "Draft commander's intent, planning guidance, and strategic directive for subordinate commands.",
    primaryRoles: ['commander'],
    supportingRoles: ['chief_of_staff', 'j5_plans'],
    aiAgentId: 'directive-reviewer',
    governanceGate: {
      gateType: 'directive_approval',
      description: 'Commander approves strategic directive for dissemination',
    },
  },
};
