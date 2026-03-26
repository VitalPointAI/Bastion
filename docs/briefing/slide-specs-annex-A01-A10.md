# BASTION Briefing Deck — Slide Specifications (Annex Slides A1-A10)

**Version:** 1.1
**Date:** 2026-03-26

> Part 4 of 5 — See also: [Part 1 (1-10)](slide-specs-01-10.md) | [Part 2 (11-20)](slide-specs-11-20.md) | [Part 3 (21-25)](slide-specs-21-25.md) | [Annex A11-A17](slide-specs-annex-A11-A17.md)

---

# ANNEX SLIDES

**Purpose:** Prepared depth for Q&A. Each annex slide maps to one or more core slides. The presenter navigates to these when asked "tell me more about X." Annex slides are intentionally more technical than core slides — the audience asking for depth can handle it.

**Navigation:** Annex slides are numbered A1-A17. During Q&A, jump directly to the relevant annex slide rather than improvising. Return to Q&A slide (Slide 25) after each deep-dive.

---

## Slide A1: Visual Glossary

**Maps to core slides:** All — reference slide for the full deck

**Purpose:** Quick reference for all technical terms used in the deck. Use this when an audience member asks "wait, what does that mean?" — or hand it to the thesis advisor before the defense.

---

### Visual

Multi-column glossary layout (3 columns), organized by category with color-coded headers. Each term: bold term name + plain language definition + one-sentence relevance to BASTION. Compact typography to maximize coverage on one slide.

**Category 1 — Blockchain & Web3** (blue header)

| Term | Definition | Relevance to BASTION |
|------|-----------|----------------------|
| Blockchain | Distributed ledger — a shared record no single party can alter | Tamper-evident audit trail for every governance decision |
| DAO | Decentralized Autonomous Organization — governance encoded in software | BASTION's 5-tier command authority structure, programmatically enforced |
| Smart Contract | Self-executing program on a blockchain — rules run automatically when conditions are met | Policy enforcement: checks if an action is authorized before it happens |
| DID | Decentralized Identifier — globally unique, owner-controlled identity | Every resource, person, agent, and robot in BASTION has a DID |
| NEAR Protocol | Proof-of-stake blockchain with human-readable accounts and sub-second finality | BASTION's on-chain substrate — chosen for speed, cost, and developer ergonomics |
| TEE | Trusted Execution Environment — hardware-isolated computing environment | Attestation layer for verifying data provenance at the hardware level |
| Gas | Transaction cost on a blockchain | NEAR gas costs are fractions of a cent; not a practical constraint at prototype scale |

**Category 2 — Military Doctrine** (olive/dark header)

| Term | Definition | Relevance to BASTION |
|------|-----------|----------------------|
| C2 | Command and Control — the exercise of authority and direction by a commander | BASTION's entire purpose: AI-enabled C2 with verifiable authority chains |
| COP | Common Operating Picture — shared situational awareness across all echelons | BASTION generates COP from planning documents using AI extraction |
| MDMP | Military Decision Making Process — the Army's 7-step planning methodology | BASTION structures its planning tabs around MDMP phases |
| JPP | Joint Planning Process — the Joint Staff methodology for operational planning | BASTION's 16 deployed agents support the JPP planning structure |
| JP 5-0 | Joint Publication 5-0 — the doctrinal manual for joint operation planning | The authority reference for BASTION's operational design and planning concepts |
| COG | Center of Gravity — the source of power that provides moral or physical strength | BASTION's AI analyzes COGs and critical vulnerabilities in its Design tab |
| LOE | Line of Effort — a logical line connecting actions focused on an end state | BASTION's campaign plan organizes operations by lines of effort |
| OPORD | Operation Order — a directive issued by a commander to subordinate units | BASTION generates OPORD sections from its knowledge graph and planning inputs |
| FRAGO | Fragmentary Order — an abbreviated OPORD issued as a change to an existing order | BASTION can generate FRAGOs automatically when conditions in the COP change |
| DDIL | Degraded, Disconnected, Intermittent, Low-bandwidth — challenging comm environments | BASTION's bridge-edge architecture is designed to operate in DDIL conditions |

**Category 3 — AI & Data** (cyan header)

