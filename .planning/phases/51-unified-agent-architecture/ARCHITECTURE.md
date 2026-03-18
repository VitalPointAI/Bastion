# Phase 51: Unified Agent Architecture

## Vision

Replace the fragmented agent system with a clean, unified architecture where:
- Every agent is built from one standard template
- One admin interface manages all agent lifecycle
- One team designer composes agent teams
- One AI interface (Ironclaw) is the sole human-AI interaction point

## Current State Analysis

### What Exists Today (and its problems)

**Multiple AI Entry Points (fragmented UX):**
- `IronclawContext` — chat panel for Ironclaw sidecar
- `AIStaffContext` — legacy AI chat (being deprecated)
- `DesignAIPanel` — design-tab-specific AI
- Per-tab agent panels scattered across the app
- Doc-intelligence pipeline (separate orchestration)

**Agents Aren't Really Agents:**
- Most are manifest definitions with stub execution
- 9+ agents have `TODO: Implement using executor` — they silently do nothing
- No persistent memory — state lost on restart
- No learning — same context every invocation
- In-memory Maps for registry, teams, tools

**Over-engineered Infrastructure:**
- LangGraph supervisor, classification filter, human checkpoints, agent wrappers, tool registry, team registry — all exist
- But 9+ agents are stubs, messaging handlers are dead code, orchestration is partially wired
- Infrastructure outpaced implementation

### What Gets Salvaged

| Component | Status | Action |
|-----------|--------|--------|
| `agents/registry.ts` | Rewrite | Keep DID generation, replace in-memory Map with DB-backed store |
| `agents/team-registry.ts` | Rewrite | Keep team model, add DB persistence |
| `agents/tool-registry.ts` | Keep + extend | Good foundation, add DB persistence |
| `agents/executor.ts` | Rewrite | Simplify to use standard agent execution path |
| `agents/copilot.ts` | Keep | Governance copilot is working rule-based v1 |
| `agents/langgraph/llm-factory.ts` | Keep | Per-agent LLM config works well |
| `orchestration/supervisor.ts` | Keep | LangGraph supervisor routing works |
| `orchestration/state.ts` | Keep | BastionStateAnnotation is solid |
| `orchestration/classification-filter.ts` | Keep | Classification ABAC works |
| `orchestration/human-checkpoints.ts` | Keep | DB-persisted checkpoints work |
| `orchestration/agent-wrapper.ts` | Keep | LangGraph node adapter works |
| `ironclaw/ironclaw-service.ts` | Extend | Add agent/team delegation commands |
| `ironclaw/action-registry.ts` | Keep | Risk levels and locked registry are good |
| `doc-intelligence/specialist-base.ts` | Refactor | Align to new standard agent template |
| `doc-intelligence/team-setup.ts` | Keep | Doc-intel team definition is good |
| `doc-intelligence/orchestrator.ts` | Keep | LangGraph orchestration works |

### What Gets Removed

| Component | Reason |
|-----------|--------|
| `frontend/src/context/AIStaffContext.tsx` | Replaced by Ironclaw |
| `frontend/src/components/ai-staff/` (dead exports) | AIShowContributions, InlineAnnotation, AgentRoutingConfig — dead |
| `frontend/src/hooks/useAgentRouting.ts` | Dead code |
| `frontend/src/hooks/useInlineAnnotations.ts` | Dead code |
| Per-tab AI panels | Replaced by single Ironclaw interface |
| `agents/narrative-synthesis.ts` | 440 lines, zero imports |
| `agents/loe-gap-analysis.ts` | Zero imports, never seeded |
| `agents/message-handlers.ts` | Zero imports, dead convenience wrappers |
| 9+ stub agent files | Rebuild on standard template when needed |

## Target Architecture

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │          Ironclaw Chat Panel               │  │
│  │  (sole AI interface — context-aware)       │  │
│  │  Knows current tab, problem set, user role │  │
│  └───────────────┬───────────────────────────┘  │
│                  │                               │
│  ┌───────────────┴───────────────────────────┐  │
│  │         Agent Admin Dashboard              │  │
│  │  Create │ Configure │ Health │ Validate    │  │
│  └───────────────┬───────────────────────────┘  │
│                  │                               │
│  ┌───────────────┴───────────────────────────┐  │
│  │          Team Designer                     │  │
│  │  Compose │ Assign Leader │ Workflow │ Test │  │
│  └───────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────┘
                   │ REST + WebSocket
┌──────────────────┴──────────────────────────────┐
│                   BACKEND                        │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │         Ironclaw Service (extended)        │  │
│  │  Route user requests → agents/teams        │  │
│  │  Assign/unassign agents to tasks           │  │
│  │  Report status back to user                │  │
│  └───────────────┬───────────────────────────┘  │
│                  │                               │
│  ┌───────────────┴───────────────────────────┐  │
│  │      Unified Agent Service                 │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │    Standard Agent Template           │  │  │
│  │  │  identity │ memory │ skills │ tools  │  │  │
│  │  │  model config │ validation │ health  │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  │                                            │  │
│  │  Agent Store (PostgreSQL-backed)           │  │
│  │  Team Store (PostgreSQL-backed)            │  │
│  │  Memory Store (per-agent persistent)       │  │
│  └───────────────┬───────────────────────────┘  │
│                  │                               │
│  ┌───────────────┴───────────────────────────┐  │
│  │      LangGraph Orchestration (kept)        │  │
│  │  Supervisor │ Filter │ Checkpoints         │  │
│  └───────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

