/**
 * Orchestration API Endpoints
 *
 * REST and WebSocket API for multi-agent orchestration.
 * Provides endpoints for:
 * - Task execution with different patterns
 * - Supervisor management
 * - Human checkpoint handling
 * - Execution trace querying
 * - Real-time execution monitoring
 */

import { Router, Request, Response } from 'express';
import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { HumanMessage } from '@langchain/core/messages';

import {
  type ClassificationLevel,
} from '../orchestration/state.js';
import { getClassificationFilter } from '../orchestration/classification-filter.js';
import { createLangGraphAgent, LangGraphAgentWrapper } from '../orchestration/agent-wrapper.js';
import { BastionSupervisor, createSupervisor } from '../orchestration/supervisor.js';
import { TaskExecutor, ExecutionPattern, createTask, type Task } from '../orchestration/execution-patterns.js';
import {
  getTracer,
} from '../orchestration/observability.js';
import {
  getCheckpointManager,
} from '../orchestration/human-checkpoints.js';
import { getAgentRegistry } from '../agents/registry.js';

const router = Router();

// Active WebSocket connections for execution streaming
const executionSubscriptions: Map<string, Set<WebSocket>> = new Map();

// Active supervisors (in production, would be persisted)
const activeSupervisors: Map<string, BastionSupervisor> = new Map();

// ==========================================================================
// Helper Functions
// ==========================================================================

/**
 * Extract user DID from request
 */
function getUserDid(req: Request): string {
  return (req.headers['x-did'] as string) || 'did:near:anonymous';
}

/**
 * Extract user clearance from request
 */
function getUserClearance(req: Request): ClassificationLevel {
  const clearance = (req.headers['x-clearance'] as string) || 'UNCLASS';
  return clearance as ClassificationLevel;
}

/**
 * Broadcast execution event to subscribers
 */
