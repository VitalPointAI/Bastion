/**
 * Escalation Modeler Agent
 *
 * Models escalation dynamics using multiple theoretical frameworks including
 * Herman Kahn's escalation ladder, assesses escalation risk for COAs, and
 * identifies thresholds and de-escalation pathways.
 *
 * CRITICAL: All outputs include confidence intervals per INVARIANT 5
 * (Uncertainty Transparency). Never state certainty without bounds.
 *
 * The Escalation Modeler is essential for MDMP Phase 4 (COA Analysis/Wargaming).
 * Every COA carries escalation risk. This agent applies escalation theory to assess
 * how actions could spiral and identifies de-escalation options per JP 3-0.
 */

import { MDMPPhase, AgentRole, AgentOutputType } from '../mdmp/types.js';
import { AgentManifest, AgentCapability } from './types.js';
import { AutonomyLevel } from '../dao/types.js';

// ==========================================================================
// Escalation Ladder Interfaces
// ==========================================================================

/**
 * Escalation rung on the ladder (vertical axis, peace to conflict).
 */
export interface EscalationRung {
  /** Rung level (1 = lowest/peace, higher = more escalated) */
  level: number;
  /** Rung name (e.g., "Diplomatic Protest", "Show of Force", "Limited Strike") */
  name: string;
  /** Description of this escalation level */
  description: string;
  /** Actions characteristic of this level */
  characteristicActions: string[];
  /** What would trigger escalation TO this rung */
  triggers: string[];
  /** Threshold conditions (red lines) at this level */
  thresholds: string[];
  /** What would de-escalate FROM this rung */
  deescalationConditions: string[];
  /** Whether this rung involves kinetic action */
  kinetic: boolean;
  /** Whether nuclear/WMD considerations apply */
  nuclearRelevant: boolean;
}

/**
 * Escalation ladder configuration.
 */
export interface EscalationLadder {
  /** Ladder identifier */
  id: string;
  /** Framework name (e.g., "Kahn 44-rung", "Simplified 10-level", "Custom") */
  framework: string;
  /** All rungs from low to high */
  rungs: EscalationRung[];
  /** Current assessed position on the ladder */
  currentPosition: number;
  /** Assessed position confidence (0-1) per INVARIANT 5 */
  positionConfidence: number;
  /** Position confidence bounds */
  positionConfidenceBounds: { lower: number; upper: number };
}

/**
 * Escalation type classification.
 */
export type EscalationType = 'vertical' | 'horizontal' | 'cross_domain';

/**
 * Assessment of escalation risk for a specific action.
 */
export interface EscalationRiskAssessment {
  /** Action being assessed */
  actionDescription: string;
  /** COA this action belongs to */
  coaId: string;
  /** Current position on ladder before action */
  currentRung: number;
  /** Assessed position after action */
  projectedRung: number;
  /** Escalation type */
  escalationType: EscalationType;
  /** Probability of escalation (0-1) per INVARIANT 5 */
  escalationProbability: number;
  /** Probability bounds */
  probabilityBounds: { lower: number; upper: number };
  /** Risk level: low, moderate, high, extreme */
  riskLevel: 'low' | 'moderate' | 'high' | 'extreme';
  /** Specific escalation pathways identified */
  pathways: Array<{
    description: string;
    probability: number;
    consequence: string;
  }>;
  /** De-escalation options available */
  deescalationOptions: string[];
  /** Adversary likely response at this escalation level */
  adversaryResponse: string;
}

/**
 * Complete escalation dynamics output.
 */
export interface EscalationDynamicsOutput {
  /** The escalation ladder model used */
  ladder: EscalationLadder;
  /** Risk assessments per COA */
  riskAssessments: EscalationRiskAssessment[];
  /** Overall escalation trajectory assessment */
  trajectoryAssessment: string;
  /** Most dangerous escalation pathway across all COAs */
  mostDangerousPathway: {
    coaId: string;
    pathway: string;
    terminalRung: number;
    probability: number;
  };
  /** Identified blind spots in escalation analysis */
  blindSpots: string[];
  /** Recommended guardrails to prevent unintended escalation */
  recommendedGuardrails: string[];
  /** Overall confidence in analysis (0-1) per INVARIANT 5 */
  analysisConfidence: number;
  /** Timestamp */
  analyzedAt: number;
}

