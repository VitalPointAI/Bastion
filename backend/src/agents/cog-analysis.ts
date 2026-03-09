/**
 * Center of Gravity Analysis Agent
 *
 * Phase 25 Plan 06: Generates CoG analysis suggestions using Strange's CG-CC-CR-CV framework.
 * Validates existing CoG trees and suggests missing elements.
 *
 * Purpose: Support planners in building comprehensive CoG analyses by identifying
 * missing tree levels, validating node completeness, and suggesting new elements
 * based on doctrinal requirements.
 *
 * Per the safety matrix, this is HYBRID_HUMAN_LED -- human owns the analysis,
 * AI offers suggestions and validation.
 *
 * v1: Rule-based stub with conservative confidence bounds per INVARIANT 5.
 */

import type { AgentManifest } from './types.js';
import { AgentPhase, AgentCapability, AutonomyLevel } from './types.js';
import { ProposalKind } from '../dao/types.js';
import type { CoGAnalysis, CoGNode, CoGTree } from '../design/types.js';
import { createLLMForAgent } from './langgraph/llm-factory.js';

// ==========================================================================
// Output Interfaces
// ==========================================================================

/**
 * A suggestion for a new node to add to a CoG tree.
 */
export interface CoGSuggestion {
  /** Type of CoG element being suggested */
  type: 'cog' | 'critical-capability' | 'critical-requirement' | 'critical-vulnerability';
  /** Suggested node label */
  label: string;
  /** Why this element matters */
  description: string;
  /** Where it should attach in the tree (null for root CG) */
  parentType: CoGNode['type'] | null;
  /** Which tree this belongs to */
  side: 'friendly' | 'adversary';
  /** Doctrinal reasoning for this suggestion */
  rationale: string;
  /** Confidence in this suggestion (0-1) */
  confidence: number;
  /** Confidence interval bounds per INVARIANT 5 */
  confidenceBounds: { lower: number; upper: number };
}

/**
 * Validation issue found in existing CoG tree.
 */
export interface CoGValidationIssue {
  /** ID of the node with the issue */
  nodeId: string;
  /** Description of the issue */
  issue: string;
  /** Severity level */
  severity: 'warning' | 'error';
}

/**
 * Complete output from CoG analysis agent.
 */
export interface CoGAnalysisOutput {
  /** Suggested nodes to add to the tree */
  suggestions: CoGSuggestion[];
  /** Problems found with existing tree */
  validationIssues: CoGValidationIssue[];
  /** How complete the analysis is (0-1) */
  completenessScore: number;
  /** Confidence interval bounds per INVARIANT 5 */
  confidenceBounds: { lower: number; upper: number };
}

// ==========================================================================
// Agent Manifest
// ==========================================================================

/**
 * CoG Analysis agent manifest.
 *
 * CRITICAL:
 * - maxAutonomy: NotAutonomous (HYBRID_HUMAN_LED per safety matrix)
 * - Human owns the CoG analysis; AI offers suggestions and validation
 * - Never modifies the tree directly, only provides suggestions
 */
