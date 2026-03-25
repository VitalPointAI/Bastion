# Phase 57: Ironclaw Persistent Memory & Adaptive Relationship — Research

**Researched:** 2026-03-25
**Domain:** AI agent memory, PostgreSQL persistence, system prompt engineering, behavioral adaptation
**Confidence:** HIGH (based on direct codebase inspection + well-understood patterns)

---

## Summary

Phase 57 transforms Ironclaw from a stateless webhook-per-message AI assistant into a persistent, learning staff officer. The system must track two orthogonal memory scopes: per-user preferences (portable across problem sets) and per-problem-set context (scoped to a single planning engagement). Both scopes feed into every Ironclaw interaction via system prompt injection.

The existing project already has a solid foundation: `agent_memory` table (migration 035), `AgentMemoryStore` with cosine similarity recall, `ironclaw_trust_preferences` with TTL, `ironclaw_sessions` keyed by `(problem_set_id, user_did)`, and the `buildSystemPrompt()` hook in `IronclawService`. The gap is that none of these are wired together for Ironclaw's own learning — `AgentMemoryStore` is for specialist agents, not for Ironclaw self-reflection. Phase 57 builds a dedicated Ironclaw memory subsystem on top of the same PostgreSQL pool using established `getPool()` patterns.

The adaptive behavior engine is the most complex piece: it must observe interaction outcomes (suggestions accepted/rejected, edit patterns, correction frequency) and write durable preference records that modulate Ironclaw's system prompt on the next request. This is pure PostgreSQL + TypeScript — no new dependencies are needed. The frontend needs a "My Ironclaw Memory" management panel so users can review, edit, and delete what Ironclaw knows about them.

**Primary recommendation:** Build two new stores (`IronclawUserMemoryStore` and `IronclawContextMemoryStore`) following the exact patterns of `IronclawStore` (getPool, row mappers, singleton export), two new migration files, a `MemoryRetrievalService` that assembles memory blocks for system prompt injection, and wire the injection into `handleMessage()` / `buildSystemPrompt()`. Add a frontend management route.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | ^8.16.3 | PostgreSQL queries | Already in use via `getPool()` throughout backend |
| `@langchain/core` | ^1.1.15 | Tool/skill invocation | Already powers all Ironclaw skills |
| `zod` | ^4.3.5 | Input validation | Project-wide validation standard |
| TypeScript | ^5.9.3 | All new files | Project-wide language |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `uuid` (built-in via `randomUUID`) | Node crypto | Memory entry IDs | Same as IronclawStore pattern |
| cosine-similarity utility | Already in repo | Semantic memory recall | `backend/src/validation/scoring/cosine-similarity.ts` — already used by AgentMemoryStore |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw PostgreSQL via `getPool()` | pgvector extension | pgvector not in current migration stack; cosine similarity already done in-process in AgentMemoryStore — consistent to keep that pattern |
| In-process behavior scoring | External ML pipeline | Overkill; simple preference counters in JSONB are sufficient for this phase |
| Separate Redis cache for hot memories | PostgreSQL only | No Redis in current stack; indexed PostgreSQL with limit 20 retrieval is fast enough |

**Installation:** No new dependencies needed. All tooling is already installed.

---

## Architecture Patterns

### Recommended Project Structure
```
backend/src/ironclaw/
├── ironclaw-memory-store.ts       # NEW: IronclawUserMemoryStore + IronclawContextMemoryStore
├── ironclaw-memory-types.ts       # NEW: type definitions for memory system
├── ironclaw-memory-service.ts     # NEW: MemoryRetrievalService (assembles system prompt blocks)
├── ironclaw-service.ts            # MODIFY: wire memory injection into handleMessage()
├── ironclaw-router.ts             # MODIFY: add /memory/* REST endpoints
├── ironclaw-store.ts              # UNCHANGED
├── ironclaw-types.ts              # MODIFY: add memory-related constants
...

backend/src/db/migrations/
├── 043-ironclaw-user-memory.sql   # NEW: ironclaw_user_memory table
├── 044-ironclaw-context-memory.sql # NEW: ironclaw_context_memory table

frontend/src/
├── components/ironclaw/
│   ├── IronclawMemoryPanel.tsx    # NEW: user-facing memory management UI
│   └── index.ts                   # MODIFY: export new component
├── lib/
│   └── ironclaw-service.ts        # MODIFY: add memory API methods
├── types/
│   └── ironclaw.ts                # MODIFY: add memory types
```

