/**
 * Decision & RACI Type Definitions
 *
 * Phase 53 Plan 02: Core types for RACI matrix and decision pipeline.
 * RACI is a first-class standalone artifact per JP 5-0 doctrine.
 *
 * Uses string literals (not enums) per project convention (erasableSyntaxOnly).
 */

// ---------------------------------------------------------------------------
// RACI Role
// ---------------------------------------------------------------------------

export type RACIRole = 'R' | 'A' | 'C' | 'I';

// ---------------------------------------------------------------------------
// RACI Assignment — one row in the raci_assignments table
// ---------------------------------------------------------------------------

export interface RACIAssignment {
  id: string;
  problem_set_id: string;
  decision_type: string;
  position: string; // 'commander' | 'xo' | 'j2' | 'j3' | 'j4' | 'j5' | 'j6' | 's2' | 's3' | 's4' | etc.
  raci_role: RACIRole;
  /** If non-null, this is a delegation — original position delegated to delegated_to */
  delegated_to: string | null;      // DID of person delegated to
  delegated_by: string | null;      // DID of person who delegated
  delegation_reason: string | null; // why delegated
  delegation_type: 'permanent' | 'temporary' | null;
  delegation_expires_at: string | null; // null = permanent
  version: number;                  // incremented on each change for audit
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// RACI Delegation — audit log row in raci_delegations table
// ---------------------------------------------------------------------------

export interface RACIDelegation {
  id: string;
  raci_assignment_id: string;
  from_did: string;
  to_did: string;
  reason: string;
  delegation_type: 'permanent' | 'temporary';
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

// ---------------------------------------------------------------------------
// Decision Status
// ---------------------------------------------------------------------------

export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'deferred' | 'info_requested';

// ---------------------------------------------------------------------------
// Decision — one row in the decisions table
// ---------------------------------------------------------------------------

export interface Decision {
  id: string;
  problem_set_id: string;
  decision_type: string;
  title: string;
  description: string;
  context_json: Record<string, unknown>; // structured context for the decision
  status: DecisionStatus;
  decided_by: string | null;      // DID of the person who decided
  decided_at: string | null;
  requested_by: string | null;    // DID of requester (Ironclaw or user)
  dao_proposal_id: number | null; // linked DAO proposal once created
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Echelon — military echelon level
// ---------------------------------------------------------------------------

export type Echelon = 'strategic' | 'operational' | 'tactical';

// ---------------------------------------------------------------------------
// RACI Default — one entry in a doctrinal defaults array
// ---------------------------------------------------------------------------

export interface RACIDefault {
  decision_type: string;
  position: string;
  raci_role: RACIRole;
}

// ---------------------------------------------------------------------------
// Decision Type Constants — military decision categories per JP 5-0
// ---------------------------------------------------------------------------

export const DECISION_TYPES = {
  mission_approval: 'mission_approval',
  roe_change: 'roe_change',
  force_allocation: 'force_allocation',
  staff_coordination: 'staff_coordination',
  internal_ops: 'internal_ops',
  intel_assessment: 'intel_assessment',
  threat_analysis: 'threat_analysis',
  coa_development: 'coa_development',
  scheme_of_maneuver: 'scheme_of_maneuver',
  fires_allocation: 'fires_allocation',
  sustainment_plan: 'sustainment_plan',
  logistics_support: 'logistics_support',
  force_projection: 'force_projection',
  campaign_plan: 'campaign_plan',
  phase_transition: 'phase_transition',
  strategic_design: 'strategic_design',
  c4isr_architecture: 'c4isr_architecture',
  network_change: 'network_change',
  order_release: 'order_release',
  design_revision: 'design_revision',
  escalation: 'escalation',
} as const;

export type DecisionType = (typeof DECISION_TYPES)[keyof typeof DECISION_TYPES];
