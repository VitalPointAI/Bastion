/**
 * decision-service.ts
 *
 * API client for the decisions endpoint (Phase 53 Plan 04 backend).
 *
 * Endpoints:
 *   GET  /api/decisions/:psId              → Decision[]
 *   GET  /api/decisions/:psId/pending/:pos → Decision[]
 *   GET  /api/decisions/:psId/summary      → DecisionSummary
 *   POST /api/decisions/:psId              → Decision
 *   PATCH /api/decisions/:psId/:id         → Decision
 *   GET  /api/decisions/:psId/raci         → RACIAssignment[]
 *   PUT  /api/decisions/:psId/raci         → RACIAssignment
 */

const API = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Decision {
  id: string;
  problem_set_id: string;
  title: string;
  description?: string;
  decision_type: string;
  status: 'pending' | 'approved' | 'rejected' | 'deferred' | 'info_requested';
  requested_by?: string;
  decided_by?: string;
  decided_at?: string;
  context?: Record<string, unknown>;
  comment?: string;
  created_at: string;
  updated_at: string;
}

export interface DecisionSummary {
  pending: number;
  approved: number;
  rejected: number;
  deferred: number;
  info_requested: number;
  recent: Decision[];
}

export interface RACIAssignment {
  id: string;
  problem_set_id: string;
  decision_type: string;
  position: string;
  raci_role: 'R' | 'A' | 'C' | 'I';
  created_at: string;
  updated_at: string;
}

export interface CreateDecisionParams {
  title: string;
  description?: string;
  decision_type: string;
  context?: Record<string, unknown>;
}

export interface ActOnDecisionParams {
  action: 'approve' | 'reject' | 'defer' | 'info';
  comment?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiRequest<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API}${url}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Decision API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const decisionApiService = {
  /**
   * Get all decisions for a problem set, with optional filters.
   */
  async getDecisions(
    psId: string,
    filters?: { status?: string; decision_type?: string },
  ): Promise<Decision[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.decision_type) params.set('decision_type', filters.decision_type);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<Decision[]>(`/api/decisions/${psId}${qs}`);
  },

  /**
   * Get pending decisions for a specific position (RACI-filtered).
   */
  async getPendingForPosition(psId: string, position: string): Promise<Decision[]> {
    return apiRequest<Decision[]>(`/api/decisions/${psId}/pending/${position}`);
  },

  /**
   * Get summary counts (pending, approved, rejected, deferred, info_requested).
   */
  async getSummary(psId: string): Promise<DecisionSummary> {
    return apiRequest<DecisionSummary>(`/api/decisions/${psId}/summary`);
  },

  /**
   * Create a new decision record.
   */
  async createDecision(psId: string, params: CreateDecisionParams): Promise<Decision> {
    return apiRequest<Decision>(`/api/decisions/${psId}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  /**
   * Act on a decision: approve, reject, defer, or request more info.
   */
  async actOnDecision(
    psId: string,
    decisionId: string,
    params: ActOnDecisionParams,
  ): Promise<Decision> {
    return apiRequest<Decision>(`/api/decisions/${psId}/${decisionId}`, {
      method: 'PATCH',
      body: JSON.stringify(params),
    });
  },

  /**
   * Get the RACI matrix for a problem set.
   */
  async getRACIMatrix(psId: string): Promise<RACIAssignment[]> {
    return apiRequest<RACIAssignment[]>(`/api/decisions/${psId}/raci`);
  },

  /**
   * Update a RACI assignment.
   */
  async updateRACIAssignment(
    psId: string,
    params: { decision_type: string; position: string; raci_role: string },
  ): Promise<RACIAssignment> {
    return apiRequest<RACIAssignment>(`/api/decisions/${psId}/raci`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  },
};
