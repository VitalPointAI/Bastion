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
  'ps.configure_agents': ActionRiskLevel.high,
  'resource.create': ActionRiskLevel.medium,
  'resource.update': ActionRiskLevel.medium,
  'resource.delete': ActionRiskLevel.high,
  'code.create_pr': ActionRiskLevel.high,
  'code.emergency_deploy': ActionRiskLevel.high,
  'system.update_config': ActionRiskLevel.high,
  'gate.create': ActionRiskLevel.medium,
  // Discovery actions
  'discovery.scan_network': ActionRiskLevel.medium,
  'discovery.onboard_device': ActionRiskLevel.medium,
  'discovery.emergency_disconnect': ActionRiskLevel.high,
  'discovery.modify_access_list': ActionRiskLevel.high,
  // Agent/team delegation actions
  'agent.list_active': ActionRiskLevel.low,
  'agent.get_status': ActionRiskLevel.low,
  'agent.assign_to_problem_set': ActionRiskLevel.medium,
  'agent.unassign_from_problem_set': ActionRiskLevel.low,
  'agent.form_team_for_task': ActionRiskLevel.medium,
  // Agent/tool/team CRUD — Ironclaw can build and configure agents
  'agent.create': ActionRiskLevel.medium,
  'agent.update': ActionRiskLevel.medium,
  'agent.delete': ActionRiskLevel.high,
  'agent.activate': ActionRiskLevel.medium,
  'agent.deactivate': ActionRiskLevel.medium,
  'tool.create': ActionRiskLevel.medium,
  'tool.update': ActionRiskLevel.medium,
  'tool.delete': ActionRiskLevel.high,
  'tool.assign_to_agent': ActionRiskLevel.medium,
  'team.create': ActionRiskLevel.medium,
  'team.update': ActionRiskLevel.medium,
  'team.delete': ActionRiskLevel.high,
  'team.add_member': ActionRiskLevel.medium,
  'team.remove_member': ActionRiskLevel.medium,
  // Skill CRUD — Ironclaw can create and assign agent skills
  'skill.create': ActionRiskLevel.medium,
  'skill.update': ActionRiskLevel.medium,
  'skill.delete': ActionRiskLevel.high,
  'skill.assign': ActionRiskLevel.low,
  'skill.unassign': ActionRiskLevel.low,
  // Field write-back — Ironclaw can suggest and apply field values
  'field.write': ActionRiskLevel.medium,
  'field.write_sensitive': ActionRiskLevel.high,
} as const;

// ---------------------------------------------------------------------------
// Agent Self-Governance Protection
// ---------------------------------------------------------------------------

/**
 * Config keys that Ironclaw is NEVER permitted to modify, regardless of
 * risk level, gate approval, or emergency mode. These govern the agent's
 * own authority boundaries and must only be changed by direct human action
 * outside the Ironclaw pipeline.
 */
export const PROTECTED_CONFIG_KEYS = new Set([
  // Agent authority & autonomy
  'ironclaw.risk_levels',
  'ironclaw.rate_limits',
  'ironclaw.trust_settings',
  'ironclaw.autonomy_level',
  'ironclaw.authority_delegation',
  'ironclaw.allowed_actions',
  'ironclaw.blocked_actions',
  'ironclaw.emergency_mode',
  // Gate & confirmation system
  'gates.enforcement_policy',
  'gates.auto_approve',
  'gates.bypass_rules',
  // Agent configuration
  'agents.risk_classification',
  'agents.rate_limits',
  'agents.permissions',
  'agents.ironclaw',
  // Discovery interface restrictions
  'discovery.interface_restrictions',
  'discovery.disabled_interfaces',
  'discovery.scanner_permissions',
  'discovery.blocklist_global',
]) as ReadonlySet<string>;

/**
 * Action types that constitute self-modification — the agent attempting to
 * change its own governance parameters. These are unconditionally blocked
 * in the action pipeline regardless of risk level or trust.
 */
export const SELF_GOVERNANCE_ACTIONS = new Set([
  'bastion.system.update_config',       // Can target protected keys
  'bastion.problem_set.configure_agents', // Can reconfigure Ironclaw itself
]) as ReadonlySet<string>;

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
// Suggestion Payload (field write-back)
// ---------------------------------------------------------------------------

export interface SuggestionPayload {
  id: string;
  content: string;
  agent_id: string;
  agent_display_name: string;
  target_field: string | null;
  target_field_label: string | null;
  field_value: string | null;
  /** Present on high-risk fields to indicate Decision Gate is required */
  risk?: 'high';
}

/**
 * Fields that require an explicit Decision Gate approval before write-back.
 * These govern commander intent / rules of engagement — high governance impact.
 */
export const SENSITIVE_FIELDS = new Set([
  'missionStatement',
  'commandersIntent',
  'ruleOfEngagement',
]) as ReadonlySet<string>;

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
  suggestion: SuggestionPayload | null;
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

/** Default trust preference TTL: 30 days in milliseconds. */
export const TRUST_TTL_DAYS = 30;

export interface TrustPreference {
  id: string;
  user_did: string;
  problem_set_id: string;
  action_type: string;
  granted_at: string;
  expires_at: string;
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
