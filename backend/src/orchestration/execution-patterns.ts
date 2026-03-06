/**
 * Task Execution Patterns
 *
 * Implements CrewAI-style execution patterns within LangGraph:
 * - Sequential: Pipeline execution (A -> B -> C)
 * - Parallel: Fan-out/fan-in execution ([A, B, C] -> merge)
 * - Hierarchical: Manager delegates to workers
 * - Consensus: All agents must agree
 *
 * Features:
 * - Task dependencies
 * - Result aggregation strategies
 * - Partial failure handling
 * - Classification-aware execution
 */

import { randomUUID } from 'crypto';
import {
  type BastionState,
  type ClassificationLevel,
  type ExecutionTraceEntry,
  createTaskState,
} from './state.js';
import { LangGraphAgentWrapper } from './agent-wrapper.js';
import { getClassificationFilter } from './classification-filter.js';
import { BastionSupervisor } from './supervisor.js';

/**
 * Execution pattern types
 */
export enum ExecutionPattern {
  /** Pipeline: A -> B -> C */
  Sequential = 'sequential',
  /** Fan-out/fan-in: [A, B, C] -> merge */
  Parallel = 'parallel',
  /** Manager delegates to workers */
  Hierarchical = 'hierarchical',
  /** All agents must agree */
  Consensus = 'consensus',
}

/**
 * Task definition
 */
export interface Task {
  /** Unique task ID */
  taskId: string;
  /** Task name for display */
  name: string;
  /** Task description/instructions */
  description: string;
  /** Expected output format */
  expectedOutput?: string;
  /** Assigned agent ID (if explicit) */
  assignedAgent?: string;
  /** Required capabilities (for dynamic assignment) */
  requiredCapabilities?: string[];
  /** Task dependencies (other task IDs) */
  dependencies?: string[];
  /** Task classification level */
  classification: ClassificationLevel;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Priority (higher = more important) */
  priority?: number;
}

/**
 * Individual task result
 */
export interface TaskResult {
  /** Task that was executed */
  taskId: string;
  /** Agent that executed the task */
  agentId: string;
  /** Success status */
  success: boolean;
  /** Output from the agent */
  output: Record<string, unknown>;
  /** Error if failed */
  error?: string;
  /** Execution duration in ms */
  durationMs: number;
  /** Token usage */
  tokenUsage?: {
    input: number;
    output: number;
  };
}

/**
 * Aggregated task results
 */
export interface TaskResults {
  /** Execution pattern used */
  pattern: ExecutionPattern;
  /** Overall success (all tasks succeeded) */
  success: boolean;
  /** Individual task results */
  results: TaskResult[];
  /** Merged output (pattern-specific) */
  mergedOutput: Record<string, unknown>;
  /** Total execution time */
  totalDurationMs: number;
  /** Final state after execution */
  finalState: BastionState;
  /** Execution trace */
  trace: ExecutionTraceEntry[];
}

/**
 * Merge strategy for parallel results
 */
export type MergeStrategy =
  | 'concatenate'  // Combine all outputs
  | 'latest'       // Take most recent
  | 'majority'     // Take majority result (for consensus)
  | 'custom';      // Custom merge function

/**
 * TaskExecutor - Orchestrates task execution with different patterns
 */
export class TaskExecutor {
  private agents: Map<string, LangGraphAgentWrapper> = new Map();

  constructor(agents: LangGraphAgentWrapper[]) {
    for (const agent of agents) {
      this.agents.set(agent.agentId, agent);
    }
  }

  /**
   * Execute tasks with specified pattern
   */
  async execute(
    tasks: Task[],
    pattern: ExecutionPattern,
    threadId: string,
    options?: {
      classification?: ClassificationLevel;
      mergeStrategy?: MergeStrategy;
      customMerge?: (results: TaskResult[]) => Record<string, unknown>;
      manager?: LangGraphAgentWrapper;
    }
  ): Promise<TaskResults> {
    const classification = options?.classification || 'UNCLASS';

    switch (pattern) {
      case ExecutionPattern.Sequential:
        return this.executeSequential(tasks, threadId, classification);
      case ExecutionPattern.Parallel:
        return this.executeParallel(
          tasks,
          threadId,
          classification,
          options?.mergeStrategy || 'concatenate',
          options?.customMerge
        );
      case ExecutionPattern.Hierarchical:
        if (!options?.manager) {
          throw new Error('Hierarchical execution requires a manager agent');
        }
        return this.executeHierarchical(tasks, options.manager, threadId, classification);
      case ExecutionPattern.Consensus:
        return this.executeConsensus(tasks, threadId, classification);
      default:
        throw new Error(`Unknown execution pattern: ${pattern}`);
    }
  }

