/**
 * ResourceSearchBar
 *
 * Global cross-view search bar that spans inventory, groups, and discovered
 * devices in the Resources tab. Always visible above sub-view content.
 *
 * Features:
 * - Debounced text input (300ms) + expandable filter panel
 * - Results dropdown with sub-view badges; clicking navigates to the sub-view
 * - Accepts activeFilter from ResourceStatCards for quick-filter merging
 * - Close on Escape / outside click
 *
 * Phase 42 Plan 06: Search bar and stat cards integration layer.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  resourceRegistryService,
  type RegisteredResource,
  type RegistrySearchParams,
} from '../../lib/resource-registry-service';
import type { ResourceStatus, ResourceCategory } from '../../lib/resource-service';

interface QuickFilter {
  key: string;
  value: string;
}

interface ResourceSearchBarProps {
  problemSetId: string;
  onNavigate: (subView: string, resourceId?: string) => void;
  activeFilter: QuickFilter | null;
}

const CATEGORIES: ResourceCategory[] = [
  'vehicles',
  'weapons',
  'communications',
  'sensors',
  'medical',
  'other',
];

const STATUSES: ResourceStatus[] = ['FMC', 'PMC', 'NMC'];

const CATEGORY_LABELS: Record<string, string> = {
  vehicles: 'Vehicles',
  weapons: 'Weapons',
  communications: 'Communications',
  sensors: 'Sensors',
  medical: 'Medical',
  other: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  FMC: 'text-green-400 bg-green-900',
  PMC: 'text-yellow-400 bg-yellow-900',
  NMC: 'text-red-400 bg-red-900',
};

/** Determine which sub-view a resource belongs to for navigation. */
function resolveSubView(resource: RegisteredResource): string {
  if (resource.groupId) return 'groups';
  // Discovered/registry resources with capabilities or autonomous flag go to inventory
  return 'inventory';
}

export function ResourceSearchBar({ problemSetId, onNavigate, activeFilter }: ResourceSearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RegisteredResource[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<RegistrySearchParams>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(
    async (text: string, currentFilters: RegistrySearchParams, quickFilter: QuickFilter | null) => {
      // Merge quick-filter from stat cards
      const merged: RegistrySearchParams = {
        ...currentFilters,
        missionId: problemSetId,
      };

      if (text.trim()) {
        merged.capability = text.trim();
      }

      // Apply quick filter dimension (category is the main supported one)
      if (quickFilter?.key === 'category') {
        merged.category = quickFilter.value as ResourceCategory;
      }

      if (!text.trim() && !Object.values(merged).some((v) => v !== undefined && v !== problemSetId)) {
        // Nothing to search — clear results
        setResults([]);
        setShowResults(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const found = await resourceRegistryService.searchRegistry(merged);
        setResults(found.slice(0, 50)); // cap at 50, show first 10 in UI
        setShowResults(found.length > 0);
      } catch {
        setResults([]);
        setShowResults(false);
      } finally {
        setLoading(false);
      }
    },
    [problemSetId]
  );

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(query, filters, activeFilter);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, filters, activeFilter, runSearch]);

  // Immediate search when activeFilter changes (stat card click)
  useEffect(() => {
    if (activeFilter !== null) {
      runSearch(query, filters, activeFilter);
    }
  }, [activeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close results on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setShowResults(false);
      inputRef.current?.blur();
    }
  }

  function handleResultClick(resource: RegisteredResource) {
    const subView = resolveSubView(resource);
    onNavigate(subView, resource.id);
    setShowResults(false);
    setQuery('');
  }

  function clearFilters() {
    setFilters({});
    setQuery('');
    setResults([]);
    setShowResults(false);
  }

  const displayed = results.slice(0, 10);

  return (
    <div ref={containerRef} className="relative px-4 py-2 border-b border-gray-700">
      {/* Search input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          {/* Search icon */}
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search resources by name, capability, or DID..."
            className="w-full bg-gray-800 border border-gray-600 rounded pl-8 pr-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {loading && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </span>
          )}
        </div>

        {/* Filter toggle */}
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={[
            'flex items-center gap-1 px-2.5 py-1.5 rounded border text-xs transition-colors',
            showFilters
              ? 'bg-gray-700 border-blue-500 text-blue-300'
              : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500',
          ].join(' ')}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
          </svg>
          Filters
          {(filters.category || filters.status || activeFilter) && (
            <span className="ml-1 w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/* Category */}
          <select
            value={filters.category ?? ''}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                category: (e.target.value as ResourceCategory) || undefined,
              }))
            }
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={filters.status ?? ''}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                status: (e.target.value as ResourceStatus) || undefined,
              }))
            }
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Capability text */}
          <input
            type="text"
            placeholder="Capability..."
            value={filters.capability ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, capability: e.target.value || undefined }))
            }
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500 w-36"
          />

          {/* Clear */}
          <button
            type="button"
            onClick={clearFilters}
            className="px-2 py-1 rounded border border-gray-600 text-xs text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Results dropdown */}
      {showResults && displayed.length > 0 && (
        <div className="absolute left-4 right-4 top-full mt-1 z-50 bg-gray-900 border border-gray-600 rounded shadow-xl max-h-72 overflow-y-auto">
          {displayed.map((resource) => {
            const subView = resolveSubView(resource);
            const statusColor = STATUS_COLORS[resource.status] ?? 'text-gray-400 bg-gray-700';
            return (
              <button
                key={resource.id}
                type="button"
                onClick={() => handleResultClick(resource)}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 transition-colors border-b border-gray-700 last:border-0"
              >
                {/* Name + category */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-100 font-medium truncate">{resource.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {CATEGORY_LABELS[resource.category] ?? resource.category}
                    {resource.groupId && <span className="ml-1 text-gray-600">· In group</span>}
                    {resource.did && <span className="ml-1 text-purple-500">· DID</span>}
                  </div>
                </div>

                {/* Status badge */}
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColor}`}>
                  {resource.status}
                </span>

                {/* Sub-view badge */}
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 capitalize">
                  {subView}
                </span>
              </button>
            );
          })}

          {/* "Show all" link when results exceed 10 */}
          {results.length > 10 && (
            <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-700">
              Showing 10 of {results.length} results — refine your search to narrow down
            </div>
          )}
        </div>
      )}
    </div>
  );
}
