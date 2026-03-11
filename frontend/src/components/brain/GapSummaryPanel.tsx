import React from 'react';
import type { GapInfo } from './hooks/useBrainGaps.js';
import './GapSummaryPanel.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GapSummaryPanelProps {
  /** Array of detected intelligence gaps */
  gaps: GapInfo[];
  /** true while the gap report is loading */
  loading: boolean;
  /** Optional callback — clicking "Investigate" focuses the brain on this node */
  onNodeClick?: (nodeId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * GapSummaryPanel
 *
 * Displays the intelligence gap report inside the brain's right detail panel.
 * Each gap shows a coverage progress bar and the missing connection types,
 * with an "Investigate" button to zoom the brain to that node.
 */
export function GapSummaryPanel({
  gaps,
  loading,
  onNodeClick,
}: GapSummaryPanelProps): React.ReactElement {
  // ── Derived stats ──────────────────────────────────────────────────────────

  const totalMissingConnections = gaps.reduce(
    (sum, g) => sum + (g.expectedConnections - g.actualConnections),
    0,
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading && gaps.length === 0) {
    return (
      <div className="gap-summary">
        <div className="gap-summary-header">
          <span className="gap-summary-title">Intelligence Gaps</span>
        </div>
        <div className="gap-summary-stats">Scanning for gaps…</div>
      </div>
    );
  }

  return (
    <div className="gap-summary">
      {/* Header */}
      <div className="gap-summary-header">
        <span className="gap-summary-title">Intelligence Gaps</span>
        {gaps.length > 0 && (
          <span className="gap-summary-count-badge">{gaps.length}</span>
        )}
      </div>

      {/* Summary stats */}
      {gaps.length > 0 && (
        <div className="gap-summary-stats">
          <span>{gaps.length} node{gaps.length !== 1 ? 's' : ''} with incomplete intelligence</span>
          {totalMissingConnections > 0 && (
            <span> &middot; {totalMissingConnections} expected connection{totalMissingConnections !== 1 ? 's' : ''} missing</span>
          )}
        </div>
      )}

      {/* Gap list */}
      {gaps.length > 0 ? (
        <div className="gap-list">
          {gaps.map((gap) => {
            const coverage =
              gap.expectedConnections > 0
                ? Math.min(1, gap.actualConnections / gap.expectedConnections)
                : 1;
            const coveragePct = Math.round(coverage * 100);

            return (
              <div key={gap.nodeId} className="gap-item">
                {/* Node label */}
                <div className="gap-item-header">
                  <span className="gap-item-label">{gap.nodeLabel}</span>
                  {onNodeClick && (
                    <button
                      className="gap-investigate-btn"
                      onClick={() => onNodeClick(gap.nodeId)}
                      type="button"
                    >
                      Investigate
                    </button>
                  )}
                </div>

                {/* Coverage progress bar */}
                <div
                  className="gap-progress"
                  title={`${coveragePct}% coverage (${gap.actualConnections}/${gap.expectedConnections} connections)`}
                >
                  <div
                    className="gap-progress-fill"
                    style={{ width: `${coveragePct}%` }}
                  />
                </div>

                {/* Missing connection types */}
                {gap.missingConnectionTypes.length > 0 && (
                  <div className="gap-missing-tags">
                    {gap.missingConnectionTypes.map((type) => (
                      <span key={type} className="gap-missing-tag">
                        {type}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty state */
        <div className="gap-empty-state">
          <span className="gap-empty-icon">&#10003;</span>
          <span>No intelligence gaps detected &mdash; good coverage!</span>
        </div>
      )}
    </div>
  );
}
