# Phase 67: Ironclaw SSE Streaming & Event-Driven Agent Communication - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the synchronous webhook / WebSocket chat delivery channel with Server-Sent Events (SSE). User messages become fire-and-forget POSTs; Ironclaw autonomously executes tools and streams back results via SSE. Event history is persisted server-side so reconnecting clients can catch up via Last-Event-ID. Specialist agent delegation becomes visible as nested event streams consumed by the existing agent panel.

Scope: Ironclaw chat stream only. Yjs collaborative editing (Phase 56) and non-chat MessageBus WebSocket channels are untouched.

</domain>

<decisions>
## Implementation Decisions

### Transport Architecture
- **D-01:** SSE for Ironclaw chat stream. WebSocket MessageBus stays for non-chat events (COP updates, notifications). Yjs WebSocket stays for collaborative editing (map overlays, documents). No dual-transport for chat — SSE is the sole chat delivery channel.
- **D-02:** User messages sent as fire-and-forget POSTs to the existing `/api/ironclaw/{problemSetId}/message` endpoint (returns 202 Accepted). No change to the request path — only the response delivery changes from WebSocket to SSE.

### Event Stream UX
- **D-03:** Progressive reveal — show each step as it happens in real-time. Tool calls, delegations, and progress appear in the chat stream as they execute, not after completion.
- **D-04:** Contextual depth for tool call display — show tool name + brief status by default (e.g., "OSINT Search: querying DPRK naval movements..." then "Found 3 results"). User can click/expand to see full tool input/output parameters.
- **D-05:** Token-by-token response streaming (typewriter effect) for Ironclaw's text responses. Text appears word-by-word as generated, like ChatGPT/Claude web interface.
- **D-06:** Inline errors with retry — errors appear in the chat flow where they happened (e.g., "OSINT Search failed: timeout") with a Retry button. Ironclaw can also auto-retry if appropriate.

### Event Persistence & Reconnection
- **D-07:** Permanent event retention — keep all events (including raw tool inputs/outputs) indefinitely. No TTL, no aging. Events stored in a dedicated `ironclaw_events` table alongside the existing `ironclaw_chat` table.
- **D-08:** Last-Event-ID replay on reconnection — standard SSE behavior. Client's EventSource automatically sends Last-Event-ID header on reconnect. Server replays all events since that ID. No custom replay logic needed.

### Specialist Delegation Visibility
- **D-09:** Chat shows delegation notice only (e.g., "Delegated to OSINT Analyst"). Detailed specialist tool calls and progress appear in the existing agent activity panel. Final result flows back to chat when specialist completes.
- **D-10:** Clickable delegation link in chat — clicking the delegation notice navigates to/opens the specialist's activity in the agent panel.
- **D-11:** Single SSE stream consumed by both chat panel and agent panel. Delegation events flow to both from one source. Agent panel filters for delegation/tool_call/tool_result/progress events; chat panel handles ack/response/error events.

### Claude's Discretion
- Event type taxonomy details (exact event names and payload shapes beyond the required types: ack, tool_call, tool_result, delegation, progress, response, error)
- SSE endpoint path design (e.g., `/api/ironclaw/{problemSetId}/stream`)
- Event ID generation strategy (sequential, UUID, timestamp-based)
- `ironclaw_events` table schema details (columns, indexes, partitioning)
- Frontend EventSource connection lifecycle management (when to connect/disconnect)
- How the existing `ironclaw_chat` table relates to the new events table (whether final responses are written to both, or events table replaces chat for storage)
- Backend SSE implementation approach (Express response streaming, third-party library, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current Ironclaw Chat Architecture
- `backend/src/ironclaw/ironclaw-router.ts` — REST endpoints for chat (POST message, GET history)
- `backend/src/ironclaw/ironclaw-service.ts` — Orchestration layer bridging frontend to Ironclaw sidecar; assembleMemoryBlock() call site
- `backend/src/ironclaw/ironclaw-store.ts` — PostgreSQL persistence (ironclaw_chat, ironclaw_sessions tables)
- `backend/src/ironclaw/ironclaw-client.ts` — getIronclawPool() pattern for DATABASE_URL_IRONCLAW access

### Frontend Chat Components
- `frontend/src/hooks/useIronclaw.ts` — Main chat hook with WebSocket lifecycle (to be replaced with EventSource)
- `frontend/src/context/IronclawContext.tsx` — Global chat context + polling for pending decisions
- `frontend/src/lib/ironclaw-service.ts` — API client (REST fetch-based, snakeToCamelMessage transformer)
- `frontend/src/types/ironclaw.ts` — Type definitions (IronclawChatMessage, ActionCardData, StepProgressData)
- `frontend/src/components/ironclaw/IronclawMessage.tsx` — Message rendering component

### Agent Activity Panel
- `frontend/src/components/admin/AgentActivityPanel.tsx` — Existing agent activity display (delegation events will route here)
- `backend/src/ironclaw/autonomous-activity-store.ts` — Activity feed storage

### Collaborative Editing (DO NOT TOUCH)
- `backend/src/collaboration/sync-server.ts` — Yjs WebSocket sync server (separate from chat)
- `backend/src/collaboration/yjs-provider.ts` — Yjs CRDT provider (stays as-is)

### Prior Phase Context
- `.planning/phases/66-ironclaw-memory-evolution-and-concept-learning/66-CONTEXT.md` — Phase 66 decisions on ironclaw-postgres, concept storage, activity feed extensions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getIronclawPool()` in `ironclaw-client.ts` — direct pool access for ironclaw-postgres (reuse for events table)
- `snakeToCamelMessage()` in `ironclaw-service.ts` — message transformer pattern (extend for event types)
- `publishToChannel()` in MessageBus — current WebSocket publish pattern (replace with SSE emit for chat)
- `IronclawChatMessage` type — existing message structure (extend or reference for event payloads)

### Established Patterns
- 202 Accepted async response pattern — already in place for message POST
- ironclaw-postgres runs pgvector:pg16 — supports any table additions without new infrastructure
- Frontend hooks pattern (`useIronclaw.ts`) — replace WebSocket lifecycle with EventSource lifecycle
- Activity feed polling in `IronclawContext.tsx` (60s interval) — can be replaced by SSE events

### Integration Points
- `ironclaw-router.ts` — add new SSE endpoint alongside existing REST routes
- `ironclaw-service.ts` — modify response delivery from WebSocket publish to SSE event emission
- `useIronclaw.ts` — replace WebSocket connection with EventSource connection
- `IronclawContext.tsx` — replace polling with SSE event handling
- `AgentActivityPanel.tsx` — subscribe to SSE delegation events for real-time updates

</code_context>

<specifics>
## Specific Ideas

- Token-by-token streaming like ChatGPT/Claude web interface for text responses
- Ironclaw's tool calls should feel like watching someone work in real-time (progressive reveal)
- The delegation notice in chat must be a clickable link that jumps to the agent panel
- Single SSE stream is the sole source for both chat and agent panel — no dual data sources

</specifics>

<deferred>
## Deferred Ideas

- Real-time collaborative COP editing (user + Ironclaw editing map simultaneously) — uses Yjs, separate from chat SSE. Not in scope for Phase 67.

</deferred>

---

*Phase: 67-ironclaw-sse-streaming-event-driven-agent-communication*
*Context gathered: 2026-04-09*
