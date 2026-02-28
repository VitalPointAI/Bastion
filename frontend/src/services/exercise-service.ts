/**
 * Exercise Service
 *
 * Phase 14 Plan 06: Typed API client for all exercise backend endpoints.
 * Covers scenario CRUD, document upload, IPB assembly/versioning,
 * COA lifecycle, order generation, planning board, and gate management.
 *
 * All requests go to /api/exercise/* — protected by the information
 * barrier middleware (withExerciseBarrier) on the backend.
 */

import type {
  ExerciseScenario,
  ScenarioDocument,
  IPBAssessment,
  ScenarioCOA,
  ExerciseCOAScore,
  ExerciseOrder,
  PlanningTask,
  ExerciseGate,
  BoardSummary,
  COAComparisonResult,
  SITREPDeltaPreview,
  CreateScenarioInput,
  CreateCOAInput,
  GenerateOrderInput,
  CreateDraftInput,
  CreateGateInput,
} from '../types/exercise';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const API_BASE = '/api/exercise';

/**
 * Perform a fetch with JSON error handling.
 * Throws an Error with the server's error message on non-2xx responses.
 */
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  // 204 No Content — return undefined cast to T
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json();
}

/**
 * Perform a multipart/form-data upload.
 * Does NOT set Content-Type header — browser sets it with the correct boundary.
 */
