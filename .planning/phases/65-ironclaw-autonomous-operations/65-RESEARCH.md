# Phase 65: Ironclaw Autonomous Operations - Research

**Researched:** 2026-03-30
**Domain:** Autonomous agent operations, event-driven architecture, webhook APIs, heartbeat scheduling
**Confidence:** HIGH

## Summary

Phase 65 transforms Ironclaw from a reactive chat assistant into an autonomous Chief of Staff that operates continuously without user interaction. The existing codebase already has all the building blocks: the `IronclawClient` webhook API, the `RoutineService` with cron-based scheduling, `HEARTBEAT.md` rendering with monitoring directives, the `IronclawGapFillerService` for intelligence gap detection, the `MessageBus` for WebSocket push, `DecisionService.createDecision()` for programmatic decision gates, and `TelegramBotService` for alerts. The work is primarily integration and routing -- connecting these pieces through two new data paths: (1) a callback webhook endpoint (Ironclaw --> Bastion) for autonomous findings, and (2) event forwarding hooks (Bastion --> Ironclaw) that notify Ironclaw when OSINT, documents, or graph changes occur.

The key architectural insight is that Ironclaw's native OpenClaw runtime already supports heartbeat-driven autonomous operation via scheduled routines and `/routine register` commands. Bastion's `RoutineService` already sends these commands. The gap is that currently the heartbeat fires but Ironclaw has no way to push results back (no callback endpoint exists), and Bastion never forwards operational events to Ironclaw (OSINT ingestion, document processing, graph changes all complete silently). Additionally, the `IronclawGapFillerService` duplicates intelligence gap detection on the server side instead of delegating to Ironclaw via MCP tools.

**Primary recommendation:** Build a `/api/ironclaw/callback` endpoint authenticated by shared secret, add event forwarding hooks at OSINT/document/graph completion points, enrich HEARTBEAT.md with operational monitoring directives, migrate gap-filler capabilities to MCP tools, and add an autonomous activity feed to the UI.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express | 4.x | Callback webhook endpoint | Already used for all backend routes |
| pg-boss | 9.x | Async job queue for event forwarding | Already used for doc-intelligence, messaging |
| WebSocket (ws) | 8.x | Push autonomous findings to UI | Already used via MessageBus |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-cron | 3.x | NOT needed | Ironclaw's OpenClaw runtime handles scheduling natively via `/routine register` |
| @modelcontextprotocol/sdk | latest | MCP tool registration | Already in use for BASTION_TOOLS |

### No New Dependencies Required

All capabilities can be built using existing project libraries. No new npm packages needed.

## Architecture Patterns

### Recommended Project Structure
```
backend/src/ironclaw/
  ironclaw-callback-router.ts    # New: POST /api/ironclaw/callback endpoint
  event-forwarder.ts              # New: Hooks into OSINT/doc/graph pipelines, forwards to Ironclaw
  autonomous-activity-store.ts    # New: Persists autonomous activity log entries
  gap-filler-service.ts           # RETIRE: capabilities migrated to MCP tools
  identity-renderer.ts            # MODIFY: enrich HEARTBEAT.md with operational directives
  tool-bridge.ts                  # MODIFY: add new MCP tools for gap detection, conflict check, sit assessment
  routine-service.ts              # MODIFY: register autonomous monitoring routines at startup
  ironclaw-service.ts             # MODIFY: integrate autonomous activity into existing flow

frontend/src/
  components/ironclaw/
    IronclawActivityFeed.tsx       # New: autonomous activity log panel
  types/ironclaw.ts                # MODIFY: add AutonomousActivityEntry type
```

