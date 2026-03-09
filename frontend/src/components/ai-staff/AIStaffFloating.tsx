/**
 * AIStaffFloating -- Global floating, draggable, resizable AI activity panel
 *
 * Rendered via createPortal to document.body so it floats above all content.
 * z-index 900 (above map ~400-600, below modals 1000+).
 * Position and size are persisted to localStorage.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAIStaff, useAIStaffDispatch } from '../../context/AIStaffContext.tsx';
import { AIStaffFeedItem } from './AIStaffFeedItem.tsx';
import type { FeedItemAction } from '../../types/ai-staff.ts';
import './AIStaffFloating.css';

const POS_STORAGE_KEY = 'bastion-ai-floating-pos';
const SIZE_STORAGE_KEY = 'bastion-ai-floating-size';

interface FloatingPos { x: number; y: number; }
interface FloatingSize { width: number; height: number; }

const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 500;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 250;

function getStoredPos(): FloatingPos | null {
  try {
    const stored = localStorage.getItem(POS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed as FloatingPos;
    }
  } catch { /* ignore */ }
  return null;
}

function getDefaultPos(): FloatingPos {
  return { x: window.innerWidth - DEFAULT_WIDTH - 20, y: window.innerHeight - DEFAULT_HEIGHT - 20 };
}

function getStoredSize(): FloatingSize | null {
  try {
    const stored = localStorage.getItem(SIZE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.width === 'number' && typeof parsed.height === 'number') return parsed as FloatingSize;
    }
  } catch { /* ignore */ }
  return null;
}

function getBadgeColor(feedItems: { urgency: string }[]): 'badge-green' | 'badge-amber' | 'badge-red' {
  const hasActionRequired = feedItems.some((i) => i.urgency === 'action_required');
  if (hasActionRequired) return 'badge-red';
  const hasAttention = feedItems.some((i) => i.urgency === 'attention');
  if (hasAttention) return 'badge-amber';
  return 'badge-green';
}

export function AIStaffFloating() {
  const { feedItems, unreadCount, activeTab } = useAIStaff();
  const dispatch = useAIStaffDispatch();
  const [pos, setPos] = useState<FloatingPos>(() => getStoredPos() ?? getDefaultPos());
  const [size, setSize] = useState<FloatingSize>(() => getStoredSize() ?? { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const isDragging = useRef(false);
  const dragOffset = useRef<FloatingPos>({ x: 0, y: 0 });

  // Persist position + size
  useEffect(() => {
    try { localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
  }, [pos]);
  useEffect(() => {
    try { localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(size)); } catch { /* ignore */ }
  }, [size]);

  // Drag handling on header bar
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      setPos({ x: moveEvent.clientX - dragOffset.current.x, y: moveEvent.clientY - dragOffset.current.y });
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

  // Resize from bottom-right corner
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.width;
    const startH = size.height;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newW = Math.max(MIN_WIDTH, startW + (moveEvent.clientX - startX));
      const newH = Math.max(MIN_HEIGHT, startH + (moveEvent.clientY - startY));
      setSize({ width: newW, height: newH });
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [size]);

  const handleAction = useCallback((_itemId: string, _action: FeedItemAction) => {
    // Action handling will be wired in Plan 04/05
  }, []);

  const handleMarkRead = useCallback((itemId: string) => {
    dispatch.markRead(itemId);
  }, [dispatch]);

  // Split items by tab
  const activeTabItems = feedItems.filter((item) => item.sourceTab === activeTab);
  const otherTabItems = feedItems.filter((item) => item.sourceTab !== activeTab);
  const [otherExpanded, setOtherExpanded] = useState(false);

  const badgeColor = getBadgeColor(feedItems);

  return createPortal(
    <div
      className="ai-staff-floating-panel"
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 900,
      }}
    >
      {/* Draggable header */}
      <div className="ai-staff-floating-header" onMouseDown={handleDragStart}>
        <span className="ai-staff-title">AI Activity</span>
        <div className="ai-staff-floating-header-actions">
          {unreadCount > 0 && (
            <span className={`ai-staff-count-badge ${badgeColor}`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <button
            className="ai-staff-floating-minimize"
            onClick={() => dispatch.setOpen(false)}
            aria-label="Close AI Activity panel"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Feed body */}
      <div className="ai-staff-floating-body">
        {activeTabItems.length === 0 && otherTabItems.length === 0 && (
          <div className="ai-staff-floating-empty">
            <span className="ai-staff-subtitle">No AI activity yet</span>
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
                width="12" height="12" viewBox="0 0 12 12"
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

      {/* Resize handle (bottom-right corner) */}
      <div className="ai-staff-floating-resize" onMouseDown={handleResizeStart} />
    </div>,
    document.body,
  );
}
