---
phase: 67-ironclaw-sse-streaming-event-driven-agent-communication
plan: "02"
subsystem: ironclaw-sse
tags: [sse, streaming, ironclaw-service, event-emission, token-streaming]
dependency_graph:
  requires:
    - ironclawEventStore singleton (from 67-01)
    - ironclaw_events PostgreSQL table (from 67-01)
    - IronclawEventType + payload types (from 67-01)
  provides:
    - SSE event emission for all Ironclaw chat responses
    - Simulated token streaming (word-chunk deltas + done:true final)
    - Ack events on user message receipt
    - Delegation events when Ironclaw routes to a specialist
    - tool_call + tool_result events for auto-executed low-risk tools
    - error events on tool execution failure
  affects:
    - backend/src/ironclaw/ironclaw-service.ts
tech_stack:
  added: []
  patterns:
    - Simulated token streaming via word-chunk split with accumulated text
    - satisfies type assertion for payload type safety (T-67-06 mitigation)
    - SSE event emission replacing WebSocket publishToChannel for chat delivery
    - Backward-compatible dual write: SSE + ironclawStore.addMessage for ironclaw_chat
key_files:
  created: []
  modified:
    - backend/src/ironclaw/ironclaw-service.ts
decisions:
  - id: D-67-02-01
    summary: "processResponse receives userDid param to scope SSE append calls correctly"
    rationale: ironclawEventStore.append requires userDid; processResponse previously had no user context
  - id: D-67-02-02
    summary: "Action cards emitted as single done:true event (no streaming) — tool approval UX needs stable display"
    rationale: Word-chunking a card JSON description would break the approval UI; streaming reserved for text responses
  - id: D-67-02-03
    summary: "publishToChannel retained for non-chat WebSocket events (COP updates, notifications)"
    rationale: Plan explicitly requires keeping the function; only chat delivery call sites replaced
metrics:
  duration_minutes: 25
  completed_date: "2026-04-09"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 67 Plan 02: SSE Event Emission in ironclaw-service Summary

SSE event emission wired into ironclaw-service.ts replacing all publishToChannel chat delivery calls with ironclawEventStore.append() calls, implementing simulated token streaming for text responses (word-chunk deltas + done:true final event).

## What Was Built

Modified `backend/src/ironclaw/ironclaw-service.ts` to:

1. **Import SSE infrastructure** — added `ironclawEventStore`, `IronclawEventType`, and all payload type imports from the Plan 01 artifacts.

2. **User message ack** — `handleMessage` and `handleGlobalMessage` now emit `IronclawEventType.ack` events immediately after storing the user message, replacing the old `publishToChannel('ironclaw.user-message')` calls.

3. **Delegation event** — `processResponse` emits `IronclawEventType.delegation` when `specialistId` is present in the response, before any response content is delivered.

4. **Tool call + tool result events** — The auto-execute low-risk tool path now emits `IronclawEventType.tool_call` (running status) before execution, `IronclawEventType.tool_result` on success, and `IronclawEventType.error` on failure.

5. **Task dispatch notification** — The `task_request` branch emits a single `done:true` response event for the dispatch notification message (no streaming — notification is a status update, not text to progressively render).

6. **Simulated token streaming** — Main text responses (final Ironclaw chat messages) are split by `/(\s+)/` into word chunks. Each chunk appends to `accumulated` and emits a `delta:true, done:false` response event. A final `delta:false, done:true` event carries the complete `content` and `messageId`.

7. **Action card responses** — Emitted as a single `done:true` event without streaming to preserve the approval card UI.

8. **processResponse signature** — Added `userDid: string` parameter (second positional) so SSE append calls have the correct scope. Call site in `handleMessage` updated accordingly.

9. **Backward compatibility preserved** — All `ironclawStore.addMessage()` calls retained so `ironclaw_chat` table continues to be populated for `getHistory()`.

10. **publishToChannel retained** — Function not deleted; used for non-chat WebSocket events (COP updates, system notifications).

## Acceptance Criteria Verification

- ironclawEventStore.append occurrences: 16 (minimum required: 4)
- publishToChannel(problemSetId, 'ironclaw.user-message': 0 (replaced)
- publishToChannel(globalChannelId(userDid), 'ironclaw.user-message': 0 (replaced)
- async function publishToChannel: present (not deleted)
- ironclawStore.addMessage: 9 occurrences (backward compat preserved)
- IronclawEventType.ack: present (2 call sites)
- IronclawEventType.response: present (multiple call sites)
- IronclawEventType.error: present
- delta: true: present in streaming loops
- done: true: present in final events
- TypeScript: exit code 0, no errors

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace publishToChannel chat calls with SSE event emission | efdbfb7a | backend/src/ironclaw/ironclaw-service.ts |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written with one minor structural addition.

**1. [Rule 2 - Missing critical functionality] Added userDid param to processResponse**
- **Found during:** Task 1 implementation
- **Issue:** ironclawEventStore.append() requires userDid but processResponse had no user context
- **Fix:** Added `userDid: string` as second parameter to processResponse; updated the single call site in handleMessage to pass userDid
- **Files modified:** backend/src/ironclaw/ironclaw-service.ts
- **Commit:** efdbfb7a

## Known Stubs

None — all SSE event emission paths are fully wired. ironclawStore.addMessage backward compat calls are intentional (not stubs) per plan requirements.

## Threat Flags

T-67-06 mitigation applied: all payload construction uses `satisfies` type assertions (e.g., `{ ... } satisfies AckPayload`, `satisfies ResponsePayload`) ensuring JSONB serialization from typed interfaces, preventing raw string injection.

T-67-07 accepted: token chunks contain response text already authorized for the user.

## Self-Check: PASSED
