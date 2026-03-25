-- Migration 045: Ironclaw context (problem-set-scoped) memory and interaction outcomes
-- Phase 57: Ironclaw Persistent Memory and Adaptive Relationship

CREATE TABLE IF NOT EXISTS ironclaw_context_memory (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_set_id  TEXT        NOT NULL,
  memory_key      TEXT        NOT NULL,
  memory_value    JSONB       NOT NULL,
  session_count   INTEGER     NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '180 days',
  UNIQUE (problem_set_id, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_ironclaw_context_memory_problem_set_id
  ON ironclaw_context_memory (problem_set_id);

CREATE INDEX IF NOT EXISTS idx_ironclaw_context_memory_expires_at
  ON ironclaw_context_memory (expires_at);

CREATE TABLE IF NOT EXISTS ironclaw_interaction_outcomes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_did        TEXT        NOT NULL,
  problem_set_id  TEXT,
  outcome_type    TEXT        NOT NULL,
  context         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ironclaw_outcomes_user_created
  ON ironclaw_interaction_outcomes (user_did, created_at);

CREATE INDEX IF NOT EXISTS idx_ironclaw_outcomes_type_created
  ON ironclaw_interaction_outcomes (outcome_type, created_at);
