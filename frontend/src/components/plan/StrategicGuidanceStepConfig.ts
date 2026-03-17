/**
 * StrategicGuidanceStepConfig
 *
 * Phase 36 Plan 02: Strategic guidance step definitions, role mappings,
 * agent IDs, governance gate configs for strategic-echelon planning.
 *
 * Phase 49 Plan 01: Replaced operational_approach with strategic_alignment.
 * Operational design (CoG, LOEs, operational approach) now lives exclusively
 * in the Design tab. Strategic Guidance focuses on strategic-to-operational alignment.
 */

/** The 3 strategic guidance steps in doctrinal order: Assessment / Alignment / Directive */
export const SG_STEPS = [
  'strategic_assessment',
  'strategic_alignment',
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
      'Review strategic environment, validate key assumptions, and assess strategic factors.',
    primaryRoles: ['commander', 'strategic_analyst'],
    supportingRoles: ['j2_intelligence', 'j5_plans'],
    aiAgentId: 'strategic-analyst',
  },
  strategic_alignment: {
    label: 'Strategic Alignment',
    description:
      'Map national and political objectives to operational-level ends with AI assistance.',
    primaryRoles: ['commander', 'j5_plans', 'strategic_analyst'],
    supportingRoles: ['j2_intelligence', 'chief_of_staff'],
    aiAgentId: 'strategic-analyst',
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
