/**
 * Validation Service
 *
 * Phase 31 Plan 05: API client for validation dashboard endpoints.
 * Follows admin-service.ts pattern with X-DID header and credentials.
 */

// Frontend-side type definitions matching backend validation-types
// (duplicated here to avoid cross-project imports)

export interface ValidationDashboardSummary {
  agentId: string;
  agentName: string;
  agentRole: string;
  overallStatus: 'passing' | 'warning' | 'critical' | 'disabled' | 'unknown';
  categories: Record<
    'determinism' | 'reliability' | 'authority',
    {
      avgScore: number;
      status: 'passing' | 'warning' | 'critical' | 'disabled' | 'unknown';
      trend: number[];
    }
  >;
  lastRunAt: string | null;
  scenarioCount: number;
}

export interface TestRunRow {
  id: string;
  triggered_by: string;
  started_at: string;
  completed_at: string | null;
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
  status: 'passing' | 'warning' | 'critical' | 'disabled' | 'unknown';
  created_at: string;
}

export interface CircuitBreakerEventRow {
  id: string;
  agent_id: string;
  category: string;
  event_type: string;
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
  scope_type: 'global' | 'category' | 'agent' | 'team';
  scope_id: string | null;
  category: string;
  warning_threshold: number;
  critical_threshold: number;
  grace_period_runs: number;
  immediate_disable: boolean;
  updated_by: string;
  updated_at: string;
}

// Use environment variable or empty string for relative URLs (Vite proxy)
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

/**
 * Validation API service class.
 * Provides typed methods for all validation dashboard endpoints.
 */
class ValidationService {
  private userDID: string | null = null;

  /**
   * Set user DID for authorization.
   */
  setUserDID(did: string): void {
    this.userDID = did;
  }

  /**
   * Make authenticated API request with X-DID header.
   */
  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.userDID) {
      (headers as Record<string, string>)['X-DID'] = this.userDID;
    }

    const response = await globalThis.fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Make authenticated request that returns a Blob (for exports).
   */
  private async fetchBlob(path: string): Promise<Blob> {
    const headers: HeadersInit = {};

    if (this.userDID) {
      (headers as Record<string, string>)['X-DID'] = this.userDID;
    }

    const response = await globalThis.fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Export failed: HTTP ${response.status}`);
    }

    return response.blob();
  }

  // --------------------------------------------------------------------------
  // Dashboard
  // --------------------------------------------------------------------------

  async getDashboard(): Promise<ValidationDashboardSummary[]> {
    return this.fetch<ValidationDashboardSummary[]>('/api/validation/dashboard');
  }

  // --------------------------------------------------------------------------
  // Runs
  // --------------------------------------------------------------------------

  async getRecentRuns(limit?: number): Promise<TestRunRow[]> {
    const params = limit ? `?limit=${limit}` : '';
    return this.fetch<TestRunRow[]>(`/api/validation/runs${params}`);
  }

  async getRunDetails(runId: string): Promise<{ run: TestRunRow; results: TestResultRow[] }> {
    return this.fetch<{ run: TestRunRow; results: TestResultRow[] }>(
      `/api/validation/runs/${encodeURIComponent(runId)}`,
    );
  }

  async triggerRun(): Promise<{ runId: string; status: string }> {
    return this.fetch<{ runId: string; status: string }>('/api/validation/runs', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // --------------------------------------------------------------------------
  // Agent Scores
  // --------------------------------------------------------------------------

  async getAgentScores(
    agentId: string,
    category?: string,
    limit?: number,
  ): Promise<ValidationAgentScoreRow[]> {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return this.fetch<ValidationAgentScoreRow[]>(
      `/api/validation/agents/${encodeURIComponent(agentId)}/scores${qs ? `?${qs}` : ''}`,
    );
  }

  // --------------------------------------------------------------------------
  // Circuit Breaker Events
  // --------------------------------------------------------------------------

  async getCircuitEvents(
    agentId: string,
    limit?: number,
  ): Promise<CircuitBreakerEventRow[]> {
    const params = limit ? `?limit=${limit}` : '';
    return this.fetch<CircuitBreakerEventRow[]>(
      `/api/validation/agents/${encodeURIComponent(agentId)}/circuit-events${params}`,
    );
  }

  // --------------------------------------------------------------------------
  // Thresholds
  // --------------------------------------------------------------------------

  async getThresholds(
    scopeType?: string,
    scopeId?: string,
  ): Promise<ThresholdConfigRow[]> {
    const params = new URLSearchParams();
    if (scopeType) params.set('scopeType', scopeType);
    if (scopeId) params.set('scopeId', scopeId);
    const qs = params.toString();
    return this.fetch<ThresholdConfigRow[]>(
      `/api/validation/thresholds${qs ? `?${qs}` : ''}`,
    );
  }

  async updateThreshold(
    data: Omit<ThresholdConfigRow, 'id' | 'updated_at'>,
  ): Promise<ThresholdConfigRow> {
    return this.fetch<ThresholdConfigRow>('/api/validation/thresholds', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // --------------------------------------------------------------------------
  // Reinstate
  // --------------------------------------------------------------------------

  async reinstateAgent(
    agentId: string,
    justification?: string,
  ): Promise<{ reinstated: boolean; reason: string }> {
    return this.fetch<{ reinstated: boolean; reason: string }>(
      `/api/validation/agents/${encodeURIComponent(agentId)}/reinstate`,
      {
        method: 'POST',
        body: JSON.stringify({ justification }),
      },
    );
  }

  // --------------------------------------------------------------------------
  // Export
  // --------------------------------------------------------------------------

  async exportCSV(agentId?: string, from?: string, to?: string): Promise<Blob> {
    const params = new URLSearchParams();
    if (agentId) params.set('agentId', agentId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return this.fetchBlob(`/api/validation/export/csv${qs ? `?${qs}` : ''}`);
  }

  async exportPDF(agentId?: string, from?: string, to?: string): Promise<Blob> {
    const params = new URLSearchParams();
    if (agentId) params.set('agentId', agentId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return this.fetchBlob(`/api/validation/export/pdf${qs ? `?${qs}` : ''}`);
  }
}

export const validationService = new ValidationService();
