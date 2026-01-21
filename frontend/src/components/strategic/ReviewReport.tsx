/**
 * ReviewReport Component
 *
 * Displays a strategy review report from the agent.
 * Shows category assessments, priority suggestions, and document summary.
 * Allows accepting/rejecting individual suggestions.
 */

import { useState } from 'react';
import type {
  StrategyReviewReport,
  CategoryAssessment,
  PriorityAssessment,
  MidlifeCategory,
  Priority,
} from '../../lib/types/strategic.js';
import { MIDLIFE_METADATA } from '../../lib/types/strategic.js';
import './ReviewReport.css';

interface ReviewReportProps {
  report: StrategyReviewReport;
  onAcceptAll?: () => void;
  onAcceptPartial?: (objectiveIds: string[]) => void;
  onReject?: (reason?: string) => void;
  loading?: boolean;
}

/**
 * Get status badge color.
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'pending_review':
      return 'status-pending';
    case 'accepted':
      return 'status-accepted';
    case 'rejected':
      return 'status-rejected';
    case 'partial':
      return 'status-partial';
    default:
      return 'status-default';
  }
}

/**
 * Get status display name.
 */
function getStatusName(status: string): string {
  switch (status) {
    case 'pending_review':
      return 'Pending Review';
    case 'accepted':
      return 'Accepted';
    case 'rejected':
      return 'Rejected';
    case 'partial':
      return 'Partially Accepted';
    default:
      return status;
  }
}

/**
 * Get priority badge color.
 */
function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case 'CRITICAL':
      return 'priority-critical';
    case 'HIGH':
      return 'priority-high';
    case 'MEDIUM':
      return 'priority-medium';
    case 'LOW':
      return 'priority-low';
    default:
      return 'priority-default';
  }
}