  /**
   * Sequential execution - tasks run in order (pipeline)
   */
  async executeSequential(
    tasks: Task[],
    threadId: string,
    classification: ClassificationLevel
  ): Promise<TaskResults> {
    const startTime = Date.now();
    const results: TaskResult[] = [];
    const trace: ExecutionTraceEntry[] = [];

    // Sort by dependencies (topological sort)
    const sortedTasks = this.topologicalSort(tasks);

    // Create initial state
    let currentState: BastionState = {
      ...createTaskState({
        threadId,
        taskId: sortedTasks[0]?.taskId || 'pipeline',
        taskType: 'sequential-pipeline',
        objectives: sortedTasks.map(t => t.description),
        classification,
      }),
      messages: [],
      invocationCount: 0,
    } as BastionState;

    // Execute tasks in sequence
    for (const task of sortedTasks) {
      const taskStart = Date.now();

      // Find agent for task
      const agent = this.findAgentForTask(task);
      if (!agent) {
        results.push({
          taskId: task.taskId,
          agentId: 'none',
          success: false,
          output: {},
          error: `No agent found for task ${task.taskId}`,
          durationMs: Date.now() - taskStart,
        });
        continue;
      }

      // Apply classification filter
      const filter = getClassificationFilter();
      currentState = await filter.filterState(
        currentState,
        agent.agentId,
        agent.getClearance()
      );

      // Execute agent
      try {
        const agentNode = agent.createNode();
        const update = await agentNode(currentState);
        currentState = { ...currentState, ...update };

        results.push({
          taskId: task.taskId,
          agentId: agent.agentId,
          success: true,
          output: currentState.taskOutput,
          durationMs: Date.now() - taskStart,
        });
      } catch (error) {
        results.push({
          taskId: task.taskId,
          agentId: agent.agentId,
          success: false,
          output: {},
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - taskStart,
        });
      }

      trace.push(...currentState.executionTrace.slice(-1));
    }

    // Merge results
    const mergedOutput = this.mergeSequentialResults(results);

    return {
      pattern: ExecutionPattern.Sequential,
      success: results.every(r => r.success),
      results,
      mergedOutput,
      totalDurationMs: Date.now() - startTime,
      finalState: currentState,
      trace,
    };
  }

  /**
   * Parallel execution - tasks run concurrently (fan-out/fan-in)
   */
  async executeParallel(
    tasks: Task[],
    threadId: string,
    classification: ClassificationLevel,
    mergeStrategy: MergeStrategy,
    customMerge?: (results: TaskResult[]) => Record<string, unknown>
  ): Promise<TaskResults> {
    const startTime = Date.now();
    const filter = getClassificationFilter();

    // Create initial state
    const baseState: BastionState = {
      ...createTaskState({
        threadId,
        taskId: 'parallel-fanout',
        taskType: 'parallel-execution',
        objectives: tasks.map(t => t.description),
        classification,
      }),
      messages: [],
      invocationCount: 0,
    } as BastionState;

    // Execute all tasks in parallel
    const taskPromises = tasks.map(async (task): Promise<TaskResult> => {
      const taskStart = Date.now();

      // Find agent for task
      const agent = this.findAgentForTask(task);
      if (!agent) {
        return {
          taskId: task.taskId,
          agentId: 'none',
          success: false,
          output: {},
          error: `No agent found for task ${task.taskId}`,
          durationMs: Date.now() - taskStart,
        };
      }

      // Create filtered state for this agent
      let taskState = await filter.filterState(
        { ...baseState, taskId: task.taskId },
        agent.agentId,
        agent.getClearance()
      );

      // Execute agent
      try {
        const agentNode = agent.createNode();
        const update = await agentNode(taskState);
        taskState = { ...taskState, ...update };

        return {
          taskId: task.taskId,
          agentId: agent.agentId,
          success: true,
          output: taskState.taskOutput,
          durationMs: Date.now() - taskStart,
        };
      } catch (error) {
        return {
          taskId: task.taskId,
          agentId: agent.agentId,
          success: false,
          output: {},
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - taskStart,
        };
      }
    });

    // Wait for all tasks
    const results = await Promise.all(taskPromises);

    // Merge results based on strategy
    let mergedOutput: Record<string, unknown>;
    if (mergeStrategy === 'custom' && customMerge) {
      mergedOutput = customMerge(results);
    } else {
      mergedOutput = this.mergeParallelResults(results, mergeStrategy);
    }

    return {
      pattern: ExecutionPattern.Parallel,
      success: results.every(r => r.success),
      results,
      mergedOutput,
      totalDurationMs: Date.now() - startTime,
      finalState: { ...baseState, taskOutput: mergedOutput },
      trace: [], // Parallel doesn't have linear trace
    };
  }

  /**
   * Hierarchical execution - manager delegates to workers
   */
  async executeHierarchical(
    tasks: Task[],
    manager: LangGraphAgentWrapper,
    threadId: string,
    classification: ClassificationLevel
  ): Promise<TaskResults> {
    const startTime = Date.now();

    // Create supervisor from manager and available agents
    const workers = tasks
      .map(t => this.findAgentForTask(t))
      .filter((a): a is LangGraphAgentWrapper => a !== null);

    const supervisor = new BastionSupervisor({
      supervisorId: manager.agentId,
      name: manager.name,
      description: manager.getDescription(),
      clearance: manager.getClearance(),
      maxIterations: tasks.length * 3, // Allow some back-and-forth
    }, workers);

    await supervisor.initialize();

    // Execute through supervisor
    const supervisorResult = await supervisor.execute({
      threadId,
      messages: [],
      classification,
      taskType: 'hierarchical-delegation',
      objectives: tasks.map(t => t.description),
    });

    // Extract results from trace
    const results: TaskResult[] = supervisorResult.invokedAgents.map(agentId => ({
      taskId: tasks.find(t => t.assignedAgent === agentId)?.taskId || agentId,
      agentId,
      success: true,
      output: {},
      durationMs: 0, // Individual timing not available from supervisor
    }));

    return {
      pattern: ExecutionPattern.Hierarchical,
      success: supervisorResult.completed,
      results,
      mergedOutput: supervisorResult.state.taskOutput,
      totalDurationMs: Date.now() - startTime,
      finalState: supervisorResult.state,
      trace: supervisorResult.trace,
    };
  }