| Term | Definition | Relevance to BASTION |
|------|-----------|----------------------|
| LangGraph | Python framework for building stateful AI agent workflows as directed graphs | BASTION's orchestration layer for multi-step AI planning workflows |
| Knowledge Graph | Network of entities and their relationships — machine-readable situational awareness | BASTION's "brain" — stores everything known about the operational environment |
| JSON-LD | Linked Data in JSON format — a standard for interoperable machine-readable data | BASTION's knowledge graph schema format, enabling future interoperability |
| NER | Named Entity Recognition — AI technique to extract entities from text | Used to extract forces, locations, and events from planning documents |
| Confidence Scoring | Numerical measure of information reliability (0.0-1.0) | BASTION tracks confidence for every intelligence assertion in the knowledge graph |
| MIL-STD-2525D | Military standard for tactical symbols — the language of the COP map | BASTION generates these symbols programmatically from extracted entities |
| Subspace Isolation | Partitioning a shared data store by workspace to prevent data leakage | Each BASTION problem set has an isolated knowledge graph subspace |

---

## Slide A2: Knowledge Graph Deep-Dive

**Maps to core slide:** 7 (Knowledge as Infrastructure)

**Purpose:** Full technical depth on how BASTION's knowledge graph is structured, what it stores, and how it grows over time.

---

### Visual

**Diagram 1: Entity-Relationship Schema**

Detailed entity-relationship diagram showing actual node types and edge types in BASTION's knowledge graph.

Node types (circles, color-coded by category):
- Person (blue): commander, staff officer, analyst, liaison
- Organization (dark blue): unit, headquarters, coalition partner, NGO
- Location (green): geographic point, area, objective, LZ, named area of interest
- Equipment/Resource (orange): platform, system, sensor, robot, logistics item
- Event (red): incident, operation, engagement, intelligence report, decision
- Document (gray): OPORD, FRAGO, intelligence report, assessment
- Concept (purple): COG, LOE, objective, end state, center of gravity

Edge types (labeled arrows):
- COMMANDS (Person → Organization)
- LOCATED_AT (Person/Organization/Equipment → Location)
- PARTICIPATES_IN (Person/Organization → Event)
- PRODUCES (Person/Organization/Event → Document)
- REFERENCES (Document → any node)
- SUPPORTS / THREATENS (Organization → Organization)
- OWNED_BY (Equipment → Organization)
- EXTRACTED_FROM (any node → Document — provenance link)

**Diagram 2: Growth Over Time**

Timeline showing how graph density increases: T0 (upload OPORD: ~40 nodes), T1 (add intel reports: +80 nodes), T2 (add ORBAT: +60 nodes), T3 (operations begin, events ingested: ongoing growth). Annotation: "Every document uploaded adds nodes and edges. The graph is never 'complete' — it reflects current knowledge."

---

## Slide A3: Agent Architecture Deep-Dive

**Maps to core slides:** 8-9 (Agent Hub and Operational Advisors)

**Purpose:** Full agent taxonomy, orchestration architecture, and multi-model design.

---

### Visual

**Diagram 1: Agent Taxonomy Tree**

Hierarchical tree showing all agent categories and example agents under each:

```
BASTION Agent Hub (16 deployed AI agents)
├── Ironclaw: Chief of Staff Agent (1 agent)
│   ├── 60-second proactive polling loop
│   ├── Persistent memory graph (Phase 57)
│   └── Cross-tab context synthesis
│
├── LangGraph Analysis Agents (8 agents)
│   ├── IPB Agent (Intelligence Preparation of the Battlefield)
│   ├── OSINT Agent (Open Source Intelligence)
│   ├── All-Source Fusion Agent
│   ├── Threat Assessment Agent
│   ├── Mission Analysis Agent
│   ├── COA Development Agent
│   ├── Risk Assessment Agent
│   └── Operational Design Agent
│
└── COP Layer Agents (7 agents)
    ├── NER Extraction Agent
    ├── Tactical Graphic Mapping Agent
    ├── Symbol Generation Agent
    ├── Perspective Toggle Agent
    ├── Phase Filter Agent
    ├── Conflict Detection Agent
    └── Map Overlay Agent
```

**Diagram 2: LangGraph Orchestration Flow**

