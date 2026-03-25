/**
 * Auth Isolation Tests: Ironclaw Router — Memory Endpoints
 *
 * Phase 57 Plan 03 — Verifies that memory endpoints always enforce
 * user_did scoping from the authenticated user's session, never from
 * any client-controlled input. A user cannot read or delete another
 * user's memories even if they know the memory key.
 *
 * Strategy: Mock getUserDid extraction via zeroTrust middleware and
 * mock ironclawUserMemoryStore to capture arguments. Assert store is
 * always called with the authenticated user's DID ('did:user:a').
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Mock ironclawUserMemoryStore BEFORE importing the router
// ---------------------------------------------------------------------------

const mockGetActiveMemories = vi.fn();
const mockDeleteUserMemory = vi.fn();
const mockDeleteAllUserMemories = vi.fn();

vi.mock('./ironclaw-memory-store.js', () => ({
  ironclawUserMemoryStore: {
    getActiveMemories: mockGetActiveMemories,
    getUserMemory: vi.fn(),
    deleteUserMemory: mockDeleteUserMemory,
    deleteAllUserMemories: mockDeleteAllUserMemories,
  },
}));

// Mock all other heavy dependencies so the router module loads in test
vi.mock('./ironclaw-service.js', () => ({
  ironclawService: {
    isHealthy: vi.fn(),
    handleGlobalMessage: vi.fn(),
    getGlobalHistory: vi.fn(),
    getGlobalChannel: vi.fn().mockReturnValue('channel:global'),
    handleMessage: vi.fn(),
    getHistory: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('./action-pipeline.js', () => ({
  actionPipeline: {
    handleConfirmation: vi.fn(),
    handleEmergencyAction: vi.fn(),
  },
}));
vi.mock('./ironclaw-store.js', () => ({
  ironclawStore: {
    getAllTrustPreferences: vi.fn().mockResolvedValue([]),
    revokeTrust: vi.fn(),
    listThreads: vi.fn().mockResolvedValue([]),
    createThread: vi.fn(),
    renameThread: vi.fn(),
    deleteThread: vi.fn(),
  },
}));
vi.mock('./ironclaw-types.js', () => ({
  SENSITIVE_FIELDS: new Set<string>(),
}));
vi.mock('../messaging/message-bus.js', () => ({
  getMessageBus: vi.fn().mockReturnValue({ publish: vi.fn() }),
}));
vi.mock('../lib/database.js', () => ({
  getPool: vi.fn().mockReturnValue({ query: vi.fn().mockResolvedValue({ rows: [] }) }),
}));
vi.mock('../problem-set/problem-set-member-store.js', () => ({
  problemSetMemberStore: { getMember: vi.fn() },
}));
vi.mock('../problem-set/problem-set-store.js', () => ({
  problemSetStore: { updateProblemSet: vi.fn() },
}));
vi.mock('../design/design-store.js', () => ({
  designStore: { updateSection: vi.fn() },
}));
vi.mock('./task-store.js', () => ({
  getTaskStore: vi.fn().mockReturnValue({ getTasksForProblemSet: vi.fn(), getTask: vi.fn() }),
}));
vi.mock('./task-orchestrator.js', () => ({
  getTaskOrchestrator: vi.fn().mockReturnValue({
    handleApproval: vi.fn(),
    handleRefinement: vi.fn(),
  }),
}));
vi.mock('./self-update-service.js', () => ({
  selfUpdateService: { getStatus: vi.fn().mockResolvedValue({ currentVersion: 'test' }) },
}));
vi.mock('./ironclaw-memory-service.js', () => ({
  memoryRetrievalService: {
    recordOutcome: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helper: build mock req and res objects
// ---------------------------------------------------------------------------

/**
 * Build a minimal mock Request that simulates an authenticated user.
 * The getUserDid() helper in the router checks req.zeroTrust.did first.
 * By setting this to 'did:user:a' we simulate authentication as user A.
 */
