---
phase: 67-ironclaw-sse-streaming-event-driven-agent-communication
verified: 2026-04-09T14:46:25Z
status: gaps_found
score: 11/14 must-haves verified
re_verification: false
gaps:
  - truth: "SSE connection status shows Live/Reconnecting/Offline in drawer header"
    status: failed
    reason: "SSEConnectionIndicator component exists but is not rendered in IronclawDrawer.tsx or anywhere in the app. sseState is not passed through IronclawContextValue interface."
    artifacts:
      - path: "frontend/src/components/ironclaw/SSEConnectionIndicator.tsx"
        issue: "Component exists and is correct, but is never imported or rendered anywhere"
      - path: "frontend/src/context/IronclawContext.tsx"
        issue: "IronclawContextValue interface does not include sseState, streamingResponse, toolCalls, delegations, or inlineErrors — these are present in useIronclaw return but not declared in the context interface"
      - path: "frontend/src/components/ironclaw/IronclawDrawer.tsx"
        issue: "Does not import or render SSEConnectionIndicator, ToolCallCard, DelegationNotice, or InlineError"
    missing:
      - "Wire sseState into IronclawContextValue interface in IronclawContext.tsx"
      - "Render SSEConnectionIndicator in IronclawDrawer header with sseState prop"
  - truth: "Tool calls render as expandable cards with name + status (D-04)"
    status: failed
    reason: "ToolCallCard component is correct and substantive but is never imported or rendered anywhere — toolCalls state from useIronclaw is not consumed by any rendering component."
    artifacts:
      - path: "frontend/src/components/ironclaw/ToolCallCard.tsx"
        issue: "Component exists, exports ToolCallCard, correct UI — but orphaned (0 import sites)"
    missing:
      - "Wire toolCalls state into IronclawContextValue or pass directly to IronclawDrawer"
      - "Render ToolCallCard items in IronclawDrawer chat message list"
  - truth: "Delegation notices show specialist name with clickable 'View in Agent Panel' link (D-09, D-10)"
    status: failed
    reason: "DelegationNotice component exists and is correct but is never imported or rendered anywhere — delegations state not surfaced in drawer."
    artifacts:
      - path: "frontend/src/components/ironclaw/DelegationNotice.tsx"
        issue: "Component exists and is correct but orphaned (0 import sites)"
    missing:
      - "Wire delegations state into IronclawContextValue or IronclawDrawer props"
      - "Render DelegationNotice items in IronclawDrawer"
  - truth: "Text responses stream with typewriter effect and blinking cursor (D-05)"
    status: failed
    reason: "IronclawMessage.tsx has isStreaming prop and cursor-blink animation, but IronclawDrawer.tsx never passes isStreaming=true when rendering messages, and streamingResponse state (which holds the in-progress streaming content) is never consumed by the drawer."
    artifacts:
      - path: "frontend/src/components/ironclaw/IronclawDrawer.tsx"
        issue: "IronclawMessage rendered without isStreaming prop; streamingResponse not used at all in drawer"
    missing:
      - "Add streamingResponse to IronclawContextValue interface"
      - "Render a StreamingResponse in the message list when streamingResponse is non-null, passing isStreaming=true to IronclawMessage"
  - truth: "Errors render inline with Retry button (D-06)"
    status: failed
    reason: "InlineError component exists and is correct but is never imported or rendered anywhere — inlineErrors state not surfaced in drawer."
    artifacts:
      - path: "frontend/src/components/ironclaw/InlineError.tsx"
        issue: "Component exists, correct implementation, but orphaned (0 import sites)"
    missing:
      - "Wire inlineErrors state into IronclawContextValue or IronclawDrawer"
      - "Render InlineError items in IronclawDrawer"
---

# Phase 67: Ironclaw SSE Streaming & Event-Driven Agent Communication Verification Report

