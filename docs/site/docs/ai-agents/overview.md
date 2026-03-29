# AI Agent Architecture

BASTION deploys **25 specialized AI agents** across five functional categories, orchestrated by LangGraph with PostgreSQL-backed state management and strict human-in-the-loop safety controls. The 25 agents comprise 8 LangGraph analysis specialists, 7 COP layer agents, 6 MDMP governance agents, 3 escalation and competition modeling agents, and Ironclaw (Chief of Staff). An additional conceptual layer of JPP staff role templates enables Ironclaw to adapt its behavior per-role context without requiring 102 separate agent processes.

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
| LangGraph Analysis | 8 | Document intelligence, OSINT, threat monitoring, entity resolution, fusion, strategic analysis |
| COP Layer | 7 | MIL-STD-2525D symbol generation, entity linking, layer governance, perspective rendering |
| MDMP Governance | 6 | Assumption Auditor, Orders Validator, Uncertainty Quantifier, Data Bias Detector, Problem Framing, ROE Compliance |
| Escalation & Competition | 3 | Adversary Modeler (MLCOA/MDCOA), Escalation Modeler, Effect Cascader |
| Chief of Staff | 1 | Ironclaw — role-adaptive coordinator spanning all JPP staff functions with persistent memory |
| **Total Deployed** | **25** | |

> **Note:** Earlier versions of this documentation referenced 131 agents, which included 102 JPP staff role templates. These templates are now implemented as role-adaptive context configurations within Ironclaw rather than as 102 separate agent processes. The 25-agent count reflects actually deployed, persistent agent processes.
