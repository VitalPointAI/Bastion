import React from 'react';
import { BreadcrumbEntry } from './types';
import './BrainBreadcrumb.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface BrainBreadcrumbProps {
  /** Current breadcrumb trail from useBrainDrillDown */
  breadcrumbs: BreadcrumbEntry[];
  /**
   * Called when the user clicks a breadcrumb entry.
   * Receives the index in the breadcrumbs array — passed to drillUp(index).
   */
  onNavigate: (index: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BrainBreadcrumb({
  breadcrumbs,
  onNavigate,
}: BrainBreadcrumbProps): React.ReactElement | null {
  if (breadcrumbs.length === 0) return null;

  return (
    <nav className="brain-breadcrumb" aria-label="Brain drill-down navigation">
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;

        return (
          <React.Fragment key={`${crumb.level}-${crumb.id}-${index}`}>
            {index > 0 && (
              <span className="brain-breadcrumb__chevron" aria-hidden="true">
                &gt;
              </span>
            )}

            {isLast ? (
              // Current level — rendered as plain text, not clickable
              <span
                className="brain-breadcrumb__entry brain-breadcrumb__entry--current"
                aria-current="page"
              >
                <span className="brain-breadcrumb__icon" aria-hidden="true">
                  {crumb.icon}
                </span>
                <span className="brain-breadcrumb__label">{crumb.label}</span>
                <span className="brain-breadcrumb__count">({crumb.count})</span>
              </span>
            ) : (
              // Ancestor level — rendered as clickable button
              <button
                className="brain-breadcrumb__entry brain-breadcrumb__entry--link"
                onClick={() => onNavigate(index)}
                type="button"
                title={`Navigate back to ${crumb.label}`}
              >
                <span className="brain-breadcrumb__icon" aria-hidden="true">
                  {crumb.icon}
                </span>
                <span className="brain-breadcrumb__label">{crumb.label}</span>
                <span className="brain-breadcrumb__count">({crumb.count})</span>
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default BrainBreadcrumb;