Sample workflow — COA Development:
```
User Request
    ↓
Orchestrator Agent (selects workflow)
    ↓
Mission Analysis Agent → outputs: Mission Statement, CCIR
    ↓
[Parallel execution]
    ├── COA Alpha Agent → COA sketch + description
    ├── COA Bravo Agent → COA sketch + description
    └── COA Charlie Agent → COA sketch + description
    ↓
COA Comparison Agent → Weighted analysis against criteria
    ↓
Risk Assessment Agent → Risk overlay for each COA
    ↓
Recommendation to J3 Staff Officer
    ↓
Human Decision Gate (MDMP Step 5: COA Approval)
```

---

## Slide A4: Ironclaw Chief of Staff Deep-Dive

**Maps to core slides:** 9-10 (Ironclaw: Your Chief of Staff), 18 (Architecture Synthesis)

**Purpose:** Full technical depth on Ironclaw's architecture — the persistent memory system, proactive polling, Chief of Staff coordination capability, and adaptive relationship development.

---

### Visual

**Diagram 1: Ironclaw Operating Cycle**

Circular diagram showing the continuous 60-second operational cycle:

```
[Poll: Every 60 seconds]
        ↓
[Analyze Context]
  - Current tab
  - Recent decisions
  - Active planning phase
  - Pending decisions surfaced
        ↓
[Query Memory Graph]
  - Commander preferences
  - Past decisions and their outcomes
  - Standing instructions
  - Patterns in behavior
        ↓
[Surface Decisions]
  - Proactive alerts to decision drawer
  - Contextual suggestions
  - Status summaries
        ↓
[User Response]
  - Approve / Reject / Modify
  - Freeform guidance
        ↓
[Memory Update]
  - Write decision to knowledge graph
  - Update preference model
  - Tag outcome for future pattern matching
        ↓
[Adapt]
  - Adjust suggestion threshold
  - Weight future suggestions by past outcomes
        ↓
[Back to Poll]
```

**Diagram 2: Persistent Memory Graph Structure**

Subgraph showing Ironclaw's memory nodes within the knowledge graph:

Node types:
- Decision (what was decided, timestamp, context)
- Preference (expressed user preference, confidence weight)
- Pattern (recurring behavior detected, frequency count)
- Standing Instruction (persistent guidance, overrides defaults)
- Outcome (follow-up observation on a past decision)

Edge types:
- INFORMED_BY (Decision → Decision — sequential reasoning chain)
- REFLECTS (Pattern → multiple Decisions)
- OVERRIDES (Standing Instruction → default behavior)
- RESULTED_IN (Decision → Outcome)

Annotation: "Auth-scoped — each commander's memory graph is isolated. Ironclaw's personality adapts per user."

---

## Slide A5: Smart Contract Architecture Deep-Dive

**Maps to core slide:** 11 (Smart Contracts as Policy), and Phase 58 on-chain caveats

**Purpose:** Full technical depth on the NEAR Rust smart contract, the `ResourceCaveats` struct, and the authorization logic.

---

### Visual

**Diagram 1: ResourceCaveats Struct (code-style layout)**

```rust
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
pub struct ResourceCaveats {
    // Access control: who can see/use this resource
    pub classification: ClassificationLevel,  // UNCLASSIFIED → TOP SECRET
    pub releasability: Vec<NationCode>,        // ["USA", "GBR", "AUS", "CAN", "NZL"]

    // Employment restrictions
    pub roe_tier: RoETier,                     // 1 (unrestricted) → 5 (strike prohibited)
    pub geo_bounds: Option<GeoPolygon>,        // Operational area restriction
    pub time_windows: Vec<TimeWindow>,         // When employment is authorized

    // Tracking
    pub caveat_version: u32,
    pub last_updated_by: AccountId,
    pub last_updated_at: Timestamp,
}
```

**Diagram 2: Authorization Check Flow**

```
Caller (agent or human) requests action on resource_did
        ↓
DID Registry Contract: check_employment_authorized(
    resource_did,
    caller_did,
    requested_action
)
        ↓
[Check classification] → caller cleared? → DENY if not
        ↓
[Check releasability] → caller nation authorized? → DENY if not
        ↓
[Check roe_tier] → requested action within ROE? → DENY if exceeds
        ↓
[Check geo_bounds] → current location within bounds? → DENY if outside
        ↓
[Check time_windows] → current time authorized? → DENY if outside window
        ↓
AUTHORIZED — return authorization token + audit record
```

