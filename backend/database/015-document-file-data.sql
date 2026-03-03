-- ============================================================================
-- Add file_data column to scenario_documents
-- Stores the original uploaded file buffer so retry-extraction can re-parse
-- when the parser is improved (e.g., XLSX support added after initial upload).
-- ============================================================================

ALTER TABLE scenario_documents
    ADD COLUMN IF NOT EXISTS file_data BYTEA;

-- Exclude file_data from common list queries via a partial index isn't needed;
-- instead, application code uses explicit column lists to avoid loading blobs.
