# Phase 66: Ironclaw Memory Evolution, Concept Learning & Reinforcement

**Status:** Designed (not yet planned)
**Depends on:** Phase 57 (Persistent Memory — complete), Phase 60 (Ironclaw/Bastion Integration), Phase 65 (Autonomous Operations — complete)
**Priority:** High — without this, Ironclaw cannot learn from conversations or improve its autonomous performance

---

## Problem Statement

Phase 57 gave Ironclaw persistent memory (user preferences, context memory, interaction outcomes). Phase 65 gave it autonomous operations (routines, heartbeat, proactive monitoring). But the system has **no learning loop** — memories are overwritten, not versioned; conversations don't produce new knowledge; autonomous actions have no feedback mechanism; and there's no way for Ironclaw to know whether its decisions helped or wasted effort.

A military Chief of Staff must:
- **Learn from every engagement** — extracting key insights, revised assessments, and commander intent
- **Track how understanding evolves** — "We initially assessed X, but after Thread 47 we revised to Y"
- **Consolidate across threads** — merge fragmented knowledge from separate conversations
- **Forget on command** — when a thread is deleted or information is retracted
- **Learn from autonomous performance** — track which decision paths produced good outcomes and optimize over time
- **Respond to commander feedback** — internalize steering ("focus more on X, less on Y") and adjust priorities

None of this exists today.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    CONVERSATION (Thread N)                        │
│  Commander ←→ Ironclaw (webhook) ←→ BASTION processResponse()   │
└──────────────┬───────────────────────────────────────────────────┘
               │ Thread ends / idle timeout
               ▼
┌──────────────────────────────────────────────────────────────────┐
│              POST-CONVERSATION EXTRACTION (async)                │
│                                                                  │
│  LLM pass over thread messages → extract:                       │
│  • Key facts / assessments (with confidence)                    │
│  • Revised understanding of existing concepts                   │
│  • Commander preferences / intent signals                       │
│  • Action outcomes & lessons learned                            │
│                                                                  │
│  Each extraction → ConceptEntry (versioned, not overwritten)    │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│              VERSIONED CONCEPT STORE (PostgreSQL)                 │
│                                                                  │
│  ironclaw_concepts                                               │
│  ├── id (UUID)                                                   │
│  ├── problem_set_id (TEXT, nullable — null = global)            │
│  ├── user_did (TEXT)                                             │
│  ├── concept_key (TEXT) — canonical identifier                  │
│  ├── concept_type (ENUM) — actor, situation, assessment,        │
│  │                         preference, lesson, intent            │
│  ├── current_value (JSONB) — latest understanding               │
│  ├── confidence (NUMERIC 0-1)                                    │
│  ├── source_thread_id (TEXT) — thread that produced this version│
│  ├── version (INT) — auto-incremented                           │
│  ├── supersedes_id (UUID, nullable) — FK to prior version       │
│  ├── embedding (vector(1536)) — for semantic retrieval          │
│  ├── created_at, updated_at, expires_at                         │
│  └── UNIQUE (problem_set_id, user_did, concept_key, version)   │
│                                                                  │
│  ironclaw_concept_history (view or materialized)                │
│  └── Full version chain for any concept_key, ordered by version │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│              CROSS-THREAD CONSOLIDATION (scheduled)              │
│                                                                  │
│  Periodic job (every 6 hours):                                   │
│  1. Find concept_keys with multiple versions from different      │
│     threads in the same problem set                              │
│  2. LLM merge pass: synthesize a consolidated understanding     │
│  3. Write new version with source_thread_id = 'consolidation'   │
│  4. Update embedding for semantic retrieval                      │
│                                                                  │
│  Conflict detection:                                             │
│  - If Thread A says "Actor X is ally" and Thread B says          │
│    "Actor X is adversary" → flag as CONTRADICTED, surface to     │
│    commander for resolution                                      │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│              RETRIEVAL & INJECTION                                │
│                                                                  │
│  On each Ironclaw message:                                       │
│  1. Embed user query                                             │
│  2. Cosine similarity search against concept embeddings          │
│  3. Retrieve top-K relevant concepts (latest version only)      │
│  4. Inject as [LEARNED CONTEXT] block in system prompt           │
│  5. Include evolution notes: "Previously assessed as X (v1),    │
│     revised to Y (v2) based on Thread 47 discussion"            │
│                                                                  │
│  This gives Ironclaw awareness of its own learning trajectory.  │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│              SIDECAR SYNC (bidirectional)                         │
│                                                                  │
│  BASTION → Sidecar:                                              │
│  • /memory update: Push consolidated concepts                    │
│  • /memory delete: Remove concepts when thread deleted           │
│  • /thread forget: Purge thread from sidecar memory              │
│                                                                  │
│  Sidecar → BASTION:                                              │
│  • Post-response hook: Sidecar reports extracted memories        │
│  • Memory sync endpoint: Periodic bulk export of sidecar state  │
│                                                                  │
│  Requires: Ironclaw sidecar API extension or REPL commands      │
│  Fallback: If sidecar doesn't support memory API, use REPL      │
│  commands via FIFO (same pattern as /mcp add)                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Concept Types

