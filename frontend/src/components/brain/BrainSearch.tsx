/**
 * BrainSearch — search and filter bar for the brain visualization.
 *
 * Two modes:
 *   - "Filter" (traditional): text input + dropdowns for type, category, theme
 *   - "Ask" (natural language): single text input, sends query to /api/brain/nl-search
 *
 * On each change, calls `onSearchResults` with the matching node IDs.
 * Optionally calls `onNodeFocus` when a specific result is clicked.
 */

import { useState, useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import type { BrainNode, BrainNodeType } from './types.js';
import './BrainSearch.css';

// ─── API base ─────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchMode = 'filter' | 'ask';

interface NlSearchResponse {
  matchingNodeIds: string[];
  interpretation: string;
}

export interface BrainSearchProps {
  nodes: BrainNode[];
  problemSetId?: string;
  onSearchResults: (matchingNodeIds: string[]) => void;
  onNodeFocus?: (nodeId: string) => void;
}

// ─── Filter option sets ───────────────────────────────────────────────────────

const NODE_TYPE_OPTIONS: Array<{ value: '' | BrainNodeType; label: string }> = [
  { value: '', label: 'All Types' },
  { value: 'entity', label: 'Entity' },
  { value: 'objective', label: 'Objective' },
  { value: 'document', label: 'Document' },
  { value: 'concept', label: 'Concept' },
];

// Actor filter options are built dynamically from the current graph nodes
function buildActorOptions(nodes: BrainNode[]): Array<{ value: string; label: string }> {
  const actors = new Map<string, number>();
  for (const n of nodes) {
    if (n.type === 'entity' && n.label) {
      actors.set(n.label, (actors.get(n.label) ?? 0) + 1);
    }
  }
  // Sort by connection count (most connected first), limit to 50
  const sorted = [...actors.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([name]) => ({ value: name, label: name }));
  return [{ value: '', label: 'All Actors' }, ...sorted];
}

// DIME theme options built dynamically from actual node data
function buildThemeOptions(nodes: BrainNode[]): Array<{ value: string; label: string }> {
  const themes = new Map<string, number>();
  for (const n of nodes) {
    if (n.dimeCategory) {
      themes.set(n.dimeCategory, (themes.get(n.dimeCategory) ?? 0) + 1);
    }
  }
  const sorted = [...themes.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([theme]) => ({
      value: theme,
      label: theme.charAt(0).toUpperCase() + theme.slice(1),
    }));
  return [{ value: '', label: 'All Themes' }, ...sorted];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BrainSearch({
  nodes,
  problemSetId,
  onSearchResults,
  onNodeFocus,
}: BrainSearchProps) {
  void onNodeFocus; // Future: wire to a result-list click

  const [searchMode, setSearchMode] = useState<SearchMode>('filter');

  // Filter mode state
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'' | BrainNodeType>('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('');

  // Ask mode state
  const [askQuery, setAskQuery] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState('');
  const [askResultCount, setAskResultCount] = useState<number | null>(null);

  // Debounce ref for filter mode
  const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Filter mode: compute matching IDs on input change ─────────────────────

  const applyFilters = useCallback(
    (text: string, type: '' | BrainNodeType, category: string, theme: string) => {
      const lower = text.toLowerCase();
      const matches = nodes.filter((n) => {
        if (text && !n.label.toLowerCase().includes(lower) && !n.id.toLowerCase().includes(lower)) {
          return false;
        }
        if (type && n.type !== type) return false;
        // Actor filter: match by actor name (dynamic dropdown)
        if (category && n.label !== category) return false;
        if (theme && n.dimeCategory !== theme) return false;
        return true;
      });

      onSearchResults(matches.map((n) => n.id));
      return matches.length;
    },
    [nodes, onSearchResults],
  );

  // Recalculate on any filter change (debounced 150ms for text)
  useEffect(() => {
    if (searchMode !== 'filter') return;

    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    filterTimerRef.current = setTimeout(() => {
      applyFilters(query, selectedType, selectedCategory, selectedTheme);
    }, 150);

    return () => {
      if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    };
  }, [searchMode, query, selectedType, selectedCategory, selectedTheme, applyFilters]);

  // Reset to all nodes when switching to filter mode
  useEffect(() => {
    if (searchMode === 'filter') {
      applyFilters(query, selectedType, selectedCategory, selectedTheme);
    } else {
      // When switching to ask mode, show all until a query runs
      if (!askResultCount) {
        onSearchResults(nodes.map((n) => n.id));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMode]);

  // ── Ask mode: send NL query to backend ───────────────────────────────────

  const handleAskSubmit = useCallback(async () => {
    if (!askQuery.trim() || askLoading) return;
    setAskLoading(true);
    setAskError('');
    setInterpretation('');

    try {
      const res = await fetch(`${API_BASE}/api/brain/nl-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemSetId: problemSetId ?? '', query: askQuery.trim() }),
      });

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const data = (await res.json()) as NlSearchResponse;
      const validIds = new Set(nodes.map((n) => n.id));
      const filtered = data.matchingNodeIds.filter((id) => validIds.has(id));

      onSearchResults(filtered);
      setInterpretation(data.interpretation);
      setAskResultCount(filtered.length);
    } catch {
      setAskError('Search failed — try traditional filters');
      onSearchResults(nodes.map((n) => n.id));
      setAskResultCount(null);
    } finally {
      setAskLoading(false);
    }
  }, [askQuery, askLoading, problemSetId, nodes, onSearchResults]);

  const handleAskKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        void handleAskSubmit();
      }
    },
    [handleAskSubmit],
  );

  // ── Clear ─────────────────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    setQuery('');
    setSelectedType('');
    setSelectedCategory('');
    setSelectedTheme('');
    setAskQuery('');
    setInterpretation('');
    setAskError('');
    setAskResultCount(null);
    onSearchResults(nodes.map((n) => n.id));
  }, [nodes, onSearchResults]);

  // ── Derived count ─────────────────────────────────────────────────────────

  const filterMatchCount = nodes.filter((n) => {
    const lower = query.toLowerCase();
    if (query && !n.label.toLowerCase().includes(lower) && !n.id.toLowerCase().includes(lower)) return false;
    if (selectedType && n.type !== selectedType) return false;
    if (selectedCategory && n.label !== selectedCategory) return false;
    if (selectedTheme && n.dimeCategory !== selectedTheme) return false;
    return true;
  }).length;

  const isFiltered = searchMode === 'filter'
    ? query !== '' || selectedType !== '' || selectedCategory !== '' || selectedTheme !== ''
    : askResultCount !== null;

  const resultLabel = searchMode === 'filter'
    ? `${filterMatchCount} of ${nodes.length}`
    : askResultCount !== null
      ? `${askResultCount} of ${nodes.length}`
      : `${nodes.length}`;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="brain-search">
      {/* Mode toggle */}
      <div className="brain-search-mode-toggle">
        <button
          type="button"
          className={`brain-search-mode-btn${searchMode === 'filter' ? ' active' : ''}`}
          onClick={() => setSearchMode('filter')}
          title="Traditional filter mode"
        >
          Filter
        </button>
        <button
          type="button"
          className={`brain-search-mode-btn${searchMode === 'ask' ? ' active' : ''}`}
          onClick={() => setSearchMode('ask')}
          title="Natural language ask mode"
        >
          Ask
        </button>
      </div>

      {/* Input */}
      {searchMode === 'filter' ? (
        <input
          type="text"
          className="brain-search-input"
          placeholder="Search nodes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      ) : (
        <div className="brain-search-ask-row">
          <input
            type="text"
            className="brain-search-input brain-search-ask-input"
            placeholder="Ask about the graph..."
            value={askQuery}
            onChange={(e) => setAskQuery(e.target.value)}
            onKeyDown={handleAskKeyDown}
            disabled={askLoading}
          />
          <button
            type="button"
            className="brain-search-ask-btn"
            onClick={() => { void handleAskSubmit(); }}
            disabled={askLoading || !askQuery.trim()}
            title="Search"
          >
            {askLoading ? '...' : '⌕'}
          </button>
        </div>
      )}

      {/* Filter dropdowns (filter mode only) */}
      {searchMode === 'filter' && (
        <div className="brain-search-filters">
          <select
            className="brain-search-select"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as '' | BrainNodeType)}
          >
            {NODE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            className="brain-search-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {buildActorOptions(nodes).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            className="brain-search-select"
            value={selectedTheme}
            onChange={(e) => setSelectedTheme(e.target.value)}
          >
            {buildThemeOptions(nodes).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Interpretation (ask mode) */}
      {searchMode === 'ask' && interpretation && (
        <span className="brain-search-interpretation">{interpretation}</span>
      )}
      {searchMode === 'ask' && askError && (
        <span className="brain-search-error">{askError}</span>
      )}

      {/* Result count */}
      <span className="brain-search-count">{resultLabel} nodes</span>

      {/* Clear button */}
      {isFiltered && (
        <button
          type="button"
          className="brain-search-clear"
          onClick={handleClear}
          title="Clear filters"
        >
          ✕
        </button>
      )}
    </div>
  );
}
