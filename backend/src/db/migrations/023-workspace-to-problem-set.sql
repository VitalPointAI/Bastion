-- ============================================================================
-- Migration 023: Rename workspace tables/columns to problem_set equivalents
-- ============================================================================
--
-- Phase 23: Problem Set Model & Workspace Rename
--
-- This migration renames all 12 workspace-related tables and their columns to
-- use "problem_set" terminology aligned with JP 5-0 doctrine. It also:
--   - Renames workspace_type -> echelon and migrates values
--   - Adds problem_statement TEXT column to the main problem_sets table
--   - Updates off-chain ID prefixes (WS->PS, WM->PM, WI->PI, WA->PA, WKS->GPS)
--   - Renames all indexes to match new table names
--
-- PostgreSQL ALTER TABLE RENAME is atomic and preserves FK relationships.
-- The entire migration is wrapped in a single transaction.
--
-- Tables renamed:
--   1. workspaces                    -> problem_sets
--   2. workspace_members             -> problem_set_members
--   3. workspace_invites             -> problem_set_invites
--   4. workspace_activity            -> problem_set_activity
--   5. workspace_roles               -> problem_set_roles
--   6. workspace_compartments        -> problem_set_compartments
--   7. workspace_member_compartments -> problem_set_member_compartments
--   8. workspace_panel_config        -> problem_set_panel_config
--   9. workspace_subscriptions       -> problem_set_subscriptions
--  10. workspace_data_cache          -> problem_set_data_cache
--  11. workspace_escalation_rules    -> problem_set_escalation_rules
--  12. graph_workspaces              -> graph_problem_sets
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Rename tables (parent table first, then children)
-- ============================================================================

-- 1. Primary table (parent of all FK references)
ALTER TABLE IF EXISTS workspaces RENAME TO problem_sets;

-- 2-11. Child tables (all reference problem_sets via FK)
ALTER TABLE IF EXISTS workspace_members RENAME TO problem_set_members;
ALTER TABLE IF EXISTS workspace_invites RENAME TO problem_set_invites;
ALTER TABLE IF EXISTS workspace_activity RENAME TO problem_set_activity;
ALTER TABLE IF EXISTS workspace_roles RENAME TO problem_set_roles;
ALTER TABLE IF EXISTS workspace_compartments RENAME TO problem_set_compartments;
ALTER TABLE IF EXISTS workspace_member_compartments RENAME TO problem_set_member_compartments;
ALTER TABLE IF EXISTS workspace_panel_config RENAME TO problem_set_panel_config;
ALTER TABLE IF EXISTS workspace_subscriptions RENAME TO problem_set_subscriptions;
ALTER TABLE IF EXISTS workspace_data_cache RENAME TO problem_set_data_cache;
ALTER TABLE IF EXISTS workspace_escalation_rules RENAME TO problem_set_escalation_rules;

-- 12. Graph table (separate system, no FK to main workspaces)
ALTER TABLE IF EXISTS graph_workspaces RENAME TO graph_problem_sets;

-- ============================================================================
-- STEP 2: Rename columns in problem_sets (main table)
-- ============================================================================

-- workspace_type -> echelon
ALTER TABLE problem_sets RENAME COLUMN workspace_type TO echelon;

-- parent_workspace_id -> parent_problem_set_id
ALTER TABLE problem_sets RENAME COLUMN parent_workspace_id TO parent_problem_set_id;

-- ============================================================================
-- STEP 3: Rename workspace_id columns across all child tables
-- ============================================================================

-- problem_set_members
ALTER TABLE problem_set_members RENAME COLUMN workspace_id TO problem_set_id;

-- problem_set_invites
ALTER TABLE problem_set_invites RENAME COLUMN workspace_id TO problem_set_id;

-- problem_set_activity
ALTER TABLE problem_set_activity RENAME COLUMN workspace_id TO problem_set_id;

-- problem_set_roles
ALTER TABLE problem_set_roles RENAME COLUMN workspace_id TO problem_set_id;

-- problem_set_compartments
ALTER TABLE problem_set_compartments RENAME COLUMN workspace_id TO problem_set_id;

-- problem_set_member_compartments
ALTER TABLE problem_set_member_compartments RENAME COLUMN workspace_id TO problem_set_id;

-- problem_set_panel_config
ALTER TABLE problem_set_panel_config RENAME COLUMN workspace_id TO problem_set_id;

-- problem_set_subscriptions
ALTER TABLE problem_set_subscriptions RENAME COLUMN subscriber_workspace_id TO subscriber_problem_set_id;
ALTER TABLE problem_set_subscriptions RENAME COLUMN publisher_workspace_id TO publisher_problem_set_id;

-- problem_set_data_cache
ALTER TABLE problem_set_data_cache RENAME COLUMN consumer_workspace_id TO consumer_problem_set_id;
ALTER TABLE problem_set_data_cache RENAME COLUMN source_workspace_id TO source_problem_set_id;

