---
phase: 66-ironclaw-memory-evolution-and-concept-learning
plan: "01"
subsystem: ironclaw
tags: [concept-store, pgvector, versioned-memory, semantic-search, rest-api]
dependency_graph:
  requires:
    - Phase 57 (persistent memory — ironclaw-postgres already running pgvector:pg16)
    - Phase 65 (autonomous operations — ironclaw-router.ts pattern)
  provides:
    - conceptStore singleton (concept-store.ts) — used by Plans 66-02 through 66-09
    - conceptRouter (concept-router.ts) — REST API at /api/ironclaw/:problemSetId/concepts
    - 052-ironclaw-concepts.sql migration — ironclaw_concepts table with pgvector schema
  affects:
    - ironclaw-router.ts — conceptRouter mounted
    - docker-compose.yml — OPENAI_API_KEY env var added to backend service
tech_stack:
  added:
    - pgvector@0.2.1 — node-postgres type registration and toSql() helper
    - openai SDK (already in deps) — generateConceptEmbedding() via text-embedding-3-small
  patterns:
    - getIronclawPool() from routine-service.ts — ironclaw-postgres access
    - rowToConceptEntry() mapper — follows autonomous-activity-store.ts pattern
    - versioned insert with supersedes_id FK — never overwrite, always version
key_files:
  created:
    - backend/src/db/migrations/052-ironclaw-concepts.sql
    - backend/src/ironclaw/concept-types.ts
    - backend/src/ironclaw/concept-store.ts
    - backend/src/ironclaw/concept-router.ts
  modified:
    - backend/src/ironclaw/ironclaw-router.ts
    - backend/package.json
    - docker-compose.yml
decisions:
  - "Store in ironclaw-postgres (not coalition_ops) — no cross-DB FK risk, pgvector already available per DESIGN.md D-01"
  - "problem_set_id is plain TEXT with no FK (cross-DB reference) — same pattern as routines table per DESIGN.md D-02"
  - "Use text-embedding-3-small (1536 dims) — matches vector(1536) column, lower cost than large"
  - "Graceful null fallback when OPENAI_API_KEY absent — semantic search degrades gracefully, CRUD still works"
  - "HNSW index (not IVFFlat) — better recall for small datasets, no training required"
metrics:
  duration: "~15 min"
  completed: "2026-04-05"
  tasks_completed: 2
  files_created: 4
  files_modified: 3
---

# Phase 66 Plan 01: Versioned Concept Store & Schema Summary

**One-liner:** PostgreSQL versioned concept store in ironclaw-postgres with pgvector HNSW index, ConceptStore class (CRUD + semantic search + retraction), and REST API mounted in ironclaw-router.

## What Was Built

### Task 1: Database migration, types, and concept store with pgvector

**Migration** (`052-ironclaw-concepts.sql`) — runs against ironclaw-postgres (NOT coalition_ops):
- `ironclaw_concepts` table with UUID PK, pgvector `vector(1536)` embedding column, JSONB `current_value`, versioning via `version INT` and `supersedes_id UUID FK`
- `ironclaw_concept_type` ENUM: actor, situation, assessment, preference, lesson, intent, relationship, directive
- `status TEXT` field: active | retracted | superseded (never hard-delete)
- HNSW index on embedding for cosine similarity search
- Lookup index on (user_did, problem_set_id, concept_key, status)

**concept-types.ts** — exports:
- `ConceptType` union type (8 types)
- `ConceptEntry` interface (full DB row mapped to camelCase)
- `ConceptUpsertInput` interface (input for versioning)
- `ConceptDraft` interface (LLM-extracted concept pre-store)

**concept-store.ts** — `ConceptStore` class:
- `ensureReady()` — registers pgvector types with pool via `pool.on('connect')` hook
- `upsertConcept()` — transactional: marks prior version 'superseded', inserts new version with incremented version number
- `getActive()` — all active concepts for user + problem set
- `getByKey()` — latest active version by canonical key
- `getVersionChain()` — all versions ordered by version ASC
- `semanticSearch()` — pgvector cosine similarity `1 - (embedding <=> $1::vector)`, includes global concepts (problem_set_id IS NULL)
- `retractByThread()` — marks concepts retracted on thread deletion, re-activates predecessors
- `retractById()` — single concept retraction
- `getConsolidationCandidates()` — finds concept_keys with 2+ versions from different threads

**generateConceptEmbedding()** — uses `text-embedding-3-small` (1536 dims), returns null if OPENAI_API_KEY unset (graceful degradation).

**Package / infra changes:**
- `pgvector@0.2.1` installed via pnpm
- `OPENAI_API_KEY: ${OPENAI_API_KEY:-}` added to docker-compose backend service

### Task 2: Concept REST API routes and router mount

**concept-router.ts** — Express router with 5 endpoints:
- `GET /global/concepts` — list active global concepts (problemSetId = null)
- `GET /:problemSetId/concepts` — list active concepts for a problem set
- `GET /:problemSetId/concepts/:conceptKey/history` — version chain
- `POST /:problemSetId/concepts/:conceptId/retract` — retract by UUID
- `POST /:problemSetId/concepts` — create/upsert concept with auto-embedding

**ironclaw-router.ts** — mounted `conceptRouter` at `/` (sub-paths under `/api/ironclaw`)

## Security (STRIDE Mitigations Applied)

| Threat | Mitigation |
|--------|-----------|
| T-66-01: Cross-user data | `user_did = $N` in ALL WHERE clauses |
| T-66-02: SQL injection | Parameterized queries only ($1, $2, etc.) throughout |
| T-66-03: LLM key injection | concept_key stored via parameterized query, not interpolated |
| T-66-04: DoS via embedding | OPENAI_API_KEY absence returns null gracefully; no crash |

## Commits

| Task | Hash | Description |
|------|------|-------------|
| Task 1 | a61701a5 | feat(66-01): versioned concept store — migration, types, and ConceptStore with pgvector |
| Task 2 | 174d3c83 | feat(66-01): concept REST API router mounted in ironclaw-router |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all methods are fully implemented. generateConceptEmbedding returns null when OPENAI_API_KEY is absent (graceful degradation, intentional per plan).

## Threat Flags

None — no new network endpoints beyond what was planned. All trust boundaries noted in the plan's threat_model are addressed.

## Self-Check: PASSED

Files created:
- backend/src/db/migrations/052-ironclaw-concepts.sql — FOUND
- backend/src/ironclaw/concept-types.ts — FOUND
- backend/src/ironclaw/concept-store.ts — FOUND
- backend/src/ironclaw/concept-router.ts — FOUND

Commits:
- a61701a5 — FOUND
- 174d3c83 — FOUND

TypeScript: `npx tsc --noEmit` passes with no errors.
