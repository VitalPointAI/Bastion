/**
 * Gate Service Module
 *
 * Client for Decision Gate API endpoints.
 * Provides typed methods for gate lifecycle operations.
 *
 * NOTE: Types are mirrored from backend/src/gates/gate-types.ts.
 * The backend is authoritative -- if backend schema changes, update here to match.
 */

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ============================================================================
// Gate Const Objects (mirror backend gate-types.ts)
// ============================================================================

export const GateType = {
  objective_approval: 'objective_approval',
  operational_approach: 'operational_approach',
  coa_selection: 'coa_selection',
  order_release: 'order_release',
  reframing: 'reframing',
} as const;

export const GateTab = {
  understand: 'understand',
  design: 'design',
  plan: 'plan',
  direct: 'direct',
  assess: 'assess',
} as const;

export const GateEnforcement = {
  hard_block: 'hard_block',
  soft_warning: 'soft_warning',
} as const;

export const GateStatus = {
  pending: 'pending',
  submitted: 'submitted',
  approved: 'approved',
  rejected: 'rejected',
  escalated: 'escalated',
  overridden: 'overridden',
} as const;

export const TimeoutBehavior = {
  auto_escalate: 'auto_escalate',
  auto_approve: 'auto_approve',
  block: 'block',
} as const;

// ============================================================================
// Interfaces (mirror backend gate-types.ts)
// ============================================================================

export interface DecisionGate {
  id: string;
  problem_set_id: string;
  gate_type: string;
  tab: string;
  target_item_id: string | null;
  target_item_type: string | null;
  target_item_title: string | null;
  enforcement: string;
  status: string;
  proposal_id: number | null;
  deadline_at: string | null;
  timeout_behavior: string;
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

export interface GateProposalContext {
  title: string;
  description: string;
  metadata: Record<string, unknown>;
}

export interface GatePermissions {
  canApprove: boolean;
  canReject: boolean;
  canOverride: boolean;
  canEscalate: boolean;
  canConfigure: boolean;
}

export interface HierarchyGatesResult {
  ownGates: DecisionGate[];
  childGates: DecisionGate[];
}

export interface CreateGateParams {
  problem_set_id: string;
  gate_type: string;
  tab: string;
  target_item_id?: string;
  target_item_type?: string;
  target_item_title?: string;
  enforcement?: string;
  deadline_at?: string;
  timeout_behavior?: string;
  mode: 'training' | 'operational';
  training_config?: Record<string, unknown>;
}

// ============================================================================
// Fetch Helper (follows mdmp-service.ts pattern)
// ============================================================================

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Gate API Functions
// ============================================================================

/** Fetch all gates for a problem set */
async function fetchGatesForProblemSet(problemSetId: string): Promise<DecisionGate[]> {
  return fetchJson<DecisionGate[]>(
    `${API_BASE}/api/gates/${encodeURIComponent(problemSetId)}`
  );
}

/** Fetch gates filtered by tab */
async function fetchGatesByTab(problemSetId: string, tab: string): Promise<DecisionGate[]> {
  return fetchJson<DecisionGate[]>(
    `${API_BASE}/api/gates/${encodeURIComponent(problemSetId)}/${encodeURIComponent(tab)}`
  );
}

/** Submit a gate for approval */
async function submitGateForApproval(
  gateId: string,
  submittedBy: string,
  context: GateProposalContext
): Promise<DecisionGate> {
  return fetchJson<DecisionGate>(
    `${API_BASE}/api/gates/${encodeURIComponent(gateId)}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({ submitted_by: submittedBy, context }),
    }
  );
}

/** Approve a gate */
async function approveGate(gateId: string, decidedBy: string): Promise<DecisionGate> {
  return fetchJson<DecisionGate>(
    `${API_BASE}/api/gates/${encodeURIComponent(gateId)}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ decided_by: decidedBy }),
    }
  );
}

/** Reject a gate */
async function rejectGate(gateId: string, decidedBy: string, reason: string): Promise<DecisionGate> {
  return fetchJson<DecisionGate>(
    `${API_BASE}/api/gates/${encodeURIComponent(gateId)}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ decided_by: decidedBy, reason }),
    }
  );
}

/** Override a gate (commander bypass) */
async function overrideGate(gateId: string, overriddenBy: string, justification: string): Promise<DecisionGate> {
  return fetchJson<DecisionGate>(
    `${API_BASE}/api/gates/${encodeURIComponent(gateId)}/override`,
    {
      method: 'POST',
      body: JSON.stringify({ overridden_by: overriddenBy, justification }),
    }
  );
}

/** Escalate a gate to parent echelon */
async function escalateGate(gateId: string, escalatedBy: string, reason: string): Promise<DecisionGate> {
  return fetchJson<DecisionGate>(
    `${API_BASE}/api/gates/${encodeURIComponent(gateId)}/escalate`,
    {
      method: 'POST',
      body: JSON.stringify({ escalated_by: escalatedBy, reason }),
    }
  );
}

/** Create a new decision gate */
async function createGate(params: CreateGateParams): Promise<DecisionGate> {
  return fetchJson<DecisionGate>(
    `${API_BASE}/api/gates`,
    {
      method: 'POST',
      body: JSON.stringify(params),
    }
  );
}

/** Update gate configuration */
async function updateGateConfig(
  gateId: string,
  config: { enforcement?: string; deadlineAt?: string; timeoutBehavior?: string }
): Promise<DecisionGate> {
  return fetchJson<DecisionGate>(
    `${API_BASE}/api/gates/${encodeURIComponent(gateId)}/config`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        enforcement: config.enforcement,
        deadline_at: config.deadlineAt,
        timeout_behavior: config.timeoutBehavior,
      }),
    }
  );
}

/** Fetch escalated gates for a parent problem set */
async function fetchEscalatedGates(parentProblemSetId: string): Promise<DecisionGate[]> {
  return fetchJson<DecisionGate[]>(
    `${API_BASE}/api/gates/${encodeURIComponent(parentProblemSetId)}/escalated`
  );
}

/** Fetch own gates + child gates for hierarchical visibility */
async function fetchHierarchyGates(problemSetId: string): Promise<HierarchyGatesResult> {
  return fetchJson<HierarchyGatesResult>(
    `${API_BASE}/api/gates/${encodeURIComponent(problemSetId)}/hierarchy`
  );
}

/** Fetch gate permissions for a specific role */
async function fetchGatePermissions(gateId: string, userRole: string): Promise<GatePermissions> {
  return fetchJson<GatePermissions>(
    `${API_BASE}/api/gates/${encodeURIComponent(gateId)}/permissions/${encodeURIComponent(userRole)}`
  );
}

// ============================================================================
// Singleton Export
// ============================================================================

export const gateService = {
  fetchGatesForProblemSet,
  fetchGatesByTab,
  submitGateForApproval,
  approveGate,
  rejectGate,
  overrideGate,
  escalateGate,
  createGate,
  updateGateConfig,
  fetchEscalatedGates,
  fetchHierarchyGates,
  fetchGatePermissions,
};