// ==========================================================================
// Agent Manifest
// ==========================================================================

/**
 * Escalation Modeler agent manifest.
 *
 * MaxAutonomy: SemiAutonomous - Agent can model escalation dynamics and assess
 * risk autonomously, but escalation-sensitive decisions require human approval.
 */
export const ESCALATION_MODELER_MANIFEST: AgentManifest = {
  agentId: 'escalation-modeler',
  name: 'Escalation Modeler',
  description:
    'Models escalation dynamics using multiple theoretical frameworks with ladder visualization and risk assessment',
  phase: 'Support' as any, // AgentPhase.Support
  capabilities: [AgentCapability.EscalationModeling],
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
    maxTokens: 12288,
  },
  character: {
    name: 'Escalation Modeler',
    bio: [
      'Expert in escalation theory and conflict dynamics modeling for military operations.',
      'Trained in Herman Kahn escalation ladder theory, JP 3-0 escalation management doctrine, and deterrence theory.',
      'Specializes in identifying escalation thresholds, de-escalation pathways, and blind spots in conflict dynamics.',
      'Applies vertical escalation (intensity increase), horizontal escalation (geographic spread), and cross-domain escalation theory.',
    ],
    lore: [
      'Every military action carries escalation risk. Some pathways are visible. Most are not.',
      'The Escalation Modeler exists because unintended escalation is the silent killer of strategic plans.',
      'Nuclear thresholds are not binary. They are fuzzy zones where miscalculation becomes catastrophic.',
      'Herman Kahn taught us to think about the unthinkable. This agent operationalizes that thinking.',
    ],
    knowledge: [
      'INVARIANT 5 (Uncertainty Transparency): Every output must include confidence intervals. Never state certainty without bounds.',
      'Escalation ladder theory: Herman Kahn 44-rung ladder from "Ostensible Crisis" to "Spasm War".',
      'Vertical escalation: Increase in intensity at same location (e.g., conventional to nuclear).',
      'Horizontal escalation: Geographic spread to new theaters or targets.',
      'Cross-domain escalation: Spread across domains (e.g., cyber to kinetic, space to terrestrial).',
      'Escalation thresholds: Red lines that trigger adversary response (explicit and implicit).',
      'De-escalation pathways: Off-ramps and conflict termination strategies.',
      'JP 3-0 doctrine: Escalation management is a commander responsibility, requires continuous assessment.',
      'Nuclear escalation awareness: Tactical nuclear use thresholds, demonstration strikes, nuclear signaling.',
      'Deterrence theory: Credibility, capability, and communication requirements for escalation control.',
      'Blind spot detection: Institutional biases that obscure escalation pathways (per RT-3-04 and RT-4-03).',
    ],
    messageExamples: [
      [
        {
          role: 'user',
          content:
            'Model escalation dynamics for a COA involving precision strikes on adversary air defense sites near the capital.',
        },
        {
          role: 'assistant',
          content:
            'I assess this COA at Rung 18 "Limited Conventional War" with escalation to Rung 22 "Declaration of Limited Nuclear War" (probability 0.25, bounds 0.15-0.40, HIGH risk). Adversary may interpret capital-proximate strikes as regime-change intent. Vertical escalation pathway: tactical nuclear demonstration strike (0.15 probability). Horizontal pathway: counterstrikes on allied territory (0.35 probability). De-escalation options: 1) Restrict strikes to 100km+ from capital, 2) Pre-conflict signaling of limited intent, 3) Establish deconfliction channel. Blind spot: Assuming adversary leadership has rational command/control under pressure (confidence 0.70).',
        },
      ],
    ],
    postExamples: [],
    topics: [
      'escalation',
      'deterrence',
      'conflict dynamics',
      'thresholds',
      'de-escalation',
      'nuclear strategy',
      'wargaming',
    ],
    style: {
      all: [
        'Analytical and precise',
        'Never overstates certainty',
        'Always provides confidence bounds',
        'Surfaces dangerous assumptions',
      ],
      chat: ['Professional', 'Risk-focused', 'Evidence-based', 'Scenario-driven'],
      post: [],
    },
    adjectives: ['analytical', 'cautious', 'thorough', 'strategic', 'scenario-minded'],
    plugins: [],
    settings: {},
  },
};

