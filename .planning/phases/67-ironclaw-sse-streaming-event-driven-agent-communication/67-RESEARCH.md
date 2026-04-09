# Phase 67: Ironclaw SSE Streaming & Event-Driven Agent Communication - Research

**Researched:** 2026-04-09
**Domain:** Server-Sent Events, Express streaming, EventSource lifecycle, PostgreSQL event persistence
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** SSE for Ironclaw chat stream only. WebSocket MessageBus stays for non-chat events. Yjs WebSocket stays for collaborative editing. SSE is the sole chat delivery channel.
- **D-02:** User messages sent as fire-and-forget POSTs to existing `/:problemSetId/message` endpoint (returns 202 Accepted). Only response delivery changes from WebSocket to SSE.
- **D-03:** Progressive reveal — show each step as it happens in real-time.
- **D-04:** Contextual depth for tool call display — show tool name + brief status by default, user can expand to see full input/output.
- **D-05:** Token-by-token response streaming (typewriter effect) for Ironclaw text responses.
- **D-06:** Inline errors with retry — errors appear in the chat flow with a Retry button.
- **D-07:** Permanent event retention — keep all events indefinitely. No TTL. Stored in a dedicated `ironclaw_events` table.
- **D-08:** Last-Event-ID replay on reconnection — standard SSE behavior using client EventSource header.
- **D-09:** Chat shows delegation notice only. Details in agent activity panel.
- **D-10:** Clickable delegation link in chat navigates to agent panel.
- **D-11:** Single SSE stream consumed by both chat panel and agent panel.

### Claude's Discretion

- Event type taxonomy details (exact event names and payload shapes beyond: ack, tool_call, tool_result, delegation, progress, response, error)
- SSE endpoint path design (e.g., `/api/ironclaw/{problemSetId}/stream`)
- Event ID generation strategy (sequential, UUID, timestamp-based)
- `ironclaw_events` table schema details (columns, indexes, partitioning)
- Frontend EventSource connection lifecycle management
- How `ironclaw_chat` relates to the new events table
- Backend SSE implementation approach

### Deferred Ideas (OUT OF SCOPE)

- Real-time collaborative COP editing (user + Ironclaw editing map simultaneously) — uses Yjs, separate from chat SSE.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SSE-01 | SSE endpoint per problem set | `GET /:problemSetId/stream` — Express res.write pattern confirmed in doc-intelligence.ts and exercise.ts |
| SSE-02 | `ironclaw_events` persistence table | New table alongside existing ironclaw_chat; getPool() pattern confirmed |
| SSE-03 | Event types: ack, tool_call, tool_result, delegation, progress, response, error | Established in CONTEXT.md; SSE named-event format supports these |
| SSE-04 | Reconnection with Last-Event-ID header | Native SSE browser behavior; server must query events WHERE id > last_event_id |
| SSE-05 | Frontend EventSource integration | Replace WebSocket lifecycle in useIronclaw.ts with EventSource; existing hook is the target |
| SSE-06 | Global scope stream | `GET /global/stream` mirrors the /:problemSetId/stream pattern for non-problem-set chats |
</phase_requirements>

---

## Summary

The backend already has a working SSE pattern used in `doc-intelligence.ts` and `exercise.ts`. The Express stack (v5.x) supports SSE natively via `res.setHeader`, `res.flushHeaders()`, and `res.write()`. No additional libraries are needed. The `ironclaw-service.ts` currently delivers all responses via `publishToChannel()` (MessageBus/WebSocket). Phase 67 replaces that delivery path with SSE emission for the chat stream while leaving MessageBus intact for everything else.

The `useIronclaw.ts` hook currently manages a WebSocket connection (`new WebSocket(WS_BASE_URL)`) with exponential backoff reconnect. This entire WebSocket lifecycle is replaced with `new EventSource('/api/ironclaw/:psId/stream')` and EventSource's built-in reconnection. The 60s polling in `IronclawContext.tsx` for activity feed is also replaced by SSE events.

The nginx configuration at `frontend/nginx.conf` already has `proxy_buffering off` on `/api/` routes, which is the critical SSE requirement. The prod nginx config also has `proxy_buffering off` and `proxy_read_timeout 86400`. No nginx changes needed for SSE to work.

**Primary recommendation:** Use the established in-project SSE pattern from `doc-intelligence.ts` (named events, `X-Accel-Buffering: no`, in-memory client set with `req.on('close')` cleanup). Add PostgreSQL persistence for replay. Wire emission into `ironclaw-service.ts` where `publishToChannel()` calls currently live.

