---
phase: 58-on-chain-resource-did-caveats-with-contract-enforcement
plan: "02"
subsystem: backend/resources
tags: [backend, postgresql, near, resource-caveats, did-registry, roe, releasability, geo-bounds, migration, api]
dependency_graph:
  requires: ["58-01"]
  provides: [046-resource-caveats migration, ResourceCaveats TypeScript types, ResourceStore caveat methods, storeResourceCaveatsOnChain, checkEmploymentAuthViaRPC, resource-caveat-service, PATCH /:id/caveats, GET /:id/employment-check]
  affects: [backend/src/db/migrations/046-resource-caveats.sql, backend/src/resources/types.ts, backend/src/resources/resource-store.ts, backend/src/near/tx-signer.ts, backend/src/resources/resource-caveat-service.ts, backend/src/api/resources.ts]
tech_stack:
  added: []
  patterns: [DB-as-source-of-truth with fire-and-forget on-chain sync, system HKDF secret for resource DID transactions, requireAuth on new endpoints only, Zod body validation, Express route ordering to prevent /:id shadowing]
key_files:
  created:
    - backend/src/db/migrations/046-resource-caveats.sql
    - backend/src/resources/resource-caveat-service.ts
  modified:
    - backend/src/resources/types.ts
    - backend/src/resources/resource-store.ts
    - backend/src/near/tx-signer.ts
    - backend/src/api/resources.ts
key_decisions:
  - "System HKDF secret (bastion-system accountId) signs resource caveat on-chain transactions — resource DIDs are admin-owned per Pitfall 3 from Phase 58 research"
  - "On-chain sync is fire-and-forget (soft failure) — DB is authoritative, chain is immutable audit layer only"
  - "New API endpoints use requireAuth; existing unauthenticated resource endpoints untouched"
  - "New routes placed before generic /:id catch-all to prevent Express matching 'caveats'/'employment-check' as resource IDs"
  - "Backfill migration sets caveat_classification='UNCLASSIFIED' and caveat_roe_tier=5 for existing DID-registered resources, signaling chain-sync readiness"
metrics:
  duration_minutes: 5
  completed_date: "2026-03-26"
  tasks_completed: 2
  files_modified: 6
---

# Phase 58 Plan 02: Resource Caveats Backend Summary

**One-liner:** Backend infrastructure for resource caveat enforcement: DB migration with backfill, TypeScript types, ResourceStore caveat CRUD, tx-signer on-chain bridge helpers, permission-gated caveat service, and two new authenticated API endpoints.

## What Was Built

### Task 1: DB Migration + Types + ResourceStore Methods

**Migration `046-resource-caveats.sql`:**
- 8 new columns on `resources` table: `caveat_classification`, `caveat_releasability`, `caveat_geo_bounds`, `caveat_roe_tier`, `caveat_time_windows`, `caveat_employment_constraints`, `caveat_updated_at`, `caveat_on_chain_synced_at`
- 2 indexes: `idx_resource_caveat_roe_tier`, `idx_resource_caveat_classification`
- REQ-58-03 backfill: sets `caveat_classification='UNCLASSIFIED'` and `caveat_roe_tier=5` for all existing DID-registered resources so they are on-chain sync ready

**`backend/src/resources/types.ts`** — New exports:
- `CaveatClassification` — 4-value enum: UNCLASSIFIED / SECRET / TOPSECRET / TS_SCI
- `GeoBounds` — integer coords (degrees * 1_000_000) matching contract i64 representation
- `TimeWindow` — Unix ms start/end
- `ResourceCaveats` — full caveat set with optional updatedAt, onChainSyncedAt
- `EmploymentContext` — requesting account, location, timestamp, ROE tier, nation code
- `EmploymentAuthResult` — authorized boolean + reasons list

**`backend/src/resources/resource-store.ts`** — New methods on `ResourceStore`:
- `updateResourceCaveats(id, caveats)` — writes caveat columns (camelCase → snake_case)
- `getResourceCaveats(id)` — reads caveat columns, returns null when unset
- `markCaveatOnChainSynced(id)` — sets `caveat_on_chain_synced_at = NOW()`

### Task 2: tx-signer Helpers + Caveat Service + API Endpoints

**`backend/src/near/tx-signer.ts`** — New exported functions:
- `storeResourceCaveatsOnChain(userSecret, blindedKeyHex, caveats)` — calls `update_resource_caveats` on DID contract with 0.005 NEAR storage deposit; serializes TS camelCase to Rust snake_case
- `checkEmploymentAuthViaRPC(blindedKeyHex, context)` — NEAR RPC view call to `check_employment_authorized`; decodes result buffer to `EmploymentAuthResult`; returns `{ authorized: false, reasons: ['RPC call failed'] }` on error

**`backend/src/resources/resource-caveat-service.ts`** (new file):
- `ResourceCaveatService.updateResourceCaveats(resourceId, problemSetId, callerDid, caveats)`:
  - Permission check: `problemSetMemberStore.getMember` — caller must be commander or XO
  - DB write via `resourceStore.updateResourceCaveats` (source of truth)
  - Fire-and-forget on-chain sync using system HKDF secret; marks sync on success
  - Throws coded errors: `FORBIDDEN` (403) and `NOT_FOUND` (404)
- `ResourceCaveatService.checkEmploymentAuth(resourceId, context)`:
  - Gets resource blinded key from DB
  - Returns `{ authorized: false, reasons: ['Resource not registered'] }` when no blinded key
  - Delegates to `checkEmploymentAuthViaRPC`

**`backend/src/api/resources.ts`** — New endpoints:
- `PATCH /:id/caveats` — requireAuth, Zod-validated body `{ problemSetId, caveats }`, calls `caveatService.updateResourceCaveats`, returns `{ success: true }` or 403/404/500
- `GET /:id/employment-check` — requireAuth, parses `bounds`, `roeTier`, `nationCode` query params, builds EmploymentContext, calls `caveatService.checkEmploymentAuth`

Both new routes placed before the parametric `router.get('/:id')` catch-all.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All files exist and both commits (f497a17a, 643421e8) verified in git history.
