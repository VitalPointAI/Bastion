---
phase: 60-rearchitect-ironclaw-integration
plan: 06
subsystem: ironclaw-agent-config
tags: [routines, heartbeat, knowledge-sync, agent-config, blueprint-phase-5]
completed: "2026-03-28"

dependency_graph:
  requires: [60-05]
  provides: [IC-05-ROUTINES, IC-05-HEARTBEAT, IC-05-KNOWLEDGE-SYNC]
  affects: [frontend/agent-config, backend/ironclaw]

tech_stack:
  added: []
  patterns:
    - "Mirrored built-in definitions pattern: static definitions in both backend and frontend to avoid an API call for unchanging catalog data"
    - "Fire-and-forget session-start hook: syncUserKnowledge runs on first message via sessionStartTimes check, never blocks message flow"
    - "Category-badged routine cards: visual distinction between knowledge/monitoring/reporting routine types"

key_files:
  created:
    - backend/src/ironclaw/routine-service.ts
    - frontend/src/components/agent-config/tabs/RoutinesTab.tsx
    - frontend/src/components/agent-config/components/RoutineEditor.tsx
  modified:
    - backend/src/ironclaw/ironclaw-service.ts
    - frontend/src/components/agent-config/AgentConfigPanel.tsx

decisions:
  - "Built-in routine definitions mirrored in frontend (not fetched from API) — they are static catalog data that only changes on deploy, avoiding unnecessary API calls and simplifying the UI"
  - "syncUserKnowledge piggybacked on existing sessionStartTimes check — no new in-memory state needed, fires on first message of each server session"
  - "initializeRoutines called in startupInit() after health check succeeds — same startup path as MCP registration, ensures Ironclaw is confirmed available before routine registration"
  - "enabledBuiltIns state local to RoutinesTab (not persisted to AgentConfig) — built-in routine enable/disable is a Ironclaw scheduler concern, not user config; toggle affects Ironclaw registration via webhook"

metrics:
  duration: "5 min"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 60 Plan 06: Routines Tab, RoutineEditor, and Knowledge Sync Summary

**One-liner:** RoutinesTab with 4 built-in routines (knowledge sync, capability update, daily brief), RoutineEditor with cron presets, heartbeat directives textarea, and knowledge sync writes BASTION_CONTEXT.md to Ironclaw workspace on session start and every 6 hours.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | routine-service.ts with BUILT_IN_ROUTINES, RoutineService class, ironclaw-service.ts modifications | 9a35bfd7 |
| 2 | RoutinesTab, RoutineEditor, AgentConfigPanel Routines tab registration | 5590f6b1 |

## What Was Built

### routine-service.ts (new)

**BuiltInRoutine interface** — `id`, `name`, `description`, `defaultCron` (nullable for event-triggered), `editable`, `category`

**BUILT_IN_ROUTINES (4 definitions):**

| ID | Name | Cron | Category | Editable |
|----|------|------|----------|---------|
| bastion_knowledge_sync | Shared Knowledge Sync | `0 */6 * * *` | knowledge | true |
| bastion_user_knowledge_sync | User Knowledge Sync (Login) | null (event-triggered) | knowledge | false |
| weekly_capability_update | Weekly Capability Update | `0 9 * * 1` | monitoring | true |
| daily_situation_brief | Daily Situation Brief | `0 6 * * *` | reporting | true |

**RoutineService class:**
- `syncKnowledge()` — queries active problem sets and agents, writes `shared/knowledge/BASTION_CONTEXT.md` to Ironclaw workspace
- `syncUserKnowledge(did)` — queries user's problem set memberships, writes `users/{slug}/knowledge/USER_CONTEXT.md`
- `registerRoutine(routineId, cron)` — sends `/routine register` command to Ironclaw webhook
- `unregisterRoutine(routineId)` — sends `/routine unregister` command
- `registerUserRoutines(did, routines)` — iterates enabled custom routines and registers each

### ironclaw-service.ts (modified)

- Import `routineService` from `./routine-service.js`
- `initializeRoutines()` — iterates BUILT_IN_ROUTINES, registers each with a cron via `routineService.registerRoutine()`. Non-blocking on individual failures.
- `startupInit()` — calls `await this.initializeRoutines()` after health check succeeds (before return)
- `handleMessage()` — calls `routineService.syncUserKnowledge(userDid)` fire-and-forget on first message of session (inside `!sessionStart` block)

### RoutinesTab.tsx (new)

Three sections:
1. **Built-in Routines** — lists all 4 BUILT_IN_ROUTINES with enable/disable toggles (editable only), category badges (knowledge/monitoring/reporting), human-readable cron descriptions. Non-editable routines show a green always-active dot.
2. **Custom Routines** — lists `config.customRoutines` with toggle, edit, delete actions. "Add Routine" button opens RoutineEditor.
3. **Heartbeat Directives** — textarea bound to `config.heartbeatDirectives` with example placeholder for standing monitoring instructions.

### RoutineEditor.tsx (new)

Modal editor with:
- Name text input (required)
- Description textarea
- Schedule: preset dropdown (8 options: every hour through weekly) + free-text cron input that sync bidirectionally
- `describeCron()` helper shows human-readable schedule below the cron input
- Enable/disable toggle
- 5-field cron validation before save
- Save/Cancel with proper state management

### AgentConfigPanel.tsx (modified)

- Import `RoutinesTab`
- `TabId` union extended with `'routines'`
- TABS array gets 5th entry: `{ id: 'routines', label: 'Routines' }`
- Render case for `activeTab === 'routines'`

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- `backend/src/ironclaw/routine-service.ts` — FOUND
- `frontend/src/components/agent-config/tabs/RoutinesTab.tsx` — FOUND
- `frontend/src/components/agent-config/components/RoutineEditor.tsx` — FOUND

Commits verified:
- `9a35bfd7` — Task 1 (routine-service.ts + ironclaw-service.ts)
- `5590f6b1` — Task 2 (RoutinesTab + RoutineEditor + AgentConfigPanel)

TypeScript: backend `tsc --noEmit` — clean. Frontend `tsc --noEmit` — clean.
