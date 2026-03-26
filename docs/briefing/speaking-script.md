# BASTION Briefing Deck — Speaking Script

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Date:** 2026-03-26
**Total slides:** 42 (25 core + 17 annex)

---

## Core Deck

---

### Slide 1: Decision Overmatch

You just watched a machine execute a tactical mission. It navigated terrain, engaged designated targets, coordinated with adjacent units — and then it stopped. It stopped because the next action exceeded the authority it had been delegated by the chain of command. It stopped and asked.

That pause — that deliberate check — is the most important thing you saw. Anyone can build a robot that acts. Building a robot that knows when to stop and why requires something different: a governance architecture baked into the system itself, not bolted on afterward as policy.

What I'm going to do in the next thirty minutes is unpack exactly how that works. BASTION — Blockchain Autonomous Strategy and Tactical Intelligence Operational Network — is a research platform that answers a specific question about coalition command and control in the age of autonomous systems. You've seen the end state. Let me show you the system underneath it.

This is not a product pitch. BASTION is a research prototype. It demonstrates what is possible, identifies what is hard, and establishes an architectural pattern that the research community — and ultimately, the operational community — can build on. If you leave today with one takeaway, let it be this: you do not have to choose between machine speed and human authority. BASTION proves you can have both, if you build it right from the start.

**DEMO CUE:** BASTION running on second screen — full platform visible at Understand tab or landing screen. Presenter has just completed the live demo sequence showing: (1) Pacific Strategy AY26 scenario loaded, (2) Ironclaw surfacing a planning recommendation in the Decide tab, (3) AI agents executing the recommended action, (4) robot bridge showing physical execution, (5) robot pausing at authority gate. The deck opens as that pause moment is frozen on screen.

---

### Slide 2: The Research Question

Every piece of research begins with a question. This is ours.

Can AI-augmented Decentralized Autonomous Organizations — the governance structures we will walk through in detail — provide a scalable, auditable, and institutionally legitimate framework for human control over autonomous systems in multi-domain coalition military operations?

That question has three specific requirements embedded in it. Scalable: it must work at coalition scale, not just for a two-person team. Auditable: every decision must be traceable, permanently. Institutionally legitimate: the framework must be acceptable to military institutions with their existing doctrine, law of armed conflict obligations, and chain of command structures.

These are not soft requirements. "Scalable" rules out approaches that work in a lab but collapse when twenty partner nations join the operation. "Auditable" rules out verbal authorization and policy documents — it requires cryptographic proof. "Institutionally legitimate" rules out any architecture that asks commanders to surrender authority; it requires the architecture to enforce and record the authority structure that already exists.

BASTION is our answer. It is a prototype — not a production system, not a program of record, not ready for operational deployment. It demonstrates that the answer is yes, under defined conditions, with known limitations. And it establishes the architecture pattern that could be scaled.

**DEMO CUE:** Second screen: BASTION idle on the Understand tab — the brain graph visualization visible in background, showing entity nodes from the Pacific Strategy AY26 scenario. Presenter does not click anything — the visualization running in the background reinforces that this is a live, running system with real scenario data.

---

### Slide 3: Coalition C2 Coordination Crisis

Between 2017 and 2024, the volume of intelligence reporting available to a joint force headquarters increased by orders of magnitude. Satellite imagery, signal intelligence, open-source data feeds, partner nation reports, commercial sensors — the information is there. The problem is not collection. The problem is processing.

A typical joint force staff officer working intelligence fusion spends roughly sixty percent of their time not on analysis, but on coordination: formatting products for adjacent units, reconciling conflicting assessments from different sources, validating whether partner nation data meets release conditions, and updating shared documents that will be out of date before they arrive.

Coalition operations multiply this problem by the number of partners. Every nation brings its own planning tool with its own data schema. Coordination happens in meetings that generate no permanent record. After the operation, "did they honor the coalition commitment?" is frequently an unanswerable question — not because anyone was dishonest, but because the coordination mechanism left no trace.

And while the friendly force headquarters runs its human-speed coordination loop, a peer adversary with autonomous coordination tools operates inside that cycle. Not faster by minutes — faster by an order of magnitude. The decision that takes a friendly staff three hours to staff, coordinate, and authorize happens in minutes on the other side.

This is not a technology problem waiting for better software. It is an architectural problem. The answer requires a different kind of system.

---

### Slide 4: The Autonomous Systems Governance Gap

In 2012, the Department of Defense issued Directive 3000.09 — the foundational policy on autonomous weapons systems. It requires "appropriate levels of human judgment over the use of force." That is a good requirement. The problem is the word "appropriate." Who decides what is appropriate in the middle of an operation? How do you prove after the fact that the appropriate judgment was exercised? What happens when operational urgency creates pressure to bypass the judgment requirement entirely?

The honest answer is: nobody knows, because the policy document does not specify the enforcement mechanism. Policy tells machines what they should do. It does not — cannot — prevent them from doing otherwise when an operator decides the situation warrants it.

Role-based access control — the standard IT security approach of assigning permissions based on user roles — does not solve this problem either. RBAC governs access to systems. It does not govern the specific decisions made within those systems. An operator with "planner" role access can still plan anything. The system will not stop them.

What this problem requires is not better policy documents. It requires enforceable policy — governance logic embedded in the system architecture itself, that executes automatically regardless of operator intent, chain-of-command pressure, or operational urgency. It requires something closer to a machine-verifiable rule of law than a machine-readable checklist.

That is what BASTION's smart contract layer provides. We will walk through the specifics. But first — here is the core thesis.

---

### Slide 5: The Approach — BASTION's Answer

BASTION's answer to both problems can be stated in nine words: AI accelerates. DAOs enforce. Humans judge.

That is the thesis. Let me unpack what each element actually means in practice.

AI accelerates: We have deployed 131 specialized agents that operate continuously. They process incoming intelligence, extract entities and relationships, cross-reference sources, flag conflicts, draft assessment products, and surface decisions that require human attention. They do not decide. They accelerate — compressing the coordination overhead that currently consumes most of a staff officer's time. The human gets to spend their cognitive resources on judgment rather than formatting.

DAOs enforce: Decentralized Autonomous Organizations — smart contracts running on NEAR blockchain — are the governance layer. When I say "enforce," I mean the word precisely. Smart contract code executes automatically. It cannot be overridden by an operator who decides the situation warrants an exception. When the contract says "this action requires Tier 3 authorization," that requirement is not a note in an order — it is a gate that will not open without the required signature. The enforcement is mathematical.

Humans judge: The five-tier authority model defines exactly which humans authorize which decisions, at which levels. And three decision categories are permanently locked to human-only authority: strike authorization, strategic resource commitment, and national caveat exceptions. Not "preferred to have human review." Locked. The system will not proceed without it.

This is a prototype. It demonstrates that this architecture works. It also demonstrates where the hard problems are — and we will be honest about those before we're done. But first, let me give you a map of what we built.

---

### Slide 6: Simplified Architecture Overview

Here is the map. Before we go through each capability section, I want to give you a picture of how these components relate to each other. This diagram is intentionally simplified — the whitepaper has the full architecture. This version is a cognitive map, not a technical reference.

At the top: the intelligence layer. The Knowledge Graph — built on Neo4j and a semantic data format called JSON-LD — is the "brain" of the system. Every piece of intelligence, every entity, every relationship BASTION knows about lives here. The Agent Hub — 131 specialized AI agents — reads from and writes to that brain continuously.

In the middle: the platform itself. Six tabs aligned to JP 5-0 doctrine provide the interface. Understand, Design, Plan, Decide, COP, Assess. Your planning workflow, made software.

Below that: the governance and identity layer. This is where BASTION is different from anything else you have seen. Smart contracts and DAOs running on NEAR blockchain enforce the authority model. A Decentralized Identifier — a DID — is assigned to every resource in the system. The Robot Bridge translates planning intent to physical execution.

At the bottom: what comes out. Physical execution from the robotic platforms. An immutable audit trail — a permanent, tamper-proof record of every governance decision — on the NEAR blockchain. Coalition reporting.

Each of these blocks will have its own slide. Let's start at the top — with how BASTION builds strategic understanding.

**DEMO CUE:** Second screen: briefly show BASTION's left navigation, clicking slowly through tabs — Understand, Design, Plan, Decide, COP, Assess — showing each tab has real content populated from the Pacific Strategy AY26 scenario. Do not explain the tabs — just show they exist and are populated. Return to Understand tab before advancing.

---

### Slide 7: The Intelligence Brain — Knowledge Graph

