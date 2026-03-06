/**
 * System Event Channels
 *
 * Pre-defined channels for system-wide event communication.
 * Standardizes event publishing for agent lifecycle, team updates, workflows, and security.
 */

import { getMessageBus, MessageBus } from './message-bus.js';
import { SystemChannels, type MessageClassification } from './types.js';

// ==========================================================================
// System Event Types
// ==========================================================================

/**
 * Agent lifecycle event types
 */
export enum AgentLifecycleEventType {
  REGISTERED = 'agent.registered',
  ACTIVATED = 'agent.activated',
  DEACTIVATED = 'agent.deactivated',
  STARTED = 'agent.started',
  STOPPED = 'agent.stopped',
  ERROR = 'agent.error',
  HEARTBEAT = 'agent.heartbeat',
}

/**
 * Team event types
 */
export enum TeamEventType {
  CREATED = 'team.created',
  UPDATED = 'team.updated',
  DELETED = 'team.deleted',
  MEMBER_ADDED = 'team.member.added',
  MEMBER_REMOVED = 'team.member.removed',
  WORKFLOW_STARTED = 'team.workflow.started',
  WORKFLOW_COMPLETED = 'team.workflow.completed',
}

/**
 * Workflow event types
 */
export enum WorkflowEventType {
  STARTED = 'workflow.started',
  STEP_COMPLETED = 'workflow.step.completed',
  STATE_CHANGED = 'workflow.state.changed',
  COMPLETED = 'workflow.completed',
  FAILED = 'workflow.failed',
  ESCALATED = 'workflow.escalated',
}

/**
 * Security alert severity levels
 */
export type SecuritySeverity = 'info' | 'warning' | 'critical' | 'emergency';

/**
 * Security alert types
 */
export enum SecurityAlertType {
  ACCESS_DENIED = 'security.access.denied',
  CLASSIFICATION_VIOLATION = 'security.classification.violation',
  ESCALATION_REQUIRED = 'security.escalation.required',
  SUSPICIOUS_ACTIVITY = 'security.suspicious.activity',
  RATE_LIMIT_EXCEEDED = 'security.rate.limit.exceeded',
  AUTHENTICATION_FAILED = 'security.authentication.failed',
}

// ==========================================================================
// Event Payloads
// ==========================================================================

/**
 * Agent lifecycle event payload
 */
export interface AgentLifecycleEvent {
  eventType: AgentLifecycleEventType;
  agentId: string;
  agentDid: string;
  agentName?: string;
  timestamp: string;
  data?: {
    phase?: string;
    capabilities?: string[];
    error?: string;
    status?: string;
  };
}

/**
 * Team event payload
 */
export interface TeamEvent {
  eventType: TeamEventType;
  teamId: string;
  teamDid: string;
  teamName?: string;
  timestamp: string;
  data?: {
    memberId?: string;
    memberRole?: string;
    workflowId?: string;
    workflowType?: string;
    changes?: Record<string, unknown>;
  };
}

/**
 * Workflow event payload
 */
export interface WorkflowEvent {
  eventType: WorkflowEventType;
  objectiveId: string;
  workflowId: string;
  timestamp: string;
  data: {
    previousState?: string;
    currentState: string;
    actorId: string;
    actorType: 'agent' | 'user' | 'system';
    context?: Record<string, unknown>;
    error?: string;
  };
  classification?: MessageClassification;
}

/**
 * Security alert payload
 */
export interface SecurityAlert {
  alertType: SecurityAlertType;
  severity: SecuritySeverity;
  timestamp: string;
  source: {
    did: string;
    type: 'agent' | 'user' | 'system';
    ip?: string;
  };
  target?: {
    resourceType: string;
    resourceId: string;
  };
  message: string;
  context?: Record<string, unknown>;
}

// ==========================================================================
// System Event Publisher
// ==========================================================================

/**
 * SystemEventPublisher - Centralized event publishing for system events
 */
export class SystemEventPublisher {
  private bus: MessageBus;
  private systemDid: string = 'did:near:system';
  private initialized = false;

  constructor(bus?: MessageBus) {
    this.bus = bus || getMessageBus();
  }

  /**
   * Initialize the publisher
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.bus.ensureInitialized();
    this.initialized = true;
  }

  // ==========================================================================
  // Agent Lifecycle Events
  // ==========================================================================

  /**
   * Publish an agent lifecycle event
   */
  async publishAgentEvent(
    eventType: AgentLifecycleEventType,
    agentId: string,
    agentDid: string,
    data?: AgentLifecycleEvent['data']
  ): Promise<string> {
    await this.ensureInitialized();

    const event: AgentLifecycleEvent = {
      eventType,
      agentId,
      agentDid,
      timestamp: new Date().toISOString(),
      data,
    };

    return this.bus.publish({
      sourceDid: this.systemDid,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: SystemChannels.AGENT_LIFECYCLE,
      messageType: eventType,
      payload: event,
      attributes: {
        classification: 'UNCLASS',
        originator: this.systemDid,
      },
      priority: eventType === AgentLifecycleEventType.ERROR ? 'high' : 'normal',
    });
  }

