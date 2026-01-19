/**
 * Workflow Engine for Strategic Objective Approval
 *
 * Manages XState actors with PostgreSQL persistence.
 * Provides audit trail logging and state restoration.
 */

import { createActor, type Actor, type SnapshotFrom } from 'xstate';
import { getPool } from '../../lib/database.js';
import { approvalMachine, type ApprovalMachine } from './approval-machine.js';
import type {
  ApprovalContext,
  ApprovalEvent,
  WorkflowStatus,
  WorkflowStateName,
  WorkflowHistoryEntry,
} from './types.js';

/**
 * SQL for initializing workflow tables
 */
const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS workflow_states (
    id TEXT PRIMARY KEY,
    objective_id TEXT NOT NULL,
    state_value TEXT NOT NULL,
    context JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_workflow_states_objective ON workflow_states(objective_id);

  CREATE TABLE IF NOT EXISTS workflow_events (
    id SERIAL PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    actor_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_workflow_events_workflow ON workflow_events(workflow_id);
`;

/**
 * Type for XState snapshot with approval context
 */
type ApprovalSnapshot = SnapshotFrom<ApprovalMachine>;

/**
 * WorkflowEngine manages approval workflow actors with database persistence
 */
export class WorkflowEngine {
  private actors: Map<string, Actor<ApprovalMachine>> = new Map();
  private initialized = false;

  /**
   * Initialize database tables if needed
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const pool = getPool();
    try {
      await pool.query(INIT_SQL);
      this.initialized = true;
    } catch (error) {
      console.error('[WorkflowEngine] Failed to initialize database tables:', error);
      throw error;
    }
  }

  /**
   * Persist workflow state to database
   */
  async persistState(workflowId: string, objectiveId: string, snapshot: ApprovalSnapshot): Promise<void> {
    const pool = getPool();
    const stateValue = typeof snapshot.value === 'string' ? snapshot.value : JSON.stringify(snapshot.value);
    const context = snapshot.context as ApprovalContext;

    try {
      await pool.query(
        `INSERT INTO workflow_states (id, objective_id, state_value, context, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO UPDATE SET
           state_value = EXCLUDED.state_value,
           context = EXCLUDED.context,
           updated_at = NOW()`,
        [workflowId, objectiveId, stateValue, JSON.stringify(context)]
      );
    } catch (error) {
      console.error('[WorkflowEngine] Failed to persist state:', { workflowId, error });
      throw error;
    }
  }

  /**
   * Load workflow state from database
   */
  async loadState(workflowId: string): Promise<{ stateValue: string; context: ApprovalContext } | null> {
    const pool = getPool();

    try {
      const result = await pool.query(
        'SELECT state_value, context FROM workflow_states WHERE id = $1',
        [workflowId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        stateValue: row.state_value,
        context: row.context as ApprovalContext,
      };
    } catch (error) {
      console.error('[WorkflowEngine] Failed to load state:', { workflowId, error });
      throw error;
    }
  }

  /**
   * Log workflow event for audit trail
   */
  async logEvent(workflowId: string, event: ApprovalEvent, actorId: string): Promise<void> {
    const pool = getPool();

    try {
      await pool.query(
        `INSERT INTO workflow_events (workflow_id, event_type, event_data, actor_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [workflowId, event.type, JSON.stringify(event), actorId]
      );
    } catch (error) {
      console.error('[WorkflowEngine] Failed to log event:', { workflowId, event, error });
      throw error;
    }
  }

  /**
   * Get or create an actor for the given objective
   */
  async getOrCreateActor(objectiveId: string): Promise<Actor<ApprovalMachine>> {
    await this.initialize();

    const workflowId = `approval-${objectiveId}`;

    // Return cached actor if exists and running
    const existing = this.actors.get(workflowId);
    if (existing && existing.getSnapshot().status === 'active') {
      return existing;
    }

    // Try to load existing state
    const savedState = await this.loadState(workflowId);

    let actor: Actor<ApprovalMachine>;

    if (savedState) {
      // Restore actor from saved state
      const restoredSnapshot = approvalMachine.resolveState({
        value: savedState.stateValue,
        context: savedState.context,
      });

      actor = createActor(approvalMachine, {
        snapshot: restoredSnapshot,
      });
    } else {
      // Create fresh actor
      actor = createActor(approvalMachine);
    }

    // Subscribe to state changes for auto-persistence
    actor.subscribe({
      next: async (snapshot) => {
        try {
          const context = snapshot.context as ApprovalContext;
          await this.persistState(workflowId, objectiveId, snapshot);
        } catch (error) {
          console.error('[WorkflowEngine] Auto-persist failed:', { workflowId, error });
        }
      },
      error: (error) => {
        console.error('[WorkflowEngine] Actor error:', { workflowId, error });
      },
    });

    actor.start();
    this.actors.set(workflowId, actor);

    return actor;
  }

  /**
   * Send an event to a workflow
   */
  async sendEvent(objectiveId: string, event: ApprovalEvent, actorId: string): Promise<WorkflowStatus> {
    const workflowId = `approval-${objectiveId}`;

    // Log event to audit table
    await this.logEvent(workflowId, event, actorId);

    // Get or create actor
    const actor = await this.getOrCreateActor(objectiveId);

    // Send event
    actor.send(event);

    // Wait for stable state (give time for transition)
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Get current snapshot
    const snapshot = actor.getSnapshot();
    const context = snapshot.context as ApprovalContext;
    const stateValue = typeof snapshot.value === 'string' ? snapshot.value : Object.keys(snapshot.value)[0];

    // Get available transitions
    const canTransition = this.getAvailableEvents(stateValue as WorkflowStateName);

    // Get history
    const history = await this.getWorkflowHistory(objectiveId);

    return {
      state: stateValue as WorkflowStateName,
      context,
      canTransition,
      history,
    };
  }

  /**
   * Get current workflow status
   */
  async getWorkflowStatus(objectiveId: string): Promise<WorkflowStatus | null> {
    const workflowId = `approval-${objectiveId}`;

    // Check if actor is running
    const actor = this.actors.get(workflowId);
    if (actor && actor.getSnapshot().status === 'active') {
      const snapshot = actor.getSnapshot();
      const context = snapshot.context as ApprovalContext;
      const stateValue = typeof snapshot.value === 'string' ? snapshot.value : Object.keys(snapshot.value)[0];
      const history = await this.getWorkflowHistory(objectiveId);

      return {
        state: stateValue as WorkflowStateName,
        context,
        canTransition: this.getAvailableEvents(stateValue as WorkflowStateName),
        history,
      };
    }

    // Try to load from database
    const savedState = await this.loadState(workflowId);
    if (!savedState) {
      return null;
    }

    const history = await this.getWorkflowHistory(objectiveId);

    return {
      state: savedState.stateValue as WorkflowStateName,
      context: savedState.context,
      canTransition: this.getAvailableEvents(savedState.stateValue as WorkflowStateName),
      history,
    };
  }

  /**
   * Get workflow event history
   */
  async getWorkflowHistory(objectiveId: string): Promise<WorkflowHistoryEntry[]> {
    const pool = getPool();
    const workflowId = `approval-${objectiveId}`;

    try {
      const result = await pool.query(
        `SELECT id, workflow_id, event_type, event_data, actor_id, created_at
         FROM workflow_events
         WHERE workflow_id = $1
         ORDER BY created_at ASC`,
        [workflowId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        workflowId: row.workflow_id,
        eventType: row.event_type,
        eventData: row.event_data,
        actorId: row.actor_id,
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      console.error('[WorkflowEngine] Failed to get history:', { workflowId, error });
      throw error;
    }
  }

  /**
   * Get available events for a state
   */
  private getAvailableEvents(state: WorkflowStateName): string[] {
    const transitions: Record<WorkflowStateName, string[]> = {
      draft: ['SUBMIT'],
      pendingReview: ['REVIEW', 'WITHDRAW', 'ESCALATE', 'ADD_COMMENT'],
      pendingRevision: ['SUBMIT', 'WITHDRAW', 'ADD_COMMENT'],
      escalated: ['REVIEW', 'ADD_COMMENT'],
      approved: [],
      rejected: [],
      withdrawn: [],
    };

    return transitions[state] || [];
  }

  /**
   * Stop an actor and remove from cache
   */
  async stopActor(objectiveId: string): Promise<void> {
    const workflowId = `approval-${objectiveId}`;
    const actor = this.actors.get(workflowId);

    if (actor) {
      actor.stop();
      this.actors.delete(workflowId);
    }
  }

  /**
   * Stop all actors
   */
  async shutdown(): Promise<void> {
    for (const [workflowId, actor] of this.actors) {
      actor.stop();
    }
    this.actors.clear();
  }
}