A senior intelligence analyst carries years of contextual understanding in their head. They know that this unit was here three months ago, that its commander has a history of particular operational patterns, that it is equipped for this specific mission type. When a new SITREP arrives, they do not read it in isolation — they read it against that accumulated understanding.

BASTION's knowledge graph does the same thing at machine scale. Every piece of intelligence BASTION processes becomes nodes and edges — entities and relationships — in a semantic network built on a data format called JSON-LD (JSON for Linked Data). JSON-LD is a W3C standard that provides formal semantic relationships rather than just keyword matching. When BASTION reads that "PLA 74th Army Group is operating near Hualien," it does not store a text string. It creates an entity node for "PLA 74th Army Group," an entity node for "Hualien," and a typed relationship between them: LOCATED_NEAR. It attaches source provenance: this came from SITREP-20260312. It attaches a NATO STANAG 2022 reliability rating: source reliability B, information reliability 2 — meaning a usually reliable source with information that is probably true.

That entity now has context. When the next report mentions the 74th Army Group, BASTION connects it to everything it already knows. Understanding accumulates rather than restarts with every new document.

One critical capability: the knowledge graph is scoped to problem sets. Intelligence from the Taiwan contingency planning effort is isolated from intelligence in other problem sets. Staff officers working different operations do not contaminate each other's analytical workspace. The brain is partitioned, not shared.

This is the foundation of strategic understanding in BASTION. Let's look at how intelligence gets into the brain in the first place.

**DEMO CUE:** Second screen: Navigate to Understand tab — show the brain graph visualization with entities visible from the Pacific Strategy AY26 scenario. Zoom slowly into an entity cluster, showing individual entity nodes and their connections. If possible, click one entity to show its properties panel — demonstrating that relationship data and source provenance are visible.

---

### Slide 8: Autonomous Document Intelligence

A document arrives — a SITREP from a partner nation, a HUMINT report from an intelligence team, a commercial satellite imagery analysis. Someone uploads it to BASTION. What happens next is invisible to the user, but critically important.

Ten specialized agents work in sequence. The Classification Agent identifies what kind of document this is, where it came from, and what classification level it carries. The Entity Extraction Agent reads the content and identifies every meaningful entity: unit designations, location names, equipment types, named individuals, events with dates. The Relationship Mapping Agent structures the relationships between those entities — who commanded whom, which unit was where, what action happened at what time.

Then — this is the piece most intelligence systems miss — the Reliability Rating Agent applies NATO STANAG 2022 ratings automatically. STANAG 2022 is the NATO standard for intelligence source reliability. It uses a two-part rating: letters A through F for source reliability (A meaning "completely reliable," F meaning "reliability cannot be judged"), and numbers 1 through 6 for information reliability (1 meaning "confirmed by other sources," 6 meaning "truth cannot be judged"). Every entity extracted from every document carries these ratings. Analysts can immediately see how much confidence to place in any given intelligence assessment.

The Conflict Detection Agent then checks whether the new information contradicts existing knowledge in the graph. If two sources disagree on where a unit was at a given time, BASTION flags that conflict and surfaces it for analyst review. It does not silently resolve contradictions — it does not pick the "more reliable" source and discard the other. Conflict is information. It surfaces the conflict.

Finally, the Graph Integration Agent merges the new entities into the existing knowledge graph — connecting them to related nodes, updating existing entries, preserving provenance.

The result: a document that arrived as unstructured text is now structured intelligence, rated, cross-referenced, and integrated into the brain in under thirty seconds.

**DEMO CUE:** Second screen: Show the document upload interface in the Understand tab, or show the entity extraction view for a previously uploaded document from the Pacific Strategy AY26 scenario — demonstrating that entities from an actual document are displayed with source and reliability information. If the upload interface is cleaner, show that with the upload queue visible.

---

### Slide 9: Doctrinal Planning Workflow

Joint Publication 5-0 defines the joint planning process in six phases: mission analysis, course of action development, plan and order development, decision briefing, execution, and assessment. If you have been trained on JP 5-0, you already understand the cognitive workflow of BASTION — because the software tabs mirror the doctrine exactly.

This is not cosmetic. When the doctrinal structure and the software structure are the same, planners do not need to learn a new mental model. The system reinforces doctrine rather than working against it. More importantly, the governance gates in BASTION correspond to doctrinal transition points: you cannot move from Design to Plan without the required approvals; you cannot move from Plan to Decide without a decision product that meets the doctrinal standard.

The Understand tab is the intelligence foundation — the knowledge graph and its entities. Design is where Operational Art happens: Center of Gravity analysis, Lines of Effort, the Operational Approach. Plan holds the campaign plan at the strategic level and the MDMP workflow at the tactical level — including AI-generated planning products like warning orders, operations orders, and fragmentary orders. Decide surfaces decisions requiring command attention, with DAO governance proposals for coalition-level decisions. COP shows the Common Operating Picture with MIL-STD-2525D military symbology, generated automatically from the plan. Assess closes the loop with training assessment and after-action review.

Present in every tab is Ironclaw — BASTION's AI Chief of Staff. Ironclaw monitors all agent activity at sixty-second polling intervals, proactively surfaces decisions requiring attention, and guides planners through doctrinal steps. Ironclaw is not a chatbot you ask questions. Ironclaw watches the operational picture, identifies when something requires a commander's judgment, and brings it forward. That is what a good Chief of Staff does.

**DEMO CUE:** Second screen: Click through tabs slowly — Understand, Design, Plan, Decide, COP, Assess — pausing briefly on each to show that real content from the Pacific Strategy AY26 scenario is populated. Do not explain each tab verbally — the script covers it. Let the visual show the system is live and populated.

---

### Slide 10: Operational Design with AI

The Design tab is where Operational Art happens in BASTION. But this slide is about two capabilities that distinguish BASTION from any planning tool you have seen — both developed since our last briefing.

The first is Ironclaw functioning as Chief of Staff for the operational design process. This is not a chatbot. When a commander sits down to develop the Operational Approach — the set of decisions about the decisive point, the adversary's center of gravity, the Lines of Effort that will achieve the objective — Ironclaw takes on the role that a Chief of Staff performs: coordinating inputs across staff sections, obtaining the commander's decisions, and validating every input against JP 5-0 doctrine before recording it. Ironclaw coordinates: "I need the commander's decisive point before I can develop Lines of Effort." Ironclaw obtains: it asks the right doctrinal questions in sequence, ensuring nothing is skipped. Ironclaw validates: "This decisive point aligns with the J2's threat assessment — recording it as the CoG linkage." The responses are not just recorded as text — they are captured as structured design decisions that become the doctrinal foundation of the plan. The planning products that follow — warning orders, operations orders — are grounded in explicitly recorded and validated design intent.

The second is the Visual Operational Approach Editor. Here is the specific capability: Ironclaw can direct MIL-STD-2525D symbol placement on the operational map. A planner describes their intent — "I want three converging Lines of Effort aimed at degrading PLAN air defense coverage" — and Ironclaw translates that verbal intent into visual operational graphics on the map: the correct MIL-STD-2525D symbols positioned at the appropriate locations, with vectors showing direction of movement and lines of effort. The planner reviews, adjusts, confirms.

This is not AI generating a report for a human to read. This is AI acting as Chief of Staff — coordinating the process, obtaining and validating decisions, and producing visual products that serve as the basis for the operations order. The difference matters for doctrine: a plan with recorded, validated design decisions is auditable, transferable, and defensible in a way that a plan that lives in a commander's head is not.

**DEMO CUE:** Second screen: Navigate to Design tab — show CoG analysis interface or the operational approach map if populated with the Pacific Strategy AY26 scenario data. If the visual approach editor is accessible, show the map with MIL-STD-2525D symbols positioned. Do not navigate away — this is a natural demo moment for the most visually compelling planning content.

---

### Slide 11: Smart Contracts as Policy Enforcement

Policy documents tell machines what they should do. Smart contracts tell machines what they can do — and when the contract says "no," the machine stops, regardless of what any operator wants.

Let me be concrete. Phase 58 of BASTION's development implemented on-chain DID caveats — Decentralized Identifier caveats — which are the specific enforcement mechanism for coalition resource management. When Australia shares satellite imagery with the Pacific coalition, that imagery gets a DID: did:near:resource-{unique-id}. Attached to that DID is a ResourceCaveats struct — a data structure recording five caveat conditions: classification level (SECRET), releasability (Five Eyes nations only), ROE tier required for employment (Tier 3 — organizational authority), geographic bounds (Pacific AOR, defined by bounding box coordinates), and time window (valid for 72 hours from sharing).

