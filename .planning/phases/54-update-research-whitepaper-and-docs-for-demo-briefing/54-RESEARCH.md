# Phase 54: Update Research Whitepaper and Docs for Demo Briefing - Research

**Researched:** 2026-03-23
**Domain:** Technical writing, academic documentation, demo materials, docs site refresh
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Whitepaper Update Approach**
- New version overlay: keep v0.1 intact, create v0.2 with tracked changes and additions
- All capability areas equally weighted — paper reflects the full system proportionally
- Update SITREP (Appendix A) fully with all 50+ completed phases, current architecture, remaining work
- Moderate visual expansion: 3-4 diagrams (architecture, governance flow, robot integration, knowledge graph) + 6-8 screenshots
- All images/diagrams produced as detailed markdown specs for AI image generation, not actual image files

**Whitepaper New Content**
- Add new subsections within existing sections (e.g., 3.4 Robot Integration, 3.5 Knowledge Graph Architecture, 4.3 Governance Results)
- Two new Background subsections: edge computing/robotics AND knowledge graphs
- Discussion section expanded to: lessons learned + updated risks + future work + explicit limitations section
- Hybrid references approach: add [CITATION NEEDED] markers in text where new claims need support, leave references section for Zotero management

**Demo Briefing Format**
- Three deliverables: slide deck (markdown-based) + updated demo script + standalone briefing document
- Audience: mixed academic and military/defense stakeholders — balance rigor with operational value
- Duration: 30 minutes plus questions
- Hybrid structure: lead with capability overview, then three-act demo flow (Strategic/Operational/Tactical) with in/on/out-of-the-loop human authority positions

**Docs Site Updates**
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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 54 is a pure documentation and writing phase. The whitepaper was written in January 2026 at Phase 13 (v0.1). Since then, approximately 40 additional phases have been completed, adding capabilities that include: doctrinal tab restructure, operational design workspace, resource registry with DIDs, training mode, AI COP layer, autonomous document intelligence, robot bridge, robot vision, swarm leadership, and the Decide tab with decision dashboard. All of these need to be woven into the paper.

The v0.2 update strategy is conservative and additive: do not rewrite existing prose, add subsections within existing section structure, update the Abstract to reflect the expanded scope, update the SITREP fully, update the demo script to 30 minutes, and produce three new demo briefing deliverables. All visual assets are markdown specs for AI image generation — no actual image files are produced.

The docs site has a clear structural deficiency: it still uses "direct-tab.md" when the platform now has a "Decide" tab, and is missing pages for robot bridge, swarm, vision, knowledge graph subspaces, and JSON-LD brain. The site refresh is a content-only operation within the existing mdBook-style structure.

**Primary recommendation:** Treat v0.2 as additions layered onto v0.1 structure, not a rewrite. Add new content in clearly delineated subsections, update metrics/status in all existing sections, and ensure the three new deliverables (slide deck, briefing doc, updated demo script) stand alone as coherent documents.

---

## Capability Inventory: What Changed Since Phase 13 (January 2026)

This is the core research finding. The planner needs to know exactly which capabilities need documentation coverage.

### Capabilities Complete Between Phase 13 and Phase 53

