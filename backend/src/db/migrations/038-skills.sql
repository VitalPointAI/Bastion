-- Migration 038: Skills Registry
-- Phase 52: Agent Skills & MCP
--
-- Creates skills and agent_skill_assignments tables.
-- Skills are higher-level reusable capability definitions composing tools, prompts,
-- and validation logic. Agents can have skills assigned like tools.

-- ============================================================================
-- skills table
-- ============================================================================

CREATE TABLE IF NOT EXISTS skills (
  skill_id      TEXT        PRIMARY KEY,
  skill_data    JSONB       NOT NULL,    -- Full skill definition (name, description, schemas as JSON Schema, tool_ids, prompts)
  version       TEXT        NOT NULL DEFAULT '1.0.0',
  created_by    TEXT        NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  is_enabled    BOOLEAN     DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS skills_is_enabled_idx ON skills (is_enabled);
CREATE INDEX IF NOT EXISTS skills_created_at_idx ON skills (created_at);

-- ============================================================================
-- agent_skill_assignments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_skill_assignments (
  skill_id    TEXT NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by TEXT NOT NULL,
  PRIMARY KEY (skill_id, agent_id)
);

CREATE INDEX IF NOT EXISTS agent_skill_assignments_agent_id_idx ON agent_skill_assignments (agent_id);
