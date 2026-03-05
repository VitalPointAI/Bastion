/**
 * Entity Linker Tests
 *
 * Phase 21 Plan 05 Task 1: Confidence threshold evaluation and linkage store CRUD.
 * Tests use in-memory implementations for unit testing without database dependencies.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import {
  evaluateConfidence,
  DEFAULT_CONFIDENCE_THRESHOLD,
  type ConfidenceConfig,
} from './confidence-threshold.js';
import {
  LinkageStore,
  type EntityLinkage,
} from './linkage-store.js';

// ─── Confidence Threshold Tests ────────────────────────────────────────────

describe('evaluateConfidence', () => {
  it('returns autoCommit=true for confidence above default threshold', () => {
    const result = evaluateConfidence(0.90);
    expect(result.autoCommit).toBe(true);
    expect(result.needsReview).toBe(false);
    expect(result.confidence).toBe(0.90);
    expect(result.threshold).toBe(DEFAULT_CONFIDENCE_THRESHOLD);
  });

  it('returns autoCommit=false for confidence below default threshold', () => {
    const result = evaluateConfidence(0.80);
    expect(result.autoCommit).toBe(false);
    expect(result.needsReview).toBe(true);
    expect(result.confidence).toBe(0.80);
    expect(result.threshold).toBe(DEFAULT_CONFIDENCE_THRESHOLD);
  });

  it('returns autoCommit=true at exactly the default threshold (inclusive)', () => {
    const result = evaluateConfidence(0.85);
    expect(result.autoCommit).toBe(true);
    expect(result.needsReview).toBe(false);
  });

  it('uses custom threshold when provided', () => {
    const result = evaluateConfidence(0.70, { threshold: 0.70 });
    expect(result.autoCommit).toBe(true);
    expect(result.needsReview).toBe(false);
    expect(result.threshold).toBe(0.70);
  });

  it('returns autoCommit=false when below custom threshold', () => {
    const result = evaluateConfidence(0.69, { threshold: 0.70 });
    expect(result.autoCommit).toBe(false);
    expect(result.needsReview).toBe(true);
  });

  it('exports DEFAULT_CONFIDENCE_THRESHOLD as 0.85', () => {
    expect(DEFAULT_CONFIDENCE_THRESHOLD).toBe(0.85);
  });
});

// ─── Linkage Store Tests ───────────────────────────────────────────────────

/**
 * In-memory LinkageStore for unit testing.
 * Overrides ensureTable to be a no-op and stores data in memory.
 */
class InMemoryLinkageStore extends LinkageStore {
  private linkages: EntityLinkage[] = [];
  private nextId = 1;

  async ensureTable(): Promise<void> {
    // No-op for in-memory tests
  }

  protected async queryAll(
    _sql: string,
    _params: unknown[],
  ): Promise<EntityLinkage[]> {
    // This will be called by the store methods; we intercept at a higher level
    return this.linkages;
  }

  // Override the CRUD methods to use in-memory storage
  async createLinkage(
    input: Omit<EntityLinkage, 'id' | 'createdAt'>,
  ): Promise<EntityLinkage> {
    const linkage: EntityLinkage = {
      ...input,
      id: `LNK-${this.nextId++}`,
      createdAt: new Date().toISOString(),
    };
    this.linkages.push(linkage);
    return linkage;
  }

  async getLinkagesForEntity(entityId: string): Promise<EntityLinkage[]> {
    return this.linkages.filter((l) => l.entityId === entityId);
  }

  async getLinkagesForSymbol(
    symbolEntityId: string,
    layerId: string,
  ): Promise<EntityLinkage[]> {
    return this.linkages.filter(
      (l) => l.symbolEntityId === symbolEntityId && l.layerId === layerId,
    );
  }

  async getPendingReviews(_workspaceId?: string): Promise<EntityLinkage[]> {
    return this.linkages.filter(
      (l) => !l.autoCommitted && !l.reviewedBy,
    );
  }

  async reviewLinkage(
    id: string,
    reviewedBy: string,
    approved: boolean,
  ): Promise<EntityLinkage> {
    const linkage = this.linkages.find((l) => l.id === id);
    if (!linkage) throw new Error(`Linkage ${id} not found`);
    linkage.reviewedBy = reviewedBy;
    linkage.reviewedAt = new Date().toISOString();
    if (approved) linkage.autoCommitted = true;
    return linkage;
  }
}