function broadcastExecutionEvent(
  executionId: string,
  event: { type: string; data: unknown }
): void {
  const subscribers = executionSubscriptions.get(executionId);
  if (!subscribers) return;

  const message = JSON.stringify(event);
  for (const ws of subscribers) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

// ==========================================================================
// Execution Endpoints
// ==========================================================================

/**
 * POST /api/orchestration/execute
 * Execute a task with specified agents and pattern
 */
router.post('/execute', async (req: Request, res: Response): Promise<void> => {
  try {
    const userDid = getUserDid(req);
    const userClearance = getUserClearance(req);
    const tracer = getTracer();

    // Validate input
    const {
      taskType,
      agents: agentIds,
      executionPattern = 'sequential',
      input,
      classification = 'UNCLASS',
      objectives = [],
    } = req.body;

    if (!taskType || !agentIds || !Array.isArray(agentIds)) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: taskType, agents',
      });
      return;
    }

    // Check user clearance
    const classificationLevel = classification as ClassificationLevel;
    if (!canAccessClassification(userClearance, classificationLevel)) {
      res.status(403).json({
        success: false,
        error: `User clearance ${userClearance} insufficient for ${classification}`,
      });
      return;
    }

    // Load agents
    const agents: LangGraphAgentWrapper[] = [];
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    for (const agentId of agentIds) {
      try {
        const agent = await createLangGraphAgent(agentId, userClearance);
        agents.push(agent);
      } catch (error) {
        console.warn(`[Orchestration] Failed to load agent ${agentId}:`, error);
      }
    }

    if (agents.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No valid agents found',
      });
      return;
    }

    // Create execution
    const executionId = randomUUID();
    const threadId = randomUUID();

    // Start trace
    const traceId = await tracer.startTrace({
      threadId,
      classification: classificationLevel,
      taskType,
      metadata: { executionId, userDid, pattern: executionPattern },
    });

    // Create task executor
    const executor = new TaskExecutor(agents);

    // Create tasks from objectives
    const tasks: Task[] = objectives.length > 0
      ? objectives.map((obj: string, i: number) => createTask({
          name: `Task ${i + 1}`,
          description: obj,
          classification: classificationLevel,
          assignedAgent: agentIds[i % agentIds.length],
        }))
      : [createTask({
          name: taskType,
          description: input?.prompt || taskType,
          classification: classificationLevel,
        })];

    // Return execution ID immediately
    res.json({
      success: true,
      executionId,
      threadId,
      traceId,
      status: 'running',
    });

    // Execute asynchronously
    (async () => {
      try {
        broadcastExecutionEvent(executionId, {
          type: 'execution_started',
          data: { executionId, threadId, pattern: executionPattern },
        });

        const result = await executor.execute(
          tasks,
          executionPattern as ExecutionPattern,
          threadId,
          { classification: classificationLevel }
        );

        await tracer.completeTrace(traceId, result.success ? 'completed' : 'failed');

        broadcastExecutionEvent(executionId, {
          type: 'execution_completed',
          data: {
            executionId,
            success: result.success,
            results: result.results,
            totalDurationMs: result.totalDurationMs,
          },
        });
      } catch (error) {
        await tracer.completeTrace(
          traceId,
          'failed',
          error instanceof Error ? error.message : String(error)
        );

        broadcastExecutionEvent(executionId, {
          type: 'execution_failed',
          data: {
            executionId,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    })();
  } catch (error) {
    console.error('[Orchestration] Execute error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
});

/**
 * GET /api/orchestration/executions
 * List executions with filtering
 */
router.get('/executions', async (req: Request, res: Response): Promise<void> => {
  try {
    const userClearance = getUserClearance(req);
    const tracer = getTracer();

    const { status, classification, taskType, limit = 50, offset = 0 } = req.query;

    const result = await tracer.listTraces({
      status: status as string | undefined,
      classification: classification as ClassificationLevel | undefined,
      taskType: taskType as string | undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });

    // Filter by user clearance
    const accessibleTraces = result.traces.filter(
      (trace) => canAccessClassification(userClearance, trace.classification)
    );

    res.json({
      success: true,
      executions: accessibleTraces,
      total: result.total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error('[Orchestration] List executions error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
});

/**
 * GET /api/orchestration/executions/:id
 * Get execution details
 */
router.get('/executions/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userClearance = getUserClearance(req);
    const tracer = getTracer();
    const traceId = req.params.id as string;

    const trace = await tracer.getTrace(traceId);
    if (!trace) {
      res.status(404).json({
        success: false,
        error: 'Execution not found',
      });
      return;
    }

    if (!canAccessClassification(userClearance, trace.classification)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient clearance',
      });
      return;
    }

    res.json({
      success: true,
      execution: trace,
    });
  } catch (error) {
    console.error('[Orchestration] Get execution error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
});

/**
 * POST /api/orchestration/executions/:id/cancel
 * Cancel a running execution
 */
router.post('/executions/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const userClearance = getUserClearance(req);
    const tracer = getTracer();
    const traceId = req.params.id as string;

    const trace = await tracer.getTrace(traceId);
    if (!trace) {
      res.status(404).json({
        success: false,
        error: 'Execution not found',
      });
      return;
    }

    if (!canAccessClassification(userClearance, trace.classification)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient clearance',
      });
      return;
    }

    // Mark as interrupted
    await tracer.completeTrace(traceId, 'interrupted', 'Cancelled by user');

    broadcastExecutionEvent(trace.threadId, {
      type: 'execution_cancelled',
      data: { traceId },
    });

    res.json({
      success: true,
      message: 'Execution cancelled',
    });
  } catch (error) {
    console.error('[Orchestration] Cancel execution error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
});

/**
 * GET /api/orchestration/executions/:id/trace
 * Get execution trace with spans
 */
router.get('/executions/:id/trace', async (req: Request, res: Response): Promise<void> => {
  try {
    const userClearance = getUserClearance(req);
    const tracer = getTracer();
    const traceId = req.params.id as string;

    const trace = await tracer.getTrace(traceId);
    if (!trace) {
      res.status(404).json({
        success: false,
        error: 'Execution not found',
      });
      return;
    }

    if (!canAccessClassification(userClearance, trace.classification)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient clearance',
      });
      return;
    }

    res.json({
      success: true,
      traceId,
      spans: trace.spans,
      agentInvocations: trace.agentInvocations,
      toolCalls: trace.toolCalls,
    });
  } catch (error) {
    console.error('[Orchestration] Get trace error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
});

/**
 * GET /api/orchestration/executions/:id/graph
 * Get execution graph for visualization
 */
router.get('/executions/:id/graph', async (req: Request, res: Response): Promise<void> => {
  try {
    const userClearance = getUserClearance(req);
    const tracer = getTracer();
    const traceId = req.params.id as string;

    const trace = await tracer.getTrace(traceId);
    if (!trace) {
      res.status(404).json({
        success: false,
        error: 'Execution not found',
      });
      return;
    }

    if (!canAccessClassification(userClearance, trace.classification)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient clearance',
      });
      return;
    }

    const graph = await tracer.getExecutionGraph(traceId);

    res.json({
      success: true,
      graph,
    });
  } catch (error) {
    console.error('[Orchestration] Get graph error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
});

// ==========================================================================
// Supervisor Endpoints
// ==========================================================================

/**
 * POST /api/orchestration/supervisors
 * Create a new supervisor
 */
router.post('/supervisors', async (req: Request, res: Response): Promise<void> => {
  try {
    const _userDid = getUserDid(req);
    const userClearance = getUserClearance(req);

    const {
      name,
      description,
      agents: agentIds,
      clearance = userClearance,
      routingPrompt,
      maxIterations = 50,
      humanCheckpoints,
    } = req.body;

    if (!name || !agentIds || !Array.isArray(agentIds)) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: name, agents',
      });
      return;
    }

    // Load agents
    const agents: LangGraphAgentWrapper[] = [];
    for (const agentId of agentIds) {
      try {
        const agent = await createLangGraphAgent(agentId, clearance as ClassificationLevel);
        agents.push(agent);
      } catch (error) {
        console.warn(`[Orchestration] Failed to load agent ${agentId}:`, error);
      }
    }

    if (agents.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No valid agents found',
      });
      return;
    }

    // Create supervisor
    const supervisorId = randomUUID();
    const supervisor = createSupervisor({
      supervisorId,
      name,
      description: description || `Supervisor ${name}`,
      clearance: clearance as ClassificationLevel,
      routingPrompt,
      maxIterations,
      humanCheckpoints,
    }, agents);

    await supervisor.initialize();

    // Store in memory
    activeSupervisors.set(supervisorId, supervisor);

    res.json({
      success: true,
      supervisorId,
      name,
      agentCount: agents.length,
      agents: agents.map(a => ({ id: a.agentId, name: a.name })),
    });
  } catch (error) {
    console.error('[Orchestration] Create supervisor error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
});

