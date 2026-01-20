/**
 * Agent Messaging
 *
 * Per-agent messaging interface for standardized communication.
 * Provides type-safe message sending and receiving for agents.
 */

import { getMessageBus, MessageBus } from '../messaging/message-bus.js';
import { getMessageABACFilter, MessageABACFilter } from '../messaging/abac-filter.js';
import {
  type MessageEnvelope,
  type CreateMessageInput,
  type MessageClassification,
  type MessageHandler,
  type SubscriptionOptions,
} from '../messaging/types.js';
import { InsufficientClearanceError } from '../messaging/errors.js';
import { getAgentRegistry } from './registry.js';
import { getTeamRegistry } from './team-registry.js';

/**
 * Standard message types for agent communication
 */
export const AgentMessageTypes = {
  // Task management
  TASK_ASSIGNED: 'task.assigned',
  TASK_STARTED: 'task.started',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',

  // Data exchange
  DATA_REQUEST: 'data.request',
  DATA_RESPONSE: 'data.response',

  // Status updates
  STATUS_UPDATE: 'status.update',
  HEARTBEAT: 'heartbeat',

  // Escalation
  ESCALATION_REQUIRED: 'escalation.required',
  ESCALATION_RESOLVED: 'escalation.resolved',

  // Coordination
  COORDINATION_REQUEST: 'coordination.request',
  COORDINATION_RESPONSE: 'coordination.response',

  // Workflow
  WORKFLOW_STARTED: 'workflow.started',
  WORKFLOW_STEP_COMPLETED: 'workflow.step.completed',
  WORKFLOW_COMPLETED: 'workflow.completed',
} as const;

export type AgentMessageType = typeof AgentMessageTypes[keyof typeof AgentMessageTypes];

/**
 * Agent message handler with typed payloads
 */
export type TypedMessageHandler<T = unknown> = (
  message: MessageEnvelope,
  payload: T
) => Promise<void>;

/**
 * AgentMessenger - Per-agent messaging interface
 */
export class AgentMessenger {
  private agentDid: string;
  private agentId: string;
  private bus: MessageBus;
  private filter: MessageABACFilter;
  private subscriptionIds: string[] = [];
  private messageHandlers: Map<string, TypedMessageHandler[]> = new Map();
  private defaultClassification: MessageClassification = 'UNCLASS';

  constructor(
    agentDid: string,
    agentId: string,
    bus?: MessageBus,
    filter?: MessageABACFilter
  ) {
    this.agentDid = agentDid;
    this.agentId = agentId;
    this.bus = bus || getMessageBus();
    this.filter = filter || getMessageABACFilter();
  }

  /**
   * Initialize the messenger and subscribe to agent's messages
   */
  async initialize(): Promise<void> {
    await this.bus.ensureInitialized();
    await this.filter.initialize();

    // Subscribe to direct messages for this agent
    const subscriptionId = this.bus.subscribe(this.agentDid, {
      callback: this.handleIncomingMessage.bind(this),
    });
    this.subscriptionIds.push(subscriptionId);

    console.log(`[AgentMessenger] Initialized for ${this.agentId}`);
  }

  /**
   * Set default classification for outgoing messages
   */
  setDefaultClassification(classification: MessageClassification): void {
    this.defaultClassification = classification;
  }

  // ==========================================================================
  // Sending Messages
  // ==========================================================================

  /**
   * Send a message to a destination
   */
  async send(
    destinationType: 'agent' | 'team' | 'channel',
    destinationTarget: string,
    messageType: string,
    payload: unknown,
    options: {
      classification?: MessageClassification;
      releasability?: string[];
      dissemination?: string[];
      priority?: 'low' | 'normal' | 'high' | 'critical';
      requiresAck?: boolean;
    } = {}
  ): Promise<string> {
    const classification = options.classification || this.defaultClassification;

    // Verify agent has clearance to send at this classification
    const canSend = await this.filter.canSendAtClassification(
      this.agentDid,
      classification
    );
    if (!canSend) {
      throw new InsufficientClearanceError(
        this.agentDid,
        this.defaultClassification,
        classification
      );
    }

    const input: CreateMessageInput = {
      sourceDid: this.agentDid,
      sourceType: 'agent',
      destinationType,
      destinationTarget,
      messageType,
      payload,
      attributes: {
        classification,
        releasability: options.releasability,
        dissemination: options.dissemination,
        originator: this.agentDid,
        orcon: false,
      },
      priority: options.priority || 'normal',
      requiresAck: options.requiresAck,
    };

    return this.bus.publish(input);
  }

