/**
 * ContainerCard Component
 *
 * Card for a single strategic container within the category-grouped view.
 * Shows container name, doc/agent counts, description, and category color accent.
 */

import type { StrategicContainer } from '../../lib/types/strategic.js';

interface ContainerCardProps {
  container: StrategicContainer;
  categoryColor: string;
  onClick: () => void;
  onRename?: (containerId: string) => void;
  onDelete?: (containerId: string) => void;
  onReassign?: (containerId: string) => void;
}

export function ContainerCard({
  container,
  categoryColor,
  onClick,
  onRename,
  onDelete,
  onReassign,
}: ContainerCardProps) {
  return (
    <div
      className="container-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onClick()}
      style={{ borderLeftColor: categoryColor }}
    >
      {/* Container header */}
      <div className="container-card-header">
        <h4 className="container-card-name">{container.name}</h4>
        {/* Context menu */}
        {(onRename || onDelete || onReassign) && (
          <div className="container-card-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="container-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                // Toggle menu - handled by CSS :focus-within
              }}
              title="Container actions"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
            <div className="container-action-menu">
              {onRename && (
                <button onClick={() => onRename(container.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Rename
                </button>
              )}
              {onReassign && (
                <button onClick={() => onReassign(container.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <polyline points="15,3 21,3 21,9" />
                    <path d="M21 3l-7 7" />
                    <path d="M3 21V9a2 2 0 0 1 2-2h6" />
                  </svg>
                  Move to...
                </button>
              )}
              {onDelete && (
                <button className="danger" onClick={() => onDelete(container.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <polyline points="3,6 5,6 21,6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Description snippet */}
      {container.description && (
        <p className="container-card-desc">{container.description}</p>
      )}

      {/* Counts */}
      <div className="container-card-counts">
        <span className="container-count-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
          </svg>
          {container.documentCount} doc{container.documentCount !== 1 ? 's' : ''}
        </span>
        {container.agentCount > 0 && (
          <span className="container-count-badge agent-count">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v10M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M1 12h6m6 0h10M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24" />
            </svg>
            {container.agentCount} agent{container.agentCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
