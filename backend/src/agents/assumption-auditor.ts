/**
 * Assumption Auditor Agent
 *
 * Surfaces hidden and explicit planning assumptions from documents, classifies
 * their sensitivity, and tracks their validity through the Assumption Registry.
 *
 * CRITICAL: All outputs must include confidence intervals per INVARIANT 5
 * (Uncertainty Transparency). Never state certainty without bounds.
 *
 * The Assumption Auditor is a core MDMP enabler. Every MDMP phase generates
 * planning assumptions that must be explicitly identified, classified, and
 * tracked. Without this agent, assumption identification falls entirely on humans.
 */

import {
  SensitivityLevel,
  AssumptionSource,
  MDMPPhase,
} from '../mdmp/types.js';
import { AgentManifest, AgentCapability } from './types.js';
import { AutonomyLevel } from '../dao/types.js';

// ==========================================================================
// Output Interfaces
// ==========================================================================

/**
 * A surfaced assumption identified by the Assumption Auditor.
 */
export interface SurfacedAssumption {
  /** Generated assumption ID */
  id: string;
  /** Human-readable description */
  description: string;
  /** Classified sensitivity level */
  sensitivity: SensitivityLevel;
  /** How this assumption was identified */
  source: AssumptionSource;
  /** Suggested validation method */
  validationMethod: string;
  /** MDMP phase where identified */
  identifiedInPhase: MDMPPhase;
  /** Activities that depend on this assumption */
  dependentActivities: string[];
  /** Confidence that this IS an assumption (0-1) per INVARIANT 5 */
  identificationConfidence: number;
  /** Confidence interval bounds for sensitivity classification */
  sensitivityConfidenceBounds: { lower: number; upper: number };
  /** Source text excerpt where assumption was found */
  sourceExcerpt: string;
}

/**
 * Output from an assumption audit operation.
 */
export interface AssumptionAuditOutput {
  /** All surfaced assumptions */
  assumptions: SurfacedAssumption[];
  /** Assumptions that were already known (matched existing) */
  matchedExisting: Array<{ surfacedId: string; existingId: string; similarity: number }>;
  /** Overall audit summary */
  summary: string;
  /** Confidence in audit completeness (0-1) per INVARIANT 5 */
  completenessConfidence: number;
  /** Known gaps in coverage */
  coverageGaps: string[];
  /** Timestamp of analysis */
  analyzedAt: number;
}

/**
 * Output from assumption validation against new intelligence.
 */
export interface AssumptionValidationOutput {
  /** Assumption ID being validated */
  assumptionId: string;
  /** Whether the assumption still appears valid */
  stillValid: boolean;
  /** Evidence supporting or contradicting */
  evidence: Array<{ source: string; supports: boolean; excerpt: string }>;
  /** Confidence in validation result (0-1) per INVARIANT 5 */
  validationConfidence: number;
  /** Recommendation: accept, reject, flag_for_review */
  recommendation: 'accept' | 'reject' | 'flag_for_review';
  /** Reasoning for recommendation */
  reasoning: string;
}

// ==========================================================================
// Agent Manifest
// ==========================================================================

/**
 * Assumption Auditor agent manifest.
 *
 * MaxAutonomy: SemiAutonomous - Agent can surface assumptions and classify
 * sensitivity autonomously, but assumption acceptance requires human approval.
 */
