-- ============================================================================
-- Migration 030: Fix source_registry missing UNIQUE constraint on source_name
--
-- source-store.ts upsertSource() uses ON CONFLICT (source_name) which
-- requires a UNIQUE constraint. Migration 028 only set id as PRIMARY KEY
-- without UNIQUE on source_name, causing:
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
--
-- Also adds a DEFAULT for the id column so INSERTs that omit id get an
-- auto-generated UUID.
-- ============================================================================

-- 1. Add UNIQUE constraint on source_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'source_registry_source_name_key'
  ) THEN
    ALTER TABLE source_registry
      ADD CONSTRAINT source_registry_source_name_key UNIQUE (source_name);
  END IF;
END
$$;

-- 2. Default for id column so upsertSource INSERTs work without providing id
ALTER TABLE source_registry
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
