---
phase: 66-ironclaw-memory-evolution-and-concept-learning
plan: 02
subsystem: ironclaw/activity-feed
tags: [commander-feedback, rating-ui, autonomous-activity, reinforcement-learning]
dependency_graph:
  requires: [66-01]
  provides: [commander-ratings, activity-outcome-tracking, rated-activities-query]
  affects: [IronclawActivityFeed, autonomous-activity-store, ironclaw-router]
tech_stack:
  added: []
  patterns: [optimistic-update-with-revert, idempotent-migration]
key_files:
  created: []
  modified:
    - backend/src/ironclaw/autonomous-activity-store.ts
    - backend/src/ironclaw/ironclaw-router.ts
    - frontend/src/components/ironclaw/IronclawActivityFeed.tsx
    - frontend/src/types/ironclaw.ts
decisions:
  - "30-second delay before showing rating controls prevents premature feedback on just-created entries"
  - "Optimistic rating update with revert-on-error provides immediate UI feedback without blocking"
  - "Rating validated as exactly 1 or -1 at API boundary (T-66-05 threat mitigation)"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-05"
  tasks: 2
  files: 4
---

# Phase 66 Plan 02: Commander Activity Rating Summary

Commander feedback on autonomous activity entries — thumbs up/down with optional notes, persisted via REST API, rendered inline on each activity card.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend activity store with outcome tracking and rating endpoint | af361fac | autonomous-activity-store.ts, ironclaw-router.ts |
| 2 | Thumbs up/down rating UI on activity feed cards | 081918d2 | IronclawActivityFeed.tsx, ironclaw.ts |

## What Was Built

### Backend (Task 1)

**autonomous-activity-store.ts** — Three new columns added to `ironclaw_autonomous_activity`:
- `outcome_status TEXT NOT NULL DEFAULT 'pending'` — derived from rating sign
- `commander_rating SMALLINT` — 1 = thumbs up, -1 = thumbs down, null = unrated
- `commander_notes TEXT` — optional text annotation

Both the `CREATE TABLE IF NOT EXISTS` statement and idempotent `ALTER TABLE ADD COLUMN IF NOT EXISTS` migrations are included for existing deployments.

`ActivityEntry` interface extended with `outcomeStatus`, `commanderRating`, `commanderNotes`. `rowToEntry()` mapper updated. Two new methods:
- `updateOutcome(id, rating, notes)` — persists commander feedback
- `getRatedActivities(problemSetId, since)` — retrieves rated entries for Plan 06 reinforcement learning

**ironclaw-router.ts** — `PATCH /:problemSetId/activity/:activityId/rate` endpoint added. Input validated: rating must be exactly `1` or `-1`, returning 400 otherwise (T-66-05 mitigation).

### Frontend (Task 2)

**IronclawActivityFeed.tsx** — Rating row added below summary text on each activity card:
- Renders only for activities older than 30 seconds (prevents premature feedback)
- Thumbs-up button: emerald-400 highlight when active (`text-emerald-400 bg-emerald-900/20`)
- Thumbs-down button: red-400 highlight when active (`text-red-400 bg-red-900/20`)
- Notes input appears inline after a rating is selected; submits on blur or Enter
- `aria-label` and `aria-pressed` for accessibility
- Optimistic update: rating applied immediately, reverted if fetch fails

**ironclaw.ts** — `AutonomousActivityEntry` extended with optional `commanderRating`, `commanderNotes`, `outcomeStatus` fields.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Worktree Reset Side Effect

The initial `git reset --soft` to the base commit left staging area changes that accidentally deleted 16 planning files (plan files, context files, 66-01-SUMMARY) and Plan 01 concept store files in the first commit. Immediately detected and corrected via a restoration commit (`cdf82935`) that recovered all deleted files from their original commits.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|-----------|
| T-66-05 | PATCH endpoint validates rating is exactly 1 or -1; rejects other values with 400 |
| T-66-06 | Activity ownership enforced by existing `requireAuth` middleware on ironclaw-router; no additional action needed |

## Known Stubs

None — all rating fields wire directly to the API and persist to database.

## Self-Check: PASSED

Files exist:
- backend/src/ironclaw/autonomous-activity-store.ts — FOUND (contains `outcome_status TEXT`, `commander_rating SMALLINT`, `commander_notes TEXT`, `updateOutcome(`, `getRatedActivities(`)
- backend/src/ironclaw/ironclaw-router.ts — FOUND (contains `activity/:activityId/rate`)
- frontend/src/components/ironclaw/IronclawActivityFeed.tsx — FOUND (contains all acceptance criteria strings)
- frontend/src/types/ironclaw.ts — FOUND (extended with rating fields)

Commits exist:
- af361fac — feat(66-02): extend activity store with outcome tracking and rating endpoint
- cdf82935 — chore(66-02): restore planning files and concept store
- 081918d2 — feat(66-02): add commander thumbs up/down rating UI to activity feed
