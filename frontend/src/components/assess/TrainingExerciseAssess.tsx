/**
 * TrainingExerciseAssess
 *
 * Phase 37 Plan 05: Exercise-level training assessment view.
 * Two sidebar views: Event Timeline (chronological AAR list with inline METL ratings)
 * and Exercise METL Aggregate (latest rating per task across all events).
 *
 * Uses TabLayout for sidebar navigation.
 */

import { useState, useEffect, useCallback } from 'react';
import { TabLayout, type SidebarItem } from '../tabs/TabLayout.tsx';
import {
  assessmentService,
  type StructuredAAR,
  type METLAssessment,
  type METLProficiencySummary,
  type DecayReportEntry,
  type AARObservation,
} from '../../lib/assessment-service.ts';
import './TrainingExerciseAssess.css';

const EXERCISE_TRAINING_ITEMS: SidebarItem[] = [
  { id: 'event-timeline', label: 'Event Timeline' },
  { id: 'exercise-aggregate', label: 'Exercise METL Aggregate' },
];

interface TrainingExerciseAssessProps {
  problemSetId: string;
}

export function TrainingExerciseAssess({ problemSetId }: TrainingExerciseAssessProps) {
  const [selectedView, setSelectedView] = useState('event-timeline');
  const [aars, setAars] = useState<StructuredAAR[]>([]);
  const [proficiencyData, setProficiencyData] = useState<METLProficiencySummary[]>([]);
  const [decayReport, setDecayReport] = useState<DecayReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [aarList, profResult] = await Promise.all([
        assessmentService.listAARs(problemSetId),
        assessmentService.getLatestProficiency(problemSetId),
      ]);
      // Sort AARs by createdAt DESC
      setAars(aarList.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
      setProficiencyData(profResult.proficiency);
      setDecayReport(profResult.decayReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exercise data');
    } finally {
      setLoading(false);
    }
  }, [problemSetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="exercise-assess-loading">
        <p>Loading exercise assessment data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="exercise-assess-error">
        <p>Error: {error}</p>
        <button onClick={loadData}>Retry</button>
      </div>
    );
  }

  return (
    <TabLayout
      items={EXERCISE_TRAINING_ITEMS}
      selectedItem={selectedView}
      onSelectItem={setSelectedView}
      header={<span className="training-badge">TRAINING</span>}
    >
      {selectedView === 'event-timeline' && (
        <EventTimeline aars={aars} />
      )}
      {selectedView === 'exercise-aggregate' && (
        <ExerciseMETLAggregate
          proficiencyData={proficiencyData}
          decayReport={decayReport}
        />
      )}
    </TabLayout>
  );
}

// ============================================================================
// Event Timeline
// ============================================================================

interface EventTimelineProps {
  aars: StructuredAAR[];
}

