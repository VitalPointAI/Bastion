/**
 * Tests for version store, layer assembler, and conflict detector.
 *
 * Covers: snapshot creation (full vs patch), reconstruction,
 * assembler merging/dedup, conflict detection with source authority.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { VersionStoreMemory } from './version-store.js';
import { LayerAssembler } from './layer-assembler.js';
import { ConflictDetector, detectConflicts } from './conflict-detector.js';
import type { COPLayerSpec, COPSymbolSpec } from './layer-types.js';
import type { COPLayer } from './layer-store.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeSymbol(overrides: Partial<COPSymbolSpec> = {}): COPSymbolSpec {
  return {
    entityId: 'ent-1',
    sidc: '10031000001211000000',
    position: { lat: 34.0, lng: -118.0 },
    designation: '1st BN',
    affiliation: 'friendly',
    linkedEntities: [],
    ccoClass: 'cco:MilitaryOrganization',
    confidence: 0.9,
    sourceAuthority: 'HUMINT',
    confidenceTier: 'high',
    ...overrides,
  };
}

function makeLayer(overrides: Partial<COPLayer> = {}): COPLayer {
  return {
    id: 'lyr-1',
    workspaceId: 'ws-1',
    sectionId: 'sec-1',
    layerType: 'force_disposition',
    state: 'cop',
    currentVersion: 1,
    spec: makeSpec(),
    auditTrail: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Version Store Tests
// ---------------------------------------------------------------------------

describe('VersionStoreMemory', () => {
  let store: VersionStoreMemory;

  beforeEach(() => {
    store = new VersionStoreMemory();
  });

  describe('createSnapshot', () => {
    it('saves full spec at COP promotion', async () => {
      const layer = makeLayer({ state: 'cop', currentVersion: 3 });
      const snapshot = await store.createSnapshot(layer, makeSpec());
      expect(snapshot.isFullSnapshot).toBe(true);
      expect(snapshot.specOrPatch).toEqual(layer.spec);
    });

    it('saves full spec when previousSpec is null', async () => {
      const layer = makeLayer({ state: 'review', currentVersion: 1 });
      const snapshot = await store.createSnapshot(layer, null);
      expect(snapshot.isFullSnapshot).toBe(true);
    });

    it('saves JSON patch diff for intermediate transitions', async () => {
      const prevSpec = makeSpec({ symbols: [] });
      const newSpec = makeSpec({
        symbols: [makeSymbol()],
      });
      const layer = makeLayer({ state: 'review', currentVersion: 2, spec: newSpec });
      const snapshot = await store.createSnapshot(layer, prevSpec);
      expect(snapshot.isFullSnapshot).toBe(false);
      // Patch should contain the changed fields
      expect(snapshot.specOrPatch).toBeDefined();
    });
  });

  describe('getSnapshot', () => {
    it('retrieves a specific version snapshot', async () => {
      const layer = makeLayer({ currentVersion: 1, state: 'draft' });
      await store.createSnapshot(layer, null);
      const snapshot = await store.getSnapshot(layer.id, 1);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.version).toBe(1);
      expect(snapshot!.layerId).toBe(layer.id);
    });

    it('returns null for non-existent version', async () => {
      const snapshot = await store.getSnapshot('lyr-1', 999);
      expect(snapshot).toBeNull();
    });
  });

  describe('listSnapshots', () => {
    it('returns all snapshots for a layer ordered by version', async () => {
      const layer1 = makeLayer({ currentVersion: 1, state: 'draft' });
      const layer2 = makeLayer({ currentVersion: 2, state: 'review' });
      const layer3 = makeLayer({ currentVersion: 3, state: 'cop' });

      await store.createSnapshot(layer1, null);
      await store.createSnapshot(layer2, layer1.spec);
      await store.createSnapshot(layer3, layer2.spec);

      const snapshots = await store.listSnapshots('lyr-1');
      expect(snapshots).toHaveLength(3);
      expect(snapshots[0].version).toBe(1);
      expect(snapshots[1].version).toBe(2);
      expect(snapshots[2].version).toBe(3);
    });
  });

  describe('reconstructAtVersion', () => {
    it('rebuilds spec from patches for non-COP versions', async () => {
      // Version 1: full snapshot (draft, no previous)
      const spec1 = makeSpec({ symbols: [] });
      const layer1 = makeLayer({ currentVersion: 1, state: 'draft', spec: spec1 });
      await store.createSnapshot(layer1, null);

      // Version 2: patch (added a symbol)
      const spec2 = makeSpec({
        symbols: [makeSymbol({ entityId: 'ent-1', designation: '1st BN' })],
      });
      const layer2 = makeLayer({ currentVersion: 2, state: 'review', spec: spec2 });
      await store.createSnapshot(layer2, spec1);

      // Reconstruct at version 2
      const reconstructed = await store.reconstructAtVersion('lyr-1', 2);
      expect(reconstructed).toBeDefined();
      expect(reconstructed.symbols).toHaveLength(1);
      expect(reconstructed.symbols[0].designation).toBe('1st BN');
    });

    it('returns full snapshot directly for COP version', async () => {
      const spec = makeSpec({ symbols: [makeSymbol()] });
      const layer = makeLayer({ currentVersion: 1, state: 'cop', spec });
      await store.createSnapshot(layer, null);

      const reconstructed = await store.reconstructAtVersion('lyr-1', 1);
      expect(reconstructed).toEqual(spec);
    });
  });
});

// ---------------------------------------------------------------------------
// Layer Assembler Tests
// ---------------------------------------------------------------------------

describe('LayerAssembler', () => {
  it('merges multiple sub-agent specs into one', () => {
    const spec1 = makeSpec({
      symbols: [makeSymbol({ entityId: 'ent-1', designation: '1st BN' })],
      controlMeasures: [{
        id: 'cm-1', type: 'boundary', points: [{ lat: 34, lng: -118 }],
        label: 'PL Alpha', phaseRange: { start: 1, end: 2 },
      }],
      temporalPhases: [{ phaseNumber: 1, label: 'Phase I' }],
      metadata: {
        generatedBy: 'agent-1', generatedAt: new Date().toISOString(),
        sourceDocumentIds: ['doc-1'], ccoValidated: true,
      },
    });
    const spec2 = makeSpec({
      symbols: [makeSymbol({ entityId: 'ent-2', designation: '2nd BDE' })],
      controlMeasures: [{
        id: 'cm-2', type: 'phase_line', points: [{ lat: 35, lng: -117 }],
        label: 'PL Bravo',
      }],
      temporalPhases: [{ phaseNumber: 2, label: 'Phase II' }],
      metadata: {
        generatedBy: 'agent-2', generatedAt: new Date().toISOString(),
        sourceDocumentIds: ['doc-2'], ccoValidated: true,
      },
    });

    const assembler = new LayerAssembler();
    const merged = assembler.assemble([spec1, spec2]);

    expect(merged.symbols).toHaveLength(2);
    expect(merged.controlMeasures).toHaveLength(2);
    expect(merged.temporalPhases).toHaveLength(2);
    expect(merged.metadata.generatedBy).toBe('cop-coordinator-001');
    expect(merged.metadata.sourceDocumentIds).toContain('doc-1');
    expect(merged.metadata.sourceDocumentIds).toContain('doc-2');
  });

  it('deduplicates symbols by entityId keeping highest confidence', () => {
    const spec1 = makeSpec({
      symbols: [makeSymbol({ entityId: 'ent-1', confidence: 0.7, designation: 'Low conf' })],
    });
    const spec2 = makeSpec({
      symbols: [makeSymbol({ entityId: 'ent-1', confidence: 0.95, designation: 'High conf' })],
    });

    const assembler = new LayerAssembler();
    const merged = assembler.assemble([spec1, spec2]);

    expect(merged.symbols).toHaveLength(1);
    expect(merged.symbols[0].confidence).toBe(0.95);
    expect(merged.symbols[0].designation).toBe('High conf');
  });

  it('merges temporal phases by phaseNumber (union)', () => {
    const spec1 = makeSpec({
      temporalPhases: [
        { phaseNumber: 1, label: 'Phase I' },
        { phaseNumber: 2, label: 'Phase II from Agent 1' },
      ],
    });
    const spec2 = makeSpec({
      temporalPhases: [
        { phaseNumber: 2, label: 'Phase II from Agent 2' },
        { phaseNumber: 3, label: 'Phase III' },
      ],
    });

    const assembler = new LayerAssembler();
    const merged = assembler.assemble([spec1, spec2]);

    expect(merged.temporalPhases).toHaveLength(3);
    const phases = merged.temporalPhases.map(p => p.phaseNumber).sort();
    expect(phases).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// Conflict Detector Tests
// ---------------------------------------------------------------------------

describe('ConflictDetector', () => {
  it('finds position conflicts (same entityId, different position)', () => {
    const targetLayer = makeLayer({
      id: 'lyr-target',
      sectionId: 'sec-A',
      spec: makeSpec({
        symbols: [makeSymbol({
          entityId: 'ent-1',
          position: { lat: 34.0, lng: -118.0 },
        })],
      }),
    });

    const existingLayer = makeLayer({
      id: 'lyr-existing',
      sectionId: 'sec-B',
      spec: makeSpec({
        symbols: [makeSymbol({
          entityId: 'ent-1',
          position: { lat: 35.0, lng: -117.0 }, // >100m difference
        })],
      }),
    });

    const conflicts = detectConflicts(targetLayer, [existingLayer]);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    const posConflict = conflicts.find(c => c.conflictType === 'position');
    expect(posConflict).toBeDefined();
    expect(posConflict!.layerIdA).toBe('lyr-target');
    expect(posConflict!.layerIdB).toBe('lyr-existing');
  });

  it('finds affiliation conflicts', () => {
    const targetLayer = makeLayer({
      id: 'lyr-target',
      spec: makeSpec({
        symbols: [makeSymbol({
          entityId: 'ent-1',
          affiliation: 'friendly',
        })],
      }),
    });

    const existingLayer = makeLayer({
      id: 'lyr-existing',
      spec: makeSpec({
        symbols: [makeSymbol({
          entityId: 'ent-1',
          affiliation: 'enemy',
        })],
      }),
    });

    const conflicts = detectConflicts(targetLayer, [existingLayer]);
    const affConflict = conflicts.find(c => c.conflictType === 'affiliation');
    expect(affConflict).toBeDefined();
  });

  it('finds designation conflicts', () => {
    const targetLayer = makeLayer({
      id: 'lyr-target',
      spec: makeSpec({
        symbols: [makeSymbol({
          entityId: 'ent-1',
          designation: '1st BN',
          position: { lat: 34.0, lng: -118.0 },
          affiliation: 'friendly',
        })],
      }),
    });

    const existingLayer = makeLayer({
      id: 'lyr-existing',
      spec: makeSpec({
        symbols: [makeSymbol({
          entityId: 'ent-1',
          designation: '2nd BDE',
          position: { lat: 34.0, lng: -118.0 },
          affiliation: 'friendly',
        })],
      }),
    });

    const conflicts = detectConflicts(targetLayer, [existingLayer]);
    const desConflict = conflicts.find(c => c.conflictType === 'designation');
    expect(desConflict).toBeDefined();
  });

  it('ranks conflicts by severity: affiliation > position > designation', () => {
    const targetLayer = makeLayer({
      id: 'lyr-target',
      spec: makeSpec({
        symbols: [
          makeSymbol({
            entityId: 'ent-aff',
            affiliation: 'friendly',
            position: { lat: 34.0, lng: -118.0 },
            designation: 'Same',
          }),
          makeSymbol({
            entityId: 'ent-pos',
            affiliation: 'friendly',
            position: { lat: 34.0, lng: -118.0 },
            designation: 'Same',
          }),
          makeSymbol({
            entityId: 'ent-des',
            affiliation: 'friendly',
            position: { lat: 34.0, lng: -118.0 },
            designation: 'Designation A',
          }),
        ],
      }),
    });

    const existingLayer = makeLayer({
      id: 'lyr-existing',
      spec: makeSpec({
        symbols: [
          makeSymbol({
            entityId: 'ent-aff',
            affiliation: 'enemy', // affiliation conflict
            position: { lat: 34.0, lng: -118.0 },
            designation: 'Same',
          }),
          makeSymbol({
            entityId: 'ent-pos',
            affiliation: 'friendly',
            position: { lat: 36.0, lng: -116.0 }, // position conflict
            designation: 'Same',
          }),
          makeSymbol({
            entityId: 'ent-des',
            affiliation: 'friendly',
            position: { lat: 34.0, lng: -118.0 },
            designation: 'Designation B', // designation conflict
          }),
        ],
      }),
    });

    const conflicts = detectConflicts(targetLayer, [existingLayer]);
    expect(conflicts.length).toBeGreaterThanOrEqual(3);

    // Should be sorted: affiliation first, then position, then designation
    const types = conflicts.map(c => c.conflictType);
    const affIdx = types.indexOf('affiliation');
    const posIdx = types.indexOf('position');
    const desIdx = types.indexOf('designation');
    expect(affIdx).toBeLessThan(posIdx);
    expect(posIdx).toBeLessThan(desIdx);
  });

  it('source authority ranking: SIGINT > HUMINT > IMINT > OSINT', () => {
    const detector = new ConflictDetector();
    const rank = detector.getSourceAuthorityRank('SIGINT');
    const rank2 = detector.getSourceAuthorityRank('HUMINT');
    const rank3 = detector.getSourceAuthorityRank('OSINT');
    expect(rank).toBeGreaterThan(rank2);
    expect(rank2).toBeGreaterThan(rank3);
  });

  it('does not flag conflicts for different entityIds', () => {
    const targetLayer = makeLayer({
      id: 'lyr-target',
      spec: makeSpec({
        symbols: [makeSymbol({ entityId: 'ent-1' })],
      }),
    });

    const existingLayer = makeLayer({
      id: 'lyr-existing',
      spec: makeSpec({
        symbols: [makeSymbol({ entityId: 'ent-2' })],
      }),
    });

    const conflicts = detectConflicts(targetLayer, [existingLayer]);
    expect(conflicts).toHaveLength(0);
  });
});
