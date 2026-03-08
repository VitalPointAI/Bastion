/**
 * Doctrinal Document Templates
 *
 * Phase 33 Plan 10: Template structures for Campaign Plan, OPLAN, CONPLAN, and OPORD
 * document generation. Each template maps to OperationalPlan/FiveParagraphOrder/Annex
 * types and defines section ordering for doctrinal document output.
 */

import type {
  OperationalPlan,
  PlanType,
  AnnexLetter,
} from './types.js';

// ─── Document Section Types ─────────────────────────────────────────────────

export interface DocumentSection {
  id: string;
  title: string;
  level: number; // heading depth: 1=major, 2=sub, 3=detail
  content: string;
  required: boolean;
  classification?: string;
  children?: DocumentSection[];
}

export interface DocumentTemplate {
  planType: PlanType | 'CAMPAIGN_PLAN';
  name: string;
  description: string;
  sections: TemplateSectionDef[];
  renderSections(plan: OperationalPlan): DocumentSection[];
}

interface TemplateSectionDef {
  id: string;
  title: string;
  level: number;
  required: boolean;
  children?: TemplateSectionDef[];
}

// ─── Shared Helpers ─────────────────────────────────────────────────────────

function formatMission(plan: OperationalPlan): string {
  if (!plan.mission) return 'TBD';
  const { who, what, when, where, why } = plan.mission;
  return `${who || 'TBD'} ${what || 'TBD'} ${when || 'TBD'} ${where || 'TBD'} ${why || 'TBD'}`;
}

function formatAnnexes(plan: OperationalPlan, includeLetters?: AnnexLetter[]): DocumentSection[] {
  const annexes = plan.annexes || {};
  const letters = includeLetters || (Object.keys(annexes) as AnnexLetter[]);

  return letters
    .filter((letter) => annexes[letter])
    .map((letter) => ({
      id: `annex-${letter}`,
      title: `Annex ${letter} - ${annexes[letter].title}`,
      level: 2,
      content: annexes[letter].content || '',
      required: false,
    }));
}

function renderSituationContent(plan: OperationalPlan): string {
  const s = plan.situation;
  if (!s) return 'TBD';

  const parts: string[] = [];
  parts.push(`a. Area of Interest: ${s.areaOfInterest || 'TBD'}`);
  parts.push(`b. Area of Operations: ${s.areaOfOperations || 'TBD'}`);

  if (s.enemyForces) {
    parts.push('c. Enemy Forces:');
    parts.push(`   Composition: ${s.enemyForces.composition || 'TBD'}`);
    parts.push(`   Disposition: ${s.enemyForces.disposition || 'TBD'}`);
    parts.push(`   Strength: ${s.enemyForces.strength || 'TBD'}`);
    parts.push(`   Recent Activity: ${s.enemyForces.recentActivity || 'TBD'}`);
    if (s.enemyForces.capabilities?.length) {
      parts.push(`   Capabilities: ${s.enemyForces.capabilities.join(', ')}`);
    }
    if (s.enemyForces.vulnerabilities?.length) {
      parts.push(`   Vulnerabilities: ${s.enemyForces.vulnerabilities.join(', ')}`);
    }
  }

  if (s.friendlyForces) {
    parts.push('d. Friendly Forces:');
    parts.push(`   Higher HQ: ${s.friendlyForces.higherHQ || 'TBD'}`);
    if (s.friendlyForces.adjacentUnits?.length) {
      parts.push(`   Adjacent: ${s.friendlyForces.adjacentUnits.join(', ')}`);
    }
    if (s.friendlyForces.supportingUnits?.length) {
      parts.push(`   Supporting: ${s.friendlyForces.supportingUnits.join(', ')}`);
    }
  }

  if (s.civilConsiderations) {
    parts.push('e. Civil Considerations:');
    parts.push(`   Population: ${s.civilConsiderations.population || 'TBD'}`);
    parts.push(`   Infrastructure: ${s.civilConsiderations.infrastructure || 'TBD'}`);
    parts.push(`   Governance: ${s.civilConsiderations.governance || 'TBD'}`);
  }

  if (s.attachmentsDetachments?.length) {
    parts.push(`f. Attachments/Detachments: ${s.attachmentsDetachments.join(', ')}`);
  }

  return parts.join('\n');
}

