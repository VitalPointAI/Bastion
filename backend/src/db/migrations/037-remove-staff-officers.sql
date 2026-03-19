-- Migration 037: Remove named staff officer agents
-- Staff officer concept replaced by Ironclaw (Phase 51)
-- Deletes ~90 ranked agents (COL, BG, LTC, MAJ, CPT, CW3, CW4) from all tables

BEGIN;

-- 1. Delete staff officer memory entries (FK cascade would handle this, but be explicit)
DELETE FROM agent_memory
WHERE agent_id IN (SELECT agent_id FROM agents_v2 WHERE agent_id ~ '^(cmd|dcom|cos|j[0-9]|j35|jflcc|jfmcc|jfacc|jfsocc|socom|transcom|fires|engineer|cbrn|cyber|ew|space|io|sja|polad|pao|km|surgeon)-[0-9]+$');

-- 2. Delete staff officer action log entries
DELETE FROM agent_action_log
WHERE agent_id IN (SELECT agent_id FROM agents_v2 WHERE agent_id ~ '^(cmd|dcom|cos|j[0-9]|j35|jflcc|jfmcc|jfacc|jfsocc|socom|transcom|fires|engineer|cbrn|cyber|ew|space|io|sja|polad|pao|km|surgeon)-[0-9]+$');

-- 3. Delete staff officer activity log entries
DELETE FROM agent_activity_log
WHERE agent_id IN (SELECT agent_id FROM agents_v2 WHERE agent_id ~ '^(cmd|dcom|cos|j[0-9]|j35|jflcc|jfmcc|jfacc|jfsocc|socom|transcom|fires|engineer|cbrn|cyber|ew|space|io|sja|polad|pao|km|surgeon)-[0-9]+$');

-- 4. Delete staff officers from agents_v2
DELETE FROM agents_v2
WHERE agent_id ~ '^(cmd|dcom|cos|j[0-9]|j35|jflcc|jfmcc|jfacc|jfsocc|socom|transcom|fires|engineer|cbrn|cyber|ew|space|io|sja|polad|pao|km|surgeon)-[0-9]+$';

-- 5. Drop the staff_agents table entirely (no longer needed)
DROP TABLE IF EXISTS staff_agents CASCADE;

-- 6. Drop staff-related tables that are now orphaned
DROP TABLE IF EXISTS staff_products CASCADE;
DROP TABLE IF EXISTS staff_product_versions CASCADE;
DROP TABLE IF EXISTS staff_notifications CASCADE;

-- 7. Drop AI staff tables (replaced by Ironclaw in Phase 51)
DROP TABLE IF EXISTS ai_staff_annotations CASCADE;
DROP TABLE IF EXISTS ai_staff_chat CASCADE;
DROP TABLE IF EXISTS ai_staff_feed CASCADE;
DROP TABLE IF EXISTS ai_staff_tab_routing CASCADE;

-- 8. Assign DIDs to any remaining agents that lack them
UPDATE agents_v2
SET agent_data = jsonb_set(
  agent_data,
  '{agentDID}',
  to_jsonb('did:near:agent-' || agent_id)
)
WHERE agent_data->>'agentDID' IS NULL
   OR agent_data->>'agentDID' = '';

COMMIT;