export const COG_ANALYSIS_AGENT: AgentManifest = {
  agentId: 'cog-analysis',
  name: 'Center of Gravity Analysis Agent',
  description:
    'Validates CoG trees and suggests missing elements using Strange\'s CG-CC-CR-CV framework',
  phase: AgentPhase.Support,
  capabilities: [AgentCapability.ContextAnalysis],
  maxAutonomy: AutonomyLevel.NotAutonomous,
  allowedProposalKinds: [],
  requiresHumanApproval: Object.values(ProposalKind),
  createdAt: new Date(),
  createdBy: 'system',
  active: true,
  character: {
    name: 'CoG Analysis Agent',
    bio: [
      'Center of Gravity analysis specialist using Strange\'s framework',
      'Expert in CG-CC-CR-CV hierarchical decomposition',
      'Validates completeness and structural integrity of CoG trees',
      'Identifies missing critical elements in friendly and adversary analyses',
    ],
    lore: [
      'Based on Dr. Joe Strange\'s Centers of Gravity & Critical Vulnerabilities framework',
      'Ensures all four levels (CG, CC, CR, CV) are addressed',
      'Validates that vulnerabilities are actionable for operational planning',
      'Supports JP 5-0 operational design methodology',
    ],
    knowledge: [
      'Strange\'s CG-CC-CR-CV: Center of Gravity, Critical Capabilities, Critical Requirements, Critical Vulnerabilities',
      'CG is the source of power that provides moral or physical strength, freedom of action, or will to act',
      'CC are primary abilities that merit a CG to be identified as such',
      'CR are essential conditions, resources, and means for a CC to be fully operative',
      'CV are CR or their components that are deficient or vulnerable to neutralization',
    ],
    messageExamples: [],
    postExamples: [],
    topics: [
      'center of gravity',
      'critical capabilities',
      'critical requirements',
      'critical vulnerabilities',
      'Strange\'s framework',
      'operational design',
    ],
    style: {
      all: [
        'Structured analysis with clear hierarchy',
        'Reference doctrinal frameworks explicitly',
        'Provide confidence intervals for all assessments',
        'Suggest specific additions rather than vague guidance',
      ],
      chat: ['Bullet points for clarity', 'Tables for comparison'],
      post: [],
    },
    adjectives: ['systematic', 'doctrinal', 'thorough', 'structured'],
    plugins: ['cog-analysis-tools'],
    settings: {},
  },
};

// ==========================================================================
// Helper Functions
// ==========================================================================

/**
 * Recursively collect all nodes in a CoG tree.
 */
function collectNodes(node: CoGNode | null): CoGNode[] {
  if (!node) return [];
  const result: CoGNode[] = [node];
  for (const child of node.children) {
    result.push(...collectNodes(child));
  }
  return result;
}

/**
 * Count how many tree levels are populated (CG -> CC -> CR -> CV = 4 levels).
 */
function countTreeDepth(tree: CoGTree): number {
  if (!tree.root) return 0;
  let depth = 1; // CG level
  const ccs = tree.root.children.filter((c) => c.type === 'critical-capability');
  if (ccs.length > 0) {
    depth = 2;
    const crs = ccs.flatMap((cc) => cc.children.filter((c) => c.type === 'critical-requirement'));
    if (crs.length > 0) {
      depth = 3;
      const cvs = crs.flatMap((cr) =>
        cr.children.filter((c) => c.type === 'critical-vulnerability')
      );
      if (cvs.length > 0) {
        depth = 4;
      }
    }
  }
  return depth;
}

// ==========================================================================
// LLM Prompts
// ==========================================================================

const COG_SYSTEM_PROMPT = `You are the Center of Gravity Analysis Agent — a specialist in Strange's CG-CC-CR-CV framework for military operational design.

Your expertise:
${COG_ANALYSIS_AGENT.character!.bio.map((b) => `- ${b}`).join('\n')}

Your knowledge base:
${COG_ANALYSIS_AGENT.character!.knowledge.map((k) => `- ${k}`).join('\n')}

Style guidelines:
${COG_ANALYSIS_AGENT.character!.style.all.map((s) => `- ${s}`).join('\n')}

CRITICAL: You are HYBRID_HUMAN_LED. You suggest improvements — the human owns the analysis.`;

function serializeTree(tree: CoGTree, side: string): string {
  if (!tree.root) return `${side} tree: (empty — no CG defined)`;
  const lines: string[] = [];
  function walk(node: CoGNode, depth: number) {
    const indent = '  '.repeat(depth);
    const desc = node.description ? ` — ${node.description}` : '';
    lines.push(`${indent}- [${formatType(node.type)}] "${node.label}"${desc} (id: ${node.id})`);
    for (const child of node.children) walk(child, depth + 1);
  }
  walk(tree.root, 0);
  return `${side} CoG Tree:\n${lines.join('\n')}`;
}

