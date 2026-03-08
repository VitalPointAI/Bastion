/**
 * METLTaskAssessment
 *
 * Phase 37 Plan 04: T/P/U rating assignment per METL task.
 * Shows task list with rating selectors, notes, and commander override option.
 */

import { useState } from 'react';
import { useProblemSet } from '../../context/ProblemSetContext.tsx';
import type {
  METLTask,
  METLAssessment,
  METLRating,
  CreateMETLAssessmentInput,
  AIRatingSuggestion,
} from '../../lib/assessment-service';
import { assessmentService } from '../../lib/assessment-service';

// ============================================================================
// Props
// ============================================================================

export interface METLTaskAssessmentProps {
  problemSetId: string;
  aarId?: string;
  metlTasks: METLTask[];
  existingAssessments: METLAssessment[];
  onAssess: (assessment: CreateMETLAssessmentInput) => void;
}

// ============================================================================
// Local rating state per task
// ============================================================================

interface TaskRatingState {
  rating: METLRating | null;
  notes: string;
  override: boolean;
}

// ============================================================================
// Component
// ============================================================================

const RATING_OPTIONS: METLRating[] = ['T', 'P', 'U'];
const RATING_LABELS: Record<METLRating, string> = { T: 'Trained', P: 'Practiced', U: 'Untrained' };

export function METLTaskAssessment({
  problemSetId: _problemSetId,
  aarId,
  metlTasks,
  existingAssessments,
  onAssess,
}: METLTaskAssessmentProps) {
  const { userRoleInActive } = useProblemSet();
  const canOverride = userRoleInActive === 'commander' || userRoleInActive === 'xo';

  // Split tasks into inherited and supplemental
  const inheritedTasks = metlTasks.filter((t) => !t.isSupplemental);
  const supplementalTasks = metlTasks.filter((t) => t.isSupplemental);

  // Rating state keyed by taskId
  const [ratings, setRatings] = useState<Record<string, TaskRatingState>>(() => {
    const init: Record<string, TaskRatingState> = {};
    metlTasks.forEach((t) => {
      init[t.id] = { rating: null, notes: '', override: false };
    });
    return init;
  });

  const [submitting, setSubmitting] = useState(false);

  // AI rating suggestion state
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AIRatingSuggestion>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function handleGetAISuggestions() {
    if (!aarId) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const suggestions = await assessmentService.generateAIRatingSuggestions(aarId);
      const sugMap: Record<string, AIRatingSuggestion> = {};
      for (const s of suggestions) {
        sugMap[s.metlTaskId] = s;
        // Pre-select the AI-suggested rating if no manual selection yet
        if (!ratings[s.metlTaskId]?.rating) {
          updateTaskRating(s.metlTaskId, { rating: s.suggestedRating });
        }
      }
      setAiSuggestions(sugMap);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get AI suggestions';
      setAiError(msg);
    } finally {
      setAiLoading(false);
    }
  }

  function updateTaskRating(taskId: string, partial: Partial<TaskRatingState>) {
    setRatings((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], ...partial },
    }));
  }

  function getCurrentRating(taskId: string): METLAssessment | undefined {
    return existingAssessments.find((a) => a.metlTaskId === taskId);
  }

  function handleSubmit() {
    setSubmitting(true);
    const toSubmit = Object.entries(ratings).filter(([, s]) => s.rating !== null);
    toSubmit.forEach(([taskId, state]) => {
      onAssess({
        metlTaskId: taskId,
        aarId,
        rating: state.rating!,
        notes: state.notes || undefined,
        assessedBy: '', // caller fills this from user context
        commanderOverride: state.override || undefined,
      });
    });
    setSubmitting(false);
  }

  const hasRatings = Object.values(ratings).some((s) => s.rating !== null);

  function renderTaskRow(task: METLTask) {
    const current = getCurrentRating(task.id);
    const state = ratings[task.id];
    const aiSug = aiSuggestions[task.id];

    return (
      <div
        key={task.id}
        className={`metl-task-row ${task.isSupplemental ? 'metl-task-row--supplemental' : ''}${aiSug ? ' metl-task-row--ai-suggested' : ''}`}
      >
        <div className="metl-task-info">
          <span className="metl-task-name">
            {task.taskName}
            {task.isSupplemental && (
              <span className="metl-task-supplemental-label"> (Supplemental)</span>
            )}
          </span>
          {task.competencyArea && (
            <span className="metl-task-comp-area">{task.competencyArea}</span>
          )}
          {aiSug && (
            <span
              className={`metl-ai-suggestion-label metl-ai-suggestion-label--${aiSug.suggestedRating}`}
              title={aiSug.rationale}
            >
              AI suggests: {aiSug.suggestedRating}
            </span>
          )}
        </div>

        <div className="metl-task-current-rating">
          {current ? (
            <span className={`status-badge status-${current.rating === 'T' ? 'green' : current.rating === 'P' ? 'yellow' : 'red'}`}>
              {RATING_LABELS[current.rating]}
            </span>
          ) : (
            <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Not assessed</span>
          )}
        </div>

        <div>
          <div className="metl-rating-selector">
            {RATING_OPTIONS.map((r) => (
              <button
                key={r}
                className={`metl-rating-btn metl-rating-btn--${r} ${
                  state?.rating === r ? 'active' : ''
                }`}
                onClick={() => updateTaskRating(task.id, { rating: r })}
                title={RATING_LABELS[r]}
              >
                {r}
              </button>
            ))}
          </div>

          {state?.rating && (
            <input
              className="metl-task-notes-input"
              type="text"
              placeholder="Notes (optional)"
              value={state.notes}
              onChange={(e) => updateTaskRating(task.id, { notes: e.target.value })}
            />
          )}

          {canOverride && state?.rating && (
            <div className="metl-override-row">
              <input
                type="checkbox"
                id={`override-${task.id}`}
                checked={state.override}
                onChange={(e) =>
                  updateTaskRating(task.id, { override: e.target.checked })
                }
              />
              <label htmlFor={`override-${task.id}`}>Commander Override</label>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="metl-assessment">
      <div className="metl-assessment-header">
        <h2>Task Assessment</h2>
        {aarId && <span className="metl-assessment-aar-ref">Linked to AAR</span>}
        <button
          className="metl-ai-suggest-btn"
          onClick={handleGetAISuggestions}
          disabled={!aarId || aiLoading}
          title={
            !aarId
              ? 'Link an AAR to get AI rating suggestions'
              : aiLoading
              ? 'Generating suggestions...'
              : 'Get AI-suggested T/P/U ratings based on AAR observations'
          }
        >
          {aiLoading ? 'Generating...' : 'Get AI Rating Suggestions'}
        </button>
      </div>
      {aiError && (
        <div className="metl-ai-error">{aiError}</div>
      )}

      {/* Inherited tasks */}
      <div className="metl-task-list">
        {inheritedTasks.map(renderTaskRow)}
      </div>

      {/* Supplemental tasks */}
      {supplementalTasks.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #94a3b8)', margin: '0.5rem 0' }}>
            Supplemental Tasks
          </h3>
          <div className="metl-task-list">
            {supplementalTasks.map(renderTaskRow)}
          </div>
        </>
      )}

      <div className="metl-submit-bar">
        <button
          className="metl-submit-btn"
          disabled={!hasRatings || submitting}
          onClick={handleSubmit}
        >
          Submit Assessments
        </button>
      </div>
    </div>
  );
}