| Phase | Capability | Whitepaper Section | Docs Site Page |
|-------|-----------|-------------------|----------------|
| 14 | Dual-perspective IPB, COA scoring, commander decision matrix, WARNORD/OPORD/FRAGO generation | 3.x new subsection (IPB/Orders) | capabilities/plan-tab.md update |
| 15 | JPP staff org workspaces, per-role AI agents, cross-staff notifications, hybrid editor | 3.x new subsection (Staff Workspaces) | new: capabilities/staff-workspaces.md |
| 21 | AI COP layer, MIL-STD-2525D SVG overlays, entity linker, layer governance, perspective toggle | 3.9 COP layer (update/expand) | capabilities/cop-tab.md update |
| 22 | Training/operational global mode, EXERCISE banner, data isolation, governance parity | 3.11 Training Mode (new) | exercises/training-mode.md update |
| 24 | Doctrinal tab restructure: Understand/Design/Plan/Direct/COP/Assess | 3.7 (update throughout) | all capabilities/* pages update |
| 25 | Operational design workspace, CoG analysis, LOEs, design-to-plan handoff | 3.7 Operational Design (new subsec) | capabilities/design-tab.md update |
| 25.1 | Training package upload, scenario-based problem set creation | 3.11 (update) | exercises/scenario-setup.md update |
| 27 | Resource registry with did:near:resource DIDs, 5 plugin types, COP integration, telemetry | 3.10 Resource Registry (new) | blockchain/resource-registry.md update |
| 30 | Ironclaw agent integration (chief-of-staff capability) | 3.x (AI agents section update) | ai-agents/agent-catalog.md update |
| 32 | Network device discovery, BLE/WiFi/USB/TAK scanning, DAO-governed acceptance | 3.x (Resource/Discovery section) | new: capabilities/resource-discovery.md |
| 33 | JPP 7-step campaign plan framework, ends-ways-means linkage | 3.x (Planning section update) | capabilities/plan-tab.md update |
| 34 | Echelon routing (strategic/operational/tactical plan views) | 3.x | capabilities/plan-tab.md update |
| 35 | Mission creation from OPORD, tactical child problem set | 3.x | capabilities/plan-tab.md update |
| 36 | Strategic guidance workflow, directive drafting | 3.x | capabilities/plan-tab.md update |
| 37 | Training assessment loop, AAR capture, METL proficiency, upward aggregation | 3.x (Training section) | exercises/training-mode.md update |
| 38 | Inheritance deepening, change notification, FRAGO propagation, upward reporting | 3.x | architecture/data-model.md update |
| 39 | Operational demonstration data package (Pacific Strategy AY26 complete seed) | 4.x (Results/demo update) | exercises/scenario-setup.md update |
| 40 | Autonomous document intelligence team, scoping interview, NATO reliability ratings | 3.x (new AI agents subsection) | ai-agents/agent-catalog.md update |
| 41 | Adaptive brain visualization, neural graph canvas, brain timeline | 3.x (Knowledge Graph section) | new: capabilities/knowledge-graph.md |
| 42 | Resources tab, consolidated inventory/discovery UI | 3.x | new: capabilities/resources-tab.md |
| 43 | Robot bridge (Docker + Python agent), mDNS auto-discovery, command proxy | 3.4 Robot Integration (new) | new: capabilities/robot-bridge.md |
| 44 | Robot vision (CSI camera, detectNet, ORB), mission intent translation, 4 vision-enabled mission types | 3.4 Robot Integration (continue) | new: capabilities/robot-vision.md |
| 46 | Swarm leader, 6 doctrinal formations, UDP peer mesh, DAO-driven membership | 3.4 Robot Integration (continue) | new: capabilities/swarm-behavior.md |
| 49 | Design/Plan alignment, fork-and-merge revision system, DAO-governed plan changes | 3.7 (update) | capabilities/design-tab.md update |
| 53 | Decide tab, decision dashboard, RACI matrix, PendingDecisionModal, Ironclaw 60s polling | Direct→Decide rename, new section | rename direct-tab.md → decide-tab.md |

### Updated Agent Count
The v0.1 abstract states 131 agents (31 specialized + 102 JPP staff). Phase 30, 40, and others added agents. The planner should verify the current total from the codebase before finalizing the abstract update. The SITREP's A.2 table shows 131 as of the SITREP date but that SITREP itself needs updating.

### Updated API Endpoint Count
v0.1 SITREP states ~417 endpoints. Phases 30-53 added more. The auto-generated API reference will capture the current count.

---

## Architecture Patterns

### Whitepaper Versioning Pattern
The existing structure is individual markdown files assembled per `docs/whitepaper/ASSEMBLY.md`. v0.2 adds content within the existing files — no new top-level section files are needed except for any new Background subsections. The ASSEMBLY.md already lists the file order.

**New background subsection files to create:**
- `02-background-robotics.md` — edge computing/robotics background (new section 2.4)
- `02-background-knowledge-graphs.md` — knowledge graphs/ontology background (new section 2.5, shifting existing 2.4+ numbering or using 2.x)

**Existing files to update:**
- `00-abstract.md` — update agent count, add robot/swarm/knowledge graph to contribution list
- `00-title-page.md` — version v0.2, date March 2026
- `03-methodology.md` — add subsections 3.4 (Robot Integration), 3.5 (Knowledge Graph Architecture), update 3.9 COP, 3.10 Resource Registry, add 3.11+ for new capabilities
- `04-results.md` — add section 4.3 Governance Results, update physical demonstration to reflect robot bridge/vision/swarm
- `05-discussion.md` — add lessons learned subsection, update risks, expand future work, add explicit limitations section
- `appendix-a-sitrep.md` — full replacement with current status (50+ phases)
- `appendix-b-demo-script.md` — update timing from 20 to 30 minutes, add new capability demonstrations

### Demo Briefing File Pattern
New files to create under `docs/`:

```
docs/
├── whitepaper/
│   ├── (existing files updated above)
│   ├── 02-background-robotics.md        (NEW)
│   ├── 02-background-knowledge-graphs.md (NEW)
│   └── figures/
│       ├── system-architecture.md       (UPDATE - add robot bridge layer)
│       ├── workflow-screenshots.md      (UPDATE - add new tab screenshots)
│       ├── governance-flow.md           (NEW - detailed DAO governance flow diagram)
│       ├── robot-integration.md         (NEW - robot bridge + vision + swarm)
│       └── knowledge-graph.md           (NEW - brain visualization architecture)
└── briefing/                            (NEW directory)
    ├── slide-deck.md                    (NEW - markdown slide deck)
    ├── demo-script-30min.md             (NEW - 30-minute updated script)
    └── briefing-document.md             (NEW - standalone executive summary)
```

### Docs Site Pattern
The docs site at `docs/site/docs/` uses mdBook-style structure. Pages are individual markdown files with category subdirectories. Navigation is managed through `docs/site/docs/index.md` (or a SUMMARY.md/book.toml if present).

**Files to rename/create/update:**
```
docs/site/docs/capabilities/
├── understand-tab.md        (UPDATE)
├── design-tab.md            (UPDATE)
├── plan-tab.md              (UPDATE)
├── direct-tab.md            (RENAME → decide-tab.md, full content rewrite)
├── cop-tab.md               (UPDATE)
├── assess-tab.md            (UPDATE)
├── resources-tab.md         (NEW)
├── robot-bridge.md          (NEW)
├── robot-vision.md          (NEW)
├── swarm-behavior.md        (NEW)
└── knowledge-graph.md       (NEW)
```

### API Reference Auto-Generation Pattern
The context notes "auto-generate API reference from actual backend routes (Swagger/OpenAPI style)." The backend is at `backend/src/`. The pattern to use is:

1. Scan backend route files for Express route definitions
2. Generate a structured markdown reference organized by domain
3. Write to `docs/site/docs/api/rest-endpoints.md`

This is a write task, not a tooling build task — the planner should schedule a task to read backend routes and produce the markdown, not build a full Swagger server.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Actual diagram images | PNG/SVG files | Markdown specs with AI image generator instructions | CONTEXT.md decision: all visuals as markdown specs |
| Swagger UI server | Express middleware | Static markdown API reference | This is a docs update phase, not an infrastructure phase |
| PDF export of whitepaper | pandoc pipeline changes | Existing `docs/whitepaper/scripts/export.sh` | Already works per ASSEMBLY.md |
| New docs site framework | mdBook replacement | Same mdBook-style structure | Established pattern, don't introduce complexity |

**Key insight:** This phase produces text files. No code changes, no tooling changes, no infrastructure. The risk is scope creep into building tooling (Swagger server, pandoc changes, image generation scripts) instead of writing content.

---

## Common Pitfalls

### Pitfall 1: Rewriting Instead of Augmenting
**What goes wrong:** Attempting to rewrite v0.1 prose to incorporate new capabilities leads to massive scope expansion and risks breaking well-formed academic writing.
**Why it happens:** Each new capability seems like it warrants updating surrounding context.
**How to avoid:** Add new subsections with clear headers. Update metrics (agent counts, endpoint counts, phase counts) in place. Let existing prose stand where it is still accurate.
**Warning signs:** Any plan task that says "rewrite Section X" rather than "add subsection X.Y" or "update metrics in Section X."

### Pitfall 2: Abstract Becomes a Changelog
**What goes wrong:** The abstract tries to list every new feature instead of presenting a coherent research contribution summary.
**Why it happens:** Writer wants to ensure every new capability gets credit.
**How to avoid:** The abstract should add one new paragraph on the physical demonstration validation (robot bridge/vision/swarm) and update the agent count. The contribution list should be expanded from 5 to ~8 key novel contributions, not exhaustively enumerated.
**Warning signs:** Abstract exceeds 350 words (current is 279 words — v0.2 target 320-350 words).

### Pitfall 3: Demo Script Timing Doesn't Add Up
**What goes wrong:** Adding new capabilities to a 30-minute script without removing or compressing existing sections causes the script to run 40-45 minutes.
**Why it happens:** Each capability gets its own allocated time without accounting for total budget.
**How to avoid:** The 30-minute structure must be planned as a whole before writing individual acts. Allocate time blocks first: suggest Strategic (8 min), Operational (6 min), Tactical (8 min), COP/Resources (4 min), Cross-Level (2 min), Conclusion (2 min). Each act must stay within its budget.
**Warning signs:** Individual act scripts that sum to more than 28 minutes of content (leave 2 min buffer).

### Pitfall 4: Docs Site Navigation Goes Stale
**What goes wrong:** New pages are created but the index/SUMMARY.md navigation file is not updated, so pages are unreachable.
**Why it happens:** Content writers focus on page content and forget to update navigation.
**How to avoid:** Every new docs site page task must include updating the navigation file. Check whether `docs/site/` uses a `SUMMARY.md`, `book.toml`, or `index.md` for navigation before writing tasks.
**Warning signs:** A task creates a new `.md` file without a corresponding navigation entry task.

### Pitfall 5: AI Image Specs Are Vague
**What goes wrong:** Image specs like "a diagram showing the robot bridge architecture" don't give AI generators enough to produce accurate visuals.
**Why it happens:** Writer summarizes instead of specifying.
**How to avoid:** Each image spec must include: layout (e.g., "left-to-right flowchart"), all labeled components with their exact names, connection types (solid/dashed/bidirectional), color palette guidance (dark background, blue=friendly, red=adversary, green=robot), and dimensions guidance.
**Warning signs:** An image spec that doesn't mention specific component names from the codebase (e.g., "PythonRobotAgent", "DockerBridge", "mDNS").

### Pitfall 6: Decide Tab Still Called "Direct" in Docs
**What goes wrong:** The tab was renamed from Direct to Decide in Phase 53. Docs that say "Direct tab" are now wrong.
**Why it happens:** The rename is recent (2026-03-19) and many references exist.
**How to avoid:** The rename task must include a global search for "Direct tab" and "direct-tab" across all docs files. The planner should schedule a search-and-replace verification step.
**Warning signs:** Any docs page that still uses "Direct tab" or links to `direct-tab.md` after Phase 54.

---

## Code Examples

### Existing Image Spec Pattern (from `docs/whitepaper/figures/system-architecture.md`)
The existing system architecture figure uses Mermaid as the spec format. This is the established pattern for v0.1. For v0.2, new figure specs should use either:
- Mermaid diagrams (for flowcharts, sequence diagrams, architecture diagrams)
- Prose specifications with detailed layout instructions (for screenshots and UI mockups)

The `workflow-screenshots.md` file provides the pattern for screenshot specs — it describes what should be visible in each screenshot with UI element labels and context.

### Backend Route Discovery Pattern
To auto-generate the API reference, the relevant route files are at `backend/src/`. A grep for `router.get\|router.post\|router.put\|router.delete\|app.get\|app.post` will enumerate endpoints. The output should be organized by functional domain (auth, dao, planning, resources, agents, etc.) matching the existing `docs/site/docs/api/rest-endpoints.md` structure.

---

## State of the Art

| Old State (v0.1, Jan 2026) | Current State (v0.2, Mar 2026) | Phase |
|---------------------------|-------------------------------|-------|
| 131 agents (31 specialized + 102 JPP) | 131+ agents (verify current count) | 30, 40 additions |
| ~417 REST endpoints | ~500+ endpoints (estimate; verify) | 30-53 additions |
| 12 smart contract modules | 12+ modules (verify) | 33-53 |
| 4-tab functional navigation | 6-tab doctrinal lifecycle | 24 |
| No operational design tool | Full Design tab with CoG/LOE/OpApproach | 25 |
| No COP generation | AI-generated MIL-STD-2525D overlays | 21 |
| No training/operational separation | Global mode toggle, data isolation | 22 |
| No JPP staff workspaces | Per-role workspaces for 31+ staff positions | 15 |
| No robot/physical demo | Robot bridge + vision + swarm leader | 43, 44, 46 |
| No knowledge graph brain | Adaptive brain visualization | 41 |
| Single platform tactical demo | 3+ platform swarm capability (Phases 46, 48) | 46 |
| 6 phases completed at writing | 50+ phases completed | 14-53 |
| Direct tab | Decide tab with decision dashboard | 53 |
| No resource DID system | did:near:resource-{id} with 5 plugins | 27 |

**Deprecated/outdated in docs:**
- "direct-tab.md" — now decide-tab.md
- Agent count "131" in abstract — needs verification and update
- SITREP phases list stops at Phase 27 — needs all phases 30-53 added
- Demo script is 20 minutes — now 30 minutes
- Figures reference old tab names (COP/Decide/Design/Campaign)

---

## Whitepaper Section-by-Section Update Guide

This section is the primary artifact the planner uses to schedule tasks.

### 00-title-page.md
- Change version: v0.1 → v0.2
- Change date: 2026-01-24 → 2026-03-23
- No other changes

### 00-abstract.md
- Update agent count (verify from codebase)
- Add robot/vision/swarm to physical demonstration paragraph
- Add knowledge graph brain visualization to contribution list
- Expand contributions from current 5 to ~8 (add: robot integration, knowledge graph, training assessment, inheritance deepening)
- Keep within 320-350 words

### 01-introduction.md
- Add a brief paragraph noting the paper reflects capabilities through Phase 53 (March 2026)
- Update any metrics that reference specific numbers
- No structural changes

### 02-background-daos.md, 02-background-military.md, 02-background-ai.md
- These are stable — add [CITATION NEEDED] markers only where new claims would need support
- Do not rewrite existing content

### NEW: 02-background-robotics.md
- Edge computing in military contexts (Jetson Orin Nano, NVIDIA TOPS)
- Autonomous ground vehicles in military applications (UGV doctrine)
- DDIL environments and edge AI resilience
- Swarm robotics and doctrinal formation concepts
- 4-6 pages, Chicago footnote style, [CITATION NEEDED] markers

### NEW: 02-background-knowledge-graphs.md
- Knowledge graphs for intelligence analysis
- JSON-LD and semantic web in defense contexts
- Graph visualization (force-directed, brain-style)
- Entity resolution and confidence scoring in intelligence
- 3-5 pages, Chicago footnote style, [CITATION NEEDED] markers

### 03-methodology.md (major additions)
**New subsections to add:**
- 3.4 Robot Integration Architecture (robot bridge Docker pattern, Python agent, mDNS discovery, mission intent translation, vision pipeline)
- 3.5 Knowledge Graph Architecture (JSON-LD brain, Neo4j, entity resolution, adaptive brain visualization)
- Update 3.9 COP Layer (now includes MIL-STD-2525D overlays from AI agents, layer governance, publish review)
- 3.10 Resource Registry (did:near:resource, 5 plugin types, COP integration)
- 3.11 Training/Operational Mode (global toggle, governance parity, data isolation)
- 3.12 Staff Organization Workspaces (JPP roles, per-role AI agents)
- 3.13 Doctrinal Tab Architecture (Understand/Design/Plan/Decide/COP/Assess — note the tab is now "Decide" not "Direct")
- 3.14 Document Intelligence Pipeline (autonomous document team, NATO source reliability ratings)
- 3.15 Inheritance Architecture (hierarchical problem sets, context propagation, FRAGO propagation)

### 04-results.md (additions)
- Update Stage 1/2/3 to reference doctrinal tabs by correct names
- Add section 4.3 Governance Results (MDMP governance gates, safety matrix validation, assumption registry behavior)
- Update 4.3 Physical Demonstration to reflect current robot capabilities (vision, swarm)
- Add demo data package reference (Pacific Strategy AY26 seed)

### 05-discussion.md (additions)
- Add 5.0 Lessons Learned (new subsection before existing content)
- Update resolved limitations (add all resolutions from Phase 14-53)
- Update remaining limitations
- Expand future work section with Phase 45-70 roadmap items
- Add explicit limitations section covering: demonstration scope vs. operational reality, AI reliability limitations, swarm scale limitations

### 06-conclusion.md
- Update metrics
- Add one paragraph on physical demonstration validation (robot bridge/vision/swarm)
- Keep research question answer intact

### 07-references.md
- Do not change (managed by Zotero)
- All new claims in v0.2 text get [CITATION NEEDED] markers

### appendix-a-sitrep.md
- Full replacement — current SITREP is already well-structured and complete through Phase 27
- Add all phases 30-53 in the same format
- Update A.2 Current Status metrics table (agent count, endpoint count, tabs, phases)
- Update A.3 Remaining Work (remove completed items, add current remaining)
- Update A.4 MVP Demo Readiness table

### appendix-b-demo-script.md
- Keep as "20-minute version" or rename to appendix-b-demo-script-20min.md
- Create new appendix-b-demo-script-30min.md with expanded content
- Add: Design tab demonstration (3 min), Resources tab (2 min), robot vision demonstration (2 min extra)
- Update setup requirements (robot bridge, Docker, Python agent)

---

## Demo Briefing Deliverables

### Slide Deck (docs/briefing/slide-deck.md)
Audience: mixed academic + military/defense. 30 slides maximum. Sections:
1. Title + Research Question (2 slides)
2. Problem: Coalition C2 Coordination Crisis (3 slides)
3. Approach: AI-Augmented DAOs (3 slides)
4. Architecture Overview — system architecture diagram spec (3 slides)
5. Key Capabilities (8 slides, one per major capability cluster)
6. Demo Preview — three-act structure (1 slide)
7. Results (3 slides: metrics, governance invariants, demo outcomes)
8. Discussion: Limitations and Future Work (2 slides)
9. Conclusion: Research Question Answered (2 slides)
10. Q&A (1 slide)
Format: markdown with `---` slide separators, speaker notes in blockquotes

### Demo Script 30 Minutes (docs/briefing/demo-script-30min.md)
Follows existing three-act structure from appendix-b-demo-script.md but:
- Extend setup requirements to include Docker bridge and Python robot agent
- Act 1: Strategic (8 min) — add Design tab demonstration
- Act 2: Operational (6 min) — no change
- Act 3: Tactical (8 min) — add robot vision demonstration
- Act 3.5: Resources/COP (4 min) — add resource DID visualization
- Act 4: Cross-Level (2 min) — no change
- Conclusion (2 min) — update research question answer

### Briefing Document (docs/briefing/briefing-document.md)
Standalone 4-6 page executive summary. Sections:
1. Executive Summary (1 page)
2. Problem Statement
3. Technical Approach
4. Key Capabilities (tabular)
5. Demonstration Results
6. Path Forward / Future Work
7. Contact/Reference

---

## Docs Site Navigation Check

Before writing any docs site page tasks, the planner must verify the navigation file. Check for one of:
- `docs/site/SUMMARY.md` (mdBook standard)
- `docs/site/docs/book.toml`
- `docs/site/docs/index.md`

Every new page must have a corresponding navigation entry.

---

## Validation Architecture

The `workflow.nyquist_validation` key is absent from `.planning/config.json` — treat as enabled.

### Test Framework
This is a documentation-only phase. There is no automated test framework applicable to markdown content validation. However, validation tasks can be defined:

| Property | Value |
|----------|-------|
| Framework | Manual validation + link checking |
| Config file | None |
| Quick run command | `grep -r "\[CITATION NEEDED\]" docs/whitepaper/ --include="*.md" \| wc -l` |
| Full suite command | `grep -rn "direct-tab\|Direct tab" docs/ --include="*.md"` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-01 | v0.2 whitepaper exists with updated abstract | manual | Check 00-abstract.md for v0.2 content | ❌ Wave 0 task |
| DOC-02 | SITREP covers all phases 1-53 | manual | `grep "Phase 53" docs/whitepaper/appendix-a-sitrep.md` | ❌ Wave 0 task |
| DOC-03 | No "direct-tab" references remain in docs site | automated | `grep -rn "direct-tab" docs/site/ --include="*.md"` | ❌ Wave 0 task |
| DOC-04 | Slide deck has 30+ slides | automated | `grep -c "^---$" docs/briefing/slide-deck.md` | ❌ Wave 0 task |
| DOC-05 | Demo script has 30-min timing markers | manual | Check docs/briefing/demo-script-30min.md for timing | ❌ Wave 0 task |
| DOC-06 | All 4 new figure specs exist | automated | `ls docs/whitepaper/figures/*.md \| wc -l` | ❌ Wave 0 task |
| DOC-07 | New docs site pages exist | automated | `ls docs/site/docs/capabilities/robot-bridge.md` | ❌ Wave 0 task |

### Sampling Rate
- **Per task commit:** Verify the specific file created/updated exists and has content
- **Per wave merge:** Run full grep suite for stale references ("Direct tab", "direct-tab", old agent counts)
- **Phase gate:** All 7 DOC requirements green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `docs/briefing/` directory needs to be created
- [ ] `docs/whitepaper/figures/governance-flow.md` — governance flow diagram spec
- [ ] `docs/whitepaper/figures/robot-integration.md` — robot bridge/vision/swarm diagram spec
- [ ] `docs/whitepaper/figures/knowledge-graph.md` — brain visualization diagram spec
- [ ] `docs/whitepaper/02-background-robotics.md` — new background section
- [ ] `docs/whitepaper/02-background-knowledge-graphs.md` — new background section
- [ ] Navigation file check: verify which file controls docs site navigation before adding new pages

---

## Open Questions

1. **Current agent count**
   - What we know: v0.1 says 131. Phase 30 (Ironclaw), Phase 40 (10 document intelligence agents), and others added agents.
   - What's unclear: Exact current total; need to check `backend/src/agents/` or agent registry.
   - Recommendation: Add a task in Wave 0 to grep the agent catalog and count current agents before writing the abstract update.

2. **Current API endpoint count**
   - What we know: v0.1 says ~417. Many phases since have added routes.
   - What's unclear: Current count.
   - Recommendation: Count route definitions as part of the API docs generation task.

3. **Docs site navigation file**
   - What we know: `docs/site/docs/` exists with subdirectories and .md files.
   - What's unclear: Whether there is a SUMMARY.md or book.toml that controls navigation.
   - Recommendation: Glob for `docs/site/**/{SUMMARY.md,book.toml}` before writing navigation update tasks.

4. **Decide tab vs Direct tab naming**
   - What we know: The tab was renamed to "Decide" in Phase 53. The CONTEXT.md says "Use current tab names: Understand, Design, Plan, Decide, COP, Assess." The direct-tab.md docs page needs to become decide-tab.md.
   - What's unclear: Whether the whitepaper's existing prose mentions "Direct tab" by that name — if so, those references need updating too.
   - Recommendation: Grep all whitepaper files for "Direct tab" before writing update tasks.

5. **ASSEMBLY.md update for new background files**
   - What we know: Two new background markdown files are being added (02-background-robotics.md, 02-background-knowledge-graphs.md).
   - What's unclear: The pandoc assembly command in ASSEMBLY.md must include them in the right order. The current numbering is 2.1 DAOs, 2.2 Military, 2.3 AI. New sections would be 2.4 and 2.5 (or the new files renumber existing ones).
   - Recommendation: The ASSEMBLY.md update must accompany the new background file creation tasks.

---

## Sources

### Primary (HIGH confidence)
- Direct file reads of `docs/whitepaper/` directory — all section content verified
- Direct file reads of `docs/site/docs/` directory — all current pages verified
- Direct read of `.planning/phases/54-update-research-whitepaper-and-docs-for-demo-briefing/54-CONTEXT.md` — user decisions
- Direct read of `.planning/STATE.md` — current phase status and completed phases
- Direct read of `.planning/ROADMAP.md` — full phase inventory with completion status
- Direct read of `.planning/config.json` — workflow configuration

### Secondary (MEDIUM confidence)
- Phase completion status from ROADMAP.md checkbox markers — HIGH confidence for phases marked [x], MEDIUM for phases with partial completion notes

### Tertiary (LOW confidence)
- Agent count estimates beyond Phase 27 — LOW confidence, requires verification from codebase

---

## Metadata

**Confidence breakdown:**
- Existing whitepaper content: HIGH — files read directly
- New capability list (phases 14-53): HIGH — from ROADMAP.md and SITREP
- Whitepaper section mapping: HIGH — based on paper structure read directly
- Agent/endpoint counts: LOW — need verification from codebase
- Docs site navigation structure: MEDIUM — directory structure known but navigation file not yet verified

**Research date:** 2026-03-23
**Valid until:** This research is based on static file content — valid until any whitepaper or docs site files change. Phase 54 should proceed immediately.
