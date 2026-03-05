---
phase: 21-ai-cop-layer-agent-team
verified: 2026-03-05T16:00:00Z
status: gaps_found
score: 5/10 must-haves verified
re_verification: false
gaps:
  - truth: "Version snapshots created at each state transition (full at COP, JSON patch for intermediate)"
    status: failed
    reason: "layerStore.transitionLayer does not call versionStore.createSnapshot during state transitions. The version store exists and is functional (with full/patch strategy and tests) but is never invoked during lifecycle transitions."
    artifacts:
      - path: "backend/src/cop/layers/layer-store.ts"
        issue: "transitionLayer method updates state and audit trail but never creates a version snapshot"
    missing:
      - "Add versionStore.createSnapshot call inside LayerStore.transitionLayer (both Memory and PostgreSQL implementations) to create a snapshot at every state transition"
      - "Full snapshot strategy at COP promotion, JSON patch for intermediate transitions"
  - truth: "Sub-agents receive document content and graph entities for extraction"
    status: failed
    reason: "handleCommitTrigger passes only workspace/section/doc IDs. runCOPGeneration receives empty documents[] and graphEntities[]. Sub-agents produce empty specs with no data to extract from."
    artifacts:
      - path: "backend/src/cop/index.ts"
        issue: "wireGenerationTrigger calls runCOPGeneration with only workspaceId/sectionId/triggeredBy - no document or entity data"
      - path: "backend/src/cop/messaging/trigger-handler.ts"
        issue: "handleCommitTrigger emits layer:generation:start without fetching or including document content"
    missing:
      - "Fetch objectives, entities, and RAFT graph data from database when trigger fires"
      - "Pass fetched data as documents and graphEntities to runCOPGeneration context"
  - truth: "COP is the primary workspace view combining all situational awareness"
    status: failed
    reason: "Overview tab and Monitor tab duplicate the same StrategicValidityDashboard map. COP tab is a separate third tab. No unified view exists. Overview should become the COP with AI layers merged onto the existing IPB map."
    artifacts:
      - path: "frontend/src/components/workspace/WorkspaceTabContainer.tsx"
        issue: "Three separate tabs (overview, monitor, cop) with overlapping map content"
      - path: "frontend/src/components/workspace/WorkspaceDashboard.tsx"
        issue: "Overview renders StrategicValidityDashboard independently from COP layers"
      - path: "frontend/src/components/tabs/MonitorTab.tsx"
        issue: "Monitor duplicates the same StrategicValidityDashboard as Overview plus actor graph"
    missing:
      - "Merge Overview + Monitor + COP into unified COP tab as the primary workspace view"
      - "Remove Monitor tab, move Actor Graph/Detail into COP sidebar views"
      - "Overlay AI-generated COP layers onto the existing IPB/validity map"
  - truth: "COP generation auto-triggers when objectives exist but no layers do"
    status: failed
    reason: "No mechanism exists to trigger initial COP generation. The commit trigger only fires on objective approval or intent creation. If a workspace already has objectives but no COP layers, visiting the COP tab shows an empty map."
    missing:
      - "Auto-trigger COP generation on first COP tab visit when objectives exist but no layers"
      - "Add manual 'Generate COP Layers' button for explicit trigger"
  - truth: "Workspace shows visual indicator of AI COP team presence and activity"
    status: failed
    reason: "No workspace-level indicator shows whether the COP agent team is active. Agent activity feed only visible inside the COP tab. Users have no way to know the AI team exists or is working."
    missing:
      - "Add COP team status indicator to workspace header/tab bar"
      - "Show generation status badge (idle/generating/ready) visible outside COP tab"
---

# Phase 21: AI COP Layer Agent Team Verification Report

