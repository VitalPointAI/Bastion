-- Migration 039: Ironclaw suggestion column and tasks table
--
-- Part 1: Add suggestion JSONB column to ironclaw_chat (stores parsed suggestion
--         payloads from Ironclaw responses for frontend rendering and accept pipeline)
-- Part 2: Create ironclaw_tasks table for Plan 05 orchestration loop

-- Part 1 ─────────────────────────────────────────────────────────────────────
ALTER TABLE ironclaw_chat ADD COLUMN IF NOT EXISTS suggestion JSONB;

-- Part 2 ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ironclaw_tasks (
  task_id         TEXT        PRIMARY KEY,
  problem_set_id  TEXT        NOT NULL,
  user_did        TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  description     TEXT,
  status          TEXT        NOT NULL DEFAULT 'created',
  assigned_agents TEXT[]      DEFAULT '{}',
  assigned_team   TEXT,
  thread_id       TEXT,
  steps           JSONB       DEFAULT '[]',
  current_step    INTEGER     DEFAULT 0,
  results         JSONB       DEFAULT '[]',
  suggestions     JSONB       DEFAULT '[]',
  target_fields   JSONB       DEFAULT '{}',
  user_feedback   JSONB       DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ironclaw_tasks_ps     ON ironclaw_tasks(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_ironclaw_tasks_status ON ironclaw_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ironclaw_tasks_user   ON ironclaw_tasks(user_did);
