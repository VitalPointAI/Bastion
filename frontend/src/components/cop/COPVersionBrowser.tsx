/**
 * COPVersionBrowser
 *
 * Phase 21 Plan 10: Historical snapshot browser for post-operation analysis.
 * Fetches version list for a layer, displays timeline with state transitions,
 * date/state filtering, and loads historical specs onto the map.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { COPLayerSpec, LayerSnapshot, LayerState } from '../../types/cop.js';
import { copService } from '../../lib/cop-service.js';
import './COPVersionBrowser.css';

// ─── Props ──────────────────────────────────────────────────────────────────

interface COPVersionBrowserProps {
  /** Layer ID to browse versions for */
  layerId: string;
  /** Current live version number */
  currentVersion: number;
  /** Called when user selects a historical version to display */
  onVersionSelect: (spec: COPLayerSpec) => void;
  /** Called when user clicks "Return to Current" */
  onReturnToCurrent?: () => void;
  /** Called when panel is closed */
  onClose?: () => void;
}

// ─── State Filter Options ───────────────────────────────────────────────────

const ALL_STATES: LayerState[] = ['draft', 'review', 'published', 'cop'];

// ─── Component ──────────────────────────────────────────────────────────────

export function COPVersionBrowser({
  layerId,
  currentVersion,
  onVersionSelect,
  onReturnToCurrent,
  onClose,
}: COPVersionBrowserProps) {
  const [versions, setVersions] = useState<LayerSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stateFilters, setStateFilters] = useState<Set<LayerState>>(
    new Set(ALL_STATES)
  );

  // ─── Fetch Versions ───────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function fetchVersions() {
      setLoading(true);
      try {
        const result = await copService.listVersions(layerId);
        if (!cancelled) {
          // Sort newest first
          setVersions(result.sort((a, b) => b.version - a.version));
        }
      } catch (err) {
        console.error('[COPVersionBrowser] Failed to fetch versions:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchVersions();
    return () => { cancelled = true; };
  }, [layerId]);

  // ─── Filter Logic ─────────────────────────────────────────────────────

  const filteredVersions = useMemo(() => {
    return versions.filter((v) => {
      // State filter
      if (!stateFilters.has(v.state)) return false;

      // Date filters
      if (startDate) {
        const vDate = new Date(v.transitionedAt).toISOString().split('T')[0];
        if (vDate < startDate) return false;
      }
      if (endDate) {
        const vDate = new Date(v.transitionedAt).toISOString().split('T')[0];
        if (vDate > endDate) return false;
      }

      return true;
    });
  }, [versions, stateFilters, startDate, endDate]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const toggleStateFilter = (state: LayerState) => {
    setStateFilters((prev) => {
      const next = new Set(prev);
      if (next.has(state)) {
        next.delete(state);
      } else {
        next.add(state);
      }
      return next;
    });
  };

  const handleVersionClick = useCallback(
    async (version: LayerSnapshot) => {
      setSelectedVersion(version.version);
      try {
        const spec = await copService.getVersionSpec(layerId, version.version);
        onVersionSelect(spec);
      } catch (err) {
        console.error('[COPVersionBrowser] Failed to load version spec:', err);
      }
    },
    [layerId, onVersionSelect]
  );

  const handleReturnToCurrent = () => {
    setSelectedVersion(null);
    onReturnToCurrent?.();
  };

  // ─── Diff Computation ─────────────────────────────────────────────────

  /** Compute brief diff between consecutive versions */
  function computeDiff(
    current: LayerSnapshot,
    idx: number
  ): { added: number; removed: number } | null {
    // Find the next (older) version in the list
    const older = filteredVersions[idx + 1];
    if (!older || !current.spec || !older.spec) return null;

    const currentSymbols = current.spec.symbols?.length ?? 0;
    const olderSymbols = older.spec.symbols?.length ?? 0;

    const added = Math.max(0, currentSymbols - olderSymbols);
    const removed = Math.max(0, olderSymbols - currentSymbols);

    if (added === 0 && removed === 0) return null;
    return { added, removed };
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="cop-version-browser">
      {/* Header */}
      <div className="cop-version-browser-header">
        <span className="cop-version-browser-title">Version History</span>
        {onClose && (
          <button className="cop-version-browser-close" onClick={onClose} title="Close">
            &#x2715;
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="cop-version-filters">
        <div className="cop-version-filter-row">
          <label>From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <label>To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="cop-version-state-filters">
          {ALL_STATES.map((state) => (
            <label key={state}>
              <input
                type="checkbox"
                checked={stateFilters.has(state)}
                onChange={() => toggleStateFilter(state)}
              />
              {state}
            </label>
          ))}
        </div>
      </div>

      {/* Return to Current */}
      <button
        className="cop-version-return-btn"
        onClick={handleReturnToCurrent}
        disabled={selectedVersion === null}
      >
        Return to Current (v{currentVersion})
      </button>

      {/* Version List */}
      <div className="cop-version-list">
        {loading && (
          <div className="cop-version-list-loading">Loading versions...</div>
        )}

        {!loading && filteredVersions.length === 0 && (
          <div className="cop-version-list-empty">
            No versions match the current filters.
          </div>
        )}

        {!loading &&
          filteredVersions.map((v, idx) => {
            const diff = computeDiff(v, idx);
            const isSelected = selectedVersion === v.version;
            const isCOPSnapshot = v.state === 'cop';

            return (
              <div
                key={v.id}
                className={`cop-version-entry${isSelected ? ' cop-version-entry--selected' : ''}`}
                onClick={() => handleVersionClick(v)}
              >
                <div className="cop-version-entry-header">
                  <span className="cop-version-number">
                    v{v.version}
                    {isCOPSnapshot && <span className="cop-version-star" title="COP Snapshot">&#9733;</span>}
                  </span>
                  <span className="cop-version-timestamp">
                    {formatTimestamp(v.transitionedAt)}
                  </span>
                </div>

                <div className="cop-version-transition">
                  <span className={`cop-version-state-badge cop-version-state-badge--${v.previousState}`}>
                    {v.previousState}
                  </span>
                  <span className="cop-version-arrow">&rarr;</span>
                  <span className={`cop-version-state-badge cop-version-state-badge--${v.state}`}>
                    {v.state}
                  </span>
                </div>

                <div className="cop-version-by">
                  by {v.transitionedBy}
                </div>

                {diff && (
                  <div className="cop-version-diff">
                    {diff.added > 0 && (
                      <span className="cop-version-diff-added">+{diff.added} entities </span>
                    )}
                    {diff.removed > 0 && (
                      <span className="cop-version-diff-removed">-{diff.removed} entities</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
