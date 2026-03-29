/**
 * Tests for OSINT Graph Sync — normalization and post-sync resolution behavior.
 *
 * Phase 62 Plan 02: Verifies that:
 * 1. syncOSINTEventToGraph normalizes actor names before MERGE (PRC → China)
 * 2. runPostSyncResolution calls findDuplicates then autoMergeDuplicates
 * 3. runPostSyncResolution does NOT throw when findDuplicates rejects
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OSINTEvent } from '../graph/osint/types.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../graph/neo4j-client.js', () => ({
  executeWriteQuery: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../graph/resolution/resolution-service.js', () => ({
  entityResolutionService: {
    findDuplicates: vi.fn().mockResolvedValue({ candidates: [], autoMerge: [], needsReview: [], verified: [], rejected: [] }),
    autoMergeDuplicates: vi.fn().mockResolvedValue([]),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(actors: string[], workspaceId = 'ws-test'): OSINTEvent {
  return {
    id: 'evt-001',
    title: 'Test event',
    content: 'Test content',
    sourceUrl: 'https://example.com/test',
    sourceName: 'test-feed',
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    workspaceId,
    actors,
    locations: [],
    eventType: 'news',
    confidence: 0.65,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
  } as unknown as OSINTEvent;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('syncOSINTEventToGraph — name normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes "PRC" to "China" in the MERGE name parameter', async () => {
    const { syncOSINTEventToGraph } = await import('./osint-graph-sync.js');
    const { executeWriteQuery } = await import('../graph/neo4j-client.js');

    const event = makeEvent(['PRC']);
    await syncOSINTEventToGraph(event);

    expect(executeWriteQuery).toHaveBeenCalled();
    const calls = vi.mocked(executeWriteQuery).mock.calls;
    const nameValues = calls.map(c => (c[1] as Record<string, unknown>)?.name);
    expect(nameValues).toContain('China');
    expect(nameValues).not.toContain('PRC');
  });

  it('uses canonical name in the generated actorId (not raw name)', async () => {
    const { syncOSINTEventToGraph } = await import('./osint-graph-sync.js');
    const { executeWriteQuery } = await import('../graph/neo4j-client.js');

    const event = makeEvent(['PRC']);
    await syncOSINTEventToGraph(event);

    const calls = vi.mocked(executeWriteQuery).mock.calls;
    const idValues = calls.map(c => (c[1] as Record<string, unknown>)?.id as string);
    // ACT-osint-china (canonical), NOT ACT-osint-prc (raw)
    const hasCanonicalId = idValues.some(id => id?.includes('china'));
    const hasRawId = idValues.some(id => id?.includes('prc'));
    expect(hasCanonicalId).toBe(true);
    expect(hasRawId).toBe(false);
  });

  it('does not call executeWriteQuery for empty or very short actor names', async () => {
    const { syncOSINTEventToGraph } = await import('./osint-graph-sync.js');
    const { executeWriteQuery } = await import('../graph/neo4j-client.js');

    const event = makeEvent(['', 'X', '  ']);
    await syncOSINTEventToGraph(event);

    expect(executeWriteQuery).not.toHaveBeenCalled();
  });

  it('skips events with no actors array', async () => {
    const { syncOSINTEventToGraph } = await import('./osint-graph-sync.js');
    const { executeWriteQuery } = await import('../graph/neo4j-client.js');

    const event = makeEvent([]);
    await syncOSINTEventToGraph(event);

    expect(executeWriteQuery).not.toHaveBeenCalled();
  });
});

describe('runPostSyncResolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls findDuplicates with the provided workspaceId', async () => {
    const { runPostSyncResolution } = await import('./osint-graph-sync.js');
    const { entityResolutionService } = await import('../graph/resolution/resolution-service.js');

    await runPostSyncResolution('ws-123');

    expect(entityResolutionService.findDuplicates).toHaveBeenCalledWith('ws-123');
  });

  it('calls autoMergeDuplicates with the result from findDuplicates', async () => {
    const { runPostSyncResolution } = await import('./osint-graph-sync.js');
    const { entityResolutionService } = await import('../graph/resolution/resolution-service.js');

    const fakeResult = { candidates: [], autoMerge: [], needsReview: [], verified: [], rejected: [] };
    vi.mocked(entityResolutionService.findDuplicates).mockResolvedValueOnce(fakeResult);

    await runPostSyncResolution('ws-123');

    expect(entityResolutionService.autoMergeDuplicates).toHaveBeenCalledWith(fakeResult);
  });

  it('does NOT throw when findDuplicates rejects (catches error internally)', async () => {
    const { runPostSyncResolution } = await import('./osint-graph-sync.js');
    const { entityResolutionService } = await import('../graph/resolution/resolution-service.js');

    vi.mocked(entityResolutionService.findDuplicates).mockRejectedValueOnce(new Error('Neo4j down'));

    await expect(runPostSyncResolution('ws-fail')).resolves.toBeUndefined();
  });

  it('does NOT throw when autoMergeDuplicates rejects (catches error internally)', async () => {
    const { runPostSyncResolution } = await import('./osint-graph-sync.js');
    const { entityResolutionService } = await import('../graph/resolution/resolution-service.js');

    vi.mocked(entityResolutionService.autoMergeDuplicates).mockRejectedValueOnce(new Error('Merge failed'));

    await expect(runPostSyncResolution('ws-fail')).resolves.toBeUndefined();
  });

  it('works with no workspaceId (undefined)', async () => {
    const { runPostSyncResolution } = await import('./osint-graph-sync.js');
    const { entityResolutionService } = await import('../graph/resolution/resolution-service.js');

    await runPostSyncResolution();

    expect(entityResolutionService.findDuplicates).toHaveBeenCalledWith(undefined);
  });
});
