/**
 * AcknowledgmentBanner
 *
 * Phase 26 Plan 02: Dismissible banner prompting commander acknowledgment
 * when inherited strategic context has been updated. Creates an audit trail
 * via the backend API.
 */

import { useState } from 'react';
import type { PendingAck } from '../../lib/inheritance-service.ts';
import { ECHELON_COLORS } from '../../lib/inheritance-service.ts';

interface AcknowledgmentBannerProps {
  pendingAcks: PendingAck[];
  onAcknowledge: (sourceProblemSetId: string) => void;
}

export function AcknowledgmentBanner({
  pendingAcks,
  onAcknowledge,
}: AcknowledgmentBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(
    new Set(),
  );

  const remaining = pendingAcks.filter(
    (ack) => !acknowledgedIds.has(ack.sourceProblemSetId),
  );

  if (dismissed || remaining.length === 0) return null;

  function handleAcknowledge(sourceProblemSetId: string) {
    onAcknowledge(sourceProblemSetId);
    setAcknowledgedIds((prev) => new Set([...prev, sourceProblemSetId]));
  }

  return (
    <div className="ack-banner">
      <style>{bannerStyles}</style>

      <div className="ack-banner-header">
        <span className="ack-banner-text">
          Strategic context updated -- {remaining.length} source
          {remaining.length !== 1 ? 's' : ''} require acknowledgment
        </span>
        <button
          className="ack-banner-dismiss"
          onClick={() => setDismissed(true)}
          title="Dismiss banner"
        >
          Dismiss
        </button>
      </div>

      <div className="ack-banner-list">
        {remaining.map((ack) => {
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
  );
}

const bannerStyles = `
.ack-banner {
  border: 1px solid rgba(234, 179, 8, 0.4);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background-color: rgba(234, 179, 8, 0.08);
}

.ack-banner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ack-banner-text {
  font-size: 0.85rem;
  font-weight: 600;
  color: #eab308;
}

.ack-banner-dismiss {
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(234, 179, 8, 0.3);
  background: transparent;
  color: #999;
  font-size: 0.7rem;
  cursor: pointer;
  transition: color 0.15s ease;
}

.ack-banner-dismiss:hover {
  color: #ddd;
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
  background-color: rgba(30, 30, 30, 0.5);
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
  color: #ccc;
  font-weight: 500;
}

.ack-pending-count {
  font-size: 0.7rem;
  color: #888;
  margin-left: auto;
}

.ack-acknowledge-btn {
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid rgba(34, 197, 94, 0.4);
  background-color: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.ack-acknowledge-btn:hover {
  background-color: rgba(34, 197, 94, 0.25);
}
`;
