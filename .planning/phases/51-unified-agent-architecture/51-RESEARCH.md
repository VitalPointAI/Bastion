# Phase 51: Unified Agent Architecture - Research

**Researched:** 2026-03-18
**Domain:** Agent system rearchitecture — TypeScript/Node, LangGraph, PostgreSQL, ElizaOS/Ironclaw sidecar, React admin UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Every agent uses ONE base class with: identity, persistent memory, skills, tools, model config, validation/health
- Memory model: long-term knowledge, working memory, episodic memory (past task summaries)
- Memory persisted to PostgreSQL with semantic recall (vector embeddings)
- Agents must actually execute — no more stub agents that silently do nothing
- Skills are defined capabilities with input/output schemas
- Tools are MCP tools bound per-agent
- Full CRUD interface for agents at /admin/agents
- Health monitoring: last invocation, success rate, avg response time, validation score
- Activate/deactivate toggle with health gates
- Memory viewer: browse what agent has learned, delete entries
- Tool assignment interface
- Test harness: send test prompt, view output, validate against schema
- Team designer with drag-and-drop at /admin/teams
- Designate leader/orchestrator per team; define team workflow (order, parallelism, checkpoints)
- Team testing against test scenarios
- Assign team to problem sets
- Ironclaw is the ONLY AI interface — remove AIStaffContext entirely
- Remove per-tab AI panels (DesignAIPanel, etc.)
- Ironclaw can assign/unassign agents or teams to any task
- Context-aware: knows current tab, problem set, user role
- Single Ironclaw panel available everywhere (drawer or sidebar)
- Upgrade Ironclaw to latest version
- KEEP: LangGraph orchestration, supervisor, classification filter, human checkpoints, LLM factory, tool registry, Ironclaw service, action registry, doc-intelligence orchestrator
- REWRITE: Agent registry (DB-backed), team registry (DB-backed), executor (standard path)
- REMOVE: AIStaffContext, per-tab AI panels, 9+ stub agents, dead hooks, narrative-synthesis, loe-gap-analysis, message-handlers

### Claude's Discretion
- Database schema for agent_memory table (vector storage approach)
- Migration strategy for existing agents to new template
- Specific Ironclaw version to upgrade to
- Whether to use pgvector or application-level similarity
- Agent health check implementation details
- WebSocket vs SSE for real-time agent status updates in dashboard

### Deferred Ideas (OUT OF SCOPE)
- Agent-to-agent direct messaging (keep orchestrated via supervisor for now)
- Agent marketplace / plugin system
- Multi-tenant agent isolation
- Agent training/fine-tuning from episodic memory
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-51-01 | Standardized agent base class | StandardAgent TypeScript class with all fields from ARCHITECTURE.md; extends/wraps current AgentManifest |
| REQ-51-02 | Persistent agent memory with semantic recall | PostgreSQL agent_memory table + application-level cosine similarity (existing utility); pgvector optional |
| REQ-51-03 | Agent admin dashboard — CRUD, health, memory viewer, tool assignment, test harness | Extend existing AdminDashboard at /admin/agents; pattern mirrors TeamComposerPanel + AgentManagementPanel |
| REQ-51-04 | Team designer UI — drag-and-drop, leader, workflow, testing | Extend admin at /admin/teams; TeamComposerPanel already provides CRUD skeleton to extend |
| REQ-51-05 | Ironclaw consolidation as single AI entry point | Extend IronclawService with delegation commands; make IronclawContext context-aware; feature flag gate |
| REQ-51-06 | Remove AIStaffContext and per-tab AI panels | Delete AIStaffContext.tsx, DesignAIPanel, ai-staff/ panel components, dead hooks — full list identified |
</phase_requirements>

---

## Summary

Phase 51 rearchitects BASTION's fragmented agent system. The project currently has two parallel agent worlds: a DAO-governance layer (`agents/registry.ts`, `agents/executor.ts`) using an in-memory Map and manifests, and a LangGraph execution layer (`agents/langgraph/`, `orchestration/`) used by doc-intelligence specialists and graph agents. These worlds are weakly connected — the DAO executor only handles governance capabilities, while the LangGraph agents are seeded separately but still registered in the same in-memory Map. Nine-plus agents are stubs that return placeholders when invoked.

The target state is a single `StandardAgent` class that all agents (governance, MDMP, doc-intel specialists, graph agents) inherit from. The in-memory Maps in `AgentRegistry` and `TeamRegistry` are replaced with PostgreSQL-backed stores using the same `ensureInitialized` DDL pattern already common across 51 stores in the project. Agent memory is added as a new `agent_memory` table with embedding-based recall using application-level cosine similarity (the `cosine-similarity.ts` utility already exists). The admin dashboard extends the existing `AdminDashboard` component pattern (sidebar nav + panel swap), with new `/admin/agents` and `/admin/teams` routes that already have skeleton panels (`AgentManagementPanel`, `TeamComposerPanel`) to upgrade.

