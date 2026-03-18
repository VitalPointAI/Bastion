---
phase: 50-universal-intelligence-input
plan: "02"
subsystem: backend/ingest
tags: [ingest, routing, sse, api, doc-intelligence, osint, pipeline-dispatch]
dependency_graph:
  requires:
    - backend/src/ingest/types.ts (Plan 50-01)
    - backend/src/ingest/universal-classifier.ts (Plan 50-01)
    - backend/src/api/doc-intelligence.ts (existing)
    - backend/src/jpp/osint-feed-store.ts (existing)
  provides:
    - backend/src/ingest/universal-ingest-router.ts — routeToProcess() pipeline dispatch
    - backend/src/api/ingest.ts — POST /api/ingest/classify and POST /api/ingest/submit
    - backend/src/api/doc-intelligence.ts — broadcastSSE() and exported problemSetSSEClients
  affects:
    - Plan 50-03 (frontend — consumes /api/ingest/classify and /api/ingest/submit)
tech_stack:
  added: []
  patterns:
    - Fire-and-forget async processing with SSE feedback via broadcastSSE
    - withRetry() wrapper: one automatic retry after 2s on transient pipeline failures
    - AbortSignal.timeout() for article URL fetch and classify timeout
    - JSDOM for HTML text extraction from article URLs
    - Multer memoryStorage for file buffer handling (consistent with doc-intelligence)
key_files:
  created:
    - backend/src/ingest/universal-ingest-router.ts
    - backend/src/api/ingest.ts
  modified:
    - backend/src/api/doc-intelligence.ts (export problemSetSSEClients + broadcastSSE)
    - backend/src/index.ts (register /api/ingest router)
decisions:
  - routeToDocIntelligence() performs duplicate detection then fires async processing — returns processId immediately (202-style)
  - osint-subscribe path calls osintFeedStore.createFeed() directly (no HTTP) with 15-min polling interval and entity_objective relevance mode
  - text-ingest pipeline routes to doc-intelligence (same as raw text) — TRIAGE_SYSTEM_PROMPT in the LangGraph graph handles sub-classification per UNIV-06
  - article_url path downloads HTML and extracts body text via JSDOM before passing to doc-intelligence
  - pdf_url path downloads binary and parses through DocumentParser before text submission
  - Duplicate detection: DUPLICATE_EXACT throws coded error caught by caller; returns status:duplicate
metrics:
  duration: 15 min
  completed: "2026-03-18"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 50 Plan 02: Universal Intelligence Input — Pipeline Router & API Endpoints Summary

**One-liner:** Dispatch layer routing classified content to doc-intelligence (files/articles/text/JSON/XML), OSINT feed subscription (RSS), or manual fallback, with SSE event broadcasting for real-time frontend feedback.

## What Was Built

### Task 2 (applied first) — Export SSE utilities from doc-intelligence.ts

`backend/src/api/doc-intelligence.ts` modified:
- `const problemSetSSEClients` changed to `export const` — makes the Map accessible to the ingest router
- Added `export function broadcastSSE(problemSetId, event, data)` — encapsulates the broadcast loop so callers don't need SSE internals
- Refactored `createSSEProgressCallback` to call `broadcastSSE` internally (DRY — behavior unchanged)

### Task 1 — Pipeline Router and Ingest API

`backend/src/ingest/universal-ingest-router.ts` exports `routeToProcess(request, classification)`:

| Pipeline | Trigger | What happens |
|----------|---------|-------------|
| `doc-intelligence` | file buffer, article_url, pdf_url, json_data, xml_data | ProblemSetContext gate → parse/extract text → async doc-intelligence LangGraph run |
| `osint-subscribe` | rss_url | `osintFeedStore.createFeed()` with 15-min polling, entity_objective mode |
| `text-ingest` | raw_text (pasted notes) | Routes to doc-intelligence — TRIAGE_SYSTEM_PROMPT handles subtype (UNIV-06) |
| `manual` | unknown/api_url | Returns accepted; frontend shows suggestion chips |

All paths:
- Generate `processId` via `crypto.randomUUID()`
- Broadcast `classify:result` and `route:selected` SSE events
- Propagate `route:error` + `route:retry_success` via `withRetry()` wrapper (one retry, 2s delay)
- article_url: fetches HTML, extracts body text with JSDOM, submits to doc-intelligence
- pdf_url: downloads binary, passes through DocumentParser, submits text
- DUPLICATE_EXACT → throws coded error, caller returns `status: 'duplicate'`

`backend/src/api/ingest.ts` Express router:

**POST /api/ingest/classify**
- Accepts JSON `{ content, problemSetId? }` or multipart file
- Broadcasts `classify:start` if problemSetId provided
- 15s timeout — returns partial result (confidence 0.3, pipeline 'manual') instead of error
- Returns `{ classification: ClassificationResult }`

**POST /api/ingest/submit**
- Accepts JSON body matching IngestSubmitRequest or multipart form
- Classifies if no `classification` provided in body
- Calls `routeToProcess()` from universal-ingest-router
- HTTP 202 for accepted, 409 for duplicate, 200 for interview_required
- Returns `IngestSubmitResponse: { processId, classification, status }`

`backend/src/index.ts` updated:
- Import `ingestRouter from './api/ingest.js'`
- `app.use('/api/ingest', ingestRouter)` registered after doc-intelligence

## SSE Event Contract

| Event | Payload |
|-------|---------|
| `classify:start` | `{ processId, content_preview }` |
| `classify:result` | `{ processId, classification }` |
| `route:selected` | `{ processId, pipeline, target, [feedId] }` |
| `route:error` | `{ processId, error, retryable }` |
| `route:retry_success` | `{ processId }` |

Events flow through the existing `/api/doc-intelligence/stream/:problemSetId` SSE endpoint.

## Deviations from Plan

None — plan executed exactly as written. The only ordering adjustment was implementing the doc-intelligence.ts exports (Task 2) before the router files (Task 1) since the router imports `broadcastSSE`.

## Commits

| Hash | Message |
|------|---------|
| fae575ac | feat(50-02): export broadcastSSE and problemSetSSEClients from doc-intelligence |
| 8a9bf327 | feat(50-02): add universal ingest pipeline router and API endpoints |

## Self-Check: PASSED
