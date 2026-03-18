-- Migration 036: Agent Activity Log
-- Creates persistent audit trail for all agent and Ironclaw operations.

CREATE TABLE IF NOT EXISTS agent_activity_log (
  id SERIAL PRIMARY KEY,
  activity_id UUID NOT NULL DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  agent_name TEXT,
  team_id TEXT,
  team_name TEXT,
  problem_set_id TEXT,
  action_type TEXT NOT NULL,
  -- action_type values:
  -- 'llm_invocation'     - LangGraph node executed an LLM call
  -- 'tool_call'          - Agent invoked an MCP tool
  -- 'delegation'         - Agent delegated task to another agent
  -- 'message_received'   - Inbound user message to Ironclaw
  -- 'message_sent'       - Outbound response from agent/Ironclaw
  -- 'action_card'        - Action card presented / decision recorded
  -- 'checkpoint'         - Human checkpoint triggered
  -- 'error'              - Agent execution error
  -- 'team_dispatch'      - Supervisor routed to an agent
  -- 'specialist_handoff' - Doc-intel specialist handoff
  action_detail TEXT,         -- human-readable description
  input_summary TEXT,         -- truncated input (first 500 chars)
  output_summary TEXT,        -- truncated output (first 500 chars)
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'success',
  -- status values: 'success', 'error', 'pending', 'cancelled'
  metadata JSONB DEFAULT '{}',  -- tokens used, model, tool name, error details, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_agent ON agent_activity_log(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_team ON agent_activity_log(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_problem_set ON agent_activity_log(problem_set_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_type ON agent_activity_log(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_created ON agent_activity_log(created_at DESC);