**Phase Goal:** Replace synchronous webhook chat with an event-driven SSE architecture. User messages are fire-and-forget POSTs; Ironclaw autonomously executes tools and streams back results via server-sent events. Event history is persisted server-side so reconnecting clients can catch up. Specialist agent delegation becomes visible as nested event streams.
**Verified:** 2026-04-09T14:46:25Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                 | Status      | Evidence                                                                                           |
|----|---------------------------------------------------------------------------------------|-------------|----------------------------------------------------------------------------------------------------|
| 1  | SSE endpoint at GET /:problemSetId/stream returns text/event-stream                   | ✓ VERIFIED  | ironclaw-sse.ts sets all required headers; router registers route at correct path                  |
| 2  | SSE endpoint at GET /global/stream returns text/event-stream                          | ✓ VERIFIED  | /global/stream route registered before /:problemSetId/stream; anonymous user gets 403              |
| 3  | ironclaw_events table with BIGSERIAL id, scope_id, user_did, thread_id, payload cols  | ✓ VERIFIED  | ensureTable() in ironclaw-event-store.ts contains exact CREATE TABLE IF NOT EXISTS SQL             |
| 4  | Events persisted via append() are retrievable via getEventsSince()                    | ✓ VERIFIED  | 16 vitest tests pass; INSERT RETURNING id + parameterized SELECT in event store                    |
| 5  | Reconnecting client with Last-Event-ID receives only missed events                    | ✓ VERIFIED  | handleSSEStream reads last-event-id header and lastEventId query param; replays via getEventsSince |
| 6  | All 7 event types have typed payloads                                                 | ✓ VERIFIED  | ironclaw-event-types.ts exports all 7 types with correct payload shapes                            |
| 7  | User message POST triggers ack event on SSE stream                                    | ✓ VERIFIED  | ironclaw-service.ts line 343: ironclawEventStore.append with IronclawEventType.ack                 |
| 8  | Ironclaw text response delivered as SSE response events with delta chunks + done:true  | ✓ VERIFIED  | Word-chunk streaming loop with delta:true + final done:true event at lines 791-800                 |
| 9  | Tool calls emit tool_call events, then tool_result events on completion               | ✓ VERIFIED  | Lines 536-597: tool_call (running) before execution, tool_result on success                        |
| 10 | Specialist delegation emits delegation event with specialist name                      | ✓ VERIFIED  | Line 494: ironclawEventStore.append with IronclawEventType.delegation                              |
| 11 | Errors emit error events with retryable flag                                           | ✓ VERIFIED  | Line 613: ironclawEventStore.append with IronclawEventType.error and retryable field               |
| 12 | SSE connection status shows Live/Reconnecting/Offline in drawer header                 | ✗ FAILED    | SSEConnectionIndicator exists but is never rendered; sseState not in IronclawContextValue          |
| 13 | Tool calls render as expandable cards with name + status (D-04)                        | ✗ FAILED    | ToolCallCard is orphaned — never imported or rendered anywhere                                     |
| 14 | Delegation notices show specialist name with View in Agent Panel link (D-09, D-10)    | ✗ FAILED    | DelegationNotice is orphaned — never imported or rendered anywhere                                 |
| 15 | Text responses stream with typewriter effect and blinking cursor (D-05)                | ✗ FAILED    | IronclawMessage has isStreaming support but drawer never passes it; streamingResponse unused        |
| 16 | Errors render inline with Retry button (D-06)                                          | ✗ FAILED    | InlineError is orphaned — never imported or rendered anywhere                                      |
| 17 | EventSource connects to /api/ironclaw/:problemSetId/stream on mount                   | ✓ VERIFIED  | useIronclaw.ts line 150: new EventSource(url, { withCredentials: true })                           |
| 18 | EventSource connects to /api/ironclaw/global/stream when no problemSetId              | ✓ VERIFIED  | url computed as /api/ironclaw/global/stream when problemSetId is null                              |
| 19 | WebSocket lifecycle code removed from useIronclaw.ts                                   | ✓ VERIFIED  | No WS_BASE_URL, no new WebSocket(), no reconnectTimerRef found                                     |
| 20 | EventSource auto-reconnects with Last-Event-ID (D-08)                                 | ✓ VERIFIED  | Browser EventSource handles this natively; no manual backoff needed                                |
| 21 | Final response events written to BOTH ironclaw_events AND ironclaw_chat tables         | ✓ VERIFIED  | ironclawStore.addMessage retained (9 call sites); SSE append added alongside                       |