When any agent, system, or operator attempts to use that resource, BASTION calls `check_employment_authorized()` — a function in the smart contract running on NEAR blockchain. That function checks all five conditions against the requesting context. If all five pass: the action is authorized. If any fail: the action is denied, and the denial is logged permanently to the NEAR blockchain ledger.

That log — what technologists call an immutable audit trail, meaning a record that mathematically cannot be altered after it is written — is the enforcement record. After the operation, every authorization and every denial is available for review. Who requested what, what the caveat conditions were at the time, and what the decision was. Not in a BASTION database that could be modified. On the blockchain, where modification is cryptographically impossible.

This is what DoD Directive 3000.09 actually requires — enforcement mechanisms, not just policies. Smart contracts are the mechanism.

**DEMO CUE:** Second screen: Show the Resources tab with the SecurityCaveatsSection visible — demonstrating the caveat fields (classification, releasability, ROE tier, geo bounds, time window) in the UI. If possible, show the NEAR testnet explorer at did.bastion.testnet showing recorded contract interactions. Note to presenter: either screen works — the Resources tab caveat editor shows the input side; the NEAR explorer shows the enforcement record.

---

### Slide 12: DAO Authority Levels — Five Tiers

Remember when the robot stopped and asked for permission? Here is the architecture that made that moment possible.

BASTION implements a five-tier authority model. Tier 1 is individual authority — a person acting within their own bounded scope. Tier 2 is team-level authority. Tier 3 is organizational authority — and this is the critical threshold. Tier 3 is the minimum authority level required for any autonomous engagement. Not Tier 4. Not coalition consensus. Tier 3 — an organizational commander. Any action that could result in lethal effect must have Tier 3 authorization, enforced by smart contract, before it proceeds.

Tier 4 is national DAO authority — decisions that commit national resources or strategic commitments. Tier 5 is the coalition strategic level — decisions requiring full coalition consensus, including strike authorization, which requires one hundred percent coalition agreement. No single partner can authorize a coalition-level strike.

In the opening demonstration, the robot was operating with a Tier 5 delegation — the most bounded, autonomous level. Within that delegation, it navigated, it conducted reconnaissance, it executed assigned tasks without requesting permission for each action. But when it identified an engagement opportunity, the smart contract checked: does this action require Tier 3 authorization? Yes. Does this robot's current delegation include Tier 3 authority? No. Can I proceed? No.

So it stopped. It submitted an authority escalation request through the DAO governance chain. It waited. That wait — that deliberate, contractually-enforced pause — is the governance architecture working exactly as designed.

Delegations are dynamic. A commander can grant an expanded delegation for a time-limited mission window — "I authorize Tier 3 engagement authority for the next four hours in grid 12S." That delegation is recorded on the NEAR blockchain with its expiration time and expires automatically. No one has to remember to revoke it.

**DEMO CUE:** Second screen: Navigate to Decide tab — show the governance proposals or decision dashboard, demonstrating that there are real governance items requiring commander attention from the Pacific Strategy AY26 scenario. If a robot authority escalation request is visible, show it. If not, show any pending DAO governance proposal to illustrate the concept.

---

### Slide 13: Decentralized Identity + Coalition Caveats

In every coalition operation, the most fraught coordination task is managing national caveats on shared resources. Australia shares imagery — but only with Five Eyes partners, only for forty-eight hours, only for use within a defined geographic area. The UK shares signals intelligence — but not with nations that have not signed certain bilateral agreements. Managing these caveats manually, through liaison officers and coordinating instructions in the operations order, generates exactly the kind of coordination overhead we described in the problem slides.

BASTION's answer is Decentralized Identity. A DID — a Decentralized Identifier, following the W3C standard for digital identity — is assigned to every resource, every person, every agent, every piece of equipment in the system. The format is: did:near:resource-{unique-id}. That identity is registered on the NEAR blockchain.

Attached to that identity is a ResourceCaveats data structure containing five fields: classification level, releasability — which nation codes are permitted — ROE tier required for employment, geographic bounds if applicable, and time window if applicable. These are not text notes. They are structured data fields that the smart contract reads when checking authorization.

Here is what this changes: the caveats travel with the resource identity. When Australia's satellite imagery is forwarded to a planning team in Japan, the caveats go with it — encoded in the DID. There is no risk that the caveat note gets lost in a copy-paste, forgotten in an email chain, or overridden by an operator who does not know the restriction existed. The contract checks before the resource is used. The Five Eyes restriction enforces itself.

Coalition partners can verify any enforcement decision independently — by checking the NEAR blockchain directly — without trusting BASTION's word. That independent verifiability is what we mean by institutionally legitimate governance. Trust does not require trust in BASTION. It requires only trust in mathematics.

**DEMO CUE:** Second screen: Show Resources tab → select a specific resource → show the DID displayed in the resource detail panel → show the SecurityCaveatsSection with caveat fields populated. Demonstrate that the DID is shown in the did:near:resource-{uuid} format and that the caveat fields correspond exactly to the struct described in the script.

---

### Slide 14: Physical Autonomous Execution

This is what was happening under the hood when you watched that robot execute at the start of this briefing.

The architecture is three tiers. At the top, the BASTION cloud platform — the AI agent hub, the DAO governance layer, the mission planning environment. This is where authority lives. This is where the human commanders make decisions, delegate tasks, and define the boundaries of autonomous action.

In the middle, the Docker bridge agent. This is the crucial translation layer. It runs a Python autonomy agent with its own NEAR blockchain wallet — the robot has an on-chain identity. It holds a buffer of mission state for DDIL-resilient operation. And critically: it contains the authority escalation handler. When the robot encounters a situation that exceeds its delegated authority at that moment, the bridge agent pauses execution and escalates back to the cloud for human decision. That pause — that check-in — is the core control mechanism you saw demonstrated.

Why Docker rather than a purpose-built edge device? This was a deliberate tradeoff. Procurement and policy constraints make hardware-specific edge nodes impractical for a research prototype. Docker provides hardware agnosticism — the bridge agent runs identically on any capable machine. That agnosticism also represents what a fielded system would need: the ability to integrate heterogeneous robotic platforms without custom firmware per device.

At the edge, the robot itself: a Jetson compute module running a camera vision pipeline, a Sphero RVR+ for locomotion, and the capability to execute six doctrinal swarm formations — column, wedge, echelon, line, diamond, and file — derived from actual military small-unit formations. These are not arbitrary movement patterns. They are doctrinal.

The three-tier architecture separates authority from execution. Cloud owns authority. Edge owns execution. Bridge translates between them, handling connectivity interruption and authority escalation as its primary functions.

**DEMO CUE:** Second screen: If robot hardware is available, show the robot bridge status page with discovered robots and bridge connectivity status. If hardware is not present, navigate to the COP tab and show the architecture diagram representation, or reference the pre-recorded demonstration clip. Point out that the BASTION platform remains visible on the second screen as Tier 1 of the architecture the audience is looking at.

---

### Slide 15: AI Common Operating Picture

The Common Operating Picture — the COP — is the single most critical shared display in any military headquarters. Commanders make decisions based on it. Staff briefs from it. The problem is how it gets built: manually. Intelligence analysts read reports, extract unit locations, and plot symbols on a map. Operations staff update those positions as units move. The COP is always behind reality because human curation cannot keep pace with the information environment.

BASTION generates the COP from documents.

The document intelligence pipeline you saw on the previous slides — the one that extracts entities, relationships, and locations from source documents — feeds directly into COP symbol placement. When a plan document describes a PLAN 74th Army Group formation establishing a defensive position at a grid coordinate, that becomes a red unit symbol on the map, positioned at that coordinate, with the relationship data from the knowledge graph attached to it. No manual plotting required.

The COP supports two capabilities that manual systems cannot. First, perspective toggle: with a single click, the same operational environment can be viewed from the friendly force perspective or the adversary perspective. This is not cosmetic. Viewing the battle space from the adversary's likely decision calculus — what would they see as BLUFOR vulnerabilities? — is a core element of the Intelligence Preparation of the Battlefield process. That analytical step currently requires a separate staff effort. In BASTION, it is a toggle.

Second, the phase slider. The Pacific Strategy AY26 scenario has six phases: Competition, Crisis, four Conflict days, and Negotiation. The phase slider allows the COP to display the operational picture as it is projected to evolve across time — showing which units are expected where at each phase boundary. That temporal visualization is not currently achievable in standard COP tools without significant manual re-plotting for each phase.

