# Phase 54: Update Research Whitepaper and Docs for Demo Briefing - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Update the existing v0.1 research whitepaper (written during Phase 13) to v0.2 reflecting all capabilities built through Phase 53. Create demo briefing materials (slide deck, updated demo script, briefing document). Fully refresh the docs site to reflect current system state. All visual assets produced as detailed AI image generator specs in markdown, not actual images.

</domain>

<decisions>
## Implementation Decisions

### Whitepaper Update Approach
- New version overlay: keep v0.1 intact, create v0.2 with tracked changes and additions
- All capability areas equally weighted — paper reflects the full system proportionally
- Update SITREP (Appendix A) fully with all 50+ completed phases, current architecture, remaining work
- Moderate visual expansion: 3-4 diagrams (architecture, governance flow, robot integration, knowledge graph) + 6-8 screenshots
- All images/diagrams produced as detailed markdown specs for AI image generation, not actual image files

### Whitepaper New Content
- Add new subsections within existing sections (e.g., 3.4 Robot Integration, 3.5 Knowledge Graph Architecture, 4.3 Governance Results)
- Two new Background subsections: edge computing/robotics AND knowledge graphs
- Discussion section expanded to: lessons learned + updated risks + future work + explicit limitations section
- Hybrid references approach: add [CITATION NEEDED] markers in text where new claims need support, leave references section for Zotero management

### Demo Briefing Format
- Three deliverables: slide deck (markdown-based) + updated demo script + standalone briefing document
- Audience: mixed academic and military/defense stakeholders — balance rigor with operational value
- Duration: 30 minutes plus questions
- Hybrid structure: lead with capability overview, then three-act demo flow (Strategic/Operational/Tactical) with in/on/out-of-the-loop human authority positions

### Docs Site Updates
- Full refresh of all docs/site/ pages to reflect current system state
- Use current tab names: Understand, Design, Plan, Decide, COP, Assess
- Rename direct-tab.md to decide-tab.md and update content
- Auto-generate API reference from actual backend routes (Swagger/OpenAPI style)
- Add new full-coverage pages for: robot bridge, swarm behavior, vision capabilities, knowledge graph subspaces, JSON-LD brain

### Claude's Discretion
- Exact subsection numbering and placement within existing paper sections
- Slide deck visual style and layout
- Which specific screenshots best represent each capability for the 6-8 screenshot specs
- How to structure auto-generated API docs tooling
- Order of new docs site pages and navigation structure

</decisions>

<specifics>
## Specific Ideas

- Whitepaper carries forward Phase 13 decisions: academic format, 20-40 pages, Chicago 18th footnotes, working title "Decision Overmatch: Accelerating Military Advantage with AI-Augmented Decentralized Autonomous Organizations"
- Demo script carries forward three human authority positions (in-the-loop, on-the-loop, out-of-the-loop) and Pacific Strategy AY26 scenario
- Image specs must be detailed enough for an AI image generator to produce accurate visuals — include layout, labels, component relationships, colors/style guidance
- Briefing document is standalone executive summary style — should work without the demo being present

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/whitepaper/` — complete v0.1 whitepaper with all sections (00-abstract through 07-references + appendices)
- `docs/whitepaper/ASSEMBLY.md` — document assembly instructions and checklist
- `docs/whitepaper/figures/` — system-architecture.md and workflow-screenshots.md specs
- `docs/whitepaper/appendix-b-demo-script.md` — existing 20-min demo script with three-act structure
- `docs/site/docs/` — existing docs site with capabilities, agents, governance, blockchain, API, exercises, architecture pages

### Established Patterns
- Whitepaper sections are individual markdown files assembled per ASSEMBLY.md order
- Docs site uses mdBook-style structure with index.md and category subdirectories
- Demo script uses narrator/inject format with timing markers and pre-demo checklists

### Integration Points
- `scripts/seed-scenario.sh` — referenced in demo script for setup
- `scenario/` directory — Pacific Strategy AY26 scenario files
- Backend routes at `backend/src/` — source for API docs generation
- Frontend tabs at `frontend/src/` — source for capability documentation

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 54-update-research-whitepaper-and-docs-for-demo-briefing*
*Context gathered: 2026-03-23*
