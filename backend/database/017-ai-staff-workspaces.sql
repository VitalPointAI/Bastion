-- ============================================================================
-- AI Staff Workspaces Migration — Phase 16 Plan 01
-- Creates the AI workspace data architecture:
-- staff_agents, ai_role_runs, ai_channel_events, staff_product_versions,
-- ai_context_store, ai_coordination_log tables,
-- and adds role_assignments JSONB column to exercise_scenarios.
-- ============================================================================

-- ─── role_assignments on exercise_scenarios ───────────────────────────────────
-- Per-position assignment mode: human | ai | disabled
-- Empty object means all positions default to "human"
-- Shape: { "j2": "human", "j3": "ai", "sja": "disabled", ... }

ALTER TABLE exercise_scenarios
    ADD COLUMN IF NOT EXISTS role_assignments JSONB NOT NULL DEFAULT '{}';

-- ─── staff_agents ─────────────────────────────────────────────────────────────
-- Default AI agent definitions seeded from the canonical agent library.
-- Agents belong to a role team and may be overridden per scenario.

CREATE TABLE IF NOT EXISTS staff_agents (
    id TEXT PRIMARY KEY,
    role_key TEXT NOT NULL,
    name TEXT NOT NULL,
    rank TEXT NOT NULL,
    branch TEXT NOT NULL,
    specialty TEXT NOT NULL,
    focus TEXT NOT NULL,
    tools TEXT[] NOT NULL DEFAULT '{}',
    personality TEXT[] NOT NULL DEFAULT '{}',
    system_prompt_hint TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_agents_role ON staff_agents(role_key);

-- ─── ai_role_runs ─────────────────────────────────────────────────────────────
-- Each AI execution run for a single role invocation within a scenario.
-- Triggered manually or by auto-trigger events.

CREATE TABLE IF NOT EXISTS ai_role_runs (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
    role_key TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    trigger_context JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'paused', 'awaiting_review', 'complete', 'failed')),
    paused_at TIMESTAMPTZ,
    resumed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_role_runs_scenario_role ON ai_role_runs(scenario_id, role_key, status);

-- ─── ai_channel_events ────────────────────────────────────────────────────────
-- Structured activity log entries for AI-assigned roles.
-- Records task progress, draft notifications, review prompts, etc.

CREATE TABLE IF NOT EXISTS ai_channel_events (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
    role_key TEXT NOT NULL,
    run_id TEXT REFERENCES ai_role_runs(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    agent_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_channel_events_scenario_role
    ON ai_channel_events(scenario_id, role_key, created_at);

-- ─── staff_product_versions ───────────────────────────────────────────────────
-- Full version history for AI-generated product drafts and revision iterations.
-- Every draft and revision is stored — not just the latest.

CREATE TABLE IF NOT EXISTS staff_product_versions (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES staff_products(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    structured JSONB NOT NULL DEFAULT '{}',
    created_by TEXT NOT NULL,
    revision_notes TEXT,
    annotated_feedback JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_product_versions_product
    ON staff_product_versions(product_id, version);

-- ─── ai_context_store ─────────────────────────────────────────────────────────
-- Shared context object readable and writable by all AI roles within a scenario.
-- Enables real-time cross-role context sharing (not limited to published products).

CREATE TABLE IF NOT EXISTS ai_context_store (
    scenario_id TEXT NOT NULL REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
    role_key TEXT NOT NULL,
    context_data JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (scenario_id, role_key)
);

-- ─── ai_coordination_log ──────────────────────────────────────────────────────
-- Audit log for every AI-to-AI coordination event (requests and responses).
-- Provides full observability for human oversight of cross-role AI interactions.

CREATE TABLE IF NOT EXISTS ai_coordination_log (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
    requesting_role TEXT NOT NULL,
    responding_role TEXT NOT NULL,
    request_type TEXT NOT NULL,
    request_payload JSONB NOT NULL DEFAULT '{}',
    response_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_coordination_log_scenario
    ON ai_coordination_log(scenario_id, created_at);

-- ─── Agent library seed data ──────────────────────────────────────────────────
-- Agent library seed data inserted by Task 2 agent-library.ts
-- Run: psql $DATABASE_URL -f backend/database/017-ai-staff-workspaces.sql
