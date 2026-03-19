/**
 * Ironclaw Task Store
 *
 * Phase 52 Plan 05: PostgreSQL CRUD for ironclaw_tasks table (created in migration 039).
 * Handles task lifecycle persistence with JSONB array operations.
 */

import { getPool } from '../lib/database.js';
import type {
  IronclawTask,
  TaskStatus,
  StepInfo,
  TaskResult,
  TaskSuggestion,
  FeedbackEntry,
} from './task-types.js';
import { VALID_TRANSITIONS } from './task-types.js';

// ---------------------------------------------------------------------------
// Row Mapper
// ---------------------------------------------------------------------------

function rowToTask(row: Record<string, unknown>): IronclawTask {
  return {
    taskId: row.task_id as string,
    problemSetId: row.problem_set_id as string,
    userDid: row.user_did as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    status: row.status as TaskStatus,
    assignedAgents: (row.assigned_agents as string[]) ?? [],
    assignedTeam: (row.assigned_team as string) ?? null,
    threadId: (row.thread_id as string) ?? null,
    steps: (row.steps as StepInfo[]) ?? [],
    currentStep: (row.current_step as number) ?? 0,
    results: (row.results as TaskResult[]) ?? [],
    suggestions: (row.suggestions as TaskSuggestion[]) ?? [],
    targetFields: (row.target_fields as Record<string, string>) ?? {},
    userFeedback: (row.user_feedback as FeedbackEntry[]) ?? [],
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
    completedAt: (row.completed_at as Date) ?? null,
  };
}

// ---------------------------------------------------------------------------
// TaskStore
// ---------------------------------------------------------------------------

export class TaskStore {
  async createTask(task: IronclawTask): Promise<IronclawTask> {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO ironclaw_tasks
        (task_id, problem_set_id, user_did, title, description, status,
         assigned_agents, assigned_team, thread_id, steps, current_step,
         results, suggestions, target_fields, user_feedback)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        task.taskId,
        task.problemSetId,
        task.userDid,
        task.title,
        task.description,
        task.status,
        task.assignedAgents,
        task.assignedTeam,
        task.threadId,
        JSON.stringify(task.steps),
        task.currentStep,
        JSON.stringify(task.results),
        JSON.stringify(task.suggestions),
        JSON.stringify(task.targetFields),
        JSON.stringify(task.userFeedback),
      ],
    );
    return rowToTask(result.rows[0]);
  }

  async getTask(taskId: string): Promise<IronclawTask | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM ironclaw_tasks WHERE task_id = $1',
      [taskId],
    );
    return result.rows.length > 0 ? rowToTask(result.rows[0]) : null;
  }

  async getTasksForProblemSet(
    problemSetId: string,
    status?: TaskStatus,
  ): Promise<IronclawTask[]> {
    const pool = getPool();
    if (status) {
      const result = await pool.query(
        'SELECT * FROM ironclaw_tasks WHERE problem_set_id = $1 AND status = $2 ORDER BY created_at DESC',
        [problemSetId, status],
      );
      return result.rows.map(rowToTask);
    }
    const result = await pool.query(
      'SELECT * FROM ironclaw_tasks WHERE problem_set_id = $1 ORDER BY created_at DESC',
      [problemSetId],
    );
    return result.rows.map(rowToTask);
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<IronclawTask> {
    const pool = getPool();

    // Validate transition
    const current = await this.getTask(taskId);
    if (!current) throw new Error(`Task not found: ${taskId}`);

    const allowed = VALID_TRANSITIONS[current.status];
    if (!allowed.includes(status)) {
      throw new Error(
        `Invalid task transition: ${current.status} -> ${status}. Allowed: ${allowed.join(', ')}`,
      );
    }

    const completedAt = status === 'completed' ? 'NOW()' : 'completed_at';
    const result = await pool.query(
      `UPDATE ironclaw_tasks
       SET status = $2, updated_at = NOW(), completed_at = ${completedAt}
       WHERE task_id = $1
       RETURNING *`,
      [taskId, status],
    );
    return rowToTask(result.rows[0]);
  }

  async updateTaskStep(
    taskId: string,
    stepIndex: number,
    stepUpdate: Partial<StepInfo>,
  ): Promise<IronclawTask> {
    const pool = getPool();
    const task = await this.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const steps = [...task.steps];
    if (stepIndex < 0 || stepIndex >= steps.length) {
      throw new Error(`Step index out of range: ${stepIndex}`);
    }
    steps[stepIndex] = { ...steps[stepIndex], ...stepUpdate };

    const result = await pool.query(
      `UPDATE ironclaw_tasks
       SET steps = $2, current_step = $3, updated_at = NOW()
       WHERE task_id = $1
       RETURNING *`,
      [taskId, JSON.stringify(steps), stepIndex],
    );
    return rowToTask(result.rows[0]);
  }

  async addTaskResult(taskId: string, taskResult: TaskResult): Promise<IronclawTask> {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE ironclaw_tasks
       SET results = results || $2::jsonb, updated_at = NOW()
       WHERE task_id = $1
       RETURNING *`,
      [taskId, JSON.stringify([taskResult])],
    );
    if (result.rows.length === 0) throw new Error(`Task not found: ${taskId}`);
    return rowToTask(result.rows[0]);
  }

  async addTaskSuggestion(taskId: string, suggestion: TaskSuggestion): Promise<IronclawTask> {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE ironclaw_tasks
       SET suggestions = suggestions || $2::jsonb, updated_at = NOW()
       WHERE task_id = $1
       RETURNING *`,
      [taskId, JSON.stringify([suggestion])],
    );
    if (result.rows.length === 0) throw new Error(`Task not found: ${taskId}`);
    return rowToTask(result.rows[0]);
  }

  async updateSuggestionStatus(
    taskId: string,
    suggestionId: string,
    status: TaskSuggestion['status'],
  ): Promise<IronclawTask> {
    const pool = getPool();
    const task = await this.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const suggestions = task.suggestions.map((s) =>
      s.id === suggestionId ? { ...s, status } : s,
    );

    const result = await pool.query(
      `UPDATE ironclaw_tasks
       SET suggestions = $2, updated_at = NOW()
       WHERE task_id = $1
       RETURNING *`,
      [taskId, JSON.stringify(suggestions)],
    );
    return rowToTask(result.rows[0]);
  }

  async addFeedback(taskId: string, entry: FeedbackEntry): Promise<IronclawTask> {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE ironclaw_tasks
       SET user_feedback = user_feedback || $2::jsonb, updated_at = NOW()
       WHERE task_id = $1
       RETURNING *`,
      [taskId, JSON.stringify([entry])],
    );
    if (result.rows.length === 0) throw new Error(`Task not found: ${taskId}`);
    return rowToTask(result.rows[0]);
  }

  async updateThreadId(taskId: string, threadId: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE ironclaw_tasks SET thread_id = $2, updated_at = NOW() WHERE task_id = $1`,
      [taskId, threadId],
    );
  }

  async updateAssignedAgents(taskId: string, agents: string[]): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE ironclaw_tasks SET assigned_agents = $2, updated_at = NOW() WHERE task_id = $1`,
      [taskId, agents],
    );
  }

  /** Mark stale in-progress tasks as failed (startup recovery). */
  async markStaleTasks(): Promise<number> {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE ironclaw_tasks
       SET status = 'failed', updated_at = NOW()
       WHERE status IN ('dispatched', 'agent_working', 'collecting_results')
       RETURNING task_id`,
    );
    return result.rowCount ?? 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: TaskStore | null = null;

export function getTaskStore(): TaskStore {
  if (!_instance) _instance = new TaskStore();
  return _instance;
}
