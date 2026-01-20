/**
 * Strategic Planning Service
 *
 * Client for strategic planning API endpoints.
 * Provides typed methods for documents, objectives, workflows, and risk assessments.
 */

import type {
  StrategicDocument,
  StrategicObjective,
  WorkflowStatus,
  RiskAssessment,
  ExtractionResult,
  ObjectiveFilters,
  DocumentLevel,
  Classification,
} from './types/strategic.js';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Paginated list response from backend.
 */
interface PaginatedResponse<T> {
  documents?: T[];
  objectives?: T[];
  intents?: T[];
  assessments?: T[];
  count: number;
  total?: number;
  limit: number;
  offset: number;
}

/**
 * Document upload response from backend.
 */
interface DocumentUploadResponse {
  documentId: string;
  title: string;
  pageCount?: number;
  textLength: number;
}

/**
 * Strategic Planning Service class.
 * Manages documents, objectives, workflows, and risk assessments.
 */
class StrategicService {
  private token: string | null = null;
  private userDID: string | null = null;

  /**
   * Set authentication token for API requests.
   */
  setAuthToken(token: string): void {
    this.token = token;
  }

  /**
   * Set user DID for API requests.
   */
  setUserDID(did: string): void {
    this.userDID = did;
  }

  /**
   * Make authenticated API request.
   * Returns raw JSON response from backend (no success wrapper expected).
   */
  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.userDID) {
      (headers as Record<string, string>)['X-DID'] = this.userDID;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Make fetch request without JSON Content-Type (for FormData).
   * Returns raw JSON response from backend.
   */
  private async fetchFormData<T>(path: string, formData: FormData): Promise<T> {
    const headers: HeadersInit = {};

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.userDID) {
      (headers as Record<string, string>)['X-DID'] = this.userDID;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ============================================================================
  // Document Operations
  // ============================================================================

  /**
   * Upload a strategic document.
   * Returns the full document after fetching by ID.
   */
  async uploadDocument(
    file: File,
    title: string,
    level: DocumentLevel,
    classification: Classification
  ): Promise<StrategicDocument> {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('title', title);
    formData.append('level', level);
    formData.append('classification', classification);

    const response = await this.fetchFormData<DocumentUploadResponse>(
      '/api/strategic/documents',
      formData
    );

    // Fetch the full document to get all fields
    return this.getDocument(response.documentId);
  }

  /**
   * Get all strategic documents.
   */
  async getDocuments(): Promise<StrategicDocument[]> {
    const response = await this.fetch<PaginatedResponse<StrategicDocument>>('/api/strategic/documents');
    return response.documents || [];
  }

  /**
   * Get a specific document by ID.
   */
  async getDocument(id: string): Promise<StrategicDocument> {
    return this.fetch<StrategicDocument>(`/api/strategic/documents/${encodeURIComponent(id)}`);
  }

  /**
   * Delete a document.
   */
  async deleteDocument(id: string): Promise<void> {
    await this.fetch<void>(`/api/strategic/documents/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Extraction Operations
  // ============================================================================

  /**
   * Extract objectives from a document using AI.
   */
  async extractObjectives(documentId: string): Promise<ExtractionResult> {
    return this.fetch<ExtractionResult>(
      `/api/strategic/documents/${encodeURIComponent(documentId)}/extract`,
      { method: 'POST' }
    );
  }

  // ============================================================================
  // Objective Operations
  // ============================================================================

  /**
   * Get objectives with optional filters.
   */
  async getObjectives(filters?: ObjectiveFilters): Promise<StrategicObjective[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.documentId) params.append('documentId', filters.documentId);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.humanVerified !== undefined) {
      params.append('humanVerified', String(filters.humanVerified));
    }

    const queryString = params.toString();
    const path = queryString
      ? `/api/strategic/objectives?${queryString}`
      : '/api/strategic/objectives';

    const response = await this.fetch<PaginatedResponse<StrategicObjective>>(path);
    return response.objectives || [];
  }

  /**
   * Get a specific objective by ID.
   */
  async getObjective(id: string): Promise<StrategicObjective> {
    return this.fetch<StrategicObjective>(`/api/strategic/objectives/${encodeURIComponent(id)}`);
  }

  /**
   * Update an objective.
   */
  async updateObjective(
    id: string,
    updates: Partial<StrategicObjective>
  ): Promise<StrategicObjective> {
    return this.fetch<StrategicObjective>(`/api/strategic/objectives/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Mark an objective as human-verified.
   */
  async verifyObjective(id: string, verified: boolean): Promise<void> {
    await this.fetch<void>(`/api/strategic/objectives/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
      body: JSON.stringify({ verified }),
    });
  }

  // ============================================================================
  // Workflow Operations
  // ============================================================================

  /**
   * Submit an objective for approval.
   */
  async submitForApproval(objectiveId: string, reviewers: string[]): Promise<WorkflowStatus> {
    return this.fetch<WorkflowStatus>(
      `/api/strategic/objectives/${encodeURIComponent(objectiveId)}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({ reviewers }),
      }
    );
  }

  /**
   * Submit a review decision.
   */
  async submitReview(
    objectiveId: string,
    decision: 'APPROVE' | 'REJECT',
    comment?: string
  ): Promise<WorkflowStatus> {
    return this.fetch<WorkflowStatus>(
      `/api/strategic/objectives/${encodeURIComponent(objectiveId)}/review`,
      {
        method: 'POST',
        body: JSON.stringify({ decision, comment }),
      }
    );
  }

  /**
   * Get workflow status for an objective.
   */
  async getWorkflowStatus(objectiveId: string): Promise<WorkflowStatus> {
    return this.fetch<WorkflowStatus>(
      `/api/strategic/objectives/${encodeURIComponent(objectiveId)}/workflow`
    );
  }

  // ============================================================================
  // Risk Assessment Operations
  // ============================================================================

  /**
   * Generate AI risk assessment for an objective.
   */
  async generateRiskAssessment(objectiveId: string): Promise<RiskAssessment> {
    return this.fetch<RiskAssessment>(
      `/api/strategic/objectives/${encodeURIComponent(objectiveId)}/risk`,
      { method: 'POST' }
    );
  }

  /**
   * Get risk assessments for an objective.
   */
  async getRiskAssessments(objectiveId: string): Promise<RiskAssessment[]> {
    const response = await this.fetch<PaginatedResponse<RiskAssessment>>(
      `/api/strategic/objectives/${encodeURIComponent(objectiveId)}/risk`
    );
    return response.assessments || [];
  }

  /**
   * Get a specific risk assessment by ID.
   */
  async getRiskAssessment(id: string): Promise<RiskAssessment> {
    return this.fetch<RiskAssessment>(`/api/strategic/risk/${encodeURIComponent(id)}`);
  }
}

/**
 * Singleton instance of the strategic service.
 */
export const strategicService = new StrategicService();

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get display name for document level.
 */
export function getDocumentLevelName(level: DocumentLevel): string {
  const names: Record<DocumentLevel, string> = {
    NSS: 'National Security Strategy',
    NDS: 'National Defense Strategy',
    NMS: 'National Military Strategy',
    GEF: 'Guidance for Employment of the Force',
    JSCP: 'Joint Strategic Capabilities Plan',
    CAMPAIGN_PLAN: 'Campaign Plan',
    OTHER: 'Other',
  };
  return names[level] || level;
}

/**
 * Get classification badge color class.
 */
export function getClassificationColor(classification: Classification): string {
  switch (classification) {
    case 'TOP_SECRET':
      return 'classification-topsecret';
    case 'SECRET':
      return 'classification-secret';
    case 'CONFIDENTIAL':
      return 'classification-confidential';
    case 'UNCLASSIFIED':
    default:
      return 'classification-unclassified';
  }
}

/**
 * Get priority badge color class.
 */
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'CRITICAL':
      return 'priority-critical';
    case 'HIGH':
      return 'priority-high';
    case 'MEDIUM':
      return 'priority-medium';
    case 'LOW':
    default:
      return 'priority-low';
  }
}

/**
 * Get status badge color class.
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'APPROVED':
    case 'OPERATIONALIZED':
      return 'status-approved';
    case 'REJECTED':
      return 'status-rejected';
    case 'UNDER_REVIEW':
    case 'SUBMITTED':
      return 'status-pending';
    case 'DRAFT':
    default:
      return 'status-draft';
  }
}
