/**
 * IronclawTaskPanel -- Active task workflow panel for the Ironclaw drawer
 *
 * Shows multi-step progress (via IronclawStepStream), suggestion cards for
 * awaiting-approval tasks, and a feedback input for refinement requests.
 *
 * Rendered above the chat messages when an active task exists.
 * Collapsible so the user can minimize it to focus on chat.
 */

import { useState } from 'react';
import type { IronclawTaskData, SuggestionData } from '../../types/ironclaw.ts';
import { IronclawStepStream } from './IronclawStepStream.tsx';
import { IronclawSuggestion } from './IronclawSuggestion.tsx';

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  working: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  awaiting_approval: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  completed: 'bg-green-500/20 text-green-300 border-green-500/40',
  failed: 'bg-red-500/20 text-red-300 border-red-500/40',
};

const STATUS_LABELS: Record<string, string> = {
  working: 'Working',
  awaiting_approval: 'Awaiting Approval',
  completed: 'Complete',
  failed: 'Failed',
};

function StatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status] ?? 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

// ─── Refinement Input ─────────────────────────────────────────────────────────

interface RefinementInputProps {
  taskId: string;
  onRefine: (taskId: string, feedback: string) => void;
  onCancel: () => void;
}

function RefinementInput({ taskId, onRefine, onCancel }: RefinementInputProps) {
  const [feedback, setFeedback] = useState('');

  const handleSend = () => {
    const trimmed = feedback.trim();
    if (!trimmed) return;
    onRefine(taskId, trimmed);
    setFeedback('');
  };

  return (
    <div className="mt-2 p-2 rounded bg-slate-800/60 border border-slate-600/60">
      <p className="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wide font-medium">
        Request Changes
      </p>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Describe what needs to be changed or refined..."
        rows={3}
        className="w-full bg-slate-900/60 border border-slate-600 rounded px-2 py-1.5
          text-xs text-white placeholder-gray-500
          focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
          resize-none"
      />
      <div className="flex gap-2 mt-1.5">
        <button
          onClick={handleSend}
          disabled={!feedback.trim()}
          className="flex-1 px-2 py-1 text-xs rounded bg-amber-600 hover:bg-amber-500
            text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Send Feedback
        </button>
        <button
          onClick={onCancel}
          className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600
            text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Suggestion Card with Refine Button ──────────────────────────────────────

interface TaskSuggestionCardProps {
  suggestion: SuggestionData;
  taskId: string;
  onApprove: (taskId: string, suggestionId: string) => void;
  onDismiss: (taskId: string, suggestionId: string) => void;
  onRefine: (taskId: string, feedback: string) => void;
}

function TaskSuggestionCard({
  suggestion,
  taskId,
  onApprove,
  onDismiss,
  onRefine,
}: TaskSuggestionCardProps) {
  const [showRefinement, setShowRefinement] = useState(false);

  return (
    <div className="mb-3">
      {/* Render the standard suggestion card for accept/dismiss */}
      <IronclawSuggestion
        suggestion={suggestion}
        onAccept={(id) => onApprove(taskId, id)}
        onDismiss={(id) => onDismiss(taskId, id)}
      />

      {/* Request Changes button — shown below the suggestion card */}
      {!showRefinement && (
        <button
          onClick={() => setShowRefinement(true)}
          className="w-full mt-1 px-3 py-1 text-xs rounded border border-slate-600
            bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-slate-300
            transition-colors"
        >
          Request Changes
        </button>
      )}

      {/* Inline refinement input */}
      {showRefinement && (
        <RefinementInput
          taskId={taskId}
          onRefine={onRefine}
          onCancel={() => setShowRefinement(false)}
        />
      )}
    </div>
  );
}

// ─── Completion Summary ───────────────────────────────────────────────────────

interface CompletionSummaryProps {
  suggestions: SuggestionData[];
  appliedIds: Set<string>;
  dismissedIds: Set<string>;
}

function CompletionSummary({ suggestions, appliedIds, dismissedIds }: CompletionSummaryProps) {
  const applied = suggestions.filter((s) => appliedIds.has(s.id)).length;
  const dismissed = suggestions.filter((s) => dismissedIds.has(s.id)).length;
  const total = suggestions.length;

  return (
    <div className="mt-2 p-2 rounded bg-green-900/20 border border-green-700/40">
      <div className="flex items-center gap-1.5 mb-1">
        <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-xs font-medium text-green-300">All suggestions resolved</span>
      </div>
      <p className="text-[10px] text-slate-400">
        {applied}/{total} applied &middot; {dismissed} dismissed
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface IronclawTaskPanelProps {
  task: IronclawTaskData;
  onApprove: (taskId: string, suggestionId: string) => void;
  onDismiss: (taskId: string, suggestionId: string) => void;
  onRefine: (taskId: string, feedback: string) => void;
}

export function IronclawTaskPanel({
  task,
  onApprove,
  onDismiss,
  onRefine,
}: IronclawTaskPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const isAwaitingApproval = task.status === 'awaiting_approval';
  const resolvedCount = appliedIds.size + dismissedIds.size;
  const totalSuggestions = task.suggestions.length;
  const allResolved = totalSuggestions > 0 && resolvedCount >= totalSuggestions;

  const pendingSuggestions = task.suggestions.filter(
    (s) => !appliedIds.has(s.id) && !dismissedIds.has(s.id),
  );

  const handleApprove = (taskId: string, suggestionId: string) => {
    setAppliedIds((prev) => new Set([...prev, suggestionId]));
    onApprove(taskId, suggestionId);
  };

  const handleDismiss = (taskId: string, suggestionId: string) => {
    setDismissedIds((prev) => new Set([...prev, suggestionId]));
    onDismiss(taskId, suggestionId);
  };

  return (
    <div className="mx-4 mb-3 rounded-lg border border-slate-700/80 bg-slate-800/50 overflow-hidden">
      {/* Panel header */}
      <button
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2
          hover:bg-slate-700/40 transition-colors text-left"
        aria-expanded={!isCollapsed}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Task icon */}
          <svg
            className="w-3.5 h-3.5 text-amber-400 shrink-0"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <span className="text-xs font-medium text-white truncate">{task.title}</span>
          <StatusBadge status={task.status} />
        </div>

        {/* Collapse chevron */}
        <svg
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Panel body */}
      {!isCollapsed && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-700/60">
          {/* Step progress stepper */}
          <IronclawStepStream progress={task.stepProgress} />

          {/* Suggestion cards — only shown when awaiting approval */}
          {isAwaitingApproval && totalSuggestions > 0 && (
            <div className="mt-3">
              {allResolved ? (
                <CompletionSummary
                  suggestions={task.suggestions}
                  appliedIds={appliedIds}
                  dismissedIds={dismissedIds}
                />
              ) : (
                <>
                  <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-wide font-medium">
                    Agent Results ({pendingSuggestions.length} pending)
                  </p>
                  {pendingSuggestions.map((suggestion) => (
                    <TaskSuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      taskId={task.taskId}
                      onApprove={handleApprove}
                      onDismiss={handleDismiss}
                      onRefine={onRefine}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