function buildCogUserPrompt(cogAnalysis: CoGAnalysis): string {
  const friendlyTree = serializeTree(cogAnalysis.friendly, 'Friendly');
  const adversaryTree = serializeTree(cogAnalysis.adversary, 'Adversary');

  return `Analyze these Center of Gravity trees and provide suggestions for improvement.

## Current CoG Analysis

${friendlyTree}

${adversaryTree}

## Instructions
Analyze the trees using Strange's CG-CC-CR-CV framework and provide:

1. "suggestions" — specific nodes to add (type: cog|critical-capability|critical-requirement|critical-vulnerability, label, description, parentType, side: friendly|adversary, rationale, confidence 0-1, confidenceBounds {lower, upper})
2. "validationIssues" — problems with existing nodes (nodeId, issue description, severity: warning|error)
3. "completenessScore" — how complete the analysis is (0-1)
4. "confidenceBounds" — overall confidence {lower, upper}

Focus on:
- Missing tree levels (every CG should have CCs, every CC should have CRs, every CR should have CVs)
- Empty descriptions that need filling
- Incorrect hierarchy nesting
- Specific, actionable suggestions with doctrinal reasoning (not generic advice)

Respond ONLY with a JSON object:
{
  "suggestions": [ { "type": "...", "label": "...", "description": "...", "parentType": "cog"|"critical-capability"|"critical-requirement"|null, "side": "friendly"|"adversary", "rationale": "...", "confidence": 0.6, "confidenceBounds": { "lower": 0.4, "upper": 0.8 } } ],
  "validationIssues": [ { "nodeId": "...", "issue": "...", "severity": "warning"|"error" } ],
  "completenessScore": 0.5,
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
    console.error('[cog-analysis] Failed to parse LLM JSON response:', cleaned.substring(0, 200));
    return null;
  }
}

// ==========================================================================
// Rule-Based Fallback
// ==========================================================================

function analyzeCenterOfGravityFallback(cogAnalysis: CoGAnalysis): CoGAnalysisOutput {
  const suggestions: CoGSuggestion[] = [];
  const validationIssues: CoGValidationIssue[] = [];

  const sides: Array<{ key: 'friendly' | 'adversary'; tree: CoGTree }> = [
    { key: 'friendly', tree: cogAnalysis.friendly },
    { key: 'adversary', tree: cogAnalysis.adversary },
  ];

  for (const { key, tree } of sides) {
    const sideLabel = key.charAt(0).toUpperCase() + key.slice(1);

    if (!tree.root) {
      suggestions.push({
        type: 'cog',
        label: `${sideLabel} Center of Gravity`,
        description: `Identify the primary source of ${key === 'friendly' ? 'our' : 'adversary'} power, strength, freedom of action, or will to act.`,
        parentType: null,
        side: key,
        rationale: `Per Strange's framework, every ${key} force analysis begins with identifying the Center of Gravity.`,
        confidence: 0.5,
        confidenceBounds: { lower: 0.3, upper: 0.7 },
      });
      continue;
    }

    if (!tree.root.description || tree.root.description.trim() === '') {
      validationIssues.push({
        nodeId: tree.root.id,
        issue: `${sideLabel} CG node is missing a description.`,
        severity: 'warning',
      });
    }

    const ccs = tree.root.children.filter((c) => c.type === 'critical-capability');
    if (ccs.length === 0) {
      suggestions.push({
        type: 'critical-capability',
        label: `${sideLabel} Critical Capability`,
        description: `Identify a primary ability that makes "${tree.root.label}" a center of gravity.`,
        parentType: 'cog',
        side: key,
        rationale: 'Each CG should have at least one Critical Capability.',
        confidence: 0.5,
        confidenceBounds: { lower: 0.3, upper: 0.7 },
      });
    } else {
      for (const cc of ccs) {
        const crs = cc.children.filter((c) => c.type === 'critical-requirement');
        if (crs.length === 0) {
          suggestions.push({
            type: 'critical-requirement',
            label: `Requirement for "${cc.label}"`,
            description: `Identify an essential condition for "${cc.label}" to be operative.`,
            parentType: 'critical-capability',
            side: key,
            rationale: 'Each CC should have at least one CR.',
            confidence: 0.45,
            confidenceBounds: { lower: 0.3, upper: 0.65 },
          });
        } else {
          for (const cr of crs) {
            const cvs = cr.children.filter((c) => c.type === 'critical-vulnerability');
            if (cvs.length === 0) {
              suggestions.push({
                type: 'critical-vulnerability',
                label: `Vulnerability in "${cr.label}"`,
                description: `Identify a deficiency in "${cr.label}" that could be exploited.`,
                parentType: 'critical-requirement',
                side: key,
                rationale: 'Each CR should have at least one CV.',
                confidence: 0.4,
                confidenceBounds: { lower: 0.25, upper: 0.6 },
              });
            }
          }
        }
      }
    }

    const allNodes = collectNodes(tree.root);
    for (const node of allNodes) {
      if (node === tree.root) continue;
      for (const child of node.children) {
        const expectedChildType = getExpectedChildType(node.type);
        if (expectedChildType && child.type !== expectedChildType) {
          validationIssues.push({
            nodeId: child.id,
            issue: `Node "${child.label}" (${formatType(child.type)}) is nested under "${node.label}" (${formatType(node.type)}). Expected: ${formatType(expectedChildType)}.`,
            severity: 'error',
          });
        }
      }
    }
  }

  const friendlyDepth = countTreeDepth(cogAnalysis.friendly);
  const adversaryDepth = countTreeDepth(cogAnalysis.adversary);
  const completenessScore = (friendlyDepth + adversaryDepth) / 8;

  return {
    suggestions,
    validationIssues,
    completenessScore: Math.round(completenessScore * 100) / 100,
    confidenceBounds: { lower: 0.3, upper: 0.7 },
  };
}