### Pattern 1: Dual-Table Memory Architecture

**What:** Two tables with distinct scoping, not one generic table with a scope discriminator.
**When to use:** Scopes have different TTLs, different query patterns, different privacy guarantees.

```typescript
// ironclaw_user_memory — portable, per-user
// PRIMARY KEY: (user_did, memory_key) for upsert semantics
// Stores: working_style, critique_tolerance, domain_strengths, communication_style
// TTL: 90 days (configurable), renewed on each update

// ironclaw_context_memory — problem-set scoped, contextual
// PRIMARY KEY: (problem_set_id, memory_key) for upsert semantics
// Stores: decisions_made, assumptions_status, discussion_threads, session_summaries
// TTL: 180 days (configurable), renewed on each update
```

### Pattern 2: Outcome Tracking via Interaction Events

**What:** Every Ironclaw suggestion accepted/rejected/overridden writes an outcome event. A lightweight aggregation query computes preference vectors on read.
**When to use:** Avoids expensive write-time aggregation; preference signals derived at retrieval time from raw events.

```typescript
// ironclaw_interaction_outcomes table
// Stores: user_did, problem_set_id, outcome_type, context, created_at
// outcome_type: 'suggestion_accepted' | 'suggestion_rejected' | 'correction_made'
//               | 'question_asked' | 'edit_post_critique'
// Aggregated queries: COUNT(*) GROUP BY outcome_type WHERE user_did = $1
```

### Pattern 3: System Prompt Memory Injection

**What:** `MemoryRetrievalService.assembleMemoryBlock(userDid, problemSetId)` returns a structured string injected at the top of every Ironclaw system prompt, BEFORE the current context-sensitive content.
**When to use:** Every `handleMessage()` call — both problem-set and global scoped.

```typescript
// IronclawService.buildSystemPrompt() — CURRENT
buildSystemPrompt(problemSetId: string): string { ... }

// AFTER Phase 57:
async buildSystemPrompt(problemSetId: string, userDid: string): Promise<string> {
  const memoryBlock = await memoryService.assembleMemoryBlock(userDid, problemSetId);
  return [
    memoryBlock,          // <-- injected first
    '## Chief of Staff Role',
    'You are the Chief of Staff for this problem set.',
    // ... rest of existing prompt
  ].join('\n');
}
```

### Pattern 4: Ironclaw Store Singleton Pattern (MUST follow)

All new stores must follow the existing pattern exactly:

```typescript
// Source: backend/src/ironclaw/ironclaw-store.ts lines 1-10, 100-106
import { getPool } from '../lib/database.js';

export class IronclawUserMemoryStore {
  async ensureTable(): Promise<void> {
    const pool = getPool();
    await pool.query(`CREATE TABLE IF NOT EXISTS ...`);
    // idempotent — safe at startup
  }
  // ...
}

export const ironclawUserMemoryStore = new IronclawUserMemoryStore();
```

### Pattern 5: Outcome-Driven Preference Computation

**What:** Rather than storing a computed preference field, store raw outcomes and derive the behavioral signal at retrieval time. This enables reweighting without data migration.
**When to use:** Proactivity level, critique frequency, draft-offer threshold.

