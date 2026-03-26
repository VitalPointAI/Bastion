# Phase 59: Briefing Deck Slide and Image Specs - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Produce comprehensive slide-by-slide specifications with image generation prompts and full scripted narratives for a BASTION briefing deck. Also produce a companion whitepaper (docx and pdf) with full technical depth, architecture diagrams, and Chicago 18th edition footnote citations. The deck covers BASTION's innovation, enabling technologies, tradeoffs, limitations, and doctrinal impact. A live BASTION demo runs on a second screen alongside the deck.

**Required slide topics (minimum):**
- Knowledge graph and its role in strategic understanding
- Agent Hub: agent types, teams, orchestrators, AI infusion throughout
- Smart contracts as policy enforcement and audit mechanism
- DAOs at various levels enacting decision gates and coordination
- DIDs providing identity to every resource, person, material, agent, data (coalition caveats)
- Enforceable authority levels (5 levels) and delegations (robot autonomy example)
- Tradeoffs and decisions (why X over Y)
- Known limitations, constraints, and future roadmap
- Doctrinal impact on military doctrine, staff, and hierarchical structures

</domain>

<decisions>
## Implementation Decisions

### Audience & Positioning
- Dual audience: mixed defense/tech evaluators AND academic thesis advisor
- Dual-track narrative: research contribution AND working prototype
- Explicitly frame as prototype/proof of concept, NOT MVP or production-ready
- Tone: "academic with edge" — rigorous and defensible, but compelling and engaging

### Terminology
- Plain language primary: lead with accessible descriptions, technical terms in parentheses
- Dedicated visual glossary slide in the annex
- Companion printed PDF whitepaper explores concepts in full technical depth

### Narrative Flow
- Open with live physical demo showing planning → autonomous execution → decision gates
- Then problem-first arc: broken status quo of coalition C2
- Simplified architecture overview slide right after problem setup (roadmap for audience)
- Technology sections organized by operational capability (not by individual technology)
- Closing sequence: tradeoffs, limitations, doctrinal impact (all at end, as reflection)
- Detailed architecture synthesis slide near the end (bookend with the simplified one)

### Visual Style
- Clean modern tech aesthetic (NOT dark tactical — BASTION itself on second screen provides that contrast)
- Light/white backgrounds, sharp typography, strategic color use
- Blue & cyan tech color palette: primary blues (#2563EB, #0EA5E9), white backgrounds, cyan accents for blockchain/crypto elements

### Image Types
- Mix of conceptual diagrams (for tech/architecture) AND AI-generated hero images (for opening/closing/transitions)
- Full generation-ready prompts for all images: composition, color palette, style references, aspect ratio, mood, specific elements — copy-paste ready for Midjourney/DALL-E

### Deck Structure
- Core deck: 20-25 slides for the main briefing
- Annex: 15-20 detailed backup slides for Q&A deep-dives
- Visual glossary slide in annex

### Narrative Depth
- Full scripted narrative for every slide — word-for-word speaking script
- Feeds into companion whitepaper content
- Each slide spec includes DEMO CUE points noting what BASTION screen to show on second monitor at that moment

### Technology Depth (Slides)
- Conceptual + one level deep: show what it does, why it matters, AND one concrete example/mechanism
- Proves it was built, not just theorized
- Full architecture lives in the whitepaper

### Companion Whitepaper
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

</decisions>

<specifics>
## Specific Ideas

- Live BASTION demo runs on second screen during briefing — the deck should complement, not duplicate, the live visuals
- Demo opens the presentation: show the culmination of planning leading to a tactical operation run autonomously with required decision gates — then the deck unpacks "how does that actually work?"
- Authority levels example: robots acting autonomously but checking in for authority when an action exceeds their delegated authority at that point in time
- Coalition caveats: DIDs enabling national caveats on shared resources — critical for Five Eyes / NATO operations
- The whitepaper is the academic proof; the deck is the executive story

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- This is a content/documentation phase — no code to write
- PROJECT.md contains comprehensive system description, constraints, and architectural decisions that feed directly into slide content
- BASTION is a running system with live UI that will be demoed alongside the deck

### Established Patterns
- Phase 54 (whitepaper update) and Phase 13 (research whitepaper) are prior documentation phases — their outputs may inform content
- Existing scenario files in /scenario/ for Pacific Strategy AY26 could provide demo context

### Integration Points
- Whitepaper content should align with PROJECT.md descriptions
- Demo cue points must reference actual BASTION screens/tabs (Understand, Design, Plan, Direct, COP, Assess)
- Authority levels, agent types, and DID structures are implemented in the codebase — specs should reflect what's actually built

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope (whitepaper was absorbed into this phase's scope)

</deferred>

---

*Phase: 59-briefing-deck-slide-and-image-specs*
*Context gathered: 2026-03-26*