The COP is not a display. It is an analytical output of the knowledge graph.

**DEMO CUE:** Second screen: Navigate to COP tab. Show the map with MIL-STD-2525D symbol overlays in place. Toggle between friendly and adversary perspective — demonstrate that the symbol sets change (friendly blue becomes red hostile, positional emphasis shifts). Then use the phase slider to advance through operational phases, showing how the force picture evolves. Narrate: "Every symbol on this map was placed by the document intelligence pipeline — no one plotted this manually."

---

### Slide 16: Training-Operational Parity

"Train as you fight" is not a slogan. It is a reliability requirement. Governance procedures that are practiced inconsistently in training will fail inconsistently under operational stress — precisely when they are most needed.

BASTION enforces training-operational parity through a single design decision: training mode and operational mode share the same smart contracts. There is no "training version" of the DAO governance logic. There is no relaxed authority tier enforcement in exercise. The only difference between TRAINING and OPERATIONAL mode is a banner — an amber EXERCISE label that makes the mode explicit — and data isolation that ensures exercise data does not contaminate the operational record.

Why does this matter? Because procedural muscle memory is built through repetition against the actual system. If trainees learn to approve an authority delegation through a simplified training interface, they have not learned to use BASTION. They have learned to use a training version of BASTION. When they encounter the real system under operational conditions — time pressure, incomplete information, command authority ambiguity — they will encounter the governance controls for the first time under the worst possible circumstances.

BASTION eliminates that gap. The planning officer who approves a robot authority delegation in a JRTC exercise is executing the same smart contract call they would execute in actual operations. The DAO vote they participate in uses the same on-chain governance mechanism. The DID they authenticate with follows the same cryptographic verification path.

Training in BASTION is not simulation. It is rehearsal on the live system.

**DEMO CUE:** Second screen: If BASTION is in training mode, point to the amber EXERCISE banner — it should be visible at the top of the interface. Demonstrate that governance controls (DAO proposals, authority delegation, planning tabs) are identical to what they would be in operational mode. If in operational mode, describe the training mode behavior: "In exercise mode, everything you see here looks the same — with an amber banner across the top confirming the mode."

---

### Slide 17: Verifiable Zero Trust

Zero trust is a term that has been adopted so broadly it has nearly lost meaning. In most contexts, "zero trust architecture" means: we wrote a policy that says we do not trust anything, and we have a product that implements that policy through software controls. The trust is still ultimately in the software vendor, the policy author, and the humans who configure and audit the system.

BASTION's zero trust architecture makes a different claim. Trust terminates at mathematics.

The architecture answers four questions for every action in the system. Is this data authentic? The document arrived through the knowledge graph pipeline, and its provenance is recorded on-chain. Is this device trusted? The robot bridge agent holds a NEAR wallet — a cryptographic identity — that was registered on the blockchain when the device was enrolled. A device that cannot prove that identity cannot participate in the mission. Is this operator authorized? Authorization is checked against the DAO's current authority delegation state — on-chain, auditable, not subject to manual override without a governance event. Is this action within bounds? The smart contract's `check_employment_authorized()` function verifies five fields before permitting any resource employment.

These four questions are answered by five verification layers, from the inside out. At the hardware level: TEE attestation — Trusted Execution Environment, a hardware-isolated computation environment that can prove to external parties that code ran without tampering. Then blockchain proof: the tamper-evident ledger that records every governance event and cannot be retroactively modified. Smart contract policy: the encoded rules that execute automatically, without human intervention, every time an action is attempted. DAO governance: the human decision gate for high-authority actions. And AI advisory: the outer layer that monitors for anomalies and flags compliance concerns.

The innermost layer is hardware. The outermost is human judgment. Both are required. Neither alone is sufficient.

**DEMO CUE:** No demo cue for this slide — this is architectural philosophy. Second screen can display any BASTION tab. Consider leaving the COP tab visible from the previous slide to maintain visual continuity with the live system while the philosophical framework is presented.

---

### Slide 18: Full Architecture Synthesis

This is the same diagram you saw on Slide 6 — except now you know what each piece does.

When you saw this architecture overview forty minutes ago, the labels were familiar: AI, blockchain, robots. But the relationships were opaque. Why does the Agent Hub connect to the DAO tier? Why does the DID Registry feed the smart contract? Why is there a bridge between cloud and edge? Those questions have answers now.

What I want to draw your attention to is the highlighted component: Ironclaw, the AI Chief of Staff. Ironclaw spans the Agent Hub and the Planning Workflow — it is present across every capability section we have covered. But in Phase 57, Ironclaw acquired something it previously lacked: persistent memory. Not session memory that resets when a conversation ends. A persistent graph of relationships — staff patterns, commander preferences, recurring intelligence themes, historical decision data — that accumulates across all interactions and persists in the knowledge graph.

This is the difference between a capable assistant and an adaptive partner. Before Phase 57, Ironclaw could answer questions about the current planning session. After Phase 57, Ironclaw remembers that this commander consistently prioritizes logistic support lines over maneuver flexibility — because that pattern appeared in three previous planning sessions. It remembers that a specific intelligence source has historically overstated adversary air defense capability. It adapts its advisory posture based on what it has learned.

The persistent memory graph is annotated here as a specialized subgraph within the Knowledge Graph layer — because that is architecturally what it is. It is the learning element of the system.

Everything else on this diagram has been operational since Phase 43. The memory graph is what makes BASTION more than a tool. It is what makes BASTION a working relationship.

**DEMO CUE:** Second screen: Show BASTION's full platform — any tab, as the architecture is running live. Consider the Understand tab or the Design tab to show the operational context. Point to the second screen: "This entire architecture is running on the screen next to me. Every component on this diagram has an active process on that machine." If Ironclaw's memory panel is accessible, briefly show the Memory tab in the Ironclaw drawer — the persistent graph entries — to ground the Phase 57 reference in a visible interface.

---

### Slide 19: Tradeoffs — What We Chose and Sacrificed

Every system is an argument. It argues for certain values over others, certain capabilities over others, certain futures over others. Part of intellectual honesty is being explicit about what that argument costs.

Six major tradeoffs shaped BASTION.

The first is blockchain platform. We chose NEAR Protocol over Ethereum, Solana, and Hyperledger. Ethereum is the most mature smart contract platform, but gas fees at operational scale are unpredictable and potentially prohibitive. Solana offers high throughput but has experienced network instability that a military system cannot tolerate. Hyperledger is permissioned and consortium-compatible, which has appeal for coalition contexts — but it requires upfront agreement on consortium membership, creating exactly the kind of centralized coordination dependency we were trying to eliminate. NEAR offers sharding-based scalability, human-readable account IDs that support the DID naming scheme, and consistent low fees. The tradeoff: NEAR is less widely known in defense contexts, requiring more explanation.

Second: governance model. We chose DAOs over traditional role-based access control. RBAC is well-understood and widely implemented. The tradeoff with DAOs is implementation complexity and the latency of consensus. When a governance vote requires multiple participants, real-time decision speed suffers. We accepted that tradeoff because verifiable, auditable, coalition-independent governance — governance that no single party can override — is worth the complexity.

Third: storage. Pure on-chain storage would maximize immutability. But operational planning data — the volume, query complexity, and update frequency of a real planning cycle — requires relational database performance. We chose hybrid storage: PostgreSQL for operational data, blockchain for governance events and identity. The tradeoff is architectural complexity and a data synchronization challenge.

Fourth: AI orchestration. LangGraph over raw API calls or LangChain's sequential chains. LangGraph enables explicit graph-based workflow control with conditional branching — the kind of "if this intelligence type, route to this agent team" logic the planning cycle requires. The tradeoff is a less-familiar framework with a steeper learning curve.

Fifth: Docker bridge over direct hardware integration. Agnosticism over optimization.

Sixth: DIDs over OAuth or SAML. Decentralized identity enables coalition participation without requiring a shared identity provider. The tradeoff is that DID tooling is less mature than OAuth, and NEAR-specific DID resolution is not yet a widely-supported standard.

These were deliberate choices. None were defaults.

**DEMO CUE:** No demo cue for this slide — this is reflection. Second screen can remain on any BASTION tab from the previous slide.

---

### Slide 20: Known Limitations

This is a proof of concept. I want to be explicit about what that means.

Seven known limitations bound what BASTION currently is. None of them are surprises. All of them are research agenda items.

