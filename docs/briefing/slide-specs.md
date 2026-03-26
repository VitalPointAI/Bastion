# BASTION Briefing Deck — Slide Specifications

**Version:** 1.0
**Date:** 2026-03-26
**Author:** Phase 59 — Briefing Deck Slide and Image Specs
**Deck Title:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance

---

## Document Purpose and Format

This document specifies every slide in the BASTION core briefing deck (slides 1-25) and annex (slides A1-A18). Each specification is complete enough for a presentation designer to reproduce the slide without additional context, and for a presenter to deliver the script without further preparation.

**This deck accompanies a live BASTION demo on a second screen.** The demo screen runs the full platform throughout the briefing. DEMO CUE notes in each slide spec indicate what the presenter should show on the second screen at that moment.

---

## Color Palette Reference

| Role | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| Primary Blue | `#2563EB` | blue-600 | Headings, primary UI elements, architecture blocks |
| Sky Blue | `#0EA5E9` | sky-500 | Secondary accents, data flow lines |
| Cyan | `#06B6D4` | cyan-500 | Blockchain/crypto elements, DID references |
| White | `#FFFFFF` | white | All backgrounds |
| Light Gray | `#F8FAFC` | slate-50 | Slide background variant |
| Dark Text | `#0F172A` | slate-900 | Body text, speaking scripts |
| Muted Text | `#64748B` | slate-500 | Captions, sub-labels |

**Rule:** Never use dark backgrounds. Never use tactical/military dark aesthetic. BASTION on the second screen provides the tactical visual; the deck is the clean analytical layer.

---

## Spec Format

Each slide specification follows this structure:

```
## Slide N: [Title]

### Purpose
[What cognitive work this slide does for the audience]

### Visual Layout
[Describe the slide composition — what appears where]

### Image Prompt
[Full copy-paste ready prompt for Midjourney/DALL-E — OR "No AI image — see Diagram Spec"]

### Diagram Spec
[If applicable — precise enough to reproduce in any diagramming tool]

### Speaking Script
[Word-for-word what the presenter says]

### DEMO CUE
[Which BASTION screen/tab to show on second monitor — or "No demo cue for this slide"]

### Transition
[What happens visually when moving to the NEXT slide]
```

**Image Prompt Requirements:** Every AI-generated image prompt includes: (1) subject/composition, (2) style reference, (3) color palette with hex values, (4) mood/tone, (5) aspect ratio, (6) specific elements, (7) explicit avoidances.

---

## Narrative Arc

| Sequence | Slides | Theme |
|----------|--------|-------|
| Opening | 1-2 | Demo hook + research anchor |
| Problem Space | 3-5 | Broken status quo + BASTION's answer |
| Architecture Roadmap | 6 | Map for the audience |
| Understanding the Environment | 7-8 | Knowledge graph + document intelligence |
| Planning and Designing | 9-10 | Doctrinal workflow + operational design |
| Governing Decisions | 11-13 | Smart contracts + DAO tiers + DIDs |
| Executing Autonomously | 14-15 | Physical autonomy + AI COP |
| Maintaining Trust | 16-17 | Training parity + verifiable zero trust |
| Architecture Synthesis | 18 | Full diagram — bookend |
| Closing Reflection | 19-22 | Tradeoffs, limits, doctrine, roadmap |
| Closing | 23-25 | Contributions + answer + Q&A |

---

## Slide Specifications — Core Deck (Slides 1-25)

---

## Slide 1: Decision Overmatch

### Purpose
Set the hook. The live demo has just run on the second screen. This slide appears as the presenter transitions from the demo to the explanation. The audience has watched a machine plan a mission, execute it autonomously, and pause to ask for authorization when its actions exceeded its delegated authority. Now we tell them how that works.

### Visual Layout
Full-bleed hero image occupying 80% of the slide. Title "Decision Overmatch" in large white sans-serif typography (bold, 72pt equivalent) centered in the lower third. Subtitle "BASTION — Blockchain Autonomous Strategy and Tactical Intelligence Operational Network" in smaller white text (24pt) below the title. A thin cyan horizontal rule separates title from subtitle. Bottom left corner: classification marker "UNCLASSIFIED // FOR OFFICIAL USE ONLY." Bottom right: date "March 2026."

