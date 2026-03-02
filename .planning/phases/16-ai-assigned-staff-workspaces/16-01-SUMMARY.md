---
phase: 16-ai-assigned-staff-workspaces
plan: "01"
subsystem: exercise/ai-workspace
tags: [database, typescript, ai-agents, staff-workspaces, migration]
dependency_graph:
  requires: [backend/database/016-staff-workspaces.sql, backend/src/exercise/types.ts]
  provides:
    - backend/database/017-ai-staff-workspaces.sql (6 AI workspace tables + role_assignments column)
    - backend/src/exercise/types.ts (AI workspace domain types)
    - backend/src/exercise/agent-library.ts (31-role default agent library, 108 agents)
  affects:
    - backend/src/exercise/scenario-store.ts (updated rowToScenario for role_assignments)
    - All plans in Phase 16 (depend on these tables and types existing)
tech_stack:
  added: []
  patterns: [JSONB for role assignments, PostgreSQL arrays for tools/personality, TypeScript strict types]
key_files:
  created:
    - backend/database/017-ai-staff-workspaces.sql
    - backend/src/exercise/agent-library.ts
  modified:
    - backend/src/exercise/types.ts
    - backend/src/exercise/scenario-store.ts
decisions:
  - "roleAssignments added to both ExerciseScenario (required) and CreateExerciseScenario (optional) to maintain backward compatibility with existing scenario creation code"
  - "108 total agents across 31 roles: commander(3), dcom(3), cos(4), j1(3), j2(4), j3(5), j35(5), j4(4), j5(4), j6(3), j7(3), j8(3), j9(3), sja(3), polad(3), pao(3), surgeon(3), cyber(4), space(3), transcom(3), socom(4), io(3), fires(4), ew(3), jfacc(4), jflcc(4), jfmcc(4), jfsocc(3), engineer(3), cbrn(3), knowledge_mgmt(3)"
  - "Migration applied immediately to database — all 6 tables confirmed present"
metrics:
  duration: 8 min
  completed: 2026-03-02
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 16 Plan 01: AI Staff Workspace Foundation Summary

**One-liner:** PostgreSQL migration (6 tables + JSONB column) plus TypeScript types and 108-agent doctrinal library covering all 31 JPP staff roles.

## What Was Built

### Task 1: Database Migration (017-ai-staff-workspaces.sql)

Applied migration creating all 7 required database objects:

1. `role_assignments JSONB` column on `exercise_scenarios` — per-position human|ai|disabled state
2. `staff_agents` table — default AI agent definitions indexed by role_key
3. `ai_role_runs` table — execution run tracking with status lifecycle (queued→running→paused→awaiting_review→complete|failed)
4. `ai_channel_events` table — structured activity log for AI-assigned roles
5. `staff_product_versions` table — full version history for AI-generated drafts
6. `ai_context_store` table — shared real-time context store (scenario_id, role_key composite PK)
7. `ai_coordination_log` table — complete audit trail for AI-to-AI coordination events

Migration was applied to the database and all 6 tables confirmed via pg_tables query.

### Task 2: TypeScript Types + 31-Role Agent Library

**Types added to `backend/src/exercise/types.ts`:**
- `RoleAssignment` union type (`'human' | 'ai' | 'disabled'`)
- `StaffAgentDef` interface (9 required fields: id, roleKey, name, rank, branch, specialty, focus, tools, personality, systemPromptHint, isDefault)
- `AIRoleRun` interface with full trigger type and status lifecycle
- `AIChannelEvent` interface with 13 event types
- `StaffProductVersion` interface with annotated feedback support
- `ReviewFeedback` interface with 5 reviewer actions
- `CreateAIRoleRun` input type
- `roleAssignments: Record<string, RoleAssignment>` field on `ExerciseScenario`

**Agent library (`backend/src/exercise/agent-library.ts`):**
- 108 agents across all 31 staff roles
- Every agent has singular focus (no overlap within same role team)
- Role-appropriate ranks: COL/BG for command, LTC for section chiefs, MAJ for action officers, CPT for specialists, CW2-CW4 for technical specialties
- Doctrinal branch assignments: IN, AR, FA, AV, EN, SC, MI, CYBER, SF, TC, QM, OD, JA, PA, MC, CA, AG, FA48, FA59, FA30, FA26, CM
- Exports: `DEFAULT_AGENT_LIBRARY`, `getDefaultAgentsForRole()`, `generateAgentLibrarySQLInserts()`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing role_assignments mapping in scenario-store.ts**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `rowToScenario()` did not map the new `role_assignments` column, causing `ExerciseScenario` interface mismatch (required field missing)
- **Fix:** Added `roleAssignments: (row.role_assignments as Record<string, RoleAssignment> | null) ?? {}` to the row mapper
- **Files modified:** `backend/src/exercise/scenario-store.ts`
- **Commit:** 6d5d4a1

**2. [Rule 1 - Bug] roleAssignments not excluded from CreateExerciseScenario Omit**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `CreateExerciseScenario` inherited `roleAssignments` as a required field from `ExerciseScenario`, breaking existing API code in `exercise.ts` that creates scenarios without specifying role assignments
- **Fix:** Added `'roleAssignments'` to the Omit tuple and added it as an optional field in the extension type
- **Files modified:** `backend/src/exercise/types.ts`
- **Commit:** 6d5d4a1

## Verification Results

1. `SELECT count(*) FROM information_schema.tables WHERE table_name IN (...)` → **6** (all 6 tables confirmed)
2. `\d exercise_scenarios | grep role_assignments` → column confirmed: `role_assignments | jsonb | not null | '{}'::jsonb`
3. `npx tsc --noEmit` → **PASS, zero errors**
4. `grep -c "roleKey:" agent-library.ts` → **108** (one per agent)
5. All 31 role keys verified with minimum 3 agents each

## Self-Check: PASSED

Files confirmed present:
- `backend/database/017-ai-staff-workspaces.sql` — EXISTS
- `backend/src/exercise/agent-library.ts` — EXISTS
- `backend/src/exercise/types.ts` — MODIFIED, contains StaffAgentDef
- `backend/src/exercise/scenario-store.ts` — MODIFIED, maps role_assignments

Commits confirmed:
- `18ff89b` — chore(16-01): create AI staff workspace database migration
- `6d5d4a1` — feat(16-01): add AI workspace TypeScript types and complete 31-role agent library

## Commits

| Hash | Message |
|------|---------|
| 18ff89b | chore(16-01): create AI staff workspace database migration |
| 6d5d4a1 | feat(16-01): add AI workspace TypeScript types and complete 31-role agent library |
