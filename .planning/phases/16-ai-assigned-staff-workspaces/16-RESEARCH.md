# Phase 16: AI Assigned Staff Workspaces — Research

**Researched:** 2026-03-02
**Domain:** AI agent orchestration, multi-agent staff simulation, human-in-the-loop review, real-time channel interface
**Confidence:** HIGH (codebase thoroughly read; Ironclaw authoritatively evaluated; LangGraph patterns verified against existing implementation)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Human | AI | Disabled toggle**
- "Manage Roles" modal gains a third state per position: Human | AI | Disabled
- Human = current behavior (workspace shown, human fills it)
- AI = agent team assigned, workspace shows AI-generated products + channel interface
- Disabled = position not staffed

**Workspace visual mode**
- Side-by-side layout: product panel (primary/wider) on left or main area, channel/activity feed (narrower) on right
- Products panel is the primary surface — channel feed is a supporting sidebar
- Initial state (before agents begin): Agent roster card showing the assigned team (names, ranks, focus areas) with a "Begin" button — no product templates shown until work starts
- Access control: Role-based — only the assigned supervisor or commander role can intervene or edit; all others are read-only observers

**Agent task initiation**
- Both manual (human clicks "Begin" on the roster card) and event-driven (auto-trigger on key events)
- Auto-trigger events:
  1. OPORD / scenario package uploaded
  2. Exercise phase changes
  3. Upstream human or AI role publishes a product this role depends on
  4. Commander role issues an explicit directive to this role
- Pause and resume control: humans can pause agent execution mid-task and resume it later
- Concurrent trigger handling: multiple simultaneous triggers merge context — one enriched execution run (not duplicated runs)

**Product review & approval**
- Review access surfaces in three places simultaneously: notification fired, channel feed "Review required" card, and product panel "Pending Review" badge
- Reviewer actions (full set):
  - Approve → publishes immediately
  - Edit then approve → reviewer edits inline, then publishes
  - Request revision → sends feedback back to agent team for another pass
  - Edit then request revision → reviewer makes partial edits, sends back for completion
  - Reject → returns with reason, agents must restart
- Feedback to agents on revision/rejection: free-text notes + annotated product (reviewer highlights sections, adds inline comments; agents receive the marked-up version)
- Full version history: Every agent draft and revision iteration is stored and visible to reviewers

**Cross-role AI coordination**
- Shared context store: All AI roles write to and read from a shared exercise context object in real-time (not limited to published products only)
- AI-to-AI tasking: Supported — via explicit AI-to-AI messages or shared context store writes
- Full auditability required: Every AI-to-AI coordination event (who asked who, what was requested, what was returned) is logged and accessible to human observers
- Waiting behavior: When blocked on an input from another role, agents display a "Waiting on [Role]: [what's needed]" status in the channel feed, but continue working on all tasks that don't depend on the missing input
- Coordination observability: Claude's discretion

**Default AI agent library**
- Generate the full canonical default AI team for all 31 staff roles based on doctrinal references
- Minimum 3 agents per role, typically 4–5
- Each agent has a singular focus (single responsibility principle)
- Deterministic results — narrow scope, no ambiguity in what each agent does
- Role-appropriate rank, name, branch, and communication style
- Grounded in JP 3-0, JP 5-0, FM 6-0, and relevant functional doctrine
- The planning agent MUST produce this library as part of the plan — not defer to implementation

**Agent identity requirements (per agent)**
- name — realistic military name (first initial + last name)
- rank — appropriate grade (typically O-3 to O-5; CW2–CW4 for technical specialties; E-7 to E-9 for enlisted specialists)
- branch / specialty — Army/joint branch and functional area
- focus — single-sentence description of exactly what this agent does (no overlap with teammates)
- tools — list of tool types this agent should have access to
- personality — communication style tokens (e.g., concise, analytical, risk-aware, action-oriented)
- systemPromptHint — 1–2 sentence persona primer for the LLM system prompt

**Ironclaw integration**
- Research https://github.com/nearai/ironclaw before planning
- If good fit: integrate as orchestration layer
- If not fit: direct LLM agent loop with multi-turn tool calls, channel-interface designed for future ironclaw migration

**Channel interface design**
- Structured activity log (not a general chatbox) per AI-assigned role
- Shows: tasks currently executing, draft products being generated (with review prompts), questions requiring human decision, final product links when complete
- Human intervention points are surfaced explicitly — not buried in feed

**Agent design principles**
1. Single responsibility — each agent does exactly one thing
2. Deterministic scope — output is predictable given inputs
3. No overlap — agents on the same team don't duplicate each other's work
4. Escalation path — every agent has a clear condition under which it routes to human review
5. Identity coherence — persona is consistent with functional role and rank

### Claude's Discretion
- Exact layout proportions and breakpoints for the side-by-side workspace
- Where coordination observability surfaces (per-role channel, unified commander view, or both)
- Loading/transition animations when agents begin or pause
- Error state handling when ironclaw or agent execution fails

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope

</user_constraints>

---

## Summary

Phase 16 extends the existing Phase 15 staff workspace system to support AI-assigned roles. The critical architecture decision is how to run the AI agents: research confirms that **Ironclaw is not a viable integration target** — it is a standalone Rust binary with no Node.js API, no embeddable library interface, and requires a NEAR AI account via browser OAuth. The project already has a production-ready LangGraph implementation (`@langchain/langgraph` ^1.1.0 already installed) with supervisor pattern, checkpointing, human-in-the-loop, and streaming — all the capabilities Phase 16 needs.

