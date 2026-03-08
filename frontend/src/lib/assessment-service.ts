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
// AAR / METL Types (training assessment)
// ============================================================================

export type AARStatus = 'draft' | 'in_review' | 'finalized';
export type AARObservationType = 'sustain' | 'improve';
export type METLRating = 'T' | 'P' | 'U';

export interface StructuredAAR {
  id: string;
  problemSetId: string;
  trainingEventName: string;
  initiatedBy: string;
  status: AARStatus;
  whatWasPlanned: string;
  whatHappened: string;
  why: string;
  finalizedAt?: string;
  finalizedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AARObservation {
  id: string;
  aarId: string;
  observationType: AARObservationType;
  content: string;
  metlTaskId?: string;
  suggestedByAi: boolean;
  aiAccepted?: boolean;
  createdBy: string;
  createdAt: string;
}

export type DecayStatus = 'current' | 'warning' | 'expired';

export interface METLTask {
  id: string;
  problemSetId: string;
  sourceProblemSetId?: string;
  taskName: string;
  taskDescription?: string;
  competencyArea?: string;
  isSupplemental: boolean;
  promotedToStrategic: boolean;
  decayDays: number;
  createdAt: string;
}

export interface CreateMETLTaskInput {
  problemSetId: string;
  sourceProblemSetId?: string;
  taskName: string;
  taskDescription?: string;
  competencyArea?: string;
  isSupplemental?: boolean;
  decayDays?: number;
}

export interface METLProficiencySummary {
  metlTaskId: string;
  taskName: string;
  competencyArea?: string;
  decayDays: number;
  rating?: METLRating;
  assessedAt?: string;
  assessedBy?: string;
  commanderOverride?: boolean;
  decayStatus: DecayStatus;
}

export interface DecayReportEntry {
  metlTaskId: string;
  taskName: string;
  rating?: METLRating;
  decayStatus: DecayStatus;
  daysRemaining: number;
}

export interface METLAssessment {
  id: string;
  metlTaskId: string;
  aarId?: string;
  rating: METLRating;
  notes?: string;
  assessedBy: string;
  commanderOverride: boolean;
  createdAt: string;
}

export interface CreateMETLAssessmentInput {
  metlTaskId: string;
  aarId?: string;
  rating: METLRating;
  notes?: string;
  assessedBy: string;
  commanderOverride?: boolean;
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

  // ─── AAR Methods ──────────────────────────────────────────────────────────

  async listAARs(problemSetId: string): Promise<StructuredAAR[]> {
    return this.request<StructuredAAR[]>(
      `/api/assessment/aars/problem-set/${encodeURIComponent(problemSetId)}`
    );
  }

  async createAAR(input: {
    problemSetId: string;
    trainingEventName: string;
    initiatedBy: string;
  }): Promise<StructuredAAR> {
    return this.request<StructuredAAR>('/api/assessment/aars', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getAAR(id: string): Promise<StructuredAAR> {
    return this.request<StructuredAAR>(
      `/api/assessment/aars/${encodeURIComponent(id)}`
    );
  }

  async updateAAR(
    id: string,
    input: { whatWasPlanned?: string; whatHappened?: string; why?: string; status?: AARStatus }
  ): Promise<StructuredAAR> {
    return this.request<StructuredAAR>(
      `/api/assessment/aars/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      }
    );
  }

  async finalizeAAR(id: string, finalizedBy: string): Promise<StructuredAAR> {
    return this.request<StructuredAAR>(
      `/api/assessment/aars/${encodeURIComponent(id)}/finalize`,
      {
        method: 'POST',
        body: JSON.stringify({ finalizedBy }),
      }
    );
  }

  async listAARObservations(aarId: string): Promise<AARObservation[]> {
    return this.request<AARObservation[]>(
      `/api/assessment/aars/${encodeURIComponent(aarId)}/observations`
    );
  }

  async addAARObservation(
    aarId: string,
    input: {
      observationType: AARObservationType;
      content: string;
      metlTaskId?: string;
      suggestedByAi?: boolean;
      createdBy: string;
    }
  ): Promise<AARObservation> {
    return this.request<AARObservation>(
      `/api/assessment/aars/${encodeURIComponent(aarId)}/observations`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  }

  async updateAARObservation(
    id: string,
    input: { aiAccepted?: boolean; content?: string }
  ): Promise<AARObservation> {
    return this.request<AARObservation>(
      `/api/assessment/observations/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      }
    );
  }

  // ─── METL Methods ─────────────────────────────────────────────────────────

  async listMETLTasks(problemSetId: string): Promise<METLTask[]> {
    return this.request<METLTask[]>(
      `/api/assessment/metl/tasks/problem-set/${encodeURIComponent(problemSetId)}`
    );
  }

  async createMETLTask(input: CreateMETLTaskInput): Promise<METLTask> {
    return this.request<METLTask>('/api/assessment/metl/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async promoteMETLTask(taskId: string): Promise<METLTask> {
    return this.request<METLTask>(
      `/api/assessment/metl/tasks/${encodeURIComponent(taskId)}/promote`,
      { method: 'POST' }
    );
  }

  async getInheritedMETLTasks(
    problemSetId: string,
    sourceProblemSetId: string
  ): Promise<METLTask[]> {
    return this.request<METLTask[]>(
      `/api/assessment/metl/tasks/inherited/${encodeURIComponent(problemSetId)}/${encodeURIComponent(sourceProblemSetId)}`
    );
  }

  async getLatestProficiency(
    sourceProblemSetId: string
  ): Promise<{ proficiency: METLProficiencySummary[]; decayReport: DecayReportEntry[] }> {
    return this.request<{ proficiency: METLProficiencySummary[]; decayReport: DecayReportEntry[] }>(
      `/api/assessment/metl/proficiency/${encodeURIComponent(sourceProblemSetId)}`
    );
  }

  async getAssessmentHistory(metlTaskId: string): Promise<METLAssessment[]> {
    return this.request<METLAssessment[]>(
      `/api/assessment/metl/history/${encodeURIComponent(metlTaskId)}`
    );
  }

  async createMETLAssessment(input: CreateMETLAssessmentInput): Promise<METLAssessment> {
    return this.request<METLAssessment>('/api/assessment/metl/assessments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getAssessmentsByAAR(aarId: string): Promise<METLAssessment[]> {
    return this.request<METLAssessment[]>(
      `/api/assessment/metl/assessments/aar/${encodeURIComponent(aarId)}`
    );
  }
}

/** Singleton assessment service instance */
export const assessmentService = new AssessmentService();
