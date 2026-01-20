/**
 * Observability Layer
 *
 * Provides comprehensive tracing, metrics, and execution graph visualization
 * for multi-agent workflows.
 *
 * Features:
 * - Structured execution traces with spans
 * - Classification context in all traces
 * - Agent invocation recording
 * - Tool call tracking
 * - PostgreSQL persistence for traces
 * - Execution graph visualization data
 * - Metrics collection and aggregation
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { ClassificationLevel, ExecutionTraceEntry } from './state.js';

/**
 * Full execution trace
 */
export interface ExecutionTrace {
  /** Unique trace ID */
  traceId: string;
  /** Thread ID for correlation */
  threadId: string;
  /** Start timestamp */
  startedAt: string;
  /** Completion timestamp */
  completedAt?: string;
  /** Trace status */
  status: 'running' | 'completed' | 'failed' | 'interrupted';
  /** Task classification */
  classification: ClassificationLevel;
  /** Task type */
  taskType: string;
  /** Individual spans */
  spans: TraceSpan[];
  /** Agent invocations */
  agentInvocations: AgentInvocation[];
  /** Classification filter decisions */
  classificationFilters: FilterDecision[];
  /** Tool calls */
  toolCalls: ToolCall[];
  /** Total duration in ms */
  totalDurationMs?: number;
  /** Total token usage */
  totalTokens?: {
    input: number;
    output: number;
  };
  /** Error message if failed */
  error?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Individual trace span
 */
export interface TraceSpan {
  /** Unique span ID */
  spanId: string;
  /** Parent span ID for hierarchy */
  parentSpanId?: string;
  /** Agent or component ID */
  agentId: string;
  /** Operation name */
  operation: string;
  /** Start timestamp */
  startedAt: string;
  /** Completion timestamp */
  completedAt: string;
  /** Duration in ms */
  durationMs: number;
  /** Input token count */
  inputTokens?: number;
  /** Output token count */
  outputTokens?: number;
  /** Span status */
  status: 'success' | 'error';
  /** Error message if failed */
  error?: string;
  /** Classification at execution time */
  classification: ClassificationLevel;
  /** Whether content was filtered */
  wasFiltered: boolean;
  /** Number of items filtered */
  filteredCount?: number;
  /** Additional attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Agent invocation record
 */
export interface AgentInvocation {
  /** Invocation ID */
  invocationId: string;
  /** Span ID this belongs to */
  spanId: string;
  /** Agent ID */
  agentId: string;
  /** Agent clearance level */
  agentClearance: ClassificationLevel;
  /** Input message count */
  inputMessageCount: number;
  /** Output message count */
  outputMessageCount: number;
  /** Model used */
  model?: string;
  /** Timestamp */
  timestamp: string;
  /** Duration in ms */
  durationMs: number;
  /** Token usage */
  tokenUsage?: {
    input: number;
    output: number;
  };
  /** Success status */
  success: boolean;
  /** Error if failed */
  error?: string;
}

/**
 * Classification filter decision
 */
export interface FilterDecision {
  /** Decision ID */
  decisionId: string;
  /** Span ID */
  spanId: string;
  /** Source classification */
  sourceClassification: ClassificationLevel;
  /** Target clearance */
  targetClearance: ClassificationLevel;
  /** Was access allowed */
  allowed: boolean;
  /** Number of items filtered */
  filteredCount: number;
  /** Timestamp */
  timestamp: string;
}

/**
 * Tool call record
 */
export interface ToolCall {
  /** Call ID */
  callId: string;
  /** Span ID */
  spanId: string;
  /** Agent that called */
  agentId: string;
  /** Tool name */
  toolName: string;
  /** Tool input (sanitized) */
  input: Record<string, unknown>;
  /** Tool output (sanitized) */
  output?: Record<string, unknown>;
  /** Timestamp */
  timestamp: string;
  /** Duration in ms */
  durationMs: number;
  /** Success status */
  success: boolean;
  /** Error if failed */
  error?: string;
}

/**
 * Execution graph node for visualization
 */
export interface GraphNode {
  /** Node ID */
  id: string;
  /** Node type */
  type: 'agent' | 'filter' | 'supervisor' | 'start' | 'end';
  /** Display label */
  label: string;
  /** Status */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Duration in ms */
  durationMs?: number;
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Execution graph edge for visualization
 */
export interface GraphEdge {
  /** Edge ID */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Edge label */
  label?: string;
  /** Was this edge taken */
  active: boolean;
}

/**
 * Execution graph for visualization
 */
export interface ExecutionGraph {
  /** Graph ID (same as trace ID) */
  id: string;
  /** Nodes */
  nodes: GraphNode[];
  /** Edges */
  edges: GraphEdge[];
}

/**
 * Aggregated metrics
 */
export interface TracingMetrics {
  /** Total traces */
  totalTraces: number;
  /** Completed traces */
  completedTraces: number;
  /** Failed traces */
  failedTraces: number;
  /** Average duration */
  avgDurationMs: number;
  /** Total tokens used */
  totalTokens: {
    input: number;
    output: number;
  };
  /** By classification */
  byClassification: Record<ClassificationLevel, number>;
  /** By agent */
  byAgent: Record<string, {
    invocations: number;
    avgDurationMs: number;
    successRate: number;
  }>;
  /** Time range */
  timeRange: {
    start: string;
    end: string;
  };
}

/**
 * SQL for initializing tracing tables
 */
const INIT_SQL = `
  -- Execution traces table
  CREATE TABLE IF NOT EXISTS execution_traces (
    trace_id UUID PRIMARY KEY,
    thread_id TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running',
    classification TEXT NOT NULL,
    task_type TEXT NOT NULL,
    total_duration_ms INTEGER,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    error TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Trace spans table
  CREATE TABLE IF NOT EXISTS trace_spans (
    span_id UUID PRIMARY KEY,
    trace_id UUID NOT NULL REFERENCES execution_traces(trace_id),
    parent_span_id UUID,
    agent_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    duration_ms INTEGER NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    status TEXT NOT NULL,
    error TEXT,
    classification TEXT NOT NULL,
    was_filtered BOOLEAN NOT NULL DEFAULT FALSE,
    filtered_count INTEGER,
    attributes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Agent invocations table
  CREATE TABLE IF NOT EXISTS agent_invocations (
    invocation_id UUID PRIMARY KEY,
    trace_id UUID NOT NULL REFERENCES execution_traces(trace_id),
    span_id UUID NOT NULL REFERENCES trace_spans(span_id),
    agent_id TEXT NOT NULL,
    agent_clearance TEXT NOT NULL,
    input_message_count INTEGER NOT NULL,
    output_message_count INTEGER NOT NULL,
    model TEXT,
    timestamp TIMESTAMPTZ NOT NULL,
    duration_ms INTEGER NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    success BOOLEAN NOT NULL,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Tool calls table
  CREATE TABLE IF NOT EXISTS tool_calls (
    call_id UUID PRIMARY KEY,
    trace_id UUID NOT NULL REFERENCES execution_traces(trace_id),
    span_id UUID NOT NULL REFERENCES trace_spans(span_id),
    agent_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    input JSONB NOT NULL,
    output JSONB,
    timestamp TIMESTAMPTZ NOT NULL,
    duration_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_execution_traces_thread_id ON execution_traces(thread_id);
  CREATE INDEX IF NOT EXISTS idx_execution_traces_status ON execution_traces(status);
  CREATE INDEX IF NOT EXISTS idx_execution_traces_classification ON execution_traces(classification);
  CREATE INDEX IF NOT EXISTS idx_execution_traces_started_at ON execution_traces(started_at);

  CREATE INDEX IF NOT EXISTS idx_trace_spans_trace_id ON trace_spans(trace_id);
  CREATE INDEX IF NOT EXISTS idx_trace_spans_agent_id ON trace_spans(agent_id);

  CREATE INDEX IF NOT EXISTS idx_agent_invocations_trace_id ON agent_invocations(trace_id);
  CREATE INDEX IF NOT EXISTS idx_agent_invocations_agent_id ON agent_invocations(agent_id);

  CREATE INDEX IF NOT EXISTS idx_tool_calls_trace_id ON tool_calls(trace_id);
  CREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name ON tool_calls(tool_name);
`;

/**
 * ExecutionTracer - Records and manages execution traces
 */
export class ExecutionTracer {
  private initialized = false;
  private activeTraces: Map<string, ExecutionTrace> = new Map();

