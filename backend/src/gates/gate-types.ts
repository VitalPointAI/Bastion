/**
 * Decision Gate Type Definitions
 *
 * Phase 28 Plan 01: Core type system for embedded DAO governance gates.
 * Uses const objects (not enums) per project convention (erasableSyntaxOnly).
 */

// ---------------------------------------------------------------------------
// Gate Type — maps to doctrinal decision points
// ---------------------------------------------------------------------------

export const GateType = {
  objective_approval: 'objective_approval',
  operational_approach: 'operational_approach',
  coa_selection: 'coa_selection',
  order_release: 'order_release',
  reframing: 'reframing',
  device_onboard: 'device_onboard',
  device_allowlist: 'device_allowlist',
} as const;

export type GateType = (typeof GateType)[keyof typeof GateType];

// ---------------------------------------------------------------------------
// Gate Tab — which tab a gate appears on
// ---------------------------------------------------------------------------

export const GateTab = {
  understand: 'understand',
  design: 'design',
  plan: 'plan',
  direct: 'direct',
  assess: 'assess',
} as const;

export type GateTab = (typeof GateTab)[keyof typeof GateTab];

// ---------------------------------------------------------------------------
// Gate Enforcement Mode
// ---------------------------------------------------------------------------

export const GateEnforcement = {
  hard_block: 'hard_block',
  soft_warning: 'soft_warning',
} as const;

export type GateEnforcement = (typeof GateEnforcement)[keyof typeof GateEnforcement];

// ---------------------------------------------------------------------------
// Gate Status — lifecycle states
// ---------------------------------------------------------------------------

export const GateStatus = {
  pending: 'pending',
  submitted: 'submitted',
  approved: 'approved',
  rejected: 'rejected',
  escalated: 'escalated',
  overridden: 'overridden',
} as const;

export type GateStatus = (typeof GateStatus)[keyof typeof GateStatus];

// ---------------------------------------------------------------------------
// Timeout Behavior — what happens when a gate deadline passes
// ---------------------------------------------------------------------------

export const TimeoutBehavior = {
  auto_escalate: 'auto_escalate',
  auto_approve: 'auto_approve',
  block: 'block',
} as const;

export type TimeoutBehavior = (typeof TimeoutBehavior)[keyof typeof TimeoutBehavior];

// ---------------------------------------------------------------------------
// Core Interfaces
// ---------------------------------------------------------------------------

export interface DecisionGate {
  id: string;
  problem_set_id: string;
  gate_type: GateType;
  tab: GateTab;
  target_item_id: string;
  target_item_type: string;
  target_item_title: string;
  enforcement: GateEnforcement;
  status: GateStatus;
  proposal_id: string | null;
  deadline_at: string | null;
  timeout_behavior: TimeoutBehavior;
  submitted_by: string | null;
  submitted_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_context: Record<string, unknown>;
  mode: 'training' | 'operational';
  training_config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGateParams {
  problem_set_id: string;
  gate_type: GateType;
  tab?: GateTab;
  target_item_id: string;
  target_item_type: string;
  target_item_title: string;
  enforcement?: GateEnforcement;
  deadline_at?: string | null;
  timeout_behavior?: TimeoutBehavior;
  mode?: 'training' | 'operational';
  training_config?: Record<string, unknown> | null;
}

export interface UpdateGateParams {
  enforcement?: GateEnforcement;
  status?: GateStatus;
  deadline_at?: string | null;
  timeout_behavior?: TimeoutBehavior;
  submitted_by?: string | null;
  submitted_at?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  decision_context?: Record<string, unknown>;
  proposal_id?: string | null;
}

export interface GateProposalContext {
  title: string;
  description: string;
  metadata: Record<string, unknown>;
}

export interface GateFilter {
  problem_set_id: string;
  tab?: GateTab;
  status?: GateStatus;
  gate_type?: GateType;
}

// ---------------------------------------------------------------------------
// Defaults — maps each GateType to its default enforcement and tab
// ---------------------------------------------------------------------------

export const GATE_DEFAULTS: Record<GateType, { enforcement: GateEnforcement; tab: GateTab }> = {
  [GateType.objective_approval]: { enforcement: GateEnforcement.hard_block, tab: GateTab.understand },
  [GateType.operational_approach]: { enforcement: GateEnforcement.hard_block, tab: GateTab.design },
  [GateType.coa_selection]: { enforcement: GateEnforcement.hard_block, tab: GateTab.plan },
  [GateType.order_release]: { enforcement: GateEnforcement.hard_block, tab: GateTab.direct },
  [GateType.reframing]: { enforcement: GateEnforcement.soft_warning, tab: GateTab.assess },
  [GateType.device_onboard]: { enforcement: GateEnforcement.hard_block, tab: GateTab.direct },
  [GateType.device_allowlist]: { enforcement: GateEnforcement.hard_block, tab: GateTab.direct },
};
