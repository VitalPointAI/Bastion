import { useState, useCallback, useEffect, useRef } from 'react';
import type { BrainNode, BrainGraphData } from '../types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Node extended with a recency score computed by the hook */
export interface BrainNodeWithRecency extends BrainNode {
  /** 0-1: 1 = very recent (created within last 24 h of viewTime), 0 = stale (>30 days) */
  recencyScore: number;
}

/** Node extended with temporal opacity computed from staleness decay */
export interface BrainNodeWithOpacity extends BrainNode {
  /**
   * Visual opacity 0-1 computed from staleness decay formula.
   * High confidence (>0.85): 1.0 — full opacity
   * Medium confidence (0.5-0.85): 0.7 — reduced opacity
   * Low confidence (<0.5): 0.4 — ghost style
   */
  temporalOpacity: number;
}

/** Playback state for animated timeline */
export interface PlaybackState {
  /** Whether animated playback is running */
  isPlaying: boolean;
  /** Playback speed multiplier (0.5x, 1x, 2x, 5x — default 1x = 1 month per second) */
  speed: number;
  /** Current playback position */
  currentTime: Date;
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
  /**
   * Filter nodes by temporal validity at the given time, compute staleness decay opacity.
   * Nodes with no validFrom/validTo are always included.
   * Exported for testability.
   */
  filterByTemporalValidity: (nodes: BrainNode[], atTime: Date) => BrainNodeWithOpacity[];
  /** Current playback state (isPlaying, speed, currentTime) */
  playbackState: PlaybackState;
  /** Start animated playback at the given speed multiplier (default 1x) */
  startPlayback: (speed?: number) => void;
  /** Stop animated playback */
  stopPlayback: () => void;
  /** Set playback speed (0.5, 1, 2, or 5) */
  setPlaybackSpeed: (speed: number) => void;
  /** Directly set the current playback/scrubber position */
  setCurrentTime: (time: Date) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RECENCY_FRESH_MS = 24 * 60 * 60 * 1000;   // 24 hours → score = 1
const RECENCY_STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days → score = 0
const FUTURE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days ahead
const DEBOUNCE_MS = 300;

/** Default playback step: 1x = advance 1 month per second of real time */
const PLAYBACK_STEP_1X_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PLAYBACK_INTERVAL_MS = 1000; // tick every 1 second

// ─── Exported utility functions ───────────────────────────────────────────────

/**
 * getStalenessOpacity
 *
 * Map a decayed confidence value (0-1) to a visual opacity level.
 * Used for rendering stale/decayed nodes with reduced visual weight.
 *
 * - > 0.85: full opacity (1.0) — high confidence
 * - 0.5-0.85: 70% opacity (0.7) — medium confidence
 * - < 0.5: ghost style (0.4) — low confidence
 */
export function getStalenessOpacity(confidence: number): number {
  if (confidence > 0.85) return 1.0;
  if (confidence >= 0.5) return 0.7;
  return 0.4;
}

// ─── Exported filter function ─────────────────────────────────────────────────

/**
 * filterByTemporalValidity
 *
 * Filter a node array to those valid at atTime (per validFrom/validTo),
 * and compute visual opacity from staleness decay for the surviving nodes.
 *
 * Nodes without validFrom/validTo pass through with full opacity.
 *
 * Decay formula: decayedConf = validityScore * 0.5^(ageDays / halfLifeDays)
 *   - > 0.85: full opacity (1.0)
 *   - 0.5-0.85: 70% opacity (0.7)
 *   - < 0.5: ghost style (0.4)
 */
export function filterByTemporalValidity(
  nodes: BrainNode[],
  atTime: Date,
): BrainNodeWithOpacity[] {
  const atMs = atTime.getTime();

  return nodes
    .filter((node) => {
      if (!node.validFrom) return true; // no temporal data → always show
      const fromMs = new Date(node.validFrom).getTime();
      if (fromMs > atMs) return false; // not yet valid
      if (node.validTo != null) {
        const toMs = new Date(node.validTo).getTime();
        if (toMs <= atMs) return false; // expired
      }
      return true;
    })
    .map((node) => {
      // Compute decayed confidence
      let temporalOpacity = 1.0;
      if (node.validFrom) {
        const ageDays =
          (atMs - new Date(node.validFrom).getTime()) / (24 * 60 * 60 * 1000);
        const halfLife = node.halfLifeDays ?? 180;
        const baseConf = node.validityScore ?? node.confidence ?? 0.5;
        const decayedConf = baseConf * Math.pow(0.5, ageDays / halfLife);

        if (decayedConf > 0.85) {
          temporalOpacity = 1.0;
        } else if (decayedConf >= 0.5) {
          temporalOpacity = 0.7;
        } else {
          temporalOpacity = 0.4;
        }
      }
      return { ...node, temporalOpacity };
    });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useBrainTimeline
 *
 * Manages the temporal state of the brain visualization:
 * - past scrubbing → fetches historical graph snapshots from the backend
 * - future zone   → generates basic trend-projection ghost nodes
 * - live mode     → passes currentData through unchanged (no fetch)
 * - playback      → interval that auto-advances currentTime through the timeline
 */
export function useBrainTimeline(
  problemSetId: string,
  currentData: BrainGraphData,
): UseBrainTimelineReturn {
  const [selectedTime, setSelectedTimeState] = useState<Date | null>(null);
  const [historicalData, setHistoricalData] = useState<BrainGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    speed: 1,
    currentTime: new Date(),
  });
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // ── Temporal validity filter (stable callback wrapping pure function) ──────

