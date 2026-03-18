---
phase: 50-universal-intelligence-input
plan: "04"
subsystem: frontend/brain-ingestion
tags: [universal-input, ingestion-sidebar, sse-forwarding, smart-chips, unified-feed]
dependency_graph:
  requires: [50-02, 50-03]
  provides: [UNIV-12, UNIV-13, UNIV-18]
  affects: [frontend/src/components/brain/IngestionSidebar.tsx, frontend/src/components/brain/hooks/useBrainIngestion.ts]
tech_stack:
  added: []
  patterns: [SSE-forwarding-callback, unified-feed-merge, smart-suggestion-chips, collapsible-deprecation]
key_files:
  created:
    - frontend/src/components/brain/SmartSuggestionChips.tsx
  modified:
    - frontend/src/components/brain/IngestionSidebar.tsx
    - frontend/src/components/brain/IngestionSidebar.css
    - frontend/src/components/brain/hooks/useBrainIngestion.ts
decisions:
  - "SSE forwarding via callback rather than second EventSource — one connection for whole sidebar"
  - "Suggestion chip handler dismisses ambiguous item and re-submits with [pipeline:X] prefix hint"
  - "Unified feed merges IngestItem[] + IngestionEvent[] sorted newest-first by timestamp"
  - "Advanced section wraps old panels (not deleted) behind defaultOpen=false collapsible"
metrics:
  duration_seconds: 301
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_modified: 4
  files_created: 1
---

# Phase 50 Plan 04: Universal Ingestion Sidebar Integration Summary

Integration wiring: UniversalInputZone as primary surface + SmartSuggestionChips for low-confidence items + unified chronological feed + SSE classification event forwarding via single EventSource callback.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Wire UniversalInputZone into IngestionSidebar, deprecate old panels, add SmartSuggestionChips, unified feed | 62ef8a9a | IngestionSidebar.tsx, IngestionSidebar.css, SmartSuggestionChips.tsx |
| 2 | Extend useBrainIngestion to forward classification SSE events | 4498bb6f | useBrainIngestion.ts |

## What Was Built

### SmartSuggestionChips (new component)

`frontend/src/components/brain/SmartSuggestionChips.tsx`

- Only renders when `classification.confidence < 0.85` OR `suggestedPipeline === 'manual'` OR no classification yet
- Builds context-aware chips from classification metadata:
  - RSS signal: "Subscribe as RSS feed" / "Ingest as document"
  - Article/PDF: "Ingest as document" / "Add as OSINT source"
  - Raw text: "Treat as intelligence report" / "Treat as freeform note"
  - Unknown: 3-chip generic set
- Each chip: `<button>` with `aria-label`, calls `onSelect(itemId, pipeline)`
- Full ARIA `role="group"` with descriptive label

### IngestionSidebar Refactor

`frontend/src/components/brain/IngestionSidebar.tsx`

**Primary surface (UNIV-18):**
- `<UniversalInputZone problemSetId={...} />` rendered at top of sidebar, always visible
- "Advanced options..." link below it scrolls to/expands the Advanced section

**Deprecation (UNIV-18):**
- `CollapsibleSection title="Advanced" defaultOpen={false}` wraps:
  - DocIntelligencePanel (Document Upload)
  - OSINT Sources section
  - Documents list with delete
- Old code preserved exactly — no deletion

**Unified feed (UNIV-12):**
- Merges `universalItems` (IngestItem[]) + `events` (IngestionEvent[]) into single array
- Sorted newest-first by timestamp
- Each entry shows type badge: DOC (blue), RSS (orange), TEXT (gray), OSINT (green)
- `SOURCE_FILTERS` array filters unified feed by badge type
- `EventItem` renders legacy events; `IngestItemStatus` renders new items

**Smart suggestion chips (UNIV-13):**
- `<SmartSuggestionChips>` rendered below each IngestItem in the feed
- Only visible when item's classification is ambiguous/low-confidence
- On chip click: dismisses old item, re-submits with `[pipeline:X]` prefix for forced routing

### useBrainIngestion Extension

`frontend/src/components/brain/hooks/useBrainIngestion.ts`

- Added `onUniversalIngestEvent?: UniversalIngestEventCallback` optional 4th parameter
- Exported `UniversalIngestEventCallback` type alias
- Added listeners for: `classify:start`, `classify:result`, `route:selected`, `route:error`, `route:retry_success`
- Events parsed and forwarded to callback if provided
- Existing event handlers completely unchanged
- One EventSource connection shared between old and new pipeline events

## Verification

- TypeScript compilation: `npx tsc --noEmit` exits 0 (clean)
- IngestionSidebar imports and renders UniversalInputZone
- Old panels wrapped in "Advanced" section (not deleted)
- SmartSuggestionChips renders for ambiguous items with ARIA attributes
- useBrainIngestion forwards new SSE event types via callback

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- SmartSuggestionChips.tsx: FOUND
- 50-04-SUMMARY.md: FOUND
- Commit 62ef8a9a (Task 1): FOUND
- Commit 4498bb6f (Task 2): FOUND
- TypeScript: EXIT 0
