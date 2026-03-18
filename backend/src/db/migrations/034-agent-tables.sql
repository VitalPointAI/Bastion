-- Migration 034: Agent Tables (Phase 51 - Unified Agent Architecture)
--
-- Creates agents_v2, agent_teams, and agent_action_log tables.
-- These replace in-memory Maps with persistent PostgreSQL storage.
-- NOTE: Run on production/staging DB after deploy — not run locally.

-- ============================================================================
-- agents_v2: Persistent storage for StandardAgent instances
-- ============================================================================

CREATE TABLE IF NOT EXISTS agents_v2 (
  agent_id              TEXT          PRIMARY KEY,
  agent_data            JSONB         NOT NULL,
  created_at            TIMESTAMPTZ   DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   DEFAULT NOW(),
  status                TEXT          DEFAULT 'active',
  last_invocation       TIMESTAMPTZ,
  success_rate          NUMERIC(4,3),
  avg_response_time_ms  INTEGER,
  validation_score      NUMERIC(4,3)
);

-- ============================================================================
-- agent_teams: Persistent storage for AgentTeam configurations
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_teams (
  team_id     TEXT        PRIMARY KEY,
  team_data   JSONB       NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- agent_action_log: Audit trail for agent actions
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_action_log (
  log_id      TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  agent_id    TEXT        NOT NULL,
  action      TEXT        NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_action_log_agent_id
  ON agent_action_log (agent_id);
