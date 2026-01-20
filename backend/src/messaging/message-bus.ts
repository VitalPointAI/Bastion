/**
 * Message Bus
 *
 * Core message routing service with pub/sub and reliable delivery.
 * Integrates with pg-boss for job-based message delivery.
 */

import { randomUUID } from 'crypto';
import { PgBoss } from 'pg-boss';
import { getPool } from '../lib/database.js';
import { getAgentRegistry } from '../agents/registry.js';
import { getTeamRegistry } from '../agents/team-registry.js';
import { getMessageStore, MessageStore } from './message-store.js';
import { getMessageABACFilter, MessageABACFilter } from './abac-filter.js';
import {
  CreateMessageSchema,
  DEFAULT_TTL,
  validatePayloadSize,
  MAX_PAYLOAD_SIZE,
  type CreateMessageInput,
} from './schemas.js';
import {
  DeliveryStatus,
  type MessageEnvelope,
  type MessageSubscription,
  type SubscriptionOptions,
  type MessageHandler,
  type MessageQueryOptions,
} from './types.js';
import {
  MessageValidationError,
  InvalidDestinationError,
  MessageDeliveryError,
  PayloadTooLargeError,
  RequestTimeoutError,
} from './errors.js';

/**
 * Delivery job data for pg-boss
 */
interface DeliveryJobData {
  messageId: string;
  recipientDid: string;
  channel?: string;
}

/**
 * Pending request tracker for request/response pattern
 */
interface PendingRequest {
  correlationId: string;
  resolve: (message: MessageEnvelope) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

/**
 * MessageBus - Central hub for inter-component communication
 */
export class MessageBus {
  private store: MessageStore;
  private filter: MessageABACFilter;
  private boss: PgBoss | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  // In-memory subscription storage (also persisted to DB)
  private subscriptions: Map<string, MessageSubscription> = new Map();
  private subscribers: Map<string, Map<string, MessageHandler>> = new Map(); // subscriberDid -> subscriptionId -> handler
  private channelSubscribers: Map<string, Set<string>> = new Map(); // channel -> subscriberDids
  private pendingRequests: Map<string, PendingRequest> = new Map();

  constructor(
    store?: MessageStore,
    filter?: MessageABACFilter
  ) {
    this.store = store || getMessageStore();
    this.filter = filter || getMessageABACFilter();
    this.initPromise = this.initialize();
  }

  /**
   * Initialize the message bus
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize dependencies
    await this.store.initialize();
    await this.filter.initialize();

    // Initialize pg-boss
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      this.boss = new PgBoss(dbUrl);

      this.boss.on('error', (error) => {
        console.error('[MessageBus] pg-boss error:', error.message);
      });

      await this.boss.start();

      // Create queues
      await this.boss.createQueue('message-delivery');
      await this.boss.createQueue('message-expiration');

      // Register workers
      await this.registerWorkers();

      // Schedule expiration check every minute
      await this.boss.schedule('message-expiration', '*/1 * * * *');

      console.log('[MessageBus] pg-boss workers started');
    } else {
      console.warn('[MessageBus] DATABASE_URL not set, running without pg-boss');
    }

