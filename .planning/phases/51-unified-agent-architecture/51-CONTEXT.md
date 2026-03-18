# Phase 51: Unified Agent Architecture - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning
**Source:** Conversation with project owner

<domain>
## Phase Boundary

Rearchitect BASTION's fragmented agent system into a unified, coherent ecosystem. This phase delivers:
1. A standard agent template that all agents are built from
2. An admin dashboard for agent lifecycle management
3. A team designer for composing agent teams
4. Ironclaw as the sole AI interface, replacing all scattered AI panels

Also: Upgrade Ironclaw to latest version as part of the consolidation.

</domain>

<decisions>
## Implementation Decisions

### Standard Agent Template
- Every agent (governance, doc-intel, escalation, etc.) uses ONE base class
- Each agent gets: identity, persistent memory, skills, tools, model config, validation/health
- Memory model: long-term knowledge, working memory, episodic memory (past task summaries)
- Memory persisted to PostgreSQL with semantic recall (vector embeddings)
- Agents must actually execute — no more stub agents that silently do nothing
- Skills are defined capabilities with input/output schemas
- Tools are MCP tools bound per-agent

### Agent Admin Dashboard
- Full CRUD interface for creating/editing agents with all config fields
- Health monitoring: last invocation, success rate, avg response time, validation score
- Activate/deactivate toggle with health gates
- Memory viewer: browse what agent has learned, delete entries
- Tool assignment interface
- Test harness: send test prompt, view output, validate against schema
- Located at /admin/agents (extend existing admin panel)

### Team Designer
- Drag-and-drop agent composition into teams
- Designate leader/orchestrator per team
- Define team workflow (order, parallelism, checkpoints)
- Team testing against test scenarios
- Assign team to problem sets
- Located at /admin/teams (extend existing admin panel)

### Ironclaw Consolidation
- Ironclaw becomes the ONLY AI interface in the application
- Remove AIStaffContext entirely
- Remove per-tab AI panels (DesignAIPanel, etc.)
- Ironclaw can assign/unassign agents or teams to any task
- Context-aware: knows current tab, problem set, user role
- Ironclaw delegates work — doesn't do it all itself
- Single Ironclaw panel available everywhere (drawer or sidebar)
- Upgrade Ironclaw to latest version

### Salvage vs Replace
- KEEP: LangGraph orchestration, supervisor, classification filter, human checkpoints, LLM factory, tool registry, Ironclaw service, action registry, doc-intelligence orchestrator
- REWRITE: Agent registry (→ DB-backed), team registry (→ DB-backed), executor (→ standard path)
- REMOVE: AIStaffContext, per-tab AI panels, 9+ stub agents, dead hooks, narrative-synthesis, loe-gap-analysis, message-handlers

### Claude's Discretion
- Database schema for agent_memory table (vector storage approach)
- Migration strategy for existing agents to new template
- Specific Ironclaw version to upgrade to
- Whether to use pgvector or application-level similarity
- Agent health check implementation details
- WebSocket vs SSE for real-time agent status updates in dashboard

</decisions>

<specifics>
## Specific Ideas

- Agent memory should support semantic recall (not just keyword matching)
- Health dashboard should show at-a-glance status for all agents
- Team designer should visualize the workflow as a graph/pipeline
- Ironclaw context-awareness: automatically adjusts behavior based on which tab user is on
- Feature flag for gradual rollout: IRONCLAW_SOLE_INTERFACE=true

</specifics>

<deferred>
## Deferred Ideas

- Agent-to-agent direct messaging (keep orchestrated via supervisor for now)
- Agent marketplace / plugin system
- Multi-tenant agent isolation
- Agent training/fine-tuning from episodic memory

</deferred>

---

*Phase: 51-unified-agent-architecture*
*Context gathered: 2026-03-18 via conversation*
