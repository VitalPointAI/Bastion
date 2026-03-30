---
phase: 65-ironclaw-autonomous-operations
plan: "04"
subsystem: ironclaw
tags: [autonomous, heartbeat, soul, identity, routine, brain-curation, governance]

dependency_graph:
  requires: ["65-02"]
  provides: ["autonomous_monitoring_routine", "proactive_soul_identity", "brain_curation_protocol"]
  affects: ["backend/src/ironclaw/routine-service.ts", "backend/src/ironclaw/ironclaw-service.ts", "backend/src/ironclaw/identity-renderer.ts", "backend/src/ironclaw/ironclaw-types.ts"]

tech_stack:
  added: []
  patterns: ["heartbeat-driven autonomous operation", "identity-file injection", "cron minimum enforcement"]

key_files:
  created: []
  modified:
    - backend/src/ironclaw/routine-service.ts
    - backend/src/ironclaw/ironclaw-service.ts
    - backend/src/ironclaw/identity-renderer.ts
    - backend/src/ironclaw/ironclaw-types.ts

decisions:
  - "Autonomous monitoring uses per-problem-set routine IDs (autonomous_monitoring__{psId}) so each operation has an independent heartbeat"
  - "15-minute minimum interval enforced in routine-service via cron field pattern match — warns and clamps rather than throwing"
  - "Autonomous monitoring registration is fire-and-forget in syncUserIdentity — never blocks identity sync or message flow"
  - "AUTONOMOUS_OPERATIONS_PROTOCOL is a top-level constant appended to every SOUL.md regardless of staff section"
  - "OperationalContext added to renderHeartbeatMd as optional param — allows live state injection when available"

metrics:
  duration: "4 min"
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_modified: 4
---

# Phase 65 Plan 04: Autonomous Monitoring Routine & Proactive SOUL Identity Summary

**One-liner:** Registered per-problem-set autonomous monitoring heartbeats (30-min default, 15-min minimum) and updated SOUL.md to establish Ironclaw as a proactive Chief of Staff with brain curation, self-extension governance, and decision surfacing protocols.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add autonomous monitoring routine and register on identity sync | 9a05c233 | routine-service.ts, ironclaw-service.ts, ironclaw-types.ts |
| 2 | Update SOUL.md for proactive Chief of Staff and self-extending governance | 4e55bd9d | identity-renderer.ts |
| 2b | Add OperationalContext to HEARTBEAT.md for autonomous directives | d0df34b4 | identity-renderer.ts |

## What Was Built

### Task 1 — Autonomous Monitoring Routine

**`routine-service.ts`:**
- Added `autonomous_monitoring` to `BUILT_IN_ROUTINES` — 30-minute default cron, category `monitoring`, editable
- Added `registerAutonomousMonitoring(problemSetId, cronOverride?)` — sends `/routine register autonomous_monitoring__{psId} "{cron}"` via `ironclawClient.sendMessage()`; enforces 15-minute minimum by detecting `*/N` cron patterns and clamping if N < 15; non-throwing (logs warning on failure)
- Added `unregisterAutonomousMonitoring(problemSetId)` — sends `/routine unregister autonomous_monitoring__{psId}`; non-throwing

**`ironclaw-types.ts`:**
- Added optional `autonomousMonitoring?: { enabled: boolean; intervalMinutes?: number }` to `AgentConfig`

**`ironclaw-service.ts`:**
- After identity sync completes in `syncUserIdentity`, calls `routineService.registerAutonomousMonitoring(psId, cronOverride)` for each ID in `config.activeOperationIds`
- Skips registration only when `autonomousMonitoring.enabled === false` (undefined = enabled)
- Fire-and-forget with `.catch()` — never blocks identity sync

### Task 2 — Proactive Chief of Staff SOUL Identity

**`identity-renderer.ts`:**
- Added `AUTONOMOUS_OPERATIONS_PROTOCOL` constant with:
  - 6-step heartbeat cycle (check events, curate brain, conflict detection, gap research, draft assessment, surface findings)
  - **Brain Curation Protocol**: evaluate relevance → augment slice → prune stale → log actions
  - **Self-Extension Protocol**: propose via `bastion.autonomous.send_alert` → medium-risk governance gate → register on approval
  - **Decision Surfacing**: critical/urgent/routine/informational tiers to prevent noise
- Protocol appended to every `renderSoulMd()` output regardless of staff section
- Commander `SOUL_TEMPLATES` entry updated to include "Review Ironclaw's autonomous activity feed" in cognitive style
- Added `OperationalContext` interface for live state injection into `HEARTBEAT.md`
- Enhanced `renderHeartbeatMd(config, operationalContext?)` — when context provided, injects Autonomous Monitoring Tasks, Current Operational Status, Callback Protocol, and Efficiency Rules

## Verification

- `tsc --noEmit` passes cleanly for all modified files (no errors)
- `BUILT_IN_ROUTINES` includes `autonomous_monitoring` entry (id, cron, category)
- `syncUserIdentity` calls `registerAutonomousMonitoring` for each active operation ID
- `renderSoulMd` output includes "Autonomous Operations Protocol" section
- Brain Curation Protocol is item 2 in heartbeat cycle (after checking new events)
- Self-extension routes through `bastion.autonomous.send_alert` → governance gate

## Deviations from Plan

### Auto-added enhancements

**1. [Rule 2 - Missing Critical Functionality] Added OperationalContext to renderHeartbeatMd**
- **Found during:** Task 2
- **Issue:** HEARTBEAT.md had no mechanism to inject live operational state (active PIRs, pending decisions, OSINT counts, callback URL) into the heartbeat directives. Without this, the autonomous heartbeat cycle described in SOUL.md couldn't reference specific current state.
- **Fix:** Added optional `OperationalContext` parameter to `renderHeartbeatMd()`. When provided, injects autonomous monitoring task list, current operational status with PIR priorities, callback POST protocol, and efficiency rules.
- **Files modified:** backend/src/ironclaw/identity-renderer.ts
- **Commit:** d0df34b4

## Self-Check: PASSED

Files verified:
- backend/src/ironclaw/routine-service.ts — FOUND, contains `autonomous_monitoring` and `registerAutonomousMonitoring`
- backend/src/ironclaw/ironclaw-service.ts — FOUND, contains `registerAutonomousMonitoring` call in `syncUserIdentity`
- backend/src/ironclaw/ironclaw-types.ts — FOUND, contains `autonomousMonitoring` field on `AgentConfig`
- backend/src/ironclaw/identity-renderer.ts — FOUND, contains `AUTONOMOUS_OPERATIONS_PROTOCOL` and `OperationalContext`

Commits verified:
- 9a05c233 — feat(65-04): add autonomous monitoring routine and wire to identity sync
- 4e55bd9d — feat(65-04): update SOUL.md with autonomous operations protocol
- d0df34b4 — feat(65-04): add OperationalContext to HEARTBEAT.md for autonomous directives