```typescript
// Pseudo-query for critique tolerance:
const { rows } = await pool.query(
  `SELECT
     SUM(CASE WHEN outcome_type = 'edit_post_critique' THEN 1 ELSE 0 END)::float
       / NULLIF(COUNT(*), 0) as incorporate_rate,
     SUM(CASE WHEN outcome_type = 'suggestion_rejected' THEN 1 ELSE 0 END)::float
       / NULLIF(COUNT(*), 0) as rejection_rate
   FROM ironclaw_interaction_outcomes
   WHERE user_did = $1
   AND created_at > NOW() - INTERVAL '30 days'`,
  [userDid]
);
// If rejection_rate > 0.6 → reduce proactivity signal in system prompt
```

### Anti-Patterns to Avoid
- **Storing computed preference scores:** Derive from raw outcomes at read time — storing scores requires migrating on algorithm change
- **Blocking handleMessage() on heavy memory operations:** Wrap `assembleMemoryBlock()` with a 200ms timeout — fall back to no memory block if slow
- **Writing interaction outcomes synchronously in the hot path:** Use fire-and-forget (`.catch(err => console.error(...))` pattern used throughout IronclawService)
- **Leaking user_did across problem sets:** User memory is always queried by `user_did` only; context memory is always queried by `problem_set_id` only — never mix
- **Storing raw chat content in memory tables:** Store derived summaries/signals only, not verbatim message content (privacy + size)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cosine similarity for memory recall | Custom embedding distance | `cosineSimilarity()` at `backend/src/validation/scoring/cosine-similarity.ts` | Already in-process, tested, returns correct values |
| TTL/expiry | Cron job | PostgreSQL `WHERE expires_at > NOW()` query filter + `pg-boss` for periodic cleanup | pg-boss already installed, TTL pattern proven in `ironclaw_trust_preferences` |
| Session continuity | New session management | Existing `ironclaw_sessions` table keyed `(problem_set_id, user_did)` | Already tracks `last_active_at`, extend rather than replace |
| Background job queue | Custom worker | `pg-boss` already in the stack | Proven job queue, used in Phase 51 |
| Input validation | Custom validators | `zod` schemas, consistent with all other stores | Project standard |

**Key insight:** Everything needed exists. The work is connecting existing infrastructure (IronclawStore patterns, AgentMemoryStore recall logic, getPool(), pg-boss) into a new set of tables specific to Ironclaw's self-learning needs.

---

## Common Pitfalls

### Pitfall 1: Making `buildSystemPrompt()` Async Without Updating All Callers
**What goes wrong:** `buildSystemPrompt()` is currently sync and called in multiple places. Making it async without updating `handleMessage()`, `handleGlobalMessage()`, and `processResponse()` will cause silent drops.
**Why it happens:** TypeScript will compile even if you forget `await` in some callers.
**How to avoid:** Search all callers with `grep -r "buildSystemPrompt"` before changing the signature. If keeping sync is cleaner, have `MemoryRetrievalService` pre-fetch and pass the block as a parameter.
**Warning signs:** Empty system prompts in Ironclaw responses; memory not appearing in AI behavior.

### Pitfall 2: Memory Bloat in System Prompt
**What goes wrong:** Retrieving too many memory entries bloats the system prompt, increasing latency and token cost.
**Why it happens:** No limit on retrieval, or retrieving entire tables instead of top-N relevant entries.
**How to avoid:** Hard cap: user memory block <= 500 tokens (~400 chars); context memory block <= 800 tokens. Retrieve top-5 most important/recent entries per category. Include a character budget check before injection.
**Warning signs:** Ironclaw responses becoming slower; OpenAI/NEAR AI rate limit errors.

### Pitfall 3: Outcome Tracking Firing on Ironclaw's Own Messages
**What goes wrong:** Logging `suggestion_accepted` on every message instead of only when the user explicitly accepts a `SuggestionPayload`.
**Why it happens:** Confusing chat message flow with suggestion acceptance flow.
**How to avoid:** Outcome events should ONLY fire from: (1) the `POST /ironclaw/:problemSetId/confirm` action pipeline (accepted/denied), (2) the suggestion accept endpoint, (3) explicit user correction detection. Not from general chat messages.
**Warning signs:** Preference scores drifting meaninglessly; critique tolerance showing max even for new users.