  /**
   * Initialize the tracer (creates tables)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const pool = getPool();
    try {
      await pool.query(INIT_SQL);
      this.initialized = true;
      console.log('[ExecutionTracer] Initialized');
    } catch (error) {
      console.error('[ExecutionTracer] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Ensure initialization
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Start a new execution trace
   */
  async startTrace(params: {
    threadId: string;
    classification: ClassificationLevel;
    taskType: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    await this.ensureInitialized();

    const traceId = randomUUID();
    const startedAt = new Date().toISOString();

    const trace: ExecutionTrace = {
      traceId,
      threadId: params.threadId,
      startedAt,
      status: 'running',
      classification: params.classification,
      taskType: params.taskType,
      spans: [],
      agentInvocations: [],
      classificationFilters: [],
      toolCalls: [],
      metadata: params.metadata,
    };

    // Store in memory
    this.activeTraces.set(traceId, trace);

    // Persist to database
    const pool = getPool();
    await pool.query(
      `INSERT INTO execution_traces (
        trace_id, thread_id, started_at, status, classification,
        task_type, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        traceId,
        params.threadId,
        startedAt,
        'running',
        params.classification,
        params.taskType,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ]
    );

    return traceId;
  }

  /**
   * Record a span
   */
  async recordSpan(traceId: string, span: TraceSpan): Promise<void> {
    await this.ensureInitialized();

    // Update in-memory trace
    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.spans.push(span);
    }

    // Persist to database
    const pool = getPool();
    await pool.query(
      `INSERT INTO trace_spans (
        span_id, trace_id, parent_span_id, agent_id, operation,
        started_at, completed_at, duration_ms, input_tokens, output_tokens,
        status, error, classification, was_filtered, filtered_count, attributes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        span.spanId,
        traceId,
        span.parentSpanId || null,
        span.agentId,
        span.operation,
        span.startedAt,
        span.completedAt,
        span.durationMs,
        span.inputTokens || null,
        span.outputTokens || null,
        span.status,
        span.error || null,
        span.classification,
        span.wasFiltered,
        span.filteredCount || null,
        span.attributes ? JSON.stringify(span.attributes) : null,
      ]
    );
  }

  /**
   * Record an agent invocation
   */
  async recordAgentInvocation(traceId: string, invocation: AgentInvocation): Promise<void> {
    await this.ensureInitialized();

    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.agentInvocations.push(invocation);
    }

    const pool = getPool();
    await pool.query(
      `INSERT INTO agent_invocations (
        invocation_id, trace_id, span_id, agent_id, agent_clearance,
        input_message_count, output_message_count, model,
        timestamp, duration_ms, input_tokens, output_tokens, success, error
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        invocation.invocationId,
        traceId,
        invocation.spanId,
        invocation.agentId,
        invocation.agentClearance,
        invocation.inputMessageCount,
        invocation.outputMessageCount,
        invocation.model || null,
        invocation.timestamp,
        invocation.durationMs,
        invocation.tokenUsage?.input || null,
        invocation.tokenUsage?.output || null,
        invocation.success,
        invocation.error || null,
      ]
    );
  }

  /**
   * Record a tool call
   */
  async recordToolCall(traceId: string, toolCall: ToolCall): Promise<void> {
    await this.ensureInitialized();

    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.toolCalls.push(toolCall);
    }

    const pool = getPool();
    await pool.query(
      `INSERT INTO tool_calls (
        call_id, trace_id, span_id, agent_id, tool_name,
        input, output, timestamp, duration_ms, success, error
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        toolCall.callId,
        traceId,
        toolCall.spanId,
        toolCall.agentId,
        toolCall.toolName,
        JSON.stringify(toolCall.input),
        toolCall.output ? JSON.stringify(toolCall.output) : null,
        toolCall.timestamp,
        toolCall.durationMs,
        toolCall.success,
        toolCall.error || null,
      ]
    );
  }

