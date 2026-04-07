-- Migration 053: Add device properties to bridge_tokens table
-- TARGET DATABASE: coalition_ops (default)
--
-- Extends bridge registration tokens with device metadata so that
-- classification, authority level, and capabilities are embedded
-- in the token and applied to the resource DID on registration.
--
-- Run with:
--   psql $DATABASE_URL -f 053-bridge-token-device-properties.sql

-- Idempotent: each ALTER uses a DO block to skip if column already exists

DO $$ BEGIN
  ALTER TABLE bridge_tokens ADD COLUMN label TEXT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bridge_tokens ADD COLUMN device_type TEXT NULL DEFAULT 'bridge';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bridge_tokens ADD COLUMN classification TEXT NULL DEFAULT 'UNCLASSIFIED';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bridge_tokens ADD COLUMN authority_level TEXT NULL DEFAULT 'observer';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bridge_tokens ADD COLUMN capabilities TEXT[] NULL DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bridge_tokens ADD COLUMN metadata JSONB NULL DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
