/**
 * WorkspaceBreadcrumb
 *
 * Compact header identity component. Renders the active workspace name,
 * type badge, and classification badge inline with the app header.
 *
 * Only visible when:
 * - activeWorkspace is non-null
 * - current path starts with /workspace/
 *
 * Phase 20 Plan 01: Workspace-first routing foundation.
 */

import { useLocation } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';

// ─── Badge helpers ────────────────────────────────────────────────────────────

function classificationColor(level: string): string {
  switch (level?.toUpperCase()) {
    case 'TOPSECRET': return 'bg-red-900 text-red-200 border-red-700';
    case 'SECRET': return 'bg-yellow-900 text-yellow-200 border-yellow-700';
    default: return 'bg-green-900 text-green-200 border-green-700';
  }
}

function workspaceTypeColor(type: string): string {
  switch (type) {
    case 'Organization': return 'text-blue-400';
    case 'Unit': return 'text-purple-400';
    case 'Team': return 'text-teal-400';
    default: return 'text-gray-400';
  }
}

// ─── WorkspaceBreadcrumb ──────────────────────────────────────────────────────

export function WorkspaceBreadcrumb() {
  const location = useLocation();
  const { activeWorkspace } = useWorkspace();

  // Only render on workspace routes with an active workspace
  if (!activeWorkspace || !location.pathname.startsWith('/workspace/')) {
    return null;
  }

  const displayName =
    activeWorkspace.name.length > 20
      ? `${activeWorkspace.name.slice(0, 18)}…`
      : activeWorkspace.name;

  return (
    <div className="flex items-center gap-2 text-sm">
      {/* Type indicator dot */}
      <span
        className={`text-xs font-medium ${workspaceTypeColor(activeWorkspace.workspaceType)}`}
        title={activeWorkspace.workspaceType}
      >
        {activeWorkspace.workspaceType.slice(0, 3).toUpperCase()}
      </span>

      {/* Separator */}
      <span className="text-gray-600">/</span>

      {/* Workspace name */}
      <span className="text-gray-200 font-medium" title={activeWorkspace.name}>
        {displayName}
      </span>

      {/* Classification badge */}
      <span
        className={`text-xs font-mono px-1.5 py-0.5 rounded border ${classificationColor(activeWorkspace.classification)}`}
      >
        {activeWorkspace.classification}
      </span>
    </div>
  );
}
