---
phase: 60-rearchitect-ironclaw-integration
plan: 03
subsystem: ironclaw-identity
tags: [ironclaw, identity, agent-config, blueprint-phase-2, per-user, soul-md]
dependency_graph:
  requires: [60-01]
  provides: [agent-config-store, identity-renderer, syncUserIdentity, agent-config-api]
  affects: [ironclaw-service, ironclaw-types, backend-api]
tech_stack:
  added: []
  patterns: [upsert-on-conflict, fire-and-forget-sync, session-start-freshness-check, soul-templates]
key_files:
  created:
    - backend/src/ironclaw/ironclaw-types.ts (AgentConfig types appended)
    - backend/src/db/migrations/049-agent-config.sql
    - backend/src/ironclaw/agent-config-store.ts
    - backend/src/ironclaw/identity-renderer.ts
    - backend/src/api/agent-config.ts
  modified:
    - backend/src/ironclaw/ironclaw-service.ts
    - backend/src/index.ts
decisions:
  - "clearanceLevel intentionally omitted from AgentConfig — resolved from VC claims at runtime per blueprint security model"
  - "syncUserIdentity is fire-and-forget from handleMessage — identity sync never blocks message flow"
  - "Session start tracked via in-memory Map per user — identity re-synced on first message of each server session"
  - "agentConfigRouter mounted behind requireAuth in index.ts (same pattern as ironclawRouter)"
metrics:
  duration: 6 min
  completed_date: 2026-03-28
  tasks: 2
  files: 7
---

# Phase 60 Plan 03: Per-User Identity System (AgentConfig) Summary

Per-user AgentConfig data model, identity file renderer, syncUserIdentity, and REST API for Blueprint Phase 2 — "one agent, many lenses."

## What Was Built

### Task 1: AgentConfig types, migration, store, and identity renderer

**ironclaw-types.ts** — Added to existing file (not replaced):
- `StaffSection`, `OutputFormat`, `TonePreference`, `NotificationLevel` union types
- `CustomSkill`, `RoutineSpec` interfaces
- `AgentConfig` interface with all blueprint fields — `clearanceLevel` intentionally absent per security design

**049-agent-config.sql** — Migration for bastion-postgres (NOT ironclaw-postgres):
- `agent_config` table with all AgentConfig fields as columns
- `near_account` index for fast lookups
- `updated_at` auto-update trigger

**agent-config-store.ts** — Singleton `agentConfigStore`:
- `getByDid(did)` — SELECT by primary key
- `upsert(config)` — INSERT ... ON CONFLICT (did) DO UPDATE, re-reads after save
- `getByNearAccount(nearAccount)` — SELECT by NEAR account
- `createDefault(did, nearAccount)` — creates sensible first-time config

**identity-renderer.ts** — Four render functions:
- `renderUserMd(config)` — Identity, rank, position, unit, HQ, operations, AOR
- `renderSoulMd(config)` — Staff-section-specific personality via `SOUL_TEMPLATES` (10 sections: Commander, S1, S2, S3, S4, S6, S9, XO, CSM, Other), appends `customPersonaInstructions`
- `renderHeartbeatMd(config)` — Monitoring directives, Telegram config, scheduled routines
- `renderAgentsMd(config)` — Enabled skill packs and custom skills

### Task 2: REST API routes and syncUserIdentity

**agent-config.ts** (new) — Express router `agentConfigRouter`:
- `GET /api/agent-config/:userId` — returns config, auto-creates default on first access
- `PUT /api/agent-config/:userId` — validates required fields, upserts, fires syncUserIdentity
- Both endpoints enforce auth: requesting DID must match target DID

**ironclaw-service.ts** — Two additions:
1. `syncUserIdentity(did, config)` — writes 4 identity files to `users/{didSlug}/identity/*.md` via webhook `/file write` commands; updates `identityLastSyncedAt` after
2. `handleMessage()` modified — checks identity freshness at session start (tracks first-message time per user via `sessionStartTimes` Map); syncs if `identityLastSyncedAt` is null or predates session start (fire-and-forget, never blocks)

**index.ts** — `agentConfigRouter` imported and mounted at `/api/agent-config` behind `requireAuth`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All created files exist on disk. Both task commits (12c09df0, fc68c78d) verified in git log.
