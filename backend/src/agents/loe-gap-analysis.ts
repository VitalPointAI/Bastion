/**
 * Lines of Effort Gap Analysis Agent
 *
 * Phase 25 Plan 06: Identifies unaddressed vulnerabilities, missing LOE-CoG linkages,
 * and phase coverage gaps in the operational design.
 *
 * Purpose: Support planners by analyzing the relationship between Lines of Effort
 * and the CoG analysis, ensuring CVs are addressed by LOE decisive points and
 * that phasing coverage is complete.
 *
 * Per the safety matrix, this is HYBRID_HUMAN_LED -- human owns the design,
 * AI identifies gaps and recommends improvements.
 *
 * v1: Rule-based stub with conservative confidence bounds per INVARIANT 5.
 */

import type { AgentManifest } from './types.js';
import { AgentPhase, AgentCapability, AutonomyLevel } from './types.js';
import { ProposalKind } from '../dao/types.js';
import type { LineOfEffort, CoGAnalysis, CoGNode } from '../design/types.js';
import { createLLMForAgent } from './langgraph/llm-factory.js';

// ==========================================================================
// Output Interfaces
// ==========================================================================

/**
 * A gap or suggestion identified in the LOE-CoG relationship.
 */
export interface LOEGapSuggestion {
  /** Type of gap identified */
  type: 'unaddressed-vulnerability' | 'missing-linkage' | 'phase-gap' | 'loe-suggestion';
  /** Description of the gap */
  description: string;
  /** Which LOE is affected (null if general) */
  affectedLoeId: string | null;
  /** Which CoG node is affected (null if general) */
  affectedCogNodeId: string | null;
  /** How to fix this gap */
  recommendation: string;
  /** Priority level */
  priority: 'high' | 'medium' | 'low';
  /** Confidence in this finding (0-1) */
  confidence: number;
  /** Confidence interval bounds per INVARIANT 5 */
  confidenceBounds: { lower: number; upper: number };
}

/**
 * Complete output from LOE gap analysis agent.
 */
export interface LOEGapAnalysisOutput {
  /** Gap suggestions and findings */
  suggestions: LOEGapSuggestion[];
  /** Percentage of CVs addressed by LOE decisive points (0-1) */
  coverageScore: number;
  /** Confidence interval bounds per INVARIANT 5 */
  confidenceBounds: { lower: number; upper: number };
}

// ==========================================================================
// Agent Manifest
// ==========================================================================

/**
 * LOE Gap Analysis agent manifest.
 *
 * CRITICAL:
 * - maxAutonomy: NotAutonomous (HYBRID_HUMAN_LED per safety matrix)
 * - Human owns LOE design; AI identifies gaps and recommends improvements
 * - Advisory only -- does not modify LOEs or CoG trees
 */
export const LOE_GAP_ANALYSIS_AGENT: AgentManifest = {
  agentId: 'loe-gap-analysis',
  name: 'Lines of Effort Gap Analysis Agent',
  description:
    'Identifies unaddressed vulnerabilities, missing LOE-CoG linkages, and phase coverage gaps',
  phase: AgentPhase.Support,
  capabilities: [AgentCapability.ContextAnalysis],
  maxAutonomy: AutonomyLevel.NotAutonomous,
  allowedProposalKinds: [],
  requiresHumanApproval: Object.values(ProposalKind),
  createdAt: new Date(),
  createdBy: 'system',
  active: true,
  character: {
    name: 'LOE Gap Analysis Agent',
    bio: [
      'Lines of Effort gap analysis specialist',
      'Expert in linking LOE decisive points to CoG vulnerabilities',
      'Identifies phase coverage gaps and missing linkages',
      'Ensures operational design completeness before plan development',
    ],
    lore: [
      'Designed to bridge CoG analysis and Lines of Effort design',
      'Ensures every identified vulnerability has an operational response',
      'Validates phasing completeness across all LOEs',
      'Supports JP 5-0 operational design-to-plan transition',
    ],
    knowledge: [
      'Lines of Effort connect strategic objectives to tactical actions through decisive points',
      'Each CV identified in CoG analysis should be addressed by at least one LOE decisive point',
      'Phase coverage ensures continuous operational pressure across the timeline',
      'Missing linkages between LOEs and CoG create gaps exploitable by adversaries',
    ],
    messageExamples: [],
    postExamples: [],
    topics: [
      'lines of effort',
      'decisive points',
      'CoG-LOE linkage',
      'phase coverage',
      'gap analysis',
      'operational design',
    ],
    style: {
      all: [
        'Identify specific gaps with actionable recommendations',
        'Prioritize findings by operational impact',
        'Reference CoG-LOE relationships explicitly',
        'Provide confidence intervals for all assessments',
      ],
      chat: ['Structured findings with priority labels', 'Clear recommendation language'],
      post: [],
    },
    adjectives: ['analytical', 'thorough', 'gap-focused', 'operationally-minded'],
    plugins: ['loe-gap-analysis-tools'],
    settings: {},
  },
};

