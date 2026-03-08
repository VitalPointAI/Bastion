# BASTION Documentation

**Blockchain Autonomous Strategy & Tactical Intelligence Operational Network**

BASTION is a military command-and-control planning platform that integrates blockchain DAOs, 131 AI agents, and NEAR blockchain for secure coalition coordination. It supports the full Joint Planning Process across the doctrinal lifecycle, from understanding the operational environment through assessing campaign outcomes.

---

## Platform at a Glance

| Metric | Value |
|---|---|
| Completed development phases | 31 |
| Total plans generated | 292 |
| AI agents (specialized + JPP staff) | 131 |
| Smart contract modules | 12 |
| Doctrinal tabs | 6 |

---

## Core Capabilities

### Doctrinal Lifecycle

Six tabs map directly to JP 5-0 planning doctrine:

1. **Understand** -- Operational environment analysis, intelligence fusion, RAFT graph generation
2. **Design** -- Operational design with centers of gravity, lines of effort, and objectives
3. **Plan** -- COA development, wargaming, and course-of-action comparison
4. **Direct** -- Execution directives, task assignment, and resource allocation
5. **COP** -- AI-generated Common Operating Picture with real-time situational awareness
6. **Assess** -- Campaign assessment, measure tracking, and feedback loops

### AI COP Generation

AI agents automatically synthesize intelligence, operational data, and planning products into a coherent Common Operating Picture, reducing manual staff workload.

### DAO Governance

A 5-tier authority model governs decision-making through on-chain proposals:

- **Tier 1** -- Commander authority (immediate decisions)
- **Tier 2** -- Deputy/chief of staff delegation
- **Tier 3** -- Staff section approval (J1-J9)
- **Tier 4** -- Coalition partner consensus
- **Tier 5** -- Full coalition vote

### Resource Registry with DIDs

Every resource receives a decentralized identifier (`did:near:resource-{id}`) enabling verifiable tracking, plugin-based extensibility, and cross-coalition interoperability.

### Training / Operational Mode

A global mode toggle implements the "train as you fight" doctrine. Training mode uses exercise scenarios with full platform capabilities; operational mode connects to live data sources.

---

## Documentation Sections

- [System Architecture](architecture/overview.md) -- Three-tier storage, authentication, AI orchestration, and deployment
- [Core Data Model](architecture/data-model.md) -- Problem sets, documents, objectives, resources, agents, and governance
- Whitepaper -- Full technical whitepaper available in the `docs/whitepaper/` directory
