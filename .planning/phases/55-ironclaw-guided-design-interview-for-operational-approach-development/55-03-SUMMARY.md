---
phase: 55
plan: 03
status: complete
started: 2026-03-23
completed: 2026-03-23
---

# Plan 55-03 Summary: REST API & MCP Tool Wiring

## What was built

Wired the design interview service into both the REST API and Ironclaw's MCP tool system.

### Task 1: REST API Routes
- Created `backend/src/api/design-interview.ts` with 5 endpoints:
  - `POST /:problemSetId/start` — Start new interview
  - `POST /:problemSetId/continue` — Continue with user message
  - `POST /:problemSetId/confirm-section` — Confirm section review gate
  - `GET /:problemSetId/state` — Get current state for resume
  - `DELETE /:problemSetId` — Reset interview
- Mounted at `/api/design-interview` with `requireAuth` in `index.ts`

### Task 2: MCP Tool & Action Handler
- Added `bastion.design.update_section` to `BASTION_TOOLS` array in `tool-bridge.ts`
- Added `design.update_section: medium` to `ACTION_RISK` map in `ironclaw-types.ts`
- Added `designUpdateSection` handler in `builder-handlers.ts`:
  - Calls `designStore.updateSection()` for persistence
  - Publishes `design.section_updated` WebSocket event for real-time frontend updates

## Key files

### Created
- `backend/src/api/design-interview.ts` — REST router

### Modified
- `backend/src/index.ts` — Router mount
- `backend/src/ironclaw/tool-bridge.ts` — MCP tool registration
- `backend/src/ironclaw/ironclaw-types.ts` — Risk classification
- `backend/src/ironclaw/builder-handlers.ts` — Action handler

## Commits
- `13111565` — feat(55-03): create REST API routes for design interview and mount in index
- `a3446a38` — feat(55-03): register bastion.design.update_section MCP tool and handler

## Deviations
None.

## Self-Check: PASSED
