/**
 * MOPCard
 *
 * Phase 37 Plan 03: Card component for displaying a single Measure of Performance.
 * Same layout as MOECard but shows linked task and standard instead of objective.
 */

import type { AssessmentMOP } from '../../lib/assessment-service';

// ============================================================================
// Types
// ============================================================================

interface MOPCardProps {
  mop: AssessmentMOP;
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

export function MOPCard({ mop, observationCount = 0 }: MOPCardProps) {
  return (
    <div className="mop-card">
      {/* Header: name + status badge */}
      <div className="measure-card-header">
        <h4 className="measure-card-name">{mop.name}</h4>
        <span className={`status-badge status-${mop.status}`}>
          {STATUS_LABELS[mop.status] ?? mop.status}
        </span>
      </div>

      {/* Subheader: linked task */}
      <div className="measure-card-subheader">
        {mop.taskSnapshot
          ? <>Task: {mop.taskSnapshot}</>
          : <span className="measure-card-no-link">No linked task</span>
        }
      </div>

      {/* Standard line */}
      {mop.standard && (
        <div className="measure-card-standard">
          Standard: {mop.standard}
        </div>
      )}

      {/* Body: description */}
      {mop.description && (
        <p className="measure-card-description">{mop.description}</p>
      )}

      {/* Trend indicator */}
      <div className={`measure-card-trend trend-${mop.trend}`}>
        <span className="trend-arrow">{TREND_ARROWS[mop.trend] ?? ''}</span>
        <span className="trend-label">{TREND_LABELS[mop.trend] ?? mop.trend}</span>
      </div>

      {/* Footer: created date + observation count */}
      <div className="measure-card-footer">
        <span className="measure-card-date">Created {formatDate(mop.createdAt)}</span>
        {observationCount > 0 && (
          <span className="measure-card-obs-badge">
            {observationCount} observation{observationCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