The codebase has significant scaffolding already in place: `StaffProduct` already has an `agentTeamId` field, `agent_team_config` table already exists, `STAFF_ROLE_CONFIG` covers all 31 roles with `agentTeamId: null` placeholders, and the orchestration layer (`supervisor.ts`, `execution-patterns.ts`) implements parallel/sequential/hierarchical patterns. Phase 16 builds on this infrastructure by wiring up the AI execution path, adding the channel interface to the database, extending the "Manage Roles" modal with Human|AI|Disabled state, and seeding the 31-role agent library as database records.

The primary architectural pattern is: per-AI-role, a LangGraph graph runs as a background job (via `pg-boss` already installed), streams channel events via Server-Sent Events (SSE), writes drafts to `staff_products` when complete, and triggers the existing notification system for review. Cross-role coordination uses a new `ai_context_store` table (JSON blob per scenario, keyed by sharing role) with PostgreSQL LISTEN/NOTIFY for real-time updates between roles.

**Primary recommendation:** Use LangGraph (`@langchain/langgraph` v1.1.0 already installed) as the agent execution layer with SSE streaming for channel events, `pg-boss` for background job queuing, and PostgreSQL LISTEN/NOTIFY for cross-role coordination. Do NOT integrate Ironclaw.

---

## Ironclaw Evaluation (CRITICAL — Required by CONTEXT.md)

### Verdict: DO NOT INTEGRATE IRONCLAW

**Source:** Official GitHub repository https://github.com/nearai/ironclaw (fetched 2026-03-02)
**Confidence:** HIGH

| Criterion | Ironclaw Status | Phase 16 Requirement |
|-----------|-----------------|----------------------|
| Long-running autonomous execution | YES — Docker sandbox orchestrator | YES |
| Message/event stream interface | YES — SSE + WebSocket in web gateway | YES |
| Node.js/TypeScript integration | NO — Rust binary only, zero Node.js API | YES (required) |
| Authentication model | NEAR AI account via browser OAuth | Passkey/NEAR implicit (incompatible) |
| Context passing | PostgreSQL memory + vector search | Via invocation params |
| Embeddable in Express app | NO — standalone application | YES (required) |
| npm package | DOES NOT EXIST | YES (required) |

**Ironclaw is a standalone Rust binary** installed via Homebrew or compiled from source. It is not a library. It cannot be `npm install`'d, imported into TypeScript, or embedded in the Express backend. The NEAR AI authentication uses browser OAuth, which is incompatible with the project's passkey/implicit account model.

**Decision:** Use direct LangGraph agent loop (pattern already established in `backend/src/agents/langgraph/` and `backend/src/orchestration/`). Design the channel interface for future migration compatibility by using an abstraction layer (an `AgentRunner` interface that LangGraph implements), so a future Rust sidecar or Ironclaw-adjacent tool could replace the runner without changing the channel/UI code.

---

## Standard Stack

### Core (all already installed in backend/package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@langchain/langgraph` | ^1.1.0 | Agent graph execution, state machines, streaming | Already used in strategy-reviewer-graph; has StateGraph, streaming, interrupt |
| `@langchain/langgraph-checkpoint-postgres` | ^1.0.0 | Durable graph state with resume-after-pause | Already installed; required for pause/resume per CONTEXT.md |
| `@langchain/anthropic` | ^1.3.10 | Anthropic Claude models via LangChain | Already in LLM factory |
| `@langchain/openai` | ^1.2.2 | OpenAI-compatible models (NEAR AI, Ollama) | Already in LLM factory |
| `@langchain/core` | ^1.1.15 | Message types, base models, streaming | Used throughout |
| `pg-boss` | ^12.5.4 | Background job queuing with retry/concurrency | Already installed; ideal for AI execution jobs |
| `pg` | ^8.16.3 | PostgreSQL (LISTEN/NOTIFY for cross-role events) | Already installed |
| `ws` | ^8.19.0 | WebSocket server (existing notification system) | Already used for staff notifications |
| `@anthropic-ai/sdk` | ^0.71.2 | Direct Anthropic API (streaming text) | Already installed |

### No new packages required
The entire Phase 16 stack is already installed. No `npm install` needed.

### Supporting (existing project infrastructure)
| Pattern | Implementation | Purpose |
|---------|---------------|---------|
| SSE streaming | Express `res.write()` + `text/event-stream` | Channel event feed to UI |
| PostgreSQL LISTEN/NOTIFY | `pg` `client.query('LISTEN channel')` | Cross-role real-time coordination |
| LangGraph interrupt | `interrupt()` from `@langchain/langgraph` | Human-in-the-loop review gates |
| pg-boss queues | `boss.send('ai-role-execution', payload)` | Durable async agent runs |

---

## Architecture Patterns

### Database Schema Extensions Required

