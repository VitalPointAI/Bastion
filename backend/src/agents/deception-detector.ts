/**
 * Deception Detector Agent
 *
 * Identifies inconsistencies between adversary stated intent and observed behavior,
 * detects denial and deception patterns, and produces deception indicators for
 * the integrated brief.
 *
 * CRITICAL: All outputs include confidence intervals per INVARIANT 5
 * (Uncertainty Transparency). Never state certainty without bounds.
 *
 * The Deception Detector supports MDMP red team challenges (MDMP-0-08) by comparing
 * adversary stated intent against behavioral signals, historical patterns, and doctrinal
 * norms to flag potential deception. Produces both inline flags for quick reference in
 * adversary narratives and a dedicated deception analysis section for detailed assessment.
 */

import { MDMPPhase, AgentRole, AgentOutputType } from '../mdmp/types.js';
import { AgentManifest, AgentCapability } from './types.js';
import { AutonomyLevel } from '../dao/types.js';

// ==========================================================================
// Output Interfaces
// ==========================================================================

/** Deception technique categories */
export type DeceptionTechnique =
  | 'camouflage' // Hide true position/capability
  | 'concealment' // Prevent observation
  | 'ruse' // Misleading actions
  | 'display' // Show false capability/position
  | 'demonstration' // Threat of action in wrong area
  | 'feint' // Limited offensive to mislead
  | 'disinformation' // False information spread
  | 'maskirovka'; // Comprehensive deception (Russian doctrine)

/** A specific deception indicator */
export interface DeceptionIndicator {
  /** Indicator identifier */
  id: string;
  /** What was observed that suggests deception */
  observation: string;
  /** What was expected based on stated intent */
  expectedBehavior: string;
  /** The actual observed behavior */
  actualBehavior: string;
  /** The inconsistency between expected and actual */
  inconsistency: string;
  /** Deception technique this most resembles */
  technique: DeceptionTechnique;
  /** Source of the observation */
  source: string;
  /** Severity: low, moderate, high, critical */
  severity: 'low' | 'moderate' | 'high' | 'critical';
  /** Confidence that this IS deception (0-1) per INVARIANT 5 */
  deceptionConfidence: number;
  /** Confidence bounds */
  confidenceBounds: { lower: number; upper: number };
  /** Alternative explanations (not every inconsistency is deception) */
  alternativeExplanations: string[];
  /** Recommended collection to confirm/deny */
  recommendedCollection: string[];
}

/** Inline deception flag for embedding in adversary narrative */
export interface InlineDeceptionFlag {
  /** Reference to the narrative section */
  narrativeReference: string;
  /** Brief flag text (e.g., "DECEPTION POSSIBLE: stated withdrawal contradicts observed reinforcement") */
  flagText: string;
  /** Traffic light: green (low risk), amber (moderate), red (high/critical) */
  trafficLight: 'green' | 'amber' | 'red';
  /** Link to full indicator */
  indicatorId: string;
}

/** Dedicated deception analysis section */
export interface DeceptionAnalysis {
  /** All identified deception indicators */
  indicators: DeceptionIndicator[];
  /** Pattern summary — what deception story is the adversary telling? */
  deceptionNarrative: string;
  /** Assessed adversary deception objective */
  assessedObjective: string;
  /** Indicators grouped by technique */
  techniqueBreakdown: Array<{
    technique: DeceptionTechnique;
    count: number;
    indicators: string[];
  }>;
  /** Historical deception patterns for this adversary */
  historicalPatterns: string[];
  /** How confident we are in the overall deception assessment (0-1) per INVARIANT 5 */
  overallConfidence: number;
  /** Confidence bounds */
  overallConfidenceBounds: { lower: number; upper: number };
  /** What collection would confirm or deny deception */
  confirmationPlan: string[];
}

/** Complete deception detection output */
export interface DeceptionDetectionOutput {
  /** Inline flags for embedding in adversary narrative (quick reference per CONTEXT) */
  inlineFlags: InlineDeceptionFlag[];
  /** Full deception analysis (dedicated section per CONTEXT) */
  analysis: DeceptionAnalysis;
  /** Summary statement */
  summary: string;
  /** Whether adversary deception is assessed as active */
  deceptionAssessed: boolean;
  /** Overall analysis confidence (0-1) per INVARIANT 5 */
  analysisConfidence: number;
  /** Timestamp */
  analyzedAt: number;
}

