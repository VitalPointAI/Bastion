/**
 * IronclawTasksPanel -- Agent task progress tracker
 *
 * Shows tasks dispatched to staff agents with live step progress.
 * Polls for updates and shows status badges, elapsed time, and step details.
 */

import { useState, useEffect, useCallback } from 'react';

interface TaskStep {
  label: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  startedAt?: string | null;
  completedAt?: string | null;
}

interface AgentTask {
  taskId: string;
  title: string;
  status: string;
  assignedAgents: string[];
  steps: TaskStep[];
  currentStep: number;
  createdAt: string;
  completedAt?: string | null;
  suggestions: Array<{ id: string; fieldLabel: string; status: string }>;
}

interface IronclawTasksPanelProps {
  problemSetId: string;
}

function relativeTime(dateStr: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function elapsed(startStr: string, endStr?: string | null): string {
  const start = new Date(startStr).getTime();
  const end = endStr ? new Date(endStr).getTime() : Date.now();
  const diffSec = Math.floor((end - start) / 1000);
  const min = Math.floor(diffSec / 60);
  const sec = diffSec % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  created: { label: 'Created', color: 'bg-slate-600 text-slate-200' },
  dispatched: { label: 'Dispatched', color: 'bg-blue-600/30 text-blue-300' },
  agent_working: { label: 'In Progress', color: 'bg-amber-600/30 text-amber-300' },
  collecting_results: { label: 'Collecting', color: 'bg-purple-600/30 text-purple-300' },
  presenting: { label: 'Presenting', color: 'bg-emerald-600/30 text-emerald-300' },
  awaiting_approval: { label: 'Ready for Review', color: 'bg-emerald-600/30 text-emerald-300' },
  completed: { label: 'Completed', color: 'bg-green-600/30 text-green-300' },
  failed: { label: 'Failed', color: 'bg-red-600/30 text-red-300' },
  rejected: { label: 'Rejected', color: 'bg-slate-600/30 text-slate-400' },
};

const STEP_ICON: Record<string, string> = {
  pending: '○',
  running: '◉',
  complete: '✓',
  failed: '✗',
};

export function IronclawTasksPanel({ problemSetId }: IronclawTasksPanelProps) {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/ironclaw/tasks/${problemSetId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as AgentTask[];
        setTasks(data);
      }
    } catch {
      // Silently fail — will retry on next poll
    } finally {
      setLoading(false);
    }
  }, [problemSetId]);

  const hasActiveTask = tasks.some((t) =>
    ['dispatched', 'agent_working', 'collecting_results'].includes(t.status),
  );

  useEffect(() => {
    fetchTasks();
    // Poll every 10s while any task is active, 30s otherwise
    const interval = setInterval(fetchTasks, hasActiveTask ? 10_000 : 30_000);
    return () => clearInterval(interval);
  }, [fetchTasks, hasActiveTask]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
        Loading tasks...
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-sm gap-2">
        <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span>No agent tasks yet</span>
        <span className="text-xs text-slate-600">Tasks appear here when Ironclaw dispatches staff agents</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {tasks.map((task) => {
        const badge = STATUS_BADGE[task.status] ?? STATUS_BADGE.created;
        const isActive = ['dispatched', 'agent_working', 'collecting_results'].includes(task.status);
        const isExpanded = expandedTask === task.taskId;
        const completedSteps = task.steps.filter((s) => s.status === 'complete').length;
        const totalSteps = task.steps.length;

        return (
          <div
            key={task.taskId}
            className={`border rounded-lg overflow-hidden transition-colors ${
              isActive
                ? 'border-amber-500/30 bg-slate-800/60'
                : 'border-slate-700/50 bg-slate-800/30'
            }`}
          >
            {/* Task header */}
            <button
              onClick={() => setExpandedTask(isExpanded ? null : task.taskId)}
              className="w-full flex items-start gap-2 p-3 text-left hover:bg-slate-700/20 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.color}`}>
                    {badge.label}
                  </span>
                  {isActive && (
                    <span className="text-[10px] text-amber-400 animate-pulse">
                      {elapsed(task.createdAt)}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-200 font-medium truncate">
                  {task.title}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-slate-500">
                    {task.assignedAgents.join(', ') || 'unassigned'}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {completedSteps}/{totalSteps} steps
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {relativeTime(task.createdAt)}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isActive ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <svg
                className={`w-4 h-4 text-slate-500 transition-transform flex-shrink-0 mt-1 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded step details */}
            {isExpanded && (
              <div className="border-t border-slate-700/50 px-3 py-2 space-y-1.5">
                {task.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`w-4 text-center ${
                      step.status === 'complete' ? 'text-emerald-400' :
                      step.status === 'running' ? 'text-amber-400 animate-pulse' :
                      step.status === 'failed' ? 'text-red-400' :
                      'text-slate-600'
                    }`}>
                      {STEP_ICON[step.status]}
                    </span>
                    <span className={`flex-1 ${
                      step.status === 'running' ? 'text-gray-200' :
                      step.status === 'complete' ? 'text-gray-400' :
                      'text-slate-500'
                    }`}>
                      {step.label}
                    </span>
                    {step.status === 'running' && step.startedAt && (
                      <span className="text-[10px] text-amber-400/70">
                        {elapsed(step.startedAt)}
                      </span>
                    )}
                    {step.status === 'complete' && step.startedAt && step.completedAt && (
                      <span className="text-[10px] text-slate-600">
                        {elapsed(step.startedAt, step.completedAt)}
                      </span>
                    )}
                  </div>
                ))}
                {task.suggestions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-700/30">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                      Suggestions ({task.suggestions.filter((s) => s.status === 'pending').length} pending)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
