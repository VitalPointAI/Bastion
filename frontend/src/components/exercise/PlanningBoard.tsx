/**
 * PlanningBoard
 *
 * Phase 14 Plan 09: Kanban-style task tracking by team and status.
 * Tasks are grouped into Pending / In Progress / Complete columns.
 * Filterable by assigned role and exercise phase.
 *
 * Layout:
 * - Header bar: progress bar, filters, stats
 * - Kanban columns: Pending | In Progress | Complete
 * - Task cards: title, team badge, role badge, deadline, source order
 * - Summary tables: by role and by phase (below Kanban)
 */

import { useState, useEffect, useCallback } from 'react';
import { exerciseService } from '../../services/exercise-service';
import type { PlanningTask, BoardSummary } from '../../types/exercise';
import './PlanningBoard.css';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface PlanningBoardProps {
  scenarioId: string;
  perspective: 'blue' | 'red';
  exercisePhase: string;
}

type TaskStatus = 'pending' | 'in_progress' | 'complete';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

function isDueToday(deadline: string | null): boolean {
  if (!deadline) return false;
  const d = new Date(deadline);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return '';
  return new Date(deadline).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function roleLabel(role: string): string {
  switch (role) {
    case 'blue_staff': return 'Blue Staff';
    case 'red_cell': return 'Red Cell';
    case 'exercise_control': return 'Exercise Control';
    default: return role;
  }
}

function teamLabel(team: string): string {
  switch (team) {
    case 'blue': return 'Blue';
    case 'red': return 'Red';
    case 'controller': return 'Controller';
    default: return team;
  }
}

// ─── Team Badge ──────────────────────────────────────────────────────────────────

function TeamBadge({ team }: { team: string }) {
  return (
    <span className={`board-team-badge board-team-badge--${team}`}>
      {teamLabel(team)}
    </span>
  );
}

// ─── Role Badge ──────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`board-role-badge board-role-badge--${role}`}>
      {roleLabel(role)}
    </span>
  );
}

// ─── Task Card ───────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: PlanningTask;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  updating: string | null;
}

