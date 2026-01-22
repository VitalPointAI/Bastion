/**
 * ReviewPanel Component
 *
 * Panel for triggering and viewing agent reviews for a document.
 * Shows review history and allows accepting/rejecting suggestions.
 * Supports SSE streaming for real-time progress updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { StrategyReviewReport } from '../../lib/types/strategic.js';
import { API_BASE } from '../../lib/strategic-service.js';
import { ReviewReport } from './ReviewReport.js';
import './ReviewPanel.css';

/**
 * Progress event from streaming review.
 */
interface ReviewProgress {
  type: 'category_assessment' | 'prioritization_complete';
  index?: number;
  total?: number;
  objectiveId?: string;
  suggestedCategory?: string;
  confidence?: number;
  requiresReview?: boolean;
  assessmentCount?: number;
  timestamp: string;
}

/**
 * Complete event from streaming review.
 */
interface ReviewComplete {
  reviewId: string;
  checkpointId: string;
  documentId: string;
  status: string;
  summary: {
    totalObjectives: number;
    coherenceScore: number;
    flags: string[];
  };
  categoryAssessmentCount: number;
  priorityAssessmentCount: number;
  coherenceScore: number;
  flags: string[];
  timestamp: string;
}

interface ReviewPanelProps {
  documentId: string;
  userDID: string;
  onReviewComplete?: () => void;
  useStreaming?: boolean;
}

export function ReviewPanel({
  documentId,
  userDID,
  onReviewComplete,
  useStreaming = true,
}: ReviewPanelProps) {
  const [reviews, setReviews] = useState<StrategyReviewReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggeringReview, setTriggeringReview] = useState(false);

  // Streaming state
  const [streamingProgress, setStreamingProgress] = useState<ReviewProgress[]>([]);
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

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

  // Cleanup event source on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  /**
   * Trigger streaming review using SSE.
   */
  const triggerStreamingReview = async () => {
    setTriggeringReview(true);
    setError(null);
    setStreamingProgress([]);
    setStreamingStatus('Connecting...');

    try {
      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Create SSE connection with custom headers via query params
      // EventSource doesn't support custom headers, so we use query params
      const url = new URL(
        `${API_BASE}/api/strategic/documents/${encodeURIComponent(documentId)}/review/stream`
      );
      url.searchParams.set('did', userDID);

      const eventSource = new EventSource(url.toString());
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('start', (event) => {
        const data = JSON.parse(event.data);
        setStreamingStatus(data.message || 'Starting analysis...');
      });

      eventSource.addEventListener('progress', (event) => {
        const data: ReviewProgress = JSON.parse(event.data);
        setStreamingProgress((prev) => [...prev, data]);

        if (data.type === 'category_assessment' && data.index && data.total) {
          setStreamingStatus(
            `Analyzing objective ${data.index}/${data.total}...`
          );
        } else if (data.type === 'prioritization_complete') {
          setStreamingStatus('Prioritization complete, building report...');
        }
      });

      eventSource.addEventListener('complete', (event) => {
        JSON.parse(event.data) as ReviewComplete; // Validate JSON structure
        setStreamingStatus(null);
        setStreamingProgress([]);
        setTriggeringReview(false);
        eventSource.close();

        // Reload reviews to get the new one
        loadReviews();
        onReviewComplete?.();
      });

      eventSource.addEventListener('error', (event) => {
        if (event instanceof MessageEvent) {
          const data = JSON.parse(event.data);
          setError(data.message || 'Review failed');
        } else {
          setError('Connection error during review');
        }
        setStreamingStatus(null);
        setTriggeringReview(false);
        eventSource.close();
      });

      eventSource.onerror = () => {
        // Connection error - EventSource will auto-reconnect
        // Only set error if we were actively streaming
        if (triggeringReview) {
          setError('Connection lost during review');
          setStreamingStatus(null);
          setTriggeringReview(false);
        }
        eventSource.close();
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start streaming review');
      setStreamingStatus(null);
      setTriggeringReview(false);
    }
  };

  /**
   * Trigger non-streaming review (original implementation).
   */
  const triggerReviewSync = async () => {
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

  const triggerReview = useStreaming ? triggerStreamingReview : triggerReviewSync;

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
              {streamingStatus || 'Analyzing...'}
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

      {/* Streaming Progress */}
      {triggeringReview && streamingProgress.length > 0 && (
        <div className="streaming-progress">
          <div className="progress-header">
            <span className="progress-title">Analysis Progress</span>
            <span className="progress-count">
              {streamingProgress.filter(p => p.type === 'category_assessment').length} objectives analyzed
            </span>
          </div>
          <div className="progress-items">
            {streamingProgress.slice(-5).map((progress, index) => (
              <div key={index} className="progress-item">
                {progress.type === 'category_assessment' && (
                  <>
                    <span className="progress-objective">{progress.objectiveId?.slice(0, 8)}...</span>
                    <span className={`progress-category ${progress.suggestedCategory?.toLowerCase()}`}>
                      {progress.suggestedCategory}
                    </span>
                    <span className={`progress-confidence ${progress.confidence && progress.confidence >= 0.7 ? 'high' : 'low'}`}>
                      {progress.confidence ? `${Math.round(progress.confidence * 100)}%` : '-'}
                    </span>
                    {progress.requiresReview && <span className="requires-review">Needs Review</span>}
                  </>
                )}
                {progress.type === 'prioritization_complete' && (
                  <span className="progress-complete">
                    Prioritization complete ({progress.assessmentCount} assessments)
                  </span>
                )}
              </div>
            ))}
          </div>
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
          {reviews.length === 0 && !triggeringReview && (
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
