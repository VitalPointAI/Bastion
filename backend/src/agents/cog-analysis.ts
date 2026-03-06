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
// Core Function (v1 Rule-Based)
// ==========================================================================

/**
 * Analyze a CoG analysis and suggest improvements.
 *
 * v1: Rule-based stub that checks tree structure and suggests missing levels.
 * Future: LLM-powered analysis using scenario context and doctrinal knowledge.
 *
 * @param cogAnalysis - Current CoG analysis with friendly and adversary trees
 * @returns CoGAnalysisOutput with suggestions, validation issues, and completeness score
 */
export async function analyzeCenterOfGravity(
  cogAnalysis: CoGAnalysis
): Promise<CoGAnalysisOutput> {
  const suggestions: CoGSuggestion[] = [];
  const validationIssues: CoGValidationIssue[] = [];

  const sides: Array<{ key: 'friendly' | 'adversary'; tree: CoGTree }> = [
    { key: 'friendly', tree: cogAnalysis.friendly },
    { key: 'adversary', tree: cogAnalysis.adversary },
  ];

  for (const { key, tree } of sides) {
    const sideLabel = key.charAt(0).toUpperCase() + key.slice(1);

    // Check if tree has a root CG node
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

    // Validate root node
    if (!tree.root.description || tree.root.description.trim() === '') {
      validationIssues.push({
        nodeId: tree.root.id,
        issue: `${sideLabel} CG node is missing a description. Describe why this is the center of gravity.`,
        severity: 'warning',
      });
    }

    // Check for CCs under CG
    const ccs = tree.root.children.filter((c) => c.type === 'critical-capability');
    if (ccs.length === 0) {
      suggestions.push({
        type: 'critical-capability',
        label: `${sideLabel} Critical Capability`,
        description: `Identify a primary ability that makes "${tree.root.label}" a center of gravity.`,
        parentType: 'cog',
        side: key,
        rationale: 'Each CG should have at least one Critical Capability -- the primary abilities that merit identification as a CG.',
        confidence: 0.5,
        confidenceBounds: { lower: 0.3, upper: 0.7 },
      });
    } else {
      // Validate each CC and check for CRs
      for (const cc of ccs) {
        if (!cc.description || cc.description.trim() === '') {
          validationIssues.push({
            nodeId: cc.id,
            issue: `Critical Capability "${cc.label}" is missing a description.`,
            severity: 'warning',
          });
        }

        const crs = cc.children.filter((c) => c.type === 'critical-requirement');
        if (crs.length === 0) {
          suggestions.push({
            type: 'critical-requirement',
            label: `Requirement for "${cc.label}"`,
            description: `Identify an essential condition, resource, or means needed for "${cc.label}" to be fully operative.`,
            parentType: 'critical-capability',
            side: key,
            rationale: 'Each CC should have at least one CR -- the essential conditions and resources for the capability to function.',
            confidence: 0.45,
            confidenceBounds: { lower: 0.3, upper: 0.65 },
          });
        } else {
          // Check each CR for CVs
          for (const cr of crs) {
            if (!cr.description || cr.description.trim() === '') {
              validationIssues.push({
                nodeId: cr.id,
                issue: `Critical Requirement "${cr.label}" is missing a description.`,
                severity: 'warning',
              });
            }

            const cvs = cr.children.filter((c) => c.type === 'critical-vulnerability');
            if (cvs.length === 0) {
              suggestions.push({
                type: 'critical-vulnerability',
                label: `Vulnerability in "${cr.label}"`,
                description: `Identify a deficiency or vulnerability in "${cr.label}" that could be neutralized or exploited.`,
                parentType: 'critical-requirement',
                side: key,
                rationale: 'Each CR should have at least one CV -- the exploitable weaknesses that enable operational targeting.',
                confidence: 0.4,
                confidenceBounds: { lower: 0.25, upper: 0.6 },
              });
            } else {
              // Validate CVs
              for (const cv of cvs) {
                if (!cv.description || cv.description.trim() === '') {
                  validationIssues.push({
                    nodeId: cv.id,
                    issue: `Critical Vulnerability "${cv.label}" is missing a description. CVs should describe actionable weaknesses.`,
                    severity: 'warning',
                  });
                }
              }
            }
          }
        }
      }
    }

    // Check for orphaned nodes (nodes that don't fit CG -> CC -> CR -> CV hierarchy)
    const allNodes = collectNodes(tree.root);
    for (const node of allNodes) {
      if (node === tree.root) continue;
      // Check for unexpected type nesting
      for (const child of node.children) {
        const expectedChildType = getExpectedChildType(node.type);
        if (expectedChildType && child.type !== expectedChildType) {
          validationIssues.push({
            nodeId: child.id,
            issue: `Node "${child.label}" (${formatType(child.type)}) is nested under "${node.label}" (${formatType(node.type)}). Expected child type: ${formatType(expectedChildType)}.`,
            severity: 'error',
          });
        }
      }
    }
  }

  // Calculate completeness score based on tree depth coverage
  const friendlyDepth = countTreeDepth(cogAnalysis.friendly);
  const adversaryDepth = countTreeDepth(cogAnalysis.adversary);
  // Average of both trees, normalized to 4 levels
  const completenessScore = (friendlyDepth + adversaryDepth) / 8;

  return {
    suggestions,
    validationIssues,
    completenessScore: Math.round(completenessScore * 100) / 100,
    confidenceBounds: { lower: 0.3, upper: 0.7 },
  };
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
