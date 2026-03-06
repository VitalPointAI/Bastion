-- 024-doctrinal-tabs.sql
-- Phase 24: Migrate panel_visibility from old tab names to doctrinal lifecycle tabs
-- Old tabs: overview, decide, design, campaign, monitor, train
-- New tabs: understand, design, plan, direct, cop, assess
--
-- Per user decision: all roles see all tabs, so replace all role arrays
-- with the full 6-tab list regardless of previous configuration.

-- Update panel_visibility: set every role to see all 6 doctrinal tabs
UPDATE problem_set_panel_config
SET panel_visibility = (
  SELECT jsonb_object_agg(
    role_name,
    '["understand","design","plan","direct","cop","assess"]'::jsonb
  )
  FROM jsonb_each(panel_visibility) AS x(role_name, tabs)
),
default_tab = 'cop',
updated_at = NOW()
WHERE panel_visibility IS NOT NULL
  AND panel_visibility != '{}'::jsonb;

-- Update column default for new records
ALTER TABLE problem_set_panel_config
  ALTER COLUMN default_tab SET DEFAULT 'cop';