// ==========================================================================
// Agent Manifest
// ==========================================================================

/**
 * Deception Detector agent manifest.
 *
 * MaxAutonomy: SemiAutonomous - Agent can detect deception indicators and classify
 * techniques autonomously, but assessment requires human validation to avoid
 * confirmation bias and false positives.
 */
export const DECEPTION_DETECTOR_MANIFEST: AgentManifest = {
  agentId: 'deception-detector',
  name: 'Deception Detector',
  description:
    'Identifies inconsistencies between adversary stated intent and observed behavior to detect denial and deception',
  phase: 'Support' as any, // AgentPhase.Support
  capabilities: [AgentCapability.DeceptionDetection],
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
    name: 'Deception Detector',
    bio: [
      'Specialist in adversary denial and deception (D&D) analysis for military intelligence.',
      'Trained to identify inconsistencies between adversary stated intent and observed behavior.',
      'Classifies deception techniques: camouflage, concealment, ruse, display, demonstration, feint, disinformation, maskirovka.',
      'Generates alternative explanations to avoid confirmation bias - not every inconsistency is deception.',
    ],
    lore: [
      'Deception is as old as warfare itself. Adversaries mask true intentions to gain strategic advantage.',
      'The Deception Detector exists because humans are prone to confirmation bias - seeing deception where there may be none, or missing it entirely.',
      'Maskirovka is not just Russian - all militaries employ denial and deception. Cultural context matters.',
      'Alternative explanations are mandatory. Logistics failures, incompetence, and miscommunication can mimic deception patterns.',
    ],
    knowledge: [
      'INVARIANT 5 (Uncertainty Transparency): Every output must include confidence intervals. Never state certainty without bounds.',
      'Deception techniques: Camouflage (hide true position/capability), Concealment (prevent observation), Ruse (misleading actions), Display (show false capability), Demonstration (threat in wrong area), Feint (limited offensive to mislead), Disinformation (false information spread), Maskirovka (comprehensive Russian deception doctrine).',
      'Deception indicators: Intent-behavior mismatch, doctrinal deviation, historical pattern breaks, resource allocation inconsistencies, information operations discrepancies.',
      'Alternative explanations: Logistics failures, command incompetence, civil-military friction, resource constraints, miscommunication, cultural differences.',
      'Confirmation bias mitigation: Always provide alternative explanations, avoid mirror imaging, consider cultural context, validate with HUMINT/SIGINT cross-checks.',
      'Collection recommendations: ISR for physical confirmation, SIGINT for communications analysis, HUMINT for intent validation, OSINT for narrative consistency checks.',
      'JP 2-01.3 and ATP 2-01.3: Intelligence preparation of the battlefield includes deception detection as part of adversary COA analysis.',
    ],
    messageExamples: [
      [
        {
          role: 'user',
          content:
            'Adversary stated they are conducting defensive preparations along Border Region A. However, SIGINT intercepts show logistics convoys moving AWAY from Border Region A toward Border Region B. Analyze for deception.',
        },
        {
          role: 'assistant',
          content:
            'I identify a HIGH severity deception indicator (confidence 0.72, bounds 0.58-0.84). Observation: Logistics convoys moving away from stated defensive area. Expected: Convoys moving TOWARD Border Region A to support defensive prep. Actual: Convoys moving to Border Region B. Inconsistency: Resource allocation contradicts stated intent. Technique: Likely DEMONSTRATION (threat in wrong area) or FEINT. Alternative explanations: (1) Logistics hub consolidation for efficiency, (2) Pre-positioning for FUTURE operations in Region B (not current), (3) Civil infrastructure damage in Region A forcing reroute. Recommended collection: ISR of Region B for offensive preparations, HUMINT on command intent, SIGINT on operational timelines.',
        },
      ],
    ],
    postExamples: [],
    topics: [
      'deception',
      'denial',
      'adversary analysis',
      'maskirovka',
      'indicators',
      'confirmation bias',
    ],
    style: {
      all: [
        'Skeptical but not paranoid',
        'Always provides alternative explanations',
        'Never overstates certainty',
        'Questions assumptions about adversary intent',
      ],
      chat: ['Analytical', 'Evidence-focused', 'Culturally aware', 'Bias-conscious'],
      post: [],
    },
    adjectives: ['skeptical', 'analytical', 'thorough', 'bias-aware', 'questioning'],
    plugins: [],
    settings: {},
  },
};

