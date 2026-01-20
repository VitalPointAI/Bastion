/**
 * Message Bus Module
 *
 * Secure, attribute-aware message bus for inter-agent and system communication.
 * All messages are ABAC-filtered based on classification and clearance.
 */

// Types and schemas
export * from './types.js';
export * from './schemas.js';
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
