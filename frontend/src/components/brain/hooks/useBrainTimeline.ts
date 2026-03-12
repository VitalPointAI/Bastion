import { useState, useCallback, useEffect, useRef } from 'react';
import type { BrainNode, BrainGraphData } from '../types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Node extended with a recency score computed by the hook */
export interface BrainNodeWithRecency extends BrainNode {
  /** 0-1: 1 = very recent (created within last 24 h of viewTime), 0 = stale (>30 days) */
  recencyScore: number;
}

export interface UseBrainTimelineReturn {
  /** Currently selected point in time. null = live/current view */
  selectedTime: Date | null;
  /** Earliest and latest node createdAt in currentData, extended 7 days into the future */
  timeRange: { start: Date; end: Date };
  /** The future boundary: now + 7 days */
  futureTime: Date;
  /** true when selectedTime === null */
  isLive: boolean;
  /**
   * When selectedTime is in the past, this holds the fetched historical snapshot.
   * When selectedTime is in the future, this holds the current data with
   * projected prediction nodes appended.
   * null while live or while loading.
   */
  historicalData: BrainGraphData | null;
  /** true while a historical snapshot fetch is in-flight */
  loading: boolean;
  /** Set the scrubber to a specific time (or pass null to return live) */
  setSelectedTime: (time: Date | null) => void;
  /** Convenience — equivalent to setSelectedTime(null) */
  goLive: () => void;
  /**
   * Returns a 0-1 recency score for a single node relative to viewTime.
   * 1 = created within 24 h of viewTime, 0 = created ≥ 30 days before viewTime.
   */
  computeRecency: (node: BrainNode, viewTime?: Date) => number;
  /**
   * Returns a copy of the supplied node array with a `recencyScore` property
   * set on every node. BrainVisualization can use this to adjust opacity/vibrancy.
   */
  applyRecencyToNodes: (nodes: BrainNode[], viewTime?: Date) => BrainNodeWithRecency[];
  /** The data that should actually be rendered — historicalData if present, else currentData */
  effectiveData: BrainGraphData;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RECENCY_FRESH_MS = 24 * 60 * 60 * 1000;   // 24 hours → score = 1
const RECENCY_STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days → score = 0
const FUTURE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days ahead
const DEBOUNCE_MS = 300;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useBrainTimeline
 *
 * Manages the temporal state of the brain visualization:
 * - past scrubbing → fetches historical graph snapshots from the backend
 * - future zone   → generates basic trend-projection ghost nodes
 * - live mode     → passes currentData through unchanged (no fetch)
 */
export function useBrainTimeline(
  problemSetId: string,
  currentData: BrainGraphData,
): UseBrainTimelineReturn {
  const [selectedTime, setSelectedTimeState] = useState<Date | null>(null);
  const [historicalData, setHistoricalData] = useState<BrainGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived constants ──────────────────────────────────────────────────────

  const now = new Date();
  const futureTime = new Date(now.getTime() + FUTURE_WINDOW_MS);

  const timeRange = (() => {
    const timestamps = currentData.nodes
      .map((n) => new Date(n.createdAt).getTime())
      .filter((t) => !isNaN(t));
    if (timestamps.length === 0) {
      return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: futureTime };
    }
    return {
      start: new Date(Math.min(...timestamps)),
      end: futureTime,
    };
  })();

  const isLive = selectedTime === null;

  // ── Recency computation ────────────────────────────────────────────────────

