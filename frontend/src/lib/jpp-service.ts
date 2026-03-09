/**
 * JPP Service
 *
 * Phase 33 Plan 04: API client for JPP instance and step product CRUD.
 */

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Types (mirrored from backend) ──────────────────────────────────────────

export type JPPStepId =
  | 'planning_initiation'
  | 'mission_analysis'
  | 'coa_development'
  | 'coa_analysis'
  | 'coa_comparison'
  | 'coa_approval'
  | 'plan_development';

export type StepStatus = 'not_started' | 'in_progress' | 'ready' | 'approved' | 'rejected';
export type StepProductStatus = 'draft' | 'reviewed' | 'approved';

export interface JPPInstance {
  id: string;
  problemSetId: string;
  parentJppId: string | null;
  echelon: string;
  planType: string;
  stepStatuses: Record<JPPStepId, StepStatus>;
  createdAt: string;
  updatedAt: string;
}

export interface JPPStepProduct {
  id: string;
  jppInstanceId: string;
  step: JPPStepId;
  roleId: string;
  content: Record<string, unknown>;
  aiDraftedBy: string | null;
  reviewedBy: string | null;
  status: StepProductStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Service ────────────────────────────────────────────────────────────────

export const jppService = {
  /**
   * Get or auto-create JPP instance for a problem set.
   */
  async getInstance(problemSetId: string): Promise<JPPInstance> {
    const res = await fetch(`${API_BASE}/api/jpp/${problemSetId}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to get JPP instance: ${res.statusText}`);
    return res.json();
  },

  /**
   * Update a step's status.
   */
  async updateStepStatus(
    instanceId: string,
    step: JPPStepId,
    status: StepStatus,
  ): Promise<JPPInstance> {
    const res = await fetch(`${API_BASE}/api/jpp/${instanceId}/step-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ step, status }),
    });
    if (!res.ok) throw new Error(`Failed to update step status: ${res.statusText}`);
    return res.json();
  },

  /**
   * Get all products for a specific JPP step.
   */
  async getStepProducts(instanceId: string, step: JPPStepId): Promise<JPPStepProduct[]> {
    const res = await fetch(`${API_BASE}/api/jpp/${instanceId}/steps/${step}/products`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to get step products: ${res.statusText}`);
    return res.json();
  },

  /**
   * Save or update a step product.
   */
  async saveStepProduct(
    instanceId: string,
    step: JPPStepId,
    product: {
      roleId: string;
      content: Record<string, unknown>;
      aiDraftedBy?: string;
      status?: StepProductStatus;
      id?: string;
    },
  ): Promise<JPPStepProduct> {
    const res = await fetch(`${API_BASE}/api/jpp/${instanceId}/steps/${step}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(product),
    });
    if (!res.ok) throw new Error(`Failed to save step product: ${res.statusText}`);
    return res.json();
  },

  /**
   * Get parent JPP products for inheritance.
   */
  async getParentProducts(
    instanceId: string,
  ): Promise<{ products: Record<string, JPPStepProduct[]>; parentJppId: string | null }> {
    const res = await fetch(`${API_BASE}/api/jpp/${instanceId}/parent-products`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to get parent products: ${res.statusText}`);
    return res.json();
  },
};
