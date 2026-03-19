# Phase 52: Agent Skills & MCP - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning
**Source:** Direct user conversation

<domain>
## Phase Boundary

This phase builds three interconnected capabilities:
1. A standalone MCP (Model Context Protocol) server that agents use to access tools
2. A reusable skills registry where skills can be defined, versioned, and assigned to agents
3. Ironclaw builder capabilities — Ironclaw can create agents, tools, skills, and teams via action cards
4. Field write-back handler — backend pipeline for applying Ironclaw suggestions to problem set fields

</domain>

<decisions>
## Implementation Decisions

### MCP Server
- Standalone MCP server process (like Ironclaw — likely its own Docker container)
- Agents connect to the MCP server to execute tools during their LangGraph workflows
- Tools registered in the existing ToolRegistry should be served via MCP protocol
- Agent tool assignments control which MCP tools each agent can access
- DID-based authorization — agent DID checked against smart contract for tool permissions

### Skills Registry
- Skills are reusable capability definitions that agents can learn
- Similar to tools but higher-level — a skill composes tools, prompts, and validation into a workflow
- Each skill has a SKILL.md definition with versioning
- Skills stored in PostgreSQL with DB migration
- Admin UI tab in Agent Hub (already has placeholder)
- Skills assignable to agents like tools are
- Ironclaw can create new skills dynamically when users request new capabilities

### Ironclaw Builder Capabilities
- Ironclaw already has action types registered: agent.create, agent.update, tool.create, team.create, etc.
- Need backend handlers that execute these actions when action cards are approved
- Action card flow: user asks Ironclaw → Ironclaw generates action card → user approves → backend executes
- All CRUD operations go through existing admin API routes
- Ironclaw must have read/write access commensurate with user permissions

### Field Write-Back
- Frontend already has SuggestionData with targetField/fieldValue and event bus
- Backend needs to generate suggestions with field targets when Ironclaw produces content
- Example: user asks "suggest a problem statement" → Ironclaw responds with suggestion + targetField='problemStatement'
- On acceptance, the field value is written via problem set API
- Sensitive fields (mission statement, ROE) use 'field.write_sensitive' (high risk — requires explicit approval)

### Claude's Discretion
- MCP server implementation details (transport protocol, connection pooling)
- Skill definition schema design
- How skills compose tools internally
- MCP server health monitoring approach

</decisions>

<specifics>
## Specific Ideas

- Every agent must have a DID — enforced at AgentStore.registerAgent (already implemented in Phase 51)
- Agent creation pipeline auto-generates fixtures for validation (already implemented in Phase 51)
- MCP server should be a Docker service like `bastion-mcp` alongside bastion-backend
- Skills should have input/output schemas (Zod) like AgentSkill interface already defines
- Ironclaw action handlers should use the same admin API that the UI uses — no parallel paths
- The existing 16 Ironclaw action types (agent.create, tool.create, team.create, etc.) already have risk levels and canonical descriptions registered

</specifics>

<deferred>
## Deferred Ideas

- Skill marketplace (sharing skills between BASTION instances)
- Skill execution analytics/metrics
- Tool chaining within skills (complex multi-tool workflows)
- MCP server federation across multiple BASTION deployments

</deferred>

---

*Phase: 52-agent-skills-mcp*
*Context gathered: 2026-03-19 via direct conversation*
