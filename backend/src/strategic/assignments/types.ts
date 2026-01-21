/**
 * Document-Agent Assignment Types
 *
 * Defines the structure for assigning documents to review agents.
 */

/**
 * Status of a document-agent assignment.
 */
export type AssignmentStatus = 'active' | 'completed' | 'revoked';

/**
 * Document-Agent Assignment
 * Links a document to an agent for automated review.
 */
export interface DocumentAssignment {
  id: string;
  documentId: string;
  agentId: string;
  status: AssignmentStatus;
  autoReview: boolean;
  reviewOptions?: {
    confidenceThreshold?: number;
    prioritizationDomain?: 'strategic' | 'operational' | 'tactical' | 'resource';
    onlyUncategorized?: boolean;
  };
  assignedAt: string;
  assignedBy: string;
  lastReviewId?: string;
  lastReviewAt?: string;
  revokedAt?: string;
  revokedBy?: string;
}

/**
 * Input for creating a new assignment.
 */
export interface AssignmentInput {
  documentId: string;
  agentId: string;
  autoReview?: boolean;
  reviewOptions?: {
    confidenceThreshold?: number;
    prioritizationDomain?: 'strategic' | 'operational' | 'tactical' | 'resource';
    onlyUncategorized?: boolean;
  };
}

/**
 * Filter options for listing assignments.
 */
export interface AssignmentFilters {
  documentId?: string;
  agentId?: string;
  status?: AssignmentStatus;
  autoReview?: boolean;
}
