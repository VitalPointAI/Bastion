# BASTION Briefing Deck — Slide Specifications (Slides 11-20)

**Version:** 1.1
**Date:** 2026-03-26

> Part 2 of 5 — See also: [Part 1 (1-10)](slide-specs-01-10.md) | [Part 3 (21-25)](slide-specs-21-25.md) | [Annex A1-A10](slide-specs-annex-A01-A10.md) | [Annex A11-A17](slide-specs-annex-A11-A17.md)

---

## Slide 11: Smart Contracts as Policy Enforcement

### Purpose
First governing decisions slide. Show how NEAR smart contracts transform written policy into executable code. The concrete mechanism — the `check_employment_authorized()` function — proves this is implemented, not theorized. Plain language framing first: "Every enforcement decision is written into a permanent, tamper-proof record" before introducing the technical term "immutable audit trail."

### Visual Layout
Left side (45%): Title "Policy as Code — Not Paper" in blue (#2563EB), 24pt. Below: a flow diagram (see Diagram Spec) showing the enforcement chain. Right side (55%): A code reference block showing the `check_employment_authorized()` function with its five caveat checks. Below the code block: three capability points:
- "Immutable audit trail — every enforcement decision permanently recorded on NEAR blockchain — cryptographically tamper-proof"
- "Automatic enforcement — no operator can override a smart contract gate; the mathematics of the blockchain enforce it regardless of intent or urgency"
- "Coalition verification — coalition partners can verify any enforcement decision independently without trusting BASTION's word"

### Image Prompt
No AI image — code reference and diagram carry the argument.

### Diagram Spec
Left panel flow diagram (vertical):

1. **Policy Decision** [blue block #2563EB] — "Commander authorizes: asset employed only within Pacific AOR, classification SECRET, FVEY releasable"
2. Arrow down ↓ [cyan #06B6D4]
3. **Smart Contract** [cyan block #0EA5E9] — "check_employment_authorized() called at execution time"
4. Arrow down ↓ [cyan]
5. **Five Caveat Checks** [nested gray block #F8FAFC with five sub-rows]:
   - "Classification level — asset is SECRET → requester must hold SECRET"
   - "Releasability — asset is FVEY only → requester must be FVEY partner"
   - "ROE tier — asset requires Tier 3 authority → requesting action must have Tier 3 approval"
   - "Geographic bounds — asset limited to Pacific AOR → action must be within bounds"
   - "Time window — asset valid until 0600Z → action must be within time window"
6. Arrow down ↓ [cyan]
7. **Result** [two branches]:
   - [Green #16A34A block] "AUTHORIZED — execution proceeds"
   - [Red #DC2626 block] "DENIED — reason logged on-chain"
8. Arrow down to both ↓ [cyan]
9. **Immutable Audit Log** [cyan block #0EA5E9] — "NEAR blockchain — permanent record"

Right panel: code reference display (monospace font, gray #F8FAFC background, 10pt):
```
check_employment_authorized(
  resource_id: ResourceId,
  requester_did: DID,
  action_context: ActionContext
) → Result<bool, CaveatError>

Checks:
• Classification ≤ requester clearance level
• Releasability includes requester's nation
• ROE tier ≤ authorized action tier
• Action location within geo_bounds
• Current time within time_window

All decisions logged to NEAR ledger
— tamper-proof, permanent, auditable
```

---

## Slide 12: DAO Authority Levels — Five Tiers

### Purpose
Show the five-tier authority model with the robot autonomy example — the payoff of the opening demo. The robot stopped and asked for permission in the demo. This slide explains why. The five tiers are concrete, the strike invariant is concrete, and the delegation mechanism is concrete. This slide should feel like the "aha moment" for the defense evaluators in the audience.

### Visual Layout
Left side (45%): Five-tier pyramid diagram (see Diagram Spec). Right side (55%): Title "The Authority Architecture" in blue (#2563EB), 24pt. Below: three elements:
1. **Strike Authorization Invariant** — a red-bordered callout box: "Tier 3 minimum (organizational authority) is required for any autonomous engagement. This invariant cannot be overridden by any operator, configuration, or operational urgency. It is enforced by smart contract."
2. **Robot Delegation Example** — a short narrative: "The robot in the opening demo was delegated Tier 5 authority (autonomous, policy-bounded). When it identified an engagement opportunity that required Tier 3 authorization, it could not proceed. It stopped. It requested authority escalation through the DAO governance chain. It waited."
3. **Dynamic Delegations** — a brief callout: "Authority delegations are not static. A commander can grant expanded delegation for a time-limited mission window. That delegation records on-chain and expires automatically."

### Image Prompt
No AI image — the pyramid diagram carries the visual argument.

### Diagram Spec
Five-tier stacked pyramid or block diagram. White background. Five horizontal tiers of decreasing width from bottom (widest) to top (narrowest), representing increasing authority level.

Tiers from bottom to top:
1. **Tier 1 — Individual Operator** [widest, light blue #DBEAFE] — label: "Individual authorization" — annotation: "Personal access, own resources, own actions only"
2. **Tier 2 — Team / Unit** [sky blue #BAE6FD] — label: "Team authorization" — annotation: "Unit-level resources and actions"
3. **Tier 3 — Organizational** [blue #93C5FD] — label: "Organizational authority" — annotation: "MINIMUM for autonomous engagement authorization" — [bold red border on right edge of this tier]
4. **Tier 4 — National** [deeper blue #60A5FA] — label: "National DAO authority" — annotation: "Strategic resource commitment"
5. **Tier 5 — Coalition Strategic** [darkest blue #2563EB, white text] — label: "Coalition DAO — unanimity" — annotation: "Strike authorization: 100% coalition threshold"

Right side annotation: Vertical bracket spanning Tiers 1-2 with label "Robot Tier 5 delegation boundary" and an arrow pointing left with notation "Robot operating here — paused at this line."

A small robot icon (geometric, minimal) positioned at the Tier 1/Tier 2 boundary with an upward arrow labeled "Authority request escalated" pointing toward Tier 3.

Dimensions: pyramid approximately 300px wide at base, 150px tall. Each tier 30px tall. Clean, sharp edges.

---

## Slide 13: Decentralized Identity + Coalition Caveats

### Purpose
Show DIDs as the identity foundation for coalition trust. Every resource, every agent, every person has a DID. Caveats travel with the identity — not with the access control list that can be bypassed. The Five Eyes example grounds this in a real coalition context. This is the slide that makes the DID concept concrete for a defense audience that may never have heard the term.

### Visual Layout
Left side (50%): DID anatomy diagram (see Diagram Spec). Right side (50%): Title "Identity That Travels With the Resource" in blue (#2563EB), 24pt. Below: Five Eyes example callout box (light blue background #EFF6FF):

"Scenario: Australia shares satellite imagery of PLAN naval disposition near the Taiwan Strait. The imagery is assigned DID: did:near:resource-{uuid}. Attached caveats:
- Classification: SECRET
- Releasability: FVEY (Five Eyes partners only — AUS, CAN, NZL, GBR, USA)
- ROE tier: Tier 3 required for employment
- Geographic bounds: Pacific AOR (bounding box: 15°N to 45°N, 115°E to 180°E)
- Time window: Valid 72 hours from 0300Z 12 March 2026

Any system in any partner nation that requests to use this resource will have its authorization automatically checked against these five conditions. No human gatekeeping required. No email to the Australian liaison. No risk that the caveats are lost when the document is forwarded."

Below the callout: three capability points:
- "Caveats travel with the resource identity — not with access control lists that can be modified"
- "Coalition partners verify independently — without trusting BASTION's word — because the enforcement is on the blockchain"
- "5 plugin types: Persons, Materials, Agents, Data, Equipment — every entity in the coalition has a DID"

### Image Prompt
No AI image — DID anatomy diagram carries the argument.

### Diagram Spec
DID anatomy breakdown diagram. White background. Two linked sections.

**Left section — DID Anatomy:**
A large text rendering of: `did:near:resource-{uuid}`

Annotated with brackets and labels:
- `did` → bracket pointing right → label "Decentralized Identifier (W3C Standard)"
- `near` → bracket pointing right → label "Method: NEAR Protocol blockchain"
- `resource` → bracket pointing right → label "Type: resource (also: person, agent, material, equipment)"
- `{uuid}` → bracket pointing right → label "Unique identifier — generated at resource registration"

Below the DID anatomy, a thin line connecting to:

**Right section — ResourceCaveats Struct:**
A structured data block (light gray #F8FAFC background, monospace 10pt):
```
ResourceCaveats {
  classification: ClassificationLevel,
  releasability: Vec<NationCode>,
  roe_tier: AuthorityTier,
  geo_bounds: Option<BoundingBox>,
  time_window: Option<TimeWindow>
}
```

Annotated with labels pointing to each field:
- `classification` → "SECRET / CONFIDENTIAL / UNCLASSIFIED"
- `releasability` → "Nation codes: [AUS, CAN, NZL, GBR, USA] = FVEY"
- `roe_tier` → "Minimum authority tier for employment"
- `geo_bounds` → "Optional geographic restriction"
- `time_window` → "Optional expiration"

The two sections connected by a cyan (#06B6D4) arrow labeled "DID → Caveats enforced on-chain."

---

## Slide 14: Physical Autonomous Execution

### Purpose
Show the three-tier architecture that makes autonomous execution possible — cloud platform, Docker bridge agent, and edge robot — and explain why this architecture exists. The audience has watched the robot operate; now they see the engineering beneath it. This slide closes the loop on the opening demo.

### Visual Layout
Title "Physical Autonomous Execution" at top. Main content: the three-tier stack diagram (see Diagram Spec). Below the diagram, a single callout box: "DDIL-Resilient: bridge continues executing last-known orders when cloud connectivity is lost." At bottom right, a small annotation: "Phase 43-46 — Docker Bridge + Jetson Vision + Doctrinal Swarm Formations."

### Image Prompt
No AI image — see Diagram Spec.

### Diagram Spec
Three horizontally separated tiers connected by vertical bidirectional arrows:

**Tier 1 — Cloud (top):** Rectangle labeled "BASTION Platform" in blue (#2563EB). Sub-labels: "Agent Hub / LangGraph orchestrator," "DAO governance + authority delegation," "Mission orders + rules of engagement." Background: white, blue border.

**Tier 2 — Bridge (middle):** Rectangle labeled "Docker Bridge Agent" in sky blue (#0EA5E9). Sub-labels: "Python autonomy agent," "NEAR wallet (robot identity on-chain)," "DDIL state buffer," "Authority escalation handler." Background: white, sky-blue border.

**Tier 3 — Edge (bottom):** Rectangle labeled "Edge Robot (Jetson + Sphero RVR+)" in slate (#64748B). Sub-labels: "Camera vision pipeline," "Terrain-adaptive locomotion," "Six doctrinal swarm formations," "IMU + odometry." Background: light gray, slate border.

**Arrows:** Bidirectional arrows between Cloud↔Bridge and Bridge↔Edge. The Bridge↔Edge arrow is annotated "DDIL-resilient" in amber (#F59E0B). The Cloud↔Bridge arrow is annotated "Mission orders / DAO attestations." Arrow color: cyan (#06B6D4).

---

## Slide 15: AI Common Operating Picture

### Purpose
Show how BASTION generates a Common Operating Picture (COP) from plan documents and intelligence data — not from manual plotting. This challenges one of the most labor-intensive tasks in military operations: maintaining an accurate, current picture of the battlefield.

### Visual Layout
Title "AI Common Operating Picture" at top. Left two-thirds: the COP map mockup (see Diagram Spec). Right one-third: three key-point callouts in a vertical stack: (1) "Generated from plan text — not manually plotted," (2) "Perspective toggle: friendly / adversary view," (3) "Phase slider: temporal progression through operation." Bottom annotation: "MIL-STD-2525D symbology — the international standard for military mapping."

### Image Prompt
No AI image — see Diagram Spec.

### Diagram Spec
Map mockup with the following elements:

**Background:** Light gray (#F8FAFC) map base with simple terrain contour lines in muted gray (#64748B). No geographic labels.

**Friendly forces (blue, #2563EB):** Four to six MIL-STD-2525D unit symbols placed in the southern portion of the map — infantry battalion (rectangle with X), mechanized element (rectangle with wheeled symbol), headquarters (rectangle with star). Unit identifiers shown in small text beneath symbols.

**Adversary forces (red, #DC2626):** Three to four MIL-STD-2525D hostile unit symbols placed in the northern portion — infantry formation, armored element, air defense site. Same format as friendly symbols.

**UI overlay elements:**
- Top-left: Dropdown labeled "Perspective: Friendly" with a down-arrow (to indicate toggle capability)
- Bottom: Horizontal slider labeled "Phase" with markers at "Competition," "Crisis," "Day 4," "Day 10," "Day 22," "Negotiation" — slider positioned at "Day 4"
- Top-right corner: Small label "Generated from: Pacific Strategy AY26 Plan Documents"

**Annotation arrow:** A thin cyan (#06B6D4) arrow pointing from "Pacific Strategy AY26 Plan Documents" label to a representative unit symbol, labeled "Document intelligence → symbol placement."

---

## Slide 16: Training-Operational Parity

### Purpose
"Train as you fight" is a foundational military principle. This slide shows how BASTION enforces identical governance in training and operational modes — preventing governance shortcuts that would undermine the system's reliability under actual operational conditions.

### Visual Layout
Title "Training-Operational Parity" at top. Main content: split-screen comparison (see Image Prompt). Below the comparison: a single declarative statement in large text — "Same smart contracts. Same DAO governance. Same authority limits. Different banner." Bottom annotation: "Phase 22 — Training/Operational mode toggle with data isolation."

### Image Prompt
Clean split-screen interface visualization, 16:9, white background (#FFFFFF). Left half labeled "TRAINING MODE" in amber (#F59E0B) bold text, with a prominent amber horizontal accent bar at the top of the interface panel — the EXERCISE banner. Right half labeled "OPERATIONAL MODE" in blue (#2563EB) bold text, with a blue accent bar. Both sides show identical interface panels: a DAO governance vote display with proposal text, vote counts, and authority tier indicator. The interface elements are pixel-for-pixel identical on both sides — same layout, same controls, same data fields. The only visual difference is the amber vs. blue accent bar and the mode label. Style: clean SaaS interface mockup, flat design, no gradients, sharp typography. Mood: disciplined parity — the message is that these are the same system. Aspect ratio: 16:9. Specific elements: amber (#F59E0B) EXERCISE banner prominently visible on training side, identical DAO governance controls on both sides, white backgrounds throughout, no dark panels. Avoid: dark themes, gritty aesthetics, visual complexity that obscures the parity message, any implication that training and operational modes differ in capability.

### Diagram Spec
No diagram — the Image Prompt is the primary visual for this slide.

---

## Slide 17: Verifiable Zero Trust

### Purpose
Show BASTION's five-layer verification model and the four questions it answers. This is the architectural philosophy slide — not a capability demonstration, but a framework claim. The argument: zero trust in BASTION means mathematical verification, not written policy.

### Visual Layout
Title "Verifiable Zero Trust" at top. Left two-thirds: the five-layer concentric ring diagram (see Diagram Spec). Right one-third: four question callouts in a vertical stack, each as a numbered question:
1. Is this data authentic?
2. Is this device trusted?
3. Is this operator authorized?
4. Is this action within bounds?

Below the questions: a single declarative statement — "Trust terminates at math, not policy."

### Image Prompt
No AI image — see Diagram Spec.

### Diagram Spec
Five concentric rings, outermost to innermost, on a white background:

**Ring 5 (outermost) — "AI Advisory":** Thin ring in sky blue (#0EA5E9). Label: "AI Advisory — Flags anomalies, recommends actions, monitors compliance."

**Ring 4 — "DAO Governance":** Ring in blue (#2563EB). Label: "DAO Governance — Human decision gates on high-authority actions."

**Ring 3 — "Smart Contract Policy":** Ring in cyan (#06B6D4). Label: "Smart Contract Policy — Encoded rules, immutable enforcement, automatic check."

**Ring 2 — "Blockchain Proof":** Ring in dark blue (#1E3A8A). Label: "Blockchain Proof — Tamper-evident ledger, audit trail, independent verifiability."

**Ring 1 (innermost ring, not center) — "TEE Attestation":** Ring in slate (#475569). Label: "TEE Attestation — Hardware root of trust, device identity verified."

**Center circle — "Verified Action":** Small circle in blue (#2563EB). Label: "Verified Action" in white text.

Ring labels positioned outside each ring, connected by thin leader lines. Overall diagram is clean and minimal — white background, no shadows, flat design. Approximate diameter of full diagram: two-thirds of slide width.

---

## Slide 18: Full Architecture Synthesis

### Purpose
Bookend with Slide 6. The audience first encountered a simplified eight-component architecture overview when they had no context for what each piece did. They have now spent twelve slides learning what each component does and why it matters. This slide presents the complete, detailed architecture — the reward for having followed the argument. It is also the moment to highlight Phase 57: Ironclaw's persistent memory graph, the feature that makes the AI Chief of Staff adaptive rather than merely responsive.

### Visual Layout
Title "Full Architecture Synthesis" at top. Subtitle in smaller text: "Every component you have encountered — operating together." Main content: the comprehensive architecture diagram (see Diagram Spec). Bottom right annotation: "Phase 57 — Ironclaw Persistent Memory: the learning element." No body text on slide — the diagram carries the content. Speaker delivers script from memory.

### Image Prompt
No AI image — see Diagram Spec.

### Diagram Spec
Comprehensive architecture diagram, landscape orientation. All major components represented as labeled rectangles. Data flow arrows connecting components. Color coding as specified.

**Core components (blue, #2563EB):**
- "Knowledge Graph" — top-left quadrant. Sub-label: "Entity-relationship storage / OSINT + documents / NATO confidence ratings"
- "Agent Hub" — top-center. Sub-label: "16 deployed AI agents / 8 LangGraph analysis agents / 7 COP layer agents / 1 Ironclaw Chief of Staff"
- "Planning Workflow" — top-right. Sub-label: "6 tabs: Understand / Design / Plan / Direct / COP / Assess / JP 5-0 aligned"

**Blockchain components (cyan, #06B6D4):**
- "Smart Contracts" — middle-left. Sub-label: "check_employment_authorized() / Policy enforcement / Immutable audit"
- "DAO Tiers" — middle-center. Sub-label: "5 authority levels / Coalition-compatible / Human decision gates"
- "DID Registry" — middle-right. Sub-label: "did:near:resource-{uuid} / ResourceCaveats on-chain / Coalition caveats"

**Execution components (sky blue, #0EA5E9):**
- "Robot Bridge" — bottom-left. Sub-label: "Docker / Python agent / NEAR wallet / DDIL-resilient"
- "Edge Robots" — bottom-far-left. Sub-label: "Jetson vision / Sphero RVR+ / 6 doctrinal formations"
- "COP Engine" — bottom-right. Sub-label: "MIL-STD-2525D / Perspective toggle / Phase slider"

**Special component (highlighted with amber, #F59E0B border):**
- "Ironclaw — AI Chief of Staff" — overlaid as a spanning banner across the top of the Agent Hub and Planning Workflow components. Sub-label: "Persistent Memory Graph (Phase 57) — adaptive relationship accumulation across interactions." The amber border distinguishes Ironclaw from the standard blue components. An annotation arrow from the "Persistent Memory Graph" label points to the Knowledge Graph, showing the memory graph as a specialized subgraph of the knowledge layer.

**Data flow arrows (light gray, thin lines):**
- Knowledge Graph ↔ Agent Hub (bidirectional)
- Agent Hub ↔ Planning Workflow (bidirectional)
- Agent Hub → Smart Contracts (unidirectional: agent initiates policy checks)
- Smart Contracts ↔ DAO Tiers (bidirectional: contract enforces, DAO governs)
- DAO Tiers ↔ DID Registry (bidirectional: identity informs authorization)
- Agent Hub → Robot Bridge (unidirectional: orders flow down)
- Robot Bridge ↔ Edge Robots (bidirectional: command and telemetry)
- Knowledge Graph → COP Engine (unidirectional: data drives display)
- DID Registry → Smart Contracts (unidirectional: identity feeds enforcement)

**Background:** White (#FFFFFF). Grid lines in very light gray (#F1F5F9) for visual alignment reference.

---

## Slide 19: Tradeoffs — What We Chose and Sacrificed

### Purpose
Honest accounting. Academic rigor demands acknowledging that every design decision is an argument — something chosen over something else, with understood costs. This slide prevents the presentation from reading as uncritical advocacy. It establishes intellectual credibility with the academic audience and practical credibility with the technical audience.

### Visual Layout
Title "Tradeoffs — What We Chose and Sacrificed" at top. Subtitle: "Every system is an argument. Here is what we argued for — and what we gave up." Main content: the six-row tradeoff table (see below). Table columns are: Decision / Chose / Over / Why. Clean table formatting — alternating light gray (#F8FAFC) and white row backgrounds, column headers in blue (#2563EB) text.

### Image Prompt
No AI image — the table is the primary visual.

### Diagram Spec
No diagram — see the tradeoff table in the Visual Layout section.

**Tradeoff Table:**

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Blockchain platform | NEAR Protocol | Ethereum / Solana / Hyperledger | Sharding scalability, human-readable account IDs, low gas fees, WebAssembly contract execution |
| Governance model | DAOs | Traditional RBAC | Verifiable on-chain decisions, independent audit, coalition-compatible without shared directory |
| Storage architecture | Hybrid (PostgreSQL + blockchain) | Pure on-chain | Operational data needs relational queries and speed; governance and identity need immutability |
| AI orchestration | LangGraph | LangChain / AutoGen / raw API | Graph-based workflow control enables conditional branching and explicit state machines |
| Edge architecture | Docker bridge agent | Direct hardware integration | Procurement and policy constraints make hardware-specific nodes impractical; Docker provides hardware agnosticism |
| Identity standard | DIDs (W3C standard) | OAuth / SAML / PKI | Decentralized — no central authority required; coalition-compatible without shared identity provider |

---

## Slide 20: Known Limitations

### Purpose
Academic honesty. What BASTION is NOT. A prototype is a claim about what is possible, not a claim about what is ready. Stating limitations explicitly is more credible — and more useful — than omitting them. This slide frames limitations as research agenda items: each is a known problem with a known solution pathway, not a discovered failure.

### Visual Layout
Title "Known Limitations" at top. Subtitle: "A prototype makes a claim about feasibility, not production readiness." Main content: numbered limitation list with severity context notes in a secondary column. Two-column layout: "Limitation" and "Context / Research Agenda." Seven rows. Clean table format matching Slide 19 style.

### Image Prompt
No AI image — the structured list is the primary visual.

### Diagram Spec
No diagram.

**Limitations Table:**

| # | Limitation | Context / Research Agenda |
|---|-----------|--------------------------|
| 1 | Research prototype — not production-ready | By deliberate decision. No attempt was made to harden for operational deployment. This is a proof of concept. |
| 2 | Demonstration scale only | Single exercise scenario (Pacific Strategy AY26), limited concurrent users. Multi-exercise and concurrent-user testing is a near-term research requirement. |
| 3 | AI reliability — LLM hallucination | Confidence scoring is nascent; OSINT confidence is currently hardcoded at 0.65 for all sources regardless of quality. Source-tier-aware scoring is a known gap. |
| 4 | Smart contract gas costs at operational scale | Unknown. The volume of governance transactions in a real operational planning cycle has not been modeled. Cost modeling is required before operational use. |
| 5 | Physical robot integration limited | Single-robot demonstration. Multi-robot swarm coordination is simulated in the COP but not physically executed. Real swarm operations require additional hardware and coordination protocol testing. |
| 6 | TEE attestation — design only | Hardware Trusted Execution Environment attestation is specified in the architecture but not yet implemented. The current system relies on software-level identity without hardware root of trust. |
| 7 | No formal security audit conducted | The system has not undergone penetration testing or formal cryptographic review. Security assumptions are architectural, not verified. |

---

> Navigation: [Part 1 (1-10)](slide-specs-01-10.md) | **Part 2 (11-20)** | [Part 3 (21-25)](slide-specs-21-25.md) | [Annex A1-A10](slide-specs-annex-A01-A10.md) | [Annex A11-A17](slide-specs-annex-A11-A17.md)
