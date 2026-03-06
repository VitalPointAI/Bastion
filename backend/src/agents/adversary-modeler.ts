/**
 * Adversary Modeler Agent
 *
 * Synthesizes adversary capability models from intelligence inputs and generates
 * MLCOA (Most Likely COA) and MDCOA (Most Dangerous COA) per ATP 2-01.3 doctrine.
 * Provides adversary COA narratives in intelligence assessment format for wargaming
 * action-reaction-counteraction cycles.
 *
 * CRITICAL: All outputs must include confidence intervals per INVARIANT 5
 * (Uncertainty Transparency). Never state certainty without bounds.
 *
 * The Adversary Modeler is a core MDMP Phase 2 enabler. Mission Analysis requires
 * adversary COA development to enable wargaming in Phase 4. Without this agent,
 * adversary COA generation falls entirely on human intelligence analysts.
 */

import {
  MDMPPhase,
} from '../mdmp/types.js';
import { AgentManifest, AgentCapability } from './types.js';
import { AutonomyLevel } from '../dao/types.js';

// ==========================================================================
// Output Interfaces
// ==========================================================================

/**
 * A specific adversary capability identified from intelligence.
 */
export interface AdversaryCapability {
  /** Capability domain (fires, maneuver, protection, intel, etc.) */
  domain: string;
  /** Human-readable description */
  description: string;
  /** Assessment of capability strength */
  assessment: 'strong' | 'moderate' | 'weak' | 'unknown';
  /** Confidence in this assessment (0-1) per INVARIANT 5 */
  confidence: number;
  /** Confidence interval bounds */
  confidenceBounds: { lower: number; upper: number };
  /** Supporting evidence */
  evidence: string[];
  /** Known limitations of this capability */
  limitations: string[];
}

/**
 * Comprehensive adversary force model synthesized from intelligence.
 */
export interface AdversaryForceModel {
  /** Generated model ID */
  id: string;
  /** Adversary name/designation */
  adversaryName: string;
  /** Force type classification */
  forceType: 'conventional' | 'irregular' | 'hybrid' | 'peer';
  /** Identified capabilities */
  capabilities: AdversaryCapability[];
  /** Doctrinal tactics, techniques, and procedures */
  doctrineTTPs: string[];
  /** Assessed objectives */
  objectives: string[];
  /** Center of gravity analysis */
  centerOfGravity: string;
  /** Critical vulnerabilities */
  criticalVulnerabilities: string[];
  /** Known intelligence gaps */
  intelligenceGaps: string[];
  /** Timestamp of model generation */
  generatedAt: number;
}

/**
 * A single adversary course of action (MLCOA or MDCOA).
 */
export interface AdversaryCOA {
  /** Generated COA ID */
  id: string;
  /** COA type classification */
  coaType: 'MLCOA' | 'MDCOA';
  /** COA name/designation */
  name: string;
  /** Narrative description in intelligence assessment format */
  narrative: string;
  /** Key actions in sequence */
  keyActions: string[];
  /** Observable indicators */
  indicators: string[];
  /** Decision points for adversary */
  decisionPoints: string[];
  /** Probability of adoption (0-1) per INVARIANT 5 */
  probability: number;
  /** Probability confidence bounds */
  probabilityBounds: { lower: number; upper: number };
  /** Risk assessment for friendly forces */
  riskAssessment: string;
}

/**
 * Complete output from adversary analysis.
 */
export interface AdversaryAnalysisOutput {
  /** Synthesized force model */
  forceModel: AdversaryForceModel;
  /** Generated COAs */
  coas: AdversaryCOA[];
  /** ID of the most likely COA */
  mostLikelyCOAId: string;
  /** ID of the most dangerous COA */
  mostDangerousCOAId: string;
  /** High-level analysis summary */
  analysisSummary: string;
  /** Confidence in overall analysis (0-1) per INVARIANT 5 */
  analysisConfidence: number;
  /** Known gaps in analysis */
  analysisGaps: string[];
  /** Timestamp of analysis */
  analyzedAt: number;
}

