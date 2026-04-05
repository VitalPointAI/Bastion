# Phase 66: Ironclaw Memory Evolution, Concept Learning & Reinforcement - Research

**Researched:** 2026-04-05
**Domain:** PostgreSQL pgvector, semantic embeddings, LLM extraction pipelines, autonomous feedback loops
**Confidence:** HIGH (all key architectural facts verified against codebase)

---

## Summary

Phase 66 builds a learning loop on top of Phase 57's persistent memory and Phase 65's autonomous operations. The infrastructure is already well-positioned: the `ironclaw-postgres` container already runs `pgvector/pgvector:pg16` (confirmed in docker-compose.yml), making the `vector(1536)` column for `ironclaw_concepts` possible without any infrastructure change. The main Bastion postgres uses `timescale/timescaledb:latest-pg16` which does NOT include pgvector — the concept store must live in the main Bastion DB (`coalition_ops`) where all other Ironclaw tables currently reside, OR it must live in ironclaw-postgres. This is the single most important architectural decision this phase must settle before schema design.

The embedding story is clear: the project already uses `OpenAIEmbeddings` from `@langchain/openai` (text-embedding-3-large in entity-linker, text-embedding-3-small in determinism-scorer). However, there is no `OPENAI_API_KEY` in the backend `.env` — the project relies on Anthropic OAuth via `~/.claude/.credentials.json` for LLM calls. Embedding generation will either require an OpenAI API key to be provisioned, or an alternative embedding approach (Anthropic does not offer a standalone embeddings API).

Thread lifecycle tracking exists (`ironclaw_threads`, `ironclaw_chat.thread_id`), and `deleteThread()` already deletes messages — the post-conversation extraction trigger can hook into this pattern. The extraction idle-timer (5-minute no-message signal) is **not currently implemented** anywhere in the frontend or backend and must be built.

**Primary recommendation:** Store `ironclaw_concepts` in the main `coalition_ops` Postgres (like all other Ironclaw tables) and add pgvector extension via migration. The main DB is TimescaleDB-pg16 — pgvector is installable as an extension on any PostgreSQL 14+ instance, but must be verified available in the `timescale/timescaledb:latest-pg16` Docker image before committing to this approach. The alternative is to store concepts in `ironclaw-postgres` (already has pgvector) and query it via the `DATABASE_URL_IRONCLAW` pool already set up in `ironclaw-client.ts`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` (node-postgres) | ^8.20.0 | Database CRUD for concepts table | Already project standard — all stores use `getPool()` pattern [VERIFIED: backend/package.json] |
| `pgvector` (npm) | 0.2.1 | Register vector type with pg driver, enable `<=>` cosine operator in queries | Lightweight adapter; project needs this to use pgvector columns from Node [VERIFIED: npm registry] |
| `@langchain/openai` | ^1.3.1 | `OpenAIEmbeddings` for text-embedding-3-large | Already installed; used in entity-linker and determinism-scorer [VERIFIED: backend/package.json] |
| `openai` | ^6.33.0 | Direct OpenAI SDK for batched embedding calls | Already installed; used in embedding-matcher.ts [VERIFIED: backend/package.json] |
| `@anthropic-ai/sdk` | ^0.80.0 | Haiku calls for extraction and consolidation LLM passes | Already installed; used throughout project [VERIFIED: backend/package.json] |
| `vitest` | ^4.1.2 | Test framework | Already project standard (`npm test` = `vitest run`) [VERIFIED: backend/package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pgvector/pgvector:pg16` Docker image | latest | PostgreSQL 16 with pgvector pre-installed | `ironclaw-postgres` already runs this; if concept store goes there, no new infra needed [VERIFIED: docker-compose.yml] |
| `timescale/timescaledb:latest-pg16` | latest | Main Bastion DB | Does NOT include pgvector by default — requires `CREATE EXTENSION vector` after installing the extension binary [ASSUMED] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| OpenAI text-embedding-3-large | text-embedding-3-small | 3-small is cheaper (~5x), dims=1536 configurable, sufficient for concept-level semantic search |
| OpenAI embeddings | Anthropic + hash-based matching | Anthropic has no embeddings API — would require a totally different retrieval approach |
| pgvector in coalition_ops | Store in ironclaw-postgres | ironclaw-postgres already has pgvector; tradeoff is access via second pool vs same getPool() |

