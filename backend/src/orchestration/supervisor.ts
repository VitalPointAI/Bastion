/**
 * Supervisor Implementation
 *
 * Implements the supervisor pattern for hierarchical agent coordination.
 * The supervisor routes tasks to appropriate agents based on:
 * - Agent capabilities and specialization
 * - Security clearance levels
 * - Task requirements and classification
 *
 * Features:
 * - Dynamic agent routing with LLM-based decision making
 * - Classification-aware handoffs with pre-filtering
 * - Checkpointing for fault recovery
 * - Configurable routing rules and escalation policies
 */

import { randomUUID } from 'crypto';
import { StateGraph, END, START } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import {
  BastionStateAnnotation,
  type BastionState,
  type ClassificationLevel,
  type ExecutionTraceEntry,
  CLASSIFICATION_ORDER,
} from './state.js';
import { LangGraphAgentWrapper } from './agent-wrapper.js';
import { getClassificationFilter, createClassificationFilterNode } from './classification-filter.js';
import { getCheckpointer } from './checkpointer.js';
import { getActivityLogger } from '../agents/activity-logger.js';
import { createLLMForAgent } from '../agents/langgraph/llm-factory.js';

/**
 * Supervisor configuration
 */
export interface SupervisorConfig {
  /** Supervisor ID */
  supervisorId: string;
  /** Name for display/logging */
  name: string;
  /** Description of supervisor's purpose */
  description: string;
  /** LLM model for routing decisions */
  model?: BaseChatModel;
  /** Provider type if model not specified */
  providerType?: 'anthropic' | 'openai';
  /** Model name if model not specified */
  modelName?: string;
  /** Supervisor's clearance level */
  clearance: ClassificationLevel;
  /** Custom routing prompt */
  routingPrompt?: string;
  /** Maximum iterations before forced termination */
  maxIterations?: number;
  /** Human checkpoint triggers */
  humanCheckpoints?: {
    /** Trigger on classification escalation */
    onClassificationEscalation?: boolean;
    /** Trigger on specific task types */
    onTaskTypes?: string[];
    /** Trigger after N iterations */
    afterIterations?: number;
  };
}

/**
 * Input for supervisor execution
 */
export interface SupervisorInput {
  /** Thread ID for checkpointing */
  threadId: string;
  /** Initial messages */
  messages: BaseMessage[];
  /** Task classification */
  classification: ClassificationLevel;
  /** Task type for routing hints */
  taskType?: string;
  /** Task objectives */
  objectives?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Output from supervisor execution
 */
export interface SupervisorOutput {
  /** Final state */
  state: BastionState;
  /** Execution trace */
  trace: ExecutionTraceEntry[];
  /** Agents that were invoked */
  invokedAgents: string[];
  /** Final routing decision */
  finalDecision: string;
  /** Whether execution completed or was interrupted */
  completed: boolean;
  /** Interrupt reason if not completed */
  interruptReason?: string;
}

/**
 * Agent info for routing
 */
interface AgentInfo {
  id: string;
  name: string;
  description: string;
  clearance: ClassificationLevel;
  canReceive: boolean;
  reason?: string;
}

/**
 * BastionSupervisor - Hierarchical agent coordination
 */
export class BastionSupervisor {
  private config: SupervisorConfig;
  private agents: LangGraphAgentWrapper[];
  private model: BaseChatModel | null = null;
  private compiled: ReturnType<StateGraph<typeof BastionStateAnnotation>['compile']> | null = null;

  constructor(config: SupervisorConfig, agents: LangGraphAgentWrapper[]) {
    this.config = config;
    this.agents = agents;

    // Pre-set model if provided directly; otherwise defer to initialize()
    if (config.model) {
      this.model = config.model;
    }
  }