-- problem_set_escalation_rules
ALTER TABLE problem_set_escalation_rules RENAME COLUMN workspace_id TO problem_set_id;

-- graph_problem_sets
ALTER TABLE graph_problem_sets RENAME COLUMN workspace_type TO echelon;
ALTER TABLE graph_problem_sets RENAME COLUMN parent_workspace_id TO parent_problem_set_id;
ALTER TABLE graph_problem_sets RENAME COLUMN linked_workspace_ids TO linked_problem_set_ids;

-- exercise_scenarios (FK column added by workspace-store init)
ALTER TABLE exercise_scenarios RENAME COLUMN workspace_id TO problem_set_id;

-- ============================================================================
-- STEP 4: Migrate WorkspaceType values to echelon values
-- ============================================================================

UPDATE problem_sets SET echelon = CASE
  WHEN echelon = 'Organization' THEN 'strategic'
  WHEN echelon = 'Unit' THEN 'operational'
  WHEN echelon = 'Team' THEN 'tactical'
  ELSE 'operational'
END;

-- Also migrate graph_problem_sets echelon values
UPDATE graph_problem_sets SET echelon = CASE
  WHEN echelon = 'Organization' THEN 'strategic'
  WHEN echelon = 'Unit' THEN 'operational'
  WHEN echelon = 'Team' THEN 'tactical'
  ELSE 'operational'
END;

-- ============================================================================
-- STEP 5: Add problem_statement column to problem_sets
-- ============================================================================

ALTER TABLE problem_sets ADD COLUMN IF NOT EXISTS problem_statement TEXT;

-- ============================================================================
-- STEP 6: Update off-chain ID prefixes in data
-- ============================================================================

-- 6a. Update primary IDs in problem_sets (WS- -> PS-)
UPDATE problem_sets SET id = REPLACE(id, 'WS-', 'PS-') WHERE id LIKE 'WS-%';

-- 6b. Update FK references that point to problem_sets.id
-- These must be updated to match the new parent ID prefix
UPDATE problem_set_members SET problem_set_id = REPLACE(problem_set_id, 'WS-', 'PS-') WHERE problem_set_id LIKE 'WS-%';
UPDATE problem_set_invites SET problem_set_id = REPLACE(problem_set_id, 'WS-', 'PS-') WHERE problem_set_id LIKE 'WS-%';
UPDATE problem_set_activity SET problem_set_id = REPLACE(problem_set_id, 'WS-', 'PS-') WHERE problem_set_id LIKE 'WS-%';
UPDATE problem_set_roles SET problem_set_id = REPLACE(problem_set_id, 'WS-', 'PS-') WHERE problem_set_id LIKE 'WS-%';
UPDATE problem_set_compartments SET problem_set_id = REPLACE(problem_set_id, 'WS-', 'PS-') WHERE problem_set_id LIKE 'WS-%';
UPDATE problem_set_member_compartments SET problem_set_id = REPLACE(problem_set_id, 'WS-', 'PS-') WHERE problem_set_id LIKE 'WS-%';
UPDATE problem_set_panel_config SET problem_set_id = REPLACE(problem_set_id, 'WS-', 'PS-') WHERE problem_set_id LIKE 'WS-%';
UPDATE problem_set_subscriptions SET subscriber_problem_set_id = REPLACE(subscriber_problem_set_id, 'WS-', 'PS-') WHERE subscriber_problem_set_id LIKE 'WS-%';
UPDATE problem_set_subscriptions SET publisher_problem_set_id = REPLACE(publisher_problem_set_id, 'WS-', 'PS-') WHERE publisher_problem_set_id LIKE 'WS-%';
UPDATE problem_set_data_cache SET consumer_problem_set_id = REPLACE(consumer_problem_set_id, 'WS-', 'PS-') WHERE consumer_problem_set_id LIKE 'WS-%';
UPDATE problem_set_data_cache SET source_problem_set_id = REPLACE(source_problem_set_id, 'WS-', 'PS-') WHERE source_problem_set_id LIKE 'WS-%';
UPDATE problem_set_escalation_rules SET problem_set_id = REPLACE(problem_set_id, 'WS-', 'PS-') WHERE problem_set_id LIKE 'WS-%';
UPDATE problem_sets SET parent_problem_set_id = REPLACE(parent_problem_set_id, 'WS-', 'PS-') WHERE parent_problem_set_id LIKE 'WS-%';
UPDATE exercise_scenarios SET problem_set_id = REPLACE(problem_set_id, 'WS-', 'PS-') WHERE problem_set_id LIKE 'WS-%';

-- 6c. Update member IDs (WM- -> PM-)
UPDATE problem_set_members SET id = REPLACE(id, 'WM-', 'PM-') WHERE id LIKE 'WM-%';

-- 6d. Update invite IDs (WI- -> PI-)
UPDATE problem_set_invites SET id = REPLACE(id, 'WI-', 'PI-') WHERE id LIKE 'WI-%';

