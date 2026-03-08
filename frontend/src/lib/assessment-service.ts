/**
 * Assessment Service
 *
 * Phase 37 Plan 03: Frontend API client for assessment MOE/MOP tracking.
 * Mirrors backend assessment routes with typed request/response.
 */

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ============================================================================
// Types (mirrored from backend assessment/types.ts)
// ============================================================================

export type AssessmentStatusValue = 'green' | 'yellow' | 'red';
export type AssessmentTrendValue = 'improving' | 'stable' | 'declining';
export type AssessmentObservationSource = 'manual' | 'ai_suggestion' | 'osint';
export type AssessmentObservationTargetType = 'moe' | 'mop';

export interface AssessmentMOE {
  id: string;
  problemSetId: string;
  objectiveId?: string;
  objectiveSnapshot: string;
  name: string;
  description?: string;
  status: AssessmentStatusValue;
  trend: AssessmentTrendValue;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMOEInput {
  problemSetId: string;
  objectiveId?: string;
  objectiveSnapshot: string;
  name: string;
  description?: string;
  createdBy: string;
}

export interface AssessmentMOP {
  id: string;
  problemSetId: string;
  taskId?: string;
  taskSnapshot: string;
  name: string;
  description?: string;
  standard?: string;
  status: AssessmentStatusValue;
  trend: AssessmentTrendValue;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMOPInput {
  problemSetId: string;
  taskId?: string;
  taskSnapshot: string;
  name: string;
  description?: string;
  standard?: string;
  createdBy: string;
}

export interface AssessmentObservation {
  id: string;
  targetType: AssessmentObservationTargetType;
  targetId: string;
  content: string;
  source: AssessmentObservationSource;
  statusUpdate?: AssessmentStatusValue;
  trendUpdate?: AssessmentTrendValue;
  approvedBy?: string;
  approvedAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface CreateAssessmentObservationInput {
  targetType: AssessmentObservationTargetType;
  targetId: string;
  content: string;
  source?: AssessmentObservationSource;
  statusUpdate?: AssessmentStatusValue;
  trendUpdate?: AssessmentTrendValue;
  createdBy: string;
}

export interface ReframingTriggerResult {
  shouldTrigger: boolean;
  decliningMOEs: number;
  redMOPs: number;
}

// ============================================================================
// Service Class
// ============================================================================

class AssessmentService {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string> | undefined),
      },
      ...options,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Assessment API error ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  // ─── MOE Methods ──────────────────────────────────────────────────────────

  async listMOEs(problemSetId: string): Promise<AssessmentMOE[]> {
    return this.request<AssessmentMOE[]>(
      `/api/assessment/moes?problemSetId=${encodeURIComponent(problemSetId)}`
    );
  }

  async createMOE(input: CreateMOEInput): Promise<AssessmentMOE> {
    return this.request<AssessmentMOE>('/api/assessment/moes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateMOEStatus(
    id: string,
    status: AssessmentStatusValue,
    trend: AssessmentTrendValue
  ): Promise<AssessmentMOE> {
    return this.request<AssessmentMOE>(`/api/assessment/moes/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, trend }),
    });
  }

  async listMOEObservations(moeId: string): Promise<AssessmentObservation[]> {
    return this.request<AssessmentObservation[]>(
      `/api/assessment/moes/${encodeURIComponent(moeId)}/observations`
    );
  }

  async addMOEObservation(
    moeId: string,
    input: CreateAssessmentObservationInput
  ): Promise<AssessmentObservation> {
    return this.request<AssessmentObservation>(
      `/api/assessment/moes/${encodeURIComponent(moeId)}/observations`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  }

  async approveMOEObservation(
    id: string,
    approvedBy: string
  ): Promise<AssessmentObservation> {
    return this.request<AssessmentObservation>(
      `/api/assessment/observations/${encodeURIComponent(id)}/approve`,
      {
        method: 'PUT',
        body: JSON.stringify({ approvedBy }),
      }
    );
  }

  // ─── MOP Methods ──────────────────────────────────────────────────────────

  async listMOPs(problemSetId: string): Promise<AssessmentMOP[]> {
    return this.request<AssessmentMOP[]>(
      `/api/assessment/mops?problemSetId=${encodeURIComponent(problemSetId)}`
    );
  }

  async createMOP(input: CreateMOPInput): Promise<AssessmentMOP> {
    return this.request<AssessmentMOP>('/api/assessment/mops', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateMOPStatus(
    id: string,
    status: AssessmentStatusValue,
    trend: AssessmentTrendValue
  ): Promise<AssessmentMOP> {
    return this.request<AssessmentMOP>(`/api/assessment/mops/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, trend }),
    });
  }

  async listMOPObservations(mopId: string): Promise<AssessmentObservation[]> {
    return this.request<AssessmentObservation[]>(
      `/api/assessment/mops/${encodeURIComponent(mopId)}/observations`
    );
  }

  async addMOPObservation(
    mopId: string,
    input: CreateAssessmentObservationInput
  ): Promise<AssessmentObservation> {
    return this.request<AssessmentObservation>(
      `/api/assessment/mops/${encodeURIComponent(mopId)}/observations`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  }

  async approveMOPObservation(
    id: string,
    approvedBy: string
  ): Promise<AssessmentObservation> {
    return this.request<AssessmentObservation>(
      `/api/assessment/observations/${encodeURIComponent(id)}/approve`,
      {
        method: 'PUT',
        body: JSON.stringify({ approvedBy }),
      }
    );
  }

  // ─── Reframing Trigger ────────────────────────────────────────────────────

  async checkReframingTrigger(problemSetId: string): Promise<ReframingTriggerResult> {
    return this.request<ReframingTriggerResult>(
      `/api/assessment/reframing-trigger?problemSetId=${encodeURIComponent(problemSetId)}`
    );
  }
}

/** Singleton assessment service instance */
export const assessmentService = new AssessmentService();
