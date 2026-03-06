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
// Core Function (v1 Rule-Based)
// ==========================================================================

/**
 * Analyze LOE-CoG relationships and identify gaps.
 *
 * v1: Rule-based stub that checks structural relationships.
 * Future: LLM-powered analysis using scenario context and doctrinal knowledge.
 *
 * @param loes - Current Lines of Effort
 * @param cogAnalysis - Current CoG analysis with friendly and adversary trees
 * @returns LOEGapAnalysisOutput with gap suggestions and coverage score
 */
export async function analyzeLOEGaps(
  loes: LineOfEffort[],
  cogAnalysis: CoGAnalysis
): Promise<LOEGapAnalysisOutput> {
  const suggestions: LOEGapSuggestion[] = [];

  // Collect all CVs from both trees
  const friendlyCVs = collectCVs(cogAnalysis.friendly.root);
  const adversaryCVs = collectCVs(cogAnalysis.adversary.root);
  const allCVs = [...friendlyCVs, ...adversaryCVs];

  // Collect all cogLinks from all decisive points
  const linkedCogNodeIds = new Set<string>();
  for (const loe of loes) {
    for (const dp of loe.decisivePoints) {
      for (const link of dp.cogLinks) {
        linkedCogNodeIds.add(link.cogNodeId);
      }
    }
  }

  // Check which CVs are unaddressed
  for (const cv of allCVs) {
    if (!linkedCogNodeIds.has(cv.id)) {
      const side = friendlyCVs.includes(cv) ? 'friendly' : 'adversary';
      suggestions.push({
        type: 'unaddressed-vulnerability',
        description: `${side.charAt(0).toUpperCase() + side.slice(1)} CV "${cv.label}" is not addressed by any LOE decisive point.`,
        affectedLoeId: null,
        affectedCogNodeId: cv.id,
        recommendation: `Create or link a decisive point in an appropriate LOE to address the vulnerability "${cv.label}".`,
        priority: 'high',
        confidence: 0.6,
        confidenceBounds: { lower: 0.4, upper: 0.8 },
      });
    }
  }

  // Check for LOEs with no decisive points
  for (const loe of loes) {
    if (loe.decisivePoints.length === 0) {
      suggestions.push({
        type: 'loe-suggestion',
        description: `LOE "${loe.name}" has no decisive points defined.`,
        affectedLoeId: loe.id,
        affectedCogNodeId: null,
        recommendation: `Add decisive points to LOE "${loe.name}" to define key actions and milestones along this line of effort.`,
        priority: 'high',
        confidence: 0.7,
        confidenceBounds: { lower: 0.5, upper: 0.85 },
      });
    }
  }

  // Check for phase gaps -- phases where no LOE has decisive points
  const referencedPhases = getReferencedPhases(loes);
  if (referencedPhases.size > 0) {
    // Check each LOE for phase coverage
    for (const loe of loes) {
      if (loe.decisivePoints.length === 0) continue;

      const loePhaseCoverage = new Set<string>();
      for (const dp of loe.decisivePoints) {
        if (dp.phase) loePhaseCoverage.add(dp.phase);
      }

      for (const phase of referencedPhases) {
        if (!loePhaseCoverage.has(phase)) {
          suggestions.push({
            type: 'phase-gap',
            description: `LOE "${loe.name}" has no decisive points in phase "${phase}".`,
            affectedLoeId: loe.id,
            affectedCogNodeId: null,
            recommendation: `Consider whether LOE "${loe.name}" requires actions during phase "${phase}". If so, add decisive points.`,
            priority: 'medium',
            confidence: 0.4,
            confidenceBounds: { lower: 0.25, upper: 0.6 },
          });
        }
      }
    }
  }

  // Check for LOEs with decisive points but no CoG links
  for (const loe of loes) {
    const dpsWithLinks = loe.decisivePoints.filter((dp) => dp.cogLinks.length > 0);
    if (loe.decisivePoints.length > 0 && dpsWithLinks.length === 0) {
      suggestions.push({
        type: 'missing-linkage',
        description: `LOE "${loe.name}" has decisive points but none are linked to CoG nodes.`,
        affectedLoeId: loe.id,
        affectedCogNodeId: null,
        recommendation: `Link decisive points in "${loe.name}" to relevant CoG vulnerabilities to ensure operational actions target identified weaknesses.`,
        priority: 'medium',
        confidence: 0.55,
        confidenceBounds: { lower: 0.35, upper: 0.75 },
      });
    }
  }

  // Suggest creating LOEs if none exist but CVs do
  if (loes.length === 0 && allCVs.length > 0) {
    suggestions.push({
      type: 'loe-suggestion',
      description: 'No Lines of Effort defined but Critical Vulnerabilities exist in CoG analysis.',
      affectedLoeId: null,
      affectedCogNodeId: null,
      recommendation: 'Create Lines of Effort to address the identified Critical Vulnerabilities. Each LOE should target specific CVs through decisive points.',
      priority: 'high',
      confidence: 0.7,
      confidenceBounds: { lower: 0.5, upper: 0.85 },
    });
  }

  // Calculate coverage score
  const totalCVs = allCVs.length;
  const linkedCVs = allCVs.filter((cv) => linkedCogNodeIds.has(cv.id)).length;
  const coverageScore = totalCVs > 0 ? Math.round((linkedCVs / totalCVs) * 100) / 100 : 0;

  return {
    suggestions,
    coverageScore,
    confidenceBounds: { lower: 0.3, upper: 0.7 },
  };
}
