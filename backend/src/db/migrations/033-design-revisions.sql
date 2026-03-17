-- Migration 033: Design Revisions
-- Phase 49 Plan 03: Fork-and-merge revision system for Design tab artifacts.
-- Plan tab staff propose changes to Design artifacts; DAO governance approves;
-- approved revisions are merged back into operational_designs table.

CREATE TABLE IF NOT EXISTS design_revisions (
  id TEXT PRIMARY KEY,
  problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,   -- 'problem-framing' | 'cog-analysis' | 'lines-of-effort' | 'operational-approach'
  proposed_by TEXT NOT NULL,
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  original_data JSONB NOT NULL,
  proposed_data JSONB NOT NULL,
  rationale TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected' | 'merged'
  gate_id TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  merged_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_design_revisions_problem_set ON design_revisions(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_design_revisions_status ON design_revisions(status);