  /**
   * Publish agent registered event
   */
  async agentRegistered(
    agentId: string,
    agentDid: string,
    name: string,
    phase: string,
    capabilities: string[]
  ): Promise<string> {
    return this.publishAgentEvent(
      AgentLifecycleEventType.REGISTERED,
      agentId,
      agentDid,
      { phase, capabilities }
    );
  }

  /**
   * Publish agent started event
   */
  async agentStarted(agentId: string, agentDid: string): Promise<string> {
    return this.publishAgentEvent(
      AgentLifecycleEventType.STARTED,
      agentId,
      agentDid,
      { status: 'running' }
    );
  }

  /**
   * Publish agent stopped event
   */
  async agentStopped(agentId: string, agentDid: string): Promise<string> {
    return this.publishAgentEvent(
      AgentLifecycleEventType.STOPPED,
      agentId,
      agentDid,
      { status: 'stopped' }
    );
  }

  /**
   * Publish agent error event
   */
  async agentError(
    agentId: string,
    agentDid: string,
    error: string
  ): Promise<string> {
    return this.publishAgentEvent(
      AgentLifecycleEventType.ERROR,
      agentId,
      agentDid,
      { error, status: 'error' }
    );
  }

  // ==========================================================================
  // Team Events
  // ==========================================================================

  /**
   * Publish a team event
   */
  async publishTeamEvent(
    eventType: TeamEventType,
    teamId: string,
    teamDid: string,
    data?: TeamEvent['data']
  ): Promise<string> {
    await this.ensureInitialized();

    const event: TeamEvent = {
      eventType,
      teamId,
      teamDid,
      timestamp: new Date().toISOString(),
      data,
    };

    return this.bus.publish({
      sourceDid: this.systemDid,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: SystemChannels.TEAM_UPDATES,
      messageType: eventType,
      payload: event,
      attributes: {
        classification: 'UNCLASS',
        originator: this.systemDid,
      },
      priority: 'normal',
    });
  }

  /**
   * Publish team created event
   */
  async teamCreated(teamId: string, teamDid: string, _name: string): Promise<string> {
    return this.publishTeamEvent(TeamEventType.CREATED, teamId, teamDid);
  }

  /**
   * Publish team member added event
   */
  async teamMemberAdded(
    teamId: string,
    teamDid: string,
    memberId: string,
    memberRole: string
  ): Promise<string> {
    return this.publishTeamEvent(
      TeamEventType.MEMBER_ADDED,
      teamId,
      teamDid,
      { memberId, memberRole }
    );
  }

  /**
   * Publish team member removed event
   */
  async teamMemberRemoved(
    teamId: string,
    teamDid: string,
    memberId: string
  ): Promise<string> {
    return this.publishTeamEvent(
      TeamEventType.MEMBER_REMOVED,
      teamId,
      teamDid,
      { memberId }
    );
  }

  // ==========================================================================
  // Workflow Events
  // ==========================================================================

  /**
   * Publish a workflow event
   */
  async publishWorkflowEvent(
    eventType: WorkflowEventType,
    objectiveId: string,
    workflowId: string,
    data: WorkflowEvent['data'],
    classification: MessageClassification = 'UNCLASS'
  ): Promise<string> {
    await this.ensureInitialized();

    const event: WorkflowEvent = {
      eventType,
      objectiveId,
      workflowId,
      timestamp: new Date().toISOString(),
      data,
      classification,
    };

    return this.bus.publish({
      sourceDid: this.systemDid,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: SystemChannels.WORKFLOW_EVENTS,
      messageType: eventType,
      payload: event,
      attributes: {
        classification,
        originator: this.systemDid,
      },
      priority: eventType === WorkflowEventType.FAILED ? 'high' : 'normal',
    });
  }

  /**
   * Publish workflow state change event
   */
  async workflowStateChanged(
    objectiveId: string,
    workflowId: string,
    previousState: string,
    currentState: string,
    actorId: string,
    actorType: 'agent' | 'user' | 'system' = 'user',
    classification: MessageClassification = 'UNCLASS'
  ): Promise<string> {
    return this.publishWorkflowEvent(
      WorkflowEventType.STATE_CHANGED,
      objectiveId,
      workflowId,
      { previousState, currentState, actorId, actorType },
      classification
    );
  }

  /**
   * Publish workflow completed event
   */
  async workflowCompleted(
    objectiveId: string,
    workflowId: string,
    actorId: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    return this.publishWorkflowEvent(
      WorkflowEventType.COMPLETED,
      objectiveId,
      workflowId,
      { currentState: 'completed', actorId, actorType: 'system', context }
    );
  }

  /**
   * Publish workflow failed event
   */
  async workflowFailed(
    objectiveId: string,
    workflowId: string,
    error: string,
    actorId: string
  ): Promise<string> {
    return this.publishWorkflowEvent(
      WorkflowEventType.FAILED,
      objectiveId,
      workflowId,
      { currentState: 'failed', actorId, actorType: 'system', error }
    );
  }

  // ==========================================================================
  // Security Alerts
  // ==========================================================================

