/**
 * WorkspaceSwitcher
 *
 * Compact dropdown button in the nav bar for workspace navigation.
 * - Shows active workspace abbreviation as the trigger label
 * - Dropdown lists all workspaces with type icons, badges, notifications
 * - "+" button at bottom to create a new workspace
 * - Closes on outside click
 *
 * Styled with WorkspaceSwitcher.css (plain CSS, no Tailwind).
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { CreateWorkspaceWizard } from './CreateWorkspaceWizard';
import { NotificationBadge } from './NotificationBadge';
import './WorkspaceSwitcher.css';

// ─── Type label maps ─────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  Organization: 'O',
  Unit: 'U',
  Team: 'T',
};

const TYPE_ICON_CLASS: Record<string, string> = {
  Organization: 'org',
  Unit: 'unit',
  Team: 'team',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function WorkspaceSwitcher() {
  const { memberships, activeWorkspaceId, notificationCounts, primaryWorkspaceId, setActiveWorkspace, refreshMemberships } =
    useWorkspace();
  const navigate = useNavigate();
  const [showWizard, setShowWizard] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Sort: primary workspace first, then alphabetically
  const sorted = [...memberships].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return a.name.localeCompare(b.name);
  });

  const handleWorkspaceClick = (workspaceId: string) => {
    setActiveWorkspace(workspaceId);
    navigate(`/workspace/${workspaceId}`);
    setIsOpen(false);
  };

  const handleCreated = async (workspaceId: string) => {
    setShowWizard(false);
    await refreshMemberships();
    setActiveWorkspace(workspaceId);
    navigate(`/workspace/${workspaceId}`);
  };

  // Abbreviation: first letters of each word, max 2, uppercase
  const getAbbreviation = (name: string) =>
    (name || 'WS')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'WS';

  // Active workspace info for trigger label
  const activeWs = memberships.find((m) => m.workspaceId === activeWorkspaceId);
  const triggerAbbrev = activeWs ? getAbbreviation(activeWs.name) : 'WS';

  // Total unread notifications across all non-active workspaces
  const totalNotifs = sorted
    .filter((ws) => ws.workspaceId !== activeWorkspaceId)
    .reduce((sum, ws) => sum + (notificationCounts[ws.workspaceId] ?? 0), 0);

  return (
    <>
      <div className="ws-switcher" ref={containerRef} aria-label="Workspace switcher">
        <button
          className={`ws-switcher-trigger${isOpen ? ' open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          title={activeWs ? `${activeWs.name} (${activeWs.workspaceType})` : 'Workspaces'}
        >
          <span className="ws-trigger-abbrev">{triggerAbbrev}</span>
          {totalNotifs > 0 && <span className="ws-notif-dot" />}
          <span className="ws-trigger-caret">&#9660;</span>
        </button>

        {isOpen && (
          <div className="ws-switcher-dropdown" role="listbox">
            <div className="ws-dropdown-header">Workspaces</div>

            <div className="ws-list">
              {sorted.map((ws) => {
                const isActive = ws.workspaceId === activeWorkspaceId;
                const isPrimary = ws.workspaceId === primaryWorkspaceId;
                const notifCount = notificationCounts[ws.workspaceId] ?? 0;
                const abbreviation = getAbbreviation(ws.name);
                const iconClass = TYPE_ICON_CLASS[ws.workspaceType] ?? 'org';

                return (
                  <button
                    key={ws.workspaceId}
                    className={`ws-item${isActive ? ' active' : ''}`}
                    onClick={() => handleWorkspaceClick(ws.workspaceId)}
                    role="option"
                    aria-selected={isActive}
                    aria-label={`Switch to ${ws.name} (${ws.workspaceType})`}
                  >
                    {/* Workspace icon */}
                    <div className={`ws-item-icon ${iconClass}`}>
                      <span>{abbreviation}</span>
                      <span className="ws-item-type-badge">{TYPE_LABEL[ws.workspaceType] ?? '?'}</span>
                      {isPrimary && <span className="ws-item-primary-star">★</span>}
                    </div>

                    {/* Text content */}
                    <div className="ws-item-text">
                      <span className="ws-item-name">{ws.name}</span>
                      <span className="ws-item-meta">{ws.workspaceType} · {ws.role}</span>
                    </div>

                    {/* Active indicator */}
                    {isActive && <span className="ws-item-active-dot" />}

                    {/* Notification badge — hidden for active workspace */}
                    {!isActive && notifCount > 0 && (
                      <span className="ws-item-notif">{notifCount}</span>
                    )}

                    {/* NotificationBadge component (for pulse animation) */}
                    {!isActive && (
                      <NotificationBadge count={notifCount} />
                    )}
                  </button>
                );
              })}
            </div>

            {sorted.length > 0 && <hr className="ws-dropdown-divider" />}

            {/* Create new workspace */}
            <button
              className="ws-create-btn"
              onClick={() => { setShowWizard(true); setIsOpen(false); }}
              aria-label="Create new workspace"
            >
              <span className="ws-create-icon">+</span>
              <span>Create new workspace</span>
            </button>
          </div>
        )}
      </div>

      {/* Create workspace modal */}
      {showWizard && (
        <CreateWorkspaceWizard
          onClose={() => setShowWizard(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