---

## Project Constraints (from CLAUDE.md)

- Always use nvm to use a newer version of Node.js for all shell commands (e.g., `bash -lc 'nvm use ...'`)

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express (built-in) | ^5.2.1 | SSE via res.write | Already in use; SSE is native HTTP streaming — no lib needed |
| pg (built-in) | via getPool() | ironclaw_events table | Established pattern across all ironclaw stores |
| EventSource (browser built-in) | MDN Standard | Frontend SSE client | Native browser API; no npm package needed |

[VERIFIED: codebase grep — backend/src/api/doc-intelligence.ts lines 875-951, exercise.ts lines 1921-1958]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `eventsource` npm (polyfill) | ^2.x | EventSource in older browsers | Only if IE11 support required — not needed here |
| `@microsoft/fetch-event-source` | ^2.x | Extended SSE with POST support | If POST-based SSE ever needed — not needed here |

[ASSUMED] The project does not require IE11 compatibility; EventSource polyfill not needed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native Express SSE | `sse` npm package or `express-sse` | Native is simpler, already proven in this codebase |
| EventSource | WebSocket | WebSocket already in use for other channels; SSE is unidirectional (correct for delivery) |
| PostgreSQL LISTEN/NOTIFY | In-memory Map of SSE clients | LISTEN/NOTIFY scales across process restarts; Map is simpler for single-process |

**Recommended approach:** In-memory SSE client Map + PostgreSQL persistence for replay (same pattern as doc-intelligence.ts session + catch-up on reconnect). LISTEN/NOTIFY is available as upgrade path if horizontal scaling needed.

---

## Architecture Patterns

### Established In-Project SSE Pattern (from doc-intelligence.ts)

```typescript
// Source: backend/src/api/doc-intelligence.ts lines 875-904
// VERIFIED in codebase

res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.setHeader('X-Accel-Buffering', 'no');  // Critical: disables nginx buffering
res.flushHeaders();

// Catch-up: send buffered events for reconnecting clients
for (const entry of session.events) {
  res.write(`event: ${entry.event}\n`);
  res.write(`data: ${JSON.stringify(entry.data)}\n\n`);
}

// Register client
session.sseClients.add(res);

// Cleanup on disconnect
req.on('close', () => {
  session.sseClients.delete(res);
});
```

[VERIFIED: codebase — doc-intelligence.ts]

### Named SSE Event Format (with ID for Last-Event-ID replay)

```
id: 42\n
event: tool_call\n
data: {"tool": "osint_search", "status": "running", "query": "DPRK naval movements"}\n\n
```

The `id:` field is what the browser sends back as `Last-Event-ID` on reconnect. [ASSUMED: sequential integer IDs from the DB are simplest and provide ordering guarantees]

### SSE Endpoint Design

```
GET /api/ironclaw/:problemSetId/stream
GET /api/ironclaw/global/stream  (for non-problem-set conversations)
```

Query params:
- `?lastEventId=<id>` — fallback for clients that don't send the header (some proxies strip it)

### ironclaw_events Table Schema

```sql
CREATE TABLE IF NOT EXISTS ironclaw_events (
  id         BIGSERIAL PRIMARY KEY,           -- sequential integer = SSE event ID
  scope_id   TEXT NOT NULL,                    -- problemSetId or _global_<did>
  user_did   TEXT NOT NULL,
  thread_id  UUID,                             -- nullable for backward compat
  event_type TEXT NOT NULL,                    -- ack|tool_call|tool_result|delegation|progress|response|error
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ironclaw_events_scope_id ON ironclaw_events (scope_id, id);
CREATE INDEX IF NOT EXISTS idx_ironclaw_events_thread   ON ironclaw_events (thread_id, id);
```

**Why BIGSERIAL (not UUID):** Sequential integers are directly usable as SSE event IDs. The `WHERE id > $lastEventId` query for replay is simple and index-efficient. UUID comparison for ordering requires `created_at` ordering which adds complexity.

[ASSUMED: BIGSERIAL is the correct choice; could use UUID + created_at ordering but sequential is simpler]

### In-Memory SSE Client Registry

