/**
 * Behavioral Tests for COP Coordinator Graph Routing
 *
 * Tests that the coordinator routes to the correct sub-agents based on
 * trigger context, handles errors gracefully, and produces complete results.
 *
 * All sub-agents and external services are mocked to avoid LLM calls.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock all sub-agents before importing coordinator
vi.mock('./layer-sub-agents/force-disposition.js', () => ({
  forceDispositionAgent: vi.fn(),
}));
vi.mock('./layer-sub-agents/objectives-overlay.js', () => ({
  objectivesOverlayAgent: vi.fn(),
}));
vi.mock('./layer-sub-agents/control-measures.js', () => ({
  controlMeasuresAgent: vi.fn(),
}));
vi.mock('./layer-sub-agents/intel-overlay.js', () => ({
  intelOverlayAgent: vi.fn(),
}));
vi.mock('./layer-sub-agents/logistics-overlay.js', () => ({
  logisticsOverlayAgent: vi.fn(),
}));
vi.mock('./layer-sub-agents/c2-overlay.js', () => ({
  c2OverlayAgent: vi.fn(),
}));

// Mock layer store
vi.mock('../layers/layer-store.js', () => ({
  layerStore: {
    createLayer: vi.fn(),
  },
  LayerStoreMemory: vi.fn(),
}));

// Mock event bus
vi.mock('../messaging/event-bus.js', () => ({
  copEventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// Mock CCO validator
vi.mock('../cco/cco-validator.js', () => ({
  validateCCOClass: vi.fn().mockReturnValue({ valid: true }),
  suggestCCOClass: vi.fn().mockReturnValue('cco:Entity'),
}));

// Mock entity linker module
vi.mock('../linkage/entity-linker.js', () => ({
  EntityLinker: vi.fn(),
}));

import { forceDispositionAgent } from './layer-sub-agents/force-disposition.js';
import { objectivesOverlayAgent } from './layer-sub-agents/objectives-overlay.js';
import { controlMeasuresAgent } from './layer-sub-agents/control-measures.js';
import { intelOverlayAgent } from './layer-sub-agents/intel-overlay.js';
import { logisticsOverlayAgent } from './layer-sub-agents/logistics-overlay.js';
import { c2OverlayAgent } from './layer-sub-agents/c2-overlay.js';
import { layerStore } from '../layers/layer-store.js';
import { copEventBus } from '../messaging/event-bus.js';
import { copCoordinatorGraph } from './cop-coordinator.js';
import type { COPLayerSpec } from '../layers/layer-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockSpec(
  layerType: COPLayerSpec['layerType'],
  symbolCount = 2,
): COPLayerSpec {
  return {
    layerId: `${layerType}-test-${Date.now()}`,
    layerType,
    workspaceId: 'ws-1',
    sectionId: 'sec-1',
    symbols: Array.from({ length: symbolCount }, (_, i) => ({
      entityId: `${layerType}-entity-${i}`,
      sidc: '10031000001100000000',
      position: { lat: 34.0 + i * 0.01, lng: -118.0 + i * 0.01 },
      designation: `Unit ${i}`,
      affiliation: 'friendly' as const,
      linkedEntities: [],
      ccoClass: 'cco:Entity',
      confidence: 0.85,
      sourceAuthority: 'DOCEX',
    })),
    controlMeasures: [],
    customAnnotations: [],
    temporalPhases: [],
    metadata: {
      generatedBy: `cop-${layerType}-001`,
      generatedAt: new Date().toISOString(),
      sourceDocumentIds: ['doc-1'],
      ccoValidated: true,
    },
  };
}

function setupAllAgentsSuccess(): void {
  (forceDispositionAgent as Mock).mockResolvedValue(createMockSpec('force_disposition'));
  (objectivesOverlayAgent as Mock).mockResolvedValue(createMockSpec('objectives'));
  (controlMeasuresAgent as Mock).mockResolvedValue(createMockSpec('control_measures'));
  (intelOverlayAgent as Mock).mockResolvedValue(createMockSpec('intel'));
  (logisticsOverlayAgent as Mock).mockResolvedValue(createMockSpec('logistics'));
  (c2OverlayAgent as Mock).mockResolvedValue(createMockSpec('c2'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('COP Coordinator Graph Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: layer store returns a mock layer
    (layerStore.createLayer as Mock).mockResolvedValue({
      id: 'LYR-test-001',
      workspaceId: 'ws-1',
      sectionId: 'sec-1',
      layerType: 'force_disposition',
      state: 'draft',
      currentVersion: 1,
      spec: {},
      auditTrail: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  it('routes to all 6 sub-agents when triggeredBy=manual with no targetAgents filter', async () => {
    setupAllAgentsSuccess();

    await copCoordinatorGraph.invoke({
      workspaceId: 'ws-1',
      sectionId: 'sec-1',
      triggeredBy: 'manual',
      triggerContext: {},
      documents: [],
      graphEntities: [],
    });

    // All 6 sub-agents should be called
    expect(forceDispositionAgent).toHaveBeenCalledTimes(1);
    expect(objectivesOverlayAgent).toHaveBeenCalledTimes(1);
    expect(controlMeasuresAgent).toHaveBeenCalledTimes(1);
    expect(intelOverlayAgent).toHaveBeenCalledTimes(1);
    expect(logisticsOverlayAgent).toHaveBeenCalledTimes(1);
    expect(c2OverlayAgent).toHaveBeenCalledTimes(1);
  });

  it('routes to only specified sub-agents when triggerContext contains targetAgents', async () => {
    setupAllAgentsSuccess();

    await copCoordinatorGraph.invoke({
      workspaceId: 'ws-1',
      sectionId: 'sec-1',
      triggeredBy: 'commit',
      triggerContext: { targetAgents: ['intel'] },
      documents: [],
      graphEntities: [],
    });

    // Only intel agent should be called
    expect(intelOverlayAgent).toHaveBeenCalledTimes(1);
    expect(forceDispositionAgent).not.toHaveBeenCalled();
    expect(objectivesOverlayAgent).not.toHaveBeenCalled();
    expect(controlMeasuresAgent).not.toHaveBeenCalled();
    expect(logisticsOverlayAgent).not.toHaveBeenCalled();
    expect(c2OverlayAgent).not.toHaveBeenCalled();
  });

  it('sets status to error and persists with error when all sub-agents fail', async () => {
    (forceDispositionAgent as Mock).mockRejectedValue(new Error('Failed'));
    (objectivesOverlayAgent as Mock).mockRejectedValue(new Error('Failed'));
    (controlMeasuresAgent as Mock).mockRejectedValue(new Error('Failed'));
    (intelOverlayAgent as Mock).mockRejectedValue(new Error('Failed'));
    (logisticsOverlayAgent as Mock).mockRejectedValue(new Error('Failed'));
    (c2OverlayAgent as Mock).mockRejectedValue(new Error('Failed'));

    const result = await copCoordinatorGraph.invoke({
      workspaceId: 'ws-1',
      sectionId: 'sec-1',
      triggeredBy: 'manual',
      triggerContext: {},
      documents: [],
      graphEntities: [],
    });

    expect(result.status).toBe('error');
    expect(result.errors.length).toBeGreaterThan(0);

    // Should emit error completion event
    expect(copEventBus.emit).toHaveBeenCalledWith(
      'layer:generation:complete',
      expect.objectContaining({ status: 'error' }),
    );
  });

  it('continues with partial results when some sub-agents fail', async () => {
    // Some succeed, some fail
    (forceDispositionAgent as Mock).mockResolvedValue(createMockSpec('force_disposition'));
    (objectivesOverlayAgent as Mock).mockRejectedValue(new Error('Failed'));
    (controlMeasuresAgent as Mock).mockResolvedValue(createMockSpec('control_measures'));
    (intelOverlayAgent as Mock).mockRejectedValue(new Error('Failed'));
    (logisticsOverlayAgent as Mock).mockResolvedValue(createMockSpec('logistics'));
    (c2OverlayAgent as Mock).mockRejectedValue(new Error('Failed'));

    const result = await copCoordinatorGraph.invoke({
      workspaceId: 'ws-1',
      sectionId: 'sec-1',
      triggeredBy: 'manual',
      triggerContext: {},
      documents: [],
      graphEntities: [],
    });

    // Should complete successfully with partial results
    expect(result.status).toBe('complete');
    expect(result.assembledLayers).not.toBeNull();

    // Layer store should have been called to persist
    expect(layerStore.createLayer).toHaveBeenCalledTimes(1);

    // Some errors should be recorded
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('persists draft layer on successful generation', async () => {
    setupAllAgentsSuccess();

    const result = await copCoordinatorGraph.invoke({
      workspaceId: 'ws-1',
      sectionId: 'sec-1',
      triggeredBy: 'manual',
      triggerContext: {},
      documents: [],
      graphEntities: [],
    });

    expect(result.status).toBe('complete');
    expect(result.assembledLayers).not.toBeNull();
    expect(layerStore.createLayer).toHaveBeenCalledTimes(1);
    expect(layerStore.createLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        sectionId: 'sec-1',
      }),
    );
  });

  it('emits layer:generation:complete on success', async () => {
    setupAllAgentsSuccess();

    await copCoordinatorGraph.invoke({
      workspaceId: 'ws-1',
      sectionId: 'sec-1',
      triggeredBy: 'manual',
      triggerContext: {},
      documents: [],
      graphEntities: [],
    });

    expect(copEventBus.emit).toHaveBeenCalledWith(
      'layer:generation:complete',
      expect.objectContaining({
        layerId: 'LYR-test-001',
        status: 'success',
      }),
    );
  });
});
