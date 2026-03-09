/**
 * E-W-M Service
 *
 * Phase 33 Plan 04: API client for Ends-Ways-Means linkage CRUD and gap analysis.
 */

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Types (mirrored from backend) ──────────────────────────────────────────

export type EWMWayType = 'loe' | 'coa';
export type EWMMeanType = 'force' | 'capability' | 'resource';

export interface EWMLinkage {
  id: string;
  jppInstanceId: string;
  endObjectiveId: string;
  wayId: string;
  wayType: EWMWayType;
  meanId: string | null;
  meanType: EWMMeanType | null;
  allocationPct: number;
  createdAt: string;
}

export interface EWMGap {
  type: 'unlinked_end' | 'unsupported_way' | 'unallocated_mean' | 'over_allocated_mean';
  entityId: string;
  entityName: string;
  details: string;
}

export interface EWMSummary {
  ends: { count: number; items: Array<{ id: string; name: string }> };
  ways: { count: number; items: Array<{ id: string; name: string }> };
  means: { count: number; items: Array<{ id: string; name: string }> };
}

// ─── Service ────────────────────────────────────────────────────────────────

export const ewmService = {
  /**
   * Get all E-W-M linkages for a JPP instance.
   */
  async getLinkages(instanceId: string): Promise<EWMLinkage[]> {
    const res = await fetch(`${API_BASE}/api/jpp/${instanceId}/ewm`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to get E-W-M linkages: ${res.statusText}`);
    return res.json();
  },

  /**
   * Create a new E-W-M linkage.
   */
  async createLinkage(
    instanceId: string,
    data: {
      endObjectiveId: string;
      wayId: string;
      wayType: EWMWayType;
      meanId?: string;
      meanType?: EWMMeanType;
      allocationPct?: number;
    },
  ): Promise<EWMLinkage> {
    const res = await fetch(`${API_BASE}/api/jpp/${instanceId}/ewm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create E-W-M linkage: ${res.statusText}`);
    return res.json();
  },

  /**
   * Delete an E-W-M linkage.
   */
  async deleteLinkage(instanceId: string, linkageId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/jpp/${instanceId}/ewm/${linkageId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to delete E-W-M linkage: ${res.statusText}`);
  },

  /**
   * Update allocation percentage on a linkage.
   */
  async updateAllocation(instanceId: string, linkageId: string, allocationPct: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/jpp/${instanceId}/ewm/${linkageId}/allocation`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ allocationPct }),
    });
    if (!res.ok) throw new Error(`Failed to update allocation: ${res.statusText}`);
  },

  /**
   * Get gap analysis for a JPP instance.
   */
  async getGaps(instanceId: string): Promise<EWMGap[]> {
    const res = await fetch(`${API_BASE}/api/jpp/${instanceId}/ewm/gaps`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to get E-W-M gaps: ${res.statusText}`);
    return res.json();
  },

  /**
   * Get E-W-M summary counts.
   */
  async getSummary(instanceId: string): Promise<EWMSummary> {
    const res = await fetch(`${API_BASE}/api/jpp/${instanceId}/ewm/summary`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to get E-W-M summary: ${res.statusText}`);
    return res.json();
  },
};
