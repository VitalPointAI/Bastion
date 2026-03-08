/**
 * AcknowledgmentBanner
 *
 * Phase 26 Plan 02: Dismissible banner prompting commander acknowledgment
 * when inherited strategic context has been updated. Creates an audit trail
 * via the backend API.
 *
 * Phase 38 Plan 05: Severity-tiered banners — amber (significant, non-dismissable)
 * and info-blue (minor, dismissable). Commander must acknowledge significant changes.
 */

import { useState, useCallback } from 'react';
import type { PendingAck, ChangelogEntry } from '../../lib/inheritance-service.ts';
import { ECHELON_COLORS } from '../../lib/inheritance-service.ts';

interface AcknowledgmentBannerProps {
  pendingAcks: PendingAck[];
  changelogEntries?: ChangelogEntry[];
  onAcknowledge: (sourceProblemSetId: string) => void;
  onViewChanges?: () => void;
}

/** localStorage key for tracking dismissed minor banners */
function dismissKey(problemSetId: string): string {
  return `ack-banner-minor-dismissed-${problemSetId}`;
}

function isDismissed(sourceProblemSetId: string): boolean {
  try {
    return localStorage.getItem(dismissKey(sourceProblemSetId)) === 'true';
  } catch {
    return false;
  }
}

function setDismissed(sourceProblemSetId: string): void {
  try {
    localStorage.setItem(dismissKey(sourceProblemSetId), 'true');
  } catch {
    // localStorage may not be available
  }
}

