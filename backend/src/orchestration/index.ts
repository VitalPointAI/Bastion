/**
 * Orchestration Module
 *
 * LangGraph integration for multi-agent orchestration with:
 * - PostgresSaver checkpointing for state persistence
 * - Classification-aware state filtering (ABAC enforcement)
 * - Supervisor pattern for hierarchical agent coordination
 * - CrewAI-style execution patterns (sequential, parallel, hierarchical)
 * - Comprehensive observability and tracing
 * - Human-in-the-loop checkpoints for oversight
 *
 * Architecture:
 * - Wraps existing Eliza-style agents as LangGraph-compatible nodes
 * - Preserves existing DID, ABAC, and provider infrastructure
 * - State filtering happens BEFORE every agent invocation
 * - All filtering decisions are audited
 *
 * @module orchestration
 */

// Checkpointing - PostgresSaver for state persistence
export { getCheckpointer, closeCheckpointer, isCheckpointerInitialized, getCheckpointerSchema } from './checkpointer.js';

// State - BastionStateAnnotation for multi-agent workflows
export {
  BastionStateAnnotation,
  type BastionState,
  type ExecutionTraceEntry,
  type ClassificationLevel,
  type InterruptSignal,
  CLASSIFICATION_ORDER,
  createInitialState,
  createTaskState,
  classificationDominates,
  maxClassification,
  isMessageAccessible,
} from './state.js';

// Classification Filter - ABAC enforcement between agents
export {
  ClassificationFilter,
  getClassificationFilter,
  createClassificationFilterNode,
  type FilterDecision,
  type FilterAuditEntry,
} from './classification-filter.js';

// Agent Wrapper - Bridge Eliza agents to LangGraph
export {
  LangGraphAgentWrapper,
  createLangGraphAgent,
  createTestAgent,
  type AgentWrapperConfig,
} from './agent-wrapper.js';

// Supervisor - Hierarchical agent coordination
export {
  BastionSupervisor,
  createSupervisor,
  createStrategicPlanningSupervisor,
  createDocumentProcessingSupervisor,
  type SupervisorConfig,
  type SupervisorInput,
  type SupervisorOutput,
} from './supervisor.js';

// Execution Patterns - CrewAI-style orchestration
export {
  TaskExecutor,
  ExecutionPattern,
  createTaskExecutor,
  createTask,
  type Task,
  type TaskResult,
  type TaskResults,
  type MergeStrategy,
} from './execution-patterns.js';

// Observability - Tracing and metrics
export {
  ExecutionTracer,
  getTracer,
  type ExecutionTrace,
  type TraceSpan,
  type AgentInvocation,
  type ToolCall,
  type FilterDecision as TraceFilterDecision,
  type ExecutionGraph,
  type GraphNode,
  type GraphEdge,
  type TracingMetrics,
} from './observability.js';

// Human Checkpoints - Human-in-the-loop oversight
export {
  HumanCheckpointManager,
  getCheckpointManager,
  CheckpointTriggerType,
  type CheckpointTrigger,
  type PendingCheckpoint,
  type HumanDecision,
  type ResumeResult,
} from './human-checkpoints.js';

// Re-export LangGraph types for convenience
export type { StateGraph } from '@langchain/langgraph';
export type { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