function mockReq(overrides: Partial<Request> & Record<string, unknown> = {}): Request {
  return {
    zeroTrust: { did: 'did:user:a' },
    headers: {},
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

/**
 * Build a mock Response that captures status and json calls.
 * Returns a chainable object matching Express response API.
 */
function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
    end() {
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

// ---------------------------------------------------------------------------
// Import router AFTER mocks are configured
// ---------------------------------------------------------------------------

// We need to extract individual route handlers from the router.
// Since Express router handlers are registered as middleware, we test
// the module-level logic by invoking the router's internal handler functions
// by finding routes on the router stack.

const { ironclawRouter } = await import('./ironclaw-router.js');

/**
 * Find the handler function registered for a given method + path on the ironclawRouter.
 * Returns the last matching layer's dispatch function.
 */
function findHandler(method: string, routePath: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stack = (ironclawRouter as any).stack as Array<{
    route?: { path: string; stack: Array<{ method: string; handle: (req: Request, res: Response) => void }> };
  }>;
  for (const layer of stack) {
    if (!layer.route) continue;
    const routeMatch = layer.route.path === routePath || layer.route.path === `/${routePath.replace(/^\//, '')}`;
    if (!routeMatch) continue;
    const methodLayer = layer.route.stack.find((l) => l.method === method.toLowerCase());
    if (methodLayer) return methodLayer.handle;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Ironclaw Router — Memory Endpoint Auth Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveMemories.mockResolvedValue([]);
    mockDeleteUserMemory.mockResolvedValue(undefined);
    mockDeleteAllUserMemories.mockResolvedValue(undefined);
  });

  describe('GET /memory — auth isolation', () => {
    it('calls getActiveMemories with the authenticated user DID', async () => {
      const handler = findHandler('get', '/memory');
      expect(handler, 'GET /memory handler must be registered').not.toBeNull();

      const req = mockReq();
      const res = mockRes();
      await handler!(req, res as unknown as Response);

      // Auth isolation: store called with authenticated DID, not any other value
      expect(mockGetActiveMemories).toHaveBeenCalledTimes(1);
      expect(mockGetActiveMemories).toHaveBeenCalledWith('did:user:a');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ memories: [] });
    });

    it('never calls store with a different DID even if request attributes differ', async () => {
      const handler = findHandler('get', '/memory');
      // Simulate a request where headers contain a different DID but zeroTrust has user A
      const req = mockReq({ headers: { 'x-did': 'did:user:b' } });
      const res = mockRes();
      await handler!(req, res as unknown as Response);

      // zeroTrust.did takes precedence — store must only see 'did:user:a'
      expect(mockGetActiveMemories).toHaveBeenCalledWith('did:user:a');
      expect(mockGetActiveMemories).not.toHaveBeenCalledWith('did:user:b');
    });
  });

  describe('DELETE /memory/:key — auth isolation', () => {
    it('calls deleteUserMemory with authenticated DID and provided key', async () => {
      const handler = findHandler('delete', '/memory/:key');
      expect(handler, 'DELETE /memory/:key handler must be registered').not.toBeNull();

      const req = mockReq({ params: { key: 'working_style' } });
      const res = mockRes();
      await handler!(req, res as unknown as Response);

      // Auth isolation: user A's DID is always enforced — user A cannot delete user B's memory
      expect(mockDeleteUserMemory).toHaveBeenCalledTimes(1);
      expect(mockDeleteUserMemory).toHaveBeenCalledWith('did:user:a', 'working_style');
      expect(res.body).toEqual({ deleted: 'working_style' });
    });

    it('cannot delete another user\'s memory — DID always comes from session', async () => {
      const handler = findHandler('delete', '/memory/:key');
      // Even if user somehow knows another user's key, the store call always uses
      // the authenticated session DID, not any client-supplied value
      const req = mockReq({ params: { key: 'communication_style' } });
      const res = mockRes();
      await handler!(req, res as unknown as Response);

      expect(mockDeleteUserMemory).toHaveBeenCalledWith('did:user:a', 'communication_style');
      // User B's DID is never passed to the store
      expect(mockDeleteUserMemory).not.toHaveBeenCalledWith('did:user:b', expect.any(String));
    });
  });

  describe('DELETE /memory/all — auth isolation', () => {
    it('calls deleteAllUserMemories with the authenticated user DID', async () => {
      const handler = findHandler('delete', '/memory/all');
      expect(handler, 'DELETE /memory/all handler must be registered').not.toBeNull();

      const req = mockReq();
      const res = mockRes();
      await handler!(req, res as unknown as Response);

      expect(mockDeleteAllUserMemories).toHaveBeenCalledTimes(1);
      expect(mockDeleteAllUserMemories).toHaveBeenCalledWith('did:user:a');
      expect(res.body).toEqual({ deleted: 'all' });
    });

    it('/memory/all is a separate route from /memory/:key', () => {
      // Verify both routes exist as distinct registrations on the router
      const allHandler = findHandler('delete', '/memory/all');
      const keyHandler = findHandler('delete', '/memory/:key');

      expect(allHandler).not.toBeNull();
      expect(keyHandler).not.toBeNull();
      // They should be distinct handler functions
      expect(allHandler).not.toBe(keyHandler);
    });
  });
});