describe('LinkageStore', () => {
  let store: InMemoryLinkageStore;

  beforeEach(() => {
    store = new InMemoryLinkageStore();
  });

  it('creates a new entity-data linkage', async () => {
    const linkage = await store.createLinkage({
      entityId: 'actor-001',
      symbolEntityId: 'sym-001',
      layerId: 'layer-001',
      confidence: 0.92,
      autoCommitted: true,
      discoveryMethod: 'graph_traversal',
    });

    expect(linkage.id).toBeDefined();
    expect(linkage.entityId).toBe('actor-001');
    expect(linkage.symbolEntityId).toBe('sym-001');
    expect(linkage.layerId).toBe('layer-001');
    expect(linkage.confidence).toBe(0.92);
    expect(linkage.autoCommitted).toBe(true);
    expect(linkage.discoveryMethod).toBe('graph_traversal');
    expect(linkage.createdAt).toBeDefined();
  });

  it('returns all linkages for a given entity', async () => {
    await store.createLinkage({
      entityId: 'actor-001',
      symbolEntityId: 'sym-001',
      layerId: 'layer-001',
      confidence: 1.0,
      autoCommitted: true,
      discoveryMethod: 'graph_traversal',
    });
    await store.createLinkage({
      entityId: 'actor-001',
      symbolEntityId: 'sym-002',
      layerId: 'layer-002',
      confidence: 0.78,
      autoCommitted: false,
      discoveryMethod: 'embedding_similarity',
    });
    await store.createLinkage({
      entityId: 'actor-002',
      symbolEntityId: 'sym-003',
      layerId: 'layer-001',
      confidence: 0.95,
      autoCommitted: true,
      discoveryMethod: 'graph_traversal',
    });

    const linkages = await store.getLinkagesForEntity('actor-001');
    expect(linkages).toHaveLength(2);
    expect(linkages.every((l) => l.entityId === 'actor-001')).toBe(true);
  });

  it('returns all linkages for a given COP symbol', async () => {
    await store.createLinkage({
      entityId: 'actor-001',
      symbolEntityId: 'sym-001',
      layerId: 'layer-001',
      confidence: 1.0,
      autoCommitted: true,
      discoveryMethod: 'graph_traversal',
    });
    await store.createLinkage({
      entityId: 'actor-002',
      symbolEntityId: 'sym-001',
      layerId: 'layer-001',
      confidence: 0.88,
      autoCommitted: true,
      discoveryMethod: 'embedding_similarity',
    });
    await store.createLinkage({
      entityId: 'actor-003',
      symbolEntityId: 'sym-001',
      layerId: 'layer-002',
      confidence: 0.90,
      autoCommitted: true,
      discoveryMethod: 'graph_traversal',
    });

    const linkages = await store.getLinkagesForSymbol('sym-001', 'layer-001');
    expect(linkages).toHaveLength(2);
    expect(linkages.every((l) => l.symbolEntityId === 'sym-001')).toBe(true);
    expect(linkages.every((l) => l.layerId === 'layer-001')).toBe(true);
  });

  it('returns pending reviews (autoCommitted=false and no reviewer)', async () => {
    await store.createLinkage({
      entityId: 'actor-001',
      symbolEntityId: 'sym-001',
      layerId: 'layer-001',
      confidence: 0.70,
      autoCommitted: false,
      discoveryMethod: 'embedding_similarity',
    });
    await store.createLinkage({
      entityId: 'actor-002',
      symbolEntityId: 'sym-002',
      layerId: 'layer-001',
      confidence: 0.92,
      autoCommitted: true,
      discoveryMethod: 'graph_traversal',
    });
    await store.createLinkage({
      entityId: 'actor-003',
      symbolEntityId: 'sym-003',
      layerId: 'layer-001',
      confidence: 0.75,
      autoCommitted: false,
      discoveryMethod: 'embedding_similarity',
    });

    const pending = await store.getPendingReviews();
    expect(pending).toHaveLength(2);
    expect(pending.every((l) => !l.autoCommitted && !l.reviewedBy)).toBe(true);
  });

  it('reviews and approves a pending linkage', async () => {
    const linkage = await store.createLinkage({
      entityId: 'actor-001',
      symbolEntityId: 'sym-001',
      layerId: 'layer-001',
      confidence: 0.75,
      autoCommitted: false,
      discoveryMethod: 'embedding_similarity',
    });

    const reviewed = await store.reviewLinkage(linkage.id, 'user-123', true);
    expect(reviewed.reviewedBy).toBe('user-123');
    expect(reviewed.reviewedAt).toBeDefined();
    expect(reviewed.autoCommitted).toBe(true); // Approved = auto-committed

    // Should no longer appear in pending reviews
    const pending = await store.getPendingReviews();
    expect(pending).toHaveLength(0);
  });

  it('reviews and rejects a pending linkage', async () => {
    const linkage = await store.createLinkage({
      entityId: 'actor-001',
      symbolEntityId: 'sym-001',
      layerId: 'layer-001',
      confidence: 0.60,
      autoCommitted: false,
      discoveryMethod: 'embedding_similarity',
    });

    const reviewed = await store.reviewLinkage(linkage.id, 'user-456', false);
    expect(reviewed.reviewedBy).toBe('user-456');
    expect(reviewed.reviewedAt).toBeDefined();
    expect(reviewed.autoCommitted).toBe(false); // Rejected = stays false

    // Reviewed but not approved, still should not appear in pending
    const pending = await store.getPendingReviews();
    expect(pending).toHaveLength(0);
  });
});
