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
