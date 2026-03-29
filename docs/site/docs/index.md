# BASTION Documentation

**Blockchain Autonomous Strategy & Tactical Intelligence Operational Network**

BASTION is a military command-and-control planning platform that integrates blockchain DAOs, 25 specialized AI agents, and NEAR blockchain for secure coalition coordination. It supports the full Joint Planning Process across the doctrinal lifecycle, from understanding the operational environment through assessing campaign outcomes — and extends to autonomous robot integration, swarm coordination, knowledge graph intelligence, and on-chain coalition caveat enforcement.

---

## Platform at a Glance

| Metric | Value |
|---|---|
| Completed development phases | 60 |
| Total plans generated | 469+ |
| AI agents (specialized, deployed) | 25 (8 LangGraph + 7 COP + 1 Ironclaw + 6 MDMP + 3 escalation) |
| Smart contract modules | 14 |
| REST API endpoints | ~572+ |
| Doctrinal tabs | 6 (Understand / Design / Plan / Decide / COP / Assess) |
| Resource type plugins | 5 |
| On-chain caveat dimensions | 5 (classification, releasability, ROE tier, geo bounds, time windows) |

---

## Core Capabilities

### Doctrinal Lifecycle

Six tabs map directly to JP 5-0 planning doctrine:

1. **Understand** -- Autonomous document intelligence, brain graph visualization, scoping interview, NATO source reliability ratings, ExtractionTheater pipeline
2. **Design** -- Center of gravity analysis, lines of effort/operation, AI-assisted design recommendations, fork-and-merge revision with DAO governance
3. **Plan** -- JPP 7-step workflow, echelon-aware routing (strategic/operational/tactical), OPORD generation, mission creation, ends-ways-means linkage
4. **Decide** -- Decision dashboard with RACI filtering, inline approve/reject/defer, PendingDecisionModal, DAO governance at decision gates, Ironclaw proactive 60-second polling
5. **COP** -- AI-generated MIL-STD-2525D SVG overlays, swarm telemetry integration, layer publish review cycle, friendly/adversary perspective toggle
6. **Assess** -- MOE/MOP tracking, training assessment loop, AAR capture, METL proficiency tracking (T/P/U), upward aggregation to readiness dashboard

### Autonomous Document Intelligence

A 10-specialist AI agent team processes uploaded documents in parallel, applying NATO source reliability ratings, building the RAFT knowledge graph, detecting contradictions, and surfacing objectives — all visible through the ExtractionTheater live pipeline.

### Knowledge Graph Brain

An adaptive force-directed neural canvas renders the full knowledge graph with JSON-LD semantic triples and ontology alignment. Entity resolution merges references across sources. Brain Timeline supports temporal reasoning. Subspaces manage graph scale for large problem sets.

### DAO Governance

A 5-tier authority model governs decision-making through on-chain proposals:

- **Tier 1** -- Individual authority (bounded scope)
- **Tier 2** -- Team-level authority
- **Tier 3** -- Organizational authority (minimum for autonomous engagement)
- **Tier 4** -- National DAO authority (strategic resource commitments)
- **Tier 5** -- Coalition strategic (100% approval for strike authorization)

### Robot Integration

A Docker-based bridge pattern connects cloud BASTION to physical robots on the local network. Python robot agents on Jetson Orin Nano provide CSI camera feeds with YOLOv8 object detection. Swarm leadership coordinates robot formations using six doctrinal formations and four movement techniques via BLE leader-spoke control with dead-reckoned positioning.

### Resource Registry with DIDs

Every resource receives a decentralized identifier (`did:near:resource-{id}`) enabling verifiable tracking, plugin-based extensibility, and cross-coalition interoperability.

### Training / Operational Mode

A global mode toggle implements the "train as you fight" doctrine. Training mode uses exercise scenarios with full platform capabilities; operational mode connects to live data sources. Training assessments are isolated from operational data.

---

## Documentation Sections

### Core Tabs

- [Understand Tab](capabilities/understand-tab.md) -- Autonomous document intelligence, brain graph, PMESII-PT analysis
- [Design Tab](capabilities/design-tab.md) -- Operational design, center of gravity analysis, lines of effort
- [Plan Tab](capabilities/plan-tab.md) -- JPP workflow, COA development, wargaming, OPORD generation
- [Decide Tab](capabilities/decide-tab.md) -- Decision dashboard, RACI filtering, DAO governance at decision gates
- [COP Tab](capabilities/cop-tab.md) -- AI-generated military symbology, swarm telemetry, layer governance
- [Assess Tab](capabilities/assess-tab.md) -- MOE/MOP tracking, training assessment loop, METL proficiency

### Expanded Capabilities

- [Resources Tab](capabilities/resources-tab.md) -- Inventory management, network device onboarding, DID registry
- [Robot Bridge](capabilities/robot-bridge.md) -- Docker bridge architecture, WebSocket command/telemetry channel
- [Robot Vision](capabilities/robot-vision.md) -- CSI camera, detectNet, mission behavior profiles
- [Swarm Behavior](capabilities/swarm-behavior.md) -- Formations, movement techniques, BLE leader-spoke control
- [Knowledge Graph](capabilities/knowledge-graph.md) -- JSON-LD brain, entity resolution, temporal reasoning

### Architecture and Infrastructure

- [System Architecture](architecture/overview.md) -- Three-tier storage, authentication, AI orchestration, and deployment
- [Core Data Model](architecture/data-model.md) -- Problem sets, documents, objectives, resources, agents, and governance
- Whitepaper -- Full technical whitepaper available in the `docs/whitepaper/` directory