  const computeRecency = useCallback(
    (node: BrainNode, viewTime?: Date): number => {
      const vt = viewTime ?? now;
      const createdMs = new Date(node.createdAt).getTime();
      if (isNaN(createdMs)) return 0.5;
      const ageMs = vt.getTime() - createdMs;
      if (ageMs <= RECENCY_FRESH_MS) return 1;
      if (ageMs >= RECENCY_STALE_MS) return 0;
      // linear interpolation between fresh and stale
      return 1 - (ageMs - RECENCY_FRESH_MS) / (RECENCY_STALE_MS - RECENCY_FRESH_MS);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const applyRecencyToNodes = useCallback(
    (nodes: BrainNode[], viewTime?: Date): BrainNodeWithRecency[] => {
      const vt = viewTime ?? now;
      return nodes.map((n) => ({ ...n, recencyScore: computeRecency(n, vt) }));
    },
    [computeRecency], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Future prediction generator ────────────────────────────────────────────

  const buildFuturePredictions = useCallback(
    (weeksAhead: number): BrainGraphData => {
      // Group existing nodes by containerId to estimate per-container growth rate.
      const containerCounts: Record<string, BrainNode[]> = {};
      for (const node of currentData.nodes) {
        const key = node.containerId ?? '__ungrouped__';
        if (!containerCounts[key]) containerCounts[key] = [];
        containerCounts[key].push(node);
      }

      // Estimate weekly growth rate per container using the last 4 weeks of data.
      const fourWeeksAgo = now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000;
      const predictedNodes: BrainNode[] = [];
      let ghostId = 0;

      for (const [containerId, nodes] of Object.entries(containerCounts)) {
        const recentCount = nodes.filter(
          (n) => new Date(n.createdAt).getTime() > fourWeeksAgo,
        ).length;
        const weeklyRate = recentCount / 4; // average per week over last 4 weeks
        const projectedCount = Math.round(weeklyRate * weeksAhead);

        // Use the most recent node in the container as a template for the ghost
        const template = nodes.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0];

        // Confidence decreases the further into the future we predict
        const baseConfidence = Math.max(0.1, 1 - weeksAhead / 8);

        for (let i = 0; i < projectedCount; i++) {
          ghostId += 1;
          // Spread predicted nodes in the future zone
          const offsetMs = ((i + 1) / (projectedCount + 1)) * weeksAhead * 7 * 24 * 60 * 60 * 1000;
          predictedNodes.push({
            id: `__future_${containerId}_${ghostId}`,
            label: `Projected (${template.containerLabel ?? containerId})`,
            type: template.type,
            actorCategory: template.actorCategory,
            containerId: containerId === '__ungrouped__' ? undefined : containerId,
            containerLabel: template.containerLabel,
            dimeCategory: template.dimeCategory,
            confidence: baseConfidence,
            isFuturePrediction: true,
            predictionConfidence: baseConfidence,
            createdAt: new Date(now.getTime() + offsetMs).toISOString(),
          });
        }
      }

      return {
        nodes: [...currentData.nodes, ...predictedNodes],
        edges: currentData.edges,
      };
    },
    [currentData], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Fetch historical snapshot ──────────────────────────────────────────────

  useEffect(() => {
    if (selectedTime === null) {
      // Return to live — clear historical data
      setHistoricalData(null);
      setLoading(false);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      return;
    }

    const isFuture = selectedTime > now;

    if (isFuture) {
      // Future prediction zone — no network call needed
      const weeksAhead =
        (selectedTime.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000);
      setHistoricalData(buildFuturePredictions(Math.max(0.1, weeksAhead)));
      setLoading(false);
      return;
    }

    // Past — debounce and fetch
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      if (!problemSetId) return;
      setLoading(true);
      try {
        const url = `/api/brain/graph-snapshot?problemSetId=${encodeURIComponent(problemSetId)}&at=${encodeURIComponent(selectedTime.toISOString())}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`graph-snapshot ${res.status}`);
        const raw = await res.json();
        // Ensure the snapshot always has arrays — the API may omit edges/nodes
        const data: BrainGraphData = {
          nodes: Array.isArray(raw.nodes) ? raw.nodes : [],
          edges: Array.isArray(raw.edges) ? raw.edges : [],
        };
        setHistoricalData(data);
      } catch (err) {
        console.error('[useBrainTimeline] failed to fetch graph snapshot:', err);
        setHistoricalData(null);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTime, problemSetId]);

  // ── Exposed setters ────────────────────────────────────────────────────────

  const setSelectedTime = useCallback((time: Date | null) => {
    setSelectedTimeState(time);
  }, []);

  const goLive = useCallback(() => {
    setSelectedTimeState(null);
  }, []);

  // ── effectiveData ──────────────────────────────────────────────────────────

  const effectiveData = historicalData ?? currentData;

  return {
    selectedTime,
    timeRange,
    futureTime,
    isLive,
    historicalData,
    loading,
    setSelectedTime,
    goLive,
    computeRecency,
    applyRecencyToNodes,
    effectiveData,
  };
}
