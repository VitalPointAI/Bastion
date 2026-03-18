/**
 * Agent Admin API — Phase 51 Extensions
 *
 * New admin endpoints for the Phase 51 unified agent architecture:
 * health monitoring, memory browsing, activate/deactivate, and test harness.
 *
 * These routes complement the existing /api/admin/agents CRUD endpoints in admin.ts.
 * Mounted at /api/admin/agents via router.use('/agents', agentAdminRouter).
 *
 * Only includes routes that do NOT conflict with existing admin.ts handlers:
 *   /:agentId/health         — detailed health for one agent
 *   /:agentId/memory         — list/delete memory entries
 *   /:agentId/memory/:id     — delete a memory entry
 *   /:agentId/activate       — activate with health gate check
 *   /:agentId/deactivate     — deactivate agent
 *   /:agentId/test           — test harness (send prompt, get output + timing)
 *
 * CRUD endpoints (GET /, POST /, GET /:id, PUT /:id, DELETE /:id) are handled
 * by the upgraded handlers in admin.ts which use AgentStore directly.
 */

import { Router, type Request, type Response } from 'express';
import { getAgentStore } from '../agents/agent-store.js';
import { getAgentMemoryStore } from '../agents/agent-memory-store.js';
import { getAgentRegistry } from '../agents/registry.js';
import { getPool } from '../lib/database.js';
import { canActivateAgent } from '../validation/activation-gate.js';
import type { StandardAgent } from '../agents/standard-agent.js';
import type { MemoryEntry } from '../agents/standard-agent.js';

const router = Router();

// ============================================================================
// Helper: fetch agent health row from DB
// ============================================================================

interface AgentHealthRow {
  agent_id: string;
  status: string;
  last_invocation: Date | null;
  success_rate: string | null;
  avg_response_time_ms: string | null;
  validation_score: string | null;
  agent_data: StandardAgent;
}

// ============================================================================
// GET /api/admin/agents/:agentId/health — detailed health for one agent
// ============================================================================

