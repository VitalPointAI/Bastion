/**
 * Message Bus Module
 *
 * Secure, attribute-aware message bus for inter-agent and system communication.
 * All messages are ABAC-filtered based on classification and clearance.
 */

// Types (explicit exports to avoid conflicts with schemas)
export {
  type MessageClassification,
  type MessagePriority,
  DeliveryStatus,
  type MessageSourceType,
  type MessageSource,
  type DestinationType,
  type MessageDestination,
  type MessageAttributes,
  type ChannelType,
  SystemChannels,
  type MessageEnvelope,
  type MessageSubscription,
  type MessageHandler,
  type SubscriptionOptions,
  type RequestOptions,
  type MessageQueryOptions,
  type StoredMessage,
  type MessageDelivery,
  type ABACDecision,
} from './types.js';

// Schemas (Zod schemas and inferred types)
export * from './schemas.js';

// Errors
export * from './errors.js';

// Core services
export { MessageStore, getMessageStore } from './message-store.js';
export { MessageABACFilter, getMessageABACFilter } from './abac-filter.js';
export { MessageBus, getMessageBus } from './message-bus.js';

// System channels
export {
  SystemEventPublisher,
  getSystemEventPublisher,
  AgentLifecycleEventType,
  TeamEventType,
  WorkflowEventType,
  SecurityAlertType,
  publishAgentLifecycle,
  publishTeamUpdate,
  publishWorkflowUpdate,
  publishSecurityAlert,
  type AgentLifecycleEvent,
  type TeamEvent,
  type WorkflowEvent,
  type SecurityAlert,
  type SecuritySeverity,
} from './system-channels.js';
