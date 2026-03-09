/**
 * STRATEGIC_DIRECTIVE Document Template
 *
 * Phase 36 Plan 04: Template for generating strategic directive documents
 * from finalized directive versions. Maps directive content to doctrinal
 * section structure for PDF/DOCX export.
 */

import type { DocumentSection, DocumentTemplate } from '../../planning/document-templates.js';
import type { OperationalPlan } from '../../planning/types.js';
import type {
  DirectiveVersion,
  CommanderDirectiveContent,
  ConstraintEntry,
  Assumption,
  ForceAllocation,
  LineOfEffort,
} from './types.js';

// ---------------------------------------------------------------------------
// Section Definitions
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: 'cover-page', title: 'Cover Page', level: 1, required: true },
  { id: 'references', title: 'References', level: 1, required: true },
  { id: 'strategic-situation', title: 'Strategic Situation Summary', level: 1, required: true },
  { id: 'commanders-intent', title: "Commander's Intent", level: 1, required: true },
  { id: 'strategic-objectives', title: 'Strategic Objectives', level: 1, required: true },
  {
    id: 'operational-approach',
    title: 'Operational Approach',
    level: 1,
    required: true,
    children: [
      { id: 'lines-of-effort', title: 'Lines of Effort', level: 2, required: true },
      { id: 'force-apportionment', title: 'Force Apportionment', level: 2, required: true },
    ],
  },
  { id: 'constraints-restraints', title: 'Constraints and Restraints', level: 1, required: true },
  { id: 'key-assumptions', title: 'Key Assumptions', level: 1, required: true },
  { id: 'planning-guidance', title: 'Planning Guidance', level: 1, required: true },
  { id: 'additional-guidance', title: 'Additional Commander Guidance', level: 1, required: false },
  { id: 'authentication', title: 'Authentication', level: 1, required: true },
];

// ---------------------------------------------------------------------------
// Render Helpers
// ---------------------------------------------------------------------------

function renderIntent(intent: CommanderDirectiveContent['commandersIntent']): string {
  if (!intent) return 'TBD';
  const parts: string[] = [];
  if (intent.purpose) parts.push(`Purpose: ${intent.purpose}`);
  if (intent.keyTasks?.length) {
    parts.push('Key Tasks:');
    intent.keyTasks.forEach((task: string, i: number) => {
      parts.push(`  ${i + 1}. ${task}`);
    });
  }
  if (intent.endState) parts.push(`End State: ${intent.endState}`);
  if (intent.constraints?.length) {
    parts.push('Constraints:');
    intent.constraints.forEach((c: string) => parts.push(`  - ${c}`));
  }
  if (intent.criticalFactors?.length) {
    parts.push('Critical Factors:');
    intent.criticalFactors.forEach((f: string) => parts.push(`  - ${f}`));
  }
  return parts.join('\n') || 'TBD';
}

function renderConstraints(entries: ConstraintEntry[]): string {
  if (!entries?.length) return 'None specified.';
  const grouped = {
    constraint: entries.filter((e) => e.type === 'constraint'),
    restraint: entries.filter((e) => e.type === 'restraint'),
    limitation: entries.filter((e) => e.type === 'limitation'),
  };
  const parts: string[] = [];
  if (grouped.constraint.length) {
    parts.push('Constraints (Must Do):');
    grouped.constraint.forEach((c) => parts.push(`  - ${c.description} [${c.sourceAuthority}]`));
  }
  if (grouped.restraint.length) {
    parts.push('Restraints (Must Not Do):');
    grouped.restraint.forEach((r) => parts.push(`  - ${r.description} [${r.sourceAuthority}]`));
  }
  if (grouped.limitation.length) {
    parts.push('Limitations:');
    grouped.limitation.forEach((l) => parts.push(`  - ${l.description} [${l.sourceAuthority}]`));
  }
  return parts.join('\n') || 'None specified.';
}

function renderAssumptions(assumptions: Assumption[]): string {
  if (!assumptions?.length) return 'None specified.';
  return assumptions
    .map((a, i) => {
      const status = a.isValid ? 'VALID' : 'INVALIDATED';
      const conditions = a.validityConditions?.length
        ? `\n    Conditions: ${a.validityConditions.join('; ')}`
        : '';
      return `  ${i + 1}. [${status}] ${a.description}${conditions}`;
    })
    .join('\n');
}

function renderForces(forces: ForceAllocation[]): string {
  if (!forces?.length) return 'No forces allocated.';
  const priorityLabel: Record<string, string> = {
    main_effort: 'MAIN EFFORT',
    supporting_effort: 'Supporting',
    reserve: 'Reserve',
    economy_of_force: 'Economy of Force',
  };
  return forces
    .map((f) => {
      const priority = priorityLabel[f.priority] || f.priority;
      return `  - ${f.forceName} (${f.forceType}) — ${priority}, ${f.allocationPct}% allocated${f.notes ? ` — ${f.notes}` : ''}`;
    })
    .join('\n');
}