// ==========================================================================
// Core Function (LLM-powered with fallback)
// ==========================================================================

/**
 * Analyze a CoG analysis and suggest improvements.
 *
 * Uses LLM with the CoG Analysis Agent's character to generate context-aware
 * suggestions. Falls back to rule-based analysis on LLM error.
 */
export async function analyzeCenterOfGravity(
  cogAnalysis: CoGAnalysis,
  strategicContext?: string,
): Promise<CoGAnalysisOutput> {
  try {
    const llm = await createLLMForAgent({
      agentId: 'cog-analysis',
      overrides: { temperature: 0.3, maxTokens: 4096 },
    });

    let userPrompt = buildCogUserPrompt(cogAnalysis);
    if (strategicContext) {
      userPrompt = `${strategicContext}\n\n${userPrompt}`;
    }

    const response = await llm.invoke([
      { role: 'system', content: COG_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);

    const text = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const parsed = parseJSONResponse<CoGAnalysisOutput>(text);
    if (!parsed || !Array.isArray(parsed.suggestions)) {
      console.warn('[cog-analysis] LLM response did not match expected structure, using fallback');
      return analyzeCenterOfGravityFallback(cogAnalysis);
    }

    console.log(`[cog-analysis] LLM generated ${parsed.suggestions.length} suggestions, ${parsed.validationIssues?.length ?? 0} issues`);
    return parsed;
  } catch (error) {
    console.error('[cog-analysis] LLM analysis failed, using fallback:', error);
    return analyzeCenterOfGravityFallback(cogAnalysis);
  }
}

/**
 * Get the expected child type for a given parent type in the CG-CC-CR-CV hierarchy.
 */
function getExpectedChildType(parentType: CoGNode['type']): CoGNode['type'] | null {
  switch (parentType) {
    case 'cog':
      return 'critical-capability';
    case 'critical-capability':
      return 'critical-requirement';
    case 'critical-requirement':
      return 'critical-vulnerability';
    case 'critical-vulnerability':
      return null; // CVs are leaf nodes
  }
}

/**
 * Format a CoG node type for human-readable display.
 */
function formatType(type: CoGNode['type']): string {
  switch (type) {
    case 'cog':
      return 'CG';
    case 'critical-capability':
      return 'CC';
    case 'critical-requirement':
      return 'CR';
    case 'critical-vulnerability':
      return 'CV';
  }
}
