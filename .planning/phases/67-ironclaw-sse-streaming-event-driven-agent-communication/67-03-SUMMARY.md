---
phase: 67-ironclaw-sse-streaming-event-driven-agent-communication
plan: "03"
subsystem: frontend
tags: [sse, ironclaw, eventSource, streaming, ui-components, typewriter]
dependency_graph:
  requires: ["67-01"]
  provides: ["frontend SSE event handling", "SSE UI components", "streaming typewriter UX"]
  affects: ["IronclawDrawer", "IronclawContext", "useIronclaw"]
tech_stack:
  added: []
  patterns:
    - "EventSource with withCredentials for cookie auth"
    - "Delta streaming accumulated in StreamingResponse state"
    - "JSON.parse try/catch guards on all SSE event handlers (T-67-08)"
    - "JSON.stringify rendering for tool I/O prevents XSS (T-67-09)"
key_files:
  created:
    - frontend/src/components/ironclaw/ToolCallCard.tsx
    - frontend/src/components/ironclaw/DelegationNotice.tsx
    - frontend/src/components/ironclaw/InlineError.tsx
    - frontend/src/components/ironclaw/SSEConnectionIndicator.tsx
  modified:
    - frontend/src/types/ironclaw.ts
    - frontend/src/hooks/useIronclaw.ts
    - frontend/src/components/ironclaw/IronclawMessage.tsx
decisions:
  - "EventSource replaces WebSocket for real-time delivery — no manual backoff needed, browser handles Last-Event-ID reconnect"
  - "Streaming delta events accumulate via setStreamingResponse with functional update (prev content + new content)"
  - "InlineError Retry button only renders when error.retryable is true"
metrics:
  duration_minutes: 20
  completed_date: "2026-04-09"
  tasks_completed: 2
  tasks_total: 3
  files_created: 4
  files_modified: 3
---

# Phase 67 Plan 03: Frontend SSE Integration and UI Components Summary

EventSource lifecycle replacing WebSocket in useIronclaw.ts with 7 typed SSE event handlers, plus 4 new UI components (ToolCallCard, DelegationNotice, InlineError, SSEConnectionIndicator) and streaming typewriter support in IronclawMessage.

## What Was Built

### Task 1: Frontend SSE Types and useIronclaw EventSource Replacement

**`frontend/src/types/ironclaw.ts`** — Added SSE event type definitions:
- `IronclawSSEEventType` union type for all 7 event types
- Payload interfaces: `AckPayload`, `ToolCallPayload`, `ToolResultPayload`, `DelegationPayload`, `ProgressPayload`, `ResponsePayload`, `ErrorPayload`
- UI state types: `StreamingResponse`, `ToolCallState`, `DelegationState`, `InlineErrorState`, `SSEConnectionState`

**`frontend/src/hooks/useIronclaw.ts`** — WebSocket replaced with EventSource:
- Removed: `WS_BASE_URL`, `RECONNECT_BASE_MS`, `RECONNECT_MAX_MS`, `wsRef`, `reconnectTimerRef`, `reconnectDelayRef`, `channelRef`, entire WebSocket lifecycle
- Added: `esRef`, `connectSSE` callback, 5 new state variables (`sseState`, `streamingResponse`, `toolCalls`, `delegations`, `inlineErrors`)
- EventSource connects to `/api/ironclaw/:problemSetId/stream` or `/api/ironclaw/global/stream`
- All 7 event types handled with typed listeners and try/catch guards (T-67-08)
- Delta streaming: `setStreamingResponse(prev => ({ content: prev.content + data.content, ... }))`
- Thread filtering applied to `ack` and `response` events
- New state exported from `UseIronclawResult`: `sseState`, `streamingResponse`, `toolCalls`, `delegations`, `inlineErrors`, `setToolCalls`, `setInlineErrors`

### Task 2: SSE UI Components

**`ToolCallCard.tsx`** — Expandable tool call display per D-04:
- Collapsed: status dot (pending/running/complete/failed) + tool name + status message + elapsed time + expand button
- Expanded: Input and Output JSON in `<pre>` tags with `max-h-48` scroll
- Status transitions: blue pulse (running) → green check (complete) → red X (failed)

**`DelegationNotice.tsx`** — Delegation notice per D-09, D-10:
- Shield icon + "Delegating to **{name}**..." or "Delegation to **{name}** complete"
- "View in Agent Panel" clickable link triggers `onViewInAgentPanel(specialistId)`
- Fade-in animation at 150ms

**`InlineError.tsx`** — Inline error per D-06:
- Warning triangle icon + error message
- Retry button (only when `retryable`) with 3-dot bounce animation when retrying

**`SSEConnectionIndicator.tsx`** — Connection status per UI-SPEC Component #4:
- `open`: blue dot + "Live"
- `connecting`: amber pulse + "Reconnecting..."
- `closed`: gray dot + "Offline"

**`IronclawMessage.tsx`** (modified) — Streaming support per D-05:
- Added `isStreaming?: boolean` prop — renders plain text + blinking cursor when true
- Added `animate?: boolean` prop — slide-in animation (150ms ease-out) on new messages
- Inline `@keyframes` for `cursor-blink` (1s step-end) and `slideIn` (150ms ease-out)
- Non-streaming path unchanged (existing Markdown rendering)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all components are fully wired with proper props. ToolCallCard, DelegationNotice, and SSEConnectionIndicator will render real data once their parent (IronclawDrawer) is updated to pass SSE state from useIronclaw (that wiring is out of scope for Plan 03 — Plan 04 or the checkpoint review handles drawer integration).

## Threat Flags

No new threat surface beyond the plan's threat model. T-67-08 (JSON.parse guards) and T-67-09 (XSS prevention via JSON.stringify) are both mitigated as required.

## Self-Check: PASSED

Files created:
- frontend/src/components/ironclaw/ToolCallCard.tsx: FOUND
- frontend/src/components/ironclaw/DelegationNotice.tsx: FOUND
- frontend/src/components/ironclaw/InlineError.tsx: FOUND
- frontend/src/components/ironclaw/SSEConnectionIndicator.tsx: FOUND

Files modified:
- frontend/src/types/ironclaw.ts: FOUND (IronclawSSEEventType, SSE payload types)
- frontend/src/hooks/useIronclaw.ts: FOUND (EventSource, no WebSocket)
- frontend/src/components/ironclaw/IronclawMessage.tsx: FOUND (isStreaming, cursor-blink)

Commits:
- f685f291: feat(67-03): frontend SSE types and useIronclaw EventSource replacement
- a56a13f0: feat(67-03): SSE UI components — ToolCallCard, DelegationNotice, InlineError, SSEConnectionIndicator, IronclawMessage streaming

TypeScript compilation: EXIT 0 (no errors)
