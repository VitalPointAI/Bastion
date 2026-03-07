/**
 * Validation Framework Type System
 *
 * Phase 31 Plan 01: All domain types for the AI agent validation and
 * compliance testing framework. Uses const objects (not enums) per project
 * erasableSyntaxOnly convention.
 */

// ---------------------------------------------------------------------------
// Const-object enumerations
// ---------------------------------------------------------------------------

export const ValidationCategory = {
  determinism: 'determinism',
  reliability: 'reliability',
  authority: 'authority',
} as const;
export type ValidationCategory =
  (typeof ValidationCategory)[keyof typeof ValidationCategory];

export const ValidationStatus = {
  passing: 'passing',
  warning: 'warning',
  critical: 'critical',
  disabled: 'disabled',
  unknown: 'unknown',
} as const;
export type ValidationStatus =
  (typeof ValidationStatus)[keyof typeof ValidationStatus];

export const CircuitState = {
  closed: 'closed',
  warning: 'warning',
  open: 'open',
} as const;
export type CircuitState = (typeof CircuitState)[keyof typeof CircuitState];

export const ScoringMethod = {
  structured_diff: 'structured_diff',
  semantic_similarity: 'semantic_similarity',
  both: 'both',
} as const;
export type ScoringMethod = (typeof ScoringMethod)[keyof typeof ScoringMethod];

export const AttackType = {
  privilege_escalation: 'privilege_escalation',
  scope_creep: 'scope_creep',
  unauthorized_action: 'unauthorized_action',
} as const;
export type AttackType = (typeof AttackType)[keyof typeof AttackType];

export const ExpectedBehavior = {
  refuse: 'refuse',
  escalate: 'escalate',
  scope_limit: 'scope_limit',
} as const;
export type ExpectedBehavior =
  (typeof ExpectedBehavior)[keyof typeof ExpectedBehavior];

export const TriggerType = {
  scheduled: 'scheduled',
  manual: 'manual',
} as const;
export type TriggerType = (typeof TriggerType)[keyof typeof TriggerType];

export const CircuitEventType = {
  disabled: 'disabled',
  reinstated: 'reinstated',
  override: 'override',
  warning: 'warning',
  fallback_activated: 'fallback_activated',
} as const;
export type CircuitEventType =
  (typeof CircuitEventType)[keyof typeof CircuitEventType];

export const ThresholdScope = {
  global: 'global',
  category: 'category',
  agent: 'agent',
  team: 'team',
} as const;
export type ThresholdScope =
  (typeof ThresholdScope)[keyof typeof ThresholdScope];

// ---------------------------------------------------------------------------
// Domain interfaces — fixtures and scenarios
// ---------------------------------------------------------------------------

export interface TestScenario {
  id: string;
  name: string;
  category: ValidationCategory;
  input: {
    messages: Array<{ role: string; content: string }>;
    context?: Record<string, unknown>;
  };
  expected: {
    structuredOutput?: Record<string, unknown>;
    freeTextReference?: string;
    requiredCitations?: string[];
    requiredTerminology?: string[];
    forbiddenActions?: string[];
    maxAutonomyLevel?: string;
  };
  scoringMethod: ScoringMethod;
  weight: number; // 0-1
}

export interface AdversarialScenario {
  id: string;
  name: string;
  attackType: AttackType;
  input: {
    messages: Array<{ role: string; content: string }>;
  };
  expectedBehavior: ExpectedBehavior;
}

export interface TestFixture {
  agentId: string;
  agentRole: string;
  version: string;
  lastReviewedAt: string; // ISO 8601
  scenarios: TestScenario[];
  adversarialScenarios: AdversarialScenario[];
  runCount: number; // configurable repeats for determinism
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Evaluation results
// ---------------------------------------------------------------------------

export interface AssertionResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export interface EvaluationResult {
  functionalScore: number; // 0-1
  llmJudgeScore: number; // 0-1
  combinedScore: number; // 0-1
  disagreement: boolean;
  functionalDetails: AssertionResult[];
  llmJudgeRationale: string;
}

// ---------------------------------------------------------------------------
// Database row types
// ---------------------------------------------------------------------------

export interface TestRunRow {
  id: string; // uuid
  triggered_by: string;
  started_at: string; // ISO 8601
  completed_at: string | null; // ISO 8601
  total_agents: number;
  total_scenarios: number;
  status: 'running' | 'completed' | 'failed';
}

export interface TestResultRow {
  id: string;
  run_id: string;
  agent_id: string;
  scenario_id: string;
  category: string;
  functional_score: number | null;
  llm_judge_score: number | null;
  combined_score: number | null;
  disagreement: boolean;
  input_snapshot: Record<string, unknown>;
  output_snapshot: Record<string, unknown>;
  expected_snapshot: Record<string, unknown>;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface ValidationAgentScoreRow {
  id: string;
  run_id: string;
  agent_id: string;
  category: string;
  avg_score: number;
  min_score: number;
  max_score: number;
  scenario_count: number;
  status: ValidationStatus;
  created_at: string;
}

export interface CircuitBreakerEventRow {
  id: string;
  agent_id: string;
  category: string;
  event_type: CircuitEventType;
  previous_state: string;
  new_state: string;
  triggered_by: string;
  justification: string | null;
  run_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface ThresholdConfigRow {
  id: string;
  scope_type: ThresholdScope;
  scope_id: string | null;
  category: string;
  warning_threshold: number;
  critical_threshold: number;
  grace_period_runs: number;
  immediate_disable: boolean;
  updated_by: string;
  updated_at: string;
}

export interface EvaluatorDriftRow {
  id: string;
  run_id: string;
  calibration_scenario_id: string;
  expected_score: number;
  actual_score: number;
  drift_magnitude: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Dashboard summary (aggregate view)
// ---------------------------------------------------------------------------

export interface ValidationDashboardSummary {
  agentId: string;
  agentName: string;
  agentRole: string;
  overallStatus: ValidationStatus;
  categories: Record<
    ValidationCategory,
    {
      avgScore: number;
      status: ValidationStatus;
      trend: number[]; // recent scores for sparkline
    }
  >;
  lastRunAt: string | null; // ISO 8601
  scenarioCount: number;
}
