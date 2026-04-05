-- Migration 052: ironclaw_concepts versioned concept store (Phase 66)
-- TARGET DATABASE: ironclaw-postgres (NOT coalition_ops)
-- This migration must be run against DATABASE_URL_IRONCLAW
-- The ironclaw-postgres image (pgvector/pgvector:pg16) already has the vector extension available.
--
-- Run with:
--   psql $DATABASE_URL_IRONCLAW -f 052-ironclaw-concepts.sql

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE ironclaw_concept_type AS ENUM (
  'actor', 'situation', 'assessment', 'preference',
  'lesson', 'intent', 'relationship', 'directive'
);

CREATE TABLE IF NOT EXISTS ironclaw_concepts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_set_id  TEXT,                   -- nullable: null = global concept
  user_did        TEXT NOT NULL,
  concept_key     TEXT NOT NULL,
  concept_type    ironclaw_concept_type NOT NULL,
  current_value   JSONB NOT NULL,
  confidence      NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  source_thread_id TEXT,
  version         INT NOT NULL DEFAULT 1,
  supersedes_id   UUID REFERENCES ironclaw_concepts(id),
  status          TEXT NOT NULL DEFAULT 'active', -- active | retracted | superseded
  embedding       vector(1536),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  UNIQUE (problem_set_id, user_did, concept_key, version)
);

-- HNSW index for fast cosine similarity search over embeddings
CREATE INDEX IF NOT EXISTS idx_ironclaw_concepts_embedding
  ON ironclaw_concepts USING hnsw (embedding vector_cosine_ops);

-- Lookup index for user + problem set + key + status queries
CREATE INDEX IF NOT EXISTS idx_ironclaw_concepts_lookup
  ON ironclaw_concepts (user_did, problem_set_id, concept_key, status);
