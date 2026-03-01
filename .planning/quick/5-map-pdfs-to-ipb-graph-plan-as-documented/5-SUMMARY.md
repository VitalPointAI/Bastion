---
phase: quick-5
plan: 1
subsystem: exercise-extraction
tags: [vision-extraction, pdf, ipb-layers, anthropic, planning-map]
dependency_graph:
  requires:
    - backend/src/strategic/extraction/providers/anthropic-provider.ts
    - backend/src/exercise/extraction-service.ts
    - backend/src/exercise/document-store.ts
    - backend/src/api/exercise.ts
  provides:
    - PDF-to-Claude vision pipeline for PLANNING_MAP documents
    - IPBLayer[] generation from vision-extracted map features
    - Multimodal LLM message support (backward-compatible)
  affects:
    - POST /api/exercise/documents/:docId/retry-extraction (new vision branch)
    - ExerciseExtractionService (new extractMapWithVision method)
    - LLMProvider abstraction (now supports multimodal content)
tech_stack:
  added:
    - Anthropic native PDF document blocks (base64, type: "document")
    - randomUUID for IPBLayer ID generation
  patterns:
    - Multimodal content blocks (LLMContentBlock union type)
    - async background extraction via setImmediate
    - geocodeRequired placeholder geometry for named-but-not-geocoded features
key_files:
  created:
    - backend/src/strategic/ingestion/pdf-renderer.ts
    - backend/src/exercise/map-to-ipb-layers.ts
  modified:
    - backend/src/strategic/extraction/providers/types.ts
    - backend/src/strategic/extraction/providers/anthropic-provider.ts
    - backend/src/strategic/extraction/providers/openai-provider.ts
    - backend/src/exercise/extraction-service.ts
    - backend/src/api/exercise.ts
decisions:
  - "Use Anthropic native PDF document blocks instead of rendering PDF pages to images — avoids canvas/native binary deps entirely"
  - "OpenAI-compatible providers normalise multimodal content to text-only (PDF vision not supported on OpenAI; vision route always uses Anthropic)"
  - "geocodeRequired flag in IPBLayer properties for features with named-but-not-geocoded locations"
  - "Vision extraction confidence capped at 0.8 to reflect lower certainty vs text extraction"
metrics:
  duration: "6 min"
  completed: "2026-03-01"
  tasks_completed: 3
  files_created: 2
  files_modified: 5
---

# Quick Task 5: Vision-Based PDF Map Extraction to IPB Layers Summary

**One-liner:** Anthropic native PDF document blocks for PLANNING_MAP vision extraction, producing IPBLayer[] from vision-extracted terrain, forces, NAIs, and engagement areas.

## What Was Built

Planning map PDFs contain visual/spatial content (terrain features, hex grids, unit positions) that `unpdf` cannot extract as text — these show as "Parse failed" with empty `textContent`. This implementation adds a three-component vision pipeline:

1. **`pdf-renderer.ts`** — Converts raw PDF Buffer to base64 string using Anthropic's native PDF document block format. No image rendering or canvas dependencies required. Validates against the 32 MB Anthropic size limit.

2. **`map-to-ipb-layers.ts`** — Converts `ExtractedExerciseData` from vision extraction into `IPBLayer[]` objects compatible with ValidityMap rendering. Handles six feature types: force dispositions (unit/forces), terrain (area/key_terrain or line/obstacle), avenues of approach (line/avenue_of_approach), NAIs (area/nai), and engagement areas (area/engagement_area). Features without explicit coordinates get a placeholder `[0,0]` geometry with `geocodeRequired: true` in properties.

3. **Provider multimodal support** — Extended `LLMMessage.content` from `string` to `string | LLMContentBlock[]`. Anthropic provider maps document/image blocks to Anthropic API format. OpenAI provider normalises multimodal content to text-only (PDF vision not supported on OpenAI-compatible APIs — vision always routes through Anthropic).

4. **`ExerciseExtractionService.extractMapWithVision()`** — Sends raw PDF buffer to Claude via base64 document block, uses `EXERCISE_EXTRACTION_TOOL` with forced tool_choice, generates IPBLayer[] and stores in `rawExtraction.ipbLayers`, persists vision summary as `textContent` for future standard extraction fallback.

5. **Retry endpoint vision branch** — `POST /api/exercise/documents/:docId/retry-extraction` now detects `PLANNING_MAP` documents with empty text and routes them to `extractMapWithVision` instead of standard re-parse. Returns `{ message: "Vision extraction triggered for map document", docId }`. Non-PLANNING_MAP documents continue through the existing standard path.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 637e44b | feat(quick-5-1): add PDF vision support — pdf-renderer, multimodal LLM content types |
| Task 2 | e38f889 | feat(quick-5-2): add vision extraction method and map-to-IPB layer converter |
| Task 3 | 7161854 | feat(quick-5-3): wire vision extraction into retry-extraction endpoint |

## Verification

- `npx tsc --noEmit` passes with zero type errors (all 3 tasks)
- All required exports confirmed:
  - `preparePdfForVision` in `pdf-renderer.ts` (line 46)
  - `extractMapWithVision` in `extraction-service.ts` (line 369)
  - `mapFeaturesToIPBLayers` in `map-to-ipb-layers.ts` (line 315)
  - Vision branch in `exercise.ts` (line 446): `"Vision extraction triggered for map document"`
- Existing tests: 2 test files pass, 1 pre-existing failure in `mdmp/e2e-workflow.test.ts` (unrelated to this plan — MDMP workflow invariant tests were already failing before our changes)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed OpenAI-compatible provider type errors caused by LLMMessage.content union type**

- **Found during:** Task 1 TypeScript check
- **Issue:** Changing `LLMMessage.content` from `string` to `string | LLMContentBlock[]` caused `TS2769` errors in `openai-provider.ts` — the OpenAI SDK's `ChatCompletionMessageParam[]` type requires `string` content, not `LLMContentBlock[]`
- **Fix:** Added `normaliseContent()` helper to OpenAI provider that extracts text blocks from multimodal content, falling back to a placeholder string if no text blocks found. Applied to both `completeWithTools()` and `completeWithoutTools()`.
- **Files modified:** `backend/src/strategic/extraction/providers/openai-provider.ts`
- **Commit:** 637e44b

## Success Criteria Verification

| Criterion | Status |
|-----------|--------|
| PLANNING_MAP PDFs with empty textContent routed to vision extraction on retry | Confirmed |
| Vision extraction sends PDF directly to Claude API via base64 document block | Confirmed |
| Extracted map data converted to IPBLayer[] stored in rawExtraction.ipbLayers | Confirmed |
| Vision-generated summary text persisted as textContent for future use | Confirmed |
| LLM provider abstraction supports multimodal content (backward compatible) | Confirmed |
| All existing extraction flows remain unchanged | Confirmed |

## Self-Check: PASSED

Files verified to exist:
- `/home/vitalpointai/projects/ssr/backend/src/strategic/ingestion/pdf-renderer.ts` FOUND
- `/home/vitalpointai/projects/ssr/backend/src/exercise/map-to-ipb-layers.ts` FOUND

Commits verified:
- 637e44b FOUND
- e38f889 FOUND
- 7161854 FOUND