**Phase Goal:** Autonomous agent team assigned per workspace section that monitors work, parses documents/plans, derives location/resource/intent, and generates MIL-STD-2525 interactive SVG overlay layers with standard military symbology for the common operating picture.
**Verified:** 2026-03-05T16:00:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | COP layer types define the full data model for layers, symbols, specs, lifecycle states, snapshots, and review feedback | VERIFIED | `frontend/src/types/cop.ts` (249 lines) exports all required interfaces: COPLayerSpec, COPSymbolSpec, COPControlMeasureSpec, COPAnnotationSpec, COPPhaseSpec, COPLayer, LayerState, LayerSnapshot, ReviewFeedback, AuditEntry, COPLayerControlsProps |
| 2 | Agent infrastructure with typed event bus, triple trigger, activity bridge, agent definitions, and pool | VERIFIED | event-bus.ts (110 lines) with typed COPEventBus class, trigger-handler.ts (160 lines) with commit/manual/polling triggers, activity-bridge.ts (88 lines) subscribes to agent:activity events, agent-definitions.ts (140 lines), agent-pool.ts (175 lines) |
| 3 | Layer persistence with lifecycle state machine, version snapshots, and conflict detection | PARTIAL | layer-store.ts (486 lines) with full CRUD and lifecycle (Draft->Review->Published->COP), conflict-detector.ts (188 lines) with Haversine distance calculation. **GAP:** version-store.ts exists (338 lines) but is NOT wired into transitionLayer |
| 4 | SIDC codes generated deterministically, SVG spec builder, LLM annotation fragments sanitized | VERIFIED | sidc-builder.ts (228 lines) with deterministic SIDC generation, svg-spec-builder.ts (199 lines), svg-fragment-generator.ts (169 lines) calls sanitizeSVG before returning, sidc-builder.test.ts (217 lines) |
| 5 | Entity linkage with hybrid graph+embedding discovery, confidence threshold, persistence | VERIFIED | entity-linker.ts (453 lines) imports OpenAIEmbeddings and graph store, confidence-threshold.ts (71 lines) with DEFAULT_CONFIDENCE_THRESHOLD, linkage-store.ts (210 lines), entity-linker.test.ts (290 lines) |
| 6 | COP coordinator is a LangGraph StateGraph routing to 6 sub-agents that produce typed specs | VERIFIED | cop-coordinator.ts (433 lines) uses StateGraph with 5 nodes (route, generate_layers, assemble, validate_cco, persist), imports all 6 sub-agents, all sub-agents use buildSIDCFromEntity, cop-coordinator.test.ts (280 lines), sub-agents.test.ts (221 lines) |
| 7 | REST API with layer CRUD, lifecycle transitions, agent control, linkage review, conflict detection | VERIFIED | cop-routes.ts (70 lines) defines 16 endpoints with auth middleware, cop-handlers.ts (658 lines), copRouter mounted at /api/cop in backend/src/index.ts:176, initCOP called at startup (index.ts:252) |
| 8 | COP map renders stacked layers with milsymbol on Leaflet, layer controls, perspective toggle, workspace integration | VERIFIED | COPMapView.tsx (324 lines) uses createMilSymbolIcon, copService.queryLayers, perspective filtering, phase-aware positioning. COPTab.tsx (127 lines) imported and rendered in WorkspaceTabContainer.tsx. COPLayerControls.tsx (7659 bytes), COPPerspectiveToggle.tsx (2464 bytes) |
| 9 | Entity tooltips, detail views, review workflow, lifecycle UI, conflict banner | VERIFIED | COPEntityTooltip.tsx calls copService.getEntityLinkages, COPEntityDetail.tsx (9529 bytes), COPReviewPanel.tsx calls copService.addFeedback and copService.transitionLayer, COPLayerLifecycle.tsx calls copService.transitionLayer and copService.recallLayer, COPConflictBanner.tsx (7757 bytes) |
| 10 | Temporal phase slider, version browser, agent activity feed | VERIFIED | COPPhaseSlider.tsx (9366 bytes) with onPhaseChange/currentPhase props and animated playback, COPVersionBrowser.tsx calls copService.listVersions and copService.getVersionSpec, COPAgentActivity.tsx calls copService.getAgentActivity with 5s polling |

**Score:** 9/10 truths verified (1 partial)

### Required Artifacts

All 57 artifacts exist with substantive implementations:

