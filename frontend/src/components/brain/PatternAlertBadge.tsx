import React, { useState, useEffect, useRef } from 'react';
import type { PatternAlert } from './hooks/useBrainPatterns.js';
import './PatternAlertBadge.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PatternAlertBadgeProps {
  /** All current pattern alerts */
  alerts: PatternAlert[];
  /** Number of unread alerts — displayed in the badge */
  unreadCount: number;
  /** Mark a single alert as read */
  onMarkAsRead: (id: string) => void;
  /** Mark all alerts as read */
  onMarkAllAsRead: () => void;
  /** Optional: clicking "View in Brain" highlights the related nodes */
  onAlertClick?: (alert: PatternAlert) => void;
  /**
   * Optional: set of alert IDs that have already been read.
   * Used to apply the `unread` visual indicator per alert row.
   * If not provided, all alerts are treated as unread when unreadCount > 0.
   */
  readAlertIds?: Set<string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns a human-friendly relative timestamp */
function relativeTime(isoString: string): string {
  const detectedAt = new Date(isoString);
  if (isNaN(detectedAt.getTime())) return '';
  const diffMs = Date.now() - detectedAt.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/** Returns the CSS color for a severity level */
function severityColor(severity: PatternAlert['severity']): string {
  switch (severity) {
    case 'high':
      return '#ff4444';
    case 'medium':
      return '#ffcc00';
    case 'low':
    default:
      return '#4a9eff';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PatternAlertBadge
 *
 * Toolbar notification badge for proactive pattern alerts. Shows a bell icon
 * with an unread count badge. Clicking opens a dropdown listing all alerts
 * with severity indicators, type tags, and "View in Brain" actions.
 */
export function PatternAlertBadge({
  alerts,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onAlertClick,
  readAlertIds,
}: PatternAlertBadgeProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Close on outside click ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    function handleOutsideClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleToggle() {
    setIsOpen((prev) => !prev);
  }

  function handleAlertClick(alert: PatternAlert) {
    onMarkAsRead(alert.id);
    onAlertClick?.(alert);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="pattern-badge-container" ref={containerRef}>
      {/* Bell button */}
      <button
        className="pattern-badge-btn"
        onClick={handleToggle}
        type="button"
        title="Pattern Alerts"
        aria-label={`Pattern alerts${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        {/* Bell icon (unicode fallback) */}
        <span aria-hidden="true">&#128276;</span>

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span className="pattern-badge-count" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="pattern-dropdown" role="dialog" aria-label="Pattern Alerts">
          {/* Dropdown header */}
          <div className="pattern-dropdown-header">
            <span className="pattern-dropdown-title">Pattern Alerts</span>
            {alerts.length > 0 && (
              <button
                className="pattern-mark-all-btn"
                onClick={onMarkAllAsRead}
                type="button"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Alert list */}
          <div className="pattern-alert-list">
            {alerts.length === 0 ? (
              <div className="pattern-empty-state">
                No pattern alerts &mdash; the brain is watching
              </div>
            ) : (
              alerts.map((alert) => {
                const isAlertRead = readAlertIds
                  ? readAlertIds.has(alert.id)
                  : false;

                return (
                  <div
                    key={alert.id}
                    className={`pattern-alert-item${isAlertRead ? '' : ' unread'}`}
                    onClick={() => handleAlertClick(alert)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleAlertClick(alert);
                      }
                    }}
                  >
                    {/* Top row: severity dot + type badge + time */}
                    <div className="pattern-alert-top-row">
                      <span
                        className="pattern-severity-dot"
                        style={{ background: severityColor(alert.severity) }}
                        title={`Severity: ${alert.severity}`}
                      />
                      <span className="pattern-alert-type">{alert.type}</span>
                      <span className="pattern-alert-time">
                        detected {relativeTime(alert.detectedAt)}
                      </span>
                    </div>

                    {/* Message */}
                    <p className="pattern-alert-message">{alert.message}</p>

                    {/* View in Brain button */}
                    {onAlertClick && alert.relatedNodeIds.length > 0 && (
                      <button
                        className="pattern-view-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAlertClick(alert);
                        }}
                        type="button"
                      >
                        View in Brain
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
