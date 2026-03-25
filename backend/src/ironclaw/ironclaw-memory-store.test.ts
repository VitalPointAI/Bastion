/**
 * Unit Tests: Ironclaw Memory Store
 *
 * Phase 57 Plan 01 — TDD RED phase
 *
 * Tests all store operations:
 * - MEM-01: User memory creation and retrieval
 * - MEM-02: Upsert semantics (no duplicate row on same key)
 * - MEM-03: Expired memories filtered from getActiveMemories()
 * - MEM-04: Context memory creation, retrieval, and upsert
 * - MEM-07: Interaction outcome recording and retrieval
 * - MEM-10: Cross-user isolation (user A memory not returned for user B)
 * - Deletion: deleteUserMemory and deleteAllUserMemories
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OUTCOME_TYPES } from './ironclaw-memory-types.js';

// ---------------------------------------------------------------------------
// Mock database pool
// ---------------------------------------------------------------------------

const mockQuery = vi.fn();

vi.mock('../lib/database.js', () => ({
  getPool: () => ({ query: mockQuery }),
}));

// Import stores AFTER mock is set up
const { ironclawUserMemoryStore, ironclawContextMemoryStore, ironclawOutcomeStore } =
  await import('./ironclaw-memory-store.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUserMemoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'uuid-1',
    user_did: 'did:user:a',
    memory_key: 'working_style',
    memory_value: { draft_preference: 'draft-first' },
    confidence: 0.5,
    source: 'inferred',
    created_at: new Date(),
    updated_at: new Date(),
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days future
    ...overrides,
  };
}

function makeContextMemoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'uuid-2',
    problem_set_id: 'ps-1',
    memory_key: 'decisions_made',
    memory_value: { count: 3 },
    session_count: 1,
    created_at: new Date(),
    updated_at: new Date(),
    expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days future
    ...overrides,
  };
}

function makeOutcomeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'uuid-3',
    user_did: 'did:user:a',
    problem_set_id: 'ps-1',
    outcome_type: OUTCOME_TYPES.SUGGESTION_ACCEPTED,
    context: { suggestion_type: 'coa' },
    created_at: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// IronclawUserMemoryStore
// ---------------------------------------------------------------------------

describe('IronclawUserMemoryStore', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('setUserMemory', () => {
    it('MEM-01: inserts with ON CONFLICT upsert semantics', async () => {
      const returnedRow = makeUserMemoryRow();
      mockQuery.mockResolvedValueOnce({ rows: [returnedRow] });

      const result = await ironclawUserMemoryStore.setUserMemory(
        'did:user:a',
        'working_style',
        { draft_preference: 'draft-first' },
      );

      expect(mockQuery).toHaveBeenCalledOnce();
      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/ON CONFLICT/i);
      expect(sql).toMatch(/ironclaw_user_memory/);
      expect(params).toContain('did:user:a');
      expect(params).toContain('working_style');
      expect(result.user_did).toBe('did:user:a');
      expect(result.memory_key).toBe('working_style');
    });

    it('MEM-02: upsert does NOT create duplicate — ON CONFLICT DO UPDATE', async () => {
      const row = makeUserMemoryRow();
      mockQuery.mockResolvedValue({ rows: [row] });

      // Call twice with same key — both should succeed via upsert
      await ironclawUserMemoryStore.setUserMemory('did:user:a', 'working_style', { x: 1 });
      await ironclawUserMemoryStore.setUserMemory('did:user:a', 'working_style', { x: 2 });

      // Both calls should use upsert SQL
      for (const call of mockQuery.mock.calls) {
        const sql = call[0] as string;
        expect(sql).toMatch(/ON CONFLICT/i);
        expect(sql).toMatch(/DO UPDATE/i);
      }
    });
  });

  describe('getActiveMemories', () => {
    it('MEM-01: returns memories for the given user', async () => {
      const rows = [makeUserMemoryRow()];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await ironclawUserMemoryStore.getActiveMemories('did:user:a');

      expect(result).toHaveLength(1);
      expect(result[0].user_did).toBe('did:user:a');
    });

    it('MEM-03: query filters by expires_at > NOW()', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await ironclawUserMemoryStore.getActiveMemories('did:user:a');

      const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/expires_at.*>.*NOW\(\)/i);
    });

    it('MEM-10: query is scoped to user_did — no cross-user leakage possible', async () => {
      // User A has memories
      mockQuery.mockResolvedValueOnce({ rows: [makeUserMemoryRow()] });
      const resultA = await ironclawUserMemoryStore.getActiveMemories('did:user:a');
      expect(resultA).toHaveLength(1);

      // User B query returns empty (mock returns empty for different call)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const resultB = await ironclawUserMemoryStore.getActiveMemories('did:user:b');
      expect(resultB).toHaveLength(0);

      // Verify each call scoped its query to the correct user_did
      const [, paramsA] = mockQuery.mock.calls[0] as [string, unknown[]];
      const [, paramsB] = mockQuery.mock.calls[1] as [string, unknown[]];
      expect(paramsA).toContain('did:user:a');
      expect(paramsA).not.toContain('did:user:b');
      expect(paramsB).toContain('did:user:b');
      expect(paramsB).not.toContain('did:user:a');
    });
  });

  describe('getUserMemory', () => {
    it('returns a single memory entry by key', async () => {
      const row = makeUserMemoryRow();
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await ironclawUserMemoryStore.getUserMemory('did:user:a', 'working_style');

      expect(result).not.toBeNull();
      expect(result!.memory_key).toBe('working_style');
      const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(params).toContain('did:user:a');
      expect(params).toContain('working_style');
    });

    it('returns null when memory not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await ironclawUserMemoryStore.getUserMemory('did:user:a', 'no_such_key');
      expect(result).toBeNull();
    });
  });

  describe('deleteUserMemory', () => {
    it('issues DELETE with correct user_did and memory_key', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await ironclawUserMemoryStore.deleteUserMemory('did:user:a', 'working_style');

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/DELETE/i);
      expect(sql).toMatch(/ironclaw_user_memory/);
      expect(params).toContain('did:user:a');
      expect(params).toContain('working_style');
    });
  });

  describe('deleteAllUserMemories', () => {
    it('issues DELETE scoped to user_did only', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await ironclawUserMemoryStore.deleteAllUserMemories('did:user:a');

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/DELETE/i);
      expect(sql).toMatch(/ironclaw_user_memory/);
      expect(params).toContain('did:user:a');
    });
  });
});

// ---------------------------------------------------------------------------
// IronclawContextMemoryStore
// ---------------------------------------------------------------------------

describe('IronclawContextMemoryStore', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('setContextMemory', () => {
    it('MEM-04: inserts with ON CONFLICT upsert semantics', async () => {
      const row = makeContextMemoryRow();
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await ironclawContextMemoryStore.setContextMemory(
        'ps-1',
        'decisions_made',
        { count: 3 },
      );

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/ON CONFLICT/i);
      expect(sql).toMatch(/DO UPDATE/i);
      expect(sql).toMatch(/ironclaw_context_memory/);
      expect(params).toContain('ps-1');
      expect(params).toContain('decisions_made');
      expect(result.problem_set_id).toBe('ps-1');
    });
  });

  describe('getActiveMemories', () => {
    it('MEM-04: returns memories for the given problem set', async () => {
      const rows = [makeContextMemoryRow()];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await ironclawContextMemoryStore.getActiveMemories('ps-1');

      expect(result).toHaveLength(1);
      expect(result[0].problem_set_id).toBe('ps-1');
    });

    it('filters by expires_at > NOW()', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await ironclawContextMemoryStore.getActiveMemories('ps-1');

      const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/expires_at.*>.*NOW\(\)/i);
    });

    it('query is scoped to problem_set_id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await ironclawContextMemoryStore.getActiveMemories('ps-1');

      const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(params).toContain('ps-1');
    });
  });

  describe('deleteContextMemory', () => {
    it('issues DELETE with correct problem_set_id and memory_key', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await ironclawContextMemoryStore.deleteContextMemory('ps-1', 'decisions_made');

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/DELETE/i);
      expect(params).toContain('ps-1');
      expect(params).toContain('decisions_made');
    });
  });
});

// ---------------------------------------------------------------------------
// IronclawOutcomeStore
// ---------------------------------------------------------------------------

describe('IronclawOutcomeStore', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('recordOutcome', () => {
    it('MEM-07: inserts a row into ironclaw_interaction_outcomes', async () => {
      const row = makeOutcomeRow();
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await ironclawOutcomeStore.recordOutcome(
        'did:user:a',
        'ps-1',
        OUTCOME_TYPES.SUGGESTION_ACCEPTED,
        { suggestion_type: 'coa' },
      );

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/ironclaw_interaction_outcomes/);
      expect(sql).toMatch(/INSERT/i);
      expect(params).toContain('did:user:a');
      expect(params).toContain('ps-1');
      expect(params).toContain(OUTCOME_TYPES.SUGGESTION_ACCEPTED);
      expect(result.user_did).toBe('did:user:a');
      expect(result.problem_set_id).toBe('ps-1');
      expect(result.outcome_type).toBe(OUTCOME_TYPES.SUGGESTION_ACCEPTED);
    });

    it('MEM-07: accepts null problem_set_id for global outcomes', async () => {
      const row = makeOutcomeRow({ problem_set_id: null });
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await ironclawOutcomeStore.recordOutcome(
        'did:user:a',
        null,
        OUTCOME_TYPES.QUESTION_ASKED,
        null,
      );

      expect(result.problem_set_id).toBeNull();
    });
  });

  describe('getOutcomes', () => {
    it('MEM-07: returns outcomes for a user', async () => {
      const rows = [makeOutcomeRow()];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await ironclawOutcomeStore.getOutcomes('did:user:a');

      expect(result).toHaveLength(1);
      expect(result[0].outcome_type).toBe(OUTCOME_TYPES.SUGGESTION_ACCEPTED);
      const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(params).toContain('did:user:a');
    });

    it('passes days option as time filter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await ironclawOutcomeStore.getOutcomes('did:user:a', { days: 30 });

      const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
      // Should filter by time range
      expect(sql).toMatch(/created_at/i);
    });
  });

  describe('getOutcomeCounts', () => {
    it('returns aggregated counts grouped by outcome_type', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { outcome_type: OUTCOME_TYPES.SUGGESTION_ACCEPTED, count: '5' },
          { outcome_type: OUTCOME_TYPES.SUGGESTION_REJECTED, count: '2' },
        ],
      });

      const result = await ironclawOutcomeStore.getOutcomeCounts('did:user:a', 30);

      expect(result[OUTCOME_TYPES.SUGGESTION_ACCEPTED]).toBe(5);
      expect(result[OUTCOME_TYPES.SUGGESTION_REJECTED]).toBe(2);
    });
  });
});