| Type | Description | Example |
|------|-------------|---------|
| `actor` | Understanding of a specific actor/entity | "Russia's naval posture shifted from defensive to offensive in Baltic" |
| `situation` | Assessment of an operational situation | "Baltic states' NATO integration is progressing faster than expected" |
| `assessment` | Analytical judgment or estimate | "PLA Eastern Theater Command has ~72hr readiness for amphibious ops" |
| `preference` | Commander preference or working style | "Commander prefers COA briefs in METT-TC format, not free-form" |
| `lesson` | Lesson learned from an action or decision | "Last COA was rejected because it didn't account for logistics constraints" |
| `intent` | Commander's intent or guidance | "Priority is deterrence, not escalation — all options should preserve off-ramps" |
| `relationship` | Understanding of actor-to-actor dynamics | "Turkey is blocking Sweden's NATO accession as leverage for Kurdish concessions" |

---

## Post-Conversation Extraction

### Trigger Conditions
1. **Thread idle timeout** — no new message in 5 minutes (conversation likely ended)
2. **Explicit thread close** — user switches to a different thread
3. **Session end** — user closes the drawer or navigates away

### Extraction Prompt (LLM Pass)
```
You are reviewing a conversation between a military commander and their AI Chief of Staff (Ironclaw).

Extract key knowledge that should persist for future conversations:
1. Any NEW facts, assessments, or judgments discussed
2. Any REVISIONS to previously held understanding
3. Commander preferences or intent signals
4. Lessons learned from decisions or actions
5. Relationship dynamics between actors

For each extraction, provide:
- concept_key: canonical identifier (e.g., "actor:russia:naval_posture")
- concept_type: actor | situation | assessment | preference | lesson | intent | relationship
- value: the current understanding (2-3 sentences)
- confidence: 0.0-1.0
- supersedes: concept_key if this revises a prior understanding, null if new

Return JSON array. Return empty array if no extractable knowledge.
```

### Cost Control
- Only run extraction on threads with 3+ substantive messages
- Skip threads that are purely administrative (action approvals, greeting-only)
- Rate-limit to max 10 extractions per problem set per hour
- Use Claude Haiku for extraction (cost-effective, sufficient quality)

---

## Version Chain Example

```
concept_key: "actor:russia:baltic_naval_posture"
problem_set_id: "PS-baltic-shield"

v1 (Thread 12, 2026-03-28):
  value: "Russia maintains defensive naval posture in Baltic Sea with
          emphasis on Kaliningrad bastion defense"
  confidence: 0.7

v2 (Thread 18, 2026-03-29):
  value: "Russia shifting to offensive naval posture in Baltic. New
          submarine deployments suggest power projection capability
          beyond Kaliningrad bastion defense"
  confidence: 0.8
  supersedes: v1

v3 (Consolidation, 2026-03-30):
  value: "Russia's Baltic naval posture evolved from defensive bastion
          (Kaliningrad-focused) to offensive power projection. Key
          indicator: 3 additional submarine deployments in Q1 2026.
          Commander assessed this shift during Baltic Shield analysis."
  confidence: 0.85
  supersedes: v2
```

When Ironclaw retrieves this concept, the system prompt injection includes:
```
[LEARNED CONTEXT]
• Russia Baltic Naval Posture (confidence: 0.85, revised 2x):
  Russia's Baltic naval posture evolved from defensive bastion to offensive
  power projection. Key indicator: 3 additional submarine deployments in Q1 2026.
  [Evolution: Initially assessed as defensive (v1) → revised to offensive (v2)
   → consolidated with submarine deployment evidence (v3)]
```

---

## Thread Deletion Impact

When a thread is deleted:
1. Mark all concepts with `source_thread_id = deletedThreadId` as `retracted`
2. If a retracted concept has successors (concepts that supersede it), successors remain valid
3. If a retracted concept is the LATEST version, roll back to the previous version
4. If it's the ONLY version, mark the concept as `retracted` (don't delete — audit trail)
5. Send `/memory forget <thread_id>` to sidecar via REPL FIFO

