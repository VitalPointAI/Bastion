-- Migration 026: Fix decision_gates.problem_set_id column type
-- Problem: Column was created as UUID but problem set IDs use TEXT format (PS-<uuid>)
-- This caused 500 errors when querying gates by problem set ID.

-- Only alter if the table exists and column is currently uuid type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_gates'
      AND column_name = 'problem_set_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE decision_gates ALTER COLUMN problem_set_id TYPE TEXT USING problem_set_id::TEXT;
  END IF;
END $$;