    this.initialized = true;
    console.log('[MessageBus] Initialized');
  }

  /**
   * Ensure initialization is complete
   */
  async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  // ==========================================================================
  // Publishing
  // ==========================================================================

  /**
   * Publish a message to the bus
   */
  async publish(input: CreateMessageInput): Promise<string> {
    await this.ensureInitialized();

    // Validate input
    const parseResult = CreateMessageSchema.safeParse(input);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((e: { message: string }) => e.message);
      throw new MessageValidationError('Invalid message input', errors);
    }

    // Validate payload size
    if (!validatePayloadSize(input.payload)) {
      throw new PayloadTooLargeError(
        JSON.stringify(input.payload).length,
        MAX_PAYLOAD_SIZE
      );
    }

    // Build envelope
    const messageId = randomUUID();
    const timestamp = new Date().toISOString();

    const envelope: MessageEnvelope = {
      messageId,
      correlationId: input.correlationId,
      timestamp,
      source: {
        did: input.sourceDid,
        type: input.sourceType || 'user',
      },
      destination: {
        type: input.destinationType,
        target: input.destinationTarget,
      },
      attributes: {
        classification: input.attributes?.classification || 'UNCLASS',
        releasability: input.attributes?.releasability || [],
        dissemination: input.attributes?.dissemination || [],
        originator: input.attributes?.originator || input.sourceDid,
        orcon: input.attributes?.orcon || false,
      },
      messageType: input.messageType,
      payload: input.payload,
      priority: input.priority || 'normal',
      ttl: input.ttl || DEFAULT_TTL,
      requiresAck: input.requiresAck,
    };

    // Store message
    await this.store.storeMessage(envelope);

    // Route based on destination type
    await this.routeMessage(envelope);

    return messageId;
  }

  /**
   * Route message to appropriate delivery method
   */
  private async routeMessage(envelope: MessageEnvelope): Promise<void> {
    switch (envelope.destination.type) {
      case 'agent':
        await this.deliverToAgent(envelope, envelope.destination.target);
        break;
      case 'team':
        await this.deliverToTeam(envelope, envelope.destination.target);
        break;
      case 'channel':
        await this.deliverToChannel(envelope, envelope.destination.target);
        break;
      case 'broadcast':
        await this.broadcast(envelope);
        break;
    }
  }

  /**
   * Deliver message to a specific agent
   */
  async deliverToAgent(envelope: MessageEnvelope, agentDid: string): Promise<void> {
    // Verify agent exists
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    const agent = registry.getAgentByDID(agentDid);
    if (!agent) {
      // Record failed delivery
      await this.store.recordDelivery(
        envelope.messageId,
        agentDid,
        DeliveryStatus.Failed,
        undefined,
        `Agent ${agentDid} not found`
      );
      throw new InvalidDestinationError('agent', agentDid);
    }

    // Queue delivery via pg-boss (or deliver directly if no boss)
    if (this.boss) {
      await this.boss.send('message-delivery', {
        messageId: envelope.messageId,
        recipientDid: agentDid,
      } as DeliveryJobData);
    } else {
      await this.processDelivery(envelope.messageId, agentDid);
    }
  }

  /**
   * Deliver message to all team members
   */
  async deliverToTeam(envelope: MessageEnvelope, teamDid: string): Promise<void> {
    const teamRegistry = getTeamRegistry();
    await teamRegistry.ensureInitialized();

    const team = teamRegistry.getTeamByDID(teamDid);
    if (!team) {
      await this.store.recordDelivery(
        envelope.messageId,
        teamDid,
        DeliveryStatus.Failed,
        undefined,
        `Team ${teamDid} not found`
      );
      throw new InvalidDestinationError('team', teamDid);
    }

    // Deliver to each team member
    const agentRegistry = getAgentRegistry();
    await agentRegistry.ensureInitialized();

    for (const member of team.members) {
      const agent = agentRegistry.getAgent(member.agentId);
      if (agent?.agentDID) {
        // Queue individual deliveries
        if (this.boss) {
          await this.boss.send('message-delivery', {
            messageId: envelope.messageId,
            recipientDid: agent.agentDID,
          } as DeliveryJobData);
        } else {
          await this.processDelivery(envelope.messageId, agent.agentDID);
        }
      }
    }
  }

  /**
   * Deliver message to channel subscribers
   */
  async deliverToChannel(envelope: MessageEnvelope, channel: string): Promise<void> {
    const subscriberDids = this.channelSubscribers.get(channel);

    if (!subscriberDids || subscriberDids.size === 0) {
      // No subscribers, but message is still stored
      console.log(`[MessageBus] No subscribers for channel ${channel}`);
      return;
    }

    // Deliver to each subscriber
    for (const subscriberDid of subscriberDids) {
      if (this.boss) {
        await this.boss.send('message-delivery', {
          messageId: envelope.messageId,
          recipientDid: subscriberDid,
          channel,
        } as DeliveryJobData);
      } else {
        await this.processDelivery(envelope.messageId, subscriberDid);
      }
    }
  }

  /**
   * Broadcast to all active subscribers
   */
  private async broadcast(envelope: MessageEnvelope): Promise<void> {
    // Get all unique subscriber DIDs
    const allDids = new Set<string>();
    for (const subscription of this.subscriptions.values()) {
      if (subscription.active) {
        allDids.add(subscription.subscriberDid);
      }
    }

    for (const did of allDids) {
      if (this.boss) {
        await this.boss.send('message-delivery', {
          messageId: envelope.messageId,
          recipientDid: did,
        } as DeliveryJobData);
      } else {
        await this.processDelivery(envelope.messageId, did);
      }
    }
  }

  // ==========================================================================
  // Delivery Processing
  // ==========================================================================

  /**
   * Process a message delivery (called by worker or directly)
   */
  async processDelivery(messageId: string, recipientDid: string): Promise<void> {
    // Get message
    const storedMessage = await this.store.getMessageById(messageId);
    if (!storedMessage) {
      console.error(`[MessageBus] Message ${messageId} not found for delivery`);
      return;
    }

    // Check ABAC authorization
    const authResult = await this.filter.canDeliver(storedMessage, recipientDid);

    // Record delivery attempt with ABAC decision
    await this.store.recordDelivery(
      messageId,
      recipientDid,
      authResult.allowed ? DeliveryStatus.Delivered : DeliveryStatus.Failed,
      authResult.decision,
      authResult.allowed ? undefined : authResult.reason
    );

    if (!authResult.allowed) {
      console.log(`[MessageBus] Delivery denied for ${recipientDid}: ${authResult.reason}`);
      return;
    }

    // Convert to envelope
    const envelope = this.store.storedMessageToEnvelope(storedMessage);

    // Check for pending request/response
    if (envelope.correlationId) {
      const pending = this.pendingRequests.get(envelope.correlationId);
      if (pending && pending.correlationId === envelope.correlationId) {
        clearTimeout(pending.timeoutId);
        this.pendingRequests.delete(envelope.correlationId);
        pending.resolve(envelope);
        return;
      }
    }

    // Invoke subscriber callbacks
    const subscriberHandlers = this.subscribers.get(recipientDid);
    if (subscriberHandlers) {
      for (const handler of subscriberHandlers.values()) {
        try {
          await handler(envelope);
        } catch (error) {
          console.error(`[MessageBus] Handler error for ${recipientDid}:`, error);
        }
      }
    }

    // Update message status
    await this.store.updateStatus(messageId, DeliveryStatus.Delivered);
  }

  // ==========================================================================
  // Subscribing
  // ==========================================================================

  /**
   * Subscribe to receive messages
   */
  subscribe(subscriberDid: string, options: SubscriptionOptions): string {
    const subscriptionId = randomUUID();
    const now = new Date().toISOString();

    const subscription: MessageSubscription = {
      subscriptionId,
      subscriberDid,
      channels: options.channels || [],
      messageTypes: options.messageTypes || [],
      createdAt: now,
      active: true,
    };

    // Store subscription
    this.subscriptions.set(subscriptionId, subscription);

    // Register handler
    let handlers = this.subscribers.get(subscriberDid);
    if (!handlers) {
      handlers = new Map();
      this.subscribers.set(subscriberDid, handlers);
    }
    handlers.set(subscriptionId, options.callback);

    // Register for channels
    for (const channel of subscription.channels) {
      let subs = this.channelSubscribers.get(channel);
      if (!subs) {
        subs = new Set();
        this.channelSubscribers.set(channel, subs);
      }
      subs.add(subscriberDid);
    }

    console.log(`[MessageBus] Subscription ${subscriptionId} created for ${subscriberDid}`);
    return subscriptionId;
  }

  /**
   * Unsubscribe from messages
   */
  unsubscribe(subscriberDid: string, subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription || subscription.subscriberDid !== subscriberDid) {
      return;
    }

    // Remove from channels
    for (const channel of subscription.channels) {
      const subs = this.channelSubscribers.get(channel);
      if (subs) {
        subs.delete(subscriberDid);
        if (subs.size === 0) {
          this.channelSubscribers.delete(channel);
        }
      }
    }

    // Remove handler
    const handlers = this.subscribers.get(subscriberDid);
    if (handlers) {
      handlers.delete(subscriptionId);
      if (handlers.size === 0) {
        this.subscribers.delete(subscriberDid);
      }
    }

    // Mark subscription as inactive
    subscription.active = false;
    this.subscriptions.set(subscriptionId, subscription);

    console.log(`[MessageBus] Subscription ${subscriptionId} removed for ${subscriberDid}`);
  }

  /**
   * Get subscriptions for a subscriber
   */
  getSubscriptions(subscriberDid: string): MessageSubscription[] {
    const result: MessageSubscription[] = [];
    for (const sub of this.subscriptions.values()) {
      if (sub.subscriberDid === subscriberDid && sub.active) {
        result.push(sub);
      }
    }
    return result;
  }

  // ==========================================================================
  // Request/Response
  // ==========================================================================

  /**
   * Send a request and await response
   */
  async request(
    input: CreateMessageInput,
    timeoutMs: number = 30000
  ): Promise<MessageEnvelope> {
    await this.ensureInitialized();

    // Generate correlation ID
    const correlationId = randomUUID();
    input.correlationId = correlationId;

    // Create promise for response
    return new Promise<MessageEnvelope>(async (resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new RequestTimeoutError(correlationId, timeoutMs));
      }, timeoutMs);

      // Track pending request
      this.pendingRequests.set(correlationId, {
        correlationId,
        resolve,
        reject,
        timeoutId,
      });

      try {
        // Publish the request message
        await this.publish(input);
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(correlationId);
        reject(error);
      }
    });
  }

  /**
   * Send a response to a request
   */
  async respond(
    originalMessageId: string,
    response: Omit<CreateMessageInput, 'correlationId'>
  ): Promise<string> {
    // Get original message
    const original = await this.store.getMessageById(originalMessageId);
    if (!original) {
      throw new MessageDeliveryError(
        'Original message not found',
        originalMessageId,
        'unknown'
      );
    }

    // Create response with correlation
    const responseInput: CreateMessageInput = {
      ...response,
      correlationId: original.correlationId || original.messageId,
      // Swap source and destination
      destinationType: 'agent',
      destinationTarget: original.sourceDid,
    };

    return this.publish(responseInput);
  }

  // ==========================================================================
  // Querying
  // ==========================================================================

  /**
   * Get messages for recipient (ABAC-filtered)
   */
  async getMessages(
    recipientDid: string,
    options: MessageQueryOptions = {}
  ): Promise<MessageEnvelope[]> {
    await this.ensureInitialized();

    const messages = await this.store.getMessagesForRecipient(recipientDid, options);

    // Apply ABAC filtering
    const authorized = await this.filter.getAuthorizedMessages(messages, recipientDid);

    return authorized.map(m => this.store.storedMessageToEnvelope(m as any));
  }

  /**
   * Get message by ID (ABAC-checked)
   */
  async getMessage(
    messageId: string,
    requestorDid: string
  ): Promise<MessageEnvelope | null> {
    await this.ensureInitialized();

    const message = await this.store.getMessageById(messageId);
    if (!message) {
      return null;
    }

    // Check ABAC
    const auth = await this.filter.canDeliver(message, requestorDid);
    if (!auth.allowed) {
      return null;
    }

    return this.store.storedMessageToEnvelope(message);
  }

  /**
   * Get message thread by correlation ID
   */
  async getThread(
    correlationId: string,
    requestorDid: string
  ): Promise<MessageEnvelope[]> {
    await this.ensureInitialized();

    const messages = await this.store.getMessageHistory(correlationId);

    // Apply ABAC filtering
    const authorized = await this.filter.getAuthorizedMessages(messages, requestorDid);

    return authorized.map(m => this.store.storedMessageToEnvelope(m as any));
  }

  /**
   * Acknowledge message receipt
   */
  async acknowledge(messageId: string, recipientDid: string): Promise<void> {
    await this.ensureInitialized();

    const message = await this.store.getMessageById(messageId);
    if (!message) {
      return;
    }

    // Verify recipient is authorized
    const auth = await this.filter.canDeliver(message, recipientDid);
    if (!auth.allowed) {
      return;
    }

    await this.store.updateStatus(messageId, DeliveryStatus.Acknowledged);
  }

  // ==========================================================================
  // Workers
  // ==========================================================================

  /**
   * Register pg-boss workers
   */
  private async registerWorkers(): Promise<void> {
    if (!this.boss) return;

    // Message delivery worker
    await this.boss.work<DeliveryJobData>('message-delivery', async (jobs) => {
      for (const job of jobs) {
        const { messageId, recipientDid } = job.data;
        await this.processDelivery(messageId, recipientDid);
      }
    });

    // Message expiration worker
    await this.boss.work('message-expiration', async () => {
      const expiredCount = await this.store.expireMessages();
      if (expiredCount > 0) {
        console.log(`[MessageBus] Expired ${expiredCount} messages`);
      }
    });
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Get bus statistics
   */
  async getStats(): Promise<{
    subscriptions: number;
    channels: number;
    pendingRequests: number;
    messagesByStatus: Record<string, number>;
  }> {
    await this.ensureInitialized();

    const messagesByStatus = await this.store.countByStatus();

    return {
      subscriptions: this.subscriptions.size,
      channels: this.channelSubscribers.size,
      pendingRequests: this.pendingRequests.size,
      messagesByStatus,
    };
  }

  /**
   * Shutdown the message bus
   */
  async shutdown(): Promise<void> {
    // Clear pending requests
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Message bus shutting down'));
    }
    this.pendingRequests.clear();

    // Stop pg-boss
    if (this.boss) {
      await this.boss.stop();
    }

    console.log('[MessageBus] Shutdown complete');
  }
}

// ==========================================================================
// Singleton Instance
// ==========================================================================

let busInstance: MessageBus | null = null;

/**
 * Get or create the message bus singleton
 */
export function getMessageBus(): MessageBus {
  if (!busInstance) {
    busInstance = new MessageBus();
  }
  return busInstance;
}
