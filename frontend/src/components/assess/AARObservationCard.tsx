/**
 * AARObservationCard
 *
 * Phase 37 Plan 04: Renders a single AAR observation (sustain or improve)
 * with AI suggestion handling and METL task linking.
 */

import type { AARObservation, METLTask } from '../../lib/assessment-service';

export interface AARObservationCardProps {
  observation: AARObservation;
  metlTasks: METLTask[];
  readOnly: boolean;
  onUpdate?: (id: string, updates: { aiAccepted?: boolean; content?: string }) => void;
}

export function AARObservationCard({
  observation,
  metlTasks,
  readOnly,
  onUpdate,
}: AARObservationCardProps) {
  const isSustain = observation.observationType === 'sustain';
  const linkedTask = observation.metlTaskId
    ? metlTasks.find((t) => t.id === observation.metlTaskId)
    : null;

  const isRejected = observation.suggestedByAi && observation.aiAccepted === false;

  return (
    <div
      className={`aar-obs-card ${isRejected ? 'aar-obs-card--dimmed' : ''}`}
    >
      <div className="aar-obs-card-header">
        <span
          className={`aar-obs-type-badge ${
            isSustain ? 'aar-obs-type--sustain' : 'aar-obs-type--improve'
          }`}
        >
          {isSustain ? 'SUSTAIN' : 'IMPROVE'}
        </span>

        {observation.suggestedByAi && (
          <span className="aar-obs-ai-tag">AI Suggested</span>
        )}

        {observation.suggestedByAi && observation.aiAccepted === true && (
          <span className="aar-obs-ai-chip aar-obs-ai-chip--accepted">Accepted</span>
        )}

        {observation.suggestedByAi && observation.aiAccepted === false && (
          <span className="aar-obs-ai-chip aar-obs-ai-chip--rejected">Rejected</span>
        )}
      </div>

      <p className="aar-obs-card-content">{observation.content}</p>

      {linkedTask && (
        <div className="aar-obs-card-metl-link">
          METL: {linkedTask.taskName}
          {linkedTask.competencyArea && (
            <span className="aar-obs-card-comp-area"> ({linkedTask.competencyArea})</span>
          )}
        </div>
      )}

      {/* Accept/Reject buttons for pending AI suggestions */}
      {observation.suggestedByAi &&
        observation.aiAccepted == null &&
        !readOnly &&
        onUpdate && (
          <div className="aar-obs-ai-actions">
            <button
              className="btn-accept"
              onClick={() => onUpdate(observation.id, { aiAccepted: true })}
            >
              Accept
            </button>
            <button
              className="btn-reject"
              onClick={() => onUpdate(observation.id, { aiAccepted: false })}
            >
              Reject
            </button>
          </div>
        )}

      <div className="aar-obs-card-footer">
        <span className="aar-obs-card-author">{observation.createdBy}</span>
        <span className="aar-obs-card-date">
          {new Date(observation.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
