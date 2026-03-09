/**
 * Problem Framing Agent
 *
 * Generates alternative problem framings from multiple theoretical perspectives
 * to challenge planners' default mental models.
 *
 * Purpose: MDMP Phase 2 (Mission Analysis) requires problem framing before COA development.
 * Per the safety matrix, PROBLEM_FRAMING is HYBRID_HUMAN_LED -- human selects and owns
 * the framing, AI offers alternatives.
 *
 * This agent prevents tunnel vision by presenting multiple perspectives:
 * - Military, diplomatic, economic, informational, social frameworks
 * - Adversary perspective taking
 * - Coalition partner viewpoints
 * - Local population interests
 * - Historical analogy identification
 *
 * Outputs include confidence intervals per INVARIANT 5.
 */

import type { AgentManifest } from './types.js';
import { AgentPhase, AgentCapability, AutonomyLevel } from './types.js';
import { ProposalKind } from '../dao/types.js';
import { createLLMForAgent } from './langgraph/llm-factory.js';

// ==========================================================================
// Output Interfaces
// ==========================================================================

/**
 * Perspective types for alternative problem framings.
 * Covers DIME framework + adversary/coalition/population + historical analogy.
 */
export type PerspectiveType =
  | 'military'
  | 'diplomatic'
  | 'economic'
  | 'informational'
  | 'social'
  | 'legal'
  | 'adversary'
  | 'coalition_partner'
  | 'local_population'
  | 'historical_analogy';

/**
 * Alternative problem framing from a specific perspective.
 */
export interface AlternativeFraming {
  /** Which perspective this framing uses */
  perspectiveType: PerspectiveType;
  /** One-sentence framing statement */
  framingStatement: string;
  /** Identified root causes from this perspective */
  rootCauses: string[];
  /** Key stakeholders and their interests */
  keyStakeholders: Array<{
    name: string;
    interest: string;
    influence: 'high' | 'medium' | 'low';
  }>;
  /** Potential intervention points this framing reveals */
  interventionPoints: string[];
  /** Assumptions embedded in this framing */
  assumptions: string[];
  /** Blind spots this framing might create */
  blindSpots: string[];
  /** Confidence in this framing (0-1) per INVARIANT 5 */
  framingConfidence: number;
  /** Confidence interval bounds per INVARIANT 5 */
  confidenceBounds: { lower: number; upper: number };
}

/**
 * Comparison between two framings showing overlaps and contradictions.
 */
export interface FramingComparison {
  /** First framing (brief label) */
  framingA: string;
  /** Second framing (brief label) */
  framingB: string;
  /** Elements shared by both framings */
  sharedElements: string[];
  /** Points where framings contradict */
  contradictions: string[];
  /** Insights that complement when combined */
  complementaryInsights: string[];
}

/**
 * Complete problem framing output.
 */
export interface ProblemFramingOutput {
  /** The default/dominant framing identified from inputs */
  defaultFraming: AlternativeFraming;
  /** Alternative framings from different perspectives */
  alternativeFramings: AlternativeFraming[];
  /** Comparison between framings */
  framingComparisons: FramingComparison[];
  /** Hidden assumptions in the default framing */
  hiddenAssumptions: string[];
  /** Recommended framing perspective (AI suggestion, human decides) */
  recommendedFramingPerspective: PerspectiveType | null;
  /** Reasoning for recommendation */
  recommendationReasoning: string;
  /** Confidence in framing completeness (0-1) per INVARIANT 5 */
  completenessConfidence: number;
  /** Confidence interval bounds per INVARIANT 5 */
  confidenceBounds: { lower: number; upper: number };
  /** Known blind spots the agent cannot address */
  knownBlindSpots: string[];
}

// ==========================================================================
// Agent Manifest
// ==========================================================================

/**
 * Problem Framing agent manifest.
 *
 * CRITICAL:
 * - maxAutonomy: NotAutonomous (PROBLEM_FRAMING is HYBRID_HUMAN_LED per safety matrix)
 * - Human selects and owns the framing; AI offers alternatives
 * - Never makes the framing decision, only provides options
 */
