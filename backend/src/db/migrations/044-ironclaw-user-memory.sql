-- Migration 044: Ironclaw user-scoped persistent memory
-- Phase 57: Ironclaw Persistent Memory and Adaptive Relationship

CREATE TABLE IF NOT EXISTS ironclaw_user_memory (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_did    TEXT        NOT NULL,
  memory_key  TEXT        NOT NULL,
  memory_value JSONB      NOT NULL,
  confidence  NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  source      TEXT        NOT NULL DEFAULT 'inferred',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '90 days',
  UNIQUE (user_did, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_ironclaw_user_memory_user_did
  ON ironclaw_user_memory (user_did);

CREATE INDEX IF NOT EXISTS idx_ironclaw_user_memory_expires_at
  ON ironclaw_user_memory (expires_at);
