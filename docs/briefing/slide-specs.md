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
Show the Design tab capabilities — specifically the capabilities added in Phases 55 and 56 that are new since the previous Phase 54 briefing deck. Ironclaw acting as Chief of Staff to coordinate, obtain, and validate operational design inputs (Phase 55) and the Visual Operational Approach Editor with MIL-STD-2525 symbology (Phase 56) demonstrate AI as an autonomous staff officer, not just a chatbot. This slide carries the most technically advanced content of the planning section.

### Visual Layout
Split layout. Left side (50%): A screenshot description or diagram showing Ironclaw functioning as Chief of Staff — coordinating inputs from multiple staff sections, obtaining commander's design decisions, and validating them against doctrine. Right side (50%): A description/diagram of the map-based visual approach editor showing MIL-STD-2525 symbols positioned on a map background with vectors showing Lines of Effort.

Title at top: "AI as Chief of Staff — Not a Chatbot" in blue (#2563EB), 24pt.

Below the split: Two callout boxes:
- Callout left: "Ironclaw as Chief of Staff (Phase 55) — Ironclaw coordinates across staff sections, obtains the commander's design decisions, and validates each input against JP 5-0 doctrine before recording it as the foundation of the plan."
- Callout right: "Visual Approach Editor (Phase 56) — Ironclaw directs MIL-STD-2525D symbol placement on the operational map, translating verbal planning intent into visual operational graphics."

### Image Prompt
No AI image — diagram/screenshot description.

### Diagram Spec
Split layout diagram:

LEFT PANEL — Ironclaw as Chief of Staff:
White background. A staff coordination interface mockup showing Ironclaw managing the operational design process:
- Ironclaw status bar (blue #2563EB top banner): "Chief of Staff — Operational Design Coordination" with status indicators for each input area (Decisive Point ✓, CoG Assessment ◆, LOE Development ○)
- Ironclaw action (blue #2563EB left-aligned): "I've obtained the commander's decisive point and validated it against the stated mission. Before developing Lines of Effort, I need to coordinate the adversary CoG assessment. What is the adversary's critical vulnerability that this decisive point exploits?"
- Commander input (gray #F1F5F9 right-aligned): "Degrading PLAN air defense coverage in the Taiwan Strait corridor."
- Ironclaw validation (blue): "Validated: this aligns with the J2's threat assessment. Recording as the CoG linkage. Coordinating with J3 for LOE development."
- Panel title above: "Ironclaw as Chief of Staff — Phase 55" in small blue text

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

The first is Ironclaw functioning as Chief of Staff for the operational design process. This is not a chatbot. When a commander sits down to develop the Operational Approach — the set of decisions about the decisive point, the adversary's center of gravity, the Lines of Effort that will achieve the objective — Ironclaw takes on the role that a Chief of Staff performs: coordinating inputs across staff sections, obtaining the commander's decisions, and validating every input against JP 5-0 doctrine before recording it. Ironclaw coordinates: "I need the commander's decisive point before I can develop Lines of Effort." Ironclaw obtains: it asks the right doctrinal questions in sequence, ensuring nothing is skipped. Ironclaw validates: "This decisive point aligns with the J2's threat assessment — recording it as the CoG linkage." The responses are not just recorded as text — they are captured as structured design decisions that become the doctrinal foundation of the plan. The planning products that follow — warning orders, operations orders — are grounded in explicitly recorded and validated design intent.

The second is the Visual Operational Approach Editor. Here is the specific capability: Ironclaw can direct MIL-STD-2525D symbol placement on the operational map. A planner describes their intent — "I want three converging Lines of Effort aimed at degrading PLAN air defense coverage" — and Ironclaw translates that verbal intent into visual operational graphics on the map: the correct MIL-STD-2525D symbols positioned at the appropriate locations, with vectors showing direction of movement and lines of effort. The planner reviews, adjusts, confirms.

This is not AI generating a report for a human to read. This is AI acting as Chief of Staff — coordinating the process, obtaining and validating decisions, and producing visual products that serve as the basis for the operations order. The difference matters for doctrine: a plan with recorded, validated design decisions is auditable, transferable, and defensible in a way that a plan that lives in a commander's head is not.

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

### Speaking Script
This is what was happening under the hood when you watched that robot execute at the start of this briefing.

The architecture is three tiers. At the top, the BASTION cloud platform — the AI agent hub, the DAO governance layer, the mission planning environment. This is where authority lives. This is where the human commanders make decisions, delegate tasks, and define the boundaries of autonomous action.

In the middle, the Docker bridge agent. This is the crucial translation layer. It runs a Python autonomy agent with its own NEAR blockchain wallet — the robot has an on-chain identity. It holds a buffer of mission state for DDIL-resilient operation. And critically: it contains the authority escalation handler. When the robot encounters a situation that exceeds its delegated authority at that moment, the bridge agent pauses execution and escalates back to the cloud for human decision. That pause — that check-in — is the core control mechanism you saw demonstrated.

Why Docker rather than a purpose-built edge device? This was a deliberate tradeoff. Procurement and policy constraints make hardware-specific edge nodes impractical for a research prototype. Docker provides hardware agnosticism — the bridge agent runs identically on any capable machine. That agnosticism also represents what a fielded system would need: the ability to integrate heterogeneous robotic platforms without custom firmware per device.

At the edge, the robot itself: a Jetson compute module running a camera vision pipeline, a Sphero RVR+ for locomotion, and the capability to execute six doctrinal swarm formations — column, wedge, echelon, line, diamond, and file — derived from actual military small-unit formations. These are not arbitrary movement patterns. They are doctrinal.

The three-tier architecture separates authority from execution. Cloud owns authority. Edge owns execution. Bridge translates between them, handling connectivity interruption and authority escalation as its primary functions.

### DEMO CUE
Second screen: If robot hardware is available, show the robot bridge status page with discovered robots and bridge connectivity status. If hardware is not present, navigate to the COP tab and show the architecture diagram representation, or reference the pre-recorded demonstration clip. Point out that the BASTION platform remains visible on the second screen as Tier 1 of the architecture the audience is looking at.

### Transition
Advance to Slide 15 — the AI-generated Common Operating Picture that emerges from this architecture.

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

### Speaking Script
The Common Operating Picture — the COP — is the single most critical shared display in any military headquarters. Commanders make decisions based on it. Staff briefs from it. The problem is how it gets built: manually. Intelligence analysts read reports, extract unit locations, and plot symbols on a map. Operations staff update those positions as units move. The COP is always behind reality because human curation cannot keep pace with the information environment.

BASTION generates the COP from documents.

The document intelligence pipeline you saw on the previous slides — the one that extracts entities, relationships, and locations from source documents — feeds directly into COP symbol placement. When a plan document describes a PLAN 74th Army Group formation establishing a defensive position at a grid coordinate, that becomes a red unit symbol on the map, positioned at that coordinate, with the relationship data from the knowledge graph attached to it. No manual plotting required.

The COP supports two capabilities that manual systems cannot. First, perspective toggle: with a single click, the same operational environment can be viewed from the friendly force perspective or the adversary perspective. This is not cosmetic. Viewing the battle space from the adversary's likely decision calculus — what would they see as BLUFOR vulnerabilities? — is a core element of the Intelligence Preparation of the Battlefield process. That analytical step currently requires a separate staff effort. In BASTION, it is a toggle.

Second, the phase slider. The Pacific Strategy AY26 scenario has six phases: Competition, Crisis, four Conflict days, and Negotiation. The phase slider allows the COP to display the operational picture as it is projected to evolve across time — showing which units are expected where at each phase boundary. That temporal visualization is not currently achievable in standard COP tools without significant manual re-plotting for each phase.

The COP is not a display. It is an analytical output of the knowledge graph.

### DEMO CUE
Second screen: Navigate to COP tab. Show the map with MIL-STD-2525D symbol overlays in place. Toggle between friendly and adversary perspective — demonstrate that the symbol sets change (friendly blue becomes red hostile, positional emphasis shifts). Then use the phase slider to advance through operational phases, showing how the force picture evolves. Narrate: "Every symbol on this map was placed by the document intelligence pipeline — no one plotted this manually."

### Transition
Advance to Slide 16 — how BASTION maintains training-operational parity to ensure governance consistency.

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

### Speaking Script
"Train as you fight" is not a slogan. It is a reliability requirement. Governance procedures that are practiced inconsistently in training will fail inconsistently under operational stress — precisely when they are most needed.

BASTION enforces training-operational parity through a single design decision: training mode and operational mode share the same smart contracts. There is no "training version" of the DAO governance logic. There is no relaxed authority tier enforcement in exercise. The only difference between TRAINING and OPERATIONAL mode is a banner — an amber EXERCISE label that makes the mode explicit — and data isolation that ensures exercise data does not contaminate the operational record.

Why does this matter? Because procedural muscle memory is built through repetition against the actual system. If trainees learn to approve an authority delegation through a simplified training interface, they have not learned to use BASTION. They have learned to use a training version of BASTION. When they encounter the real system under operational conditions — time pressure, incomplete information, command authority ambiguity — they will encounter the governance controls for the first time under the worst possible circumstances.

BASTION eliminates that gap. The planning officer who approves a robot authority delegation in a JRTC exercise is executing the same smart contract call they would execute in actual operations. The DAO vote they participate in uses the same on-chain governance mechanism. The DID they authenticate with follows the same cryptographic verification path.

Training in BASTION is not simulation. It is rehearsal on the live system.

### DEMO CUE
Second screen: If BASTION is in training mode, point to the amber EXERCISE banner — it should be visible at the top of the interface. Demonstrate that governance controls (DAO proposals, authority delegation, planning tabs) are identical to what they would be in operational mode. If in operational mode, describe the training mode behavior: "In exercise mode, everything you see here looks the same — with an amber banner across the top confirming the mode."

### Transition
Advance to Slide 17 — the zero trust architecture that verifies every action in both training and operational contexts.

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

### Speaking Script
Zero trust is a term that has been adopted so broadly it has nearly lost meaning. In most contexts, "zero trust architecture" means: we wrote a policy that says we do not trust anything, and we have a product that implements that policy through software controls. The trust is still ultimately in the software vendor, the policy author, and the humans who configure and audit the system.

BASTION's zero trust architecture makes a different claim. Trust terminates at mathematics.

The architecture answers four questions for every action in the system. Is this data authentic? The document arrived through the knowledge graph pipeline, and its provenance is recorded on-chain. Is this device trusted? The robot bridge agent holds a NEAR wallet — a cryptographic identity — that was registered on the blockchain when the device was enrolled. A device that cannot prove that identity cannot participate in the mission. Is this operator authorized? Authorization is checked against the DAO's current authority delegation state — on-chain, auditable, not subject to manual override without a governance event. Is this action within bounds? The smart contract's `check_employment_authorized()` function verifies five fields before permitting any resource employment.

These four questions are answered by five verification layers, from the inside out. At the hardware level: TEE attestation — Trusted Execution Environment, a hardware-isolated computation environment that can prove to external parties that code ran without tampering. Then blockchain proof: the tamper-evident ledger that records every governance event and cannot be retroactively modified. Smart contract policy: the encoded rules that execute automatically, without human intervention, every time an action is attempted. DAO governance: the human decision gate for high-authority actions. And AI advisory: the outer layer that monitors for anomalies and flags compliance concerns.

The innermost layer is hardware. The outermost is human judgment. Both are required. Neither alone is sufficient.

### DEMO CUE
No demo cue for this slide — this is architectural philosophy. Second screen can display any BASTION tab. Consider leaving the COP tab visible from the previous slide to maintain visual continuity with the live system while the philosophical framework is presented.

### Transition
Advance to Slide 18 — the full architecture synthesis diagram that brings all components together.

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
- "Agent Hub" — top-center. Sub-label: "131+ agents / LangGraph orchestrator / 19 AI roles / 31 JPP staff roles"
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

### Speaking Script
This is the same diagram you saw on Slide 6 — except now you know what each piece does.

When you saw this architecture overview forty minutes ago, the labels were familiar: AI, blockchain, robots. But the relationships were opaque. Why does the Agent Hub connect to the DAO tier? Why does the DID Registry feed the smart contract? Why is there a bridge between cloud and edge? Those questions have answers now.

What I want to draw your attention to is the highlighted component: Ironclaw, the AI Chief of Staff. Ironclaw spans the Agent Hub and the Planning Workflow — it is present across every capability section we have covered. But in Phase 57, Ironclaw acquired something it previously lacked: persistent memory. Not session memory that resets when a conversation ends. A persistent graph of relationships — staff patterns, commander preferences, recurring intelligence themes, historical decision data — that accumulates across all interactions and persists in the knowledge graph.

This is the difference between a capable assistant and an adaptive partner. Before Phase 57, Ironclaw could answer questions about the current planning session. After Phase 57, Ironclaw remembers that this commander consistently prioritizes logistic support lines over maneuver flexibility — because that pattern appeared in three previous planning sessions. It remembers that a specific intelligence source has historically overstated adversary air defense capability. It adapts its advisory posture based on what it has learned.

The persistent memory graph is annotated here as a specialized subgraph within the Knowledge Graph layer — because that is architecturally what it is. It is the learning element of the system.

Everything else on this diagram has been operational since Phase 43. The memory graph is what makes BASTION more than a tool. It is what makes BASTION a working relationship.

### DEMO CUE
Second screen: Show BASTION's full platform — any tab, as the architecture is running live. Consider the Understand tab or the Design tab to show the operational context. Point to the second screen: "This entire architecture is running on the screen next to me. Every component on this diagram has an active process on that machine." If Ironclaw's memory panel is accessible, briefly show the Memory tab in the Ironclaw drawer — the persistent graph entries — to ground the Phase 57 reference in a visible interface.

### Transition
Advance to Slide 19 — the closing reflection begins with an honest accounting of tradeoffs.

---

## Slide 19: Tradeoffs — What We Chose and Sacrificed

### Purpose
Honest accounting. Academic rigor demands acknowledging that every design decision is an argument — something chosen over something else, with understood costs. This slide prevents the presentation from reading as uncritical advocacy. It establishes intellectual credibility with the academic audience and practical credibility with the technical audience.

### Visual Layout
Title "Tradeoffs — What We Chose and Sacrificed" at top. Subtitle: "Every system is an argument. Here is what we argued for — and what we gave up." Main content: the six-row tradeoff table (see below). Table columns are: Decision / Chose / Over / Why. Clean table formatting — alternating light gray (#F8FAFC) and white row backgrounds, column headers in blue (#2563EB) text.

### Image Prompt
No AI image — the table is the primary visual.

### Diagram Spec
No diagram — see the tradeoff table in the Visual Layout and Speaking Script sections.

**Tradeoff Table:**

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Blockchain platform | NEAR Protocol | Ethereum / Solana / Hyperledger | Sharding scalability, human-readable account IDs, low gas fees, WebAssembly contract execution |
| Governance model | DAOs | Traditional RBAC | Verifiable on-chain decisions, independent audit, coalition-compatible without shared directory |
| Storage architecture | Hybrid (PostgreSQL + blockchain) | Pure on-chain | Operational data needs relational queries and speed; governance and identity need immutability |
| AI orchestration | LangGraph | LangChain / AutoGen / raw API | Graph-based workflow control enables conditional branching and explicit state machines |
| Edge architecture | Docker bridge agent | Direct hardware integration | Procurement and policy constraints make hardware-specific nodes impractical; Docker provides hardware agnosticism |
| Identity standard | DIDs (W3C standard) | OAuth / SAML / PKI | Decentralized — no central authority required; coalition-compatible without shared identity provider |

### Speaking Script
Every system is an argument. It argues for certain values over others, certain capabilities over others, certain futures over others. Part of intellectual honesty is being explicit about what that argument costs.

Six major tradeoffs shaped BASTION.

The first is blockchain platform. We chose NEAR Protocol over Ethereum, Solana, and Hyperledger. Ethereum is the most mature smart contract platform, but gas fees at operational scale are unpredictable and potentially prohibitive. Solana offers high throughput but has experienced network instability that a military system cannot tolerate. Hyperledger is permissioned and consortium-compatible, which has appeal for coalition contexts — but it requires upfront agreement on consortium membership, creating exactly the kind of centralized coordination dependency we were trying to eliminate. NEAR offers sharding-based scalability, human-readable account IDs that support the DID naming scheme, and consistent low fees. The tradeoff: NEAR is less widely known in defense contexts, requiring more explanation.

Second: governance model. We chose DAOs over traditional role-based access control. RBAC is well-understood and widely implemented. The tradeoff with DAOs is implementation complexity and the latency of consensus. When a governance vote requires multiple participants, real-time decision speed suffers. We accepted that tradeoff because verifiable, auditable, coalition-independent governance — governance that no single party can override — is worth the complexity.

Third: storage. Pure on-chain storage would maximize immutability. But operational planning data — the volume, query complexity, and update frequency of a real planning cycle — requires relational database performance. We chose hybrid storage: PostgreSQL for operational data, blockchain for governance events and identity. The tradeoff is architectural complexity and a data synchronization challenge.

Fourth: AI orchestration. LangGraph over raw API calls or LangChain's sequential chains. LangGraph enables explicit graph-based workflow control with conditional branching — the kind of "if this intelligence type, route to this agent team" logic the planning cycle requires. The tradeoff is a less-familiar framework with a steeper learning curve.

Fifth: Docker bridge over direct hardware integration. Agnosticism over optimization.

Sixth: DIDs over OAuth or SAML. Decentralized identity enables coalition participation without requiring a shared identity provider. The tradeoff is that DID tooling is less mature than OAuth, and NEAR-specific DID resolution is not yet a widely-supported standard.

These were deliberate choices. None were defaults.

### DEMO CUE
No demo cue for this slide — this is reflection. Second screen can remain on any BASTION tab from the previous slide.

### Transition
Advance to Slide 20 — known limitations of the current system.

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

### Speaking Script
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

### DEMO CUE
No demo cue for this slide. Allow the list to be read and absorbed.

### Transition
Advance to Slide 21 — doctrinal impact of the approach.

---

## Slide 21: Doctrinal Impact

### Purpose
The "so what" for military audiences. How does a system like BASTION change how military organizations plan, decide, and operate? This slide elevates from technology to doctrine — connecting the architecture to changes in staff process, command relationships, and operational tempo.

### Visual Layout
Title "Doctrinal Impact" at top. Subtitle: "What changes when the planning environment is AI-augmented and governance is verifiable?" Left two-thirds: the five doctrinal impact statements as a numbered list with brief elaborations. Right one-third: the hero image (see Image Prompt). The five impact statements should be in large, clean typography — each fits in two lines maximum.

### Image Prompt
AI-generated hero image representing the convergence of human judgment and AI capability in a command setting, 16:9. A modern, clean command center environment — bright, organized, forward-leaning. Human figures at workstations alongside subtle holographic-style AI agent representations — the AI presences are represented as clean geometric overlays or network visualizations, not humanoid robots. Color palette: primary blue (#2563EB) dominant, white walls and surfaces, cyan (#06B6D4) accents on digital displays, warm task lighting suggesting active operations. Mood: "collaborative authority" — humans clearly in command, AI clearly augmenting, the relationship between the two is the subject. Aspect ratio: 16:9. Specific elements: multiple human operators at consoles, translucent AI network overlays on display surfaces (not covering human faces), a sense of organized operational activity rather than crisis, light colors throughout. Avoid: dark aesthetics, gritty war room atmosphere, dystopian AI imagery, robotic figures, anything suggesting AI has replaced human judgment, explosion imagery, tactical darkness.

### Diagram Spec
No diagram — the Image Prompt is the primary visual for the right side of this slide.

### Speaking Script
Five doctrinal shifts follow from the BASTION approach.

First: staff augmentation, not replacement. BASTION fields 131 AI agents covering 19 AI capability roles and 31 JPP staff officer roles. That is not a replacement for human staff — it is additional capacity. The intelligence analyst who currently spends eight hours manually correlating OSINT reports can redirect those eight hours toward judgment tasks that require human contextual understanding. The AI handles correlation. The human handles interpretation. Staff size is not reduced; staff effectiveness is multiplied.

Second: planning timelines compress. The Joint Planning Process — from mission analysis through the operations order — currently takes days at minimum, weeks in complex coalition scenarios. BASTION's document intelligence pipeline, knowledge graph synthesis, and Ironclaw-guided operational design process can compress the information-gathering and analysis phases significantly. Early testing suggests that phases which take two to three days manually can complete in hours with AI augmentation. This is not a claim about quality — a faster analysis is not always a better analysis — but it is a claim about optionality. Compressed timelines give commanders more decision space.

Third: coalition accountability becomes verifiable. The current state of coalition accountability is largely trust-based. Nations share information under caveats enforced by policy and liaison. BASTION makes accountability verifiable: every governance decision, every authority delegation, every resource employment check is recorded on the NEAR blockchain. A coalition partner does not need to trust BASTION's word about compliance. They can verify independently.

Fourth: authority delegation becomes formal and enforceable. "The robot is authorized to conduct area reconnaissance but must check in before engaging any target" is currently a statement in a fragmentary order — enforced by training, culture, and the robot operator's judgment. In BASTION, that authority delegation is a smart contract condition. It enforces itself.

Fifth: training and operations converge. The same system, same governance, same tools — different banner.

### DEMO CUE
Second screen: Show BASTION with a populated exercise — the full planning environment with agents, COP, and governance elements visible. The live system is the doctrinal impact made visible. Narrate: "The doctrinal shift I am describing is not theoretical. It is running on the screen next to me."

### Transition
Advance to Slide 22 — the future development roadmap.

---

## Slide 22: Future Roadmap

### Purpose
Near/medium/long-term research and development trajectory. Communicates that BASTION is a platform, not a product — a foundation that scales toward operational relevance through successive research and development gates. Sets expectations clearly: there is a path from here to operational, and that path has defined waypoints.

### Visual Layout
Title "Future Roadmap" at top. Main content: three-column timeline layout labeled "Near-Term," "Medium-Term," and "Long-Term." Each column has a header in blue (#2563EB) with a time horizon label in smaller text below it. Roadmap items as clean bullet points within each column. Dividing lines between columns in light gray.

### Image Prompt
No AI image — the three-column layout is the primary visual.

### Diagram Spec
Three-column timeline:

**Near-Term (6-18 months):**
- Formal security audit and penetration testing
- Source-tier-aware confidence scoring (replace hardcoded 0.65 baseline)
- Multi-exercise testing and concurrent-user stress testing
- Gas cost modeling for smart contract operations at operational scale
- TEE attestation implementation (hardware root of trust)

**Medium-Term (18-36 months):**
- Multi-node NEAR deployment (distributed validator network for operational resilience)
- Hardware TEE integration across all participating devices
- Real multi-robot swarm operations (physical, not simulated)
- Coalition partner testing with allied nation observers
- Formal doctrinal integration study with JPP working group

**Long-Term (36+ months):**
- JADC2 integration pathway investigation (Joint All-Domain Command and Control)
- NATO interoperability standards compliance assessment
- Operational pilot under exercise conditions (JRTC or equivalent)
- Publication of architecture standards for AI-governed military C2

Each column is preceded by an icon: a wrench symbol for Near-Term, a building/construction symbol for Medium-Term, a flag/objective symbol for Long-Term. Icons in blue (#2563EB).

### Speaking Script
The roadmap from research prototype to operational relevance has three stages.

Near-term — the next six to eighteen months — is about hardening the foundation. A formal security audit and penetration test. Source-tier-aware confidence scoring that replaces the current hardcoded baseline with a scoring model that accounts for the actual reliability history of each intelligence source. Multi-exercise testing to validate that the architecture scales beyond the single Pacific Strategy AY26 scenario. Gas cost modeling to understand the economics of blockchain governance at operational scale. And TEE attestation — moving from "zero trust by design" to "zero trust by hardware verification."

Medium-term — eighteen to thirty-six months — is about validation at scale. Multi-node NEAR deployment, because a single-node blockchain is not operationally resilient. Real multi-robot swarm operations, because the six doctrinal formations need physical validation, not just COP representation. Coalition partner testing — bringing allied nation observers into exercises and validating that the DID-based coalition caveat model works across national systems. And a formal doctrinal study: does the JPP actually compress when AI-augmented? What are the second-order effects on staff competency and commander judgment?

Long-term — beyond three years — is about integration. The JADC2 program is the U.S. Department of Defense's primary initiative for multi-domain command and control. BASTION's architecture — distributed, AI-augmented, blockchain-governed — is architecturally aligned with JADC2 principles, but formal integration would require standards compliance work that has not begun. NATO interoperability assessment. And ultimately, an operational pilot — taking BASTION into a controlled exercise environment at JRTC or equivalent with actual units and measuring the outcome against baseline planning cycle performance.

This is a research prototype with a path to operational relevance. The path is defined. The work is significant. The destination is worth it.

### DEMO CUE
No demo cue for this slide. Allow the roadmap to stand as a planning document.

### Transition
Advance to Slide 23 — enumeration of the research contributions.

---

## Slide 23: Key Research Contributions

### Purpose
Enumerate what this research contributes to the field. This is the claim slide — what BASTION has established that did not exist before. Each contribution is a distinct intellectual and technical contribution, not a feature list. Framed for the academic audience.

### Visual Layout
Title "Key Research Contributions" at top. Subtitle: "Eight contributions to the field of AI-augmented military command and control." Main content: numbered list, one contribution per line, clean and authoritative typography. No imagery, no diagram — the list speaks for itself. Generous whitespace between items.

### Image Prompt
No AI image — this is a clean text slide.

### Diagram Spec
No diagram.

### Speaking Script
Eight contributions.

One: a DAO-governed military C2 architecture. The first working implementation of DAO-based governance applied to military command and control at the problem set level, demonstrating feasibility of on-chain human decision gates in a planning context.

Two: a five-tier authority delegation model. A formally specified hierarchy of authority levels — from strategic command to autonomous system — with each tier's permissions encoded in smart contracts and enforced without manual intervention.

Three: AI agent orchestration for military planning at scale. A 131-agent architecture covering 19 AI capability roles and 31 Joint Planning Process staff officer roles, orchestrated through LangGraph workflows, demonstrating that AI staff augmentation can span the full JPP cycle.

Four: a knowledge graph for strategic intelligence accumulation. A graph-based intelligence environment that accumulates entity-relationship data across documents and sources, enabling the synthesis that current manual methods cannot achieve at comparable speed.

Five: smart contract policy enforcement for coalition operations. The `check_employment_authorized()` enforcement model demonstrating that coalition caveats can be encoded as verifiable contract conditions rather than policy instructions subject to human error.

Six: DID-based identity with on-chain coalition caveats. An implementation of W3C Decentralized Identifiers applied to military resources, personnel, and systems — with the `ResourceCaveats` data structure enabling Five Eyes releasability, ROE tier enforcement, geographic restrictions, and temporal windows — all on-chain.

Seven: a three-tier edge architecture for autonomous systems. The cloud-bridge-edge pattern demonstrating that blockchain-governed autonomy can survive DDIL conditions while maintaining authority delegation integrity.

Eight: training-operational governance parity. A working implementation of "train as you fight" governance — shared smart contracts, identical DAO authority structures, and data isolation — establishing that operational governance can be rehearsed, not just described.

### DEMO CUE
No demo cue for this slide — let the list speak.

### Transition
Advance to Slide 24 — the answer to the research question.

---

## Slide 24: The Answer

### Purpose
Return to the research question posed in Slide 2. Answer it directly. This is the closing argument — connecting the journey the audience has taken through the architecture back to the question that opened the academic framing of the briefing. The answer should be assertive but appropriately caveated for a prototype.

### Visual Layout
Title "The Answer" at top. Main content: the research question displayed prominently in a styled quote block (left-aligned, vertical cyan (#06B6D4) bar on the left side, research question text in large italic type). Below the quote block: a dividing line. Then the answer in clean, assertive body text — three to four sentences. Full-bleed hero image on the right half of the slide (see Image Prompt). The image occupies 45% of slide width on the right, with the text elements on the left 55%.

### Image Prompt
AI-generated closing hero — abstract visualization of clarity emerging from complexity, 16:9. A network of dispersed, complex data streams — branching lines, nodes, scattered information artifacts — converging toward a single clear beacon or focal point at the center-right of the image. The convergence point radiates clean, clear light. Color palette: deep blue (#2563EB) for the network streams, white (#FFFFFF) for the convergence point, cyan (#06B6D4) for the intermediate connections near the convergence, pure white background. Style: abstract data visualization, clean and minimal, no literal imagery. Mood: "clarity emerging from complexity" — the relief of a difficult question answered. Aspect ratio: 16:9. Specific elements: the network streams should be clearly converging (not diverging), the focal point should be the brightest element, subtle gradient from complexity at edges to clarity at center. Avoid: dark backgrounds, chaotic imagery, military iconography, photorealistic elements, anything suggesting the complexity is unresolved or threatening.

### Diagram Spec
No diagram — the Image Prompt is the primary visual.

### Research Question (from Slide 2)
*"Can blockchain-based governance and AI agent orchestration enable scalable, auditable, and institutionally legitimate command and control for complex coalition operations, including the governance of autonomous physical systems?"*

### Speaking Script
The question was this: Can blockchain-based governance and AI agent orchestration enable scalable, auditable, and institutionally legitimate command and control for complex coalition operations — including the governance of autonomous physical systems?

BASTION is the answer.

Not a complete answer. Not a production-ready answer. But a working proof of concept that demonstrates feasibility across all three requirements embedded in the question.

Scalability: the NEAR Protocol sharding architecture, the LangGraph multi-agent orchestration framework, and the hybrid storage model are each chosen for their ability to scale. The current implementation handles a single exercise scenario. The architecture is designed to handle more.

Auditability: every governance decision, every authority delegation, every resource employment check is recorded on the NEAR blockchain. The audit trail is not a log file someone controls — it is an immutable ledger that any participant can verify independently.

Institutional legitimacy: the DAO governance model removes the requirement for trust in any single institution. A coalition partner does not need to trust BASTION, or the nation that developed it, or any specific organizational actor. They need only trust the smart contracts they can read and the blockchain whose state they can verify. Institutional legitimacy does not require institutional trust. It requires institutional verifiability.

And for the autonomous physical systems requirement: the opening demonstration was not a concept video. That was BASTION governing a physical robot through a mission — planning it, authorizing it, pausing it when the robot exceeded its delegated authority, and resuming it when human judgment authorized continuation.

The question asked whether this was possible. BASTION demonstrates that it is.

### DEMO CUE
Second screen: BASTION running — the live system is the answer. Navigate to any tab that shows the planning environment in active use. If Ironclaw is visible, better. If the COP is visible, better still. The point is that the system is alive and running as the presenter closes the argument.

### Transition
Advance to Slide 25 — Q&A.

---

## Slide 25: Q&A

### Purpose
End slide. Remains on screen during the entire question and answer period. Minimal visual distraction — the BASTION system on the second screen should be the visual focus during Q&A, not the deck. This slide simply confirms the briefing is complete and holds contact information.

### Visual Layout
Centered layout, maximum whitespace. BASTION name in large bold text center-top: "BASTION." Subtitle beneath: "Blockchain Autonomous Strategy and Tactical Intelligence Operational Network." Thin cyan (#06B6D4) horizontal rule below the subtitle. Below the rule, centered: "Questions?" in large, clean typography (not bold — inviting, not demanding). Below that: presenter name and contact placeholder on separate lines. Bottom of slide: "UNCLASSIFIED // FOR OFFICIAL USE ONLY" in small text, and date "March 2026." No imagery. No background elements.

### Image Prompt
No AI image — simple text slide.

### Diagram Spec
No diagram.

### Speaking Script
Thank you. The system is live on the second screen — I am happy to demonstrate any capability you would like to explore. Questions?

### DEMO CUE
Second screen: BASTION remains running throughout Q&A. Navigate to whatever tab is most useful for the first anticipated question — if the audience has been engaged with physical autonomy, the COP tab or robot bridge page. If governance has been the focus of questions during the briefing, a DAO proposal view. Keep the system ready for live demonstration of any capability discussed. The second screen is an asset during Q&A — not a background.

### Transition
End of core deck.

---

## Document Completeness Verification

This document (Slides 1-25 — complete core deck) satisfies the following verification criteria:

| Check | Result |
|-------|--------|
| Slides 1-25 fully specified | PASS — 25 slides present |
| Every slide has Speaking Script | PASS — 25 speaking scripts |
| Every slide has DEMO CUE or explicit "no demo cue" | PASS — 25 demo cue sections |
| Hero/illustrative slides have image prompts | PASS — Slides 1, 3, 4, 16, 21, 24 have full AI image prompts |
| Architecture/capability slides have diagram specs | PASS — Slides 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18 have diagram specs |
| Document header with color palette | PASS — present at top of document |
| Narrative arc follows locked decision | PASS — demo opens, problem-first, simplified arch, capability sections, synthesis, reflection, close |
| Phase 55 content present | PASS — Slide 10: Ironclaw as Chief of Staff |
| Phase 56 content present | PASS — Slide 10: Visual Operational Approach Editor |
| Phase 57 content present | PASS — Slide 18: Ironclaw persistent memory graph highlighted |
| Phase 58 content present | PASS — Slides 11, 13: check_employment_authorized(), ResourceCaveats struct |
| Architecture synthesis bookends Slide 6 | PASS — Slide 18 references Slide 6 and provides detailed companion diagram |
| Closing reflection covers all required topics | PASS — Slide 19 (tradeoffs), Slide 20 (limitations), Slide 21 (doctrinal impact), Slide 22 (roadmap) |
| Slide 24 answers the research question from Slide 2 | PASS — research question quoted and answered directly |
| Speaking scripts maintain "academic with edge" tone | PASS — rigor + engagement throughout |
| Image prompts include all 7 required elements | PASS — subject, style, palette, mood, aspect ratio, elements, avoidances |
| Demo cues reference actual BASTION screens | PASS — COP, Design, Understand, Resources, robot bridge, memory panel used |

### Word Count Estimate — Slides 14-25

| Slide | Script Length |
|-------|--------------|
| Slide 14 | ~260 words |
| Slide 15 | ~270 words |
| Slide 16 | ~200 words |
| Slide 17 | ~280 words |
| Slide 18 | ~220 words |
| Slide 19 | ~310 words |
| Slide 20 | ~310 words |
| Slide 21 | ~290 words |
| Slide 22 | ~250 words |
| Slide 23 | ~230 words |
| Slide 24 | ~250 words |
| Slide 25 | ~50 words |
| **Slides 14-25 Subtotal** | **~2,920 words** |
| **Slides 1-13 Subtotal** | **~2,920 words** |
| **Full Deck Total** | **~5,840 words** |

Complete speaking scripts span the full 25-slide deck at approximately 5,840 words — a 40-minute briefing at standard speaking pace.

---

# ANNEX SLIDES

**Purpose:** Prepared depth for Q&A. Each annex slide maps to one or more core slides. The presenter navigates to these when asked "tell me more about X." Annex slides are intentionally more technical than core slides — the audience asking for depth can handle it.

**Navigation:** Annex slides are numbered A1–A17. During Q&A, jump directly to the relevant annex slide rather than improvising. Return to Q&A slide (Slide 25) after each deep-dive.

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
| JPP | Joint Planning Process — the Joint Staff methodology for operational planning | BASTION's 131 JPP staff role agents map directly to the JPP structure |
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
| Confidence Scoring | Numerical measure of information reliability (0.0–1.0) | BASTION tracks confidence for every intelligence assertion in the knowledge graph |
| MIL-STD-2525D | Military standard for tactical symbols — the language of the COP map | BASTION generates these symbols programmatically from extracted entities |
| Subspace Isolation | Partitioning a shared data store by workspace to prevent data leakage | Each BASTION problem set has an isolated knowledge graph subspace |

---

### Speaking Script

This is your reference. Every technical term in the briefing is defined here in plain language. You do not need to memorize these definitions — that is what this slide is for. If anything in the deck raised a "wait, what does that mean?" reaction, the answer is here.

Notice the three categories: Blockchain and Web3 terms at the top, military doctrine terms in the middle, and AI and data terms at the bottom. BASTION sits at the intersection of all three — that is what makes it architecturally novel. Most systems in this space speak either military doctrine or blockchain or AI. BASTION's contribution is a coherent architecture that speaks all three simultaneously.

---

### Demo Cue

No demo cue — reference slide. Keep on screen during Q&A to answer terminology questions as they arise.

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

### Speaking Script

The knowledge graph is what separates BASTION from a document management system or a chat interface. When you upload an OPORD into BASTION, the AI does not just store the file — it reads it, extracts every entity mentioned, identifies the relationships between those entities, and writes that structure into a graph database.

The result is machine-readable situational awareness. BASTION knows that the 3rd Battalion is commanded by Colonel Park, that it is located at grid reference Sierra-7, that it participated in the operation at Objective Eagle on Day 4, and that Objective Eagle is 12 kilometers from the nearest logistics support area. Those are not separate facts stored in separate documents — they are connected nodes in a graph that any agent or staff officer can traverse.

The schema uses seven node types: persons, organizations, locations, equipment, events, documents, and concepts. Relationships between nodes use labeled edges. Every node carries a confidence score and a provenance link back to the source document it was extracted from.

The graph grows over time. Early in the planning cycle it is sparse — a few hundred nodes from initial documents. As the operation proceeds and new intelligence arrives, new events are ingested, and the graph densifies. By execution phase, it reflects the accumulated knowledge of the entire staff.

Technical implementation: Neo4j graph database with JSON-LD schema, isolated per problem set using subspace partitioning. Graph queries use Cypher. Agent access is through a REST API layer that enforces workspace boundaries.

---

### Demo Cue

Second screen: Navigate to the Understand tab, open the brain graph visualization, click on a unit entity to show its relationships, traverse to a linked location or event. Show the confidence score and source document link on an entity detail panel.

---

## Slide A3: Agent Architecture Deep-Dive

**Maps to core slides:** 8–9 (Agent Hub and Operational Advisors)

**Purpose:** Full agent taxonomy, orchestration architecture, and multi-model design.

---

### Visual

**Diagram 1: Agent Taxonomy Tree**

Hierarchical tree showing all agent categories and example agents under each:

```
BASTION Agent Hub (131+ agents)
├── Ironclaw: Chief of Staff Agent
│   ├── 60-second proactive polling loop
│   ├── Persistent memory graph (Phase 57)
│   └── Cross-tab context synthesis
│
├── Intelligence Directorate (J2)
│   ├── IPB Agent (Intelligence Preparation of the Battlefield)
│   ├── OSINT Agent (Open Source Intelligence)
│   ├── Signal Intelligence Agent
│   ├── All-Source Fusion Agent
│   └── Threat Assessment Agent
│
├── Operations Directorate (J3)
│   ├── Mission Analysis Agent
│   ├── COA Development Agent (x3 parallel)
│   ├── COA Comparison Agent
│   ├── Risk Assessment Agent
│   └── Synchronization Agent
│
├── Logistics Directorate (J4)
│   ├── LOGSTAT Agent
│   ├── Sustainment Planning Agent
│   └── CSS Analysis Agent
│
├── Strategic/Plans Directorate (J5)
│   ├── Operational Design Agent
│   ├── Center of Gravity Agent
│   ├── Lines of Effort Agent
│   └── End State Analysis Agent
│
├── Communications (J6)
│   └── Network Architecture Agent
│
└── JPP Staff Role Agents (102 agents)
    ├── Maps to each named role in JP 5-0 Annex B
    └── Activated on-demand for specific planning tasks
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

### Speaking Script

BASTION has 131 named AI agents. That number is not arbitrary — it maps to the actual organizational structure of a joint planning staff as defined in JP 5-0. Every directorate, every functional role, every specialized planning function has a corresponding AI agent.

The taxonomy breaks into three groups. First, the core directorate agents: these are always-on, tied to the six major staff directorates — Intelligence, Operations, Logistics, Plans, Communications, and Command. Second, the 102 JPP staff role agents: these are on-demand specialists that activate when a specific planning task requires their expertise. Third, Ironclaw — the Chief of Staff agent that coordinates all the others and maintains the persistent awareness that the directorate agents lack.

Orchestration uses LangGraph — a Python framework for building stateful agent workflows as directed graphs. Each workflow is a directed acyclic graph of agent steps. Some steps execute in parallel when outputs are independent. Human decision gates are explicit nodes in the graph — the workflow does not proceed past a gate until the human approves.

Multi-model design: not every agent uses the same AI model. Complex analytical tasks like COA development use large context models. Classification and entity extraction use faster, cheaper models. The orchestrator selects the appropriate model for each step. This reduces cost and latency without sacrificing capability where it matters.

Agent memory: agents within a single workflow share context through the LangGraph state object. Cross-session memory is routed through Ironclaw's persistent memory graph. Agents do not hallucinate previous decisions because Ironclaw writes them to the knowledge graph — where they persist and are queryable.

---

### Demo Cue

Second screen: Navigate to the Agent Hub tab or any planning tab where an agent team is active. Show the agent activity stream — each agent's status, its current task, and its output. If a workflow is in progress, show the dependency graph of agent steps with status indicators.

---

## Slide A4: Ironclaw Chief of Staff Deep-Dive

**Maps to core slides:** 9–10 (Ironclaw: Your Chief of Staff), 18 (Architecture Synthesis)

**Purpose:** Full technical depth on Ironclaw's architecture — the persistent memory system, proactive polling, design coordination capability, and adaptive relationship development.

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

### Speaking Script

Ironclaw is not a chatbot. You do not open a chat window and ask Ironclaw questions. Ironclaw operates on a continuous 60-second polling loop — every minute, whether or not anyone is talking to it, Ironclaw analyzes the current state of the planning environment, cross-references it against what it knows from the persistent memory graph, and determines whether anything requires the commander's attention.

If something requires attention, Ironclaw surfaces a decision card in the decision drawer — a brief, structured summary of what was found and what options are available. The commander reviews and responds. That response is then written back to the memory graph, where it informs all future Ironclaw behavior.

This is the Chief of Staff function. A good Chief of Staff does not wait to be asked. They track the operational environment, anticipate requirements, coordinate staff effort, and surface issues before they become crises. Ironclaw does exactly this — for every tab, every workflow, every active planning cycle simultaneously.

The persistent memory graph — built in Phase 57 — is what makes Ironclaw adaptive rather than stateless. Without memory, every session starts from scratch. With memory, Ironclaw accumulates a model of how this specific commander thinks, what their standing preferences are, which decisions they have made and why, and which approaches have worked. Over time, the suggestions become more relevant and the friction of planning decreases.

Phase 55 adds the operational design coordination capability — Ironclaw systematically works through the operational design framework as Chief of Staff would, obtaining and validating inputs from the staff, synthesizing them into the design framework, and flagging gaps for commander attention. This is not an interview — it is staff coordination, conducted by Ironclaw in its Chief of Staff role.

Auth scoping: each user's Ironclaw memory is isolated. Ironclaw is not a single shared agent — it is an agent that presents differently to each authorized user based on their role, their problem set access, and the accumulated memory of their working relationship.

---

### Demo Cue

Second screen: Open any planning tab, show Ironclaw in the decision drawer. Demonstrate a proactive suggestion — open the notification, show its context, show the response options. Navigate to the Memory tab in the Ironclaw drawer to show the persistent memory graph — individual memory items with their timestamps and context tags.

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

### Speaking Script

The smart contract is the policy enforcement layer that makes BASTION's authority claims verifiable rather than declarative. When any agent or staff officer wants to take an action involving a resource — deploy a robot, access classified intelligence, task a coalition asset — that request is checked against the resource's on-chain caveats before the action is permitted.

The `ResourceCaveats` struct is the data structure that stores those caveats on the blockchain. It has five fields: classification level, releasability by nation code, rules of engagement tier, geographic bounds, and time windows. These are not soft attributes in a database that an administrator can override. They are on-chain — changing them requires a signed transaction from an authorized account, which creates an immutable record in the blockchain history.

The authorization check is sequential. Every field is checked in order. A denial at any point immediately returns — with a denial reason and an audit record written to the blockchain. That audit record is the accountability mechanism. A commander cannot authorize an action, deny authorizing it, and have the blockchain agree with the denial. The record is permanent.

Phase 58 extended this to on-chain caveats specifically — moving the caveat storage from PostgreSQL into the smart contract. This is architecturally significant: the authoritative source of truth for employment restrictions is now on a public blockchain, not in a database that the operator controls. Coalition partners do not need to trust the operator's database. They verify against the blockchain directly.

The contract is deployed at `did.bastion.testnet` on the NEAR testnet. Every authorization check, every caveat update, and every denial is visible in the testnet explorer. That transparency is intentional — it is the accountability proof that makes human control over lethal decisions verifiable.

---

### Demo Cue

Second screen: Navigate to the Resources tab, show the SecurityCaveatsSection for a resource, show the on-chain caveats panel with classification, releasability, and ROE tier. Alternatively, open the NEAR testnet explorer at did.bastion.testnet and show recent contract calls in the transaction history.

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

### Speaking Script

The DAO governance model is not a metaphor for good governance — it is literally how authority is exercised in BASTION. Every decision that has operational or legal consequence is processed through a governance proposal that is voted on, recorded on the blockchain, and cannot be altered after the fact.

The proposal lifecycle has four stages. First, creation: any authorized account can create a proposal, specifying the action requested, the authority tier it falls under, the voting period, and the required quorum. Second, voting: eligible voters at that tier can cast votes during the open period. Each vote is an on-chain transaction — permanently recorded. Third, resolution: at the deadline, the contract checks quorum and tally. If quorum is not met, the proposal expires — inaction is a decision, and it is recorded. If quorum is met and the vote passes, the proposal executes. Fourth, execution: the smart contract automatically performs the associated action and writes the final audit record.

Quorum rules vary by tier. Theater-level decisions can be made by a single senior commander. Coalition-level decisions require affirmative votes from all contributing nations. This is designed to mirror actual doctrine — speed at tactical echelons, deliberation at strategic and coalition echelons.

The strike authorization invariant is the hardest rule in the system. There is no default authorization for lethal force. There is no automation that can generate it. There is no path through the codebase that produces a strike authorization without an explicit affirmative human vote at the responsible tier. This is not a policy — it is a property of the smart contract that is verifiable by anyone who reads the code.

---

### Demo Cue

Second screen: Navigate to the Decide tab, show the governance dashboard, show a sample proposal in the voting or executed state. Show the proposal detail with vote history and the on-chain transaction link. If available, show the Tier visualization showing which commanders are in which governance tier.

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

### Speaking Script

The DID — Decentralized Identifier — is BASTION's universal identity mechanism. Every entity that touches the operational environment has a DID: every robot, every intelligence report, every planning document, every staff officer, every AI agent. The DID connects the entity to its caveats, its authorization rules, and its operational history on the blockchain.

The DID format follows the W3C DID specification: `did:near:{account}#{resource}`. The NEAR account is the owner — the only account that can update the DID's caveats. The resource suffix distinguishes multiple assets owned by the same account.

BASTION defines five plugin types: hardware, software, personnel, data, and composite. Hardware DIDs cover physical assets — robots, sensors, platforms. Software DIDs cover BASTION modules and agent instances. Personnel DIDs cover every human with system access. Data DIDs cover every document and intelligence product. Composite DIDs cover aggregated entities like joint task forces — and they automatically inherit the most restrictive caveat from all their member DIDs.

The coalition sharing example makes the releasability field concrete. A US-generated intelligence product is marked with its classification and a releasability array listing the five EYES nations. When an Australian analyst requests access, the contract checks whether "AUS" is in the releasability array. It is — access granted. When an unauthorized nation requests access, the check fails — access denied, with an immutable denial record on the blockchain.

This is how BASTION solves the coalition information sharing problem without requiring bilateral agreements between every pair of nations. The sharing rules are encoded in the resource's DID. Any party with access to the NEAR testnet can verify the rules and the access history.

---

### Demo Cue

Second screen: Navigate to the Resources tab, select a resource, show its DID and the full caveat display. Show the releasability array and the ROE tier. If testnet explorer is accessible, show the DID registration transaction and the caveat history.

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
│  Ironclaw (decision coordination)                               │
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

### Speaking Script

The physical autonomy tier is where BASTION's planning outputs become physical action. The architecture has three tiers: cloud, bridge, and edge. Each tier has a distinct role, and the system is designed to continue functioning even when the connections between tiers are intermittent or degraded.

The cloud tier is the BASTION application itself — the knowledge graph, the agent hub, the DAO governance layer, and Ironclaw. This is where decisions are made and where authority resides.

The Docker bridge is the critical middle layer. It runs as a container on a local network — physically close to the robots. The bridge has two jobs: translate cloud commands into robot-executable instructions, and enforce the authority chain before forwarding any command. Before the bridge forwards any action to the edge, it confirms that the action has been authorized through the DAO governance process. The bridge is not just a relay — it is a policy enforcement point. If the robot loses connection to the cloud, the bridge queues commands and re-syncs when connectivity is restored.

The edge is a Jetson Orin Nano paired with a Sphero RVR+ platform. The Jetson runs a YOLOv8 computer vision pipeline — real-time object detection and classification. The RVR+ provides mobility. Together they execute the formation and movement commands issued from the cloud through the bridge.

The six doctrinal formations map directly to standard military doctrine for small unit tactics. BASTION does not invent new tactics — it provides a controllable interface for commanding formations that military units already know.

The DAO-governed engagement chain is the key constraint: the bridge will not forward any lethal action command without a governance-approved authorization token. That token must be generated by an explicit DAO vote — it cannot be manufactured by any agent or automation layer.

---

### Demo Cue

Second screen: Show the robot control panel in BASTION (if robot is physically connected). Show the formation selector and the authority chain status. If the robot is live, demonstrate a formation command and show the authorization check occurring before movement. Alternatively, show the Docker bridge container logs demonstrating the authority check.

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

### Speaking Script

The Common Operating Picture in BASTION is not drawn by a map sergeant. It is generated by AI from the planning documents already in the system.

The pipeline has six stages. First, the planning document is pre-processed — chunked into sentences, normalized. Second, named entity recognition extracts every unit, person, location, and piece of equipment mentioned. Third, relationship extraction links those entities to each other and to existing knowledge graph nodes. If the document mentions the 3rd Battalion, and the 3rd Battalion is already in the graph from a previous document, they are merged — the COP gets richer, not wider.

Fourth, each extracted entity is mapped to a MIL-STD-2525D symbol code. MIL-STD-2525D is the military standard for tactical symbols — it encodes affiliation, echelon, function, and status into a symbol structure. BASTION generates these codes programmatically from the entity's context: a "3rd Battalion" with "hostile" context gets a red hostile unit symbol; the same entity in a "friendly" context gets a blue friendly symbol.

Fifth, SVG symbols are generated to spec. Sixth, the symbols are placed on the map using geocoded coordinates and linked to their knowledge graph nodes — so clicking a symbol shows everything BASTION knows about that entity.

The perspective toggle and phase slider are the two key navigation tools. The perspective toggle filters by affiliation — the same plan viewed from friendly versus adversary perspective. The phase slider filters by the temporal phase tag, showing how the operational picture evolves across the six Pacific Strategy AY26 phases.

The key claim: BASTION's COP reflects what the staff has planned and what intelligence has been gathered. It is not ground truth — it has confidence scores. But it is generated automatically, which means it is always current with the latest documents in the system.

---

### Demo Cue

Second screen: Navigate to the COP tab. Show the map with MIL-STD-2525D symbols. Demonstrate the perspective toggle (switch between friendly and adversary view). Use the phase slider to advance through Pacific Strategy AY26 phases. Click on a symbol to show the entity detail panel and its knowledge graph connections.

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

### Speaking Script

The zero trust architecture in BASTION is not a firewall configuration — it is a verification model that asks four questions about every consequential action and uses cryptographic mechanisms to answer them.

Working from the inside out: the innermost ring is TEE attestation — hardware-level proof that the AI processing intelligence data is running in an unmodified, trusted execution environment. Intel SGX and TDX, and the Phala Network concept for cloud TEEs, provide this capability. I want to be explicit: TEE attestation is a design goal in BASTION, not yet implemented. It represents the full security architecture BASTION is designed toward.

Layer 4 is blockchain proof — the immutable transaction history on NEAR. Every governance decision, every caveat change, every authorization event is recorded as a blockchain transaction. This is the tamper-evident audit log. No one can alter it — not the system operator, not the platform provider, not a malicious insider. The record is permanent and public.

Layer 3 is smart contract policy enforcement — the caveat check on every resource employment request. Five fields, checked in sequence, with a denial record written if any check fails. This is what turns policy into math.

Layer 2 is DAO governance — the collective authority validation. Even if the smart contract says a resource can be employed, the action must have passed through the appropriate governance tier. An authorized resource without an authorized proposal is still unauthorized.

Layer 1 is the AI advisory layer — the recommendation engine. It sits outside all the verification layers. It advises. It does not authorize. The human decision gate between the AI recommendation and the governance vote is the architectural boundary between advice and authority.

Trust in BASTION does not terminate at policy or training or good intentions. It terminates at math — at cryptographic proof and immutable records that any party can verify.

---

### Demo Cue

Second screen: Navigate to the Decide tab and show the verification status indicators — which layers are active for a current decision. Show the governance proposal with its on-chain transaction link. Show the smart contract caveat check result for a resource. Narrate each layer as you show the corresponding UI element.

---

## Slide A11: Live Demo Script — Understanding Phase

**Maps to core slides:** 7 (Knowledge as Infrastructure), 3 (opening demo context)

**Purpose:** Step-by-step guided walkthrough for demoing the Understand tab during Q&A. This IS the demo script — the presenter reads from this slide while executing the demo on the second screen.

---

### Visual

Clean two-column layout. Left column: numbered step list. Right column: screenshot placeholder annotated with what to show at each step. Title: "DEMO: Understanding the Operational Environment"

---

### Demo Script (follow on second screen)

**Step 1 — Open the Understand tab**
Navigate to the Understand tab. The tab shows the brain graph visualization. Orient the audience: "This is where everything BASTION knows about the operational environment lives."

**Step 2 — Show an empty vs. populated graph**
If starting from scratch: explain that the graph begins empty and grows with every document uploaded. If the Pacific Strategy AY26 scenario is loaded: the graph already has entities from scenario initialization. Show the entity count in the graph header.

**Step 3 — Upload a document (or point to an existing one)**
If live upload: drag a planning document (OPORD fragment, intel report) into the upload zone. Watch the ingestion spinner. When complete, note that the graph node count has increased.
If pre-loaded: navigate to the Documents section and select a previously ingested document. Show the document detail panel.

**Step 4 — Watch entities appear in the graph**
Pan and zoom the brain graph visualization. Identify key entity clusters: units (blue nodes), locations (green nodes), events (red nodes). "Every node you see was extracted automatically from a planning document. No one drew this — the AI built it."

**Step 5 — Click on an entity**
Click on a unit node (e.g., 3rd Battalion or equivalent). Show the entity detail panel: name, type, confidence score, source document link, relationship list.

**Step 6 — Traverse a relationship**
From the entity detail panel, click a relationship to navigate to a linked entity. E.g., from the unit → click LOCATED_AT → navigate to the location node. Show the location's coordinates and the documents that placed the unit there.

**Step 7 — Show the source document link**
Click the source document link on the location entity. Show the original document passage where this location was mentioned. "This is the provenance chain — every piece of knowledge is traceable back to a specific sentence in a specific document."

---

### Speaking Script

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

## Slide A12: Live Demo Script — Planning Phase

**Maps to core slides:** 8 (Agent Hub), 9–10 (Ironclaw), 18 (Architecture Synthesis)

**Purpose:** Step-by-step guided walkthrough for demoing the Design and Plan tabs during Q&A.

---

### Visual

Same two-column format as A11. Title: "DEMO: Designing the Operation and Building the Plan"

---

### Demo Script (follow on second screen)

**Step 1 — Open the Design tab**
Navigate to the Design tab. This is the operational design workspace. Orient the audience: "This is where the staff translates strategic direction into an operational approach."

**Step 2 — Show the Center of Gravity analysis**
Navigate to the CoG section. Show the adversary CoG analysis: BASTION's AI has identified the CoG, critical capabilities, critical requirements, and critical vulnerabilities. "Ironclaw coordinated this analysis from the J2 intelligence agents and the J5 planning agents. The staff officer reviews and validates — not authors."

**Step 3 — Show the Operational Approach**
Navigate to the Operational Approach section. Show the Lines of Effort and their connections to the end state. "This is the operational logic — the visualization of how we get from current conditions to end state."

**Step 4 — Show Ironclaw surfacing a decision**
Open the Ironclaw decision drawer (if a proactive suggestion is pending). Show the decision card: what Ironclaw identified, why it matters, what options are available. "Ironclaw identified this gap in the operational design and surfaced it without being asked. This is the Chief of Staff function."

**Step 5 — Open the Plan tab**
Navigate to the Plan tab. Show the campaign plan structure: phases, tasks, sequencing.

**Step 6 — Show OPORD generation**
Navigate to the OPORD section. Show a generated OPORD section — Situation, Mission, Execution. "This OPORD section was generated from the knowledge graph and the design decisions. The staff officer reviews, edits, and approves — BASTION provides the draft."

**Step 7 — Show Ironclaw contextual assistance in the Plan tab**
If Ironclaw has a suggestion relevant to the current planning state, show it in context. "Every tab has Ironclaw present. It is always tracking the full operational picture, not just what is on screen."

---

### Speaking Script

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

## Slide A13: Live Demo Script — Governance and Execution

**Maps to core slides:** 11–14 (governance, DIDs, autonomy)

**Purpose:** Step-by-step guided walkthrough for the Decide tab and robot execution demo during Q&A.

---

### Visual

Same two-column format as A11-A12. Title: "DEMO: Governance, Authority, and Autonomous Execution"

---

### Demo Script (follow on second screen)

**Step 1 — Open the Decide tab**
Navigate to the Decide tab. This is the governance dashboard. "This is where decisions with operational or legal consequence are formalized."

**Step 2 — Show the decision dashboard**
Show the list of pending and completed governance proposals. Point out a completed proposal — show the vote tally, the timestamp, and the on-chain transaction link.

**Step 3 — Click the on-chain transaction link**
Open the NEAR testnet explorer link. Show the transaction record: who voted, when, the proposal details, the outcome. "This record cannot be altered. It is on the blockchain. If anyone asks 'who authorized this?' — this is the answer."

**Step 4 — Show the authority tier visualization**
Show the 5-tier authority structure visualization. Point out which tier the current operation falls under and what quorum is required. "The system enforces this automatically. A Tier 3 tactical commander cannot approve a Tier 1 theater action — the smart contract rejects the attempt."

**Step 5 — Navigate to Resources tab, show a resource with caveats**
Navigate to the Resources tab. Select a resource (robot or intelligence product). Show its DID and caveats. Point out the releasability array. "This resource is releasable to Five Eyes nations. The smart contract checks this before any agent or staff officer can access it."

**Step 6 — (If robot is physically present) Show robot execution**
Switch to the robot control view. Show the robot's current status, formation, and position. Issue a simple movement command. Narrate the authority check: "Before this command reaches the robot, it passes through the Docker bridge, which confirms the DAO authorization token is valid. Without that token, the bridge will not forward the command."

**Step 7 — (If robot is not present) Show the bridge log**
Open the Docker bridge container log. Show the authorization check event: command received, token validated, command forwarded. "The bridge is the enforcement point. It is always running, always checking."

---

### Speaking Script

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

## Slide A14: Companion Whitepaper Overview

**Maps to core slides:** 24–25 (closing, Q&A backup)

**Purpose:** Point the audience to the leave-behind document for full technical depth and academic citations.

---

### Visual

Clean single-column layout. Title: "BASTION: Companion Whitepaper"

Displayed as a formatted table of contents:

```
BASTION: Blockchain Autonomous Strategy & Tactical Intelligence Operational Network
A Research Prototype in AI-Enabled Coalition Command and Control

Chapter 1: Introduction and Research Question
  1.1 Problem Statement: The Coalition C2 Challenge
  1.2 Research Question and Contributions
  1.3 Design Science Research Methodology
  1.4 Scope and Limitations

Chapter 2: Background and Literature Review
  2.1 Current State of Military C2 Systems
  2.2 Blockchain in Defense Applications
  2.3 AI Agent Orchestration Frameworks
  2.4 Decentralized Identity and Verifiable Credentials
  2.5 Autonomous Systems and Human Control Frameworks

Chapter 3: System Architecture
  3.1 Architectural Overview
  3.2 Knowledge Graph and Situational Awareness
  3.3 Agent Hub: Taxonomy, Orchestration, and Workflows
  3.4 DAO Governance: Proposal Lifecycle and Quorum Mechanics
  3.5 DID Registry and Coalition Caveats
  3.6 Smart Contract Policy Enforcement
  3.7 Physical Autonomy: Bridge and Edge Architecture
  3.8 Training-Operational Parity

Chapter 4: Technology Selection and Tradeoffs
  4.1 Blockchain Platform Selection (NEAR)
  4.2 AI Orchestration (LangGraph)
  4.3 Storage Architecture (Hybrid)
  4.4 Identity Standard (DIDs)

Chapter 5: Evaluation and Findings
  5.1 Prototype Demonstration: Pacific Strategy AY26
  5.2 Governance Integrity Findings
  5.3 Planning Compression Findings
  5.4 Limitations and Future Work

Chapter 6: Doctrinal Implications and Future Research
  6.1 Impact on Staff Roles and Doctrine
  6.2 JADC2 Integration Pathway
  6.3 NATO Interoperability Assessment
  6.4 Research Agenda

References (Chicago 18th Edition)
Appendix A: Smart Contract Code (DID Registry)
Appendix B: Agent Taxonomy (Full List)
Appendix C: Knowledge Graph Schema (JSON-LD)
```

Annotation at bottom: "Available as printed PDF — ask the presenter. Full Chicago 18th edition footnote citations throughout."

---

### Speaking Script

Everything you have seen today is documented in full technical depth in the companion whitepaper. The deck gives you the story. The whitepaper gives you the proof.

Six chapters: introduction and methodology, background literature, full system architecture, technology selection rationale, evaluation findings, and doctrinal implications. The appendices include the actual smart contract code, the complete 131-agent taxonomy, and the full knowledge graph schema.

Citations follow Chicago 18th edition footnote format throughout. This is the academic record — every architectural claim is sourced, every design decision has a citation chain back to the relevant literature.

If you want to verify anything I have shown today, the whitepaper is where to look. If you want to understand why we made a specific technology choice, the tradeoffs chapter explains it with citations. If you want to understand the doctrinal implications in depth, Chapter 6 develops that argument from first principles.

I have copies available. Ask me afterward.

---

### Demo Cue

No demo cue — point to the printed whitepaper. If a digital version is open, show the chapter list briefly.

---

## Slide A15: Technology Comparison Matrix

**Maps to core slide:** 19 (Tradeoffs and Decisions)

**Purpose:** Full detailed comparison tables for audience members who want to challenge specific technology choices.

---

### Visual

Four comparison tables, each covering a technology domain.

**Table 1: Blockchain Platform**

| Criterion | NEAR Protocol ✓ | Ethereum | Solana | Hyperledger Fabric |
|-----------|-----------------|----------|--------|--------------------|
| Transaction throughput | ~1,000 TPS | ~15 TPS | ~65,000 TPS | ~1,000–3,500 TPS |
| Transaction cost | ~$0.001 | $1–$50 | ~$0.00025 | Free (permissioned) |
| Account model | Human-readable, named accounts | Hex addresses | Hex addresses | Permissioned identity |
| Consensus | Nightshade PoS, sharded | PoS (post-Merge) | PoH + PoS | PBFT variants |
| Smart contract language | Rust / AssemblyScript | Solidity | Rust / C | Go / JavaScript |
| Network type | Public permissionless | Public permissionless | Public permissionless | Private permissioned |
| Coalition suitability | High (public verifiability) | High (same) | High (same) | Low (trust between partners) |
| Developer ecosystem | Growing, strong Rust tooling | Largest, most mature | Large, high performance | Enterprise-focused |
| **Why not chosen** | **CHOSEN** | High gas costs at scale | Stability concerns, centralization | Private = no external verifiability |

**Table 2: AI Orchestration**

| Criterion | LangGraph ✓ | LangChain | AutoGen (Microsoft) | CrewAI |
|-----------|-------------|-----------|---------------------|--------|
| Workflow model | Directed graph (stateful) | Chain/agent abstraction | Conversation-based agents | Role-based crew agents |
| State management | Explicit, persistent graph state | Limited, stateless by default | Shared conversation context | Shared crew state |
| Human-in-the-loop | First-class: explicit gate nodes | Plugin, not native | Plugin-level | Not native |
| Parallelism | Native: parallel graph branches | Possible but complex | Sequential default | Sequential default |
| Debugging | Visual graph inspection | Complex chain tracing | Conversation log | Basic |
| HITL gates for doctrine | Yes — designed for it | Workaround required | Workaround required | Not supported |
| **Why not chosen** | **CHOSEN** | No native HITL, less suited | Conversation model wrong for staff process | Simpler but less control |

**Table 3: Storage Architecture**

| Criterion | Hybrid (PostgreSQL + NEAR) ✓ | Pure On-Chain | Pure Off-Chain (DB only) |
|-----------|------------------------------|---------------|--------------------------|
| Operational data speed | Fast (PostgreSQL) | Slow (blockchain latency) | Fast |
| Governance integrity | Blockchain-enforced | Blockchain-enforced | Trust the operator |
| Storage cost | Low (off-chain data) | High (on-chain per KB) | Low |
| Coalition verifiability | Yes (governance on-chain) | Yes (all on-chain) | No (trust the operator) |
| Data privacy | Off-chain data private | All data public | Data private |
| Scalability | High | Limited | High |
| **Why not chosen** | **CHOSEN** | Cost and privacy prohibitive | No external verifiability |

**Table 4: Identity Standard**

| Criterion | W3C DIDs ✓ | OAuth 2.0 / OIDC | SAML 2.0 | CAC/PKI |
|-----------|------------|------------------|----------|---------|
| Self-sovereign | Yes — owner controls | No — IdP controls | No — IdP controls | Partial — CA controls |
| Coalition interoperability | Yes — any DID resolver | Requires federation | Requires federation | PKI bridge required |
| On-chain integration | Native | Not designed for | Not designed for | Not designed for |
| Caveat storage | Native (DID Document) | Not applicable | Not applicable | Certificate extensions |
| Human-readable IDs | Yes (NEAR account-based) | Yes (email-based) | Yes (email-based) | No (hex cert fingerprints) |
| Revocation | On-chain, immediate | Token expiry + revocation list | Short-lived assertions | CRL/OCSP |
| **Why not chosen** | **CHOSEN** | No on-chain integration | No on-chain integration | PKI bridges fragile in coalition |

---

### Speaking Script

If any technology choice in this briefing prompts the question "why not X instead?" — this slide is the answer.

Four domains where BASTION made consequential technology choices. Blockchain: NEAR over Ethereum for cost, over Solana for stability, over Hyperledger for public verifiability. A private permissioned blockchain like Hyperledger cannot provide coalition-verifiable audit trails — the partner nations have to trust the operator's black box. That defeats the purpose.

AI orchestration: LangGraph over LangChain, AutoGen, and CrewAI. The deciding factor is human-in-the-loop as a first-class citizen of the orchestration model. BASTION's governance model requires explicit human decision gates at defined points in every consequential workflow. LangGraph treats those gates as nodes in the directed graph. The other frameworks treat them as workarounds.

Storage: the hybrid architecture over pure on-chain or pure off-chain. Pure on-chain is cost-prohibitive and privacy-problematic — every OPORD section on a public blockchain. Pure off-chain provides no external verifiability. The hybrid model puts governance events and caveats on-chain (where they need to be verifiable) and keeps operational data in PostgreSQL (where it needs to be fast and private).

Identity: W3C DIDs over OAuth, SAML, and CAC/PKI. The core requirement is self-sovereign identity that integrates natively with blockchain and supports on-chain caveat storage. No other standard meets all three requirements simultaneously.

---

### Demo Cue

No demo cue — this is a reference slide for challenged technology choices during Q&A. Leave on screen while fielding technology questions.

---

## Slide A16: Pacific Strategy AY26 Scenario Overview

**Maps to core slides:** 3 (opening demo context), 15 (COP demo context)

**Purpose:** Provide context on the exercise scenario used throughout the briefing and demo.

---

### Visual

**Timeline Diagram: Pacific Strategy AY26 — Six Phases**

Horizontal timeline with phase blocks, color-coded by operational phase:

```
[Gray]         [Yellow]        [Red]         [Dark Red]    [Darker Red]    [Blue]
COMPETITION  → CRISIS        → CONFLICT     → CONFLICT    → CONFLICT     → NEGOTIATION
Phase 1        Phase 2         Day 4          Day 10         Day 22          Phase 6
Background     Escalation      Kinetic        Mid-battle     Late battle     Endgame
tensions       detected        operations     intensity      assessment
               begin           begin                         operations

Indo-Pacific regional context — Taiwan Strait contingency
6 NEAR-peer nations involved — coalition C2 challenge
US, UK, Australia, Canada, New Zealand (Five Eyes) + Japan
```

Below timeline: scenario scope annotations:
- "~200 OPORD/FRAGO documents uploaded"
- "400+ knowledge graph nodes generated"
- "6 governance proposals demonstrated"
- "3 robot formation exercises conducted"
- "Complete planning cycle from Competition → Negotiation"

---

### Speaking Script

Every demonstration in this briefing uses the Pacific Strategy AY26 exercise scenario. Understanding what that scenario is gives context to everything you have seen.

Pacific Strategy AY26 is an Indo-Pacific regional scenario built around a Taiwan Strait contingency. Six phases: Competition, Crisis, Conflict Day 4, Conflict Day 10, Conflict Day 22, and Negotiation. The scenario runs from background tension through full kinetic operations to negotiated endgame.

The scenario involves a five-nation coalition — Five Eyes plus Japan — which makes it specifically useful for demonstrating BASTION's coalition C2 capabilities. You have multiple nations, multiple classification levels, multiple releasability constraints, and multiple governance tiers operating simultaneously.

The scenario data in BASTION includes approximately 200 planning documents — OPORDs, FRAGOs, intelligence reports, and assessment documents spanning all six phases. That document set generates over 400 knowledge graph nodes, which populates the brain graph you saw in the Understand tab.

The three-tier exercise phases — Competition, Conflict, and Negotiation — each produce distinct COP pictures. The phase slider you saw in the COP demo navigates across those three pictures, showing how the operational environment evolves from pre-conflict through high-intensity operations to negotiated resolution.

Every governance proposal, every robot formation exercise, and every OPORD generation you have seen was conducted against this scenario data. It is not a contrived demo — it is a coherent operational scenario exercising the full BASTION capability set.

---

### Demo Cue

Second screen: Show the scenario files directory or the scenario selection screen. Navigate to the COP phase slider and scroll through all six phases to show the evolving operational picture. If multiple scenario documents are loaded, show the document list with phase annotations.

---

## Slide A17: Research Methodology and Approach

**Maps to core slides:** 2 (Research Question), 23–24 (Research Contributions, The Answer)

**Purpose:** Academic deep-dive for thesis advisor questions about research design, methodology, and rigor.

---

### Visual

**Diagram: Design Science Research Methodology Cycle**

Circular/iterative diagram with six phases:

```
1. PROBLEM IDENTIFICATION
   Coalition C2 lacks verifiability, auditability, and AI integration
   at the required scale and speed for near-peer conflict
         ↓
2. OBJECTIVE DEFINITION
   Build a system that demonstrates: DAO-governed authority,
   AI-enabled planning, verifiable human control over lethal decisions
         ↓
3. DESIGN AND DEVELOPMENT
   59 development phases, iterative prototype construction
   Each phase: plan → execute → verify → document
   Technologies selected against specific requirements
         ↓
4. DEMONSTRATION
   Pacific Strategy AY26 exercise scenario
   Live prototype running the full planning-to-execution cycle
   Briefing deck + companion whitepaper as academic artifacts
         ↓
5. EVALUATION
   Does the prototype demonstrate feasibility?
   What limitations were encountered?
   What does the artifact reveal about the research question?
         ↓
6. COMMUNICATION
   This briefing (executive and academic audience)
   Companion whitepaper (academic record)
   Codebase (artifact verifiability)
         ↓
   [Back to Problem Identification — research agenda for future work]
```

**Table: Research Artifact Characteristics**

| Dimension | BASTION Status |
|-----------|----------------|
| Artifact type | Prototype — proof of concept, not production |
| Development method | Iterative, phase-based (59 phases) |
| Technology integration | Novel combination of existing technologies |
| Evaluation method | Scenario-based demonstration + architectural analysis |
| Generalizability | Architectural patterns generalizable; specific implementation is prototype-scale |
| Known limitations | Documented in whitepaper Chapter 5.4 |
| Reproducibility | Open codebase — methodology and implementation are inspectable |

---

### Speaking Script

The research methodology is Design Science Research — a methodology from information systems research specifically designed for building and evaluating novel artifacts.

The six-phase cycle applies: problem identification, objective definition, design and development, demonstration, evaluation, and communication. BASTION is the artifact. The cycle is iterative — each development phase feeds learning back into the next phase's design.

Why Design Science Research rather than experimental or case study methodology? Because the research question asks whether a specific technical architecture can demonstrate a specific set of capabilities. That is not a hypothesis to test against a control group — it is a design problem. The contribution is the artifact itself and the knowledge embedded in its construction.

BASTION was built in 59 development phases, each planned and executed with explicit objectives, verification criteria, and documentation. That iterative structure is itself a methodological choice: it allows the architecture to evolve as design decisions are validated or revised, rather than committing to a full design upfront.

The artifact is a prototype. I want to be precise about what that means: it demonstrates the feasibility of the architectural approach, it exercises the full capability set on a realistic scenario, and it surfaces the limitations that would need to be addressed at production scale. It is not a claim that the system is ready for operational deployment. The whitepaper's evaluation chapter documents both what the prototype achieves and the seven significant limitations that constrain its current scope.

The research contribution is architectural: BASTION demonstrates that DAO governance, AI agent orchestration, decentralized identity, and physical autonomy can be integrated into a coherent command and control platform. Whether that integration is sufficient for operational deployment is a question for future research.

---

### Demo Cue

No demo cue — this is an academic methodology slide. Reference the whitepaper Chapter 1 and 5 if more depth is needed.

---

# DOCUMENT END

**Total slides:** 25 core + 17 annex = 42 slides
**Core deck speaking time estimate:** ~35-45 minutes (at ~150 words/minute with pauses)
**Color palette:** Primary blue #2563EB, Sky blue #0EA5E9, White backgrounds, Cyan accents
**Visual style:** Clean modern tech aesthetic, NOT dark tactical

**Companion documents:**
- Whitepaper: docs/whitepaper/ (compiled to docx/pdf)
- Briefing document: docs/briefing/briefing-document.md
- Demo script: docs/briefing/demo-script-30min.md
