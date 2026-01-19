/**
 * Strategic Objective Approval Workflow
 *
 * XState v5 workflow engine for multi-stakeholder approval process.
 * Exports workflow types, machine, and engine.
 */

// Export types
export type {
  RiskLevel,
  ApprovalDecisionType,
  FinalDecision,
  ApprovalDecision,
  WorkflowComment,
  ApprovalContext,
  ApprovalEvent,
  WorkflowStateName,
  WorkflowStatus,
  WorkflowHistoryEntry,
} from './types.js';

// Export state machine
export { approvalMachine, type ApprovalMachine } from './approval-machine.js';

// Export engine
export { WorkflowEngine } from './engine.js';

// Singleton instance for convenience
import { WorkflowEngine } from './engine.js';
export const workflowEngine = new WorkflowEngine();
