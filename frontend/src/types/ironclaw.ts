/**
 * Ironclaw Frontend Type Definitions
 *
 * CamelCase frontend types mirroring backend snake_case.
 * Duplicated per project convention (no shared package, backend authoritative).
 */

// ============================================================================
// Enums / Union Types
// ============================================================================

export type IronclawSender = 'user' | 'ironclaw' | 'specialist';
export type ActionRiskLevel = 'low' | 'medium' | 'high';
export type TrustDecision = 'yes' | 'no' | 'always';
export type StepStatus = 'pending' | 'running' | 'complete' | 'failed';

// ============================================================================
// Chat Messages
// ============================================================================

export interface IronclawChatMessage {
  id: string;
  problemSetId: string;
  content: string;
  sender: IronclawSender;
  specialistId?: string;
  specialistDisplayName?: string;
  delegatedBy?: string;
  actionCard?: ActionCardData;
  stepProgress?: StepProgressData;
  suggestion?: SuggestionData;
  threadId?: string;
  createdAt: string;
}

// ============================================================================
// Action Cards
// ============================================================================

export interface ActionCardData {
  actionId: string;
  actionType: string;
  description: string;
  /** Specific target — URL, file path, resource name, etc. */
  detail?: string | null;
  riskLevel: ActionRiskLevel;
  options: TrustDecision[];
}

// ============================================================================
// Step Progress
// ============================================================================

export interface StepProgressData {
  actionId: string;
  steps: StepInfo[];
  currentStep: number;
  startedAt: string;
}

export interface StepInfo {
  label: string;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
}

// ============================================================================
// Suggestions
// ============================================================================

export interface SuggestionData {
  id: string;
  content: string;
  agentId: string;
  agentDisplayName: string;
  actionType?: string;
  /** Target field path for write-back (e.g., 'problemStatement', 'design.cogAnalysis.friendly') */
  targetField?: string;
  /** Human-readable field label (e.g., 'Problem Statement') */
  targetFieldLabel?: string;
  /** The value to write to the field when accepted */
  fieldValue?: string;
}

// ============================================================================
// Task Orchestration
// ============================================================================

export interface IronclawTaskData {
  taskId: string;
  title: string;
  status: string;
  stepProgress: StepProgressData;
  suggestions: SuggestionData[];
  currentStep: number;
}

// ============================================================================
// Trust Preferences
// ============================================================================

export interface TrustPreference {
  id: string;
  actionType: string;
  problemSetId: string;
  grantedAt: string;
  expiresAt: string;
}

// ============================================================================
// Autonomous Activity Feed (Plan 65-05)
// ============================================================================

export interface AutonomousActivityEntry {
  id: string;
  problemSetId: string;
  activityType: string;
  severity: 'critical' | 'urgent' | 'routine' | 'informational';
  summary: string;
  detail: Record<string, unknown> | null;
  decisionId: string | null;
  createdAt: string; // ISO string from API
  // Phase 66-02: Commander feedback fields
  commanderRating?: number | null; // 1 = thumbs up, -1 = thumbs down, null = unrated
  commanderNotes?: string | null;
  outcomeStatus?: 'pending' | 'positive' | 'negative' | 'neutral';
}

// ============================================================================
// User Memory (Plan 03)
// ============================================================================

export interface IronclawMemoryEntry {
  id: string;
  memory_key: string;
  memory_value: Record<string, unknown>;
  confidence: number;
  source: 'inferred' | 'explicit';
  created_at: string;
  updated_at: string;
  expires_at: string;
}

// ============================================================================
// SSE Event Types (Phase 67)
// ============================================================================

export type IronclawSSEEventType = 'ack' | 'tool_call' | 'tool_result' | 'delegation' | 'progress' | 'response' | 'error';

export interface AckPayload { messageId: string; threadId?: string; }
export interface ToolCallPayload { toolName: string; status: StepStatus; statusMessage: string; input?: unknown; elapsed?: number; }
export interface ToolResultPayload { toolName: string; output: unknown; summary: string; elapsed: number; }
export interface DelegationPayload { specialistId: string; specialistDisplayName: string; status: 'delegating' | 'complete'; resultSummary?: string; }
export interface ProgressPayload { step: number; totalSteps: number; label: string; }
export interface ResponsePayload { content: string; delta?: boolean; done?: boolean; messageId?: string; threadId?: string; sender: 'ironclaw' | 'specialist'; specialistId?: string; specialistDisplayName?: string; }
export interface ErrorPayload { message: string; code?: string; retryable: boolean; originalMessageId?: string; }

/** Represents a streaming response being assembled from delta events */
export interface StreamingResponse {
  content: string;
  isStreaming: boolean;
  threadId?: string;
}

/** Tool call card state for progressive reveal (D-03, D-04) */
export interface ToolCallState {
  toolName: string;
  status: StepStatus;
  statusMessage: string;
  input?: unknown;
  output?: unknown;
  summary?: string;
  elapsed?: number;
  expanded: boolean;
}

/** Delegation state for chat notice (D-09) */
export interface DelegationState {
  specialistId: string;
  specialistDisplayName: string;
  status: 'delegating' | 'complete';
  resultSummary?: string;
}

/** Inline error state (D-06) */
export interface InlineErrorState {
  message: string;
  code?: string;
  retryable: boolean;
  originalMessageId?: string;
  retrying?: boolean;
}

/** SSE connection readiness */
export type SSEConnectionState = 'connecting' | 'open' | 'closed';
