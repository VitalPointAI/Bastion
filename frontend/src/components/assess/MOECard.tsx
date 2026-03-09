/**
 * MOECard
 *
 * Phase 37 Plan 03: Card component for displaying a single Measure of Effectiveness.
 * Shows status badge (green/yellow/red), trend indicator, linked objective,
 * description, and observation count.
 */

import type { AssessmentMOE } from '../../lib/assessment-service';

// ============================================================================
// Types
// ============================================================================

interface MOECardProps {
  moe: AssessmentMOE;
  observationCount?: number;
  onStatusUpdate?: (status: string, trend: string) => void;
  onAddObservation?: (content: string) => void;
}

// ============================================================================
// Helpers
// ============================================================================

const STATUS_LABELS: Record<string, string> = {
  green: 'Green',
  yellow: 'Yellow',
  red: 'Red',
};

const TREND_LABELS: Record<string, string> = {
  improving: 'Improving',
  stable: 'Stable',
  declining: 'Declining',
};

const TREND_ARROWS: Record<string, string> = {
  improving: '\u2191',   // up arrow
  stable: '\u2192',      // right arrow
  declining: '\u2193',   // down arrow
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

// ============================================================================
// Component
// ============================================================================

export function MOECard({ moe, observationCount = 0 }: MOECardProps) {
  return (
    <div className="moe-card">
      {/* Header: name + status badge */}
      <div className="measure-card-header">
        <h4 className="measure-card-name">{moe.name}</h4>
        <span className={`status-badge status-${moe.status}`}>
          {STATUS_LABELS[moe.status] ?? moe.status}
        </span>
      </div>

      {/* Subheader: linked objective */}
      <div className="measure-card-subheader">
        {moe.objectiveSnapshot
          ? <>Linked to: {moe.objectiveSnapshot}</>
          : <span className="measure-card-no-link">No linked objective</span>
        }
      </div>

      {/* Body: description */}
      {moe.description && (
        <p className="measure-card-description">{moe.description}</p>
      )}

      {/* Trend indicator */}
      <div className={`measure-card-trend trend-${moe.trend}`}>
        <span className="trend-arrow">{TREND_ARROWS[moe.trend] ?? ''}</span>
        <span className="trend-label">{TREND_LABELS[moe.trend] ?? moe.trend}</span>
      </div>

      {/* Footer: created date + observation count */}
      <div className="measure-card-footer">
        <span className="measure-card-date">Created {formatDate(moe.createdAt)}</span>
        {observationCount > 0 && (
          <span className="measure-card-obs-badge">
            {observationCount} observation{observationCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