```typescript
// Per-scope client set — scope is problemSetId or global scope string
const sseClients = new Map<string, Set<Response>>();

function getClientsForScope(scopeId: string): Set<Response> {
  if (!sseClients.has(scopeId)) sseClients.set(scopeId, new Set());
  return sseClients.get(scopeId)!;
}

function emitEvent(scopeId: string, eventType: string, payload: unknown, eventId: number) {
  const clients = sseClients.get(scopeId);
  if (!clients) return;
  const chunk = `id: ${eventId}\nevent: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try {
      res.write(chunk);
    } catch {
      clients.delete(res);
    }
  }
}
```

### Modified ironclaw-service.ts Delivery

The key change is replacing `publishToChannel()` calls with `emitIronclawEvent()` calls:

```typescript
// Current (to be replaced for chat delivery):
await publishToChannel(problemSetId, 'ironclaw.response', msg);

// New pattern:
await ironclawEventStore.append(problemSetId, userDid, 'response', { ...msg });
// emitEvent is called inside append (or separately by the store)
```

The MessageBus WebSocket `publishToChannel` is kept for non-Ironclaw channels. The Ironclaw-specific message types (`ironclaw.response`, `ironclaw.user-message`) are migrated to SSE only.

### Frontend: useIronclaw.ts EventSource Replacement

```typescript
// Replace WebSocket lifecycle:
// OLD: new WebSocket(WS_BASE_URL) with subscribe/unsubscribe messages

// NEW: EventSource with auto-reconnect and Last-Event-ID
const sseUrl = problemSetId
  ? `/api/ironclaw/${problemSetId}/stream`
  : `/api/ironclaw/global/stream`;

const es = new EventSource(sseUrl, { withCredentials: true });

es.addEventListener('ack', (e: MessageEvent) => { /* update loading state */ });
es.addEventListener('tool_call', (e: MessageEvent) => { /* show tool progress */ });
es.addEventListener('tool_result', (e: MessageEvent) => { /* update tool card */ });
es.addEventListener('delegation', (e: MessageEvent) => { /* delegation notice */ });
es.addEventListener('progress', (e: MessageEvent) => { /* progress indicator */ });
es.addEventListener('response', (e: MessageEvent) => { /* append message */ });
es.addEventListener('error', (e: MessageEvent) => { /* show inline error */ });

es.onopen = () => setIsConnected(true);
es.onerror = () => setIsConnected(false);
// EventSource reconnects automatically with Last-Event-ID header
```

[ASSUMED: `withCredentials: true` is needed since the backend uses HttpOnly cookie auth]

### Single Stream for Both Chat and Agent Panel (D-11)

Both `useIronclaw` (chat) and `AgentActivityPanel` can subscribe to the same SSE endpoint. The event types naturally route:

- Chat panel handles: `ack`, `response`, `error`, `delegation` (notice only)
- Agent panel handles: `tool_call`, `tool_result`, `delegation` (details), `progress`

The stream endpoint does NOT filter by consumer. Each consumer filters client-side.

### ironclaw_chat vs ironclaw_events Relationship

**Recommended approach (Claude's discretion):** Keep `ironclaw_chat` as the canonical message store for history display (what users see in thread view). Use `ironclaw_events` as the streaming log (all events including intermediate tool calls). Final `response` events get written to both tables. This preserves backward compatibility with `getHistory()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE reconnection with backoff | Custom reconnect timer | Browser EventSource built-in | EventSource retries automatically with Last-Event-ID |
| SSE heartbeat | Manual ping timer | Standard SSE comment `: heartbeat\n\n` | Already used in doc-intelligence.ts; keeps connections alive through nginx |
| Token streaming buffer | Custom token accumulator | EventSource + React state append | One event per token chunk; append to string in state |
| Per-session SSE registration | Complex pub/sub system | In-memory Map<scopeId, Set<Response>> | Proven pattern in doc-intelligence.ts; simple cleanup on close |
| Reconnect state | Custom ID tracking | BIGSERIAL id + WHERE id > $lastEventId | One SQL query covers all replay |

---

## Common Pitfalls

### Pitfall 1: Nginx Buffering Kills Streaming

**What goes wrong:** SSE events are buffered by nginx and sent in batches, destroying the real-time feel.
**Why it happens:** Nginx buffers proxy responses by default.
**How to avoid:** Set `X-Accel-Buffering: no` header in the Express response AND verify `proxy_buffering off` in nginx.conf.
**Warning signs:** Events arrive in bursts rather than individually.