  const filterByTemporalValidityCallback = useCallback(
    (nodes: BrainNode[], atTime: Date): BrainNodeWithOpacity[] => {
      return filterByTemporalValidity(nodes, atTime);
    },
    [],
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
        const url = `/api/brain/graph-snapshot?problemSetId=${encodeURIComponent(problemSetId)}&atTime=${encodeURIComponent(selectedTime.toISOString())}`;
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

  // ── Playback controls ──────────────────────────────────────────────────────

  const stopPlayback = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    setPlaybackState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const startPlayback = useCallback(
    (speed = 1) => {
      // Stop any existing playback first
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }

      // Initialize currentTime from selectedTime or start of range
      const startTime = selectedTime ?? timeRange.start;

      setPlaybackState({ isPlaying: true, speed, currentTime: startTime });

      playbackIntervalRef.current = setInterval(() => {
        setPlaybackState((prev) => {
          const stepMs = PLAYBACK_STEP_1X_MS * prev.speed;
          const next = new Date(prev.currentTime.getTime() + stepMs);
          // Stop at futureTime
          if (next >= futureTime) {
            clearInterval(playbackIntervalRef.current!);
            playbackIntervalRef.current = null;
            return { ...prev, isPlaying: false, currentTime: futureTime };
          }
          return { ...prev, currentTime: next };
        });

        // Also advance the timeline selectedTime
        setSelectedTimeState((prev) => {
          if (prev === null) return null; // don't disrupt live mode
          const stepMs = PLAYBACK_STEP_1X_MS * speed;
          const next = new Date(prev.getTime() + stepMs);
          return next >= futureTime ? futureTime : next;
        });
      }, PLAYBACK_INTERVAL_MS);
    },
    [selectedTime, timeRange.start, futureTime],
  );

  const setPlaybackSpeed = useCallback((speed: number) => {
    setPlaybackState((prev) => {
      if (prev.isPlaying) {
        // Restart interval with new speed — handled by startPlayback
      }
      return { ...prev, speed };
    });
  }, []);

  const setCurrentTime = useCallback((time: Date) => {
    setSelectedTimeState(time);
    setPlaybackState((prev) => ({ ...prev, currentTime: time }));
  }, []);

  // ── Cleanup playback on unmount ────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // ── Exposed setters ────────────────────────────────────────────────────────

  const setSelectedTime = useCallback((time: Date | null) => {
    setSelectedTimeState(time);
    if (time) {
      setPlaybackState((prev) => ({ ...prev, currentTime: time }));
    }
  }, []);

  const goLive = useCallback(() => {
    stopPlayback();
    setSelectedTimeState(null);
  }, [stopPlayback]);

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
    filterByTemporalValidity: filterByTemporalValidityCallback,
    playbackState,
    startPlayback,
    stopPlayback,
    setPlaybackSpeed,
    setCurrentTime,
  };
}