  /**
   * Complete a trace
   */
  async completeTrace(
    traceId: string,
    status: 'completed' | 'failed' | 'interrupted',
    error?: string
  ): Promise<void> {
    await this.ensureInitialized();

    const trace = this.activeTraces.get(traceId);
    const completedAt = new Date().toISOString();

    if (trace) {
      trace.completedAt = completedAt;
      trace.status = status;
      trace.error = error;

      // Calculate totals
      trace.totalDurationMs = new Date(completedAt).getTime() - new Date(trace.startedAt).getTime();

      let inputTokens = 0;
      let outputTokens = 0;
      for (const span of trace.spans) {
        inputTokens += span.inputTokens || 0;
        outputTokens += span.outputTokens || 0;
      }
      trace.totalTokens = { input: inputTokens, output: outputTokens };

      // Remove from active
      this.activeTraces.delete(traceId);
    }

    // Update database
    const pool = getPool();
    await pool.query(
      `UPDATE execution_traces SET
        completed_at = $1,
        status = $2,
        total_duration_ms = $3,
        total_input_tokens = $4,
        total_output_tokens = $5,
        error = $6
      WHERE trace_id = $7`,
      [
        completedAt,
        status,
        trace?.totalDurationMs || null,
        trace?.totalTokens?.input || 0,
        trace?.totalTokens?.output || 0,
        error || null,
        traceId,
      ]
    );
  }

