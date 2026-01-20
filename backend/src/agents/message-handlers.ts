/**
 * Agent Message Handlers
 *
 * Standard message type handlers for common agent communication patterns.
 * Provides reusable handlers for task management, data exchange, and coordination.
 */

import { type MessageEnvelope } from '../messaging/types.js';
import { AgentMessenger, AgentMessageTypes, type TypedMessageHandler } from './agent-messaging.js';

// ==========================================================================
// Payload Types
// ==========================================================================

/**
 * Task assignment payload
 */
export interface TaskAssignedPayload {
  taskId: string;
  description: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  deadline?: string;
  context?: Record<string, unknown>;
  assignedBy?: string;
}

/**
 * Task completion payload
 */
export interface TaskCompletedPayload {
  taskId: string;
  result: unknown;
  completedAt: string;
  completedBy: string;
}

/**
 * Task failure payload
 */
export interface TaskFailedPayload {
  taskId: string;
  error: string;
  failedAt: string;
  failedBy: string;
  retryable: boolean;
}

/**
 * Data request payload
 */
export interface DataRequestPayload {
  dataType: string;
  filters?: Record<string, unknown>;
  requestId?: string;
}

/**
 * Data response payload
 */
export interface DataResponsePayload {
  requestId?: string;
  dataType: string;
  data: unknown;
  metadata?: {
    count?: number;
    totalCount?: number;
    page?: number;
  };
}

/**
 * Status update payload
 */
export interface StatusUpdatePayload {
  agentId: string;
  agentDid: string;
  state: string;
  progress?: number;
  currentTask?: string;
  message?: string;
  timestamp: string;
}

/**
 * Escalation request payload
 */
export interface EscalationRequiredPayload {
  reason: string;
  taskId?: string;
  proposalId?: number;
  daoId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, unknown>;
  requestedBy: string;
  requestedAt: string;
}

/**
 * Coordination request payload
 */
export interface CoordinationRequestPayload {
  requestType: 'sync' | 'consensus' | 'handoff' | 'review';
  context: Record<string, unknown>;
  participants?: string[];
  deadline?: string;
}

/**
 * Workflow event payload
 */
export interface WorkflowEventPayload {
  workflowId: string;
  stage: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  result?: unknown;
  nextStage?: string;
  timestamp: string;
}

// ==========================================================================
// Handler Builders
// ==========================================================================

/**
 * Create a task assignment handler
 */
export function createTaskAssignedHandler(
  onTaskReceived: (task: TaskAssignedPayload, message: MessageEnvelope) => Promise<void>
): TypedMessageHandler<TaskAssignedPayload> {
  return async (message, payload) => {
    console.log(`[MessageHandler] Task assigned: ${payload.taskId}`);
    await onTaskReceived(payload, message);
  };
}

/**
 * Create a task completion handler
 */
export function createTaskCompletedHandler(
  onTaskCompleted: (completion: TaskCompletedPayload, message: MessageEnvelope) => Promise<void>
): TypedMessageHandler<TaskCompletedPayload> {
  return async (message, payload) => {
    console.log(`[MessageHandler] Task completed: ${payload.taskId}`);
    await onTaskCompleted(payload, message);
  };
}

/**
 * Create a data request handler with automatic response
 */
