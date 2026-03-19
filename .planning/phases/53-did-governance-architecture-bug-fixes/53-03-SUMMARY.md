---
phase: 53-did-governance-architecture-bug-fixes
plan: "03"
subsystem: identity/ironclaw
tags: [did, governance, action-pipeline, per-agent, risk-classification]
dependency_graph:
  requires: ["53-01"]
  provides: ["AgentGovernancePolicy interface", "DIDDocument governance field", "ActionPipeline per-agent risk resolution"]
  affects: ["backend/src/identity/types.ts", "backend/src/identity/did-service.ts", "backend/src/ironclaw/action-pipeline.ts"]
tech_stack:
  added: []
  patterns: ["Per-agent governance cache in ActionPipeline", "Risk-only-elevate override pattern", "Encrypted governance data in DID document"]
key_files:
  created: []
  modified:
    - backend/src/identity/types.ts
    - backend/src/identity/did-service.ts
    - backend/src/ironclaw/action-pipeline.ts
decisions:
  - "Governance overrides live in ActionPipeline cache, not ActionRegistry — registry locks at startup and cannot accept per-agent changes afterward"
  - "Risk can only be elevated via governance overrides, never downgraded (enforced in getEffectiveRisk)"
  - "Phase 53 MVP uses setGovernancePolicy() for direct cache population — full DID resolution path deferred (requires agent userSecret)"
  - "Governance data encrypted inside DID document blob — no smart contract changes"
  - "Backward compatible: existing agents without governance field use ACTION_RISK defaults"
metrics:
  duration_seconds: 211
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
  completed_date: "2026-03-19T15:01:54Z"
requirements: [REQ-53-05, REQ-53-06]
---

# Phase 53 Plan 03: DID Governance Schema + ActionPipeline Per-Agent Risk Resolution Summary

**One-liner:** Added `AgentGovernancePolicy` interface to DID schema and `agentGovernanceCache` + `getEffectiveRisk()` to ActionPipeline for per-agent risk override with risk-only-elevate semantics.

## What Was Built

### Task 1: Extend DIDDocument with governance + update DID creation
Commit: `682a07d3`

Added `AgentGovernancePolicy` interface to `backend/src/identity/types.ts` with:
- `actionRiskOverrides` — per-action-type risk level overrides (elevation only)
- `rateLimitOverrides` — per-risk-bucket rate limit overrides
- `additionalProtectedKeys` — additional config keys protected from agent modification
- `allowedActions` / `blockedActions` — per-agent action permission lists
- `policyVersion` — schema version for forward compatibility

Added `governance?: AgentGovernancePolicy` field to `DIDDocument` interface, positioned after `service?`.

Updated `createDID()` in `did-service.ts` to conditionally add a default governance section (`{ policyVersion: 1 }`) when `entityType === 'AiAgent'`. The governance data rides inside the existing `encrypted_document` blob — no separate encryption step, no smart contract changes.

### Task 2: ActionPipeline governance cache + per-agent risk resolution
Commit: `4f8ee863`

Added to `ActionPipeline` class in `backend/src/ironclaw/action-pipeline.ts`:

- **`agentGovernanceCache`** — `Map<string, AgentGovernancePolicy>` keyed by agent DID
- **`getEffectiveRisk(actionType, agentDid?)`** — resolves effective risk by consulting both the locked registry defaults AND per-agent governance overrides. Risk-only-elevate invariant enforced: overrides cannot reduce risk below the registry baseline. Blocked actions and unlisted actions (when allowedActions is specified) treated as `'high'`.
- **`loadAgentGovernance(agentDid)`** — stub for future full DID resolution path; Phase 53 MVP delegates to `setGovernancePolicy()`.
- **`setGovernancePolicy(agentDid, policy)`** — direct cache population for session initialization code that has access to the resolved DID document.

Updated `processAction()` to accept optional `agentDid` parameter and use `this.getEffectiveRisk()` for all risk lookups. Updated `handleEmergencyAction()` similarly. All three `actionRegistry.getRiskLevel()` call sites in the pipeline now route through `getEffectiveRisk()`.

## Decisions Made

1. **Governance overrides in ActionPipeline, not ActionRegistry** — The registry locks at startup and cannot accept per-agent changes afterward. The pipeline can consult both the locked registry defaults and per-agent overrides.

2. **Risk-only-elevate invariant** — `getEffectiveRisk()` enforces that governance overrides can only raise the risk level. An override of `'low'` on an action with a `'medium'` baseline is ignored; the baseline wins.

3. **Phase 53 MVP: direct cache population via `setGovernancePolicy()`** — Full DID resolution requires the agent's `userSecret` which is not available inside the pipeline. Session initialization code (which has DID access) populates the cache directly. `loadAgentGovernance()` is a stub for future phases.

4. **Backward compatibility** — Agents whose DID documents lack a `governance` field get no cache entry. `getEffectiveRisk()` falls back to registry defaults when no cache entry exists.

5. **No smart contract changes** — Governance data is encrypted inside the existing `encrypted_document` blob along with the rest of the DID document.

## Verification

- `bash -lc 'cd backend && npx tsc --noEmit'` — zero errors (confirmed twice)
- `types.ts` exports `AgentGovernancePolicy` interface — confirmed
- `DIDDocument` interface has `governance?: AgentGovernancePolicy` — confirmed
- `did-service.ts` createDID adds governance for AiAgent type — confirmed
- `action-pipeline.ts` has `agentGovernanceCache` Map and `getEffectiveRisk()` — confirmed
- `processAction()` calls `getEffectiveRisk()` not `actionRegistry.getRiskLevel()` directly — confirmed

## Deviations from Plan

None — plan executed exactly as written with one minor addition: `handleEmergencyAction()` was also updated to accept optional `agentDid` and use `getEffectiveRisk()` for consistency (the plan referenced ~3 call sites; the emergency action path was the third).
