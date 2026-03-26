-- Phase 58 Plan 02: Resource Caveat Columns
-- Adds caveat enforcement fields to the resources table and backfills
-- existing DID-registered resources with permissive defaults so they are
-- ready for on-chain caveat sync when a user first sets caveats via
-- PATCH /:id/caveats.

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS caveat_classification TEXT,
  ADD COLUMN IF NOT EXISTS caveat_releasability TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS caveat_geo_bounds JSONB,
  ADD COLUMN IF NOT EXISTS caveat_roe_tier SMALLINT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS caveat_time_windows JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS caveat_employment_constraints TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS caveat_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS caveat_on_chain_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_resource_caveat_roe_tier ON resources(caveat_roe_tier);
CREATE INDEX IF NOT EXISTS idx_resource_caveat_classification ON resources(caveat_classification);

-- REQ-58-03: Backfill existing resources that have DID registrations.
-- Set blinded_key column to non-null for resources that already have a DID,
-- ensuring they are ready for on-chain caveat sync when caveats are assigned.
-- Actual on-chain caveat storage happens when a user first sets caveats via
-- PATCH /:id/caveats (fire-and-forget chain sync in resource-caveat-service).
-- This migration ensures the DB schema is ready; no on-chain migration is needed
-- because resources without caveats return authorized=true (permissive default
-- in the contract's check_employment_authorized).
UPDATE resources
  SET caveat_classification = 'UNCLASSIFIED',
      caveat_roe_tier = 5
  WHERE did IS NOT NULL
    AND caveat_classification IS NULL;