  /**
   * Initialize and compile the supervisor graph
   */
  async initialize(): Promise<void> {
    // Create model if not provided in config (deferred from constructor for async support)
    if (!this.model) {
      this.model = await this.createModel(
        this.config.providerType || 'anthropic',
        this.config.modelName
      );
    }

    const checkpointer = await getCheckpointer();

    // Build node names
    const supervisorNode = 'supervisor';
    const nodeNames: string[] = [supervisorNode];

    for (const agent of this.agents) {
      nodeNames.push(`filter_${agent.agentId}`);
      nodeNames.push(agent.agentId);
    }

    // Create state graph with proper typing
    const graph = new StateGraph(BastionStateAnnotation)
      // Add supervisor router node
      .addNode(supervisorNode, this.createSupervisorNode());

    // Add filter + agent nodes for each agent
    for (const agent of this.agents) {
      const filterNodeName = `filter_${agent.agentId}`;

      // Filter node
      graph.addNode(filterNodeName, createClassificationFilterNode(
        agent.agentId,
        agent.getClearance()
      ));

      // Agent node
      graph.addNode(agent.agentId, agent.createNode());
    }

    // Add edges
    graph.addEdge(START, supervisorNode);

    for (const agent of this.agents) {
      const filterNodeName = `filter_${agent.agentId}`;
      // Edge from filter to agent
      (graph as unknown as { addEdge: (a: string, b: string) => void }).addEdge(filterNodeName, agent.agentId);
      (graph as unknown as { addEdge: (a: string, b: string) => void }).addEdge(agent.agentId, supervisorNode);
    }

    // Conditional routing from supervisor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (graph as any).addConditionalEdges(
      supervisorNode,
      this.routeFromSupervisor.bind(this),
      // Route map
      this.agents.reduce((acc, agent) => {
        acc[`filter_${agent.agentId}`] = `filter_${agent.agentId}`;
        return acc;
      }, { [END]: END } as Record<string, string>)
    );

    // Compile with checkpointer
    this.compiled = graph.compile({ checkpointer }) as ReturnType<StateGraph<typeof BastionStateAnnotation>['compile']>;

    console.log(`[Supervisor] ${this.config.name} initialized with ${this.agents.length} agents`);
  }

  /**
   * Execute the supervisor with input
   */
  async execute(input: SupervisorInput): Promise<SupervisorOutput> {
    if (!this.compiled) {
      await this.initialize();
    }

    const initialState: Partial<BastionState> = {
      messages: input.messages,
      classification: input.classification,
      agentClearance: this.config.clearance,
      threadId: input.threadId,
      traceId: input.threadId,
      taskType: input.taskType || 'general',
      objectives: input.objectives || [],
      metadata: input.metadata || {},
      invocationCount: 0,
      maxInvocations: this.config.maxIterations || 50,
      executionTrace: [],
    };

    const config = {
      configurable: {
        thread_id: input.threadId,
      },
    };

    try {
      const result = await this.compiled!.invoke(initialState, config) as BastionState;

      // Extract invoked agents from trace
      const invokedAgents = this.extractInvokedAgents(result.executionTrace || []);

      return {
        state: result,
        trace: result.executionTrace || [],
        invokedAgents,
        finalDecision: result.next || 'END',
        completed: result.interrupt === null,
        interruptReason: result.interrupt?.reason,
      };
    } catch (error) {
      console.error(`[Supervisor] Execution error:`, error);
      throw error;
    }
  }

  /**
   * Resume execution from a checkpoint
   */
  async resume(
    threadId: string,
    resumeWith?: Partial<BastionState>
  ): Promise<SupervisorOutput> {
    if (!this.compiled) {
      await this.initialize();
    }

    const config = {
      configurable: {
        thread_id: threadId,
      },
    };

    // Get current state from checkpoint
    const currentState = await this.compiled!.getState(config);

    // Merge with resume data if provided
    const resumeState = resumeWith
      ? { ...currentState.values, ...resumeWith, interrupt: null }
      : { ...currentState.values, interrupt: null };

    // Continue execution
    const result = await this.compiled!.invoke(resumeState, config) as BastionState;

    const invokedAgents = this.extractInvokedAgents(result.executionTrace || []);

    return {
      state: result,
      trace: result.executionTrace || [],
      invokedAgents,
      finalDecision: result.next || 'END',
      completed: result.interrupt === null,
      interruptReason: result.interrupt?.reason,
    };
  }

  /**
   * Get current state for a thread
   */
  async getState(threadId: string): Promise<BastionState | null> {
    if (!this.compiled) {
      await this.initialize();
    }

    const config = {
      configurable: {
        thread_id: threadId,
      },
    };

    try {
      const snapshot = await this.compiled!.getState(config);
      return snapshot.values as BastionState;
    } catch {
      return null;
    }
  }