```sql
-- ── 017-ai-staff-workspaces.sql ────────────────────────────────────────────

-- Per-position assignment mode: human | ai | disabled
ALTER TABLE exercise_scenarios
  ADD COLUMN IF NOT EXISTS role_assignments JSONB NOT NULL DEFAULT '{}';
-- Shape: { "j2": "human", "j3": "ai", "sja": "disabled", ... }
-- Default (empty object): all positions default to "human"

-- Agent library: seeded default agents for all 31 roles
CREATE TABLE IF NOT EXISTS staff_agents (
  id TEXT PRIMARY KEY,
  role_key TEXT NOT NULL,           -- e.g. "j2"
  name TEXT NOT NULL,               -- "CPT J. Martinez"
  rank TEXT NOT NULL,               -- "CPT"
  branch TEXT NOT NULL,             -- "MI"
  specialty TEXT NOT NULL,          -- "All-Source Intelligence"
  focus TEXT NOT NULL,              -- Single-sentence what this agent does
  tools TEXT[] NOT NULL DEFAULT '{}', -- Tool type list
  personality TEXT[] NOT NULL DEFAULT '{}', -- Style tokens
  system_prompt_hint TEXT NOT NULL, -- 1-2 sentence persona primer
  is_default BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_agents_role ON staff_agents(role_key);

-- AI execution runs: one row per agent team invocation
CREATE TABLE IF NOT EXISTS ai_role_runs (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  trigger_type TEXT NOT NULL,       -- 'manual' | 'opord_upload' | 'phase_change' | 'upstream_publish' | 'commander_directive'
  trigger_context JSONB NOT NULL DEFAULT '{}', -- merged context from concurrent triggers
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'paused', 'awaiting_review', 'complete', 'failed')),
  paused_at TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_role_runs_scenario_role ON ai_role_runs(scenario_id, role_key, status);

-- Channel feed events: activity log entries per AI role
CREATE TABLE IF NOT EXISTS ai_channel_events (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  run_id TEXT REFERENCES ai_role_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
    -- 'task_started' | 'task_progress' | 'draft_ready' | 'review_required'
    -- | 'revision_requested' | 'approved' | 'rejected' | 'waiting_on_role'
    -- | 'ai_to_ai_request' | 'ai_to_ai_response' | 'error' | 'paused' | 'resumed'
  payload JSONB NOT NULL DEFAULT '{}',
  agent_name TEXT,                  -- Which agent generated this event
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_channel_events_scenario_role
  ON ai_channel_events(scenario_id, role_key, created_at);

-- Product version history: full draft chain (not just latest)
CREATE TABLE IF NOT EXISTS staff_product_versions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES staff_products(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  structured JSONB NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,         -- 'agent:agentName' or 'user:did'
  revision_notes TEXT,              -- Human feedback that triggered this revision
  annotated_feedback JSONB,         -- Highlighted sections with inline comments
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_product_versions_product
  ON staff_product_versions(product_id, version);

-- Shared AI context store: real-time cross-role context
CREATE TABLE IF NOT EXISTS ai_context_store (
  scenario_id TEXT NOT NULL REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  context_data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scenario_id, role_key)
);

-- AI-to-AI coordination audit log
CREATE TABLE IF NOT EXISTS ai_coordination_log (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
  requesting_role TEXT NOT NULL,
  responding_role TEXT NOT NULL,
  request_type TEXT NOT NULL,       -- 'context_read' | 'explicit_task' | 'shared_write'
  request_payload JSONB NOT NULL DEFAULT '{}',
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_coordination_log_scenario
  ON ai_coordination_log(scenario_id, created_at);
```

### Recommended Project Structure (new files only)

```
backend/src/
├── exercise/
│   ├── ai-role-runner.ts        # AgentRunner interface + LangGraph implementation
│   ├── ai-role-graph.ts         # LangGraph StateGraph for staff role execution
│   ├── ai-channel-store.ts      # CRUD for ai_channel_events
│   ├── ai-context-store.ts      # CRUD for ai_context_store + LISTEN/NOTIFY
│   ├── ai-run-store.ts          # CRUD for ai_role_runs
│   ├── ai-coordination-store.ts # CRUD for ai_coordination_log
│   ├── product-version-store.ts # CRUD for staff_product_versions
│   ├── trigger-router.ts        # Merges concurrent triggers into one enriched run
│   └── agent-library.ts         # Seed data: 31-role default agent library
├── api/
│   └── exercise.ts              # Add new routes: role-assignments, ai-runs, channel, etc.
└── database/
    └── 017-ai-staff-workspaces.sql

frontend/src/
├── components/exercise/
│   ├── ManageRolesModal.tsx      # Extend with Human|AI|Disabled toggle
│   ├── AIRoleWorkspace.tsx       # New: AI workspace (product panel + channel)
│   ├── AgentRosterCard.tsx       # New: initial state before agents begin
│   ├── ChannelFeed.tsx           # New: structured activity log
│   ├── ChannelEvent.tsx          # New: individual channel event renderer
│   ├── ProductReviewPanel.tsx    # New: review actions + annotated feedback
│   └── ProductVersionHistory.tsx # New: version chain viewer
└── services/
    └── exercise-service.ts       # Extend: role-assignments, SSE channel, runs
```

### Pattern 1: LangGraph State Graph for Staff Role Execution

**What:** Each AI-assigned role runs a LangGraph graph with defined nodes: context assembly, parallel agent fan-out, product generation, human-in-the-loop interrupt, revision loop.
**When to use:** When a role is triggered (manually or by event).

```typescript
// Source: existing backend/src/agents/langgraph/graphs/strategy-reviewer-graph.ts pattern
import { StateGraph, END, START, interrupt } from '@langchain/langgraph';
import { Annotation, messagesStateReducer } from '@langchain/langgraph';

const AIRoleState = Annotation.Root({
  scenarioId: Annotation<string>(),
  roleKey: Annotation<string>(),
  runId: Annotation<string>(),
  triggerContext: Annotation<Record<string, unknown>>(),
  agentTeam: Annotation<StaffAgentDef[]>(),
  sharedContext: Annotation<Record<string, unknown>>(),
  currentProducts: Annotation<StaffProduct[]>(),
  draftContent: Annotation<Record<string, string>>(),  // agentId -> content
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer }),
  status: Annotation<'running' | 'awaiting_review' | 'complete' | 'failed'>(),
  reviewFeedback: Annotation<ReviewFeedback | null>(),
  iterationCount: Annotation<number>(),
});

// Graph nodes: assemble_context -> run_agents (parallel) -> merge_drafts
//              -> await_review (interrupt) -> [approve|revise|reject]
```

### Pattern 2: SSE Channel Event Stream

**What:** Frontend subscribes to `GET /api/exercise/:scenarioId/roles/:roleKey/channel` — backend streams `ai_channel_events` as Server-Sent Events.
**When to use:** When the AI workspace panel is open; automatically reconnects.

