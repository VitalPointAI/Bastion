# AI Agent Architecture

BASTION deploys **131 AI agents** across five categories, orchestrated by LangGraph with PostgreSQL-backed state management and strict human-in-the-loop safety controls.

## Orchestration

Agents run as LangGraph state machines with PostgreSQL checkpoints for durable execution. Each agent maintains its own checkpoint thread, enabling pause/resume, retry, and audit replay. The checkpoint store persists full graph state including intermediate reasoning steps.

## LLM Configuration

Each agent specifies its own LLM provider and model, with system-wide defaults as fallback:

- **Provider**: Anthropic, OpenAI, or any OpenAI-compatible endpoint
- **Model**: Configurable per agent (e.g., `claude-sonnet-4-20250514` for complex reasoning, lighter models for classification)
- **Global defaults**: Applied when an agent does not declare a provider/model override

## Agent DIDs

Every agent receives a deterministic Decentralized Identifier (DID) derived from its role name and the parent DAO. DIDs provide a stable, cryptographically verifiable identity for message signing, audit attribution, and cross-DAO agent references.

## MCP Tool Registry

Agents access external capabilities through the Model Context Protocol (MCP) tool registry:

- Tools are registered with **JSON Schema** definitions for inputs and outputs
- The registry enforces schema validation on every invocation
- Tools span database queries, blockchain operations, graph traversals, and external API calls

## Secure Message Bus

Inter-agent communication runs over a **pg-boss** job queue with security controls:

| Property | Detail |
|---|---|
| Access control | ABAC-aware; messages filtered by agent role and clearance |
| TTL | 24-hour default; expired messages archived automatically |
| Dead letter queue | Failed deliveries routed for inspection and retry |
| Ordering | FIFO within priority bands |

## Human-in-the-Loop Checkpoints

All consequential agent outputs pass through human review before taking effect. The checkpoint system:

- Pauses execution at configured decision points
- Presents the proposed action with full reasoning chain
- Requires explicit human approval, rejection, or modification
- Logs the decision with the reviewer's identity for audit

## Agent Categories

| Category | Count | Purpose |
|---|---|---|
| Governance | 4 | DAO proposal screening, feasibility, and context analysis |
| Operational Planning | 14 | MDMP support, assumption auditing, compliance checking |
| Strategic Analysis | 4 | Document review, OSINT, threat monitoring, fusion |
| Graph Analysis | 7 | Entity resolution, conflict detection, RAFT extraction |
| JPP Staff | 102 | Full joint planning process staff roles (J1-J9, functional, component) |
| **Total** | **131** | |
