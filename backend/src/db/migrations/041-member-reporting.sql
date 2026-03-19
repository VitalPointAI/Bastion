-- Migration 041: Member reporting relationships for ORBAT
-- Stores direct (solid line) and dotted (coordination) reporting relationships
-- between problem set members.

CREATE TABLE IF NOT EXISTS member_reporting_relationships (
  id TEXT PRIMARY KEY,
  problem_set_id TEXT NOT NULL,
  superior_did TEXT NOT NULL,
  subordinate_did TEXT NOT NULL,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('direct', 'dotted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  UNIQUE(problem_set_id, superior_did, subordinate_did, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_member_reporting_ps ON member_reporting_relationships(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_member_reporting_superior ON member_reporting_relationships(superior_did);
CREATE INDEX IF NOT EXISTS idx_member_reporting_subordinate ON member_reporting_relationships(subordinate_did);
