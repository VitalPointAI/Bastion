import { createActor, SnapshotFrom, Actor } from 'xstate';
import { jp50Machine } from './jp50-machine.js';
import { JP50Context, JP50Event } from './types.js';
import { getPool } from '../../lib/database.js';
import { planStore } from '../stores/plan-store.js';

type JP50Machine = typeof jp50Machine;
type JP50Actor = Actor<JP50Machine>;

class JP50WorkflowEngine {
  private actors: Map<string, JP50Actor> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS jp50_workflow_states (
        plan_id TEXT PRIMARY KEY REFERENCES operational_plans(id) ON DELETE CASCADE,
        state_value TEXT NOT NULL,
        context JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS jp50_workflow_events (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES operational_plans(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        event_data JSONB NOT NULL,
        actor_did TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_jp50_events_plan ON jp50_workflow_events(plan_id);
      CREATE INDEX IF NOT EXISTS idx_jp50_events_created ON jp50_workflow_events(created_at);
    `);

    this.initialized = true;
  }

  /**
   * Get or create workflow actor for a plan
   */
  async getWorkflow(planId: string): Promise<JP50Actor> {
    await this.initialize();

    // Check memory cache
    if (this.actors.has(planId)) {
      return this.actors.get(planId)!;
    }

    const pool = getPool();

    // Try to restore from database
    const result = await pool.query(
      'SELECT state_value, context FROM jp50_workflow_states WHERE plan_id = $1',
      [planId]
    );

    let actor: JP50Actor;

    if (result.rows.length > 0) {
      // Restore from persisted state using resolveState for proper XState v5 snapshot format
      const row = result.rows[0];
      const persistedContext = row.context as JP50Context;

      // Use resolveState to create a proper XState snapshot
      const snapshot = jp50Machine.resolveState({
        value: row.state_value || 'navigation',
        context: {
          ...persistedContext,
          // Ensure planId is set correctly (may have been empty in broken saves)
          planId: persistedContext.planId || planId,
        },
      });

      actor = createActor(jp50Machine, {
        snapshot,
      });
    } else {
      // Get plan to initialize context
      const plan = await planStore.findById(planId);
      if (!plan) {
        throw new Error(`Plan ${planId} not found`);
      }

      // Create actor with plan data
      const initialSnapshot = jp50Machine.resolveState({
        value: 'navigation',
        context: {
          planId,
          missionId: plan.missionId,
          currentStep: plan.step,
          steps: plan.stepStatuses,
          coaCount: 0,
          selectedCoaId: null,
          commanderApproval: {
            coaApproved: plan.commanderApproval.coaApproved,
            coaApprovedAt: plan.commanderApproval.coaApprovedAt || null,
            coaApprovedBy: plan.commanderApproval.coaApprovedBy || null,
            planApproved: plan.commanderApproval.planApproved,
            planApprovedAt: plan.commanderApproval.planApprovedAt || null,
            planApprovedBy: plan.commanderApproval.planApprovedBy || null,
          },
          lastUpdated: plan.updatedAt,
          lastUpdatedBy: plan.createdBy,
        },
      });

      actor = createActor(jp50Machine, {
        snapshot: initialSnapshot,
      });
    }

    // Subscribe to state changes for persistence
    actor.subscribe({
      next: async (state) => {
        await this.persistState(planId, state);
      },
    });

    actor.start();
    this.actors.set(planId, actor);
    return actor;
  }

  /**
   * Send event to workflow
   */
  async send(planId: string, event: JP50Event): Promise<SnapshotFrom<JP50Machine>> {
    const actor = await this.getWorkflow(planId);

    // Log event for audit trail
    await this.logEvent(planId, event);

    actor.send(event);
    return actor.getSnapshot();
  }

  /**
   * Get current state without modifying
   */
  async getState(planId: string): Promise<SnapshotFrom<JP50Machine>> {
    const actor = await this.getWorkflow(planId);
    return actor.getSnapshot();
  }

  /**
   * Check if plan is at a specific checkpoint
   */
  async isAtCheckpoint(planId: string): Promise<{ atCheckpoint: boolean; checkpoint?: string }> {
    const state = await this.getState(planId);

    // Safely extract state value, handling null/undefined
    let stateValue: string;
    if (!state || !state.value) {
      stateValue = 'navigation';
    } else if (typeof state.value === 'string') {
      stateValue = state.value;
    } else if (typeof state.value === 'object') {
      const keys = Object.keys(state.value);
      stateValue = keys.length > 0 ? keys[0] : 'navigation';
    } else {
      stateValue = 'navigation';
    }

    if (stateValue === 'awaitingCOAApproval') {
      return { atCheckpoint: true, checkpoint: 'coa_approval' };
    }
    if (stateValue === 'awaitingPlanApproval') {
      return { atCheckpoint: true, checkpoint: 'plan_approval' };
    }
    return { atCheckpoint: false };
  }

  /**
   * Persist state to database
   */
  private async persistState(planId: string, state: SnapshotFrom<JP50Machine>): Promise<void> {
    const pool = getPool();
    const stateValue = typeof state.value === 'string' ? state.value : JSON.stringify(state.value);

    await pool.query(`
      INSERT INTO jp50_workflow_states (plan_id, state_value, context, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (plan_id) DO UPDATE SET
        state_value = EXCLUDED.state_value,
        context = EXCLUDED.context,
        updated_at = NOW()
    `, [planId, stateValue, state.context]);

    // Also update plan with step statuses and commander approval
    await this.updatePlanFromWorkflow(planId, state.context);
  }

  /**
   * Update operational plan from workflow context
   */
  private async updatePlanFromWorkflow(planId: string, context: JP50Context): Promise<void> {
    const pool = getPool();

    await pool.query(`
      UPDATE operational_plans
      SET step = $1,
          step_statuses = $2,
          commander_approval = $3,
          updated_at = NOW()
      WHERE id = $4
    `, [
      context.currentStep,
      JSON.stringify(context.steps),
      JSON.stringify(context.commanderApproval),
      planId
    ]);
  }

  /**
   * Log event for audit trail
   */
  private async logEvent(planId: string, event: JP50Event): Promise<void> {
    const pool = getPool();
    const id = `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const actorDID = 'actorDID' in event ? event.actorDID :
                     'commanderDID' in event ? event.commanderDID : null;

    await pool.query(`
      INSERT INTO jp50_workflow_events (id, plan_id, event_type, event_data, actor_did, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [id, planId, event.type, event, actorDID]);
  }

  /**
   * Get workflow history for a plan
   */
  async getHistory(planId: string): Promise<Record<string, unknown>[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM jp50_workflow_events WHERE plan_id = $1 ORDER BY created_at ASC',
      [planId]
    );
    return result.rows;
  }

  /**
   * Release workflow from memory
   */
  releaseWorkflow(planId: string): void {
    const actor = this.actors.get(planId);
    if (actor) {
      actor.stop();
      this.actors.delete(planId);
    }
  }
}

export const jp50WorkflowEngine = new JP50WorkflowEngine();
