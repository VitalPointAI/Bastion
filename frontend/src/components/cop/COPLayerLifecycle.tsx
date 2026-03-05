/**
 * COPLayerLifecycle Component
 *
 * Displays the current layer lifecycle state as a horizontal progress indicator
 * (Draft -> Review -> Published -> COP) and provides transition controls
 * appropriate for the current state. Includes recall modal for COP state.
 */

import { useState } from 'react';
import type { COPLayer, LayerState } from '../../types/cop.js';
import { copService } from '../../lib/cop-service.js';
import './COPLayerLifecycle.css';

interface COPLayerLifecycleProps {
  layer: COPLayer;
  onTransition: (layer: COPLayer) => void;
  /** Whether current user has permission to promote to COP */
  canPromote: boolean;
}

/** Lifecycle states in order */
const STATES: LayerState[] = ['draft', 'review', 'published', 'cop'];

/** State display configuration */
const STATE_CONFIG: Record<
  LayerState,
  { label: string; color: string; bgColor: string }
> = {
  draft: { label: 'Draft', color: '#9ca3af', bgColor: 'rgba(156, 163, 175, 0.2)' },
  review: { label: 'Review', color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.2)' },
  published: { label: 'Published', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.2)' },
  cop: { label: 'COP', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.2)' },
};

export function COPLayerLifecycle({
  layer,
  onTransition,
  canPromote,
}: COPLayerLifecycleProps) {
  const [transitioning, setTransitioning] = useState(false);
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [recallReason, setRecallReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const currentStateIdx = STATES.indexOf(layer.state);

  async function handleTransition(targetState: LayerState, reason?: string) {
    setTransitioning(true);
    setError(null);
    try {
      const updated = await copService.transitionLayer(
        layer.id,
        targetState,
        reason
      );
      if (updated) onTransition(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transition failed');
    } finally {
      setTransitioning(false);
    }
  }

  async function handleRecall() {
    if (!recallReason.trim()) return;
    setTransitioning(true);
    setError(null);
    try {
      const updated = await copService.recallLayer(layer.id, recallReason.trim());
      if (updated) {
        onTransition(updated);
        setShowRecallModal(false);
        setRecallReason('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recall failed');
    } finally {
      setTransitioning(false);
    }
  }

  return (
    <div className="cop-layer-lifecycle">
      {/* Progress Indicator */}
      <div className="lifecycle-progress">
        {STATES.map((state, idx) => {
          const config = STATE_CONFIG[state];
          const isActive = state === layer.state;
          const isPast = idx < currentStateIdx;
          const isFuture = idx > currentStateIdx;

          return (
            <div key={state} className="lifecycle-step-wrapper">
              {idx > 0 && (
                <div
                  className={`lifecycle-connector ${isPast ? 'past' : ''}`}
                />
              )}
              <div
                className={`lifecycle-step ${isActive ? 'active' : ''} ${isPast ? 'past' : ''} ${isFuture ? 'future' : ''}`}
                style={{
                  borderColor: isActive ? config.color : undefined,
                  backgroundColor: isActive ? config.bgColor : undefined,
                }}
              >
                <span
                  className="lifecycle-step-dot"
                  style={{
                    backgroundColor: isPast || isActive ? config.color : undefined,
                  }}
                />
                <span className="lifecycle-step-label">{config.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current State Badge */}
      <div className="lifecycle-state-info">
        <span
          className="lifecycle-state-badge"
          style={{
            color: STATE_CONFIG[layer.state].color,
            backgroundColor: STATE_CONFIG[layer.state].bgColor,
          }}
        >
          {STATE_CONFIG[layer.state].label}
        </span>

        {/* Promotion info */}
        {layer.state === 'cop' && layer.promotedBy && (
          <span className="lifecycle-promoted-info">
            Promoted by {layer.promotedBy}
            {layer.promotedAt && (
              <> at {new Date(layer.promotedAt).toLocaleString()}</>
            )}
          </span>
        )}

        {/* Recall reason display */}
        {layer.recallReason && (
          <div className="lifecycle-recall-info">
            <span className="lifecycle-recall-label">Previously recalled:</span>
            <span className="lifecycle-recall-reason">{layer.recallReason}</span>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="lifecycle-error">
          {error}
          <button
            className="lifecycle-error-dismiss"
            onClick={() => setError(null)}
            type="button"
          >
            X
          </button>
        </div>
      )}

      {/* Transition Buttons */}
      <div className="lifecycle-actions">
        {layer.state === 'draft' && (
          <button
            className="lifecycle-btn lifecycle-btn-review"
            onClick={() => handleTransition('review')}
            disabled={transitioning}
            type="button"
          >
            Submit for Review
          </button>
        )}

        {layer.state === 'review' && (
          <>
            <button
              className="lifecycle-btn lifecycle-btn-approve"
              onClick={() => handleTransition('published')}
              disabled={transitioning}
              type="button"
            >
              Approve
            </button>
            <button
              className="lifecycle-btn lifecycle-btn-revision"
              onClick={() => handleTransition('draft')}
              disabled={transitioning}
              type="button"
            >
              Request Revision
            </button>
          </>
        )}

        {layer.state === 'published' && canPromote && (
          <button
            className="lifecycle-btn lifecycle-btn-promote"
            onClick={() => handleTransition('cop')}
            disabled={transitioning}
            type="button"
          >
            Promote to COP
          </button>
        )}

        {layer.state === 'cop' && (
          <button
            className="lifecycle-btn lifecycle-btn-recall"
            onClick={() => setShowRecallModal(true)}
            disabled={transitioning}
            type="button"
          >
            Recall
          </button>
        )}
      </div>

      {/* Recall Modal */}
      {showRecallModal && (
        <div
          className="lifecycle-recall-overlay"
          onClick={() => setShowRecallModal(false)}
        >
          <div
            className="lifecycle-recall-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="recall-modal-title">Recall Layer from COP</h4>
            <p className="recall-modal-desc">
              Provide a reason for recalling this layer. This action will remove
              it from the active COP and return it to review state.
            </p>
            <textarea
              className="recall-modal-textarea"
              placeholder="Reason for recall (required)..."
              value={recallReason}
              onChange={(e) => setRecallReason(e.target.value)}
              rows={4}
            />
            <div className="recall-modal-actions">
              <button
                className="recall-modal-cancel"
                onClick={() => {
                  setShowRecallModal(false);
                  setRecallReason('');
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="recall-modal-confirm"
                onClick={handleRecall}
                disabled={transitioning || !recallReason.trim()}
                type="button"
              >
                {transitioning ? 'Recalling...' : 'Confirm Recall'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
