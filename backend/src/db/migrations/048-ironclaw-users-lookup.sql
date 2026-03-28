-- Run against ironclaw-postgres (port 5433), NOT bastion-postgres
-- Phase 60 Plan 01: DID slug lookup table for Ironclaw per-user workspace isolation

-- Maps NEAR account → DID slug for RLS policy enforcement
-- did_slug is the URL-safe identifier used in app.current_did_slug
-- Example: did:near:alice.near → alice-near
CREATE TABLE IF NOT EXISTS ironclaw_users (
  did_slug    TEXT PRIMARY KEY,
  did         TEXT UNIQUE NOT NULL,
  near_account TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
