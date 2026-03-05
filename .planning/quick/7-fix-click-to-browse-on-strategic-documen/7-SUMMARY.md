---
phase: quick-7
plan: 01
subsystem: ui
tags: [react, useRef, file-upload, drag-and-drop]

requires:
  - phase: none
    provides: n/a
provides:
  - "Working click-to-browse on strategic document upload dropzone"
affects: [strategic-documents]

tech-stack:
  added: []
  patterns: ["useRef + onClick for hidden file input triggering"]

key-files:
  created: []
  modified:
    - frontend/src/components/strategic/DocumentUpload.tsx
    - frontend/src/components/strategic/DocumentUpload.css

key-decisions:
  - "Replaced CSS absolute-position overlay with useRef + onClick pattern for reliability"

patterns-established:
  - "Hidden file input pattern: use display:none + ref.click() instead of CSS overlay"

requirements-completed: [QUICK-7]

duration: 1min
completed: 2026-03-05
---

# Quick Task 7: Fix Click-to-Browse on Strategic Document Upload Summary

**Replaced fragile CSS overlay file input with useRef + onClick pattern so clicking the dropzone opens the file browser**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-05T18:08:21Z
- **Completed:** 2026-03-05T18:09:11Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Fixed click-to-browse: clicking the upload dropzone now programmatically triggers the hidden file input via React ref
- Replaced fragile CSS absolute-position overlay (opacity:0) with clean display:none approach
- Drag-and-drop functionality preserved (handlers remain on dropzone div)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix click-to-browse using useRef pattern and clean up CSS** - `4091183` (fix)

## Files Created/Modified
- `frontend/src/components/strategic/DocumentUpload.tsx` - Added useRef, fileInputRef, handleDropzoneClick handler, onClick on dropzone div, ref on input
- `frontend/src/components/strategic/DocumentUpload.css` - Changed .file-input from absolute-position overlay to display:none

## Decisions Made
- Used useRef + onClick instead of fixing z-index on the CSS overlay -- the ref pattern is more reliable and avoids stacking context issues entirely

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript compiler (`npx tsc`) could not run due to Node.js version mismatch in default shell; resolved by sourcing nvm and switching to node v20. Compilation passed with no errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Fix is complete and ready for deployment
- No blockers or concerns

---
*Phase: quick-7*
*Completed: 2026-03-05*