/**
 * GET /api/orchestration/supervisors
 * List active supervisors
 */
router.get('/supervisors', async (req: Request, res: Response): Promise<void> => {
  try {
    const supervisors = Array.from(activeSupervisors.entries()).map(([id, _sup]) => ({
      supervisorId: id,
      // Note: In production, would store more metadata
    }));

    res.json({
      success: true,
      supervisors,
      total: supervisors.length,
    });
  } catch (error) {
    console.error('[Orchestration] List supervisors error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
});

/**
 * POST /api/orchestration/supervisors/:id/execute
 * Execute a task through a supervisor
 */
router.post('/supervisors/:id/execute', async (req: Request, res: Response): Promise<void> => {
  try {
    const userDid = getUserDid(req);
    const userClearance = getUserClearance(req);
    const supervisorId = req.params.id as string;
    const tracer = getTracer();

    const supervisor = activeSupervisors.get(supervisorId);
    if (!supervisor) {
      res.status(404).json({
        success: false,
        error: 'Supervisor not found',
      });
      return;
    }

    const {
      messages = [],
      classification = 'UNCLASS',
      taskType = 'general',
      objectives = [],
    } = req.body;

    // Check clearance
    const classificationLevel = classification as ClassificationLevel;
    if (!canAccessClassification(userClearance, classificationLevel)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient clearance',
      });
      return;
    }

    // Create thread
    const threadId = randomUUID();

    // Start trace
    const traceId = await tracer.startTrace({
      threadId,
      classification: classificationLevel,
      taskType,
      metadata: { supervisorId, userDid },
    });

    // Convert messages to LangChain format
    const langchainMessages = messages.map((m: { role: string; content: string }) =>
      new HumanMessage(m.content)
    );

    // Return immediately
    res.json({
      success: true,
      threadId,
      traceId,
      status: 'running',
    });

    // Execute asynchronously
    (async () => {
      try {
        broadcastExecutionEvent(threadId, {
          type: 'supervisor_started',
          data: { supervisorId, threadId },
        });

        const result = await supervisor.execute({
          threadId,
          messages: langchainMessages,
          classification: classificationLevel,
          taskType,
          objectives,
        });

        await tracer.completeTrace(
          traceId,
          result.completed ? 'completed' : 'interrupted',
          result.interruptReason
        );

        broadcastExecutionEvent(threadId, {
          type: 'supervisor_completed',
          data: {
            threadId,
            completed: result.completed,
            invokedAgents: result.invokedAgents,
            finalDecision: result.finalDecision,
          },
        });
      } catch (error) {
        await tracer.completeTrace(
          traceId,
          'failed',
          error instanceof Error ? error.message : String(error)
        );

        broadcastExecutionEvent(threadId, {
          type: 'supervisor_failed',
          data: {
            threadId,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    })();
  } catch (error) {
    console.error('[Orchestration] Supervisor execute error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
});

// ==========================================================================
// Checkpoint Endpoints
// ==========================================================================

/**
 * GET /api/orchestration/checkpoints
 * List pending checkpoints
 */
router.get('/checkpoints', async (req: Request, res: Response): Promise<void> => {
  try {
    const userClearance = getUserClearance(req);
    const manager = getCheckpointManager();
    await manager.initialize();

    const { status = 'pending', limit = 50, offset = 0 } = req.query;

    const result = await manager.getPendingCheckpoints({
      status: status as 'pending' | 'approved' | 'rejected' | 'expired',
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });

    // Filter by clearance
    const accessibleCheckpoints = result.checkpoints.filter(
      (cp) => canAccessClassification(userClearance, cp.classification)
    );

    res.json({
      success: true,
      checkpoints: accessibleCheckpoints.map(cp => ({
        checkpointId: cp.checkpointId,
        threadId: cp.threadId,
        trigger: cp.trigger,
        triggerDescription: cp.triggerDescription,
        classification: cp.classification,
        currentAgent: cp.currentAgent,
        createdAt: cp.createdAt,
        status: cp.status,
        priority: cp.priority,
      })),
      total: result.total,
    });
  } catch (error) {
    console.error('[Orchestration] List checkpoints error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
});

/**
 * GET /api/orchestration/checkpoints/:id
 * Get checkpoint details
 */
router.get('/checkpoints/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userClearance = getUserClearance(req);
    const manager = getCheckpointManager();
    await manager.initialize();
    const checkpointId = req.params.id as string;

    const checkpoint = await manager.getCheckpoint(checkpointId);
    if (!checkpoint) {
      res.status(404).json({
        success: false,
        error: 'Checkpoint not found',
      });
      return;
    }

    if (!canAccessClassification(userClearance, checkpoint.classification)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient clearance',
      });
      return;
    }

    res.json({
      success: true,
      checkpoint: {
        ...checkpoint,
        // Exclude full state for security
        state: undefined,
        statePreview: {
          messageCount: checkpoint.state.messages.length,
          taskType: checkpoint.state.taskType,
          objectives: checkpoint.state.objectives,
        },
      },
    });
  } catch (error) {
    console.error('[Orchestration] Get checkpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
});

/**
 * POST /api/orchestration/checkpoints/:id/approve
 * Approve a checkpoint and resume execution
 */
router.post('/checkpoints/:id/approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const userDid = getUserDid(req);
    const userClearance = getUserClearance(req);
    const manager = getCheckpointManager();
    await manager.initialize();
    const checkpointId = req.params.id as string;

    const checkpoint = await manager.getCheckpoint(checkpointId);
    if (!checkpoint) {
      res.status(404).json({
        success: false,
        error: 'Checkpoint not found',
      });
      return;
    }

    if (!canAccessClassification(userClearance, checkpoint.classification)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient clearance',
      });
      return;
    }

    const { reason, modifications } = req.body;

    const result = await manager.approve(checkpointId, {
      decidedBy: userDid,
      reason,
      modifications,
    });

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('[Orchestration] Approve checkpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
});

/**
 * POST /api/orchestration/checkpoints/:id/reject
 * Reject a checkpoint and terminate execution
 */
router.post('/checkpoints/:id/reject', async (req: Request, res: Response): Promise<void> => {
  try {
    const userDid = getUserDid(req);
    const userClearance = getUserClearance(req);
    const manager = getCheckpointManager();
    await manager.initialize();
    const checkpointId = req.params.id as string;

    const checkpoint = await manager.getCheckpoint(checkpointId);
    if (!checkpoint) {
      res.status(404).json({
        success: false,
        error: 'Checkpoint not found',
      });
      return;
    }

    if (!canAccessClassification(userClearance, checkpoint.classification)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient clearance',
      });
      return;
    }

    const { reason } = req.body;

    const result = await manager.reject(checkpointId, {
      decidedBy: userDid,
      reason,
    });

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('[Orchestration] Reject checkpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
});

// ==========================================================================
// Metrics Endpoints
// ==========================================================================

/**
 * GET /api/orchestration/metrics
 * Get orchestration metrics
 */
router.get('/metrics', async (req: Request, res: Response): Promise<void> => {
  try {
    const tracer = getTracer();
    const filter = getClassificationFilter();

    const { since, until } = req.query;

    const sinceDate = since ? new Date(since as string) : undefined;
    const untilDate = until ? new Date(until as string) : undefined;

    const [tracingMetrics, filterStats] = await Promise.all([
      tracer.getMetrics(sinceDate, untilDate),
      filter.getFilterStats(sinceDate),
    ]);

    res.json({
      success: true,
      metrics: {
        tracing: tracingMetrics,
        filtering: filterStats,
      },
    });
  } catch (error) {
    console.error('[Orchestration] Get metrics error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
});

// ==========================================================================
// Helper Functions
// ==========================================================================

const CLASSIFICATION_ORDER: Record<ClassificationLevel, number> = {
  UNCLASS: 1,
  CUI: 2,
  CONFIDENTIAL: 3,
  SECRET: 4,
  TOPSECRET: 5,
};

function canAccessClassification(
  userClearance: ClassificationLevel,
  targetClassification: ClassificationLevel
): boolean {
  return CLASSIFICATION_ORDER[userClearance] >= CLASSIFICATION_ORDER[targetClassification];
}

// ==========================================================================
// WebSocket Setup
// ==========================================================================

/**
 * Setup WebSocket server for execution streaming
 */
export function setupOrchestrationWebSocket(server: HTTPServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);

    // Handle /ws/orchestration/:executionId
    const match = url.pathname.match(/^\/ws\/orchestration\/([^/]+)$/);
    if (match) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        const executionId = match[1];
        handleExecutionSubscription(ws, executionId);
      });
    }
    // Non-matching paths are left for other upgrade handlers
  });
}

function handleExecutionSubscription(ws: WebSocket, executionId: string): void {
  // Add to subscribers
  let subscribers = executionSubscriptions.get(executionId);
  if (!subscribers) {
    subscribers = new Set();
    executionSubscriptions.set(executionId, subscribers);
  }
  subscribers.add(ws);

  console.log(`[Orchestration WS] Client subscribed to execution ${executionId}`);

  // Send initial acknowledgment
  ws.send(JSON.stringify({
    type: 'subscribed',
    data: { executionId },
  }));

  // Handle close
  ws.on('close', () => {
    const subs = executionSubscriptions.get(executionId);
    if (subs) {
      subs.delete(ws);
      if (subs.size === 0) {
        executionSubscriptions.delete(executionId);
      }
    }
    console.log(`[Orchestration WS] Client unsubscribed from execution ${executionId}`);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`[Orchestration WS] Error for execution ${executionId}:`, error);
  });
}

export default router;
