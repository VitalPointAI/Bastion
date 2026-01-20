/**
 * Agent State Annotation
 *
 * Defines the LangGraph state annotation for multi-agent workflows
 * with classification support. Extends MessagesAnnotation with:
 * - Security context (classification, clearance)
 * - Routing information
 * - Task context
 * - Execution metadata
 *
 * All state transitions are type-safe through Annotation.Root().
 */

import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

/**
 * Classification levels - matches ABAC enforcer
 */
export type ClassificationLevel =
  | 'UNCLASS'
  | 'CUI'
  | 'CONFIDENTIAL'
  | 'SECRET'
  | 'TOPSECRET';

/**
 * Classification level ordering (higher = more restricted)
 */
export const CLASSIFICATION_ORDER: Record<ClassificationLevel, number> = {
  UNCLASS: 1,
  CUI: 2,
  CONFIDENTIAL: 3,
  SECRET: 4,
  TOPSECRET: 5,
};

/**
 * Execution trace entry for observability
 */
export interface ExecutionTraceEntry {
  /** Unique span ID */
  spanId: string;
  /** Parent span ID for hierarchical traces */
  parentSpanId?: string;
  /** Agent that executed */
  agentId: string;
  /** Operation performed */
  operation: string;
  /** Start timestamp */
  startedAt: string;
  /** Completion timestamp */
  completedAt?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Input token count */
  inputTokens?: number;
  /** Output token count */
  outputTokens?: number;
  /** Status */
  status: 'running' | 'success' | 'error';
  /** Error message if failed */
  error?: string;
  /** Classification at time of execution */
  classification: ClassificationLevel;
  /** Whether content was filtered */
  wasFiltered: boolean;
  /** Items filtered (count) */
  filteredCount?: number;
}

/**
 * Interrupt signal for human checkpoints
 */
export interface InterruptSignal {
  /** Checkpoint ID */
  checkpointId: string;
  /** Reason for interrupt */
  reason: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * BastionStateAnnotation - Main state type for multi-agent workflows
 *
 * Extends LangGraph's MessagesAnnotation with security and task context.
 */
export const BastionStateAnnotation = Annotation.Root({
  // Inherit messages from MessagesAnnotation
  // Messages are accumulated across agent invocations
  ...MessagesAnnotation.spec,

  // ========================================================================
  // Security Context
  // ========================================================================

  /**
   * Current classification level of the workflow
   * Content at higher levels cannot flow to lower-clearance agents
   */
  classification: Annotation<ClassificationLevel>({
    reducer: (current, update) => update ?? current,
    default: () => 'UNCLASS' as ClassificationLevel,
  }),

  /**
   * Clearance level of the current agent
   * Set by classification filter before agent invocation
   */
  agentClearance: Annotation<ClassificationLevel>({
    reducer: (current, update) => update ?? current,
    default: () => 'UNCLASS' as ClassificationLevel,
  }),

  /**
   * Originator DID for ORCON enforcement
   */
  originator: Annotation<string | null>({
    reducer: (current, update) => update ?? current,
    default: () => null,
  }),

  /**
   * Releasability constraints (e.g., ['USA', 'GBR', 'FVEY'])
   */
  releasability: Annotation<string[]>({
    reducer: (current, update) => update ?? current,
    default: () => [],
  }),

  // ========================================================================
  // Routing
  // ========================================================================

  /**
   * Next agent to route to (set by supervisor or explicit routing)
   * null means workflow is complete
   */
  next: Annotation<string | null>({
    reducer: (current, update) => update,
    default: () => null,
  }),

  /**
   * Current agent being executed
   */
  currentAgent: Annotation<string | null>({
    reducer: (current, update) => update ?? current,
    default: () => null,
  }),

  /**
   * Previous agent (for context)
   */
  previousAgent: Annotation<string | null>({
    reducer: (current, update) => update ?? current,
    default: () => null,
  }),

  // ========================================================================
  // Task Context
  // ========================================================================

  /**
   * Unique task identifier
   */
  taskId: Annotation<string>({
    reducer: (current, update) => update ?? current,
    default: () => '',
  }),

  /**
   * Task type for routing decisions
   */
  taskType: Annotation<string>({
    reducer: (current, update) => update ?? current,
    default: () => 'general',
  }),

  /**
   * Task objectives for agent guidance
   */
  objectives: Annotation<string[]>({
    reducer: (current, update) => update ?? current,
    default: () => [],
  }),

  /**
   * Task-specific input data
   */
  taskInput: Annotation<Record<string, unknown>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({}),
  }),