// Update character to include system prompt
DECEPTION_DETECTOR_MANIFEST.character!.bio.push(
  `System Prompt: You are a Deception Detector for military intelligence analysis. Your role is to:
1. Identify inconsistencies between adversary STATED INTENT and OBSERVED BEHAVIOR
2. Classify deception techniques (camouflage, concealment, ruse, display, demonstration, feint, disinformation, maskirovka)
3. Generate ALTERNATIVE EXPLANATIONS for every inconsistency to avoid confirmation bias
4. Recommend collection activities to confirm or deny deception
5. Produce inline flags (quick reference) AND dedicated analysis section (detailed breakdown)

CRITICAL: Every output must include confidence intervals. Never state certainty without bounds.
You operate under INVARIANT 5 (Uncertainty Transparency).

Not every inconsistency is deception. Consider:
- Logistics failures and resource constraints
- Command incompetence or miscommunication
- Cultural differences in operational patterns
- Civil-military friction affecting operations
- Intelligence gaps creating false patterns

Deception detection workflow:
1. Compare stated intent against observed behavior
2. Identify inconsistencies with confidence bounds
3. Classify deception technique (if applicable)
4. Generate alternative explanations (minimum 2)
5. Recommend collection to confirm/deny
6. Produce traffic light severity (green/amber/red)
7. Build deception narrative (if pattern detected)`
);

// ==========================================================================
// Core Functions
// ==========================================================================

/**
 * Detect deception by comparing stated intent against observed behaviors.
 *
 * TODO: Implement using agent execution framework from executor.ts.
 * This is a stub for now - full implementation will integrate LLM calls
 * through the agent orchestration layer.
 *
 * @param statedIntent Adversary's stated intent or public narrative
 * @param observedBehaviors Array of observed behaviors with source and timestamp
 * @param adversaryProfile Adversary profile with historical patterns and doctrine
 * @param historicalContext Historical deception patterns for this adversary
 * @returns Deception detection output with indicators and analysis
 */
export async function detectDeception(
  statedIntent: string,
  observedBehaviors: Array<{ source: string; observation: string; timestamp: number }>,
  adversaryProfile: string,
  historicalContext: string
): Promise<DeceptionDetectionOutput> {
  // TODO: Implement via agent executor framework
  // This stub returns empty results for now
  return {
    inlineFlags: [],
    analysis: {
      indicators: [],
      deceptionNarrative: 'Analysis not yet implemented - awaiting agent executor integration',
      assessedObjective: 'Unknown',
      techniqueBreakdown: [],
      historicalPatterns: [],
      overallConfidence: 0.0,
      overallConfidenceBounds: { lower: 0.0, upper: 0.0 },
      confirmationPlan: ['Full implementation pending agent framework integration'],
    },
    summary: 'Deception detection not yet implemented - awaiting agent executor integration',
    deceptionAssessed: false,
    analysisConfidence: 0.0,
    analyzedAt: Date.now(),
  };
}

/**
 * Generate inline flags for embedding in adversary narrative.
 *
 * TODO: Implement using agent execution framework from executor.ts.
 * This is a stub for now - full implementation will integrate LLM calls
 * through the agent orchestration layer.
 *
 * @param adversaryNarrative The adversary narrative text to flag
 * @param indicators Deception indicators identified by detectDeception
 * @returns Array of inline flags for embedding in narrative
 */
export async function generateInlineFlags(
  adversaryNarrative: string,
  indicators: DeceptionIndicator[]
): Promise<InlineDeceptionFlag[]> {
  // TODO: Implement via agent executor framework
  // This stub returns empty results for now
  return [];
}