function renderDirectiveSections(sections: CommanderDirectiveContent['directiveSections']): string {
  if (!sections?.length) return 'TBD';
  return sections
    .map((s) => `${s.title}:\n${s.content || 'TBD'}`)
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

/**
 * Render strategic directive document sections from a DirectiveVersion.
 * Since the DocumentTemplate interface expects OperationalPlan, we use
 * a separate function for directive-specific rendering.
 */
export function renderDirectiveSections_fromVersion(
  version: DirectiveVersion,
  linesOfEffort?: LineOfEffort[],
): DocumentSection[] {
  const content = version.content;
  const sections: DocumentSection[] = [
    {
      id: 'cover-page',
      title: 'Cover Page',
      level: 1,
      content: `STRATEGIC DIRECTIVE v${version.version}\nDate: ${new Date(version.createdAt).toISOString().split('T')[0]}`,
      required: true,
    },
    {
      id: 'references',
      title: 'References',
      level: 1,
      content: 'See referenced documents and strategic guidance.',
      required: true,
    },
    {
      id: 'strategic-situation',
      title: 'Strategic Situation Summary',
      level: 1,
      content: renderDirectiveSections(content.directiveSections?.filter((s) => s.title.toLowerCase().includes('situation') || s.title.toLowerCase().includes('strategic obj'))) || 'See Strategic Assessment step.',
      required: true,
    },
    {
      id: 'commanders-intent',
      title: "Commander's Intent",
      level: 1,
      content: renderIntent(content.commandersIntent),
      required: true,
    },
    {
      id: 'strategic-objectives',
      title: 'Strategic Objectives',
      level: 1,
      content: renderDirectiveSections(content.directiveSections?.filter((s) => s.title.toLowerCase().includes('objective'))) || 'See Operational Approach step.',
      required: true,
    },
    {
      id: 'operational-approach',
      title: 'Operational Approach',
      level: 1,
      content: '',
      required: true,
      children: [
        {
          id: 'lines-of-effort',
          title: 'Lines of Effort',
          level: 2,
          content: linesOfEffort?.length
            ? linesOfEffort.map((loe, i) => `${i + 1}. ${loe.name}: ${loe.description}`).join('\n')
            : 'See Operational Approach step.',
          required: true,
        },
        {
          id: 'force-apportionment',
          title: 'Force Apportionment',
          level: 2,
          content: renderForces(version.forceApportionment),
          required: true,
        },
      ],
    },
    {
      id: 'constraints-restraints',
      title: 'Constraints and Restraints',
      level: 1,
      content: renderConstraints(version.constraints),
      required: true,
    },
    {
      id: 'key-assumptions',
      title: 'Key Assumptions',
      level: 1,
      content: renderAssumptions(version.assumptions),
      required: true,
    },
    {
      id: 'planning-guidance',
      title: 'Planning Guidance',
      level: 1,
      content: content.planningGuidance || 'TBD',
      required: true,
    },
  ];

  if (content.additionalGuidance) {
    sections.push({
      id: 'additional-guidance',
      title: 'Additional Commander Guidance',
      level: 1,
      content: content.additionalGuidance,
      required: false,
    });
  }

  sections.push({
    id: 'authentication',
    title: 'Authentication',
    level: 1,
    content: content.finalizedBy
      ? `Approved by: ${content.finalizedBy}\nDate: ${content.finalizedAt ? new Date(content.finalizedAt).toISOString().split('T')[0] : 'TBD'}`
      : 'Pending authentication.',
    required: true,
  });

  return sections;
}

/**
 * Strategic Directive document template registered in the template registry.
 * Uses OperationalPlan as input type for compatibility, but strategic directives
 * should use renderDirectiveSections_fromVersion directly for best results.
 */
export const StrategicDirectiveTemplate: DocumentTemplate = {
  planType: 'STRATEGIC_DIRECTIVE' as 'CAMPAIGN_PLAN',
  name: 'Strategic Directive',
  description: 'Strategic-level planning directive with commander\'s intent, operational approach, force apportionment, and constraints.',
  sections: SECTIONS,
  renderSections(_plan: OperationalPlan): DocumentSection[] {
    // For strategic directives, use renderDirectiveSections_fromVersion directly
    // This fallback returns the template structure with placeholder content
    return SECTIONS.map((s) => ({
      id: s.id,
      title: s.title,
      level: s.level,
      content: 'Use renderDirectiveSections_fromVersion for populated content.',
      required: s.required,
      children: s.children?.map((c) => ({
        id: c.id,
        title: c.title,
        level: c.level,
        content: '',
        required: c.required,
      })),
    }));
  },
};