  /**
   * Get a trace by ID
   */
  async getTrace(traceId: string): Promise<ExecutionTrace | null> {
    await this.ensureInitialized();

    // Check active first
    if (this.activeTraces.has(traceId)) {
      return this.activeTraces.get(traceId)!;
    }

    // Query from database
    const pool = getPool();

    const traceResult = await pool.query(
      'SELECT * FROM execution_traces WHERE trace_id = $1',
      [traceId]
    );

    if (traceResult.rows.length === 0) {
      return null;
    }

    const row = traceResult.rows[0];

    // Get spans
    const spansResult = await pool.query(
      'SELECT * FROM trace_spans WHERE trace_id = $1 ORDER BY started_at',
      [traceId]
    );

    // Get invocations
    const invocationsResult = await pool.query(
      'SELECT * FROM agent_invocations WHERE trace_id = $1 ORDER BY timestamp',
      [traceId]
    );

    // Get tool calls
    const toolCallsResult = await pool.query(
      'SELECT * FROM tool_calls WHERE trace_id = $1 ORDER BY timestamp',
      [traceId]
    );

    return {
      traceId: row.trace_id,
      threadId: row.thread_id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status,
      classification: row.classification as ClassificationLevel,
      taskType: row.task_type,
      totalDurationMs: row.total_duration_ms,
      totalTokens: {
        input: row.total_input_tokens || 0,
        output: row.total_output_tokens || 0,
      },
      error: row.error,
      metadata: row.metadata,
      spans: spansResult.rows.map(this.rowToSpan),
      agentInvocations: invocationsResult.rows.map(this.rowToInvocation),
      classificationFilters: [], // Not stored separately
      toolCalls: toolCallsResult.rows.map(this.rowToToolCall),
    };
  }