### Pitfall 4: Privacy — Cross-User Memory Leakage
**What goes wrong:** Querying user memory by `problem_set_id` alone (instead of `user_did`) exposes one user's preferences to another.
**Why it happens:** Copy-paste error in store queries, or using the wrong column in WHERE clause.
**How to avoid:** `ironclaw_user_memory` table must have `user_did` in EVERY query's WHERE clause. Add a TypeScript type guard: `getUserMemory(userDid: string)` — no `problemSetId` parameter accepted.
**Warning signs:** User reports Ironclaw "knowing things" from other users' sessions.

### Pitfall 5: Outcome Recorder Fails Silently on High Traffic
**What goes wrong:** The fire-and-forget outcome recorder accumulates errors in logs but no one notices until preference signals are stale.
**Why it happens:** `catch(err => console.error(...))` swallows errors.
**How to avoid:** Use `pg-boss` to enqueue outcome records rather than direct DB writes in the hot path. Failed jobs are retried automatically.
**Warning signs:** interaction_outcomes table row count not growing despite active usage.

### Pitfall 6: Memory Lifecycle — Decay Without Cleanup
**What goes wrong:** Expired memories never deleted, table grows unboundedly.
**Why it happens:** TTL is checked at READ time (good) but nothing deletes old rows.
**How to avoid:** Register a `pg-boss` recurring job `ironclaw-memory-cleanup` that runs daily, deleting rows where `expires_at < NOW()`. Pattern established in Phase 51 gap-filler.
**Warning signs:** ironclaw_user_memory and ironclaw_context_memory tables growing without bound.

---

## Code Examples

### Migration: User Memory Table
```sql
-- 043-ironclaw-user-memory.sql
-- Source: derived from ironclaw-store.ts + agent-memory.sql patterns

CREATE TABLE IF NOT EXISTS ironclaw_user_memory (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_did        TEXT        NOT NULL,
  memory_key      TEXT        NOT NULL,       -- 'working_style' | 'critique_tolerance' etc.
  memory_value    JSONB       NOT NULL,        -- structured payload, flexible per key
  confidence      NUMERIC(4,3) DEFAULT 0.5,   -- how strongly this signal is trusted
  source          TEXT        NOT NULL DEFAULT 'inferred', -- 'inferred' | 'explicit'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  UNIQUE (user_did, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_ironclaw_user_memory_user
  ON ironclaw_user_memory (user_did);
CREATE INDEX IF NOT EXISTS idx_ironclaw_user_memory_expires
  ON ironclaw_user_memory (expires_at);
```

### Migration: Context Memory Table
```sql
-- 044-ironclaw-context-memory.sql

CREATE TABLE IF NOT EXISTS ironclaw_context_memory (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_set_id  TEXT        NOT NULL,
  memory_key      TEXT        NOT NULL,
  memory_value    JSONB       NOT NULL,
  session_count   INTEGER     NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '180 days'),
  UNIQUE (problem_set_id, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_ironclaw_context_memory_ps
  ON ironclaw_context_memory (problem_set_id);

-- Interaction outcomes for adaptive behavior engine
CREATE TABLE IF NOT EXISTS ironclaw_interaction_outcomes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_did        TEXT        NOT NULL,
  problem_set_id  TEXT,                      -- nullable for global-scope interactions
  outcome_type    TEXT        NOT NULL,
  context         JSONB,                     -- e.g. {suggestion_type, field, was_incorporated}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ironclaw_outcomes_user
  ON ironclaw_interaction_outcomes (user_did, created_at);
CREATE INDEX IF NOT EXISTS idx_ironclaw_outcomes_type
  ON ironclaw_interaction_outcomes (outcome_type, created_at);
```