Ironclaw consolidation removes `AIStaffContext` (used in 9 components), `DesignAIPanel` and its four sub-components that dispatch to AIStaff, and the AI staff panel components (`AIStaffPanel`, `AIStaffDocked`, `AIStaffFloating`, `AIStaffChatInput`). The `IronclawContext` already provides a global drawer + floating button at the `AuthenticatedShell` level — the task is to extend it with context-awareness (tab, problem set, user role) and agent/team delegation commands to `IronclawService`. The Ironclaw sidecar is pinned to commit `56b72188` on the `nearai/ironclaw` GitHub repo — upgrade path is to bump the `IRONCLAW_COMMIT` ARG in the Dockerfile.

**Primary recommendation:** Follow the four-subphase breakdown exactly (51A backend, 51B admin dashboard, 51C team designer, 51D Ironclaw consolidation). Do NOT start 51D until the other three subphases are complete, as 51D is the breaking UX change.

---

## Current State: What Exists

### Backend Agent System (Confirmed by code inspection)

**`backend/src/agents/registry.ts`**
- `AgentRegistry` class, singleton via `getAgentRegistry()`
- In-memory `Map<string, AgentManifest>` — lost on restart (confirmed CONCERN)
- Has `ensureInitialized()` pattern already, but initialize only registers default agents, no DB reads
- Keeps: DID generation (`createAgentDID`), activation gate check (`canActivateAgent`), character management, delegation logic, action log (also in-memory)
- Rewrite target: replace `Map` with DB reads/writes while keeping all method signatures

**`backend/src/agents/types.ts`**
- `AgentManifest` interface — the current "manifest" only has: `agentId, name, description, phase, capabilities[], maxAutonomy, allowedProposalKinds[], requiresHumanApproval[], createdAt, createdBy, active, agentDID?, agentBlindedKey?, agentPublicKey?, modelConfig?, character?`
- Missing from target `StandardAgent`: `systemPrompt`, `skills[]`, `memory`, explicit `clearance`, `validation` health fields, `status`, `activatedAt/deactivatedAt`
- New `StandardAgent` extends this or replaces it

**`backend/src/agents/executor.ts`**
- `AgentExecutor` class — DAO-oriented, only handles 6 governance capabilities
- `executeHandler` switch falls through to `throw new Error('Capability not implemented')` for all capabilities outside the 6 governance ones
- All 9+ MDMP/escalation agents are seeded with manifests in `agent-seeder.ts` but their implementations return stub outputs
- Rewrite target: generalize to route any skill execution through the LangGraph path

**`backend/src/agents/langgraph/agent-seeder.ts`**
- Seeds 20+ agents including: strategy-reviewer, strategic-fusion-agent, entity-resolution, osint-monitor, validity-assessment, conflict-detection, raft-extraction, raft-reasoning (full LangGraph), plus MDMP governance agents (assumption-auditor, orders-validator, uncertainty-quantifier, data-bias-detector, problem-framing, roe-compliance) and escalation agents (adversary-modeler, effect-cascader, escalation-modeler, deception-detector, deescalation-manager, deception-planner, exploitation-analyst)
- All agents registered in the same in-memory `AgentRegistry`

**`backend/src/agents/team-registry.ts`**
- `TeamRegistry` class, singleton via `getTeamRegistry()`
- In-memory `Map<string, AgentTeam>` — lost on restart
- Has `initialize()` method but it does nothing (no DB reads)
- Rewrite target: same pattern as AgentRegistry

**`backend/src/agents/tool-registry.ts`**
- Tool registry exists, has DB persistence pattern already (based on ARCHITECTURE.md "Keep + extend")
- This is the one registry that already has DB backing or a path to it

**LLM Factory** (`backend/src/agents/langgraph/llm-factory.ts`)
- `resolveLLMConfig(agentId, overrides)` — resolves per-agent model config from `configService.getAgentModelConfig(agentId)`
- Supports: anthropic, openai, azure, near-ai, local (ollama)
- Caches LLM instances by config hash (10-min TTL)
- KEEP as-is

**Orchestration** (`backend/src/orchestration/`)
- `supervisor.ts` — LangGraph StateGraph with classification-aware routing, `@langchain/langgraph ^1.1.0`
- `agent-wrapper.ts` — `LangGraphAgentWrapper` converts `AgentManifest` to LangGraph node
- `classification-filter.ts` — ABAC pre-filtering
- `human-checkpoints.ts` — DB-persisted checkpoints
- `state.ts` — `BastionStateAnnotation` used across all LangGraph graphs
- ALL KEPT — these are the execution backbone

**Doc-Intelligence** (`backend/src/doc-intelligence/`)
- `specialist-base.ts` — abstract `SpecialistBase` class, already extends `LangGraphAgentWrapper`
- Creates an `AgentManifest` inline with limited fields
- Refactor target: align constructor to accept `StandardAgent` config instead

**Dead backend files confirmed for deletion:**
- `agents/narrative-synthesis.ts` — 440 lines, zero imports
- `agents/loe-gap-analysis.ts` — zero imports, never seeded
- `agents/message-handlers.ts` — zero imports, dead convenience wrappers
- `ironclaw/self-update-service.ts` — investigate constructor side-effects before deleting
- `ironclaw/audit-anchor-service.ts` — never called, investigate
- 9+ stub agent files: adversary-modeler, deescalation-manager, adversary-modeler, deception-detector, assumption-auditor, effect-cascader, deception-planner, exploitation-analyst, orders-validator, problem-framing, roe-compliance, uncertainty-quantifier, data-bias-detector, cog-analysis (rebuild on standard template as needed)