  /**
   * Publish a security alert
   */
  async publishSecurityAlert(
    alertType: SecurityAlertType,
    severity: SecuritySeverity,
    message: string,
    source: SecurityAlert['source'],
    target?: SecurityAlert['target'],
    context?: Record<string, unknown>
  ): Promise<string> {
    await this.ensureInitialized();

    const alert: SecurityAlert = {
      alertType,
      severity,
      timestamp: new Date().toISOString(),
      source,
      target,
      message,
      context,
    };

    // Determine priority based on severity
    const priority =
      severity === 'emergency' || severity === 'critical' ? 'critical' :
        severity === 'warning' ? 'high' : 'normal';

    // Determine classification based on severity
    const classification: MessageClassification =
      severity === 'emergency' ? 'SECRET' :
        severity === 'critical' ? 'CONFIDENTIAL' : 'CUI';

    return this.bus.publish({
      sourceDid: this.systemDid,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: SystemChannels.SECURITY_ALERTS,
      messageType: alertType,
      payload: alert,
      attributes: {
        classification,
        originator: this.systemDid,
      },
      priority,
    });
  }

  /**
   * Publish access denied alert
   */
  async accessDenied(
    subjectDid: string,
    subjectType: 'agent' | 'user' | 'system',
    resourceType: string,
    resourceId: string,
    reason: string
  ): Promise<string> {
    return this.publishSecurityAlert(
      SecurityAlertType.ACCESS_DENIED,
      'warning',
      `Access denied: ${reason}`,
      { did: subjectDid, type: subjectType },
      { resourceType, resourceId },
      { reason }
    );
  }

  /**
   * Publish classification violation alert
   */
  async classificationViolation(
    subjectDid: string,
    subjectType: 'agent' | 'user' | 'system',
    subjectClearance: string,
    requiredClearance: string,
    resourceType: string,
    resourceId: string
  ): Promise<string> {
    return this.publishSecurityAlert(
      SecurityAlertType.CLASSIFICATION_VIOLATION,
      'critical',
      `Classification violation: ${subjectClearance} attempted to access ${requiredClearance} content`,
      { did: subjectDid, type: subjectType },
      { resourceType, resourceId },
      { subjectClearance, requiredClearance }
    );
  }

  // ==========================================================================
  // Audit Events
  // ==========================================================================

  /**
   * Publish to audit log channel (high-clearance only)
   */
  async publishAuditEvent(
    eventType: string,
    actorDid: string,
    actorType: 'agent' | 'user' | 'system',
    action: string,
    resource: { type: string; id: string },
    outcome: 'success' | 'failure',
    details?: Record<string, unknown>
  ): Promise<string> {
    await this.ensureInitialized();

    const event = {
      eventType,
      timestamp: new Date().toISOString(),
      actor: { did: actorDid, type: actorType },
      action,
      resource,
      outcome,
      details,
    };

    return this.bus.publish({
      sourceDid: this.systemDid,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: SystemChannels.AUDIT_ALL,
      messageType: eventType,
      payload: event,
      attributes: {
        classification: 'SECRET', // Audit logs require high clearance
        originator: this.systemDid,
      },
      priority: 'low', // Audit events are low priority
    });
  }

  /**
   * Ensure publisher is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// ==========================================================================
// Singleton Instance
// ==========================================================================

let publisherInstance: SystemEventPublisher | null = null;

/**
 * Get or create the system event publisher singleton
 */
export function getSystemEventPublisher(): SystemEventPublisher {
  if (!publisherInstance) {
    publisherInstance = new SystemEventPublisher();
  }
  return publisherInstance;
}

// ==========================================================================
// Convenience Functions
// ==========================================================================

/**
 * Publish agent lifecycle event
 */
export async function publishAgentLifecycle(
  eventType: AgentLifecycleEventType,
  agentId: string,
  agentDid: string,
  data?: AgentLifecycleEvent['data']
): Promise<string> {
  const publisher = getSystemEventPublisher();
  return publisher.publishAgentEvent(eventType, agentId, agentDid, data);
}

/**
 * Publish team event
 */
export async function publishTeamUpdate(
  eventType: TeamEventType,
  teamId: string,
  teamDid: string,
  data?: TeamEvent['data']
): Promise<string> {
  const publisher = getSystemEventPublisher();
  return publisher.publishTeamEvent(eventType, teamId, teamDid, data);
}

/**
 * Publish workflow event
 */
export async function publishWorkflowUpdate(
  eventType: WorkflowEventType,
  objectiveId: string,
  workflowId: string,
  data: WorkflowEvent['data'],
  classification?: MessageClassification
): Promise<string> {
  const publisher = getSystemEventPublisher();
  return publisher.publishWorkflowEvent(eventType, objectiveId, workflowId, data, classification);
}

/**
 * Publish security alert
 */
export async function publishSecurityAlert(
  alertType: SecurityAlertType,
  severity: SecuritySeverity,
  message: string,
  source: SecurityAlert['source'],
  target?: SecurityAlert['target'],
  context?: Record<string, unknown>
): Promise<string> {
  const publisher = getSystemEventPublisher();
  return publisher.publishSecurityAlert(alertType, severity, message, source, target, context);
}
