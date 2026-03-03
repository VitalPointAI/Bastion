---
phase: quick-3
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/strategic/AgentAssignmentModal.tsx
autonomous: true
requirements: [QUICK-3]
must_haves:
  truths:
    - "Agent assignment modal successfully POSTs to the correct backend endpoint"
    - "Backend receives documentId in the request body and creates the assignment"
    - "Modal closes and triggers onAssigned callback on successful assignment"
  artifacts:
    - path: "frontend/src/components/strategic/AgentAssignmentModal.tsx"
      provides: "Fixed agent assignment modal with correct API endpoint"
  key_links:
    - from: "frontend/src/components/strategic/AgentAssignmentModal.tsx"
      to: "backend/src/api/strategic.ts POST /assignments"
      via: "fetch POST to /api/strategic/assignments"
      pattern: "fetch.*api/strategic/assignments"
---

<objective>
Fix the 404 error when assigning agents to strategic documents in AgentAssignmentModal.

Purpose: The modal currently POSTs to `/api/strategic/documents/{id}/agents` which does not exist. The backend expects `POST /api/strategic/assignments` with `{ documentId, agentId }` in the body.

Output: Working agent assignment from the modal UI.
</objective>

<execution_context>
@/home/vitalpointai/.claude/get-shit-done/workflows/execute-plan.md
@/home/vitalpointai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/strategic/AgentAssignmentModal.tsx
@backend/src/api/strategic.ts (lines 2150-2210 — POST /assignments endpoint)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix AgentAssignmentModal API endpoint and request body</name>
  <files>frontend/src/components/strategic/AgentAssignmentModal.tsx</files>
  <action>
In the `handleAssign` function (around line 106), change the fetch URL from:
```
`${API_BASE}/api/strategic/documents/${encodeURIComponent(documentId)}/agents`
```
to:
```
`${API_BASE}/api/strategic/assignments`
```

Update the request body (around line 114) to include `documentId` as required by the backend. The backend expects `{ documentId, agentId, autoReview?, reviewOptions? }`. Change the body from:
```json
{
  "agentId": selectedAgentId,
  "teamId": selectedTeamId,
  "assignmentType": assignmentType
}
```
to:
```json
{
  "documentId": documentId,
  "agentId": selectedAgentId || selectedTeamId,
  "autoReview": assignmentType === "monitor"
}
```

Note: The backend assignment system uses `agentId` for both agents and teams. The `autoReview` field maps to the "monitor" assignment type. The backend does not have a separate `assignmentType` field — `autoReview: true` indicates monitoring behavior, and the default `false` covers review/analyze use cases.
  </action>
  <verify>
Run `cd /home/vitalpointai/projects/ssr/frontend && npx tsc --noEmit` to confirm no TypeScript errors.
Visually confirm the fetch URL in the code points to `/api/strategic/assignments` and the body includes `documentId`.
  </verify>
  <done>
AgentAssignmentModal POSTs to `/api/strategic/assignments` with `{ documentId, agentId, autoReview }` in the body. No more 404 on agent assignment.
  </done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- The fetch URL in AgentAssignmentModal matches the backend route `POST /api/strategic/assignments`
- The request body includes `documentId` (required by backend)
- The request body includes `agentId` (required by backend)
</verification>

<success_criteria>
Agent assignment from the modal no longer returns 404. The POST hits `/api/strategic/assignments` and the backend creates the assignment record.
</success_criteria>

<output>
After completion, create `.planning/quick/3-fix-agent-assignment-404-on-strategic-do/3-SUMMARY.md`
</output>
