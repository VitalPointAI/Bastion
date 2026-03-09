-- ============================================================================
-- Migration 028: Document Intelligence Team Tables
-- Phase 40: Autonomous Document Intelligence Team
--
-- Creates tables for:
--   1. problem_set_context - scoping interview output
--   2. entity_provenance - per-source entity tracking
--   3. source_registry - known source trust scores
--   4. briefing_access_log - per-user/agent last-access tracking
--   5. document_intelligence_reports - orchestrator output per document
--   6. ALTER strategic_documents - NATO ratings and trust status columns
-- ============================================================================

-- 1. Problem set scoping context
CREATE TABLE IF NOT EXISTS problem_set_context (
  id TEXT PRIMARY KEY,
  problem_set_id TEXT NOT NULL UNIQUE,
  context_data JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Entity provenance tracking
CREATE TABLE IF NOT EXISTS entity_provenance (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  extracted_by TEXT NOT NULL,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  UNIQUE(entity_id, source_document_id)
);

CREATE INDEX IF NOT EXISTS idx_provenance_entity ON entity_provenance(entity_id);
CREATE INDEX IF NOT EXISTS idx_provenance_source ON entity_provenance(source_document_id);
CREATE INDEX IF NOT EXISTS idx_provenance_revoked ON entity_provenance(is_revoked);

-- 3. Source trust registry
CREATE TABLE IF NOT EXISTS source_registry (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  default_reliability TEXT CHECK (default_reliability IN ('A','B','C','D','E','F')),
  trust_notes TEXT,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Briefing change tracking
CREATE TABLE IF NOT EXISTS briefing_access_log (
  id TEXT PRIMARY KEY,
  problem_set_id TEXT NOT NULL,
  accessed_by TEXT NOT NULL,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  graph_snapshot_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_briefing_access ON briefing_access_log(problem_set_id, accessed_by);

-- 5. Document intelligence reports
CREATE TABLE IF NOT EXISTS document_intelligence_reports (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  problem_set_id TEXT NOT NULL,
  triage_decision JSONB NOT NULL,
  report_data JSONB NOT NULL,
  nato_rating JSONB,
  processing_duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_document ON document_intelligence_reports(document_id);
CREATE INDEX IF NOT EXISTS idx_reports_problem_set ON document_intelligence_reports(problem_set_id);

-- 6. Extend strategic_documents with NATO ratings and trust status
ALTER TABLE strategic_documents
  ADD COLUMN IF NOT EXISTS nato_reliability TEXT CHECK (nato_reliability IN ('A','B','C','D','E','F')),
  ADD COLUMN IF NOT EXISTS nato_credibility INTEGER CHECK (nato_credibility BETWEEN 1 AND 6),
  ADD COLUMN IF NOT EXISTS trust_status TEXT DEFAULT 'pending'
    CHECK (trust_status IN ('trusted', 'pending', 'flagged', 'revoked')),
  ADD COLUMN IF NOT EXISTS trust_assessed_by TEXT,
  ADD COLUMN IF NOT EXISTS trust_assessed_at TIMESTAMPTZ;
