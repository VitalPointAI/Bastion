/**
 * Unit Tests: Ironclaw Memory Retrieval Service
 *
 * Phase 57 Plan 02 — TDD RED phase
 *
 * Tests:
 * - MEM-05: assembleMemoryBlock returns '' when store retrieval exceeds 200ms timeout
 * - MEM-06: assembleMemoryBlock truncates output to 1300 chars max (with '...' suffix)
 * - MEM-08: deriveAdaptivePreferences computes behavioral signals from outcome counts
 * - assembleMemoryBlock with no memories returns ''
 * - assembleMemoryBlock with user memories only returns user section
 * - assembleMemoryBlock with both scopes returns both sections formatted as markdown
 * - assembleMemoryBlock includes "## Behavioral Adaptation" section when outcome history exists
 * - assembleMemoryBlock omits "## Behavioral Adaptation" section when no outcome history
 * - recordOutcome delegates to ironclawOutcomeStore.recordOutcome
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the memory store module before importing the service
// ---------------------------------------------------------------------------

const mockGetUserActiveMemories = vi.fn();
const mockGetContextActiveMemories = vi.fn();
const mockGetOutcomeCounts = vi.fn();
const mockRecordOutcome = vi.fn();

vi.mock('./ironclaw-memory-store.js', () => ({
  ironclawUserMemoryStore: {
    getActiveMemories: mockGetUserActiveMemories,
  },
  ironclawContextMemoryStore: {
    getActiveMemories: mockGetContextActiveMemories,
  },
  ironclawOutcomeStore: {
    getOutcomeCounts: mockGetOutcomeCounts,
    recordOutcome: mockRecordOutcome,
  },
}));

// Import AFTER mock is set up
const { memoryRetrievalService } = await import('./ironclaw-memory-service.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUserMemory(key: string, value: string) {
  return {
    id: 'uid-1',
    user_did: 'did:near:test',
    memory_key: key,
    memory_value: { value },
    confidence: 0.8,
    source: 'inferred' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };
}

function makeContextMemory(key: string, value: string) {
  return {
    id: 'cid-1',
    problem_set_id: 'ps-123',
    memory_key: key,
    memory_value: { value },
    session_count: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MemoryRetrievalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: empty memories and zero outcome counts
    mockGetUserActiveMemories.mockResolvedValue([]);
    mockGetContextActiveMemories.mockResolvedValue([]);
    mockGetOutcomeCounts.mockResolvedValue({});
  });

  // -------------------------------------------------------------------------
  // assembleMemoryBlock: empty case
  // -------------------------------------------------------------------------

  it('returns empty string when no memories exist', async () => {
    const result = await memoryRetrievalService.assembleMemoryBlock('did:near:test', 'ps-123');
    expect(result).toBe('');
  });

  // -------------------------------------------------------------------------
  // assembleMemoryBlock: user memories only
  // -------------------------------------------------------------------------

  it('returns user section when user memories exist but no context memories', async () => {
    mockGetUserActiveMemories.mockResolvedValue([
      makeUserMemory('communication_style', 'concise'),
      makeUserMemory('prefers_bullet_points', 'true'),
    ]);
    mockGetContextActiveMemories.mockResolvedValue([]);

    const result = await memoryRetrievalService.assembleMemoryBlock('did:near:test', 'ps-123');

    expect(result).toContain('## User Preferences');
    expect(result).toContain('communication_style');
    expect(result).not.toContain('## Problem Set Memory');
  });

  // -------------------------------------------------------------------------
  // assembleMemoryBlock: both scopes
  // -------------------------------------------------------------------------

  it('returns both user and context sections when both have memories', async () => {
    mockGetUserActiveMemories.mockResolvedValue([
      makeUserMemory('communication_style', 'concise'),
    ]);
    mockGetContextActiveMemories.mockResolvedValue([
      makeContextMemory('coa_preference', 'maneuver-focused'),
    ]);

    const result = await memoryRetrievalService.assembleMemoryBlock('did:near:test', 'ps-123');

    expect(result).toContain('## User Preferences');
    expect(result).toContain('## Problem Set Memory');
    expect(result).toContain('communication_style');
    expect(result).toContain('coa_preference');
  });

  // -------------------------------------------------------------------------
  // assembleMemoryBlock: Behavioral Adaptation section present when outcomes exist
  // -------------------------------------------------------------------------

  it('includes Behavioral Adaptation section when outcome history exists', async () => {
    mockGetUserActiveMemories.mockResolvedValue([
      makeUserMemory('communication_style', 'concise'),
    ]);
    mockGetContextActiveMemories.mockResolvedValue([]);
    mockGetOutcomeCounts.mockResolvedValue({
      suggestion_accepted: 5,
      suggestion_rejected: 2,
    });

    const result = await memoryRetrievalService.assembleMemoryBlock('did:near:test', 'ps-123');

    expect(result).toContain('## Behavioral Adaptation');
    expect(result).toContain('proactivityLevel');
    expect(result).toContain('critiqueFrequency');
    expect(result).toContain('prefersDraftFirst');
  });

  // -------------------------------------------------------------------------
  // assembleMemoryBlock: Behavioral Adaptation section omitted when no outcomes
  // -------------------------------------------------------------------------

  it('omits Behavioral Adaptation section when getOutcomeCounts returns all zeros', async () => {
    mockGetUserActiveMemories.mockResolvedValue([
      makeUserMemory('communication_style', 'concise'),
    ]);
    mockGetContextActiveMemories.mockResolvedValue([]);
    mockGetOutcomeCounts.mockResolvedValue({});

    const result = await memoryRetrievalService.assembleMemoryBlock('did:near:test', 'ps-123');

    expect(result).not.toContain('## Behavioral Adaptation');
  });

  // -------------------------------------------------------------------------
  // MEM-05: Timeout protection
  // -------------------------------------------------------------------------

  it('MEM-05: returns empty string when store retrieval exceeds timeout', async () => {
    mockGetUserActiveMemories.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([makeUserMemory('key', 'val')]), 500)),
    );

    const result = await memoryRetrievalService.assembleMemoryBlock('did:near:test', 'ps-123', 200);

    expect(result).toBe('');
  });

  // -------------------------------------------------------------------------
  // MEM-06: Hard character cap at 1300 chars
  // -------------------------------------------------------------------------

  it('MEM-06: truncates output to 1300 chars max with "..." suffix', async () => {
    // Create 20 user memory entries with long values to exceed 1300 chars
    const bigMemories = Array.from({ length: 20 }, (_, i) =>
      makeUserMemory(`key_${i}`, 'x'.repeat(200)),
    );
    mockGetUserActiveMemories.mockResolvedValue(bigMemories);

    const result = await memoryRetrievalService.assembleMemoryBlock('did:near:test', 'ps-123');

    // Result should not exceed 1303 chars (1300 + '...')
    expect(result.length).toBeLessThanOrEqual(1303);
    if (result.length === 1303) {
      expect(result.endsWith('...')).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // MEM-08: deriveAdaptivePreferences — proactivity level
  // -------------------------------------------------------------------------

  it('MEM-08: returns proactivityLevel=low when rejection rate exceeds 60%', async () => {
    mockGetOutcomeCounts.mockResolvedValue({
      suggestion_rejected: 7,
      suggestion_accepted: 3,
    });

    const prefs = await memoryRetrievalService.deriveAdaptivePreferences('did:near:test');

    expect(prefs.proactivityLevel).toBe('low');
  });

  it('MEM-08: returns proactivityLevel=high when rejection rate is below 20%', async () => {
    mockGetOutcomeCounts.mockResolvedValue({
      suggestion_rejected: 1,
      suggestion_accepted: 9,
    });

    const prefs = await memoryRetrievalService.deriveAdaptivePreferences('did:near:test');

    expect(prefs.proactivityLevel).toBe('high');
  });

  it('MEM-08: returns proactivityLevel=medium for moderate rejection rates', async () => {
    mockGetOutcomeCounts.mockResolvedValue({
      suggestion_rejected: 4,
      suggestion_accepted: 6,
    });

    const prefs = await memoryRetrievalService.deriveAdaptivePreferences('did:near:test');

    expect(prefs.proactivityLevel).toBe('medium');
  });

  // -------------------------------------------------------------------------
  // MEM-08b: deriveAdaptivePreferences — critique frequency
  // -------------------------------------------------------------------------

  it('MEM-08b: returns critiqueFrequency=high when incorporation rate exceeds 70%', async () => {
    mockGetOutcomeCounts.mockResolvedValue({
      suggestion_accepted: 10,
      edit_post_critique: 8, // 0.8 > 0.7
    });

    const prefs = await memoryRetrievalService.deriveAdaptivePreferences('did:near:test');

    expect(prefs.critiqueFrequency).toBe('high');
  });

  it('MEM-08b: returns critiqueFrequency=low when incorporation rate is below 30%', async () => {
    mockGetOutcomeCounts.mockResolvedValue({
      suggestion_accepted: 10,
      edit_post_critique: 2, // 0.2 < 0.3
    });

    const prefs = await memoryRetrievalService.deriveAdaptivePreferences('did:near:test');

    expect(prefs.critiqueFrequency).toBe('low');
  });

  // -------------------------------------------------------------------------
  // recordOutcome: delegates to store
  // -------------------------------------------------------------------------

  it('recordOutcome delegates to ironclawOutcomeStore.recordOutcome', async () => {
    mockRecordOutcome.mockResolvedValue({ id: 'outcome-1' });

    await memoryRetrievalService.recordOutcome(
      'did:near:test',
      'ps-123',
      'suggestion_accepted',
      { action_type: 'coa.create' },
    );

    expect(mockRecordOutcome).toHaveBeenCalledWith(
      'did:near:test',
      'ps-123',
      'suggestion_accepted',
      { action_type: 'coa.create' },
    );
  });
});
