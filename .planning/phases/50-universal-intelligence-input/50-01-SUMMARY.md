---
phase: 50-universal-intelligence-input
plan: "01"
subsystem: backend/ingest
tags: [classification, url-unfurling, tdd, intelligence-input, types]
dependency_graph:
  requires: []
  provides:
    - backend/src/ingest/types.ts — InputType, ClassificationResult, UnfurlResult, IngestSubmitRequest, IngestSubmitResponse
    - backend/src/ingest/universal-classifier.ts — classifyInput()
    - backend/src/ingest/url-unfurler.ts — unfurlUrl()
  affects:
    - Plan 50-02 (API routes — consumes IngestSubmitRequest/Response and classifyInput)
    - Plan 50-03 (frontend — consumes InputType and ClassificationResult)
tech_stack:
  added: []
  patterns:
    - TDD with Vitest — write failing tests before implementation
    - vi.mock() for network isolation in unit tests
    - AbortSignal.timeout() for fetch timeouts (Node 20+)
    - Function-style mock constructors (vi.fn() arrow functions cannot be `new`-ed)
key_files:
  created:
    - backend/src/ingest/types.ts
    - backend/src/ingest/universal-classifier.ts
    - backend/src/ingest/url-unfurler.ts
    - backend/src/ingest/universal-classifier.test.ts
    - backend/src/ingest/url-unfurler.test.ts
  modified: []
decisions:
  - Used function-style constructors in vi.mock() for rss-parser and jsdom because vi.fn() arrow functions cannot be used with `new`
  - unfurlUrl treats any unrecognised URL as api_url (not unknown) at the classifier layer, while the unfurler itself returns type:unknown which maps to api_url
  - Module-level _jsdomImpl variable used for per-test JSDOM behaviour injection without re-mocking the module
metrics:
  duration: 4 min
  completed: "2026-03-18"
  tasks_completed: 2
  files_created: 5
---

# Phase 50 Plan 01: Universal Intelligence Input — Types, Classifier, Unfurler Summary

**One-liner:** Content classification layer with 5-category heuristic detection (Buffer, RSS/article/PDF URL, JSON, XML, raw_text) and URL metadata extraction via HEAD+JSDOM+RSS autodiscovery.

## What Was Built

### Task 1 — Shared Types + Universal Classifier (TDD)

`backend/src/ingest/types.ts` exports the full type contract for all ingest pipelines:
- `InputType` union: 9 variants covering all content types
- `ClassificationResult` with confidence scoring (0-1) and pipeline routing
- `UnfurlResult` with RSS/article/pdf_url/unknown discrimination
- `IngestSubmitRequest` and `IngestSubmitResponse` for the Plan 02 API

`backend/src/ingest/universal-classifier.ts` exports `classifyInput(content, hint?)`:
1. Buffer path: maps MIME hint to `file` type → `doc-intelligence` pipeline (confidence 0.95 with hint, 0.7 without)
2. URL path: delegates to `unfurlUrl()` and maps result to `rss_url`/`article_url`/`pdf_url`/`api_url`
3. JSON path: attempts `JSON.parse()`, confidence 0.95 on success
4. XML path: detects `<?xml` declaration or opening tag pattern, confidence 0.85
5. Fallback: `raw_text`, confidence 0.7 → `text-ingest` pipeline

18 unit tests pass, all network calls mocked via `vi.mock('./url-unfurler.js')`.

### Task 2 — URL Unfurler (TDD)

`backend/src/ingest/url-unfurler.ts` exports `unfurlUrl(url)`:
1. HEAD request with 5s `AbortSignal.timeout()` — returns `unknown` on timeout/error
2. `application/rss+xml` or `application/atom+xml` → `{ type: 'rss' }`
3. `application/pdf` → `{ type: 'pdf_url' }`
4. `text/html` → GET body → JSDOM parse:
   - `<link type="application/rss+xml">` autodiscovery → `{ type: 'rss', discoveredFrom: url }`
   - `rssParser.parseURL()` fallback for feeds served as HTML
   - OG tag extraction (og:title, og:description, \<title\>) → `{ type: 'article', title, description }`
5. Fallback → `{ type: 'unknown' }`
6. Entire function wrapped in try/catch — never throws

7 unit tests pass covering all paths. RSS-parser and JSDOM mocked with function-style constructors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.fn() arrow function cannot be used as constructor**
- **Found during:** Task 2 (url-unfurler.test.ts)
- **Issue:** `vi.mock('rss-parser', () => { const RSSParser = vi.fn()... })` fails with "is not a constructor" because arrow functions cannot be `new`-ed
- **Fix:** Replaced with `function RSSParser(this: ...) { ... }` syntax in both rss-parser and jsdom mocks
- **Files modified:** backend/src/ingest/url-unfurler.test.ts
- **Commit:** 849a6566

**2. [Rule 1 - Bug] TypeScript `as` cast in arrow function argument**
- **Found during:** Task 2 RED phase (transform error)
- **Issue:** esbuild rejected `) as (sel: string) => Element | null` inline cast syntax
- **Fix:** Converted to typed arrow function parameter directly
- **Files modified:** backend/src/ingest/url-unfurler.test.ts
- **Commit:** 849a6566

## Test Summary

| File | Tests | Status |
|------|-------|--------|
| universal-classifier.test.ts | 18 | PASS |
| url-unfurler.test.ts | 7 | PASS |
| **Total** | **25** | **PASS** |

## Commits

| Hash | Message |
|------|---------|
| 4b964c4b | test(50-01): add failing tests for universal classifier |
| 99db9042 | feat(50-01): implement universal classifier and shared ingest types |
| 849a6566 | feat(50-01): implement URL unfurler with tests |

## Self-Check: PASSED

All 5 created files confirmed on disk. All 3 task commits confirmed in git log.
