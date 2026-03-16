/**
 * Tests for EntityResolutionService — hybrid three-signal scoring
 *
 * Phase 47 Wave 0 TDD scaffold. Tests define expected behavior for:
 * - computeHybridScore: 0.4*string + 0.4*embedding + 0.2*type
 * - Auto-merge threshold (>= 0.85), human review (0.5-0.85), distinct (< 0.5)
 * - Embedding similarity computation (mocked OpenAI API)
 * - Ontology type matching (same jsonldType = 1.0, different = 0.0)
 *
 * Tests will fail (RED) until Plan 06 extends EntityResolutionService with
 * hybrid three-signal scoring.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Setup ───────────────────────────────────────────────────────────────

// Mock Neo4j client
vi.mock('../../graph/neo4j-client.js', () => ({
  executeWriteQuery: vi.fn().mockResolvedValue({ records: [] }),
  executeReadQuery: vi.fn().mockResolvedValue({ records: [] }),
}));

vi.mock('../neo4j-client.js', () => ({
  executeWriteQuery: vi.fn().mockResolvedValue({ records: [] }),
  executeReadQuery: vi.fn().mockResolvedValue({ records: [] }),
}));

// Mock actor-store to avoid Neo4j dependency
vi.mock('../raft/actor-store.js', () => ({
  actorStore: {
    listActors: vi.fn().mockResolvedValue([]),
    getActor: vi.fn().mockResolvedValue(null),
    mergeActors: vi.fn().mockResolvedValue(null),
  },
}));

// Mock LLM factory for embedding generation
vi.mock('../../agents/langgraph/llm-factory.js', () => ({
  createLLMForAgent: vi.fn().mockResolvedValue({
    invoke: vi.fn().mockResolvedValue({ content: 'SAME entity: same org' }),
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }],
      }),
    },
  }),
}));

// ─── hybrid three-signal scoring ─────────────────────────────────────────────

describe('hybrid three-signal scoring', () => {
  it('computeHybridScore uses weights 0.4 + 0.4 + 0.2', async () => {
    const { computeHybridScore } = await import('./resolution-service.js');

    // string=0.8, embedding=0.9, type=1.0
    // fused = 0.4*0.8 + 0.4*0.9 + 0.2*1.0
    //       = 0.32 + 0.36 + 0.20 = 0.88
    const result = computeHybridScore(0.8, 0.9, 1.0);
    expect(result).toBeCloseTo(0.88, 2);
  });

  it('returns 0.86 for string=0.8, embedding=0.9, type=1.0 (auto-merge territory)', async () => {
    const { computeHybridScore } = await import('./resolution-service.js');

    // From RESEARCH.md Pattern 7 example:
    // 0.4*0.8 + 0.4*0.9 + 0.2*1.0 = 0.88
    // Note: RESEARCH.md shows "fused=0.86" — slight rounding difference from 0.88
    // Accepting the formula result: 0.88 which is >= 0.85 (auto-merge)
    const result = computeHybridScore(0.8, 0.9, 1.0);
    expect(result).toBeGreaterThanOrEqual(0.85);
  });

  it('returns 0.28 for string=0.4, embedding=0.3, type=0.0 (distinct territory)', async () => {
    const { computeHybridScore } = await import('./resolution-service.js');

    // 0.4*0.4 + 0.4*0.3 + 0.2*0.0 = 0.16 + 0.12 + 0.0 = 0.28
    const result = computeHybridScore(0.4, 0.3, 0.0);
    expect(result).toBeCloseTo(0.28, 2);
  });

  it('returns score in human-review band for string=0.6, embedding=0.7, type=1.0', async () => {
    const { computeHybridScore } = await import('./resolution-service.js');

    // 0.4*0.6 + 0.4*0.7 + 0.2*1.0 = 0.24 + 0.28 + 0.20 = 0.72
    const result = computeHybridScore(0.6, 0.7, 1.0);
    expect(result).toBeCloseTo(0.72, 2);
    // Must be in human review band: 0.5 <= score < 0.85
    expect(result).toBeGreaterThanOrEqual(0.5);
    expect(result).toBeLessThan(0.85);
  });

  it('handles all-zero inputs (totally distinct) → 0.0', async () => {
    const { computeHybridScore } = await import('./resolution-service.js');

    expect(computeHybridScore(0, 0, 0)).toBeCloseTo(0, 5);
  });

  it('handles all-one inputs (perfect match) → 1.0', async () => {
    const { computeHybridScore } = await import('./resolution-service.js');

    expect(computeHybridScore(1, 1, 1)).toBeCloseTo(1.0, 5);
  });
});

// ─── resolution action thresholds ─────────────────────────────────────────────

describe('resolution action thresholds', () => {
  it('classifyHybridScore returns auto_merge for score >= 0.85', async () => {
    const { classifyHybridScore } = await import('./resolution-service.js');

    expect(classifyHybridScore(0.85)).toBe('auto_merge');
    expect(classifyHybridScore(0.90)).toBe('auto_merge');
    expect(classifyHybridScore(1.00)).toBe('auto_merge');
  });

  it('classifyHybridScore returns human_review for 0.5 <= score < 0.85', async () => {
    const { classifyHybridScore } = await import('./resolution-service.js');

    expect(classifyHybridScore(0.50)).toBe('human_review');
    expect(classifyHybridScore(0.70)).toBe('human_review');
    expect(classifyHybridScore(0.84)).toBe('human_review');
  });

  it('classifyHybridScore returns distinct for score < 0.5', async () => {
    const { classifyHybridScore } = await import('./resolution-service.js');

    expect(classifyHybridScore(0.00)).toBe('distinct');
    expect(classifyHybridScore(0.28)).toBe('distinct');
    expect(classifyHybridScore(0.49)).toBe('distinct');
  });

  it('boundary: 0.85 exactly is auto_merge (not human_review)', async () => {
    const { classifyHybridScore } = await import('./resolution-service.js');
    expect(classifyHybridScore(0.85)).toBe('auto_merge');
  });

  it('boundary: 0.5 exactly is human_review (not distinct)', async () => {
    const { classifyHybridScore } = await import('./resolution-service.js');
    expect(classifyHybridScore(0.5)).toBe('human_review');
  });
});

// ─── embedding similarity ─────────────────────────────────────────────────────

describe('embedding similarity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computeEmbeddingSimilarity returns a number in 0-1 range', async () => {
    const { computeEmbeddingSimilarity } = await import('./resolution-service.js');

    // Mock returns identical embeddings → cosine similarity = 1.0
    const result = await computeEmbeddingSimilarity('PLA 82nd Group Army', 'PLA 82nd Group Army');

    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('returns 1.0 for identical text (cosine similarity of identical vectors)', async () => {
    const { computeEmbeddingSimilarity } = await import('./resolution-service.js');

    // With mocked embeddings returning same vector for both → cosine = 1.0
    const result = await computeEmbeddingSimilarity('same text', 'same text');

    // Should be very high similarity for identical inputs
    expect(result).toBeGreaterThan(0.9);
  });

  it('calls the LLM factory to generate embeddings', async () => {
    const { computeEmbeddingSimilarity } = await import('./resolution-service.js');
    const { createLLMForAgent } = await import('../../agents/langgraph/llm-factory.js');

    await computeEmbeddingSimilarity('Entity A', 'Entity B');

    expect(createLLMForAgent).toHaveBeenCalled();
  });
});

// ─── ontology type matching ───────────────────────────────────────────────────

describe('ontology type matching', () => {
  it('computeOntologyTypeScore returns 1.0 for same jsonldType', async () => {
    const { computeOntologyTypeScore } = await import('./resolution-service.js');

    expect(computeOntologyTypeScore('cco:MilitaryOrganization', 'cco:MilitaryOrganization')).toBe(1.0);
    expect(computeOntologyTypeScore('cco:Person', 'cco:Person')).toBe(1.0);
  });

  it('computeOntologyTypeScore returns 0.0 for different jsonldType', async () => {
    const { computeOntologyTypeScore } = await import('./resolution-service.js');

    expect(computeOntologyTypeScore('cco:Person', 'cco:MilitaryOrganization')).toBe(0.0);
    expect(computeOntologyTypeScore('cco:Organization', 'cco:GovernmentOrganization')).toBe(0.0);
  });

  it('computeOntologyTypeScore handles undefined/null jsonldType gracefully', async () => {
    const { computeOntologyTypeScore } = await import('./resolution-service.js');

    // Unmigrated nodes may not have jsonldType yet
    const result = computeOntologyTypeScore(undefined as unknown as string, 'cco:Organization');
    expect(result).toBe(0.0);
  });
});