  /**
   * Generate execution graph for visualization
   */
  async getExecutionGraph(traceId: string): Promise<ExecutionGraph | null> {
    const trace = await this.getTrace(traceId);
    if (!trace) return null;

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Add start node
    nodes.push({
      id: 'start',
      type: 'start',
      label: 'Start',
      status: 'completed',
    });

    // Add nodes from spans
    const spanAgents = new Set<string>();
    for (const span of trace.spans) {
      if (!spanAgents.has(span.agentId)) {
        spanAgents.add(span.agentId);
        nodes.push({
          id: span.agentId,
          type: span.agentId.includes('filter') ? 'filter' :
                span.agentId.includes('supervisor') ? 'supervisor' : 'agent',
          label: span.agentId,
          status: span.status === 'success' ? 'completed' : 'failed',
          durationMs: span.durationMs,
          data: {
            classification: span.classification,
            wasFiltered: span.wasFiltered,
          },
        });
      }
    }

    // Add end node
    nodes.push({
      id: 'end',
      type: 'end',
      label: 'End',
      status: trace.status === 'completed' ? 'completed' :
              trace.status === 'failed' ? 'failed' : 'pending',
    });

    // Create edges from span sequence
    let prevAgentId = 'start';
    for (const span of trace.spans) {
      const edgeId = `${prevAgentId}-${span.agentId}`;
      if (!edges.find(e => e.id === edgeId)) {
        edges.push({
          id: edgeId,
          source: prevAgentId,
          target: span.agentId,
          active: true,
        });
      }
      prevAgentId = span.agentId;
    }

    // Add edge to end
    if (prevAgentId !== 'start') {
      edges.push({
        id: `${prevAgentId}-end`,
        source: prevAgentId,
        target: 'end',
        active: true,
      });
    }

    return {
      id: traceId,
      nodes,
      edges,
    };
  }