Limitation one: this is a research prototype. By deliberate design decision, no effort was made to harden BASTION for operational deployment. The architecture is sound. The code works. But "works in a controlled demonstration environment" and "survives operational tempo with real-world data volumes and adversarial inputs" are meaningfully different claims. BASTION makes the first claim.

Limitation two: demonstration scale. Every scenario in the system is Pacific Strategy AY26 — a single exercise designed for this research. Concurrent-user testing, multiple simultaneous planning sessions, and multi-exercise data separation have not been stress-tested.

Limitation three: AI reliability. Large language models hallucinate. BASTION's confidence scoring system is designed to surface and flag uncertain outputs — but the confidence scoring is currently immature. OSINT source confidence is hardcoded at 0.65 regardless of the source's actual reliability history. Source-tier-aware scoring — differentiating between a signals intelligence report and an open social media post — is a gap with a clear solution pathway, but it has not been implemented.

Limitation four: gas cost at scale. The volume of smart contract calls in a real planning cycle — every resource employment check, every DID resolution, every governance vote — has not been modeled against actual NEAR mainnet costs. Cost modeling is required before any operational consideration.

Limitation five: physical swarm is simulated. The robot demonstration involves a single physical robot. Multi-robot swarm coordination — the six doctrinal formations — is represented in the COP and in the architecture but has not been physically executed with multiple units.

Limitation six: TEE attestation is designed, not built. Hardware root of trust is specified in the architecture. It has not been implemented. This is the gap between "zero trust by design" and "zero trust by verification."

Limitation seven: no security audit. The system has not been penetration tested. Cryptographic assumptions have not been formally reviewed.

Each of these has a solution pathway. None of them invalidates the proof of concept.

---

### Slide 21: Doctrinal Impact

Five doctrinal shifts follow from the BASTION approach.

First: staff augmentation, not replacement. BASTION fields 131 AI agents covering 19 AI capability roles and 31 JPP staff officer roles. That is not a replacement for human staff — it is additional capacity. The intelligence analyst who currently spends eight hours manually correlating OSINT reports can redirect those eight hours toward judgment tasks that require human contextual understanding. The AI handles correlation. The human handles interpretation. Staff size is not reduced; staff effectiveness is multiplied.

Second: planning timelines compress. The Joint Planning Process — from mission analysis through the operations order — currently takes days at minimum, weeks in complex coalition scenarios. BASTION's document intelligence pipeline, knowledge graph synthesis, and Ironclaw-guided operational design process can compress the information-gathering and analysis phases significantly. Early testing suggests that phases which take two to three days manually can complete in hours with AI augmentation. This is not a claim about quality — a faster analysis is not always a better analysis — but it is a claim about optionality. Compressed timelines give commanders more decision space.

Third: coalition accountability becomes verifiable. The current state of coalition accountability is largely trust-based. Nations share information under caveats enforced by policy and liaison. BASTION makes accountability verifiable: every governance decision, every authority delegation, every resource employment check is recorded on the NEAR blockchain. A coalition partner does not need to trust BASTION's word about compliance. They can verify independently.

Fourth: authority delegation becomes formal and enforceable. "The robot is authorized to conduct area reconnaissance but must check in before engaging any target" is currently a statement in a fragmentary order — enforced by training, culture, and the robot operator's judgment. In BASTION, that authority delegation is a smart contract condition. It enforces itself.

Fifth: training and operations converge. The same system, same governance, same tools — different banner.

**DEMO CUE:** Second screen: Show BASTION with a populated exercise — the full planning environment with agents, COP, and governance elements visible. The live system is the doctrinal impact made visible. Narrate: "The doctrinal shift I am describing is not theoretical. It is running on the screen next to me."

---

### Slide 22: Future Roadmap

The roadmap from research prototype to operational relevance has three stages.

Near-term — the next six to eighteen months — is about hardening the foundation. A formal security audit and penetration test. Source-tier-aware confidence scoring that replaces the current hardcoded baseline with a scoring model that accounts for the actual reliability history of each intelligence source. Multi-exercise testing to validate that the architecture scales beyond the single Pacific Strategy AY26 scenario. Gas cost modeling to understand the economics of blockchain governance at operational scale. And TEE attestation — moving from "zero trust by design" to "zero trust by hardware verification."

Medium-term — eighteen to thirty-six months — is about validation at scale. Multi-node NEAR deployment, because a single-node blockchain is not operationally resilient. Real multi-robot swarm operations, because the six doctrinal formations need physical validation, not just COP representation. Coalition partner testing — bringing allied nation observers into exercises and validating that the DID-based coalition caveat model works across national systems. And a formal doctrinal study: does the JPP actually compress when AI-augmented? What are the second-order effects on staff competency and commander judgment?

Long-term — beyond three years — is about integration. The JADC2 program is the U.S. Department of Defense's primary initiative for multi-domain command and control. BASTION's architecture — distributed, AI-augmented, blockchain-governed — is architecturally aligned with JADC2 principles, but formal integration would require standards compliance work that has not begun. NATO interoperability assessment. And ultimately, an operational pilot — taking BASTION into a controlled exercise environment at JRTC or equivalent with actual units and measuring the outcome against baseline planning cycle performance.

This is a research prototype with a path to operational relevance. The path is defined. The work is significant. The destination is worth it.

---

### Slide 23: Key Research Contributions

Eight contributions.

One: a DAO-governed military C2 architecture. The first working implementation of DAO-based governance applied to military command and control at the problem set level, demonstrating feasibility of on-chain human decision gates in a planning context.

Two: a five-tier authority delegation model. A formally specified hierarchy of authority levels — from strategic command to autonomous system — with each tier's permissions encoded in smart contracts and enforced without manual intervention.

Three: AI agent orchestration for military planning at scale. A 131-agent architecture covering 19 AI capability roles and 31 Joint Planning Process staff officer roles, orchestrated through LangGraph workflows, demonstrating that AI staff augmentation can span the full JPP cycle.

Four: a knowledge graph for strategic intelligence accumulation. A graph-based intelligence environment that accumulates entity-relationship data across documents and sources, enabling the synthesis that current manual methods cannot achieve at comparable speed.

Five: smart contract policy enforcement for coalition operations. The `check_employment_authorized()` enforcement model demonstrating that coalition caveats can be encoded as verifiable contract conditions rather than policy instructions subject to human error.

Six: DID-based identity with on-chain coalition caveats. An implementation of W3C Decentralized Identifiers applied to military resources, personnel, and systems — with the `ResourceCaveats` data structure enabling Five Eyes releasability, ROE tier enforcement, geographic restrictions, and temporal windows — all on-chain.

Seven: a three-tier edge architecture for autonomous systems. The cloud-bridge-edge pattern demonstrating that blockchain-governed autonomy can survive DDIL conditions while maintaining authority delegation integrity.

Eight: training-operational governance parity. A working implementation of "train as you fight" governance — shared smart contracts, identical DAO authority structures, and data isolation — establishing that operational governance can be rehearsed, not just described.

---

### Slide 24: The Answer

The question was this: Can blockchain-based governance and AI agent orchestration enable scalable, auditable, and institutionally legitimate command and control for complex coalition operations — including the governance of autonomous physical systems?

BASTION is the answer.

Not a complete answer. Not a production-ready answer. But a working proof of concept that demonstrates feasibility across all three requirements embedded in the question.

Scalability: the NEAR Protocol sharding architecture, the LangGraph multi-agent orchestration framework, and the hybrid storage model are each chosen for their ability to scale. The current implementation handles a single exercise scenario. The architecture is designed to handle more.

Auditability: every governance decision, every authority delegation, every resource employment check is recorded on the NEAR blockchain. The audit trail is not a log file someone controls — it is an immutable ledger that any participant can verify independently.

Institutional legitimacy: the DAO governance model removes the requirement for trust in any single institution. A coalition partner does not need to trust BASTION, or the nation that developed it, or any specific organizational actor. They need only trust the smart contracts they can read and the blockchain whose state they can verify. Institutional legitimacy does not require institutional trust. It requires institutional verifiability.

And for the autonomous physical systems requirement: the opening demonstration was not a concept video. That was BASTION governing a physical robot through a mission — planning it, authorizing it, pausing it when the robot exceeded its delegated authority, and resuming it when human judgment authorized continuation.

The question asked whether this was possible. BASTION demonstrates that it is.

**DEMO CUE:** Second screen: BASTION running — the live system is the answer. Navigate to any tab that shows the planning environment in active use. If Ironclaw is visible, better. If the COP is visible, better still. The point is that the system is alive and running as the presenter closes the argument.

