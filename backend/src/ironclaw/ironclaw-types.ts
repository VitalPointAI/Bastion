/**
 * Ironclaw Integration Types
 *
 * Phase 30 Plan 01: Type definitions for the Ironclaw agent integration.
 * Covers chat messages, action system, risk classification, trust preferences,
 * action logging, audit anchors, sessions, and rate limits.
 *
 * Uses const objects (not enums) per project erasableSyntaxOnly convention.
 */

// ---------------------------------------------------------------------------
// Action Risk Classification
// ---------------------------------------------------------------------------

export const ActionRiskLevel = {
  low: 'low',
  medium: 'medium',
  high: 'high',
} as const;
export type ActionRiskLevel = (typeof ActionRiskLevel)[keyof typeof ActionRiskLevel];

/**
 * Maps action type strings to their risk level.
 * Used by the trust/approval system to determine whether user confirmation
 * is required before executing an action.
 */
export const ACTION_RISK: Record<string, ActionRiskLevel> = {
  'ps.read': ActionRiskLevel.low,
  'ps.list_children': ActionRiskLevel.low,
  'ps.update_field': ActionRiskLevel.medium,
  'ps.create_child': ActionRiskLevel.medium,
  'ps.configure_agents': ActionRiskLevel.medium,
  'resource.create': ActionRiskLevel.medium,
  'resource.update': ActionRiskLevel.medium,
  'resource.delete': ActionRiskLevel.high,
  'code.create_pr': ActionRiskLevel.high,
  'code.emergency_deploy': ActionRiskLevel.high,
  'system.update_config': ActionRiskLevel.high,
  'gate.create': ActionRiskLevel.medium,
} as const;

// ---------------------------------------------------------------------------
// Step Progress (embedded in chat messages)
// ---------------------------------------------------------------------------

export interface StepInfo {
  label: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  started_at: string | null;
  completed_at: string | null;
}

export interface StepProgressData {
  action_id: string;
  steps: StepInfo[];
  current_step: number;
  started_at: string;
}

// ---------------------------------------------------------------------------
// Action Card (embedded in chat messages)
// ---------------------------------------------------------------------------

export interface ActionCardData {
  action_id: string;
  action_type: string;
  description: string;
  risk_level: ActionRiskLevel;
  options: ('yes' | 'no' | 'always')[];
}

// ---------------------------------------------------------------------------
// Chat Message
// ---------------------------------------------------------------------------

export interface IronclawChatMessage {
  id: string;
  problem_set_id: string;
  content: string;
  sender: 'user' | 'ironclaw' | 'specialist';
  specialist_id: string | null;
  specialist_display_name: string | null;
  /** Always 'ironclaw' for specialist messages */
  delegated_by: string | null;
  action_card: ActionCardData | null;
  step_progress: StepProgressData | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Action System
// ---------------------------------------------------------------------------

export interface IronclawAction {
  id: string;
  /** Action type key e.g. 'ps.read', 'code.create_pr' */
  type: string;
  description: string;
  payload: Record<string, unknown>;
  problem_set_id: string;
  /** User DID who requested the action */
  requested_by: string;
}

// ---------------------------------------------------------------------------
// Trust Preferences
// ---------------------------------------------------------------------------

export type TrustDecision = 'yes' | 'no' | 'always';

export interface TrustPreference {
  id: string;
  user_did: string;
  problem_set_id: string;
  action_type: string;
  granted_at: string;
}

// ---------------------------------------------------------------------------
// Action Log
// ---------------------------------------------------------------------------

export interface ActionLogEntry {
  id: string;
  problem_set_id: string;
  user_did: string;
  action_type: string;
  action_payload: Record<string, unknown>;
  risk_level: ActionRiskLevel;
  decision: 'approved' | 'denied' | 'auto_approved' | 'gate_pending';
  gate_id: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  emergency: boolean;
  justification: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Audit Anchors (blockchain anchoring)
// ---------------------------------------------------------------------------

export interface AuditAnchor {
  id: string;
  batch_start: string;
  batch_end: string;
  action_count: number;
  merkle_root: string;
  tx_hash: string | null;
  anchored_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface IronclawSession {
  id: string;
  problem_set_id: string;
  user_did: string;
  /** Ironclaw's internal session ID */
  ironclaw_session_id: string | null;
  created_at: string;
  last_active_at: string;
}

// ---------------------------------------------------------------------------
// Rate Limits
// ---------------------------------------------------------------------------

export const RATE_LIMITS = {
  low: { max: 60, window_seconds: 60 },
  medium: { max: 10, window_seconds: 60 },
  high: { max: 3, window_seconds: 60 },
  code_pr: { max: 5, window_seconds: 3600 },
} as const;