  /**
   * Get metrics for a time range
   */
  async getMetrics(since?: Date, until?: Date): Promise<TracingMetrics> {
    await this.ensureInitialized();
    const pool = getPool();

    const conditions: string[] = [];
    const params: (string | Date)[] = [];
    let paramIdx = 1;

    if (since) {
      conditions.push(`started_at >= $${paramIdx}`);
      params.push(since.toISOString());
      paramIdx++;
    }
    if (until) {
      conditions.push(`started_at <= $${paramIdx}`);
      params.push(until.toISOString());
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get trace counts
    const countsResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(total_duration_ms) as avg_duration,
        SUM(total_input_tokens) as total_input,
        SUM(total_output_tokens) as total_output,
        MIN(started_at) as start_time,
        MAX(completed_at) as end_time
      FROM execution_traces
      ${whereClause}
    `, params);

    // Get by classification
    const byClassResult = await pool.query(`
      SELECT classification, COUNT(*) as count
      FROM execution_traces
      ${whereClause}
      GROUP BY classification
    `, params);

    const byClassification: Record<ClassificationLevel, number> = {
      UNCLASS: 0,
      CUI: 0,
      CONFIDENTIAL: 0,
      SECRET: 0,
      TOPSECRET: 0,
    };
    for (const row of byClassResult.rows) {
      byClassification[row.classification as ClassificationLevel] = parseInt(row.count, 10);
    }

    // Get by agent
    const byAgentResult = await pool.query(`
      SELECT
        agent_id,
        COUNT(*) as invocations,
        AVG(duration_ms) as avg_duration,
        SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
      FROM agent_invocations
      ${conditions.length > 0 ? `WHERE trace_id IN (SELECT trace_id FROM execution_traces ${whereClause})` : ''}
      GROUP BY agent_id
    `, params);

    const byAgent: Record<string, { invocations: number; avgDurationMs: number; successRate: number }> = {};
    for (const row of byAgentResult.rows) {
      byAgent[row.agent_id] = {
        invocations: parseInt(row.invocations, 10),
        avgDurationMs: parseFloat(row.avg_duration) || 0,
        successRate: parseFloat(row.success_rate) || 0,
      };
    }

    const row = countsResult.rows[0];
    return {
      totalTraces: parseInt(row.total, 10) || 0,
      completedTraces: parseInt(row.completed, 10) || 0,
      failedTraces: parseInt(row.failed, 10) || 0,
      avgDurationMs: parseFloat(row.avg_duration) || 0,
      totalTokens: {
        input: parseInt(row.total_input, 10) || 0,
        output: parseInt(row.total_output, 10) || 0,
      },
      byClassification,
      byAgent,
      timeRange: {
        start: row.start_time || new Date().toISOString(),
        end: row.end_time || new Date().toISOString(),
      },
    };
  }

  /**
   * List traces with pagination
   */
  async listTraces(options: {
    status?: string;
    classification?: ClassificationLevel;
    taskType?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ traces: ExecutionTrace[]; total: number }> {
    await this.ensureInitialized();
    const pool = getPool();

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (options.status) {
      conditions.push(`status = $${paramIdx}`);
      params.push(options.status);
      paramIdx++;
    }
    if (options.classification) {
      conditions.push(`classification = $${paramIdx}`);
      params.push(options.classification);
      paramIdx++;
    }
    if (options.taskType) {
      conditions.push(`task_type = $${paramIdx}`);
      params.push(options.taskType);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM execution_traces ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get traces
    params.push(limit);
    params.push(offset);
    const tracesResult = await pool.query(
      `SELECT * FROM execution_traces ${whereClause}
       ORDER BY started_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    const traces: ExecutionTrace[] = tracesResult.rows.map(row => ({
      traceId: row.trace_id,
      threadId: row.thread_id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status,
      classification: row.classification as ClassificationLevel,
      taskType: row.task_type,
      totalDurationMs: row.total_duration_ms,
      totalTokens: {
        input: row.total_input_tokens || 0,
        output: row.total_output_tokens || 0,
      },
      error: row.error,
      metadata: row.metadata,
      spans: [],
      agentInvocations: [],
      classificationFilters: [],
      toolCalls: [],
    }));

    return { traces, total };
  }

  // Row conversion helpers
  private rowToSpan(row: Record<string, unknown>): TraceSpan {
    return {
      spanId: row.span_id as string,
      parentSpanId: row.parent_span_id as string | undefined,
      agentId: row.agent_id as string,
      operation: row.operation as string,
      startedAt: row.started_at as string,
      completedAt: row.completed_at as string,
      durationMs: row.duration_ms as number,
      inputTokens: row.input_tokens as number | undefined,
      outputTokens: row.output_tokens as number | undefined,
      status: row.status as 'success' | 'error',
      error: row.error as string | undefined,
      classification: row.classification as ClassificationLevel,
      wasFiltered: row.was_filtered as boolean,
      filteredCount: row.filtered_count as number | undefined,
      attributes: row.attributes as Record<string, unknown> | undefined,
    };
  }

  private rowToInvocation(row: Record<string, unknown>): AgentInvocation {
    return {
      invocationId: row.invocation_id as string,
      spanId: row.span_id as string,
      agentId: row.agent_id as string,
      agentClearance: row.agent_clearance as ClassificationLevel,
      inputMessageCount: row.input_message_count as number,
      outputMessageCount: row.output_message_count as number,
      model: row.model as string | undefined,
      timestamp: row.timestamp as string,
      durationMs: row.duration_ms as number,
      tokenUsage: row.input_tokens ? {
        input: row.input_tokens as number,
        output: row.output_tokens as number,
      } : undefined,
      success: row.success as boolean,
      error: row.error as string | undefined,
    };
  }

  private rowToToolCall(row: Record<string, unknown>): ToolCall {
    return {
      callId: row.call_id as string,
      spanId: row.span_id as string,
      agentId: row.agent_id as string,
      toolName: row.tool_name as string,
      input: row.input as Record<string, unknown>,
      output: row.output as Record<string, unknown> | undefined,
      timestamp: row.timestamp as string,
      durationMs: row.duration_ms as number,
      success: row.success as boolean,
      error: row.error as string | undefined,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let tracerInstance: ExecutionTracer | null = null;

/**
 * Get or create the execution tracer singleton
 */
export function getTracer(): ExecutionTracer {
  if (!tracerInstance) {
    tracerInstance = new ExecutionTracer();
  }
  return tracerInstance;
}
