# Phase 52: Agent Skills & MCP - Research

**Researched:** 2026-03-19
**Domain:** MCP Server (Model Context Protocol), Skills Registry, Ironclaw Builder Actions, Field Write-Back, Autonomous Orchestration Loop
**Confidence:** HIGH (based on direct codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**MCP Server**
- Standalone MCP server process (like Ironclaw — its own Docker container `bastion-mcp`)
- Agents connect to MCP server to execute tools during LangGraph workflows
- Tools registered in the existing ToolRegistry should be served via MCP protocol
- Agent tool assignments control which MCP tools each agent can access
- DID-based authorization — agent DID checked against smart contract for tool permissions

**Skills Registry**
- Skills are reusable capability definitions that agents can learn
- Higher-level than tools — a skill composes tools, prompts, and validation into a workflow
- Each skill has a SKILL.md definition with versioning
- Skills stored in PostgreSQL with DB migration
- Admin UI tab in Agent Hub (already has `<SkillsPlaceholder />`)
- Skills assignable to agents like tools are
- Ironclaw can create new skills dynamically when users request new capabilities

**Ironclaw Builder Capabilities**
- Ironclaw already has action types registered: `agent.create`, `agent.update`, `tool.create`, `team.create`, etc. in `ACTION_RISK` map and `CANONICAL_DESCRIPTIONS` in `action-registry.ts`
- Need backend handlers that execute these actions when action cards are approved
- Action card flow: user asks Ironclaw → Ironclaw generates action card → user approves → backend executes
- All CRUD operations go through existing admin API routes
- Ironclaw must have read/write access commensurate with user permissions

**Field Write-Back**
- Frontend already has `SuggestionData` with `targetField`/`fieldValue` and event bus in `IronclawContext.tsx`
- Backend needs to generate suggestions with field targets when Ironclaw produces content
- Example: user asks "suggest a problem statement" → Ironclaw responds with `suggestion + targetField='problemStatement'`
- On acceptance, field value written via problem set API
- Sensitive fields (mission statement, ROE) use `field.write_sensitive` (high risk — requires explicit approval)

**Autonomous Orchestration Loop (Critical)**
- Ironclaw needs a task lifecycle: receive complex task → assign to agent(s) → wait for completion → collect/synthesize results → present as suggestion cards → user approves → apply to problem set fields
- Collaborative back-and-forth pattern: Ironclaw proposes → user reviews/provides input → Ironclaw refines → user approves → Ironclaw applies
- Same pattern as Chief of Staff ↔ Commander: staff prepares products, commander reviews and decides, staff refines and implements
- Task progress must be visible in the Ironclaw drawer (uses existing StepProgressData/IronclawStepStream)
- Permission scoping: user's role determines which fields they can approve changes to
- Multi-step tasks with intermediate checkpoints and decision gates
- Results presented as rich suggestion cards with "Apply to {field}" buttons (uses existing IronclawSuggestion component)
- Must work for ALL problem set fields: mission statement, COA, COP layers, design sections, objectives, etc.

### Claude's Discretion
- MCP server implementation details (transport protocol, connection pooling)
- Skill definition schema design
- How skills compose tools internally
- MCP server health monitoring approach
- Task lifecycle state machine design
- Orchestration loop polling/streaming strategy

### Deferred Ideas (OUT OF SCOPE)
- Skill marketplace (sharing skills between BASTION instances)
- Skill execution analytics/metrics
- Tool chaining within skills (complex multi-tool workflows)
- MCP server federation across multiple BASTION deployments
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-52-01 | Standalone MCP server Docker container that serves tools to agents via MCP protocol | MCP SDK patterns; docker-compose service model mirrors ironclaw service |
| REQ-52-02 | Skills registry with PostgreSQL storage, versioning, and admin UI panel | AgentSkill interface already exists; agents_v2 migration pattern; AgentHub Skills tab already stubbed |
| REQ-52-03 | Ironclaw builder action handlers for agent.create, tool.create, team.create, and related types | action-registry.ts already has all action types registered; tool-bridge + action-pipeline patterns cover the approval path |
| REQ-52-04 | Field write-back pipeline applying Ironclaw suggestions to problem set fields with risk-tiered approval | SuggestionData frontend type complete; IronclawContext event bus wired; backend ironclaw-service.ts needs suggestion embedding in processResponse |
| REQ-52-05 | Autonomous orchestration loop: task lifecycle with agent dispatch, progress tracking, multi-step approval, and field write-back | BastionSupervisor + LangGraph orchestration exists; StepProgressData/IronclawStepStream UI exists; task persistence and Ironclaw-to-supervisor bridge are the gaps |
</phase_requirements>

---

## Summary

Phase 52 builds five tightly coupled capabilities on top of the Phase 51 unified agent architecture. All foundations are in place — the research task is to understand the exact wiring gaps so the planner can create precise implementation tasks.

The **MCP server** will be a new Node.js process in its own Docker container, using `@modelcontextprotocol/sdk` to expose the tools already registered in `ToolRegistry` over stdio or SSE transport. The backend's `agent-wrapper.ts` currently wires LangChain tools directly; the MCP server provides the same tools via the official protocol, enabling any MCP-compatible agent to invoke them.

The **skills registry** is structurally similar to the tool registry but operates at a higher abstraction level. The `AgentSkill` interface already exists in `standard-agent.ts` (with Zod `inputSchema`/`outputSchema`), but skills are not yet persisted to PostgreSQL nor surfaced in the admin UI. A new migration (`038-skills.sql`) and `SkillRegistryPanel.tsx` replacing the existing `<SkillsPlaceholder />` are the core deliverables.

The **Ironclaw builder handlers** are the most structurally interesting piece. `action-registry.ts` already registers all 16 action types (`agent.create`, `tool.create`, `team.create`, etc.) with canonical descriptions and risk levels. The gap is in `tool-bridge.ts` (which currently only calls `actionPipeline.processAction` but does NOT execute the actual CRUD) — `handleToolCall` returns `ActionResult` with `status: 'executed'` but never actually calls the admin service to perform the write. Phase 52 adds a dispatch layer that routes approved actions to the correct admin API call.

The **field write-back** frontend infrastructure is complete: `SuggestionData.targetField`, `SuggestionData.fieldValue`, `IronclawContext.acceptSuggestion`, and the `onFieldWrite` event bus all exist. The only gap is on the backend: `ironclaw-service.ts:processResponse` does not yet parse or embed suggestion payloads from the Ironclaw sidecar response. Phase 52 adds the `suggestion` field parsing alongside the existing `tool_call` parsing.

The **autonomous orchestration loop** is the core value proposition of Phase 52. It bridges Ironclaw's Chief of Staff role with the existing LangGraph agent infrastructure to enable multi-step collaborative workflows. The user issues a complex task (e.g., "develop a COA for this scenario"), Ironclaw decomposes it, dispatches sub-tasks to specialist agents via the BastionSupervisor, tracks progress with StepProgressData (already wired to IronclawStepStream in the drawer), and presents results as suggestion cards with "Apply to {field}" buttons. The user approves or refines at each decision gate, and approved changes are written to problem set fields via the field write-back pipeline. All existing infrastructure pieces are present but not connected: BastionSupervisor handles agent routing, HumanCheckpointManager handles approval gates, StepProgressData tracks multi-step progress, and SuggestionData handles field targeting. The gap is a **task orchestrator** service that ties these together into a coherent lifecycle with persistent task state.

**Primary recommendation:** Implement in five streams. The orchestration loop depends on field write-back (for the "apply" step) and builder handlers (for executing approved actions), so it should be the final stream. The MCP server and skills registry are independent.

Stream dependency order:
1. MCP container (independent)
2. Skills registry (independent)
3. Ironclaw builder handlers (independent)
4. Field write-back pipeline (independent)
5. Orchestration loop (depends on 3 + 4)

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | latest | MCP server implementation — tool registration and transport | Official Anthropic/MCP SDK; the canonical way to expose MCP tools |
| `zod` | `^4.3.5` (already in project) | Skill input/output schema validation | Already used throughout; `AgentSkill.inputSchema` is already `ZodType` |
| `zod-to-json-schema` | `^3.25.1` (already in project) | Convert Zod schemas to JSON Schema for MCP tool descriptors | Already in backend `package.json` |
| `express` | `^5.2.1` (already in project) | HTTP transport for MCP server (SSE or webhook variant) | Matches existing backend transport |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pg` / `postgres` pool | (via `getPool()`) | Skills table CRUD | Follow existing migration + `getPool()` pattern — do NOT introduce a new DB client |
| `@langchain/core` `StructuredToolInterface` | `^1.1.15` (already in project) | Convert MCP tools to LangChain format for agent-wrapper | Already used in `ToolRegistry.getLangChainToolsForAgent` |

### Installation
```bash
# Only NEW dependency needed — everything else already in backend/package.json
cd backend && npm install @modelcontextprotocol/sdk
```

---

## Architecture Patterns

### Recommended Project Structure
```
backend/src/mcp/
├── mcp-server.ts          # MCP Server process entry point — lists/calls tools
├── mcp-router.ts          # Express routes for MCP SSE or HTTP transport
└── index.ts               # Export singleton, startup init

backend/src/agents/
├── skill-registry.ts      # NEW: mirrors ToolRegistry pattern, backed by skills table
├── skill-store.ts         # NEW: PostgreSQL CRUD for skills (migration 038)
└── standard-agent.ts      # EXISTING: AgentSkill interface already defined here

backend/src/ironclaw/
├── builder-handlers.ts    # NEW: dispatch map for agent.create, tool.create, etc.
├── task-orchestrator.ts   # NEW: task lifecycle, agent dispatch, result collection
├── task-store.ts          # NEW: PostgreSQL CRUD for ironclaw_tasks table
├── task-types.ts          # NEW: task state machine types
├── tool-bridge.ts         # EXISTING: add executeApprovedAction(action, result) dispatch
└── ironclaw-service.ts    # EXISTING: add suggestion parsing + task dispatch in processResponse()

backend/src/db/migrations/
├── 038-skills.sql         # NEW: skills table
└── 039-ironclaw-tasks.sql # NEW: task lifecycle + suggestion columns

frontend/src/components/ironclaw/
├── IronclawTaskPanel.tsx  # NEW: task progress panel in drawer (uses IronclawStepStream)
├── IronclawStepStream.tsx # EXISTING: multi-step progress stepper
└── IronclawSuggestion.tsx # EXISTING: suggestion card with "Apply to {field}" button

frontend/src/components/admin/
└── SkillRegistryPanel.tsx # NEW: replaces SkillsPlaceholder in AgentHub
```

### Pattern 1: MCP Server as Sidecar Container
**What:** The MCP server is a separate Node.js process in `docker-compose.yml`, structured identically to the Ironclaw service.
**When to use:** Any tool execution from agent LangGraph workflows.
**Implementation approach:**
```typescript
// backend/src/mcp/mcp-server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getToolRegistry } from '../agents/tool-registry.js';

const server = new McpServer({ name: 'bastion-mcp', version: '1.0.0' });
const registry = getToolRegistry();
await registry.ensureInitialized();

for (const tool of registry.listTools()) {
  server.tool(tool.toolId, tool.description, zodSchema, async (input) => {
    // Dispatch to tool handler
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });
}

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Docker service model** (mirror of ironclaw service):
```yaml
bastion-mcp:
  build:
    context: ./backend
    target: runtime
  container_name: bastion-mcp
  command: node dist/mcp/index.js
  environment:
    - DATABASE_URL=postgresql://postgres:password@postgres:5432/coalition_ops
    - MCP_SHARED_SECRET=${MCP_SHARED_SECRET:-dev-mcp-secret}
  depends_on:
    postgres:
      condition: service_healthy
  networks:
    - bastion-network
  restart: unless-stopped
```

### Pattern 2: Skills Registry Mirrors ToolRegistry
**What:** `SkillRegistry` follows the exact same singleton pattern as `ToolRegistry`. Skills persist to a `skills` table via `SkillStore`.
**When to use:** Whenever agents need reusable, validated capability workflows.

The `AgentSkill` interface already exists in `standard-agent.ts`:
```typescript
export interface AgentSkill {
  skillId: string;
  name: string;
  description: string;
  inputSchema: ZodType;   // Already Zod
  outputSchema: ZodType;  // Already Zod
}
```

The DB schema for skills follows the `agents_v2` JSONB pattern:
```sql
-- 038-skills.sql
CREATE TABLE IF NOT EXISTS skills (
  skill_id      TEXT        PRIMARY KEY,
  skill_data    JSONB       NOT NULL,    -- full AgentSkill serialized
  version       TEXT        NOT NULL DEFAULT '1.0.0',
  created_by    TEXT        NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  is_enabled    BOOLEAN     DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS agent_skill_assignments (
  skill_id    TEXT        NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
  agent_id    TEXT        NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by TEXT        NOT NULL,
  PRIMARY KEY (skill_id, agent_id)
);
```

### Pattern 3: Ironclaw Builder Handler Dispatch
**What:** A new `builder-handlers.ts` module dispatches approved Ironclaw actions to the existing admin API functions.
**When to use:** When `action-pipeline.ts` returns `status: 'executed'` for agent/tool/team CRUD action types.

The gap is in `tool-bridge.ts:handleToolCall` — it routes through `actionPipeline.processAction` but `processAction` only DECIDES approval; it does not execute. The caller (currently nothing) is supposed to run the action when status is `'executed'`. Phase 52 closes this loop:

```typescript
// backend/src/ironclaw/builder-handlers.ts
type ActionHandler = (payload: Record<string, unknown>, userDid: string) => Promise<Record<string, unknown>>;

export const BUILDER_HANDLERS: Record<string, ActionHandler> = {
  'agent.create': async (payload, userDid) => {
    // Call existing admin service: same logic as POST /api/admin/agents
    const agentStore = getAgentStore();
    // ... build StandardAgent from payload, call agentStore.registerAgent()
    return { agentId: agent.agentId };
  },
  'agent.update': async (payload, _userDid) => { /* agentStore.updateAgent() */ },
  'agent.delete': async (payload, _userDid) => { /* agentStore.deleteAgent() */ },
  'agent.activate': async (payload, _userDid) => { /* agentStore.updateStatus('active') */ },
  'agent.deactivate': async (payload, _userDid) => { /* agentStore.updateStatus('inactive') */ },
  'tool.create': async (payload, userDid) => { /* toolRegistry.registerTool() */ },
  'tool.update': async (payload, _userDid) => { /* toolRegistry.updateTool() */ },
  'tool.delete': async (payload, _userDid) => { /* toolRegistry.deleteTool() */ },
  'tool.assign_to_agent': async (payload, userDid) => { /* toolRegistry.assignToolToAgent() */ },
  'team.create': async (payload, userDid) => { /* teamStore.createTeam() */ },
  'team.update': async (payload, _userDid) => { /* teamStore.updateTeam() */ },
  'team.delete': async (payload, _userDid) => { /* teamStore.deleteTeam() */ },
  'team.add_member': async (payload, _userDid) => { /* teamStore.addMember() */ },
  'team.remove_member': async (payload, _userDid) => { /* teamStore.removeMember() */ },
};
```

`tool-bridge.ts:handleToolCall` is updated to call `BUILDER_HANDLERS[action.type](action.payload, userDid)` after `actionPipeline.processAction` returns `status: 'executed'`.

### Pattern 4: Field Write-Back via Suggestion Embedding
**What:** Ironclaw response JSON includes an optional `suggestion` object with `target_field` and `field_value`. The backend `processResponse()` parses this and embeds it in the chat message. The frontend event bus then dispatches it to the relevant form.
**When to use:** Any time Ironclaw is asked to suggest content for a specific problem set field.

Backend gap in `ironclaw-service.ts:processResponse()`:
```typescript
// After existing action_card parsing, add:
let suggestion: SuggestionPayload | null = null;
if (parsed?.suggestion) {
  const s = parsed.suggestion as Record<string, unknown>;
  suggestion = {
    id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    content: (s.content as string) ?? messageContent,
    agent_id: (s.agent_id as string) ?? 'ironclaw',
    agent_display_name: (s.agent_display_name as string) ?? 'Ironclaw',
    target_field: (s.target_field as string) ?? null,
    target_field_label: (s.target_field_label as string) ?? null,
    field_value: (s.field_value as string) ?? null,
  };
}
```

The backend `IronclawChatMessage` type and `ironclaw_messages` DB table need a `suggestion` JSONB column (migration 038 or 039).

The frontend `IronclawContext.acceptSuggestion` already has the TODO comment:
```typescript
// TODO: notify backend of acceptance if needed
```
This should call `POST /api/ironclaw/suggestions/:id/accept` which calls the problem set update API.

**Sensitive field routing:**
- Fields listed in `SENSITIVE_FIELDS` set (e.g., `missionStatement`, `ruleOfEngagement`) emit `field.write_sensitive` action type (high risk — requires Decision Gate).
- All other fields emit `field.write` (medium risk — inline confirmation).

### Pattern 5: Autonomous Orchestration Loop (Task Lifecycle)
**What:** A persistent task lifecycle that bridges the Ironclaw chat interface with the LangGraph agent execution infrastructure. Ironclaw receives a complex request, creates a task, dispatches agents, tracks progress via WebSocket, and presents results as suggestion cards for user approval.
**When to use:** Any multi-step work request that requires agent execution and produces artifacts to write back to problem set fields.

**The Chief of Staff metaphor:**
The orchestration loop mirrors military staff process. The Commander (user) issues guidance. The Chief of Staff (Ironclaw) decomposes it into staff tasks, assigns them to the right J-code staff officers (specialist agents), monitors progress, collects products, and presents them to the Commander for decision. The Commander approves, rejects, or redirects. Approved products are published (written to problem set fields).

**Existing infrastructure inventory (what is already built):**

| Component | Location | What It Does | Gap |
|-----------|----------|-------------|-----|
| `BastionSupervisor` | `orchestration/supervisor.ts` | LangGraph StateGraph — routes tasks to agents, tracks execution trace | Not connected to Ironclaw; no persistent task state |
| `LangGraphAgentWrapper` | `orchestration/agent-wrapper.ts` | Wraps agents as LangGraph nodes with tool binding, classification filtering | Works but only invoked via supervisor.execute() — no Ironclaw trigger |
| `HumanCheckpointManager` | `orchestration/human-checkpoints.ts` | DB-persisted pause/resume with approval, expiry, notification via message bus | Not connected to Ironclaw drawer; only used for classification escalation |
| `StepProgressData` | `ironclaw-types.ts` | Backend type: `steps[]`, `current_step`, `started_at` | Type exists, not emitted by any code path |
| `IronclawStepStream` | `frontend IronclawStepStream.tsx` | Vertical stepper UI with pending/running/complete/failed icons | Fully built; renders from `stepProgress` on `IronclawChatMessage` — just never receives data |
| `SuggestionData` | `frontend types/ironclaw.ts` | `targetField`, `fieldValue`, `agentDisplayName` | Frontend component complete; backend doesn't emit suggestions yet (REQ-52-04 gap) |
| `IronclawSuggestion` | `frontend IronclawSuggestion.tsx` | "Apply to {field}" card with accept/dismiss | Fully built; wired to IronclawContext event bus |
| `ActionPipeline` | `ironclaw/action-pipeline.ts` | Risk classification, trust check, Decision Gate creation | Works for action cards; needs extension for task-level approval |
| `ironclawService.formTeamForTask()` | `ironclaw-service.ts` | Assigns a team to a task, stores in team_data JSONB | Works but returns synchronously — no async task tracking |

**Task state machine:**
```
CREATED → DISPATCHED → AGENT_WORKING → COLLECTING_RESULTS → PRESENTING → AWAITING_APPROVAL → APPLYING → COMPLETED
                ↑                                                     ↓                          ↑
                └─────────────────── REFINING ←──────────────────────┘(user requests changes)    │
                                                                                                  │
                                                              REJECTED ←── (user rejects) ────────┘
                                                              FAILED ←── (agent error at any step)
```

**Task persistence (new table):**
```sql
-- 039-ironclaw-tasks.sql
CREATE TABLE IF NOT EXISTS ironclaw_tasks (
  task_id         TEXT        PRIMARY KEY,
  problem_set_id  TEXT        NOT NULL,
  user_did        TEXT        NOT NULL,
  title           TEXT        NOT NULL,           -- "Develop COA for Phase 3"
  description     TEXT,                           -- Full task description
  status          TEXT        NOT NULL DEFAULT 'created',
  assigned_agents TEXT[]      DEFAULT '{}',       -- Agent IDs dispatched
  assigned_team   TEXT,                           -- Team ID if team-based
  thread_id       TEXT,                           -- LangGraph supervisor thread_id
  steps           JSONB       DEFAULT '[]',       -- StepInfo[] — progress tracking
  current_step    INTEGER     DEFAULT 0,
  results         JSONB       DEFAULT '[]',       -- Collected agent outputs
  suggestions     JSONB       DEFAULT '[]',       -- SuggestionData[] ready for user review
  target_fields   JSONB       DEFAULT '{}',       -- Map of field path → proposed value
  user_feedback   JSONB       DEFAULT '[]',       -- User refinement comments
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ironclaw_tasks_ps ON ironclaw_tasks(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_ironclaw_tasks_status ON ironclaw_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ironclaw_tasks_user ON ironclaw_tasks(user_did);
```

**Orchestrator service (new module):**
```typescript
// backend/src/ironclaw/task-orchestrator.ts
export class TaskOrchestrator {
  /**
   * Create and dispatch a task. Called when Ironclaw identifies a complex request
   * that requires agent execution (not a simple chat response).
   *
   * Flow:
   * 1. Parse user request into task definition with target fields
   * 2. Create task record in DB
   * 3. Emit CREATED step progress to drawer via WebSocket
   * 4. Identify required agents (from request context + agent capabilities)
   * 5. Dispatch to BastionSupervisor.execute() in background
   * 6. Stream step progress updates via WebSocket as agents complete
   * 7. Collect results and generate SuggestionData[] with target fields
   * 8. Present suggestions in drawer — one per target field
   * 9. Wait for user approval per suggestion
   * 10. On approval, write to problem set via field write-back pipeline
   */
  async createTask(params: CreateTaskParams): Promise<IronclawTask> { /* ... */ }
  async dispatchTask(taskId: string): Promise<void> { /* ... */ }
  async handleStepComplete(taskId: string, stepIdx: number, result: unknown): Promise<void> { /* ... */ }
  async presentResults(taskId: string): Promise<void> { /* ... */ }
  async handleApproval(taskId: string, suggestionId: string, decision: TrustDecision): Promise<void> { /* ... */ }
  async handleRefinement(taskId: string, feedback: string): Promise<void> { /* ... */ }
  async applyApproved(taskId: string): Promise<void> { /* ... */ }
}
```

**How Ironclaw triggers the orchestration loop:**
The Ironclaw sidecar (LLM) is instructed via system prompt to emit a `task_request` JSON key when a user message requires multi-step agent work. `ironclaw-service.ts:processResponse()` detects this (same pattern as `tool_call` detection) and routes to `TaskOrchestrator.createTask()`:

```typescript
// In processResponse(), after existing tool_call and suggestion detection:
if (parsed?.task_request) {
  const tr = parsed.task_request as Record<string, unknown>;
  const task = await taskOrchestrator.createTask({
    problemSetId,
    userDid: session.userDid,
    title: tr.title as string,
    description: tr.description as string,
    targetFields: tr.target_fields as Record<string, string>, // field path → label
    agentHints: tr.agent_hints as string[] ?? [],
  });
  // Emit initial step progress message to drawer
  await this.emitTaskProgress(problemSetId, task);
  // Dispatch agents in background (non-blocking)
  taskOrchestrator.dispatchTask(task.taskId).catch(err =>
    console.error(`[ironclaw] Task dispatch failed: ${task.taskId}`, err)
  );
}
```

**Progress tracking via WebSocket (leverages existing StepProgressData):**
As agents complete steps, the orchestrator publishes `ironclaw.step-progress` messages through the existing `publishToChannel` function. The frontend already renders these via `IronclawStepStream`. The step labels come from the task definition (e.g., "Analyzing threat environment", "Developing courses of action", "Evaluating COA feasibility").

**Result presentation as suggestion cards:**
When all agents complete, the orchestrator:
1. Collects results from the LangGraph execution trace
2. Synthesizes them into per-field suggestions (one `SuggestionData` per target field)
3. Persists suggestions to the task record
4. Emits each as an `ironclaw.response` message with `suggestion` data
5. Frontend renders them as `IronclawSuggestion` cards with "Apply to {field}" buttons

**Permission scoping for field writes:**
The orchestrator checks the user's role before presenting suggestions:
- **Commander role**: Can approve writes to ALL fields including sensitive ones (mission statement, ROE, commander's intent)
- **Staff officer roles (J2-J6)**: Can approve writes within their functional lane (e.g., J2 can approve intelligence estimate, J3 can approve scheme of maneuver)
- **Observer/analyst**: Can view suggestions but cannot approve writes — suggestion cards show "Request Approval" instead of "Apply"

Role-to-field mapping uses the existing problem set membership model (`userRoleInActive` from `ProblemSetContext`). The mapping is configured in a `ROLE_FIELD_PERMISSIONS` constant:
```typescript
const ROLE_FIELD_PERMISSIONS: Record<string, string[]> = {
  commander: ['*'],  // All fields
  xo: ['*'],         // Deputy — all fields
  j2_intelligence: ['design.problemFraming', 'design.cogAnalysis.*', 'intelligence.*'],
  j3_operations: ['design.operationalApproach', 'design.linesOfEffort', 'plan.coaDetails.*'],
  j4_logistics: ['plan.sustainment.*', 'logistics.*'],
  j5_plans: ['design.*', 'plan.*', 'campaign.*'],
  j6_communications: ['plan.commandSignal.*', 'communications.*'],
};
```

**Multi-step refinement loop:**
When the user rejects a suggestion or provides feedback, the orchestrator:
1. Records feedback in `user_feedback` JSONB array on the task
2. Transitions task to `REFINING` status
3. Re-dispatches to the relevant agent(s) with the feedback as additional context
4. Agent produces revised output
5. New suggestion card replaces the rejected one in the drawer
6. Cycle continues until user approves or cancels

This refinement loop is the key differentiator from a one-shot action card. It enables the iterative staff-commander dynamic where products are refined through multiple review cycles.

**Writable problem set field map (from codebase inspection):**

| Field Path | API Target | Risk Level | Description |
|-----------|-----------|-----------|-------------|
| `name` | `PATCH /api/problem-sets/:id` body.name | medium | Problem set name |
| `description` | `PATCH /api/problem-sets/:id` body.description | medium | Problem set description |
| `design.problemFraming` | `PUT /api/design/:psId/problem-framing` | medium | Problem framing section |
| `design.cogAnalysis` | `PUT /api/design/:psId/cog-analysis` | medium | Center of gravity analysis (friendly/adversary) |
| `design.linesOfEffort` | `PUT /api/design/:psId/lines-of-effort` | medium | Lines of effort definitions |
| `design.operationalApproach` | `PUT /api/design/:psId/operational-approach` | medium | Operational approach narrative |
| `missionStatement` | Design API or PS metadata | **high** (sensitive) | Mission statement — requires Decision Gate |
| `commandersIntent` | Design API or PS metadata | **high** (sensitive) | Commander's intent |
| `ruleOfEngagement` | PS metadata | **high** (sensitive) | Rules of engagement |
| `plan.coaDetails` | Planning API | medium | Course of action details |
| `cop.layers.*` | COP API | medium | COP layer configurations |

### Anti-Patterns to Avoid
- **Building a custom tool protocol:** Do not hand-roll a tool transport. Use `@modelcontextprotocol/sdk` — it handles protocol framing, capability negotiation, and error responses.
- **Storing Zod schema instances in PostgreSQL:** Zod schemas cannot be serialized. Store JSON Schema (`zod-to-json-schema` conversion) in the DB; reconstruct Zod schema at runtime for validation.
- **Parallel admin paths for Ironclaw builder:** Ironclaw builder handlers MUST call the exact same admin service functions that the UI calls — no separate DB queries. This is a locked decision.
- **Making `action-registry.ts` mutable after startup:** The registry is locked after startup. Phase 52 does not add new action types to `ACTION_RISK` — all 16 builder action types are already registered there.
- **Synchronous orchestration in the request handler:** The `handleMessage` flow is synchronous (request → Ironclaw webhook → response). Task dispatch MUST be async/background — the user gets an immediate "Task created, tracking progress..." message, and results arrive later via WebSocket. Never block the chat on a multi-minute agent workflow.
- **Coupling task orchestrator to specific field schemas:** The orchestrator should be field-agnostic — it receives `targetFields` as `Record<string, string>` (path → label) from the Ironclaw LLM. It does not hardcode knowledge of which fields exist. Field validation happens at write time in the respective API endpoint.
- **Skipping the approval step for "low risk" fields:** Every field write from agent results MUST go through suggestion → approval. The orchestration loop is never fully autonomous — the Commander always decides. Trust preferences (via `always` button) can auto-approve repeat patterns, but the first instance always presents a card.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP tool protocol | Custom JSON-RPC tool server | `@modelcontextprotocol/sdk` McpServer | MCP protocol has capability negotiation, transport abstraction, typed request/response — hand-rolling creates protocol drift |
| Zod → JSON Schema conversion | Custom schema serializer | `zod-to-json-schema` (already in project) | Already a dependency; handles all Zod constructs including unions, refinements |
| Skill version comparison | Custom semver logic | Store `version` as TEXT, compare with `semver` or simple string equality | Phase 52 doesn't need complex version resolution — single active version per skill is sufficient |
| Field write routing | Custom field-to-API dispatch | Call the existing problem set PATCH/update API endpoint directly | The problem set API is already tested and handles validation, access control |
| Agent orchestration | Custom agent execution pipeline | `BastionSupervisor` (LangGraph StateGraph) via `supervisor.execute()` | Already handles routing, classification, checkpointing, and trace collection |
| Progress streaming | Custom WebSocket protocol | Existing `publishToChannel` + `StepProgressData` on `IronclawChatMessage` | Already wired end-to-end; `IronclawStepStream` renders steps — just needs data |
| Human approval gates | Custom approval UI | Existing `ActionPipeline` for risk-tiered confirmation + `IronclawActionCard` / `IronclawSuggestion` components | Two approval patterns already built: action cards (yes/no/always) and suggestion cards (accept/dismiss) |

---

## Common Pitfalls

### Pitfall 1: Zod Schema Serialization
**What goes wrong:** `AgentSkill.inputSchema` is a `ZodType` (live runtime object). Writing it directly to JSONB stores `{}`.
**Why it happens:** Zod types are class instances with methods, not plain objects.
**How to avoid:** On write, call `zodToJsonSchema(skill.inputSchema)`. On read, reconstruct with `z.object(...)` from the stored JSON Schema, or store both forms.
**Warning signs:** Skill reads from DB return empty schemas.

### Pitfall 2: MCP Server Shares ToolRegistry State with Backend
**What goes wrong:** MCP server and backend both instantiate `ToolRegistry` singleton — they diverge over time (MCP has stale tool list).
**Why it happens:** `getToolRegistry()` is in-memory; two processes = two separate instances.
**How to avoid:** MCP server reads tools from PostgreSQL (once skills/tools are persisted), or exposes a REST endpoint to reload from the backend. For Phase 52, the simplest approach is MCP server calling backend's `GET /api/admin/tools` at startup and reloading periodically.
**Warning signs:** Tools visible in admin UI but not callable via MCP.

### Pitfall 3: Ironclaw Builder Handlers Not Idempotent
**What goes wrong:** Action approved → handler called → network error → action retried → duplicate agent/tool created.
**Why it happens:** `tool-bridge.ts` generates action IDs with `Date.now()` — no deduplication.
**How to avoid:** `builder-handlers.ts` wraps each call in `ON CONFLICT DO NOTHING` or checks existence before insert. Use `agentStore.registerAgent` which already uses `ON CONFLICT DO UPDATE`.
**Warning signs:** Duplicate agent IDs appearing after network hiccups.

### Pitfall 4: Field Write-Back Missing the `suggestion` Column
**What goes wrong:** Backend parses suggestion from Ironclaw response, creates the `SuggestionPayload` object, but `ironclawStore.addMessage()` drops it because the `ironclaw_messages` table has no `suggestion` column.
**Why it happens:** The DB schema and store haven't been extended yet.
**How to avoid:** Migration 038 (or 039) must add `suggestion JSONB` to `ironclaw_messages` AND the `rowToChatMessage` mapper in `ironclaw-store.ts` must include the column.
**Warning signs:** Frontend never receives suggestion data even when Ironclaw response contains it.

### Pitfall 5: action-registry.ts Lock
**What goes wrong:** Builder tries to `actionRegistry.registerAction('skill.create', 'medium')` but registry is locked after startup.
**Why it happens:** `tool-bridge.ts:registerTools()` calls `actionRegistry.lock()` on startup.
**How to avoid:** If Phase 52 adds new action types (e.g., `skill.create`, `skill.assign`), they MUST be added to `ACTION_RISK` in `ironclaw-types.ts` before the lock fires. Do not call `registerAction()` dynamically at runtime.
**Warning signs:** Console warning: `REJECTED: Attempt to modify locked registry`.

### Pitfall 6: Task Orchestrator Blocks on Supervisor.execute()
**What goes wrong:** `BastionSupervisor.execute()` is a long-running LangGraph invocation (can take 30-120 seconds with multiple agent hops). If called in the Express request handler, the HTTP connection times out and the user sees no progress.
**Why it happens:** The existing `handleMessage` → `processResponse` flow is synchronous request-response.
**How to avoid:** `dispatchTask()` must spawn the supervisor execution in a background worker (fire-and-forget with error handling). Use `setImmediate` or a task queue. Progress updates stream via WebSocket, not HTTP response.
**Warning signs:** Chat drawer shows infinite loading spinner; request times out at 30s.

### Pitfall 7: Stale Task State After Server Restart
**What goes wrong:** Server restarts mid-task. In-memory task state is lost. Task shows as `DISPATCHED` in DB forever.
**Why it happens:** LangGraph supervisor state is in the checkpointer (PostgreSQL), but the orchestrator's in-memory tracking of "which tasks are active" is lost.
**How to avoid:** On startup, `TaskOrchestrator.init()` queries `ironclaw_tasks WHERE status IN ('dispatched', 'agent_working')` and either resumes them (via `BastionSupervisor.resume(threadId)`) or marks them as `FAILED` with a "server restart" error. The LangGraph checkpointer already persists execution state — resumption is supported.
**Warning signs:** Tasks stuck in "Agent Working..." state with no progress updates after deploy.

### Pitfall 8: Multiple Suggestions Per Task Cause Partial Apply
**What goes wrong:** Task produces 3 suggestions (e.g., problem statement + CoG analysis + operational approach). User approves 2, dismisses 1. System tries to apply all 3 or applies none.
**Why it happens:** Suggestion approval is per-card but task completion is per-task.
**How to avoid:** Each suggestion is independently approvable. Task tracks per-suggestion status in `suggestions` JSONB array. Task transitions to `COMPLETED` only when all suggestions are resolved (approved, dismissed, or the user explicitly closes the task). Partial application is the expected path — not all suggestions need to be accepted.
**Warning signs:** User approves one field but the other pending suggestions disappear from the drawer.

---

## Code Examples

### Existing Pattern: Tool Registration in ToolRegistry
```typescript
// Source: backend/src/agents/tool-registry.ts
async registerTool(input: MCPToolInput, createdBy: string): Promise<MCPTool> {
  const parseResult = MCPToolInputSchema.safeParse(input);
  if (!parseResult.success) {
    throw new Error(`Invalid tool input: ${parseResult.error.message}`);
  }
  const didResult = await createToolDID(validInput.toolId);
  const tool: MCPTool = { ...validInput, toolDID: didResult.did, ... };
  this.tools.set(tool.toolId, tool);
  return tool;
}
```
Skill registry follows the same pattern: validate → generate DID (optional for skills) → persist to DB.

### Existing Pattern: Action Pipeline Approval Flow
```typescript
// Source: backend/src/ironclaw/action-pipeline.ts
// Pattern: processAction() returns status, CALLER executes
async processAction(action: IronclawAction, userDid: string): Promise<ActionResult> {
  // rate limit → risk classify → trust check → route
  // Returns { status: 'executed' } for auto-approved medium/low
  // Returns { status: 'confirm_required', action_card } for untrusted
  // Returns { status: 'gate_created', gate_id } for high risk
}
```
Builder handlers sit AFTER this — only called when status === 'executed'.

### Existing Pattern: ironclaw-service processResponse
```typescript
// Source: backend/src/ironclaw/ironclaw-service.ts (lines 163-242)
// Pattern: parse JSON → detect action_card → persist → publish WebSocket
private async processResponse(problemSetId: string, responseText: string): Promise<void> {
  let parsed: Record<string, unknown> | null = null;
  try { parsed = JSON.parse(responseText); } catch { /* plain text */ }

  // Detect action card
  let actionCard: ActionCardData | null = null;
  if (parsed?.tool_call) { /* ... */ }

  // NEW for Phase 52: detect suggestion
  // if (parsed?.suggestion) { /* embed targetField, fieldValue */ }

  const chatMsg = await ironclawStore.addMessage({ ..., action_card: actionCard });
  await publishToChannel(problemSetId, 'ironclaw.response', chatMsg);
}
```

### Existing Pattern: DB Migration (follow migration 034)
```sql
-- Source: backend/src/db/migrations/034-agent-tables.sql
-- NOTE: Run on production/staging DB after deploy — not run locally.
CREATE TABLE IF NOT EXISTS skills (
  skill_id    TEXT        PRIMARY KEY,
  skill_data  JSONB       NOT NULL,
  ...
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-memory ToolRegistry (Map) | ToolRegistry loads from memory, AgentStore persists agents to PostgreSQL | Phase 51 | Skills registry should follow AgentStore DB pattern, not in-memory Map |
| Eliza agent tools wired directly in LangChain | LangChain StructuredToolInterface wrapping via `getLangChainToolsForAgent()` | Phase 51 | MCP server is the next evolution — serves same tools over MCP protocol |
| Manual suggestion patterns (ad-hoc) | `SuggestionData` with `targetField`/`fieldValue` typed interface | Phase 51 (frontend types) | Backend needs to emit this structure — types are ready |
| One-shot chat responses (ask → answer) | Action cards with risk-tiered approval (ask → card → approve → execute) | Phase 30 | Orchestration loop extends this to multi-step: ask → task → progress → suggestions → approve → apply |
| Per-tab AI panels (AIStaffContext, DesignAIPanel) | Single Ironclaw drawer as sole AI interface | Phase 51 | Ironclaw drawer is the right surface for orchestration — it already has context (tab, PS, role) |
| Manual agent invocation via supervisor tests | Ironclaw can assign agents to problem sets and form teams | Phase 51 | Orchestration loop automates what was manual: Ironclaw dispatches, tracks, and presents results |

---

## Open Questions

1. **MCP Transport: stdio vs SSE vs HTTP Streamable**
   - What we know: `@modelcontextprotocol/sdk` supports stdio, SSE, and the newer "Streamable HTTP" transport. Ironclaw communicates with the backend via HTTP webhook.
   - What's unclear: Whether LangGraph agents in `agent-wrapper.ts` can use stdio transport (subprocess model) or need HTTP.
   - Recommendation: Use SSE transport (HTTP-based) for Phase 52 — aligns with Docker container model and doesn't require subprocess spawning. Expose MCP server on port 3334 (follows bastion port convention: 3001=backend, 3333=ironclaw).

2. **Skill DID requirement**
   - What we know: Agents get DIDs (enforced in AgentStore.registerAgent), tools get DIDs (createToolDID in ToolRegistry).
   - What's unclear: Whether skills need DIDs for smart contract authorization in Phase 52.
   - Recommendation: Omit skill DIDs in Phase 52 — skills are internal capability definitions, not external actors. DID can be added in a later phase if authorization at skill level is needed.

3. **Field write-back: problem set API target**
   - What we know: The problem set update API exists and handles field updates.
   - What's unclear: Which specific endpoints handle free-form field writes for fields like `problemStatement`, `design.cogAnalysis.friendly`.
   - Recommendation: Research the problem set PATCH/update endpoint signatures in `backend/src/api/` during plan execution (Wave 0). The handler should be `PATCH /api/problem-sets/:id/fields` or equivalent.

4. **Ironclaw response format for suggestions**
   - What we know: Ironclaw response is JSON with `tool_call`, `content`, `specialist_id` etc. parsed in `ironclaw-service.ts:processResponse`.
   - What's unclear: The exact JSON shape the Ironclaw sidecar will emit for suggestions — this requires configuring the Ironclaw system prompt to output a `suggestion` key.
   - Recommendation: Define the suggestion JSON schema in Phase 52 (e.g., `{ suggestion: { target_field, field_value, content, agent_id } }`) and update the Ironclaw system prompt accordingly.

5. **Orchestration loop: how does the Ironclaw LLM decide "this needs a task"?**
   - What we know: Currently `processResponse` detects `tool_call` for action cards. The same pattern extends to `task_request` for orchestration tasks.
   - What's unclear: Whether the Ironclaw sidecar LLM can reliably distinguish between "simple chat response" vs "needs multi-step agent work" from the system prompt alone.
   - Recommendation: Add explicit task-triggering keywords/patterns to the system prompt. Examples: "develop a COA", "analyze the center of gravity", "generate an OPORD". The LLM outputs `{ task_request: { title, description, target_fields, agent_hints } }` when it detects these. For Phase 52 MVP, also support an explicit user command like `/task develop a COA` to guarantee task creation.

6. **Orchestration loop: supervisor reuse vs per-task supervisor**
   - What we know: `BastionSupervisor` creates a compiled LangGraph StateGraph with a fixed set of agents. Creating one per task is expensive (LangGraph compilation).
   - What's unclear: Whether to use a shared supervisor singleton or create lightweight task-specific supervisors.
   - Recommendation: Create a shared supervisor per problem set (or per team) that can be reused across tasks. The `threadId` differentiates tasks within the same supervisor graph. This matches the existing `thread_id` pattern in `ironclawStore.getOrCreateSession()`.

7. **Orchestration loop: connecting supervisor output to suggestions**
   - What we know: `BastionSupervisor.execute()` returns `SupervisorOutput` with `state.messages` (LangChain BaseMessage[]) and `trace` (ExecutionTraceEntry[]). Agent responses are `AIMessage` objects.
   - What's unclear: How to extract structured field values from free-text agent responses and map them to `SuggestionData.fieldValue`.
   - Recommendation: Two approaches: (a) Agents are given a structured output schema via tools that returns `{ field_path, field_value, explanation }` — clean but requires tool definition. (b) A post-processing step asks Ironclaw LLM to parse agent output and extract field values — more flexible but adds latency. Start with (a) for Phase 52 MVP using DynamicStructuredTool output.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No dedicated test framework detected (no jest.config, vitest.config, pytest.ini found) |
| Config file | none — Wave 0 task |
| Quick run command | `cd backend && npx ts-node --esm src/mcp/mcp-server.ts --dry-run` (smoke test) |
| Full suite command | Manual integration test via `docker-compose up bastion-mcp` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-52-01 | MCP server starts and lists tools | smoke | `node dist/mcp/index.js --list-tools` | Wave 0 |
| REQ-52-01 | Agent can call tool via MCP | integration | `docker exec bastion-mcp node -e "..."` | Wave 0 |
| REQ-52-02 | Skills CRUD: create/read/assign | unit | `ts-node src/agents/skill-registry.ts` | Wave 0 |
| REQ-52-02 | Skills tab renders in AgentHub | manual | Open `/admin` → Agent Hub → Skills tab | N/A (UI) |
| REQ-52-03 | Ironclaw builder: agent.create action executes | integration | Send action card via ironclaw router, verify agent in DB | Wave 0 |
| REQ-52-04 | Field write-back: suggestion parsed and emitted | unit | Unit test `processResponse` with suggestion payload | Wave 0 |
| REQ-52-04 | Field write-back: accept writes to problem set | integration | POST accept, verify PS field updated | Wave 0 |
| REQ-52-05 | Task created from chat request | integration | Send "develop a COA" message, verify task record in DB | Wave 0 |
| REQ-52-05 | Task dispatches agents and tracks progress | integration | Create task, verify step progress messages on WebSocket | Wave 0 |
| REQ-52-05 | Task results presented as suggestion cards | integration | Complete task, verify suggestion messages in drawer | Wave 0 |
| REQ-52-05 | Approved suggestion writes to field | integration | Accept suggestion card, verify field updated via design API | Wave 0 |
| REQ-52-05 | Refinement loop re-dispatches agent | integration | Reject suggestion with feedback, verify agent re-invoked | Wave 0 |
| REQ-52-05 | Permission scoping blocks unauthorized field write | unit | Staff officer tries to approve sensitive field, verify blocked | Wave 0 |

### Wave 0 Gaps
- [ ] `backend/src/mcp/mcp-server.ts` — covers REQ-52-01
- [ ] `backend/src/agents/skill-registry.ts` + `skill-store.ts` — covers REQ-52-02
- [ ] `backend/src/ironclaw/builder-handlers.ts` — covers REQ-52-03
- [ ] `backend/src/db/migrations/038-skills.sql` — prerequisite for REQ-52-02 and REQ-52-04
- [ ] `backend/src/ironclaw/task-orchestrator.ts` — covers REQ-52-05 (core orchestration loop)
- [ ] `backend/src/ironclaw/task-store.ts` — covers REQ-52-05 (task persistence)
- [ ] `backend/src/ironclaw/task-types.ts` — covers REQ-52-05 (task state machine types)
- [ ] `backend/src/db/migrations/039-ironclaw-tasks.sql` — prerequisite for REQ-52-05
- [ ] `frontend/src/components/ironclaw/IronclawTaskPanel.tsx` — covers REQ-52-05 (task list UI in drawer)

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `backend/src/agents/tool-registry.ts` — tool registration pattern, LangChain integration
- `backend/src/ironclaw/action-registry.ts` — all 16 builder action types already registered
- `backend/src/ironclaw/ironclaw-types.ts` — `ACTION_RISK` map, risk levels, rate limits, `StepProgressData` type
- `backend/src/ironclaw/ironclaw-service.ts` — `processResponse` pattern for suggestion integration; `formTeamForTask()` for team dispatch; `buildSystemPrompt()` for Chief of Staff persona
- `backend/src/ironclaw/tool-bridge.ts` — `handleToolCall` execution gap (returns ActionResult but doesn't dispatch)
- `backend/src/ironclaw/action-pipeline.ts` — approval flow, `processAction` returns status
- `backend/src/orchestration/supervisor.ts` — `BastionSupervisor` with LangGraph StateGraph, agent routing, human checkpoints, execution trace
- `backend/src/orchestration/agent-wrapper.ts` — `LangGraphAgentWrapper.createNode()` for LangGraph-compatible agent execution
- `backend/src/orchestration/human-checkpoints.ts` — `HumanCheckpointManager` with DB persistence, approval/reject/resume, message bus notifications
- `frontend/src/context/IronclawContext.tsx` — field write event bus, `acceptSuggestion` TODO, `FieldWriteEvent` dispatch
- `frontend/src/types/ironclaw.ts` — `SuggestionData` with `targetField`/`fieldValue`, `StepProgressData` with `StepInfo[]`
- `frontend/src/components/ironclaw/IronclawStepStream.tsx` — multi-step progress stepper (fully built, renders from StepProgressData)
- `frontend/src/components/ironclaw/IronclawSuggestion.tsx` — "Apply to {field}" card with accept/dismiss (fully built)
- `frontend/src/components/ironclaw/IronclawDrawer.tsx` — main drawer UI, renders suggestions and step progress
- `backend/src/agents/standard-agent.ts` — `AgentSkill` interface with Zod schemas
- `backend/src/design/types.ts` — `OperationalDesign` with `problemFraming`, `cogAnalysis`, `linesOfEffort`, `operationalApproach`
- `backend/src/api/design.ts` — Design API routes for section CRUD
- `backend/src/api/problem-sets.ts` — `PATCH /:id` for problem set field updates
- `docker-compose.yml` — ironclaw service pattern to replicate for bastion-mcp
- `backend/src/db/migrations/034-agent-tables.sql` — migration pattern
- `frontend/src/components/admin/AgentHub.tsx` — Skills tab already stubbed as `<SkillsPlaceholder />`

### Secondary (MEDIUM confidence)
- MCP SDK naming conventions inferred from MCP protocol specification knowledge (verify package API with `@modelcontextprotocol/sdk` docs at install time)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all key dependencies either already in the project or clearly identified
- Architecture: HIGH — patterns directly observable in existing ironclaw, tool registry, and agent store code
- Orchestration loop: HIGH — all building blocks exist (Supervisor, StepProgress, Suggestions, Checkpoints, WebSocket); the gap is purely the connecting tissue (TaskOrchestrator + TaskStore)
- Pitfalls: HIGH — identified from direct code inspection (Zod serialization, ToolRegistry singleton, DB schema gaps, async task dispatch, server restart recovery)

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (30 days — stable architecture, no fast-moving external dependencies beyond MCP SDK)
