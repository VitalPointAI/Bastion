import type { OperationalPlan, COA, WorkflowState, JP50Step } from '../components/planning/types';

const API_BASE = '/api/planning';

// Helper for fetch with error handling
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
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Plans
export async function createPlan(data: Partial<OperationalPlan>): Promise<OperationalPlan> {
  return fetchJson<OperationalPlan>(`${API_BASE}/plans`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getPlan(id: string): Promise<OperationalPlan> {
  return fetchJson<OperationalPlan>(`${API_BASE}/plans/${id}`);
}

export async function getPlansByMission(missionId: string): Promise<OperationalPlan[]> {
  return fetchJson<OperationalPlan[]>(`${API_BASE}/missions/${missionId}/plans`);
}

export async function updatePlan(id: string, data: Partial<OperationalPlan>): Promise<OperationalPlan> {
  return fetchJson<OperationalPlan>(`${API_BASE}/plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deletePlan(id: string): Promise<void> {
  await fetch(`${API_BASE}/plans/${id}`, { method: 'DELETE' });
}

// Workflow
export async function getWorkflowState(planId: string): Promise<WorkflowState> {
  return fetchJson<WorkflowState>(`${API_BASE}/plans/${planId}/workflow`);
}

export async function sendWorkflowEvent(planId: string, event: { type: string; [key: string]: unknown }): Promise<WorkflowState> {
  return fetchJson<WorkflowState>(`${API_BASE}/plans/${planId}/workflow/events`, {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

export async function navigateToStep(planId: string, step: JP50Step): Promise<WorkflowState> {
  return sendWorkflowEvent(planId, { type: 'NAVIGATE_TO_STEP', step });
}

export async function startStep(planId: string, step: JP50Step, actorDID: string): Promise<WorkflowState> {
  return sendWorkflowEvent(planId, { type: 'START_STEP', step, actorDID });
}

export async function markStepReady(planId: string, step: JP50Step, actorDID: string): Promise<WorkflowState> {
  return sendWorkflowEvent(planId, { type: 'MARK_STEP_READY', step, actorDID });
}

// COAs
export async function getCOAs(planId: string): Promise<COA[]> {
  return fetchJson<COA[]>(`${API_BASE}/plans/${planId}/coas`);
}

export async function createCOA(planId: string, data: Partial<COA>): Promise<COA> {
  return fetchJson<COA>(`${API_BASE}/plans/${planId}/coas`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function selectCOA(planId: string, coaId: string): Promise<void> {
  await fetchJson(`${API_BASE}/plans/${planId}/coas/${coaId}/select`, {
    method: 'POST',
  });
}

// AI Agents
export async function generateCOAs(planId: string, targetCount?: number): Promise<{ coaCount: number; confidence: number }> {
  return fetchJson(`${API_BASE}/plans/${planId}/coas/generate`, {
    method: 'POST',
    body: JSON.stringify({ targetCount }),
  });
}

export async function runRedTeam(planId: string, coaIds?: string[]): Promise<{ analyzedCount: number }> {
  return fetchJson(`${API_BASE}/plans/${planId}/red-team`, {
    method: 'POST',
    body: JSON.stringify({ coaIds }),
  });
}

export async function compareCOAs(planId: string): Promise<{ comparedCount: number; rankings: Array<{ coaId: string; rank: number; score: number }> }> {
  return fetchJson(`${API_BASE}/plans/${planId}/coas/compare`, {
    method: 'POST',
  });
}

// Documents
export function getOPORDDocxUrl(planId: string): string {
  return `${API_BASE}/plans/${planId}/documents/opord.docx`;
}

export function getOPORDPdfUrl(planId: string): string {
  return `${API_BASE}/plans/${planId}/documents/opord.pdf`;
}

export function getBriefingUrl(planId: string, type: 'commander' | 'staff' | 'rehearsal'): string {
  return `${API_BASE}/plans/${planId}/documents/briefing.pptx?type=${type}`;
}

export async function getSyncMatrix(planId: string): Promise<unknown> {
  return fetchJson(`${API_BASE}/plans/${planId}/documents/sync-matrix`);
}

export async function getDST(planId: string): Promise<unknown> {
  return fetchJson(`${API_BASE}/plans/${planId}/documents/dst`);
}

export async function getCCIR(planId: string): Promise<unknown> {
  return fetchJson(`${API_BASE}/plans/${planId}/documents/ccir`);
}

// Graphics
export async function getOperationalGraphics(planId: string): Promise<unknown> {
  return fetchJson(`${API_BASE}/plans/${planId}/graphics`);
}

export async function getGraphicsGeoJSON(planId: string): Promise<unknown> {
  return fetchJson(`${API_BASE}/plans/${planId}/graphics/geojson`);
}
