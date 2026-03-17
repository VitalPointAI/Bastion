/**
 * Design Revision Service
 *
 * Phase 49 Plan 04: API client for design revision proposal CRUD operations.
 * Follows the same fetch pattern as design-service.ts (if !res.ok throw Error).
 *
 * Endpoints (from Plan 03 backend):
 *   POST   /api/design/:problemSetId/revisions
 *   GET    /api/design/:problemSetId/revisions?status=
 *   GET    /api/design/:problemSetId/revisions/:id
 *   PATCH  /api/design/:problemSetId/revisions/:id/merge
 *   PATCH  /api/design/:problemSetId/revisions/:id/status
 */

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RevisionStatus = 'pending' | 'approved' | 'rejected' | 'merged';

export type RevisionArtifactType =
  | 'problem-framing'
  | 'cog-analysis'
  | 'lines-of-effort'
  | 'operational-approach';

export interface DesignRevision {
  id: string;
  problemSetId: string;
  artifactType: RevisionArtifactType;
  proposedBy: string;
  proposedAt: string;
  originalData: unknown;
  proposedData: unknown;
  rationale?: string;
  status: RevisionStatus;
  gateId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  mergedAt?: string;
}

export interface CreateRevisionParams {
  artifactType: RevisionArtifactType;
  proposedData: unknown;
  originalData: unknown;
  rationale?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const designRevisionService = {
  /**
   * Create a new revision proposal.
   */
  async create(problemSetId: string, params: CreateRevisionParams): Promise<DesignRevision> {
    const res = await fetch(`${API_BASE}/api/design/${problemSetId}/revisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Failed to create revision: ${res.statusText}`);
    const data = await res.json();
    return data.revision;
  },

  /**
   * List revisions for a problem set, optionally filtered by status.
   */
  async list(problemSetId: string, status?: RevisionStatus): Promise<DesignRevision[]> {
    const url = status
      ? `${API_BASE}/api/design/${problemSetId}/revisions?status=${encodeURIComponent(status)}`
      : `${API_BASE}/api/design/${problemSetId}/revisions`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to list revisions: ${res.statusText}`);
    const data = await res.json();
    return data.revisions;
  },

  /**
   * Get a single revision by ID.
   */
  async get(problemSetId: string, id: string): Promise<DesignRevision> {
    const res = await fetch(`${API_BASE}/api/design/${problemSetId}/revisions/${id}`);
    if (!res.ok) throw new Error(`Failed to get revision: ${res.statusText}`);
    const data = await res.json();
    return data.revision;
  },

  /**
   * Merge an approved revision into the canonical Design artifact.
   */
  async merge(problemSetId: string, id: string): Promise<DesignRevision> {
    const res = await fetch(`${API_BASE}/api/design/${problemSetId}/revisions/${id}/merge`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Failed to merge revision: ${res.statusText}`);
    const data = await res.json();
    return data.revision;
  },

  /**
   * Update revision status (approve / reject).
   */
  async updateStatus(problemSetId: string, id: string, status: RevisionStatus): Promise<DesignRevision> {
    const res = await fetch(`${API_BASE}/api/design/${problemSetId}/revisions/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error(`Failed to update revision status: ${res.statusText}`);
    const data = await res.json();
    return data.revision;
  },
};