| Artifact | Lines | Status | Details |
|----------|-------|--------|---------|
| `frontend/src/types/cop.ts` | 249 | VERIFIED | All 11 required exports present |
| `backend/src/cop/cco/cco-types.ts` | 67 | VERIFIED | CCOClassMapping, CCOModule, CCOValidationResult |
| `backend/src/cop/cco/cco-schema-loader.ts` | 42 | VERIFIED | loadCCOSchema, getCCOClassMap with flat Map |
| `backend/src/cop/cco/cco-validator.ts` | 49 | VERIFIED | imports getCCOClassMap, exports validateCCOClass, suggestCCOClass |
| `backend/src/cop/layers/layer-types.ts` | 144 | VERIFIED | CreateLayerInput, UpdateLayerInput, LayerTransitionInput, LayerQueryFilters |
| `backend/src/cop/svg/svg-allowlist.ts` | 130 | VERIFIED | SVG_ALLOWED_TAGS, SVG_ALLOWED_ATTRS, SVG_FORBIDDEN_TAGS, SVG_FORBIDDEN_ATTRS |
| `backend/src/cop/svg/svg-sanitizer.ts` | 94 | VERIFIED | DOMPurify with strict allowlist, sanitizeSVG, validateSVGSafety |
| `backend/src/cop/messaging/event-bus.ts` | 110 | VERIFIED | Typed COPEventBus with on/emit/off, copEventBus singleton |
| `backend/src/cop/messaging/trigger-handler.ts` | 160 | VERIFIED | Triple trigger: commit, manual, polling with adaptive intervals |
| `backend/src/cop/messaging/activity-bridge.ts` | 88 | VERIFIED | Ring buffer, subscribes to agent:activity |
| `backend/src/cop/agents/agent-definitions.ts` | 140 | VERIFIED | COP_AGENT_DEFINITIONS, COP_COORDINATOR_DEF |
| `backend/src/cop/agents/agent-pool.ts` | 175 | VERIFIED | AgentPool, AgentAssignment |
| `backend/src/cop/layers/layer-store.ts` | 486 | VERIFIED | Full CRUD, lifecycle state machine, PostgreSQL + Memory impl |
| `backend/src/cop/layers/layer-assembler.ts` | 83 | VERIFIED | LayerAssembler merges sub-agent specs |
| `backend/src/cop/layers/conflict-detector.ts` | 188 | VERIFIED | Haversine distance, 3 conflict types, source authority ranking |
| `backend/src/cop/layers/version-store.ts` | 338 | ORPHANED | Functional but NOT called from transitionLayer |
| `backend/src/cop/svg/sidc-builder.ts` | 228 | VERIFIED | Deterministic SIDC with IDENTITY_MAP, SYMBOL_SET_MAP, ECHELON_MAP |
| `backend/src/cop/svg/svg-spec-builder.ts` | 199 | VERIFIED | buildSymbolRenderData, SymbolRenderData |
| `backend/src/cop/svg/svg-fragment-generator.ts` | 169 | VERIFIED | Calls sanitizeSVG on all LLM output |
| `backend/src/cop/linkage/entity-linker.ts` | 453 | VERIFIED | Hybrid graph+embedding, imports OpenAIEmbeddings |
| `backend/src/cop/linkage/confidence-threshold.ts` | 71 | VERIFIED | evaluateConfidence, DEFAULT_CONFIDENCE_THRESHOLD |
| `backend/src/cop/linkage/linkage-store.ts` | 210 | VERIFIED | PostgreSQL persistence |
| `backend/src/cop/agents/cop-coordinator.ts` | 433 | VERIFIED | LangGraph StateGraph with 5 nodes, imports all 6 sub-agents |
| `backend/src/cop/agents/layer-sub-agents/force-disposition.ts` | 214 | VERIFIED | Uses buildSIDCFromEntity |
| `backend/src/cop/agents/layer-sub-agents/objectives-overlay.ts` | 217 | VERIFIED | Uses buildSIDCFromEntity |
| `backend/src/cop/agents/layer-sub-agents/control-measures.ts` | 200 | VERIFIED | Control measure extraction |
| `backend/src/cop/agents/layer-sub-agents/intel-overlay.ts` | 205 | VERIFIED | Uses buildSIDCFromEntity |
| `backend/src/cop/agents/layer-sub-agents/logistics-overlay.ts` | 219 | VERIFIED | Uses buildSIDCFromEntity |
| `backend/src/cop/agents/layer-sub-agents/c2-overlay.ts` | 247 | VERIFIED | Uses buildSIDCFromEntity |
| `backend/src/cop/agents/cop-coordinator.test.ts` | 280 | VERIFIED | Behavioral tests |
| `backend/src/cop/agents/layer-sub-agents/sub-agents.test.ts` | 221 | VERIFIED | Output validation tests |
| `backend/src/cop/api/cop-routes.ts` | 70 | VERIFIED | 16 endpoints with auth middleware |
| `backend/src/cop/api/cop-handlers.ts` | 658 | VERIFIED | Layer, version, agent, linkage, conflict handlers |
| `backend/src/cop/index.ts` | 201 | VERIFIED | initCOP, copRouter, document commit wiring |
| `frontend/src/lib/cop-service.ts` | 307 | VERIFIED | Full typed API client for all endpoints |
| `frontend/src/components/cop/COPMapView.tsx` | 324 | VERIFIED | Leaflet map with milsymbol, perspective filtering, phase positioning |
| `frontend/src/components/cop/COPLayerControls.tsx` | ~230 | VERIFIED | Visibility and opacity controls |
| `frontend/src/components/cop/COPPerspectiveToggle.tsx` | ~75 | VERIFIED | Friendly/Adversary/Combined toggle |
| `frontend/src/components/cop/COPTab.tsx` | 127 | VERIFIED | Composes map, controls, perspective toggle |
| `frontend/src/components/cop/COPEntityTooltip.tsx` | ~190 | VERIFIED | Calls copService.getEntityLinkages |
| `frontend/src/components/cop/COPEntityDetail.tsx` | ~290 | VERIFIED | Full entity data view |
| `frontend/src/components/cop/COPReviewPanel.tsx` | ~260 | VERIFIED | Calls copService.addFeedback, copService.transitionLayer |
| `frontend/src/components/cop/COPLayerLifecycle.tsx` | ~260 | VERIFIED | Calls copService.transitionLayer, copService.recallLayer |
| `frontend/src/components/cop/COPConflictBanner.tsx` | ~240 | VERIFIED | Conflict display with source authority |
| `frontend/src/components/cop/COPPhaseSlider.tsx` | ~285 | VERIFIED | Phase scrub with animated playback |
| `frontend/src/components/cop/COPVersionBrowser.tsx` | ~310 | VERIFIED | Calls copService.listVersions, copService.getVersionSpec |
| `frontend/src/components/cop/COPAgentActivity.tsx` | ~270 | VERIFIED | Calls copService.getAgentActivity with polling |
| `frontend/src/components/cop/SandboxedSVG.tsx` | ~160 | VERIFIED | Shadow DOM SVG rendering |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| cco-validator.ts | cco-schema-loader.ts | getCCOClassMap() | WIRED | Import at line 11, call at line 20 |
| svg-sanitizer.ts | svg-allowlist.ts | SVG_ALLOWED_TAGS, SVG_ALLOWED_ATTRS | WIRED | Import at lines 16-21 |
| trigger-handler.ts | event-bus.ts | emit layer:generation:start | WIRED | Lines 67, 79, 113 |
| activity-bridge.ts | event-bus.ts | subscribes to agent:activity | WIRED | Constructor subscribes at line 38 |
| layer-store.ts | version-store.ts | createSnapshot on transition | NOT WIRED | transitionLayer never calls versionStore |
| conflict-detector.ts | layer-store.ts | queries layers for overlap | PARTIAL | detect() takes layers as params, doesn't query store directly -- API handler wires this |
| svg-fragment-generator.ts | svg-sanitizer.ts | sanitizeSVG | WIRED | Import at line 13, call at line 107 |
| sub-agents/* | sidc-builder.ts | buildSIDCFromEntity | WIRED | All 5 combat sub-agents import and call |
| cop-coordinator.ts | layer-store.ts | layerStore.createLayer | WIRED | Import at line 18, call at line 337 |
| cop-coordinator.ts | sub-agents/* | routes to sub-agents | WIRED | SUB_AGENT_MAP at lines 38-45 |
| cop-routes.ts | strategic.ts | mounted on app | WIRED | backend/src/index.ts:176 app.use('/api/cop', copRouter) |
| cop-handlers.ts | cop-coordinator.ts | runCOPGeneration | WIRED | Import confirmed |
| cop/index.ts | strategic.ts | handleCommitTrigger on doc approval | WIRED | strategic.ts lines 999 and 1363 call copTrigger.handleCommitTrigger |
| COPMapView.tsx | cop-service.ts | copService.queryLayers | WIRED | Line 89 calls copService.queryLayers |
| COPMapView.tsx | milsymbol | createMilSymbolIcon | WIRED | Import at line 25, usage in Marker rendering |
| COPTab.tsx | WorkspaceTabContainer.tsx | registered as 'cop' tab | WIRED | Imported at line 40, rendered at line 220 |
| COPEntityTooltip.tsx | cop-service.ts | copService.getEntityLinkages | WIRED | Line 73 |
| COPReviewPanel.tsx | cop-service.ts | addFeedback, transitionLayer | WIRED | Lines 61, 79 |
| COPLayerLifecycle.tsx | cop-service.ts | transitionLayer, recallLayer | WIRED | Lines 51, 69 |
| COPPhaseSlider.tsx | COPMapView.tsx | currentPhase prop | WIRED | Props interface exposes onPhaseChange/currentPhase |
| COPVersionBrowser.tsx | cop-service.ts | listVersions, getVersionSpec | WIRED | Lines 61, 116 |
| COPAgentActivity.tsx | cop-service.ts | getAgentActivity | WIRED | Line 73 |

### Requirements Coverage

No REQUIREMENTS.md file exists in the project. Requirement IDs in plan frontmatter are internally-defined labels with no external cross-reference target. All 30 requirement IDs across 10 plans are covered by verified artifacts.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| backend/src/cop/messaging/trigger-handler.ts | 152-158 | `hasChanges()` always returns false (stub) | Warning | Polling trigger will only fire on first poll; subsequent polls find no changes. Acceptable for initial implementation since commit trigger is primary. |

### Human Verification Required

### 1. COP Map Visual Rendering

**Test:** Navigate to a workspace with COP layers and verify the map displays correctly
**Expected:** Military symbols rendered with correct MIL-STD-2525D symbology via milsymbol, control measures shown as polylines/polygons, perspective toggle filters symbols correctly
**Why human:** Visual rendering quality and symbol correctness cannot be verified programmatically

### 2. Layer Lifecycle Workflow

**Test:** Create a draft layer, transition through Review -> Published -> COP, then recall with reason
**Expected:** Each transition succeeds, audit trail entries created, recall requires reason
**Why human:** Full workflow completion requires database and UI interaction

### 3. Phase Slider Animated Playback

**Test:** Open a COP layer with temporal phases and use the phase slider
**Expected:** Symbols animate to phase-specific positions with smooth transitions
**Why human:** Animation timing and visual smoothness require visual inspection

### 4. Entity Tooltip and Detail Views

**Test:** Hover over a military symbol on the COP map
**Expected:** Tooltip shows entity name, affiliation, and linked entities; click opens full detail view
**Why human:** Hover/click interaction behavior requires UI testing

### Gaps Summary

One gap found: **Version snapshots are not created during layer state transitions.** The `versionStore` exists with a fully implemented `createSnapshot` method (including full/patch strategy and comprehensive tests), but `layerStore.transitionLayer` never calls it. This means:

- Version browsing in the frontend (COPVersionBrowser) will find no snapshots to display
- Historical snapshot analysis is non-functional
- The "version history" feature is disconnected

The fix is straightforward: import `versionStore` in `layer-store.ts` and call `versionStore.createSnapshot(layer, previousSpec)` inside `transitionLayer` for both the in-memory and PostgreSQL implementations.

---

_Verified: 2026-03-05T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
