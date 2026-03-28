/**
 * Ironclaw Skill Packs
 *
 * Phase 60 Plan 05: Role-specific skill pack definitions for Ironclaw.
 *
 * Blueprint Phase 4 — Each skill pack gives Ironclaw domain expertise for a
 * staff role. When a user enables a pack, the rendered SKILL.md content is
 * injected into Ironclaw's workspace so it understands domain-specific
 * terminology, workflows, and tools appropriate for that staff section.
 *
 * 7 packs cover the full staff section spectrum:
 *   S2 — intel-analysis
 *   S3 — ops-planning
 *   S4 — logistics-support
 *   S1 — personnel-admin
 *   S6 — comms-cyber
 *   S9 — civil-affairs
 *   Commander/XO — command-decision
 */

import type { StaffSection } from './ironclaw-types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillPack {
  /** Unique slug identifier (e.g., "intel-analysis"). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Short description of what this pack enables. */
  description: string;
  /** Which staff sections this pack is recommended for. */
  staffSections: StaffSection[];
  /** Natural-language phrases that should activate skills from this pack. */
  triggers: string[];
  /** Bastion tool IDs required by this pack. */
  requiredTools: string[];
  /** How much autonomous action this pack is allowed to take. */
  trustLevel: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Skill Pack Catalog
// ---------------------------------------------------------------------------

export const SKILL_PACKS: SkillPack[] = [
  {
    id: 'intel-analysis',
    name: 'Intelligence Analysis (S2)',
    description:
      'Intelligence preparation of the battlespace (IPB), threat assessment, ' +
      'collection management, and adversary course of action (ACOA) development. ' +
      'Enables Ironclaw to assist with IPB products, OSINT fusion, and named area ' +
      'of interest (NAI) management.',
    staffSections: ['S2'],
    triggers: [
      'analyze threat',
      'IPB',
      'collection plan',
      'threat assessment',
      'ACOA',
      'named area of interest',
      'NAI',
      'enemy situation',
      'OSINT',
      'intelligence estimate',
    ],
    requiredTools: [
      'bastion.knowledge.search',
      'bastion.ops.get_problem_set',
    ],
    trustLevel: 'medium',
  },
  {
    id: 'ops-planning',
    name: 'Operations Planning (S3)',
    description:
      'MDMP workflow facilitation, OPORD drafting, synchronization matrix ' +
      'management, and course of action (COA) analysis. Enables Ironclaw to ' +
      'scaffold planning products, track planning timelines, and cross-reference ' +
      'doctrinal formats.',
    staffSections: ['S3'],
    triggers: [
      'draft OPORD',
      'synchronize',
      'COA analysis',
      'MDMP',
      'operations order',
      'mission analysis',
      'task organize',
      'scheme of maneuver',
      'synchronization matrix',
      'planning timeline',
    ],
    requiredTools: [
      'bastion.ops.get_campaign_plan',
      'bastion.ops.get_coa',
    ],
    trustLevel: 'medium',
  },
  {
    id: 'logistics-support',
    name: 'Logistics Support (S4)',
    description:
      'Supply management, LOGSTAT formatting, maintenance tracking, and class ' +
      'of supply forecasting. Enables Ironclaw to generate logistics status ' +
      'reports, track CSS priorities, and flag supply shortfalls.',
    staffSections: ['S4'],
    triggers: [
      'supply status',
      'LOGSTAT',
      'maintenance report',
      'class of supply',
      'CSS',
      'sustainment',
      'fuel status',
      'ammunition status',
      'supply shortfall',
      'logistics estimate',
    ],
    requiredTools: [
      'bastion.resources.list',
      'bastion.resources.get_status',
    ],
    trustLevel: 'low',
  },
  {
    id: 'personnel-admin',
    name: 'Personnel Administration (S1)',
    description:
      'Personnel readiness reporting, strength reports, morale assessments, ' +
      'and casualty tracking. Enables Ironclaw to aggregate personnel data, ' +
      'format PERSTAT reports, and identify manning shortfalls.',
    staffSections: ['S1'],
    triggers: [
      'personnel status',
      'strength report',
      'PERSTAT',
      'casualty',
      'personnel readiness',
      'morale report',
      'manning',
      'replacement report',
      'personnel estimate',
    ],
    requiredTools: [
      'bastion.personnel.list_staff',
    ],
    trustLevel: 'low',
  },
  {
    id: 'comms-cyber',
    name: 'Communications & Cyber (S6)',
    description:
      'C4ISR architecture planning, network status monitoring, spectrum ' +
      'management, and cybersecurity posture assessment. Enables Ironclaw to ' +
      'assist with comms plans, frequency deconfliction, and network diagrams.',
    staffSections: ['S6'],
    triggers: [
      'network status',
      'comms plan',
      'spectrum',
      'C4ISR',
      'frequency',
      'cyber',
      'communications architecture',
      'signal plan',
      'network diagram',
      'comms estimate',
    ],
    requiredTools: [
      'bastion.resources.search_capabilities',
    ],
    trustLevel: 'medium',
  },
  {
    id: 'civil-affairs',
    name: 'Civil Affairs (S9)',
    description:
      'PMESII-PT analysis, civil-military operations (CMO) coordination, ' +
      'host nation support planning, and key leader engagement (KLE) tracking. ' +
      'Enables Ironclaw to synthesize civil environment assessments and support ' +
      'COIN and stability operations.',
    staffSections: ['S9'],
    triggers: [
      'civil assessment',
      'PMESII',
      'CMO',
      'host nation',
      'key leader engagement',
      'KLE',
      'civil environment',
      'stability operations',
      'COIN',
      'civil estimate',
    ],
    requiredTools: [
      'bastion.knowledge.search',
    ],
    trustLevel: 'low',
  },
  {
    id: 'command-decision',
    name: 'Command Decision Support (CDR/XO)',
    description:
      'COA comparison, decision brief preparation, commander\'s critical ' +
      'information requirements (CCIR) management, and risk matrix generation. ' +
      'Enables Ironclaw to synthesize staff inputs into commander-ready decision ' +
      'products and track decision points.',
    staffSections: ['Commander', 'XO'],
    triggers: [
      'decision brief',
      'compare COAs',
      'risk matrix',
      'CCIR',
      'commander\'s intent',
      'decision point',
      'wargame',
      'staff estimate',
      'COA comparison',
      'decision support',
    ],
    requiredTools: [
      'bastion.ops.get_coa',
      'bastion.knowledge.get_relationships',
    ],
    trustLevel: 'high',
  },
];

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