export const PROBLEM_FRAMING_AGENT: AgentManifest = {
  agentId: 'problem-framing',
  name: 'Problem Framing Agent',
  description:
    'Generates alternative problem framings from multiple theoretical perspectives to challenge default mental models',
  phase: AgentPhase.Support,
  capabilities: [AgentCapability.ProblemFraming],
  maxAutonomy: AutonomyLevel.NotAutonomous,
  allowedProposalKinds: [],
  requiresHumanApproval: Object.values(ProposalKind),
  createdAt: new Date(),
  createdBy: 'system',
  active: true,
  character: {
    name: 'Problem Framing Agent',
    bio: [
      'Multi-perspective problem framing specialist',
      'Trained in DIME framework (Diplomatic, Informational, Military, Economic)',
      'Expertise in adversary perspective taking and coalition dynamics',
      'Identifies hidden assumptions in problem statements',
      'Uses historical analogy to surface alternative framings',
    ],
    lore: [
      'Designed to prevent planning tunnel vision',
      'Surfaces alternative framings planners might not consider',
      'Reveals assumptions embedded in default problem statements',
      'Trained on historical case studies of reframing military problems',
      'Supports MDMP Phase 2 (Mission Analysis) problem framing step',
    ],
    knowledge: [
      'DIME: Diplomatic, Informational, Military, Economic instruments of power',
      'PMESII-PT: Political, Military, Economic, Social, Information, Infrastructure, Physical Environment, Time',
      'Historical analogy: Vietnam, Afghanistan, Iraq, Balkans, Korean War case studies',
      'Adversary perspective taking: Red team cognitive models',
      'Coalition dynamics: NATO, Five Eyes, bilateral partnership constraints',
      'Problem framing theory: Kahneman framing effects, Klein sensemaking model',
      'Systems thinking: Feedback loops, second-order effects, leverage points',
    ],
    messageExamples: [],
    postExamples: [],
    topics: [
      'problem framing',
      'alternative perspectives',
      'DIME analysis',
      'adversary red teaming',
      'coalition dynamics',
      'hidden assumptions',
      'historical analogies',
      'systems thinking',
    ],
    style: {
      all: [
        'Present multiple perspectives without advocacy',
        'Surface hidden assumptions explicitly',
        'Use historical analogies when relevant',
        'Acknowledge limits of each framing',
        'Identify contradictions between framings',
        'Highlight blind spots each framing creates',
        'Provide confidence intervals for all assessments',
      ],
      chat: [
        'Structured analysis with clear sections',
        'Bullet points for clarity',
        'Comparative tables for framings',
      ],
      post: [],
    },
    adjectives: [
      'multi-perspective',
      'systematic',
      'assumption-surfacing',
      'devil\'s advocate',
      'historically-informed',
      'systems-aware',
    ],
    plugins: ['problem-framing-tools'],
    settings: {},
  },
};

// ==========================================================================
// LLM Prompts
// ==========================================================================

const SYSTEM_PROMPT = `You are the Problem Framing Agent — a multi-perspective problem framing specialist for military operational planning (MDMP Phase 2 - Mission Analysis).

Your expertise:
${PROBLEM_FRAMING_AGENT.character!.bio.map((b) => `- ${b}`).join('\n')}

Your knowledge base:
${PROBLEM_FRAMING_AGENT.character!.knowledge.map((k) => `- ${k}`).join('\n')}

Style guidelines:
${PROBLEM_FRAMING_AGENT.character!.style.all.map((s) => `- ${s}`).join('\n')}

CRITICAL: You are HYBRID_HUMAN_LED. You offer alternative framings — the human selects and owns the framing. Never advocate for a single framing.`;

function buildUserPrompt(
  situationDescription: string,
  missionStatement: string,
  commanderIntent: string,
  existingAssumptions: string[]
): string {
  return `Analyze this operational situation and generate alternative problem framings from multiple perspectives.

## Situation
${situationDescription || '(not provided)'}

## Mission Statement
${missionStatement || '(not provided)'}

## Commander's Intent / Desired End State
${commanderIntent || '(not provided)'}

## Existing Assumptions
${existingAssumptions.length > 0 ? existingAssumptions.map((a) => `- ${a}`).join('\n') : '(none identified)'}

## Instructions
Generate a comprehensive problem framing analysis with:
1. A "defaultFraming" from the military perspective based on the inputs
2. 3-5 "alternativeFramings" from different perspectives (diplomatic, economic, adversary, informational, social, coalition_partner, local_population, or historical_analogy)
3. 2-3 "framingComparisons" comparing pairs of framings
4. "hiddenAssumptions" in the default framing
5. A recommendation (or null if no single framing is clearly superior)

Each framing must include: perspectiveType, framingStatement, rootCauses[], keyStakeholders[] (with name, interest, influence: high|medium|low), interventionPoints[], assumptions[], blindSpots[], framingConfidence (0-1), confidenceBounds ({lower, upper}).

Respond ONLY with a JSON object matching this exact structure:
{
  "defaultFraming": { ... },
  "alternativeFramings": [ ... ],
  "framingComparisons": [ { "framingA": "label", "framingB": "label", "sharedElements": [], "contradictions": [], "complementaryInsights": [] } ],
  "hiddenAssumptions": [ "..." ],
  "recommendedFramingPerspective": null,
  "recommendationReasoning": "...",
  "completenessConfidence": 0.7,
  "confidenceBounds": { "lower": 0.5, "upper": 0.85 },
  "knownBlindSpots": [ "..." ]
}`;
}

// ==========================================================================
// JSON Parsing Helper
// ==========================================================================

function parseJSONResponse<T>(text: string): T | null {
  let cleaned = text.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    console.error('[problem-framing] Failed to parse LLM JSON response:', cleaned.substring(0, 200));
    return null;
  }
}

// ==========================================================================
// Fallback Stub
// ==========================================================================

