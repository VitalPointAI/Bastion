/**
 * ReviewPanel Component
 *
 * Panel for triggering and viewing agent reviews for a document.
 * Shows review history and allows accepting/rejecting suggestions.
 */

import { useState, useEffect, useCallback } from 'react';
import type { StrategyReviewReport } from '../../lib/types/strategic.js';
import { strategicService, API_BASE } from '../../lib/strategic-service.js';
import { ReviewReport } from './ReviewReport.js';
import './ReviewPanel.css';

interface ReviewPanelProps {
  documentId: string;
  userDID: string;
  onReviewComplete?: () => void;
}

export function ReviewPanel({
  documentId,
  userDID,
  onReviewComplete,
}: ReviewPanelProps) {
  const [reviews, setReviews] = useState<StrategyReviewReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggeringReview, setTriggeringReview] = useState(false);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE}/api/strategic/documents/${encodeURIComponent(documentId)}/reviews`,
        {
          headers: {
            'X-DID': userDID,
          },
        }
      );
      if (!response.ok) {
        throw new Error('Failed to load reviews');
      }
      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [documentId, userDID]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const triggerReview = async () => {
    setTriggeringReview(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE}/api/strategic/documents/${encodeURIComponent(documentId)}/review`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-DID': userDID,
          },
          body: JSON.stringify({}),
        }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to trigger review');
      }
      await loadReviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger review');
    } finally {
      setTriggeringReview(false);
    }
  };

  const handleAcceptAll = async (reviewId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE}/api/strategic/reviews/${encodeURIComponent(reviewId)}/accept`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-DID': userDID,
          },
        }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to accept review');
      }
      await loadReviews();
      onReviewComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept review');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptPartial = async (reviewId: string, objectiveIds: string[]) => {
    setActionLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE}/api/strategic/reviews/${encodeURIComponent(reviewId)}/accept-partial`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-DID': userDID,
          },
          body: JSON.stringify({ objectiveIds }),
        }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to accept partial review');
      }
      await loadReviews();
      onReviewComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept partial review');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (reviewId: string, reason?: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE}/api/strategic/reviews/${encodeURIComponent(reviewId)}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-DID': userDID,
          },
          body: JSON.stringify({ reason }),
        }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to reject review');
      }
      await loadReviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject review');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingReview = reviews.find(r => r.status === 'pending_review');
  const pastReviews = reviews.filter(r => r.status !== 'pending_review');

  return (
    <div className="review-panel">
      <div className="panel-header">
        <h3>Agent Reviews</h3>
        <button
          onClick={triggerReview}
          disabled={triggeringReview || !!pendingReview}
          className="trigger-review-btn"
          title={pendingReview ? 'Review pending - resolve before triggering new review' : ''}
        >
          {triggeringReview ? (
            <>
              <span className="spinner" />
              Analyzing...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="2" />
                <path d="M9 14l2 2 4-4" />
              </svg>
              Request Review
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="panel-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {loading ? (
        <div className="panel-loading">
          <span className="spinner" />
          Loading reviews...
        </div>
      ) : (
        <div className="panel-content">
          {/* Pending Review */}
          {pendingReview && (
            <div className="pending-section">
              <h4>Pending Review</h4>
              <ReviewReport
                report={pendingReview}
                onAcceptAll={() => handleAcceptAll(pendingReview.id)}
                onAcceptPartial={(ids) => handleAcceptPartial(pendingReview.id, ids)}
                onReject={(reason) => handleReject(pendingReview.id, reason)}
                loading={actionLoading}
              />
            </div>
          )}

          {/* Past Reviews */}
          {pastReviews.length > 0 && (
            <div className="past-section">
              <h4>Review History ({pastReviews.length})</h4>
              <div className="past-reviews">
                {pastReviews.slice(0, 5).map((review) => (
                  <ReviewReport
                    key={review.id}
                    report={review}
                  />
                ))}
                {pastReviews.length > 5 && (
                  <p className="more-reviews">
                    +{pastReviews.length - 5} more reviews
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {reviews.length === 0 && (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="2" />
              </svg>
              <p>No agent reviews yet</p>
              <span>Click "Request Review" to analyze objectives with AI</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
