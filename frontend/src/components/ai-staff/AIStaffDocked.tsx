/**
 * AIStaffDocked -- Right sidebar panel for process tabs
 *
 * Fixed-width panel with left-edge resize handle, scrollable feed,
 * and footer slot for chat input (Plan 04).
 * Positioned as flex sibling to tab content (not inside TabLayout).
 */

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { useAIStaff, useAIStaffDispatch } from '../../context/AIStaffContext.tsx';
import { AIStaffFeedItem } from './AIStaffFeedItem.tsx';
import type { FeedItemAction } from '../../types/ai-staff.ts';

const STORAGE_KEY = 'bastion-ai-panel-width';
const DEFAULT_WIDTH = 360;
const MIN_WIDTH = 280;
const MAX_WIDTH = 600;

function getStoredWidth(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const val = parseInt(stored, 10);
      if (val >= MIN_WIDTH && val <= MAX_WIDTH) return val;
    }
  } catch { /* ignore */ }
  return DEFAULT_WIDTH;
}

interface AIStaffDockedProps {
  /** Optional footer slot for chat input (rendered in Plan 04) */
  footer?: ReactNode;
}

export function AIStaffDocked({ footer }: AIStaffDockedProps) {
  const { feedItems, activeTab } = useAIStaff();
  const dispatch = useAIStaffDispatch();
  const [width, setWidth] = useState(getStoredWidth);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Persist width to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(width));
    } catch { /* ignore */ }
  }, [width]);

  // Resize handle via native mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      // Dragging left edge: moving left increases width, moving right decreases
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [width]);

  const handleAction = useCallback((_itemId: string, _action: FeedItemAction) => {
    // Action handling will be wired in Plan 04/05
  }, []);

  const handleMarkRead = useCallback((itemId: string) => {
    dispatch.markRead(itemId);
  }, [dispatch]);

  // Split items: active-tab items first, then other-tab items
  const activeTabItems = feedItems.filter((item) => item.sourceTab === activeTab);
  const otherTabItems = feedItems.filter((item) => item.sourceTab !== activeTab);

  const [otherExpanded, setOtherExpanded] = useState(false);

  return (
    <div
      ref={panelRef}
      className="ai-staff-docked"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className="ai-staff-docked-resize"
        onMouseDown={handleMouseDown}
      />

      {/* Header */}
      <div className="ai-staff-docked-header">
        <span className="ai-staff-title">AI Staff</span>
        <button
          className="ai-staff-docked-close"
          onClick={() => dispatch.setOpen(false)}
          aria-label="Close AI Staff panel"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Feed body */}
      <div className="ai-staff-docked-body">
        {activeTabItems.length === 0 && otherTabItems.length === 0 && (
          <div className="ai-staff-docked-empty">
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
          <div className="ai-staff-docked-other">
            <button
              className="ai-staff-docked-other-toggle"
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

      {/* Footer slot for chat input */}
      {footer && (
        <div className="ai-staff-docked-footer">
          {footer}
        </div>
      )}
    </div>
  );
}