### Memory Assembly Service
```typescript
// Source: pattern derived from IronclawService.buildSystemPrompt() + AgentMemoryStore.recall()

export class MemoryRetrievalService {
  /**
   * Assemble a memory block for injection into the Ironclaw system prompt.
   * Hard cap: 1300 total characters (~1600 tokens budget headroom).
   * Falls back to empty string on timeout or error — never blocks message flow.
   */
  async assembleMemoryBlock(
    userDid: string,
    problemSetId: string | null,
    timeoutMs = 200,
  ): Promise<string> {
    try {
      const result = await Promise.race([
        this._buildBlock(userDid, problemSetId),
        new Promise<string>((resolve) => setTimeout(() => resolve(''), timeoutMs)),
      ]);
      return result;
    } catch {
      return '';
    }
  }

  private async _buildBlock(userDid: string, problemSetId: string | null): Promise<string> {
    const sections: string[] = [];

    // User preferences
    const userMems = await ironclawUserMemoryStore.getActiveMemories(userDid);
    if (userMems.length > 0) {
      sections.push('## User Preferences (persistent)');
      for (const m of userMems.slice(0, 8)) {
        sections.push(`- ${m.memory_key}: ${JSON.stringify(m.memory_value)}`);
      }
    }

    // Problem set context
    if (problemSetId) {
      const ctxMems = await ironclawContextMemoryStore.getActiveMemories(problemSetId);
      if (ctxMems.length > 0) {
        sections.push('## Problem Set Memory');
        for (const m of ctxMems.slice(0, 8)) {
          sections.push(`- ${m.memory_key}: ${JSON.stringify(m.memory_value)}`);
        }
      }
    }

    if (sections.length === 0) return '';
    const block = sections.join('\n');
    // Hard cap at 1300 chars
    return block.length > 1300 ? block.slice(0, 1297) + '...' : block;
  }
}
```

### Upsert Pattern for User Preferences
```typescript
// Source: ironclaw_trust_preferences ON CONFLICT pattern in ironclaw-store.ts

async setUserMemory(
  userDid: string,
  memoryKey: string,
  value: Record<string, unknown>,
  source: 'inferred' | 'explicit' = 'inferred',
  confidence = 0.5,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO ironclaw_user_memory
       (user_did, memory_key, memory_value, source, confidence, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '90 days')
     ON CONFLICT (user_did, memory_key) DO UPDATE SET
       memory_value = EXCLUDED.memory_value,
       source       = EXCLUDED.source,
       confidence   = EXCLUDED.confidence,
       updated_at   = NOW(),
       expires_at   = NOW() + INTERVAL '90 days'`,
    [userDid, memoryKey, JSON.stringify(value), source, confidence],
  );
}
```

### Suggestion Outcome Recording (Fire-and-Forget)
```typescript
// Source: pattern from IronclawService.checkDesignTabSuggestion() fire-and-forget

// In ironclaw-router.ts suggestion accept endpoint:
ironclawRouter.post('/:problemSetId/suggestions/:suggestionId/accept', async (req, res) => {
  // ... existing accept logic ...

  // Fire-and-forget outcome recording — non-blocking
  ironclawMemoryService.recordOutcome(
    userDid,
    problemSetId,
    'suggestion_accepted',
    { suggestion_type: suggestion.target_field, field: suggestion.target_field_label },
  ).catch((err) => console.error('[ironclaw-memory] outcome record failed:', err));
});
```

### Adaptive Preference Derivation
```typescript
// Source: pattern derived from ironclaw_trust_preferences aggregation queries