All DENY branches write an immutable audit record to the blockchain before returning.

**Diagram 3: Testnet Deployment**

- Contract: `did.bastion.testnet`
- NEAR Testnet Explorer URL annotation
- Annotation: "Every call is visible — no black boxes"

---

## Slide A6: DAO Governance Mechanics Deep-Dive

**Maps to core slide:** 12 (Democratic Governance of Force)

**Purpose:** Full mechanics of the DAO proposal lifecycle, quorum rules, time constraints, and the strike authorization invariant.

---

### Visual

**Diagram 1: Proposal Lifecycle Flowchart**

```
Commander / Staff Officer submits Proposal
    ↓
[Proposal Created On-Chain]
  - Proposal type (personnel, mission, strike, etc.)
  - Requesting authority tier
  - Voting period duration (configurable per tier)
  - Required quorum percentage
    ↓
[Voting Period Opens]
  - Eligible voters notified (determined by tier membership)
  - Each vote recorded as immutable blockchain transaction
  - Running tally visible in real-time
    ↓
[Quorum Check at Deadline]
  ├── Quorum NOT reached → EXPIRED (proposal fails)
  └── Quorum reached → TALLY VOTES
        ↓
  [Simple Majority?]
  ├── No → REJECTED (audit record written)
  └── Yes → APPROVED
        ↓
  [Execute Proposal]
  - Smart contract executes associated action automatically
  - Audit record: who voted, how, timestamp, outcome
```

**Table: Quorum Rules by Tier**

| Tier | Name | Quorum | Voting Period | Example Action |
|------|------|--------|---------------|----------------|
| Tier 1 | Theater Command | 1 vote (senior commander) | 72 hours | Theater-level mission assignment |
| Tier 2 | Operational HQ | 3 of 5 eligible voters | 48 hours | Operational-level COA selection |
| Tier 3 | Tactical Command | 2 of 3 eligible voters | 24 hours | Tactical mission authorization |
| Tier 4 | Unit/Element | 1 vote (unit commander) | 12 hours | Unit-level task assignment |
| Tier 5 | Coalition | All contributing nations | 96 hours | Cross-national strike authorization |

**Special Rule: Strike Authorization Invariant**
Highlighted box: "Lethal strike authorization requires explicit affirmative vote at the responsible Tier. No agent, no automation, and no default can generate a strike authorization. The chain must be affirmative all the way down."

---

## Slide A7: DID Registry and Coalition Caveats Deep-Dive

**Maps to core slide:** 13 (Every Entity Has an Identity)

**Purpose:** Full technical depth on BASTION's DID specification, the five plugin types, on-chain vs. off-chain storage, and coalition information sharing.

---

### Visual

**Diagram 1: DID Lifecycle**

```
Resource/Person/Agent identified
        ↓
[DID Created]
  Format: did:near:{account_id}#{resource_suffix}
  Examples:
    did:near:bastion.testnet#resource-uav-1
    did:near:alice.near#personnel-alice
    did:near:docker-bridge.bastion.testnet#agent-ironclaw
        ↓
[DID Registered On-Chain]
  - DID Document stored in DID Registry contract
  - Owner account set (controls updates)
  - Public key associated
        ↓
[Caveats Attached]
  - ResourceCaveats struct written to chain
  - Classification, releasability, ROE tier set
  - Coalition nations noted in releasability array
        ↓
[In Operation]
  - Any authorization query references the DID
  - Smart contract returns caveats for enforcement
  - All queries logged in transaction history
        ↓
[Update Caveats]
  - Only owner account can update
  - Caveat version incremented
  - Change recorded as on-chain transaction
        ↓
[Decommission]
  - DID marked inactive in registry
  - Historical record preserved (immutable blockchain)
```

**Table: Five Plugin Types**

| Plugin Type | Examples in BASTION | DID Structure | Key Caveats |
|-------------|-------------------|--------------|-------------|
| Hardware | Robot (Jetson Orin Nano + RVR+), Sensor, Platform | `#hardware-{serial}` | ROE tier, geo bounds, operational window |
| Software | BASTION instance, Agent module, Planning workflow | `#software-{module}` | Classification level, authorized users |
| Personnel | Commander, Staff officer, Analyst, Liaison | `#personnel-{id}` | Clearance level, releasability to coalitions |
| Data | Intelligence report, OPORD, FRAGO, Assessment | `#data-{document_hash}` | Classification, originator nation, releasability |
| Composite | Joint task force (personnel + equipment + data) | `#composite-{group_id}` | Inherits most restrictive caveat from members |

