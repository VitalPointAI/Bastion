/**
 * Approval Workflow State Machine
 *
 * XState v5 state machine for strategic objective approval workflow.
 * Manages multi-stakeholder review process with escalation logic.
 *
 * States:
 * - draft: Initial state, objective not yet submitted
 * - pendingReview: Awaiting reviewer decisions
 * - pendingRevision: Revision requested, awaiting resubmission
 * - escalated: Escalated to higher authority
 * - approved: Final state - objective approved
 * - rejected: Final state - objective rejected
 * - withdrawn: Final state - objective withdrawn
 */

import { setup, assign } from 'xstate';
import type { ApprovalContext, ApprovalEvent, RiskLevel } from './types.js';

/**
 * Initial context for the approval workflow
 */
const initialContext: ApprovalContext = {
  objectiveId: '',
  documentId: '',
  submittedBy: '',
  submittedAt: new Date(),
  reviewers: [],
  approvals: [],
  currentReviewerIndex: 0,
  riskLevel: 'LOW' as RiskLevel,
  comments: [],
};

/**
 * Approval workflow state machine
 */
export const approvalMachine = setup({
  types: {
    context: {} as ApprovalContext,
    events: {} as ApprovalEvent,
  },
  guards: {
    /**
     * Check if all required reviewers have approved
     */
    allReviewersApproved: ({ context }) =>
      context.approvals.filter((a) => a.decision === 'APPROVE').length >= context.reviewers.length,

    /**
     * Check if any reviewer has rejected
     */
    hasRejection: ({ context: _context, event }) => {
      if (event.type !== 'REVIEW') return false;
      return event.decision === 'REJECT';
    },

    /**
     * Check if any reviewer has requested revision
     */
    hasRevisionRequest: ({ context: _context, event }) => {
      if (event.type !== 'REVIEW') return false;
      return event.decision === 'REQUEST_REVISION';
    },

    /**
     * Check if there are more reviewers to process
     */
    moreReviewersRemaining: ({ context }) =>
      context.currentReviewerIndex < context.reviewers.length - 1,
  },
  actions: {
    /**
     * Record an approval decision
     */
    recordApproval: assign({
      approvals: ({ context, event }) => {
        if (event.type !== 'REVIEW') return context.approvals;
        return [
          ...context.approvals,
          {
            reviewerId: event.reviewerId,
            decision: event.decision,
            comment: event.comment,
            decidedAt: new Date(),
          },
        ];
      },
    }),

    /**
     * Advance to the next reviewer
     */
    advanceReviewer: assign({
      currentReviewerIndex: ({ context }) => context.currentReviewerIndex + 1,
    }),

    /**
     * Set final decision to approved
     */
    setFinalApproved: assign({ finalDecision: 'APPROVED' as const }),

    /**
     * Set final decision to rejected
     */
    setFinalRejected: assign({ finalDecision: 'REJECTED' as const }),

    /**
     * Record escalation details
     */
    recordEscalation: assign({
      escalatedTo: ({ event }) => (event.type === 'ESCALATE' ? event.escalateTo : undefined),
      escalatedAt: () => new Date(),
    }),

    /**
     * Add a comment to the workflow
     */
    addComment: assign({
      comments: ({ context, event }) => {
        if (event.type !== 'ADD_COMMENT') return context.comments;
        return [
          ...context.comments,
          {
            authorId: event.authorId,
            content: event.content,
            createdAt: new Date(),
          },
        ];
      },
    }),

    /**
     * Reset approvals for resubmission
     */
    resetApprovals: assign({
      approvals: () => [],
      currentReviewerIndex: () => 0,
    }),
  },
}).createMachine({
  id: 'objectiveApproval',
  initial: 'draft',
  context: initialContext,
  states: {
    draft: {
      on: {
        SUBMIT: {
          target: 'pendingReview',
          actions: assign({
            objectiveId: ({ event }) => event.objectiveId,
            documentId: ({ event }) => event.documentId,
            submittedBy: ({ event }) => event.submittedBy,
            reviewers: ({ event }) => event.reviewers,
            riskLevel: ({ event }) => event.riskLevel,
            submittedAt: () => new Date(),
          }),
        },
      },
    },
    pendingReview: {
      on: {
        REVIEW: [
          {
            guard: 'hasRejection',
            target: 'rejected',
            actions: ['recordApproval', 'setFinalRejected'],
          },
          {
            guard: 'hasRevisionRequest',
            target: 'pendingRevision',
            actions: 'recordApproval',
          },
          {
            guard: 'allReviewersApproved',
            target: 'approved',
            actions: ['recordApproval', 'setFinalApproved'],
          },
          {
            guard: 'moreReviewersRemaining',
            actions: ['recordApproval', 'advanceReviewer'],
          },
          { actions: 'recordApproval' },
        ],
        WITHDRAW: 'withdrawn',
        ESCALATE: { target: 'escalated', actions: 'recordEscalation' },
        TIMEOUT: 'escalated',
        ADD_COMMENT: { actions: 'addComment' },
      },
    },
    pendingRevision: {
      on: {
        SUBMIT: {
          target: 'pendingReview',
          actions: 'resetApprovals',
        },
        WITHDRAW: 'withdrawn',
        ADD_COMMENT: { actions: 'addComment' },
      },
    },
    escalated: {
      on: {
        REVIEW: [
          {
            guard: 'hasRejection',
            target: 'rejected',
            actions: ['recordApproval', 'setFinalRejected'],
          },
          {
            target: 'approved',
            actions: ['recordApproval', 'setFinalApproved'],
          },
        ],
        ADD_COMMENT: { actions: 'addComment' },
      },
    },
    approved: { type: 'final' },
    rejected: { type: 'final' },
    withdrawn: { type: 'final' },
  },
});

export type ApprovalMachine = typeof approvalMachine;
