/**
 * TrainingStrategicAssess
 *
 * Phase 37 Plan 05: Strategic-level training assessment view.
 * Four sidebar views: METL Dashboard, Readiness Overview, Trends, Manage METL Tasks.
 *
 * Uses TabLayout for sidebar navigation. Fetches proficiency data on mount
 * via assessmentService.getLatestProficiency.
 */

import { useState, useEffect, useCallback } from 'react';
import { TabLayout, type SidebarItem } from '../tabs/TabLayout.tsx';
import { METLDashboard } from './METLDashboard.tsx';
import {
  assessmentService,
  type METLProficiencySummary,
  type DecayReportEntry,
  type METLTask,
  type METLAssessment,
  type CreateMETLTaskInput,
} from '../../lib/assessment-service.ts';
import './TrainingStrategicAssess.css';

const STRATEGIC_TRAINING_ITEMS: SidebarItem[] = [
  { id: 'metl-dashboard', label: 'METL Dashboard' },
  { id: 'readiness-overview', label: 'Readiness Overview' },
  { id: 'trends', label: 'Trends' },
  { id: 'manage-tasks', label: 'Manage METL Tasks' },
];

interface TrainingStrategicAssessProps {
  problemSetId: string;
}

export function TrainingStrategicAssess({ problemSetId }: TrainingStrategicAssessProps) {
  const [selectedView, setSelectedView] = useState('metl-dashboard');
  const [proficiencyData, setProficiencyData] = useState<METLProficiencySummary[]>([]);
  const [decayReport, setDecayReport] = useState<DecayReportEntry[]>([]);
  const [metlTasks, setMetlTasks] = useState<METLTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [profResult, tasks] = await Promise.all([
        assessmentService.getLatestProficiency(problemSetId),
        assessmentService.listMETLTasks(problemSetId),
      ]);
      setProficiencyData(profResult.proficiency);
      setDecayReport(profResult.decayReport);
      setMetlTasks(tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assessment data');
    } finally {
      setLoading(false);
    }
  }, [problemSetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="strategic-assess-loading">
        <p>Loading training assessment data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="strategic-assess-error">
        <p>Error: {error}</p>
        <button onClick={loadData}>Retry</button>
      </div>
    );
  }

  return (
    <TabLayout
      items={STRATEGIC_TRAINING_ITEMS}
      selectedItem={selectedView}
      onSelectItem={setSelectedView}
      header={<span className="training-badge">TRAINING</span>}
    >
      {selectedView === 'metl-dashboard' && (
        <METLDashboard
          problemSetId={problemSetId}
          proficiencyData={proficiencyData}
        />
      )}
      {selectedView === 'readiness-overview' && (
        <ReadinessOverview
          proficiencyData={proficiencyData}
          decayReport={decayReport}
        />
      )}
      {selectedView === 'trends' && (
        <TrendsView proficiencyData={proficiencyData} />
      )}
      {selectedView === 'manage-tasks' && (
        <ManageMETLTasks
          problemSetId={problemSetId}
          tasks={metlTasks}
          onRefresh={loadData}
        />
      )}
    </TabLayout>
  );
}

// ============================================================================
// Readiness Overview
// ============================================================================

interface ReadinessOverviewProps {
  proficiencyData: METLProficiencySummary[];
  decayReport: DecayReportEntry[];
}

