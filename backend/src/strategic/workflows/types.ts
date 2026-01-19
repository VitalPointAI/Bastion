/**
 * Workflow Types for Strategic Objective Approval
 *
 * Types for XState v5 approval workflow machine supporting
 * multi-stakeholder review process with escalation.
 */

/**
 * Risk levels for objectives - determines escalation timing
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

/**
 * Possible approval decisions by a reviewer
 */
export type ApprovalDecisionType = 'APPROVE' | 'REJECT' | 'REQUEST_REVISION';

/**
 * Final decision outcomes
 */
export type FinalDecision = 'APPROVED' | 'REJECTED';

/**
 * Individual approval decision record
 */
export interface ApprovalDecision {
  reviewerId: string;
  decision: ApprovalDecisionType;
  comment?: string;
  decidedAt: Date;
}

/**
 * Comment on a workflow
 */
export interface WorkflowComment {
  authorId: string;
  content: string;
  createdAt: Date;
}

/**
 * Context for the approval workflow state machine
 */
export interface ApprovalContext {
  objectiveId: string;
  documentId: string;
  submittedBy: string;
  submittedAt: Date;
  reviewers: string[]; // DIDs of required reviewers
  approvals: ApprovalDecision[];
  currentReviewerIndex: number;
  riskLevel: RiskLevel;
  escalatedTo?: string;
  escalatedAt?: Date;
  finalDecision?: FinalDecision;
  comments: WorkflowComment[];
}

/**
 * Events that can be sent to the approval workflow machine
 */
export type ApprovalEvent =
  | { type: 'SUBMIT'; objectiveId: string; documentId: string; submittedBy: string; reviewers: string[]; riskLevel: RiskLevel }
  | { type: 'REVIEW'; reviewerId: string; decision: ApprovalDecisionType; comment?: string }
  | { type: 'ESCALATE'; reason: string; escalateTo: string }
  | { type: 'WITHDRAW' }
  | { type: 'TIMEOUT' }
  | { type: 'ADD_COMMENT'; authorId: string; content: string };

/**
 * Workflow state names
 */
export type WorkflowStateName =
  | 'draft'
  | 'pendingReview'
  | 'pendingRevision'
  | 'escalated'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

/**
 * Workflow status response
 */
export interface WorkflowStatus {
  state: WorkflowStateName;
  context: ApprovalContext;
  canTransition: string[];
  history: WorkflowHistoryEntry[];
}

/**
 * History entry for audit trail
 */
export interface WorkflowHistoryEntry {
  id: number;
  workflowId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  actorId: string;
  createdAt: Date;
}