  /**
   * Send a message directly to another agent
   */
  async sendToAgent(
    targetAgentDid: string,
    messageType: string,
    payload: unknown,
    options?: {
      classification?: MessageClassification;
      priority?: 'low' | 'normal' | 'high' | 'critical';
    }
  ): Promise<string> {
    return this.send('agent', targetAgentDid, messageType, payload, options);
  }

  /**
   * Broadcast a message to all teams this agent belongs to
   */
  async broadcast(
    messageType: string,
    payload: unknown,
    options?: {
      classification?: MessageClassification;
      priority?: 'low' | 'normal' | 'high' | 'critical';
    }
  ): Promise<string[]> {
    const teamRegistry = getTeamRegistry();
    await teamRegistry.ensureInitialized();

    const teams = teamRegistry.getTeamsForAgent(this.agentId);
    const messageIds: string[] = [];

    for (const team of teams) {
      const messageId = await this.send(
        'team',
        team.teamDID,
        messageType,
        payload,
        options
      );
      messageIds.push(messageId);
    }

    return messageIds;
  }

  /**
   * Publish to a channel
   */
  async publishToChannel(
    channel: string,
    messageType: string,
    payload: unknown,
    options?: {
      classification?: MessageClassification;
      priority?: 'low' | 'normal' | 'high' | 'critical';
    }
  ): Promise<string> {
    return this.send('channel', channel, messageType, payload, options);
  }

  // ==========================================================================
  // Request/Response
  // ==========================================================================

  /**
   * Send a request and wait for response
   */
  async request<TRequest = unknown, TResponse = unknown>(
    targetAgentDid: string,
    messageType: string,
    payload: TRequest,
    timeoutMs: number = 30000
  ): Promise<TResponse> {
    const classification = this.defaultClassification;

    const input: CreateMessageInput = {
      sourceDid: this.agentDid,
      sourceType: 'agent',
      destinationType: 'agent',
      destinationTarget: targetAgentDid,
      messageType,
      payload,
      attributes: {
        classification,
        originator: this.agentDid,
      },
      priority: 'high',
      requiresAck: true,
    };

    const response = await this.bus.request(input, timeoutMs);
    return response.payload as TResponse;
  }

  /**
   * Send a data request to another agent
   */
  async requestData<T = unknown>(
    targetAgentDid: string,
    query: {
      dataType: string;
      filters?: Record<string, unknown>;
    },
    timeoutMs: number = 30000
  ): Promise<T> {
    return this.request<typeof query, T>(
      targetAgentDid,
      AgentMessageTypes.DATA_REQUEST,
      query,
      timeoutMs
    );
  }

  // ==========================================================================
  // Message Handling
  // ==========================================================================

  /**
   * Register a handler for incoming messages
   */
  onMessage<T = unknown>(
    messageType: string | string[],
    handler: TypedMessageHandler<T>
  ): void {
    const types = Array.isArray(messageType) ? messageType : [messageType];

    for (const type of types) {
      let handlers = this.messageHandlers.get(type);
      if (!handlers) {
        handlers = [];
        this.messageHandlers.set(type, handlers);
      }
      handlers.push(handler as TypedMessageHandler);
    }
  }

