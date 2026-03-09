/**
 * Strategic Guidance Service
 *
 * Phase 36 Plan 02: API client for strategic guidance backend endpoints.
 * Follows the same patterns as mdmp-service.ts and jpp-service.ts.
 */

const API_BASE = '/api/strategic-guidance';

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
    if (response.status === 404) {
      throw new Error('Not found');
    }
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// ============================================================================
// Types
// ============================================================================

export interface SGInstance {
  id: string;
  problemSetId: string;
  createdBy: string;
  createdAt: string;
  stepStatuses: Record<string, string>;
}

export interface SGStepContent {
  stepId: string;
  content: unknown;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ForceAllocation {
  id: string;
  instanceId: string;
  unitName: string;
  unitType: string;
  lineOfEffort: string;
  allocation: number;
  notes?: string;
}

export interface ForceAllocationSummary {
  totalAllocated: number;
  byLineOfEffort: Record<string, number>;
}

export interface DirectiveVersion {
  id: string;
  instanceId: string;
  version: number;
  content: unknown;
  createdAt: string;
  finalized: boolean;
  createdBy?: string;
  changelog?: string;
}

// ============================================================================
// Service Methods
// ============================================================================

async function getInstance(problemSetId: string): Promise<SGInstance | null> {
  try {
    const data = await fetchJson<SGInstance>(
      `${API_BASE}/instances/${encodeURIComponent(problemSetId)}`,
    );
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Not found')) {
      return null;
    }
    throw error;
  }
}

async function createInstance(problemSetId: string): Promise<SGInstance> {
  return fetchJson<SGInstance>(`${API_BASE}/instances`, {
    method: 'POST',
    body: JSON.stringify({ problemSetId, createdBy: '' }),
  });
}

async function getStepContent(instanceId: string, stepId: string): Promise<SGStepContent> {
  return fetchJson<SGStepContent>(
    `${API_BASE}/instances/${encodeURIComponent(instanceId)}/steps/${encodeURIComponent(stepId)}`,
  );
}

async function saveStepContent(
  instanceId: string,
  stepId: string,
  content: unknown,
): Promise<SGStepContent> {
  return fetchJson<SGStepContent>(
    `${API_BASE}/instances/${encodeURIComponent(instanceId)}/steps/${encodeURIComponent(stepId)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ content, updatedBy: '' }),
    },
  );
}

async function updateStepStatus(
  instanceId: string,
  stepId: string,
  status: string,
): Promise<void> {
  await fetchJson(
    `${API_BASE}/instances/${encodeURIComponent(instanceId)}/steps/${encodeURIComponent(stepId)}/status`,
    {
      method: 'PUT',
      body: JSON.stringify({ status }),
    },
  );
}

async function getForceAllocations(instanceId: string): Promise<ForceAllocation[]> {
  return fetchJson<ForceAllocation[]>(
    `${API_BASE}/instances/${encodeURIComponent(instanceId)}/forces`,
  );
}

async function getForceAllocationSummary(instanceId: string): Promise<ForceAllocationSummary> {
  return fetchJson<ForceAllocationSummary>(
    `${API_BASE}/instances/${encodeURIComponent(instanceId)}/forces/summary`,
  );
}

async function saveForceAllocation(
  instanceId: string,
  allocation: Omit<ForceAllocation, 'id' | 'instanceId'>,
): Promise<ForceAllocation> {
  return fetchJson<ForceAllocation>(
    `${API_BASE}/instances/${encodeURIComponent(instanceId)}/forces`,
    {
      method: 'POST',
      body: JSON.stringify(allocation),
    },
  );
}

async function deleteForceAllocation(instanceId: string, allocationId: string): Promise<void> {
  await fetchJson(
    `${API_BASE}/instances/${encodeURIComponent(instanceId)}/forces/${encodeURIComponent(allocationId)}`,
    { method: 'DELETE' },
  );
}

async function getDirectiveVersions(instanceId: string): Promise<DirectiveVersion[]> {
  return fetchJson<DirectiveVersion[]>(
    `${API_BASE}/instances/${encodeURIComponent(instanceId)}/directives`,
  );
}

async function finalizeDirective(instanceId: string): Promise<DirectiveVersion> {
  return fetchJson<DirectiveVersion>(
    `${API_BASE}/instances/${encodeURIComponent(instanceId)}/directives/finalize`,
    { method: 'POST' },
  );
}

// ============================================================================
// Export as object (not namespace)
// ============================================================================

export const sgService = {
  getInstance,
  createInstance,
  getStepContent,
  saveStepContent,
  updateStepStatus,
  getForceAllocations,
  getForceAllocationSummary,
  saveForceAllocation,
  deleteForceAllocation,
  getDirectiveVersions,
  finalizeDirective,
};
