/**
 * Document-Agent Assignment Store
 *
 * Manages persistence of document-to-agent assignments.
 * In-memory storage for now; can be extended to PostgreSQL.
 */

import { randomUUID } from 'crypto';
import type {
  DocumentAssignment,
  AssignmentInput,
  AssignmentFilters,
} from './types.js';

/**
 * Assignment Store - manages document-agent assignment persistence.
 */
export class AssignmentStore {
  private assignments: Map<string, DocumentAssignment> = new Map();
  private documentIndex: Map<string, string[]> = new Map(); // documentId -> assignmentIds
  private agentIndex: Map<string, string[]> = new Map(); // agentId -> assignmentIds

  /**
   * Create a new document-agent assignment.
   */
  async createAssignment(
    input: AssignmentInput,
    assignedBy: string
  ): Promise<DocumentAssignment> {
    // Check for existing active assignment
    const existing = await this.getActiveAssignment(input.documentId, input.agentId);
    if (existing) {
      throw new Error(
        `Document ${input.documentId} is already assigned to agent ${input.agentId}`
      );
    }

    const id = randomUUID();
    const assignment: DocumentAssignment = {
      id,
      documentId: input.documentId,
      agentId: input.agentId,
      status: 'active',
      autoReview: input.autoReview ?? false,
      reviewOptions: input.reviewOptions,
      assignedAt: new Date().toISOString(),
      assignedBy,
    };

    this.assignments.set(id, assignment);

    // Update document index
    const docAssignments = this.documentIndex.get(input.documentId) || [];
    docAssignments.push(id);
    this.documentIndex.set(input.documentId, docAssignments);

    // Update agent index
    const agentAssignments = this.agentIndex.get(input.agentId) || [];
    agentAssignments.push(id);
    this.agentIndex.set(input.agentId, agentAssignments);

    return assignment;
  }

  /**
   * Get an assignment by ID.
   */
  async getAssignment(id: string): Promise<DocumentAssignment | null> {
    return this.assignments.get(id) || null;
  }

  /**
   * Get active assignment for a document-agent pair.
   */
  async getActiveAssignment(
    documentId: string,
    agentId: string
  ): Promise<DocumentAssignment | null> {
    const docAssignments = this.documentIndex.get(documentId) || [];

    for (const id of docAssignments) {
      const assignment = this.assignments.get(id);
      if (assignment && assignment.agentId === agentId && assignment.status === 'active') {
        return assignment;
      }
    }

    return null;
  }

  /**
   * Get all active assignments for a document.
   */
  async getAssignmentsForDocument(documentId: string): Promise<DocumentAssignment[]> {
    const ids = this.documentIndex.get(documentId) || [];
    const assignments: DocumentAssignment[] = [];

    for (const id of ids) {
      const assignment = this.assignments.get(id);
      if (assignment && assignment.status === 'active') {
        assignments.push(assignment);
      }
    }

    return assignments;
  }

  /**
   * Get all active assignments for an agent.
   */
  async getAssignmentsForAgent(agentId: string): Promise<DocumentAssignment[]> {
    const ids = this.agentIndex.get(agentId) || [];
    const assignments: DocumentAssignment[] = [];

    for (const id of ids) {
      const assignment = this.assignments.get(id);
      if (assignment && assignment.status === 'active') {
        assignments.push(assignment);
      }
    }

    return assignments;
  }

  /**
   * Get all assignments with auto-review enabled.
   */
  async getAutoReviewAssignments(): Promise<DocumentAssignment[]> {
    return Array.from(this.assignments.values()).filter(
      a => a.status === 'active' && a.autoReview
    );
  }

  /**
   * Update assignment with last review info.
   */
  async recordReview(
    assignmentId: string,
    reviewId: string
  ): Promise<DocumentAssignment | null> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) {
      return null;
    }

    assignment.lastReviewId = reviewId;
    assignment.lastReviewAt = new Date().toISOString();

    this.assignments.set(assignmentId, assignment);
    return assignment;
  }

  /**
   * Revoke an assignment.
   */
  async revokeAssignment(
    assignmentId: string,
    revokedBy: string
  ): Promise<DocumentAssignment | null> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) {
      return null;
    }

    assignment.status = 'revoked';
    assignment.revokedAt = new Date().toISOString();
    assignment.revokedBy = revokedBy;

    this.assignments.set(assignmentId, assignment);
    return assignment;
  }

  /**
   * Mark assignment as completed.
   */
  async completeAssignment(assignmentId: string): Promise<DocumentAssignment | null> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) {
      return null;
    }

    assignment.status = 'completed';
    this.assignments.set(assignmentId, assignment);
    return assignment;
  }

  /**
   * Update auto-review setting.
   */
  async setAutoReview(
    assignmentId: string,
    autoReview: boolean
  ): Promise<DocumentAssignment | null> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) {
      return null;
    }

    assignment.autoReview = autoReview;
    this.assignments.set(assignmentId, assignment);
    return assignment;
  }

  /**
   * List assignments with optional filters.
   */
  async listAssignments(
    filters?: AssignmentFilters
  ): Promise<{ assignments: DocumentAssignment[]; total: number }> {
    let assignments = Array.from(this.assignments.values());

    // Apply filters
    if (filters?.documentId) {
      assignments = assignments.filter(a => a.documentId === filters.documentId);
    }
    if (filters?.agentId) {
      assignments = assignments.filter(a => a.agentId === filters.agentId);
    }
    if (filters?.status) {
      assignments = assignments.filter(a => a.status === filters.status);
    }
    if (filters?.autoReview !== undefined) {
      assignments = assignments.filter(a => a.autoReview === filters.autoReview);
    }

    // Sort by assigned date, newest first
    assignments.sort(
      (a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime()
    );

    return { assignments, total: assignments.length };
  }
}

// Singleton instance
let storeInstance: AssignmentStore | null = null;

/**
 * Get or create the assignment store singleton.
 */
export function getAssignmentStore(): AssignmentStore {
  if (!storeInstance) {
    storeInstance = new AssignmentStore();
  }
  return storeInstance;
}

// Export singleton for convenience
export const assignmentStore = getAssignmentStore();