---

### Slide 25: Q&A

Thank you. The system is live on the second screen — I am happy to demonstrate any capability you would like to explore. Questions?

**DEMO CUE:** Second screen: BASTION remains running throughout Q&A. Navigate to whatever tab is most useful for the first anticipated question — if the audience has been engaged with physical autonomy, the COP tab or robot bridge page. If governance has been the focus of questions during the briefing, a DAO proposal view. Keep the system ready for live demonstration of any capability discussed. The second screen is an asset during Q&A — not a background.

---

## Annex Slides

---

### Slide A1: Visual Glossary

This is your reference. Every technical term in the briefing is defined here in plain language. You do not need to memorize these definitions — that is what this slide is for. If anything in the deck raised a "wait, what does that mean?" reaction, the answer is here.

Notice the three categories: Blockchain and Web3 terms at the top, military doctrine terms in the middle, and AI and data terms at the bottom. BASTION sits at the intersection of all three — that is what makes it architecturally novel. Most systems in this space speak either military doctrine or blockchain or AI. BASTION's contribution is a coherent architecture that speaks all three simultaneously.

---

### Slide A2: Knowledge Graph Deep-Dive

The knowledge graph is what separates BASTION from a document management system or a chat interface. When you upload an OPORD into BASTION, the AI does not just store the file — it reads it, extracts every entity mentioned, identifies the relationships between those entities, and writes that structure into a graph database.

The result is machine-readable situational awareness. BASTION knows that the 3rd Battalion is commanded by Colonel Park, that it is located at grid reference Sierra-7, that it participated in the operation at Objective Eagle on Day 4, and that Objective Eagle is 12 kilometers from the nearest logistics support area. Those are not separate facts stored in separate documents — they are connected nodes in a graph that any agent or staff officer can traverse.

The schema uses seven node types: persons, organizations, locations, equipment, events, documents, and concepts. Relationships between nodes use labeled edges. Every node carries a confidence score and a provenance link back to the source document it was extracted from.

The graph grows over time. Early in the planning cycle it is sparse — a few hundred nodes from initial documents. As the operation proceeds and new intelligence arrives, new events are ingested, and the graph densifies. By execution phase, it reflects the accumulated knowledge of the entire staff.

Technical implementation: Neo4j graph database with JSON-LD schema, isolated per problem set using subspace partitioning. Graph queries use Cypher. Agent access is through a REST API layer that enforces workspace boundaries.

**DEMO CUE:** Second screen: Navigate to the Understand tab, open the brain graph visualization, click on a unit entity to show its relationships, traverse to a linked location or event. Show the confidence score and source document link on an entity detail panel.

---

### Slide A3: Agent Architecture Deep-Dive

BASTION has 131 named AI agents. That number is not arbitrary — it maps to the actual organizational structure of a joint planning staff as defined in JP 5-0. Every directorate, every functional role, every specialized planning function has a corresponding AI agent.

The taxonomy breaks into three groups. First, the core directorate agents: these are always-on, tied to the six major staff directorates — Intelligence, Operations, Logistics, Plans, Communications, and Command. Second, the 102 JPP staff role agents: these are on-demand specialists that activate when a specific planning task requires their expertise. Third, Ironclaw — the Chief of Staff agent that coordinates all the others and maintains the persistent awareness that the directorate agents lack.

Orchestration uses LangGraph — a Python framework for building stateful agent workflows as directed graphs. Each workflow is a directed acyclic graph of agent steps. Some steps execute in parallel when outputs are independent. Human decision gates are explicit nodes in the graph — the workflow does not proceed past a gate until the human approves.

Multi-model design: not every agent uses the same AI model. Complex analytical tasks like COA development use large context models. Classification and entity extraction use faster, cheaper models. The orchestrator selects the appropriate model for each step. This reduces cost and latency without sacrificing capability where it matters.

Agent memory: agents within a single workflow share context through the LangGraph state object. Cross-session memory is routed through Ironclaw's persistent memory graph. Agents do not hallucinate previous decisions because Ironclaw writes them to the knowledge graph — where they persist and are queryable.

**DEMO CUE:** Second screen: Navigate to the Agent Hub tab or any planning tab where an agent team is active. Show the agent activity stream — each agent's status, its current task, and its output. If a workflow is in progress, show the dependency graph of agent steps with status indicators.

---

### Slide A4: Ironclaw Chief of Staff Deep-Dive

Ironclaw is not a chatbot. You do not open a chat window and ask Ironclaw questions. Ironclaw operates on a continuous 60-second polling loop — every minute, whether or not anyone is talking to it, Ironclaw analyzes the current state of the planning environment, cross-references it against what it knows from the persistent memory graph, and determines whether anything requires the commander's attention.

If something requires attention, Ironclaw surfaces a decision card in the decision drawer — a brief, structured summary of what was found and what options are available. The commander reviews and responds. That response is then written back to the memory graph, where it informs all future Ironclaw behavior.

This is the Chief of Staff function. A good Chief of Staff does not wait to be asked. They track the operational environment, anticipate requirements, coordinate staff effort, and surface issues before they become crises. Ironclaw does exactly this — for every tab, every workflow, every active planning cycle simultaneously.

The persistent memory graph — built in Phase 57 — is what makes Ironclaw adaptive rather than stateless. Without memory, every session starts from scratch. With memory, Ironclaw accumulates a model of how this specific commander thinks, what their standing preferences are, which decisions they have made and why, and which approaches have worked. Over time, the suggestions become more relevant and the friction of planning decreases.

Phase 55 adds the operational design coordination capability — Ironclaw systematically works through the operational design framework as Chief of Staff would, obtaining and validating inputs from the staff, synthesizing them into the design framework, and flagging gaps for commander attention. This is not an interview — it is staff coordination, conducted by Ironclaw in its Chief of Staff role.

Auth scoping: each user's Ironclaw memory is isolated. Ironclaw is not a single shared agent — it is an agent that presents differently to each authorized user based on their role, their problem set access, and the accumulated memory of their working relationship.

**DEMO CUE:** Second screen: Open any planning tab, show Ironclaw in the decision drawer. Demonstrate a proactive suggestion — open the notification, show its context, show the response options. Navigate to the Memory tab in the Ironclaw drawer to show the persistent memory graph — individual memory items with their timestamps and context tags.

---

### Slide A5: Smart Contract Architecture Deep-Dive

The smart contract is the policy enforcement layer that makes BASTION's authority claims verifiable rather than declarative. When any agent or staff officer wants to take an action involving a resource — deploy a robot, access classified intelligence, task a coalition asset — that request is checked against the resource's on-chain caveats before the action is permitted.

The `ResourceCaveats` struct is the data structure that stores those caveats on the blockchain. It has five fields: classification level, releasability by nation code, rules of engagement tier, geographic bounds, and time windows. These are not soft attributes in a database that an administrator can override. They are on-chain — changing them requires a signed transaction from an authorized account, which creates an immutable record in the blockchain history.

The authorization check is sequential. Every field is checked in order. A denial at any point immediately returns — with a denial reason and an audit record written to the blockchain. That audit record is the accountability mechanism. A commander cannot authorize an action, deny authorizing it, and have the blockchain agree with the denial. The record is permanent.

Phase 58 extended this to on-chain caveats specifically — moving the caveat storage from PostgreSQL into the smart contract. This is architecturally significant: the authoritative source of truth for employment restrictions is now on a public blockchain, not in a database that the operator controls. Coalition partners do not need to trust the operator's database. They verify against the blockchain directly.

The contract is deployed at `did.bastion.testnet` on the NEAR testnet. Every authorization check, every caveat update, and every denial is visible in the testnet explorer. That transparency is intentional — it is the accountability proof that makes human control over lethal decisions verifiable.

**DEMO CUE:** Second screen: Navigate to the Resources tab, show the SecurityCaveatsSection for a resource, show the on-chain caveats panel with classification, releasability, and ROE tier. Alternatively, open the NEAR testnet explorer at did.bastion.testnet and show recent contract calls in the transaction history.

---

### Slide A6: DAO Governance Mechanics Deep-Dive

The DAO governance model is not a metaphor for good governance — it is literally how authority is exercised in BASTION. Every decision that has operational or legal consequence is processed through a governance proposal that is voted on, recorded on the blockchain, and cannot be altered after the fact.

