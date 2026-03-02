/**
 * ProductReviewPanel
 *
 * Phase 16 Plan 05: Human review panel for AI-generated product drafts.
 *
 * Shows 5 reviewer actions: Approve, Edit+Approve, Request Revision,
 * Edit+Request Revision, Reject. Supports inline text annotation (highlights
 * with comments). Fetches version history on mount and passes to ProductVersionHistory.
 *
 * Calls exerciseService.submitReview() on submit with full ReviewFeedback.
 */

import { useEffect, useRef, useState } from 'react';
import './ProductReviewPanel.css';
import { ProductVersionHistory } from './ProductVersionHistory';
import { exerciseService } from '../../services/exercise-service';
import type { ReviewFeedback, StaffProductVersion } from '../../types/exercise';

interface Annotation {
  paragraphIndex: number;
  startChar: number;
  endChar: number;
  highlightedText: string;
  comment: string;
}

type ReviewMode =
  | 'idle'
  | 'edit_approve'
  | 'request_revision'
  | 'edit_request_revision'
  | 'reject';

interface ProductReviewPanelProps {
  scenarioId: string;
  roleKey: string;
  runId: string;
  productId: string;
  productContent: string;
  productType: string;
  draftVersion: number;
  onReviewComplete: () => void;
  onClose: () => void;
}