### Pattern 1: Callback Webhook (Ironclaw --> Bastion)
**What:** A new Express route that Ironclaw calls to push autonomous findings back to Bastion
**When to use:** Every time Ironclaw autonomously produces a finding, assessment, or action during heartbeat
**Example:**
```typescript
// backend/src/ironclaw/ironclaw-callback-router.ts
import { Router } from 'express';
import { verifyHMAC } from './hmac-auth.js';

const router = Router();

// No requireAuth -- this is machine-to-machine, authenticated via shared secret
router.post('/callback', verifyHMAC, async (req, res) => {
  const { type, problemSetId, payload, severity } = req.body;

  switch (type) {
    case 'intelligence_gap_detected':
      // Create PIR alert decision gate
      break;
    case 'conflict_detected':
      // Create conflict resolution decision gate
      break;
    case 'situation_assessment':
      // Store draft assessment, notify via WebSocket
      break;
    case 'skill_creation_request':
      // Medium-risk governance gate for self-extending
      break;
    case 'alert':
      // Push to Telegram + WebSocket
      break;
  }

  // Always log to autonomous activity store
  await autonomousActivityStore.log({ type, problemSetId, payload, severity });

  // Always push to WebSocket for UI activity feed
  await publishToChannel(problemSetId, 'ironclaw.autonomous-activity', { type, payload, severity });

  res.json({ status: 'ok' });
});
```

### Pattern 2: Event Forwarding (Bastion --> Ironclaw)
**What:** Hook into existing pipelines to forward events to Ironclaw via webhook
**When to use:** After OSINT ingestion, document processing, graph changes
**Example:**
```typescript
// backend/src/ironclaw/event-forwarder.ts
export async function forwardEventToIronclaw(event: {
  type: 'osint_ingested' | 'document_processed' | 'graph_changed' | 'decision_gate_created';
  problemSetId: string;
  summary: string;
  entityIds?: string[];
}) {
  // Use fire-and-forget async via sendMessageAsync
  // Thread = 'autonomous-{problemSetId}' for separation from user chat
  await ironclawClient.sendMessageAsync(
    `autonomous-${event.problemSetId}`,
    `[EVENT] ${event.type}: ${event.summary}`,
  );
}
```

### Pattern 3: Enriched HEARTBEAT.md
**What:** Populate HEARTBEAT.md with operational monitoring directives, not just user preferences
**When to use:** During identity sync, before heartbeat fires
**Example:**
```typescript
// Enhanced HEARTBEAT.md rendering
export function renderHeartbeatMd(config: AgentConfig, operationalContext?: {
  activePIRs: Array<{ description: string; priority: number }>;
  pendingDecisions: number;
  recentOSINTCount: number;
  knownGapCount: number;
}): string {
  // ... existing user preferences ...

  // Add operational monitoring directives
  if (operationalContext) {
    lines.push('### Autonomous Monitoring Tasks');
    lines.push('On each heartbeat tick, evaluate:');
    lines.push('1. Run conflict detection against the knowledge graph (bastion.graph.query)');
    lines.push('2. Check active PIRs against recent intelligence (bastion.intel.get_priority_intel_requirements)');
    lines.push('3. Assess intelligence gaps (bastion.intel.get_intelligence_gaps)');
    lines.push('4. If significant intelligence accumulated, draft situation assessment');
    lines.push('5. Check for stale decisions that need escalation');
    lines.push('');
    lines.push(`Active PIRs: ${operationalContext.activePIRs.length}`);
    lines.push(`Pending Decisions: ${operationalContext.pendingDecisions}`);
    lines.push(`Intelligence Gaps: ${operationalContext.knownGapCount}`);
    lines.push('');
    lines.push('### Callback Protocol');
    lines.push('When you identify a finding, POST to: POST http://bastion-mcp:3334/api/ironclaw/callback');
    lines.push('Include: { type, problemSetId, payload, severity }');
  }
}
```

### Anti-Patterns to Avoid