export const ASSUMPTION_AUDITOR_MANIFEST: AgentManifest = {
  agentId: 'assumption-auditor',
  name: 'Assumption Auditor',
  description:
    'Surfaces hidden and explicit planning assumptions, classifies sensitivity, and tracks validity',
  phase: 'Support' as unknown as AgentManifest['phase'],
  capabilities: [AgentCapability.AssumptionAuditing],
  maxAutonomy: AutonomyLevel.SemiAutonomous,
  allowedProposalKinds: [],
  requiresHumanApproval: [],
  createdAt: new Date(),
  createdBy: 'system',
  active: true,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-sonnet',
    temperature: 0.3,
    maxTokens: 8192,
  },
  character: {
    name: 'Assumption Auditor',
    bio: [
      'Methodical analyst specializing in uncovering unstated beliefs in military planning.',
      'Trained to identify explicit assumptions stated in documents and hidden assumptions planners may not realize they are making.',
      'Classifies assumptions by sensitivity: how much the plan changes if the assumption is wrong.',
    ],
    lore: [
      'Every plan is built on assumptions. Some are stated. Most are not.',
      'The Assumption Auditor exists because hidden assumptions are the silent killers of military plans.',
      'Sensitivity analysis is not optional. If an assumption is wrong, how much of the plan survives?',
    ],
    knowledge: [
      'INVARIANT 5 (Uncertainty Transparency): Every output must include confidence intervals. Never state certainty without bounds.',
      'Hidden assumption categories: Environmental stability, adversary behavior, coalition reliability, logistics availability, information environment, timeline feasibility, force ratios.',
      'Sensitivity levels: Low (plan survives), Medium (plan degrades), High (plan fails), Critical (mission fails).',
      'Validation methods: Intelligence collection, wargaming, red team challenge, historical analysis, simulation.',
      'JP 5-0 doctrine: Mission analysis (Phase 2) is the primary phase for assumption identification, but assumptions surface in all phases.',
    ],
    messageExamples: [
      [
        {
          role: 'user',
          content:
            'Analyze this planning document and surface assumptions: "We will establish a logistics hub at Port X within 48 hours of D-Day."',
        },
        {
          role: 'assistant',
          content:
            'I identify 4 assumptions (confidence 0.85): 1) Port X is accessible and not denied by adversary (CRITICAL sensitivity, 0.7-0.9), 2) Local labor and equipment are available for offload (HIGH sensitivity, 0.6-0.8), 3) No significant civil unrest in port area (MEDIUM, 0.5-0.7), 4) Weather permits port operations (MEDIUM, 0.4-0.6). Validation methods: Recent ISR of port, civil affairs assessment, meteorological forecast.',
        },
      ],
    ],
    postExamples: [],
    topics: ['assumptions', 'planning', 'risk', 'sensitivity', 'validation', 'doctrine'],
    style: {
      all: [
        'Methodical and precise',
        'Never overstates certainty',
        'Always provides confidence bounds',
        'Questions unstated beliefs',
      ],
      chat: ['Professional', 'Skeptical but constructive', 'Evidence-focused'],
      post: [],
    },
    adjectives: ['methodical', 'skeptical', 'thorough', 'precise', 'questioning'],
    plugins: [],
    settings: {},
  },
};

// Update character to include system prompt
ASSUMPTION_AUDITOR_MANIFEST.character!.bio.push(
  `System Prompt: You are an Assumption Auditor for military planning (MDMP). Your role is to:
1. Surface explicit assumptions stated in planning documents
2. Identify HIDDEN assumptions that planners may not realize they are making
3. Classify each assumption by sensitivity (how much the plan changes if wrong)
4. Suggest validation methods for each assumption
5. Track which activities and products depend on each assumption

CRITICAL: Every output must include confidence intervals. Never state certainty without bounds.
You operate under INVARIANT 5 (Uncertainty Transparency).

Categories of hidden assumptions to check:
- Environmental stability (weather, terrain, civil infrastructure)
- Adversary behavior (intent, capability, will to fight)
- Coalition partner reliability (caveats, political will, interoperability)
- Logistics availability (port access, fuel, ammunition)
- Information environment (comms, cyber, deception)
- Timeline feasibility (deployment rates, decision cycles)
- Force ratios and combat power calculations`
);

// ==========================================================================
// Core Functions
// ==========================================================================

/**
 * Audit a document for planning assumptions.
 *
 * TODO: Implement using agent execution framework from executor.ts.
 * This is a stub for now - full implementation will integrate LLM calls
 * through the agent orchestration layer.
 *
 * @param documentText The document text to analyze
 * @param missionId The mission this analysis is for
 * @param currentPhase The current MDMP phase
 * @param existingAssumptions Previously identified assumptions for deduplication
 * @returns Audit output with surfaced assumptions and confidence metrics
 */
export async function auditAssumptions(
  _documentText: string,
  _missionId: string,
  _currentPhase: MDMPPhase,
  _existingAssumptions: Array<{ id: string; description: string }>
): Promise<AssumptionAuditOutput> {
  // TODO: Implement via agent executor framework
  // This stub returns empty results for now
  return {
    assumptions: [],
    matchedExisting: [],
    summary: 'Audit not yet implemented - awaiting agent executor integration',
    completenessConfidence: 0.0,
    coverageGaps: ['Full implementation pending agent framework integration'],
    analyzedAt: Date.now(),
  };
}

/**
 * Validate an existing assumption against new intelligence.
 *
 * TODO: Implement using agent execution framework from executor.ts.
 * This is a stub for now - full implementation will integrate LLM calls
 * through the agent orchestration layer.
 *
 * @param assumptionId The assumption to validate
 * @param assumptionDescription Human-readable assumption text
 * @param currentIntelligence New intelligence to validate against
 * @returns Validation output with evidence and recommendation
 */
export async function validateAssumption(
  assumptionId: string,
  _assumptionDescription: string,
  _currentIntelligence: string
): Promise<AssumptionValidationOutput> {
  // TODO: Implement via agent executor framework
  // This stub returns conservative results for now
  return {
    assumptionId,
    stillValid: false,
    evidence: [],
    validationConfidence: 0.0,
    recommendation: 'flag_for_review',
    reasoning: 'Validation not yet implemented - awaiting agent executor integration',
  };
}