**Status:** The production nginx config (`frontend/nginx.conf`) already has `proxy_buffering off` on `/api/` routes. [VERIFIED: codebase — frontend/nginx.conf line 43]. The `X-Accel-Buffering: no` header in the response provides belt-and-suspenders protection.

### Pitfall 2: CORS + EventSource Credentials

**What goes wrong:** EventSource connection rejected with CORS error when using cookie auth.
**Why it happens:** `EventSource` with `withCredentials: true` requires the server CORS config to explicitly allow the origin (not wildcard `*`) and `credentials: true`. The `allowedHeaders` must include anything the browser sends.
**How to avoid:** The project's CORS config already uses `credentials: true` and explicit origin whitelist [VERIFIED: backend/src/index.ts lines 97-118]. No changes needed for CORS.
**Warning signs:** Browser console shows CORS error on EventSource connect.

### Pitfall 3: Express 5 Response Already-Sent

**What goes wrong:** Writing to `res` after client disconnect throws an unhandled error.
**Why it happens:** Express 5 is stricter about writing to closed responses.
**How to avoid:** Wrap all `res.write()` calls in try/catch. Remove client from the Set on any write error. Use `req.on('close', ...)` for cleanup.
**Warning signs:** Unhandled error logs with "headers already sent" or "write after end".

### Pitfall 4: Last-Event-ID Header Stripped by Some Proxies

**What goes wrong:** Client reconnects but server does not replay missed events because `Last-Event-ID` header is missing.
**Why it happens:** Some HTTP proxies strip unknown headers. The existing nginx configs do not explicitly forward `Last-Event-ID`.
**How to avoid:** Accept both the `Last-Event-ID` header AND a `?lastEventId=` query parameter as fallback. The browser EventSource sends the header; a manual fetch-based fallback can use the query param.
**Warning signs:** User reconnects after network drop and misses events.

### Pitfall 5: Global Scope SSE Endpoint Auth

**What goes wrong:** Any authenticated user can read any other user's global stream.
**Why it happens:** SSE endpoint only validates auth (cookie), not that the `user_did` matches the stream's `scope_id`.
**How to avoid:** The global stream scope is `_global_${userDid}`. The endpoint must derive `userDid` from the auth middleware and only allow that user's scope — same pattern as the existing `getUserDid(req)` helper.

### Pitfall 6: ironclaw-service.ts handleMessage Blocking

**What goes wrong:** The `handleMessage` function currently calls `ironclawClient.sendMessage()` synchronously (with `wait_for_response: true`, 600s timeout). This blocks the entire Node.js async queue for that problem set.
**Why it happens:** The synchronous webhook was chosen because the async poll approach broke with Ironclaw v0.24. The SSE architecture does not change this — it changes where the *result* is delivered, not how Ironclaw is called.
**How to avoid:** The POST handler keeps the fire-and-forget pattern (already returns 202). The SSE stream opens separately. The blocking happens inside the async callback that does NOT hold the HTTP response open. This is already correct — just emit SSE events at each stage of `handleMessage` instead of only at the end.

### Pitfall 7: Token Streaming Requires Ironclaw Sidecar Support

**What goes wrong:** D-05 (token-by-token streaming) cannot be implemented if the Ironclaw sidecar returns the full response as a single string.
**Why it happens:** The current `sendMessage()` call to the sidecar uses `wait_for_response: true` and returns one complete `response` string. Token streaming requires the sidecar to stream tokens via a different API (e.g., OpenAI-compatible `/v1/chat/completions` with `stream: true`).
**Research finding:** The sidecar exposes an OpenAI-compatible gateway at port 3000 (`/v1/chat/completions`). [ASSUMED: the streaming endpoint exists at port 3000 but is not currently used by `ironclaw-client.ts`].
**How to avoid:** For D-05, the planner should consider two options: (a) simulate token streaming by chunking the complete response into word-sized pieces sent as rapid `response` events (achieves typewriter effect without sidecar streaming), or (b) switch to the port 3000 streaming API. Option (a) is lower risk for Phase 67.

---

## Code Examples

### Established SSE Response Pattern (VERIFIED in project)

```typescript
// Source: backend/src/api/doc-intelligence.ts (VERIFIED)
// Used at lines 875-904 and 926-953

res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.setHeader('X-Accel-Buffering', 'no');
res.flushHeaders();

// Heartbeat to keep connection alive through proxies
// (used in doc-intelligence.ts line 951)
res.write(': heartbeat\n\n');
```

### PostgreSQL LISTEN/NOTIFY for SSE (VERIFIED in project)

