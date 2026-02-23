---
phase: quick-3
plan: 1
subsystem: frontend/strategic
tags: [bug-fix, api, fetch, agent-assignment]
dependency_graph:
  requires: []
  provides: [working-agent-assignment-from-modal]
  affects: [frontend/src/components/strategic/AgentAssignmentModal.tsx]
tech_stack:
  added: []
  patterns: [fetch POST to backend REST endpoint]
key_files:
  created: []
  modified:
    - frontend/src/components/strategic/AgentAssignmentModal.tsx
decisions:
  - "Map assignmentType==='monitor' to autoReview:true — backend uses boolean not string for monitoring behavior"
  - "Use selectedAgentId || selectedTeamId as agentId — backend uses single agentId field for both agents and teams"
metrics:
  duration: 5min
  completed: 2026-02-23
---

# Quick Task 3: Fix Agent Assignment 404 on Strategic Do — Summary

**One-liner:** Fixed 404 by changing POST target from `/api/strategic/documents/{id}/agents` to `/api/strategic/assignments` with correct `{ documentId, agentId, autoReview }` body.

## What Was Done

The `AgentAssignmentModal` component was POSTing to a non-existent route, causing a 404 on every agent assignment attempt. The backend has a single assignment endpoint at `POST /api/strategic/assignments` that requires `documentId` and `agentId` in the request body.

### Changes Made

**`frontend/src/components/strategic/AgentAssignmentModal.tsx`** — `handleAssign()` function (lines 106-120):

**Before:**
```ts
const response = await fetch(
  `${API_BASE}/api/strategic/documents/${encodeURIComponent(documentId)}/agents`,
  {
    method: 'POST',
    ...
    body: JSON.stringify({
      agentId: assignmentMode === 'agent' ? selectedAgentId : undefined,
      teamId: assignmentMode === 'team' ? selectedTeamId : undefined,
      assignmentType,
    }),
  }
);
```

**After:**
```ts
const response = await fetch(
  `${API_BASE}/api/strategic/assignments`,
  {
    method: 'POST',
    ...
    body: JSON.stringify({
      documentId,
      agentId: selectedAgentId || selectedTeamId,
      autoReview: assignmentType === 'monitor',
    }),
  }
);
```

## Verification

- TypeScript compiled with no errors (`tsc --noEmit`)
- URL confirmed pointing to `/api/strategic/assignments`
- Request body confirmed including `documentId` and `agentId`
- `autoReview` correctly mapped from `assignmentType === 'monitor'`

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix AgentAssignmentModal API endpoint and request body | 4a1ad87 | frontend/src/components/strategic/AgentAssignmentModal.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- File exists: `frontend/src/components/strategic/AgentAssignmentModal.tsx` — FOUND
- Commit exists: `4a1ad87` — FOUND
- TypeScript: no errors
