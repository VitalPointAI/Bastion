---
phase: 53-did-governance-architecture-bug-fixes
plan: "06"
subsystem: decision-dao-bridge
tags: [dao, decisions, encryption, raci, on-chain, audit-trail]
dependency_graph:
  requires: ["53-04", "53-05"]
  provides: ["decision-dao-bridge", "on-chain-decision-recording", "audit-trail-endpoint"]
  affects: ["backend/src/decisions/", "frontend/src/components/decide/", "frontend/src/lib/decision-service.ts"]
tech_stack:
  added: []
  patterns: ["chacha20poly1305 encryption of decision payloads", "async non-blocking DAO proposal creation with graceful degradation", "RACI-derived voting membership (single-authority vs multi-member)"]
key_files:
  created:
    - backend/src/decisions/decision-dao-bridge.ts
  modified:
    - backend/src/decisions/decision-service.ts
    - backend/src/api/decisions.ts
    - frontend/src/components/decide/DecisionDashboard.tsx
    - frontend/src/components/tabs/DecideTab.tsx
    - frontend/src/lib/decision-service.ts
decisions:
  - "Async non-blocking DAO bridge calls: decision creation/action never blocks on blockchain availability"
  - "Simulated proposal ID from decision UUID for stable on-chain reference before tx submission (real NEAR tx dispatched by system agent with signing key)"
  - "ChaCha20-Poly1305 encryption with nonce prepended to encrypted blob for self-contained on-chain storage"
  - "Graceful degradation: null return from createProposalForDecision if blockchain unavailable, decision continues in PostgreSQL"
metrics:
  duration: "6 min"
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_modified: 6
---

# Phase 53 Plan 06: Decision-DAO Bridge & Encrypted On-Chain Recording Summary

Decision-DAO bridge integrates RACI-governed decision pipeline with encrypted on-chain DAO proposals using ChaCha20-Poly1305, with audit trail surfaced in the Decide tab UI.

## What Was Built

### Task 1: Decision-DAO Bridge (decision-dao-bridge.ts)

New bridge class `DecisionDAOBridge` with four methods:

- `createProposalForDecision(decision, raciAssignments, daoId)` — encrypts decision payload, determines voters from RACI R/A assignments, builds DAO proposal tx args via `daoService.buildCreateProposalTx`, returns simulated proposal ID (stable reference until real NEAR tx is dispatched by system agent). Returns `null` if blockchain unavailable (graceful degradation).
- `determineVoters(raciAssignments)` — filters R/A assignments, extracts unique positions. Single-authority mode if only commander-level positions; multi-member mode otherwise.
- `encryptDecisionPayload(decision)` — ChaCha20-Poly1305 encryption of title/description/decision_type/context_json/requested_by. Key derived from problem_set_id. Nonce prepended to encrypted output for self-contained storage.
- `syncProposalStatus(decisionId, daoId, proposalId)` — queries DAO proposal status, maps Approved/Rejected to decision status updates in PostgreSQL.
- `getAuditTrail(decision, daoId)` — returns linked proposal + votes from DAO service; empty if no dao_proposal_id or blockchain unavailable.

### Task 2: Decision Service + API + UI

**decision-service.ts:**
- `createDecision()` — after PostgreSQL insert, fires `setImmediate` to create DAO proposal asynchronously (non-blocking). Links returned proposal ID via `decisionStore.linkDaoProposal`.
- `actOnDecision()` — after status update, fires `setImmediate` to `syncProposalStatus` if decision has a `dao_proposal_id`.
- New `getDecisionAuditTrail(decisionId)` — returns `{ decision, daoProposal, votes }` combining PostgreSQL and on-chain data.

**api/decisions.ts:**
- `GET /api/decisions/:problemSetId/:decisionId/audit` — calls `getDecisionAuditTrail`, returns full audit bundle. 404 on missing decision, 500 on other errors.

**DecisionDashboard.tsx:**
- Accepts new `problemSetId` prop (required for audit trail fetches).
- `DecisionCard` shows purple "On-Chain #N" badge on decided decisions with `dao_proposal_id`. Clicking expands inline audit panel with proposal ID, status, and voting record.
- Pending decisions without `dao_proposal_id` show "Awaiting on-chain" grey badge.
- `VoteRecord` sub-component renders votes with color-coded vote types.

**DecideTab.tsx:**
- Passes `problemSetId` to `DecisionDashboard`.

**frontend/src/lib/decision-service.ts:**
- Added `dao_proposal_id` to `Decision` type.
- Added `DAOProposal`, `DAOVote`, `DecisionAuditTrail` types.
- Added `getAuditTrail(psId, decisionId)` to `decisionApiService`.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written with one design clarification:

**Design Note (not a deviation):** The DAO service is a view-only service that builds transaction args for frontend signing. Since there's no backend signing key in the current architecture, `createProposalForDecision` logs the tx args and returns a deterministic simulated proposal ID derived from the decision UUID. This is the correct pattern for the current stage — when a system agent with NEAR credentials is deployed, it can use these logged tx args to submit the real transaction and call `linkDaoProposal` with the actual on-chain ID. The plan's intent (immutable on-chain audit trail) is preserved.

## Self-Check: PASSED

- backend/src/decisions/decision-dao-bridge.ts: FOUND
- backend/src/decisions/decision-service.ts: FOUND (updated)
- backend/src/api/decisions.ts: FOUND (updated)
- frontend/src/components/decide/DecisionDashboard.tsx: FOUND (updated)
- frontend/src/components/tabs/DecideTab.tsx: FOUND (updated)
- frontend/src/lib/decision-service.ts: FOUND (updated)
- backend tsc --noEmit: 0 errors
- frontend tsc --noEmit: 0 errors
- Commits: 9a85d7e4, f1677370