```typescript
// Source: backend/src/api/exercise.ts lines 1935-1953 (VERIFIED)
// Shows pg LISTEN pattern for real-time DB-driven SSE events

const pgClient = await pool.connect();
await pgClient.query(`LISTEN "channel:${scenarioId}:${roleKey}"`);
pgClient.on('notification', (msg) => {
  if (msg.payload) res.write(`data: ${msg.payload}\n\n`);
});
req.on('close', () => {
  pgClient.query(`UNLISTEN ...`).finally(() => pgClient.release());
  res.end();
});
```

### getPool() Pattern for ironclaw-postgres (VERIFIED in project)

```typescript
// Source: backend/src/ironclaw/ironclaw-client.ts lines 61-65 (VERIFIED)
// ironclaw-postgres uses DATABASE_URL_IRONCLAW, separate pool

const ironclawDbUrl = process.env.DATABASE_URL_IRONCLAW ?? process.env.IRONCLAW_DB_URL ?? null;
if (ironclawDbUrl) {
  this.pool = new pg.Pool({ connectionString: ironclawDbUrl });
}
```

**CRITICAL:** The `ironclaw_events` table should be added to the **main Bastion PostgreSQL** (using `getPool()` from `lib/database.ts`) NOT to ironclaw-postgres. The ironclaw-postgres pool is for Ironclaw sidecar's internal data. Bastion's persistent chat data lives in the main Bastion DB alongside `ironclaw_chat`.

[VERIFIED: ironclaw-store.ts uses `getPool()` from `lib/database.js` for ironclaw_chat — same DB that should host ironclaw_events]

### Event Emission Helper Pattern

```typescript
// New ironclaw-event-store.ts pattern (to be created)
// Follows same singleton pattern as ironclawStore

export class IronclawEventStore {
  private clients = new Map<string, Set<Response>>();

  async append(
    scopeId: string,
    userDid: string,
    eventType: string,
    payload: unknown,
    threadId?: string,
  ): Promise<number> {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO ironclaw_events (scope_id, user_did, thread_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [scopeId, userDid, threadId ?? null, eventType, JSON.stringify(payload)],
    );
    const id: number = result.rows[0].id;
    this.emit(scopeId, eventType, payload, id);
    return id;
  }

  private emit(scopeId: string, eventType: string, payload: unknown, id: number): void {
    const clients = this.clients.get(scopeId);
    if (!clients?.size) return;
    const chunk = `id: ${id}\nevent: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of [...clients]) {
      try { res.write(chunk); }
      catch { clients.delete(res); }
    }
  }

  registerClient(scopeId: string, res: Response): void {
    if (!this.clients.has(scopeId)) this.clients.set(scopeId, new Set());
    this.clients.get(scopeId)!.add(res);
  }

  removeClient(scopeId: string, res: Response): void {
    this.clients.get(scopeId)?.delete(res);
  }

  async getEventsSince(scopeId: string, lastId: number, threadId?: string): Promise<Array<{id: number, event_type: string, payload: unknown}>> {
    const pool = getPool();
    const result = threadId
      ? await pool.query(
          `SELECT id, event_type, payload FROM ironclaw_events
           WHERE scope_id = $1 AND thread_id = $2 AND id > $3 ORDER BY id ASC`,
          [scopeId, threadId, lastId],
        )
      : await pool.query(
          `SELECT id, event_type, payload FROM ironclaw_events
           WHERE scope_id = $1 AND id > $2 ORDER BY id ASC`,
          [scopeId, lastId],
        );
    return result.rows;
  }
}

export const ironclawEventStore = new IronclawEventStore();
```

### Frontend useIronclaw EventSource Skeleton

```typescript
// Replace WebSocket section in useIronclaw.ts
// Key change: wsRef -> esRef; connectWebSocket -> connectSSE

const esRef = useRef<EventSource | null>(null);

