---
phase: 33-joint-planning-process-jpp-campaign-plan-framework-with-ends-ways-means-linkage
verified: 2026-03-08T22:00:00Z
status: gaps_found
score: 10/12 must-haves verified
gaps:
  - truth: "Document generation API is accessible from frontend"
    status: failed
    reason: "documentRouter defined in backend/src/planning/routes/document-routes.ts but never imported or mounted in backend/src/index.ts"
    artifacts:
      - path: "backend/src/planning/routes/document-routes.ts"
        issue: "Router defined and exported but not mounted in main Express app"
      - path: "backend/src/index.ts"
        issue: "No import or app.use() for documentRouter"
    missing:
      - "Import documentRouter in backend/src/index.ts"
      - "Mount documentRouter under appropriate path (e.g., app.use('/api/planning', requireAuth, documentRouter))"
  - truth: "JPP tools and E-W-M tools are registered in the tool registry for AI agent use"
    status: failed
    reason: "jppToolDefinitions and ewmToolDefinitions not imported or registered in backend/src/graph/tools/index.ts; JPP agent manifests not exported from backend/src/graph/agents/index.ts"
    artifacts:
      - path: "backend/src/graph/tools/index.ts"
        issue: "No import of jppToolDefinitions or ewmToolDefinitions; these tools are invisible to the ToolRegistry"
      - path: "backend/src/graph/agents/index.ts"
        issue: "No import/export of any JPP agent manifests; agents cannot be discovered by the agent system"
    missing:
      - "Import and spread jppToolDefinitions, ewmToolDefinitions into allToolDefinitions in backend/src/graph/tools/index.ts"
      - "Import and re-export all 7 JPP agent manifests from backend/src/graph/agents/index.ts"
---

# Phase 33: JPP Campaign Plan Framework Verification Report

**Phase Goal:** Build the full 7-step JPP workflow as a collaborative planning framework within the Plan tab, producing COAs and annex-based campaign plans with Ends-Ways-Means linkage to strategic objectives. Includes entity resolution, OSINT feed integration (Argus), and designated AI agents per step.

**Verified:** 2026-03-08T22:00:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | JPP instance can be created for a problem set with echelon, step products stored/retrieved per step | VERIFIED | backend/src/jpp/jpp-store.ts: full CRUD with createInstance, getInstanceByProblemSet (auto-create), getStepProducts, saveStepProduct (279 lines) |
| 2 | E-W-M linkages connect objectives to LOEs/COAs to forces; gap analysis identifies unlinked objectives | VERIFIED | backend/src/jpp/ewm-store.ts: createLinkage, findGaps with 4 gap types, aggregate queries (318 lines) |
| 3 | Argus webhook receives articles with HMAC validation, stores as OSINT events, auto-links entities | VERIFIED | backend/src/api/osint-webhook.ts: HMAC-SHA256 with timingSafeEqual, Argus transform, entity auto-linking with confidence threshold (174 lines) |
| 4 | OSINT feed config per problem set is persisted with RSS polling support | VERIFIED | backend/src/jpp/osint-feed-store.ts: full CRUD, getActiveRSSFeeds, per-problem-set config (241 lines) |
| 5 | Frontend can fetch JPP instance, step products, and E-W-M data via REST API | VERIFIED | backend/src/api/jpp.ts: 15+ endpoints wired to jppStore/ewmStore (336 lines); frontend services: jpp-service.ts, ewm-service.ts, osint-service.ts, entity-service.ts all exist with typed API methods |
| 6 | Plan tab shows 8 sidebar items (7 JPP steps + E-W-M Overview) with free-flow navigation | VERIFIED | frontend/src/components/tabs/PlanTab.tsx: buildJPPItems returns 8 items, all always enabled, status badges from stepStatuses (228 lines) |
| 7 | All 7 JPP step components wired into PlanTab and render with role-gated sections | VERIFIED | PlanTab.tsx imports all 7 step components + EWMOverview + EntityResolutionPanel; conditional render per selectedView; currentRole from useProblemSet |
| 8 | Steps 1-3 (PlanningInitiation, MissionAnalysis, COADevelopment) substantive with role-gated sections, LOE import, E-W-M linkage creation | VERIFIED | PlanningInitiation: HQ guidance inheritance, commander guidance, staff estimates, timeline; MissionAnalysis: IPB, 5W mission statement, Klein 7 intent; COADevelopment: LOE input from designService, COA workspace, ewmService.createLinkage |
| 9 | Steps 4-7 (COAAnalysis, COAComparison, COAApproval, PlanOrderDevelopment) substantive with decision matrix, governance gates, 5-paragraph order, annexes | VERIFIED | COAAnalysis: wargame results per COA; COAComparison: 5-criteria decision matrix; COAApproval: briefing package + GateSubmitButton; PlanOrderDevelopment: 5-paragraph order, annexes A-E, E-W-M gap check, DocumentExport + DocumentVersionHistory integrated |
| 10 | E-W-M Overview shows tree and Sankey views with gap analysis | VERIFIED | EWMOverview.tsx: tree/sankey toggle, gap panel with color coding; EWMTree.tsx: 3-level SVG tree; EWMSankey.tsx: recharts Sankey with numeric indices, custom nodes |
| 11 | Document generation API accessible from frontend for PDF/DOCX export | FAILED | documentRouter defined in backend/src/planning/routes/document-routes.ts but NOT mounted in backend/src/index.ts -- endpoints are unreachable |
| 12 | JPP tools and agent manifests registered in system tool/agent registries | FAILED | jppToolDefinitions/ewmToolDefinitions not in backend/src/graph/tools/index.ts; 7 JPP agent manifests not exported from backend/src/graph/agents/index.ts |

