/**
 * OrgTreeSidebar
 *
 * Fixed-position slide-out sidebar that wraps the OrgTree component.
 * Renders as an overlay from the right side of the viewport with a
 * semi-transparent backdrop.
 *
 * Phase 20 Plan 02: WorkspaceTabContainer + OrgTreeSidebar
 */

import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { OrgTree } from './OrgTree';

// ─── Props ────────────────────────────────────────────────────────────────────

interface OrgTreeSidebarProps {
  onClose: () => void;
}

// ─── OrgTreeSidebar ───────────────────────────────────────────────────────────

export function OrgTreeSidebar({ onClose }: OrgTreeSidebarProps) {
  const navigate = useNavigate();
  const { activeWorkspaceId, activeWorkspace, setActiveWorkspace } = useWorkspace();

  // Derive root workspace ID — if no parent, current workspace IS the root
  const rootWorkspaceId: string | null = activeWorkspace
    ? activeWorkspace.parentWorkspaceId === null
      ? activeWorkspace.id
      : activeWorkspaceId
    : activeWorkspaceId;

  function handleNavigate(workspaceId: string) {
    setActiveWorkspace(workspaceId);
    navigate(`/workspace/${workspaceId}`);
    onClose();
  }

  return (
    <>
      {/* Semi-transparent backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out panel */}
      <div className="fixed inset-y-0 right-0 w-80 bg-gray-800 border-l border-gray-700 z-50 shadow-xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
          <h2 className="text-sm font-semibold text-gray-200">Organization</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            aria-label="Close organization sidebar"
          >
            {/* X icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body: OrgTree */}
        <div className="flex-1 overflow-auto p-2">
          {rootWorkspaceId ? (
            <OrgTree
              rootWorkspaceId={rootWorkspaceId}
              currentUserWorkspaceId={activeWorkspaceId ?? undefined}
              onNavigate={handleNavigate}
            />
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-gray-500">
              No workspace selected.
            </div>
          )}
        </div>

      </div>
    </>
  );
}

export default OrgTreeSidebar;
