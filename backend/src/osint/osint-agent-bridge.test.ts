/**
 * OSINT Agent Bridge — Unit Tests
 *
 * Tests the bridge module that translates OSINTEvent + OSINTFeedConfig
 * into the doc-intelligence pipeline input shape and invokes the agent team.
 *
 * Requirements covered:
 *   OSINT-63-01: processOSINTEventThroughAgents routes through createWiredDocIntelligenceGraph
 *   OSINT-63-02: Fallback ProblemSetContext synthesised when none exists
 *   OSINT-63-04: assertedVia: 'osint' in metadata passed to processDocument
 *   OSINT-63-05: Compiled graph cached per problemSetId (not recreated per event)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { OSINTEvent } from '../graph/osint/types.js';
import type { OSINTFeedConfig } from '../jpp/osint-feed-store.js';

// ---------------------------------------------------------------------------
// Module mocks — declared before any imports that trigger module execution
// ---------------------------------------------------------------------------

const mockProcessDocument = vi.fn();
const mockCreateWiredDocIntelligenceGraph = vi.fn();
const mockGetProblemSetContext = vi.fn();

vi.mock('../doc-intelligence/orchestrator-wiring.js', () => ({
  createWiredDocIntelligenceGraph: mockCreateWiredDocIntelligenceGraph,
}));

vi.mock('../doc-intelligence/interview/interview-store.js', () => ({
  getProblemSetContext: mockGetProblemSetContext,
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const stubEvent: OSINTEvent = {
  id: 'EVT-test-001',
  title: 'PLA Conducts Naval Exercise Near Taiwan',
  description: 'Chinese naval forces deployed near the Taiwan Strait.',
  sourceType: 'news',
  sourceUrl: 'https://example.com/article/123',
  sourceName: 'Reuters',
  publishedAt: new Date('2026-03-15T10:00:00Z'),
  ingestedAt: new Date('2026-03-15T10:05:00Z'),
  actors: ['PLA', 'Taiwan'],
  tags: ['naval', 'exercise', 'taiwan'],
  workspaceId: 'ws-001',
  metadata: { feedId: 'FEED-abc' },
};

const stubFeed: OSINTFeedConfig = {
  id: 'FEED-abc',
  problemSetId: 'ps-001',
  sourceName: 'Reuters',
  sourceType: 'rss',
  endpointUrl: 'https://feeds.reuters.com/reuters/topNews',
  pollingIntervalMs: 60000,
  relevanceMode: 'ai_semantic',
  active: true,
  config: {},
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const stubReport = {
  documentId: 'EVT-test-001',
  problemSetId: 'ps-001',
  triage: { documentType: 'OSINT_REPORT', relevanceScore: 0.8, specialists: ['fact-extractor'], reasoning: 'test' },
  facts: [],
  perspectives: [],
  biasFindings: [],
  qualityRating: { sourceReliability: 'B', informationCredibility: 2 },
  crossDocLinks: [],
  summary: 'Naval exercise detected.',
  specialistResults: {
    'fact-extractor': { output: { graphResult: { actorsCreated: 2, relationshipsCreated: 1, tensionsCreated: 0, errors: [] } } },
  },
};

const stubProblemSetContext = {
  problemSetId: 'ps-001',
  coreProblem: 'Indo-Pacific security dynamics',
  geographicScope: { regions: ['Indo-Pacific'], countries: ['China', 'Taiwan'] },
  temporalRange: { startDate: '2026-01-01', endDate: null },
  actorFocus: { primaryActors: ['PLA', 'INDOPACOM'], secondaryActors: [] },
  version: 1,
  updatedAt: '2026-03-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Helper: reset and configure mocks
// ---------------------------------------------------------------------------

function setupMocks() {
  mockProcessDocument.mockResolvedValue(stubReport);
  mockCreateWiredDocIntelligenceGraph.mockResolvedValue({ processDocument: mockProcessDocument });
  mockGetProblemSetContext.mockResolvedValue(stubProblemSetContext);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('osint-agent-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the module-level graph cache between tests by re-importing fresh module
    vi.resetModules();
    setupMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('OSINT-63-01: calls createWiredDocIntelligenceGraph with problemSetId then processDocument with correct args', async () => {
    // Re-mock after resetModules
    vi.doMock('../doc-intelligence/orchestrator-wiring.js', () => ({
      createWiredDocIntelligenceGraph: mockCreateWiredDocIntelligenceGraph,
    }));
    vi.doMock('../doc-intelligence/interview/interview-store.js', () => ({
      getProblemSetContext: mockGetProblemSetContext,
    }));

    const { processOSINTEventThroughAgents } = await import('./osint-agent-bridge.js');

    await processOSINTEventThroughAgents(stubEvent, stubFeed);

    // createWiredDocIntelligenceGraph called with correct problemSetId
    expect(mockCreateWiredDocIntelligenceGraph).toHaveBeenCalledOnce();
    const wiredGraphCall = mockCreateWiredDocIntelligenceGraph.mock.calls[0][0];
    expect(wiredGraphCall.problemSetId).toBe('ps-001');

    // processDocument called with event.id as documentId, concatenated text, and metadata
    expect(mockProcessDocument).toHaveBeenCalledOnce();
    const [docId, docText, metadata] = mockProcessDocument.mock.calls[0];
    expect(docId).toBe('EVT-test-001');
    expect(docText).toContain('PLA Conducts Naval Exercise Near Taiwan');
    expect(docText).toContain('Chinese naval forces deployed near the Taiwan Strait.');
    expect(metadata.documentType).toBe('OSINT_REPORT');
    expect(metadata.assertedVia).toBe('osint');
  });

  it('OSINT-63-02: synthesises fallback context when getProblemSetContext returns null', async () => {
    mockGetProblemSetContext.mockResolvedValue(null);

    vi.doMock('../doc-intelligence/orchestrator-wiring.js', () => ({
      createWiredDocIntelligenceGraph: mockCreateWiredDocIntelligenceGraph,
    }));
    vi.doMock('../doc-intelligence/interview/interview-store.js', () => ({
      getProblemSetContext: mockGetProblemSetContext,
    }));

    const { processOSINTEventThroughAgents } = await import('./osint-agent-bridge.js');

    await processOSINTEventThroughAgents(stubEvent, stubFeed);

    // createWiredDocIntelligenceGraph called with a fallback problemSetContext
    expect(mockCreateWiredDocIntelligenceGraph).toHaveBeenCalledOnce();
    const config = mockCreateWiredDocIntelligenceGraph.mock.calls[0][0];
    const ctx = config.problemSetContext;

    expect(ctx).toBeDefined();
    expect(ctx.coreProblem).toBe('General geopolitical intelligence monitoring');
    expect(ctx.geographicScope.regions).toContain('Global');
  });

  it('OSINT-63-04: metadata passed to processDocument contains assertedVia: osint', async () => {
    vi.doMock('../doc-intelligence/orchestrator-wiring.js', () => ({
      createWiredDocIntelligenceGraph: mockCreateWiredDocIntelligenceGraph,
    }));
    vi.doMock('../doc-intelligence/interview/interview-store.js', () => ({
      getProblemSetContext: mockGetProblemSetContext,
    }));

    const { processOSINTEventThroughAgents } = await import('./osint-agent-bridge.js');

    await processOSINTEventThroughAgents(stubEvent, stubFeed);

    const [, , metadata] = mockProcessDocument.mock.calls[0];
    expect(metadata.assertedVia).toBe('osint');
    expect(metadata.assertedVia).not.toBe('doc_intelligence');
    expect(metadata.assertedVia).not.toBe('ai_inference');
  });

  it('OSINT-63-05: caches compiled graph per problemSetId and creates new graph for different problemSetId', async () => {
    vi.doMock('../doc-intelligence/orchestrator-wiring.js', () => ({
      createWiredDocIntelligenceGraph: mockCreateWiredDocIntelligenceGraph,
    }));
    vi.doMock('../doc-intelligence/interview/interview-store.js', () => ({
      getProblemSetContext: mockGetProblemSetContext,
    }));

    const { processOSINTEventThroughAgents } = await import('./osint-agent-bridge.js');

    // Two consecutive calls with same problemSetId
    await processOSINTEventThroughAgents(stubEvent, stubFeed);
    await processOSINTEventThroughAgents(
      { ...stubEvent, id: 'EVT-test-002', title: 'Second event' },
      stubFeed,
    );

    // createWiredDocIntelligenceGraph called only once (cache hit on second call)
    expect(mockCreateWiredDocIntelligenceGraph).toHaveBeenCalledOnce();

    // Different problemSetId creates new graph
    const differentFeed: OSINTFeedConfig = { ...stubFeed, problemSetId: 'ps-999' };
    await processOSINTEventThroughAgents(stubEvent, differentFeed);

    expect(mockCreateWiredDocIntelligenceGraph).toHaveBeenCalledTimes(2);
  });

  it('cache entry expires after TTL (30 minutes)', async () => {
    vi.doMock('../doc-intelligence/orchestrator-wiring.js', () => ({
      createWiredDocIntelligenceGraph: mockCreateWiredDocIntelligenceGraph,
    }));
    vi.doMock('../doc-intelligence/interview/interview-store.js', () => ({
      getProblemSetContext: mockGetProblemSetContext,
    }));

    // Advance Date.now past 30-minute TTL between calls
    const realDateNow = Date.now;
    let fakeNow = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => fakeNow);

    const { processOSINTEventThroughAgents } = await import('./osint-agent-bridge.js');

    await processOSINTEventThroughAgents(stubEvent, stubFeed);
    expect(mockCreateWiredDocIntelligenceGraph).toHaveBeenCalledTimes(1);

    // Advance time by 31 minutes to expire the cache
    fakeNow += 31 * 60 * 1000;

    await processOSINTEventThroughAgents(
      { ...stubEvent, id: 'EVT-test-003' },
      stubFeed,
    );

    // Should have created a new graph because the cache expired
    expect(mockCreateWiredDocIntelligenceGraph).toHaveBeenCalledTimes(2);

    vi.spyOn(Date, 'now').mockImplementation(realDateNow);
  });
});
