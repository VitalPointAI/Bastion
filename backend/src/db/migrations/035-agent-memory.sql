-- Migration 035: Agent Memory Table (Phase 51 - Unified Agent Architecture)
--
-- Creates agent_memory table with foreign key to agents_v2.
-- Supports per-agent knowledge, working context, and episode summaries.
-- JSONB column stores vector embeddings for semantic recall.
-- NOTE: Run on production/staging DB after deploy — not run locally.

-- ============================================================================
-- agent_memory: Per-agent episodic and knowledge memory
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_memory (
  entry_id      TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  agent_id      TEXT          NOT NULL,
  memory_type   TEXT          NOT NULL,
  category      TEXT,
  content       TEXT          NOT NULL,
  embedding     JSONB,
  importance    NUMERIC(4,3)  DEFAULT 0.5,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  last_accessed TIMESTAMPTZ,
  task_id       TEXT,

  CONSTRAINT fk_agent
    FOREIGN KEY (agent_id)
    REFERENCES agents_v2 (agent_id)
    ON DELETE CASCADE
);

-- Index for querying all memories for a specific agent
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_id
  ON agent_memory (agent_id);

-- Composite index for filtered queries by agent + memory type
CREATE INDEX IF NOT EXISTS idx_agent_memory_type
  ON agent_memory (agent_id, memory_type);