### Image Prompt
Abstract network of interconnected decision nodes converging toward a single central command point, rendered in a clean tech visualization style — not tactical, not militaristic in aesthetic. Color palette: deep blue (#2563EB) nodes and network lines on a pure white (#FFFFFF) background, with cyan (#06B6D4) highlights on the converging central node and its immediate connections. Style reference: modern SaaS product launch keynote imagery, tech visualization, data network graph art. Mood: controlled authority, precision, calm power — the sense that complexity has been organized. Aspect ratio: 16:9. Specific elements: the network radiates from center-right, nodes decrease in size toward edges, thin connection lines show hierarchy with the thicker lines closer to the center, subtle military command post silhouettes faintly visible at the far edges — impressionistic, not literal. Avoid: dark backgrounds, gritty military aesthetic, camouflage patterns, dramatic lighting, photorealistic military equipment, explosion imagery, anything that reads as propaganda.

### Diagram Spec
No diagram — AI-generated hero image (see Image Prompt above).

### Speaking Script
You just watched a machine execute a tactical mission. It navigated terrain, engaged designated targets, coordinated with adjacent units — and then it stopped. It stopped because the next action exceeded the authority it had been delegated by the chain of command. It stopped and asked.

That pause — that deliberate check — is the most important thing you saw. Anyone can build a robot that acts. Building a robot that knows when to stop and why requires something different: a governance architecture baked into the system itself, not bolted on afterward as policy.

What I'm going to do in the next thirty minutes is unpack exactly how that works. BASTION — Blockchain Autonomous Strategy and Tactical Intelligence Operational Network — is a research platform that answers a specific question about coalition command and control in the age of autonomous systems. You've seen the end state. Let me show you the system underneath it.

This is not a product pitch. BASTION is a research prototype. It demonstrates what is possible, identifies what is hard, and establishes an architectural pattern that the research community — and ultimately, the operational community — can build on. If you leave today with one takeaway, let it be this: you do not have to choose between machine speed and human authority. BASTION proves you can have both, if you build it right from the start.

### DEMO CUE
BASTION running on second screen — full platform visible at Understand tab or landing screen. Presenter has just completed the live demo sequence showing: (1) Pacific Strategy AY26 scenario loaded, (2) Ironclaw surfacing a planning recommendation in the Decide tab, (3) AI agents executing the recommended action, (4) robot bridge showing physical execution, (5) robot pausing at authority gate. The deck opens as that pause moment is frozen on screen.

### Transition
Fade to Slide 2. The hero image fades to white, leaving the title text briefly before dissolving.

---

## Slide 2: The Research Question

### Purpose
Academic anchor. Frames the entire briefing as answering a specific, falsifiable research question. This signals to the academic evaluator that the work is defensible and to the defense evaluator that there is intellectual rigor behind the demonstration. It also sets expectations: this is not a features tour, it is an argument.

### Visual Layout
Clean white slide. The research question displayed in large, centered typography — approximately 36pt, bold, dark text (#0F172A), with line breaks for readability. Below the question, a thin blue rule (#2563EB). Below the rule, three brief framing lines in normal weight, 18pt. Bottom right: "UNCLASSIFIED" marker. No decorative elements — this slide is about the weight of the question landing.

The research question in full:

> **"Can AI-augmented Decentralized Autonomous Organizations provide a scalable, auditable, and institutionally legitimate framework for human control over autonomous systems in multi-domain coalition military operations?"**

Below the rule:
- "Research platform: BASTION (prototype, proof of concept)"
- "Demonstrated at: Pacific Strategy AY26 — Indo-Pacific contingency"
- "This briefing: the answer, the evidence, and the caveats"

### Image Prompt
No AI image — clean text slide.

### Diagram Spec
No diagram — typography only.

### Speaking Script
Every piece of research begins with a question. This is ours.

Can AI-augmented Decentralized Autonomous Organizations — the governance structures we will walk through in detail — provide a scalable, auditable, and institutionally legitimate framework for human control over autonomous systems in multi-domain coalition military operations?

That question has three specific requirements embedded in it. Scalable: it must work at coalition scale, not just for a two-person team. Auditable: every decision must be traceable, permanently. Institutionally legitimate: the framework must be acceptable to military institutions with their existing doctrine, law of armed conflict obligations, and chain of command structures.

These are not soft requirements. "Scalable" rules out approaches that work in a lab but collapse when twenty partner nations join the operation. "Auditable" rules out verbal authorization and policy documents — it requires cryptographic proof. "Institutionally legitimate" rules out any architecture that asks commanders to surrender authority; it requires the architecture to enforce and record the authority structure that already exists.

BASTION is our answer. It is a prototype — not a production system, not a program of record, not ready for operational deployment. It demonstrates that the answer is yes, under defined conditions, with known limitations. And it establishes the architecture pattern that could be scaled.

### DEMO CUE
Second screen: BASTION idle on the Understand tab — the brain graph visualization visible in background, showing entity nodes from the Pacific Strategy AY26 scenario. Presenter does not click anything — the visualization running in the background reinforces that this is a live, running system with real scenario data.

### Transition
Slide appears in place — no dramatic transition. The research question should feel like a statement of record.

---

## Slide 3: Coalition C2 Coordination Crisis

### Purpose
Problem slide 1. Establishes the broken status quo of coalition command and control. The audience must feel the weight of the problem before they hear the solution. This slide paints the crisis in vivid, real-world terms — not hypothetical, not academic. Three specific problems: data overload, interoperability gaps, and the human decision bottleneck.

### Visual Layout
Left side (60%): Large conceptual hero image showing fragmented, overwhelmed network (see Image Prompt). Right side (40%): Three problem statements as a numbered vertical list with brief explanations. Each problem has a bold headline and two supporting sentences. Color: problem numbers in blue (#2563EB), headline text dark (#0F172A), body text in muted slate. Title "The Coordination Crisis" at top of right column in blue, 28pt.

Problem list:
1. **Data volume exceeds human capacity** — Modern multi-domain operations generate intelligence at rates no staff can manually process. Analysts spend coordination time, not judgment time.
2. **Coalition partners cannot interoperate** — Each nation uses different planning tools with incompatible schemas. National caveats require manual validation at every coordination point, with no permanent record.
3. **Adversaries operate inside the decision cycle** — Hierarchical human-only C2 cannot compress below the time required for human coordination overhead. An adversary using machine-speed coordination wins the race.

### Image Prompt
Conceptual visualization of a fragmented command network in crisis — fractured, overwhelmed, disconnected. Central human figure (silhouette only, abstract, not photorealistic) submerged in cascading data streams represented as thin lines flowing in from all directions, overwhelming the figure's ability to process them. Connected to this figure, a network of command nodes — each showing partial connectivity to others with broken or absent connections indicated by dashed lines or missing links. Color palette: muted reds (#DC2626, desaturated to #EF9999) for the data overflow streams, cool grays (#94A3B8) for the fragmented network connections, white (#FFFFFF) background. Style: clean data visualization, infographic aesthetic, not gritty. Mood: overwhelm, fragmentation, loss of coherence — but clinical, not emotional. Aspect ratio: 16:9. Specific elements: the broken network lines should have visible gaps; the data streams should converge on the central human point from multiple directions; show at least five disconnected command nodes in the background. Avoid: photographs, literal military imagery, blood/violence, dramatic lighting, dark backgrounds.

### Diagram Spec
No separate diagram — the image carries the visual argument.

### Speaking Script
Between 2017 and 2024, the volume of intelligence reporting available to a joint force headquarters increased by orders of magnitude. Satellite imagery, signal intelligence, open-source data feeds, partner nation reports, commercial sensors — the information is there. The problem is not collection. The problem is processing.

A typical joint force staff officer working intelligence fusion spends roughly sixty percent of their time not on analysis, but on coordination: formatting products for adjacent units, reconciling conflicting assessments from different sources, validating whether partner nation data meets release conditions, and updating shared documents that will be out of date before they arrive.

Coalition operations multiply this problem by the number of partners. Every nation brings its own planning tool with its own data schema. Coordination happens in meetings that generate no permanent record. After the operation, "did they honor the coalition commitment?" is frequently an unanswerable question — not because anyone was dishonest, but because the coordination mechanism left no trace.

And while the friendly force headquarters runs its human-speed coordination loop, a peer adversary with autonomous coordination tools operates inside that cycle. Not faster by minutes — faster by an order of magnitude. The decision that takes a friendly staff three hours to staff, coordinate, and authorize happens in minutes on the other side.

This is not a technology problem waiting for better software. It is an architectural problem. The answer requires a different kind of system.

### DEMO CUE
No demo cue for this slide. Presenter focuses on the problem statement — the second screen can remain on the Understand tab graph visualization from Slide 2.

### Transition
Fade to Slide 4. Brief pause after the final sentence of the script — "a different kind of system" — before advancing.

---

## Slide 4: The Autonomous Systems Governance Gap

### Purpose
Problem slide 2. Introduces the lethal autonomy governance gap — the second major unsolved problem that BASTION addresses. Who enforces the rules of engagement when machines act? Policy documents and RBAC (Role-Based Access Control) systems are insufficient. The audience needs to understand why existing approaches fail before they can appreciate the smart contract solution.

### Visual Layout
Split layout, 50/50. Left side: AI-generated conceptual image (see Image Prompt). Right side: Title "The Governance Gap" in blue 28pt. Below, a two-column table or comparison block:

Left column header: "What Exists Today"
- DoD Directive 3000.09 — written policy on autonomous weapons
- Role-based access control — who can access what system
- Rules of Engagement — written in orders, enforced by commanders
- Audit logs — optional, inconsistent, siloed by system

Right column header: "What This Requires"
- Enforceable policy — code that executes regardless of intent
- Authority-based governance — what action requires which authority level
- Machine-verifiable ROE — conditions checked by the system, not an operator
- Immutable audit trail — cryptographically verified, tamper-proof record

Below the comparison: one bold framing line: "Policy documents tell machines what they should do. Smart contracts tell machines what they can do — and they don't ask."

### Image Prompt
A precision balance scale rendered in clean tech visualization style. On the left pan: an abstract representation of an autonomous system — clean geometric drone silhouette or robotic form, rendered in blue (#2563EB), precise and sharp. On the right pan: a policy document represented as a stack of paper forms dissolving, their edges blurring and fading into the background, rendered in muted gray (#94A3B8). The scale is visibly unbalanced — the autonomous system side is heavier, the policy side is lighter and fading. Background: pure white (#FFFFFF). Style: isometric infographic, editorial illustration, clinical precision aesthetic — not photorealistic. Color palette: blue (#2563EB) for the autonomous system elements, muted gray (#94A3B8) for the dissolving policy, white background. Mood: imbalance, inadequacy of existing approach, the gap between capability and governance. Aspect ratio: 16:9. Specific elements: the scale's central pivot should be rendered in cyan (#06B6D4) to draw the eye; fine lines connecting the scale arms to the pans for precision; the policy documents should show visible dissolution/pixel-scatter effect on their edges. Avoid: dramatic lighting, dark backgrounds, actual weapons imagery, emotional content, literal photographs.

### Diagram Spec
No separate diagram — the split layout carries the comparison; the image carries the metaphor.

### Speaking Script
In 2012, the Department of Defense issued Directive 3000.09 — the foundational policy on autonomous weapons systems. It requires "appropriate levels of human judgment over the use of force." That is a good requirement. The problem is the word "appropriate." Who decides what is appropriate in the middle of an operation? How do you prove after the fact that the appropriate judgment was exercised? What happens when operational urgency creates pressure to bypass the judgment requirement entirely?

The honest answer is: nobody knows, because the policy document does not specify the enforcement mechanism. Policy tells machines what they should do. It does not — cannot — prevent them from doing otherwise when an operator decides the situation warrants it.

Role-based access control — the standard IT security approach of assigning permissions based on user roles — does not solve this problem either. RBAC governs access to systems. It does not govern the specific decisions made within those systems. An operator with "planner" role access can still plan anything. The system will not stop them.

What this problem requires is not better policy documents. It requires enforceable policy — governance logic embedded in the system architecture itself, that executes automatically regardless of operator intent, chain-of-command pressure, or operational urgency. It requires something closer to a machine-verifiable rule of law than a machine-readable checklist.

That is what BASTION's smart contract layer provides. We will walk through the specifics. But first — here is the core thesis.

### DEMO CUE
No demo cue for this slide.

### Transition
Brief pause after "here is the core thesis." Advance to Slide 5.

---

## Slide 5: The Approach — BASTION's Answer

### Purpose
Transition from problem to solution. Introduces BASTION's three-pillar thesis: AI accelerates coordination, DAOs enforce governance, humans provide judgment. This is the thesis statement of the entire research project. After two problem slides, the audience needs the relief of seeing the shape of the answer before diving into architecture.

### Visual Layout
Three-column layout on white background. Title at top: "BASTION's Thesis" in blue (#2563EB), 32pt bold. Three columns of equal width, each containing:
- Column 1: Brain/circuit icon (blue #2563EB) — headline "AI Accelerates" — subtext "131+ specialized agents process intelligence, surface decisions, and coordinate at machine speed so your staff can focus on judgment."
- Column 2: Shield/contract icon (cyan #06B6D4) — headline "DAOs Enforce" — subtext "Smart contracts on NEAR blockchain make authority requirements executable code — enforced automatically, recorded permanently."
- Column 3: Person/silhouette icon (blue #2563EB) — headline "Humans Judge" — subtext "Five-tier authority model with governance invariants: strike authorization always requires human approval at coalition level. Always."

Below the three columns: a horizontal connector arrow showing the flow: AI output → DAO gate → Human decision → DAO record. Small blue dots at each stage.

Bottom line in italics: "Research prototype — proof of concept — demonstrating what is architecturally possible."

### Image Prompt
No AI image for this slide — diagram carries the argument.

### Diagram Spec
Three-column layout with connecting flow diagram:

Column headers and icons:
- Column 1 (left): Icon = abstract neural network/brain nodes, blue (#2563EB), 48pt equivalent. Header = "AI Accelerates". Body = two-line description.
- Column 2 (center): Icon = abstract shield with a geometric contract/code symbol inside, cyan (#06B6D4), 48pt equivalent. Header = "DAOs Enforce". Body = two-line description.
- Column 3 (right): Icon = abstract human silhouette (minimal, geometric), blue (#2563EB), 48pt equivalent. Header = "Humans Judge". Body = two-line description.

Connecting arrow below columns: left to right, "AI Output" → [thin blue (#2563EB) arrow] → "DAO Gate" → [thin cyan (#06B6D4) arrow] → "Human Decision" → [thin blue arrow] → "Immutable Record". Each stage labeled with 10pt text below the connector.

Background: white (#FFFFFF). Column separators: thin light gray (#E2E8F0) vertical lines.

### Speaking Script
BASTION's answer to both problems can be stated in nine words: AI accelerates. DAOs enforce. Humans judge.

That is the thesis. Let me unpack what each element actually means in practice.

AI accelerates: We have deployed 131 specialized agents that operate continuously. They process incoming intelligence, extract entities and relationships, cross-reference sources, flag conflicts, draft assessment products, and surface decisions that require human attention. They do not decide. They accelerate — compressing the coordination overhead that currently consumes most of a staff officer's time. The human gets to spend their cognitive resources on judgment rather than formatting.

DAOs enforce: Decentralized Autonomous Organizations — smart contracts running on NEAR blockchain — are the governance layer. When I say "enforce," I mean the word precisely. Smart contract code executes automatically. It cannot be overridden by an operator who decides the situation warrants an exception. When the contract says "this action requires Tier 3 authorization," that requirement is not a note in an order — it is a gate that will not open without the required signature. The enforcement is mathematical.

Humans judge: The five-tier authority model defines exactly which humans authorize which decisions, at which levels. And three decision categories are permanently locked to human-only authority: strike authorization, strategic resource commitment, and national caveat exceptions. Not "preferred to have human review." Locked. The system will not proceed without it.

This is a prototype. It demonstrates that this architecture works. It also demonstrates where the hard problems are — and we will be honest about those before we're done. But first, let me give you a map of what we built.

### DEMO CUE
No demo cue for this slide.

### Transition
Advance to Slide 6 — this is the natural "and here is the map" moment.

---

## Slide 6: Simplified Architecture Overview

### Purpose
Give the audience a map before diving into capabilities. This is the "you are here" moment — a deliberately simplified diagram showing BASTION's major components and how they connect. Not detailed. Not complete. Just enough to orient the audience so the capability sections that follow feel like they fit into a coherent system rather than appearing as isolated features.

### Visual Layout
White slide. Title "What We Built — Architecture Overview" in blue (#2563EB), 28pt. Central diagram occupying 80% of the slide area, with component blocks connected by directional arrows showing data flow. Below the diagram: one line of text "Each block will be unpacked in the following slides." Navigation note at bottom right showing the five capability sections: Understanding → Planning → Governing → Executing → Trusting.

### Image Prompt
No AI image — diagram (see Diagram Spec below).

### Diagram Spec
Simplified block architecture diagram — white background, blue (#2563EB) blocks, cyan (#06B6D4) data flow arrows, gray (#94A3B8) secondary elements.

Layout (top to bottom, left to right):

**Top row (input/intelligence layer):**
- Block: "Knowledge Graph" (Neo4j + JSON-LD) [blue, left position]
- Block: "Agent Hub" (131+ Specialized Agents) [blue, center position]
- Block: "Pacific Strategy AY26 Scenario" [gray, right position — context only]

**Middle row (platform layer):**
- Block: "Doctrinal Workflow" (Understand / Design / Plan / Decide / COP / Assess) [blue, full width, centered]

**Lower middle row (governance/identity layer):**
- Block: "Smart Contracts + DAOs" (NEAR Blockchain) [cyan, left position]
- Block: "DID Registry" (did:near:resource-{id}) [cyan, center position]
- Block: "Robot Bridge" (Python Agent + mDNS) [blue, right position]

**Bottom row (output layer):**
- Block: "Physical Execution" (Sphero RVR+ + Jetson) [blue, left position]
- Block: "Immutable Audit Trail" (NEAR Ledger) [cyan, center position]
- Block: "Coalition Reporting" [blue, right position]

Arrows:
- Knowledge Graph → Agent Hub (bidirectional)
- Agent Hub → Doctrinal Workflow (down)
- Doctrinal Workflow → Smart Contracts + DAOs (down-left)
- Doctrinal Workflow → DID Registry (down-center)
- Doctrinal Workflow → Robot Bridge (down-right)
- Smart Contracts + DAOs → Immutable Audit Trail (down)
- Robot Bridge → Physical Execution (down)
- Physical Execution → Coalition Reporting (right)

All arrows: thin, directional, in cyan (#06B6D4) with arrowheads.

Font in blocks: 10pt white text for block names, 8pt white text for descriptions in parentheses.

### Speaking Script
Here is the map. Before we go through each capability section, I want to give you a picture of how these components relate to each other. This diagram is intentionally simplified — the whitepaper has the full architecture. This version is a cognitive map, not a technical reference.

At the top: the intelligence layer. The Knowledge Graph — built on Neo4j and a semantic data format called JSON-LD — is the "brain" of the system. Every piece of intelligence, every entity, every relationship BASTION knows about lives here. The Agent Hub — 131 specialized AI agents — reads from and writes to that brain continuously.

In the middle: the platform itself. Six tabs aligned to JP 5-0 doctrine provide the interface. Understand, Design, Plan, Decide, COP, Assess. Your planning workflow, made software.

Below that: the governance and identity layer. This is where BASTION is different from anything else you have seen. Smart contracts and DAOs running on NEAR blockchain enforce the authority model. A Decentralized Identifier — a DID — is assigned to every resource in the system. The Robot Bridge translates planning intent to physical execution.

At the bottom: what comes out. Physical execution from the robotic platforms. An immutable audit trail — a permanent, tamper-proof record of every governance decision — on the NEAR blockchain. Coalition reporting.

Each of these blocks will have its own slide. Let's start at the top — with how BASTION builds strategic understanding.

### DEMO CUE
Second screen: briefly show BASTION's left navigation, clicking slowly through tabs — Understand, Design, Plan, Decide, COP, Assess — showing each tab has real content populated from the Pacific Strategy AY26 scenario. Do not explain the tabs — just show they exist and are populated. Return to Understand tab before advancing.

### Transition
Advance to Slide 7 — the first capability section begins.

---

## Slide 7: The Intelligence Brain — Knowledge Graph

### Purpose
First capability slide. Show how strategic understanding accumulates in BASTION through the knowledge graph. The "brain" metaphor does cognitive work: it makes an abstract technical system feel like something the audience already understands — the collective memory of a staff. The concrete mechanism — JSON-LD entity relationships — proves it was built, not just theorized.

### Visual Layout
Left side (55%): Diagram showing the knowledge graph visualization concept (see Diagram Spec). Right side (45%): Title "The Intelligence Brain" in blue (#2563EB), 28pt bold. Below: Three key points as short labeled blocks:
- "Every entity. Every relationship." — description of the graph structure
- "Scoped to your problem set." — description of subspace isolation
- "Intelligence that accumulates, not just searches." — the differentiating capability vs. keyword search

Below the three points: a small concrete example box with a gray (#F8FAFC) background: "Example: A SITREP mentions 'PLA 74th Army Group operating near Hualien.' BASTION creates: entity [PLA 74th Army Group] → relationship [LOCATED_NEAR] → entity [Hualien] → property [source: SITREP-20260312, reliability: B-2 per NATO STANAG 2022]."

### Image Prompt
No AI image — diagram carries the argument (see Diagram Spec).

### Diagram Spec
Force-directed knowledge graph visualization concept. White background (#FFFFFF). Node clusters connected by typed relationship lines.

Nodes (circles):
- Large central node: "BASTION Knowledge Graph" — blue (#2563EB), 30px diameter, bold label
- Medium nodes: "PLA 74th Army Group" [blue], "Hualien Province" [blue], "Pacific AOR" [blue], "JSOC Task Force" [blue], "USS Carl Vinson" [blue] — 20px diameter
- Small nodes: property nodes (dates, reliability ratings, source documents) — light gray (#94A3B8), 12px diameter

Relationship lines (connecting medium nodes):
- "LOCATED_NEAR" — cyan (#06B6D4) line between "PLA 74th Army Group" and "Hualien Province"
- "COMMANDS" — blue (#2563EB) line
- "OPPOSES" — sky blue (#0EA5E9) line
- "ASSESSED_BY" — gray (#94A3B8) dashed line to reliability rating property nodes

Subspace boundary: a soft-edged blue circle (#EFF6FF, fill opacity 0.3) enclosing a subset of nodes with label "Problem Set: Taiwan Contingency (Phase 3)" — showing that this intelligence is scoped to this specific problem set.

Layout: nodes arranged organically (force-directed style), not in a grid. Central cluster dense, peripheral nodes sparser.

### Speaking Script
A senior intelligence analyst carries years of contextual understanding in their head. They know that this unit was here three months ago, that its commander has a history of particular operational patterns, that it is equipped for this specific mission type. When a new SITREP arrives, they do not read it in isolation — they read it against that accumulated understanding.

BASTION's knowledge graph does the same thing at machine scale. Every piece of intelligence BASTION processes becomes nodes and edges — entities and relationships — in a semantic network built on a data format called JSON-LD (JSON for Linked Data). JSON-LD is a W3C standard that provides formal semantic relationships rather than just keyword matching. When BASTION reads that "PLA 74th Army Group is operating near Hualien," it does not store a text string. It creates an entity node for "PLA 74th Army Group," an entity node for "Hualien," and a typed relationship between them: LOCATED_NEAR. It attaches source provenance: this came from SITREP-20260312. It attaches a NATO STANAG 2022 reliability rating: source reliability B, information reliability 2 — meaning a usually reliable source with information that is probably true.

That entity now has context. When the next report mentions the 74th Army Group, BASTION connects it to everything it already knows. Understanding accumulates rather than restarts with every new document.

One critical capability: the knowledge graph is scoped to problem sets. Intelligence from the Taiwan contingency planning effort is isolated from intelligence in other problem sets. Staff officers working different operations do not contaminate each other's analytical workspace. The brain is partitioned, not shared.

This is the foundation of strategic understanding in BASTION. Let's look at how intelligence gets into the brain in the first place.

### DEMO CUE
Second screen: Navigate to Understand tab — show the brain graph visualization with entities visible from the Pacific Strategy AY26 scenario. Zoom slowly into an entity cluster, showing individual entity nodes and their connections. If possible, click one entity to show its properties panel — demonstrating that relationship data and source provenance are visible.

### Transition
Advance to Slide 8 — the document intelligence pipeline slide.

---

## Slide 8: Autonomous Document Intelligence

### Purpose
Show the 10-agent pipeline that transforms raw documents into structured intelligence in the knowledge graph. This slide bridges from "what the brain looks like" (Slide 7) to "how information gets into the brain." The pipeline diagram makes the automation tangible and the NATO reliability rating detail proves the implementation depth.

### Visual Layout
Full-width pipeline flow diagram occupying 65% of the slide area (see Diagram Spec). Above the diagram: title "From Document to Understanding — Automated" in blue (#2563EB), 24pt. Below the diagram: three capability callouts in a horizontal row:
- Callout 1: "NATO STANAG 2022" — "Source reliability (A-F) and information reliability (1-6) applied automatically by the Rating Agent"
- Callout 2: "Conflict Detection" — "When two sources disagree on the same fact, BASTION flags the conflict and surfaces it for analyst review — never silently resolves it"
- Callout 3: "10 Specialized Agents" — "Each stage has dedicated AI: classification, extraction, rating, conflict detection, graph integration — running in parallel across all uploaded documents"

### Image Prompt
No AI image — pipeline diagram (see Diagram Spec).

### Diagram Spec
Left-to-right horizontal pipeline flow diagram. White background. Blue (#2563EB) agent stage blocks connected by cyan (#06B6D4) directional arrows.

Pipeline stages (left to right):

1. **Document Upload** [gray intake block, #F1F5F9] — label: "SITREP, HUMINT, OSINT, Partner Report" — icon: document stack
2. **Classification Agent** [blue block #2563EB] — label: "Classification Agent" — sublabel: "Identifies document type, origin, classification level"
3. **Entity Extraction Agent** [blue block] — label: "Entity Extraction Agent" — sublabel: "Identifies actors, locations, equipment, events"
4. **Relationship Mapping Agent** [blue block] — label: "Relationship Mapping Agent" — sublabel: "Structures typed relationships between entities"
5. **NATO Rating Agent** [blue block] — label: "Reliability Rating Agent" — sublabel: "Applies STANAG 2022 A-F / 1-6 ratings"
6. **Conflict Detection Agent** [blue block] — label: "Conflict Detection Agent" — sublabel: "Flags contradictions between sources"
7. **Graph Integration Agent** [blue block] — label: "Graph Integration Agent" — sublabel: "Merges entities, updates relationships in Knowledge Graph"
8. **Knowledge Graph** [large cyan block #0EA5E9 with rounded corners] — label: "Knowledge Graph Updated" — icon: network nodes

Connecting arrows: cyan (#06B6D4), 2px, with arrowheads pointing right. Each arrow connects one stage to the next.

Above the pipeline, a small branch arrow from "Conflict Detection Agent" pointing upward to a yellow (#FBBF24) alert block labeled "Analyst Flag: Review Required" — showing that conflicts surface for human review.

Width: full slide width. Agent stage blocks: equal width (~90px each), 50px height, white text labels inside.

### Speaking Script
A document arrives — a SITREP from a partner nation, a HUMINT report from an intelligence team, a commercial satellite imagery analysis. Someone uploads it to BASTION. What happens next is invisible to the user, but critically important.

Ten specialized agents work in sequence. The Classification Agent identifies what kind of document this is, where it came from, and what classification level it carries. The Entity Extraction Agent reads the content and identifies every meaningful entity: unit designations, location names, equipment types, named individuals, events with dates. The Relationship Mapping Agent structures the relationships between those entities — who commanded whom, which unit was where, what action happened at what time.

Then — this is the piece most intelligence systems miss — the Reliability Rating Agent applies NATO STANAG 2022 ratings automatically. STANAG 2022 is the NATO standard for intelligence source reliability. It uses a two-part rating: letters A through F for source reliability (A meaning "completely reliable," F meaning "reliability cannot be judged"), and numbers 1 through 6 for information reliability (1 meaning "confirmed by other sources," 6 meaning "truth cannot be judged"). Every entity extracted from every document carries these ratings. Analysts can immediately see how much confidence to place in any given intelligence assessment.

The Conflict Detection Agent then checks whether the new information contradicts existing knowledge in the graph. If two sources disagree on where a unit was at a given time, BASTION flags that conflict and surfaces it for analyst review. It does not silently resolve contradictions — it does not pick the "more reliable" source and discard the other. Conflict is information. It surfaces the conflict.

Finally, the Graph Integration Agent merges the new entities into the existing knowledge graph — connecting them to related nodes, updating existing entries, preserving provenance.

The result: a document that arrived as unstructured text is now structured intelligence, rated, cross-referenced, and integrated into the brain in under thirty seconds.

### DEMO CUE
Second screen: Show the document upload interface in the Understand tab, or show the entity extraction view for a previously uploaded document from the Pacific Strategy AY26 scenario — demonstrating that entities from an actual document are displayed with source and reliability information. If the upload interface is cleaner, show that with the upload queue visible.

### Transition
Advance to Slide 9 — the planning and designing capability section begins.

---

## Slide 9: Doctrinal Planning Workflow

### Purpose
Show JP 5-0 alignment. BASTION's interface mirrors the operations process — planners trained on doctrine find the system immediately familiar. This slide explains why that structure matters: it is not cosmetic, it is architectural. Ironclaw as the AI Chief of Staff present across all tabs demonstrates that AI support is contextual, not generic.

### Visual Layout
Upper half: Six-tab visual — six equal-width boxes showing each tab with a brief description and a JP 5-0 phase alignment label. Lower half: Two key points as prose blocks, plus an Ironclaw callout.

Tab boxes (left to right, blue #2563EB backgrounds, white text):
- **Understand** — "IPB / Strategic Assessment / Knowledge Graph" — "JP 5-0: Mission Analysis"
- **Design** — "CoG Analysis / LOEs / Operational Approach" — "JP 5-0: Course of Action Development"
- **Plan** — "JPP Campaign Plan / MDMP / OPORD" — "JP 5-0: Plan/Order Development"
- **Decide** — "Decision Dashboard / DAO Governance / RACI" — "JP 5-0: Decision Brief"
- **COP** — "MIL-STD-2525D / Perspective Toggle / Phase Slider" — "JP 5-0: Execution Monitoring"
- **Assess** — "Training Assessment / METL / AAR" — "JP 5-0: Assessment"

Below tabs: Ironclaw callout box (cyan #EFF6FF background, blue border): "Ironclaw — AI Chief of Staff — is contextually present in every tab. Ironclaw monitors all agent activity, surfaces decisions requiring commander attention, and guides planners through doctrinal steps with proactive recommendations."

### Image Prompt
No AI image — tab layout diagram carries the argument.

### Diagram Spec
Six-tab layout as described in Visual Layout. Each tab block: approximately 150px wide, 120px tall. Blue (#2563EB) background, white text. Tab label in bold 14pt, JP 5-0 phase label in 10pt italic at bottom of each block. Thin white border between tabs.

Below the tab row: Ironclaw callout box spanning full width, 60px height. Background #EFF6FF (very light blue), 1px solid blue border (#2563EB). Left-aligned cyan circle icon (Ironclaw indicator). Text: "Ironclaw — AI Chief of Staff" in bold blue 14pt, followed by description in normal 12pt.

### Speaking Script
Joint Publication 5-0 defines the joint planning process in six phases: mission analysis, course of action development, plan and order development, decision briefing, execution, and assessment. If you have been trained on JP 5-0, you already understand the cognitive workflow of BASTION — because the software tabs mirror the doctrine exactly.

This is not cosmetic. When the doctrinal structure and the software structure are the same, planners do not need to learn a new mental model. The system reinforces doctrine rather than working against it. More importantly, the governance gates in BASTION correspond to doctrinal transition points: you cannot move from Design to Plan without the required approvals; you cannot move from Plan to Decide without a decision product that meets the doctrinal standard.

The Understand tab is the intelligence foundation — the knowledge graph and its entities. Design is where Operational Art happens: Center of Gravity analysis, Lines of Effort, the Operational Approach. Plan holds the campaign plan at the strategic level and the MDMP workflow at the tactical level — including AI-generated planning products like warning orders, operations orders, and fragmentary orders. Decide surfaces decisions requiring command attention, with DAO governance proposals for coalition-level decisions. COP shows the Common Operating Picture with MIL-STD-2525D military symbology, generated automatically from the plan. Assess closes the loop with training assessment and after-action review.

Present in every tab is Ironclaw — BASTION's AI Chief of Staff. Ironclaw monitors all agent activity at sixty-second polling intervals, proactively surfaces decisions requiring attention, and guides planners through doctrinal steps. Ironclaw is not a chatbot you ask questions. Ironclaw watches the operational picture, identifies when something requires a commander's judgment, and brings it forward. That is what a good Chief of Staff does.

### DEMO CUE
Second screen: Click through tabs slowly — Understand, Design, Plan, Decide, COP, Assess — pausing briefly on each to show that real content from the Pacific Strategy AY26 scenario is populated. Do not explain each tab verbally — the script covers it. Let the visual show the system is live and populated.

### Transition
Advance to Slide 10 — operational design with AI.

---

## Slide 10: Operational Design with AI

### Purpose
Show the Design tab capabilities — specifically the capabilities added in Phases 55 and 56 that are new since the previous Phase 54 briefing deck. Ironclaw-guided design interviews (Phase 55) and the Visual Operational Approach Editor with MIL-STD-2525 symbology (Phase 56) demonstrate AI as a design partner, not just an advisor. This slide carries the most technically advanced content of the planning section.

### Visual Layout
Split layout. Left side (50%): A screenshot description or diagram showing an Ironclaw design interview conversation — a dialogue exchange where Ironclaw is asking structured questions about the operational approach, and the commander/planner is responding. Right side (50%): A description/diagram of the map-based visual approach editor showing MIL-STD-2525 symbols positioned on a map background with vectors showing Lines of Effort.

Title at top: "AI as Design Partner — Not Just Advisor" in blue (#2563EB), 24pt.

Below the split: Two callout boxes:
- Callout left: "Ironclaw Design Interview (Phase 55) — Ironclaw guides commanders through a structured Operational Art interview, capturing design decisions that form the doctrinal foundation of the plan."
- Callout right: "Visual Approach Editor (Phase 56) — Ironclaw directs MIL-STD-2525D symbol placement on the operational map, translating verbal planning intent into visual operational graphics."

### Image Prompt
No AI image — diagram/screenshot description.

### Diagram Spec
Split layout diagram:

LEFT PANEL — Ironclaw Design Interview:
White background. A conversation interface mockup showing alternating message bubbles:
- Ironclaw message (blue #2563EB left-aligned bubble): "Before we develop the Lines of Effort, I need to understand your decisive point. What is the single condition, if achieved, that most directly enables mission accomplishment?"
- Commander response (gray #F1F5F9 right-aligned bubble): "Degrading PLAN air defense coverage in the Taiwan Strait corridor."
- Ironclaw message: "Understood. I'll record that as the decisive point for this phase. Does this align with your assessment of the adversary's critical vulnerability?"
- Panel title above: "Ironclaw Design Interview — Phase 55" in small blue text

RIGHT PANEL — Visual Approach Editor:
Map background (simplified, light gray terrain with blue water areas). MIL-STD-2525D symbols positioned on the map:
- Friendly unit symbols (blue) at starting positions
- Directional vectors (bold blue arrows) showing Lines of Effort converging on an objective
- Objective symbol at convergence point
- Small Ironclaw command prompt at bottom: "I've positioned the 3rd LOE based on your decisive point. Confirm or adjust the axis."
- Panel title above: "Visual Operational Approach Editor — Phase 56" in small blue text

Thin gray vertical divider between panels. Both panels within a light gray (#F8FAFC) background container.

### Speaking Script
The Design tab is where Operational Art happens in BASTION. But this slide is about two capabilities that distinguish BASTION from any planning tool you have seen — both developed since our last briefing.

The first is the Ironclaw Design Interview. When a commander sits down to develop the Operational Approach — the set of decisions about the decisive point, the adversary's center of gravity, the Lines of Effort that will achieve the objective — Ironclaw does not sit back and wait to be asked questions. Ironclaw guides the interview. It asks the doctrinal questions in sequence: "What is your decisive point?" "What is the adversary's critical vulnerability?" "How does this Line of Effort connect to that vulnerability?" The responses are not just recorded as text — they are captured as structured design decisions that become the doctrinal foundation of the plan. The planning products that follow — warning orders, operations orders — are grounded in explicitly recorded design intent.

The second is the Visual Operational Approach Editor. Here is the specific capability: Ironclaw can direct MIL-STD-2525D symbol placement on the operational map. A planner describes their intent — "I want three converging Lines of Effort aimed at degrading PLAN air defense coverage" — and Ironclaw translates that verbal intent into visual operational graphics on the map: the correct MIL-STD-2525D symbols positioned at the appropriate locations, with vectors showing direction of movement and lines of effort. The planner reviews, adjusts, confirms.

This is not AI generating a report for a human to read. This is AI acting as a design partner — guiding the process, capturing decisions, and producing visual products that serve as the basis for the operations order. The difference matters for doctrine: a plan with recorded design decisions is auditable, transferable, and defensible in a way that a plan that lives in a commander's head is not.

### DEMO CUE
Second screen: Navigate to Design tab — show CoG analysis interface or the operational approach map if populated with the Pacific Strategy AY26 scenario data. If the visual approach editor is accessible, show the map with MIL-STD-2525D symbols positioned. Do not navigate away — this is a natural demo moment for the most visually compelling planning content.

### Transition
Advance to Slide 11 — the governing decisions section begins.

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

### Speaking Script
Policy documents tell machines what they should do. Smart contracts tell machines what they can do — and when the contract says "no," the machine stops, regardless of what any operator wants.

Let me be concrete. Phase 58 of BASTION's development implemented on-chain DID caveats — Decentralized Identifier caveats — which are the specific enforcement mechanism for coalition resource management. When Australia shares satellite imagery with the Pacific coalition, that imagery gets a DID: did:near:resource-{unique-id}. Attached to that DID is a ResourceCaveats struct — a data structure recording five caveat conditions: classification level (SECRET), releasability (Five Eyes nations only), ROE tier required for employment (Tier 3 — organizational authority), geographic bounds (Pacific AOR, defined by bounding box coordinates), and time window (valid for 72 hours from sharing).

When any agent, system, or operator attempts to use that resource, BASTION calls `check_employment_authorized()` — a function in the smart contract running on NEAR blockchain. That function checks all five conditions against the requesting context. If all five pass: the action is authorized. If any fail: the action is denied, and the denial is logged permanently to the NEAR blockchain ledger.

That log — what technologists call an immutable audit trail, meaning a record that mathematically cannot be altered after it is written — is the enforcement record. After the operation, every authorization and every denial is available for review. Who requested what, what the caveat conditions were at the time, and what the decision was. Not in a BASTION database that could be modified. On the blockchain, where modification is cryptographically impossible.

This is what DoD Directive 3000.09 actually requires — enforcement mechanisms, not just policies. Smart contracts are the mechanism.

### DEMO CUE
Second screen: Show the Resources tab with the SecurityCaveatsSection visible — demonstrating the caveat fields (classification, releasability, ROE tier, geo bounds, time window) in the UI. If possible, show the NEAR testnet explorer at did.bastion.testnet showing recorded contract interactions. Note to presenter: either screen works — the Resources tab caveat editor shows the input side; the NEAR explorer shows the enforcement record.

### Transition
Advance to Slide 12 — the five-tier authority model.

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

### Speaking Script
Remember when the robot stopped and asked for permission? Here is the architecture that made that moment possible.

BASTION implements a five-tier authority model. Tier 1 is individual authority — a person acting within their own bounded scope. Tier 2 is team-level authority. Tier 3 is organizational authority — and this is the critical threshold. Tier 3 is the minimum authority level required for any autonomous engagement. Not Tier 4. Not coalition consensus. Tier 3 — an organizational commander. Any action that could result in lethal effect must have Tier 3 authorization, enforced by smart contract, before it proceeds.

Tier 4 is national DAO authority — decisions that commit national resources or strategic commitments. Tier 5 is the coalition strategic level — decisions requiring full coalition consensus, including strike authorization, which requires one hundred percent coalition agreement. No single partner can authorize a coalition-level strike.

In the opening demonstration, the robot was operating with a Tier 5 delegation — the most bounded, autonomous level. Within that delegation, it navigated, it conducted reconnaissance, it executed assigned tasks without requesting permission for each action. But when it identified an engagement opportunity, the smart contract checked: does this action require Tier 3 authorization? Yes. Does this robot's current delegation include Tier 3 authority? No. Can I proceed? No.

So it stopped. It submitted an authority escalation request through the DAO governance chain. It waited. That wait — that deliberate, contractually-enforced pause — is the governance architecture working exactly as designed.

Delegations are dynamic. A commander can grant an expanded delegation for a time-limited mission window — "I authorize Tier 3 engagement authority for the next four hours in grid 12S." That delegation is recorded on the NEAR blockchain with its expiration time and expires automatically. No one has to remember to revoke it.

### DEMO CUE
Second screen: Navigate to Decide tab — show the governance proposals or decision dashboard, demonstrating that there are real governance items requiring commander attention from the Pacific Strategy AY26 scenario. If a robot authority escalation request is visible, show it. If not, show any pending DAO governance proposal to illustrate the concept.

### Transition
Advance to Slide 13 — decentralized identity and coalition caveats.

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

### Speaking Script
In every coalition operation, the most fraught coordination task is managing national caveats on shared resources. Australia shares imagery — but only with Five Eyes partners, only for forty-eight hours, only for use within a defined geographic area. The UK shares signals intelligence — but not with nations that have not signed certain bilateral agreements. Managing these caveats manually, through liaison officers and coordinating instructions in the operations order, generates exactly the kind of coordination overhead we described in the problem slides.

BASTION's answer is Decentralized Identity. A DID — a Decentralized Identifier, following the W3C standard for digital identity — is assigned to every resource, every person, every agent, every piece of equipment in the system. The format is: did:near:resource-{unique-id}. That identity is registered on the NEAR blockchain.

Attached to that identity is a ResourceCaveats data structure containing five fields: classification level, releasability — which nation codes are permitted — ROE tier required for employment, geographic bounds if applicable, and time window if applicable. These are not text notes. They are structured data fields that the smart contract reads when checking authorization.

Here is what this changes: the caveats travel with the resource identity. When Australia's satellite imagery is forwarded to a planning team in Japan, the caveats go with it — encoded in the DID. There is no risk that the caveat note gets lost in a copy-paste, forgotten in an email chain, or overridden by an operator who does not know the restriction existed. The contract checks before the resource is used. The Five Eyes restriction enforces itself.

Coalition partners can verify any enforcement decision independently — by checking the NEAR blockchain directly — without trusting BASTION's word. That independent verifiability is what we mean by institutionally legitimate governance. Trust does not require trust in BASTION. It requires only trust in mathematics.

### DEMO CUE
Second screen: Show Resources tab → select a specific resource → show the DID displayed in the resource detail panel → show the SecurityCaveatsSection with caveat fields populated. Demonstrate that the DID is shown in the did:near:resource-{uuid} format and that the caveat fields correspond exactly to the struct described in the script.

### Transition
Advance to Slide 14 — physical autonomous execution section begins.
