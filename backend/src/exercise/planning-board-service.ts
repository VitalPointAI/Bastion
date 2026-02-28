/**
 * Planning Board Service
 *
 * Phase 14 Plan 04: Order publication triggers task creation and MessageBus
 * notifications. Tracks the full lifecycle from pending through in_progress
 * to complete, with role reassignment and board summary metrics.
 */

import type { Pool } from 'pg';
import type { OrderStore } from './order-store.js';
import type { TaskStore } from './task-store.js';
import type { MessageBus } from '../messaging/message-bus.js';
import type {
  ExerciseOrder,
  PlanningTask,
  WARNORDContent,
  OPORDContent,
  FRAGOContent,
} from './types.js';
import type { SubordinateTask } from '../planning/types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusCounts {
  pending: number;
  in_progress: number;
  complete: number;
}

/**
 * Aggregated planning board summary for a scenario.
 * Provides completion metrics by status, role, and exercise phase.
 */
export interface BoardSummary {
  totalTasks: number;
  byStatus: StatusCounts;
  byRole: Record<string, StatusCounts>;
  byPhase: Record<string, StatusCounts>;
  completionPercentage: number;
}

// ─── Task extraction helpers ─────────────────────────────────────────────────

/**
 * Derive CreatePlanningTask arguments from order content.
 * Returns an array of task specs to be created after publication.
 */
interface TaskSpec {
  assignedRole: PlanningTask['assignedRole'];
  title: string;
  description: string;
  deadline?: Date;
}

function extractTasksFromWARNORD(
  content: WARNORDContent
): TaskSpec[] {
  return (content.initialTasks ?? []).map((t) => ({
    assignedRole: mapRoleString(t.assignedTo),
    title: t.task,
    description: t.purpose,
    deadline: t.deadline ? parseDateOrUndefined(t.deadline) : undefined,
  }));
}

function extractTasksFromOPORD(content: OPORDContent): TaskSpec[] {
  const execution = content.execution;
  if (!execution?.tasks) return [];
  return (execution.tasks as SubordinateTask[]).map((t) => ({
    assignedRole: mapRoleString(t.unitId || 'blue_staff'),
    title: t.task,
    description: t.purpose,
  }));
}

function extractTasksFromFRAGO(content: FRAGOContent): TaskSpec[] {
  const changed = content.changedParagraphs;
  if (!changed?.execution?.tasks) return [];
  return (changed.execution.tasks as SubordinateTask[]).map((t) => ({
    assignedRole: mapRoleString(t.unitId || 'blue_staff'),
    title: t.task,
    description: t.purpose,
  }));
}

/**
 * Map an arbitrary role string to one of the three valid PlanningTask assignedRole
 * values. Unknown strings default to 'blue_staff' for safety.
 */
function mapRoleString(role: string): PlanningTask['assignedRole'] {
  const normalized = role.toLowerCase().replace(/[^a-z_]/g, '_');
  if (normalized.includes('red') || normalized.includes('red_cell')) {
    return 'red_cell';
  }
  if (normalized.includes('controller') || normalized.includes('exercise_control')) {
    return 'exercise_control';
  }
  return 'blue_staff';
}