export function AcknowledgmentBanner({
  pendingAcks,
  changelogEntries = [],
  onAcknowledge,
  onViewChanges,
}: AcknowledgmentBannerProps) {
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(
    new Set(),
  );
  const [dismissedMinorIds, setDismissedMinorIds] = useState<Set<string>>(
    () => new Set(pendingAcks.filter(a => isDismissed(a.sourceProblemSetId)).map(a => a.sourceProblemSetId)),
  );

  // Separate changelog entries by severity
  const significantEntries = changelogEntries.filter(e => e.changeSeverity === 'significant');
  const minorEntries = changelogEntries.filter(e => e.changeSeverity !== 'significant');

  // Build significant and minor ack groupings
  const significantSources = new Set(significantEntries.map(e => e.sourceProblemSetName));
  const minorSources = new Set(minorEntries.map(e => e.sourceProblemSetName));

  // Filter remaining acks
  const remaining = pendingAcks.filter(
    (ack) => !acknowledgedIds.has(ack.sourceProblemSetId),
  );

  // Significant acks: sources that have significant changelog entries or any remaining acks (fallback)
  const significantAcks = remaining.filter(ack =>
    significantSources.has(ack.sourceProblemSetName) ||
    (significantEntries.length === 0 && changelogEntries.length === 0),
  );

  // Minor acks: sources that only have minor entries (and not dismissed)
  const minorAcks = remaining.filter(ack =>
    !significantSources.has(ack.sourceProblemSetName) &&
    minorSources.has(ack.sourceProblemSetName) &&
    !dismissedMinorIds.has(ack.sourceProblemSetId),
  );

  const handleAcknowledge = useCallback((sourceProblemSetId: string) => {
    onAcknowledge(sourceProblemSetId);
    setAcknowledgedIds((prev) => new Set([...prev, sourceProblemSetId]));
  }, [onAcknowledge]);

  const handleDismissMinor = useCallback((sourceProblemSetId: string) => {
    setDismissed(sourceProblemSetId);
    setDismissedMinorIds((prev) => new Set([...prev, sourceProblemSetId]));
  }, []);

  if (significantAcks.length === 0 && minorAcks.length === 0 && remaining.length === 0) {
    return null;
  }

  return (
    <div>
      <style>{bannerStyles}</style>

      {/* Amber tier: significant changes — NO dismiss button */}
      {(significantAcks.length > 0 || (remaining.length > 0 && changelogEntries.length === 0)) && (
        <div className="ack-banner ack-banner--significant">
          <div className="ack-banner-header">
            <span className="ack-banner-text ack-banner-text--significant">
              Significant updates from {significantAcks.length > 0 ? significantAcks.length : remaining.length} source
              {(significantAcks.length > 0 ? significantAcks.length : remaining.length) !== 1 ? 's' : ''} require acknowledgment
            </span>
            {onViewChanges && (
              <button
                className="ack-banner-view-btn"
                onClick={onViewChanges}
              >
                View Changes
              </button>
            )}
          </div>

          <div className="ack-banner-list">
            {(significantAcks.length > 0 ? significantAcks : remaining).map((ack) => {
              const echelon = ack.sourceEchelon;
              const colors = ECHELON_COLORS[echelon];
              return (
                <div key={ack.sourceProblemSetId} className="ack-banner-item">
                  <span
                    className="ack-echelon-badge"
                    style={{ backgroundColor: colors?.border ?? '#888' }}
                  >
                    {colors?.label ?? echelon}
                  </span>
                  <span className="ack-source-name">
                    {ack.sourceProblemSetName}
                  </span>
                  <span className="ack-pending-count">
                    {ack.pendingCount} update{ack.pendingCount !== 1 ? 's' : ''}
                  </span>
                  <button
                    className="ack-acknowledge-btn"
                    onClick={() => handleAcknowledge(ack.sourceProblemSetId)}
                  >
                    Acknowledge
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info-blue tier: minor changes — dismiss allowed */}
      {minorAcks.length > 0 && (
        <div className="ack-banner ack-banner--minor">
          <div className="ack-banner-header">
            <span className="ack-banner-text ack-banner-text--minor">
              {minorAcks.reduce((sum, a) => sum + a.pendingCount, 0)} minor update
              {minorAcks.reduce((sum, a) => sum + a.pendingCount, 0) !== 1 ? 's' : ''} from{' '}
              {minorAcks.map(a => a.sourceProblemSetName).join(', ')}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {onViewChanges && (
                <button
                  className="ack-banner-view-btn ack-banner-view-btn--minor"
                  onClick={onViewChanges}
                >
                  View Changes
                </button>
              )}
              <button
                className="ack-banner-dismiss"
                onClick={() => minorAcks.forEach(a => handleDismissMinor(a.sourceProblemSetId))}
                title="Dismiss minor updates"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const bannerStyles = `
.ack-banner {
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.ack-banner--significant {
  border: 1px solid rgba(234, 179, 8, 0.4);
  background-color: #FFF3CD;
}

.ack-banner--minor {
  border: 1px solid rgba(59, 130, 246, 0.4);
  background-color: #D1ECF1;
}

.ack-banner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ack-banner--minor .ack-banner-header {
  margin-bottom: 0;
}

.ack-banner-text {
  font-size: 0.85rem;
  font-weight: 600;
}

.ack-banner-text--significant {
  color: #856404;
}

.ack-banner-text--minor {
  color: #0c5460;
}

.ack-banner-view-btn {
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid rgba(234, 179, 8, 0.4);
  background: transparent;
  color: #856404;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.ack-banner-view-btn:hover {
  background-color: rgba(234, 179, 8, 0.15);
}

.ack-banner-view-btn--minor {
  border-color: rgba(59, 130, 246, 0.4);
  color: #0c5460;
}

.ack-banner-view-btn--minor:hover {
  background-color: rgba(59, 130, 246, 0.15);
}

.ack-banner-dismiss {
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid rgba(59, 130, 246, 0.3);
  background: transparent;
  color: #0c5460;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.ack-banner-dismiss:hover {
  background-color: rgba(59, 130, 246, 0.15);
}

.ack-banner-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ack-banner-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.05);
}

.ack-echelon-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #fff;
  letter-spacing: 0.05em;
}

.ack-source-name {
  font-size: 0.8rem;
  color: #333;
  font-weight: 500;
}

.ack-pending-count {
  font-size: 0.7rem;
  color: #666;
  margin-left: auto;
}

.ack-acknowledge-btn {
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid rgba(34, 197, 94, 0.4);
  background-color: rgba(34, 197, 94, 0.15);
  color: #166534;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.ack-acknowledge-btn:hover {
  background-color: rgba(34, 197, 94, 0.25);
}
`;
