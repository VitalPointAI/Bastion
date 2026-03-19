-- Migration 040: RACI matrix and decisions tables
--
-- RACI is a first-class standalone artifact per JP 5-0 doctrine.
-- Supports temporal and permanent delegation with full audit trail.
-- Decisions are the second half of the decision pipeline.

-- RACI matrix assignments per problem set ────────────────────────────────────
CREATE TABLE IF NOT EXISTS raci_assignments (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_set_id       UUID        NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
  decision_type        TEXT        NOT NULL,
  position             TEXT        NOT NULL,
  raci_role            TEXT        NOT NULL CHECK (raci_role IN ('R', 'A', 'C', 'I')),
  delegated_to         TEXT,              -- DID of delegate (null = no delegation)
  delegated_by         TEXT,              -- DID of person who delegated
  delegation_reason    TEXT,
  delegation_type      TEXT        CHECK (delegation_type IN ('permanent', 'temporary')),
  delegation_expires_at TIMESTAMPTZ,
  version              INTEGER     NOT NULL DEFAULT 1,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(problem_set_id, decision_type, position)
);

-- RACI delegation audit trail (every delegation/revocation logged) ────────────
CREATE TABLE IF NOT EXISTS raci_delegations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  raci_assignment_id   UUID        NOT NULL REFERENCES raci_assignments(id) ON DELETE CASCADE,
  from_did             TEXT        NOT NULL,
  to_did               TEXT        NOT NULL,
  reason               TEXT        NOT NULL DEFAULT '',
  delegation_type      TEXT        NOT NULL CHECK (delegation_type IN ('permanent', 'temporary')),
  expires_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_raci_delegations_assignment ON raci_delegations(raci_assignment_id);
CREATE INDEX IF NOT EXISTS idx_raci_delegations_to         ON raci_delegations(to_did);

-- Decision records ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decisions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_set_id   UUID        NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
  decision_type    TEXT        NOT NULL,
  title            TEXT        NOT NULL,
  description      TEXT        NOT NULL DEFAULT '',
  context_json     JSONB       NOT NULL DEFAULT '{}',
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'approved', 'rejected', 'deferred', 'info_requested')),
  decided_by       TEXT,
  decided_at       TIMESTAMPTZ,
  requested_by     TEXT,
  dao_proposal_id  INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raci_problem_set   ON raci_assignments(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_raci_position      ON raci_assignments(problem_set_id, position);
CREATE INDEX IF NOT EXISTS idx_decisions_problem_set ON decisions(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status   ON decisions(problem_set_id, status);
CREATE INDEX IF NOT EXISTS idx_decisions_type     ON decisions(problem_set_id, decision_type);
