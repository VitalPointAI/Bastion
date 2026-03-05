/**
 * COPConflictBanner Component
 *
 * Dismissible alert banner displayed above the map when cross-section
 * conflicts exist. Shows conflict count, expandable conflict list with
 * type badges, descriptions, and source authority ranking.
 */

import { useState } from 'react';
import type { COPConflict } from '../../types/cop.js';

interface COPConflictBannerProps {
  conflicts: COPConflict[];
  onConflictClick: (conflict: COPConflict) => void;
}

/** Source authority ranking (higher index = more authoritative) */
const SOURCE_AUTHORITY_RANK: Record<string, number> = {
  SIGINT: 4,
  HUMINT: 3,
  IMINT: 2,
  OSINT: 1,
};

/** Conflict type visual configuration */
const CONFLICT_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; priority: number }
> = {
  affiliation: {
    label: 'AFFILIATION',
    color: '#f87171',
    bgColor: 'rgba(239, 68, 68, 0.2)',
    priority: 1,
  },
  position: {
    label: 'POSITION',
    color: '#fb923c',
    bgColor: 'rgba(251, 146, 60, 0.2)',
    priority: 2,
  },
  designation: {
    label: 'DESIGNATION',
    color: '#facc15',
    bgColor: 'rgba(250, 204, 21, 0.2)',
    priority: 3,
  },
};

function getAuthorityLabel(authority: string): string {
  const rank = SOURCE_AUTHORITY_RANK[authority.toUpperCase()];
  if (rank === undefined) return authority;
  return authority.toUpperCase();
}

function getAuthorityRank(authority: string): number {
  return SOURCE_AUTHORITY_RANK[authority.toUpperCase()] ?? 0;
}

/**
 * Determines which entity has the more authoritative source.
 * Returns 'A' or 'B' or 'equal'.
 */
function compareAuthority(
  authorityA: string,
  authorityB: string
): 'A' | 'B' | 'equal' {
  const rankA = getAuthorityRank(authorityA);
  const rankB = getAuthorityRank(authorityB);
  if (rankA > rankB) return 'A';
  if (rankB > rankA) return 'B';
  return 'equal';
}

export function COPConflictBanner({
  conflicts,
  onConflictClick,
}: COPConflictBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (conflicts.length === 0 || dismissed) return null;

  // Sort by priority: affiliation first (most dangerous), then position, then designation
  const sorted = [...conflicts].sort((a, b) => {
    const pa = CONFLICT_TYPE_CONFIG[a.conflictType]?.priority ?? 99;
    const pb = CONFLICT_TYPE_CONFIG[b.conflictType]?.priority ?? 99;
    return pa - pb;
  });

  // Count unresolved
  const unresolved = conflicts.filter((c) => !c.resolved).length;

  // Determine banner severity color based on worst conflict type
  const worstType = sorted[0]?.conflictType ?? 'designation';
  const bannerConfig = CONFLICT_TYPE_CONFIG[worstType] ?? CONFLICT_TYPE_CONFIG.designation;

  return (
    <div
      className="cop-conflict-banner"
      style={{ borderColor: bannerConfig.color }}
    >
      {/* Summary Bar */}
      <div className="conflict-banner-header">
        <div className="conflict-banner-summary">
          <span
            className="conflict-banner-icon"
            style={{ color: bannerConfig.color }}
          >
            !
          </span>
          <span className="conflict-banner-count">
            {unresolved} conflict{unresolved !== 1 ? 's' : ''} detected across
            sections
          </span>
        </div>
        <div className="conflict-banner-controls">
          <button
            className="conflict-expand-btn"
            onClick={() => setExpanded(!expanded)}
            type="button"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          <button
            className="conflict-dismiss-btn"
            onClick={() => setDismissed(true)}
            type="button"
            aria-label="Dismiss"
          >
            X
          </button>
        </div>
      </div>

      {/* Expanded Conflict List */}
      {expanded && (
        <div className="conflict-banner-list">
          {sorted.map((conflict) => {
            const typeConfig =
              CONFLICT_TYPE_CONFIG[conflict.conflictType] ??
              CONFLICT_TYPE_CONFIG.designation;

            // Extract source authorities from description if available
            // The description format may include authority info
            const authorityComparison = compareAuthority(
              extractAuthority(conflict, 'A'),
              extractAuthority(conflict, 'B')
            );

            return (
              <div
                key={conflict.id}
                className={`conflict-item ${conflict.resolved ? 'resolved' : ''}`}
              >
                <div className="conflict-item-header">
                  <span
                    className="conflict-type-badge"
                    style={{
                      color: typeConfig.color,
                      backgroundColor: typeConfig.bgColor,
                    }}
                  >
                    {typeConfig.label}
                  </span>
                  {conflict.resolved && (
                    <span className="conflict-resolved-badge">RESOLVED</span>
                  )}
                </div>

                <p className="conflict-description">{conflict.description}</p>

                {/* Source Authority Ranking */}
                <div className="conflict-authority">
                  <span className="conflict-authority-label">
                    Source Authority:
                  </span>
                  <span
                    className={`conflict-authority-source ${authorityComparison === 'A' ? 'preferred' : ''}`}
                  >
                    {getAuthorityLabel(extractAuthority(conflict, 'A'))}
                  </span>
                  <span className="conflict-authority-vs">vs</span>
                  <span
                    className={`conflict-authority-source ${authorityComparison === 'B' ? 'preferred' : ''}`}
                  >
                    {getAuthorityLabel(extractAuthority(conflict, 'B'))}
                  </span>
                </div>

                {/* Resolve Button */}
                {!conflict.resolved && (
                  <button
                    className="conflict-resolve-btn"
                    onClick={() => onConflictClick(conflict)}
                    type="button"
                  >
                    Resolve
                  </button>
                )}
              </div>
            );
          })}

          {/* Authority Ranking Legend */}
          <div className="conflict-authority-legend">
            <span className="conflict-legend-label">Authority Ranking:</span>
            <span className="conflict-legend-items">
              SIGINT &gt; HUMINT &gt; IMINT &gt; OSINT
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Extract source authority from conflict metadata.
 * Since COPConflict doesn't carry authority directly, we use entity IDs
 * as proxies and return placeholder strings. In production, this would
 * resolve entity IDs to their source authority via the layer spec.
 */
function extractAuthority(conflict: COPConflict, side: 'A' | 'B'): string {
  // Parse authority from description if it follows pattern "... (SIGINT vs HUMINT)"
  const match = conflict.description.match(
    /\((\w+)\s+vs\s+(\w+)\)/i
  );
  if (match) {
    return side === 'A' ? match[1] : match[2];
  }
  // Fallback: use entity ID prefix convention or generic label
  const entityId = side === 'A' ? conflict.entityIdA : conflict.entityIdB;
  if (entityId.startsWith('sig-')) return 'SIGINT';
  if (entityId.startsWith('hum-')) return 'HUMINT';
  if (entityId.startsWith('img-')) return 'IMINT';
  if (entityId.startsWith('os-')) return 'OSINT';
  return `Source ${side}`;
}
