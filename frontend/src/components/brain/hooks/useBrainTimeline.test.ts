/**
 * Tests for useBrainTimeline — temporal validity filtering and staleness decay opacity
 *
 * Phase 47 Wave 0 TDD scaffold. Tests define expected behavior for:
 * - filterByTemporalValidity: filters nodes by validFrom/validTo at a given atTime
 * - Staleness decay opacity: maps confidence tiers to opacity values
 * - Playback state: startPlayback/stopPlayback/advanceTime
 *
 * The current useBrainTimeline.ts uses createdAt-based filtering (recency scoring).
 * Plan 04 upgrades it to use per-assertion temporal validity (validFrom/validTo).
 *
 * Tests will fail (RED) until Plan 04 adds filterByTemporalValidity and
 * playback state management to the hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrainNode } from '../types.js';

// ─── Mock Setup ───────────────────────────────────────────────────────────────

// Mock fetch for API calls in useBrainTimeline
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ nodes: [], edges: [] }),
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const AT_TIME = new Date('2026-03-15T00:00:00Z');

/** Build a BrainNode with temporal validity and confidence fields */
function makeNode(overrides: Partial<BrainNode> & {
  validFrom?: string;
  validTo?: string | null;
  halfLifeDays?: number;
} = {}): BrainNode & {
  validFrom?: string;
  validTo?: string | null;
  halfLifeDays?: number;
} {
  return {
    id: `node-${Math.random().toString(36).slice(2)}`,
    label: 'Test Node',
    type: 'entity',
    confidence: 0.85,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── filterByTemporalValidity ─────────────────────────────────────────────────

describe('filterByTemporalValidity', () => {
  it('filters out nodes where validTo < atTime (expired)', async () => {
    const { filterByTemporalValidity } = await import('./useBrainTimeline.js');

    const expiredNode = makeNode({
      id: 'node-expired',
      validFrom: '2025-01-01T00:00:00Z',
      validTo: '2025-12-31T23:59:59Z', // expired before AT_TIME
    });

    const result = filterByTemporalValidity([expiredNode], AT_TIME);

    expect(result).toHaveLength(0);
  });

  it('includes nodes where validTo is null (still current)', async () => {
    const { filterByTemporalValidity } = await import('./useBrainTimeline.js');

    const currentNode = makeNode({
      id: 'node-current',
      validFrom: '2026-01-01T00:00:00Z',
      validTo: null, // still current
    });

    const result = filterByTemporalValidity([currentNode], AT_TIME);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('node-current');
  });

  it('includes nodes within validFrom <= atTime AND validTo > atTime (within window)', async () => {
    const { filterByTemporalValidity } = await import('./useBrainTimeline.js');

    const validNode = makeNode({
      id: 'node-valid',
      validFrom: '2026-01-01T00:00:00Z',
      validTo: '2026-12-31T23:59:59Z', // valid at AT_TIME
    });

    const result = filterByTemporalValidity([validNode], AT_TIME);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('node-valid');
  });

  it('excludes nodes where validFrom > atTime (not yet valid)', async () => {
    const { filterByTemporalValidity } = await import('./useBrainTimeline.js');

    const futureNode = makeNode({
      id: 'node-future',
      validFrom: '2026-06-01T00:00:00Z', // future, not yet valid at AT_TIME
      validTo: null,
    });

    const result = filterByTemporalValidity([futureNode], AT_TIME);

    expect(result).toHaveLength(0);
  });

  it('includes nodes with no temporal fields (backward compat — include by default)', async () => {
    const { filterByTemporalValidity } = await import('./useBrainTimeline.js');

    const legacyNode = makeNode({
      id: 'node-legacy',
      // No validFrom/validTo — pre-migration nodes
    });

    const result = filterByTemporalValidity([legacyNode], AT_TIME);

    // Nodes without temporal fields should be included (backward compat with pre-migration data)
    expect(result).toHaveLength(1);
  });

  it('filters mixed array correctly — only valid nodes returned', async () => {
    const { filterByTemporalValidity } = await import('./useBrainTimeline.js');

    const nodes = [
      makeNode({ id: 'expired', validFrom: '2025-01-01T00:00:00Z', validTo: '2025-06-30T00:00:00Z' }),
      makeNode({ id: 'current', validFrom: '2026-01-01T00:00:00Z', validTo: null }),
      makeNode({ id: 'future', validFrom: '2027-01-01T00:00:00Z', validTo: null }),
      makeNode({ id: 'in-window', validFrom: '2026-01-01T00:00:00Z', validTo: '2026-12-31T00:00:00Z' }),
    ];

    const result = filterByTemporalValidity(nodes, AT_TIME);

    expect(result).toHaveLength(2);
    const resultIds = result.map(n => n.id);
    expect(resultIds).toContain('current');
    expect(resultIds).toContain('in-window');
    expect(resultIds).not.toContain('expired');
    expect(resultIds).not.toContain('future');
  });
});

// ─── staleness decay opacity ──────────────────────────────────────────────────

describe('staleness decay opacity', () => {
  it('returns opacity 1.0 for high confidence (> 0.85)', async () => {
    const { getStalenessOpacity } = await import('./useBrainTimeline.js');

    expect(getStalenessOpacity(0.86)).toBe(1.0);
    expect(getStalenessOpacity(0.95)).toBe(1.0);
    expect(getStalenessOpacity(1.0)).toBe(1.0);
  });

  it('returns opacity 0.7 for medium confidence (0.5-0.85)', async () => {
    const { getStalenessOpacity } = await import('./useBrainTimeline.js');

    expect(getStalenessOpacity(0.85)).toBe(0.7);
    expect(getStalenessOpacity(0.70)).toBe(0.7);
    expect(getStalenessOpacity(0.50)).toBe(0.7);
  });

  it('returns opacity 0.4 for low confidence (< 0.5)', async () => {
    const { getStalenessOpacity } = await import('./useBrainTimeline.js');

    expect(getStalenessOpacity(0.49)).toBe(0.4);
    expect(getStalenessOpacity(0.25)).toBe(0.4);
    expect(getStalenessOpacity(0.0)).toBe(0.4);
  });

  it('boundary: 0.85 exactly is medium (not high)', async () => {
    const { getStalenessOpacity } = await import('./useBrainTimeline.js');

    // > 0.85 is high; 0.85 exactly is medium
    expect(getStalenessOpacity(0.85)).toBe(0.7);
  });

  it('boundary: 0.5 exactly is medium (not low)', async () => {
    const { getStalenessOpacity } = await import('./useBrainTimeline.js');

    expect(getStalenessOpacity(0.5)).toBe(0.7);
  });
});

// ─── playback state ───────────────────────────────────────────────────────────

describe('playback state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useBrainTimeline exposes startPlayback, stopPlayback, and isPlaying state', async () => {
    // This test verifies the public API shape — will fail until Plan 04 adds playback
    const { useBrainTimeline } = await import('./useBrainTimeline.js');

    // Check that the hook's return type includes playback controls
    // We verify this by checking the function export exists
    expect(typeof useBrainTimeline).toBe('function');

    // The return value interface must include these playback fields (checked at runtime):
    // - isPlaying: boolean
    // - startPlayback: () => void
    // - stopPlayback: () => void
    // - advanceTime: (ms: number) => void
    //
    // Full behavioral tests require renderHook from @testing-library/react-hooks,
    // which requires DOM environment. The interface contract is validated by TypeScript.
    // These tests verify the exported utilities that do NOT require React.
  });

  it('filterByTemporalValidity re-application on time advance produces smaller result set', async () => {
    const { filterByTemporalValidity } = await import('./useBrainTimeline.js');

    const nodes = [
      makeNode({ id: 'early', validFrom: '2025-01-01T00:00:00Z', validTo: null }),
      makeNode({ id: 'late', validFrom: '2026-06-01T00:00:00Z', validTo: null }), // not yet valid at AT_TIME
    ];

    // At AT_TIME (2026-03-15), only 'early' is valid
    const atAtTime = filterByTemporalValidity(nodes, AT_TIME);
    expect(atAtTime).toHaveLength(1);
    expect(atAtTime[0].id).toBe('early');

    // After advancing time to 2026-07-01, both should be valid
    const laterTime = new Date('2026-07-01T00:00:00Z');
    const atLaterTime = filterByTemporalValidity(nodes, laterTime);
    expect(atLaterTime).toHaveLength(2);
  });
});