async deriveAdaptivePreferences(userDid: string): Promise<AdaptivePreferences> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       outcome_type,
       COUNT(*)::int AS count
     FROM ironclaw_interaction_outcomes
     WHERE user_did = $1
       AND created_at > NOW() - INTERVAL '30 days'
     GROUP BY outcome_type`,
    [userDid],
  );

  const counts = Object.fromEntries(rows.map((r) => [r.outcome_type, r.count]));
  const total = Object.values(counts).reduce((s, c) => s + c, 0);

  const rejectionRate = (counts['suggestion_rejected'] ?? 0) / Math.max(total, 1);
  const incorporationRate = (counts['edit_post_critique'] ?? 0)
    / Math.max(counts['suggestion_accepted'] ?? 1, 1);

  return {
    proactivityLevel: rejectionRate > 0.6 ? 'low' : rejectionRate < 0.2 ? 'high' : 'medium',
    critiqueFrequency: incorporationRate > 0.7 ? 'high' : incorporationRate < 0.3 ? 'low' : 'medium',
    prefersDraftFirst: (counts['draft_accepted'] ?? 0) > (counts['blank_page_preferred'] ?? 0),
  };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-session stateless prompt | Persistent user memory in system prompt | Phase 57 | Ironclaw builds long-term model of each user |
| `buildSystemPrompt()` sync string | `buildSystemPrompt()` async with memory injection | Phase 57 | All callers must await |
| Interaction outcomes lost | Stored in `ironclaw_interaction_outcomes` | Phase 57 | Adaptive behavior now data-driven |
| User cannot see AI's model of them | Memory management panel | Phase 57 | Transparency + GDPR-like user control |

**Deprecated/outdated:**
- Static `buildSystemPrompt()` without user context: replaced by memory-aware version
- `IronclawService.designSuggestionShown` in-memory Set: still valid for session-level dedup, but cross-session persistence now also tracked in `ironclaw_context_memory`

---

## Open Questions

1. **Does the NEAR AI Ironclaw sidecar (the agent running at `IRONCLAW_URL`) need configuration changes to accept longer system prompts?**
   - What we know: The client sends `content` + `thread_id` to the webhook. There is no explicit system prompt parameter in `IronclawClient.sendMessage()`.
   - What's unclear: How does the NEAR AI runtime receive and apply the system prompt? Looking at `buildSystemPrompt()` — it returns a string but it is NOT currently passed to `sendMessage()`. The system prompt may be configured in the Ironclaw sidecar directly, not injected per-request.
   - Recommendation: Before implementing memory injection, verify whether the system prompt is configurable per-request via the webhook payload or only at sidecar startup. If per-request injection is not supported, the memory block must be prepended to the `content` field instead (as a structured preamble), which is already done for context (`[Context: tab=..., problemSet=...]`). This is a Wave 1 investigative task.

2. **What is the right memory key taxonomy for `working_style` and `communication_style`?**
   - What we know: The phase spec mentions "draft-first vs blank-page", "formal vs informal", "verbose vs terse". These need stable string keys.
   - What's unclear: Whether to use flat keys (`working_style.draft_preference`) or compound JSONB values (`working_style: { draft_preference: 'draft-first', detail_level: 'high' }`).
   - Recommendation: Use compound JSONB values (single row per major category) to minimize table rows and simplify upsert. Key taxonomy: `working_style`, `critique_tolerance`, `domain_expertise`, `communication_style`, `adaptive_behavior`.

3. **Session summary generation — LLM call or rule-based?**
   - What we know: Problem set context memory includes "key discussion threads and their conclusions" and "cross-session continuity."
   - What's unclear: Whether to generate a summary via an LLM call at session end, or extract structured signals via rule-based parsing of the conversation.
   - Recommendation: Start rule-based (simpler, no extra cost, no latency): at session close (when `last_active_at` advances by > 30 min), extract: decisions made (action log entries approved during this session), suggestions accepted/rejected. LLM summarization is a Phase 57+ enhancement.

---

## Validation Architecture

> `workflow.nyquist_validation` is not set in `.planning/config.json` — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.17 |
| Config file | `backend/vitest.config.ts` (check if exists) or inline `vitest` in package.json |
| Quick run command | `cd backend && npx vitest run --reporter=verbose src/ironclaw/` |
| Full suite command | `cd backend && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MEM-01 | User memory upsert — new key creates row | unit | `npx vitest run src/ironclaw/ironclaw-memory-store.test.ts` | No — Wave 0 |
| MEM-02 | User memory upsert — existing key updates + extends TTL | unit | `npx vitest run src/ironclaw/ironclaw-memory-store.test.ts` | No — Wave 0 |
| MEM-03 | Expired memory rows not returned by getActiveMemories() | unit | `npx vitest run src/ironclaw/ironclaw-memory-store.test.ts` | No — Wave 0 |
| MEM-04 | Context memory upsert for problem_set_id scope | unit | `npx vitest run src/ironclaw/ironclaw-memory-store.test.ts` | No — Wave 0 |
| MEM-05 | assembleMemoryBlock() returns empty string on timeout | unit | `npx vitest run src/ironclaw/ironclaw-memory-service.test.ts` | No — Wave 0 |
| MEM-06 | assembleMemoryBlock() hard-caps at 1300 chars | unit | `npx vitest run src/ironclaw/ironclaw-memory-service.test.ts` | No — Wave 0 |
| MEM-07 | recordOutcome() writes to ironclaw_interaction_outcomes | unit | `npx vitest run src/ironclaw/ironclaw-memory-service.test.ts` | No — Wave 0 |
| MEM-08 | deriveAdaptivePreferences() returns 'low' proactivity when rejection > 60% | unit | `npx vitest run src/ironclaw/ironclaw-memory-service.test.ts` | No — Wave 0 |
| MEM-09 | DELETE /ironclaw/memory/:key removes row for authenticated user | integration | `npx vitest run src/ironclaw/ironclaw-router.test.ts` | No — Wave 0 |
| MEM-10 | No cross-user data leakage — query for userA never returns userB memory | unit | `npx vitest run src/ironclaw/ironclaw-memory-store.test.ts` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `cd /home/vitalpointai/projects/ssr/backend && npx vitest run src/ironclaw/ironclaw-memory-store.test.ts`
- **Per wave merge:** `cd /home/vitalpointai/projects/ssr/backend && npx vitest run src/ironclaw/`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/ironclaw/ironclaw-memory-store.test.ts` — covers MEM-01 through MEM-04, MEM-10
- [ ] `backend/src/ironclaw/ironclaw-memory-service.test.ts` — covers MEM-05 through MEM-08
- [ ] `backend/src/ironclaw/ironclaw-router.test.ts` — covers MEM-09 (requires test DB or mock)

---

## Sources

### Primary (HIGH confidence)
- Direct inspection: `backend/src/ironclaw/ironclaw-store.ts` — existing store patterns
- Direct inspection: `backend/src/ironclaw/ironclaw-service.ts` — `handleMessage()`, `buildSystemPrompt()`, fire-and-forget patterns
- Direct inspection: `backend/src/ironclaw/ironclaw-client.ts` — webhook protocol (identifies open question about system prompt injection)
- Direct inspection: `backend/src/agents/agent-memory-store.ts` — cosine similarity recall, `getPool()` pattern, TTL management
- Direct inspection: `backend/src/db/migrations/035-agent-memory.sql` — existing memory table schema
- Direct inspection: `backend/src/db/migrations/039-ironclaw-tasks.sql` — ironclaw_tasks schema pattern
- Direct inspection: `backend/package.json` — confirmed: pg, @langchain/core, pg-boss, vitest all installed
- Direct inspection: `backend/src/ironclaw/ironclaw-types.ts` — TRUST_TTL_DAYS pattern, JSONB constants

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` Phase 57 section — feature spec descriptions (no code yet)
- `.planning/STATE.md` — Phase 55 complete, Phase 57 depends on Phase 55

### Tertiary (LOW confidence)
- None. All findings derived from direct codebase inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in package.json
- Architecture: HIGH — derived directly from existing patterns in ironclaw-store.ts, agent-memory-store.ts, and ironclaw-service.ts
- Pitfalls: HIGH — pitfalls derived from reading the actual code flows (fire-and-forget patterns, async gaps, privacy scope separation already present in the store)
- Open questions: MEDIUM — system prompt injection mechanism is unclear from the webhook client code alone; requires runtime verification

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable domain — no external API dependencies beyond existing stack)