  /**
   * Register handler for all messages
   */
  onAnyMessage(handler: TypedMessageHandler): void {
    this.onMessage('*', handler);
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(message: MessageEnvelope): Promise<void> {
    const messageType = message.messageType;
    const payload = message.payload;

    // Call type-specific handlers
    const handlers = this.messageHandlers.get(messageType) || [];
    for (const handler of handlers) {
      try {
        await handler(message, payload);
      } catch (error) {
        console.error(
          `[AgentMessenger:${this.agentId}] Handler error for ${messageType}:`,
          error
        );
      }
    }

    // Call catch-all handlers
    const anyHandlers = this.messageHandlers.get('*') || [];
    for (const handler of anyHandlers) {
      try {
        await handler(message, payload);
      } catch (error) {
        console.error(
          `[AgentMessenger:${this.agentId}] Catch-all handler error:`,
          error
        );
      }
    }
  }

  // ==========================================================================
  // Subscriptions
  // ==========================================================================

  /**
   * Subscribe to a channel
   */
  subscribeToChannel(channel: string): string {
    const subscriptionId = this.bus.subscribe(this.agentDid, {
      channels: [channel],
      callback: this.handleIncomingMessage.bind(this),
    });
    this.subscriptionIds.push(subscriptionId);
    return subscriptionId;
  }

  /**
   * Subscribe to specific message types
   */
  subscribeToMessageTypes(messageTypes: string[]): string {
    const subscriptionId = this.bus.subscribe(this.agentDid, {
      messageTypes,
      callback: this.handleIncomingMessage.bind(this),
    });
    this.subscriptionIds.push(subscriptionId);
    return subscriptionId;
  }

  /**
   * Unsubscribe from a subscription
   */
  unsubscribe(subscriptionId: string): void {
    this.bus.unsubscribe(this.agentDid, subscriptionId);
    const idx = this.subscriptionIds.indexOf(subscriptionId);
    if (idx !== -1) {
      this.subscriptionIds.splice(idx, 1);
    }
  }

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  /**
   * Send task assignment
   */
  async assignTask(
    targetAgentDid: string,
    task: {
      taskId: string;
      description: string;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      deadline?: string;
      context?: Record<string, unknown>;
    }
  ): Promise<string> {
    return this.sendToAgent(targetAgentDid, AgentMessageTypes.TASK_ASSIGNED, task, {
      priority: task.priority,
    });
  }

  /**
   * Send task completion notification
   */
  async completeTask(
    taskId: string,
    result: unknown,
    notifyAgentDid?: string
  ): Promise<string | string[]> {
    const payload = {
      taskId,
      result,
      completedAt: new Date().toISOString(),
      completedBy: this.agentDid,
    };

    if (notifyAgentDid) {
      return this.sendToAgent(notifyAgentDid, AgentMessageTypes.TASK_COMPLETED, payload);
    }

    // Broadcast to teams if no specific target
    return this.broadcast(AgentMessageTypes.TASK_COMPLETED, payload);
  }

  /**
   * Send status update
   */
  async updateStatus(
    status: {
      state: string;
      progress?: number;
      currentTask?: string;
      message?: string;
    }
  ): Promise<string[]> {
    return this.broadcast(AgentMessageTypes.STATUS_UPDATE, {
      ...status,
      agentId: this.agentId,
      agentDid: this.agentDid,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Request escalation to human
   */
  async requestEscalation(
    reason: string,
    context: {
      taskId?: string;
      proposalId?: number;
      daoId?: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      details?: Record<string, unknown>;
    }
  ): Promise<string[]> {
    return this.broadcast(AgentMessageTypes.ESCALATION_REQUIRED, {
      reason,
      ...context,
      requestedBy: this.agentDid,
      requestedAt: new Date().toISOString(),
    }, {
      priority: context.severity === 'critical' ? 'critical' : 'high',
    });
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Get agent DID
   */
  getAgentDid(): string {
    return this.agentDid;
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Cleanup messenger resources
   */
  async cleanup(): Promise<void> {
    // Unsubscribe from all subscriptions
    for (const subscriptionId of this.subscriptionIds) {
      this.bus.unsubscribe(this.agentDid, subscriptionId);
    }
    this.subscriptionIds = [];
    this.messageHandlers.clear();

    console.log(`[AgentMessenger] Cleaned up for ${this.agentId}`);
  }
}

// ==========================================================================
// Factory Functions
// ==========================================================================

/**
 * Create a messenger for an agent
 */
export async function createAgentMessenger(agentId: string): Promise<AgentMessenger | null> {
  const registry = getAgentRegistry();
  await registry.ensureInitialized();

  const agent = registry.getAgent(agentId);
  if (!agent || !agent.agentDID) {
    return null;
  }

  const messenger = new AgentMessenger(agent.agentDID, agentId);
  await messenger.initialize();

  return messenger;
}
