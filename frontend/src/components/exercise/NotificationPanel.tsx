/**
 * NotificationPanel
 *
 * Phase 15 Plan 04: Bell icon + notification list panel for the staff workspace.
 *
 * Features:
 *   - Bell icon button with red badge showing unread count
 *   - Dropdown panel that slides down when bell is clicked
 *   - Filter toggle: "All Staff" vs "{role} Only"
 *   - Notification items: source role badge, product title, type, relative timestamp
 *   - Unread indicator (blue dot), Dismiss/Integrate/View action buttons
 *   - "Mark All Read" bulk action
 *   - Empty state when no notifications match the filter
 *
 * Layout: Positioned in the workspace header area (top-right overlay).
 * Props flow from StaffWorkspace via useStaffNotifications hook.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { StaffNotification } from '../../types/exercise';
import { STAFF_ROLE_CONFIG } from '../../types/exercise';
import './NotificationPanel.css';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface NotificationPanelProps {
  notifications: StaffNotification[];
  unreadCount: number;
  roleUnreadCount: number;
  activeRole: string;
  onMarkRead: (id: string) => Promise<void>;
  onMarkIntegrated: (id: string) => Promise<void>;
  onViewProduct: (notification: StaffNotification) => void;
  onIntegrate: (notification: StaffNotification) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/**
 * Returns a CSS class suffix for the source role's category color.
 * Command=gold, J-Staff=blue, Special Staff=purple, Supporting=green,
 * Component Commands=teal, Additional Elements=orange.
 */
function roleCategoryClass(roleKey: string): string {
  const config = STAFF_ROLE_CONFIG[roleKey];
  if (!config) return 'other';
  switch (config.category) {
    case 'Command':
      return 'command';
    case 'J-Staff':
      return 'jstaff';
    case 'Special Staff':
      return 'special';
    case 'Supporting Elements':
      return 'supporting';
    case 'Component Commands':
      return 'component';
    case 'Additional Elements':
      return 'additional';
    default:
      return 'other';
  }
}

function roleLabel(roleKey: string): string {
  return STAFF_ROLE_CONFIG[roleKey]?.label ?? roleKey;
}

// ─── Single notification item ──────────────────────────────────────────────────

interface NotificationItemProps {
  notification: StaffNotification;
  onMarkRead: (id: string) => Promise<void>;
  onMarkIntegrated: (id: string) => Promise<void>;
  onViewProduct: (n: StaffNotification) => void;
  onIntegrate: (n: StaffNotification) => void;
}