**Score:** 10/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/jpp/types.ts` | JPP domain types | VERIFIED | 206 lines; JPP_STEPS (7), JPPInstance, JPPStepProduct, EWMLinkage, EWMGap, JPPStepConfig all exported |
| `backend/src/jpp/jpp-store.ts` | PostgreSQL CRUD for JPP | VERIFIED | 279 lines; createInstance, getInstance, getInstanceByProblemSet, updateStepStatus, getStepProducts, saveStepProduct |
| `backend/src/jpp/ewm-store.ts` | E-W-M linkage CRUD + gap analysis | VERIFIED | 318 lines; createLinkage, deleteLinkage, getLinkagesByInstance, findGaps (4 gap types), getEnds/getWays/getMeans |
| `backend/src/jpp/osint-feed-store.ts` | OSINT feed config store | VERIFIED | 241 lines; createFeed, getFeedsByProblemSet, updateFeed, getActiveRSSFeeds |
| `backend/src/api/osint-webhook.ts` | Argus webhook with HMAC | VERIFIED | 174 lines; HMAC-SHA256, Argus transform, entity auto-linking |
| `backend/src/api/jpp.ts` | JPP REST API | VERIFIED | 336 lines; 15+ endpoints, static routes before parametric, jppStore + ewmStore + entityToolHandlers |
| `backend/src/graph/agents/jpp-*-agent.ts` (x7) | 7 JPP agent manifests | VERIFIED (exist, substantive) | All 7 files exist with full manifests, Eliza characters, tool assignments |
| `backend/src/graph/tools/jpp-tools.ts` | JPP MCP tools | VERIFIED (exists, substantive) | 6 tool definitions + 6 handlers with lazy imports |
| `backend/src/graph/tools/ewm-tools.ts` | E-W-M MCP tools | VERIFIED (exists, substantive) | 6 tool definitions + handlers |
| `frontend/src/lib/jpp-service.ts` | JPP API client | VERIFIED | Typed methods: getInstance, updateStepStatus, getStepProducts, saveStepProduct, getParentProducts |
| `frontend/src/lib/ewm-service.ts` | E-W-M API client | VERIFIED | Typed methods: getLinkages, createLinkage, deleteLinkage, getGaps, getSummary |
| `frontend/src/lib/osint-service.ts` | OSINT API client | VERIFIED | Exists with typed methods |
| `frontend/src/lib/entity-service.ts` | Entity API client | VERIFIED | Exists with typed methods |
| `frontend/src/lib/document-service.ts` | Document API client | VERIFIED | Typed methods: generateDocument, createVersion, getVersions, distribute |
| `frontend/src/components/tabs/PlanTab.tsx` | Restructured Plan tab | VERIFIED | 228 lines; 8 sidebar items, all step components wired, EntityResolutionPanel |
| `frontend/src/components/plan/JPPStepLayout.tsx` | Shared step layout | VERIFIED | Exists with AI agent panel, OSINT alerts, governance gates |
| `frontend/src/components/plan/RoleGatedSection.tsx` | Role-based access control | VERIFIED | Exists with editable/read-only distinction |
| `frontend/src/components/plan/OSINTAlertBanner.tsx` | OSINT alert banner | VERIFIED | Exists with collapsible amber banner |
| `frontend/src/components/plan/PlanningInitiation.tsx` | JPP Step 1 | VERIFIED | HQ guidance inheritance, commander guidance, staff estimates, timeline |
| `frontend/src/components/plan/MissionAnalysis.tsx` | JPP Step 2 | VERIFIED | IPB, tasks, constraints, 5W mission statement, Klein 7 intent |
| `frontend/src/components/plan/COADevelopment.tsx` | JPP Step 3 | VERIFIED | LOE import from Design, COA workspace, E-W-M linkage creation |
| `frontend/src/components/plan/COAAnalysis.tsx` | JPP Step 4 | VERIFIED | Wargame results per COA, decision points |
| `frontend/src/components/plan/COAComparison.tsx` | JPP Step 5 | VERIFIED | 5-criteria decision matrix, staff recommendation |
| `frontend/src/components/plan/COAApproval.tsx` | JPP Step 6 | VERIFIED | Briefing package, commander decision, governance gate |
| `frontend/src/components/plan/PlanOrderDevelopment.tsx` | JPP Step 7 | VERIFIED | 5-paragraph order, annexes, E-W-M gap check, DocumentExport + DocumentVersionHistory integrated |
| `frontend/src/components/plan/EWMOverview.tsx` | E-W-M Overview | VERIFIED | Tree/Sankey toggle, gap panel, summary bar |
| `frontend/src/components/plan/EWMTree.tsx` | Interactive E-W-M tree | VERIFIED | 3-level SVG tree with drag-to-link |
| `frontend/src/components/plan/EWMSankey.tsx` | Sankey diagram | VERIFIED | recharts Sankey, custom nodes, numeric indices |
| `frontend/src/components/plan/EntityResolutionPanel.tsx` | Entity resolution panel | VERIFIED | Floating slide-out, approve/reject/merge/create-new actions |
| `frontend/src/components/plan/DocumentExport.tsx` | Document export UI | VERIFIED | Format selection, annex picker, version lifecycle, distribution |
| `frontend/src/components/plan/DocumentVersionHistory.tsx` | Version history panel | VERIFIED | Timeline of versions with status badges |
| `backend/src/planning/document-generator.ts` | Document rendering engine | VERIFIED | PDF (pdfkit) + DOCX (docx package), GenerateOptions, doctrinal structure |
| `backend/src/planning/document-templates.ts` | Doctrinal templates | VERIFIED | DocumentSection, DocumentTemplate, formatMission, formatAnnexes |
| `backend/src/planning/routes/document-routes.ts` | Document API endpoints | ORPHANED | 5 endpoints defined but router NOT mounted in main app |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| PlanTab.tsx | PlanningInitiation.tsx | import + conditional render | WIRED | Line 21 import, line 185 render |
| PlanTab.tsx | EWMOverview.tsx | import + conditional render | WIRED | Line 28 import, line 220 render |
| PlanTab.tsx | TabLayout.tsx | TabLayout with JPP sidebar items | WIRED | buildJPPItems returns 8 SidebarItem[] |
| PlanTab.tsx | jpp-service.ts | jppService.getInstance | WIRED | Line 132 fetch call |
| COADevelopment.tsx | ewm-service.ts | ewmService.createLinkage | WIRED | Import + usage confirmed |
| COADevelopment.tsx | design-service.ts | designService for LOEs | WIRED | Import confirmed |
| PlanningInitiation.tsx | jpp-service.ts | getParentProducts | WIRED | Import confirmed |
| PlanOrderDevelopment.tsx | ewm-service.ts | getGaps for E-W-M gap check | WIRED | Import confirmed |
| PlanOrderDevelopment.tsx | DocumentExport.tsx | Embedded in Step 7 | WIRED | Line 16 import |
| backend/src/index.ts | backend/src/api/jpp.ts | router mount | WIRED | Line 60 import, line 205 mount |
| backend/src/index.ts | backend/src/api/osint-webhook.ts | router mount | WIRED | Line 59 import, line 204 mount |
| backend/src/api/jpp.ts | backend/src/jpp/jpp-store.ts | store method calls | WIRED | Line 13 import, used throughout |
| backend/src/api/jpp.ts | backend/src/jpp/ewm-store.ts | store method calls | WIRED | Line 14 import, used throughout |
| backend/src/api/osint-webhook.ts | osintEventStore | event persistence | WIRED | Line 17 import, line 74 createEvent |
| backend/src/api/osint-webhook.ts | entityToolHandlers | entity auto-linking | WIRED | Line 18 import, line 83 search_entities |
| backend/src/planning/routes/document-routes.ts | backend/src/index.ts | router mount | NOT WIRED | documentRouter never imported or mounted |
| backend/src/graph/tools/jpp-tools.ts | tools/index.ts | tool registration | NOT WIRED | Not imported in index |
| backend/src/graph/tools/ewm-tools.ts | tools/index.ts | tool registration | NOT WIRED | Not imported in index |
| backend/src/graph/agents/jpp-*-agent.ts | agents/index.ts | agent registration | NOT WIRED | Not imported/exported in index |

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|-------------|--------|----------|
| JPP-01 | 33-01, 33-04, 33-05, 33-06, 33-07, 33-10 | SATISFIED | Full 7-step JPP workflow with data layer, API, and UI |
| JPP-03 | 33-01, 33-04, 33-08 | SATISFIED | E-W-M linkage store, API, tree + Sankey views, gap analysis |
| JPP-04 | 33-03 | PARTIAL | 7 agent manifests + MCP tools exist but NOT registered in tool/agent indexes |
| JPP-05 | 33-03 | PARTIAL | Agent manifests define auto-draft capability but agents not discoverable by system |
| JPP-08 | 33-02, 33-04, 33-09 | SATISFIED | OSINT webhook, feed config, entity resolution panel |
| JPP-02 | (in ROADMAP but not in scope requirements) | N/A | Listed in ROADMAP requirements but not claimed by any plan |
| JPP-06 | (in ROADMAP but not in scope requirements) | N/A | Listed in ROADMAP requirements but addressed by Plans 05-07 |
| JPP-07 | (in ROADMAP but not in scope requirements) | N/A | Listed in ROADMAP requirements but addressed by Plans 05, 09 |
| JPP-09 to JPP-13 | (in ROADMAP but mixed coverage) | N/A | Partial coverage across plans; no REQUIREMENTS.md to verify against |

Note: No REQUIREMENTS.md file exists in the project. Requirement IDs are referenced in ROADMAP.md (Phase 33 lists JPP-01 through JPP-13) and in individual plan frontmatter. Without REQUIREMENTS.md, full requirement text/descriptions cannot be cross-referenced. The 5 requirement IDs specified for verification (JPP-01, JPP-03, JPP-04, JPP-05, JPP-08) are accounted for above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| frontend/src/components/plan/EWMOverview.tsx | 290-291 | console.log for AI suggestion (placeholder for future agent integration) | Info | Non-blocking; AI suggestion feature deferred |
| backend/src/api/jpp.ts | 336 | export default router (not named export jppRouter) | Info | Works but inconsistent with plan's documented export name |

### Human Verification Required

### 1. Full JPP Workflow Navigation
**Test:** Navigate to any problem set Plan tab, verify 8 sidebar items visible, click through all 7 steps + E-W-M Overview
**Expected:** All 8 views render without errors, status badges visible, free-flow navigation (no blocking)
**Why human:** Visual layout, rendering correctness, interaction flow

### 2. Role-Gated Section Behavior
**Test:** Log in with different staff roles (j2, j3, commander, observer), visit each step
**Expected:** Sections show "(read-only)" for non-owning roles with reduced opacity; owning roles can edit
**Why human:** Visual distinction, CSS behavior, role context integration

### 3. E-W-M Tree and Sankey Visualization
**Test:** Navigate to E-W-M Overview, toggle between Tree and Sankey views
**Expected:** Tree shows 3-level node layout with color coding; Sankey shows flow diagram; gap panel shows warnings
**Why human:** SVG rendering, recharts Sankey component visual output, interaction (drag-to-link)

### 4. Document Export Flow
**Test:** Complete Step 7, attempt to export as PDF/DOCX (once documentRouter is mounted)
**Expected:** Document downloads with doctrinal format, cover page, 5-paragraph order, annexes
**Why human:** Binary file output quality, formatting

### 5. Entity Resolution Panel
**Test:** Click floating entity resolution button, verify slide-out panel
**Expected:** Shows pending low-confidence matches with approve/reject/merge/create-new actions
**Why human:** Floating panel positioning, animation, data flow

## Gaps Summary

Two wiring gaps prevent full goal achievement:

1. **Document generation API not mounted** -- The `documentRouter` is fully implemented in `backend/src/planning/routes/document-routes.ts` with 5 endpoints (generate, versions, distribute) but is never imported or mounted in `backend/src/index.ts`. This means the frontend `DocumentExport` component's fetch calls to generate/version/distribute endpoints will fail with 404. The fix is a 2-line change: import the router and mount it.

2. **JPP tools and agent manifests not registered in system indexes** -- The 6 JPP tools (`jpp-tools.ts`) and 6 E-W-M tools (`ewm-tools.ts`) are fully implemented with definitions and handlers but are not imported into `backend/src/graph/tools/index.ts`, making them invisible to the ToolRegistry. Similarly, all 7 JPP agent manifests exist as standalone files but are not exported from `backend/src/graph/agents/index.ts`, making them undiscoverable by the agent orchestration system. The fix is adding import/export lines to both index files.

Both gaps are wiring-only issues -- all underlying implementations are complete and substantive. The fixes are mechanical (import + register).

---

_Verified: 2026-03-08T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