function generateFallbackFramings(
  missionStatement: string,
  existingAssumptions: string[]
): ProblemFramingOutput {
  return {
    defaultFraming: {
      perspectiveType: 'military',
      framingStatement: missionStatement || 'Default military framing from mission statement',
      rootCauses: ['Adversary action', 'Regional instability'],
      keyStakeholders: [
        { name: 'Friendly forces', interest: 'Mission success', influence: 'high' },
        { name: 'Adversary', interest: 'Resist friendly objectives', influence: 'high' },
        { name: 'Local population', interest: 'Security and stability', influence: 'medium' },
      ],
      interventionPoints: ['Apply military force', 'Secure key terrain'],
      assumptions: existingAssumptions,
      blindSpots: ['May overlook non-military solutions', 'Assumes military force is primary tool'],
      framingConfidence: 0.6,
      confidenceBounds: { lower: 0.4, upper: 0.8 },
    },
    alternativeFramings: [
      {
        perspectiveType: 'diplomatic',
        framingStatement: 'Problem is fundamentally a failure of negotiation and diplomatic engagement',
        rootCauses: ['Breakdown in dialogue', 'Competing national interests', 'Trust deficit'],
        keyStakeholders: [
          { name: 'National government', interest: 'Sovereignty', influence: 'high' },
          { name: 'Regional powers', interest: 'Sphere of influence', influence: 'high' },
          { name: 'International organizations', interest: 'Stability', influence: 'medium' },
        ],
        interventionPoints: ['Facilitate negotiations', 'Build confidence measures', 'Engage regional mediators'],
        assumptions: ['Parties are willing to negotiate', 'Diplomatic solution exists'],
        blindSpots: ['May underestimate adversary resolve', 'Overlooks military realities'],
        framingConfidence: 0.5,
        confidenceBounds: { lower: 0.3, upper: 0.7 },
      },
      {
        perspectiveType: 'adversary',
        framingStatement: 'From adversary perspective: defending against external intervention and protecting interests',
        rootCauses: ['External threat perception', 'Sovereignty concerns', 'Historical grievances'],
        keyStakeholders: [
          { name: 'Adversary leadership', interest: 'Regime survival', influence: 'high' },
          { name: 'Adversary population', interest: 'National pride', influence: 'medium' },
          { name: 'Regional allies', interest: 'Counter-balance', influence: 'medium' },
        ],
        interventionPoints: ['Reduce threat perception', 'Offer face-saving options', 'Engage regional allies'],
        assumptions: ['Adversary acts rationally from their perspective', 'De-escalation possible'],
        blindSpots: ['May legitimize adversary actions', 'Overlooks moral accountability'],
        framingConfidence: 0.4,
        confidenceBounds: { lower: 0.2, upper: 0.6 },
      },
    ],
    framingComparisons: [
      {
        framingA: 'Military',
        framingB: 'Diplomatic',
        sharedElements: ['Both recognize adversary as key stakeholder', 'Both seek stability'],
        contradictions: ['Military emphasizes force; diplomatic emphasizes dialogue'],
        complementaryInsights: ['Military creates conditions for diplomacy'],
      },
    ],
    hiddenAssumptions: [
      'Military force is the primary instrument',
      'Adversary is irrational or malicious',
      'Non-military solutions are secondary',
    ],
    recommendedFramingPerspective: null,
    recommendationReasoning: 'No single framing is recommended. Human decision-maker should consider multiple perspectives.',
    completenessConfidence: 0.4,
    confidenceBounds: { lower: 0.2, upper: 0.6 },
    knownBlindSpots: [
      'LLM analysis unavailable — using generic fallback framings',
      'Framings are not tailored to the specific scenario context',
    ],
  };
}

// ==========================================================================
// Core Function (LLM-powered with fallback)
// ==========================================================================

/**
 * Generate alternative problem framings from multiple perspectives.
 *
 * Uses LLM with the Problem Framing Agent's character definition to generate
 * context-aware framings. Falls back to generic stub on LLM error.
 *
 * @param situationDescription - Current situation from mission analysis
 * @param missionStatement - Proposed mission statement
 * @param commanderIntent - Commander's stated intent
 * @param existingAssumptions - Assumptions already identified
 * @returns ProblemFramingOutput with default framing + alternatives
 */
export async function generateFramings(
  situationDescription: string,
  missionStatement: string,
  commanderIntent: string,
  existingAssumptions: string[]
): Promise<ProblemFramingOutput> {
  try {
    const llm = await createLLMForAgent({
      agentId: 'problem-framing',
      overrides: { temperature: 0.4, maxTokens: 4096 },
    });

    const userPrompt = buildUserPrompt(situationDescription, missionStatement, commanderIntent, existingAssumptions);

    const response = await llm.invoke([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);

    const text = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const parsed = parseJSONResponse<ProblemFramingOutput>(text);
    if (!parsed || !parsed.defaultFraming || !Array.isArray(parsed.alternativeFramings)) {
      console.warn('[problem-framing] LLM response did not match expected structure, using fallback');
      return generateFallbackFramings(missionStatement, existingAssumptions);
    }

    console.log(`[problem-framing] LLM generated ${parsed.alternativeFramings.length} alternative framings`);
    return parsed;
  } catch (error) {
    console.error('[problem-framing] LLM analysis failed, using fallback:', error);
    return generateFallbackFramings(missionStatement, existingAssumptions);
  }
}
