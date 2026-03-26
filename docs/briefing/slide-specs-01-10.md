> Part 1 of 5 — See also: [Part 2 (11-20)](slide-specs-11-20.md) | [Part 3 (21-25)](slide-specs-21-25.md) | [Annex A1-A10](slide-specs-annex-A01-A10.md) | [Annex A11-A17](slide-specs-annex-A11-A17.md)

# BASTION Briefing Deck — Slide Specifications

**Version:** 1.1
**Date:** 2026-03-26
**Author:** Phase 59 — Briefing Deck Slide and Image Specs
**Deck Title:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance

---

## Document Purpose and Format

This document specifies every slide in the BASTION core briefing deck (slides 1-25) and annex (slides A1-A18). Each specification is complete enough for a presentation designer to reproduce the slide without additional context. This document contains slide and image specs only. Presenter speaking scripts, demo cues, and transitions are in [speaking-script.md](speaking-script.md).

---

## Color Palette Reference

| Role | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| Primary Blue | `#2563EB` | blue-600 | Headings, primary UI elements, architecture blocks |
| Sky Blue | `#0EA5E9` | sky-500 | Secondary accents, data flow lines |
| Cyan | `#06B6D4` | cyan-500 | Blockchain/crypto elements, DID references |
| White | `#FFFFFF` | white | All backgrounds |
| Light Gray | `#F8FAFC` | slate-50 | Slide background variant |
| Dark Text | `#0F172A` | slate-900 | Body text |
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

---

## Slide 5: The Approach — BASTION's Answer

### Purpose
Transition from problem to solution. Introduces BASTION's three-pillar thesis: AI accelerates coordination, DAOs enforce governance, humans provide judgment. This is the thesis statement of the entire research project. After two problem slides, the audience needs the relief of seeing the shape of the answer before diving into architecture.

### Visual Layout
Three-column layout on white background. Title at top: "BASTION's Thesis" in blue (#2563EB), 32pt bold. Three columns of equal width, each containing:
- Column 1: Brain/circuit icon (blue #2563EB) — headline "AI Accelerates" — subtext "16 deployed AI agents (8 LangGraph analysis, 7 COP layer, 1 Ironclaw Chief of Staff) process intelligence, surface decisions, and coordinate at machine speed so your staff can focus on judgment."
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
- Block: "Agent Hub" (16 Deployed AI Agents) [blue, center position]
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

Below tabs: Ironclaw callout box (cyan #EFF6FF background, blue border): "Ironclaw — AI Chief of Staff — is contextually present in every tab. Ironclaw monitors all agent activity, surfaces decisions requiring commander attention, and coordinates planners through doctrinal steps with proactive recommendations."

### Image Prompt
No AI image — tab layout diagram carries the argument.

### Diagram Spec
Six-tab layout as described in Visual Layout. Each tab block: approximately 150px wide, 120px tall. Blue (#2563EB) background, white text. Tab label in bold 14pt, JP 5-0 phase label in 10pt italic at bottom of each block. Thin white border between tabs.

Below the tab row: Ironclaw callout box spanning full width, 60px height. Background #EFF6FF (very light blue), 1px solid blue border (#2563EB). Left-aligned cyan circle icon (Ironclaw indicator). Text: "Ironclaw — AI Chief of Staff" in bold blue 14pt, followed by description in normal 12pt.

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

---
