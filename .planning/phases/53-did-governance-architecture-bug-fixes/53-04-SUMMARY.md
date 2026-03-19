---
phase: 53-did-governance-architecture-bug-fixes
plan: "04"
subsystem: decisions
tags: [decisions, raci, rest-api, service-layer, delegation]
dependency_graph:
  requires: ["53-02"]
  provides: ["decision-service", "decisions-rest-api"]
  affects: ["backend/src/index.ts"]
tech_stack:
  added: []
  patterns: ["service-layer-over-stores", "requireAuth-middleware", "x-did-header"]
key_files:
  created:
    - backend/src/decisions/decision-service.ts
    - backend/src/api/decisions.ts
  modified:
    - backend/src/index.ts
decisions:
  - "Actor DID sourced from X-DID request header (matches existing project convention)"
  - "Actor position passed in request body (not derived from session) to allow flexible role testing"
  - "RACI auto-seeds on getRACIMatrix() when no assignments exist for a problem set"
  - "Only commander/xo positions can modify RACI or delegate authority (enforced in both service and API)"
metrics:
  duration: "~6 min"
  completed: "2026-03-19"
  tasks: 2
  files: 3
---

# Phase 53 Plan 04: Decision Service and REST API Summary

**One-liner:** RACI-aware decision service + 11-endpoint REST API wiring Plan 02 stores to the backend surface.

## What Was Built

Decision management now has a full backend: a service layer that enforces RACI roles and a REST API that the Decide tab (Plan 05) and Ironclaw (Plan 05) will consume.

### Task 1 — Decision service with RACI enforcement and auto-seeding
**Commit:** 668e33ab

`backend/src/decisions/decision-service.ts` — `DecisionService` class with:
- `getRACIMatrix()` — auto-seeds JP 5-0 defaults from problem_sets.echelon when matrix is empty
- `getPendingForPosition()` — filters pending decisions to only those where position holds R or A
- `createDecision()` — validates decision_type exists in RACI matrix before inserting
- `actOnDecision()` — checks actor position has R or A for the decision type before updating status
- `updateRACIAssignment()` — commander/xo-only guard before calling raciStore.upsert()
- `getDashboardSummary()` — counts by status + recent 20 decisions

### Task 2 — Decision REST API + mount in index.ts
**Commit:** e369cd8e

`backend/src/api/decisions.ts` — 11 route handlers, all behind `requireAuth`:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/:psId` | List decisions (filterable by status, type) |
| GET | `/:psId/summary` | Dashboard counts + recent 20 |
| GET | `/:psId/pending/:position` | Pending decisions for a staff position |
| POST | `/:psId` | Create decision request |
| PATCH | `/:psId/:decisionId` | Act on decision (approve/reject/defer/info_requested) |
| GET | `/:psId/raci` | Get RACI matrix (auto-seeds if empty) |
| PUT | `/:psId/raci` | Update RACI assignment (commander/xo only) |
| POST | `/:psId/raci/delegate` | Delegate authority (commander/xo only) |
| POST | `/:psId/raci/revoke` | Revoke delegation |
| GET | `/:psId/raci/delegations` | Active delegations for problem set |
| GET | `/:psId/raci/:assignmentId/history` | Delegation audit trail |

`backend/src/index.ts` — `decisionsRouter` imported and mounted at `/api/decisions` near existing gate/governance routes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript: req.params type and req.session access**
- **Found during:** Task 2 — first tsc compile attempt
- **Issue:** Express `req.params` members typed as `string | string[]`; `req.session` not on base `Request` type
- **Fix:** Cast all `req.params.*` to `string`; replaced session-based DID with `req.headers['x-did'] as string` (matches existing project convention in planning.ts, doc-intelligence.ts)
- **Files modified:** backend/src/api/decisions.ts
- **Commit:** e369cd8e (inline in task commit)

## Verification

```
bash -lc 'cd backend && npx tsc --noEmit'
→ zero errors
```

- decisions.ts router has GET/POST/PATCH/PUT/DELETE endpoints ✓
- index.ts mounts `/api/decisions` ✓
- decisionService enforces RACI roles on actOnDecision ✓
- RACI auto-seeds on getRACIMatrix when matrix is empty ✓

## Self-Check: PASSED

Files exist:
- backend/src/decisions/decision-service.ts ✓
- backend/src/api/decisions.ts ✓

Commits exist:
- 668e33ab — feat(53-04): Decision service with RACI enforcement and auto-seeding
- e369cd8e — feat(53-04): Decision REST API + mount in index.ts
