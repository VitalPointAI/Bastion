import type { ReactNode } from 'react';
import './BrainLayout.css';

interface BrainLayoutProps {
  /** Compact left sidebar — unified ingestion feed */
  leftSidebar: ReactNode;
  /** Main content area — force-graph canvas */
  center: ReactNode;
  /** Optional detail panel content — slides in from the right */
  rightPanel?: ReactNode;
  /** Controls whether the right panel is visible */
  rightPanelOpen: boolean;
  /** Optional timeline scrubber rendered below all columns */
  timeline?: ReactNode;
  /** Optional top bar rendered above all columns (search, cluster toggle, etc.) */
  topBar?: ReactNode;
  /** Additional CSS class names for the root element */
  className?: string;
}

/**
 * BrainLayout — three-column CSS Grid shell for the adaptive brain visualization.
 *
 * Grid anatomy:
 *   Row 1 (auto):   top bar — search, cluster mode toggle, snapshot button
 *   Row 2 (1fr):    left sidebar | center brain canvas | right detail panel
 *   Row 3 (auto):   timeline scrubber (full width)
 *
 * The right panel is 0-width when closed and expands to 380px via CSS transition.
 * The top bar and timeline rows are only injected into the DOM when the
 * corresponding props are provided, avoiding empty layout rows.
 */
export function BrainLayout({
  leftSidebar,
  center,
  rightPanel,
  rightPanelOpen,
  timeline,
  topBar,
  className,
}: BrainLayoutProps) {
  return (
    <div className={`brain-layout${className ? ` ${className}` : ''}`}>
      {topBar !== undefined && (
        <div className="brain-top-bar">{topBar}</div>
      )}

      <div className="brain-left-sidebar">{leftSidebar}</div>

      <div className="brain-center">{center}</div>

      <div className={`brain-right-panel${rightPanelOpen ? ' open' : ''}`}>
        {rightPanel}
      </div>

      {timeline !== undefined && (
        <div className="brain-timeline">{timeline}</div>
      )}
    </div>
  );
}
