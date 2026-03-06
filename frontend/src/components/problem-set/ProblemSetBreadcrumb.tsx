/**
 * Problem SetBreadcrumb
 *
 * Compact header identity component. Renders the active problem set name,
 * type badge, and classification badge inline with the app header.
 *
 * Only visible when:
 * - activeProblemSet is non-null
 * - current path starts with /problem-set/
 *
 * Phase 20 Plan 01: Problem Set-first routing foundation.
 */

import { useLocation } from 'react-router-dom';
import { useProblemSet } from '../../context/ProblemSetContext';

// ─── Badge helpers ────────────────────────────────────────────────────────────

function classificationColor(level: string): string {
  switch (level?.toUpperCase()) {
    case 'TOPSECRET': return 'bg-red-900 text-red-200 border-red-700';
    case 'SECRET': return 'bg-yellow-900 text-yellow-200 border-yellow-700';
    default: return 'bg-green-900 text-green-200 border-green-700';
  }
}

function echelonColor(type: string): string {
  switch (type) {
    case 'Organization': return 'text-blue-400';
    case 'Unit': return 'text-purple-400';
    case 'Team': return 'text-teal-400';
    default: return 'text-gray-400';
  }
}

// ─── Problem SetBreadcrumb ──────────────────────────────────────────────────────

export function ProblemSetBreadcrumb() {
  const location = useLocation();
  const { activeProblemSet } = useProblemSet();

  // Only render on problem set routes with an active problem set
  if (!activeProblemSet || !location.pathname.startsWith('/problem-set/')) {
    return null;
  }

  const displayName =
    activeProblemSet.name.length > 20
      ? `${activeProblemSet.name.slice(0, 18)}…`
      : activeProblemSet.name;

  return (
    <div className="flex items-center gap-2 text-sm">
      {/* Type indicator dot */}
      <span
        className={`text-xs font-medium ${echelonColor(activeProblemSet.echelon)}`}
        title={activeProblemSet.echelon}
      >
        {activeProblemSet.echelon.slice(0, 3).toUpperCase()}
      </span>

      {/* Separator */}
      <span className="text-gray-600">/</span>

      {/* Problem Set name */}
      <span className="text-gray-200 font-medium" title={activeProblemSet.name}>
        {displayName}
      </span>

      {/* Classification badge */}
      <span
        className={`text-xs font-mono px-1.5 py-0.5 rounded border ${classificationColor(activeProblemSet.classification)}`}
      >
        {activeProblemSet.classification}
      </span>
    </div>
  );
}