**Diagram 2: Coalition Sharing Example (Five Eyes)**

```
USA generates intelligence document
  → DID: did:near:usa.bastion.testnet#data-intel-2026-04-001
  → Classification: SECRET
  → Releasability: ["USA", "GBR", "AUS", "CAN", "NZL"]

AUS requests access:
  check_employment_authorized("did:...intel-2026-04-001", "did:...aus-analyst", "READ")
  → Check: AUS in releasability array ["USA","GBR","AUS","CAN","NZL"] → TRUE
  → AUTHORIZED

UNKNOWN_NATION requests access:
  → Check: UNKNOWN_NATION not in releasability array → FALSE
  → DENIED (audit record written)
```

---

## Slide A8: Robot Integration Deep-Dive

**Maps to core slide:** 14 (Physical Autonomous Execution)

**Purpose:** Full technical depth on the Docker bridge architecture, Python agent design, Jetson Orin Nano vision pipeline, and DAO-governed engagement chain.

---

### Visual

**Diagram 1: Three-Tier Architecture (detailed)**

```
TIER 1: CLOUD — BASTION Application
┌─────────────────────────────────────────────────────────────────┐
│  BASTION Frontend (React)  ←→  Backend (Node/TypeScript)        │
│  Ironclaw (Chief of Staff coordination)                         │
│  DAO Governance (proposal voting)                               │
│  Knowledge Graph (Neo4j)                                        │
│  DID Registry (NEAR smart contract)                             │
└─────────────────┬───────────────────────────────────────────────┘
                  │  REST API + WebSocket (HTTPS / WSS)
                  │  (persistent connection, command queue)
                  │
TIER 2: BRIDGE — Docker Container (local network)
┌─────────────────┴───────────────────────────────────────────────┐
│  Docker bridge container                                        │
│  Python agent: receives commands from cloud                     │
│  Command proxy: validates, translates, forwards                 │
│  Authority check: confirms DAO authorization before forwarding  │
│  Status aggregator: collects telemetry from edge, reports up    │
│  Offline buffer: queues commands during DDIL conditions         │
└─────────────────┬───────────────────────────────────────────────┘
                  │  MQTT (pub/sub) + HTTP REST
                  │  (tolerant of DDIL, reconnects automatically)
                  │
TIER 3: EDGE — Jetson Orin Nano + RVR+
┌─────────────────┴───────────────────────────────────────────────┐
│  Jetson Orin Nano (compute)                                     │
│  ├── Computer vision pipeline (YOLOv8 inference)                │
│  ├── Object detection / classification                          │
│  ├── Threat identification (within ROE constraints)             │
│  └── Status reporting (telemetry, BDA)                          │
│                                                                 │
│  Sphero RVR+ (mobility platform)                                │
│  ├── Motor control (differential drive)                         │
│  ├── IR sensors (obstacle avoidance)                            │
│  └── Camera feed (to Jetson for vision processing)              │
└─────────────────────────────────────────────────────────────────┘
```

**Table: Six Doctrinal Swarm Formations**

| Formation | Visual | Tactical Purpose | When Used |
|-----------|--------|-----------------|-----------|
| Line | → → → | Maximum frontage coverage | Area clearance, screening |
| Wedge | ↗ → ↘ | Lead element with flank protection | Movement to contact |
| Column | ↑ ↑ ↑ | Minimizes exposure, maximizes speed | Movement through restricted terrain |
| Diamond | ↑ ← → ↓ | 360-degree security | Stationary security, uncertain threat |
| Echelon | ↗ ↗ ↗ | Oblique movement, mass on one flank | Flanking maneuver |
| Stagger | ↗↘↗↘ | Reduces vulnerability to linear threats | Movement under fire |

---

## Slide A9: COP Generation Deep-Dive

**Maps to core slide:** 15 (AI Common Operating Picture)

**Purpose:** Full pipeline for how BASTION generates COP symbols from planning documents using AI extraction.

