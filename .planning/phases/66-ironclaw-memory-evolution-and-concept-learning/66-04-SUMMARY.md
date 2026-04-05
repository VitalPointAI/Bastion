---
phase: 66-ironclaw-memory-evolution-and-concept-learning
plan: 04
subsystem: ironclaw
tags: [concept-retrieval, semantic-search, pgvector, system-prompt-injection, memory]
dependency_graph:
  requires: ["66-01"]
  provides: ["concept-retrieval-service", "learned-context-injection"]
  affects: ["ironclaw-service", "message-preamble"]
tech_stack:
  added: ["concept-retrieval.ts"]
  patterns: ["Promise.race timeout", "semantic-search-injection", "graceful-degradation"]
key_files:
  created:
    - backend/src/ironclaw/concept-retrieval.ts
  modified:
    - backend/src/ironclaw/ironclaw-service.ts
decisions:
  - "conceptBlock placed after memoryBlock and before kgContextBlock in preamble — learned concepts sit between personal memory and knowledge graph context"
  - "Similarity threshold 0.3 filters low-relevance concepts; 2000-char cap prevents context bloat"
metrics:
  duration: "15 minutes"
  completed: "2026-04-05"
  tasks_completed: 2
  files_changed: 2
---

# Phase 66 Plan 04: Concept Retrieval and System Prompt Injection Summary

Semantic concept retrieval integrated into every Ironclaw message via a [LEARNED CONTEXT] block assembled from top-5 pgvector cosine similarity matches with 400ms timeout protection.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Concept retrieval service with semantic search and context assembly | 43114b6b | backend/src/ironclaw/concept-retrieval.ts (created) |
| 2 | Inject [LEARNED CONTEXT] into ironclaw-service.ts message flow | fe53d30a | backend/src/ironclaw/ironclaw-service.ts (modified) |

## What Was Built

### concept-retrieval.ts (new)

`ConceptRetrievalService` with one public method: `getLearnedContextBlock(userDid, problemSetId, messageContent, timeoutMs)`.

Flow:
1. Wrap entire operation in `Promise.race` against a 400ms timeout
2. Generate embedding for the incoming message content via `generateConceptEmbedding()`
3. Return `''` if `OPENAI_API_KEY` is missing (graceful degradation)
4. Call `conceptStore.semanticSearch(embedding, userDid, problemSetId, 5)`
5. Filter results with `similarity > 0.3` to discard low-relevance matches
6. Format each concept as: `- {concept_key} (confidence: {n}, v{version}): {value.text}`
7. Append `[Evolution: v1 → v{version}]` note for concepts with version > 1
8. Wrap in `[LEARNED CONTEXT] ... [/LEARNED CONTEXT]` block
9. Hard-cap at 2000 characters (~500 tokens) with `...` truncation
10. Return `''` if no concepts match (no empty block injected)

### ironclaw-service.ts (modified)

Two changes at the message processing path:
- Extended `Promise.all` to include `conceptRetrievalService.getLearnedContextBlock(userDid, problemSetId, content, 400)` as fourth element → `conceptBlock`
- Added `conceptBlock` to preamble array between `memoryBlock` and `kgContextBlock`

Result: every Ironclaw message now carries learned concept context in the preamble, placed after personal memory and before the knowledge graph context block.

## Deviations from Plan

None — plan executed exactly as written.

## Security Notes

Per threat model T-66-11: 400ms timeout ensures semantic search never blocks message flow. T-66-10 (concept injection tampering) accepted per plan — concepts are backend-generated from LLM extraction; users cannot directly control injected text.

## Known Stubs

None.

## Self-Check: PASSED

- `backend/src/ironclaw/concept-retrieval.ts` — exists, contains `getLearnedContextBlock(`, `conceptStore.semanticSearch`, `generateConceptEmbedding`, `[LEARNED CONTEXT]`, `[/LEARNED CONTEXT]`, `Promise.race`, `0.3`, exports `conceptRetrievalService`
- `backend/src/ironclaw/ironclaw-service.ts` — contains `import.*conceptRetrievalService`, `conceptRetrievalService.getLearnedContextBlock`, `conceptBlock` in preamble
- Commits 43114b6b and fe53d30a exist
- TypeScript compiles without new errors (pre-existing ironclaw-router.ts error unrelated to this plan)
