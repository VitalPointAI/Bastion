/**
 * WorkspaceSwitcher
 *
 * Sidebar component for workspace navigation using the Slack/Discord pattern.
 * - Shows all workspaces user belongs to as icon tiles
 * - Active workspace has highlighted border
 * - Notification badges with count
 * - Primary workspace indicator
 * - Tooltip on hover with full name and type
 * - "+" button to create new workspace
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { CreateWorkspaceWizard } from './CreateWorkspaceWizard';

// ─── Type label maps ─────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  Organization: 'O',
  Unit: 'U',
  Team: 'T',
};

const TYPE_COLOR: Record<string, string> = {
  Organization: 'bg-blue-700',
  Unit: 'bg-purple-700',
  Team: 'bg-green-700',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function WorkspaceSwitcher() {
  const { memberships, activeWorkspaceId, notificationCounts, primaryWorkspaceId, setActiveWorkspace, refreshMemberships } =
    useWorkspace();
  const navigate = useNavigate();
  const [showWizard, setShowWizard] = useState(false);
  const [tooltip, setTooltip] = useState<string | null>(null);

  // Sort: primary workspace first, then alphabetically
  const sorted = [...memberships].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return a.name.localeCompare(b.name);
  });

  const handleWorkspaceClick = (workspaceId: string) => {
    setActiveWorkspace(workspaceId);
    navigate(`/workspace/${workspaceId}`);
  };

  const handleCreated = async (workspaceId: string) => {
    setShowWizard(false);
    await refreshMemberships();
    setActiveWorkspace(workspaceId);
    navigate(`/workspace/${workspaceId}`);
  };

  // Abbreviation: first 2 characters of workspace name, uppercase
  const getAbbreviation = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || name.slice(0, 2).toUpperCase();

  return (
    <>
      <aside
        className="flex flex-col items-center gap-2 py-3 px-1 bg-gray-900 border-r border-gray-700"
        style={{ width: '64px', minHeight: '100vh', flexShrink: 0 }}
        aria-label="Workspace switcher"
      >
        {sorted.map((ws) => {
          const isActive = ws.workspaceId === activeWorkspaceId;
          const isPrimary = ws.workspaceId === primaryWorkspaceId;
          const notifCount = notificationCounts[ws.workspaceId] ?? 0;
          const typeColor = TYPE_COLOR[ws.workspaceType] ?? 'bg-gray-700';
          const abbreviation = getAbbreviation(ws.name);

          return (
            <div key={ws.workspaceId} className="relative flex items-center" style={{ width: '48px' }}>
              {/* Active indicator bar on left */}
              {isActive && (
                <div
                  className="absolute bg-white rounded-r"
                  style={{ left: '-4px', width: '4px', height: '32px' }}
                />
              )}

              {/* Workspace icon */}
              <button
                onClick={() => handleWorkspaceClick(ws.workspaceId)}
                onMouseEnter={() => setTooltip(ws.workspaceId)}
                onMouseLeave={() => setTooltip(null)}
                title={`${ws.name} (${ws.workspaceType})`}
                className={[
                  'relative flex items-center justify-center w-12 h-12 rounded-xl text-white text-sm font-bold transition-all duration-150',
                  typeColor,
                  isActive
                    ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900'
                    : 'hover:rounded-lg opacity-80 hover:opacity-100',
                ].join(' ')}
                style={{ cursor: 'pointer', border: 'none', outline: 'none' }}
                aria-label={`Switch to ${ws.name}`}
                aria-pressed={isActive}
              >
                {/* Type label (O/U/T) */}
                <span className="text-xs font-bold">{abbreviation}</span>

                {/* Workspace type badge */}
                <span
                  className="absolute bottom-0 right-0 text-xs leading-none bg-black bg-opacity-60 rounded text-white"
                  style={{ fontSize: '8px', padding: '1px 2px' }}
                >
                  {TYPE_LABEL[ws.workspaceType] ?? '?'}
                </span>

                {/* Primary star indicator */}
                {isPrimary && (
                  <span
                    className="absolute top-0 right-0 text-yellow-400"
                    style={{ fontSize: '8px', lineHeight: 1, marginTop: '1px', marginRight: '1px' }}
                    title="Primary workspace"
                  >
                    ★
                  </span>
                )}

                {/* Notification badge */}
                {notifCount > 0 && (
                  <span
                    className="absolute flex items-center justify-center bg-red-500 text-white rounded-full font-bold"
                    style={{
                      top: '-4px',
                      left: '-4px',
                      minWidth: '16px',
                      height: '16px',
                      fontSize: '9px',
                      padding: '0 2px',
                    }}
                  >
                    {notifCount > 99 ? '99+' : notifCount}
                  </span>
                )}
              </button>

              {/* Tooltip */}
              {tooltip === ws.workspaceId && (
                <div
                  className="absolute z-50 left-14 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg pointer-events-none"
                  role="tooltip"
                >
                  <div className="font-semibold">{ws.name}</div>
                  <div className="text-gray-400">{ws.workspaceType} · {ws.role}</div>
                </div>
              )}
            </div>
          );
        })}

        {/* Divider */}
        {sorted.length > 0 && (
          <div className="w-8 border-t border-gray-600 my-1" />
        )}

        {/* Create workspace button */}
        <button
          onClick={() => setShowWizard(true)}
          onMouseEnter={() => setTooltip('__create__')}
          onMouseLeave={() => setTooltip(null)}
          className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gray-700 hover:bg-green-600 text-white text-2xl font-light transition-all duration-150"
          style={{ cursor: 'pointer', border: 'none', outline: 'none' }}
          aria-label="Create new workspace"
          title="Create new workspace"
        >
          +
          {tooltip === '__create__' && (
            <div
              className="absolute z-50 left-14 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg pointer-events-none"
              role="tooltip"
            >
              Create new workspace
            </div>
          )}
        </button>
      </aside>

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
