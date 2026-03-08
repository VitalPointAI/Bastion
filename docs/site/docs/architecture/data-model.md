# Core Data Model

This page describes the primary entities in BASTION and their relationships.

---

## Problem Sets

Problem sets (formerly called workspaces) are the top-level organizational unit for all planning activity. Each problem set scopes a strategic or operational problem and contains all associated documents, objectives, COAs, and AI agent outputs.

| Field | Description |
|---|---|
| `id` | Unique identifier |
| `name` | Descriptive title (e.g., "Indo-Pacific Contingency AY26") |
| `echelon` | Command echelon level (planned: strategic environment inheritance from parent to child) |
| `mode` | Training or operational |
| `created_at` | Timestamp |

**Planned**: Echelon-aware inheritance will allow parent problem sets to push strategic context (objectives, constraints, assumptions) down to subordinate problem sets, mirroring how higher headquarters frames lower-echelon planning.

---

## Documents and Strategic Intelligence

Documents are ingested into the platform and processed through an NLP pipeline that extracts entities, relationships, and key themes for RAFT graph construction.

| Field | Description |
|---|---|
| `id` | Unique identifier |
| `problem_set_id` | Owning problem set |
| `title` | Document title |
| `content` | Full text or IPFS reference for large files |
| `doc_type` | Category (intelligence report, OPORD, OPLAN, policy, etc.) |
| `raft_processed` | Whether RAFT extraction has completed |

Extracted entities and relationships are stored in Neo4j, linked back to source documents for provenance tracking.

---

## Objectives, COAs, and Planning Products

### Objectives

Objectives represent desired end states or conditions, linked to lines of effort and centers of gravity from the operational design.

### Courses of Action (COAs)

COAs are developed by AI staff agents and human planners during the Plan phase. Each COA includes:

- Scheme of maneuver or scheme of action
- Task organization
- Risk assessment
- Decision points and branches/sequels
- Wargaming results and comparison scores

### Planning Products

Outputs such as OPORDs, FRAGOs, synchronization matrices, and decision support templates are generated collaboratively by AI agents and human staff.

---

## Resources

Resources represent personnel, equipment, units, and capabilities tracked through the platform. Each resource receives a decentralized identifier for cross-system interoperability.

| Field | Description |
|---|---|
| `id` | Internal identifier |
| `did` | Decentralized identifier (`did:near:resource-{id}`) |
| `name` | Resource name |
| `type` | Plugin-defined type (unit, equipment, capability, facility, etc.) |
| `attributes` | JSON attributes specific to the resource type |
| `status` | Availability and readiness state |

The plugin architecture allows new resource types to be defined without schema changes. Each plugin registers its type, validation rules, and UI components.

---

## AI Agents and Teams

BASTION deploys 131 AI agents organized into two categories:

| Category | Count | Description |
|---|---|---|
| Specialized agents | 31 | Purpose-built for specific capabilities (COP generation, wargaming, assessment, etc.) |
| JPP staff agents | 102 | Mapped to Joint Planning Process staff roles across J1-J9 directorates |

Each agent record includes:

- **Role**: Staff function and doctrinal responsibility
- **Model config**: LLM provider, model name, temperature, and token limits
- **Tools**: Available function-calling tools (database queries, graph lookups, document retrieval)
- **Team**: Staff section assignment (J1 Personnel, J2 Intelligence, J3 Operations, etc.)

Agents are registered in a LangGraph registry and invoked through workflow graphs that coordinate multi-agent collaboration.

---

## DAO Proposals and Governance

On-chain governance manages planning decisions through a proposal lifecycle:

```
Draft -> Submitted -> Voting -> Approved/Rejected -> Executed
```

| Field | Description |
|---|---|
| `id` | Proposal identifier |
| `authority_tier` | Required approval tier (1-5) |
| `proposer` | NEAR account of the proposing user or agent |
| `action` | What the proposal authorizes (approve COA, allocate resources, etc.) |
| `quorum` | Minimum votes required, varies by tier and coalition composition |
| `votes_for` / `votes_against` | Current tally |
| `status` | Current lifecycle state |

Coalition governance adds cross-organization voting where partner nations or agencies hold weighted votes based on contribution and stake.

---

## Exercise Scenarios

Scenarios structure training exercises with phased progression:

| Field | Description |
|---|---|
| `id` | Scenario identifier |
| `name` | Exercise name (e.g., "Pacific Strategy AY26") |
| `phases` | Ordered list of scenario phases |
| `current_phase` | Active phase for the exercise |

Each phase defines the operational context, injects, and conditions that drive planning activity. The Pacific Strategy AY26 scenario, for example, includes six phases: Competition, Crisis, Conflict Day 4, Conflict Day 10, Conflict Day 22, and Negotiation.
