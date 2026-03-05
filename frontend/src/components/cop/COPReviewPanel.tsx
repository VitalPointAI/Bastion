/**
 * COPReviewPanel Component
 *
 * Staff review panel for COP layers. Supports spatial annotations (placed on
 * map at specific positions/entities) and general free-text comments.
 * Displays existing feedback and provides layer transition actions.
 */

import { useState } from 'react';
import type {
  COPLayer,
  ReviewFeedback,
  LatLng,
  LayerState,
} from '../../types/cop.js';
import { copService } from '../../lib/cop-service.js';
import './COPReviewPanel.css';

interface COPReviewPanelProps {
  layer: COPLayer;
  onFeedbackSubmitted: (layer: COPLayer) => void;
  onTransition: (layer: COPLayer) => void;
}

type FeedbackMode = 'spatial_annotation' | 'general_comment';

export function COPReviewPanel({
  layer,
  onFeedbackSubmitted,
  onTransition,
}: COPReviewPanelProps) {
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('general_comment');
  const [commentText, setCommentText] = useState('');
  const [spatialPosition, setSpatialPosition] = useState<LatLng | null>(null);
  const [spatialEntityId, setSpatialEntityId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingFeedback = layer.reviewFeedback ?? [];

  async function handleSubmitFeedback() {
    if (!commentText.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const feedback: Omit<ReviewFeedback, 'id' | 'createdAt'> = {
        layerId: layer.id,
        type: feedbackMode,
        content: commentText.trim(),
        createdBy: 'current-user', // Will be overridden by auth middleware
        ...(feedbackMode === 'spatial_annotation' && spatialPosition
          ? { position: spatialPosition }
          : {}),
        ...(feedbackMode === 'spatial_annotation' && spatialEntityId
          ? { entityId: spatialEntityId }
          : {}),
      };

      const updatedLayer = await copService.addFeedback(layer.id, feedback);
      if (updatedLayer) {
        onFeedbackSubmitted(updatedLayer);
        setCommentText('');
        setSpatialPosition(null);
        setSpatialEntityId('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTransition(targetState: LayerState) {
    setTransitioning(true);
    setError(null);
    try {
      const updatedLayer = await copService.transitionLayer(
        layer.id,
        targetState
      );
      if (updatedLayer) {
        onTransition(updatedLayer);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transition failed');
    } finally {
      setTransitioning(false);
    }
  }

  return (
    <div className="cop-review-panel">
      <div className="review-panel-header">
        <h3 className="review-panel-title">Layer Review</h3>
        <span className="review-layer-id">{layer.id.slice(0, 12)}...</span>
      </div>

      {/* Error display */}
      {error && (
        <div className="review-error">
          {error}
          <button
            className="review-error-dismiss"
            onClick={() => setError(null)}
            type="button"
          >
            X
          </button>
        </div>
      )}

      {/* Feedback Mode Tabs */}
      <div className="review-mode-tabs">
        <button
          className={`review-mode-tab ${feedbackMode === 'general_comment' ? 'active' : ''}`}
          onClick={() => setFeedbackMode('general_comment')}
          type="button"
        >
          General Comment
        </button>
        <button
          className={`review-mode-tab ${feedbackMode === 'spatial_annotation' ? 'active' : ''}`}
          onClick={() => setFeedbackMode('spatial_annotation')}
          type="button"
        >
          Spatial Annotation
        </button>
      </div>

      {/* Feedback Form */}
      <div className="review-feedback-form">
        {feedbackMode === 'spatial_annotation' && (
          <div className="review-spatial-fields">
            <div className="review-field">
              <label className="review-field-label">Position (click map to set)</label>
              <div className="review-position-display">
                {spatialPosition ? (
                  <span>
                    {spatialPosition.lat.toFixed(6)}, {spatialPosition.lng.toFixed(6)}
                  </span>
                ) : (
                  <span className="review-position-placeholder">
                    Click on map to place annotation
                  </span>
                )}
              </div>
            </div>
            <div className="review-field">
              <label className="review-field-label">Entity ID (optional)</label>
              <input
                className="review-input"
                type="text"
                placeholder="Entity ID if annotation targets a symbol"
                value={spatialEntityId}
                onChange={(e) => setSpatialEntityId(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="review-field">
          <label className="review-field-label">
            {feedbackMode === 'spatial_annotation' ? 'Annotation' : 'Comment'}
          </label>
          <textarea
            className="review-textarea"
            placeholder={
              feedbackMode === 'spatial_annotation'
                ? 'Describe the spatial annotation...'
                : 'Enter review comment about this layer...'
            }
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
          />
        </div>

        <button
          className="review-submit-btn"
          onClick={handleSubmitFeedback}
          disabled={submitting || !commentText.trim()}
          type="button"
        >
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </div>

      {/* Existing Feedback */}
      <div className="review-existing-feedback">
        <h4 className="review-section-title">
          Feedback ({existingFeedback.length})
        </h4>
        {existingFeedback.length === 0 ? (
          <p className="review-empty">No feedback yet</p>
        ) : (
          <ul className="review-feedback-list">
            {existingFeedback.map((fb) => (
              <li key={fb.id} className="review-feedback-item">
                <div className="feedback-item-header">
                  <span className="feedback-type-badge"
                    data-type={fb.type}
                  >
                    {fb.type === 'spatial_annotation' ? 'Spatial' : 'Comment'}
                  </span>
                  <span className="feedback-author">{fb.createdBy}</span>
                  <span className="feedback-time">
                    {new Date(fb.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="feedback-content">{fb.content}</p>
                {fb.position && (
                  <span className="feedback-position-indicator">
                    @ {fb.position.lat.toFixed(4)}, {fb.position.lng.toFixed(4)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Action Buttons */}
      {layer.state === 'review' && (
        <div className="review-actions">
          <button
            className="review-action-btn review-action-revision"
            onClick={() => handleTransition('draft')}
            disabled={transitioning}
            type="button"
          >
            Request Revision
          </button>
          <button
            className="review-action-btn review-action-approve"
            onClick={() => handleTransition('published')}
            disabled={transitioning}
            type="button"
          >
            Approve for Publish
          </button>
        </div>
      )}

      {/* Expose spatial position setter for parent map integration */}
      <input
        type="hidden"
        data-spatial-lat={spatialPosition?.lat ?? ''}
        data-spatial-lng={spatialPosition?.lng ?? ''}
        data-set-position="true"
      />
    </div>
  );
}

/**
 * Helper for parent components to set the spatial position
 * when the user clicks on the map. Call this from the map click handler.
 */
COPReviewPanel.setSpatialPosition = undefined as
  | ((pos: LatLng) => void)
  | undefined;
