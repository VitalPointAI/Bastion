-- Migration 019: Add extraction_status and extraction_error to scenario_documents
-- Allows distinguishing pending vs extracting vs failed vs complete states

ALTER TABLE scenario_documents
  ADD COLUMN IF NOT EXISTS extraction_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS extraction_error TEXT;

-- Backfill: documents with extractedData are complete
UPDATE scenario_documents
  SET extraction_status = 'complete'
  WHERE extraction_confidence > 0;