The proposal lifecycle has four stages. First, creation: any authorized account can create a proposal, specifying the action requested, the authority tier it falls under, the voting period, and the required quorum. Second, voting: eligible voters at that tier can cast votes during the open period. Each vote is an on-chain transaction — permanently recorded. Third, resolution: at the deadline, the contract checks quorum and tally. If quorum is not met, the proposal expires — inaction is a decision, and it is recorded. If quorum is met and the vote passes, the proposal executes. Fourth, execution: the smart contract automatically performs the associated action and writes the final audit record.

Quorum rules vary by tier. Theater-level decisions can be made by a single senior commander. Coalition-level decisions require affirmative votes from all contributing nations. This is designed to mirror actual doctrine — speed at tactical echelons, deliberation at strategic and coalition echelons.

The strike authorization invariant is the hardest rule in the system. There is no default authorization for lethal force. There is no automation that can generate it. There is no path through the codebase that produces a strike authorization without an explicit affirmative human vote at the responsible tier. This is not a policy — it is a property of the smart contract that is verifiable by anyone who reads the code.

**DEMO CUE:** Second screen: Navigate to the Decide tab, show the governance dashboard, show a sample proposal in the voting or executed state. Show the proposal detail with vote history and the on-chain transaction link. If available, show the Tier visualization showing which commanders are in which governance tier.

---

### Slide A7: DID Registry and Coalition Caveats Deep-Dive

The DID — Decentralized Identifier — is BASTION's universal identity mechanism. Every entity that touches the operational environment has a DID: every robot, every intelligence report, every planning document, every staff officer, every AI agent. The DID connects the entity to its caveats, its authorization rules, and its operational history on the blockchain.

The DID format follows the W3C DID specification: `did:near:{account}#{resource}`. The NEAR account is the owner — the only account that can update the DID's caveats. The resource suffix distinguishes multiple assets owned by the same account.

BASTION defines five plugin types: hardware, software, personnel, data, and composite. Hardware DIDs cover physical assets — robots, sensors, platforms. Software DIDs cover BASTION modules and agent instances. Personnel DIDs cover every human with system access. Data DIDs cover every document and intelligence product. Composite DIDs cover aggregated entities like joint task forces — and they automatically inherit the most restrictive caveat from all their member DIDs.

The coalition sharing example makes the releasability field concrete. A US-generated intelligence product is marked with its classification and a releasability array listing the five EYES nations. When an Australian analyst requests access, the contract checks whether "AUS" is in the releasability array. It is — access granted. When an unauthorized nation requests access, the check fails — access denied, with an immutable denial record on the blockchain.

This is how BASTION solves the coalition information sharing problem without requiring bilateral agreements between every pair of nations. The sharing rules are encoded in the resource's DID. Any party with access to the NEAR testnet can verify the rules and the access history.

**DEMO CUE:** Second screen: Navigate to the Resources tab, select a resource, show its DID and the full caveat display. Show the releasability array and the ROE tier. If testnet explorer is accessible, show the DID registration transaction and the caveat history.

---

### Slide A8: Robot Integration Deep-Dive

The physical autonomy tier is where BASTION's planning outputs become physical action. The architecture has three tiers: cloud, bridge, and edge. Each tier has a distinct role, and the system is designed to continue functioning even when the connections between tiers are intermittent or degraded.

The cloud tier is the BASTION application itself — the knowledge graph, the agent hub, the DAO governance layer, and Ironclaw. This is where decisions are made and where authority resides.

The Docker bridge is the critical middle layer. It runs as a container on a local network — physically close to the robots. The bridge has two jobs: translate cloud commands into robot-executable instructions, and enforce the authority chain before forwarding any command. Before the bridge forwards any action to the edge, it confirms that the action has been authorized through the DAO governance process. The bridge is not just a relay — it is a policy enforcement point. If the robot loses connection to the cloud, the bridge queues commands and re-syncs when connectivity is restored.

The edge is a Jetson Orin Nano paired with a Sphero RVR+ platform. The Jetson runs a YOLOv8 computer vision pipeline — real-time object detection and classification. The RVR+ provides mobility. Together they execute the formation and movement commands issued from the cloud through the bridge.

The six doctrinal formations map directly to standard military doctrine for small unit tactics. BASTION does not invent new tactics — it provides a controllable interface for commanding formations that military units already know.

The DAO-governed engagement chain is the key constraint: the bridge will not forward any lethal action command without a governance-approved authorization token. That token must be generated by an explicit DAO vote — it cannot be manufactured by any agent or automation layer.

**DEMO CUE:** Second screen: Show the robot control panel in BASTION (if robot is physically connected). Show the formation selector and the authority chain status. If the robot is live, demonstrate a formation command and show the authorization check occurring before movement. Alternatively, show the Docker bridge container logs demonstrating the authority check.

---

### Slide A9: COP Generation Deep-Dive

The Common Operating Picture in BASTION is not drawn by a map sergeant. It is generated by AI from the planning documents already in the system.

The pipeline has six stages. First, the planning document is pre-processed — chunked into sentences, normalized. Second, named entity recognition extracts every unit, person, location, and piece of equipment mentioned. Third, relationship extraction links those entities to each other and to existing knowledge graph nodes. If the document mentions the 3rd Battalion, and the 3rd Battalion is already in the graph from a previous document, they are merged — the COP gets richer, not wider.

Fourth, each extracted entity is mapped to a MIL-STD-2525D symbol code. MIL-STD-2525D is the military standard for tactical symbols — it encodes affiliation, echelon, function, and status into a symbol structure. BASTION generates these codes programmatically from the entity's context: a "3rd Battalion" with "hostile" context gets a red hostile unit symbol; the same entity in a "friendly" context gets a blue friendly symbol.

Fifth, SVG symbols are generated to spec. Sixth, the symbols are placed on the map using geocoded coordinates and linked to their knowledge graph nodes — so clicking a symbol shows everything BASTION knows about that entity.

The perspective toggle and phase slider are the two key navigation tools. The perspective toggle filters by affiliation — the same plan viewed from friendly versus adversary perspective. The phase slider filters by the temporal phase tag, showing how the operational picture evolves across the six Pacific Strategy AY26 phases.

The key claim: BASTION's COP reflects what the staff has planned and what intelligence has been gathered. It is not ground truth — it has confidence scores. But it is generated automatically, which means it is always current with the latest documents in the system.

**DEMO CUE:** Second screen: Navigate to the COP tab. Show the map with MIL-STD-2525D symbols. Demonstrate the perspective toggle (switch between friendly and adversary view). Use the phase slider to advance through Pacific Strategy AY26 phases. Click on a symbol to show the entity detail panel and its knowledge graph connections.

---

### Slide A10: Security Architecture Deep-Dive

The zero trust architecture in BASTION is not a firewall configuration — it is a verification model that asks four questions about every consequential action and uses cryptographic mechanisms to answer them.

Working from the inside out: the innermost ring is TEE attestation — hardware-level proof that the AI processing intelligence data is running in an unmodified, trusted execution environment. Intel SGX and TDX, and the Phala Network concept for cloud TEEs, provide this capability. I want to be explicit: TEE attestation is a design goal in BASTION, not yet implemented. It represents the full security architecture BASTION is designed toward.

Layer 4 is blockchain proof — the immutable transaction history on NEAR. Every governance decision, every caveat change, every authorization event is recorded as a blockchain transaction. This is the tamper-evident audit log. No one can alter it — not the system operator, not the platform provider, not a malicious insider. The record is permanent and public.

Layer 3 is smart contract policy enforcement — the caveat check on every resource employment request. Five fields, checked in sequence, with a denial record written if any check fails. This is what turns policy into math.

Layer 2 is DAO governance — the collective authority validation. Even if the smart contract says a resource can be employed, the action must have passed through the appropriate governance tier. An authorized resource without an authorized proposal is still unauthorized.

Layer 1 is the AI advisory layer — the recommendation engine. It sits outside all the verification layers. It advises. It does not authorize. The human decision gate between the AI recommendation and the governance vote is the architectural boundary between advice and authority.

Trust in BASTION does not terminate at policy or training or good intentions. It terminates at math — at cryptographic proof and immutable records that any party can verify.

**DEMO CUE:** Second screen: Navigate to the Decide tab and show the verification status indicators — which layers are active for a current decision. Show the governance proposal with its on-chain transaction link. Show the smart contract caveat check result for a resource. Narrate each layer as you show the corresponding UI element.

---

### Slide A11: Live Demo Script — Understanding Phase

I am going to walk you through what happens when a planning staff uploads their first document into BASTION. Everything you are about to see is automated — I am not drawing anything, not tagging anything, not entering data into a form.

