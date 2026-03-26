# Phase 59: Briefing Deck Slide and Image Specs - Research

**Researched:** 2026-03-26
**Domain:** Technical writing, presentation design, AI image generation prompting, academic whitepaper authoring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Audience & Positioning**
- Dual audience: mixed defense/tech evaluators AND academic thesis advisor
- Dual-track narrative: research contribution AND working prototype
- Explicitly frame as prototype/proof of concept, NOT MVP or production-ready
- Tone: "academic with edge" — rigorous and defensible, but compelling and engaging

**Terminology**
- Plain language primary: lead with accessible descriptions, technical terms in parentheses
- Dedicated visual glossary slide in the annex
- Companion printed PDF whitepaper explores concepts in full technical depth

**Narrative Flow**
- Open with live physical demo showing planning → autonomous execution → decision gates
- Then problem-first arc: broken status quo of coalition C2
- Simplified architecture overview slide right after problem setup (roadmap for audience)
- Technology sections organized by operational capability (not by individual technology)
- Closing sequence: tradeoffs, limitations, doctrinal impact (all at end, as reflection)
- Detailed architecture synthesis slide near the end (bookend with the simplified one)

**Visual Style**
- Clean modern tech aesthetic (NOT dark tactical — BASTION itself on second screen provides that contrast)
- Light/white backgrounds, sharp typography, strategic color use
- Blue & cyan tech color palette: primary blues (#2563EB, #0EA5E9), white backgrounds, cyan accents for blockchain/crypto elements

**Image Types**
- Mix of conceptual diagrams (for tech/architecture) AND AI-generated hero images (for opening/closing/transitions)
- Full generation-ready prompts for all images: composition, color palette, style references, aspect ratio, mood, specific elements — copy-paste ready for Midjourney/DALL-E

**Deck Structure**
- Core deck: 20-25 slides for the main briefing
- Annex: 15-20 detailed backup slides for Q&A deep-dives
- Visual glossary slide in annex

**Narrative Depth**
- Full scripted narrative for every slide — word-for-word speaking script
- Feeds into companion whitepaper content
- Each slide spec includes DEMO CUE points noting what BASTION screen to show on second monitor at that moment

**Technology Depth (Slides)**
- Conceptual + one level deep: show what it does, why it matters, AND one concrete example/mechanism
- Proves it was built, not just theorized
- Full architecture lives in the whitepaper

**Companion Whitepaper**
- Generated in both docx and pdf formats
- Full technical depth with architecture diagrams
- Chicago 18th edition footnote citation style
- Detailed reasoning for each technology choice
- Impact analysis highlighting why these technologies matter
- Serves as the "leave-behind" that complements the briefing

### Claude's Discretion
- Exact slide ordering within capability sections
- Which technologies group under which operational capabilities
- Annex slide selection and organization
- Diagram composition and layout details
- Whitepaper chapter structure and section ordering

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope (whitepaper was absorbed into this phase's scope)
</user_constraints>

---

## Summary

Phase 59 is a pure content/specification phase. It produces two deliverables: (1) a comprehensive slide-by-slide specification document for a 20-25 slide core deck plus 15-20 annex slides, where every slide has a full speaking script, image generation prompts, and BASTION demo cue points; and (2) a companion whitepaper in docx and pdf format with full technical depth and Chicago 18th edition footnotes.

The existing Phase 54 briefing deck (`docs/briefing/slide-deck.md`) is a 33-slide markdown document that is the immediate predecessor — it covers substantially similar territory but was not built with this phase's requirements in mind. It lacks image generation prompts, has no demo cue points, and was written for a 30-minute structured demo briefing rather than the open-form specced approach needed here. The new Phase 59 specs supersede that document with far greater per-slide depth.

The whitepaper already exists as `docs/whitepaper/` (v0.2, updated through Phase 54) with complete sections. The Phase 59 companion whitepaper builds on this but adds the Phase 55-58 content (Ironclaw design interviews, visual operational approach editor, Ironclaw memory, on-chain DID caveats), reformats to docx/pdf, and aligns more precisely to Chicago 18th footnote style throughout.

**Primary recommendation:** Build the slide specs as a single comprehensive markdown specification document (one file per plan/wave is fine), with each slide as a structured block containing: title, visual layout description, speaker script (word-for-word), image prompt (if applicable), diagram spec (if applicable), and BASTION demo cue. The whitepaper should be assembled from the existing `docs/whitepaper/` markdown files plus new content, compiled to docx with `pandoc` and then to pdf.

---

## What This Phase Must Produce

### Deliverable 1: Slide Specifications Document

A comprehensive spec for every slide in the deck. Each slide spec contains:

1. **Slide number and title**
2. **Slide purpose** — what cognitive work this slide does for the audience
3. **Visual layout description** — describe the slide composition
4. **Image generation prompt** (where a hero/illustrative image is needed) — copy-paste ready for Midjourney/DALL-E
5. **Diagram spec** (where a conceptual diagram is needed) — described precisely enough to reproduce
6. **Full speaking script** — word-for-word what the presenter says
7. **DEMO CUE** — which BASTION screen/tab to show on the second monitor at this moment (or "no demo cue")
8. **Slide transition** — what happens visually when moving to this slide

### Deliverable 2: Companion Whitepaper

Full technical document compiled to docx and pdf. The whitepaper already exists in markdown form in `docs/whitepaper/`. The Phase 59 work:
- Adds new sections for Phases 55-58 capabilities
- Formalizes Chicago 18th edition footnote citations throughout
- Assembles to docx using `pandoc` (already in the project — used in Phase 54 context)
- Converts docx to pdf

---

## Content Inventory: What BASTION Actually Does

This is the authoritative list of capabilities the slide deck must cover, drawn from implemented phases. The planner assigns these to slides.

### Core System Capabilities (Implemented)

| Capability | Phase | Description | Slide-Worthy Elements |
|-----------|-------|-------------|----------------------|
| Knowledge graph / brain visualization | 45, 47 | JSON-LD Neo4j graph, force-directed visualization, subspace scoping | Show the "brain" concept, entity relationships, how intelligence accumulates |
| Agent Hub: 131+ agents, teams, orchestrators | 4.2, 51 | 31 specialized + 102 JPP staff role agents, LangGraph orchestration | Agent types taxonomy, LangGraph flow, multi-model consortium |
| Smart contracts as policy enforcement | 3, 58 | NEAR Rust contracts, DID registry, caveat enforcement | `check_employment_authorized()`, immutable audit, coalition verification |
| DAOs at multiple levels | 3, 28 | Five-tier authority model, coalition voting, governance gates | Five tiers diagram, strike authorization invariant, Decide tab |
| DIDs for every resource | 27, 58 | `did:near:resource-{id}`, 5 plugin types, caveats on-chain | DID anatomy, coalition caveats, Five Eyes example |
| Enforceable authority levels (5 levels) | 3, 28 | Tiers 1-5, robot autonomy example, delegations | Robot checking in for authority, tier escalation |
| Ironclaw: AI Chief of Staff | 30, 55, 57 | Proactive decision surfacing, persistent memory, design interviews | 60-second polling, memory graph, visual approach editor |
| Knowledge graph subspaces | 45 | Container-scoped subgraphs, hierarchical drill-down, virtual lenses | How intelligence scopes to a problem set without contaminating others |
| Doctrinal tab structure | 24 | Understand/Design/Plan/Decide/COP/Assess aligned to JP 5-0 | Tab-by-tab walkthrough with doctrinal grounding |
| Autonomous document intelligence | 40 | 10-agent pipeline, NATO A-F reliability ratings, conflict detection | Document-to-graph pipeline, source reliability |
| AI COP generation | 21 | MIL-STD-2525D SVG overlays from documents, perspective toggle | From plan text to COP symbology automatically |
| Operational Design workspace | 25 | CoG analysis, LOEs, design-to-plan handoff | CoG analysis interface, Ironclaw-guided interviews |
| Visual Operational Approach Editor | 56 | Ironclaw-driven map editing, MIL-STD-2525 symbology | Map with COA vectors drawn by AI |
| MDMP/JPP planning workflows | 5, 5.1, 14 | Full 7-step JPP, dual-perspective IPB, OPORD generation | MDMP phase gates, AI-generated order products |
| Robot integration: bridge + vision + swarm | 43, 44, 46, 48 | Docker bridge, Jetson vision, 6 doctrinal swarm formations | Physical demo — robot on second screen |
| Training/operational mode | 22 | EXERCISE amber banner, identical governance, data isolation | The "train as you fight" principle |
| Resource registry + DID caveats | 27, 58 | Classification, releasability, ROE tier, geo bounds, time windows | Coalition caveat enforcement on shared resources |
| Three-tier architecture | 43 | Cloud/bridge/edge, DDIL resilience | Architecture diagram, edge autonomy |
| Verifiable zero trust | PROJECT.md | Five-layer verification, four questions, TEE attestation | Trust terminates at math not policy |
| Physical demonstration | 48 | Sphero RVR+ + Jetson + swarm, DAO-governed engagement | End-to-end chain |
| Pacific Strategy AY26 scenario | scenario/ | 6 phases, Indo-Pacific / Taiwan contingency | Demo scenario context |

### Phase 55-58 New Content (Not in Phase 54 Deck)

| Phase | Capability | What to Include |
|-------|-----------|-----------------|
| Phase 55 | Ironclaw design interview — Ironclaw guides Operational Approach development through structured interview, documents design decisions | Annex slide: Ironclaw as design partner, not just advisor |
| Phase 56 | Visual Operational Approach Editor — map-based editing with MIL-STD-2525 symbols, Ironclaw directs symbol placement | Core or annex slide: show AI directing visual design |
| Phase 57 | Ironclaw persistent memory — memory graph, adaptive relationship, auth-scoped memory isolation | Part of Ironclaw capability slide: AI that learns your preferences |
| Phase 58 | On-chain DID caveats — `ResourceCaveats` struct, `check_employment_authorized()`, classification/releasability/ROE tier | Part of DID/coalition caveats slide: concrete enforcement mechanism |

---

## Required Slide Topics (from CONTEXT.md)

CONTEXT.md specifies these must be covered. Mapping to the content above:

| Required Topic | Recommended Treatment |
|---------------|----------------------|
| Knowledge graph and its role in strategic understanding | Dedicated slide — the "brain" metaphor, JSON-LD relationships, how understanding accumulates |
| Agent Hub: agent types, teams, orchestrators, AI infusion | Dedicated slide — 131+ agents, LangGraph, Ironclaw, multi-model consortium |
| Smart contracts as policy enforcement and audit | Dedicated slide — NEAR smart contracts, immutable record, caveat enforcement |
| DAOs at various levels, decision gates, coordination | Dedicated slide — five-tier model with concrete examples |
| DIDs for every resource, coalition caveats | Dedicated slide — `did:near:resource-{id}`, Five Eyes example |
| Enforceable authority levels (5 levels), robot autonomy example | Part of DAO slide OR separate — the robot checking in for authority is the killer demo cue |
| Tradeoffs and decisions (why X over Y) | Dedicated closing slide |
| Known limitations, constraints, future roadmap | Dedicated closing slide |
| Doctrinal impact on military doctrine, staff, hierarchies | Dedicated implications slide |

---

## Narrative Arc: Recommended Deck Flow

Based on CONTEXT.md decisions (demo opens, problem-first, simplified arch after problem, capabilities organized by operational function, closing reflection):

### Opening Sequence (Slides 1-2)
- **Slide 1: Title + Demo Cue** — "Watch this first." Demo runs. Then we explain how it works.
- **Slide 2: The Research Question** — Frames what we're answering. Anchors the whole briefing.

### Problem Space (Slides 3-5)
- **Slide 3: Coalition C2 Coordination Crisis** — Three problems: data overload, interoperability gaps, human decision bottleneck
- **Slide 4: The Autonomous Systems Governance Gap** — The lethal autonomy problem — who enforces the rules?
- **Slide 5: The Approach** — BASTION's answer: AI accelerates coordination, DAOs enforce governance, humans provide judgment

### Architecture Roadmap (Slide 6)
- **Slide 6: Simplified Architecture** — One-page "here's what we built" diagram. Sets up the capability sections. Deliberately simplified.

### Capability Sections (Slides 7-18, organized by operational function)

**Understanding the environment:**
- **Slide 7: The Intelligence Brain** — Knowledge graph, JSON-LD, how strategic understanding accumulates
- **Slide 8: Autonomous Document Intelligence** — 10-agent pipeline, NATO ratings, conflict detection

**Planning and designing:**
- **Slide 9: Doctrinal Planning Workflow** — Six tabs, JP 5-0 alignment, Ironclaw as chief of staff
- **Slide 10: Operational Design with AI** — Design tab, CoG, LOEs, Ironclaw design interview, visual approach editor

**Governing decisions:**
- **Slide 11: Smart Contracts as Policy** — NEAR smart contracts, audit trail, caveat enforcement
- **Slide 12: DAO Authority Levels** — Five tiers, strike invariant, robot autonomy example (DEMO CUE: Decide tab)
- **Slide 13: Decentralized Identity + Coalition Caveats** — DIDs for every resource, coalition caveat fields, Five Eyes example

**Executing autonomously:**
- **Slide 14: Physical Autonomous Execution** — Robot integration, bridge architecture, Jetson vision, swarm formations (DEMO CUE: robot demo)
- **Slide 15: AI Common Operating Picture** — MIL-STD-2525D from documents, perspective toggle (DEMO CUE: COP tab)

**Maintaining trust:**
- **Slide 16: Training-Operational Parity** — Train as you fight, identical governance
- **Slide 17: Verifiable Zero Trust** — The four questions, TEE + blockchain proof, trust terminates at math

### Architecture Synthesis (Slide 18)
- **Slide 18: Full Architecture Synthesis** — Detailed version of Slide 6. Bookend. Now the audience has the context to read it.

### Closing Reflection (Slides 19-22)
- **Slide 19: Tradeoffs — What We Chose and Sacrificed** — Honest table, NEAR vs alternatives, DAO vs RBAC, hybrid storage
- **Slide 20: Known Limitations** — What this is and isn't. Research prototype, demonstration scale, AI reliability
- **Slide 21: Doctrinal Impact** — How this changes military staff work, planning timelines, coalition accountability structures
- **Slide 22: Future Roadmap** — Near/medium/long-term development gates

### Closing (Slides 23-24 or 23-25)
- **Slide 23: Key Contributions** — Eight research contributions enumerated
- **Slide 24: The Answer** — Conclusion, research question answered with caveats
- **Slide 25: Q&A slide** — Leave on screen

**Total core slides: ~25 (within the 20-25 target)**

### Annex Structure (15-20 slides)

| Section | Slides |
|---------|--------|
| Visual Glossary | 1 slide (required per CONTEXT.md) |
| Deep-dives on capabilities | 8-10 slides (one per major tech) |
| Demo script + walkthrough | 2-3 slides |
| Whitepaper overview | 1 slide |
| Technical architecture deep-dives | 3-4 slides |

---

## Image Generation Guidance

Every slide that uses an AI-generated hero image needs a copy-paste ready prompt. The Phase 59 plan must produce these for each applicable slide.

### Color Palette (from CONTEXT.md)
- Primary blue: `#2563EB` (Tailwind blue-600)
- Sky blue: `#0EA5E9` (Tailwind sky-500)
- Cyan accents: for blockchain/crypto elements
- White backgrounds
- Sharp typography, clean lines

### Prompt Template Structure

Each AI image prompt should specify:
1. **Subject/composition** — what is in the image
2. **Style references** — e.g., "tech visualization", "isometric", "photorealistic"
3. **Color palette** — explicitly named hex values or descriptive colors
4. **Mood/tone** — "calm authority", "precision", "controlled power"
5. **Aspect ratio** — 16:9 for slide hero images
6. **Specific elements** — circuit patterns, network nodes, military silhouettes, etc.
7. **What to avoid** — "no dark backgrounds", "no gritty military aesthetic"

### Image Types per Slide Category

| Slide Category | Image Type | Notes |
|---------------|-----------|-------|
| Title/opening | AI-generated hero | Abstract tech + subtle military silhouette |
| Problem slides | AI-generated conceptual | Data overload visualization, fragmented networks |
| Architecture slides | Conceptual diagram (not AI-generated) | ASCII/box diagrams converted to clean vector spec |
| Capability slides | Mix: diagram for how-it-works + optional hero | |
| Closing/reflection | AI-generated hero | Clean, authoritative, forward-looking |
| Q&A slide | Minimal/clean | Just the question + system name |

---

## BASTION Demo Cue Reference

The following BASTION screens/tabs exist and can be shown as demo cues. Specs must reference these exactly:

| BASTION Screen | What It Shows | Good Demo Cue For |
|---------------|--------------|-------------------|
| Understand tab | Brain graph visualization, document upload, entity extraction, knowledge graph nodes | Knowledge graph slide, document intelligence slide |
| Design tab | CoG analysis, LOEs, operational approach, Ironclaw interview mode, visual approach map | Operational design slide |
| Plan tab | JPP campaign plan (strategic), MDMP workflow (tactical), staff workspaces, WARNORD/OPORD/FRAGO | Planning workflow slide |
| Decide tab | Decision dashboard, Ironclaw surfaced decisions, DAO governance proposals, RACI matrix | DAO governance slide, authority levels slide |
| COP tab | MIL-STD-2525D overlays, perspective toggle (friendly/adversary), phase slider, entity linkage | AI COP slide |
| Assess tab | Training assessment loop, METL proficiency, AAR capture | Training-operational parity slide |
| Resources tab | Resource inventory, DID display, SecurityCaveatsSection editor, on-chain sync badge | DID/caveats slide |
| Robot bridge | Python agent status, discovered robots, command proxying | Physical execution slide |
| Physical robot | Sphero RVR+ + Jetson in actual environment, swarm formation | Autonomous execution demo |
| Smart contract | NEAR testnet (`did.bastion.testnet`), check_employment_authorized call | Smart contracts slide |
| Second screen | Live BASTION running full platform | Opening demo cue (before any slides) |

---

## Whitepaper Architecture

The companion whitepaper extends the existing v0.2 document (`docs/whitepaper/`). The Phase 59 whitepaper is the "leave-behind" version, which means it:
- Is self-contained (no live demo required to understand)
- Has full technical depth
- Carries Chicago 18th edition footnotes throughout
- Includes all Phase 55-58 content

### Existing Structure (v0.2)

```
docs/whitepaper/
├── 00-title-page.md        # "Decision Overmatch" — v0.2, Aaron Luhning
├── 00-abstract.md          # Research question, contributions
├── 01-introduction.md      # Vision, approach
├── 02-background-*.md      # 5 background sections (AI, DAOs, knowledge graphs, military, robotics)
├── 03-methodology.md       # Architecture and design decisions
├── 04-results.md           # Demonstration outcomes
├── 05-discussion.md        # Limitations, future work, tradeoffs
├── 06-conclusion.md        # Research question answered
├── 07-references.md        # Sources
├── appendix-a-sitrep.md    # Project status through Phase 54
├── appendix-b-demo-script.md  # 30-min demo script
└── ASSEMBLY.md             # pandoc assembly instructions
```

### New Content Required for Phase 59 Whitepaper

| Section | New Content |
|---------|------------|
| 03-methodology or new subsection | Phase 55: Ironclaw guided design interview pattern |
| 03-methodology or new subsection | Phase 56: Visual operational approach editor with MIL-STD-2525 |
| 03-methodology or new subsection | Phase 57: Ironclaw persistent memory graph, auth-scoped isolation |
| 03-methodology or new subsection | Phase 58: On-chain DID caveats (`ResourceCaveats` struct, `check_employment_authorized()`) |
| appendix-a-sitrep | Update through Phase 58 |
| 05-discussion | Add Phase 55-58 to limitations and future work |

### Compilation Process

The `docs/whitepaper/ASSEMBLY.md` file documents how to compile. The standard approach:
```bash
pandoc --from=markdown --to=docx --output=BASTION-Whitepaper-v0.3.docx \
  00-title-page.md 00-abstract.md 01-introduction.md \
  02-background-ai.md 02-background-daos.md 02-background-knowledge-graphs.md \
  02-background-military.md 02-background-robotics.md \
  03-methodology.md 04-results.md 05-discussion.md 06-conclusion.md \
  07-references.md appendix-a-sitrep.md appendix-b-demo-script.md
```

Then pdf from docx or via pandoc directly to pdf (requires LaTeX or wkhtmltopdf).

---

## Key Source Documents for Whitepaper Citations

The whitepaper needs Chicago 18th footnotes. These sources are already referenced or implied in PROJECT.md and the existing whitepaper:

### Primary Doctrine Sources (HIGH confidence)
- JP 5-0, Joint Planning (current edition) — doctrinal foundation
- ADP 5-0, The Operations Process — MDMP foundation
- NATO Allied Tactical Publication (ATP-5-0.1) — coalition planning
- DoD Directive 3000.09 — Autonomous Weapons Systems (lethal autonomy)

### Academic/Technical Sources
- Boyd, John. OODA loop presentations — decision cycle theory
- Nakamoto, Satoshi. "Bitcoin: A Peer-to-Peer Electronic Cash System" (2008) — blockchain foundation
- NEAR Protocol whitepaper — blockchain platform rationale
- Phala Network documentation — TEE attestation
- arXiv:2512.08769 — Agentic AI workflows (cited in PROJECT.md)
- W3C DID Specification — decentralized identifiers standard
- MIL-STD-2525D — military symbology standard
- NATO STANAG 2022 — intelligence source reliability (A-F, 1-6 ratings)
- Intel SGX/TDX documentation — TEE hardware attestation

---

## Common Pitfalls for This Phase

### Pitfall 1: Slide Specs Too Vague for Image Generation
**What goes wrong:** Image prompts say "show the architecture" without specifying composition, colors, mood, aspect ratio, or specific elements. The resulting images don't match the deck aesthetic.
**How to avoid:** Every image prompt must include all 7 elements from the prompt template structure above. Test each prompt mentally: "Could an Midjourney user produce the right image from this prompt with no other context?"

### Pitfall 2: Demo Cue Points Referencing Non-Existent Features
**What goes wrong:** A spec says "show the DID registry on-chain verification screen" but no such dedicated screen exists — it's accessible through ResourceDetailPanel in the Resources tab.
**How to avoid:** Use only the verified BASTION screen list from the Demo Cue Reference table above. If a desired demo moment isn't accessible in one of those screens, note it as "demo cue: navigate to [tab] > [specific action]" with enough detail to actually navigate there.

### Pitfall 3: Speaking Script Too Technical Too Fast
**What goes wrong:** The speaker script assumes the audience knows what "Borsh serialization" or "LEB128 encoding" means. Defense evaluators and academic advisors won't.
**How to avoid:** CONTEXT.md locks this: plain language primary, technical terms in parentheses. Every technical term in the script should be preceded by a plain language description. The whitepaper is where full depth lives; the script has one level of depth beyond the accessible description.

### Pitfall 4: Whitepaper Citations Not Chicago 18th Style
**What goes wrong:** Citations are formatted as APA or Harvard style. The thesis advisor checks this.
**How to avoid:** Chicago 18th edition footnote (not author-date) format throughout. Example: `^1 Satoshi Nakamoto, "Bitcoin: A Peer-to-Peer Electronic Cash System," 2008, https://bitcoin.org/bitcoin.pdf.`

### Pitfall 5: Slide Count Creep
**What goes wrong:** Every topic feels important, resulting in 35+ core slides. The audience loses the thread.
**How to avoid:** Core deck is hard-capped at 25 slides. Additional depth goes to annex. Every slide above 20 must justify its place by asking: "Is this load-bearing for the argument, or is it detail?"

### Pitfall 6: Missing Phase 55-58 Content
**What goes wrong:** The specs replicate Phase 54's deck without incorporating the new capabilities from Phases 55-58 that this phase specifically adds.
**How to avoid:** Ironclaw design interview (Phase 55), visual operational approach editor (Phase 56), Ironclaw persistent memory (Phase 57), and on-chain DID caveats with `check_employment_authorized()` (Phase 58) must each appear. Phase 58 is the direct predecessor — its DID caveat enforcement is the concrete "one level deep" example for the smart contracts slide.

---

## Architecture Patterns for Content Organization

### Pattern 1: Capability-First Slide Structure
**What:** Organize technology sections by what military capability they enable, not by which technology implements them.
**Example:** "Governing decisions" section covers smart contracts, DAOs, and authority levels together — because they all answer the governance question — rather than separate "blockchain," "smart contracts," and "DAO" slides.
**Why:** Matches how the audience thinks (what does it let me do?) not how engineers think (what does this component do?).

### Pattern 2: Concrete Mechanism for Every Claim
**What:** Every slide that makes a capability claim includes one concrete mechanism that proves the claim.
**Example:** Slide on smart contract enforcement includes the `check_employment_authorized()` function signature and what it checks — proving enforcement is code, not policy.
**Why:** The deck promises "one level deep." The concrete mechanism is that one level.

### Pattern 3: Bookend Architecture Slides
**What:** Show a simplified architecture diagram early (slide 6), show the full synthesis late (slide 18). The first gives the audience a map. The second rewards them when they've absorbed the capabilities.
**Why:** Cognitive load management. The audience can't read a complex architecture slide without context for the components.

### Pattern 4: Speaker Script as Conversation, Not Lecture
**What:** Write the speaking script in second person where appropriate ("You're seeing...") and use direct conversational framing rather than formal lecture tone.
**Why:** CONTEXT.md calls for "academic with edge" — rigorous but compelling and engaging. Lecture tone kills engagement.

---

## Validation Architecture

*Note: This phase produces markdown specification files and whitepaper markdown. There is no automated test suite. Validation is by human review of deliverable completeness.*

### Completeness Checks (Manual)

| Check | Criteria |
|-------|----------|
| Slide count | Core deck: 20-25 slides |
| Annex count | 15-20 annex slides |
| Visual glossary | Present in annex |
| All required topics covered | 9 required topics from CONTEXT.md |
| Image prompts | Every hero/illustrative slide has a complete prompt |
| Demo cue points | Every slide has a cue (or explicit "no cue") |
| Speaking script | Word-for-word script on every slide |
| Phase 55-58 content | All four phases represented in specs |
| Whitepaper sections | New subsections for phases 55-58 present |
| Chicago citations | Footnote format verified on whitepaper |
| Pandoc compilation | docx produced without errors |
| PDF export | pdf produced from docx or directly |

---

## Sources

### Primary (HIGH confidence)
- `/home/vitalpointai/projects/ssr/docs/briefing/slide-deck.md` — Existing Phase 54 slide deck (33 slides, no image prompts or demo cues — predecessor to supersede)
- `/home/vitalpointai/projects/ssr/docs/briefing/briefing-document.md` — Executive briefing document with full prose
- `/home/vitalpointai/projects/ssr/docs/whitepaper/` — Full whitepaper v0.2 (all sections)
- `/home/vitalpointai/projects/ssr/.planning/PROJECT.md` — Full system description, constraints, five-layer zero trust, verifiable zero trust
- `/home/vitalpointai/projects/ssr/.planning/phases/59-briefing-deck-slide-and-image-specs/59-CONTEXT.md` — User decisions
- `/home/vitalpointai/projects/ssr/.planning/phases/58-on-chain-resource-did-caveats-with-contract-enforcement/58-03-SUMMARY.md` — Phase 58 implementation details (on-chain caveats)
- `/home/vitalpointai/projects/ssr/.planning/phases/54-update-research-whitepaper-and-docs-for-demo-briefing/54-RESEARCH.md` — Phase 54 research (predecessor documentation phase)

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Phase completion status, metrics
- `.planning/ROADMAP.md` — Phase descriptions and completion status for all phases

---

## Metadata

**Confidence breakdown:**
- Content inventory: HIGH — directly read from implemented phase summaries and PROJECT.md
- Slide narrative arc: HIGH — derived from CONTEXT.md locked decisions + existing Phase 54 deck structure
- Image prompt guidance: MEDIUM — based on CONTEXT.md color/style specs; specific prompts will need iteration
- Whitepaper compilation: HIGH — pandoc approach already used in Phase 54, ASSEMBLY.md exists

**Research date:** 2026-03-26
**Valid until:** Indefinite — this is a content/documentation phase with no external dependencies that could change