/**
 * Render a SkillPack as a SKILL.md string in Ironclaw's expected format.
 *
 * Generates YAML frontmatter (name, triggers, required_tools, trust) followed
 * by a markdown body describing the skill's purpose and usage guidance.
 */
export function renderSkillPackMd(pack: SkillPack): string {
  const triggersYaml = pack.triggers
    .map((t) => `  - "${t}"`)
    .join('\n');

  const toolsYaml = pack.requiredTools
    .map((t) => `  - ${t}`)
    .join('\n');

  const staffLabel = pack.staffSections.join(', ');

  return `---
name: ${pack.name}
skill_id: ${pack.id}
staff_sections: [${pack.staffSections.join(', ')}]
triggers:
${triggersYaml}
required_tools:
${toolsYaml}
trust: ${pack.trustLevel}
---

# ${pack.name}

**Staff Section:** ${staffLabel}
**Trust Level:** ${pack.trustLevel.charAt(0).toUpperCase() + pack.trustLevel.slice(1)}

## Purpose

${pack.description}

## Activation Triggers

This skill pack activates when the user's request contains any of the following phrases:

${pack.triggers.map((t) => `- "${t}"`).join('\n')}

## Required Tools

The following Bastion tools must be available and authorized for this skill pack to function fully:

${pack.requiredTools.map((t) => `- \`${t}\``).join('\n')}

## Usage Guidance

When this skill pack is active, apply domain-specific terminology and doctrinal
formats appropriate for ${staffLabel} staff functions. Prioritize accuracy over
brevity for planning products, and always reference the active problem set
context when generating staff estimates or status reports.
`;
}