**Score:** 11/14 truths verified (16/21 counting full plan-level truth set; 5 frontend UI wiring truths failed)

### Required Artifacts

| Artifact                                                          | Expected                                      | Status        | Details                                                               |
|-------------------------------------------------------------------|-----------------------------------------------|---------------|-----------------------------------------------------------------------|
| `backend/src/ironclaw/ironclaw-event-types.ts`                    | SSE event type taxonomy with typed payloads   | ✓ VERIFIED    | 7 event types, all payload interfaces present, IronclawPayloadMap     |
| `backend/src/ironclaw/ironclaw-event-store.ts`                    | Event persistence, in-memory registry, emit   | ✓ VERIFIED    | IronclawEventStore class with all required methods; singleton exported |
| `backend/src/ironclaw/ironclaw-sse.ts`                            | SSE endpoint with Last-Event-ID + heartbeat   | ✓ VERIFIED    | handleSSEStream exported; all security mitigations implemented         |
| `backend/src/ironclaw/ironclaw-router.ts`                         | Routes wired, ensureTable on startup          | ✓ VERIFIED    | /global/stream before /:problemSetId/stream; ensureTable() called      |
| `backend/src/ironclaw/ironclaw-service.ts`                        | SSE event emission replacing publishToChannel | ✓ VERIFIED    | 16 ironclawEventStore.append calls; 0 publishToChannel chat calls      |
| `backend/src/ironclaw/__tests__/ironclaw-event-store.test.ts`     | Unit tests for event store                    | ✓ VERIFIED    | 16 tests, all passing                                                  |
| `frontend/src/types/ironclaw.ts`                                  | Frontend SSE event type definitions           | ✓ VERIFIED    | IronclawSSEEventType, all payload interfaces, SSEConnectionState       |
| `frontend/src/hooks/useIronclaw.ts`                               | EventSource lifecycle replacing WebSocket     | ✓ VERIFIED    | new EventSource with all 7 event listeners; sseState, toolCalls etc.   |
| `frontend/src/components/ironclaw/ToolCallCard.tsx`               | Expandable tool call display card             | ⚠ ORPHANED   | Exists and correct; never imported or rendered                         |
| `frontend/src/components/ironclaw/DelegationNotice.tsx`           | Delegation notice with agent panel link       | ⚠ ORPHANED   | Exists and correct; never imported or rendered                         |
| `frontend/src/components/ironclaw/InlineError.tsx`                | Inline error with retry button                | ⚠ ORPHANED   | Exists and correct; never imported or rendered                         |
| `frontend/src/components/ironclaw/SSEConnectionIndicator.tsx`     | SSE connection status dot indicator           | ⚠ ORPHANED   | Exists and correct; never imported or rendered                         |
| `frontend/src/components/ironclaw/IronclawMessage.tsx`            | Streaming typewriter + slide-in animation     | ⚠ PARTIAL    | isStreaming prop and cursor-blink added; never activated by drawer      |

### Key Link Verification

| From                                 | To                               | Via                                    | Status      | Details                                                             |
|--------------------------------------|----------------------------------|----------------------------------------|-------------|---------------------------------------------------------------------|
| ironclaw-sse.ts                      | ironclaw-event-store.ts          | ironclawEventStore.registerClient/getEventsSince | ✓ WIRED | Both calls present in handleSSEStream                           |
| ironclaw-router.ts                   | ironclaw-sse.ts                  | Express route handler                  | ✓ WIRED     | import { handleSSEStream } + two routes registered                  |
| ironclaw-service.ts                  | ironclaw-event-store.ts          | ironclawEventStore.append()            | ✓ WIRED     | 16 append calls across handleMessage and handleGlobalMessage        |
| ironclaw-service.ts                  | ironclaw-store.ts                | ironclawStore.addMessage()             | ✓ WIRED     | 9 addMessage calls retained for backward compat                     |
| frontend/useIronclaw.ts              | /api/ironclaw/:problemSetId/stream | new EventSource(url)                 | ✓ WIRED     | URL computed correctly for both problem-set and global modes        |
| frontend/IronclawMessage.tsx         | ToolCallCard.tsx                 | import and render for tool_call events | ✗ NOT WIRED | IronclawDrawer renders IronclawMessage but never renders ToolCallCard |
| IronclawContextValue                 | sseState/toolCalls/delegations   | context interface declaration          | ✗ NOT WIRED | IronclawContextValue does not include the 5 new SSE state fields    |