### Frontend AI System (Confirmed by code inspection)

**`AIStaffContext.tsx`** — Used in 9 files:
- `App.tsx` (provides the context)
- `ProblemSetTabContainer.tsx` — wraps tabs with `AIStaffProvider`
- `DesignAIPanel.tsx` — primary consumer
- `CoGAnalysisSection.tsx`, `LOETimelineSection.tsx`, `ProblemFramingSection.tsx`, `OperationalApproachSection.tsx` — all 4 design sections dispatch to AIStaff
- `AIStaffChatInput.tsx`, `AIStaffDocked.tsx`, `AIStaffPanel.tsx`, `AIStaffFloating.tsx` — AI staff panel components

**`IronclawContext.tsx`** — Already global, used in:
- Drawer + button rendered in `AuthenticatedShell` layer
- `DevicePipelineKanban.tsx`, `DiscoveryLayer.tsx` (minor consumers)
- Ironclaw components: `IronclawActionCard`, `IronclawDrawer`, `IronclawMessage`, `IronclawSuggestion`, `IronclawStepStream`, `IronclawButton`
- Currently scoped by `activeProblemSetId` from `ProblemSetContext`

**Files to DELETE (AIStaffContext removal):**
- `context/AIStaffContext.tsx`
- `components/ai-staff/AIStaffChatInput.tsx`
- `components/ai-staff/AIStaffDocked.tsx`
- `components/ai-staff/AIStaffPanel.tsx`
- `components/ai-staff/AIStaffFloating.tsx`
- `components/ai-staff/AIShowContributions.tsx` (already dead per audit)
- `components/ai-staff/InlineAnnotation.tsx` (already dead per audit)
- `components/ai-staff/AgentRoutingConfig.ts` (already dead per audit)
- `components/design/DesignAIPanel.tsx`
- `hooks/useAgentRouting.ts` (already dead per audit)
- `hooks/useInlineAnnotations.ts` (already dead per audit)
- Also remove `AIStaffProvider` wrapper from `ProblemSetTabContainer.tsx`
- Remove dispatch calls from CoGAnalysisSection, LOETimelineSection, ProblemFramingSection, OperationalApproachSection

**Admin Dashboard** (`frontend/src/components/admin/AdminDashboard.tsx`)
- Already has sidebar nav with 12 items including `agent-management` and `teams`
- `AdminView` type already includes `'agent-management'` and `'teams'`
- `AgentManagementPanel` and `TeamComposerPanel` already exist as panel components
- The new agent admin dashboard and team designer EXTEND these existing panels — they are not built from scratch
- Pattern for new sub-routes: add new `AdminView` values, add `SidebarItem` entries, render corresponding panels

### Ironclaw Sidecar

- Built from source at commit `56b72188974e042c379f9b74384a82bd0f5e8449` from `nearai/ironclaw`
- Exposes HTTP webhook on port 8080: `POST /webhook` with `{content, secret, thread_id, wait_for_response}`
- Uses Rust, compiled from `nearai/ironclaw` GitHub repo
- Token auto-refresh via shared volume file, watched by `entrypoint.sh`
- **Upgrade path:** Update `IRONCLAW_COMMIT` ARG in `ironclaw/Dockerfile` to the latest commit SHA from `https://github.com/nearai/ironclaw`
- The upgrade is a Dockerfile ARG change + Docker rebuild — no TypeScript changes needed for the upgrade itself
- Context-awareness extension is entirely on the backend `IronclawService.buildSystemPrompt()` — inject current tab, problem set, user role into the thread system prompt per message

### Database Migration Pattern

- 33 numbered SQL migration files in `backend/src/db/migrations/`
- Pattern: `034-agent-tables.sql`, `035-agent-memory.sql`, etc.
- Migration runner in `backend/src/db/migration-runner.ts` imported by `index.ts` (runs on startup)
- New tables for this phase: `agents_v2` (DB-backed agent store), `agent_teams` (DB-backed team store), `agent_memory` (per-agent memory with optional embeddings)
- AVOID adding more `ensureInitialized` DDL in store constructors — use SQL migration files per established standard

---

## Standard Stack

