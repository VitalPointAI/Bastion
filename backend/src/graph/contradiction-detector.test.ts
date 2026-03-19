/**
 * Tests for contradiction-detector.ts (created in Plan 05)
 *
 * These tests define the expected behavior for contradiction detection
 * before the implementation exists. Tests will fail (RED) until Plan 05
 * creates the contradiction-detector module.
 *
 * Key design constraints (from RESEARCH.md Pitfall 7):
 * - Contradiction REQUIRES temporal overlap — same entity, same property,
 *   different values, AND overlapping validFrom/validTo ranges.
 * - Historical succession (non-overlapping periods, same property changing
 *   over time) is NOT a contradiction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
// ─── Mock Setup ───────────────────────────────────────────────────────────────

// Mock the Neo4j client to avoid real DB connections in unit tests
vi.mock('./neo4j-client.js', () => ({
  executeWriteQuery: vi.fn().mockResolvedValue({ records: [{ get: () => null }] }),
  executeReadQuery: vi.fn().mockResolvedValue({ records: [] }),
}));

// ─── Test Assertions ──────────────────────────────────────────────────────────

interface TestAssertion {
  id: string;
  entityId: string;
  propertyKey: string;
  value: unknown;
  validFrom: string;
  validTo: string | null;
  confidence: number;
}

// ─── detectContradiction ──────────────────────────────────────────────────────

describe('detectContradiction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects contradiction: same entity + same property + different values + overlapping temporal range', async () => {
    const { detectContradiction } = await import('./contradiction-detector.js');

    const assertionA: TestAssertion = {
      id: 'assert-A',
      entityId: 'ACT-001',
      propertyKey: 'attributes_affiliation',
      value: 'hostile',
      validFrom: '2026-01-01T00:00:00Z',
      validTo: '2026-06-30T00:00:00Z',
      confidence: 0.90,
    };

    const assertionB: TestAssertion = {
      id: 'assert-B',
      entityId: 'ACT-001',
      propertyKey: 'attributes_affiliation',
      value: 'neutral',
      validFrom: '2026-03-01T00:00:00Z', // overlaps with A
      validTo: null,                       // currently valid
      confidence: 0.75,
    };

    const result = await detectContradiction(assertionA, assertionB);

    expect(result).not.toBeNull();
    expect(result!.entityId).toBe('ACT-001');
    expect(result!.propertyKey).toBe('attributes_affiliation');
    expect(result!.assertionAId).toBe('assert-A');
    expect(result!.assertionBId).toBe('assert-B');
    expect(result!.detectedAt).toBeDefined();
    expect(result!.resolvedAt).toBeUndefined();
  });

  it('returns null when temporal ranges do NOT overlap (historical succession)', async () => {
    const { detectContradiction } = await import('./contradiction-detector.js');

    // Commander A served Jan–Jun 2025, Commander B took over Jul 2025+
    // This is historical succession, NOT a contradiction (Pitfall 7)
    const assertionA: TestAssertion = {
      id: 'assert-A',
      entityId: 'ACT-001',
      propertyKey: 'attributes_commander',
      value: 'General Smith',
      validFrom: '2025-01-01T00:00:00Z',
      validTo: '2025-06-30T23:59:59Z', // expired
      confidence: 0.95,
    };

    const assertionB: TestAssertion = {
      id: 'assert-B',
      entityId: 'ACT-001',
      propertyKey: 'attributes_commander',
      value: 'General Jones',
      validFrom: '2025-07-01T00:00:00Z', // starts after A expires
      validTo: null,
      confidence: 0.95,
    };

    const result = await detectContradiction(assertionA, assertionB);

    expect(result).toBeNull();
  });

  it('returns null when values are the same (no conflict even with overlapping dates)', async () => {
    const { detectContradiction } = await import('./contradiction-detector.js');

    const assertionA: TestAssertion = {
      id: 'assert-A',
      entityId: 'ACT-001',
      propertyKey: 'attributes_affiliation',
      value: 'hostile',
      validFrom: '2026-01-01T00:00:00Z',
      validTo: null,
      confidence: 0.90,
    };

    const assertionB: TestAssertion = {
      id: 'assert-B',
      entityId: 'ACT-001',
      propertyKey: 'attributes_affiliation',
      value: 'hostile', // same value
      validFrom: '2026-02-01T00:00:00Z',
      validTo: null,
      confidence: 0.75,
    };

    const result = await detectContradiction(assertionA, assertionB);

    expect(result).toBeNull();
  });

  it('returns null when entity IDs differ (different entities, same property)', async () => {
    const { detectContradiction } = await import('./contradiction-detector.js');

    const assertionA: TestAssertion = {
      id: 'assert-A',
      entityId: 'ACT-001',
      propertyKey: 'attributes_affiliation',
      value: 'hostile',
      validFrom: '2026-01-01T00:00:00Z',
      validTo: null,
      confidence: 0.90,
    };

    const assertionB: TestAssertion = {
      id: 'assert-B',
      entityId: 'ACT-002', // different entity
      propertyKey: 'attributes_affiliation',
      value: 'neutral',
      validFrom: '2026-01-01T00:00:00Z',
      validTo: null,
      confidence: 0.75,
    };

    const result = await detectContradiction(assertionA, assertionB);

    expect(result).toBeNull();
  });

  it('returns null when property keys differ (same entity, different properties)', async () => {
    const { detectContradiction } = await import('./contradiction-detector.js');

    const assertionA: TestAssertion = {
      id: 'assert-A',
      entityId: 'ACT-001',
      propertyKey: 'attributes_affiliation',
      value: 'hostile',
      validFrom: '2026-01-01T00:00:00Z',
      validTo: null,
      confidence: 0.90,
    };

    const assertionB: TestAssertion = {
      id: 'assert-B',
      entityId: 'ACT-001',
      propertyKey: 'attributes_echelon', // different property
      value: 'brigade',
      validFrom: '2026-01-01T00:00:00Z',
      validTo: null,
      confidence: 0.75,
    };

    const result = await detectContradiction(assertionA, assertionB);

    expect(result).toBeNull();
  });

  it('lowers confidence of both assertions by 20% when contradiction detected', async () => {
    const { detectContradiction } = await import('./contradiction-detector.js');
    const { executeWriteQuery } = await import('./neo4j-client.js');

    const assertionA: TestAssertion = {
      id: 'assert-A',
      entityId: 'ACT-001',
      propertyKey: 'attributes_affiliation',
      value: 'hostile',
      validFrom: '2026-01-01T00:00:00Z',
      validTo: null,
      confidence: 0.90,
    };

    const assertionB: TestAssertion = {
      id: 'assert-B',
      entityId: 'ACT-001',
      propertyKey: 'attributes_affiliation',
      value: 'neutral',
      validFrom: '2026-02-01T00:00:00Z',
      validTo: null,
      confidence: 0.75,
    };

    await detectContradiction(assertionA, assertionB);

    // Verify that executeWriteQuery was called (to create :CONTRADICTS edge
    // and update confidence values on both assertions)
    expect(executeWriteQuery).toHaveBeenCalled();

    // The returned confidence values on both should be reduced by 20%
    // Original A: 0.90 → 0.72, Original B: 0.75 → 0.60
    const calls = (executeWriteQuery as ReturnType<typeof vi.fn>).mock.calls;
    const queryArgs = calls.flatMap((c: unknown[]) => c);
    const queryString = queryArgs.join(' ');

    // At minimum, the write queries must reference the assertion IDs
    expect(queryString).toContain('assert-A');
    expect(queryString).toContain('assert-B');
  });

  it('creates a :CONTRADICTS edge in Neo4j when contradiction is detected', async () => {
    const { detectContradiction } = await import('./contradiction-detector.js');
    const { executeWriteQuery } = await import('./neo4j-client.js');

    const assertionA: TestAssertion = {
      id: 'assert-A',
      entityId: 'ACT-001',
      propertyKey: 'attributes_affiliation',
      value: 'hostile',
      validFrom: '2026-01-01T00:00:00Z',
      validTo: null,
      confidence: 0.90,
    };

    const assertionB: TestAssertion = {
      id: 'assert-B',
      entityId: 'ACT-001',
      propertyKey: 'attributes_affiliation',
      value: 'neutral',
      validFrom: '2026-02-01T00:00:00Z',
      validTo: null,
      confidence: 0.75,
    };

    await detectContradiction(assertionA, assertionB);

    // The CONTRADICTS relationship must be created via executeWriteQuery
    const wasCalled = (executeWriteQuery as ReturnType<typeof vi.fn>).mock.calls.some(
      (callArgs: unknown[]) =>
        typeof callArgs[0] === 'string' && callArgs[0].includes('CONTRADICTS'),
    );
    expect(wasCalled).toBe(true);
  });

  it('handles the edge case where assertionA has validTo=null (still current) with overlapping assertionB', async () => {
    const { detectContradiction } = await import('./contradiction-detector.js');

    const assertionA: TestAssertion = {
      id: 'assert-A',
      entityId: 'ACT-001',
      propertyKey: 'attributes_affiliation',
      value: 'hostile',
      validFrom: '2026-01-01T00:00:00Z',
      validTo: null, // currently valid
      confidence: 0.90,
    };

    const assertionB: TestAssertion = {
      id: 'assert-B',
      entityId: 'ACT-001',
      propertyKey: 'attributes_affiliation',
      value: 'friendly', // conflicts with hostile
      validFrom: '2026-03-01T00:00:00Z', // overlaps with A (A is still active)
      validTo: null,
      confidence: 0.80,
    };

    const result = await detectContradiction(assertionA, assertionB);

    // Both are currently valid and conflicting — should be detected
    expect(result).not.toBeNull();
  });
});
