/**
 * Ironclaw Task Types
 *
 * Phase 52 Plan 05: Task state machine types for the autonomous orchestration loop.
 * Tasks represent complex multi-agent work items dispatched by Ironclaw.
 */

// ---------------------------------------------------------------------------
// Task Status State Machine
// ---------------------------------------------------------------------------

export type TaskStatus =
  | 'created'
  | 'dispatched'
  | 'agent_working'
  | 'collecting_results'
  | 'presenting'
  | 'awaiting_approval'
  | 'applying'
  | 'completed'
  | 'refining'
  | 'rejected'
  | 'failed';

/** Valid state transitions — enforced at store level. */
export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  created: ['dispatched', 'failed'],
  dispatched: ['agent_working', 'failed'],
  agent_working: ['collecting_results', 'failed'],
  collecting_results: ['presenting', 'failed'],
  presenting: ['awaiting_approval'],
  awaiting_approval: ['applying', 'refining', 'rejected'],
  applying: ['completed', 'failed'],
  refining: ['dispatched'],
  completed: [],
  rejected: [],
  failed: [],
};

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------

export interface StepInfo {
  index: number;
  label: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  agentId?: string;
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
}

export interface TaskResult {
  agentId: string;
  agentName: string;
  output: string;
  fieldPath?: string;
  timestamp: string;
}

export interface TaskSuggestion {
  id: string;
  fieldPath: string;
  fieldLabel: string;
  content: string;
  agentId: string;
  status: 'pending' | 'approved' | 'dismissed' | 'revision_requested';
}

export interface FeedbackEntry {
  timestamp: string;
  feedback: string;
  suggestionId?: string;
}

// ---------------------------------------------------------------------------
// IronclawTask
// ---------------------------------------------------------------------------

export interface IronclawTask {
  taskId: string;
  problemSetId: string;
  userDid: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignedAgents: string[];
  assignedTeam: string | null;
  threadId: string | null;
  steps: StepInfo[];
  currentStep: number;
  results: TaskResult[];
  suggestions: TaskSuggestion[];
  targetFields: Record<string, string>;
  userFeedback: FeedbackEntry[];
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Create Params
// ---------------------------------------------------------------------------

export interface CreateTaskParams {
  problemSetId: string;
  userDid: string;
  title: string;
  description?: string;
  targetFields: Record<string, string>;
  agentHints?: string[];
}

// ---------------------------------------------------------------------------
// Role-based Field Permissions
// ---------------------------------------------------------------------------

export const ROLE_FIELD_PERMISSIONS: Record<string, string[]> = {
  commander: ['*'],
  xo: ['*'],
  j2_intelligence: ['design.problemFraming', 'design.cogAnalysis.*', 'intelligence.*'],
  j3_operations: ['design.operationalApproach', 'design.linesOfEffort', 'plan.coaDetails.*'],
  j4_logistics: ['plan.sustainment.*', 'logistics.*'],
  j5_plans: ['design.*', 'plan.*', 'campaign.*'],
  j6_communications: ['plan.commandSignal.*', 'communications.*'],
};