**Installation (if adding pgvector npm package):**
```bash
cd backend && npm install pgvector
```

**Embedding API key gap:** No `OPENAI_API_KEY` is present in `backend/.env` or `backend/.env.example`. The existing uses of `OpenAIEmbeddings` in entity-linker and determinism-scorer likely fail silently in dev (no OPENAI_API_KEY configured). Plan 66-01 Wave 0 must address provisioning an OpenAI key or choosing an alternative embedding approach.

---

## Architecture Patterns

### Recommended Project Structure

New files for Phase 66 follow existing ironclaw module conventions:

```
backend/src/ironclaw/
├── concept-store.ts          # CRUD, version chain, semantic search (Plan 66-01)
├── concept-types.ts          # ConceptType enum, interfaces (Plan 66-01)
├── concept-extraction.ts     # LLM extraction pass (Plan 66-02)
├── concept-retrieval.ts      # Semantic search + [LEARNED CONTEXT] assembly (Plan 66-03)
├── concept-consolidation.ts  # Cross-thread merge job (Plan 66-04)
└── commander-directive-store.ts  # Priorities/directives panel (Plan 66-09)

backend/src/db/migrations/
└── 052-ironclaw-concepts.sql  # ironclaw_concepts + pgvector extension (Plan 66-01)

frontend/src/components/ironclaw/
├── IronclawConceptsPanel.tsx  # "What Ironclaw Knows" dashboard (Plan 66-06)
└── IronclawDirectivesPanel.tsx  # Commander priorities panel (Plan 66-09)
```

### Pattern 1: Store in coalition_ops via Migration (Recommended Path A)

**What:** Add pgvector extension and `ironclaw_concepts` table to the main coalition_ops DB via migration 052.

**When to use:** When the concept store needs to join or cross-reference other Bastion data (e.g., link concepts to problem_set_id that exists in coalition_ops). Keeps all Ironclaw data in one pool.

**Migration example:**
```sql
-- Migration 052: ironclaw_concepts versioned concept store (Phase 66)
-- Requires: pgvector extension available in PostgreSQL image

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE ironclaw_concept_type AS ENUM (
  'actor', 'situation', 'assessment', 'preference',
  'lesson', 'intent', 'relationship', 'directive'
);

CREATE TABLE IF NOT EXISTS ironclaw_concepts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_set_id  TEXT,                     -- null = global
  user_did        TEXT NOT NULL,
  concept_key     TEXT NOT NULL,
  concept_type    ironclaw_concept_type NOT NULL,
  current_value   JSONB NOT NULL,
  confidence      NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  source_thread_id TEXT,                    -- thread that produced this version
  version         INT NOT NULL DEFAULT 1,
  supersedes_id   UUID REFERENCES ironclaw_concepts(id),
  status          TEXT NOT NULL DEFAULT 'active', -- active | retracted | superseded
  embedding       vector(1536),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  UNIQUE (problem_set_id, user_did, concept_key, version)
);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_ironclaw_concepts_embedding
  ON ironclaw_concepts USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_ironclaw_concepts_lookup
  ON ironclaw_concepts (user_did, problem_set_id, concept_key, status);
```

**CRITICAL RISK:** The `timescale/timescaledb:latest-pg16` image may not have the pgvector shared library (`vector.so`) installed. If not present, `CREATE EXTENSION vector` fails at migration time. Must verify before committing to Path A. [ASSUMED — requires runtime test against the TimescaleDB image]

### Pattern 2: Store in ironclaw-postgres (Path B)

**What:** Create `ironclaw_concepts` in the `ironclaw-postgres` DB (already `pgvector/pgvector:pg16`). Access via the `DATABASE_URL_IRONCLAW` pool already wired in `ironclaw-client.ts`.

**When to use:** If pgvector is not available in TimescaleDB image, or to keep Ironclaw's learning state isolated like its routines.

