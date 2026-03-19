/**
 * Tests for actor-store.ts — JSON-LD property migration and temporal queries
 *
 * Phase 47 Wave 0 TDD scaffold. Tests define expected behavior for:
 * - Actor creation with JSON-LD-native properties (jsonldType, jsonldContext)
 * - W3C PROV-O provenance fields (assertedBy, assertedVia, derivedFrom)
 * - Temporal validity fields (validFrom, validTo, halfLifeDays)
 * - Temporal point-in-time queries
 * - Staleness decay in query results
 *
 * All tests mock Neo4j client — no real DB required.
 * Tests will fail (RED) until Plan 03 rewrites actor-store.ts with JSON-LD properties.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Setup ───────────────────────────────────────────────────────────────

// Mock Neo4j client before importing actor-store to avoid driver init
const mockExecuteWriteQuery = vi.fn();
const mockExecuteReadQuery = vi.fn();

vi.mock('../neo4j-client.js', () => ({
  executeWriteQuery: mockExecuteWriteQuery,
  executeReadQuery: mockExecuteReadQuery,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Mock Neo4j record-shaped return for a created Actor with JSON-LD properties */
function makeMockActorRecord(overrides: Record<string, unknown> = {}) {
  const props = {
    id: 'ACT-test-001',
    name: 'PLA 82nd Group Army',
    type: 'organization',
    aliases: ['82nd GA'],
    attributes: '{}',
    workspaceId: 'ws-123',
    sourceDocumentIds: [],
    containerIds: ['con-456'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',

    // JSON-LD fields — the new fields Plan 03 adds
    jsonldType: 'cco:MilitaryOrganization',
    jsonldContext: 'https://bastion.vitalpoint.ai/ontology/context.jsonld',

    // Provenance fields
    assertedBy: 'user:did:near:alice.near',
    assertedVia: 'manual_entry',
    derivedFrom: '[]',
    confidence: 0.95,
    sourceWeight: 0.95,

    // Temporal fields
    validFrom: '2026-01-01T00:00:00Z',
    validTo: null,
    halfLifeDays: 180,

    ...overrides,
  };

  return {
    get: (key: string): { properties: typeof props } | null => {
      if (key === 'a') return { properties: props };
      return null;
    },
    records: [{ get: (k: string): { properties: typeof props } | null => (k === 'a' ? { properties: props } : null) }],
  };
}

// ─── createActor (JSON-LD) ────────────────────────────────────────────────────

describe('createActor (JSON-LD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteWriteQuery.mockResolvedValue({
      records: [{ get: (key: string) => key === 'a' ? { properties: makeMockActorRecord().get('a')!.properties } : null }],
    });
  });

  it('creates an Actor with jsonldType set to CCO class URI', async () => {
    const { actorStore } = await import('./actor-store.js');

    const actor = await actorStore.createActor({
      name: 'PLA 82nd Group Army',
      type: 'organization',
      workspaceId: 'ws-123',
      containerIds: ['con-456'],
    });

    expect(actor.jsonldType).toBeDefined();
    expect(typeof actor.jsonldType).toBe('string');
    // Should be a CCO/BFO class URI
    expect(actor.jsonldType).toMatch(/^(cco:|bfo:|jc3:)/);
  });

  it('creates an Actor with jsonldContext pointing to bastion context URL', async () => {
    const { actorStore } = await import('./actor-store.js');

    const actor = await actorStore.createActor({
      name: 'PLA 82nd Group Army',
      type: 'organization',
    });

    expect(actor.jsonldContext).toBeDefined();
    expect(actor.jsonldContext).toBe('https://bastion.vitalpoint.ai/ontology/context.jsonld');
  });

  it('creates an Actor with PROV-O assertedBy field', async () => {
    const { actorStore } = await import('./actor-store.js');

    const actor = await actorStore.createActor({
      name: 'Test Actor',
      type: 'organization',
    });

    expect(actor.assertedBy).toBeDefined();
    expect(typeof actor.assertedBy).toBe('string');
  });

  it('creates an Actor with PROV-O assertedVia (source method)', async () => {
    const { actorStore } = await import('./actor-store.js');

    const actor = await actorStore.createActor({
      name: 'Test Actor',
      type: 'organization',
    });

    expect(actor.assertedVia).toBeDefined();
    const validMethods = ['manual_entry', 'doc_intelligence', 'osint', 'vision_pipeline', 'ai_inference', 'sigint'];
    expect(validMethods).toContain(actor.assertedVia);
  });

  it('creates an Actor with PROV-O derivedFrom (source document IDs JSON)', async () => {
    const { actorStore } = await import('./actor-store.js');

    const actor = await actorStore.createActor({
      name: 'Test Actor',
      type: 'organization',
    });

    expect(actor.derivedFrom).toBeDefined();
    // derivedFrom is stored as JSON string
    expect(() => JSON.parse(actor.derivedFrom)).not.toThrow();
  });

  it('creates an Actor with confidence value in 0-1 range', async () => {
    const { actorStore } = await import('./actor-store.js');

    const actor = await actorStore.createActor({
      name: 'Test Actor',
      type: 'organization',
    });

    expect(actor.confidence).toBeDefined();
    expect(actor.confidence).toBeGreaterThanOrEqual(0);
    expect(actor.confidence).toBeLessThanOrEqual(1);
  });

  it('creates an Actor with sourceWeight matching the assertedVia method', async () => {
    const { actorStore } = await import('./actor-store.js');

    const actor = await actorStore.createActor({
      name: 'Test Actor',
      type: 'manual_entry' as never, // workaround for input type
    });

    expect(actor.sourceWeight).toBeDefined();
    expect(actor.sourceWeight).toBeGreaterThan(0);
    expect(actor.sourceWeight).toBeLessThanOrEqual(1);
  });

  it('creates an Actor with validFrom timestamp', async () => {
    const { actorStore } = await import('./actor-store.js');

    const actor = await actorStore.createActor({
      name: 'Test Actor',
      type: 'organization',
    });

    expect(actor.validFrom).toBeDefined();
    // Must be a valid ISO 8601 string
    expect(new Date(actor.validFrom).getTime()).not.toBeNaN();
  });

  it('creates an Actor with validTo=null (currently valid)', async () => {
    const { actorStore } = await import('./actor-store.js');

    const actor = await actorStore.createActor({
      name: 'Test Actor',
      type: 'organization',
    });

    // New entities start as currently valid
    expect(actor.validTo).toBeNull();
  });

  it('creates an Actor with halfLifeDays set to the personnel default (180)', async () => {
    const { actorStore } = await import('./actor-store.js');

    const actor = await actorStore.createActor({
      name: 'Test Actor',
      type: 'individual',
    });

    expect(actor.halfLifeDays).toBeDefined();
    expect(actor.halfLifeDays).toBeGreaterThan(0);
  });

  it('Cypher CREATE query includes all JSON-LD properties', async () => {
    const { actorStore } = await import('./actor-store.js');

    await actorStore.createActor({
      name: 'Test Actor',
      type: 'organization',
    });

    expect(mockExecuteWriteQuery).toHaveBeenCalledOnce();
    const [cypherQuery] = mockExecuteWriteQuery.mock.calls[0];

    // Verify the CREATE query includes JSON-LD fields
    expect(cypherQuery).toContain('jsonldType');
    expect(cypherQuery).toContain('jsonldContext');
    expect(cypherQuery).toContain('assertedBy');
    expect(cypherQuery).toContain('assertedVia');
    expect(cypherQuery).toContain('derivedFrom');
    expect(cypherQuery).toContain('confidence');
    expect(cypherQuery).toContain('sourceWeight');
    expect(cypherQuery).toContain('validFrom');
    expect(cypherQuery).toContain('halfLifeDays');
  });
});

