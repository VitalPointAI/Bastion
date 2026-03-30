-- 050: Add columns referenced in code but missing from prior migrations
-- Fixes runtime errors: quality_assessed_by, quality_assessed_at, ai_summary, status

-- strategic_documents: quality assessment tracking (quality-assessor.ts)
ALTER TABLE strategic_documents ADD COLUMN IF NOT EXISTS quality_assessed_by TEXT;
ALTER TABLE strategic_documents ADD COLUMN IF NOT EXISTS quality_assessed_at TIMESTAMPTZ;

-- strategic_documents: AI-generated summary (cross-doc-linker.ts)
ALTER TABLE strategic_documents ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- problem_sets: status for active/planning filtering (routine-service.ts)
ALTER TABLE problem_sets ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- entity_provenance: extraction_context (fact-extractor.ts)
-- This should already exist from migration 028, but add IF NOT EXISTS as safety net
ALTER TABLE entity_provenance ADD COLUMN IF NOT EXISTS extraction_context JSONB;
