/**
 * AIStaffFloating -- Floating overlay panel for watch tabs
 *
 * Collapsed: circular button with notification badge (color-coded urgency).
 * Expanded: draggable floating panel via createPortal to document.body.
 * z-index 900 (above map ~400-600, below modals 1000+).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAIStaff, useAIStaffDispatch } from '../../context/AIStaffContext.tsx';
import { AIStaffFeedItem } from './AIStaffFeedItem.tsx';
import type { FeedItemAction } from '../../types/ai-staff.ts';
import './AIStaffFloating.css';

const POS_STORAGE_KEY = 'bastion-ai-floating-pos';

interface FloatingPos {
  x: number;
  y: number;
}

function getStoredPos(): FloatingPos | null {
  try {
    const stored = localStorage.getItem(POS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return parsed as FloatingPos;
      }
    }
  } catch { /* ignore */ }
  return null;
}

function getDefaultPos(): FloatingPos {
  return {
    x: window.innerWidth - 380,
    y: window.innerHeight - 520,
  };
}

function getBadgeColor(feedItems: { urgency: string }[]): 'badge-green' | 'badge-amber' | 'badge-red' {
  const hasActionRequired = feedItems.some((i) => i.urgency === 'action_required');
  if (hasActionRequired) return 'badge-red';
  const hasAttention = feedItems.some((i) => i.urgency === 'attention');
  if (hasAttention) return 'badge-amber';
  return 'badge-green';
}

function getBorderColor(feedItems: { urgency: string }[]): string {
  const badge = getBadgeColor(feedItems);
  if (badge === 'badge-red') return 'var(--accent-red, #ef4444)';
  if (badge === 'badge-amber') return 'var(--accent-yellow, #f59e0b)';
  return 'var(--accent-green, #22c55e)';
}

export function AIStaffFloating() {
  const { feedItems, unreadCount, activeTab } = useAIStaff();
  const dispatch = useAIStaffDispatch();
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState<FloatingPos>(() => getStoredPos() ?? getDefaultPos());
  const isDragging = useRef(false);
  const dragOffset = useRef<FloatingPos>({ x: 0, y: 0 });

  // Persist position
  useEffect(() => {
    try {
      localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos));
    } catch { /* ignore */ }
  }, [pos]);

  // Drag handling on header bar
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      setPos({
        x: moveEvent.clientX - dragOffset.current.x,
        y: moveEvent.clientY - dragOffset.current.y,
      });
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [pos]);

  const handleAction = useCallback((_itemId: string, _action: FeedItemAction) => {
    // Action handling will be wired in Plan 04/05
  }, []);

  const handleMarkRead = useCallback((itemId: string) => {
    dispatch.markRead(itemId);
  }, [dispatch]);

  // Split items
  const activeTabItems = feedItems.filter((item) => item.sourceTab === activeTab);
  const otherTabItems = feedItems.filter((item) => item.sourceTab !== activeTab);
  const [otherExpanded, setOtherExpanded] = useState(false);

  const badgeColor = getBadgeColor(feedItems);
  const borderColor = getBorderColor(feedItems);

  // Collapsed: floating button
  if (!expanded) {
    return createPortal(
      <button
        className="ai-staff-floating-button"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          borderColor: borderColor,
          zIndex: 900,
        }}
        onClick={() => setExpanded(true)}
        aria-label={`AI Staff: ${unreadCount} unread items`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v-2h-2v2zm0-4h2V7h-2v6z"
            fill="currentColor"
          />
        </svg>
        {unreadCount > 0 && (
          <span className={`ai-staff-count-badge ${badgeColor}`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>,
      document.body,
    );
  }

  // Expanded: floating panel
  return createPortal(
    <div
      className="ai-staff-floating-panel"
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex: 900,
      }}
    >
      {/* Draggable header */}
      <div
        className="ai-staff-floating-header"
        onMouseDown={handleDragStart}
      >
        <span className="ai-staff-title">AI Staff</span>
        <div className="ai-staff-floating-header-actions">
          {unreadCount > 0 && (
            <span className={`ai-staff-count-badge ${badgeColor}`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <button
            className="ai-staff-floating-minimize"
            onClick={() => setExpanded(false)}
            aria-label="Minimize AI Staff panel"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Feed body */}
      <div className="ai-staff-floating-body">
        {activeTabItems.length === 0 && otherTabItems.length === 0 && (
          <div className="ai-staff-floating-empty">
            <span className="ai-staff-subtitle">No AI staff activity yet</span>
          </div>
        )}

        {activeTabItems.map((item) => (
          <AIStaffFeedItem
            key={item.id}
            item={item}
            onAction={handleAction}
            onMarkRead={handleMarkRead}
          />
        ))}

        {otherTabItems.length > 0 && (
          <div className="ai-staff-floating-other">
            <button
              className="ai-staff-floating-other-toggle"
              onClick={() => setOtherExpanded(!otherExpanded)}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                className={`chevron ${otherExpanded ? 'expanded' : ''}`}
              >
                <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="ai-staff-subtitle">
                Other tabs ({otherTabItems.length})
              </span>
            </button>
            {otherExpanded && otherTabItems.map((item) => (
              <AIStaffFeedItem
                key={item.id}
                item={item}
                onAction={handleAction}
                onMarkRead={handleMarkRead}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
