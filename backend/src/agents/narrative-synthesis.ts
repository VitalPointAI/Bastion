/**
 * Operational Narrative Synthesis Agent
 *
 * Quick Task 8: Generates a draft operational narrative by synthesizing all
 * operational design data (problem framing, CoG analysis, LOEs, phases,
 * transitions, decision points) into a unified narrative text.
 *
 * Purpose: Support planners by producing a coherent narrative draft that
 * connects all design elements, which the user can adopt or use as a
 * starting point for their own narrative.
 *
 * Per the safety matrix, this is HYBRID_HUMAN_LED -- human owns the narrative,
 * AI offers draft text for adoption.
 *
 * v1: Rule-based stub with conservative confidence bounds per INVARIANT 5.
 */

import type { AgentManifest } from './types.js';
import { AgentPhase, AgentCapability, AutonomyLevel } from './types.js';
import { ProposalKind } from '../dao/types.js';
import type {
  ProblemFramingData,
  CoGAnalysis,
  CoGNode,
  LineOfEffort,
  OperationalApproach,
} from '../design/types.js';

// ==========================================================================
// Output Interfaces
// ==========================================================================

/**
 * A structured section within a narrative draft.
 */
export interface NarrativeSection {
  heading: string;
  content: string;
}

/**
 * A single narrative draft with confidence assessment.
 */
export interface NarrativeDraft {
  /** Full draft narrative text */
  narrative: string;
  /** Structured breakdown by section */
  sections: NarrativeSection[];
  /** Confidence in this draft (0-1) */
  confidence: number;
  /** Confidence interval bounds per INVARIANT 5 */
  confidenceBounds: { lower: number; upper: number };
  /** Notes on what data was used or missing */
  synthesisNotes: string[];
}

/**
 * Complete output from the narrative synthesis agent.
 */
export interface NarrativeSynthesisOutput {
  /** 1-2 alternative narrative drafts */
  drafts: NarrativeDraft[];
  /** How much design data exists to synthesize (0-1) */
  completenessScore: number;
}

// ==========================================================================
// Context Interface
// ==========================================================================

export interface NarrativeSynthesisContext {
  problemFraming: ProblemFramingData;
  cogAnalysis: CoGAnalysis;
  linesOfEffort: LineOfEffort[];
  operationalApproach: OperationalApproach;
}

// ==========================================================================
// Agent Manifest
// ==========================================================================

/**
 * Narrative Synthesis agent manifest.
 *
 * CRITICAL:
 * - maxAutonomy: NotAutonomous (HYBRID_HUMAN_LED per safety matrix)
 * - Human owns the narrative; AI offers draft text
 * - Never modifies the narrative directly, only provides drafts for adoption
 */
export const NARRATIVE_SYNTHESIS_AGENT: AgentManifest = {
  agentId: 'narrative-synthesis',
  name: 'Operational Narrative Synthesis Agent',
  description:
    'Synthesizes operational design data into a coherent operational narrative draft',
  phase: AgentPhase.Support,
  capabilities: [AgentCapability.ContextAnalysis],
  maxAutonomy: AutonomyLevel.NotAutonomous,
  allowedProposalKinds: [],
  requiresHumanApproval: Object.values(ProposalKind),
  createdAt: new Date(),
  createdBy: 'system',
  active: true,
  character: {
    name: 'Narrative Synthesis Agent',
    bio: [
      'Operational narrative synthesis specialist',
      'Expert in integrating problem framing, CoG analysis, and LOEs into coherent narrative',
      'Drafts unified operational approach descriptions',
      'Supports JP 5-0 operational design methodology',
    ],
    lore: [
      'Synthesizes all operational design elements into a single narrative',
      'Connects problem framing through CoG analysis to lines of effort',
      'Ensures phasing and decision points are reflected in the narrative',
      'Produces drafts for human review and adoption',
    ],
    knowledge: [
      'Operational narratives connect the problem statement to the desired end state through a coherent approach',
      'CoG analysis informs how friendly strengths exploit adversary vulnerabilities',
      'Lines of effort organize decisive actions across operational phases',
      'Decision points define key junctures where the commander must choose between options',
      'Transitions define conditions for moving between operational phases',
    ],
    messageExamples: [],
    postExamples: [],
    topics: [
      'operational narrative',
      'design synthesis',
      'operational approach',
      'phasing',
      'decision points',
      'lines of effort integration',
    ],
    style: {
      all: [
        'Clear, concise operational prose',
        'Integrate all design elements into a coherent story',
        'Use doctrinal terminology where appropriate',
        'Provide confidence intervals for all assessments',
      ],
      chat: ['Structured narrative with clear sections', 'Reference source design elements'],
      post: [],
    },
    adjectives: ['integrative', 'coherent', 'doctrinal', 'synthesizing'],
    plugins: ['narrative-synthesis-tools'],
    settings: {},
  },
};

