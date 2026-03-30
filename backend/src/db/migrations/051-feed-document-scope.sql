-- 051: Add scope field to OSINT feeds and strategic documents
-- Supports global (shared across all problem sets) vs local (problem-set-scoped) ingestion

ALTER TABLE osint_feed_config ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'local';
ALTER TABLE strategic_documents ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'local';