## Standard Agent Template

Every agent — whether governance copilot, escalation modeler, or doc-intelligence specialist — follows this structure:

```typescript
interface StandardAgent {
  // Identity
  agentId: string;
  name: string;
  role: string;
  agentDID: string;
  clearance: ClassificationLevel;

  // Personality & Behavior
  systemPrompt: string;
  character?: ElizaCharacter;  // optional personality overlay

  // LLM Configuration
  modelConfig: {
    provider: 'anthropic' | 'openai' | 'azure' | 'near-ai' | 'local';
    model: string;
    temperature: number;
    maxTokens: number;
  };

  // Persistent Memory
  memory: AgentMemory;  // per-agent knowledge store (not just conversation)
  // What has this agent learned?
  // What decisions has it made before?
  // What context does it retain across invocations?

  // Skills (what can this agent DO)
  skills: AgentSkill[];  // defined capabilities with input/output schemas
  // e.g., "analyze_escalation_risk", "generate_opord", "extract_entities"

  // Tools (external capabilities)
  tools: MCPTool[];  // MCP tools bound to this agent
  // e.g., web_search, database_query, document_generation

  // Validation & Health
  validation: {
    healthCheck: () => HealthStatus;
    lastInvocation: Date;
    successRate: number;
    avgResponseTime: number;
    validationScore: number;
  };

  // Lifecycle
  status: 'active' | 'inactive' | 'degraded' | 'error';
  activatedAt?: Date;
  deactivatedAt?: Date;
}
```

### Agent Memory Model

```typescript
interface AgentMemory {
  agentId: string;

  // Long-term knowledge (persists across invocations)
  knowledge: MemoryEntry[];  // learned facts, patterns, preferences

  // Working memory (current task context)
  workingMemory: MemoryEntry[];  // cleared between tasks

  // Episodic memory (past task summaries)
  episodes: EpisodeSummary[];  // compressed records of past work

  // Methods
  remember(fact: string, category: string): void;
  recall(query: string, limit?: number): MemoryEntry[];
  forget(entryId: string): void;
  summarizeEpisode(taskId: string): EpisodeSummary;
}
```

Stored in PostgreSQL: `agent_memory` table with vector embeddings for semantic recall.

## Subphase Breakdown

### 51A: Standard Agent Template + DB Persistence (~3-4 plans)

1. Create `StandardAgent` base class and `AgentMemory` model
2. Create PostgreSQL-backed `AgentStore` replacing in-memory Map
3. Create `agent_memory` table with semantic recall
4. Migrate existing agents (4 default + doc-intel specialists) to new template
5. Refactor `agents/executor.ts` to use standard execution path

**Salvages:** DID generation, LLM factory, tool registry
**Removes:** Stub agent files (9+), narrative-synthesis, loe-gap-analysis, message-handlers

### 51B: Agent Admin Dashboard (~3-4 plans)

1. Agent CRUD interface — create agent with all config fields
2. Health monitoring panel — last invocation, success rate, response time, validation score
3. Activate/deactivate toggle with health gates
4. Memory viewer — browse what agent has learned, delete entries
5. Tool assignment interface — assign/remove tools from agent
6. Test harness — send test prompt, view output, validate against schema

**New frontend route:** `/admin/agents` (extend existing admin panel)

### 51C: Team Designer (~2-3 plans)

1. Team CRUD with drag-and-drop agent composition
2. Leader/orchestrator designation with workflow stage editor
3. Team testing — run team against test scenario, view agent-by-agent trace
4. Assign team to problem set (tie to existing problem set membership model)

**New frontend route:** `/admin/teams` (extend existing admin panel)

### 51D: Ironclaw Consolidation (~3-4 plans)

1. Extend Ironclaw service with agent/team assignment commands
   - "assign escalation-modeler to this problem set"
   - "form a team with adversary-modeler and deception-detector"
   - "what agents are working on this?"
2. Make Ironclaw context-aware (knows current tab, problem set, user role)
3. Remove `AIStaffContext` and all per-tab AI panels
4. Single Ironclaw panel available everywhere (drawer or sidebar)
5. Route all AI interactions through Ironclaw → agent delegation

**Removes:** AIStaffContext.tsx, DesignAIPanel, scattered AI panels
**Extends:** IronclawService, IronclawContext

## Migration Strategy

### Phase 51A (no UX change, backend only)
- New standard agent model created alongside old
- Migrate agents one by one to new template
- Old registry still works during migration
- Cut over when all agents migrated

### Phase 51B-C (new admin pages, no breaking changes)
- New routes added to admin panel
- Old agent seeding still works
- Dashboard reads from new DB-backed store

### Phase 51D (breaking UX change)
- Remove old AI panels in one coordinated commit
- Ironclaw becomes sole interface
- Feature flag: `IRONCLAW_SOLE_INTERFACE=true` for gradual rollout

## Success Criteria

- [ ] Every agent built from StandardAgent template
- [ ] Agent state persisted to PostgreSQL (survives restart)
- [ ] Per-agent memory store with semantic recall
- [ ] Admin dashboard: create, configure, activate, health monitor, test
- [ ] Team designer: compose, assign leader, define workflow, test
- [ ] Ironclaw is the only AI interface in the application
- [ ] All scattered AI panels removed
- [ ] Zero stub agents — every registered agent actually executes
- [ ] Agent health visible at a glance in admin