const connectSSE = useCallback(() => {
  if (!mountedRef.current) return;

  const url = problemSetId
    ? `/api/ironclaw/${problemSetId}/stream`
    : `/api/ironclaw/global/stream`;

  const es = new EventSource(url, { withCredentials: true });
  esRef.current = es;

  es.onopen = () => { if (mountedRef.current) setIsConnected(true); };
  es.onerror = () => { if (mountedRef.current) setIsConnected(false); };
  // EventSource reconnects automatically — no manual backoff needed

  es.addEventListener('ack', (e: MessageEvent) => { /* clear loading or set pending state */ });
  es.addEventListener('response', (e: MessageEvent) => { /* append to messages */ });
  es.addEventListener('error', (e: MessageEvent) => { /* inline error + retry */ });
  es.addEventListener('tool_call', (e: MessageEvent) => { /* tool progress card */ });
  es.addEventListener('tool_result', (e: MessageEvent) => { /* update tool card */ });
  es.addEventListener('delegation', (e: MessageEvent) => { /* delegation notice */ });
  es.addEventListener('progress', (e: MessageEvent) => { /* progress indicator */ });

}, [problemSetId]);

// Cleanup on unmount
return () => {
  mountedRef.current = false;
  esRef.current?.close();
  esRef.current = null;
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Long-polling for AI responses | SSE / WebSocket | 2020+ | No polling needed |
| WebSocket for unidirectional push | SSE for unidirectional push | 2015-present | Simpler lifecycle, native reconnect |
| Custom token streaming buffers | Direct EventSource + append | 2023+ | Less code, same UX |

**Note on token streaming options:**
- Simulated: complete response -> split by word -> emit rapid `response` events with `delta: true` flag — no sidecar changes needed [ASSUMED to be viable]
- True streaming: use Ironclaw port 3000 `/v1/chat/completions` with `stream: true` — requires refactoring `ironclaw-client.ts` to consume streaming HTTP response

For Phase 67, simulated streaming is recommended to avoid scope expansion.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `withCredentials: true` required on EventSource for cookie auth to work | Architecture Patterns | SSE stream would fail auth if wrong — easily verified by testing |
| A2 | BIGSERIAL is the right event ID strategy (vs UUID + created_at) | Architecture Patterns | Wrong choice adds complexity but is fixable; BIGSERIAL is lower risk |
| A3 | ironclaw-postgres pool is NOT the right place for ironclaw_events (main Bastion DB is correct) | Code Examples | If wrong, events stored in wrong DB, history API breaks |
| A4 | Simulated token streaming (word chunking) satisfies D-05 without sidecar streaming API | Pitfalls | If user expects true per-token streaming from sidecar, requires scope expansion |
| A5 | The sidecar's OpenAI-compatible endpoint at port 3000 supports stream=true | Pitfalls | Relevant only if true streaming is chosen; not blocking for simulated approach |
| A6 | EventSource polyfill not needed (no IE11 requirement) | Standard Stack | Non-issue for this military internal app |

---

## Open Questions (RESOLVED)

1. **Token streaming approach (D-05)**
   - What we know: sidecar returns one complete response string via webhook
   - What's unclear: whether planner should implement simulated streaming (word chunks) or use sidecar's port 3000 streaming API
   - Recommendation: Default to simulated streaming in Phase 67; true streaming can be a future phase
   - **RESOLVED:** Simulated word chunking adopted in Plan 02 Task 1 — complete response is split by whitespace into rapid `response` delta events, achieving typewriter effect without sidecar streaming API changes.

2. **Thread filtering on SSE stream**
   - What we know: Users have tab-scoped threads; messages are filtered by threadId in WebSocket handler
   - What's unclear: Should the SSE stream be thread-scoped (only events for current thread) or scope-scoped (all threads, client filters)?
   - Recommendation: Scope-scoped stream (all threads, client filters by threadId) — matches D-11 single-stream decision
   - **RESOLVED:** Scope-scoped stream adopted. Plan 01 streams all events for the scope; Plan 03 frontend filters by threadId client-side in useIronclaw.ts event listeners.

3. **ironclaw_chat relationship to ironclaw_events for final response**
   - What we know: getHistory() reads from ironclaw_chat for the message thread view
   - What's unclear: Does a `response` event also write to ironclaw_chat, or does ironclaw_events replace ironclaw_chat?
   - Recommendation: Write final `response` events to BOTH tables — ironclaw_events for streaming/replay, ironclaw_chat for history display. Preserve backward compat.
   - **RESOLVED:** Write-to-both adopted in Plan 02 Task 1 — `ironclawStore.addMessage()` retained for ironclaw_chat backward compatibility alongside `ironclawEventStore.append()` for SSE streaming.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (main Bastion DB) | ironclaw_events table | Yes | 16 (pgvector) | — |
| Express 5.x | SSE endpoint | Yes | ^5.2.1 | — |
| Browser EventSource API | Frontend SSE client | Yes | MDN Standard | — |
| nginx proxy_buffering off | SSE streaming | Yes (already set) | — | Add X-Accel-Buffering: no header |

No missing dependencies. No environment gaps block execution.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.2 |
| Config file | vitest.config.ts (check backend/) |
| Quick run command | `bash -lc 'cd backend && npx vitest run --reporter=verbose 2>&1 | tail -20'` |
| Full suite command | `bash -lc 'cd backend && npx vitest run 2>&1'` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SSE-01 | SSE endpoint emits events with correct headers | integration | vitest — ironclaw-sse.test.ts | No — Wave 0 |
| SSE-02 | ironclaw_events table persists events, getEventsSince returns correct subset | unit | vitest — ironclaw-event-store.test.ts | No — Wave 0 |
| SSE-03 | All 7 event types serialize and parse correctly | unit | vitest — ironclaw-event-types.test.ts | No — Wave 0 |
| SSE-04 | Reconnect with Last-Event-ID replays missed events | integration | vitest — sse-reconnect.test.ts | No — Wave 0 |
| SSE-05 | EventSource connection lifecycle (connect, disconnect, reconnect) | smoke/manual | Browser dev tools | N/A — manual |
| SSE-06 | Auth cookie forwarded via withCredentials | smoke/manual | Browser network tab | N/A — manual |

### Wave 0 Gaps

- [ ] `backend/src/ironclaw/__tests__/ironclaw-event-store.test.ts` — covers SSE-02, SSE-03 (created by Plan 01 Task 1)
- [ ] `backend/tests/ironclaw/sse-reconnect.test.ts` — covers SSE-04 (not covered by current plans — integration test deferred to post-execution verification)
- [ ] Framework already installed (vitest in devDependencies)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | requireAuth middleware + cookie session — already applied to all ironclaw routes |
| V3 Session Management | yes | HttpOnly cookie; SSE endpoint must validate same session |
| V4 Access Control | yes | SSE scope must be gated to the authenticated user's problemSetId only |
| V5 Input Validation | yes | `event_type` and `payload` validated before DB insert; JSONB is not unvalidated string |
| V6 Cryptography | no | Events are not sensitive enough for at-rest encryption beyond DB-level |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User reads another user's SSE stream | Information Disclosure | Validate `getUserDid(req)` matches stream's scope; reject mismatched scopes |
| Prompt injection via event payload | Tampering | Don't render event payloads as unsanitized HTML; use react-markdown with sanitize |
| SSE connection amplification (DoS) | DoS | Limit concurrent SSE connections per user; enforce in registerClient() |
| Event replay of sensitive tool outputs | Information Disclosure | Permanent retention is decided (D-07); ensure requireAuth on stream endpoint |

---

## Sources

### Primary (HIGH confidence)

- `backend/src/api/doc-intelligence.ts` lines 860-953 — established SSE pattern with headers, client registry, catch-up events, disconnect cleanup
- `backend/src/api/exercise.ts` lines 1913-1958 — SSE with PostgreSQL LISTEN/NOTIFY pattern
- `backend/src/ironclaw/ironclaw-store.ts` — complete schema for ironclaw_chat, ironclaw_sessions, confirms getPool() from `lib/database.ts`
- `backend/src/ironclaw/ironclaw-service.ts` lines 99-118, 280-408 — `publishToChannel()` call sites to replace with SSE emission; `handleMessage()` flow
- `backend/src/ironclaw/ironclaw-client.ts` — confirms ironclaw-postgres is a separate pool from main Bastion DB
- `frontend/src/hooks/useIronclaw.ts` — complete WebSocket lifecycle to be replaced with EventSource
- `frontend/nginx.conf` line 43 — `proxy_buffering off` already set for /api/ routes
- `nginx/nginx.prod.conf` lines 74-77 — `proxy_buffering off` already set at host level

### Secondary (MEDIUM confidence)

- MDN Web Docs: EventSource API — named events, Last-Event-ID, withCredentials behavior
- [ASSUMED] Based on training knowledge of SSE + Express patterns, consistent with what is verified in codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies needed; all libraries already in use
- Architecture: HIGH — established SSE pattern directly usable from doc-intelligence.ts
- Pitfalls: HIGH for nginx/CORS (verified); MEDIUM for token streaming (sidecar capability not verified)
- Event schema: MEDIUM — BIGSERIAL choice is assumed best practice, not verified against alternatives

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable stack — 30 days)