---

## Plans (estimated)

### Plan 66-01: Versioned Concept Store & Schema
- Database migration for `ironclaw_concepts` table with pgvector column
- `ConceptStore` class (CRUD, version chain queries, semantic search)
- Concept types enum and validation

### Plan 66-02: Post-Conversation Extraction Engine
- Idle/close detection in frontend → trigger backend extraction
- LLM extraction prompt and response parsing
- Concept upsert with version chain management
- Cost control (rate limiting, thread quality filter)

### Plan 66-03: Retrieval & System Prompt Injection
- Semantic search over concept embeddings on each message
- `[LEARNED CONTEXT]` block assembly with evolution notes
- Integration into `MemoryRetrievalService.assembleMemoryBlock()`
- Budget: extend 200ms timeout to 400ms for embedding search

### Plan 66-04: Cross-Thread Consolidation
- Scheduled job (6hr interval) to find multi-version concepts
- LLM merge pass for synthesis
- Contradiction detection and commander flagging
- Embedding update after consolidation

### Plan 66-05: Bidirectional Sidecar Sync
- Investigate ironclaw binary REPL commands for memory management
- Push consolidated concepts to sidecar
- Thread deletion → sidecar forget
- Fallback: REPL FIFO commands if no REST API available

### Plan 66-06: Commander Memory Dashboard
- "What Ironclaw Knows" panel — browse concepts by type
- Version history viewer (see how understanding evolved)
- Edit/retract/delete individual concepts
- Contradiction resolution UI

### Plan 66-07: Autonomous Action Outcome Tracking
- Extend `ironclaw_autonomous_activity` with outcome fields: `outcome_status` (pending, positive, negative, neutral), `commander_rating` (nullable), `commander_notes` (nullable)
- Track what Ironclaw did → what happened next (was the PIR accepted? was the research useful? was the alert acknowledged?)
- Frontend: add thumbs up/down + optional notes on each activity entry in the activity feed
- Store outcome data in the activity table, not a separate table — keeps the feedback loop tight

### Plan 66-08: Decision Path Memory
- After each autonomous monitoring cycle, Ironclaw writes a structured decision log to its concept store:
  - What it found → what it decided to do → what tools it used → what the outcome was
- On future cycles, Ironclaw retrieves relevant past decision logs via semantic search
- Successful patterns get reinforced: "Last time I found gaps in [topic], web search + research event ingestion produced useful results"
- Failed patterns get deprioritized: "Last time I created a PIR for [topic], commander dismissed it — probably not worth auto-creating PIRs for that category"

### Plan 66-09: Commander Steering & Priority Internalization
- Add a "Priorities" panel in the Ironclaw config UI where commanders can set:
  - Focus areas ("prioritize Baltic naval movements over economic data")
  - Prohibited actions ("do not auto-create PIRs without my approval")
  - Alert thresholds ("only alert me for critical/urgent, not routine")
- Store as versioned concepts (type: `directive`) so Ironclaw retrieves them on each cycle
- Ironclaw's autonomous prompt already references HEARTBEAT.md — extend to include these directives
- Ironclaw periodically summarizes what it's been doing and asks: "Is this the right focus?"

---

## Success Criteria

1. After a conversation where understanding of an actor changes, the next conversation in any thread reflects the updated understanding
2. Concept version chains are queryable — can answer "how did our assessment of X evolve?"
3. Thread deletion properly retracts associated concepts without destroying the version chain
4. Cross-thread consolidation merges fragmented knowledge within 6 hours
5. Contradictions between threads are detected and surfaced to the commander
6. Extraction cost stays under $0.50/day at typical usage (20 threads/day)
7. Autonomous activity entries show commander ratings; Ironclaw's subsequent cycles reflect the feedback
8. After 10+ monitoring cycles, Ironclaw's decision patterns visibly improve — fewer dismissed alerts, higher-value research, better prioritization
9. Commander-set priorities are reflected in Ironclaw's next monitoring cycle within 30 minutes

---

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| Ironclaw sidecar has no memory management API | Use REPL FIFO commands; worst case, sidecar memory drifts from BASTION truth |
| Extraction quality from Haiku may be low | Start with Haiku, evaluate quality, upgrade to Sonnet if needed |
| pgvector not in current migration stack | Add as extension in migration; already available in PostgreSQL 15+ |
| Embedding compute cost at scale | Batch embeddings, cache concept embeddings, only re-embed on version change |
| Consolidation LLM pass could hallucinate | Always include source thread references; commander can verify via history viewer |
