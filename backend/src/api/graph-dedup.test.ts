/**
 * Graph Dedup API Tests
 *
 * Phase 62 Plan 03 — TDD RED phase
 * Behavioral tests for batch-merge and stats endpoints.
 * All external dependencies are mocked — no real DB calls made.
 *
 * Strategy: Test exported handler functions directly to avoid needing
 * supertest. Handlers are exported from graph.ts for testability.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the resolution service module before any imports
vi.mock('../graph/resolution/resolution-service.js', () => ({
  entityResolutionService: {
    findDuplicates: vi.fn(),
    autoMergeDuplicates: vi.fn(),
  },
}));

// Mock neo4j-client (used in stats endpoint via dynamic import)
vi.mock('../graph/neo4j-client.js', () => ({
  executeReadQuery: vi.fn(),
}));

import { entityResolutionService } from '../graph/resolution/resolution-service.js';
import { executeReadQuery } from '../graph/neo4j-client.js';
import type { ResolutionResult, MergeResult } from '../graph/resolution/resolution-service.js';
import type { MatchCandidate } from '../graph/resolution/string-matcher.js';
import { batchMergeHandler, graphStatsHandler } from './graph.js';

const mockFindDuplicates = vi.mocked(entityResolutionService.findDuplicates);
const mockAutoMergeDuplicates = vi.mocked(entityResolutionService.autoMergeDuplicates);
const mockExecuteReadQuery = vi.mocked(executeReadQuery);

// ─── Minimal mock request / response helpers ──────────────────────────────────

function mockReq(body: Record<string, unknown> = {}, query: Record<string, unknown> = {}) {
  return { body, query } as unknown as import('express').Request;
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
  };
  return res;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCandidate(
  id1: string,
  name1: string,
  id2: string,
  name2: string,
  score: number,
): MatchCandidate {
  return {
    actor1Id: id1,
    actor1Name: name1,
    actor2Id: id2,
    actor2Name: name2,
    score: { score, algorithm: 'jaro_winkler' },
  };
}

function makeMergeResult(canonicalId: string, mergedId: string): MergeResult {
  return {
    canonicalActorId: canonicalId,
    mergedActorIds: [mergedId],
    aliasesAdded: [],
  };
}

function makeNeo4jRecord(total: number, softDeleted: number, active: number) {
  return {
    records: [
      {
        get: (key: string) => {
          const values: Record<string, { toNumber: () => number }> = {
            total: { toNumber: () => total },
            softDeleted: { toNumber: () => softDeleted },
            active: { toNumber: () => active },
          };
          return values[key];
        },
      },
    ],
  };
}

// ─── Shared fixture ───────────────────────────────────────────────────────────

const autoMergeCandidates: MatchCandidate[] = [
  makeCandidate('a1', 'China', 'a2', 'PRC', 0.97),
  makeCandidate('a3', 'Russia', 'a4', 'RF', 0.96),
  makeCandidate('a5', 'USA', 'a6', 'United States', 0.97),
];
const reviewCandidates: MatchCandidate[] = [
  makeCandidate('a7', 'Taiwan', 'a8', 'ROC', 0.88),
  makeCandidate('a9', 'Korea', 'a10', 'South Korea', 0.87),
];
const canned: ResolutionResult = {
  candidates: [...autoMergeCandidates, ...reviewCandidates],
  autoMerge: autoMergeCandidates,
  needsReview: reviewCandidates,
  verified: [],
  rejected: [],
};

beforeEach(() => {
  vi.resetAllMocks();
});

// ─── POST /graph/resolution/batch-merge (dryRun=true) ────────────────────────

describe('batchMergeHandler — dry run', () => {
  it('returns candidate counts without calling autoMergeDuplicates', async () => {
    mockFindDuplicates.mockResolvedValueOnce(canned);
    const req = mockReq({ dryRun: true });
    const res = mockRes();

    await batchMergeHandler(req, res as unknown as import('express').Response);

    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body).toMatchObject({
      autoMergeCandidates: 3,
      reviewCandidates: 2,
      totalCandidates: 5,
    });
    expect(Array.isArray(body.sample)).toBe(true);
    expect(mockAutoMergeDuplicates).not.toHaveBeenCalled();
  });

  it('sample items have actor1Name, actor2Name and score fields', async () => {
    mockFindDuplicates.mockResolvedValueOnce(canned);
    const req = mockReq({ dryRun: true });
    const res = mockRes();

    await batchMergeHandler(req, res as unknown as import('express').Response);

    const body = res.body as { sample: Array<Record<string, unknown>> };
    for (const item of body.sample) {
      expect(typeof item.actor1Name).toBe('string');
      expect(typeof item.actor2Name).toBe('string');
      expect(typeof item.score).toBe('number');
    }
  });

  it('defaults to dryRun=true when dryRun is omitted', async () => {
    mockFindDuplicates.mockResolvedValueOnce(canned);
    const req = mockReq({});
    const res = mockRes();

    await batchMergeHandler(req, res as unknown as import('express').Response);

    expect(mockAutoMergeDuplicates).not.toHaveBeenCalled();
  });
});

// ─── POST /graph/resolution/batch-merge (dryRun=false) ───────────────────────

describe('batchMergeHandler — execute', () => {
  it('calls autoMergeDuplicates and returns mergedCount + merges array', async () => {
    mockFindDuplicates.mockResolvedValueOnce(canned);
    const merges: MergeResult[] = [
      makeMergeResult('a1', 'a2'),
      makeMergeResult('a3', 'a4'),
    ];
    mockAutoMergeDuplicates.mockResolvedValueOnce(merges);
    const req = mockReq({ dryRun: false });
    const res = mockRes();

    await batchMergeHandler(req, res as unknown as import('express').Response);

    expect(mockAutoMergeDuplicates).toHaveBeenCalledOnce();
    const body = res.body as Record<string, unknown>;
    expect(body).toMatchObject({ mergedCount: 2 });
    expect(Array.isArray(body.merges)).toBe(true);
    expect((body.merges as unknown[]).length).toBe(2);
  });

  it('merges items expose canonicalActorId and mergedActorIds', async () => {
    mockFindDuplicates.mockResolvedValueOnce(canned);
    mockAutoMergeDuplicates.mockResolvedValueOnce([makeMergeResult('a1', 'a2')]);
    const req = mockReq({ dryRun: false });
    const res = mockRes();

    await batchMergeHandler(req, res as unknown as import('express').Response);

    const body = res.body as { merges: Array<Record<string, unknown>> };
    const merge = body.merges[0];
    expect(typeof merge.canonicalActorId).toBe('string');
    expect(Array.isArray(merge.mergedActorIds)).toBe(true);
  });
});

// ─── GET /graph/stats ─────────────────────────────────────────────────────────

describe('graphStatsHandler', () => {
  it('returns all 6 numeric fields', async () => {
    mockExecuteReadQuery.mockResolvedValueOnce(makeNeo4jRecord(100, 10, 90) as never);
    mockFindDuplicates.mockResolvedValueOnce(canned);
    const req = mockReq({}, {});
    const res = mockRes();

    await graphStatsHandler(req, res as unknown as import('express').Response);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      totalActors: 100,
      activeActors: 90,
      softDeletedActors: 10,
      duplicateCandidates: 5,
      autoMergeCandidates: 3,
      humanReviewCandidates: 2,
    });
  });

  it('returns zero dedup metrics when resolution scan fails', async () => {
    mockExecuteReadQuery.mockResolvedValueOnce(makeNeo4jRecord(50, 5, 45) as never);
    mockFindDuplicates.mockRejectedValueOnce(new Error('neo4j timeout'));
    const req = mockReq({}, {});
    const res = mockRes();

    await graphStatsHandler(req, res as unknown as import('express').Response);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      totalActors: 50,
      activeActors: 45,
      softDeletedActors: 5,
      duplicateCandidates: 0,
      autoMergeCandidates: 0,
      humanReviewCandidates: 0,
    });
  });
});
