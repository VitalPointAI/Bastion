# Phase 39: Operational Demonstration Data Package - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a comprehensive, reusable data package that populates BASTION with realistic operational content following the Pacific Strategy AY26 exercise arc. The package enables end-to-end platform demonstrations for military stakeholders and academic/wargaming audiences. This phase creates DATA and SCRIPTS — no new platform features.

</domain>

<decisions>
## Implementation Decisions

### Audience & Narrative
- Primary audience: military stakeholders + academic/wargaming (war college faculty, students, exercise planners)
- Data tells a coherent operational story following the Pacific Strategy AY26 arc: Competition → Crisis → Conflict Day 4/10/22 → Negotiation
- All 6 exercise phases populated with data
- Demo shows both training mode AND operational mode, demonstrating the Phase 22 transition concept
- AI content: pre-seeded polished outputs for the walkthrough path, plus live agent invocations available for Q&A / ad-hoc exploration

### Scenario Scope & Depth
- Full Pacific Strategy AY26 scenario — all 6 phases
- Problem set hierarchy: 3 levels deep (Theater campaign → Component plans → Tactical missions)
- Example: INDOPACOM campaign → JTF-West plan → individual strike/logistics missions
- RAFT graph: 15-25 actors (core state actors: US, China, Taiwan, Japan, Philippines, Australia + key non-state actors and institutions)
- Real-world unit designations and geography (USS Ronald Reagan, 3rd MEF, PLA Eastern Theater Command, etc.)

### Data Coverage — All Must-Have
- **Problem set hierarchy + inheritance**: Theater → Component → Tactical with Phase 38 inheritance (change notifications, override tracking, FRAGO propagation, upward status reporting)
- **RAFT graph + OSINT events**: 15-25 actor network with relationships and tensions. 20-30 OSINT events (3-5 per exercise phase across DIME domains) linked to objectives for trend analysis and validity scoring
- **Doctrinal tabs content**: Understand/Design/Plan/Direct/COP/Assess tabs populated with phase-appropriate content showing JP 5-0 planning workflow
- **AI agent analysis products**: Pre-seeded outputs from strategic fusion, entity resolution, adversary modeling, escalation modeling, assumption auditing agents
- **DAO governance artifacts**: Decision gates with recorded votes, commander approvals, and audit trails — essential to show blockchain governance value proposition
- **Documents**: Include sample PDFs/docs (strategy docs, OPORDs, intelligence reports) that get ingested by strategy document reviewer agent, showing full document → objectives → fusion pipeline

### Delivery Format
- Modular per-feature scripts: seed-problem-sets.sh, seed-graph.sh, seed-osint.sh, seed-documents.sh, seed-agents.sh, seed-governance.sh
- Master orchestrator: scripts/seed-demo.sh runs all modular scripts in dependency order with `--reset` flag for clean teardown + rebuild
- Idempotent upsert pattern — safe to re-run multiple times without duplicating data
- Demo data fixtures stored in scripts/demo-data/ with subfolder per feature (graph/, osint/, documents/, etc.)
- Builds on existing seed-graph-data.sh curl + cypher-shell pattern

### Cleanup & Reusability
- All seeded records tagged with `source: demo-seed` marker (extends existing `x-did: seed-script` pattern)
- Cleanup script queries by tag and deletes — never touches user-created data
- Master orchestrator `--reset` flag handles full teardown before re-seeding
- Designed for repeated demo runs — one command to reset and repopulate

### Demo Management UI (Deferred)
- Admin page controls for starting/pausing/ending/cleaning up demos — future phase
- Easy interface to manage demo lifecycle without CLI

### Claude's Discretion
- Exact OSINT event content and timing distribution across phases
- Specific relationships and tension intensities in the RAFT graph
- AI agent output content quality and formatting
- Document templates and sample content structure
- Order of operations within the master orchestrator
- Error handling and retry logic in seed scripts

</decisions>

<specifics>
## Specific Ideas

- Data must be cleanable — system shouldn't be cluttered with demo data after use
- Demo should be easily repeatable for multiple runs
- Real unit designations for military credibility (USS Ronald Reagan, 3rd MEF, PLA Eastern Theater Command)
- Show the training → operational mode transition as a demo highlight
- Pre-seeded AI outputs for predictable walkthrough, live agents for ad-hoc Q&A
- Pacific Strategy AY26 scenario PDFs already exist in /scenario/ directory — leverage these as source material

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/seed-graph-data.sh`: Existing seed script for Indo-Pacific actors/relationships via curl + cypher-shell. Pattern to extend.
- `scripts/seed-positions.ts`: Exercise positions seeder — TypeScript pattern available
- `backend/src/agents/langgraph/agent-seeder.ts`: Auto-registers 19+ AI agents on startup. Agents already registered — need to seed their OUTPUT products.
- `backend/src/agents/langgraph/staff-agent-seeder.ts`: JPP staff agent registration
- `scenario/` directory: Full Pacific Strategy AY26 content — blue team, red team, 6 scenario phases with PDFs

### Established Patterns
- API seeding via curl against `http://localhost:3001/api/` endpoints (seed-graph-data.sh)
- Neo4j direct access via `docker exec bastion-neo4j cypher-shell` (seed-graph-data.sh)
- DID-based ownership: `x-did: seed-script` header for identifying seeded data
- Problem sets API at `/api/problem-sets`
- Graph API at `/api/graph`

### Integration Points
- Backend API endpoints: problem-sets, graph, documents, agents, assessment, design, command, exercise, inheritance
- Neo4j graph database for RAFT actor network
- PostgreSQL for problem sets, documents, objectives, OSINT events, governance
- Document upload/processing pipeline via strategy document reviewer agent
- Training/operational mode toggle (Phase 22)
- Inheritance system (Phase 38) — parent-child propagation between problem set levels

</code_context>

<deferred>
## Deferred Ideas

- Demo management admin UI (start/pause/end/cleanup from admin page) — future phase

</deferred>

---

*Phase: 39-operational-demonstration-data-package*
*Context gathered: 2026-03-08*