-- 6e. Update activity IDs (WA- -> PA-)
UPDATE problem_set_activity SET id = REPLACE(id, 'WA-', 'PA-') WHERE id LIKE 'WA-%';

-- 6f. Update graph workspace IDs (WKS- -> GPS-)
UPDATE graph_problem_sets SET id = REPLACE(id, 'WKS-', 'GPS-') WHERE id LIKE 'WKS-%';

-- 6g. Update graph parent references
UPDATE graph_problem_sets SET parent_problem_set_id = REPLACE(parent_problem_set_id, 'WKS-', 'GPS-') WHERE parent_problem_set_id LIKE 'WKS-%';

-- 6h. Update graph linked_problem_set_ids array entries
UPDATE graph_problem_sets SET linked_problem_set_ids = (
  SELECT array_agg(REPLACE(elem, 'WKS-', 'GPS-'))
  FROM unnest(linked_problem_set_ids) AS elem
) WHERE EXISTS (
  SELECT 1 FROM unnest(linked_problem_set_ids) AS elem WHERE elem LIKE 'WKS-%'
);

-- ============================================================================
-- STEP 7: Rename indexes
-- ============================================================================

-- problem_sets (main table)
ALTER INDEX IF EXISTS idx_workspace_parent RENAME TO idx_problem_set_parent;
ALTER INDEX IF EXISTS idx_workspace_classification RENAME TO idx_problem_set_classification;
ALTER INDEX IF EXISTS idx_workspace_type RENAME TO idx_problem_set_echelon;
ALTER INDEX IF EXISTS idx_workspace_mode RENAME TO idx_problem_set_mode;

-- problem_set_members
ALTER INDEX IF EXISTS idx_one_primary_per_user RENAME TO idx_one_primary_per_user; -- no workspace in name, keep as-is
ALTER INDEX IF EXISTS idx_wm_workspace RENAME TO idx_pm_problem_set;
ALTER INDEX IF EXISTS idx_wm_user RENAME TO idx_pm_user;
ALTER INDEX IF EXISTS idx_wm_primary RENAME TO idx_pm_primary;

-- problem_set_invites
ALTER INDEX IF EXISTS idx_wi_workspace RENAME TO idx_pi_problem_set;
ALTER INDEX IF EXISTS idx_wi_token RENAME TO idx_pi_token;

-- problem_set_activity
ALTER INDEX IF EXISTS idx_wa_workspace RENAME TO idx_pa_problem_set;
ALTER INDEX IF EXISTS idx_wa_created RENAME TO idx_pa_created;
ALTER INDEX IF EXISTS idx_wa_actor RENAME TO idx_pa_actor;

-- problem_set_roles
ALTER INDEX IF EXISTS idx_workspace_roles_workspace RENAME TO idx_problem_set_roles_problem_set;
ALTER INDEX IF EXISTS idx_workspace_roles_label RENAME TO idx_problem_set_roles_label;

-- problem_set_compartments
ALTER INDEX IF EXISTS idx_wc_workspace RENAME TO idx_pc_problem_set;

-- problem_set_member_compartments
ALTER INDEX IF EXISTS idx_wmc_workspace RENAME TO idx_pmc_problem_set;
ALTER INDEX IF EXISTS idx_wmc_member RENAME TO idx_pmc_member;
ALTER INDEX IF EXISTS idx_wmc_compartment RENAME TO idx_pmc_compartment;

-- problem_set_panel_config
ALTER INDEX IF EXISTS idx_wpc_workspace RENAME TO idx_ppc_problem_set;

-- problem_set_subscriptions
ALTER INDEX IF EXISTS idx_wsub_subscriber RENAME TO idx_psub_subscriber;
ALTER INDEX IF EXISTS idx_wsub_publisher RENAME TO idx_psub_publisher;
ALTER INDEX IF EXISTS idx_wsub_status RENAME TO idx_psub_status;

-- problem_set_data_cache
ALTER INDEX IF EXISTS idx_wdc_consumer RENAME TO idx_pdc_consumer;
ALTER INDEX IF EXISTS idx_wdc_source RENAME TO idx_pdc_source;

-- problem_set_escalation_rules
ALTER INDEX IF EXISTS idx_wer_workspace RENAME TO idx_per_problem_set;
ALTER INDEX IF EXISTS idx_wer_kind RENAME TO idx_per_kind;
ALTER INDEX IF EXISTS idx_wer_active RENAME TO idx_per_active;

-- graph_problem_sets
ALTER INDEX IF EXISTS idx_graph_workspace_type RENAME TO idx_graph_problem_set_echelon;
ALTER INDEX IF EXISTS idx_graph_workspace_parent RENAME TO idx_graph_problem_set_parent;
ALTER INDEX IF EXISTS idx_graph_workspace_classification RENAME TO idx_graph_problem_set_classification;

COMMIT;