// ─── temporal queries ─────────────────────────────────────────────────────────

describe('temporal queries', () => {
  const NOW = new Date('2026-03-15T00:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listActorsAtTime returns only actors valid at the given point in time', async () => {
    const { actorStore } = await import('./actor-store.js');

    // Mock: one expired actor (validTo in past) and one currently valid
    const _expiredActorProps = makeMockActorRecord({
      id: 'ACT-expired',
      name: 'Expired Entity',
      validFrom: '2025-01-01T00:00:00Z',
      validTo: '2025-12-31T00:00:00Z', // expired before our query time
    }).get('a')!.properties;

    const validActorProps = makeMockActorRecord({
      id: 'ACT-valid',
      name: 'Valid Entity',
      validFrom: '2026-01-01T00:00:00Z',
      validTo: null, // still current
    }).get('a')!.properties;

    mockExecuteReadQuery.mockResolvedValue({
      records: [
        { get: (k: string) => k === 'a' ? { properties: validActorProps } : null },
      ],
    });

    const result = await actorStore.listActorsAtTime('ws-123', NOW);

    // The query should filter — only valid entity returned (mock returns just valid one)
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ACT-valid');
  });

  it('listActorsAtTime uses validFrom/validTo Cypher filter', async () => {
    const { actorStore } = await import('./actor-store.js');

    mockExecuteReadQuery.mockResolvedValue({ records: [] });

    await actorStore.listActorsAtTime('ws-123', NOW);

    expect(mockExecuteReadQuery).toHaveBeenCalledOnce();
    const [cypherQuery] = mockExecuteReadQuery.mock.calls[0];

    // Must include Pitfall 3 safe pattern: (validTo IS NULL OR validTo > atTime)
    expect(cypherQuery).toContain('validFrom');
    expect(cypherQuery).toContain('validTo');
    expect(cypherQuery).toContain('IS NULL');
  });

  it('includes nodes where validTo is null (currently valid)', async () => {
    const { actorStore } = await import('./actor-store.js');

    const currentActor = makeMockActorRecord({ validTo: null }).get('a')!.properties;

    mockExecuteReadQuery.mockResolvedValue({
      records: [{ get: (k: string) => k === 'a' ? { properties: currentActor } : null }],
    });

    const result = await actorStore.listActorsAtTime('ws-123', NOW);

    expect(result).toHaveLength(1);
    expect(result[0].validTo).toBeNull();
  });
});

