---
phase: 51-unified-agent-architecture
plan: 01
subsystem: agents
tags: [postgresql, typescript, jsonb, cosine-similarity, agent-memory, zod]

# Dependency graph
requires:
  - phase: agents/types.ts
    provides: AgentManifest interface that StandardAgent extends
  - phase: validation/scoring/cosine-similarity.ts
    provides: cosineSimilarity utility used by AgentMemoryStore.recall()
  - phase: lib/database.ts
    provides: getPool() for all DB access

provides:
  - StandardAgent interface (extends AgentManifest with systemPrompt, clearance, skills, status, health metrics)
  - AgentSkill, MemoryEntry, EpisodeSummary interfaces
  - toStandardAgent() helper for converting legacy manifests
  - AgentStore — PostgreSQL-backed CRUD for agents (agents_v2 table)
  - TeamStore — PostgreSQL-backed CRUD for teams (agent_teams table)
  - AgentMemoryStore — per-agent memory with semantic recall (agent_memory table)
  - SQL migration 034: agents_v2, agent_teams, agent_action_log tables
  - SQL migration 035: agent_memory table with FK constraint and composite indexes

affects:
  - 51-02 (StandardAgent executor — uses AgentStore and AgentMemoryStore)
  - 51-03 (Ironclaw agent — built on StandardAgent type)
  - All future agent implementations in Phase 51

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Singleton factory pattern for stores (getAgentStore, getTeamStore, getAgentMemoryStore)
    - JSONB for full object storage with separate indexed columns for hot query fields
    - Upsert (INSERT ... ON CONFLICT DO UPDATE) for idempotent agent registration
    - Embedding-based semantic recall with ILIKE fallback when no embeddings present
    - Caller-supplied embeddings — stores never generate embeddings (decoupled from provider)

key-files:
  created:
    - backend/src/agents/standard-agent.ts
    - backend/src/agents/agent-store.ts
    - backend/src/agents/team-store.ts
    - backend/src/agents/agent-memory-store.ts
    - backend/src/db/migrations/034-agent-tables.sql
    - backend/src/db/migrations/035-agent-memory.sql
  modified: []

key-decisions:
  - "StandardAgent extends AgentManifest rather than replacing it — all existing agent consumers remain unbroken"
  - "Health metrics (status, last_invocation, success_rate, avg_response_time_ms) stored as separate NUMERIC columns on agents_v2, not just in JSONB, for efficient filtering and sorting"
  - "Embeddings are caller-supplied (not generated in AgentMemoryStore) to keep store decoupled from any specific embedding provider"
  - "recall() falls back to ILIKE text search when no embeddings are present, ensuring utility before async embedding pipeline is wired up"
  - "agent_memory uses ON DELETE CASCADE FK to agents_v2 so deleting an agent cleans up all its memories automatically"

patterns-established:
  - "Singleton factory: let _store = null; export function getXxxStore() { if (!_store) _store = new XxxStore(); return _store; }"
  - "JSONB + indexed columns: store full object in JSONB for flexibility, extract hot fields as typed columns for efficient queries"
  - "rowToEntry helper: private function mapping DB row shape to clean TypeScript interface"

requirements-completed: [REQ-51-01, REQ-51-02]

# Metrics
duration: 5min
completed: 2026-03-18
---

# Phase 51 Plan 01: StandardAgent Foundation Summary

**PostgreSQL-backed StandardAgent type system with JSONB stores for agents, teams, and per-agent memory using cosine similarity semantic recall**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T21:37:34Z
- **Completed:** 2026-03-18T21:42:55Z
- **Tasks:** 2
- **Files modified:** 6 (all created)

## Accomplishments

- StandardAgent interface extending AgentManifest with systemPrompt, clearance, skills, status, and health metrics — fully backward-compatible
- Three PostgreSQL-backed stores (AgentStore, TeamStore, AgentMemoryStore) replacing in-memory Maps with durable persistence
- AgentMemoryStore.recall() combines cosine similarity (from existing validation utility) with ILIKE text fallback for semantic search without requiring an active embedding pipeline
- SQL migrations 034 and 035 creating agents_v2, agent_teams, agent_action_log, and agent_memory tables with proper indexes and FK constraints

## Task Commits

Each task was committed atomically:

1. **Task 1: StandardAgent types + SQL migrations** - `3b36319e` (feat)
2. **Task 2: AgentStore, TeamStore, AgentMemoryStore** - `5c098e51` (feat)

**Plan metadata:** (assigned after final commit — see docs commit below)

## Files Created/Modified

- `backend/src/agents/standard-agent.ts` - StandardAgent interface, AgentSkill, MemoryEntry, EpisodeSummary, toStandardAgent() helper
- `backend/src/agents/agent-store.ts` - PostgreSQL CRUD for StandardAgent with upsert, health tracking, action log
- `backend/src/agents/team-store.ts` - PostgreSQL CRUD for AgentTeam
- `backend/src/agents/agent-memory-store.ts` - Per-agent memory with embedding-based recall and ILIKE fallback
- `backend/src/db/migrations/034-agent-tables.sql` - agents_v2, agent_teams, agent_action_log tables
- `backend/src/db/migrations/035-agent-memory.sql` - agent_memory table with FK cascade and composite indexes

## Decisions Made

- Extended AgentManifest rather than replacing it so all existing code (registry.ts, agent routes) remains unbroken
- Health metrics stored as typed NUMERIC columns alongside the JSONB blob — enables efficient queries without JSON unpacking
- Embeddings never generated inside the store layer — callers pass pre-computed embeddings, keeping the store decoupled from any OpenAI/Ollama dependency
- recall() ILIKE fallback allows memory retrieval to work immediately without an embedding pipeline wired up
- ON DELETE CASCADE on agent_memory FK ensures agent deletion cascades to memory cleanup automatically

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

5 pre-existing TSC errors exist in `src/api/design.ts` and `src/wargaming/wargaming-engine.ts` referencing missing module files (`problem-framing.js`, `loe-gap-analysis.js`, `narrative-synthesis.js`, `effect-cascader.js`, `escalation-modeler.js`). These are out-of-scope pre-existing failures not caused by this plan. All 6 new files introduced zero TypeScript errors (confirmed with targeted tsc check).

## User Setup Required

None — no external service configuration required.

DB migrations (034, 035) must be run on production/staging DB after deploy per project convention (not run locally).

## Next Phase Readiness

- StandardAgent type system ready for Plan 02 (executor) and Plan 03 (Ironclaw)
- All three stores ready to be wired into agent routes and executor
- SQL migrations ready to deploy — both sequential (034, 035) after existing 033

---
*Phase: 51-unified-agent-architecture*
*Completed: 2026-03-18*
