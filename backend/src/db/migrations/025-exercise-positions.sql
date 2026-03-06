-- 025-exercise-positions.sql
-- Quick Task 9: Custom exercise positions with phase-transition mapping
--
-- Creates tables for flexible per-exercise position rosters that support
-- multi-sided wargaming with evolving responsibilities across scenario phases.

CREATE TABLE IF NOT EXISTS exercise_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_set_id UUID NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
  side VARCHAR(20) NOT NULL CHECK (side IN ('blue', 'red', 'neutral', 'green')),
  title VARCHAR(200) NOT NULL,
  duties TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  assigned_to VARCHAR(200),  -- NEAR account ID (optional)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercise_positions_problem_set ON exercise_positions(problem_set_id);

CREATE TABLE IF NOT EXISTS exercise_position_phase_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL REFERENCES exercise_positions(id) ON DELETE CASCADE,
  exercise_phase VARCHAR(100) NOT NULL,
  title VARCHAR(200) NOT NULL,
  duties TEXT,
  UNIQUE(position_id, exercise_phase)
);

CREATE INDEX IF NOT EXISTS idx_position_phase_mappings_position ON exercise_position_phase_mappings(position_id);