// ==========================================================================
// Helper Functions
// ==========================================================================

/**
 * Recursively collect all CVs from a CoG tree.
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
 * Get all unique phases referenced by decisive points across LOEs.
 */
function getReferencedPhases(loes: LineOfEffort[]): Set<string> {
  const phases = new Set<string>();
  for (const loe of loes) {
    for (const dp of loe.decisivePoints) {
      if (dp.phase) {
        phases.add(dp.phase);
      }
    }
  }
  return phases;
}

// ==========================================================================
// LLM Prompts
// ==========================================================================

const LOE_SYSTEM_PROMPT = `You are the Lines of Effort Gap Analysis Agent — a specialist in linking operational Lines of Effort to Center of Gravity vulnerabilities.

Your expertise:
${LOE_GAP_ANALYSIS_AGENT.character!.bio.map((b) => `- ${b}`).join('\n')}

Your knowledge base:
${LOE_GAP_ANALYSIS_AGENT.character!.knowledge.map((k) => `- ${k}`).join('\n')}

Style guidelines:
${LOE_GAP_ANALYSIS_AGENT.character!.style.all.map((s) => `- ${s}`).join('\n')}

CRITICAL: You are HYBRID_HUMAN_LED. You identify gaps — the human owns the design.`;

function serializeCogForLOE(node: CoGNode | null, side: string): string {
  if (!node) return `${side}: (empty)`;
  const lines: string[] = [];
  function walk(n: CoGNode, depth: number) {
    const indent = '  '.repeat(depth);
    lines.push(`${indent}- [${n.type}] "${n.label}" (id: ${n.id})`);
    for (const child of n.children) walk(child, depth + 1);
  }
  walk(node, 0);
  return `${side} CoG:\n${lines.join('\n')}`;
}

