/**
 * ChangelogView
 *
 * Phase 26 Plan 03: Chronological timeline of inherited context changes
 * with severity distinction (significant vs minor) and change type icons.
 */

import { useState } from 'react';
import type { ChangelogEntry } from '../../lib/inheritance-service.ts';

interface ChangelogViewProps {
  changelog: ChangelogEntry[];
  maxItems?: number;
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

/** SVG icons for change types */
function ChangeTypeIcon({ type }: { type: string }) {
  const size = 16;
  const color = 'currentColor';

  switch (type) {
    case 'document_added':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5">
          <circle cx="8" cy="8" r="6" />
          <line x1="8" y1="5" x2="8" y2="11" />
          <line x1="5" y1="8" x2="11" y2="8" />
        </svg>
      );
    case 'document_updated':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5">
          <path d="M11.5 2.5l2 2-7 7H4.5v-2l7-7z" />
          <line x1="9" y1="5" x2="11" y2="7" />
        </svg>
      );
    case 'document_removed':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5">
          <path d="M5 3V2h6v1M3 4h10M6 4v8M10 4v8M4 4l1 10h6l1-10" />
        </svg>
      );
    case 'graph_updated':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5">
          <circle cx="4" cy="4" r="2" />
          <circle cx="12" cy="4" r="2" />
          <circle cx="8" cy="12" r="2" />
          <line x1="5.5" y1="5.5" x2="7" y2="10.5" />
          <line x1="10.5" y1="5.5" x2="9" y2="10.5" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5">
          <circle cx="8" cy="8" r="6" />
        </svg>
      );
  }
}

function changeTypeLabel(type: string): string {
  switch (type) {
    case 'document_added': return 'Added';
    case 'document_updated': return 'Updated';
    case 'document_removed': return 'Removed';
    case 'graph_updated': return 'Graph Updated';
    default: return type;
  }
}

export function ChangelogView({ changelog, maxItems = 20 }: ChangelogViewProps) {
  const [showAll, setShowAll] = useState(false);

  if (changelog.length === 0) {
    return (
      <div className="changelog-view">
        <style>{changelogStyles}</style>
        <div className="changelog-empty">No changes recorded</div>
      </div>
    );
  }

  const sorted = [...changelog].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const visible = showAll ? sorted : sorted.slice(0, maxItems);
  const hasMore = sorted.length > maxItems;

  return (
    <div className="changelog-view">
      <style>{changelogStyles}</style>

      <div className="changelog-timeline">
        {visible.map((entry) => {
          const isSignificant = entry.changeSeverity === 'significant';
          return (
            <div
              key={entry.id}
              className={`changelog-entry ${isSignificant ? 'significant' : 'minor'}`}
            >
              <div className="changelog-indicator">
                <span
                  className={`changelog-dot ${isSignificant ? 'significant' : 'minor'}`}
                />
                <span className="changelog-line" />
              </div>

              <div className="changelog-content">
                <div className="changelog-meta">
                  <span className="changelog-time">{relativeTime(entry.createdAt)}</span>
                  <span className="changelog-source">{entry.sourceProblemSetName}</span>
                  <span className={`changelog-type-badge ${isSignificant ? 'significant' : ''}`}>
                    <ChangeTypeIcon type={entry.changeType} />
                    {changeTypeLabel(entry.changeType)}
                  </span>
                </div>

                <h4 className={`changelog-title ${isSignificant ? 'significant' : ''}`}>
                  {entry.itemTitle}
                </h4>

                {entry.summary && (
                  <p className="changelog-summary">{entry.summary}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && !showAll && (
        <button
          className="changelog-show-more"
          onClick={() => setShowAll(true)}
        >
          Show more ({sorted.length - maxItems} remaining)
        </button>
      )}
    </div>
  );
}

const changelogStyles = `
.changelog-view {
  padding: 8px 0;
}

.changelog-empty {
  text-align: center;
  padding: 24px 16px;
  color: #666;
  font-size: 0.85rem;
  font-style: italic;
}

.changelog-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.changelog-entry {
  display: flex;
  gap: 12px;
  padding: 8px 0;
}

.changelog-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
  flex-shrink: 0;
  position: relative;
}

.changelog-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  z-index: 1;
}

.changelog-dot.significant {
  background-color: #d97706;
  box-shadow: 0 0 6px rgba(217, 119, 6, 0.4);
}

.changelog-dot.minor {
  background-color: #555;
}

.changelog-line {
  width: 1px;
  flex: 1;
  background-color: rgba(100, 100, 100, 0.3);
  min-height: 8px;
}

.changelog-entry:last-child .changelog-line {
  display: none;
}

.changelog-content {
  flex: 1;
  min-width: 0;
  padding-bottom: 8px;
}

.changelog-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.changelog-time {
  font-size: 0.7rem;
  color: #777;
}

.changelog-source {
  font-size: 0.7rem;
  color: #999;
  padding: 1px 6px;
  border-radius: 3px;
  background-color: rgba(100, 100, 100, 0.2);
}

.changelog-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  color: #888;
}

.changelog-type-badge.significant {
  color: #d97706;
  font-weight: 600;
}

.changelog-title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 500;
  color: #ccc;
}

.changelog-title.significant {
  font-weight: 700;
  color: #e5e5e5;
}

.changelog-summary {
  margin: 4px 0 0 0;
  font-size: 0.78rem;
  color: #888;
  line-height: 1.4;
}

.changelog-show-more {
  display: block;
  width: 100%;
  padding: 8px 16px;
  margin-top: 8px;
  border-radius: 4px;
  border: 1px solid rgba(100, 100, 100, 0.3);
  background: transparent;
  color: #aaa;
  font-size: 0.78rem;
  cursor: pointer;
  text-align: center;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.changelog-show-more:hover {
  background-color: rgba(100, 100, 100, 0.2);
  color: #ddd;
}
`;