```typescript
// Backend: Express SSE endpoint
router.get('/:scenarioId/roles/:roleKey/channel', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send existing events (backfill)
  const existing = await channelStore.findByRole(scenarioId, roleKey);
  for (const event of existing) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  // Subscribe to new events via pg LISTEN
  const pgClient = await getPool().connect();
  await pgClient.query(`LISTEN "channel:${scenarioId}:${roleKey}"`);
  pgClient.on('notification', (msg) => {
    res.write(`data: ${msg.payload}\n\n`);
  });

  req.on('close', () => { pgClient.release(); });
});

// Backend: emit after inserting event
await pgClient.query(
  `SELECT pg_notify($1, $2)`,
  [`channel:${scenarioId}:${roleKey}`, JSON.stringify(event)]
);
```

### Pattern 3: Trigger Deduplication / Context Merge

**What:** Multiple events arriving within a short window (e.g., OPORD upload + phase change) are merged into a single enriched run rather than spawning duplicate jobs.
**When to use:** All auto-trigger events route through this layer.

```typescript
// trigger-router.ts
const MERGE_WINDOW_MS = 2000; // 2-second debounce window

class TriggerRouter {
  private pending = new Map<string, { timeout: NodeJS.Timeout; context: TriggerContext[] }>();

  async trigger(scenarioId: string, roleKey: string, event: TriggerContext) {
    const key = `${scenarioId}:${roleKey}`;
    const existing = this.pending.get(key);

    if (existing) {
      clearTimeout(existing.timeout);
      existing.context.push(event);
    } else {
      this.pending.set(key, { context: [event], timeout: null! });
    }

    const entry = this.pending.get(key)!;
    entry.timeout = setTimeout(async () => {
      this.pending.delete(key);
      await this.dispatchMergedRun(scenarioId, roleKey, entry.context);
    }, MERGE_WINDOW_MS);
  }

  private async dispatchMergedRun(scenarioId: string, roleKey: string, contexts: TriggerContext[]) {
    const mergedContext = mergeContexts(contexts);
    await boss.send('ai-role-execution', { scenarioId, roleKey, triggerContext: mergedContext });
  }
}
```

### Pattern 4: LangGraph Interrupt for Human Review

**What:** After agent drafts are generated, the graph calls `interrupt()` to pause and surface the review card. Human action (approve/revise/reject) resumes the graph with feedback.
**When to use:** Every time agents produce a product draft.

```typescript
// Source: @langchain/langgraph interrupt API
import { interrupt } from '@langchain/langgraph';

async function awaitReview(state: AIRoleStateType) {
  // Emit 'review_required' channel event
  await channelStore.create({ ...reviewRequiredEvent });

  // LangGraph interrupt — pauses graph, persists state to PostgreSQL checkpoint
  const feedback = interrupt({
    type: 'product_review',
    productId: state.currentProductId,
    draftVersion: state.iterationCount,
  });

  // Resumed by POST /api/exercise/:scenarioId/roles/:roleKey/runs/:runId/review
  return { reviewFeedback: feedback as ReviewFeedback };
}

// Resume graph from API endpoint
const config = { configurable: { thread_id: run.id } };
await graph.invoke({ reviewFeedback }, config);
```

### Pattern 5: pg-boss for Durable Background Agent Execution

**What:** Agent runs are submitted as `pg-boss` jobs. This provides retry on crash, concurrency limiting per role, and survives backend restarts.
**When to use:** All agent run initiations.

```typescript
// Pattern already used by existing infrastructure (pg-boss ^12.5.4 installed)
await boss.send('ai-role-execution', {
  scenarioId, roleKey, runId, triggerContext,
}, {
  singletonKey: `${scenarioId}:${roleKey}`, // Deduplication: one active run per role
  retryLimit: 2,
  retryDelay: 30,
});

boss.work('ai-role-execution', { teamSize: 3 }, async (job) => {
  const { scenarioId, roleKey, runId, triggerContext } = job.data;
  await runAIRoleGraph(scenarioId, roleKey, runId, triggerContext);
});
```

### Pattern 6: Cross-Role AI Coordination via Shared Context Store

**What:** AI roles read/write a shared JSONB context keyed by (scenarioId, roleKey). PostgreSQL NOTIFY propagates updates to listening roles.
**When to use:** AI roles publishing interim data other AI roles depend on.

