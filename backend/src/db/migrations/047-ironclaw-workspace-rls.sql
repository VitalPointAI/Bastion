-- Run against ironclaw-postgres (port 5433), NOT bastion-postgres
-- Phase 60 Plan 01: PostgreSQL RLS on Ironclaw workspace table for per-user DID isolation

-- Add owner_did column to workspace table if not already present
ALTER TABLE workspace ADD COLUMN IF NOT EXISTS owner_did TEXT;

-- Enable Row Level Security on workspace table
ALTER TABLE workspace ENABLE ROW LEVEL SECURITY;

-- Index for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_workspace_owner_did ON workspace(owner_did);

-- Policy 1: SELECT — user can read their own rows, shared rows, and rows before RLS was applied (null owner_did)
CREATE POLICY workspace_read_own ON workspace
  FOR SELECT
  USING (
    owner_did = current_setting('app.current_did_slug', true)
    OR owner_did = 'shared'
    OR current_setting('app.current_did_slug', true) IS NULL
  );

-- Policy 2: INSERT — user can only write rows attributed to their own DID slug
CREATE POLICY workspace_write_own ON workspace
  FOR INSERT
  WITH CHECK (
    owner_did = current_setting('app.current_did_slug', true)
    OR owner_did = 'shared'
    OR current_setting('app.current_did_slug', true) IS NULL
  );

-- Policy 3: UPDATE — user can only modify rows that belong to them
CREATE POLICY workspace_update_own ON workspace
  FOR UPDATE
  USING (
    owner_did = current_setting('app.current_did_slug', true)
    OR owner_did = 'shared'
    OR current_setting('app.current_did_slug', true) IS NULL
  )
  WITH CHECK (
    owner_did = current_setting('app.current_did_slug', true)
    OR owner_did = 'shared'
    OR current_setting('app.current_did_slug', true) IS NULL
  );
