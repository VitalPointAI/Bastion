/**
 * TabNotificationDropdown
 *
 * Inline dropdown that appears below a tab badge when clicked.
 * Shows cross-problem set updates for that specific tab, allowing
 * commanders to take action without navigating away from the current tab.
 *
 * Features:
 * - Filters CrossProblemSetUpdate[] to the relevant tab
 * - Color-coded update type badges (directive, data_change, escalation)
 * - Relative timestamps ("2 min ago")
 * - Click item to trigger onAction callback
 * - "Mark all as read" clears badge count and closes dropdown
 * - Click outside (backdrop) to dismiss
 *
 * Phase 20 Plan 07: Tab notification dropdown for cross-problem set updates
 */

import { useEffect, useRef } from 'react';
import { useProblemSet, type CrossProblemSetUpdate } from '../../context/ProblemSetContext';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TabNotificationDropdownProps {
  tab: string;
  updates: CrossProblemSetUpdate[];
  onClose: () => void;
  onAction: (update: CrossProblemSetUpdate) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Badge styling for each update type */
const UPDATE_TYPE_STYLES: Record<CrossProblemSetUpdate['updateType'], { label: string; className: string }> = {
  new_directive: { label: 'Directive', className: 'bg-red-700 text-red-100' },
  data_change: { label: 'Data Change', className: 'bg-blue-700 text-blue-100' },
  escalation: { label: 'Escalation', className: 'bg-yellow-700 text-yellow-100' },
};

/** Returns a human-readable relative time string */
function relativeTime(timestamp: string): string {
  try {
    const diff = Date.now() - new Date(timestamp).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TabNotificationDropdown({
  tab,
  updates,
  onClose,
  onAction,
}: TabNotificationDropdownProps) {
  const { clearTabNotifications } = useProblemSet();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter updates to this tab
  const tabUpdates = updates.filter((u) => u.tab === tab);

  // ─── Click outside detection ───────────────────────────────────────────────

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    // Use capture phase so we intercept before other handlers
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [onClose]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleMarkAllRead() {
    clearTabNotifications(tab);
    onClose();
  }

  function handleItemClick(update: CrossProblemSetUpdate) {
    onAction(update);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden"
      role="menu"
      aria-label={`Cross-problem set updates for ${tab}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
          Cross-Problem Set Updates
        </span>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 transition-colors p-0.5"
          aria-label="Close dropdown"
        >
          {/* X icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Update list */}
      <div className="max-h-64 overflow-auto">
        {tabUpdates.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6 px-4">
            No updates for this tab
          </p>
        ) : (
          tabUpdates.map((update) => {
            const typeStyle = UPDATE_TYPE_STYLES[update.updateType];
            return (
              <button
                key={update.actionableItemId}
                onClick={() => handleItemClick(update)}
                className="w-full text-left px-3 py-2.5 border-b border-gray-700 last:border-b-0 hover:bg-gray-700/60 transition-colors focus:outline-none focus:bg-gray-700/60"
                role="menuitem"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  {/* Source problem set name */}
                  <span className="text-sm font-semibold text-gray-100 truncate">
                    {update.sourceProblemSetName}
                  </span>
                  {/* Update type badge */}
                  <span
                    className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${typeStyle.className}`}
                  >
                    {typeStyle.label}
                  </span>
                </div>
                {/* Summary text */}
                <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-1">
                  {update.summary}
                </p>
                {/* Timestamp */}
                <span className="text-xs text-gray-600">
                  {relativeTime(update.timestamp)}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Footer: mark all as read */}
      {tabUpdates.length > 0 && (
        <div className="border-t border-gray-700 px-3 py-2">
          <button
            onClick={handleMarkAllRead}
            className="w-full text-xs text-blue-400 hover:text-blue-300 transition-colors text-center py-0.5"
          >
            Mark all as read
          </button>
        </div>
      )}
    </div>
  );
}

export default TabNotificationDropdown;
