/**
 * Unit tests for IronclawEventStore
 *
 * Phase 67 Plan 01 — TDD RED phase
 * Tests: append(), getEventsSince(), emit(), ensureTable(), client cleanup,
 * and event type taxonomy coverage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock getPool BEFORE importing the store
// ---------------------------------------------------------------------------

const mockQuery = vi.fn();
const mockPool = { query: mockQuery };

vi.mock('../../lib/database.js', () => ({
  getPool: () => mockPool,
}));

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------

import {
  IronclawEventStore,
  ironclawEventStore,
} from '../ironclaw-event-store.js';

import {
  IronclawEventType,
  type AckPayload,
  type ToolCallPayload,
  type ToolResultPayload,
  type DelegationPayload,
  type ProgressPayload,
  type ResponsePayload,
  type ErrorPayload,
} from '../ironclaw-event-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRes() {
  return {
    write: vi.fn(),
    // minimal Express.Response shape needed for tests
  } as unknown as import('express').Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IronclawEventStore', () => {
  let store: IronclawEventStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new IronclawEventStore();
  });

  // Test 1: append() inserts a row and returns a numeric id
  it('append() inserts a row and returns the numeric id', async () => {
    const expectedId = 42;
    mockQuery.mockResolvedValueOnce({ rows: [{ id: expectedId }] });

    const payload: AckPayload = { messageId: 'msg-1', threadId: 'thread-1' };
    const id = await store.append('scope-1', 'did:near:user1', IronclawEventType.ack, payload);

    expect(id).toBe(expectedId);
    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO ironclaw_events');
    expect(params).toContain('scope-1');
    expect(params).toContain('did:near:user1');
    expect(params).toContain(IronclawEventType.ack);
  });

  // Test 2: getEventsSince() returns only events with id > lastId ordered ASC
  it('getEventsSince() returns events with id > lastId for the given scopeId', async () => {
    const fakeRows = [
      { id: 5, event_type: 'ack', payload: { messageId: 'msg-5' } },
      { id: 6, event_type: 'progress', payload: { step: 1, totalSteps: 3, label: 'thinking' } },
    ];
    mockQuery.mockResolvedValueOnce({ rows: fakeRows });

    const results = await store.getEventsSince('scope-1', 4);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(5);
    expect(results[1].id).toBe(6);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('WHERE');
    expect(sql).toContain('scope_id');
    expect(params).toContain('scope-1');
    expect(params).toContain(4);
  });

  // Test 3: getEventsSince() with threadId filters by thread_id
  it('getEventsSince() with threadId adds thread_id filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await store.getEventsSince('scope-2', 0, 'thread-abc');

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('thread_id');
    expect(params).toContain('thread-abc');
  });

  // Test 4: ensureTable() creates the ironclaw_events table idempotently
  it('ensureTable() runs CREATE TABLE IF NOT EXISTS idempotently', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await store.ensureTable();

    const calls = mockQuery.mock.calls as [string, unknown[]][];
    const sqls = calls.map(([sql]) => sql).join('\n');
    expect(sqls).toContain('CREATE TABLE IF NOT EXISTS ironclaw_events');
  });

  // Test 5: emit() writes correct SSE format to registered client Response objects
  it('emit() writes SSE format id/event/data chunks to registered clients', async () => {
    const res = makeRes();
    store.registerClient('scope-sse', res);

    // Trigger emit via append
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 10 }] });
    const payload: ProgressPayload = { step: 1, totalSteps: 5, label: 'step one' };
    await store.append('scope-sse', 'did:near:user1', IronclawEventType.progress, payload);

    expect(res.write).toHaveBeenCalledOnce();
    const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(written).toContain('id: 10');
    expect(written).toContain('event: progress');
    expect(written).toContain(JSON.stringify(payload));
    expect(written).toMatch(/\n\n$/); // SSE chunk ends with double newline
  });

  // Test 6: emit() removes clients that throw on write
  it('emit() removes a client if its write() throws', async () => {
    const badRes = {
      write: vi.fn().mockImplementation(() => {
        throw new Error('broken pipe');
      }),
    } as unknown as import('express').Response;

    store.registerClient('scope-err', badRes);

    mockQuery.mockResolvedValueOnce({ rows: [{ id: 99 }] });
    const payload: ErrorPayload = { message: 'test error', retryable: false };
    await store.append('scope-err', 'did:near:user2', IronclawEventType.error, payload);

    // After throwing, the client should be removed; a second append should not call write again
    vi.clearAllMocks();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 100 }] });
    await store.append('scope-err', 'did:near:user2', IronclawEventType.error, payload);

    expect(badRes.write).not.toHaveBeenCalled();
  });

  // Test 7: All 7 event types are exported from ironclaw-event-types.ts
  it('exports all 7 required event types', () => {
    expect(IronclawEventType.ack).toBe('ack');
    expect(IronclawEventType.tool_call).toBe('tool_call');
    expect(IronclawEventType.tool_result).toBe('tool_result');
    expect(IronclawEventType.delegation).toBe('delegation');
    expect(IronclawEventType.progress).toBe('progress');
    expect(IronclawEventType.response).toBe('response');
    expect(IronclawEventType.error).toBe('error');

    expect(IronclawEventType.data_updated).toBe('data_updated');

    // Verify all 8 types are present
    const types = Object.values(IronclawEventType);
    expect(types).toHaveLength(8);
  });

  // Bonus: singleton export exists
  it('exports a default singleton ironclawEventStore', () => {
    expect(ironclawEventStore).toBeInstanceOf(IronclawEventStore);
  });

  // Bonus: removeClient works correctly
  it('removeClient() removes the client so it no longer receives events', async () => {
    const res = makeRes();
    store.registerClient('scope-rm', res);
    store.removeClient('scope-rm', res);

    mockQuery.mockResolvedValueOnce({ rows: [{ id: 11 }] });
    await store.append('scope-rm', 'did:near:user1', IronclawEventType.ack, { messageId: 'x' });

    expect(res.write).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Payload shape tests
// ---------------------------------------------------------------------------

describe('Payload interfaces', () => {
  it('AckPayload has messageId and optional threadId', () => {
    const p: AckPayload = { messageId: 'msg-1' };
    expect(p.messageId).toBe('msg-1');
    expect(p.threadId).toBeUndefined();
  });

  it('ToolCallPayload has required fields', () => {
    const p: ToolCallPayload = {
      toolName: 'search',
      status: 'running',
      statusMessage: 'Searching...',
    };
    expect(p.toolName).toBe('search');
    expect(p.status).toBe('running');
  });

  it('ResponsePayload has delta and done optional fields', () => {
    const p: ResponsePayload = { content: 'hello', sender: 'ironclaw', delta: true, done: false };
    expect(p.delta).toBe(true);
    expect(p.done).toBe(false);
  });

  it('ErrorPayload has required retryable field', () => {
    const p: ErrorPayload = { message: 'fail', retryable: true };
    expect(p.retryable).toBe(true);
  });

  it('DelegationPayload has specialistId and status', () => {
    const p: DelegationPayload = {
      specialistId: 'agent-1',
      specialistDisplayName: 'Intel Analyst',
      status: 'delegating',
    };
    expect(p.status).toBe('delegating');
  });

  it('ProgressPayload has step, totalSteps, label', () => {
    const p: ProgressPayload = { step: 2, totalSteps: 5, label: 'Analyzing...' };
    expect(p.step).toBe(2);
  });

  it('ToolResultPayload has toolName, output, summary, elapsed', () => {
    const p: ToolResultPayload = {
      toolName: 'analyze',
      output: { data: 'result' },
      summary: 'Done',
      elapsed: 1200,
    };
    expect(p.elapsed).toBe(1200);
  });
});