function NotificationItem({
  notification: n,
  onMarkRead,
  onMarkIntegrated,
  onViewProduct,
  onIntegrate,
}: NotificationItemProps) {
  const [dismissing, setDismissing] = useState(false);
  const [integrating, setIntegrating] = useState(false);

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await onMarkRead(n.id);
    } finally {
      setDismissing(false);
    }
  };

  const handleIntegrate = async () => {
    setIntegrating(true);
    try {
      await onMarkIntegrated(n.id);
      onIntegrate(n);
    } finally {
      setIntegrating(false);
    }
  };

  const categoryClass = roleCategoryClass(n.sourceRole);

  return (
    <div
      className={`notif-item notif-item--${categoryClass} ${n.isRead ? 'notif-item--read' : 'notif-item--unread'}`}
    >
      {/* Unread indicator dot */}
      {!n.isRead && <span className="notif-unread-dot" aria-label="Unread" />}

      <div className="notif-item-body">
        <div className="notif-item-header">
          {/* Source role badge */}
          <span className={`notif-role-badge notif-role-badge--${categoryClass}`}>
            {roleLabel(n.sourceRole)}
          </span>
          {/* Notification type */}
          <span className="notif-type">
            {n.notificationType === 'published' ? 'Published' : 'Updated'}
          </span>
          {/* Timestamp */}
          <span className="notif-time">{formatRelativeTime(n.createdAt)}</span>
        </div>

        {/* Product title (stored in diffSnapshot summary or fallback) */}
        <div className="notif-product-title">
          {(n.diffSnapshot as { productTitle?: string } | null)?.productTitle ??
            `Product from ${roleLabel(n.sourceRole)}`}
        </div>
      </div>

      {/* Action buttons */}
      <div className="notif-actions">
        <button
          className="notif-btn notif-btn--view"
          onClick={() => onViewProduct(n)}
          title="View this product"
        >
          View
        </button>
        <button
          className="notif-btn notif-btn--integrate"
          onClick={handleIntegrate}
          disabled={integrating || n.isIntegrated}
          title={n.isIntegrated ? 'Already integrated' : 'Integrate into your workspace'}
        >
          {n.isIntegrated ? 'Integrated' : integrating ? '...' : 'Integrate'}
        </button>
        {!n.isRead && (
          <button
            className="notif-btn notif-btn--dismiss"
            onClick={handleDismiss}
            disabled={dismissing}
            title="Mark as read"
          >
            {dismissing ? '...' : 'Dismiss'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── NotificationPanel ─────────────────────────────────────────────────────────

export function NotificationPanel({
  notifications,
  unreadCount,
  roleUnreadCount,
  activeRole,
  onMarkRead,
  onMarkIntegrated,
  onViewProduct,
  onIntegrate,
}: NotificationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'role'>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, handleOutsideClick]);

  // Filtered list based on current mode
  const visibleNotifications =
    filterMode === 'role'
      ? notifications.filter((n) => n.targetRole === activeRole)
      : notifications;

  // Sort newest first
  const sortedNotifications = [...visibleNotifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const displayedUnreadCount = filterMode === 'role' ? roleUnreadCount : unreadCount;
  const hasUnread = displayedUnreadCount > 0;

  // Mark all visible unread as read
  const handleMarkAllRead = async () => {
    const unread = visibleNotifications.filter((n) => !n.isRead);
    await Promise.all(unread.map((n) => onMarkRead(n.id)));
  };

  const activeRoleLabel = STAFF_ROLE_CONFIG[activeRole]?.label ?? activeRole;

  return (
    <div className="notif-panel-wrapper" ref={panelRef}>
      {/* ── Bell button ── */}
      <button
        className={`notif-bell-btn ${isOpen ? 'notif-bell-btn--open' : ''}`}
        onClick={() => setIsOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        title="Notifications"
      >
        {/* Bell icon (Unicode) */}
        <span className="notif-bell-icon" aria-hidden="true">
          &#128276;
        </span>
        {unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {isOpen && (
        <div className="notif-panel" role="dialog" aria-label="Notifications panel">
          {/* Panel header */}
          <div className="notif-panel-header">
            <span className="notif-panel-title">Notifications</span>

            {/* Filter toggle */}
            <div className="notif-filter-toggle" role="group" aria-label="Filter notifications">
              <button
                className={`notif-filter-btn ${filterMode === 'all' ? 'notif-filter-btn--active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                All Staff
              </button>
              <button
                className={`notif-filter-btn ${filterMode === 'role' ? 'notif-filter-btn--active' : ''}`}
                onClick={() => setFilterMode('role')}
              >
                {activeRoleLabel} Only
              </button>
            </div>
          </div>

          {/* Mark all read */}
          {hasUnread && (
            <div className="notif-panel-actions">
              <button
                className="notif-mark-all-btn"
                onClick={handleMarkAllRead}
              >
                Mark All Read ({displayedUnreadCount})
              </button>
            </div>
          )}

          {/* Notification list */}
          <div className="notif-list">
            {sortedNotifications.length === 0 ? (
              <div className="notif-empty">
                <span className="notif-empty-icon">&#10003;</span>
                <p>No notifications{filterMode === 'role' ? ` for ${activeRoleLabel}` : ''}</p>
              </div>
            ) : (
              sortedNotifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onMarkRead={onMarkRead}
                  onMarkIntegrated={onMarkIntegrated}
                  onViewProduct={onViewProduct}
                  onIntegrate={onIntegrate}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