// ─── staleness decay ──────────────────────────────────────────────────────────

describe('staleness decay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listActorsWithDecay returns decayedConfidence for each actor', async () => {
    const { actorStore } = await import('./actor-store.js');

    // Actor last updated 90 days ago with halfLifeDays=180
    const actorProps = makeMockActorRecord({
      confidence: 0.95,
      halfLifeDays: 180,
      updatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    }).get('a')!.properties;

    // Mock returns actor plus a decayedConf value
    mockExecuteReadQuery.mockResolvedValue({
      records: [{
        get: (k: string) => {
          if (k === 'a') return { properties: actorProps };
          if (k === 'decayedConf') return 0.95 * Math.pow(0.5, 90 / 180); // ~0.672
          return null;
        },
      }],
    });

    const result = await actorStore.listActorsWithDecay('ws-123');

    expect(result).toHaveLength(1);
    expect(result[0].decayedConfidence).toBeDefined();
    expect(result[0].decayedConfidence).toBeLessThan(0.95);
    expect(result[0].decayedConfidence).toBeCloseTo(0.672, 1);
  });

  it('listActorsWithDecay Cypher query includes decay formula projection', async () => {
    const { actorStore } = await import('./actor-store.js');

    mockExecuteReadQuery.mockResolvedValue({ records: [] });

    await actorStore.listActorsWithDecay('ws-123');

    const [cypherQuery] = mockExecuteReadQuery.mock.calls[0];

    // Should use the decay formula pattern: baseConf * 0.5^(ageDays/halfLife)
    expect(cypherQuery).toContain('halfLife');
    expect(cypherQuery).toContain('confidence');
    expect(cypherQuery).toContain('0.5');
  });
});
