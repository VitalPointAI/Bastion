/**
 * AARForm
 *
 * Phase 37 Plan 04: Structured 4-section AAR form per FM 7-0.
 * Sections: What Was Planned, What Happened, Why (analysis), Observations.
 * Lifecycle: draft -> in_review -> finalized (locked read-only).
 */

import { useState } from 'react';
import type {
  StructuredAAR,
  AARObservation,
  AARObservationType,
  METLTask,
} from '../../lib/assessment-service';
import { assessmentService } from '../../lib/assessment-service';
import { AARObservationCard } from './AARObservationCard.tsx';

// ============================================================================
// Props
// ============================================================================

export interface AARFormProps {
  aar: StructuredAAR;
  observations: AARObservation[];
  metlTasks: METLTask[];
  onUpdate: (updated: {
    whatWasPlanned?: string;
    whatHappened?: string;
    why?: string;
    status?: 'draft' | 'in_review';
  }) => void;
  onFinalize: () => void;
  onAddObservation: (obs: {
    observationType: AARObservationType;
    content: string;
    metlTaskId?: string;
  }) => void;
  onUpdateObservation: (
    id: string,
    updates: { aiAccepted?: boolean; content?: string }
  ) => void;
  /** Called after AI suggestions are generated so parent can refresh observations */
  onObservationsGenerated?: (newObs: AARObservation[]) => void;
}

// ============================================================================
// Status badge
// ============================================================================

