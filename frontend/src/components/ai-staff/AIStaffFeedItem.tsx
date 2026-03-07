/**
 * AIStaffFeedItem -- Individual feed item card
 *
 * Displays agent attribution badge, confidence, urgency, timestamp,
 * content, action buttons, and optional team detail.
 */

import type { AIFeedItem, FeedItemAction } from '../../types/ai-staff.ts';
import { AIStaffTeamBadge } from './AIStaffTeamBadge.tsx';
import { AIStaffConfidence } from './AIStaffConfidence.tsx';
import { AIStaffTeamDetail } from './AIStaffTeamDetail.tsx';
import { AgentHealthDot } from '../common/AgentHealthDot.tsx';
import { URGENCY_STYLES } from '../../types/ai-staff.ts';
import { useState, useCallback } from 'react';
import './AIStaffFeedItem.css';

// Action button styling config
const ACTION_STYLES: Record<FeedItemAction, { label: string; className: string }> = {
  accept: { label: 'Accept', className: 'action-accept' },
  dismiss: { label: 'Dismiss', className: 'action-dismiss' },
  modify: { label: 'Modify', className: 'action-modify' },
  escalate: { label: 'Escalate', className: 'action-escalate' },
};

/**
 * Format a timestamp as relative time (e.g., "2m ago", "1h ago").
 */
function relativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

interface AIStaffFeedItemProps {
  item: AIFeedItem;
  onAction: (itemId: string, action: FeedItemAction) => void;
  onMarkRead: (itemId: string) => void;
  validationStatus?: 'passing' | 'warning' | 'critical' | 'disabled' | 'unknown';
}

export function AIStaffFeedItem({ item, onAction, onMarkRead, validationStatus }: AIStaffFeedItemProps) {
  const [teamExpanded, setTeamExpanded] = useState(false);
  const urgencyStyle = URGENCY_STYLES[item.urgency];

  const handleClick = useCallback(() => {
    if (!item.isRead) {
      onMarkRead(item.id);
    }
  }, [item.isRead, item.id, onMarkRead]);

  return (
    <div
      className={`ai-feed-item ${item.isRead ? '' : 'unread'}`}
      onClick={handleClick}
      role="article"
      aria-label={`${item.agentDisplayName}: ${item.content.slice(0, 60)}`}
    >
      {/* Header row: badge + timestamp + urgency */}
      <div className="ai-feed-item-header">
        <AgentHealthDot status={validationStatus ?? 'unknown'} size="sm" />
        <AIStaffTeamBadge agentDisplayName={item.agentDisplayName} agentRole={item.agentRole} />
        <div className="ai-feed-item-meta">
          <span className={`ai-staff-badge ${urgencyStyle.className}`}>{urgencyStyle.label}</span>
          <AIStaffConfidence confidence={item.confidence} />
          <span className="ai-staff-timestamp">{relativeTime(item.timestamp)}</span>
        </div>
      </div>

      {/* Content */}
      <div className="ai-feed-item-content">
        {item.content}
      </div>

      {/* Auto-applied label */}
      {item.isAutoApplied && (
        <div className="ai-feed-item-auto-applied">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Auto-applied</span>
        </div>
      )}

      {/* Action buttons (only if not auto-applied and actions exist) */}
      {!item.isAutoApplied && item.actions && item.actions.length > 0 && (
        <div className="ai-feed-item-actions">
          {item.actions.map((action) => {
            const style = ACTION_STYLES[action];
            return (
              <button
                key={action}
                className={`ai-feed-action ${style.className}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(item.id, action);
                }}
              >
                {style.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Team detail toggle */}
      {item.teamId && item.teamName && (
        <div className="ai-feed-item-team">
          <button
            className="ai-feed-item-team-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setTeamExpanded(!teamExpanded);
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              className={`chevron ${teamExpanded ? 'expanded' : ''}`}
            >
              <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="ai-staff-subtitle">Team</span>
          </button>
          {teamExpanded && (
            <AIStaffTeamDetail
              teamId={item.teamId}
              teamName={item.teamName}
              members={[]}
            />
          )}
        </div>
      )}
    </div>
  );
}