export function createDataRequestHandler(
  messenger: AgentMessenger,
  dataProvider: (request: DataRequestPayload, message: MessageEnvelope) => Promise<unknown>
): TypedMessageHandler<DataRequestPayload> {
  return async (message, payload) => {
    console.log(`[MessageHandler] Data request: ${payload.dataType}`);

    try {
      const data = await dataProvider(payload, message);

      // Send response back to requester
      const response: DataResponsePayload = {
        requestId: payload.requestId,
        dataType: payload.dataType,
        data,
      };

      await messenger.sendToAgent(
        message.source.did,
        AgentMessageTypes.DATA_RESPONSE,
        response
      );
    } catch (error) {
      console.error(`[MessageHandler] Data request error:`, error);

      // Send error response
      await messenger.sendToAgent(
        message.source.did,
        AgentMessageTypes.DATA_RESPONSE,
        {
          requestId: payload.requestId,
          dataType: payload.dataType,
          data: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  };
}

/**
 * Create a status update handler
 */
export function createStatusUpdateHandler(
  onStatusUpdate: (status: StatusUpdatePayload, message: MessageEnvelope) => Promise<void>
): TypedMessageHandler<StatusUpdatePayload> {
  return async (message, payload) => {
    console.log(`[MessageHandler] Status update from ${payload.agentId}: ${payload.state}`);
    await onStatusUpdate(payload, message);
  };
}

/**
 * Create an escalation handler
 */
export function createEscalationHandler(
  onEscalation: (escalation: EscalationRequiredPayload, message: MessageEnvelope) => Promise<void>
): TypedMessageHandler<EscalationRequiredPayload> {
  return async (message, payload) => {
    console.log(`[MessageHandler] Escalation from ${payload.requestedBy}: ${payload.reason}`);
    await onEscalation(payload, message);
  };
}

/**
 * Create a coordination request handler
 */
export function createCoordinationHandler(
  messenger: AgentMessenger,
  onCoordination: (request: CoordinationRequestPayload, message: MessageEnvelope) => Promise<unknown>
): TypedMessageHandler<CoordinationRequestPayload> {
  return async (message, payload) => {
    console.log(`[MessageHandler] Coordination request: ${payload.requestType}`);

    try {
      const result = await onCoordination(payload, message);

      // Send response
      await messenger.sendToAgent(
        message.source.did,
        AgentMessageTypes.COORDINATION_RESPONSE,
        {
          requestType: payload.requestType,
          result,
          respondedBy: messenger.getAgentDid(),
          respondedAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error(`[MessageHandler] Coordination error:`, error);
    }
  };
}

// ==========================================================================
// Handler Registration Helpers
// ==========================================================================

/**
 * Register all standard handlers for an agent
 */
export function registerStandardHandlers(
  messenger: AgentMessenger,
  handlers: {
    onTaskAssigned?: (task: TaskAssignedPayload, message: MessageEnvelope) => Promise<void>;
    onTaskCompleted?: (completion: TaskCompletedPayload, message: MessageEnvelope) => Promise<void>;
    onTaskFailed?: (failure: TaskFailedPayload, message: MessageEnvelope) => Promise<void>;
    onDataRequest?: (request: DataRequestPayload, message: MessageEnvelope) => Promise<unknown>;
    onStatusUpdate?: (status: StatusUpdatePayload, message: MessageEnvelope) => Promise<void>;
    onEscalation?: (escalation: EscalationRequiredPayload, message: MessageEnvelope) => Promise<void>;
    onCoordination?: (request: CoordinationRequestPayload, message: MessageEnvelope) => Promise<unknown>;
  }
): void {
  if (handlers.onTaskAssigned) {
    messenger.onMessage(
      AgentMessageTypes.TASK_ASSIGNED,
      createTaskAssignedHandler(handlers.onTaskAssigned)
    );
  }

  if (handlers.onTaskCompleted) {
    messenger.onMessage(
      AgentMessageTypes.TASK_COMPLETED,
      createTaskCompletedHandler(handlers.onTaskCompleted)
    );
  }

  if (handlers.onTaskFailed) {
    messenger.onMessage<TaskFailedPayload>(
      AgentMessageTypes.TASK_FAILED,
      async (message, payload) => {
        console.log(`[MessageHandler] Task failed: ${payload.taskId}`);
        await handlers.onTaskFailed!(payload, message);
      }
    );
  }

  if (handlers.onDataRequest) {
    messenger.onMessage(
      AgentMessageTypes.DATA_REQUEST,
      createDataRequestHandler(messenger, handlers.onDataRequest)
    );
  }

  if (handlers.onStatusUpdate) {
    messenger.onMessage(
      AgentMessageTypes.STATUS_UPDATE,
      createStatusUpdateHandler(handlers.onStatusUpdate)
    );
  }

  if (handlers.onEscalation) {
    messenger.onMessage(
      AgentMessageTypes.ESCALATION_REQUIRED,
      createEscalationHandler(handlers.onEscalation)
    );
  }

  if (handlers.onCoordination) {
    messenger.onMessage(
      AgentMessageTypes.COORDINATION_REQUEST,
      createCoordinationHandler(messenger, handlers.onCoordination)
    );
  }
}

/**
 * Create a logging handler that logs all messages
 */
export function createLoggingHandler(
  agentId: string
): TypedMessageHandler {
  return async (message, payload) => {
    console.log(`[${agentId}] Received message:`, {
      messageId: message.messageId,
      type: message.messageType,
      from: message.source.did,
      classification: message.attributes.classification,
      payloadSize: JSON.stringify(payload).length,
    });
  };
}