export function ProductReviewPanel({
  scenarioId,
  roleKey,
  runId,
  productId,
  productContent,
  productType,
  draftVersion,
  onReviewComplete,
  onClose,
}: ProductReviewPanelProps) {
  const [mode, setMode] = useState<ReviewMode>('idle');
  const [editedContent, setEditedContent] = useState(productContent);
  const [notes, setNotes] = useState('');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [pendingAnnotation, setPendingAnnotation] = useState<Omit<Annotation, 'comment'> | null>(null);
  const [pendingComment, setPendingComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [versions, setVersions] = useState<StaffProductVersion[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);

  // Fetch version history on mount
  useEffect(() => {
    exerciseService
      .getProductVersionHistory(scenarioId, productId)
      .then(setVersions)
      .catch(console.error);
  }, [scenarioId, productId]);

  // Handle text selection for annotation
  const handleContentMouseUp = () => {
    if (!isAnnotating) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const container = contentRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return;

    const text = selection.toString().trim();
    if (!text) return;

    // Compute character offsets relative to the container text
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(container);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const startChar = preSelectionRange.toString().length;
    const endChar = startChar + text.length;

    setPendingAnnotation({
      paragraphIndex: 0, // single-content model
      startChar,
      endChar,
      highlightedText: text,
    });
    setPendingComment('');

    // Clear browser selection
    selection.removeAllRanges();
  };

  const confirmAnnotation = () => {
    if (!pendingAnnotation) return;
    setAnnotations(prev => [...prev, { ...pendingAnnotation, comment: pendingComment }]);
    setPendingAnnotation(null);
    setPendingComment('');
  };

  const removeAnnotation = (idx: number) => {
    setAnnotations(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAction = async (action: ReviewFeedback['action']) => {
    setIsSubmitting(true);
    setSubmitError(null);

    const feedback: ReviewFeedback = {
      action,
      notes: notes.trim() || undefined,
      annotations: annotations.length > 0 ? annotations : undefined,
      edits:
        action === 'edit_approve' || action === 'edit_request_revision'
          ? { content: editedContent }
          : undefined,
    };

    try {
      await exerciseService.submitReview(scenarioId, roleKey, runId, feedback);
      onReviewComplete();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit review');
      setIsSubmitting(false);
    }
  };

  const needsEditArea = mode === 'edit_approve' || mode === 'edit_request_revision';
  const needsNotesArea =
    mode === 'request_revision' || mode === 'edit_request_revision' || mode === 'reject';

  return (
    <div className="product-review-panel" role="dialog" aria-modal="true" aria-label="Product Review">
      {/* Header */}
      <div className="prp-header">
        <div className="prp-header-left">
          <span className="prp-title">Review: {productType}</span>
          <span className="prp-version-badge">v{draftVersion}</span>
        </div>
        <button className="prp-close-btn" onClick={onClose} aria-label="Close review panel">
          ×
        </button>
      </div>

      {/* Content section */}
      <div className="prp-content-section">
        <div className="prp-content-toolbar">
          <span className="prp-content-label">Draft Content</span>
          <button
            className={`prp-annotate-toggle${isAnnotating ? ' active' : ''}`}
            onClick={() => {
              setIsAnnotating(v => !v);
              setPendingAnnotation(null);
            }}
            aria-pressed={isAnnotating}
          >
            {isAnnotating ? 'Stop Annotating' : 'Annotate'}
          </button>
        </div>

        {isAnnotating && (
          <div className="prp-annotation-hint">
            Select text in the content below to add a comment.
          </div>
        )}

        {/* Read-only content with annotation support */}
        <div
          ref={contentRef}
          className={`prp-content-area${isAnnotating ? ' prp-annotating' : ''}`}
          onMouseUp={handleContentMouseUp}
        >
          {productContent}
        </div>

        {/* Pending annotation input */}
        {pendingAnnotation && (
          <div className="prp-pending-annotation">
            <div className="prp-annotation-quote">
              &ldquo;{pendingAnnotation.highlightedText}&rdquo;
            </div>
            <textarea
              className="prp-annotation-comment-input"
              placeholder="Add a comment for this selection..."
              value={pendingComment}
              onChange={e => setPendingComment(e.target.value)}
              rows={2}
              autoFocus
            />
            <div className="prp-annotation-actions">
              <button className="prp-btn-sm prp-btn-confirm" onClick={confirmAnnotation}>
                Add Comment
              </button>
              <button className="prp-btn-sm prp-btn-cancel" onClick={() => setPendingAnnotation(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Annotation list */}
        {annotations.length > 0 && (
          <div className="prp-annotation-list">
            <div className="prp-annotation-list-title">Annotations ({annotations.length})</div>
            {annotations.map((ann, idx) => (
              <div key={idx} className="prp-annotation-item">
                <div className="prp-annotation-quote prp-annotation-item-quote">
                  &ldquo;{ann.highlightedText}&rdquo;
                </div>
                <div className="prp-annotation-comment">{ann.comment}</div>
                <button
                  className="prp-annotation-remove"
                  onClick={() => removeAnnotation(idx)}
                  aria-label="Remove annotation"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editable textarea for edit modes */}
      {needsEditArea && (
        <div className="prp-edit-section">
          <label className="prp-edit-label">Edit Content</label>
          <textarea
            className="prp-edit-textarea"
            value={editedContent}
            onChange={e => setEditedContent(e.target.value)}
            rows={10}
            aria-label="Edit product content"
          />
        </div>
      )}

      {/* Notes textarea for revision/reject modes */}
      {needsNotesArea && (
        <div className="prp-notes-section">
          <label className="prp-notes-label">
            {mode === 'reject' ? 'Rejection Reason' : 'Revision Instructions'}
          </label>
          <textarea
            className="prp-notes-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={
              mode === 'reject'
                ? 'Reason for rejection...'
                : 'Revision instructions for agents...'
            }
            rows={4}
            aria-label={mode === 'reject' ? 'Rejection reason' : 'Revision instructions'}
          />
        </div>
      )}

      {/* Review action buttons */}
      <div className="prp-actions">
        <button
          className="prp-btn prp-approve"
          onClick={() => handleAction('approve')}
          disabled={isSubmitting}
          aria-label="Approve and publish"
        >
          Approve
        </button>
        <button
          className={`prp-btn prp-edit-approve${mode === 'edit_approve' ? ' prp-mode-active' : ''}`}
          onClick={() => {
            if (mode === 'edit_approve') {
              handleAction('edit_approve');
            } else {
              setMode('edit_approve');
              setEditedContent(productContent);
            }
          }}
          disabled={isSubmitting}
          aria-label="Edit then approve"
        >
          {mode === 'edit_approve' ? 'Submit Edit + Approve' : 'Edit + Approve'}
        </button>
        <button
          className={`prp-btn prp-request-revision${mode === 'request_revision' ? ' prp-mode-active' : ''}`}
          onClick={() => {
            if (mode === 'request_revision') {
              handleAction('request_revision');
            } else {
              setMode('request_revision');
            }
          }}
          disabled={isSubmitting}
          aria-label="Request revision"
        >
          {mode === 'request_revision' ? 'Submit Revision Request' : 'Request Revision'}
        </button>
        <button
          className={`prp-btn prp-edit-revision${mode === 'edit_request_revision' ? ' prp-mode-active' : ''}`}
          onClick={() => {
            if (mode === 'edit_request_revision') {
              handleAction('edit_request_revision');
            } else {
              setMode('edit_request_revision');
              setEditedContent(productContent);
            }
          }}
          disabled={isSubmitting}
          aria-label="Edit then request revision"
        >
          {mode === 'edit_request_revision' ? 'Submit Edit + Revision' : 'Edit + Request Revision'}
        </button>
        <button
          className={`prp-btn prp-reject${mode === 'reject' ? ' prp-mode-active' : ''}`}
          onClick={() => {
            if (mode === 'reject') {
              handleAction('reject');
            } else {
              setMode('reject');
            }
          }}
          disabled={isSubmitting}
          aria-label="Reject draft"
        >
          {mode === 'reject' ? 'Confirm Rejection' : 'Reject'}
        </button>
      </div>

      {/* Reset mode button when a mode is active */}
      {mode !== 'idle' && !isSubmitting && (
        <div className="prp-mode-reset">
          <button
            className="prp-btn-sm prp-btn-cancel"
            onClick={() => setMode('idle')}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Submit error */}
      {submitError && (
        <div className="prp-submit-error" role="alert">
          {submitError}
        </div>
      )}

      {/* Loading state */}
      {isSubmitting && (
        <div className="prp-submitting" role="status" aria-live="polite">
          Submitting review...
        </div>
      )}

      {/* Version history collapsible */}
      <div className="prp-version-history-section">
        <button
          className="prp-version-history-toggle"
          onClick={() => setShowVersionHistory(v => !v)}
          aria-expanded={showVersionHistory}
        >
          Version History ({versions.length})
          <span className="pvh-toggle-icon">{showVersionHistory ? '▲' : '▼'}</span>
        </button>
        {showVersionHistory && (
          <div className="prp-version-history-body">
            <ProductVersionHistory
              versions={versions}
              currentVersion={draftVersion}
            />
          </div>
        )}
      </div>
    </div>
  );
}