[Navigate to Understand tab]

The brain graph starts empty. As documents are ingested, entities and relationships are extracted and written into this graph. Let me show you what that looks like with the Pacific Strategy AY26 scenario already loaded.

[Show populated graph]

Each node is an entity the AI extracted from a planning document. Each edge is a relationship the AI identified between entities. The graph you are looking at represents the accumulated intelligence of every document the staff has uploaded.

[Click on a unit entity]

Here is the 3rd Battalion. Confidence score 0.87 — extracted from this specific OPORD section. BASTION knows it is commanded by Colonel Park, that it is located at Grid Sierra-7, and that it participated in the operation at Objective Eagle on Day 4.

[Navigate to source document]

Click that source link and you are back at the original sentence. The entire knowledge graph is traceable to source. Nothing is fabricated.

---

### Slide A12: Live Demo Script — Planning Phase

Moving from understanding the environment to designing the operation. The Design tab is where the staff works through the operational design framework — CoG analysis, lines of effort, operational approach.

[Navigate to Design tab]

The AI agents have already run the Center of Gravity analysis based on the intelligence in the knowledge graph. Ironclaw coordinated the J2 and J5 agents to produce this draft. The staff officer's job is to review it, challenge the assumptions, and approve or modify.

[Show CoG analysis]

This is not the AI replacing the staff. The AI cannot exercise judgment on what matters strategically — that requires human intent, doctrine, and accountability. The AI produces the analysis quickly and consistently. The staff officer applies judgment.

[Open Plan tab]

The plan tab structures the campaign — phases, tasks, forces, timing. When I ask BASTION to generate the OPORD Situation paragraph, it queries the knowledge graph for the current order of battle, the intelligence summary, and the CoG analysis, and synthesizes a paragraph that the staff officer can review and sign.

[Show OPORD section]

This draft took three seconds to generate. A staff officer writing this from scratch in a conventional planning process takes hours. BASTION compresses the planning timeline — not by cutting corners, but by eliminating the mechanical work of synthesis.

---

### Slide A13: Live Demo Script — Governance and Execution

The Decide tab is where the governance layer becomes visible. Every proposal that has been voted on is here — with its full voting history and a direct link to the blockchain record.

[Navigate to Decide tab, show a completed proposal]

Click on that transaction link. This is the NEAR testnet explorer. This record shows exactly who voted, when, and how. It shows the proposal text and the outcome. No one in the system — not the administrator, not the platform provider — can alter this record. It exists on a distributed blockchain.

[Show the 5-tier visualization]

Five tiers of authority. Each tier has its own quorum requirement and voting period. The smart contract enforces the boundaries between tiers. A commander at Tier 3 cannot vote on a Tier 1 proposal. A Tier 1 proposal cannot execute until the Tier 1 quorum is met. These are not administrative rules — they are code.

[Navigate to Resources, show caveat detail]

This resource is a UAV platform. Its DID is registered on the blockchain. Its caveats specify that it is classified at the SECRET level, releasable to Five Eyes nations, authorized for ROE Tier 2 employment, and restricted to this geographic bounding box. Every time an agent or staff officer requests this asset, the smart contract checks all five caveat fields before authorizing.

[If robot present: show execution]

The robot is executing a wedge formation. Before that command reached the robot, the Docker bridge confirmed the DAO authorization token. The robot does not move without it.

---

### Slide A14: Companion Whitepaper Overview

Everything you have seen today is documented in full technical depth in the companion whitepaper. The deck gives you the story. The whitepaper gives you the proof.

Six chapters: introduction and methodology, background literature, full system architecture, technology selection rationale, evaluation findings, and doctrinal implications. The appendices include the actual smart contract code, the complete 131-agent taxonomy, and the full knowledge graph schema.

Citations follow Chicago 18th edition footnote format throughout. This is the academic record — every architectural claim is sourced, every design decision has a citation chain back to the relevant literature.

If you want to verify anything I have shown today, the whitepaper is where to look. If you want to understand why we made a specific technology choice, the tradeoffs chapter explains it with citations. If you want to understand the doctrinal implications in depth, Chapter 6 develops that argument from first principles.

I have copies available. Ask me afterward.

---

### Slide A15: Technology Comparison Matrix

If any technology choice in this briefing prompts the question "why not X instead?" — this slide is the answer.

Four domains where BASTION made consequential technology choices. Blockchain: NEAR over Ethereum for cost, over Solana for stability, over Hyperledger for public verifiability. A private permissioned blockchain like Hyperledger cannot provide coalition-verifiable audit trails — the partner nations have to trust the operator's black box. That defeats the purpose.

AI orchestration: LangGraph over LangChain, AutoGen, and CrewAI. The deciding factor is human-in-the-loop as a first-class citizen of the orchestration model. BASTION's governance model requires explicit human decision gates at defined points in every consequential workflow. LangGraph treats those gates as nodes in the directed graph. The other frameworks treat them as workarounds.

Storage: the hybrid architecture over pure on-chain or pure off-chain. Pure on-chain is cost-prohibitive and privacy-problematic — every OPORD section on a public blockchain. Pure off-chain provides no external verifiability. The hybrid model puts governance events and caveats on-chain (where they need to be verifiable) and keeps operational data in PostgreSQL (where it needs to be fast and private).

Identity: W3C DIDs over OAuth, SAML, and CAC/PKI. The core requirement is self-sovereign identity that integrates natively with blockchain and supports on-chain caveat storage. No other standard meets all three requirements simultaneously.

---

### Slide A16: Pacific Strategy AY26 Scenario Overview

Every demonstration in this briefing uses the Pacific Strategy AY26 exercise scenario. Understanding what that scenario is gives context to everything you have seen.

Pacific Strategy AY26 is an Indo-Pacific regional scenario built around a Taiwan Strait contingency. Six phases: Competition, Crisis, Conflict Day 4, Conflict Day 10, Conflict Day 22, and Negotiation. The scenario runs from background tension through full kinetic operations to negotiated endgame.

The scenario involves a five-nation coalition — Five Eyes plus Japan — which makes it specifically useful for demonstrating BASTION's coalition C2 capabilities. You have multiple nations, multiple classification levels, multiple releasability constraints, and multiple governance tiers operating simultaneously.

The scenario data in BASTION includes approximately 200 planning documents — OPORDs, FRAGOs, intelligence reports, and assessment documents spanning all six phases. That document set generates over 400 knowledge graph nodes, which populates the brain graph you saw in the Understand tab.

The three-tier exercise phases — Competition, Conflict, and Negotiation — each produce distinct COP pictures. The phase slider you saw in the COP demo navigates across those three pictures, showing how the operational environment evolves from pre-conflict through high-intensity operations to negotiated resolution.

Every governance proposal, every robot formation exercise, and every OPORD generation you have seen was conducted against this scenario data. It is not a contrived demo — it is a coherent operational scenario exercising the full BASTION capability set.

**DEMO CUE:** Second screen: Show the scenario files directory or the scenario selection screen. Navigate to the COP phase slider and scroll through all six phases to show the evolving operational picture. If multiple scenario documents are loaded, show the document list with phase annotations.

---

### Slide A17: Research Methodology and Approach

The research methodology is Design Science Research — a methodology from information systems research specifically designed for building and evaluating novel artifacts.

The six-phase cycle applies: problem identification, objective definition, design and development, demonstration, evaluation, and communication. BASTION is the artifact. The cycle is iterative — each development phase feeds learning back into the next phase's design.

Why Design Science Research rather than experimental or case study methodology? Because the research question asks whether a specific technical architecture can demonstrate a specific set of capabilities. That is not a hypothesis to test against a control group — it is a design problem. The contribution is the artifact itself and the knowledge embedded in its construction.

BASTION was built in 59 development phases, each planned and executed with explicit objectives, verification criteria, and documentation. That iterative structure is itself a methodological choice: it allows the architecture to evolve as design decisions are validated or revised, rather than committing to a full design upfront.

The artifact is a prototype. I want to be precise about what that means: it demonstrates the feasibility of the architectural approach, it exercises the full capability set on a realistic scenario, and it surfaces the limitations that would need to be addressed at production scale. It is not a claim that the system is ready for operational deployment. The whitepaper's evaluation chapter documents both what the prototype achieves and the seven significant limitations that constrain its current scope.

The research contribution is architectural: BASTION demonstrates that DAO governance, AI agent orchestration, decentralized identity, and physical autonomy can be integrated into a coherent command and control platform. Whether that integration is sufficient for operational deployment is a question for future research.