// ==========================================================================
// Agent Manifest
// ==========================================================================

/**
 * Adversary Modeler agent manifest.
 *
 * MaxAutonomy: SemiAutonomous - Agent can synthesize force models and generate
 * COAs autonomously, but COA acceptance for wargaming requires human approval.
 */
export const ADVERSARY_MODELER_MANIFEST: AgentManifest = {
  agentId: 'adversary-modeler',
  name: 'Adversary Modeler',
  description:
    'Synthesizes adversary capability models and generates MLCOA/MDCOA per ATP 2-01.3',
  phase: 'Support' as unknown as AgentManifest['phase'],
  capabilities: [AgentCapability.AdversaryModeling],
  maxAutonomy: AutonomyLevel.SemiAutonomous,
  allowedProposalKinds: [],
  requiresHumanApproval: [],
  createdAt: new Date(),
  createdBy: 'system',
  active: true,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-sonnet',
    temperature: 0.4,
    maxTokens: 16384,
  },
  character: {
    name: 'Adversary Modeler',
    bio: [
      'Intelligence analyst specializing in adversary force modeling and COA development.',
      'Trained to synthesize disparate intelligence into coherent capability assessments.',
      'Generates MLCOA (Most Likely COA) and MDCOA (Most Dangerous COA) per ATP 2-01.3 doctrine.',
    ],
    lore: [
      'Understanding the adversary is the foundation of operational planning.',
      'The Adversary Modeler exists because adversary COA development requires synthesizing intelligence from multiple sources at speed.',
      'MLCOA tells you what to plan for. MDCOA tells you what to be ready for.',
    ],
    knowledge: [
      'INVARIANT 5 (Uncertainty Transparency): Every output must include confidence intervals. Never state certainty without bounds.',
      'ATP 2-01.3 Intelligence Preparation of the Battlefield: Adversary force modeling, COA development, event templates.',
      'COA types: MLCOA (most probable given objectives and capabilities), MDCOA (most dangerous given friendly vulnerabilities).',
      'Force types: Conventional (uniformed, doctrine-driven), Irregular (guerrilla, asymmetric), Hybrid (mix of both), Peer (near-equal capability).',
      'Center of Gravity: Source of freedom of action, physical or moral strength, power, or will to act (JP 5-0).',
      'Observable indicators: Actions that signal adversary intent or COA adoption.',
      'Intelligence gaps: Information needed but not available - drives ISR planning.',
    ],
    messageExamples: [
      [
        {
          role: 'user',
          content:
            'Analyze this adversary: "Mechanized brigade with T-72 tanks, BMP-2 IFVs, and 122mm artillery. Known to use Soviet-era doctrine."',
        },
        {
          role: 'assistant',
          content:
            'Force model (confidence 0.75): Conventional mechanized force. Capabilities: Fires (moderate, 0.6-0.8), Maneuver (moderate, 0.5-0.7), Protection (weak, 0.4-0.6). Doctrine: Soviet combined arms - artillery prep, armor exploitation. MLCOA (probability 0.65, bounds 0.55-0.75): Deliberate attack along MSR Alpha with artillery suppression. MDCOA (probability 0.25, bounds 0.15-0.35): Night infiltration bypassing defensive positions. Intelligence gaps: Air defense capability, C2 modernization level, fuel/ammo status.',
        },
      ],
    ],
    postExamples: [],
    topics: [
      'adversary',
      'intelligence',
      'COA',
      'wargaming',
      'ATP 2-01.3',
      'force modeling',
    ],
    style: {
      all: [
        'Analytical and precise',
        'Never overstates confidence',
        'Always provides probability bounds',
        'Intelligence analyst perspective',
      ],
      chat: ['Professional', 'Evidence-based', 'Doctrine-grounded'],
      post: [],
    },
    adjectives: ['analytical', 'precise', 'thorough', 'evidence-based', 'doctrine-grounded'],
    plugins: [],
    settings: {},
  },
};