- **Running autonomous logic on the Bastion server side:** The whole point is Ironclaw owns autonomy. Do NOT build cron jobs in Node.js. Use Ironclaw's native heartbeat scheduler.
- **Blocking on Ironclaw responses during event forwarding:** Use `sendMessageAsync` for fire-and-forget. Event forwarding must NEVER block the pipeline that generated the event.
- **Unbounded autonomous cycles:** Always include circuit breakers -- max actions per heartbeat tick, cost caps, rate limits on callback endpoint.
- **Trusting Ironclaw callback payloads uncritically:** Validate all incoming callback data. Ironclaw is on an isolated network but defense-in-depth still applies. Use HMAC shared secret verification (already exists in `hmac-auth.ts`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job scheduling | Custom cron scheduler in Node.js | Ironclaw's OpenClaw `/routine register` | OpenClaw has built-in cron scheduling; Bastion already sends these commands via RoutineService |
| Message delivery | Custom WebSocket push logic | Existing `MessageBus.publish()` | Already handles pub/sub, delivery tracking, channel routing |
| Decision gates | Custom approval workflow | `DecisionService.createDecision()` | Already has RACI matrix, DAO proposal bridging, approval workflow |
| Telegram alerts | Custom bot API calls | `TelegramBotService.sendNotification()` | Already handles pairing, message formatting, chat discovery |
| HMAC auth | Custom signature verification | Existing `hmac-auth.ts` / `verifyHMAC` middleware | Already validates shared secret for Ironclaw-to-Bastion requests |
| Activity persistence | Custom file/memory store | PostgreSQL with simple table | Consistent with all other stores in the project |

## Common Pitfalls

### Pitfall 1: LLM Cost Runaway from Autonomous Heartbeat
**What goes wrong:** Heartbeat fires every N minutes, each tick invokes Claude, costs accumulate rapidly with no user oversight
**Why it happens:** No cost or rate limiting on autonomous cycles
**How to avoid:** Implement early-exit logic in HEARTBEAT.md directives (check if anything changed since last tick before doing full analysis). Set heartbeat interval to 30+ minutes for normal operations. Add a daily cost cap tracked by callback counter. Log every autonomous LLM invocation to the activity store.
**Warning signs:** Backend logs showing continuous heartbeat → callback cycles with no meaningful findings

### Pitfall 2: Callback Endpoint Spoofing
**What goes wrong:** Unauthenticated callback endpoint allows injection of fake autonomous findings
**Why it happens:** Callback is machine-to-machine on Docker network but not authenticated
**How to avoid:** Use the existing HMAC shared secret verification (`hmac-auth.ts`). Validate callback body schema. Rate-limit callbacks per problem set.
**Warning signs:** Unexpected autonomous activity appearing in UI without corresponding Ironclaw logs

### Pitfall 3: Event Forwarding Storm
**What goes wrong:** Bulk OSINT ingestion (e.g., 50 events) triggers 50 individual event forwards to Ironclaw, overwhelming the sidecar
**Why it happens:** Event forwarding hooks fire per-event without batching
**How to avoid:** Use pg-boss job queue for event forwarding with deduplication. Batch events over a short window (e.g., 30 seconds) and forward a summary. Use `sendMessageAsync` (fire-and-forget, no wait).
**Warning signs:** Ironclaw sidecar becoming unresponsive, webhook timeouts in backend logs

### Pitfall 4: Gap Filler Migration Incomplete
**What goes wrong:** Gap filler service retired but not all its capabilities available as MCP tools, leaving intelligence gaps unfilled
**Why it happens:** Gap filler does 5 things (detect gaps, build search queries, search SearXNG, create OSINT events, check PIR matches) and each needs a corresponding MCP tool or Ironclaw directive
**How to avoid:** Map every gap filler capability to either an existing MCP tool or a new one before removing the service. Test autonomous gap detection end-to-end before retirement.
**Warning signs:** Gap fill activity dropping to zero after migration

### Pitfall 5: Autonomous Thread Pollution in Chat History
**What goes wrong:** Autonomous Ironclaw messages mixed into user's chat history, confusing the conversation flow
**Why it happens:** Using the same thread ID for autonomous and user-initiated messages
**How to avoid:** Use a dedicated thread per problem set for autonomous activity (e.g., `autonomous-{psId}`). Display autonomous activity in a separate feed, not the main chat. Store in a separate table or with a clear `source = 'autonomous'` flag.
**Warning signs:** Users seeing unfamiliar messages in their chat history

### Pitfall 6: Docker Network Routing for Callback
**What goes wrong:** Ironclaw cannot reach the callback endpoint because it's on the isolated `ironclaw-network`
**Why it happens:** Ironclaw can only reach `bastion-mcp` on the ironclaw-network, NOT the main backend
**How to avoid:** Mount the callback endpoint on the `bastion-mcp` container (port 3334), NOT on the main backend (port 3001). Or add a proxy route on bastion-mcp that forwards to the backend. The MCP server already bridges both networks.
**Warning signs:** Connection refused errors from Ironclaw when posting to callback URL

## Code Examples

### Existing: Ironclaw Webhook API (Send Message)
```typescript
// Source: backend/src/ironclaw/ironclaw-client.ts
// Sends a message to Ironclaw via HTTP webhook
await ironclawClient.sendMessage(threadId, content, didSlug);
// Fire-and-forget version (no wait for response)
await ironclawClient.sendMessageAsync(threadId, content);
```

### Existing: Decision Gate Creation
```typescript
// Source: backend/src/decisions/decision-service.ts
await decisionService.createDecision({
  problem_set_id: problemSetId,
  decision_type: 'PIR_ALERT',   // Must exist in RACI matrix
  title: 'Intelligence Gap: Missing adversary ORBAT data',
  description: 'Ironclaw detected that...',
  context_json: { pirId, suggestedAnswer, source: 'ironclaw-autonomous' },
  requested_by: 'did:system:ironclaw',
});
```

### Existing: WebSocket Push to UI
```typescript
// Source: backend/src/ironclaw/ironclaw-service.ts
const bus = getMessageBus();
await bus.publish({
  sourceDid: 'did:system:ironclaw-autonomous',
  sourceType: 'system',
  destinationType: 'channel',
  destinationTarget: `ironclaw.${problemSetId}`,
  messageType: 'ironclaw.autonomous-activity',
  payload: { type: 'conflict_detected', summary: '...', severity: 'urgent' },
});
```

### Existing: Telegram Alert
```typescript
// Source: backend/src/ironclaw/telegram-bot-service.ts
// sendNotification already exists for pushing alerts
await telegramBotService.sendNotification(chatId, message);
```

### Existing: Routine Registration
```typescript
// Source: backend/src/ironclaw/routine-service.ts
// Registers a cron-based routine with Ironclaw's scheduler
await routineService.registerRoutine('autonomous_monitoring', '*/30 * * * *');
// Result: Ironclaw's heartbeat fires every 30 minutes
```

### Existing: Gap Filler Capabilities (to be migrated to MCP tools)
```typescript
// Source: backend/src/ironclaw/gap-filler-service.ts
// 1. Detect gaps: brainStore.getIntelligenceGaps(problemSetId)
//    → Already exposed as bastion.intel.get_intelligence_gaps MCP tool
// 2. Search: performWebSearch(query, maxResults)
//    → Need new bastion.intel.web_search MCP tool
// 3. Create OSINT event: osintEventStore.createEvent(...)
//    → Need new bastion.intel.create_osint_event MCP tool
// 4. Process through agents: processOSINTEventThroughAgents(event, feed)
//    → Need new bastion.intel.process_osint_event MCP tool
// 5. Check PIR matches: pirStore.getActivePIRsForGapResearch(problemSetId)
//    → Already exposed as bastion.intel.get_priority_intel_requirements
```

### Existing: MCP Tool Registration Pattern
```typescript
// Source: backend/src/ironclaw/tool-bridge.ts
export const BASTION_TOOLS: MCPToolDefinition[] = [
  {
    name: 'bastion.intel.web_search',         // NEW tool needed
    description: 'Search the web via SearXNG for intelligence on a topic',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        max_results: { type: 'number', description: 'Max results (default 5)' },
      },
      required: ['query'],
    },
    riskLevel: 'medium',
  },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side cron job (gap-filler) | Ironclaw-native heartbeat + MCP tools | Phase 65 | Ironclaw owns all autonomous intelligence work |
| Reactive chat only | Heartbeat + event-driven hybrid | Phase 65 | Continuous operational monitoring |
| Silent event completion | Event forwarding to Ironclaw | Phase 65 | Ironclaw aware of all operational changes |
| No callback path | Callback webhook endpoint | Phase 65 | Bidirectional Ironclaw-Bastion communication |

## Key Implementation Details

### Docker Network Constraint
Ironclaw sits on `ironclaw-network` and can ONLY reach `bastion-mcp` (port 3334). It cannot reach the main backend (port 3001) or any other service (postgres, neo4j, searxng). The callback endpoint MUST be mounted on the `bastion-mcp` service, or a proxy must be added. The MCP server (`backend/src/mcp/index.ts`) is a separate Express process that already bridges both `bastion-network` and `ironclaw-network`.

### Ironclaw Webhook API Format
```json
POST http://ironclaw:8080/webhook
{
  "content": "message text or /command",
  "thread_id": "unique-thread-id",
  "user": "thread-owner-id",
  "secret": "shared-secret",
  "wait_for_response": true|false
}
```
Response: `{ "message_id": "...", "status": "...", "response": "..." }`

Commands available: `/file write path content`, `/routine register id "cron"`, `/routine unregister id`, `/mcp add name url`

### HEARTBEAT.md Current Rendering
Currently renders user preferences (notification channel, monitoring directives from user config, custom routines). Needs to be enriched with operational context (active PIRs, intelligence gaps, pending decisions) so Ironclaw's heartbeat evaluation has actionable data.

### Gap Filler Service Capabilities to Migrate
| Capability | Current Implementation | Target MCP Tool |
|------------|----------------------|-----------------|
| Detect intelligence gaps | `brainStore.getIntelligenceGaps()` | `bastion.intel.get_intelligence_gaps` (EXISTS) |
| Web search for gap research | `performWebSearch()` | `bastion.intel.web_search` (NEW) |
| Create OSINT event from research | `osintEventStore.createEvent()` | `bastion.intel.create_research_event` (NEW) |
| Process OSINT through agent pipeline | `processOSINTEventThroughAgents()` | `bastion.intel.process_osint_event` (NEW) |
| Check PIR matches | `pirStore.getActivePIRsForGapResearch()` | `bastion.intel.get_priority_intel_requirements` (EXISTS) |
| Create PIR alert decision | `createPIRAlertDecision()` | `bastion.intel.create_pir_alert` (EXISTS) |
| Prioritize gap research | `gapFillerService.prioritizeGap()` | `bastion.intel.prioritize_gap_research` (EXISTS) |

### New MCP Tools Needed
1. `bastion.intel.web_search` -- wrap `performWebSearch()` from `doc-intelligence/web-search.ts`
2. `bastion.intel.create_research_event` -- wrap `osintEventStore.createEvent()` for synthetic OSINT events
3. `bastion.intel.process_osint_event` -- wrap `processOSINTEventThroughAgents()` for entity extraction pipeline
4. `bastion.intel.detect_conflicts` -- NEW: query knowledge graph for contradicting relationships/tensions
5. `bastion.intel.draft_situation_assessment` -- NEW: synthesize recent intelligence into a situation update
6. `bastion.autonomous.log_activity` -- NEW: log an entry to the autonomous activity feed
7. `bastion.autonomous.send_alert` -- NEW: push alert to WebSocket + Telegram based on severity

### Event Forwarding Hook Points
| Event Source | File | Hook Point |
|-------------|------|------------|
| OSINT event ingested | `backend/src/osint/osint-agent-bridge.ts` | After `processOSINTEventThroughAgents()` completes |
| Document processed | `backend/src/doc-intelligence/orchestrator-wiring.ts` | After specialist pipeline completes |
| Graph changed | `backend/src/graph/construction/graph-builder.ts` | After `buildFromDocument()` or OSINT sync |
| Decision gate created | `backend/src/decisions/decision-service.ts` | After `createDecision()` |
| PIR alert created | `backend/src/decisions/pir-alert-handler.ts` | After `createPIRAlertDecision()` |

### Autonomous Activity Feed Schema
```sql
CREATE TABLE ironclaw_autonomous_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_set_id TEXT NOT NULL REFERENCES problem_sets(id),
  activity_type TEXT NOT NULL,     -- 'gap_detected', 'conflict_found', 'assessment_drafted', etc.
  severity TEXT NOT NULL DEFAULT 'informational',  -- 'critical', 'urgent', 'routine', 'informational'
  summary TEXT NOT NULL,
  detail JSONB,
  decision_id UUID REFERENCES decisions(id),  -- if this activity created a decision gate
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_autonomous_activity_ps ON ironclaw_autonomous_activity(problem_set_id, created_at DESC);
```

### Frontend: Autonomous Activity Feed
Add a new tab or section in the IronclawDrawer showing autonomous activity. Separate from chat history. Shows what Ironclaw has been doing between user interactions. Each entry has: timestamp, type icon, summary, severity badge, link to decision gate if applicable.

WebSocket channel: `ironclaw.{problemSetId}` with message type `ironclaw.autonomous-activity`

### Circuit Breakers
- Max 10 callbacks per problem set per heartbeat tick
- Max 100 callbacks per problem set per day
- Heartbeat interval minimum 15 minutes (configurable via agent config)
- If callback endpoint returns 429, Ironclaw should back off (handled by HTTP client)
- Daily cost tracking: log estimated LLM token usage per autonomous cycle

## Open Questions

1. **OpenClaw heartbeat callback mechanism**
   - What we know: Ironclaw's OpenClaw runtime supports `/routine register` and scheduled execution. HEARTBEAT.md defines monitoring directives. Routines fire on cron schedule.
   - What's unclear: Does OpenClaw natively support a callback URL where heartbeat results are POSTed? Or does Ironclaw need to call the MCP tools explicitly during heartbeat and then POST results to the callback? The GOAL.md implies the latter (Ironclaw evaluates + calls back).
   - Recommendation: Design the callback as an explicit MCP tool (`bastion.autonomous.report_finding`) that Ironclaw calls when it discovers something worth reporting. This is more flexible than a native callback URL and works with any OpenClaw version.

2. **Self-extending skill creation governance**
   - What we know: GOAL.md says Ironclaw can create new skills/routines autonomously, subject to medium-risk governance gate. `bastion.skill.create` MCP tool already exists with `riskLevel: 'medium'`.
   - What's unclear: Should self-created skills be auto-registered with Ironclaw's runtime, or require human review first? Medium risk means action card confirmation in the UI.
   - Recommendation: Self-created skills go through the existing medium-risk action pipeline (user sees action card, confirms). After confirmation, auto-register the skill with Ironclaw via `/routine register`.

3. **Multiple problem sets monitoring**
   - What we know: The gap filler already monitors multiple problem sets via `monitoredProblemSets` set. Ironclaw needs to do the same.
   - What's unclear: Should there be one heartbeat per problem set, or one global heartbeat that iterates all active problem sets?
   - Recommendation: One heartbeat thread per active problem set, each with its own thread ID (`autonomous-{psId}`). This matches the gap filler pattern and keeps context separated.

## Sources

### Primary (HIGH confidence)
- `backend/src/ironclaw/ironclaw-client.ts` -- Webhook API format, sendMessage/sendMessageAsync
- `backend/src/ironclaw/gap-filler-service.ts` -- Full gap filler implementation to migrate
- `backend/src/ironclaw/identity-renderer.ts` -- HEARTBEAT.md rendering
- `backend/src/ironclaw/routine-service.ts` -- Routine registration, built-in routines
- `backend/src/ironclaw/tool-bridge.ts` -- All existing MCP tools
- `backend/src/ironclaw/ironclaw-service.ts` -- Message handling, identity sync
- `backend/src/decisions/decision-service.ts` -- Decision gate creation API
- `backend/src/ironclaw/telegram-bot-service.ts` -- Telegram notification API
- `backend/src/mcp/mcp-server.ts` -- MCP server on bastion-mcp container
- `docker-compose.yml` -- Network topology (ironclaw-network isolation)

### Secondary (MEDIUM confidence)
- `ironclaw_bastion_blueprint_v1.3.pdf` -- Blueprint reference (could not extract text but code references sections 3.1-3.5)
- GOAL.md architecture diagrams and success criteria

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- callback + event forwarding pattern is straightforward, all building blocks exist
- Pitfalls: HIGH -- identified from direct code analysis (Docker networking, thread pollution, cost runaway)
- Gap filler migration: HIGH -- complete capability mapping from source code analysis

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable -- internal project architecture, not external dependencies)