// ==========================================================================
// Helper Functions
// ==========================================================================

/**
 * Recursively collect all CVs from a CoG node tree.
 */
function collectCVs(node: CoGNode | null): CoGNode[] {
  if (!node) return [];
  const cvs: CoGNode[] = [];
  if (node.type === 'critical-vulnerability') {
    cvs.push(node);
  }
  for (const child of node.children) {
    cvs.push(...collectCVs(child));
  }
  return cvs;
}

/**
 * Recursively collect all CCs from a CoG node tree.
 */
function collectCCs(node: CoGNode | null): CoGNode[] {
  if (!node) return [];
  const ccs: CoGNode[] = [];
  if (node.type === 'critical-capability') {
    ccs.push(node);
  }
  for (const child of node.children) {
    ccs.push(...collectCCs(child));
  }
  return ccs;
}

/**
 * Check whether a string has substantive content (not empty/whitespace).
 */
function hasContent(s: string | undefined | null): boolean {
  return !!s && s.trim().length > 0;
}

// ==========================================================================
// Core Function (v1 Rule-Based)
// ==========================================================================

/**
 * Synthesize operational design data into a narrative draft.
 *
 * v1: Rule-based stub that constructs narrative from available data.
 * Future: LLM-powered synthesis for more natural prose.
 *
 * @param context - All operational design data
 * @returns NarrativeSynthesisOutput with 1-2 narrative drafts
 */