**Access pattern already exists in codebase:**
```typescript
// Source: backend/src/ironclaw/routine-service.ts (getIronclawPool pattern)
function getIronclawPool(): pg.Pool {
  const url = process.env.DATABASE_URL_IRONCLAW ?? process.env.IRONCLAW_DB_URL;
  if (!url) throw new Error('DATABASE_URL_IRONCLAW not set');
  ironclawPool = new pg.Pool({ connectionString: url, max: 3 });
  return ironclawPool;
}
```

### Pattern 3: Embedding Generation (Existing Project Pattern)

**What:** Use OpenAI `text-embedding-3-large` (3072 dims, but truncatable to 1536) or `text-embedding-3-small` (1536 dims fixed) via `openai` SDK.

**Existing pattern from `embedding-matcher.ts`:**
```typescript
// Source: backend/src/graph/resolution/embedding-matcher.ts
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
  });
  return response.data[0].embedding;
}
```

**Note:** This pattern requires `OPENAI_API_KEY`. The project does not currently have this key configured in backend `.env`. For Phase 66, use `text-embedding-3-small` (fixed 1536 dims matching the `vector(1536)` column) and add OPENAI_API_KEY to `.env` and docker-compose.

### Pattern 4: assembleMemoryBlock Extension (Existing Integration Point)

**What:** `MemoryRetrievalService.assembleMemoryBlock()` in `ironclaw-memory-service.ts` is the single injection point for context into every Ironclaw message. Phase 66 extends this to add a `[LEARNED CONTEXT]` block.

**Current call site:**
```typescript
// Source: backend/src/ironclaw/ironclaw-service.ts line 360
const [memoryBlock, kgContextBlock, skillBlock] = await Promise.all([
  memoryRetrievalService.assembleMemoryBlock(userDid, problemSetId),
  kgContextService.getContextForMessage(problemSetId, content),
  this._assembleSkillInventory(),
]);
```

**Phase 66 extension approach:**
```typescript
// Extend assembleMemoryBlock to accept content string for semantic search
// Returns '' on timeout (200ms currently, extend to 400ms per DESIGN.md)
const [memoryBlock, kgContextBlock, skillBlock, conceptBlock] = await Promise.all([
  memoryRetrievalService.assembleMemoryBlock(userDid, problemSetId),
  kgContextService.getContextForMessage(problemSetId, content),
  this._assembleSkillInventory(),
  conceptRetrievalService.getLearnedContextBlock(userDid, problemSetId, content, 400),
]);
```

### Pattern 5: Thread Deletion Hook (Existing Integration Point)

**What:** `deleteThread()` in `ironclaw-store.ts` (line 365) is the current delete handler. It only deletes chat messages and the thread record. Phase 66 must extend it to trigger concept retraction.

**Current implementation:**
```typescript
// Source: backend/src/ironclaw/ironclaw-store.ts line 365
async deleteThread(threadId: string): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM ironclaw_chat WHERE thread_id = $1', [threadId]);
  await pool.query('DELETE FROM ironclaw_threads WHERE id = $1', [threadId]);
}
```

**Extension:** After deletion, call `conceptStore.retractByThread(threadId)` to mark associated concepts as `retracted` per DESIGN.md logic.

### Pattern 6: Routine Service Pattern (Cross-Thread Consolidation Job)

**What:** Phase 65 established the pattern for scheduled work via `routine-service.ts` writing to Ironclaw's `routines` table. Phase 66's consolidation job follows a different pattern — it's a pure backend Node.js job, not an Ironclaw LLM job.

**Recommended:** Use `setInterval` on backend startup for the 6-hour consolidation job, similar to how the project handles memory cleanup in `ironclaw-memory-cleanup.ts`.

### Anti-Patterns to Avoid