/**
 * Get confidence color based on threshold.
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'confidence-high';
  if (confidence >= 0.6) return 'confidence-medium';
  return 'confidence-low';
}

export function ReviewReport({
  report,
  onAcceptAll,
  onAcceptPartial,
  onReject,
  loading = false,
}: ReviewReportProps) {
  const [selectedObjectives, setSelectedObjectives] = useState<Set<string>>(new Set());
  const [expandedAssessments, setExpandedAssessments] = useState<Set<string>>(new Set());
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const isPending = report.status === 'pending_review';

  const toggleObjective = (objectiveId: string) => {
    const newSelected = new Set(selectedObjectives);
    if (newSelected.has(objectiveId)) {
      newSelected.delete(objectiveId);
    } else {
      newSelected.add(objectiveId);
    }
    setSelectedObjectives(newSelected);
  };

  const toggleExpanded = (objectiveId: string) => {
    const newExpanded = new Set(expandedAssessments);
    if (newExpanded.has(objectiveId)) {
      newExpanded.delete(objectiveId);
    } else {
      newExpanded.add(objectiveId);
    }
    setExpandedAssessments(newExpanded);
  };

  const selectAll = () => {
    const allIds = report.categoryAssessments.map(a => a.objectiveId);
    setSelectedObjectives(new Set(allIds));
  };

  const selectNone = () => {
    setSelectedObjectives(new Set());
  };

  const handleAcceptSelected = () => {
    if (selectedObjectives.size > 0 && onAcceptPartial) {
      onAcceptPartial(Array.from(selectedObjectives));
    }
  };

  const handleReject = () => {
    if (onReject) {
      onReject(rejectReason || undefined);
      setShowRejectDialog(false);
      setRejectReason('');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="review-report">
      {/* Header */}
      <div className="report-header">
        <div className="report-title">
          <h3>Agent Review Report</h3>
          <span className={`status-badge ${getStatusColor(report.status)}`}>
            {getStatusName(report.status)}
          </span>
        </div>
        <div className="report-meta">
          <span className="meta-item">
            Reviewed: {formatDate(report.reviewedAt)}
          </span>
          <span className="meta-item">
            ID: {report.id.substring(0, 8)}...
          </span>
        </div>
      </div>

      {/* Document Summary */}
      <div className="report-summary">
        <h4>Document Summary</h4>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">Objectives</span>
            <span className="summary-value">{report.documentSummary.totalObjectives}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Coherence Score</span>
            <span className={`summary-value coherence-${report.documentSummary.coherenceScore >= 70 ? 'good' : report.documentSummary.coherenceScore >= 50 ? 'medium' : 'low'}`}>
              {report.documentSummary.coherenceScore}%
            </span>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="category-distribution">
          <span className="distribution-label">Category Distribution:</span>
          <div className="distribution-bars">
            {Object.entries(report.documentSummary.categoryDistribution)
              .filter(([_, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([category, count]) => (
                <div key={category} className="distribution-item">
                  <span
                    className="distribution-bar"
                    style={{
                      backgroundColor: MIDLIFE_METADATA[category as MidlifeCategory]?.color || '#666',
                      width: `${(count / report.documentSummary.totalObjectives) * 100}%`,
                    }}
                  />
                  <span className="distribution-text">
                    {MIDLIFE_METADATA[category as MidlifeCategory]?.label || category}: {count}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Flags */}
        {report.documentSummary.flags.length > 0 && (
          <div className="summary-flags">
            <span className="flags-label">Flags:</span>
            <ul className="flags-list">
              {report.documentSummary.flags.map((flag, i) => (
                <li key={i} className="flag-item">{flag}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Category Assessments */}
      <div className="report-assessments">
        <div className="assessments-header">
          <h4>Category Suggestions ({report.categoryAssessments.length})</h4>
          {isPending && report.categoryAssessments.length > 0 && (
            <div className="selection-controls">
              <button onClick={selectAll} className="select-btn">Select All</button>
              <button onClick={selectNone} className="select-btn">Select None</button>
              <span className="selected-count">{selectedObjectives.size} selected</span>
            </div>
          )}
        </div>

        <div className="assessments-list">
          {report.categoryAssessments.map((assessment) => (
            <div
              key={assessment.objectiveId}
              className={`assessment-item ${assessment.requiresHumanReview ? 'needs-review' : ''} ${selectedObjectives.has(assessment.objectiveId) ? 'selected' : ''}`}
            >
              <div className="assessment-main" onClick={() => toggleExpanded(assessment.objectiveId)}>
                {isPending && (
                  <input
                    type="checkbox"
                    checked={selectedObjectives.has(assessment.objectiveId)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleObjective(assessment.objectiveId);
                    }}
                    className="assessment-checkbox"
                  />
                )}
                <div className="assessment-content">
                  <div className="assessment-id">
                    {assessment.objectiveId.substring(0, 8)}...
                    {assessment.requiresHumanReview && (
                      <span className="review-flag" title="Low confidence - human review recommended">
                        !
                      </span>
                    )}
                  </div>
                  <div className="assessment-suggestion">
                    {assessment.currentCategory && assessment.currentCategory !== assessment.suggestedCategory ? (
                      <>
                        <span
                          className="category-badge current"
                          style={{ backgroundColor: MIDLIFE_METADATA[assessment.currentCategory]?.color }}
                        >
                          {MIDLIFE_METADATA[assessment.currentCategory]?.label}
                        </span>
                        <span className="arrow">-&gt;</span>
                      </>
                    ) : null}
                    <span
                      className="category-badge suggested"
                      style={{ backgroundColor: MIDLIFE_METADATA[assessment.suggestedCategory]?.color }}
                    >
                      {MIDLIFE_METADATA[assessment.suggestedCategory]?.label}
                    </span>
                    <span className={`confidence ${getConfidenceColor(assessment.confidence)}`}>
                      {Math.round(assessment.confidence * 100)}%
                    </span>
                  </div>
                </div>
                <span className={`expand-icon ${expandedAssessments.has(assessment.objectiveId) ? 'expanded' : ''}`}>
                  v
                </span>
              </div>
              {expandedAssessments.has(assessment.objectiveId) && (
                <div className="assessment-detail">
                  <p className="rationale">{assessment.rationale}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Priority Assessments */}
      {report.priorityAssessments.length > 0 && (
        <div className="report-priorities">
          <h4>Priority Suggestions ({report.priorityAssessments.length})</h4>
          <div className="priorities-list">
            {report.priorityAssessments
              .filter(a => a.currentPriority !== a.suggestedPriority)
              .slice(0, 5)
              .map((assessment) => (
                <div key={assessment.objectiveId} className="priority-item">
                  <span className="priority-id">{assessment.objectiveId.substring(0, 8)}...</span>
                  <span className={`priority-badge ${getPriorityColor(assessment.currentPriority)}`}>
                    {assessment.currentPriority}
                  </span>
                  <span className="arrow">-&gt;</span>
                  <span className={`priority-badge ${getPriorityColor(assessment.suggestedPriority)}`}>
                    {assessment.suggestedPriority}
                  </span>
                  <span className="priority-score">Score: {assessment.score}</span>
                </div>
              ))}
            {report.priorityAssessments.filter(a => a.currentPriority !== a.suggestedPriority).length > 5 && (
              <div className="more-priorities">
                +{report.priorityAssessments.filter(a => a.currentPriority !== a.suggestedPriority).length - 5} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="report-actions">
          <button
            onClick={onAcceptAll}
            disabled={loading}
            className="action-btn accept-all"
          >
            {loading ? 'Processing...' : 'Accept All'}
          </button>
          <button
            onClick={handleAcceptSelected}
            disabled={loading || selectedObjectives.size === 0}
            className="action-btn accept-selected"
          >
            Accept Selected ({selectedObjectives.size})
          </button>
          <button
            onClick={() => setShowRejectDialog(true)}
            disabled={loading}
            className="action-btn reject"
          >
            Reject
          </button>
        </div>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="reject-dialog-overlay" onClick={() => setShowRejectDialog(false)}>
          <div className="reject-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>Reject Review</h4>
            <p>Optionally provide a reason for rejection:</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
            />
            <div className="dialog-actions">
              <button onClick={() => setShowRejectDialog(false)} className="dialog-btn cancel">
                Cancel
              </button>
              <button onClick={handleReject} className="dialog-btn confirm">
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