function AARStatusBadge({ status }: { status: StructuredAAR['status'] }) {
  const labels: Record<string, string> = {
    draft: 'DRAFT',
    in_review: 'IN REVIEW',
    finalized: 'FINALIZED',
  };
  const colors: Record<string, string> = {
    draft: 'status-yellow',
    in_review: 'status-green',
    finalized: 'status-green',
  };
  return (
    <span className={`status-badge ${colors[status] ?? ''}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ============================================================================
// Component
// ============================================================================

export function AARForm({
  aar,
  observations,
  metlTasks,
  onUpdate,
  onFinalize,
  onAddObservation,
  onUpdateObservation,
  onObservationsGenerated,
}: AARFormProps) {
  const isFinalized = aar.status === 'finalized';
  const isInReview = aar.status === 'in_review';

  // Local draft state for textareas
  const [whatWasPlanned, setWhatWasPlanned] = useState(aar.whatWasPlanned);
  const [whatHappened, setWhatHappened] = useState(aar.whatHappened);
  const [why, setWhy] = useState(aar.why);

  // Inline observation form state
  const [addingObsType, setAddingObsType] = useState<AARObservationType | null>(null);
  const [obsContent, setObsContent] = useState('');
  const [obsMetlTaskId, setObsMetlTaskId] = useState('');

  // Finalize confirmation
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);

  // AI suggestion state
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const sustainObs = observations.filter((o) => o.observationType === 'sustain');
  const improveObs = observations.filter((o) => o.observationType === 'improve');

  function handleSaveDraft() {
    onUpdate({ whatWasPlanned, whatHappened, why });
  }

  function handleSubmitForReview() {
    onUpdate({ whatWasPlanned, whatHappened, why, status: 'in_review' });
  }

  function handleFinalize() {
    setShowFinalizeConfirm(false);
    onFinalize();
  }

  function handleAddObservation() {
    if (!addingObsType || !obsContent.trim()) return;
    onAddObservation({
      observationType: addingObsType,
      content: obsContent.trim(),
      metlTaskId: obsMetlTaskId || undefined,
    });
    setAddingObsType(null);
    setObsContent('');
    setObsMetlTaskId('');
  }

  const hasAARContent = !!(aar.whatWasPlanned || aar.whatHappened);
  const canGenerateAI = hasAARContent && !isFinalized;

  async function handleGenerateAISuggestions() {
    setAiGenerating(true);
    setAiError(null);
    try {
      const newObs = await assessmentService.generateAIObservations(aar.id);
      onObservationsGenerated?.(newObs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate AI suggestions';
      setAiError(msg);
    } finally {
      setAiGenerating(false);
    }
  }

  function renderObsList(obs: AARObservation[], type: AARObservationType) {
    return (
      <div className="aar-obs-column">
        <h4 className="aar-obs-column-title">
          {type === 'sustain' ? 'Sustain' : 'Improve'}
          <span className="aar-obs-count">({obs.length})</span>
        </h4>
        {obs.length === 0 && (
          <p className="aar-obs-empty">No {type} observations yet.</p>
        )}
        {obs.map((o) => (
          <AARObservationCard
            key={o.id}
            observation={o}
            metlTasks={metlTasks}
            readOnly={isFinalized}
            onUpdate={onUpdateObservation}
          />
        ))}
        {!isFinalized && (
          <button
            className="add-measure-btn"
            onClick={() => {
              setAddingObsType(type);
              setObsContent('');
              setObsMetlTaskId('');
            }}
          >
            + Add Observation
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="aar-form">
      {/* Section header */}
      <div className="aar-form-header">
        <h2 className="aar-form-title">{aar.trainingEventName}</h2>
        <AARStatusBadge status={aar.status} />
        {isFinalized && aar.finalizedAt && (
          <span className="aar-finalized-ts">
            Finalized {new Date(aar.finalizedAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Section 1: What Was Planned */}
      <div className="aar-section">
        <label className="aar-section-label">1. What Was Planned?</label>
        <textarea
          className="aar-section-textarea"
          value={whatWasPlanned}
          onChange={(e) => setWhatWasPlanned(e.target.value)}
          readOnly={isFinalized}
          placeholder="Describe the planned objectives, tasks, and expected outcomes..."
          rows={4}
        />
      </div>

      {/* Section 2: What Happened */}
      <div className="aar-section">
        <label className="aar-section-label">2. What Happened?</label>
        <textarea
          className="aar-section-textarea"
          value={whatHappened}
          onChange={(e) => setWhatHappened(e.target.value)}
          readOnly={isFinalized}
          placeholder="Describe actual events, actions taken, and outcomes observed..."
          rows={4}
        />
      </div>

      {/* Section 3: Why */}
      <div className="aar-section">
        <label className="aar-section-label">3. Why? (Analysis)</label>
        <textarea
          className="aar-section-textarea"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          readOnly={isFinalized}
          placeholder="Analyze causes of successes and shortfalls..."
          rows={4}
        />
      </div>

      {/* Section 4: Observations */}
      <div className="aar-section">
        <div className="aar-obs-header">
          <label className="aar-section-label">4. Observations</label>
          {!isFinalized && (
            <div className="aar-ai-suggestion-controls">
              <button
                className="aar-btn aar-btn--ai-suggest"
                onClick={handleGenerateAISuggestions}
                disabled={!canGenerateAI || aiGenerating}
                title={
                  !hasAARContent
                    ? 'Add content to at least one AAR section first'
                    : aiGenerating
                    ? 'Generating suggestions...'
                    : 'Generate AI-suggested observations'
                }
              >
                {aiGenerating ? 'Generating...' : 'Generate AI Suggestions'}
              </button>
              <span className="aar-ai-info">
                AI will suggest sustain/improve observations based on your AAR content. Review each suggestion before accepting.
              </span>
            </div>
          )}
        </div>
        {aiError && (
          <div className="aar-ai-error">{aiError}</div>
        )}
        <div className="aar-obs-columns">
          {renderObsList(sustainObs, 'sustain')}
          {renderObsList(improveObs, 'improve')}
        </div>

        {/* Inline add observation form */}
        {addingObsType && (
          <div className="add-measure-form">
            <label className="aar-section-label">
              New {addingObsType === 'sustain' ? 'Sustain' : 'Improve'} Observation
            </label>
            <textarea
              value={obsContent}
              onChange={(e) => setObsContent(e.target.value)}
              placeholder="Observation content..."
              rows={3}
            />
            <select
              value={obsMetlTaskId}
              onChange={(e) => setObsMetlTaskId(e.target.value)}
            >
              <option value="">Link to METL Task (optional)</option>
              {metlTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.taskName}
                  {t.competencyArea ? ` (${t.competencyArea})` : ''}
                </option>
              ))}
            </select>
            <div className="add-measure-form-actions">
              <button
                className="btn-cancel"
                onClick={() => setAddingObsType(null)}
              >
                Cancel
              </button>
              <button
                className="btn-save"
                onClick={handleAddObservation}
                disabled={!obsContent.trim()}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      {!isFinalized && (
        <div className="aar-action-bar">
          <button className="aar-btn aar-btn--draft" onClick={handleSaveDraft}>
            Save Draft
          </button>
          {!isInReview && (
            <button
              className="aar-btn aar-btn--review"
              onClick={handleSubmitForReview}
            >
              Submit for Review
            </button>
          )}
          {isInReview && !showFinalizeConfirm && (
            <button
              className="aar-btn aar-btn--finalize"
              onClick={() => setShowFinalizeConfirm(true)}
            >
              Finalize
            </button>
          )}
          {showFinalizeConfirm && (
            <div className="aar-finalize-confirm">
              <span>Finalize this AAR? This action cannot be undone.</span>
              <button className="btn-save" onClick={handleFinalize}>
                Confirm
              </button>
              <button
                className="btn-cancel"
                onClick={() => setShowFinalizeConfirm(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