function ReadinessOverview({ proficiencyData, decayReport }: ReadinessOverviewProps) {
  const total = proficiencyData.length;
  const trained = proficiencyData.filter(p => p.rating === 'T').length;
  const readinessPercent = total > 0 ? Math.round((trained / total) * 100) : 0;

  // Group by competency area for breakdown
  const areaMap = new Map<string, { t: number; p: number; u: number; none: number }>();
  for (const item of proficiencyData) {
    const area = item.competencyArea || 'Uncategorized';
    const counts = areaMap.get(area) || { t: 0, p: 0, u: 0, none: 0 };
    if (item.rating === 'T') counts.t++;
    else if (item.rating === 'P') counts.p++;
    else if (item.rating === 'U') counts.u++;
    else counts.none++;
    areaMap.set(area, counts);
  }

  // Decay alerts
  const decayAlerts = decayReport.filter(d => d.decayStatus === 'warning' || d.decayStatus === 'expired');

  return (
    <div className="readiness-overview">
      <h3>Readiness Overview</h3>

      {/* Overall readiness */}
      <div className="readiness-overall">
        <div className="readiness-score">
          <span className="readiness-percent">{readinessPercent}%</span>
          <span className="readiness-label">Overall Readiness</span>
          <span className="readiness-detail">{trained} of {total} tasks at Trained</span>
        </div>
        <div className="readiness-bar-container">
          <div className="readiness-bar-fill" style={{ width: `${readinessPercent}%` }} />
        </div>
      </div>

      {/* Per-competency breakdown */}
      <div className="readiness-breakdown">
        <h4>By Competency Area</h4>
        {Array.from(areaMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([area, counts]) => {
          const areaTotal = counts.t + counts.p + counts.u + counts.none;
          const tPct = (counts.t / areaTotal) * 100;
          const pPct = (counts.p / areaTotal) * 100;
          const uPct = (counts.u / areaTotal) * 100;

          return (
            <div key={area} className="readiness-area-row">
              <span className="readiness-area-name">{area}</span>
              <div className="readiness-stacked-bar">
                {counts.t > 0 && (
                  <div className="bar-segment bar-trained" style={{ width: `${tPct}%` }} title={`T: ${counts.t}`} />
                )}
                {counts.p > 0 && (
                  <div className="bar-segment bar-practiced" style={{ width: `${pPct}%` }} title={`P: ${counts.p}`} />
                )}
                {counts.u > 0 && (
                  <div className="bar-segment bar-untrained" style={{ width: `${uPct}%` }} title={`U: ${counts.u}`} />
                )}
              </div>
              <span className="readiness-area-counts">
                {counts.t}T / {counts.p}P / {counts.u}U
              </span>
            </div>
          );
        })}
      </div>

      {/* Decay Alerts */}
      {decayAlerts.length > 0 && (
        <div className="readiness-decay-alerts">
          <h4>Decay Alerts</h4>
          <div className="decay-alert-list">
            {decayAlerts.map(alert => (
              <div
                key={alert.metlTaskId}
                className={`decay-alert-item ${alert.decayStatus === 'expired' ? 'alert-expired' : 'alert-warning'}`}
              >
                <span className="decay-alert-name">{alert.taskName}</span>
                <span className="decay-alert-status">
                  {alert.decayStatus === 'expired'
                    ? `Expired (${Math.abs(alert.daysRemaining)} days overdue)`
                    : `Warning (${alert.daysRemaining} days remaining)`
                  }
                </span>
                <span className="decay-alert-rating">
                  {alert.rating ? `Last rated: ${alert.rating}` : 'Never assessed'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Trends View
// ============================================================================

interface TrendsViewProps {
  proficiencyData: METLProficiencySummary[];
}

interface TaskHistory {
  taskId: string;
  taskName: string;
  history: METLAssessment[];
  loading: boolean;
}

function TrendsView({ proficiencyData }: TrendsViewProps) {
  const [taskHistories, setTaskHistories] = useState<TaskHistory[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function fetchHistories() {
      // Fetch history for each task (limit to recent activity)
      const tasks = proficiencyData.filter(p => p.rating); // Only tasks with at least one rating
      const histories: TaskHistory[] = [];

      for (const task of tasks.slice(0, 20)) {
        try {
          const history = await assessmentService.getAssessmentHistory(task.metlTaskId);
          histories.push({
            taskId: task.metlTaskId,
            taskName: task.taskName,
            history: history.sort((a, b) =>
              new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime()
            ),
            loading: false,
          });
        } catch {
          histories.push({
            taskId: task.metlTaskId,
            taskName: task.taskName,
            history: [],
            loading: false,
          });
        }
      }
      setTaskHistories(histories);
      setLoaded(true);
    }

    fetchHistories();
  }, [proficiencyData]);

  if (!loaded) {
    return <div className="trends-loading">Loading trend data...</div>;
  }

  if (taskHistories.length === 0) {
    return (
      <div className="trends-empty">
        <h3>Trends</h3>
        <p>No assessment history available yet. Trends will appear after training events are assessed.</p>
      </div>
    );
  }

  return (
    <div className="trends-view">
      <h3>Assessment Trends</h3>
      <p className="trends-subtitle">Rating history for assessed METL tasks (most recent first)</p>

      <div className="trends-list">
        {taskHistories.map(th => (
          <div key={th.taskId} className="trend-task-card">
            <div className="trend-task-header">
              <span className="trend-task-name">{th.taskName}</span>
              {th.history.length >= 2 && (
                <TrendIndicator
                  current={th.history[0].rating}
                  previous={th.history[1].rating}
                />
              )}
            </div>
            <div className="trend-history-timeline">
              {th.history.map(assessment => (
                <div key={assessment.id} className="trend-history-entry">
                  <span className={`trend-rating-badge rating-${assessment.rating}`}>
                    {assessment.rating}
                  </span>
                  <span className="trend-date">
                    {new Date(assessment.assessedAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                  {assessment.commanderOverride && (
                    <span className="trend-override">CDR Override</span>
                  )}
                  {assessment.notes && (
                    <span className="trend-notes" title={assessment.notes}>
                      {assessment.notes.substring(0, 40)}{assessment.notes.length > 40 ? '...' : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const RATING_ORDER: Record<string, number> = { U: 0, P: 1, T: 2 };

function TrendIndicator({ current, previous }: { current: string; previous: string }) {
  const currentVal = RATING_ORDER[current] ?? 0;
  const previousVal = RATING_ORDER[previous] ?? 0;

  if (currentVal > previousVal) {
    return <span className="trend-indicator trend-improving" title="Improving">Improving</span>;
  }
  if (currentVal < previousVal) {
    return <span className="trend-indicator trend-declining" title="Declining">Declining</span>;
  }
  return <span className="trend-indicator trend-stable" title="Stable">Stable</span>;
}

// ============================================================================
// Manage METL Tasks
// ============================================================================

interface ManageMETLTasksProps {
  problemSetId: string;
  tasks: METLTask[];
  onRefresh: () => void;
}

function ManageMETLTasks({ problemSetId, tasks, onRefresh }: ManageMETLTasksProps) {
  const [showForm, setShowForm] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [competencyArea, setCompetencyArea] = useState('');
  const [decayDays, setDecayDays] = useState('90');
  const [submitting, setSubmitting] = useState(false);
  const [promoteLoading, setPromoteLoading] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;

    try {
      setSubmitting(true);
      const input: CreateMETLTaskInput = {
        problemSetId,
        taskName: taskName.trim(),
        taskDescription: taskDescription.trim() || undefined,
        competencyArea: competencyArea.trim() || undefined,
        decayDays: parseInt(decayDays) || 90,
      };
      await assessmentService.createMETLTask(input);
      setTaskName('');
      setTaskDescription('');
      setCompetencyArea('');
      setDecayDays('90');
      setShowForm(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to create METL task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromote = async (taskId: string) => {
    try {
      setPromoteLoading(taskId);
      await assessmentService.promoteMETLTask(taskId);
      onRefresh();
    } catch (err) {
      console.error('Failed to promote task:', err);
    } finally {
      setPromoteLoading(null);
    }
  };

  return (
    <div className="manage-metl-tasks">
      <div className="manage-header">
        <h3>Manage METL Tasks</h3>
        <button
          className="btn-add-task"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : 'Add METL Task'}
        </button>
      </div>

      {/* Add Task Form */}
      {showForm && (
        <form className="add-task-form" onSubmit={handleCreate}>
          <div className="form-row">
            <label>
              Task Name *
              <input
                type="text"
                value={taskName}
                onChange={e => setTaskName(e.target.value)}
                placeholder="e.g., Conduct Joint Force Entry Operations"
                required
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Description
              <textarea
                value={taskDescription}
                onChange={e => setTaskDescription(e.target.value)}
                placeholder="Task description..."
                rows={2}
              />
            </label>
          </div>
          <div className="form-row form-row-split">
            <label>
              Competency Area
              <input
                type="text"
                value={competencyArea}
                onChange={e => setCompetencyArea(e.target.value)}
                placeholder="e.g., Force Projection"
              />
            </label>
            <label>
              Decay Days
              <input
                type="number"
                value={decayDays}
                onChange={e => setDecayDays(e.target.value)}
                min="1"
                max="365"
              />
            </label>
          </div>
          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Task'}
          </button>
        </form>
      )}

      {/* Task List */}
      <div className="metl-task-list">
        {tasks.length === 0 && (
          <p className="tasks-empty">No METL tasks defined at this level. Click "Add METL Task" to create one.</p>
        )}
        {tasks.map(task => (
          <div key={task.id} className="metl-task-row-manage">
            <div className="task-info">
              <span className="task-name-manage">{task.taskName}</span>
              {task.competencyArea && (
                <span className="task-area-badge">{task.competencyArea}</span>
              )}
              {task.isSupplemental && !task.promotedToStrategic && (
                <span className="task-supplemental-badge">Supplemental</span>
              )}
              {task.promotedToStrategic && (
                <span className="task-promoted-badge">Promoted</span>
              )}
            </div>
            <div className="task-meta">
              <span className="task-decay">Decay: {task.decayDays}d</span>
              {task.isSupplemental && !task.promotedToStrategic && (
                <button
                  className="btn-promote"
                  onClick={() => handlePromote(task.id)}
                  disabled={promoteLoading === task.id}
                >
                  {promoteLoading === task.id ? 'Promoting...' : 'Promote'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