function renderExecutionContent(plan: OperationalPlan): string {
  const e = plan.execution;
  if (!e) return 'TBD';

  const parts: string[] = [];

  if (e.commandersIntent) {
    parts.push("a. Commander's Intent:");
    parts.push(`   Purpose: ${e.commandersIntent.purpose || 'TBD'}`);
    if (e.commandersIntent.keyTasks?.length) {
      parts.push(`   Key Tasks: ${e.commandersIntent.keyTasks.join('; ')}`);
    }
    parts.push(`   End State: ${e.commandersIntent.endState || 'TBD'}`);
  }

  if (e.conceptOfOperations) {
    parts.push('b. Concept of Operations:');
    parts.push(`   Scheme: ${e.conceptOfOperations.scheme || 'TBD'}`);
    if (e.conceptOfOperations.phases?.length) {
      parts.push('   Phases:');
      e.conceptOfOperations.phases.forEach((phase, i) => {
        parts.push(`     Phase ${i + 1} - ${phase.name}: ${phase.purpose}`);
        if (phase.tasks?.length) {
          phase.tasks.forEach((t) => parts.push(`       - ${t}`));
        }
      });
    }
  }

  if (e.tasks?.length) {
    parts.push('c. Tasks to Subordinate Units:');
    e.tasks.forEach((t, i) => {
      parts.push(`   (${i + 1}) ${t.unitId}: ${t.task} - ${t.purpose}`);
    });
  }

  if (e.coordinatingInstructions?.length) {
    parts.push('d. Coordinating Instructions:');
    e.coordinatingInstructions.forEach((ci) => parts.push(`   - ${ci}`));
  }

  return parts.join('\n');
}

function renderSustainmentContent(plan: OperationalPlan): string {
  const s = plan.sustainment;
  if (!s) return 'TBD';

  const parts: string[] = [];

  if (s.logistics) {
    parts.push('a. Logistics:');
    parts.push(`   Supply: ${s.logistics.supplyPlan || 'IAW SOP'}`);
    parts.push(`   Transportation: ${s.logistics.transportationPlan || 'IAW SOP'}`);
    parts.push(`   Maintenance: ${s.logistics.maintenancePlan || 'IAW SOP'}`);
  }

  if (s.personnel) {
    parts.push('b. Personnel:');
    parts.push(`   Replacement: ${s.personnel.replacementPlan || 'IAW SOP'}`);
    parts.push(`   Medical Evacuation: ${s.personnel.medicalEvacuation || 'IAW SOP'}`);
  }

  if (s.publicAffairs) parts.push(`c. Public Affairs: ${s.publicAffairs}`);
  if (s.civilAffairs) parts.push(`d. Civil Affairs: ${s.civilAffairs}`);
  if (s.healthServiceSupport) parts.push(`e. Health Service Support: ${s.healthServiceSupport}`);

  return parts.join('\n');
}