- **Storing embeddings as JSONB:** Migration 035 (`agent_memory`) stored embeddings as `JSONB` — this prevents pgvector's `<=>` cosine operator and HNSW indexing. Always use `vector(N)` column type for semantic search.
- **Re-embedding on every read:** Cache concept embeddings — only re-embed when `current_value` changes (new version). The embedding is per-version, not per-query.
- **Blocking message flow on extraction:** Post-conversation extraction must be fire-and-forget. Never `await` extraction in the message path.
- **Writing concepts to ironclaw-postgres without checking pool availability:** Always guard with `DATABASE_URL_IRONCLAW` check before getting pool, same pattern as `routine-service.ts` line 134.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vector similarity search | Custom cosine similarity in app layer | pgvector `<=>` operator + HNSW index | In-DB search is 100x faster at scale; project already has custom `cosineSimilarity()` for in-memory use but it can't handle indexed search over thousands of records |
| Embedding generation | Custom HTTP client to OpenAI | `openai` SDK already installed + project pattern in embedding-matcher.ts | SDK handles batching, retries, and error handling |
| LLM extraction pass | Custom prompt management | Use `@anthropic-ai/sdk` Haiku calls following existing project pattern | Already wired for OAuth auth; Haiku is appropriate cost/quality |
| Concept version chain queries | Recursive application-layer traversal | SQL CTE with `supersedes_id` FK | Recursive CTEs are the right tool for linked-list version chains |
| Rate limiting extraction | Custom window counters | Leverage existing circuit-breaker pattern from `autonomous-activity-store.ts` (`getCountSince()`) | `getCountSince()` already counts activity in a time window |

---

## Runtime State Inventory

This is a greenfield capability (no existing concept store to migrate). However, Phase 66 extends existing tables:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `ironclaw_user_memory` (phase 57): key-value, no versioning — not migrated to concepts, runs in parallel | None — existing memories remain; concepts are additive |
| Stored data | `ironclaw_context_memory` (phase 57): problem-set-scoped key-value — same, runs in parallel | None |
| Stored data | `ironclaw_autonomous_activity` (phase 65): needs `outcome_status`, `commander_rating`, `commander_notes` columns added | ALTER TABLE migration (Plan 66-07) |
| Live service config | Ironclaw `routines` table in ironclaw-postgres: consolidation job is a backend Node.js timer, NOT a routine | None — consolidation is backend-managed |
| OS-registered state | None found | None |
| Secrets/env vars | `OPENAI_API_KEY` — not currently in backend `.env` or docker-compose; needed for embedding generation | Add to `.env`, `docker-compose.yml`, `docker-compose.prod.yml` (Plan 66-01 Wave 0) |
| Build artifacts | None | None |

---

## Common Pitfalls

### Pitfall 1: pgvector Not Available in TimescaleDB Image

**What goes wrong:** `CREATE EXTENSION vector` fails at migration time with "could not open extension control file" because the vector.so binary is not in the TimescaleDB image.

**Why it happens:** `timescale/timescaledb:latest-pg16` is a PostgreSQL extension layer; it does not bundle pgvector. The `pgvector/pgvector:pg16` image (used by ironclaw-postgres) explicitly includes it.

**How to avoid:** Before writing migration 052, run `docker exec bastion-postgres psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>&1` to verify the extension is available. If it fails, use Path B (ironclaw-postgres).

**Warning signs:** Migration 052 fails on first run; `pg_available_extensions` query on coalition_ops shows no `vector` entry.

### Pitfall 2: OPENAI_API_KEY Not Configured

**What goes wrong:** Embedding generation silently returns zero vectors (the fallback in `embedding-matcher.ts` line 78), causing all cosine similarities to return 0 and semantic search to fail completely.

**Why it happens:** The project uses Anthropic OAuth as primary LLM provider. OpenAI API key is only needed for embeddings. The key was never added to the dev environment.

**How to avoid:** Add `OPENAI_API_KEY=` to `.env.example`, `backend/.env`, and both docker-compose files as a required variable with clear comment. Wave 0 must fail fast if key is absent.

**Warning signs:** All semantic searches return top-K random results; concept retrieval returns irrelevant concepts regardless of query.

### Pitfall 3: Extraction Firing on Every Thread Switch

**What goes wrong:** The extraction trigger fires too frequently — e.g., on every tab switch (which creates new tab-scoped threads), generating 20+ extraction calls per session.

**Why it happens:** Tab threads are auto-created on every `useEffect([problemSetId, currentTab])` in `useIronclaw.ts` line 430. These threads frequently have 0-2 messages.

**How to avoid:** Apply the "3+ substantive messages" filter from DESIGN.md before any extraction. Track extraction state by thread_id to prevent double-extraction. The idle timer must only start after a real user message, not on tab thread creation.

