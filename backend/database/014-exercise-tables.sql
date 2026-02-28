-- ============================================================================
-- Exercise Tables Migration — Phase 14 Plan 01
-- Creates the dual-perspective exercise data architecture with information
-- barrier enforcement via team column filtering.
-- ============================================================================

-- ─── exercise_scenarios ──────────────────────────────────────────────────────
-- Top-level scenario entity. All exercise data FK's here.

CREATE TABLE IF NOT EXISTS exercise_scenarios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    designation TEXT NOT NULL DEFAULT 'training/exercise'
        CHECK (designation IN ('training/exercise', 'operational')),
    exercise_phases TEXT[] NOT NULL DEFAULT '{}',
    current_phase_index INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'complete')),
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercise_scenarios_status
    ON exercise_scenarios(status);
CREATE INDEX IF NOT EXISTS idx_exercise_scenarios_created_by
    ON exercise_scenarios(created_by);

-- ─── scenario_documents ──────────────────────────────────────────────────────
-- Ingested documents with team assignment for information barrier filtering.

CREATE TABLE IF NOT EXISTS scenario_documents (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL
        REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
    team TEXT NOT NULL
        CHECK (team IN ('blue', 'red', 'controller')),
    exercise_phase TEXT NOT NULL,
    document_type TEXT NOT NULL
        CHECK (document_type IN ('ALERTORD', 'SITREP', 'CAMPAIGN_PLAN', 'FRAGO',
                                  'OOB', 'COUNTRY_POLICY', 'PLANNING_MAP', 'DIRECTIVE', 'OTHER')),
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    text_content TEXT NOT NULL DEFAULT '',
    extracted_data JSONB NOT NULL DEFAULT '{}',
    extraction_confidence NUMERIC(4,3) NOT NULL DEFAULT 0.0
        CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenario_documents_scenario_team
    ON scenario_documents(scenario_id, team);
CREATE INDEX IF NOT EXISTS idx_scenario_documents_scenario_phase
    ON scenario_documents(scenario_id, exercise_phase);
CREATE INDEX IF NOT EXISTS idx_scenario_documents_type
    ON scenario_documents(document_type);

-- ─── ipb_assessments ─────────────────────────────────────────────────────────
-- IPB assessments with version history chain via parent_version_id.

CREATE TABLE IF NOT EXISTS ipb_assessments (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL
        REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
    team TEXT NOT NULL
        CHECK (team IN ('blue', 'red')),
    perspective TEXT NOT NULL
        CHECK (perspective IN ('own', 'enemy_assessment')),
    exercise_phase TEXT NOT NULL,
    area_of_operations JSONB NOT NULL DEFAULT '{}',
    terrain_analysis JSONB NOT NULL DEFAULT '{}',
    threat_assessment TEXT NOT NULL DEFAULT '',
    civil_considerations TEXT NOT NULL DEFAULT '',
    named_areas_of_interest JSONB NOT NULL DEFAULT '[]',
    force_dispositions JSONB NOT NULL DEFAULT '[]',
    overlay_layers JSONB NOT NULL DEFAULT '[]',
    version INTEGER NOT NULL DEFAULT 1,
    parent_version_id TEXT REFERENCES ipb_assessments(id) ON DELETE SET NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ipb_assessments_scenario_team
    ON ipb_assessments(scenario_id, team);
CREATE INDEX IF NOT EXISTS idx_ipb_assessments_scenario_phase
    ON ipb_assessments(scenario_id, exercise_phase);
CREATE INDEX IF NOT EXISTS idx_ipb_assessments_perspective
    ON ipb_assessments(team, perspective);
CREATE INDEX IF NOT EXISTS idx_ipb_assessments_parent_version
    ON ipb_assessments(parent_version_id) WHERE parent_version_id IS NOT NULL;

-- ─── scenario_coas ───────────────────────────────────────────────────────────
-- Courses of Action with doctrinal scoring and commander decision tracking.

CREATE TABLE IF NOT EXISTS scenario_coas (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL
        REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
    team TEXT NOT NULL
        CHECK (team IN ('blue', 'red')),
    exercise_phase TEXT NOT NULL,
    number INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    scheme TEXT NOT NULL DEFAULT '',
    doct_scores JSONB,
    wargame_evidence JSONB NOT NULL DEFAULT '{}',
    combined_score NUMERIC(5,2),
    narrative TEXT NOT NULL DEFAULT '',
    commander_decision TEXT
        CHECK (commander_decision IN ('accepted', 'rejected', 'modified', 'combined', 'returned')),
    commander_decision_notes TEXT NOT NULL DEFAULT '',
    decision_hash TEXT,
    blockchain_tx TEXT,
    selected BOOLEAN NOT NULL DEFAULT false,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenario_coas_scenario_team
    ON scenario_coas(scenario_id, team);
CREATE INDEX IF NOT EXISTS idx_scenario_coas_selected
    ON scenario_coas(scenario_id, selected) WHERE selected = true;
CREATE INDEX IF NOT EXISTS idx_scenario_coas_decision
    ON scenario_coas(commander_decision) WHERE commander_decision IS NOT NULL;

-- ─── exercise_orders ─────────────────────────────────────────────────────────
-- WARNORD, OPORD, FRAGO orders for each team with full 5-paragraph content.

CREATE TABLE IF NOT EXISTS exercise_orders (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL
        REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
    team TEXT NOT NULL
        CHECK (team IN ('blue', 'red')),
    order_type TEXT NOT NULL
        CHECK (order_type IN ('WARNORD', 'OPORD', 'FRAGO')),
    exercise_phase TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    content JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published')),
    published_at TIMESTAMPTZ,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercise_orders_scenario_team
    ON exercise_orders(scenario_id, team);
CREATE INDEX IF NOT EXISTS idx_exercise_orders_scenario_phase
    ON exercise_orders(scenario_id, exercise_phase);
CREATE INDEX IF NOT EXISTS idx_exercise_orders_status
    ON exercise_orders(status);

-- ─── planning_tasks ───────────────────────────────────────────────────────────
-- Tasks created from published orders, assigned to planning roles.

CREATE TABLE IF NOT EXISTS planning_tasks (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL
        REFERENCES exercise_orders(id) ON DELETE CASCADE,
    scenario_id TEXT NOT NULL
        REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
    team TEXT NOT NULL
        CHECK (team IN ('blue', 'red', 'controller')),
    assigned_role TEXT NOT NULL
        CHECK (assigned_role IN ('blue_staff', 'red_cell', 'exercise_control')),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    deadline TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'complete')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planning_tasks_scenario_team
    ON planning_tasks(scenario_id, team);
CREATE INDEX IF NOT EXISTS idx_planning_tasks_order
    ON planning_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_planning_tasks_role
    ON planning_tasks(scenario_id, assigned_role);
CREATE INDEX IF NOT EXISTS idx_planning_tasks_status
    ON planning_tasks(status);

-- ─── exercise_gates ───────────────────────────────────────────────────────────
-- Phase transition and information release gates controlled by exercise_control.

CREATE TABLE IF NOT EXISTS exercise_gates (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL
        REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
    exercise_phase TEXT NOT NULL,
    gate_type TEXT NOT NULL
        CHECK (gate_type IN ('info_release', 'phase_transition', 'order_required')),
    condition_description TEXT NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT false,
    opened_by TEXT,
    opened_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercise_gates_scenario
    ON exercise_gates(scenario_id);
CREATE INDEX IF NOT EXISTS idx_exercise_gates_scenario_phase
    ON exercise_gates(scenario_id, exercise_phase);
CREATE INDEX IF NOT EXISTS idx_exercise_gates_open
    ON exercise_gates(scenario_id, is_open);