function renderCommandSignalContent(plan: OperationalPlan): string {
  const cs = plan.commandSignal;
  if (!cs) return 'TBD';

  const parts: string[] = [];

  if (cs.commandPost) {
    parts.push('a. Command:');
    parts.push(`   Location: ${cs.commandPost.location || 'TBD'}`);
    parts.push(`   Alternate: ${cs.commandPost.alternateLocation || 'TBD'}`);
  }

  if (cs.succession?.length) {
    parts.push(`   Succession: ${cs.succession.join(' > ')}`);
  }

  if (cs.signal) {
    parts.push('b. Signal:');
    if (cs.signal.frequencies?.length) {
      parts.push(`   Frequencies: ${cs.signal.frequencies.join(', ')}`);
    }
    if (cs.signal.callSigns && Object.keys(cs.signal.callSigns).length) {
      parts.push(`   Call Signs: ${Object.entries(cs.signal.callSigns).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }
  }

  if (cs.codewords && Object.keys(cs.codewords).length) {
    parts.push(`c. Codewords: ${Object.entries(cs.codewords).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }

  return parts.join('\n');
}

// ─── OPLAN Template ─────────────────────────────────────────────────────────

const OPLAN_SECTIONS: TemplateSectionDef[] = [
  { id: 'cover', title: 'Cover Page', level: 1, required: true },
  { id: 'toc', title: 'Table of Contents', level: 1, required: true },
  { id: 'references', title: 'References', level: 1, required: true },
  { id: 'para1-situation', title: '1. SITUATION', level: 1, required: true },
  { id: 'para2-mission', title: '2. MISSION', level: 1, required: true },
  { id: 'para3-execution', title: '3. EXECUTION', level: 1, required: true },
  { id: 'para4-sustainment', title: '4. SUSTAINMENT', level: 1, required: true },
  { id: 'para5-command-signal', title: '5. COMMAND AND SIGNAL', level: 1, required: true },
  { id: 'annexes', title: 'ANNEXES', level: 1, required: false },
  { id: 'authentication', title: 'Authentication', level: 1, required: true },
];

export const OPLANTemplate: DocumentTemplate = {
  planType: 'OPLAN',
  name: 'Operations Plan',
  description: 'Complete operations plan without a specific execution time. Full 5-paragraph order with all annexes.',
  sections: OPLAN_SECTIONS,

  renderSections(plan: OperationalPlan): DocumentSection[] {
    return [
      {
        id: 'cover',
        title: plan.name || 'OPERATIONS PLAN',
        level: 1,
        content: [
          `Classification: ${plan.classification || 'UNCLASSIFIED'}`,
          `Plan Type: OPLAN`,
          `Plan ID: ${plan.id}`,
          plan.commanderApproval?.planApprovedAt
            ? `Approved: ${new Date(plan.commanderApproval.planApprovedAt).toISOString()}`
            : 'Status: DRAFT',
        ].join('\n'),
        required: true,
      },
      { id: 'toc', title: 'Table of Contents', level: 1, content: '', required: true },
      { id: 'references', title: 'References', level: 1, content: 'See referenced documents.', required: true },
      { id: 'para1-situation', title: '1. SITUATION', level: 1, content: renderSituationContent(plan), required: true },
      { id: 'para2-mission', title: '2. MISSION', level: 1, content: formatMission(plan), required: true },
      { id: 'para3-execution', title: '3. EXECUTION', level: 1, content: renderExecutionContent(plan), required: true },
      { id: 'para4-sustainment', title: '4. SUSTAINMENT', level: 1, content: renderSustainmentContent(plan), required: true },
      { id: 'para5-command-signal', title: '5. COMMAND AND SIGNAL', level: 1, content: renderCommandSignalContent(plan), required: true },
      ...formatAnnexes(plan),
      {
        id: 'authentication',
        title: 'Authentication',
        level: 1,
        content: plan.commanderApproval?.planApprovedBy
          ? `Approved by: ${plan.commanderApproval.planApprovedBy}`
          : 'PENDING COMMANDER APPROVAL',
        required: true,
      },
    ];
  },
};

// ─── CONPLAN Template ───────────────────────────────────────────────────────

const CONPLAN_SECTIONS: TemplateSectionDef[] = [
  { id: 'cover', title: 'Cover Page', level: 1, required: true },
  { id: 'para1-situation', title: '1. SITUATION', level: 1, required: true },
  { id: 'para2-mission', title: '2. MISSION', level: 1, required: true },
  { id: 'para3-execution-concept', title: '3. EXECUTION CONCEPT', level: 1, required: true },
  { id: 'para4-logistics-summary', title: '4. LOGISTICS SUMMARY', level: 1, required: true },
  { id: 'authentication', title: 'Authentication', level: 1, required: true },
];

export const CONPLANTemplate: DocumentTemplate = {
  planType: 'CONPLAN',
  name: 'Concept Plan',
  description: 'Abbreviated OPLAN with situation, mission, execution concept (no detailed task org), and logistics summary.',
  sections: CONPLAN_SECTIONS,

  renderSections(plan: OperationalPlan): DocumentSection[] {
    const executionSummary = plan.execution
      ? [
          `Concept of Operations: ${plan.execution.conceptOfOperations?.scheme || 'TBD'}`,
          plan.execution.conceptOfOperations?.phases?.length
            ? `Phases: ${plan.execution.conceptOfOperations.phases.map((p) => p.name).join(', ')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      : 'TBD';

    const logisticsSummary = plan.sustainment?.logistics
      ? [
          `Supply: ${plan.sustainment.logistics.supplyPlan || 'IAW SOP'}`,
          `Transportation: ${plan.sustainment.logistics.transportationPlan || 'IAW SOP'}`,
          `Maintenance: ${plan.sustainment.logistics.maintenancePlan || 'IAW SOP'}`,
        ].join('\n')
      : 'TBD';

    return [
      {
        id: 'cover',
        title: plan.name || 'CONCEPT PLAN',
        level: 1,
        content: [
          `Classification: ${plan.classification || 'UNCLASSIFIED'}`,
          `Plan Type: CONPLAN`,
          `Plan ID: ${plan.id}`,
        ].join('\n'),
        required: true,
      },
      { id: 'para1-situation', title: '1. SITUATION', level: 1, content: renderSituationContent(plan), required: true },
      { id: 'para2-mission', title: '2. MISSION', level: 1, content: formatMission(plan), required: true },
      { id: 'para3-execution-concept', title: '3. EXECUTION CONCEPT', level: 1, content: executionSummary, required: true },
      { id: 'para4-logistics-summary', title: '4. LOGISTICS SUMMARY', level: 1, content: logisticsSummary, required: true },
      {
        id: 'authentication',
        title: 'Authentication',
        level: 1,
        content: plan.commanderApproval?.planApprovedBy
          ? `Approved by: ${plan.commanderApproval.planApprovedBy}`
          : 'PENDING COMMANDER APPROVAL',
        required: true,
      },
    ];
  },
};

// ─── OPORD Template ─────────────────────────────────────────────────────────

const OPORD_SECTIONS: TemplateSectionDef[] = [
  ...OPLAN_SECTIONS.map((s) => ({ ...s })),
];
// OPORD adds effective time fields
OPORD_SECTIONS.splice(2, 0, {
  id: 'effective-time',
  title: 'Effective Time',
  level: 1,
  required: true,
});

export const OPORDTemplate: DocumentTemplate = {
  planType: 'OPORD',
  name: 'Operations Order',
  description: 'Directive order for execution. Same structure as OPLAN but marked as directive with DTG and effective time.',
  sections: OPORD_SECTIONS,

  renderSections(plan: OperationalPlan): DocumentSection[] {
    // Reuse OPLAN sections but add directive markers
    const oplanSections = OPLANTemplate.renderSections(plan);

    // Update cover page to reflect OPORD
    const cover = oplanSections.find((s) => s.id === 'cover');
    if (cover) {
      cover.content = cover.content
        .replace('Plan Type: OPLAN', 'Plan Type: OPORD (DIRECTIVE)')
        .replace('OPERATIONS PLAN', 'OPERATIONS ORDER');
    }

    // Insert effective time section after references
    const refIdx = oplanSections.findIndex((s) => s.id === 'references');
    oplanSections.splice(refIdx + 1, 0, {
      id: 'effective-time',
      title: 'Effective Time',
      level: 1,
      content: `DTG: ${new Date().toISOString()}\nThis order is effective upon receipt unless otherwise specified.`,
      required: true,
    });

    return oplanSections;
  },
};

// ─── Campaign Plan Template ─────────────────────────────────────────────────

const CAMPAIGN_PLAN_SECTIONS: TemplateSectionDef[] = [
  { id: 'cover', title: 'Cover Page', level: 1, required: true },
  { id: 'toc', title: 'Table of Contents', level: 1, required: true },
  { id: 'strategic-context', title: 'Strategic Context', level: 1, required: true },
  { id: 'campaign-objectives', title: 'Campaign Objectives', level: 1, required: true },
  { id: 'phasing-construct', title: 'Phasing Construct', level: 1, required: true },
  { id: 'loe-mapping', title: 'Lines of Effort to Objective Mapping', level: 1, required: true },
  { id: 'para1-situation', title: '1. SITUATION', level: 1, required: true },
  { id: 'para2-mission', title: '2. MISSION', level: 1, required: true },
  { id: 'para3-execution', title: '3. EXECUTION', level: 1, required: true },
  { id: 'para4-sustainment', title: '4. SUSTAINMENT', level: 1, required: true },
  { id: 'para5-command-signal', title: '5. COMMAND AND SIGNAL', level: 1, required: true },
  { id: 'annexes', title: 'ANNEXES', level: 1, required: false },
  { id: 'authentication', title: 'Authentication', level: 1, required: true },
];

export const CampaignPlanTemplate: DocumentTemplate = {
  planType: 'CAMPAIGN_PLAN',
  name: 'Campaign Plan',
  description: 'Comprehensive campaign plan with strategic context, campaign objectives, phasing construct, LOE-to-objective mapping, and full 5-paragraph order with annexes.',
  sections: CAMPAIGN_PLAN_SECTIONS,

  renderSections(plan: OperationalPlan): DocumentSection[] {
    // Extract strategic context from objectives
    const objectivesSummary = plan.objectiveIds?.length
      ? `Strategic objectives: ${plan.objectiveIds.join(', ')}`
      : 'No strategic objectives linked.';

    // Extract phasing from execution
    const phasingContent = plan.execution?.conceptOfOperations?.phases?.length
      ? plan.execution.conceptOfOperations.phases
          .map((p, i) => `Phase ${i + 1} - ${p.name}: ${p.purpose}`)
          .join('\n')
      : 'Phasing construct TBD.';

    // LOE mapping from execution tasks
    const loeContent = plan.execution?.tasks?.length
      ? plan.execution.tasks
          .map((t) => `${t.unitId}: ${t.task} (Purpose: ${t.purpose})`)
          .join('\n')
      : 'Lines of effort mapping TBD.';

    return [
      {
        id: 'cover',
        title: plan.name || 'CAMPAIGN PLAN',
        level: 1,
        content: [
          `Classification: ${plan.classification || 'UNCLASSIFIED'}`,
          `Plan Type: Campaign Plan`,
          `Plan ID: ${plan.id}`,
          plan.commanderApproval?.planApprovedAt
            ? `Approved: ${new Date(plan.commanderApproval.planApprovedAt).toISOString()}`
            : 'Status: DRAFT',
        ].join('\n'),
        required: true,
      },
      { id: 'toc', title: 'Table of Contents', level: 1, content: '', required: true },
      {
        id: 'strategic-context',
        title: 'Strategic Context',
        level: 1,
        content: objectivesSummary,
        required: true,
      },
      {
        id: 'campaign-objectives',
        title: 'Campaign Objectives',
        level: 1,
        content: objectivesSummary,
        required: true,
      },
      {
        id: 'phasing-construct',
        title: 'Phasing Construct',
        level: 1,
        content: phasingContent,
        required: true,
      },
      {
        id: 'loe-mapping',
        title: 'Lines of Effort to Objective Mapping',
        level: 1,
        content: loeContent,
        required: true,
      },
      { id: 'para1-situation', title: '1. SITUATION', level: 1, content: renderSituationContent(plan), required: true },
      { id: 'para2-mission', title: '2. MISSION', level: 1, content: formatMission(plan), required: true },
      { id: 'para3-execution', title: '3. EXECUTION', level: 1, content: renderExecutionContent(plan), required: true },
      { id: 'para4-sustainment', title: '4. SUSTAINMENT', level: 1, content: renderSustainmentContent(plan), required: true },
      { id: 'para5-command-signal', title: '5. COMMAND AND SIGNAL', level: 1, content: renderCommandSignalContent(plan), required: true },
      ...formatAnnexes(plan),
      {
        id: 'authentication',
        title: 'Authentication',
        level: 1,
        content: plan.commanderApproval?.planApprovedBy
          ? `Approved by: ${plan.commanderApproval.planApprovedBy}`
          : 'PENDING COMMANDER APPROVAL',
        required: true,
      },
    ];
  },
};

// ─── Template Registry ──────────────────────────────────────────────────────

const templateRegistry: Record<string, DocumentTemplate> = {
  OPLAN: OPLANTemplate,
  CONPLAN: CONPLANTemplate,
  OPORD: OPORDTemplate,
  CAMPAIGN_PLAN: CampaignPlanTemplate,
  // FRAGORD uses OPORD template with modifications
  FRAGORD: OPORDTemplate,
};

/**
 * Get the document template for a given plan type.
 * Defaults to OPLAN if type not recognized.
 */
export function getTemplate(planType: string): DocumentTemplate {
  return templateRegistry[planType] || OPLANTemplate;
}
