/**
 * PIR Service
 *
 * API client for Priority Intelligence Requirements endpoints.
 * Provides typed methods for CRUD operations on PIR/CCIR/FFIR/EEFI records.
 */

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PIRType = 'CCIR' | 'PIR' | 'FFIR' | 'EEFI';
export type PIRStatus = 'ACTIVE' | 'ANSWERED' | 'SUPERSEDED' | 'CANCELLED';

export interface PIR {
  id: string;
  problemSetId: string;
  type: PIRType;
  description: string;
  priority: number;
  status: PIRStatus;
  sourceType: string | null;
  sourceId: string | null;
  linkedAssumptionIds: string[];
  linkedObjectiveIds: string[];
  answer: string | null;
  answeredAt: string | null;
  answeredBy: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PIRListFilters {
  type?: PIRType;
  status?: PIRStatus;
}

export interface CreatePIRInput {
  problemSetId: string;
  type: PIRType;
  description: string;
  priority?: number;
  sourceType?: string;
  sourceId?: string;
  linkedAssumptionIds?: string[];
  linkedObjectiveIds?: string[];
  createdBy?: string;
}

export interface UpdatePIRInput {
  description?: string;
  type?: PIRType;
  priority?: number;
  status?: PIRStatus;
  answer?: string;
  answeredBy?: string;
  linkedAssumptionIds?: string[];
  linkedObjectiveIds?: string[];
}

export interface PIRSuggestion {
  type: string;
  description: string;
  priority: number;
  sourceType: string;
  sourceLabel: string;
  rationale: string;
  possibleDuplicate: boolean;
}

export interface DeriveResult {
  suggestions: PIRSuggestion[];
  totalSuggestions: number;
  existingPIRCount: number;
  sources: {
    assumptions: number;
    cogNodes: number;
    decisivePoints: number;
    constraints: number;
  };
  note: string;
}

export interface ResearchStatus {
  pirId: string;
  pirStatus: PIRStatus;
  gapFillerMonitoring: boolean;
  gapFillerRunning: boolean;
  lastGapFillerRun: string | null;
  nextScheduledRun: string | null;
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/**
 * List PIRs for a problem set with optional filters.
 */
export async function listPIRs(
  problemSetId: string,
  filters?: PIRListFilters,
): Promise<PIR[]> {
  const params = new URLSearchParams({ problemSetId });
  if (filters?.type) params.set('type', filters.type);
  if (filters?.status) params.set('status', filters.status);

  const res = await fetch(`${API_BASE}/api/pirs?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to list PIRs: ${res.statusText}`);
  const data = await res.json();
  return data.pirs;
}

/**
 * Create a new PIR.
 */
export async function createPIR(input: CreatePIRInput): Promise<PIR> {
  const res = await fetch(`${API_BASE}/api/pirs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create PIR: ${res.statusText}`);
  const data = await res.json();
  return data.pir;
}

/**
 * Update an existing PIR.
 */
export async function updatePIR(id: string, updates: UpdatePIRInput): Promise<PIR> {
  const res = await fetch(`${API_BASE}/api/pirs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Failed to update PIR: ${res.statusText}`);
  const data = await res.json();
  return data.pir;
}

/**
 * Delete a PIR.
 */
export async function deletePIR(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/pirs/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete PIR: ${res.statusText}`);
}

/**
 * Mark a PIR as answered.
 */
export async function answerPIR(
  id: string,
  answer: string,
  answeredBy?: string,
): Promise<PIR> {
  const res = await fetch(`${API_BASE}/api/pirs/${id}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer, answeredBy }),
  });
  if (!res.ok) throw new Error(`Failed to answer PIR: ${res.statusText}`);
  const data = await res.json();
  return data.pir;
}

/**
 * Link an assumption to a PIR.
 */
export async function linkAssumption(
  pirId: string,
  assumptionId: string,
): Promise<PIR> {
  const res = await fetch(`${API_BASE}/api/pirs/${pirId}/link-assumption`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assumptionId }),
  });
  if (!res.ok) throw new Error(`Failed to link assumption: ${res.statusText}`);
  const data = await res.json();
  return data.pir;
}

/**
 * Check research status for a PIR.
 */
export async function getResearchStatus(pirId: string): Promise<ResearchStatus> {
  const res = await fetch(`${API_BASE}/api/pirs/${pirId}/research-status`);
  if (!res.ok) throw new Error(`Failed to get research status: ${res.statusText}`);
  return await res.json();
}

/**
 * Call Ironclaw's derive_pirs_from_design tool via the Ironclaw chat endpoint.
 * This is a convenience wrapper that sends the appropriate command.
 */
export async function derivePIRsFromDesign(problemSetId: string): Promise<DeriveResult> {
  const res = await fetch(`${API_BASE}/api/ironclaw/tool-call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toolName: 'bastion.intel.derive_pirs_from_design',
      args: { problem_set_id: problemSetId },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to derive PIRs: ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.success && data.result) {
    return data.result as DeriveResult;
  }
  return data as DeriveResult;
}
