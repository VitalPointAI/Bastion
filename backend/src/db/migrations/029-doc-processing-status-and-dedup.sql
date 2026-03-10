-- ============================================================================
-- Migration 029: Document Processing Status & Duplicate Detection
--
-- 1. Add processing lifecycle columns to strategic_documents
-- 2. Add content_hash for duplicate detection
-- 3. Create doc_intelligence_reports table (code expects this name;
--    migration 028 created document_intelligence_reports)
-- 4. Add pg_trgm extension for fuzzy text similarity
-- ============================================================================

-- 1. Processing lifecycle on strategic_documents
ALTER TABLE strategic_documents
  ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'complete', 'failed', 'interrupted')),
  ADD COLUMN IF NOT EXISTS processing_error TEXT,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_strategic_documents_processing_status
  ON strategic_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_strategic_documents_content_hash
  ON strategic_documents(content_hash);

-- Mark any documents stuck in 'processing' as 'interrupted' (server restart recovery)
UPDATE strategic_documents
  SET processing_status = 'interrupted'
  WHERE processing_status = 'processing';

-- 2. Create doc_intelligence_reports table that code actually references.
--    Migration 028 created document_intelligence_reports with different columns.
--    This table uses the schema the API code expects.
CREATE TABLE IF NOT EXISTS doc_intelligence_reports (
  document_id TEXT NOT NULL,
  problem_set_id TEXT NOT NULL,
  report JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  PRIMARY KEY (document_id, problem_set_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_intel_reports_ps
  ON doc_intelligence_reports(problem_set_id);

-- Migrate any existing data from the old table name (if it exists and has rows)
INSERT INTO doc_intelligence_reports (document_id, problem_set_id, report, created_at)
  SELECT document_id, problem_set_id, report_data, created_at
  FROM document_intelligence_reports
  WHERE NOT EXISTS (
    SELECT 1 FROM doc_intelligence_reports r
    WHERE r.document_id = document_intelligence_reports.document_id
      AND r.problem_set_id = document_intelligence_reports.problem_set_id
  )
  ON CONFLICT DO NOTHING;

-- 3. Enable pg_trgm for similarity() function (fuzzy duplicate detection)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