### Core (all already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@langchain/langgraph` | ^1.1.0 | Agent orchestration graphs | Already powering supervisor, doc-intel orchestrator, all graph agents |
| `@langchain/core` | ^1.1.15 | Base LLM types, messages | LangChain ecosystem base, used everywhere |
| `@langchain/anthropic` | ^1.3.10 | Anthropic Claude models | Primary AI provider for BASTION |
| `@langchain/openai` | ^1.2.2 | OpenAI models | Secondary provider, already configured |
| `@langchain/langgraph-checkpoint-postgres` | ^1.0.0 | LangGraph state persistence | Already used by human-checkpoints |
| `zod` | (existing) | Input/output schema validation for skills | Already used throughout for all API validation |
| `pg` (node-postgres) | (existing) | PostgreSQL client | All stores use this directly |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-dnd` or `@dnd-kit/core` | check package.json | Drag-and-drop in Team Designer | Team Designer UI needs DnD for agent composition |
| cosine-similarity.ts | (internal) | Application-level vector similarity | Agent memory semantic recall — avoids pgvector dep |
| `openai` embeddings | via existing openai package | Generate embeddings for memory entries | Call `openai.embeddings.create()` for memory entries |

**Check for DnD library:**
```bash
grep -E '"react-dnd|@dnd-kit|react-beautiful-dnd"' frontend/package.json
```
If none found, add `@dnd-kit/core` and `@dnd-kit/sortable` — lightweight, modern, no deprecated React APIs.

**Installation if needed:**
```bash
npm install --prefix frontend @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## Architecture Patterns

### Recommended Project Structure for New Files

```
backend/src/
├── agents/
│   ├── standard-agent.ts          # NEW: StandardAgent base class + AgentMemory model
│   ├── agent-store.ts             # NEW: PostgreSQL-backed AgentStore (replaces registry Map)
│   ├── agent-memory-store.ts      # NEW: AgentMemoryStore with semantic recall
│   ├── team-store.ts              # NEW: PostgreSQL-backed TeamStore (replaces team-registry Map)
│   ├── registry.ts                # REWRITE: delegate to AgentStore, keep method signatures
│   ├── team-registry.ts           # REWRITE: delegate to TeamStore, keep method signatures
│   └── executor.ts                # REWRITE: generalized skill execution via LangGraph
├── api/
│   └── agents.ts                  # EXTEND: add /admin/agents endpoints for CRUD, health, memory
├── db/migrations/
│   ├── 034-agent-tables.sql       # agents_v2, agent_teams tables
│   └── 035-agent-memory.sql       # agent_memory table

frontend/src/
├── components/admin/
│   ├── AgentDashboardPanel.tsx    # NEW: full CRUD + health dashboard (replaces/extends AgentManagementPanel)
│   ├── AgentHealthCard.tsx        # NEW: per-agent health display widget
│   ├── AgentMemoryViewer.tsx      # NEW: memory browser for agent
│   ├── AgentTestHarness.tsx       # NEW: test prompt → output panel
│   └── TeamDesignerPanel.tsx      # NEW: extends TeamComposerPanel with DnD + workflow graph
├── context/
│   └── IronclawContext.tsx        # EXTEND: add tab/problemSet/role awareness
└── components/ironclaw/
    └── IronclawDrawer.tsx         # EXTEND: add agent/team assignment UI
```

### Pattern 1: StandardAgent Base Class

**What:** TypeScript class that all agents extend or are constructed from. Wraps the existing `AgentManifest` while adding memory, skills, and health fields.

**When to use:** Every new or migrated agent registration.

```typescript
// backend/src/agents/standard-agent.ts
import type { AgentManifest } from './types.js';

export interface AgentSkill {
  skillId: string;
  name: string;
  description: string;
  inputSchema: z.ZodType;   // zod schema
  outputSchema: z.ZodType;
}

export interface StandardAgent extends AgentManifest {
  // Extends existing AgentManifest — preserves backward compat
  systemPrompt: string;
  clearance: ClassificationLevel;
  skills: AgentSkill[];
  status: 'active' | 'inactive' | 'degraded' | 'error';
  activatedAt?: Date;
  deactivatedAt?: Date;
  // Health metrics (updated after each invocation)
  lastInvocation?: Date;
  successRate?: number;        // 0.0 - 1.0
  avgResponseTimeMs?: number;
  validationScore?: number;    // from validation/activation-gate.ts
}
```

### Pattern 2: PostgreSQL-Backed AgentStore

**What:** Drop-in replacement for the `Map<string, AgentManifest>` in `AgentRegistry`. Reads/writes to a `agents_v2` table. Uses same `ensureInitialized` method name to avoid changing callers.

**When to use:** AgentRegistry rewrite (subphase 51A).

