/**
 * Document Service
 *
 * Phase 33 Plan 10: Frontend API client for document generation, versioning,
 * and distribution endpoints.
 */

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DocumentFormat = 'pdf' | 'docx';
export type VersionStatus = 'draft' | 'coordinating_draft' | 'final';

export interface VersionRecord {
  versionId: string;
  planId: string;
  status: VersionStatus;
  notes?: string;
  createdAt: string;
  createdBy: string;
  snapshotRef?: string;
}

export interface DistributionTarget {
  problemSetId: string;
  status: string;
}

export interface DistributionResult {
  distributionId: string;
  targets: DistributionTarget[];
}

export interface DistributionRecord {
  distributionId: string;
  planId: string;
  versionId: string;
  targetProblemSetId: string;
  status: string;
  distributedAt: string;
  distributedBy: string;
}

// ─── Service ────────────────────────────────────────────────────────────────

export const documentService = {
  /**
   * Generate a document (PDF or DOCX) and return as a Blob for download.
   */
  async generateDocument(
    problemSetId: string,
    planId: string,
    format: DocumentFormat,
    includeAnnexes?: string[],
    planType?: string,
    classification?: string,
  ): Promise<Blob> {
    const res = await fetch(
      `${API_BASE}/api/planning/${problemSetId}/documents/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          planId,
          format,
          includeAnnexes,
          planType,
          classification,
        }),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Failed to generate document');
    }

    return res.blob();
  },

  /**
   * Create a version snapshot of the current plan state.
   */
  async createVersion(
    problemSetId: string,
    planId: string,
    status: VersionStatus,
    notes?: string,
  ): Promise<VersionRecord> {
    const res = await fetch(
      `${API_BASE}/api/planning/${problemSetId}/documents/versions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planId, status, notes }),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Failed to create version');
    }

    return res.json();
  },

  /**
   * Get version history for a plan.
   */
  async getVersions(
    problemSetId: string,
    planId: string,
  ): Promise<VersionRecord[]> {
    const res = await fetch(
      `${API_BASE}/api/planning/${problemSetId}/documents/${planId}/versions`,
      { credentials: 'include' },
    );

    if (!res.ok) {
      throw new Error(`Failed to get versions: ${res.statusText}`);
    }

    return res.json();
  },

  /**
   * Distribute an approved plan version to subordinate problem sets.
   */
  async distribute(
    problemSetId: string,
    planId: string,
    versionId: string,
    targetProblemSetIds: string[],
  ): Promise<DistributionResult> {
    const res = await fetch(
      `${API_BASE}/api/planning/${problemSetId}/documents/distribute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planId, versionId, targetProblemSetIds }),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Failed to distribute plan');
    }

    return res.json();
  },

  /**
   * Get distribution history for a plan.
   */
  async getDistributions(
    problemSetId: string,
    planId: string,
  ): Promise<DistributionRecord[]> {
    const res = await fetch(
      `${API_BASE}/api/planning/${problemSetId}/documents/${planId}/distributions`,
      { credentials: 'include' },
    );

    if (!res.ok) {
      throw new Error(`Failed to get distributions: ${res.statusText}`);
    }

    return res.json();
  },
};