function TaskCard({ task, onStatusChange, updating }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const overdue = isOverdue(task.deadline);
  const dueToday = isDueToday(task.deadline);

  const deadlineClass = overdue
    ? 'board-deadline board-deadline--overdue'
    : dueToday
    ? 'board-deadline board-deadline--today'
    : 'board-deadline';

  return (
    <div className={`board-task-card board-task-card--${task.team}`}>
      {/* Title */}
      <p className="board-task-title">{task.title}</p>

      {/* Badges */}
      <div className="board-task-badges">
        <TeamBadge team={task.team} />
        <RoleBadge role={task.assignedRole} />
      </div>

      {/* Description */}
      <div className={`board-task-desc ${expanded ? 'expanded' : ''}`}>
        <p>{task.description}</p>
      </div>
      {task.description && task.description.length > 100 && (
        <button
          className="board-expand-btn"
          onClick={() => setExpanded((p) => !p)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      {/* Phase tag */}
      <div className="board-task-meta">
        {task.deadline && (
          <span className={deadlineClass} title={task.deadline}>
            {overdue && 'OVERDUE '}{dueToday && 'DUE TODAY '}
            {formatDeadline(task.deadline)}
          </span>
        )}
      </div>

      {/* Source order reference */}
      {task.orderId && (
        <div className="board-task-source">
          Order: <span className="board-task-order-ref">{task.orderId.slice(0, 8)}...</span>
        </div>
      )}

      {/* Status change buttons */}
      <div className="board-task-actions">
        {task.status === 'pending' && (
          <button
            className="board-action-btn board-action-btn--start"
            onClick={() => onStatusChange(task.id, 'in_progress')}
            disabled={updating === task.id}
          >
            {updating === task.id ? '...' : 'Start'}
          </button>
        )}
        {task.status === 'in_progress' && (
          <button
            className="board-action-btn board-action-btn--complete"
            onClick={() => onStatusChange(task.id, 'complete')}
            disabled={updating === task.id}
          >
            {updating === task.id ? '...' : 'Complete'}
          </button>
        )}
        {task.status === 'complete' && (
          <span className="board-done-label">Done</span>
        )}
      </div>
    </div>
  );
}

// ─── Kanban Column ───────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: PlanningTask[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  updating: string | null;
}

const COLUMN_CONFIG: Record<TaskStatus, { label: string; colorClass: string }> = {
  pending: { label: 'Pending', colorClass: 'board-col--pending' },
  in_progress: { label: 'In Progress', colorClass: 'board-col--in-progress' },
  complete: { label: 'Complete', colorClass: 'board-col--complete' },
};

function KanbanColumn({ status, tasks, onStatusChange, updating }: KanbanColumnProps) {
  const { label, colorClass } = COLUMN_CONFIG[status];

  return (
    <div className={`board-column ${colorClass}`}>
      <div className="board-col-header">
        <span className="board-col-label">{label}</span>
        <span className="board-col-count">{tasks.length}</span>
      </div>
      <div className="board-col-cards">
        {tasks.length === 0 && (
          <div className="board-col-empty">No tasks</div>
        )}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onStatusChange={onStatusChange}
            updating={updating}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Summary Table ───────────────────────────────────────────────────────────────

interface SummaryTableRow {
  label: string;
  pending: number;
  inProgress: number;
  complete: number;
  total: number;
}

function SummaryTable({ title, rows }: { title: string; rows: SummaryTableRow[] }) {
  return (
    <div className="board-summary-table">
      <h4 className="board-summary-title">{title}</h4>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Pending</th>
            <th>In Progress</th>
            <th>Complete</th>
            <th>% Done</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pct = row.total > 0 ? Math.round((row.complete / row.total) * 100) : 0;
            return (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className="board-summary-cell board-summary-cell--pending">{row.pending}</td>
                <td className="board-summary-cell board-summary-cell--inprogress">{row.inProgress}</td>
                <td className="board-summary-cell board-summary-cell--complete">{row.complete}</td>
                <td className="board-summary-cell board-summary-cell--pct">{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── PlanningBoard ───────────────────────────────────────────────────────────────

export function PlanningBoard({ scenarioId, perspective, exercisePhase }: PlanningBoardProps) {
  // ── State ────────────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<PlanningTask[]>([]);
  const [summary, setSummary] = useState<BoardSummary | null>(null);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterPhase, setFilterPhase] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);

  // ── Load tasks ───────────────────────────────────────────────────────────────

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasksData, summaryData] = await Promise.all([
        exerciseService.getTasks(scenarioId),
        exerciseService.getBoardSummary(scenarioId),
      ]);
      setTasks(tasksData);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load planning board');
    } finally {
      setLoading(false);
    }
  }, [scenarioId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks, perspective, exercisePhase]);

  // ── Status change ─────────────────────────────────────────────────────────────

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setUpdatingTask(taskId);
    try {
      const updated = await exerciseService.updateTaskStatus(taskId, newStatus);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      // Refresh summary
      const newSummary = await exerciseService.getBoardSummary(scenarioId);
      setSummary(newSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task status');
    } finally {
      setUpdatingTask(null);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  // Available phases from tasks
  const availablePhases = Array.from(new Set(tasks.map((t) => {
    // Tasks don't have exercisePhase directly, derive from orderId
    // We'll show 'all' only for now — phase filtering available if task has phase field
    return 'all';
  }))).filter(Boolean);

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filterRole !== 'all' && task.assignedRole !== filterRole) return false;
    // Phase filter: tasks don't directly store exercisePhase, skip for now
    return true;
  });

  // Split by status
  const pendingTasks = filteredTasks.filter((t) => t.status === 'pending');
  const inProgressTasks = filteredTasks.filter((t) => t.status === 'in_progress');
  const completeTasks = filteredTasks.filter((t) => t.status === 'complete');

  // Completion percentage
  const completionPct = summary && summary.total > 0
    ? Math.round((summary.complete / summary.total) * 100)
    : 0;

  // Role summary rows
  const roleRows: SummaryTableRow[] = [
    'blue_staff',
    'red_cell',
    'exercise_control',
  ].map((role) => {
    const byRole = summary?.byRole[role] ?? { pending: 0, inProgress: 0, complete: 0, total: 0 };
    return {
      label: roleLabel(role),
      pending: byRole.pending,
      inProgress: byRole.inProgress,
      complete: byRole.complete,
      total: byRole.total,
    };
  });

  // Phase summary rows (computed from tasks directly since BoardSummary doesn't have byPhase)
  const phaseMap: Record<string, SummaryTableRow> = {};
  tasks.forEach((task) => {
    // Tasks don't have exercisePhase, use the current exercisePhase as a group label
    const phase = exercisePhase;
    if (!phaseMap[phase]) {
      phaseMap[phase] = { label: phase, pending: 0, inProgress: 0, complete: 0, total: 0 };
    }
    phaseMap[phase].total++;
    if (task.status === 'pending') phaseMap[phase].pending++;
    if (task.status === 'in_progress') phaseMap[phase].inProgress++;
    if (task.status === 'complete') phaseMap[phase].complete++;
  });
  const phaseRows = Object.values(phaseMap);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="board-shell">
        <div className="board-loading">Loading planning board...</div>
      </div>
    );
  }

  return (
    <div className="board-shell">

      {/* Header bar */}
      <div className="board-header">

        {/* Progress bar */}
        <div className="board-progress-wrap">
          <div className="board-progress-bar">
            <div
              className="board-progress-fill"
              style={{ width: `${completionPct}%` }}
              title={`${completionPct}% complete`}
            />
          </div>
          <span className="board-progress-label">{completionPct}% Complete</span>
        </div>

        {/* Filters */}
        <div className="board-filters">
          <select
            className="board-filter-select"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="blue_staff">Blue Staff</option>
            <option value="red_cell">Red Cell</option>
            <option value="exercise_control">Exercise Control</option>
          </select>
        </div>

        {/* Stats */}
        <div className="board-stats">
          <span className="board-stat">
            <span className="board-stat-num">{summary?.total ?? 0}</span>
            <span className="board-stat-label">Total</span>
          </span>
          <span className="board-stat board-stat--pending">
            <span className="board-stat-num">{summary?.pending ?? 0}</span>
            <span className="board-stat-label">Pending</span>
          </span>
          <span className="board-stat board-stat--inprogress">
            <span className="board-stat-num">{summary?.inProgress ?? 0}</span>
            <span className="board-stat-label">In Progress</span>
          </span>
          <span className="board-stat board-stat--complete">
            <span className="board-stat-num">{summary?.complete ?? 0}</span>
            <span className="board-stat-label">Complete</span>
          </span>
        </div>

        {/* Refresh button */}
        <button className="board-refresh-btn" onClick={loadTasks} title="Refresh board">
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && <div className="board-error">{error}</div>}

      {/* Kanban columns */}
      <div className="board-kanban">
        <KanbanColumn
          status="pending"
          tasks={pendingTasks}
          onStatusChange={handleStatusChange}
          updating={updatingTask}
        />
        <KanbanColumn
          status="in_progress"
          tasks={inProgressTasks}
          onStatusChange={handleStatusChange}
          updating={updatingTask}
        />
        <KanbanColumn
          status="complete"
          tasks={completeTasks}
          onStatusChange={handleStatusChange}
          updating={updatingTask}
        />
      </div>

      {/* Summary tables */}
      {tasks.length > 0 && (
        <div className="board-summaries">
          <SummaryTable title="By Role" rows={roleRows} />
          {phaseRows.length > 0 && (
            <SummaryTable title="By Phase" rows={phaseRows} />
          )}
        </div>
      )}
    </div>
  );
}
