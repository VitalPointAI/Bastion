-- Phase 60 Plan 03: Per-user AgentConfig table for Ironclaw identity system.
-- Blueprint Phase 2: "One agent, many lenses" — stores identity, personality,
-- channel preferences, and skill configuration per user DID.
--
-- Run against bastion-postgres (main DB), NOT ironclaw-postgres.
--
-- SECURITY NOTE: clearance_level is intentionally absent. Per blueprint,
-- clearance is always read from VC claims at runtime, never persisted here.

CREATE TABLE IF NOT EXISTS agent_config (
  -- Primary identity
  did                         TEXT PRIMARY KEY,
  near_account                TEXT NOT NULL,

  -- Personal identity
  display_name                TEXT,
  rank                        TEXT,
  staff_section               TEXT NOT NULL DEFAULT 'Other',
  position                    TEXT,
  unit                        TEXT,
  higher_hq                   TEXT,
  reporting_to_did            TEXT,

  -- Operational context (stored as JSON arrays)
  active_operation_ids        JSONB NOT NULL DEFAULT '[]',
  areas_of_responsibility     JSONB NOT NULL DEFAULT '[]',

  -- Output / communication preferences
  bluf_enforced               BOOLEAN NOT NULL DEFAULT true,
  output_format               TEXT NOT NULL DEFAULT 'Auto',
  verbosity_level             INTEGER NOT NULL DEFAULT 3,
  tone                        TEXT NOT NULL DEFAULT 'Professional',
  expand_acronyms             BOOLEAN NOT NULL DEFAULT false,
  classification_markings     BOOLEAN NOT NULL DEFAULT true,
  custom_persona_instructions TEXT NOT NULL DEFAULT '',

  -- Channel preferences
  telegram_enabled            BOOLEAN NOT NULL DEFAULT false,
  telegram_chat_id            TEXT,
  telegram_notification_level TEXT NOT NULL DEFAULT 'Routine',

  -- Skills
  enabled_skill_packs         JSONB NOT NULL DEFAULT '[]',
  custom_skills               JSONB NOT NULL DEFAULT '[]',

  -- Heartbeat system
  heartbeat_directives        TEXT NOT NULL DEFAULT '',
  custom_routines             JSONB NOT NULL DEFAULT '[]',

  -- Sync tracking
  identity_last_synced_at     TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for NEAR account lookup (used by agent-config-store.getByNearAccount)
CREATE INDEX IF NOT EXISTS idx_agent_config_near_account ON agent_config (near_account);

-- Trigger to auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_agent_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_config_updated_at ON agent_config;
CREATE TRIGGER agent_config_updated_at
  BEFORE UPDATE ON agent_config
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_config_updated_at();