export function synthesizeNarrative(
  context: NarrativeSynthesisContext
): NarrativeSynthesisOutput {
  const { problemFraming, cogAnalysis, linesOfEffort, operationalApproach } = context;
  const synthesisNotes: string[] = [];

  // Track what data is available for completeness scoring
  let sectionsWithData = 0;
  const totalSections = 5; // problem, CoG, LOEs, phases, decision points

  // ─── Build sections for primary draft (objective-focused) ─────────────

  const primarySections: NarrativeSection[] = [];

  // 1. Opening paragraph: problem statement and desired end state
  if (hasContent(problemFraming.problemStatement) || hasContent(problemFraming.desiredEndState)) {
    sectionsWithData++;
    let content = '';
    if (hasContent(problemFraming.problemStatement)) {
      content += problemFraming.problemStatement.trim();
    }
    if (hasContent(problemFraming.desiredEndState)) {
      content += content ? ' ' : '';
      content += `The desired end state is: ${problemFraming.desiredEndState.trim()}.`;
    }
    if (hasContent(problemFraming.currentState)) {
      content += ` The current situation is characterized by: ${problemFraming.currentState.trim()}.`;
    }
    if (problemFraming.assumptions?.length > 0) {
      const nonEmpty = problemFraming.assumptions.filter(hasContent);
      if (nonEmpty.length > 0) {
        content += ` Key assumptions include: ${nonEmpty.join('; ')}.`;
      }
    }
    primarySections.push({ heading: 'Situation and Objectives', content });
    synthesisNotes.push('Problem framing data used: problem statement, desired end state');
  } else {
    synthesisNotes.push('Missing: problem statement and desired end state (problem framing incomplete)');
  }

  // 2. CoG paragraph
  const friendlyRoot = cogAnalysis.friendly?.root;
  const adversaryRoot = cogAnalysis.adversary?.root;
  if (friendlyRoot || adversaryRoot) {
    sectionsWithData++;
    let content = '';
    if (friendlyRoot) {
      content += `The friendly center of gravity is "${friendlyRoot.label}"`;
      const friendlyCCs = collectCCs(friendlyRoot);
      if (friendlyCCs.length > 0) {
        content += `, with critical capabilities including ${friendlyCCs.map((c) => c.label).join(', ')}`;
      }
      content += '. ';
    }
    if (adversaryRoot) {
      content += `The adversary center of gravity is "${adversaryRoot.label}"`;
      const adversaryCVs = collectCVs(adversaryRoot);
      if (adversaryCVs.length > 0) {
        content += `. Key adversary critical vulnerabilities to exploit include: ${adversaryCVs.map((v) => v.label).join(', ')}`;
      }
      content += '. ';
    }
    const friendlyCVs = collectCVs(friendlyRoot);
    if (friendlyCVs.length > 0) {
      content += `Friendly critical vulnerabilities to protect include: ${friendlyCVs.map((v) => v.label).join(', ')}.`;
    }
    primarySections.push({ heading: 'Centers of Gravity', content: content.trim() });
    synthesisNotes.push('CoG analysis data used: friendly and adversary trees');
  } else {
    synthesisNotes.push('Missing: CoG analysis (no friendly or adversary trees defined)');
  }

  // 3. Lines of Effort paragraph
  if (linesOfEffort.length > 0) {
    sectionsWithData++;
    let content = `The operational approach is organized along ${linesOfEffort.length} line${linesOfEffort.length !== 1 ? 's' : ''} of effort. `;
    for (const loe of linesOfEffort) {
      content += `LOE "${loe.name}"`;
      if (hasContent(loe.description)) {
        content += ` ${loe.description.trim()}`;
      }
      if (loe.decisivePoints?.length > 0) {
        content += `, with ${loe.decisivePoints.length} decisive point${loe.decisivePoints.length !== 1 ? 's' : ''}`;
        const linkedDPs = loe.decisivePoints.filter((dp) => dp.cogLinks?.length > 0);
        if (linkedDPs.length > 0) {
          content += ` (${linkedDPs.length} linked to CoG vulnerabilities)`;
        }
      }
      content += '. ';
    }
    primarySections.push({ heading: 'Lines of Effort', content: content.trim() });
    synthesisNotes.push(`LOE data used: ${linesOfEffort.length} lines of effort`);
  } else {
    synthesisNotes.push('Missing: lines of effort (none defined)');
  }

  // 4. Phasing paragraph
  const phases = operationalApproach.phases ?? [];
  const transitions = operationalApproach.transitions ?? [];
  if (phases.length > 0) {
    sectionsWithData++;
    const sorted = [...phases].sort((a, b) => a.order - b.order);
    let content = `The operation is organized into ${phases.length} phase${phases.length !== 1 ? 's' : ''}: `;
    content += sorted.map((p) => {
      let desc = `Phase ${p.order + 1} "${p.name}"`;
      if (hasContent(p.description)) {
        desc += ` -- ${p.description.trim()}`;
      }
      return desc;
    }).join('; ');
    content += '. ';

    if (transitions.length > 0) {
      content += 'Phase transitions are governed by the following conditions: ';
      for (const t of transitions) {
        const fromPhase = phases.find((p) => p.id === t.fromPhaseId);
        const toPhase = phases.find((p) => p.id === t.toPhaseId);
        if (fromPhase && toPhase) {
          const condText = t.conditions.filter(hasContent).join('; ');
          content += `From "${fromPhase.name}" to "${toPhase.name}"${condText ? `: ${condText}` : ''}. `;
        }
      }
    }
    primarySections.push({ heading: 'Operational Phasing', content: content.trim() });
    synthesisNotes.push(`Phasing data used: ${phases.length} phases, ${transitions.length} transitions`);
  } else {
    synthesisNotes.push('Missing: operational phases (none defined)');
  }

  // 5. Decision points paragraph
  const decisionPoints = operationalApproach.decisionPoints ?? [];
  if (decisionPoints.length > 0) {
    sectionsWithData++;
    let content = `${decisionPoints.length} key decision point${decisionPoints.length !== 1 ? 's' : ''} ${decisionPoints.length !== 1 ? 'are' : 'is'} identified: `;
    for (const dp of decisionPoints) {
      const phase = phases.find((p) => p.id === dp.phaseId);
      content += `"${dp.label}"`;
      if (phase) {
        content += ` (during "${phase.name}")`;
      }
      if (dp.criteria?.length > 0) {
        const nonEmpty = dp.criteria.filter(hasContent);
        if (nonEmpty.length > 0) {
          content += ` with criteria: ${nonEmpty.join('; ')}`;
        }
      }
      content += '. ';
    }
    primarySections.push({ heading: 'Decision Points', content: content.trim() });
    synthesisNotes.push(`Decision point data used: ${decisionPoints.length} decision points`);
  } else {
    synthesisNotes.push('Missing: decision points (none defined)');
  }

  // Combine primary sections into full narrative
  const primaryNarrative = primarySections.map((s) => s.content).join('\n\n');

  const completenessScore = Math.round((sectionsWithData / totalSections) * 100) / 100;

  const primaryDraft: NarrativeDraft = {
    narrative: primaryNarrative,
    sections: primarySections,
    confidence: 0.5,
    confidenceBounds: { lower: 0.3, upper: 0.7 },
    synthesisNotes: [...synthesisNotes],
  };

  // ─── Build alternative draft (phasing-focused) ─────────────────────────

  const altSections: NarrativeSection[] = [];
  const altNotes: string[] = ['Alternative draft emphasizes phasing and temporal flow'];

  // Alternative: lead with phasing if available
  if (phases.length > 0) {
    const sorted = [...phases].sort((a, b) => a.order - b.order);
    let content = `This operational approach unfolds across ${phases.length} phase${phases.length !== 1 ? 's' : ''}. `;
    for (const phase of sorted) {
      content += `In Phase ${phase.order + 1} ("${phase.name}")`;
      if (hasContent(phase.description)) {
        content += `, ${phase.description.trim()}`;
      }
      // Find LOE decisive points in this phase
      const phaseActivities: string[] = [];
      for (const loe of linesOfEffort) {
        const phaseDPs = (loe.decisivePoints ?? []).filter((dp) => dp.phase === phase.name);
        if (phaseDPs.length > 0) {
          phaseActivities.push(`${loe.name} pursues ${phaseDPs.map((dp) => dp.label).join(', ')}`);
        }
      }
      if (phaseActivities.length > 0) {
        content += `: ${phaseActivities.join('; ')}`;
      }
      content += '. ';
    }
    altSections.push({ heading: 'Phased Approach', content: content.trim() });
  }

  // Alternative: operational context (brief problem + CoG)
  if (hasContent(problemFraming.problemStatement) || friendlyRoot || adversaryRoot) {
    let content = '';
    if (hasContent(problemFraming.problemStatement)) {
      content += `The operational challenge: ${problemFraming.problemStatement.trim()} `;
    }
    if (adversaryRoot) {
      content += `The approach targets the adversary center of gravity ("${adversaryRoot.label}")`;
      const adversaryCVs = collectCVs(adversaryRoot);
      if (adversaryCVs.length > 0) {
        content += ` through identified vulnerabilities: ${adversaryCVs.map((v) => v.label).join(', ')}`;
      }
      content += '. ';
    }
    if (hasContent(problemFraming.desiredEndState)) {
      content += `The desired end state: ${problemFraming.desiredEndState.trim()}.`;
    }
    altSections.push({ heading: 'Operational Context', content: content.trim() });
  }

  // Alternative: LOE integration summary
  if (linesOfEffort.length > 0) {
    let content = `${linesOfEffort.length} lines of effort converge to achieve the operational objectives: `;
    content += linesOfEffort.map((loe) => {
      let desc = `"${loe.name}"`;
      if (hasContent(loe.description)) desc += ` (${loe.description.trim()})`;
      return desc;
    }).join(', ');
    content += '.';

    if (decisionPoints.length > 0) {
      content += ` Commanders will face ${decisionPoints.length} key decision${decisionPoints.length !== 1 ? 's' : ''}: `;
      content += decisionPoints.map((dp) => `"${dp.label}"`).join(', ');
      content += '.';
    }
    altSections.push({ heading: 'Lines of Effort and Decision Points', content: content.trim() });
  }

  const altNarrative = altSections.map((s) => s.content).join('\n\n');

  const altDraft: NarrativeDraft = {
    narrative: altNarrative,
    sections: altSections,
    confidence: 0.45,
    confidenceBounds: { lower: 0.3, upper: 0.65 },
    synthesisNotes: altNotes,
  };

  // Only include alternative if it has content
  const drafts: NarrativeDraft[] = [primaryDraft];
  if (altSections.length > 0) {
    drafts.push(altDraft);
  }

  return {
    drafts,
    completenessScore,
  };
}
