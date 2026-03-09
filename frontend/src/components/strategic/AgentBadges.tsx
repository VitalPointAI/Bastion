/**
 * AgentBadges Component
 *
 * Displays agent/team assignment badges on document cards.
 * Shows assigned agents with status indicators.
 */

import type { ReactElement } from 'react';
import type { DocumentAgentAssignment } from '../../lib/types/strategic.js';
import './AgentBadges.css';

interface AgentBadgesProps {
  assignments: DocumentAgentAssignment[];
  compact?: boolean;
}

/**
 * Get status color class for assignment.
 */
function getStatusClass(status: string): string {
  switch (status) {
    case 'active':
      return 'status-active';
    case 'completed':
      return 'status-completed';
    case 'paused':
      return 'status-paused';
    default:
      return 'status-assigned';
  }
}

/**
 * Get icon for assignment type.
 */
function getTypeIcon(type: string): ReactElement {
  switch (type) {
    case 'review':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="2" />
          <path d="M9 14l2 2 4-4" />
        </svg>
      );
    case 'monitor':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
    case 'analyze':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
  }
}

export function AgentBadges({ assignments, compact = false }: AgentBadgesProps) {
  if (!assignments || assignments.length === 0) {
    return null;
  }

  if (compact) {
    // Show just a count badge for compact view
    const activeCount = assignments.filter(a => a.status === 'active').length;
    const totalCount = assignments.length;

    return (
      <div className="agent-badges compact">
        <span className="agent-count-badge" title={`${totalCount} agent${totalCount !== 1 ? 's' : ''} assigned`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 6v10M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M1 12h6m6 0h10M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24" />
          </svg>
          <span className="count">{totalCount}</span>
          {activeCount > 0 && <span className="active-indicator" />}
        </span>
      </div>
    );
  }

  return (
    <div className="agent-badges">
      {assignments.slice(0, 3).map((assignment, idx) => (
        <div
          key={assignment.id || `assignment-${idx}`}
          className={`agent-badge ${getStatusClass(assignment.status)}`}
          title={`${assignment.agentDisplayName || assignment.agentId || 'Agent'} (${assignment.assignmentType || 'review'})`}
        >
          <span className="badge-icon">
            {getTypeIcon(assignment.assignmentType)}
          </span>
          <span className="badge-name">
            {assignment.agentDisplayName || (assignment.agentId ? assignment.agentId.substring(0, 12) : 'Agent')}
          </span>
          {assignment.teamName && (
            <span className="badge-team" title={`Team: ${assignment.teamName}`}>
              T
            </span>
          )}
        </div>
      ))}
      {assignments.length > 3 && (
        <span className="more-agents">+{assignments.length - 3}</span>
      )}
    </div>
  );
}