**Warning signs:** `ironclaw_concepts` table grows rapidly with trivial/empty concepts; extraction cost spikes.

### Pitfall 4: Concept Embedding Dimension Mismatch

**What goes wrong:** Embedding stored as `vector(1536)` but generation uses `text-embedding-3-large` without dimension reduction returns 3072-dim vectors — pgvector rejects the INSERT.

**Why it happens:** `text-embedding-3-large` defaults to 3072 dimensions; `text-embedding-3-small` is always 1536.

**How to avoid:** Either use `text-embedding-3-small` (recommended — matches column size) OR pass `dimensions: 1536` parameter to the large model's API call. The column definition and embedding model must agree.

### Pitfall 5: Thread ID vs Problem-Set Scope Confusion

**What goes wrong:** Concepts extracted from tab-scoped threads (e.g., `tab:cop`, `tab:design`) are associated with `source_thread_id` but the tab thread ID changes on each problem set switch, making retraction by thread_id unreliable.

**Why it happens:** `getOrCreateTabThread()` creates a new thread per tab per problem set, but the thread names follow a deterministic `tab:${tabName}` pattern — the UUIDs differ across sessions.

**How to avoid:** When extracting from tab threads, set `source_thread_id` to the thread UUID (not the name). When a tab thread is deleted, concepts are retracted by that UUID. The tab-name pattern does not affect UUID-based retraction.

---

## Code Examples

### Semantic Search Query (pgvector)

```sql
-- Source: pgvector documentation pattern [CITED: github.com/pgvector/pgvector]
-- Find top-5 concepts most similar to query embedding, active versions only
SELECT id, concept_key, concept_type, current_value, confidence,
       1 - (embedding <=> $1) AS similarity
FROM ironclaw_concepts
WHERE user_did = $2
  AND (problem_set_id = $3 OR problem_set_id IS NULL)
  AND status = 'active'
ORDER BY embedding <=> $1
LIMIT 5;
-- $1 = query embedding as vector(1536)
-- $2 = user_did
-- $3 = current problem_set_id
```

### Registering pgvector Type with pg Driver

```typescript
// Source: pgvector npm package pattern [CITED: npmjs.com/package/pgvector]
// Must be called once before using vector columns
import pgvector from 'pgvector/pg';
// In store constructor or ensureTable():
const pool = getPool();
await pgvector.registerTypes(pool);
```

### Version Chain Upsert (Concept Write)

```typescript
// Insert new version, marking previous as superseded
// Source: DESIGN.md architecture + standard SQL pattern [ASSUMED pattern — not yet in codebase]
async function upsertConcept(entry: ConceptUpsertInput): Promise<ConceptEntry> {
  const pool = getPool();
  
  // Find current latest version
  const existing = await pool.query(
    `SELECT id, version FROM ironclaw_concepts
     WHERE user_did = $1 AND concept_key = $2
       AND (problem_set_id = $3 OR (problem_set_id IS NULL AND $3 IS NULL))
       AND status = 'active'
     ORDER BY version DESC LIMIT 1`,
    [entry.userDid, entry.conceptKey, entry.problemSetId],
  );
  
  const nextVersion = existing.rows.length > 0 ? (existing.rows[0].version as number) + 1 : 1;
  const supersedesId = existing.rows.length > 0 ? (existing.rows[0].id as string) : null;
  
  // Mark prior as superseded
  if (supersedesId) {
    await pool.query(
      `UPDATE ironclaw_concepts SET status = 'superseded' WHERE id = $1`,
      [supersedesId],
    );
  }
  
  // Insert new version
  const result = await pool.query(
    `INSERT INTO ironclaw_concepts
       (problem_set_id, user_did, concept_key, concept_type, current_value,
        confidence, source_thread_id, version, supersedes_id, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [entry.problemSetId, entry.userDid, entry.conceptKey, entry.conceptType,
     JSON.stringify(entry.value), entry.confidence, entry.sourceThreadId,
     nextVersion, supersedesId, entry.embedding],
  );
  return rowToConceptEntry(result.rows[0]);
}
```

### Haiku Extraction Call Pattern

```typescript
// Source: existing Anthropic SDK usage in project [VERIFIED: llm-factory.ts pattern]
import Anthropic from '@anthropic-ai/sdk';