  /**
   * Create the supervisor router node
   */
  private createSupervisorNode(): (state: BastionState) => Promise<Partial<BastionState>> {
    return async (state: BastionState): Promise<Partial<BastionState>> => {
      const startTime = Date.now();
      const spanId = randomUUID();

      // Check iteration limit
      if (state.invocationCount >= state.maxInvocations) {
        return {
          next: null, // Signal END
          executionTrace: [...state.executionTrace, {
            spanId,
            agentId: this.config.supervisorId,
            operation: 'route',
            startedAt: new Date(startTime).toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime,
            status: 'success',
            classification: state.classification,
            wasFiltered: false,
          }],
        };
      }

      // Check human checkpoint triggers
      const checkpointNeeded = this.checkHumanCheckpoint(state);
      if (checkpointNeeded) {
        return {
          interrupt: {
            checkpointId: randomUUID(),
            reason: checkpointNeeded,
          },
          executionTrace: [...state.executionTrace, {
            spanId,
            agentId: this.config.supervisorId,
            operation: 'checkpoint',
            startedAt: new Date(startTime).toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime,
            status: 'success',
            classification: state.classification,
            wasFiltered: false,
          }],
        };
      }

      // Build agent info with accessibility check
      const filter = getClassificationFilter();
      const agentInfos: AgentInfo[] = await Promise.all(
        this.agents.map(async (agent) => {
          const canReceive = await filter.canAgentReceive(
            state,
            agent.agentId,
            agent.getClearance()
          );
          return {
            id: agent.agentId,
            name: agent.name,
            description: agent.getDescription(),
            clearance: agent.getClearance(),
            canReceive: canReceive.allowed,
            reason: canReceive.reason,
          };
        })
      );

      // Build routing prompt
      const routingPrompt = this.buildRoutingPrompt(state, agentInfos);

      // Ask LLM for routing decision
      const messages = [
        new SystemMessage(routingPrompt),
        ...state.messages.slice(-5), // Last 5 messages for context
        new HumanMessage('Based on the current state and available agents, which agent should handle the next step? Respond with just the agent ID or "END" if complete.'),
      ];

      const response = await this.model!.invoke(messages);
      const decision = this.parseRoutingDecision(response, agentInfos);

      // Create trace entry
      const traceEntry: ExecutionTraceEntry = {
        spanId,
        parentSpanId: state.executionTrace.length > 0
          ? state.executionTrace[state.executionTrace.length - 1].spanId
          : undefined,
        agentId: this.config.supervisorId,
        operation: 'route',
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        status: 'success',
        classification: state.classification,
        wasFiltered: false,
      };

      // Log dispatch to activity audit trail (if routing to an agent)
      if (decision) {
        getActivityLogger().logSupervisorDispatch(
          this.config.supervisorId,
          decision,
          undefined,
          `Routed by LLM decision`
        );
      }

      return {
        next: decision,
        executionTrace: [...state.executionTrace, traceEntry],
      };
    };
  }

  /**
   * Route from supervisor to next node
   */
  private routeFromSupervisor(state: BastionState): string {
    // Check for interrupt
    if (state.interrupt) {
      return END;
    }

    // Check for explicit END
    if (!state.next || state.next === 'END' || state.next === 'end') {
      return END;
    }

    // Route to filter node for the selected agent
    const agent = this.agents.find(a => a.agentId === state.next);
    if (agent) {
      return `filter_${agent.agentId}`;
    }

    // Unknown agent, end
    console.warn(`[Supervisor] Unknown agent: ${state.next}`);
    return END;
  }

