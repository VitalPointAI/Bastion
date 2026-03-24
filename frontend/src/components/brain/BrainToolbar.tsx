/**
 * BrainToolbar — top toolbar for the brain visualization.
 *
 * Left: LensSelector dropdown (Overview / J2 Intel / J3 Ops / J5 Plans / custom)
 * Center: BrainSearch component (text + filter dropdowns, or NL ask)
 * Right: AI Snapshot button, Gap indicator badge
 *
 * Phase 45: Cluster toggle buttons removed; replaced by LensSelector.
 * The active lens drives cluster mode via BrainController → useBrainClustering.
 */

import type { BrainNode, BrainLens } from './types.js';
import { BrainSearch } from './BrainSearch.js';
import { LensSelector } from './LensSelector.js';
import './BrainToolbar.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BrainToolbarProps {
  nodes: BrainNode[];
  problemSetId?: string;
  /** Active lens (replaces clusterMode prop) */
  activeLens: BrainLens;
  /** All available lenses */
  allLenses: BrainLens[];
  /** Called when the user selects a different lens */
  onLensChange: (lensId: string) => void;
  /** Called to save a new custom lens (optional) */
  onSaveLens?: () => void;
  /** Called to delete a custom lens (optional) */
  onDeleteLens?: (id: string) => void;
  /** Called to clone a lens (optional) */
  onCloneLens?: (id: string) => void;
  onSearchResults: (matchingNodeIds: string[]) => void;
  onNodeFocus?: (nodeId: string) => void;
  onSnapshotClick?: () => void;
  onStrategicEnvClick?: () => void;
  gapCount?: number;
  onGapClick?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BrainToolbar({
  nodes,
  problemSetId,
  activeLens,
  allLenses,
  onLensChange,
  onSaveLens,
  onDeleteLens,
  onCloneLens,
  onSearchResults,
  onNodeFocus,
  onSnapshotClick,
  onStrategicEnvClick,
  gapCount,
  onGapClick,
}: BrainToolbarProps) {
  return (
    <div className="brain-toolbar">
      {/* Left: lens selector (Phase 45 — replaces cluster toggle buttons) */}
      <LensSelector
        activeLens={activeLens}
        allLenses={allLenses}
        onLensChange={onLensChange}
        onSaveLens={onSaveLens}
        onDeleteLens={onDeleteLens}
        onCloneLens={onCloneLens}
      />

      {/* Center: search */}
      <BrainSearch
        nodes={nodes}
        problemSetId={problemSetId}
        onSearchResults={onSearchResults}
        onNodeFocus={onNodeFocus}
      />

      {/* Right: action buttons */}
      <div className="brain-toolbar-actions">
        {/* Strategic Environment Assessment */}
        <button
          type="button"
          className="brain-toolbar-btn"
          onClick={onStrategicEnvClick}
          title="Synthesize strategic environment assessment from problem set knowledge"
        >
          <span className="brain-toolbar-btn-icon">&#x1F30D;</span>
          <span className="brain-toolbar-btn-label">STRATENV</span>
        </button>

        {/* AI Snapshot button */}
        <button
          type="button"
          className="brain-toolbar-btn"
          onClick={onSnapshotClick}
          title="Save AI context snapshot of current view"
        >
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