  /**
   * Accumulated task output from agents
   */
  taskOutput: Annotation<Record<string, unknown>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({}),
  }),

  // ========================================================================
  // Execution Metadata
  // ========================================================================

  /**
   * Thread ID for checkpointing
   */
  threadId: Annotation<string>({
    reducer: (current, update) => update ?? current,
    default: () => '',
  }),

  /**
   * Trace ID for observability
   */
  traceId: Annotation<string>({
    reducer: (current, update) => update ?? current,
    default: () => '',
  }),

  /**
   * Creation timestamp
   */
  createdAt: Annotation<string>({
    reducer: (current, update) => update ?? current,
    default: () => new Date().toISOString(),
  }),

  /**
   * Execution trace entries (appended)
   */
  executionTrace: Annotation<ExecutionTraceEntry[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  /**
   * Interrupt signal for human checkpoints
   * Non-null triggers workflow pause
   */
  interrupt: Annotation<InterruptSignal | null>({
    reducer: (current, update) => update,
    default: () => null,
  }),

  /**
   * Number of agent invocations (for loop detection)
   */
  invocationCount: Annotation<number>({
    reducer: (current, update) => (update !== undefined ? update : current + 1),
    default: () => 0,
  }),

  /**
   * Maximum allowed invocations before forced termination
   */
  maxInvocations: Annotation<number>({
    reducer: (current, update) => update ?? current,
    default: () => 50,
  }),

  /**
   * Arbitrary metadata for extensibility
   */
  metadata: Annotation<Record<string, unknown>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({}),
  }),
});

/**
 * Type alias for the state shape
 */
export type BastionState = typeof BastionStateAnnotation.State;

// ============================================================================
// State Factory Functions
// ============================================================================

/**
 * Create initial state for a new workflow
 */
export function createInitialState(params: {
  threadId: string;
  traceId?: string;
  classification?: ClassificationLevel;
  originator?: string;
  releasability?: string[];
  maxInvocations?: number;
  metadata?: Record<string, unknown>;
}): Partial<BastionState> {
  const now = new Date().toISOString();

  return {
    messages: [],
    classification: params.classification ?? 'UNCLASS',
    agentClearance: 'UNCLASS',
    originator: params.originator ?? null,
    releasability: params.releasability ?? [],
    next: null,
    currentAgent: null,
    previousAgent: null,
    taskId: '',
    taskType: 'general',
    objectives: [],
    taskInput: {},
    taskOutput: {},
    threadId: params.threadId,
    traceId: params.traceId ?? params.threadId,
    createdAt: now,
    executionTrace: [],
    interrupt: null,
    invocationCount: 0,
    maxInvocations: params.maxInvocations ?? 50,
    metadata: params.metadata ?? {},
  };
}

/**
 * Create state for a specific task
 */
export function createTaskState(params: {
  threadId: string;
  taskId: string;
  taskType: string;
  objectives: string[];
  classification?: ClassificationLevel;
  originator?: string;
  releasability?: string[];
  input?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Partial<BastionState> {
  return {
    ...createInitialState({
      threadId: params.threadId,
      classification: params.classification,
      originator: params.originator,
      releasability: params.releasability,
      metadata: params.metadata,
    }),
    taskId: params.taskId,
    taskType: params.taskType,
    objectives: params.objectives,
    taskInput: params.input ?? {},
  };
}

/**
 * Check if classification level A dominates (is >= ) level B
 */
export function classificationDominates(
  a: ClassificationLevel,
  b: ClassificationLevel
): boolean {
  return CLASSIFICATION_ORDER[a] >= CLASSIFICATION_ORDER[b];
}

/**
 * Get the maximum classification from a list
 */
export function maxClassification(
  levels: ClassificationLevel[]
): ClassificationLevel {
  if (levels.length === 0) return 'UNCLASS';

  return levels.reduce((max, level) =>
    CLASSIFICATION_ORDER[level] > CLASSIFICATION_ORDER[max] ? level : max
  );
}

/**
 * Check if message classification is at or below clearance
 */
export function isMessageAccessible(
  messageClassification: ClassificationLevel,
  agentClearance: ClassificationLevel
): boolean {
  return CLASSIFICATION_ORDER[messageClassification] <= CLASSIFICATION_ORDER[agentClearance];
}