async function fetchFormData<T>(url: string, body: FormData, method = 'POST'): Promise<T> {
  const response = await fetch(url, { method, body });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ─── Exercise Service ──────────────────────────────────────────────────────────

export const exerciseService = {
  // ─── Scenarios ──────────────────────────────────────────────────────────────

  /**
   * Create a new exercise scenario.
   */
  createScenario(data: CreateScenarioInput): Promise<ExerciseScenario> {
    return fetchJson<ExerciseScenario>(`${API_BASE}/scenarios`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * List all exercise scenarios visible to the current user.
   */
  getScenarios(): Promise<ExerciseScenario[]> {
    return fetchJson<ExerciseScenario[]>(`${API_BASE}/scenarios`);
  },

  /**
   * Get a single exercise scenario by ID.
   */
  getScenario(id: string): Promise<ExerciseScenario> {
    return fetchJson<ExerciseScenario>(`${API_BASE}/scenarios/${encodeURIComponent(id)}`);
  },

  /**
   * Update an exercise scenario (partial updates supported).
   */
  updateScenario(id: string, data: Partial<ExerciseScenario>): Promise<ExerciseScenario> {
    return fetchJson<ExerciseScenario>(`${API_BASE}/scenarios/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Advance the scenario to the next exercise phase.
   */
  advancePhase(id: string): Promise<ExerciseScenario> {
    return fetchJson<ExerciseScenario>(`${API_BASE}/scenarios/${encodeURIComponent(id)}/advance-phase`, {
      method: 'POST',
    });
  },

  /**
   * Delete a scenario and all associated data.
   */
  deleteScenario(id: string): Promise<void> {
    return fetchJson<void>(`${API_BASE}/scenarios/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // ─── Documents ──────────────────────────────────────────────────────────────

  /**
   * Upload a package of multiple files to a scenario.
   *
   * Uses FormData with a 'files' array. The relative path (webkitRelativePath)
   * is included so the backend can infer team/phase/type tags from the path.
   *
   * The backend returns 202 and queues async LLM extraction — documents will
   * initially have empty extractedData and low extractionConfidence.
   */
  uploadPackage(scenarioId: string, files: File[]): Promise<ScenarioDocument[]> {
    const form = new FormData();
    for (const file of files) {
      // Use relative path if available (folder upload via webkitdirectory),
      // fall back to filename for standard multi-file input
      const path = file.webkitRelativePath || file.name;
      form.append('files', file, path);
    }
    return fetchFormData<ScenarioDocument[]>(
      `${API_BASE}/scenarios/${encodeURIComponent(scenarioId)}/documents/upload`,
      form
    );
  },

  /**
   * List documents for a scenario, optionally filtered by phase or type.
   */
  getDocuments(
    scenarioId: string,
    filters?: { phase?: string; type?: string }
  ): Promise<ScenarioDocument[]> {
    const params = new URLSearchParams();
    if (filters?.phase) params.set('phase', filters.phase);
    if (filters?.type) params.set('type', filters.type);
    const qs = params.toString();
    return fetchJson<ScenarioDocument[]>(
      `${API_BASE}/scenarios/${encodeURIComponent(scenarioId)}/documents${qs ? `?${qs}` : ''}`
    );
  },

  /**
   * Get a single document by ID.
   */
  getDocument(docId: string): Promise<ScenarioDocument> {
    return fetchJson<ScenarioDocument>(`${API_BASE}/documents/${encodeURIComponent(docId)}`);
  },

  // ─── IPB ────────────────────────────────────────────────────────────────────

  /**
   * Trigger LLM-assisted IPB assembly for a team/perspective/phase.
   * Reads documents with matching team+phase tags and synthesizes the IPB.
   */
  assembleIPB(
    scenarioId: string,
    data: { team: string; perspective: string; exercisePhase: string }
  ): Promise<IPBAssessment> {
    return fetchJson<IPBAssessment>(
      `${API_BASE}/scenarios/${encodeURIComponent(scenarioId)}/ipb/assemble`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * List IPB assessments for a scenario, optionally filtered.
   */
  getIPBAssessments(
    scenarioId: string,
    filters?: { team?: string; perspective?: string; phase?: string }
  ): Promise<IPBAssessment[]> {
    const params = new URLSearchParams();
    if (filters?.team) params.set('team', filters.team);
    if (filters?.perspective) params.set('perspective', filters.perspective);
    if (filters?.phase) params.set('phase', filters.phase);
    const qs = params.toString();
    return fetchJson<IPBAssessment[]>(
      `${API_BASE}/scenarios/${encodeURIComponent(scenarioId)}/ipb${qs ? `?${qs}` : ''}`
    );
  },

  /**
   * Get a single IPB assessment by ID.
   */
  getIPBAssessment(assessmentId: string): Promise<IPBAssessment> {
    return fetchJson<IPBAssessment>(`${API_BASE}/ipb/${encodeURIComponent(assessmentId)}`);
  },

  /**
   * Get the version history of an IPB assessment (chain of parent versions).
   */
  getIPBHistory(assessmentId: string): Promise<IPBAssessment[]> {
    return fetchJson<IPBAssessment[]>(
      `${API_BASE}/ipb/${encodeURIComponent(assessmentId)}/history`
    );
  },

  /**
   * Preview the delta that would result from incorporating a SITREP document
   * into an existing IPB assessment — does NOT commit any changes.
   *
   * Staff reviews the SITREPDeltaPreview before calling updateIPBFromSITREP
   * to confirm which fields to update (see Plan 14-07 for the UI).
   */
  previewIPBFromSITREP(assessmentId: string, sitrepDocId: string): Promise<SITREPDeltaPreview> {
    return fetchJson<SITREPDeltaPreview>(
      `${API_BASE}/ipb/${encodeURIComponent(assessmentId)}/sitrep-preview`,
      {
        method: 'POST',
        body: JSON.stringify({ sitrepDocId }),
      }
    );
  },

  /**
   * Apply a SITREP delta to an existing IPB assessment, creating a new version.
   * Should be called only after staff reviews and confirms the delta via previewIPBFromSITREP.
   */
  updateIPBFromSITREP(assessmentId: string, sitrepDocId: string): Promise<IPBAssessment> {
    return fetchJson<IPBAssessment>(
      `${API_BASE}/ipb/${encodeURIComponent(assessmentId)}/sitrep-update`,
      {
        method: 'POST',
        body: JSON.stringify({ sitrepDocId }),
      }
    );
  },

  // ─── COAs ───────────────────────────────────────────────────────────────────

  /**
   * Create a new Course of Action for a scenario.
   */
  createCOA(scenarioId: string, data: CreateCOAInput): Promise<ScenarioCOA> {
    return fetchJson<ScenarioCOA>(
      `${API_BASE}/scenarios/${encodeURIComponent(scenarioId)}/coas`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * List COAs for a scenario, optionally filtered by team or phase.
   */
  getCOAs(
    scenarioId: string,
    filters?: { team?: string; phase?: string }
  ): Promise<ScenarioCOA[]> {
    const params = new URLSearchParams();
    if (filters?.team) params.set('team', filters.team);
    if (filters?.phase) params.set('phase', filters.phase);
    const qs = params.toString();
    return fetchJson<ScenarioCOA[]>(
      `${API_BASE}/scenarios/${encodeURIComponent(scenarioId)}/coas${qs ? `?${qs}` : ''}`
    );
  },

  /**
   * Get a single COA by ID.
   */
  getCOA(coaId: string): Promise<ScenarioCOA> {
    return fetchJson<ScenarioCOA>(`${API_BASE}/coas/${encodeURIComponent(coaId)}`);
  },

  /**
   * Run LLM-assisted FASDC scoring on a COA.
   */
  scoreCOA(coaId: string): Promise<ExerciseCOAScore> {
    return fetchJson<ExerciseCOAScore>(
      `${API_BASE}/coas/${encodeURIComponent(coaId)}/score`,
      { method: 'POST' }
    );
  },

  /**
   * Integrate wargaming outcomes into a COA's evidence record.
   */
  integrateWargame(
    coaId: string,
    data: { wargameSessionId: string; outcomes: unknown }
  ): Promise<void> {
    return fetchJson<void>(
      `${API_BASE}/coas/${encodeURIComponent(coaId)}/wargame`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * Update the staff-edited narrative on a COA.
   */
  updateNarrative(coaId: string, narrative: string): Promise<void> {
    return fetchJson<void>(
      `${API_BASE}/coas/${encodeURIComponent(coaId)}/narrative`,
      {
        method: 'PATCH',
        body: JSON.stringify({ narrative }),
      }
    );
  },

  /**
   * Compare multiple COAs using LLM-assisted analysis.
   */
  compareCOAs(coaIds: string[]): Promise<COAComparisonResult> {
    return fetchJson<COAComparisonResult>(`${API_BASE}/coas/compare`, {
      method: 'POST',
      body: JSON.stringify({ coaIds }),
    });
  },

  /**
   * Record a commander's decision on a COA and anchor it on the blockchain.
   * Returns the SHA-256 hash of the decision record.
   */
  recordDecision(
    coaId: string,
    decision: string,
    notes: string
  ): Promise<{ hash: string }> {
    return fetchJson<{ hash: string }>(
      `${API_BASE}/coas/${encodeURIComponent(coaId)}/decision`,
      {
        method: 'POST',
        body: JSON.stringify({ decision, notes }),
      }
    );
  },

  // ─── Orders ─────────────────────────────────────────────────────────────────

  /**
   * Generate an order (WARNORD/OPORD/FRAGO) using LLM assistance.
   */
  generateOrder(scenarioId: string, data: GenerateOrderInput): Promise<ExerciseOrder> {
    return fetchJson<ExerciseOrder>(
      `${API_BASE}/scenarios/${encodeURIComponent(scenarioId)}/orders/generate`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * Create a draft order from manually-entered content (no LLM).
   */
  createDraftOrder(scenarioId: string, data: CreateDraftInput): Promise<ExerciseOrder> {
    return fetchJson<ExerciseOrder>(
      `${API_BASE}/scenarios/${encodeURIComponent(scenarioId)}/orders`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * List orders for a scenario, optionally filtered by team, phase, or type.
   */
  getOrders(
    scenarioId: string,
    filters?: { team?: string; phase?: string; type?: string }
  ): Promise<ExerciseOrder[]> {
    const params = new URLSearchParams();
    if (filters?.team) params.set('team', filters.team);
    if (filters?.phase) params.set('phase', filters.phase);
    if (filters?.type) params.set('type', filters.type);
    const qs = params.toString();
    return fetchJson<ExerciseOrder[]>(
      `${API_BASE}/scenarios/${encodeURIComponent(scenarioId)}/orders${qs ? `?${qs}` : ''}`
    );
  },

  /**
   * Get a single order by ID.
   */
  getOrder(orderId: string): Promise<ExerciseOrder> {
    return fetchJson<ExerciseOrder>(`${API_BASE}/orders/${encodeURIComponent(orderId)}`);
  },

  /**
   * Update the content of a draft order.
   */
  updateOrderContent(orderId: string, content: unknown): Promise<void> {
    return fetchJson<void>(
      `${API_BASE}/orders/${encodeURIComponent(orderId)}/content`,
      {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      }
    );
  },

  /**
   * Publish an order — creates PlanningTasks from the order's task paragraphs.
   */
  publishOrder(orderId: string): Promise<{ order: ExerciseOrder; tasks: PlanningTask[] }> {
    return fetchJson<{ order: ExerciseOrder; tasks: PlanningTask[] }>(
      `${API_BASE}/orders/${encodeURIComponent(orderId)}/publish`,
      { method: 'POST' }
    );
  },

  // ─── Tasks ──────────────────────────────────────────────────────────────────

  /**
   * List planning tasks for a scenario, optionally filtered by role or status.
   */
  getTasks(
    scenarioId: string,
    filters?: { role?: string; status?: string }
  ): Promise<PlanningTask[]> {
    const params = new URLSearchParams();
    if (filters?.role) params.set('role', filters.role);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();
    return fetchJson<PlanningTask[]>(
      `${API_BASE}/scenarios/${encodeURIComponent(scenarioId)}/tasks${qs ? `?${qs}` : ''}`
    );
  },

  /**
   * Get the planning board summary (task counts by role and status).
   */
  getBoardSummary(scenarioId: string): Promise<BoardSummary> {
    return fetchJson<BoardSummary>(
      `${API_BASE}/scenarios/${encodeURIComponent(scenarioId)}/tasks/summary`
    );
  },

  /**
   * Update the status of a planning task.
   */
  updateTaskStatus(taskId: string, status: string): Promise<PlanningTask> {
    return fetchJson<PlanningTask>(
      `${API_BASE}/tasks/${encodeURIComponent(taskId)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }
    );
  },

  /**
   * Reassign a planning task to a different role.
   */
  reassignTask(taskId: string, role: string): Promise<PlanningTask> {
    return fetchJson<PlanningTask>(
      `${API_BASE}/tasks/${encodeURIComponent(taskId)}/reassign`,
      {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }
    );
  },

  // ─── Gates ──────────────────────────────────────────────────────────────────

  /**
   * Create a new exercise gate (exercise controller only).
   */
  createGate(scenarioId: string, data: CreateGateInput): Promise<ExerciseGate> {
    return fetchJson<ExerciseGate>(
      `${API_BASE}/scenarios/${encodeURIComponent(scenarioId)}/gates`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * List gates for a scenario, optionally filtered by phase.
   */
  getGates(scenarioId: string, phase?: string): Promise<ExerciseGate[]> {
    const params = phase ? `?phase=${encodeURIComponent(phase)}` : '';
    return fetchJson<ExerciseGate[]>(
      `${API_BASE}/scenarios/${encodeURIComponent(scenarioId)}/gates${params}`
    );
  },

  /**
   * Open a gate (exercise controller only) — triggers associated info release or phase transition.
   */
  openGate(gateId: string): Promise<void> {
    return fetchJson<void>(
      `${API_BASE}/gates/${encodeURIComponent(gateId)}/open`,
      { method: 'POST' }
    );
  },

  /**
   * Check whether a scenario phase has all required gates open (phase-ready check).
   */
  isPhaseReady(scenarioId: string, phase: string): Promise<boolean> {
    return fetchJson<boolean>(
      `${API_BASE}/scenarios/${encodeURIComponent(scenarioId)}/phase-ready?phase=${encodeURIComponent(phase)}`
    );
  },
};
