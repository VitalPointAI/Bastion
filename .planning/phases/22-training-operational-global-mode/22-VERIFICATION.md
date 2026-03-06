---
phase: 22-training-operational-global-mode
verified: 2026-03-06T01:00:00Z
status: human_needed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "Full mode toggle flow end-to-end"
    expected: "Click toggle in header -> confirmation modal appears -> confirm -> amber EXERCISE banner appears -> workspaces refresh -> navigate to home"
    why_human: "Requires running application to verify UI rendering, modal behavior, and navigation"
  - test: "Mode persistence across page refresh"
    expected: "Switch to training mode, refresh page, mode should still be training with banner visible"
    why_human: "Requires running backend and frontend together to test API persistence and reload behavior"
  - test: "EXERCISE watermark on exported documents"
    expected: "In training mode, export OPORD as PDF/DOCX -> file has EXERCISE watermark/header and EXERCISE_ filename prefix"
    why_human: "Requires running document generation pipeline and inspecting output files"
  - test: "Scenario-to-workspace creation"
    expected: "POST /api/workspaces/from-scenario with valid scenarioId creates a training-mode workspace with scenario data"
    why_human: "Requires running backend with database and seeded scenario data"
---

# Phase 22: Training/Operational Global Mode Verification Report

**Phase Goal:** Global app-level toggle that switches the entire BASTION instance between training (exercise) and operational modes -- same UI, same workflow, same AI agents, different data context and consequence level
**Verified:** 2026-03-06T01:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Global mode toggle exists in header, requires confirmation, persisted per user | VERIFIED | `UserStatusBar.tsx` has mode toggle button calling `requestModeSwitch`; `ModeConfirmationModal.tsx` intercepts switches; `user-mode.ts` API persists to `user_profiles.app_mode` via GET/PUT endpoints |
| 2 | Training mode shows amber EXERCISE banner, operational shows clean UI | VERIFIED | `ExerciseBanner.tsx` renders sticky amber banner; `App.tsx:93` conditionally renders `{isTraining && <ExerciseBanner />}` |
| 3 | Workspaces are tagged with mode and filtered by active mode | VERIFIED | `workspace-store.ts` has `mode` column with index on workspaces table; `listForUser()` method filters by `w.mode = $2`; `WorkspaceContext.tsx` passes mode to `listMyMemberships(userDID, mode)` |
| 4 | AAR event capture exists for training workspaces | VERIFIED | `aar-store.ts` (162 lines) creates `aar_events` table, provides `record()` and query methods; append-only design; initialized in `exercise.ts` on startup |
| 5 | Exercise checkpoint snapshot/restore exists | VERIFIED | `checkpoint-store.ts` (173 lines) creates `exercise_checkpoints` table, provides `createCheckpoint()`, `listForWorkspace()`, `restoreCheckpoint()` methods; restore does not touch AAR events |
| 6 | EXERCISE watermark applied to training-mode document exports | VERIFIED | `exercise-watermark.ts` provides `isTrainingMode()`, `addPdfExerciseWatermark()`, `addExerciseHeader()`; `pdf-generator.ts` and `docx-generator.ts` both apply watermark when `exerciseMode` is true; `planning.ts` routes apply `modeMiddleware` and pass `exerciseMode: isTrainingMode(req)` to generators |
| 7 | Scenario-to-workspace creation creates training workspace | VERIFIED | `workspaces.ts` has `POST /from-scenario` endpoint; `workspace-service.ts` has `createFromScenario()` method; scenario workspace always created with `mode: 'training'` |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/api/user-mode.ts` | Mode GET/PUT API endpoints | VERIFIED | 77 lines, GET/PUT with Zod validation, DB queries for app_mode, registered at `/api/user-mode` in index.ts |
| `backend/src/middleware/mode-context.ts` | Mode extraction middleware | VERIFIED | 45 lines, exports `modeMiddleware`, reads app_mode from user_profiles, sets `req.userMode`, non-blocking with operational default |
| `backend/src/workspace/types.ts` | AppMode type and Workspace.mode field | VERIFIED | `AppMode = 'training' | 'operational'` on line 10, `mode: AppMode` in Workspace interface (line 29), `mode?: AppMode` in CreateWorkspaceInput (line 103) |
| `backend/src/workspace/workspace-store.ts` | Mode-aware workspace listing | VERIFIED | 339 lines, mode column migration (line 52-55), mode in mapRow (line 110), `listForUser(userDid, mode)` method (line 242-253), mode in createWorkspace (line 137-178) |
| `frontend/src/context/ModeContext.tsx` | ModeProvider with useMode hook | VERIFIED | 161 lines, exports `ModeProvider` and `useMode`, API sync on mount, confirmation flow (requestModeSwitch/confirmModeSwitch/cancelModeSwitch), renders ModeConfirmationModal |
| `frontend/src/components/ExerciseBanner.tsx` | Amber EXERCISE banner | VERIFIED | 30 lines, sticky top amber banner, z-index 9999, role="status", aria-live="polite" |
| `frontend/src/components/ModeConfirmationModal.tsx` | Confirmation dialog | VERIFIED | 127 lines, mode-specific warnings, Cancel/Confirm buttons, loading state |
| `frontend/src/components/UserStatusBar.tsx` | Mode toggle button in header | VERIFIED | Imports and uses `useMode`, renders mode toggle button with amber (training) / green (operational) styling |
| `backend/src/exercise/aar-store.ts` | AAR event capture store | VERIFIED | 162 lines, exports `aarStore` singleton, `record()`, `listByWorkspace()`, `listByScenario()` methods, aar_events table with indexes |
| `backend/src/exercise/checkpoint-store.ts` | Exercise checkpoint store | VERIFIED | 173 lines, exports `checkpointStore` singleton, `createCheckpoint()`, `listForWorkspace()`, `getCheckpoint()`, `restoreCheckpoint()` methods |
| `backend/src/middleware/exercise-watermark.ts` | Document watermark utility | VERIFIED | 71 lines, exports `isTrainingMode()`, `addPdfExerciseWatermark()`, `addExerciseHeader()`, `getExerciseFilenamePrefix()` |
| `frontend/src/context/WorkspaceContext.tsx` | Mode-aware workspace filtering with per-mode persistence | VERIFIED | Imports `useMode`, uses `getActiveWorkspaceKey(mode)` for mode-keyed localStorage, mode in loadMemberships dependency array, clears active workspace on mode change |
| `frontend/src/lib/workspace-service.ts` | Mode parameter on listMyMemberships, createFromScenario | VERIFIED | `listMyMemberships(userDID, mode?)` appends `?mode=` query param; `createFromScenario(scenarioId, name?)` POSTs to `/from-scenario` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `user-mode.ts` | `user_profiles` table | `pool.query` for `app_mode` | WIRED | GET queries `SELECT app_mode`, PUT does `UPDATE app_mode` |
| `mode-context.ts` | `user_profiles` table | `SELECT app_mode` | WIRED | Reads mode, sets `req.userMode` |
| `workspace-store.ts` | `workspaces` table | `WHERE w.mode = $2` | WIRED | `listForUser()` filters by mode |
| `ModeContext.tsx` | `/api/user-mode` | `fetch GET/PUT` | WIRED | Fetches on mount with credentials, PUTs on confirm |
| `UserStatusBar.tsx` | `ModeContext.tsx` | `useMode` hook | WIRED | Destructures `mode, isTraining, requestModeSwitch` |
| `App.tsx` | `ModeContext.tsx` | `ModeProvider` wrapping `WorkspaceProvider` | WIRED | ModeProvider inside AuthenticatedShell, wraps WorkspaceProvider |
| `WorkspaceContext.tsx` | `ModeContext.tsx` | `useMode()`, mode in dependency array | WIRED | `const { mode } = useMode()`, mode passed to `listMyMemberships(userDID, mode)` |
| `WorkspaceContext.tsx` | `/api/workspaces/me` | `mode` query parameter | WIRED | `workspace-service.ts` appends `?mode=${mode}` |
| `exercise-watermark.ts` | `pdf-generator.ts` | watermark injection | WIRED | PDF generator imports and calls `addPdfExerciseWatermark()` and `addExerciseHeader()` when `exerciseMode` |
| `exercise-watermark.ts` | `docx-generator.ts` | exercise header | WIRED | DOCX generator adds EXERCISE header paragraph and filename prefix when `exerciseMode` |
| `planning.ts` routes | `mode-context.ts` + `exercise-watermark.ts` | `modeMiddleware` + `isTrainingMode(req)` | WIRED | Document routes use modeMiddleware, pass `exerciseMode: isTrainingMode(req)` to generators |
| `workspaces.ts` | `scenario-store` | `POST /from-scenario` | WIRED | Loads scenario via `scenarioStore.findById()`, creates workspace with `mode: 'training'` |
| `exercise.ts` | `aar-store.ts`, `checkpoint-store.ts` | `init()` calls | WIRED | Both stores initialized on server startup via `aarStore.init()` and `checkpointStore.init()` |

### Requirements Coverage

No explicit requirement IDs were assigned to this phase. Coverage is assessed against the phase goal capabilities:

| Capability | Status | Evidence |
|------------|--------|----------|
| Global mode toggle | SATISFIED | User-mode API + ModeContext + UserStatusBar toggle |
| Confirmation before switch | SATISFIED | ModeConfirmationModal with mode-specific warnings |
| Visual distinction (EXERCISE banner) | SATISFIED | ExerciseBanner component, conditional rendering |
| Data isolation (mode-tagged workspaces) | SATISFIED | Workspace mode column, mode-filtered queries |
| Mode persistence | SATISFIED | Server-side in user_profiles.app_mode |
| Per-mode workspace memory | SATISFIED | Mode-keyed localStorage in WorkspaceContext |
| AAR event capture | SATISFIED | aar-store.ts with append-only events |
| Exercise checkpoints | SATISFIED | checkpoint-store.ts with snapshot/restore |
| EXERCISE watermark on documents | SATISFIED | PDF watermark + header, DOCX header, filename prefix |
| Scenario-to-workspace creation | SATISFIED | POST /from-scenario endpoint + frontend service |
| Train tab removal | SATISFIED | WORKSPACE_TABS has 5 entries (cop, decide, design, campaign, overview), no train references |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | - | - | - | - |

No TODO, FIXME, placeholder, or stub patterns found in any phase-modified files. All implementations are substantive. TypeScript compiles cleanly for both frontend and backend with zero errors.

### Human Verification Required

### 1. Full Mode Toggle Flow

**Test:** Start app, log in, click mode toggle button in header, verify confirmation modal appears, cancel (verify nothing changes), toggle again and confirm
**Expected:** Amber EXERCISE banner appears at top, button shows TRAINING, app navigates to workspace home, workspace list shows only training-mode workspaces
**Why human:** Requires running full application stack to verify UI rendering, modal interaction, and navigation behavior

### 2. Mode Persistence Across Refresh

**Test:** Switch to training mode, refresh page
**Expected:** Mode remains training with EXERCISE banner visible (fetched from server on mount)
**Why human:** Requires running backend API to test server-side persistence round-trip

### 3. Document EXERCISE Watermark

**Test:** In training mode, export an OPORD as PDF and DOCX
**Expected:** PDF has diagonal red EXERCISE watermark and header; DOCX has EXERCISE header paragraph; both filenames prefixed with EXERCISE_
**Why human:** Requires document generation pipeline to run and output inspection

### 4. Scenario-to-Workspace Creation

**Test:** POST to /api/workspaces/from-scenario with a valid scenarioId
**Expected:** Creates a training-mode workspace with scenario data, adds requesting user as commander
**Why human:** Requires database with seeded scenarios

### Gaps Summary

No code-level gaps found. All 7 observable truths are verified through code analysis: artifacts exist, are substantive (no stubs), and are properly wired together. TypeScript compiles cleanly for both frontend and backend.

The phase goal of a global training/operational mode toggle is fully implemented in code. The remaining verification items are runtime behaviors that require human testing with a running application stack.

---

_Verified: 2026-03-06T01:00:00Z_
_Verifier: Claude (gsd-verifier)_
