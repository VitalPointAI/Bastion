/**
 * Tests for COP layer store with lifecycle state machine.
 *
 * Uses in-memory store implementation for unit testing.
 * Covers: CRUD, lifecycle transitions, audit trail, review feedback.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LayerStoreMemory } from './layer-store.js';
import type {
  CreateLayerInput,
  COPLayerSpec,
  ReviewFeedback,
} from './layer-types.js';

function makeSpec(overrides: Partial<COPLayerSpec> = {}): COPLayerSpec {
  return {
    layerId: 'spec-1',
    layerType: 'force_disposition',
    workspaceId: 'ws-1',
    sectionId: 'sec-1',
    symbols: [],
    controlMeasures: [],
    customAnnotations: [],
    temporalPhases: [],
    metadata: {
      generatedBy: 'test-agent',
      generatedAt: new Date().toISOString(),
      sourceDocumentIds: ['doc-1'],
      ccoValidated: true,
    },
    ...overrides,
  };
}

function makeCreateInput(overrides: Partial<CreateLayerInput> = {}): CreateLayerInput {
  return {
    workspaceId: 'ws-1',
    sectionId: 'sec-1',
    layerType: 'force_disposition',
    spec: makeSpec(),
    ...overrides,
  };
}

describe('LayerStoreMemory', () => {
  let store: LayerStoreMemory;

  beforeEach(() => {
    store = new LayerStoreMemory();
  });

  // ---- CRUD ----

  describe('createLayer', () => {
    it('creates a new layer in draft state with version 1', async () => {
      const layer = await store.createLayer(makeCreateInput());
      expect(layer.id).toBeDefined();
      expect(layer.state).toBe('draft');
      expect(layer.currentVersion).toBe(1);
      expect(layer.workspaceId).toBe('ws-1');
      expect(layer.sectionId).toBe('sec-1');
      expect(layer.layerType).toBe('force_disposition');
      expect(layer.auditTrail).toHaveLength(1);
      expect(layer.auditTrail[0].action).toBe('created');
    });
  });

  describe('getLayer', () => {
    it('returns the layer by id', async () => {
      const created = await store.createLayer(makeCreateInput());
      const fetched = await store.getLayer(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
    });

    it('returns null for non-existent id', async () => {
      const fetched = await store.getLayer('non-existent');
      expect(fetched).toBeNull();
    });
  });

  describe('queryLayers', () => {
    it('filters by workspaceId', async () => {
      await store.createLayer(makeCreateInput({ workspaceId: 'ws-1' }));
      await store.createLayer(makeCreateInput({ workspaceId: 'ws-2' }));
      const results = await store.queryLayers({ workspaceId: 'ws-1' });
      expect(results).toHaveLength(1);
      expect(results[0].workspaceId).toBe('ws-1');
    });

    it('filters by sectionId', async () => {
      await store.createLayer(makeCreateInput({ sectionId: 'sec-a' }));
      await store.createLayer(makeCreateInput({ sectionId: 'sec-b' }));
      const results = await store.queryLayers({ sectionId: 'sec-a' });
      expect(results).toHaveLength(1);
    });

    it('filters by state', async () => {
      const layer = await store.createLayer(makeCreateInput());
      await store.transitionLayer({ layerId: layer.id, targetState: 'review', performedBy: 'user-1' });
      await store.createLayer(makeCreateInput());
      const results = await store.queryLayers({ state: 'review' });
      expect(results).toHaveLength(1);
    });

    it('filters by layerType', async () => {
      await store.createLayer(makeCreateInput({ layerType: 'force_disposition' }));
      await store.createLayer(makeCreateInput({ layerType: 'intel' }));
      const results = await store.queryLayers({ layerType: 'intel' });
      expect(results).toHaveLength(1);
    });

    it('returns all layers with no filters', async () => {
      await store.createLayer(makeCreateInput());
      await store.createLayer(makeCreateInput());
      const results = await store.queryLayers({});
      expect(results).toHaveLength(2);
    });
  });

  // ---- Lifecycle State Machine ----

  describe('transitionLayer', () => {
    it('draft -> review succeeds', async () => {
      const layer = await store.createLayer(makeCreateInput());
      const transitioned = await store.transitionLayer({
        layerId: layer.id,
        targetState: 'review',
        performedBy: 'user-1',
      });
      expect(transitioned.state).toBe('review');
    });

    it('draft -> published fails (must go through review)', async () => {
      const layer = await store.createLayer(makeCreateInput());
      await expect(
        store.transitionLayer({
          layerId: layer.id,
          targetState: 'published',
          performedBy: 'user-1',
        })
      ).rejects.toThrow(/invalid transition/i);
    });

    it('review -> published succeeds', async () => {
      const layer = await store.createLayer(makeCreateInput());
      await store.transitionLayer({ layerId: layer.id, targetState: 'review', performedBy: 'user-1' });
      const published = await store.transitionLayer({
        layerId: layer.id,
        targetState: 'published',
        performedBy: 'user-1',
      });
      expect(published.state).toBe('published');
    });

    it('review -> draft succeeds (revision)', async () => {
      const layer = await store.createLayer(makeCreateInput());
      await store.transitionLayer({ layerId: layer.id, targetState: 'review', performedBy: 'user-1' });
      const revised = await store.transitionLayer({
        layerId: layer.id,
        targetState: 'draft',
        performedBy: 'user-1',
      });
      expect(revised.state).toBe('draft');
    });

    it('published -> cop succeeds (promote)', async () => {
      const layer = await store.createLayer(makeCreateInput());
      await store.transitionLayer({ layerId: layer.id, targetState: 'review', performedBy: 'user-1' });
      await store.transitionLayer({ layerId: layer.id, targetState: 'published', performedBy: 'user-1' });
      const promoted = await store.transitionLayer({
        layerId: layer.id,
        targetState: 'cop',
        performedBy: 'commander-1',
      });
      expect(promoted.state).toBe('cop');
      expect(promoted.promotedBy).toBe('commander-1');
      expect(promoted.promotedAt).toBeDefined();
    });

    it('cop -> review succeeds with reason (recall)', async () => {
      const layer = await store.createLayer(makeCreateInput());
      await store.transitionLayer({ layerId: layer.id, targetState: 'review', performedBy: 'user-1' });
      await store.transitionLayer({ layerId: layer.id, targetState: 'published', performedBy: 'user-1' });
      await store.transitionLayer({ layerId: layer.id, targetState: 'cop', performedBy: 'user-1' });
      const recalled = await store.transitionLayer({
        layerId: layer.id,
        targetState: 'review',
        performedBy: 'commander-1',
        reason: 'Intel update required',
      });
      expect(recalled.state).toBe('review');
      expect(recalled.recalledBy).toBe('commander-1');
      expect(recalled.recalledAt).toBeDefined();
      expect(recalled.recallReason).toBe('Intel update required');
    });

    it('cop -> review fails without reason', async () => {
      const layer = await store.createLayer(makeCreateInput());
      await store.transitionLayer({ layerId: layer.id, targetState: 'review', performedBy: 'user-1' });
      await store.transitionLayer({ layerId: layer.id, targetState: 'published', performedBy: 'user-1' });
      await store.transitionLayer({ layerId: layer.id, targetState: 'cop', performedBy: 'user-1' });
      await expect(
        store.transitionLayer({
          layerId: layer.id,
          targetState: 'review',
          performedBy: 'commander-1',
        })
      ).rejects.toThrow(/reason.*required/i);
    });

    it('each transition creates an AuditEntry', async () => {
      const layer = await store.createLayer(makeCreateInput());
      const transitioned = await store.transitionLayer({
        layerId: layer.id,
        targetState: 'review',
        performedBy: 'user-1',
      });
      // 1 from creation + 1 from transition
      expect(transitioned.auditTrail).toHaveLength(2);
      const lastEntry = transitioned.auditTrail[transitioned.auditTrail.length - 1];
      expect(lastEntry.action).toBe('transition:draft->review');
      expect(lastEntry.performedBy).toBe('user-1');
    });

    it('throws for non-existent layer', async () => {
      await expect(
        store.transitionLayer({
          layerId: 'non-existent',
          targetState: 'review',
          performedBy: 'user-1',
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  // ---- Spec Updates ----

  describe('updateLayerSpec', () => {
    it('updates spec and increments version', async () => {
      const layer = await store.createLayer(makeCreateInput());
      const newSpec = makeSpec({ layerId: layer.id });
      newSpec.symbols = [
        {
          entityId: 'ent-1',
          sidc: '10031000001211000000',
          position: { lat: 34.0, lng: -118.0 },
          designation: '1st BN',
          affiliation: 'friendly',
          linkedEntities: [],
          ccoClass: 'cco:MilitaryOrganization',
          confidence: 0.95,
          sourceAuthority: 'HUMINT',
        },
      ];
      const updated = await store.updateLayerSpec(layer.id, newSpec);
      expect(updated.currentVersion).toBe(2);
      expect(updated.spec.symbols).toHaveLength(1);
    });
  });

  // ---- Review Feedback ----

  describe('addReviewFeedback', () => {
    it('appends feedback to layer', async () => {
      const layer = await store.createLayer(makeCreateInput());
      const feedback: ReviewFeedback = {
        id: 'fb-1',
        layerId: layer.id,
        type: 'general_comment',
        content: 'Revise positions for 2nd BDE',
        createdBy: 'reviewer-1',
        createdAt: new Date().toISOString(),
      };
      const updated = await store.addReviewFeedback(layer.id, feedback);
      expect(updated.reviewFeedback).toHaveLength(1);
      expect(updated.reviewFeedback![0].content).toBe('Revise positions for 2nd BDE');
    });

    it('appends multiple feedback entries', async () => {
      const layer = await store.createLayer(makeCreateInput());
      const fb1: ReviewFeedback = {
        id: 'fb-1', layerId: layer.id, type: 'general_comment',
        content: 'First comment', createdBy: 'r1', createdAt: new Date().toISOString(),
      };
      const fb2: ReviewFeedback = {
        id: 'fb-2', layerId: layer.id, type: 'spatial_annotation',
        content: 'Move unit north', createdBy: 'r2', createdAt: new Date().toISOString(),
        position: { lat: 34.0, lng: -118.0 }, entityId: 'ent-1',
      };
      await store.addReviewFeedback(layer.id, fb1);
      const updated = await store.addReviewFeedback(layer.id, fb2);
      expect(updated.reviewFeedback).toHaveLength(2);
    });
  });
});
