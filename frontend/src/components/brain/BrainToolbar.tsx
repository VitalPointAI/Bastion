/**
 * BrainToolbar — top toolbar for the brain visualization.
 *
 * Left: cluster mode segmented toggle (Container | DIME | Organic)
 * Center: BrainSearch component (text + filter dropdowns, or NL ask)
 * Right: AI Snapshot button, Gap indicator badge
 */

import type { BrainNode, ClusterMode } from './types.js';
import { BrainSearch } from './BrainSearch.js';
import './BrainToolbar.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BrainToolbarProps {
  nodes: BrainNode[];
  problemSetId?: string;
  clusterMode: ClusterMode;
  onClusterModeChange: (mode: ClusterMode) => void;
  onSearchResults: (matchingNodeIds: string[]) => void;
  onNodeFocus?: (nodeId: string) => void;
  onSnapshotClick?: () => void;
  gapCount?: number;
  onGapClick?: () => void;
}

// ─── Cluster mode options ─────────────────────────────────────────────────────

const CLUSTER_OPTIONS: Array<{ value: ClusterMode; label: string }> = [
  { value: 'container', label: 'Container' },
  { value: 'dime', label: 'DIME' },
  { value: 'organic', label: 'Organic' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function BrainToolbar({
  nodes,
  problemSetId,
  clusterMode,
  onClusterModeChange,
  onSearchResults,
  onNodeFocus,
  onSnapshotClick,
  gapCount,
  onGapClick,
}: BrainToolbarProps) {
  return (
    <div className="brain-toolbar">
      {/* Left: cluster mode toggle */}
      <div className="cluster-toggle" role="group" aria-label="Cluster mode">
        {CLUSTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`cluster-toggle-btn${clusterMode === opt.value ? ' active' : ''}`}
            onClick={() => onClusterModeChange(opt.value)}
            aria-pressed={clusterMode === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Center: search */}
      <BrainSearch
        nodes={nodes}
        problemSetId={problemSetId}
        onSearchResults={onSearchResults}
        onNodeFocus={onNodeFocus}
      />

      {/* Right: action buttons */}
      <div className="brain-toolbar-actions">
        {/* AI Snapshot button */}
        <button
          type="button"
          className="brain-toolbar-btn"
          onClick={onSnapshotClick}
          title="Save AI context snapshot"
        >
          {/* Camera icon (unicode) */}
          <span className="brain-toolbar-btn-icon">&#x1F4F7;</span>
          <span className="brain-toolbar-btn-label">AI Snapshot</span>
        </button>

        {/* Gap indicator */}
        {gapCount != null && gapCount > 0 && (
          <div className="brain-toolbar-gap-wrapper" title={`${gapCount} intelligence gap${gapCount !== 1 ? 's' : ''} detected`}>
            <button
              type="button"
              className="brain-toolbar-btn brain-toolbar-gap-btn"
              onClick={onGapClick}
            >
              {/* Brain icon (unicode) */}
              <span className="brain-toolbar-btn-icon">&#x1F9E0;</span>
            </button>
            <span className="gap-badge">{gapCount > 99 ? '99+' : gapCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}