function buildLoeUserPrompt(loes: LineOfEffort[], cogAnalysis: CoGAnalysis): string {
  const friendlyCog = serializeCogForLOE(cogAnalysis.friendly?.root, 'Friendly');
  const adversaryCog = serializeCogForLOE(cogAnalysis.adversary?.root, 'Adversary');

  const loeText = loes.length === 0
    ? '(no LOEs defined)'
    : loes.map((loe) => {
        const dps = loe.decisivePoints.map((dp) => {
          const links = dp.cogLinks?.map((l) => l.cogNodeId).join(', ') || 'none';
          return `    - DP: "${dp.label}" (phase: ${dp.phase || 'unassigned'}, cogLinks: [${links}])`;
        }).join('\n');
        return `  LOE: "${loe.name}" (id: ${loe.id})${loe.description ? ` — ${loe.description}` : ''}\n${dps || '    (no decisive points)'}`;
      }).join('\n\n');

  return `Analyze the relationship between Lines of Effort and CoG analysis to identify gaps.

## CoG Analysis

${friendlyCog}

${adversaryCog}

## Lines of Effort

${loeText}

## Instructions
Identify gaps in the LOE-CoG relationship:

1. "suggestions" — gaps found (type: unaddressed-vulnerability|missing-linkage|phase-gap|loe-suggestion, description, affectedLoeId or null, affectedCogNodeId or null, recommendation, priority: high|medium|low, confidence 0-1, confidenceBounds {lower, upper})
2. "coverageScore" — percentage of CVs addressed by LOE decisive points (0-1)
3. "confidenceBounds" — overall confidence {lower, upper}

Focus on:
- CVs not addressed by any LOE decisive point
- LOEs with no decisive points or no CoG links
- Phase coverage gaps (phases where an LOE has no activity)
- Missing LOEs that should exist to address identified vulnerabilities
- Specific actionable recommendations

Respond ONLY with a JSON object:
{
  "suggestions": [ ... ],
  "coverageScore": 0.5,
  "confidenceBounds": { "lower": 0.3, "upper": 0.7 }
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
    console.error('[loe-gap-analysis] Failed to parse LLM JSON response:', cleaned.substring(0, 200));
    return null;
  }
}

// ==========================================================================
// Rule-Based Fallback
// ==========================================================================

function analyzeLOEGapsFallback(
  loes: LineOfEffort[],
  cogAnalysis: CoGAnalysis
): LOEGapAnalysisOutput {
  const suggestions: LOEGapSuggestion[] = [];

  const friendlyCVs = collectCVs(cogAnalysis.friendly?.root);
  const adversaryCVs = collectCVs(cogAnalysis.adversary?.root);
  const allCVs = [...friendlyCVs, ...adversaryCVs];

  const linkedCogNodeIds = new Set<string>();
  for (const loe of loes) {
    for (const dp of loe.decisivePoints) {
      for (const link of dp.cogLinks) {
        linkedCogNodeIds.add(link.cogNodeId);
      }
    }
  }

  for (const cv of allCVs) {
    if (!linkedCogNodeIds.has(cv.id)) {
      const side = friendlyCVs.includes(cv) ? 'friendly' : 'adversary';
      suggestions.push({
        type: 'unaddressed-vulnerability',
        description: `${side.charAt(0).toUpperCase() + side.slice(1)} CV "${cv.label}" is not addressed by any LOE decisive point.`,
        affectedLoeId: null,
        affectedCogNodeId: cv.id,
        recommendation: `Create or link a decisive point to address "${cv.label}".`,
        priority: 'high',
        confidence: 0.6,
        confidenceBounds: { lower: 0.4, upper: 0.8 },
      });
    }
  }

  for (const loe of loes) {
    if (loe.decisivePoints.length === 0) {
      suggestions.push({
        type: 'loe-suggestion',
        description: `LOE "${loe.name}" has no decisive points defined.`,
        affectedLoeId: loe.id,
        affectedCogNodeId: null,
        recommendation: `Add decisive points to LOE "${loe.name}".`,
        priority: 'high',
        confidence: 0.7,
        confidenceBounds: { lower: 0.5, upper: 0.85 },
      });
    }
  }

  if (loes.length === 0 && allCVs.length > 0) {
    suggestions.push({
      type: 'loe-suggestion',
      description: 'No Lines of Effort defined but Critical Vulnerabilities exist.',
      affectedLoeId: null,
      affectedCogNodeId: null,
      recommendation: 'Create Lines of Effort to address identified CVs.',
      priority: 'high',
      confidence: 0.7,
      confidenceBounds: { lower: 0.5, upper: 0.85 },
    });
  }

  const totalCVs = allCVs.length;
  const linkedCVs = allCVs.filter((cv) => linkedCogNodeIds.has(cv.id)).length;
  const coverageScore = totalCVs > 0 ? Math.round((linkedCVs / totalCVs) * 100) / 100 : 0;

  return {
    suggestions,
    coverageScore,
    confidenceBounds: { lower: 0.3, upper: 0.7 },
  };
}

// ==========================================================================
// Core Function (LLM-powered with fallback)
// ==========================================================================

/**
 * Analyze LOE-CoG relationships and identify gaps.
 *
 * Uses LLM with the LOE Gap Analysis Agent's character to generate context-aware
 * gap analysis. Falls back to rule-based analysis on LLM error.
 */
export async function analyzeLOEGaps(
  loes: LineOfEffort[],
  cogAnalysis: CoGAnalysis,
  strategicContext?: string,
): Promise<LOEGapAnalysisOutput> {
  try {
    const llm = await createLLMForAgent({
      agentId: 'loe-gap-analysis',
      overrides: { temperature: 0.3, maxTokens: 4096 },
    });

    let userPrompt = buildLoeUserPrompt(loes, cogAnalysis);
    if (strategicContext) {
      userPrompt = `${strategicContext}\n\n${userPrompt}`;
    }

    const response = await llm.invoke([
      { role: 'system', content: LOE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);

    const text = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const parsed = parseJSONResponse<LOEGapAnalysisOutput>(text);
    if (!parsed || !Array.isArray(parsed.suggestions)) {
      console.warn('[loe-gap-analysis] LLM response did not match expected structure, using fallback');
      return analyzeLOEGapsFallback(loes, cogAnalysis);
    }

    console.log(`[loe-gap-analysis] LLM generated ${parsed.suggestions.length} gap suggestions`);
    return parsed;
  } catch (error) {
    console.error('[loe-gap-analysis] LLM analysis failed, using fallback:', error);
    return analyzeLOEGapsFallback(loes, cogAnalysis);
  }
}