async function extractConcepts(messages: {role: string, content: string}[]): Promise<ConceptDraft[]> {
  const client = new Anthropic({ authToken: getOAuthToken() });
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',  // Same model as Ironclaw's own LLM backend
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: EXTRACTION_PROMPT + JSON.stringify(messages),
    }],
  });
  const text = (response.content[0] as {text: string}).text;
  return JSON.parse(text) as ConceptDraft[];
}
```

---

## Existing Infrastructure Verified

### ironclaw_concepts Will Live in coalition_ops (or ironclaw-postgres)

**Main postgres (`coalition_ops`):** All existing Ironclaw tables are here — `ironclaw_user_memory`, `ironclaw_context_memory`, `ironclaw_autonomous_activity`, `ironclaw_threads`, `ironclaw_chat`, `ironclaw_sessions`. The existing `getPool()` singleton in `ironclaw-memory-store.ts` and `autonomous-activity-store.ts` connects to coalition_ops. [VERIFIED: codebase inspection]

**Ironclaw postgres (`ironclaw`):** Used only for Ironclaw's own runtime state (routines, agent state). Accessible from backend via `DATABASE_URL_IRONCLAW` pool in `ironclaw-client.ts` and `routine-service.ts`. Already runs pgvector/pgvector:pg16. [VERIFIED: docker-compose.yml]

**Decision needed:** Which DB hosts `ironclaw_concepts`? Recommendation: coalition_ops (Path A), but verify pgvector availability first.

### Thread Deletion — Current State

`ironclawStore.deleteThread(threadId)` in `ironclaw-store.ts` line 365 deletes from `ironclaw_chat` and `ironclaw_threads`. The router calls this at `DELETE /:problemSetId/threads/:threadId`. Phase 66 must add concept retraction here. [VERIFIED: codebase inspection]

### Post-Conversation Trigger — Not Yet Built

No idle timer or thread-close detection exists in the frontend. `useIronclaw.ts` closes the WebSocket on drawer close (`closeDrawer()` line 348) but does not fire any extraction event. The frontend `selectThread()` at line 462 switches threads but fires no extraction. All three trigger mechanisms (idle timeout, thread switch, session end) must be built from scratch in Plan 66-02. [VERIFIED: codebase inspection]

### Activity Table Extension Points

`ironclaw_autonomous_activity` schema (from `autonomous-activity-store.ts` ensureTable):
- Current columns: `id, problem_set_id, activity_type, severity, summary, detail (JSONB), decision_id, created_at`
- Missing (Plan 66-07): `outcome_status TEXT DEFAULT 'pending'`, `commander_rating SMALLINT` (nullable, 1-5 or -1/0/1 thumbs), `commander_notes TEXT` (nullable)
- The `rowToEntry()` mapper and `ActivityEntry` interface in `autonomous-activity-store.ts` must be updated [VERIFIED: codebase inspection]

### Embedding Dimension Alignment

Ironclaw's own postgres instance (`ironclaw-postgres`) uses `pgvector/pgvector:pg16` which supports up to 16,000 dimensions. The design specifies `vector(1536)`. Use `text-embedding-3-small` (1536 dims natively) to match without needing dimension reduction. [VERIFIED: docker-compose.yml + npm registry]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| RAG over all memories (no versioning) | Versioned concept store with pgvector HNSW index | Phase 66 introduces | Enables "how did our understanding of X evolve?" queries |
| Simple key-value memory (Phase 57) | Versioned semantic concept store | Phase 66 introduces | Knowledge persists across conversations with provenance |
| JSONB embedding storage (agent_memory, migration 035) | Native `vector(N)` column type with HNSW index | Phase 66 introduces | Enables O(log n) ANN search instead of full-table cosine scan |
| Flat interaction outcomes | Rated outcomes + decision path memory | Phase 66 introduces | Enables reinforcement: Ironclaw learns which actions produce results |

**Deprecated/outdated:**
- JSONB embedding storage in `agent_memory` (migration 035): stores embeddings as JSONB strings — works for small datasets but cannot use pgvector `<=>` operator or HNSW index. Phase 66 must use native `vector(N)` type.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pgvector extension (coalition_ops) | 66-01 concept schema | Unknown | — | Use ironclaw-postgres (already has pgvector) |
| pgvector extension (ironclaw-postgres) | 66-01 (Path B) | YES | pg16 | — |
| `openai` npm package | Embedding generation | YES | ^6.33.0 | — |
| `@langchain/openai` npm package | OpenAIEmbeddings | YES | ^1.3.1 | — |
| `pgvector` npm package | Register vector type with pg driver | NOT INSTALLED | 0.2.1 available | Use raw SQL casting as fallback |
| OPENAI_API_KEY | text-embedding-3-small calls | NOT CONFIGURED | — | Must provision before Plan 66-03 |
| Ironclaw sidecar memory management API | Plan 66-05 sidecar sync | UNKNOWN | Ironclaw v0.24.0 | REPL FIFO commands via webhook (existing pattern) |

**Missing dependencies with no fallback:**
- `OPENAI_API_KEY` — without this, embedding generation cannot proceed. Must be added to environment before Plan 66-03.

**Missing dependencies with fallback:**
- pgvector in coalition_ops — if not available, use ironclaw-postgres (Path B)
- `pgvector` npm package — can use raw SQL with `::vector` cast as fallback, though npm package is cleaner

---

## Validation Architecture

Vitest is the test framework (`npm test` = `vitest run`). No config file found — vitest uses defaults with `*.test.ts` pattern.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.2 |
| Config file | none — uses defaults (finds `*.test.ts` files) |
| Quick run command | `cd backend && npm test -- --testPathPattern ironclaw-concept` |
| Full suite command | `cd backend && npm test` |

### Phase Requirements to Test Map

| Behavior | Test Type | Notes |
|----------|-----------|-------|
| Concept version chain: upsert creates new version, marks prior superseded | unit | concept-store.test.ts |
| Thread deletion retracts source concepts without destroying successors | unit | concept-store.test.ts |
| Semantic search returns most similar concepts | unit | Mock embedding, verify ordering |
| Extraction LLM pass parses JSON array correctly | unit | Mock Haiku call, verify concept draft parsing |
| Rate limiting: max 10 extractions/hour enforced | unit | concept-extraction.test.ts |
| Activity entry update: rating stored, not overwrites | unit | autonomous-activity-store.test.ts |

### Wave 0 Gaps

- [ ] `backend/src/ironclaw/concept-store.test.ts` — unit tests for CRUD and version chains
- [ ] `backend/src/ironclaw/concept-extraction.test.ts` — extraction pipeline tests
- [ ] `OPENAI_API_KEY` must be set for integration tests; unit tests must mock embedding generation

---

## Security Domain

`security_enforcement` not found in config.json — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Concepts scoped to `user_did` — same auth as existing Ironclaw endpoints |
| V3 Session Management | no | No new session management |
| V4 Access Control | yes | Concepts must be user-scoped: all queries MUST include `user_did` in WHERE clause (same enforcement as `ironclaw_user_memory` — pattern already established) |
| V5 Input Validation | yes | `concept_key` (user-controlled in extraction) must be validated/sanitized; max length enforced; no SQL injection via parameterized queries |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Concept key injection (LLM-extracted keys used in SQL) | Tampering | Parameterized queries only; validate concept_key format (alphanumeric + colon + underscore) |
| Cross-user concept leak | Information Disclosure | All concept queries MUST include `user_did = $N` in WHERE clause; test for this explicitly |
| Concept extraction prompt injection via thread content | Tampering | LLM extraction is an internal backend call; concept values are stored as-is but never eval'd |
| Commander rating manipulation via API | Tampering | Rating endpoint must verify `user_did` matches activity's problem set member before allowing update |

---

## Open Questions (RESOLVED)

1. **pgvector in TimescaleDB image?**
   - What we know: Main Bastion postgres uses `timescale/timescaledb:latest-pg16`; ironclaw-postgres uses `pgvector/pgvector:pg16`
   - What's unclear: Whether pgvector is bundled in the TimescaleDB Docker image
   - Recommendation: Test `CREATE EXTENSION vector` against coalition_ops in Wave 0 of Plan 66-01. If it fails, proceed with Path B (ironclaw-postgres). **This is the critical blocker for Plan 66-01.**
   - **RESOLVED:** D-01 decided to use ironclaw-postgres (Path B). No pgvector in TimescaleDB needed.

2. **Ironclaw sidecar `/memory forget` command availability**
   - What we know: REPL FIFO commands are used for `/mcp add` (via `sendMessage`); sidecar is v0.24.0
   - What's unclear: Whether Ironclaw v0.24.0 supports memory management REPL commands like `/memory forget <thread_id>`
   - Recommendation: Plan 66-05 begins with investigation: send a test `/memory` command via webhook and observe response. If not supported, use REPL FIFO pattern (same as `/mcp add`) or fall back to no-op with a warning.
   - **RESOLVED:** Plan 07 implements runtime probe with graceful fallback (`checkSidecarMemorySupport()`).

3. **OpenAI API key provisioning strategy**
   - What we know: No OPENAI_API_KEY exists; existing embedding uses in entity-linker and embedding-matcher likely fail silently
   - What's unclear: Whether project wants to add OpenAI billing or find an alternative
   - Recommendation: Add OPENAI_API_KEY as a required env var with documentation in `.env.example`. Consider `text-embedding-3-small` at $0.02/1M tokens — very low cost for this use case.
   - **RESOLVED:** Plan 01 adds OPENAI_API_KEY to docker-compose.yml with `user_setup` guidance.

4. **Commander rating UX: thumbs up/down vs 1-5 stars**
   - What we know: DESIGN.md says "thumbs up/down + optional notes"
   - What's unclear: What integer encoding to use in the column
   - Recommendation: Use `SMALLINT` with values: 1 (positive), 0 (neutral/no rating), -1 (negative). Maps cleanly to thumbs UI and allows SQL aggregations.
   - **RESOLVED:** D-06 decided thumbs up/down with optional comment. SMALLINT encoding: 1 (positive), -1 (negative), null (unrated).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TimescaleDB image does not include pgvector by default | Architecture Patterns (Pitfall 1) | If wrong, Path A works without issue and no architectural choice needed |
| A2 | Ironclaw v0.24.0 does not expose a `/memory forget` REST endpoint | Open Questions | If wrong, Plan 66-05 sidecar sync becomes a REST call instead of REPL |
| A3 | `text-embedding-3-small` produces semantically sufficient results for concept retrieval | Standard Stack | If wrong, switch to `text-embedding-3-large` with `dimensions: 1536` parameter |
| A4 | OpenAI embeddings are the required approach (vs local model) | Standard Stack | If project policy changes to self-hosted models (e.g., nomic-embed via Ollama), embedding infrastructure changes significantly |

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection: `backend/src/ironclaw/*.ts` — all existing Ironclaw service patterns verified directly
- `docker-compose.yml` — image configuration for both postgres instances verified
- `backend/src/db/migrations/044-045.sql` — Phase 57 memory schema verified
- `backend/src/ironclaw/autonomous-activity-store.ts` — Phase 65 activity table schema verified
- `backend/package.json` — all npm dependency versions verified

### Secondary (MEDIUM confidence)

- pgvector project documentation [CITED: github.com/pgvector/pgvector] — HNSW index syntax
- npm registry for pgvector@0.2.1 — current version, MIT license, no dependencies
- DESIGN.md — phase architecture and design decisions (authored by project owner)

### Tertiary (LOW confidence)

- Claim that timescale/timescaledb does not include pgvector — based on understanding of Docker image layering, not confirmed by inspecting the image [ASSUMED]
- Ironclaw v0.24.0 memory management CLI capability — no documentation available for this specific version [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json; versions confirmed via npm registry
- Architecture: HIGH — all integration points (assembleMemoryBlock, deleteThread, getIronclawPool) verified in codebase
- Pitfalls: MEDIUM — pgvector/TimescaleDB pitfall is assumed, not proven; embedding key gap is verified
- Sidecar sync: LOW — Ironclaw v0.24.0 memory API capabilities are unknown; must investigate in Plan 66-05

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable infrastructure, 30-day validity)
