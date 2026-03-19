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
import { createLLMForAgent } from './langgraph/llm-factory.js';

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
function _collectCCs(node: CoGNode | null): CoGNode[] {
  if (!node) return [];
  const ccs: CoGNode[] = [];
  if (node.type === 'critical-capability') {
    ccs.push(node);
  }
  for (const child of node.children) {
    ccs.push(..._collectCCs(child));
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
// LLM Prompts
// ==========================================================================

const NARRATIVE_SYSTEM_PROMPT = `You are the Operational Narrative Synthesis Agent — a specialist in synthesizing operational design elements into coherent narrative drafts.

Your expertise:
${NARRATIVE_SYNTHESIS_AGENT.character!.bio.map((b) => `- ${b}`).join('\n')}

Your knowledge base:
${NARRATIVE_SYNTHESIS_AGENT.character!.knowledge.map((k) => `- ${k}`).join('\n')}

Style guidelines:
${NARRATIVE_SYNTHESIS_AGENT.character!.style.all.map((s) => `- ${s}`).join('\n')}

CRITICAL: You are HYBRID_HUMAN_LED. You draft narrative text — the human owns and adopts the final narrative.`;

function buildNarrativeUserPrompt(context: NarrativeSynthesisContext): string {
  const { problemFraming, cogAnalysis, linesOfEffort, operationalApproach } = context;

  // Serialize problem framing
  const pfText = [
    `Problem Statement: ${problemFraming.problemStatement || '(not provided)'}`,
    `Current State: ${problemFraming.currentState || '(not provided)'}`,
    `Desired End State: ${problemFraming.desiredEndState || '(not provided)'}`,
    `Assumptions: ${problemFraming.assumptions?.filter(hasContent).join('; ') || '(none)'}`,
  ].join('\n');

  // Serialize CoG trees
  function serializeTree(node: CoGNode | null, label: string): string {
    if (!node) return `${label}: (empty)`;
    const lines: string[] = [];
    function walk(n: CoGNode, depth: number) {
      lines.push(`${'  '.repeat(depth)}- [${n.type}] "${n.label}"`);
      for (const child of n.children) walk(child, depth + 1);
    }
    walk(node, 0);
    return `${label}:\n${lines.join('\n')}`;
  }
  const cogText = `${serializeTree(cogAnalysis.friendly?.root, 'Friendly CoG')}\n\n${serializeTree(cogAnalysis.adversary?.root, 'Adversary CoG')}`;

  // Serialize LOEs
  const loeText = linesOfEffort.length === 0
    ? '(no LOEs defined)'
    : linesOfEffort.map((loe) => {
        const dps = loe.decisivePoints?.map((dp) => `  - DP: "${dp.label}" (phase: ${dp.phase || 'unassigned'})`).join('\n') || '  (no decisive points)';
        return `LOE: "${loe.name}"${loe.description ? ` — ${loe.description}` : ''}\n${dps}`;
      }).join('\n\n');

  // Serialize phases
  const phases = operationalApproach.phases ?? [];
  const transitions = operationalApproach.transitions ?? [];
  const decisionPoints = operationalApproach.decisionPoints ?? [];
  const phaseText = phases.length === 0
    ? '(no phases defined)'
    : [...phases].sort((a, b) => a.order - b.order)
        .map((p) => `Phase ${p.order + 1}: "${p.name}"${p.description ? ` — ${p.description}` : ''}`)
        .join('\n');
  const transitionText = transitions.length === 0
    ? '(no transitions defined)'
    : transitions.map((t) => {
        const from = phases.find((p) => p.id === t.fromPhaseId)?.name || t.fromPhaseId;
        const to = phases.find((p) => p.id === t.toPhaseId)?.name || t.toPhaseId;
        return `"${from}" → "${to}": ${t.conditions.filter(hasContent).join('; ') || '(no conditions)'}`;
      }).join('\n');
  const dpText = decisionPoints.length === 0
    ? '(no decision points defined)'
    : decisionPoints.map((dp) => {
        const phase = phases.find((p) => p.id === dp.phaseId)?.name;
        return `"${dp.label}"${phase ? ` (${phase})` : ''}${dp.criteria?.length ? `: ${dp.criteria.filter(hasContent).join('; ')}` : ''}`;
      }).join('\n');

  return `Synthesize all operational design data into a coherent operational narrative.

## Problem Framing
${pfText}

## Center of Gravity Analysis
${cogText}

## Lines of Effort
${loeText}

## Operational Phases
${phaseText}

## Phase Transitions
${transitionText}

## Decision Points
${dpText}

## Instructions
Generate 2 narrative drafts:
1. Primary draft (objective-focused): Lead with the problem and end state, then CoG, LOEs, phasing, decision points
2. Alternative draft (phasing-focused): Lead with temporal flow, integrate LOE activities per phase

Each draft should have:
- "narrative": full text (clear operational prose, 3-8 paragraphs)
- "sections": array of { "heading": "...", "content": "..." }
- "confidence": 0-1
- "confidenceBounds": { "lower", "upper" }
- "synthesisNotes": what data was used or missing

Respond ONLY with a JSON object:
{
  "drafts": [ { "narrative": "...", "sections": [...], "confidence": 0.7, "confidenceBounds": {...}, "synthesisNotes": [...] } ],
  "completenessScore": 0.6
}`;
}

function parseJSONResponse<T>(text: string): T | null {
  let cleaned = text.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    console.error('[narrative-synthesis] Failed to parse LLM JSON response:', cleaned.substring(0, 200));
    return null;
  }
}

// ==========================================================================
// Rule-Based Fallback
// ==========================================================================

function synthesizeNarrativeFallback(
  context: NarrativeSynthesisContext
): NarrativeSynthesisOutput {
  const { problemFraming, cogAnalysis, linesOfEffort, operationalApproach } = context;
  const synthesisNotes: string[] = [];
  let sectionsWithData = 0;
  const totalSections = 5;
  const primarySections: NarrativeSection[] = [];

  if (hasContent(problemFraming.problemStatement) || hasContent(problemFraming.desiredEndState)) {
    sectionsWithData++;
    let content = '';
    if (hasContent(problemFraming.problemStatement)) content += problemFraming.problemStatement!.trim();
    if (hasContent(problemFraming.desiredEndState)) {
      content += content ? ' ' : '';
      content += `The desired end state is: ${problemFraming.desiredEndState!.trim()}.`;
    }
    primarySections.push({ heading: 'Situation and Objectives', content });
    synthesisNotes.push('Problem framing data used');
  } else {
    synthesisNotes.push('Missing: problem framing');
  }

  const friendlyRoot = cogAnalysis.friendly?.root;
  const adversaryRoot = cogAnalysis.adversary?.root;
  if (friendlyRoot || adversaryRoot) {
    sectionsWithData++;
    let content = '';
    if (friendlyRoot) content += `The friendly center of gravity is "${friendlyRoot.label}". `;
    if (adversaryRoot) {
      content += `The adversary center of gravity is "${adversaryRoot.label}"`;
      const adversaryCVs = collectCVs(adversaryRoot);
      if (adversaryCVs.length > 0) {
        content += `. Key vulnerabilities: ${adversaryCVs.map((v) => v.label).join(', ')}`;
      }
      content += '. ';
    }
    primarySections.push({ heading: 'Centers of Gravity', content: content.trim() });
    synthesisNotes.push('CoG data used');
  }

  if (linesOfEffort.length > 0) {
    sectionsWithData++;
    let content = `${linesOfEffort.length} lines of effort: `;
    content += linesOfEffort.map((loe) => `"${loe.name}"`).join(', ') + '.';
    primarySections.push({ heading: 'Lines of Effort', content });
    synthesisNotes.push(`${linesOfEffort.length} LOEs`);
  }

  const phases = operationalApproach.phases ?? [];
  if (phases.length > 0) {
    sectionsWithData++;
    const sorted = [...phases].sort((a, b) => a.order - b.order);
    const content = `${phases.length} phases: ${sorted.map((p) => `"${p.name}"`).join(', ')}.`;
    primarySections.push({ heading: 'Operational Phasing', content });
    synthesisNotes.push(`${phases.length} phases`);
  }

  const decisionPoints = operationalApproach.decisionPoints ?? [];
  if (decisionPoints.length > 0) {
    sectionsWithData++;
    const content = `${decisionPoints.length} decision points: ${decisionPoints.map((dp) => `"${dp.label}"`).join(', ')}.`;
    primarySections.push({ heading: 'Decision Points', content });
    synthesisNotes.push(`${decisionPoints.length} decision points`);
  }

  const primaryNarrative = primarySections.map((s) => s.content).join('\n\n');
  const completenessScore = Math.round((sectionsWithData / totalSections) * 100) / 100;

  return {
    drafts: [{
      narrative: primaryNarrative,
      sections: primarySections,
      confidence: 0.4,
      confidenceBounds: { lower: 0.2, upper: 0.6 },
      synthesisNotes: [...synthesisNotes, 'LLM unavailable — using template-based fallback'],
    }],
    completenessScore,
  };
}

// ==========================================================================
// Core Function (LLM-powered with fallback)
// ==========================================================================

/**
 * Synthesize operational design data into a narrative draft.
 *
 * Uses LLM with the Narrative Synthesis Agent's character to generate natural
 * operational prose. Falls back to rule-based template on LLM error.
 */
export async function synthesizeNarrative(
  context: NarrativeSynthesisContext,
  strategicContext?: string,
): Promise<NarrativeSynthesisOutput> {
  try {
    const llm = await createLLMForAgent({
      agentId: 'narrative-synthesis',
      overrides: { temperature: 0.5, maxTokens: 4096 },
    });

    let userPrompt = buildNarrativeUserPrompt(context);
    if (strategicContext) {
      userPrompt = `${strategicContext}\n\n${userPrompt}`;
    }

    const response = await llm.invoke([
      { role: 'system', content: NARRATIVE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);

    const text = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const parsed = parseJSONResponse<NarrativeSynthesisOutput>(text);
    if (!parsed || !Array.isArray(parsed.drafts) || parsed.drafts.length === 0) {
      console.warn('[narrative-synthesis] LLM response did not match expected structure, using fallback');
      return synthesizeNarrativeFallback(context);
    }

    console.log(`[narrative-synthesis] LLM generated ${parsed.drafts.length} narrative drafts`);
    return parsed;
  } catch (error) {
    console.error('[narrative-synthesis] LLM synthesis failed, using fallback:', error);
    return synthesizeNarrativeFallback(context);
  }
}
