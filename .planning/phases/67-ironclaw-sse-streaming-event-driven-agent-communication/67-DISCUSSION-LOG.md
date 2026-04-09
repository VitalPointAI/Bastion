# Phase 67: Ironclaw SSE Streaming & Event-Driven Agent Communication - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 67-ironclaw-sse-streaming-event-driven-agent-communication
**Areas discussed:** SSE vs WebSocket migration, Event stream UX, Event persistence & reconnection, Specialist delegation visibility

---

## SSE vs WebSocket migration

| Option | Description | Selected |
|--------|-------------|----------|
| Replace WebSocket entirely | Remove WS for Ironclaw chat. SSE becomes the only delivery channel. | |
| SSE for chat, keep WS for other events | Ironclaw chat moves to SSE. WebSocket stays for non-chat MessageBus events. | |
| Run both temporarily | Add SSE alongside WebSocket. Frontend uses SSE, but WS remains as fallback. | |

**User's choice:** SSE for chat, keep WS for other events — after extended discussion about collaborative editing concerns.
**Notes:** User initially asked about collaborative editing scenarios (COP layer editing). Discussion revealed Phase 56 uses Yjs CRDTs for collaborative map editing (separate transport). SSE + POST confirmed as correct for the turn-based chat interaction. Yjs handles simultaneous editing.

---

## Event stream UX

| Option | Description | Selected |
|--------|-------------|----------|
| Progressive reveal | Show each step as it happens in real-time | |
| Final response only | Show typing indicator, deliver complete response | |
| Collapsible tool trace | Final response shown, tool calls in collapsible section | |

**User's choice:** Progressive reveal

### Tool Call Verbosity

| Option | Description | Selected |
|--------|-------------|----------|
| Tool name + brief status | Compact status-line style | |
| Full tool I/O | Developer-level visibility inline | |
| Contextual depth | Tool name + status by default, expandable for full I/O | |

**User's choice:** Contextual depth

### Response Streaming

| Option | Description | Selected |
|--------|-------------|----------|
| Token-by-token streaming | Text appears word-by-word, like ChatGPT/Claude web | |
| Sentence/paragraph chunks | Buffer until natural break | |
| You decide | Claude picks based on technical constraints | |

**User's choice:** Token-by-token streaming

### Error Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error in stream | Error appears in chat flow | |
| Toast notification | Error as toast/banner | |
| Both — inline + retry | Error shown inline with Retry button | |

**User's choice:** Both — inline + retry

---

## Event persistence & reconnection

| Option | Description | Selected |
|--------|-------------|----------|
| Session-scoped (hours) | Events live for active session duration | |
| 24 hours | Events available for replay for a full day | |
| Permanent with aging | Keep structural events forever, age out verbose tool I/O | |
| Permanent, keep everything | Never delete events, full provenance | |

**User's choice:** Permanent, keep everything
**Notes:** User asked about tradeoffs. Explained that decision provenance (what Ironclaw actually looked at when making recommendations) matters for C2 platform. User chose full permanent retention.

### Reconnection Replay

| Option | Description | Selected |
|--------|-------------|----------|
| From Last-Event-ID | Standard SSE behavior, replay from last received event | |
| Last N minutes | Replay most recent 5-10 minutes | |
| Current thread only | Replay from active thread since last user message | |

**User's choice:** From Last-Event-ID (recommended by Claude — standard SSE, zero custom logic)

---

## Specialist delegation visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Nested sub-stream | Specialist work as indented section in chat | |
| Inline with specialist badge | Specialist messages in same stream with colored badge | |
| Separate specialist panel | Specialist work in separate panel | |

**User's choice:** Existing agent panel — user noted the agent activity panel is already built for this purpose.

### Chat vs Agent Panel Split

| Option | Description | Selected |
|--------|-------------|----------|
| Chat: delegation notice only | Chat shows delegation + result. Detail in agent panel. | |
| Chat: notice + summary result | Chat shows delegation + summarized result. Agent panel has full trace. | |
| Chat: full specialist stream | Everything streams in chat too with specialist badge. | |

**User's choice:** Chat: delegation notice only

### Navigation Link

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, clickable link | Delegation notice in chat is clickable, opens agent panel | |
| No, just informational | Display-only, manual navigation | |
| You decide | Claude picks based on existing navigation patterns | |

**User's choice:** Yes, clickable link

### Agent Panel Data Source

| Option | Description | Selected |
|--------|-------------|----------|
| Same SSE stream | Agent panel subscribes to same SSE endpoint | |
| Keep current source | Agent panel keeps polling/WS, only chat uses SSE | |
| You decide | Claude picks based on what agent panel currently uses | |

**User's choice:** Same SSE stream (recommended by Claude — single source of truth, real-time consistency)

---

## Claude's Discretion

- Event type taxonomy details (exact event names and payload shapes)
- SSE endpoint path design
- Event ID generation strategy
- ironclaw_events table schema details
- Frontend EventSource connection lifecycle management
- Relationship between ironclaw_chat and ironclaw_events tables
- Backend SSE implementation approach

## Deferred Ideas

- Real-time collaborative COP editing (user + Ironclaw editing map simultaneously) — uses Yjs, separate from chat SSE
