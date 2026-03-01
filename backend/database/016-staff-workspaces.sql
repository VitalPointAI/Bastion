-- ============================================================================
-- Staff Workspaces Migration — Phase 15 Plan 01
-- Creates the JPP staff workspace data architecture:
-- staff_products, staff_notifications, agent_team_config tables,
-- and adds enabled_roles column to exercise_scenarios.
-- ============================================================================

-- ─── staff_products ──────────────────────────────────────────────────────────
-- Staff workspace products: IPB assessments, COA sketches, strategic guidance, etc.
-- Each product belongs to a role within a scenario.

CREATE TABLE IF NOT EXISTS staff_products (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL
        REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
    role_key TEXT NOT NULL,
    product_type TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published')),
    structured JSONB NOT NULL DEFAULT '{}',
    content TEXT NOT NULL DEFAULT '',
    agent_team_id TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    published_at TIMESTAMPTZ,
    published_by TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_products_scenario_role
    ON staff_products(scenario_id, role_key);
CREATE INDEX IF NOT EXISTS idx_staff_products_scenario_role_type
    ON staff_products(scenario_id, role_key, product_type);
CREATE INDEX IF NOT EXISTS idx_staff_products_scenario_status
    ON staff_products(scenario_id, status);

-- ─── staff_notifications ─────────────────────────────────────────────────────
-- Cross-role notifications created when a product is published.
-- Each enabled role (excluding the source role) receives a notification.

CREATE TABLE IF NOT EXISTS staff_notifications (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL
        REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
    source_product_id TEXT NOT NULL
        REFERENCES staff_products(id) ON DELETE CASCADE,
    source_role TEXT NOT NULL,
    target_role TEXT NOT NULL,
    notification_type TEXT NOT NULL
        CHECK (notification_type IN ('product_published', 'product_updated')),
    diff_snapshot JSONB NOT NULL DEFAULT '{}',
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_integrated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_notifications_target_unread
    ON staff_notifications(scenario_id, target_role, is_read);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_scenario
    ON staff_notifications(scenario_id);

-- ─── agent_team_config ────────────────────────────────────────────────────────
-- Persists per-role (and per-product-type override) agent team assignments.
-- NULL product_type = role default; non-NULL = override for that product type.

CREATE TABLE IF NOT EXISTS agent_team_config (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL
        REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
    role_key TEXT NOT NULL,
    product_type TEXT,
    agent_team_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (scenario_id, role_key, product_type)
);

CREATE INDEX IF NOT EXISTS idx_agent_team_config_scenario_role
    ON agent_team_config(scenario_id, role_key);

-- ─── enabled_roles on exercise_scenarios ─────────────────────────────────────
-- Controls which staff workspaces appear for a given scenario.
-- Defaults to all 31 roles.

ALTER TABLE exercise_scenarios
    ADD COLUMN IF NOT EXISTS enabled_roles TEXT[] NOT NULL DEFAULT '{"commander","dcom","cos","j1","j2","j3","j35","j4","j5","j6","j7","j8","j9","sja","polad","pao","surgeon","cyber","space","transcom","socom","io","fires","ew","jfacc","jflcc","jfmcc","jfsocc","engineer","cbrn","knowledge_mgmt"}';