// Update character to include system prompt
ADVERSARY_MODELER_MANIFEST.character!.bio.push(
  `System Prompt: You are an Adversary Modeler for military planning (MDMP Phase 2 - Mission Analysis). Your role is to:
1. Synthesize intelligence inputs into coherent adversary force capability models
2. Generate MLCOA (Most Likely COA) based on adversary objectives and capabilities
3. Generate MDCOA (Most Dangerous COA) based on friendly vulnerabilities
4. Provide narrative intelligence assessments in ATP 2-01.3 format
5. Identify observable indicators and decision points for each COA
6. Surface intelligence gaps that require ISR collection

CRITICAL: Every output must include confidence intervals. Never state certainty without bounds.
You operate under INVARIANT 5 (Uncertainty Transparency).

Force modeling domains to assess:
- Fires: Artillery, rockets, mortars, air support capability
- Maneuver: Mobility, combined arms coordination, tempo
- Protection: Defensive posture, survivability, force protection
- Intelligence: ISR assets, cyber capability, information warfare
- Sustainment: Logistics capacity, fuel, ammunition, personnel replacement
- Command & Control: C2 systems, decision cycle speed, delegation patterns

COA development criteria:
- MLCOA: Most probable given adversary objectives, capabilities, and historical patterns
- MDCOA: Most dangerous to friendly forces given our vulnerabilities and adversary capabilities
- Both must be feasible (adversary can execute), acceptable (achieves objectives), suitable (exploits terrain/weather)
- Provide probability estimates with confidence bounds for each COA`
);

// ==========================================================================
// Core Functions
// ==========================================================================

/**
 * Analyze adversary from intelligence inputs and generate force model.
 *
 * TODO: Implement using agent execution framework from executor.ts.
 * This is a stub for now - full implementation will integrate LLM calls
 * through the agent orchestration layer.
 *
 * @param intelligenceInputs Raw intelligence data to analyze
 * @param missionId The mission this analysis is for
 * @param currentPhase The current MDMP phase
 * @param existingForceModel Optional previous force model to update
 * @returns Adversary analysis output with force model and COAs
 */
export async function analyzeAdversary(
  _intelligenceInputs: string[],
  _missionId: string,
  _currentPhase: MDMPPhase,
  _existingForceModel?: AdversaryForceModel
): Promise<AdversaryAnalysisOutput> {
  // TODO: Implement via agent executor framework
  // This stub returns empty results for now
  return {
    forceModel: {
      id: 'temp-id',
      adversaryName: 'Unknown',
      forceType: 'unknown' as AdversaryForceModel['forceType'],
      capabilities: [],
      doctrineTTPs: [],
      objectives: [],
      centerOfGravity: 'Not yet analyzed',
      criticalVulnerabilities: [],
      intelligenceGaps: ['Full implementation pending agent framework integration'],
      generatedAt: Date.now(),
    },
    coas: [],
    mostLikelyCOAId: '',
    mostDangerousCOAId: '',
    analysisSummary: 'Analysis not yet implemented - awaiting agent executor integration',
    analysisConfidence: 0.0,
    analysisGaps: ['Full implementation pending agent framework integration'],
    analyzedAt: Date.now(),
  };
}

/**
 * Generate adversary COAs from force model.
 *
 * TODO: Implement using agent execution framework from executor.ts.
 * This is a stub for now - full implementation will integrate LLM calls
 * through the agent orchestration layer.
 *
 * @param forceModel The adversary force model to generate COAs for
 * @param friendlyMission Friendly mission context for MDCOA risk assessment
 * @param operationalEnvironment Terrain, weather, civil factors
 * @returns Array of adversary COAs (MLCOA and MDCOA)
 */
export async function generateAdversaryCOAs(
  _forceModel: AdversaryForceModel,
  _friendlyMission: string,
  _operationalEnvironment: string
): Promise<AdversaryCOA[]> {
  // TODO: Implement via agent executor framework
  // This stub returns empty results for now
  return [];
}