### Data-Flow Trace (Level 4)

| Artifact                    | Data Variable     | Source                                | Produces Real Data | Status         |
|-----------------------------|-------------------|---------------------------------------|--------------------|----------------|
| ironclaw-event-store.ts     | events/clients    | PostgreSQL INSERT / in-memory Map     | Yes                | ✓ FLOWING      |
| ironclaw-service.ts         | SSE append calls  | Sidecar response + tool execution     | Yes                | ✓ FLOWING      |
| useIronclaw.ts              | messages          | SSE response events → setMessages     | Yes                | ✓ FLOWING      |
| useIronclaw.ts              | streamingResponse | delta response events → setState      | Yes (populated)    | ⚠ DISCONNECTED — populated but never consumed by drawer |
| useIronclaw.ts              | toolCalls         | tool_call events → setState           | Yes (populated)    | ⚠ DISCONNECTED — populated but never rendered           |
| useIronclaw.ts              | delegations       | delegation events → setState          | Yes (populated)    | ⚠ DISCONNECTED — populated but never rendered           |
| useIronclaw.ts              | inlineErrors      | error events → setState               | Yes (populated)    | ⚠ DISCONNECTED — populated but never rendered           |
| useIronclaw.ts              | sseState          | es.onopen/onerror → setSseState       | Yes (populated)    | ⚠ DISCONNECTED — populated but not in context interface |

### Behavioral Spot-Checks

| Behavior                                      | Command                                                                                      | Result        | Status     |
|-----------------------------------------------|----------------------------------------------------------------------------------------------|---------------|------------|
| Backend TypeScript compiles clean             | cd backend && npx tsc --noEmit                                                               | EXIT 0        | ✓ PASS     |
| Frontend TypeScript compiles clean            | cd frontend && npx tsc --noEmit                                                              | EXIT 0        | ✓ PASS     |
| All 16 event-store unit tests pass            | cd backend && npx vitest run ironclaw-event-store --no-coverage                              | 16/16 passed  | ✓ PASS     |
| SSE router routes registered correctly        | grep "global/stream\|problemSetId/stream" ironclaw-router.ts                                 | Both found    | ✓ PASS     |
| WebSocket fully removed from useIronclaw      | grep "new WebSocket\|WS_BASE_URL" useIronclaw.ts                                             | 0 matches     | ✓ PASS     |
| 4 new UI components exist                     | ls ToolCallCard.tsx DelegationNotice.tsx InlineError.tsx SSEConnectionIndicator.tsx           | All found     | ✓ PASS     |
| New components used in drawer                 | grep -r "SSEConnectionIndicator\|ToolCallCard\|DelegationNotice\|InlineError" IronclawDrawer.tsx | 0 matches | ✗ FAIL     |

### Requirements Coverage