function EventTimeline({ aars }: EventTimelineProps) {
  return (
    <div className="event-timeline">
      <div className="timeline-header">
        <h3>Event Timeline</h3>
        <p className="timeline-subtitle">
          Chronological list of training events and their METL assessments
        </p>
      </div>

      <div className="timeline-info">
        <span className="timeline-info-text">
          Training events are created at the tactical level within this exercise.
        </span>
      </div>

      {aars.length === 0 && (
        <p className="timeline-empty">
          No training events recorded yet. Events will appear here after AARs are created at the tactical level.
        </p>
      )}

      <div className="timeline-list">
        {aars.map(aar => (
          <EventCard key={aar.id} aar={aar} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Event Card (expandable)
// ============================================================================

interface EventCardProps {
  aar: StructuredAAR;
}

function EventCard({ aar }: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [assessments, setAssessments] = useState<METLAssessment[]>([]);
  const [aarDetail, setAarDetail] = useState<(StructuredAAR & { observations: AARObservation[] }) | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const toggleExpand = async () => {
    if (!expanded && assessments.length === 0) {
      setLoadingDetail(true);
      try {
        const [metlAssessments, detail] = await Promise.all([
          assessmentService.getAssessmentsByAAR(aar.id),
          assessmentService.getAAR(aar.id),
        ]);
        setAssessments(metlAssessments);
        setAarDetail(detail);
      } catch {
        // Silently handle -- will show empty
      } finally {
        setLoadingDetail(false);
      }
    }
    setExpanded(!expanded);
  };

  const statusClass = `aar-status-${aar.status}`;

  return (
    <div className={`event-card ${expanded ? 'expanded' : ''}`}>
      <div className="event-card-header" onClick={toggleExpand}>
        <div className="event-card-info">
          <span className="event-name">{aar.trainingEventName}</span>
          <span className="event-date">
            {new Date(aar.createdAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </span>
        </div>
        <div className="event-card-badges">
          <span className={`aar-status-badge ${statusClass}`}>
            {aar.status.replace('_', ' ')}
          </span>
          {assessments.length > 0 && !expanded && (
            <span className="event-assessment-count">{assessments.length} tasks</span>
          )}
        </div>
        <span className="event-expand-icon">{expanded ? '\u25B2' : '\u25BC'}</span>
      </div>

      {expanded && (
        <div className="event-card-detail">
          {loadingDetail ? (
            <p className="detail-loading">Loading event details...</p>
          ) : (
            <>
              {/* Inline METL ratings */}
              {assessments.length > 0 && (
                <div className="event-metl-ratings">
                  <h4>METL Task Ratings</h4>
                  <div className="event-rating-grid">
                    {assessments.map(a => (
                      <div key={a.id} className="event-rating-item">
                        <span className={`event-rating-badge rating-${a.rating}`}>
                          {a.rating}
                        </span>
                        <span className="event-rating-task">{a.metlTaskId}</span>
                        {a.commanderOverride && (
                          <span className="event-cdr-badge">CDR</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AAR Detail (read-only if finalized) */}
              {aarDetail && (
                <div className="event-aar-detail">
                  <h4>After-Action Review</h4>
                  {aarDetail.whatWasPlanned && (
                    <div className="aar-section">
                      <strong>What was planned?</strong>
                      <p>{aarDetail.whatWasPlanned}</p>
                    </div>
                  )}
                  {aarDetail.whatHappened && (
                    <div className="aar-section">
                      <strong>What happened?</strong>
                      <p>{aarDetail.whatHappened}</p>
                    </div>
                  )}
                  {aarDetail.why && (
                    <div className="aar-section">
                      <strong>Why?</strong>
                      <p>{aarDetail.why}</p>
                    </div>
                  )}
                  {aarDetail.observations && aarDetail.observations.length > 0 && (
                    <div className="aar-observations-summary">
                      <strong>Observations</strong>
                      <div className="obs-list">
                        {aarDetail.observations.map(obs => (
                          <div key={obs.id} className={`obs-item obs-${obs.observationType}`}>
                            <span className="obs-type-badge">{obs.observationType}</span>
                            <span className="obs-content">{obs.content}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {assessments.length === 0 && !aarDetail?.whatWasPlanned && (
                <p className="detail-empty">No assessment data or AAR content recorded for this event.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Exercise METL Aggregate
// ============================================================================

interface ExerciseMETLAggregateProps {
  proficiencyData: METLProficiencySummary[];
  decayReport: DecayReportEntry[];
}

function ExerciseMETLAggregate({ proficiencyData, decayReport }: ExerciseMETLAggregateProps) {
  const total = proficiencyData.length;
  const trained = proficiencyData.filter(p => p.rating === 'T').length;
  const decayWarnings = decayReport.filter(d => d.decayStatus === 'warning' || d.decayStatus === 'expired').length;

  return (
    <div className="exercise-aggregate">
      <h3>Exercise METL Aggregate</h3>
      <p className="aggregate-subtitle">
        Latest rating for each METL task across all training events in this exercise
      </p>

      <div className="aggregate-summary">
        {trained} of {total} tasks at Trained{decayWarnings > 0 ? `, ${decayWarnings} decay warnings` : ''}
      </div>

      {total === 0 ? (
        <p className="aggregate-empty">No METL proficiency data available for this exercise.</p>
      ) : (
        <table className="aggregate-table">
          <thead>
            <tr>
              <th>Task Name</th>
              <th>Latest Rating</th>
              <th>Last Assessed</th>
              <th>Assessed By</th>
              <th>Decay</th>
            </tr>
          </thead>
          <tbody>
            {proficiencyData.map(p => (
              <tr key={p.metlTaskId}>
                <td className="agg-task-name">{p.taskName}</td>
                <td>
                  <span className={`agg-rating rating-${p.rating || 'none'}`}>
                    {p.rating || '--'}
                  </span>
                </td>
                <td className="agg-date">
                  {p.assessedAt
                    ? new Date(p.assessedAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })
                    : 'Never'}
                </td>
                <td className="agg-by">
                  {p.assessedBy || '--'}
                  {p.commanderOverride && <span className="agg-cdr"> (CDR)</span>}
                </td>
                <td>
                  {p.decayStatus === 'warning' && (
                    <span className="agg-decay-warning">Warning</span>
                  )}
                  {p.decayStatus === 'expired' && (
                    <span className="agg-decay-expired">Expired</span>
                  )}
                  {p.decayStatus === 'current' && (
                    <span className="agg-decay-current">Current</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
