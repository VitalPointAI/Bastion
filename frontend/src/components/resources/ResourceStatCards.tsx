/**
 * ResourceStatCards
 *
 * Compact horizontal stat cards row above all sub-views in the Resources tab.
 * Shows at-a-glance counts: total resources, per-category, with-DID, autonomous, groups.
 *
 * Cards are clickable quick-filters — clicking a card sets an active filter that
 * flows into ResourceSearchBar. Clicking the active card again clears the filter.
 *
 * Cards flash briefly (animate-pulse for 1s) when values change via WebSocket.
 *
 * Phase 42 Plan 06: Search bar and stat cards integration layer.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { resourceRegistryService, type RegistryStats } from '../../lib/resource-registry-service';

interface QuickFilter {
  key: string;
  value: string;
}

interface ResourceStatCardsProps {
  problemSetId: string;
  onQuickFilter: (filter: QuickFilter | null) => void;
}

interface StatCardConfig {
  id: string;
  label: string;
  value: number;
  filterKey?: string;
  filterValue?: string;
}

// Category display name map
const CATEGORY_LABELS: Record<string, string> = {
  vehicles: 'Vehicles',
  weapons: 'Weapons',
  communications: 'Comms',
  sensors: 'Sensors',
  medical: 'Medical',
  other: 'Other',
};

export function ResourceStatCards({ problemSetId: _problemSetId, onQuickFilter }: ResourceStatCardsProps) {
  const [stats, setStats] = useState<RegistryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<QuickFilter | null>(null);
  const [flashingCards, setFlashingCards] = useState<Set<string>>(new Set());
  const prevStatsRef = useRef<RegistryStats | null>(null);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const next = await resourceRegistryService.getRegistryStats();
      const prev = prevStatsRef.current;

      if (prev !== null) {
        // Detect changed cards to flash
        const toFlash = new Set<string>();

        if (prev.totalResources !== next.totalResources) toFlash.add('total');
        if (prev.withDID !== next.withDID) toFlash.add('withDID');
        if (prev.autonomous !== next.autonomous) toFlash.add('autonomous');
        if (prev.groupCount !== next.groupCount) toFlash.add('groups');

        for (const cat of Object.keys(next.byCategory)) {
          if ((prev.byCategory[cat] ?? 0) !== next.byCategory[cat]) {
            toFlash.add(`cat:${cat}`);
            toFlash.add('total');
          }
        }

        if (toFlash.size > 0) {
          setFlashingCards(toFlash);
          setTimeout(() => setFlashingCards(new Set()), 1000);
        }
      }

      prevStatsRef.current = next;
      setStats(next);
    } catch {
      // Silently ignore fetch errors — stats are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // WebSocket position subscription — re-fetch stats on batch events, debounced to max 1x per 5s
  useEffect(() => {
    const unsub = resourceRegistryService.subscribeToPositions(() => {
      if (refetchTimerRef.current) return; // already queued
      refetchTimerRef.current = setTimeout(() => {
        refetchTimerRef.current = null;
        fetchStats();
      }, 5000);
    });

    return () => {
      unsub();
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
    };
  }, [fetchStats]);

  function handleCardClick(filterKey: string, filterValue: string) {
    const isSame =
      activeFilter?.key === filterKey && activeFilter?.value === filterValue;
    const next = isSame ? null : { key: filterKey, value: filterValue };
    setActiveFilter(next);
    onQuickFilter(next);
  }

  function buildCards(s: RegistryStats): StatCardConfig[] {
    const cards: StatCardConfig[] = [
      { id: 'total', label: 'Total', value: s.totalResources },
    ];

    // One card per category with non-zero count
    for (const [cat, count] of Object.entries(s.byCategory)) {
      if (count > 0) {
        cards.push({
          id: `cat:${cat}`,
          label: CATEGORY_LABELS[cat] ?? cat,
          value: count,
          filterKey: 'category',
          filterValue: cat,
        });
      }
    }

    cards.push({ id: 'withDID', label: 'With DID', value: s.withDID, filterKey: 'withDID', filterValue: 'true' });
    cards.push({ id: 'autonomous', label: 'Autonomous', value: s.autonomous, filterKey: 'autonomous', filterValue: 'true' });
    cards.push({ id: 'groups', label: 'Groups', value: s.groupCount, filterKey: 'groups', filterValue: 'true' });

    return cards;
  }

  if (loading || !stats) {
    // Skeleton state
    return (
      <div className="flex flex-wrap gap-2 px-4 py-2">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 w-20 h-14 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const cards = buildCards(stats);

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2 border-b border-gray-700">
      {cards.map((card) => {
        const isActive =
          card.filterKey !== undefined &&
          activeFilter?.key === card.filterKey &&
          activeFilter?.value === card.filterValue;
        const isFlashing = flashingCards.has(card.id);
        const isClickable = card.filterKey !== undefined;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => {
              if (card.filterKey) {
                handleCardClick(card.filterKey, card.filterValue!);
              }
            }}
            disabled={!isClickable}
            className={[
              'bg-gray-800 border rounded px-3 py-2 text-center transition-colors min-w-18',
              isClickable ? 'cursor-pointer hover:border-gray-500' : 'cursor-default',
              isActive ? 'border-blue-500 bg-gray-700' : 'border-gray-600',
              isFlashing ? 'animate-pulse' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="text-lg font-semibold text-white leading-none">{card.value}</div>
            <div className="text-xs text-gray-400 mt-1 whitespace-nowrap">{card.label}</div>
          </button>
        );
      })}
    </div>
  );
}
