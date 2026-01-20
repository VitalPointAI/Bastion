/**
 * Message Bus Types
 *
 * TypeScript interfaces for the secure, attribute-aware message bus.
 * Messages carry ABAC attributes for classification-aware delivery.
 */

/**
 * Classification levels for messages - aligned with ABAC enforcer
 */
export type MessageClassification = 'UNCLASS' | 'CUI' | 'CONFIDENTIAL' | 'SECRET' | 'TOPSECRET';

/**
 * Message priority levels
 */
export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Delivery status for message tracking
 */
export enum DeliveryStatus {
  /** Message created but not yet delivered */
  Pending = 'pending',
  /** Message delivered to recipient */
  Delivered = 'delivered',
  /** Recipient acknowledged receipt */
  Acknowledged = 'acknowledged',
  /** Delivery failed */
  Failed = 'failed',
  /** Message TTL exceeded */
  Expired = 'expired',
}

/**
 * Source entity types for messages
 */
export type MessageSourceType = 'agent' | 'user' | 'system';

/**
 * Message source information
 */
export interface MessageSource {
  /** DID of the sender (agent, user, or system) */
  did: string;
  /** Type of the source entity */
  type: MessageSourceType;
}

/**
 * Destination types for message routing
 */
export type DestinationType = 'agent' | 'team' | 'channel' | 'broadcast';

/**
 * Message destination information
 */
export interface MessageDestination {
  /** Type of destination */
  type: DestinationType;
  /** DID or channel name depending on type */
  target: string;
}

/**
 * Security attributes for ABAC enforcement
 * Carried with every message for classification-aware filtering
 */
export interface MessageAttributes {
  /** Classification level of the message content */
  classification: MessageClassification;
  /** REL TO countries/groups */
  releasability: string[];
  /** Dissemination controls (NOFORN, ORCON, PROPIN, etc.) */
  dissemination: string[];
  /** DID of the content originator */
  originator: string;
  /** Originator controlled - requires originator approval for re-distribution */
  orcon: boolean;
}

/**
 * Channel types for message routing
 */
export type ChannelType =
  | 'agent.direct'       // Direct agent-to-agent
  | 'team.internal'      // Within a team
  | 'team.broadcast'     // To all team members
  | 'system.events'      // System-wide events
  | 'workflow.updates'   // Workflow state changes
  | 'audit.log';         // Audit trail channel

/**
 * Pre-defined system channel names
 */
export const SystemChannels = {
  AGENT_LIFECYCLE: 'system.agent.lifecycle',
  TEAM_UPDATES: 'system.team.updates',
  WORKFLOW_EVENTS: 'system.workflow.events',
  SECURITY_ALERTS: 'system.security.alerts',
  AUDIT_ALL: 'audit.all',
} as const;

/**
 * Message envelope - the complete message structure
 */
export interface MessageEnvelope {
  /** Unique message identifier (UUID v4) */
  messageId: string;
  /** Correlation ID for request/response pairing */
  correlationId?: string;
  /** ISO 8601 timestamp of message creation */
  timestamp: string;

  // Routing
  /** Source of the message */
  source: MessageSource;
  /** Destination for the message */
  destination: MessageDestination;

  // Security attributes
  /** ABAC security attributes */
  attributes: MessageAttributes;

  // Payload
  /** Message type (e.g., 'task.assigned', 'data.request', 'status.update') */
  messageType: string;
  /** JSON-serializable message content */
  payload: unknown;

  // Delivery tracking
  /** Message priority */
  priority: MessagePriority;
  /** Time-to-live in seconds (default: 86400 = 24 hours) */
  ttl?: number;
  /** Whether delivery acknowledgment is required */
  requiresAck?: boolean;

  // Status (populated by message store)
  /** Current delivery status */
  status?: DeliveryStatus;
  /** When message was delivered */
  deliveredAt?: string;
  /** When message was acknowledged */
  acknowledgedAt?: string;
}

// Note: CreateMessageInput is defined in schemas.ts as a Zod inferred type
// Import from schemas.ts to avoid duplication

/**
 * Subscription configuration
 */
export interface MessageSubscription {
  /** Unique subscription ID */
  subscriptionId: string;
  /** Subscriber DID */
  subscriberDid: string;
  /** Subscribed channels (empty = all) */
  channels: string[];
  /** Subscribed message types (empty = all) */
  messageTypes: string[];
  /** When subscription was created */
  createdAt: string;
  /** Whether subscription is active */
  active: boolean;
}

/**
 * Message handler callback type
 */
export type MessageHandler = (message: MessageEnvelope) => Promise<void>;

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  /** Filter by channels */
  channels?: string[];
  /** Filter by message types */
  messageTypes?: string[];
  /** Message handler callback */
  callback: MessageHandler;
}

/**
 * Request/response timeout configuration
 */
export interface RequestOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
}

/**
 * Message query options for retrieving messages
 */
export interface MessageQueryOptions {
  /** Filter by channel */
  channel?: string;
  /** Filter by message type */
  messageType?: string;
  /** Messages since timestamp */
  since?: string;
  /** Maximum number of messages to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Include only messages with specific status */
  status?: DeliveryStatus;
}

/**
 * Stored message record (database representation)
 */
export interface StoredMessage {
  messageId: string;
  correlationId: string | null;
  timestamp: Date;
  sourceDid: string;
  sourceType: MessageSourceType;
  destinationType: DestinationType;
  destinationTarget: string;
  classification: MessageClassification;
  releasability: string[];
  dissemination: string[];
  originator: string;
  orcon: boolean;
  messageType: string;
  payload: unknown;
  priority: MessagePriority;
  ttl: number | null;
  requiresAck: boolean;
  status: DeliveryStatus;
  deliveredAt: Date | null;
  acknowledgedAt: Date | null;
  createdAt: Date;
}

/**
 * Message delivery record for audit trail
 */
export interface MessageDelivery {
  deliveryId: string;
  messageId: string;
  recipientDid: string;
  attemptedAt: Date;
  status: DeliveryStatus;
  errorMessage: string | null;
  abacDecision: ABACDecision | null;
}

/**
 * ABAC decision record for audit logging
 */
export interface ABACDecision {
  /** Subject's clearance level */
  subjectClearance: MessageClassification;
  /** Object's classification level */
  objectClassification: MessageClassification;
  /** Result of releasability check */
  releasabilityCheck: {
    passed: boolean;
    subjectNationality?: string;
    objectReleasability?: string[];
  };
  /** Result of dissemination check */
  disseminationCheck: {
    passed: boolean;
    controls?: string[];
    failedControl?: string;
  };
  /** Whether access was allowed */
  allowed: boolean;
  /** Reason for denial (if denied) */
  denialReason?: string;
}