---

### Visual

**Diagram 1: COP Generation Pipeline**

```
Input: Planning Document (OPORD, Intel Report, SITREP)
        ↓
[NLP Pre-processing]
  - Document chunking
  - Language normalization
  - Sentence boundary detection
        ↓
[Named Entity Recognition (NER)]
  - Extract: unit names, personnel, locations, equipment
  - Tag entity type and context
  - Assign initial confidence score
        ↓
[Relationship Extraction]
  - Identify COMMANDS, LOCATED_AT, PARTICIPATES_IN relationships
  - Link entities to previously known graph nodes (coreference)
  - Merge with existing knowledge graph
        ↓
[Tactical Graphic Mapping]
  - Entity type → MIL-STD-2525D symbol code
  - Affiliation from context (friendly / hostile / neutral / unknown)
  - Size indicator from unit echelon mention
  - Function indicator from unit type
        ↓
[SVG Symbol Generation]
  - Generate MIL-STD-2525D compliant SVG per entity
  - Annotate with unit designation, status, confidence score
        ↓
[Map Overlay]
  - Geocode locations to lat/lon coordinates
  - Place symbols on map
  - Link symbol to knowledge graph node (click → entity detail)
        ↓
COP: Live tactical map with selectable, linked symbols
```

**Diagram 2: COP Filters**

Two filter controls shown:
1. Perspective Toggle: [Friendly View] / [Adversary View] / [Full Picture] — controls which affiliation symbols are visible
2. Phase Slider: [Competition] → [Crisis] → [Day 4] → [Day 10] → [Day 22] → [Negotiation] — filters symbols by temporal phase tag

---

## Slide A10: Security Architecture Deep-Dive

**Maps to core slide:** 17 (Verifiable Zero Trust)

**Purpose:** Full technical depth on BASTION's five-layer verification model and the technologies at each layer.

---

### Visual

**Diagram: Five-Layer Verification Model (detailed)**

Concentric rings, center = verified action, working outward:

**Layer 1 (outermost): AI Advisory**
- Technology: LangGraph agent outputs with confidence scores
- Role: Recommends actions based on situational awareness and operational context
- Verification mechanism: Human review required before any consequential action
- Question answered: Is this recommendation coherent and contextually appropriate?

**Layer 2: DAO Governance**
- Technology: NEAR smart contracts (voting mechanism)
- Role: Collective authority validation — required votes at each tier
- Verification mechanism: On-chain vote tally, quorum check, time bounds
- Question answered: Has the appropriate authority structure approved this action?

**Layer 3: Smart Contract Policy**
- Technology: `check_employment_authorized()` in DID Registry contract
- Role: Per-resource rule enforcement — caveat check before employment
- Verification mechanism: Sequential caveat field checking, denial with reason code
- Question answered: Do the resource's caveats permit this specific action?

**Layer 4: Blockchain Proof**
- Technology: NEAR Protocol transaction history (immutable ledger)
- Role: Tamper-evident audit log of all governance decisions and caveat changes
- Verification mechanism: Public blockchain — verifiable by any party
- Question answered: Was this authorization actually granted, and when, by whom?

**Layer 5 (innermost): TEE Attestation** *(Design goal — not yet implemented)*
- Technology: Intel SGX/TDX, Phala Network (design concept)
- Role: Hardware-level verification that intelligence data originates from attested sources
- Verification mechanism: Remote attestation — cryptographic proof of execution environment
- Question answered: Was this intelligence generated in a trusted, unmodified environment?

**Four Questions Framework (mapped to layers)**

| Question | Answered By | Layer |
|----------|-------------|-------|
| Is the data authentic? | Blockchain proof + TEE (design) | Layer 4/5 |
| Is the device trusted? | TEE attestation (design) | Layer 5 |
| Is the operator authorized? | DAO governance + smart contract | Layer 2/3 |
| Is the action within bounds? | Smart contract caveats + ROE check | Layer 3 |

---

> Navigation: [Part 1 (1-10)](slide-specs-01-10.md) | [Part 2 (11-20)](slide-specs-11-20.md) | [Part 3 (21-25)](slide-specs-21-25.md) | **Annex A1-A10** | [Annex A11-A17](slide-specs-annex-A11-A17.md)