  /**
   * Build the routing prompt for the LLM
   */
  private buildRoutingPrompt(state: BastionState, agentInfos: AgentInfo[]): string {
    const basePrompt = this.config.routingPrompt || `You are a supervisor coordinating a team of AI agents.
Your job is to route tasks to the most appropriate agent based on:
1. Agent capabilities and specialization
2. Security clearance requirements
3. Task context and objectives

Current task classification: ${state.classification}
Your clearance level: ${this.config.clearance}`;

    const agentList = agentInfos.map(a => {
      const accessNote = a.canReceive
        ? `[ACCESSIBLE at ${a.clearance}]`
        : `[NOT ACCESSIBLE: ${a.reason}]`;
      return `- ${a.id}: ${a.description} ${accessNote}`;
    }).join('\n');

    const objectivesText = state.objectives.length > 0
      ? `\nTask objectives:\n${state.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
      : '';

    return `${basePrompt}

Available agents:
${agentList}
${objectivesText}

Task type: ${state.taskType}
Iterations so far: ${state.invocationCount}

IMPORTANT:
- Only route to agents marked as [ACCESSIBLE]
- Respond with "END" if the task is complete
- Respond with just the agent ID (e.g., "osint-agent") to route to that agent`;
  }

  /**
   * Parse the routing decision from LLM response
   */
  private parseRoutingDecision(response: BaseMessage, agentInfos: AgentInfo[]): string | null {
    const content = typeof response.content === 'string'
      ? response.content.trim().toLowerCase()
      : '';

    // Check for END
    if (content === 'end' || content.includes('complete') || content.includes('done')) {
      return null;
    }

    // Try to match agent ID
    for (const agent of agentInfos) {
      if (agent.canReceive && content.includes(agent.id.toLowerCase())) {
        return agent.id;
      }
    }

    // If no match, check if content is a direct agent ID
    const accessibleAgent = agentInfos.find(
      a => a.canReceive && a.id.toLowerCase() === content
    );
    if (accessibleAgent) {
      return accessibleAgent.id;
    }

    // Default to END if can't parse
    console.warn(`[Supervisor] Could not parse routing decision: ${content}`);
    return null;
  }

  /**
   * Check if a human checkpoint is needed
   */
  private checkHumanCheckpoint(state: BastionState): string | null {
    const triggers = this.config.humanCheckpoints;
    if (!triggers) return null;

    // Check classification escalation
    if (triggers.onClassificationEscalation) {
      const currentLevel = CLASSIFICATION_ORDER[state.classification];
      const supervisorLevel = CLASSIFICATION_ORDER[this.config.clearance];
      if (currentLevel > supervisorLevel) {
        return 'classification_escalation';
      }
    }

    // Check task type triggers
    if (triggers.onTaskTypes && triggers.onTaskTypes.includes(state.taskType)) {
      return `task_type:${state.taskType}`;
    }

    // Check iteration trigger
    if (triggers.afterIterations && state.invocationCount >= triggers.afterIterations) {
      return `iteration_limit:${triggers.afterIterations}`;
    }

    return null;
  }

  /**
   * Extract invoked agent IDs from trace
   */
  private extractInvokedAgents(trace: ExecutionTraceEntry[]): string[] {
    const agents = new Set<string>();
    for (const entry of trace) {
      if (entry.agentId !== this.config.supervisorId && entry.agentId !== 'classification-filter') {
        agents.add(entry.agentId);
      }
    }
    return Array.from(agents);
  }

  /**
   * Create LLM model
   */
  private async createModel(providerType: 'anthropic' | 'openai', modelName?: string): Promise<BaseChatModel> {
    if (providerType === 'openai') {
      return new ChatOpenAI({
        model: modelName || 'gpt-4o',
      });
    }
    return createLLMForAgent({
      agentId: 'supervisor',
    });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a supervisor with given configuration and agents
 */
export function createSupervisor(
  config: SupervisorConfig,
  agents: LangGraphAgentWrapper[]
): BastionSupervisor {
  return new BastionSupervisor(config, agents);
}

/**
 * Create a pre-configured strategic planning supervisor
 */
export function createStrategicPlanningSupervisor(
  agents: LangGraphAgentWrapper[],
  clearance: ClassificationLevel = 'SECRET'
): BastionSupervisor {
  return new BastionSupervisor({
    supervisorId: 'strategic-planning-supervisor',
    name: 'Strategic Planning Supervisor',
    description: 'Coordinates OSINT, analysis, and assessment agents for strategic planning tasks',
    clearance,
    routingPrompt: `You are coordinating a strategic planning workflow.
Your agents specialize in:
- OSINT: Open source intelligence gathering
- Analysis: Data analysis and pattern recognition
- Assessment: Risk and feasibility assessment
- Reporting: Document preparation and summarization

Route tasks based on the current workflow stage.`,
    maxIterations: 20,
    humanCheckpoints: {
      onClassificationEscalation: true,
      onTaskTypes: ['final-approval', 'resource-allocation'],
    },
  }, agents);
}

/**
 * Create a pre-configured document processing supervisor
 */
export function createDocumentProcessingSupervisor(
  agents: LangGraphAgentWrapper[],
  clearance: ClassificationLevel = 'CONFIDENTIAL'
): BastionSupervisor {
  return new BastionSupervisor({
    supervisorId: 'document-processing-supervisor',
    name: 'Document Processing Supervisor',
    description: 'Coordinates ingestion, extraction, and validation agents for document processing',
    clearance,
    routingPrompt: `You are coordinating a document processing workflow.
Your agents specialize in:
- Ingestion: Document intake and parsing
- Extraction: Key information extraction
- Validation: Data validation and quality checks
- Classification: Security classification assignment

Route documents through the processing pipeline.`,
    maxIterations: 30,
    humanCheckpoints: {
      onClassificationEscalation: true,
      afterIterations: 25,
    },
  }, agents);
}