| Requirement                                                         | Source Plan | Description                                          | Status          | Evidence                                                              |
|---------------------------------------------------------------------|-------------|------------------------------------------------------|-----------------|-----------------------------------------------------------------------|
| SSE endpoint                                                        | 67-01       | GET /:problemSetId/stream and /global/stream         | ✓ SATISFIED     | handleSSEStream registered for both routes in ironclaw-router.ts      |
| event persistence table                                             | 67-01       | ironclaw_events PostgreSQL table                     | ✓ SATISFIED     | ensureTable() creates table with BIGSERIAL id, all required columns   |
| event types (ack, tool_call, tool_result, delegation, progress, response, error) | 67-01 | All 7 typed event types | ✓ SATISFIED | ironclaw-event-types.ts defines all 7 with payload interfaces         |
| reconnection with last-event-id                                     | 67-01       | Last-Event-ID header + query param fallback replay   | ✓ SATISFIED     | handleSSEStream reads both; replays via getEventsSince                 |
| frontend EventSource integration                                    | 67-03       | Replace WebSocket with EventSource in useIronclaw    | ✓ SATISFIED     | new EventSource present; no WebSocket; all 7 events handled           |

All 5 declared requirements are satisfied at the infrastructure level. However, the frontend EventSource integration requirement is only partially satisfied in user-visible terms — the hook correctly uses EventSource, but the resulting SSE state (streaming, tool calls, delegation, errors, connection indicator) is not visible to users because the drawer wiring was not completed.

### Anti-Patterns Found

| File                                                          | Line | Pattern                              | Severity    | Impact                                                          |
|---------------------------------------------------------------|------|--------------------------------------|-------------|-----------------------------------------------------------------|
| frontend/src/components/ironclaw/IronclawDrawer.tsx           | 647  | IronclawMessage without isStreaming  | ⚠ Warning   | Typewriter effect never activates; streaming content invisible |
| frontend/src/context/IronclawContext.tsx                      | 78   | IronclawContextValue missing SSE fields | ⚠ Warning | sseState/toolCalls/delegations/inlineErrors/streamingResponse not typed in context |
| frontend/src/components/ironclaw/index.ts                     | all  | New components not exported          | ⚠ Warning   | ToolCallCard, DelegationNotice, InlineError, SSEConnectionIndicator not in barrel export |

No blockers in backend code. The anti-patterns are all in the frontend drawer integration layer.

### Human Verification Required

None required — all identified issues are programmatically verifiable.

### Gaps Summary

The backend SSE architecture (Plans 01 and 02) is complete and correct: event types, PostgreSQL persistence, SSE endpoint with Last-Event-ID replay and heartbeat, connection limits, auth guards, TypeScript compiles clean, 16 unit tests pass. The frontend EventSource hook (Plan 03) correctly replaces WebSocket and populates SSE state for all 7 event types.

The gap is the final integration layer: the 4 new UI components (ToolCallCard, DelegationNotice, InlineError, SSEConnectionIndicator) and the streamingResponse state are never wired into IronclawDrawer.tsx or IronclawContext.tsx. The SUMMARY for Plan 03 explicitly acknowledges this: "ToolCallCard, DelegationNotice, and SSEConnectionIndicator will render real data once their parent (IronclawDrawer) is updated — that wiring is out of scope for Plan 03 — Plan 04 or the checkpoint review handles drawer integration."

Since no Plan 04 exists and there is no later milestone phase that claims this work, these 5 truths from the phase goal are unmet. The components that should deliver the D-03 through D-09 user-visible behaviors (progressive reveal, typewriter streaming, tool call cards, delegation notices, inline errors, connection status) exist but produce zero visible output.

Root cause: A single task scope boundary was drawn after Plan 03 — the plan wrote all components and state management but deliberately stopped before drawer integration, labeling it "out of scope." No plan was created to close that gap.

**Items needed to close:**
1. Add SSE state fields to `IronclawContextValue` interface in `IronclawContext.tsx`
2. Render `SSEConnectionIndicator` in `IronclawDrawer` header with `sseState` prop
3. Render `streamingResponse` as a live `IronclawMessage` with `isStreaming=true` while streaming
4. Render `toolCalls` array as `ToolCallCard` items in the message list during agent execution
5. Render `delegations` array as `DelegationNotice` items in the message list
6. Render `inlineErrors` array as `InlineError` items in the message list
7. Export new components from `frontend/src/components/ironclaw/index.ts`

---

_Verified: 2026-04-09T14:46:25Z_
_Verifier: Claude (gsd-verifier)_