function parseDateOrUndefined(value: string): Date | undefined {
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

function emptyStatusCounts(): StatusCounts {
  return { pending: 0, in_progress: 0, complete: 0 };
}

function incrementStatus(counts: StatusCounts, status: string): void {
  if (status === 'pending') counts.pending++;
  else if (status === 'in_progress') counts.in_progress++;
  else if (status === 'complete') counts.complete++;
}

// ─── PlanningBoardService ────────────────────────────────────────────────────

/**
 * Manages the planning board lifecycle:
 *  - Publishing an order creates PlanningTask records for each task assignment
 *  - MessageBus notifications fire on order publication and task completion
 *  - Task status and role are mutable through this service
 *  - Board summary aggregates completion metrics across status, role, and phase
 */
export class PlanningBoardService {
  private pool: Pool;
  private orderStore: OrderStore;
  private taskStore: TaskStore;
  private bus: MessageBus;

  /** Source DID used for all MessageBus events published by this service */
  private static readonly SOURCE_DID = 'system:planning-board';

  constructor(
    pool: Pool,
    orderStore: OrderStore,
    taskStore: TaskStore,
    bus: MessageBus
  ) {
    this.pool = pool;
    this.orderStore = orderStore;
    this.taskStore = taskStore;
    this.bus = bus;
  }

  // ─── Publish Order ─────────────────────────────────────────────────────────

  /**
   * Publish an order and automatically create PlanningTask records for each
   * task assignment embedded in the order content.
   *
   * 1. Load and validate the draft order
   * 2. Extract task assignments based on order type
   * 3. Create PlanningTask records
   * 4. Mark order as published
   * 5. Emit exercise.order.published on the MessageBus
   */
  async publishOrder(
    orderId: string,
    visibleTeams: string[]
  ): Promise<{ order: ExerciseOrder; tasks: PlanningTask[] }> {
    // Load and validate order
    const order = await this.orderStore.findById(orderId, visibleTeams);
    if (!order) {
      throw new Error(`Order ${orderId} not found or not visible`);
    }
    if (!order.content) {
      throw new Error(`Order ${orderId} has no content`);
    }
    if (order.status !== 'draft') {
      throw new Error(`Order ${orderId} is not in draft status (current: ${order.status})`);
    }

    // Extract task assignments from order content
    let taskSpecs: TaskSpec[] = [];
    if (order.orderType === 'WARNORD') {
      taskSpecs = extractTasksFromWARNORD(order.content as WARNORDContent);
    } else if (order.orderType === 'OPORD') {
      taskSpecs = extractTasksFromOPORD(order.content as OPORDContent);
    } else if (order.orderType === 'FRAGO') {
      taskSpecs = extractTasksFromFRAGO(order.content as FRAGOContent);
    }

    // Create PlanningTask records
    const tasks: PlanningTask[] = [];
    for (const spec of taskSpecs) {
      const task = await this.taskStore.create({
        orderId: order.id,
        scenarioId: order.scenarioId,
        team: order.team,
        assignedRole: spec.assignedRole,
        title: spec.title,
        description: spec.description,
        deadline: spec.deadline ?? null,
        status: 'pending',
        completedAt: null,
      });
      tasks.push(task);
    }

    // Mark order as published
    await this.orderStore.markPublished(orderId);

    // Publish MessageBus notification to exercise channel
    try {
      await this.bus.publish({
        sourceDid: PlanningBoardService.SOURCE_DID,
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: `exercise.${order.scenarioId}`,
        messageType: 'exercise.order.published',
        payload: {
          orderId,
          team: order.team,
          orderType: order.orderType,
          exercisePhase: order.exercisePhase,
          taskCount: tasks.length,
        },
      });
    } catch (err) {
      // Log but do not fail publication — messaging is advisory
      console.error('[PlanningBoardService] Failed to publish MessageBus notification:', err);
    }

    // Return refreshed order with publishedAt set
    const publishedOrder = await this.orderStore.findById(orderId, visibleTeams);
    return { order: publishedOrder ?? order, tasks };
  }

  // ─── Task Status Update ─────────────────────────────────────────────────────

  /**
   * Update a planning task's status.
   * Emits exercise.task.completed when status transitions to 'complete'.
   */
  async updateTaskStatus(
    taskId: string,
    status: 'pending' | 'in_progress' | 'complete',
    visibleTeams: string[]
  ): Promise<PlanningTask> {
    // Validate the task is visible to the requester
    const task = await this.taskStore.findById(taskId, visibleTeams);
    if (!task) {
      throw new Error(`Task ${taskId} not found or not visible`);
    }

    await this.taskStore.updateStatus(taskId, status);

    // Emit completion notification
    if (status === 'complete') {
      try {
        await this.bus.publish({
          sourceDid: PlanningBoardService.SOURCE_DID,
          sourceType: 'system',
          destinationType: 'channel',
          destinationTarget: `exercise.${task.scenarioId}`,
          messageType: 'exercise.task.completed',
          payload: {
            taskId,
            orderId: task.orderId,
            scenarioId: task.scenarioId,
            team: task.team,
            assignedRole: task.assignedRole,
            title: task.title,
          },
        });
      } catch (err) {
        console.error('[PlanningBoardService] Failed to publish task completion notification:', err);
      }
    }

    // Return the updated task
    const updated = await this.taskStore.findById(taskId, visibleTeams);
    if (!updated) {
      throw new Error(`Task ${taskId} not found after status update`);
    }
    return updated;
  }

  // ─── Board Summary ──────────────────────────────────────────────────────────

  /**
   * Compute a completion summary for a scenario's planning board.
   * Aggregates task counts by status, role, and exercise phase.
   */
  async getBoardSummary(
    scenarioId: string,
    visibleTeams: string[]
  ): Promise<BoardSummary> {
    const tasks = await this.taskStore.findByScenario(scenarioId, visibleTeams);

    const byStatus: StatusCounts = emptyStatusCounts();
    const byRole: Record<string, StatusCounts> = {};
    const byPhase: Record<string, StatusCounts> = {};

    // We need exercise phase per task — join with orders to get phase
    // Build orderId → exercisePhase map from loaded tasks
    const orderIds = [...new Set(tasks.map((t) => t.orderId))];
    const phaseByOrderId = await this.loadPhaseByOrderId(orderIds, visibleTeams);

    for (const task of tasks) {
      // Global status counts
      incrementStatus(byStatus, task.status);

      // Per-role counts
      if (!byRole[task.assignedRole]) {
        byRole[task.assignedRole] = emptyStatusCounts();
      }
      incrementStatus(byRole[task.assignedRole]!, task.status);

      // Per-phase counts
      const phase = phaseByOrderId.get(task.orderId) ?? 'unknown';
      if (!byPhase[phase]) {
        byPhase[phase] = emptyStatusCounts();
      }
      incrementStatus(byPhase[phase]!, task.status);
    }

    const total = tasks.length;
    const completionPercentage =
      total === 0 ? 0 : Math.round((byStatus.complete / total) * 100);

    return {
      totalTasks: total,
      byStatus,
      byRole,
      byPhase,
      completionPercentage,
    };
  }

  // ─── Task Reassignment ──────────────────────────────────────────────────────

  /**
   * Reassign a planning task to a different role.
   * Emits exercise.task.reassigned notification via MessageBus.
   */
  async reassignTask(
    taskId: string,
    newRole: string,
    visibleTeams: string[]
  ): Promise<PlanningTask> {
    const task = await this.taskStore.findById(taskId, visibleTeams);
    if (!task) {
      throw new Error(`Task ${taskId} not found or not visible`);
    }

    await this.taskStore.updateAssignedRole(taskId, newRole);

    try {
      await this.bus.publish({
        sourceDid: PlanningBoardService.SOURCE_DID,
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: `exercise.${task.scenarioId}`,
        messageType: 'exercise.task.reassigned',
        payload: {
          taskId,
          orderId: task.orderId,
          scenarioId: task.scenarioId,
          team: task.team,
          previousRole: task.assignedRole,
          newRole,
          title: task.title,
        },
      });
    } catch (err) {
      console.error('[PlanningBoardService] Failed to publish task reassignment notification:', err);
    }

    const updated = await this.taskStore.findById(taskId, visibleTeams);
    if (!updated) {
      throw new Error(`Task ${taskId} not found after reassignment`);
    }
    return updated;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Load the exercisePhase for a set of order IDs.
   * Queries the database directly to avoid N+1 loading per task.
   */
  private async loadPhaseByOrderId(
    orderIds: string[],
    visibleTeams: string[]
  ): Promise<Map<string, string>> {
    const phaseMap = new Map<string, string>();
    if (orderIds.length === 0) return phaseMap;

    const result = await this.pool.query(
      `SELECT id, exercise_phase FROM exercise_orders
       WHERE id = ANY($1) AND team = ANY($2)`,
      [orderIds, visibleTeams]
    );

    for (const row of result.rows) {
      phaseMap.set(row.id as string, row.exercise_phase as string);
    }

    return phaseMap;
  }
}
