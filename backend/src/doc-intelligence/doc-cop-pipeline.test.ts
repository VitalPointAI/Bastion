/**
 * Tests for doc-intelligence → COP layer pipeline
 *
 * Phase 50 Gap Plan 06 Task 1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateDocIntelCOPLayer, buildLayerDisplayName } from './doc-cop-pipeline.js';
import type { DocumentIntelligenceReport, ExtractedFact } from './types.js';
import type { GeoLocation } from '../lib/geocoding-service.js';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockCreateLayer = vi.fn().mockResolvedValue({ id: 'LYR-test123' });
const mockUpdateLayerSpec = vi.fn().mockResolvedValue(undefined);
const mockQueryLayers = vi.fn().mockResolvedValue([]);

vi.mock('../cop/layers/layer-store.js', () => ({
  layerStore: {
    createLayer: (...args: unknown[]) => mockCreateLayer(...args),
    updateLayerSpec: (...args: unknown[]) => mockUpdateLayerSpec(...args),
    queryLayers: (...args: unknown[]) => mockQueryLayers(...args),
  },
}));

const mockPublish = vi.fn().mockResolvedValue(undefined);
vi.mock('../messaging/message-bus.js', () => ({
  getMessageBus: () => ({ publish: mockPublish }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────

function makeReport(overrides?: Partial<DocumentIntelligenceReport>): DocumentIntelligenceReport {
  return {
    documentId: 'doc-abc12345',
    problemSetId: 'ps-1',
    triage: {
      documentType: 'INTEL_ESTIMATE',
      relevanceScore: 0.85,
      specialists: [],
      reasoning: 'Test triage',
    },
    facts: [],
    perspectives: [],
    biasFindings: [],
    qualityRating: {
      sourceReliability: 'B',
      informationCredibility: 2,
      assessedBy: 'test',
      assessedAt: new Date().toISOString(),
      reasoning: 'Test',
    },
    crossDocLinks: [],
    summary: 'Test document about Pacific theater naval movements.',
    ...overrides,
  };
}

function makeFact(overrides?: Partial<ExtractedFact>): ExtractedFact {
  return {
    claim: 'PLA Navy deployed three destroyer groups to the South China Sea',
    type: 'assertion',
    confidence: 0.8,
    sourceReference: { quote: 'test' },
    entities: ['PLA Navy', 'South China Sea'],
    geospatialContext: 'South China Sea, near Spratly Islands',
    ...overrides,
  };
}

function makeLocation(overrides?: Partial<GeoLocation>): GeoLocation {
  return {
    name: 'South China Sea',
    latitude: 12.5,
    longitude: 114.0,
    region: 'Southeast Asia',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateDocIntelCOPLayer', () => {
  it('creates COP symbols when locations have associated facts', async () => {
    const report = makeReport({
      facts: [makeFact()],
    });
    const locations = [makeLocation()];

    const result = await updateDocIntelCOPLayer('ps-1', report, locations, {
      title: 'Pacific Strategy Assessment',
    });

    expect(result).not.toBeNull();
    expect(result!.symbolCount).toBe(1);
    expect(mockCreateLayer).toHaveBeenCalledOnce();

    const spec = mockCreateLayer.mock.calls[0][0].spec as Record<string, unknown>;
    const symbols = spec.symbols as Array<Record<string, unknown>>;
    expect(symbols).toHaveLength(1);
    expect(symbols[0].affiliation).toBe('enemy'); // PLA Navy triggers hostile keyword
    expect(symbols[0].sidc).toMatch(/^10/); // MIL-STD-2525D prefix
    expect(symbols[0].assertedVia).toBe('doc_intelligence_pipeline');
  });

  it('creates annotation-only markers for locations without associated facts', async () => {
    const report = makeReport({ facts: [] }); // no facts
    const locations = [makeLocation({ name: 'Tokyo', latitude: 35.68, longitude: 139.69 })];

    const result = await updateDocIntelCOPLayer('ps-1', report, locations);

    expect(result).not.toBeNull();
    expect(result!.symbolCount).toBe(0); // no SIDC symbols
    expect(mockCreateLayer).toHaveBeenCalledOnce();

    const spec = mockCreateLayer.mock.calls[0][0].spec as Record<string, unknown>;
    const annotations = spec.customAnnotations as Array<Record<string, unknown>>;
    expect(annotations).toHaveLength(1); // annotation still created
    expect(annotations[0].description).toContain('Tokyo');
  });

  it('returns null and skips layer creation when locations array is empty', async () => {
    const report = makeReport();

    const result = await updateDocIntelCOPLayer('ps-1', report, []);

    expect(result).toBeNull();
    expect(mockCreateLayer).not.toHaveBeenCalled();
  });

  it('filters out locations with invalid coordinates', async () => {
    const report = makeReport({ facts: [makeFact()] });
    const locations = [
      makeLocation(), // valid
      makeLocation({ name: 'Nowhere', latitude: 0, longitude: 0 }), // invalid 0,0
    ];

    const result = await updateDocIntelCOPLayer('ps-1', report, locations);

    expect(result).not.toBeNull();
    expect(mockCreateLayer).toHaveBeenCalledOnce();

    const spec = mockCreateLayer.mock.calls[0][0].spec as Record<string, unknown>;
    const annotations = spec.customAnnotations as Array<Record<string, unknown>>;
    expect(annotations).toHaveLength(1); // only valid location
  });

  it('infers friendly affiliation from coalition keywords', async () => {
    const report = makeReport({
      facts: [makeFact({
        claim: 'NATO coalition forces conducted joint exercises near Okinawa',
        entities: ['NATO', 'Okinawa'],
        geospatialContext: 'Okinawa, Japan',
      })],
    });
    const locations = [makeLocation({ name: 'Okinawa', latitude: 26.34, longitude: 127.77 })];

    const result = await updateDocIntelCOPLayer('ps-1', report, locations);

    expect(result).not.toBeNull();
    const spec = mockCreateLayer.mock.calls[0][0].spec as Record<string, unknown>;
    const symbols = spec.symbols as Array<Record<string, unknown>>;
    expect(symbols[0].affiliation).toBe('friendly');
  });

  it('infers naval symbol set from ship/fleet keywords', async () => {
    const report = makeReport({
      facts: [makeFact({
        claim: 'Chinese destroyer fleet deployed near Taiwan Strait',
        entities: ['Chinese Navy', 'Taiwan Strait'],
        geospatialContext: 'Taiwan Strait',
      })],
    });
    const locations = [makeLocation({ name: 'Taiwan Strait', latitude: 24.0, longitude: 119.5 })];

    await updateDocIntelCOPLayer('ps-1', report, locations);

    const spec = mockCreateLayer.mock.calls[0][0].spec as Record<string, unknown>;
    const symbols = spec.symbols as Array<Record<string, unknown>>;
    // destroyer → naval symbol set '30'
    expect((symbols[0].sidc as string).slice(3, 5)).toBe('30');
  });

  it('broadcasts cop:layer_updated via message bus', async () => {
    const report = makeReport({ facts: [makeFact()] });
    const locations = [makeLocation()];

    await updateDocIntelCOPLayer('ps-1', report, locations, {
      title: 'Indo-Pacific Assessment',
    });

    expect(mockPublish).toHaveBeenCalledOnce();
    const payload = mockPublish.mock.calls[0][0].payload;
    expect(payload.source).toBe('doc-intelligence-pipeline');
    expect(payload.displayName).toContain('Indo-Pacific Assessment');
    expect(payload.workspaceId).toBe('ps-1');
  });

  it('uses descriptive section IDs derived from document metadata', async () => {
    const report = makeReport();
    const locations = [makeLocation()];

    await updateDocIntelCOPLayer('ps-1', report, locations, {
      title: 'Pacific Strategy Assessment.pdf',
    });

    const input = mockCreateLayer.mock.calls[0][0];
    expect(input.sectionId).toMatch(/^intel_estimate-pacific-strategy-assessment/);
    expect(input.sectionId).not.toContain('.pdf');
  });
});

describe('buildLayerDisplayName', () => {
  it('formats display name from report and metadata', () => {
    const report = makeReport();
    const name = buildLayerDisplayName(report, { title: 'Taiwan Contingency Brief' });
    expect(name).toContain('INTEL_ESTIMATE');
    expect(name).toContain('Taiwan Contingency Brief');
  });

  it('strips file extensions from display name', () => {
    const report = makeReport();
    const name = buildLayerDisplayName(report, { originalName: 'assessment.pdf' });
    expect(name).not.toContain('.pdf');
    expect(name).toContain('assessment');
  });

  it('falls back to document ID when no title available', () => {
    const report = makeReport();
    const name = buildLayerDisplayName(report, {});
    expect(name).toContain('doc-abc1');
  });
});
