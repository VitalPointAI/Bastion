/**
 * Ironclaw SSE Event Type Taxonomy
 *
 * Phase 67 Plan 01: Defines all typed event payloads for the Ironclaw
 * Server-Sent Events stream. Uses const objects (not enums) per project
 * erasableSyntaxOnly convention.
 */

// ---------------------------------------------------------------------------
// Event type registry
// ---------------------------------------------------------------------------

export const IronclawEventType = {
  ack: 'ack',
  tool_call: 'tool_call',
  tool_result: 'tool_result',
  delegation: 'delegation',
  progress: 'progress',
  response: 'response',
  error: 'error',
} as const;
export type IronclawEventType = (typeof IronclawEventType)[keyof typeof IronclawEventType];

// ---------------------------------------------------------------------------
// Payload interfaces — one per event type
// ---------------------------------------------------------------------------

/**
 * ack — confirms a message was received by the backend.
 * Sent immediately after the user's message is accepted.
 */
export interface AckPayload {
  messageId: string;
  threadId?: string;
}

/**
 * tool_call — lifecycle update for a tool invocation.
 * Per design doc D-04: pending → running → complete | failed.
 */
export interface ToolCallPayload {
  toolName: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  statusMessage: string;
  input?: unknown;
  elapsed?: number;
}

/**
 * tool_result — final output of a completed tool call.
 */
export interface ToolResultPayload {
  toolName: string;
  output: unknown;
  summary: string;
  elapsed: number;
}

/**
 * delegation — Ironclaw delegating to a specialist agent.
 * Per design doc D-09.
 */
export interface DelegationPayload {
  specialistId: string;
  specialistDisplayName: string;
  status: 'delegating' | 'complete';
  resultSummary?: string;
}

/**
 * progress — generic multi-step progress indicator.
 */
export interface ProgressPayload {
  step: number;
  totalSteps: number;
  label: string;
}

/**
 * response — Ironclaw's final (or streaming token) response.
 * Per design doc D-05: delta=true for token chunks, done=true for final message.
 */
export interface ResponsePayload {
  content: string;
  delta?: boolean;
  done?: boolean;
  messageId?: string;
  threadId?: string;
  sender: 'ironclaw' | 'specialist';
  specialistId?: string;
  specialistDisplayName?: string;
}

/**
 * error — surface errors to the client.
 * Per design doc D-06.
 */
export interface ErrorPayload {
  message: string;
  code?: string;
  retryable: boolean;
  originalMessageId?: string;
}

// ---------------------------------------------------------------------------
// Generic event envelope (matches ironclaw_events DB row)
// ---------------------------------------------------------------------------

export interface IronclawEvent<T = unknown> {
  id: number;
  scopeId: string;
  userDid: string;
  threadId: string | null;
  eventType: IronclawEventType;
  payload: T;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Payload type map (for use with generics)
// ---------------------------------------------------------------------------

export interface IronclawPayloadMap {
  ack: AckPayload;
  tool_call: ToolCallPayload;
  tool_result: ToolResultPayload;
  delegation: DelegationPayload;
  progress: ProgressPayload;
  response: ResponsePayload;
  error: ErrorPayload;
}