```typescript
// SQL migration 034-agent-tables.sql
CREATE TABLE IF NOT EXISTS agents_v2 (
  agent_id TEXT PRIMARY KEY,
  agent_data JSONB NOT NULL,      -- full StandardAgent serialized
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active',
  last_invocation TIMESTAMPTZ,
  success_rate NUMERIC(4,3),
  avg_response_time_ms INTEGER,
  validation_score NUMERIC(4,3)
);

CREATE TABLE IF NOT EXISTS agent_teams (
  team_id TEXT PRIMARY KEY,
  team_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Pattern 3: Agent Memory Store

**What:** Per-agent memory table. No pgvector required — embeddings stored as `float4[]` JSONB, cosine similarity computed in application layer using the existing `cosine-similarity.ts` utility.

**Decision rationale:** pgvector requires a PostgreSQL extension that may not be installed on the Hetzner deployment. The `cosine-similarity.ts` utility already exists and the memory store is per-agent (small dataset per agent — cosine sim over <1000 entries is fast in JS). pgvector is the better long-term choice but is Claude's discretion — application-level similarity is the safe default.

```typescript
// SQL migration 035-agent-memory.sql
CREATE TABLE IF NOT EXISTS agent_memory (
  entry_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  agent_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,    -- 'knowledge' | 'working' | 'episode'
  category TEXT,
  content TEXT NOT NULL,
  embedding JSONB,              -- float array, nullable — null = no semantic recall for entry
  importance NUMERIC(4,3) DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed TIMESTAMPTZ,
  task_id TEXT,                 -- for episodes: links to originating task
  CONSTRAINT fk_agent FOREIGN KEY (agent_id) REFERENCES agents_v2(agent_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_id ON agent_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(agent_id, memory_type);
```

**Semantic recall implementation:**
```typescript
// backend/src/agents/agent-memory-store.ts
async recall(agentId: string, query: string, limit = 5): Promise<MemoryEntry[]> {
  // 1. Generate embedding for query (via openai or anthropic embeddings API)
  const queryEmbedding = await generateEmbedding(query);
  // 2. Load agent's knowledge memories
  const entries = await this.loadEntries(agentId, 'knowledge');
  // 3. Score with cosine similarity from existing utility
  const scored = entries
    .filter(e => e.embedding)
    .map(e => ({ entry: e, score: cosineSimilarity(queryEmbedding, e.embedding!) }))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.entry);
}
```

### Pattern 4: Ironclaw Context-Awareness

**What:** Extend `IronclawService.handleMessage()` to accept a context object (current tab, problem set, role) and inject it into the thread's effective system prompt per-message.

**When to use:** Subphase 51D.

```typescript
// backend/src/ironclaw/ironclaw-service.ts  (extend)
interface MessageContext {
  currentTab?: string;    // 'understand' | 'design' | 'plan' | 'direct' | 'cop' | 'assess'
  problemSetId?: string;
  userRole?: string;
}

async handleMessage(
  problemSetId: string,
  userDid: string,
  content: string,
  context?: MessageContext,  // new parameter
): Promise<void>
```

The context is appended to the message content before sending to the Ironclaw webhook — Ironclaw processes it as context prefix. This approach requires no sidecar changes.

**Frontend context injection:**
```typescript
// frontend/src/context/IronclawContext.tsx (extend)
// IronclawProvider reads currentTab from router location
// Passes tab name + problemSetId + userRole to sendMessage
const { pathname } = useLocation();
const currentTab = deriveTabFromPath(pathname);  // parse from route
```

### Pattern 5: Agent/Team Delegation Commands in Ironclaw

**What:** Extend `IronclawService` with new command handlers that Ironclaw can invoke via action cards.

**When to use:** Subphase 51D.

New action types to add to `action-registry.ts`:
- `assign_agent_to_problem_set` — MEDIUM risk
- `unassign_agent_from_problem_set` — LOW risk
- `form_team_for_task` — MEDIUM risk
- `list_active_agents` — LOW risk (read-only)
- `get_agent_status` — LOW risk (read-only)

### Anti-Patterns to Avoid

- **Adding another `ensureInitialized` inline DDL method:** Use SQL migration files. The existing 51 inline DDL methods are a known concern. New tables go in `backend/src/db/migrations/`.
- **Removing AgentRegistry/TeamRegistry public API surface:** Other code depends on `getAgentRegistry()` and `getTeamRegistry()` singletons. Rewrite the internals, keep the interface.
- **Blocking executor on stub agents during transition:** Mark stub agents `status: 'inactive'` in DB so the executor fast-fails instead of silently returning empty output.
- **Embedding generation on every memory write:** Embeddings are expensive. Generate only for `knowledge` type entries, not `working` or `episode` summaries.
- **Rebuilding TeamComposerPanel from scratch:** The existing `TeamComposerPanel.tsx` already has CRUD, Zod validation, `react-tabs`, member roles, workflow types. Extend it — don't replace.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM invocation per-agent | Custom fetch wrapper | `createLLM(agentId)` from existing `llm-factory.ts` | Already handles provider selection, caching, oauth tokens, model config from DB |
| Agent DID generation | New DID logic | `createAgentDID(agentId)` from `agents/agent-did.ts` | Already implements DER/blinded key pattern |
| Vector similarity | SQL extension or npm package | `cosineSimilarity(a, b)` from `validation/scoring/cosine-similarity.ts` | Pure JS, already exists, adequate for per-agent memory sets |
| LangGraph state | Custom state object | `BastionStateAnnotation` from `orchestration/state.ts` | Typed, already used across all graphs, has classification + trace |
| Agent-to-LangGraph-node adapter | New wrapper | `LangGraphAgentWrapper` from `orchestration/agent-wrapper.ts` | Already converts `AgentManifest` to LangGraph node with tool binding |
| Supervisor routing | Custom orchestration | `orchestration/supervisor.ts` | Classification-aware, human checkpoints, already wired to agents |
| Health gate check | New validation | `canActivateAgent()` from `validation/activation-gate.ts` | Already checks test fixture requirements |
| Form validation | Custom validator | `zod` + `react-hook-form` + `zodResolver` | Already used in `TeamComposerPanel.tsx` and `AgentBuilderWizard.tsx` |
| Drag-and-drop | Raw HTML5 DnD | `@dnd-kit/core` + `@dnd-kit/sortable` | Modern, accessible, no deprecated React APIs |

**Key insight:** The infrastructure (LangGraph, DID, health gates, supervisor, LLM factory) is already built and working. The gap is only: (1) connecting the registry to DB, (2) adding memory, (3) completing execution handlers, (4) consolidating the UI. Do not rebuild any of the existing infrastructure.

---

## Common Pitfalls

### Pitfall 1: Breaking AgentRegistry Callers During Rewrite
**What goes wrong:** `agents/registry.ts` is imported by `agents/executor.ts`, `agents/langgraph/agent-seeder.ts`, `api/agents.ts`, `api/admin.ts`, `orchestration/supervisor.ts`, `doc-intelligence/specialist-base.ts`, and `validation/activation-gate.ts`. A rewrite that changes method signatures breaks all of them.
**Why it happens:** Treating the rewrite as "build new, delete old" rather than "replace internals, keep interface."
**How to avoid:** Keep all existing method signatures on `AgentRegistry`. Only change the backing store from `Map` to `AgentStore`. Add new methods for DB-specific operations; don't remove old ones.
**Warning signs:** TypeScript errors across multiple `agents/` consumers after registry rewrite.

### Pitfall 2: Embedding API Costs for Memory
**What goes wrong:** Generating OpenAI embeddings for every memory write makes agent invocations expensive.
**Why it happens:** Naive implementation calls `embeddings.create()` on every `remember()` call.
**How to avoid:** Only generate embeddings for `knowledge` type entries. Use lazy embedding: store content immediately, generate embedding async in background. Working memory is never embedded (cleared between tasks anyway). Episodes use keyword-based recall, not vector recall.
**Warning signs:** High OpenAI API costs in logs, slow `remember()` calls.

### Pitfall 3: Removing AIStaffContext Without Fixing Design Sections
**What goes wrong:** Deleting `AIStaffContext.tsx` causes compile errors in `CoGAnalysisSection`, `LOETimelineSection`, `ProblemFramingSection`, `OperationalApproachSection` — all 4 dispatch AI analysis to the staff context.
**Why it happens:** The design sections have direct `useAIStaffDispatch()` calls to trigger AI analysis of section content.
**How to avoid:** Before removing AIStaffContext, update all 4 sections to use `useIronclawContext().sendMessage()` instead, or simply strip the AI dispatch calls (Ironclaw replaces the feature). Do this in the same commit as the AIStaffContext removal.
**Warning signs:** `useAIStaff is not defined` errors in design tab after deletion.

### Pitfall 4: In-Memory Action Log Lost After Registry Rewrite
**What goes wrong:** `AgentRegistry.actionLog` is an in-memory array. When rewriting the registry to DB-backed, the action log needs to be persisted too or it becomes even more volatile.
**Why it happens:** The rewrite focuses on agent/team maps but misses the action log.
**How to avoid:** During 51A, add an `agent_action_log` table and persist actions there. The `logAction()` method signature stays the same.

### Pitfall 5: Ironclaw Commit Bump Triggering Full Rust Recompile
**What goes wrong:** Bumping `IRONCLAW_COMMIT` in Dockerfile triggers a full `cargo build --release` (10-30 minutes). This stalls deploys if done carelessly.
**Why it happens:** The Rust compile is uncached if the commit SHA changes.
**How to avoid:** Bump the commit intentionally and test in a branch build first. The Docker layer cache and GHA build cache (`docker buildx` with `--cache-from`) handle this gracefully if configured. Verify the new Ironclaw version still responds to the same webhook API before deploying.

### Pitfall 6: IronclawService.buildSystemPrompt Not Dynamically Injected
**What goes wrong:** `buildSystemPrompt()` is called once per session creation. If it doesn't include tab/role context, Ironclaw won't be context-aware even after the frontend sends context headers.
**Why it happens:** The current prompt is built at session creation time, not per-message.
**How to avoid:** Pass context as a prefix to the message content, not as a system prompt override. This works within the current webhook API: prefix each user message with `[Context: tab=design, problemSet=abc123, role=commander]\n` before sending to Ironclaw.

---

## Code Examples

### Existing AgentManifest → StandardAgent Migration Pattern

```typescript
// Extend AgentManifest to produce StandardAgent — no breaking changes
// Source: backend/src/agents/types.ts (existing interface)
// Extend in: backend/src/agents/standard-agent.ts

export interface StandardAgent extends AgentManifest {
  systemPrompt: string;
  clearance: ClassificationLevel;
  skills: AgentSkill[];
  status: 'active' | 'inactive' | 'degraded' | 'error';
  activatedAt?: Date;
  deactivatedAt?: Date;
  lastInvocation?: Date;
  successRate?: number;
  avgResponseTimeMs?: number;
  validationScore?: number;
}

// Migration helper: wrap existing manifest
export function toStandardAgent(
  manifest: AgentManifest,
  extras: Partial<StandardAgent> = {}
): StandardAgent {
  return {
    ...manifest,
    systemPrompt: extras.systemPrompt ?? '',
    clearance: extras.clearance ?? 'Unclassified',
    skills: extras.skills ?? [],
    status: manifest.active ? 'active' : 'inactive',
    ...extras,
  };
}
```

### DB-Backed AgentStore (Key Methods)

```typescript
// backend/src/agents/agent-store.ts
import { getPool } from '../lib/database.js';

export class AgentStore {
  async registerAgent(agent: StandardAgent): Promise<StandardAgent> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO agents_v2 (agent_id, agent_data, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (agent_id) DO UPDATE SET agent_data = $2, status = $3, updated_at = NOW()`,
      [agent.agentId, JSON.stringify(agent), agent.status]
    );
    return agent;
  }

  async getAgent(agentId: string): Promise<StandardAgent | undefined> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT agent_data FROM agents_v2 WHERE agent_id = $1`,
      [agentId]
    );
    return result.rows[0]?.agent_data as StandardAgent | undefined;
  }

  async listAgents(): Promise<StandardAgent[]> {
    const pool = getPool();
    const result = await pool.query(`SELECT agent_data FROM agents_v2 ORDER BY created_at`);
    return result.rows.map(r => r.agent_data as StandardAgent);
  }

  async updateHealth(agentId: string, health: {
    lastInvocation: Date;
    successRate: number;
    avgResponseTimeMs: number;
  }): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE agents_v2 SET last_invocation=$2, success_rate=$3, avg_response_time_ms=$4
       WHERE agent_id = $1`,
      [agentId, health.lastInvocation, health.successRate, health.avgResponseTimeMs]
    );
  }
}
```

### LangGraph Node from StandardAgent

```typescript
// Existing pattern from orchestration/agent-wrapper.ts — KEEP AND REFERENCE
// When adding a StandardAgent to LangGraph, use the existing wrapper:
import { LangGraphAgentWrapper } from '../orchestration/agent-wrapper.js';

const wrapper = new LangGraphAgentWrapper(standardAgent, tools, systemPrompt);
const nodeFunction = wrapper.createNode();
// Then: graph.addNode(agent.agentId, nodeFunction);
```

### Context Injection for Ironclaw

```typescript
// backend/src/ironclaw/ironclaw-service.ts — extend handleMessage
async handleMessage(
  problemSetId: string,
  userDid: string,
  content: string,
  ctx?: { currentTab?: string; userRole?: string }
): Promise<void> {
  const contextPrefix = ctx
    ? `[Context: tab=${ctx.currentTab ?? 'unknown'}, role=${ctx.userRole ?? 'user'}]\n`
    : '';

  const result = await ironclawClient.sendMessage(
    session.id,
    contextPrefix + content,
  );
  // ... rest of method unchanged
}
```

### Agent Health Dashboard Data Fetch

```typescript
// New API endpoint pattern: GET /api/admin/agents/health
// Returns array of agents with health metrics from agents_v2 table
// (health stored as columns, not in JSONB, for efficient querying)
router.get('/agents/health', requireAuth, requireAdmin, async (req, res) => {
  const pool = getPool();
  const result = await pool.query(`
    SELECT agent_id, status, last_invocation, success_rate,
           avg_response_time_ms, validation_score,
           (agent_data->>'name') as name
    FROM agents_v2
    ORDER BY name
  `);
  res.json({ success: true, data: result.rows });
});
```

---

## State of the Art

| Old Approach | Current Approach | Impact on Phase 51 |
|--------------|------------------|--------------------|
| In-memory Map for agent registry | DB-backed AgentStore | Agents survive restart; admin dashboard can query |
| Separate manifest definitions per agent | StandardAgent base class | Single code path for all agent capabilities |
| AIStaffContext + IronclawContext coexistence | IronclawContext only | Single AI entry point; removes ~1500 lines |
| Stub agent implementations | LangGraph execution via standard executor | Agents actually do work |
| No agent memory | PostgreSQL agent_memory + cosine similarity | Agents learn and recall across invocations |
| DesignAIPanel + per-tab AI panels | Ironclaw context-aware delegation | Consistent AI UX everywhere |

**Deprecated/outdated patterns to eliminate:**
- `agents/registry.ts` in-memory Map: replaced by AgentStore with DB backing
- `agents/team-registry.ts` in-memory Map: replaced by TeamStore
- `agents/executor.ts` governance-only switch: replaced by generalized skill executor
- `AIStaffContext`: replaced by IronclawContext entirely

---

## Open Questions

1. **pgvector vs application-level similarity for agent_memory**
   - What we know: Project does NOT currently use pgvector. `cosine-similarity.ts` exists and works. Each agent's memory will be small (<1000 entries in practice).
   - What's unclear: Whether Hetzner PostgreSQL deployment has the vector extension available.
   - Recommendation: Use application-level cosine similarity with `float4[]` stored as JSONB. Add a `TODO: migrate to pgvector` comment. This is fully functional and avoids a deployment dependency.

2. **Ironclaw version to upgrade to**
   - What we know: Current commit is `56b72188` from `nearai/ironclaw`. The Dockerfile pins to this SHA.
   - What's unclear: What features/breaking changes are in newer commits. Need to check `https://github.com/nearai/ironclaw` commits since `56b72188`.
   - Recommendation: Check the repo for newer commits during 51D planning. The upgrade is a Dockerfile ARG bump + Docker rebuild — minimal risk if the webhook API is backward compatible.

3. **WebSocket vs SSE for agent health dashboard real-time updates**
   - What we know: Project uses WebSocket (message-bus + per-channel publish) extensively. SSE exists as a pattern in `doc-intelligence/orchestrator.ts`.
   - What's unclear: Whether the admin dashboard needs real-time updates or polling is acceptable.
   - Recommendation: Use polling (30s interval) for the health dashboard. Real-time is not critical for admin health monitoring. Avoids WebSocket channel proliferation. Simple `setInterval` fetch is sufficient.

4. **Migration strategy for 20+ seeded agents**
   - What we know: `agent-seeder.ts` registers 20+ agents at startup via `agentRegistry.registerAgent()`. After the registry rewrite, the seeder must upsert to DB.
   - What's unclear: Whether existing agents in the old in-memory registry need any special migration.
   - Recommendation: Since the old registry is in-memory (lost on restart anyway), treat the DB as empty at launch. The seeder upserts all default agents on startup. No data migration needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.17 |
| Config file | `backend/package.json` ("test": "vitest run") — no vitest.config.ts found |
| Quick run command | `npm --prefix backend test` |
| Full suite command | `npm --prefix backend test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-51-01 | StandardAgent extends AgentManifest, toStandardAgent migration helper produces valid object | unit | `npm --prefix backend test -- --reporter=verbose` targeting standard-agent.test.ts | No — Wave 0 |
| REQ-51-02 | AgentMemoryStore.remember() persists, recall() returns semantically similar entries | unit (mock DB) | same | No — Wave 0 |
| REQ-51-03 | Agent admin API GET /api/admin/agents/health returns correct schema | unit | same | No — Wave 0 |
| REQ-51-04 | TeamStore CRUD creates/reads teams from DB | unit (mock DB) | same | No — Wave 0 |
| REQ-51-05 | IronclawService.handleMessage with context prefix sends correct content to webhook | unit (mock HTTP) | same | No — Wave 0 |
| REQ-51-06 | AIStaffContext removed: no TypeScript errors after deletion | build check | `npm --prefix frontend run build` | N/A — compile validation |

### Sampling Rate
- **Per task commit:** `npm --prefix backend test`
- **Per wave merge:** `npm --prefix backend test && npm --prefix frontend run build`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/agents/standard-agent.test.ts` — covers REQ-51-01
- [ ] `backend/src/agents/agent-memory-store.test.ts` — covers REQ-51-02
- [ ] `backend/src/agents/agent-store.test.ts` — covers AgentStore DB upsert/read
- [ ] `backend/src/agents/team-store.test.ts` — covers REQ-51-04

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `backend/src/agents/registry.ts` — confirmed in-memory Map, DID generation, activation gate pattern
- Direct code inspection: `backend/src/agents/executor.ts` — confirmed DAO-only capability dispatch, stub handlers
- Direct code inspection: `backend/src/agents/langgraph/agent-seeder.ts` — confirmed 20+ seeded agents, LangGraph manifests
- Direct code inspection: `backend/src/orchestration/` — confirmed LangGraph supervisor, wrapper, state, checkpoints all working
- Direct code inspection: `backend/src/ironclaw/ironclaw-service.ts` — confirmed WebSocket pub, global scope, buildSystemPrompt
- Direct code inspection: `ironclaw/Dockerfile` — confirmed Rust build from nearai/ironclaw at commit `56b72188`
- Direct code inspection: `frontend/src/components/admin/AdminDashboard.tsx` — confirmed sidebar nav, existing panel structure
- Direct code inspection: `frontend/src/components/admin/TeamComposerPanel.tsx` — confirmed Zod + react-hook-form pattern
- Direct code inspection: `frontend/src/context/AIStaffContext.tsx` + `IronclawContext.tsx` — confirmed 9 consumers, global drawer
- Direct code inspection: `.planning/codebase/CONCERNS.md` + `AUDIT-BACKEND-DEAD-CODE.md` + `AUDIT-FRONTEND-DEAD-CODE.md` — confirmed exact dead files
- `backend/package.json` versions: `@langchain/langgraph ^1.1.0`, `@langchain/core ^1.1.15`, vitest `^4.0.17`

### Secondary (MEDIUM confidence)
- `backend/src/validation/scoring/cosine-similarity.ts` — application-level cosine sim utility exists, verified by code read
- `.planning/codebase/CONCERNS.md` (line 173-181) — In-memory state lost on restart concern for registry.ts, team-registry.ts confirmed

### Tertiary (LOW confidence)
- pgvector availability on Hetzner deployment — not verified, assumed unavailable without checking
- Latest Ironclaw commit features — not checked (GitHub lookup needed during 51D planning)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, versions confirmed from package.json
- Architecture: HIGH — based on direct code inspection of all target files
- Pitfalls: HIGH — derived from actual code patterns and known concerns in CONCERNS.md
- Ironclaw upgrade specifics: LOW — latest commit features unknown until GitHub checked

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable architecture, 30-day window)