  /**
   * Consensus execution - all agents must agree
   */
  async executeConsensus(
    tasks: Task[],
    threadId: string,
    classification: ClassificationLevel
  ): Promise<TaskResults> {
    const _startTime = Date.now();

    // For consensus, we execute in parallel and then check for agreement
    const parallelResults = await this.executeParallel(
      tasks,
      threadId,
      classification,
      'concatenate'
    );

    // Check for consensus in results
    const successfulResults = parallelResults.results.filter(r => r.success);

    if (successfulResults.length < tasks.length) {
      // Not all tasks succeeded, no consensus possible
      return {
        ...parallelResults,
        pattern: ExecutionPattern.Consensus,
        success: false,
        mergedOutput: {
          consensus: false,
          reason: 'Not all agents completed successfully',
          agreementRatio: successfulResults.length / tasks.length,
        },
      };
    }

    // Check if outputs are consistent (simplified check)
    const isConsensus = this.checkConsensus(successfulResults);

    return {
      ...parallelResults,
      pattern: ExecutionPattern.Consensus,
      success: isConsensus,
      mergedOutput: isConsensus
        ? this.mergeParallelResults(successfulResults, 'majority')
        : {
            consensus: false,
            reason: 'Agents did not reach consensus',
            results: successfulResults.map(r => r.output),
          },
    };
  }

  /**
   * Find an agent for a task based on assignment or capabilities
   */
  private findAgentForTask(task: Task): LangGraphAgentWrapper | null {
    // Check explicit assignment
    if (task.assignedAgent) {
      return this.agents.get(task.assignedAgent) || null;
    }

    // Find by capabilities (simplified - just return first available)
    // In production, this would match required capabilities
    for (const agent of this.agents.values()) {
      return agent;
    }

    return null;
  }

  /**
   * Topological sort for task dependencies
   */
  private topologicalSort(tasks: Task[]): Task[] {
    const taskMap = new Map(tasks.map(t => [t.taskId, t]));
    const visited = new Set<string>();
    const result: Task[] = [];

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const task = taskMap.get(taskId);
      if (!task) return;

      // Visit dependencies first
      for (const depId of task.dependencies || []) {
        visit(depId);
      }

      result.push(task);
    };

    for (const task of tasks) {
      visit(task.taskId);
    }

    return result;
  }

  /**
   * Merge sequential results (each builds on previous)
   */
  private mergeSequentialResults(results: TaskResult[]): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    for (const result of results) {
      if (result.success) {
        Object.assign(merged, result.output);
        merged[`${result.taskId}_output`] = result.output;
      }
    }

    return merged;
  }

  /**
   * Merge parallel results based on strategy
   */
  private mergeParallelResults(
    results: TaskResult[],
    strategy: MergeStrategy
  ): Record<string, unknown> {
    switch (strategy) {
      case 'concatenate':
        return {
          outputs: results.map(r => ({
            taskId: r.taskId,
            agentId: r.agentId,
            ...r.output,
          })),
        };

      case 'latest': {
        const latest = results.filter(r => r.success).pop();
        return latest?.output || {};
      }

      case 'majority':
        // For now, just return concatenated (proper majority voting needs structured output)
        return {
          outputs: results.map(r => ({
            taskId: r.taskId,
            agentId: r.agentId,
            ...r.output,
          })),
          votingResult: 'majority_not_implemented',
        };

      default:
        return {};
    }
  }

  /**
   * Check if results represent consensus
   * Simplified implementation - in production would compare outputs semantically
   */
  private checkConsensus(results: TaskResult[]): boolean {
    if (results.length < 2) return true;

    // For now, just check that all outputs have same keys
    const keySignatures = results.map(r =>
      Object.keys(r.output).sort().join(',')
    );

    return keySignatures.every(sig => sig === keySignatures[0]);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a task executor with given agents
 */
export function createTaskExecutor(agents: LangGraphAgentWrapper[]): TaskExecutor {
  return new TaskExecutor(agents);
}

/**
 * Create a simple task definition
 */
export function createTask(params: {
  name: string;
  description: string;
  classification?: ClassificationLevel;
  assignedAgent?: string;
  dependencies?: string[];
}): Task {
  return {
    taskId: randomUUID(),
    name: params.name,
    description: params.description,
    classification: params.classification || 'UNCLASS',
    assignedAgent: params.assignedAgent,
    dependencies: params.dependencies,
  };
}
