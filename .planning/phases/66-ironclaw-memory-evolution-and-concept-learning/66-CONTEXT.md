# Phase 66: Ironclaw Memory Evolution, Concept Learning & Reinforcement - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a learning loop on top of Phase 57's persistent memory and Phase 65's autonomous operations. Ironclaw gains the ability to extract knowledge from conversations, store versioned concepts with semantic embeddings, consolidate understanding across threads, inject learned context into prompts, track autonomous action outcomes with commander feedback, and accept commander directives for priority steering.

</domain>

<decisions>
## Implementation Decisions

### Database Location
- **D-01:** Store `ironclaw_concepts` table in ironclaw-postgres (already runs `pgvector/pgvector:pg16` — zero infrastructure risk). Access via existing `DATABASE_URL_IRONCLAW` pool pattern in `ironclaw-client.ts`.
- **D-02:** Use plain TEXT column for `problem_set_id` with no FK constraint (cross-DB reference). Same pattern routines already use.

### Claude's Discretion (DB)
- Cross-DB reference approach for problem_set_id — use plain TEXT column, no FK, consistent with routine-service.ts pattern.

### Extraction Triggers & Scope
- **D-03:** Fire post-conversation extraction on ALL THREE triggers: idle timeout (5 minutes no messages), explicit thread close (user switches threads), and session end (drawer close/navigate away).
- **D-04:** No minimum message count — extract from any thread with user content. Even short exchanges may contain valuable insights.
- **D-05:** No rate limiting on extractions. Trust trigger conditions to self-limit. Haiku extraction cost is negligible.

### Commander Feedback UX
- **D-06:** Thumbs up/down with optional comment on each activity feed item. Thumbs for quick signal, expandable text field for notes on any rating. Both positive and negative feedback captured.
- **D-07:** Dedicated Commander Directives panel (IronclawDirectivesPanel) in the drawer for persistent priority/guidance settings. Commander types directives that Ironclaw internalizes across all future actions. Directives stored as `directive` concept type.

### Concept Dashboard & Retrieval
- **D-08:** New dedicated drawer tab for "What Ironclaw Knows" (IronclawConceptsPanel). Separate from existing Memory panel. Added alongside Chat, Activity, Memory, Tasks tabs.
- **D-09:** Expandable version history on each concept card. Collapsed by default showing latest version. Click to expand full version chain (v1 → v2 → v3) with source threads and confidence changes.
- **D-10:** Top-5 semantic retrieval per message. Retrieve 5 most relevant concepts via cosine similarity for injection as [LEARNED CONTEXT] block in system prompt. ~500 tokens budget.

### Claude's Discretion
- Consolidation job frequency (DESIGN.md suggests 6 hours — Claude may adjust)
- Embedding model choice between text-embedding-3-large and text-embedding-3-small
- Exact idle timeout implementation (frontend timer vs backend heartbeat)
- Session-end detection reliability strategy (beforeunload vs heartbeat timeout)
- Concept card visual design details within UI-SPEC guidelines
- Conflict resolution presentation when consolidation finds contradictions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Design & Research
- `.planning/phases/66-ironclaw-memory-evolution-and-concept-learning/DESIGN.md` — Full architecture: concept types, extraction prompts, version chain examples, consolidation logic, sidecar sync, reinforcement learning
- `.planning/phases/66-ironclaw-memory-evolution-and-concept-learning/66-RESEARCH.md` — Stack verification, migration patterns, embedding patterns, integration points, anti-patterns
- `.planning/phases/66-ironclaw-memory-evolution-and-concept-learning/66-UI-SPEC.md` — UI design contract: spacing, typography, color, component specs for ConceptsPanel and DirectivesPanel

### Existing Ironclaw Integration Points
- `backend/src/ironclaw/ironclaw-client.ts` — `getIronclawPool()` pattern for DATABASE_URL_IRONCLAW access
- `backend/src/ironclaw/ironclaw-service.ts` — `assembleMemoryBlock()` call site (line ~360) where [LEARNED CONTEXT] injection goes
- `backend/src/ironclaw/ironclaw-store.ts` — `deleteThread()` (line ~365) where concept retraction hook goes
- `backend/src/ironclaw/ironclaw-memory-service.ts` — Existing memory retrieval service to extend
- `backend/src/ironclaw/routine-service.ts` — Pattern for getIronclawPool() and scheduled work
- `backend/src/ironclaw/autonomous-activity-store.ts` — Needs outcome_status, commander_rating, commander_notes columns
- `backend/src/graph/resolution/embedding-matcher.ts` — Existing embedding generation pattern with OpenAI SDK

### Frontend Components
- `frontend/src/components/ironclaw/IronclawDrawer.tsx` — Drawer tab structure to extend with new Concepts tab
- `frontend/src/components/ironclaw/IronclawMemoryPanel.tsx` — Established card styling patterns (bg-slate-800/60, gap-3, py-2.5)
- `frontend/src/components/ironclaw/IronclawActivityFeed.tsx` — Activity feed where thumbs rating row is added

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getIronclawPool()` in `ironclaw-client.ts` — direct pool access pattern for ironclaw-postgres
- `generateEmbedding()` in `embedding-matcher.ts` — OpenAI embedding generation pattern
- `assembleMemoryBlock()` in `ironclaw-memory-service.ts` — system prompt injection point
- `getCountSince()` in `autonomous-activity-store.ts` — activity counting pattern (usable for extraction metrics)
- `IronclawMemoryPanel` card styling — established visual pattern for concept cards

### Established Patterns
- kebab-case backend files (`concept-store.ts`, `concept-extraction.ts`)
- `getPool()` / `getIronclawPool()` for DB access
- `@anthropic-ai/sdk` Haiku calls for LLM passes
- `openai` SDK for embedding generation
- Section comments with `// ─── Section Name ───`
- `.js` extensions on local imports (ESM)

### Integration Points
- `ironclaw-service.ts` Promise.all block (line ~360) — add conceptRetrievalService.getLearnedContextBlock()
- `ironclaw-store.ts` deleteThread() — add concept retraction hook
- `IronclawDrawer.tsx` tab array — add Concepts and Directives tabs
- `IronclawActivityFeed.tsx` — add thumbs rating row to activity items
- `docker-compose.yml` — add OPENAI_API_KEY env var to backend service

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following DESIGN.md architecture.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 66-ironclaw-memory-evolution-and-concept-learning*
*Context gathered: 2026-04-05*
