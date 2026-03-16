/**
 * Output Validation Tests for COP Layer Sub-Agents
 *
 * Validates that sub-agents produce correctly structured COPLayerSpec
 * output with deterministic SIDC codes (not LLM-generated) and CCO
 * validation on every entity.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock LLM factory to avoid real API calls
vi.mock('../../../agents/langgraph/llm-factory.js', () => ({
  createLLMForAgent: vi.fn().mockResolvedValue({
    invoke: vi.fn().mockResolvedValue({
      content: JSON.stringify([
        {
          entityId: '1-bde-101-abn',
          designation: '1st Brigade Combat Team, 101st Airborne Division',
          type: 'infantry',
          echelon: 'brigade',
          affiliation: 'friendly',
          position: { lat: 34.05, lng: -118.25 },
          movementPath: [
            { phase: 1, position: { lat: 34.05, lng: -118.25 } },
            { phase: 2, position: { lat: 34.10, lng: -118.20 } },
          ],
          sourceDocumentId: 'doc-opord-1',
        },
        {
          entityId: '2-bn-502-in',
          designation: '2nd Battalion, 502nd Infantry Regiment',
          type: 'infantry',
          echelon: 'battalion',
          affiliation: 'friendly',
          position: { lat: 34.06, lng: -118.24 },
          sourceDocumentId: 'doc-opord-1',
        },
      ]),
    }),
  }),
}));

// Mock event bus
vi.mock('../../messaging/event-bus.js', () => ({
  copEventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// Mock CCO validator
vi.mock('../../cco/cco-validator.js', () => ({
  validateCCOClass: vi.fn().mockReturnValue({ valid: true }),
  suggestCCOClass: vi.fn().mockReturnValue('cco:MilitaryOrganization'),
}));

// Keep SIDC builder real (deterministic, no external deps)
// Do NOT mock it -- we want to verify real SIDC generation

import { forceDispositionAgent } from './force-disposition.js';
import { createLLMForAgent } from '../../../agents/langgraph/llm-factory.js';
import { suggestCCOClass } from '../../cco/cco-validator.js';
import type { SubAgentInput } from './sub-agent-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestInput(
  documents: SubAgentInput['documents'] = [],
  graphEntities: SubAgentInput['graphEntities'] = [],
): SubAgentInput {
  return {
    workspaceId: 'ws-test-1',
    sectionId: 'sec-test-1',
    documents,
    graphEntities,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Force Disposition Agent Output', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup the mock for each test
    (createLLMForAgent as Mock).mockResolvedValue({
      invoke: vi.fn().mockResolvedValue({
        content: JSON.stringify([
          {
            entityId: '1-bde-101-abn',
            designation: '1st Brigade Combat Team, 101st Airborne Division',
            type: 'infantry',
            echelon: 'brigade',
            affiliation: 'friendly',
            position: { lat: 34.05, lng: -118.25 },
            movementPath: [
              { phase: 1, position: { lat: 34.05, lng: -118.25 } },
            ],
            sourceDocumentId: 'doc-opord-1',
          },
        ]),
      }),
    });
  });

  it('returns COPLayerSpec with affiliation=friendly and valid SIDC codes', async () => {
    const input = createTestInput([
      { id: 'doc-opord-1', content: 'OPORD content with unit positions...', type: 'opord' },
    ]);

    const result = await forceDispositionAgent(input);

    expect(result.layerType).toBe('force_disposition');
    expect(result.symbols.length).toBeGreaterThan(0);

    for (const symbol of result.symbols) {
      expect(symbol.affiliation).toBe('friendly');
      // SIDC must be exactly 20 digits (MIL-STD-2525D)
      expect(symbol.sidc).toMatch(/^\d{20}$/);
      expect(symbol.sidc.length).toBe(20);
    }
  });

  it('returns empty spec with error metadata when given no relevant documents', async () => {
    const input = createTestInput([], []);

    const result = await forceDispositionAgent(input);

    expect(result.symbols.length).toBe(0);
    expect(result.controlMeasures.length).toBe(0);
    // Should have error metadata
    expect(result.metadata.ccoValidated).toBe(false);
  });

  it('generates SIDC codes deterministically via buildSIDCFromEntity (not LLM)', async () => {
    const input = createTestInput([
      { id: 'doc-1', content: 'Unit positions in OPORD...', type: 'opord' },
    ]);

    const result = await forceDispositionAgent(input);

    // Every SIDC should be exactly 20 characters
    for (const symbol of result.symbols) {
      expect(symbol.sidc.length).toBe(20);
      // Version prefix should be '10' (MIL-STD-2525D)
      expect(symbol.sidc.startsWith('10')).toBe(true);
      // Should be all digits
      expect(symbol.sidc).toMatch(/^\d{20}$/);
    }

    // The LLM should NOT have been asked to generate SIDC codes
    // (LLM only extracts structured entity data, not SIDC codes)
    const mockLLM = await createLLMForAgent({ agentId: 'test' });
    const invokeCall = (mockLLM.invoke as Mock).mock.calls[0];
    if (invokeCall) {
      const systemMsg = invokeCall[0][0];
      // System prompt should NOT ask for SIDC codes
      expect(systemMsg.content).not.toContain('generate SIDC');
    }
  });

  it('calls suggestCCOClass for each extracted entity', async () => {
    const input = createTestInput([
      { id: 'doc-1', content: 'OPORD with units...', type: 'opord' },
    ]);

    await forceDispositionAgent(input);

    // suggestCCOClass should be called for each extracted entity
    expect(suggestCCOClass).toHaveBeenCalled();
  });

  it('handles graph entities alongside document extraction', async () => {
    const input = createTestInput(
      [{ id: 'doc-1', content: 'OPORD...', type: 'opord' }],
      [
        {
          id: 'graph-unit-1',
          name: '3rd Armored Division',
          jsonldType: 'cco:MilitaryOrganization',
          confidence: 0.9,
          provenance: {
            assertedBy: 'system',
            assertedVia: 'manual_entry' as const,
            derivedFrom: '[]',
            confidence: 0.9,
            sourceWeight: 0.95,
          },
          temporalValid: true,
          properties: {
            type: 'military_unit',
            unitType: 'armor',
            echelon: 'division',
            affiliation: 'friendly',
            lat: 35.0,
            lng: -117.0,
          },
        },
      ],
    );

    const result = await forceDispositionAgent(input);

    // Should have symbols from both document extraction AND graph entities
    const graphSymbol = result.symbols.find(s => s.entityId === 'graph-unit-1');
    expect(graphSymbol).toBeDefined();
    expect(graphSymbol!.designation).toBe('3rd Armored Division');
    expect(graphSymbol!.sidc.length).toBe(20);
  });

  it('every symbol has SIDC exactly 20 characters in MIL-STD-2525D format', async () => {
    const input = createTestInput([
      { id: 'doc-1', content: 'Multiple units in OPORD...', type: 'opord' },
    ]);

    const result = await forceDispositionAgent(input);

    for (const symbol of result.symbols) {
      // Exactly 20 characters
      expect(symbol.sidc.length).toBe(20);
      // All digits
      expect(symbol.sidc).toMatch(/^\d{20}$/);
      // Starts with version '10'
      expect(symbol.sidc.substring(0, 2)).toBe('10');
    }
  });
});