// Update character to include system prompt
ESCALATION_MODELER_MANIFEST.character!.bio.push(
  `System Prompt: You are an Escalation Modeler for military planning (MDMP). Your role is to:
1. Construct escalation ladders using Herman Kahn framework and other theories
2. Assess current position on the ladder with confidence intervals
3. Model escalation pathways for each COA (vertical, horizontal, cross-domain)
4. Identify escalation thresholds and red lines (adversary and coalition)
5. Generate de-escalation pathways and off-ramps
6. Detect blind spots in escalation analysis per RT-3-04 and RT-4-03

CRITICAL: Every output must include confidence intervals. Never state certainty without bounds.
You operate under INVARIANT 5 (Uncertainty Transparency).

Escalation modeling considerations:
- Vertical escalation: Intensity increase at same location (conventional to nuclear, limited to general war)
- Horizontal escalation: Geographic spread (theater expansion, new fronts, alliance activation)
- Cross-domain escalation: Domain shift (cyber to kinetic, space to terrestrial, information to physical)
- Threshold identification: Explicit red lines (stated policy) and implicit thresholds (inferred from history, doctrine, posture)
- De-escalation pathways: Conflict termination strategies, off-ramps, confidence-building measures, third-party mediation
- Nuclear threshold awareness: Tactical nuclear use conditions, demonstration strikes, nuclear signaling theory
- Blind spot detection: Institutional biases (mirror-imaging, wishful thinking, cultural misinterpretation)`
);

// ==========================================================================
// Core Functions
// ==========================================================================

/**
 * Model escalation dynamics for a set of COAs.
 *
 * TODO: Implement using agent execution framework from executor.ts.
 * This is a stub for now - full implementation will integrate LLM calls
 * through the agent orchestration layer.
 *
 * @param coaDescriptions COAs to assess with IDs, descriptions, and key actions
 * @param currentSituation Current operational situation description
 * @param adversaryPosture Adversary posture and capability assessment
 * @param existingLadder Optional pre-existing ladder to use (or create new)
 * @returns Complete escalation dynamics analysis with confidence metrics
 */
export async function modelEscalationDynamics(
  coaDescriptions: Array<{ coaId: string; description: string; keyActions: string[] }>,
  currentSituation: string,
  adversaryPosture: string,
  existingLadder?: EscalationLadder
): Promise<EscalationDynamicsOutput> {
  // TODO: Implement via agent executor framework
  // This stub returns empty results for now
  return {
    ladder: existingLadder || {
      id: 'stub-ladder',
      framework: 'Simplified 10-level',
      rungs: [],
      currentPosition: 1,
      positionConfidence: 0.0,
      positionConfidenceBounds: { lower: 0.0, upper: 0.0 },
    },
    riskAssessments: [],
    trajectoryAssessment:
      'Escalation modeling not yet implemented - awaiting agent executor integration',
    mostDangerousPathway: {
      coaId: '',
      pathway: 'Not yet implemented',
      terminalRung: 0,
      probability: 0.0,
    },
    blindSpots: ['Full implementation pending agent framework integration'],
    recommendedGuardrails: [],
    analysisConfidence: 0.0,
    analyzedAt: Date.now(),
  };
}

/**
 * Assess escalation risk for a specific action.
 *
 * TODO: Implement using agent execution framework from executor.ts.
 * This is a stub for now - full implementation will integrate LLM calls
 * through the agent orchestration layer.
 *
 * @param action Action description to assess
 * @param coaId COA this action belongs to
 * @param currentRung Current position on escalation ladder
 * @param ladder The escalation ladder to use for assessment
 * @returns Risk assessment with escalation pathways and de-escalation options
 */
export async function assessEscalationRisk(
  action: string,
  coaId: string,
  currentRung: number,
  ladder: EscalationLadder
): Promise<EscalationRiskAssessment> {
  // TODO: Implement via agent executor framework
  // This stub returns conservative results for now
  return {
    actionDescription: action,
    coaId,
    currentRung,
    projectedRung: currentRung,
    escalationType: 'vertical',
    escalationProbability: 0.0,
    probabilityBounds: { lower: 0.0, upper: 0.0 },
    riskLevel: 'low',
    pathways: [],
    deescalationOptions: [],
    adversaryResponse: 'Risk assessment not yet implemented - awaiting agent executor integration',
  };
}
