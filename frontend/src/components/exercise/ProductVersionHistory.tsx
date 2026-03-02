/**
 * ProductVersionHistory
 *
 * Phase 16 Plan 05: Purely presentational version chain viewer.
 *
 * Renders the full draft iteration history for a staff product.
 * The versions array is fetched by the PARENT (ProductReviewPanel) via
 * exerciseService.getProductVersionHistory() — this component does NOT fetch.
 *
 * Used as a collapsible section inside ProductReviewPanel.
 */

import './ProductVersionHistory.css';

interface VersionEntry {
  id: string;
  version: number;
  createdBy: string;
  revisionNotes?: string;
  createdAt: string;
}

interface ProductVersionHistoryProps {
  versions: VersionEntry[];
  currentVersion: number;
  onVersionSelect?: (version: number) => void;
}

export function ProductVersionHistory({
  versions,
  currentVersion,
  onVersionSelect,
}: ProductVersionHistoryProps) {
  if (versions.length === 0) {
    return (
      <div className="pvh-empty">No previous versions</div>
    );
  }

  // Sort by version descending (newest first)
  const sorted = [...versions].sort((a, b) => b.version - a.version);

  return (
    <div className="product-version-history">
      <div className="pvh-timeline">
        {sorted.map((v, idx) => {
          const isCurrent = v.version === currentVersion;
          const isLast = idx === sorted.length - 1;
          const timestamp = new Date(v.createdAt).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={v.id}
              className={`pvh-entry${isCurrent ? ' pvh-current' : ''}${isLast ? ' pvh-last' : ''}`}
            >
              {/* Timeline dot + connector */}
              <div className="pvh-dot-col">
                <div className={`pvh-dot${isCurrent ? ' pvh-dot-current' : ''}`} />
                {!isLast && <div className="pvh-connector" />}
              </div>

              {/* Version content */}
              <div className="pvh-content">
                <div className="pvh-row">
                  <span className={`pvh-version-badge${isCurrent ? ' pvh-version-current' : ''}`}>
                    v{v.version}
                  </span>
                  {isCurrent && (
                    <span className="pvh-current-label">current</span>
                  )}
                  <span className="pvh-created-by">{v.createdBy}</span>
                  <span className="pvh-timestamp">{timestamp}</span>

                  {onVersionSelect && (
                    <button
                      className="pvh-view-btn"
                      onClick={() => onVersionSelect(v.version)}
                      aria-label={`View version ${v.version}`}
                    >
                      View
                    </button>
                  )}
                </div>

                {v.revisionNotes && (
                  <div className="pvh-notes">{v.revisionNotes}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
