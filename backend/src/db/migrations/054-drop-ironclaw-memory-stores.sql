-- Drop the parallel BASTION memory stores. Ironclaw's intrinsic memory
-- (memory_documents in bastion-ironclaw-postgres) is the single source of
-- truth for user preferences, behavioral rules, and facts the commander
-- wants Ironclaw to remember. The old ironclaw_user_memory table was only
-- ever used for the honorific preference, which now lives in AgentConfig
-- and gets rendered into USER.md on identity sync.
--
-- See: project_ironclaw_token_architecture.md for the rationale on why
-- there's only one memory system now.

ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS honorific TEXT;

DROP TABLE IF EXISTS ironclaw_user_memory CASCADE;
DROP TABLE IF EXISTS ironclaw_context_memory CASCADE;

-- The ironclaw_outcome table was populated alongside the memory tables to
-- support behavioral adaptation. Behavioral adaptation still works (tracked
-- via commander feedback on activity cards), but the outcome store is not
-- loaded into context anymore. Leaving it in place — it's tiny — but if it
-- ever needs to go, this is the migration to amend.
