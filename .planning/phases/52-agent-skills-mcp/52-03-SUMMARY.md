---
phase: 52-agent-skills-mcp
plan: "03"
subsystem: ironclaw
tags: [ironclaw, builder, action-handlers, crud, tool-bridge]
dependency_graph:
  requires: []
  provides:
    - ironclaw/builder-handlers.ts — dispatch map for all 19 approved action types
    - ironclaw/tool-bridge.ts — closes execution loop after action pipeline approval
  affects:
    - ironclaw/ironclaw-types.ts — 5 new skill action types registered
    - ironclaw/action-registry.ts — canonical descriptions for skill action types
tech_stack:
  added: []
  patterns:
    - Dispatch map pattern (BUILDER_HANDLERS) for action type → handler function
    - Dynamic imports for optional skill modules (graceful degradation)
    - Idempotent CRUD via existence checks before create/assign operations
key_files:
  created:
    - backend/src/ironclaw/builder-handlers.ts
  modified:
    - backend/src/ironclaw/ironclaw-types.ts
    - backend/src/ironclaw/action-registry.ts
    - backend/src/ironclaw/tool-bridge.ts
decisions:
  - "Skill handlers use dynamic imports so Plan 52-03 can execute independently of Plan 52-02"
  - "Idempotency via existence check rather than ON CONFLICT (stores vary — registry uses Map, DB uses upsert)"
  - "No new builder handler for delegation/read actions — those are not CRUD operations"
metrics:
  duration: 20min
  completed: "2026-03-19T13:30:00Z"
  tasks_completed: 2
  files_modified: 4
---

# Phase 52 Plan 03: Ironclaw Builder Action Handlers Summary

Closed the execution gap in tool-bridge.ts: builder-handlers.ts dispatch map routes approved actions to store/registry CRUD calls, enabling Ironclaw to actually create/update/delete agents, tools, teams, and skills after pipeline approval.

## What Was Built

### Task 1: Skill Action Types Registration

Added 5 skill action types to `ironclaw-types.ts` ACTION_RISK map:
- `skill.create` (medium), `skill.update` (medium), `skill.delete` (high)
- `skill.assign` (low), `skill.unassign` (low)

Added matching canonical descriptions to `action-registry.ts` CANONICAL_DESCRIPTIONS map.

`field.write` and `field.write_sensitive` were already present — no changes needed.

### Task 2: builder-handlers.ts + tool-bridge.ts wiring

Created `backend/src/ironclaw/builder-handlers.ts` with:
- `BUILDER_HANDLERS` — dispatch map covering all 19 action types (14 existing + 5 skill)
- `executeApprovedAction(actionType, payload, userDid)` — entry point used by tool-bridge
- Per-handler validation (required field checks), idempotency (existence checks), clear error messages
- Agent handlers: create/update/delete/activate/deactivate (use AgentRegistry + AgentStore)
- Tool handlers: create/update/delete/assign_to_agent (use ToolRegistry)
- Team handlers: create/update/delete/add_member/remove_member (use TeamRegistry)
- Skill handlers: create/update/delete/assign/unassign (dynamic imports, graceful failure if skill modules absent)

Updated `backend/src/ironclaw/tool-bridge.ts`:
- Added import of `executeApprovedAction` from builder-handlers
- Step 5 added to `handleToolCall`: when `actionPipeline.processAction` returns `status === 'executed'`, calls `executeApprovedAction` and merges result or marks as denied on failure

## Decisions Made

1. **Dynamic imports for skill handlers** — skill-registry.ts and skill-store.ts (created in Plan 52-02) are loaded lazily via `await import(...)`. If Plan 52-02 hasn't executed yet, skill handlers fail gracefully with a descriptive error rather than crashing at startup.

2. **Idempotency via existence checks** — `agent.create`, `tool.create`, `team.create`, `tool.assign_to_agent`, `team.add_member` check for existing records and return `already_exists`/`already_assigned`/`already_member` instead of throwing. This prevents duplicate-key errors if an action is replayed.

3. **No handler for delegation/read actions** — `agent.list_active`, `agent.get_status`, `agent.assign_to_problem_set`, etc. are not CRUD builder actions. `executeApprovedAction` returns `success: false` with a clear "No builder handler registered" message for unknown types, which tool-bridge logs but does not treat as a hard failure.

## Deviations from Plan

None — plan executed exactly as written. The `field.write` and `field.write_sensitive` types in Task 1 were already present in the codebase; no addition was needed.

### Pre-existing Issues (Out of Scope, Tracked)

Pre-existing TypeScript errors in `ironclaw-service.ts`, `self-update-service.ts`, and `mcp-server.ts` were present before this plan executed (caused by prior SuggestionPayload addition). Documented in `deferred-items.md`.

## Verification

- `bash -lc 'cd backend && npx tsc --noEmit'` — PASSED (clean, zero errors from this plan's changes)
- `BUILDER_HANDLERS` exports 19 entries (verified via grep)
- `executeApprovedAction` exported from builder-handlers.ts
- `tool-bridge.ts` calls `executeApprovedAction` when `status === 'executed'`
- `ironclaw-types.ts` has all 5 skill action types at correct risk levels

## Self-Check: PASSED

- builder-handlers.ts: FOUND
- tool-bridge.ts: FOUND (modified)
- ironclaw-types.ts: FOUND (modified)
- action-registry.ts: FOUND (modified)
- Commit 5ed0c244: FOUND
- Commit de12536e: FOUND