```typescript
// ai-context-store.ts
class AIContextStore {
  async write(scenarioId: string, roleKey: string, data: Record<string, unknown>) {
    await pool.query(
      `INSERT INTO ai_context_store (scenario_id, role_key, context_data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (scenario_id, role_key) DO UPDATE
       SET context_data = ai_context_store.context_data || $3, updated_at = NOW()`,
      [scenarioId, roleKey, JSON.stringify(data)]
    );
    // Notify other roles listening
    await pool.query(
      `SELECT pg_notify($1, $2)`,
      [`context:${scenarioId}`, JSON.stringify({ sourceRole: roleKey, keys: Object.keys(data) })]
    );
  }

  async read(scenarioId: string, roleKey: string): Promise<Record<string, unknown>> {
    const result = await pool.query(
      `SELECT context_data FROM ai_context_store WHERE scenario_id = $1 AND role_key = $2`,
      [scenarioId, roleKey]
    );
    return result.rows[0]?.context_data ?? {};
  }
}
```

### Anti-Patterns to Avoid

- **Running agent execution synchronously in Express request handlers:** AI execution takes minutes. Always dispatch to pg-boss and return a run ID immediately.
- **Polling for channel events from the frontend:** Use SSE (already established in project) not polling. Polling creates excessive DB load at scale.
- **One LangGraph graph per agent (not per role):** Create one graph per *role invocation* that internally fans out to multiple agents in parallel. Otherwise checkpointing state becomes unwieldy.
- **Storing product content in ai_channel_events payloads:** Events are activity log entries. Full product content lives in `staff_products`. Events reference by ID.
- **Running one pg-boss job per agent:** One job per *role run*. The role run graph manages individual agent calls internally.
- **Spawning duplicate runs when multiple triggers arrive:** The TriggerRouter debounce + `singletonKey` on pg-boss prevents this.
- **Saving full draft history by overwriting staff_products:** Never overwrite. Use `staff_product_versions` for every draft iteration, keep `staff_products` as the "current" pointer.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Durable background agent execution | Custom job runner | `pg-boss` (already installed) | Retry, deduplication, crash recovery, concurrency control |
| Agent graph state machine | Manual state enum + switch | `@langchain/langgraph` StateGraph (already installed) | Checkpointing, interrupt/resume, streaming — all built-in |
| Pause/resume during execution | Custom flag polling | LangGraph `interrupt()` + PostgreSQL checkpoint | Transactional pause state; survives backend restarts |
| Streaming execution output to UI | WebSocket or polling | SSE `text/event-stream` + PostgreSQL `LISTEN/NOTIFY` | SSE is simpler than WebSocket for unidirectional streams; existing project pattern for notifications |
| Cross-role event propagation | REST endpoint polling | PostgreSQL `LISTEN/NOTIFY` via `pg` client | Already used for staff notifications; zero extra infrastructure |
| Text diff for annotated feedback | Custom diff algorithm | Existing `ProductDiffView` component + structured annotation JSON | Phase 15 already built diff view; annotated feedback is JSON highlights array |
| LLM multi-provider routing | Custom API wrapper | Existing `LLM Factory` in `backend/src/agents/langgraph/llm-factory.ts` | Already handles Anthropic, OpenAI, Azure, NEAR AI, Ollama |

**Key insight:** The project has invested heavily in LangGraph, orchestration patterns, and pg-boss. Phase 16 should wire these together rather than build new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Duplicate AI Runs from Concurrent Triggers
**What goes wrong:** OPORD upload and phase change arrive within seconds. Two separate `pg-boss` jobs spawn two separate graph executions for the same role. Products are generated twice, channel feed shows duplicate events.
**Why it happens:** Event handlers each independently call `boss.send()`.
**How to avoid:** Route ALL triggers through `TriggerRouter` with a debounce window (2s). Use `singletonKey: \`${scenarioId}:${roleKey}\`` in pg-boss `send()` options — subsequent sends within the singleton window are discarded.
**Warning signs:** Two "Task Started" entries in channel feed for same role within seconds.

### Pitfall 2: LangGraph State Not Persisting Across Pause/Resume
**What goes wrong:** Human pauses agents. Backend restarts. Graph state is lost. Resume fails with "thread not found."
**Why it happens:** Using in-memory checkpointer (`MemorySaver`) instead of PostgreSQL checkpointer.
**How to avoid:** Always use `@langchain/langgraph-checkpoint-postgres` (already installed). Initialize checkpointer with the same pool instance used by the app. Pass `thread_id: runId` in every graph invocation config.
**Warning signs:** Resume works in dev (same process lifetime) but fails after deploy.

### Pitfall 3: Channel Feed Flooding on Long Runs
**What goes wrong:** AI agents emit progress events every sentence. Channel feed shows thousands of entries for a single run. Frontend performance degrades.
**Why it happens:** Streaming LLM tokens directly to channel events.
**How to avoid:** Buffer events. Emit `task_progress` events at meaningful milestones (section complete, tool call complete) not token-by-token. Final draft emits one `draft_ready` event with product ID reference. Store streaming output in memory during generation; persist final product to DB.
**Warning signs:** `ai_channel_events` row count explodes during runs.

### Pitfall 4: Race Condition in Cross-Role Context Reads
**What goes wrong:** J2 starts reading J3's context while J3 is mid-write. J2 gets partial or stale data. Agents produce products based on inconsistent input.
**Why it happens:** PostgreSQL JSONB merge isn't atomic for concurrent reads and writes without proper isolation.
**How to avoid:** Use PostgreSQL `FOR UPDATE` on context reads when agents need a consistent snapshot. Design context writes to be additive merges (`||` operator in ON CONFLICT DO UPDATE) rather than full overwrites. Version context entries with a counter so agents can detect staleness.
**Warning signs:** AI products referencing different force dispositions than what J2 published.

### Pitfall 5: Annotated Feedback Lost in Revision Loop
**What goes wrong:** Reviewer highlights sections and adds inline comments. Agents receive only the free-text notes. Highlighted sections are ignored. Revision doesn't address the specific feedback.
**Why it happens:** Annotated feedback (highlighted JSON array) is stored separately from the free-text notes and not passed to the agent system prompt.
**How to avoid:** Build `ReviewFeedback` type that includes both `notes: string` and `annotations: Array<{ startOffset, endOffset, text, comment }>`. Serialize annotations as plaintext ("Paragraph 2, lines 3-5: [text excerpt] — [comment]") when constructing agent revision prompt. Store full JSON in `staff_product_versions.annotated_feedback`.
**Warning signs:** Agents in revision respond to general feedback but miss specific highlighted passages.

### Pitfall 6: AI Workspace vs Human Workspace CSS Collision
**What goes wrong:** Switching a role from Human to AI mid-session renders the old human `RoleDashboard` styles inside the new AI workspace layout. Side-by-side channel panel overflows or breaks grid.
**Why it happens:** `RoleDashboard` is conditionally rendered based on assignment mode, but CSS transitions aren't cleanly handled.
**How to avoid:** `AIRoleWorkspace` and the human `RoleDashboard` are completely separate components mounted/unmounted based on assignment mode. No shared container structure. Use `key` prop on the mounting container to force full remount when mode changes.
**Warning signs:** Channel panel clips product panel; human product editor appears inside AI workspace.

### Pitfall 7: Missing Escalation Path Blocks Entire Role
**What goes wrong:** An agent hits an edge case (missing input, ambiguous scenario data) with no escalation logic. It loops or fails silently. The channel feed shows no progress. The role is stuck indefinitely.
**Why it happens:** Agent design doesn't implement the "escalation path" principle from CONTEXT.md.
**How to avoid:** Every agent node in the LangGraph graph has a max-iteration limit. When limit is hit, the graph emits a `review_required` event with escalation reason and calls `interrupt()`. Channel event type `'error'` is reserved for hard failures; `'review_required'` with `escalated: true` signals human decision needed.
**Warning signs:** `ai_role_runs.status` stays `'running'` indefinitely; no `draft_ready` or `review_required` events appear.

---

## Code Examples

### Agent Library Seed Data Structure (for one role)

```typescript
// Source: CONTEXT.md agent identity requirements
// Pattern derived from existing AgentManifest + CharacterSchema in registry.ts

export interface StaffAgentDef {
  id: string;                  // UUID
  roleKey: string;             // 'j2'
  name: string;                // 'CPT J. Martinez'
  rank: string;                // 'CPT'
  branch: string;              // 'MI'
  specialty: string;           // 'All-Source Intelligence'
  focus: string;               // Single sentence, single responsibility
  tools: string[];             // Tool type identifiers
  personality: string[];       // Style tokens
  systemPromptHint: string;    // 1-2 sentence LLM primer
  isDefault: boolean;
}

// Example: J2 Intelligence role (4 agents, each with singular focus)
export const J2_DEFAULT_AGENTS: StaffAgentDef[] = [
  {
    id: uuid(),
    roleKey: 'j2',
    name: 'MAJ S. Nguyen',
    rank: 'MAJ',
    branch: 'MI',
    specialty: 'All-Source Intelligence Analysis',
    focus: 'Produces the IPB assessment by synthesizing terrain analysis, threat disposition, and NAI designation.',
    tools: ['read_scenario_documents', 'read_shared_context', 'write_product_draft'],
    personality: ['methodical', 'analytical', 'precise', 'evidence-grounded'],
    systemPromptHint: 'You are MAJ S. Nguyen, an all-source intelligence analyst. Your sole task is producing the IPB assessment for the assigned exercise phase.',
    isDefault: true,
  },
  {
    id: uuid(),
    roleKey: 'j2',
    name: 'CPT A. Williams',
    rank: 'CPT',
    branch: 'MI',
    specialty: 'Threat Intelligence',
    focus: 'Develops the threat assessment including enemy MLCOA and MDCOA based on available OOB and SITREP data.',
    tools: ['read_scenario_documents', 'read_shared_context', 'write_product_draft'],
    personality: ['threat-focused', 'risk-aware', 'concise'],
    systemPromptHint: 'You are CPT A. Williams, a threat intelligence officer. You produce only the threat assessment — enemy capabilities, intentions, and most likely/dangerous COAs.',
    isDefault: true,
  },
  {
    id: uuid(),
    roleKey: 'j2',
    name: 'CW3 R. Park',
    rank: 'CW3',
    branch: 'MI',
    specialty: 'Collection Management',
    focus: 'Defines Priority Intelligence Requirements (PIR) and designs the intelligence collection plan.',
    tools: ['read_scenario_documents', 'read_shared_context', 'write_product_draft'],
    personality: ['systematic', 'detail-oriented', 'collection-focused'],
    systemPromptHint: 'You are CW3 R. Park, a collection manager. You identify information gaps and produce PIR with a specific collection plan — nothing else.',
    isDefault: true,
  },
  {
    id: uuid(),
    roleKey: 'j2',
    name: 'MSG D. Thompson',
    rank: 'MSG',
    branch: 'MI',
    specialty: 'Intelligence Reporting',
    focus: 'Synthesizes intelligence outputs into the Intelligence Summary (INTSUM) for command distribution.',
    tools: ['read_scenario_documents', 'read_shared_context', 'write_product_draft'],
    personality: ['concise', 'clear', 'reader-focused'],
    systemPromptHint: 'You are MSG D. Thompson, an intelligence sergeant responsible for the INTSUM. You synthesize J2 products into a concise summary for the commander — no analysis, only synthesis.',
    isDefault: true,
  },
];
```

### Manage Roles Modal — Human|AI|Disabled Toggle

```typescript
// Frontend pattern — extends existing ExerciseDashboard "Manage Roles" UI
// Three-state toggle per position row

type RoleAssignment = 'human' | 'ai' | 'disabled';

function RoleAssignmentToggle({
  roleKey,
  current,
  onChange,
}: {
  roleKey: string;
  current: RoleAssignment;
  onChange: (mode: RoleAssignment) => void;
}) {
  return (
    <div className="role-assignment-toggle" role="group" aria-label={`Assignment for ${roleKey}`}>
      {(['human', 'ai', 'disabled'] as const).map((mode) => (
        <button
          key={mode}
          className={`toggle-btn ${current === mode ? 'active' : ''}`}
          onClick={() => onChange(mode)}
          aria-pressed={current === mode}
        >
          {mode === 'human' ? 'Human' : mode === 'ai' ? 'AI' : 'Disabled'}
        </button>
      ))}
    </div>
  );
}
```

### StaffWorkspace — Conditional Workspace Rendering

```typescript
// In StaffWorkspace.tsx — extend existing component
// Route to AIRoleWorkspace or RoleDashboard based on role assignment

const roleAssignments = scenario.roleAssignments ?? {};

// In content area:
{roleAssignments[activeRole] === 'ai' ? (
  <AIRoleWorkspace
    key={activeRole}
    roleKey={activeRole}
    scenarioId={scenario.id}
    exercisePhase={exercisePhase}
    isControllerView={isControllerView}
  />
) : roleAssignments[activeRole] !== 'disabled' ? (
  <RoleDashboard
    key={activeRole}
    roleKey={activeRole}
    scenarioId={scenario.id}
    exercisePhase={exercisePhase}
    perspective={perspective}
    isControllerView={isControllerView}
  />
) : (
  <div className="role-disabled">
    <p>This position is not staffed for this exercise.</p>
  </div>
)}
```

### AI Role Graph — Core LangGraph Pattern

```typescript
// backend/src/exercise/ai-role-graph.ts
// Based on existing strategy-reviewer-graph.ts pattern

import { StateGraph, END, START, interrupt } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

export async function createAIRoleGraph(checkpointer: PostgresSaver) {
  const graph = new StateGraph(AIRoleStateAnnotation)
    .addNode('assemble_context', assembleContextNode)
    .addNode('run_agents', runAgentsNode)       // Parallel fan-out via Promise.all
    .addNode('merge_drafts', mergeDraftsNode)
    .addNode('await_review', awaitReviewNode)   // Calls interrupt()
    .addNode('handle_approved', handleApprovedNode)
    .addNode('handle_revision', handleRevisionNode)
    .addNode('handle_rejected', handleRejectedNode)
    .addEdge(START, 'assemble_context')
    .addEdge('assemble_context', 'run_agents')
    .addEdge('run_agents', 'merge_drafts')
    .addEdge('merge_drafts', 'await_review')
    .addConditionalEdges('await_review', routeReviewDecision, {
      approved: 'handle_approved',
      revision: 'handle_revision',
      rejected: 'handle_rejected',
    })
    .addEdge('handle_approved', END)
    .addEdge('handle_rejected', END)
    .addEdge('handle_revision', 'run_agents'); // Revision loops back to agents

  return graph.compile({ checkpointer });
}
```

### Product Review Endpoint — Resume LangGraph Interrupt

```typescript
// backend/src/api/exercise.ts — new endpoint
router.post('/:scenarioId/roles/:roleKey/runs/:runId/review', async (req, res) => {
  const { action, notes, annotations, edits } = req.body;
  // action: 'approve' | 'edit_approve' | 'request_revision' | 'edit_request_revision' | 'reject'

  const feedback: ReviewFeedback = { action, notes, annotations, edits };

  const graph = await getAIRoleGraph();
  const config = { configurable: { thread_id: req.params.runId } };

  // Resume the interrupted graph with feedback
  await graph.invoke({ reviewFeedback: feedback }, config);

  res.json({ status: 'resumed' });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LangGraph MemorySaver (in-memory) | `@langchain/langgraph-checkpoint-postgres` | LangGraph 0.2+ | Pause/resume survives restarts |
| LangGraph `interrupt()` as throw | `interrupt()` returns feedback value (v1.0+) | LangGraph 1.0 | Graph receives human input cleanly; no throw/catch |
| Custom streaming adapter | LangGraph `.stream()` with `streamMode` | v1.0 | Native SSE/WebSocket streaming |
| CrewAI for multi-agent | LangGraph with supervisor pattern | 2024 | Already implemented in orchestration/ |

**Existing in this project (do not rebuild):**
- `backend/src/orchestration/supervisor.ts`: BastionSupervisor with LangGraph supervisor pattern
- `backend/src/orchestration/execution-patterns.ts`: Sequential, Parallel, Hierarchical, Consensus patterns
- `backend/src/agents/langgraph/llm-factory.ts`: Multi-provider LLM factory
- `backend/src/agents/langgraph/prompt-generator.ts`: Character-driven system prompt builder

---

## Default AI Agent Library — 31-Role Specification

The plan MUST produce this library. Below are agent counts and focus areas per role. Names, ranks, branches, and `systemPromptHint` must follow the template.

### Agent Count by Role

| Role | Key | Agent Count | Primary Products |
|------|-----|-------------|-----------------|
| Commander | commander | 3 | commander_intent, coa_decision, warnord_approval |
| DCOM | dcom | 3 | strategic_guidance, staff coordination |
| Chief of Staff | cos | 4 | staff_estimate, battle rhythm, synchronization |
| J1 Personnel | j1 | 3 | personnel_estimate, manning_status, casualty_tracking |
| J2 Intelligence | j2 | 4 | ipb_assessment, threat_assessment, pir, intel_summary |
| J3 Operations | j3 | 5 | sync_matrix, coa_sketch, task_org, roe, execute_order |
| J35 Future Plans | j35 | 5 | coa_development, coa_analysis, staff_estimate, campaign_plan |
| J4 Logistics | j4 | 4 | logistics_estimate, css_annex, supply_plan |
| J5 Strategic Plans | j5 | 4 | strategic_estimate, strategic_direction, campaign_objectives |
| J6 Communications | j6 | 3 | comms_plan, c2_architecture, network_diagram |
| J7 Training | j7 | 3 | staff_estimate, training assessment |
| J8 Resource Mgmt | j8 | 3 | staff_estimate, resource allocation |
| J9 Civil-Military | j9 | 3 | staff_estimate, CMO planning |
| SJA | sja | 3 | roe, legal review, law of armed conflict |
| POLAD | polad | 3 | strategic_estimate, political-military |
| PAO | pao | 3 | strategic communication, media ops |
| Command Surgeon | surgeon | 3 | medical readiness, CASEVAC, force health |
| Cyber | cyber | 4 | defensive cyber, cyberspace ops |
| Space | space | 3 | satellite support, space ops |
| TRANSCOM | transcom | 3 | logistics_estimate, strategic airlift |
| SOCOM/SOF | socom | 4 | task_org, SOF integration |
| IO | io | 3 | information environment, influence |
| Fires | fires | 4 | sync_matrix, targeting, fire support |
| EW | ew | 3 | electronic attack, protection |
| JFACC | jfacc | 4 | task_org, ATO, airspace |
| JFLCC | jflcc | 4 | task_org, land operations |
| JFMCC | jfmcc | 4 | task_org, maritime ops |
| JFSOCC | jfsocc | 3 | task_org, SOF component |
| Engineer | engineer | 3 | obstacle planning, infrastructure |
| CBRN | cbrn | 3 | CBRN defense, contamination |
| Knowledge Mgmt | knowledge_mgmt | 3 | COP, info sharing, data management |

**Total: ~108 agents across 31 roles**

### Agent Identity Template (Doctrinal Basis)

```
Rank conventions (grounded in JP 3-0, FM 6-0):
- Command roles (commander, dcom): O-6 (COL), O-7 (BG) — senior officer personas
- J-Staff leads (cos, j2, j3, j35, j4, j5, j6): O-5 (LTC) — section chief
- J-Staff deputies: O-4 (MAJ)
- Action officers / specialists: O-3 (CPT)
- Technical specialties (cyber, intel collection, EW): CW2-CW4
- Senior enlisted leads (CoS NCO, PAO NCOIC): MSG, SGM
- Support roles: E-7 (SFC) to E-9 (SGM)

Branch codes per FM 6-0 functional areas:
- IN (Infantry), AR (Armor), FA (Field Artillery)
- AV (Aviation), EN (Engineer), SC (Signal)
- MI (Military Intelligence), CYBER, SF (Special Forces)
- TC (Transportation), QM (Quartermaster), OD (Ordnance)
- JA (Judge Advocate), PA (Public Affairs), MC (Medical Corps)
- FA59 (Space Operations), FA26 (Information Operations)
- FA30 (Information Operations), FA48 (Foreign Area)
```

---

## Open Questions

1. **pg-boss singletonKey behavior with paused runs**
   - What we know: `singletonKey` deduplicates queued/running jobs. Paused LangGraph graphs are not "running" in pg-boss — they're interrupted.
   - What's unclear: Does a paused graph run count as the singleton key being held? Or will a new trigger dispatch a second run while the first is awaiting review?
   - Recommendation: Track active runs in `ai_role_runs` table. Before dispatching a pg-boss job, check if a run for that role is in `queued | running | awaiting_review` status. If yes, merge the new trigger context into the existing run's context store and notify the graph.

2. **LangGraph streaming and the channel feed**
   - What we know: LangGraph v1.1.0 supports `.stream()` with `streamMode: 'messages'` which emits token-by-token.
   - What's unclear: Whether to stream token-by-token to channel events (high volume) or buffer and emit milestone events.
   - Recommendation: Buffer token stream internally; emit `task_progress` events at logical milestones (product section complete, tool call complete). One `draft_ready` event when the full draft is ready.

3. **Annotated feedback highlight format**
   - What we know: CONTEXT.md requires inline highlighted sections with comments.
   - What's unclear: Whether to use character offsets (fragile across edits), paragraph IDs, or visual markup with CSS highlight ranges.
   - Recommendation: Store annotations as `Array<{ paragraphIndex: number; startChar: number; endChar: number; highlightedText: string; comment: string }>`. When constructing revision prompt, serialize as: `"Paragraph 3 (characters 45-120): '...quoted text...' — Reviewer comment: '...'"`

4. **Commander directive to AI role**
   - What we know: CONTEXT.md lists "Commander role issues an explicit directive to this role" as an auto-trigger event.
   - What's unclear: Whether this is a product published by commander role (handled by upstream_publish trigger) or a separate explicit message type.
   - Recommendation: Implement as a separate channel event type `'commander_directive'` with explicit text. Commander workspace shows a "Send Directive" action targeting specific AI roles. This triggers the TriggerRouter for the target role with `triggerType: 'commander_directive'` and the directive text in context.

---

## Sources

### Primary (HIGH confidence)
- Official IronClaw GitHub: https://github.com/nearai/ironclaw (fetched 2026-03-02) — confirms Rust-only, standalone binary, no Node.js API
- `backend/package.json` (read directly) — confirms all required packages already installed
- `backend/src/agents/langgraph/` (read directly) — confirms LangGraph integration pattern and LLM factory
- `backend/src/orchestration/` (read directly) — confirms supervisor, execution patterns, checkpointer already exist
- `backend/src/exercise/types.ts` (read directly) — confirms `agentTeamId` field, `AgentTeamConfig`, STAFF_ROLE_CONFIG with all 31 roles
- `backend/database/016-staff-workspaces.sql` (read directly) — confirms `agent_team_config` table and `enabled_roles` column

### Secondary (MEDIUM confidence)
- `@langchain/langgraph` v1.1.0 interrupt API — confirmed against existing code patterns; interrupt() semantics match current version behavior
- `pg-boss` singletonKey behavior — based on package documentation patterns in existing codebase context

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified present in package.json; no new installs needed
- Ironclaw verdict: HIGH — read official GitHub directly; confirmed Rust binary, no Node.js API
- Architecture: HIGH — derived from reading existing codebase patterns (LangGraph graphs, orchestration, SSE)
- Agent library content: MEDIUM — agent identities/focuses derived from doctrinal knowledge (JP 3-0, FM 6-0); should be reviewed by military doctrine SME
- Pitfalls: HIGH — most derived from direct analysis of existing code patterns and LangGraph internals

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (LangGraph moves fast; re-verify interrupt API if > 30 days)