router.get('/:agentId/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const agentId = req.params.agentId as string;
    const pool = getPool();
    const result = await pool.query<AgentHealthRow>(
      `SELECT agent_id, status, last_invocation, success_rate, avg_response_time_ms,
              validation_score, agent_data
       FROM agents_v2
       WHERE agent_id = $1`,
      [agentId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: `Agent ${agentId} not found` });
      return;
    }
    const r = result.rows[0];
    res.setHeader('Cache-Control', 'no-cache');
    res.json({
      success: true,
      data: {
        agentId: r.agent_id,
        name: r.agent_data.name,
        status: r.status,
        lastInvocation: r.last_invocation ?? null,
        successRate: r.success_rate !== null ? parseFloat(r.success_rate) : null,
        avgResponseTimeMs: r.avg_response_time_ms !== null ? parseFloat(r.avg_response_time_ms) : null,
        validationScore: r.validation_score !== null ? parseFloat(r.validation_score) : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// ============================================================================
// POST /api/admin/agents/:agentId/activate — activate agent (health gate)
// ============================================================================

router.post('/:agentId/activate', async (req: Request, res: Response): Promise<void> => {
  try {
    const agentId = req.params.agentId as string;
    const store = getAgentStore();

    const existing = await store.getAgent(agentId);
    if (!existing) {
      res.status(404).json({ success: false, error: `Agent ${agentId} not found` });
      return;
    }

    // Check activation gate (requires test fixtures)
    const gate = await canActivateAgent(agentId, agentId);
    if (!gate.allowed) {
      res.status(400).json({
        success: false,
        error: `Activation gate failed: ${gate.reason}`,
        gateReason: gate.reason,
      });
      return;
    }

    await store.updateAgent(agentId, { status: 'active', active: true } as Partial<StandardAgent>);

    // Sync registry cache
    const updated = await store.getAgent(agentId);
    if (updated) {
      const registry = getAgentRegistry();
      (registry as unknown as { agents: Map<string, StandardAgent> }).agents.set(agentId, updated);
    }

    res.json({ success: true, message: `Agent ${agentId} activated` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// ============================================================================
// POST /api/admin/agents/:agentId/deactivate — deactivate agent
// ============================================================================

router.post('/:agentId/deactivate', async (req: Request, res: Response): Promise<void> => {
  try {
    const agentId = req.params.agentId as string;
    const store = getAgentStore();

    const existing = await store.getAgent(agentId);
    if (!existing) {
      res.status(404).json({ success: false, error: `Agent ${agentId} not found` });
      return;
    }

    await store.updateAgent(agentId, { status: 'inactive', active: false } as Partial<StandardAgent>);

    // Sync registry cache
    const updated = await store.getAgent(agentId);
    if (updated) {
      const registry = getAgentRegistry();
      (registry as unknown as { agents: Map<string, StandardAgent> }).agents.set(agentId, updated);
    }

    res.json({ success: true, message: `Agent ${agentId} deactivated` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// ============================================================================
// GET /api/admin/agents/:agentId/memory — list agent memory entries
// ============================================================================

router.get('/:agentId/memory', async (req: Request, res: Response): Promise<void> => {
  try {
    const agentId = req.params.agentId as string;
    const memoryStore = getAgentMemoryStore();

    const { type } = req.query;
    const memoryType = type as MemoryEntry['memoryType'] | undefined;

    const entries = await memoryStore.listEntries(agentId, memoryType);

    // Apply limit/offset if provided
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    let paged = entries;
    if (offset > 0) paged = entries.slice(offset);
    if (limit) paged = paged.slice(0, limit);

    res.json({ success: true, data: paged, total: entries.length, count: paged.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// ============================================================================
// DELETE /api/admin/agents/:agentId/memory/:entryId — delete memory entry
// ============================================================================

router.delete('/:agentId/memory/:entryId', async (req: Request, res: Response): Promise<void> => {
  try {
    const entryId = req.params.entryId as string;
    const memoryStore = getAgentMemoryStore();
    await memoryStore.forget(entryId);
    res.json({ success: true, message: `Memory entry ${entryId} deleted` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// ============================================================================
// POST /api/admin/agents/:agentId/test — send test prompt to agent
// ============================================================================

router.post('/:agentId/test', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const agentId = req.params.agentId as string;
    const { prompt, skill } = req.body;

    if (!prompt) {
      res.status(400).json({ success: false, error: 'Missing required field: prompt' });
      return;
    }

    const store = getAgentStore();
    const agent = await store.getAgent(agentId);
    if (!agent) {
      res.status(404).json({ success: false, error: `Agent ${agentId} not found` });
      return;
    }

    // Dynamically import LangGraphAgentWrapper for direct execution
    const { LangGraphAgentWrapper } = await import('../orchestration/agent-wrapper.js');
    const { HumanMessage } = await import('@langchain/core/messages');

    // Map StandardAgent clearance to BastionState ClassificationLevel
    type BastionClearance = 'UNCLASS' | 'CUI' | 'CONFIDENTIAL' | 'SECRET' | 'TOPSECRET';
    const clearanceMap: Record<string, BastionClearance> = {
      Unclassified: 'UNCLASS',
      CUI: 'CUI',
      Secret: 'SECRET',
      TopSecret: 'TOPSECRET',
    };
    const bastionClearance: BastionClearance = clearanceMap[agent.clearance] ?? 'UNCLASS';

    // Build wrapper — providerConfig will fall back to default (from LLM factory)
    const wrapper = new LangGraphAgentWrapper({
      manifest: agent,
      clearance: bastionClearance,
      tools: [],
      applyClassificationFilter: false,
    });

    // Create minimal BastionState for test invocation
    const nodeFunction = wrapper.createNode();
    const testState = {
      messages: [new HumanMessage(prompt)],
      classification: 'UNCLASS' as const,
      agentClearance: 'UNCLASS' as const,
      originator: null,
      releasability: [],
      next: null,
      currentAgent: agentId,
      previousAgent: null,
      taskId: `test-${Date.now()}`,
      taskType: skill || 'general',
      objectives: [prompt],
      taskInput: { prompt, skill: skill || null } as Record<string, unknown>,
      taskOutput: {} as Record<string, unknown>,
      threadId: `admin-test-${Date.now()}`,
      traceId: `trace-${Date.now()}`,
      createdAt: new Date().toISOString(),
      executionTrace: [] as import('../orchestration/state.js').ExecutionTraceEntry[],
      invocationCount: 0,
      maxInvocations: 1,
      interrupt: null,
      metadata: {},
    };

    // Type assertion required: BastionState is inferred from Annotation.Root()
    const resultState = await nodeFunction(testState as unknown as Parameters<typeof nodeFunction>[0]);

    const duration = Date.now() - startTime;

    // Extract output from resulting messages
    const resultMessages = resultState?.messages || [];
    const lastMessage = resultMessages.length > 0 ? resultMessages[resultMessages.length - 1] : null;
    const lastMsg = lastMessage as unknown as Record<string, unknown> | null;
    const output = lastMsg
      ? (typeof lastMsg.content === 'string'
        ? lastMsg.content
        : JSON.stringify(lastMsg.content))
      : '(no output)';

    // Log test execution to action log (fire-and-forget)
    store.logAction(agentId, 'admin-test', { prompt, skill, duration } as Record<string, unknown>).catch(() => {});

    res.json({
      success: true,
      data: {
        output,
        durationMs: duration,
        agentId,
        skill: skill || null,
        executionTrace: resultState?.executionTrace || [],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const duration = Date.now() - startTime;
    res.status(500).json({
      success: false,
      error: message,
      data: { output: null, durationMs: duration, error: message },
    });
  }
});

export { router as agentAdminRouter };
