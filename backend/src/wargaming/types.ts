/**
 * Wargaming Framework Types
 *
 * Defines the data model for action-reaction-counteraction wargaming simulation.
 * Supports configurable cycle depth, interactive mode, and complete audit trails.
 */

/** Wargaming session configuration */
export interface WargamingConfig {
  /** Maximum number of action-reaction-counteraction cycles */
  cycleDepth: number;
  /** Whether to run automated scenarios before interactive mode */
  autoRunFirst: boolean;
  /** COA IDs to wargame */
  coaIds: string[];
  /** Adversary COA IDs to test against */
  adversaryCoaIds: string[];
  /** Mission context identifier */
  missionId: string;
  /** Plan identifier */
  planId: string;
}

/** Who is making a move */
export type MoveActor = 'friendly' | 'adversary' | 'environment';

/** A single move in the wargaming sequence */
export interface WargamingMove {
  /** Unique move identifier */
  id: string;
  /** Which cycle this move belongs to (1-based) */
  cycle: number;
  /** Move sequence within cycle: action=1, reaction=2, counteraction=3 */
  sequenceInCycle: 1 | 2 | 3;
  /** Who is making this move */
  actor: MoveActor;
  /** Description of the action taken */
  action: string;
  /** Reasoning behind the action */
  reasoning: string;
  /** Domain(s) of the action (DIME) */
  domains: string[];
  /** Resources committed */
  resourcesCommitted: string[];
  /** Expected outcome */
  expectedOutcome: string;
  /** Actual simulated outcome (after resolution) */
  simulatedOutcome?: string;
  /** Whether this move was AI-generated or human-specified */
  source: 'ai_automated' | 'commander_interactive';
  /** Effect cascade results for this move */
  effectCascade?: unknown; // EffectCascadeOutput from effect-cascader
  /** Escalation assessment for this move */
  escalationAssessment?: unknown; // EscalationRiskAssessment from escalation-modeler
  /** Timestamp */
  timestamp: number;
}

/** A complete action-reaction-counteraction cycle */
export interface WargamingCycle {
  /** Cycle number (1-based) */
  cycleNumber: number;
  /** Friendly action */
  action: WargamingMove;
  /** Adversary reaction */
  reaction: WargamingMove;
  /** Friendly counteraction */
  counteraction: WargamingMove;
  /** Cycle summary */
  cycleSummary: string;
  /** Decision points extracted from this cycle */
  decisionPoints: Array<{
    description: string;
    trigger: string;
    options: string[];
  }>;
  /** Running force ratio after this cycle */
  forceRatioAfter?: { friendly: number; adversary: number };
}

/** Session state */
export type SessionState = 'configuring' | 'auto_running' | 'interactive' | 'paused' | 'completed';

/** What-if adjustment parameters */
export interface WhatIfAdjustment {
  /** What parameter is being changed */
  parameterType: 'friendly_action' | 'adversary_response' | 'force_ratio' | 'environment' | 'escalation_posture';
  /** Description of the adjustment */
  description: string;
  /** Original value */
  originalValue: string;
  /** New value */
  newValue: string;
  /** Which cycle to apply from */
  appliedFromCycle: number;
}

/** Complete wargaming session */
export interface WargamingSession {
  /** Session identifier */
  id: string;
  /** Session configuration */
  config: WargamingConfig;
  /** Current session state */
  state: SessionState;
  /** Completed cycles */
  cycles: WargamingCycle[];
  /** Current cycle in progress */
  currentCycle: number;
  /** All moves in chronological order (flat view of cycles) */
  moveLog: WargamingMove[];
  /** What-if adjustments applied during interactive mode */
  whatIfAdjustments: WhatIfAdjustment[];
  /** Decision points extracted across all cycles */
  allDecisionPoints: Array<{
    cycleNumber: number;
    description: string;
    trigger: string;
    options: string[];
  }>;
  /** Session-level outcomes */
  outcomes?: {
    /** Overall assessment */
    assessment: string;
    /** COA strengths revealed */
    strengths: string[];
    /** COA weaknesses revealed */
    weaknesses: string[];
    /** Critical decision points */
    criticalDecisionPoints: string[];
    /** Recommended modifications to COA */
    coaModifications: string[];
  };
  /** Created timestamp */
  createdAt: number;
  /** Last updated timestamp */
  updatedAt: number;
  /** Created by (user DID) */
  createdBy: string;
}
