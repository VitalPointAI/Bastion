/**
 * ContextDashboardWidget
 *
 * Phase 26 Plan 02: Compact dashboard widget showing ancestor hierarchy,
 * sync status, and pending acknowledgment count.
 */

import type { AncestorInfo, SyncStatus } from '../../lib/inheritance-service.ts';
import { ECHELON_COLORS } from '../../lib/inheritance-service.ts';

interface ContextDashboardWidgetProps {
  ancestors: AncestorInfo[];
  syncStatus: SyncStatus;
  pendingAcknowledgments: number;
  onRefresh?: () => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ContextDashboardWidget({
  ancestors,
  syncStatus,
  pendingAcknowledgments,
  onRefresh,
}: ContextDashboardWidgetProps) {
  const sorted = [...ancestors].sort((a, b) => a.depth - b.depth);

  return (
    <div className="context-dashboard-widget">
      <style>{widgetStyles}</style>

      <div className="cdw-header">
        <h4 className="cdw-title">Inherited Context</h4>
        {onRefresh && (
          <button
            className="cdw-refresh-btn"
            onClick={onRefresh}
            title="Refresh inherited context"
          >
            Refresh
          </button>
        )}
      </div>

      <div className="cdw-grid">
        {/* Ancestor chain */}
        <div className="cdw-section">
          <span className="cdw-label">Connected Ancestors</span>
          <div className="cdw-ancestor-chain">
            {sorted.map((ancestor, idx) => {
              const echelon = ancestor.echelon;
              const color = ECHELON_COLORS[echelon]?.border ?? '#888';
              return (
                <div key={ancestor.problemSetId} className="cdw-ancestor-node">
                  {idx > 0 && <span className="cdw-chain-line" />}
                  <span
                    className="cdw-echelon-dot"
                    style={{ backgroundColor: color }}
                    title={ECHELON_COLORS[echelon]?.label ?? echelon}
                  />
                  <span className="cdw-ancestor-name">{ancestor.name}</span>
                </div>
              );
            })}
            {sorted.length === 0 && (
              <span className="cdw-empty">No ancestors</span>
            )}
          </div>
        </div>

        {/* Sync status */}
        <div className="cdw-section">
          <span className="cdw-label">Sync Status</span>
          <div className="cdw-sync-status">
            {syncStatus.hasStaleCaches ? (
              <span className="cdw-status-indicator stale">Stale</span>
            ) : (
              <span className="cdw-status-indicator synced">Synced</span>
            )}
            {syncStatus.lastSyncAt && (
              <span className="cdw-sync-time">
                {relativeTime(syncStatus.lastSyncAt)}
              </span>
            )}
          </div>
        </div>

        {/* Pending acks */}
        <div className="cdw-section">
          <span className="cdw-label">Pending Acks</span>
          {pendingAcknowledgments > 0 ? (
            <span className="cdw-pending-badge">{pendingAcknowledgments}</span>
          ) : (
            <span className="cdw-none">None</span>
          )}
        </div>
      </div>
    </div>
  );
}

const widgetStyles = `
.context-dashboard-widget {
  border: 1px solid rgba(100, 100, 100, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background-color: rgba(25, 25, 30, 0.8);
}

.cdw-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.cdw-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #e5e5e5;
}

.cdw-refresh-btn {
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid rgba(100, 100, 100, 0.4);
  background: transparent;
  color: #aaa;
  font-size: 0.7rem;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.cdw-refresh-btn:hover {
  background-color: rgba(100, 100, 100, 0.3);
  color: #ddd;
}

.cdw-grid {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.cdw-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 120px;
}

.cdw-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #777;
  font-weight: 600;
}

.cdw-ancestor-chain {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cdw-ancestor-node {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  padding-left: 4px;
}

.cdw-chain-line {
  position: absolute;
  left: 8px;
  top: -6px;
  width: 1px;
  height: 6px;
  background-color: rgba(100, 100, 100, 0.5);
}

.cdw-echelon-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cdw-ancestor-name {
  font-size: 0.8rem;
  color: #ccc;
}

.cdw-empty {
  font-size: 0.8rem;
  color: #666;
  font-style: italic;
}

.cdw-sync-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cdw-status-indicator {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 600;
}

.cdw-status-indicator.synced {
  background-color: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.cdw-status-indicator.stale {
  background-color: rgba(234, 179, 8, 0.2);
  color: #eab308;
}

.cdw-sync-time {
  font-size: 0.7rem;
  color: #888;
}

.cdw-pending-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
  font-size: 0.75rem;
  font-weight: 700;
}

.cdw-none {
  font-size: 0.8rem;
  color: #666;
}
`;
