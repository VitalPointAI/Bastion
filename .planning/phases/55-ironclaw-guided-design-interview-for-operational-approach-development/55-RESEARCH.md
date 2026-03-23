# Phase 55: Ironclaw Guided Design Interview - Research

**Researched:** 2026-03-23
**Domain:** LangGraph StateGraph / Conversational AI / Operational Design / Ironclaw Skills
**Confidence:** HIGH (all findings verified against actual codebase; no speculative claims)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Interview Trigger**
- Both proactive and manual triggers
- Proactive: Ironclaw suggestion card when Design tab opens with empty/incomplete sections
- Manual: "Guide Me" button always available in each Design section
- Handles new designs (full walkthrough) and revision mode (reviews existing, focuses on gaps)

**Interview Flow & Structure**
- Sequential doctrinal order: Problem Framing → CoG Analysis → LOEs → Operational Approach
- Cross-referencing earlier answers when probing later sections
- LangGraph StateGraph with PostgreSQL checkpointing (interrupt-resume, same pattern as ScopingInterview)
- Conversation in Ironclaw drawer; Design tab sections update in real-time

**Doctrinal Questioning Style**
- Challenge-then-recommend: probe assumptions BEFORE offering recommendations
- Red team / devil's advocate probing after each answer
- Adaptive depth using doctrinal coverage criteria (CoG: CG + >=2 CCs + CRs per CC + CVs identified)
- Proactive suggestions at high confidence (existing confidence bounds pattern)

**Knowledge Graph Integration**
- Reference brain/KG data when available; graceful degradation if absent
- Gap detection: if KG data is missing, launch background research agent
- Interview continues while research runs; results incorporated into subsequent questions
- Findings also ingested into KG

**Output & Artifact Generation**
- Direct population of Design tab fields in real-time
- Review gate after each section (summary → confirm/revise)
- CoG tree built node-by-node (CG → CC → CR → CV)
- After all sections: Ironclaw drafts operational approach narrative for review

**Prerequisites & Entry Conditions**
- ScopingInterview (problem set context) is a required prerequisite
- If incomplete: Ironclaw can redirect or incorporate scoping into opening discussion
- Revision mode: review existing design, identify weak areas, focus on gaps

**Multi-User Collaborative Interview**
- Multiple simultaneous users via Yjs collaborative infrastructure
- Role-directed questioning: J2 for intel, J3 for ops concepts, J5 for planning
- Role direction is guidance, not strict gating

**Ironclaw Skills (4 new)**
- **Overlay Producer**: SVG overlays on Leaflet/COP map (COPMapView/COASketchMap pattern)
- **Resource Allocator**: Query Resource Registry (Phase 27), map forces to phases, surface shortfalls
- **Campaign Plan Visualizer**: One-page placemat SVG + markdown image specs for image AI
- **Risk Visualizer**: Risk matrix / timeline / heatmap with mitigations and residual risk

### Claude's Discretion
- Exact LangGraph graph topology and state schema design
- Doctrinal coverage criteria thresholds per section
- Research agent selection and query formulation for KG gap-filling
- Confidence threshold for proactive suggestions
- Yjs document schema for collaborative interview state
- Lock/notification behavior when multiple users edit simultaneously
- Exact timing of Design tab field population (per-answer vs per-section-completion)
- Interview progress indicator design
- SVG overlay rendering approach (D3-generated vs template-based vs LLM-generated SVG)
- Campaign placemat layout and information density
- Markdown image spec format for image AI generation
- Resource allocator query strategy and shortfall threshold definitions

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 55 builds a LangGraph-powered guided design interview that runs inside the existing IronclawDrawer and populates the four Design tab sections (ProblemFraming, CoGAnalysis, LOETimeline, OperationalApproach) in real-time. The core technical pattern is already proven in the codebase: `interview-service.ts` implements the identical LangGraph StateGraph + PostgreSQL checkpointer pattern with interrupt-resume. This phase extends that pattern to a richer domain (operational design vs. problem scoping) with additional complexity: doctrinal coverage criteria, red-team prompting, cross-section referencing, real-time field population via the existing `useIronclawContext`, and multi-user Yjs sync.

The four new Ironclaw skills (overlay-producer, resource-allocator, campaign-visualizer, risk-visualizer) follow the existing skill .md + handler registry pattern exactly. They are registered in `backend/src/skills/design/` (new category directory) with `.md` frontmatter defining inputSchema, outputSchema, and systemPromptFragment, plus corresponding TypeScript execution functions in a `design-skills.ts` file registered via `initializeBuiltinHandlers()`.

**Primary recommendation:** Model the design interview service closely on `interview-service.ts` — reuse the StateGraph/checkpointer/interrupt-resume pattern, extend `InterviewStateAnnotation` to carry `currentSection` + `sectionCoverage` + `derivedDesign`, and wire field population through a new `bastion.design.update_section` MCP tool registered in `tool-bridge.ts`.

---

## Standard Stack

### Core (already in project — no new installs needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@langchain/langgraph` | ^1.1.0 | StateGraph, Annotation, interrupt-resume | Already used by interview-service.ts |
| `@langchain/langgraph-checkpoint-postgres` | ^1.0.0 | PostgresSaver checkpointing | Already used; `getCheckpointer()` from orchestration/checkpointer.ts |
| `@langchain/core` | ^1.1.15 | AIMessage, HumanMessage, SystemMessage | Already installed |
| `@langchain/anthropic` | ^1.3.10 | LLM for agent (createLLMForAgent) | Already configured |
| `yjs` | (existing) | Collaborative interview state | Already in yjs-hooks.ts |
| `y-websocket` | (existing) | WebSocket provider for Yjs | Already in yjs-hooks.ts |
| `react-leaflet` / `leaflet` | (existing) | Map rendering for overlay producer | Already in COPMapView/COASketchMap |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `d3` | (existing) | SVG generation for overlays/visualizations | Overlay producer, campaign placemat, risk visualizer — follows CoGTree/EffectChainDiagram pattern |
| `milsymbol` | (existing) | MIL-STD-2525 symbology for overlays | Overlay producer — already used in COASketchMap |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LangGraph StateGraph | Custom FSM | LangGraph already proven in this codebase; provides free checkpointing + interrupt/resume |
| D3 SVG generation | Template string SVG | D3 already used for CoG trees; template strings fine for simple shapes but D3 better for dynamic positioning |
| Per-answer field population | Per-section-completion only | Per-section is simpler but loses real-time feedback; decided in Claude's Discretion |

**Installation:** No new packages required. All dependencies are already in `backend/package.json` and `frontend/package.json`.

---

## Architecture Patterns

### Recommended Project Structure

```
backend/src/
├── design-interview/
│   ├── design-interview-service.ts    # LangGraph StateGraph (mirrors interview-service.ts)
│   ├── design-interview-prompts.ts    # System prompts per section + coverage criteria
│   ├── design-interview-store.ts      # PostgreSQL persistence for interview progress
│   └── design-interview-types.ts     # DesignInterviewState, SectionCoverage types
├── skills/
│   └── design/                        # New skill category
│       ├── overlay-producer.md
│       ├── resource-allocator.md
│       ├── campaign-visualizer.md
│       └── risk-visualizer.md
├── skills/design-skills.ts            # TypeScript handlers for all 4 skills

frontend/src/
├── components/design/
│   ├── DesignInterviewProgress.tsx    # Section progress indicator
│   └── DesignInterviewGate.tsx       # Per-section review gate UI
├── hooks/
│   └── useDesignInterview.ts          # Interview state management + real-time field sync
```

### Pattern 1: LangGraph StateGraph (Design Interview)

**What:** Extend the proven `InterviewStateAnnotation` pattern from `interview-service.ts` to carry design-specific state. The graph topology is more complex because it handles 4 sequential sections with section-level completion gates.

**When to use:** This is the only option — locked decision.

**State annotation design:**
```typescript
// Source: mirrors backend/src/doc-intelligence/interview/interview-service.ts
const DesignInterviewStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,

  /** Current section being interviewed */
  currentSection: Annotation<'problem-framing' | 'cog-analysis' | 'loes' | 'operational-approach'>({
    reducer: (_prev, next) => next,
    default: () => 'problem-framing',
  }),

  /** Coverage tracking per section using doctrinal criteria */
  sectionCoverage: Annotation<Record<string, SectionCoverage>>({
    reducer: (_prev, next) => next,
    default: () => ({
      'problem-framing': { met: false, criteria: [] },
      'cog-analysis': { met: false, criteria: [] },
      'loes': { met: false, criteria: [] },
      'operational-approach': { met: false, criteria: [] },
    }),
  }),

  /** Partially derived design data accumulated across interview */
  derivedDesign: Annotation<Partial<OperationalDesign>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),

  /** Interview mode: new design or revision of existing */
  interviewMode: Annotation<'new' | 'revision'>({
    reducer: (_prev, next) => next,
    default: () => 'new',
  }),

  /** Whether the review gate for current section is active */
  awaitingSectionConfirm: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),

  problemSetId: Annotation<string>({ reducer: (_prev, next) => next, default: () => '' }),
  questionsAsked: Annotation<number>({ reducer: (_prev, next) => next, default: () => 0 }),
  isComplete: Annotation<boolean>({ reducer: (_prev, next) => next, default: () => false }),
  phase: Annotation<'start' | 'continue'>({ reducer: (_prev, next) => next, default: () => 'start' }),
});
```

**Graph topology:**
```typescript
// Route entry point
.addConditionalEdges('__start__', routeEntry, {
  ask_question: 'ask_question',
  process_answer: 'process_answer',
})
// Main loop
.addEdge('ask_question', '__end__')   // Wait for user input
.addEdge('process_answer', 'check_section_coverage')
.addConditionalEdges('check_section_coverage', routeAfterCoverage, {
  ask_question: 'ask_question',           // Keep probing
  section_review_gate: 'section_review_gate',  // Show review summary
  advance_section: 'advance_section',     // Move to next section
  synthesize_narrative: 'synthesize_narrative', // Final synthesis
})
.addEdge('section_review_gate', '__end__')  // Wait for user confirm/revise
.addEdge('advance_section', 'ask_question')
.addEdge('synthesize_narrative', '__end__')
```

### Pattern 2: Doctrinal Coverage Criteria (per section)

**What:** Each section has explicit coverage criteria that the LLM evaluates to determine when questioning is sufficient. Mirrors `getUncoveredCategories()` from `interview-prompts.ts`.

**Coverage criteria per section:**
```typescript
// Source: JP 5-0 doctrine, Strange's CG-CC-CR-CV framework
export const SECTION_COVERAGE_CRITERIA = {
  'problem-framing': [
    'current_state',
    'desired_end_state',
    'problem_statement',
    'key_tensions',  // at least 1
    'obstacles',     // at least 1
  ],
  'cog-analysis': [
    'adversary_cog',           // 1 CG
    'adversary_ccs',           // >=2 critical capabilities
    'adversary_crs_per_cc',    // CRs for each CC
    'adversary_cvs',           // >=1 CV
    'friendly_cog',            // 1 CG
  ],
  'loes': [
    'loe_names',               // >=2 LOEs
    'loe_decisive_points',     // >=1 DP per LOE
    'loe_cog_links',           // >=1 CoG link across all LOEs
  ],
  'operational-approach': [
    'phases',                  // >=2 phases
    'transitions',             // transition conditions between phases
    'decision_points',         // >=1 decision point
  ],
} as const;
```

### Pattern 3: Real-Time Field Population via MCP Tool

**What:** When Ironclaw captures data for a Design section, it calls a new `bastion.design.update_section` MCP tool. This routes through the action pipeline (medium risk, requires user confirmation per existing pipeline) and calls `designStore.updateSection()`. The frontend receives the update via WebSocket and calls the section's `onUpdate` callback.

**New MCP tool to register in `tool-bridge.ts`:**
```typescript
// Source: pattern from BASTION_TOOLS in tool-bridge.ts
{
  name: 'bastion.design.update_section',
  description: 'Update a specific section of the operational design from interview output',
  inputSchema: {
    type: 'object',
    properties: {
      problem_set_id: { type: 'string' },
      section: { type: 'string', enum: ['problem-framing', 'cog-analysis', 'lines-of-effort', 'operational-approach'] },
      data: { type: 'object' },
      partial: { type: 'boolean', description: 'True for per-answer updates, false for full section replacement' },
    },
    required: ['problem_set_id', 'section', 'data'],
  },
  riskLevel: 'medium',
},
```

**New action risk entry in `ironclaw-types.ts`:**
```typescript
'design.update_section': ActionRiskLevel.medium,
```

### Pattern 4: New Ironclaw Skill Registration

**What:** The 4 new skills follow the exact `.md frontmatter + handler` pattern from `backend/src/skills/tactical/`. They go in a new `design/` category subdirectory. Handlers are TypeScript functions registered in `initializeBuiltinHandlers()`.

**Skill .md structure (example — overlay-producer.md):**
```yaml
---
skillId: design-overlay-producer
name: overlay_producer
description: Generate SVG overlays depicting the operational approach on the area of operations map. Renders phases, axes of advance, LOEs mapped to geography, decisive points, and boundaries.
version: 1.0.0
category: design
tags: [visualization, map, overlay, operational-approach, svg]
inputSchema:
  type: object
  properties:
    problem_set_id:
      type: string
    operational_approach:
      type: object
      description: OperationalApproach data from design tab
    loes:
      type: array
      description: Lines of effort with decisive points
    ao_bounds:
      type: object
      description: Area of operations bounding box {southwest, northeast}
  required: [problem_set_id, operational_approach, loes]
outputSchema:
  type: object
  properties:
    svg:
      type: string
      description: SVG string for rendering on Leaflet map
    layers:
      type: array
      description: Array of named overlay layers
systemPromptFragment: |
  You can produce map overlays using overlay_producer.
  This generates SVG overlays showing the operational approach on the AO map.
  Use this after the design interview to visualize phases, axes of advance,
  LOEs mapped to geography, decisive points, and boundaries.
handler: design/overlayProducer
---
```

**Handler registration in `skill-handler-registry.ts`:**
```typescript
// In initializeBuiltinHandlers():
const designTools = createDesignTools();
for (const tool of designTools) {
  const handlerId = designToolHandlerMap[tool.name];
  if (handlerId) {
    registerHandler(handlerId, async (args) => {
      const result = await tool.invoke(args);
      return typeof result === 'string' ? result : JSON.stringify(result);
    });
  }
}

const designToolHandlerMap: Record<string, string> = {
  'overlay_producer': 'design/overlayProducer',
  'resource_allocator': 'design/resourceAllocator',
  'campaign_visualizer': 'design/campaignVisualizer',
  'risk_visualizer': 'design/riskVisualizer',
};
```

### Pattern 5: Collaborative Interview via Yjs

**What:** The interview state is synced across participants via a Yjs document on the `/ws/collab` WebSocket endpoint. The existing `useYjsDocument` hook provides `getMap()` for shared state.

**Yjs document schema for the interview:**
```typescript
// Source: useYjsDocument in frontend/src/lib/yjs-hooks.ts
const interviewDoc = useYjsDocument({
  documentId: `design-interview-${problemSetId}`,
  planId: problemSetId,
  user: { did, name, role: userRole, color: '#...' },
});

// Yjs shared state
const sharedState = interviewDoc.getMap<unknown>('interviewState');
// Keys: currentSection, sectionCoverage, pendingQuestion, lastSectionSummary
// Role awareness: participantRoles map (did -> role) for role-directed questioning
const participantRoles = interviewDoc.getMap<string>('participantRoles');
```

### Pattern 6: Proactive Suggestion Card

**What:** When the user opens the Design tab with empty/incomplete sections, Ironclaw publishes a suggestion card via the existing `SuggestionPayload` WebSocket message. The frontend `IronclawSuggestion.tsx` renders it.

**Trigger detection in `ironclaw-service.ts`:**
- The existing `handleMessage` function receives `messageContext.currentTab`
- When `currentTab === 'design'` and design sections are empty, publish a suggestion
- Reuse existing `SuggestionPayload` type from `ironclaw-types.ts`

### Anti-Patterns to Avoid
- **Don't create a separate WebSocket channel for the design interview**: use the existing `ironclaw.{problemSetId}` channel — interview events are just new message types
- **Don't block the interview on KG gap research**: background research is async; interview continues and incorporates results when they arrive
- **Don't reinvent checkpointing**: use the existing `getCheckpointer()` with a new thread_id prefix (`design-interview-{problemSetId}`)
- **Don't write directly to `operational_designs` table from the graph**: route through the action pipeline (`bastion.design.update_section`) so updates get audit trail and trust confirmation
- **Don't add Yjs for non-collaborative interviews**: Yjs is optional; single-user interviews use only the existing WebSocket pattern

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State persistence across page refresh | Custom DB table for interview state | `getCheckpointer()` → `PostgresSaver` | Already handles serialization, thread_id scoping, and resume — used by ScopingInterview |
| LLM conversation loop | Manual message array management | LangGraph StateGraph | Provides interrupt/resume, conditional edges, and state reducer pattern — tested in production |
| Real-time field updates to frontend | Polling or new WebSocket connection | Existing `ironclaw.{problemSetId}` channel + `publishToChannel()` | Already wired to all Design tab consumers |
| Multi-user cursors and awareness | Custom presence protocol | `useYjsDocument` + `y-websocket` | Already deployed on `/ws/collab` with user presence map |
| SVG map overlays | Leaflet L.Polygon/L.Polyline directly | Leaflet + SVG overlay with D3 geometry | COASketchMap already renders mil symbols on Leaflet; overlay uses same `L.svgOverlay` pattern |
| Skill file commit to source control | Manual git operations | `githubService.commitFileToMaster()` in `registerRuntimeSkill()` | Already wired in skill-handler-registry.ts |
| Resource availability lookup | Query `resources` table directly | `ResourceRegistry.queryByCapability()` | Singleton with DID index and capability index; already initialized at startup |

---

## Common Pitfalls

### Pitfall 1: Interview Thread ID Collision with ScopingInterview
**What goes wrong:** Both `interview-service.ts` and the new `design-interview-service.ts` use `interview-${problemSetId}` as the LangGraph `thread_id`. The PostgresSaver stores state by thread_id — collision would corrupt both interviews.
**Why it happens:** Copying the pattern without changing the thread_id prefix.
**How to avoid:** Use `design-interview-${problemSetId}` as the thread_id. Each interview graph should have a unique prefix.
**Warning signs:** Resume fails with "wrong number of questions" or state from the scoping interview bleeds into design interview.

### Pitfall 2: Anthropic System Message Ordering
**What goes wrong:** LangChain's Anthropic adapter throws if there are multiple SystemMessages or if a SystemMessage is not the first message. This is a known issue documented in `interview-service.ts` with the `m.type !== 'system'` filter.
**Why it happens:** After checkpoint deserialization, message class identity is lost — `instanceof SystemMessage` returns false. The fix in interview-service.ts uses `.type !== 'system'` instead.
**How to avoid:** Copy the exact filter pattern from `interview-service.ts` lines 162-164 and 437-439. Always filter system messages before passing conversation history to the LLM.
**Warning signs:** `Error: system message must be first` from the Anthropic SDK.

### Pitfall 3: Yjs Document ID Reuse Across Interview Types
**What goes wrong:** If the design interview Yjs documentId is the same as a COA sketch document, state from COA sketches would bleed into interview awareness.
**Why it happens:** Using `problemSetId` alone as the documentId.
**How to avoid:** Use `design-interview-${problemSetId}` as the Yjs `documentId` (same prefix convention as the LangGraph thread_id).

### Pitfall 4: Real-Time Field Population Race Condition
**What goes wrong:** If the interview updates a Design tab section while the user is actively editing it, the user's in-progress edits get overwritten. The 2-second debounce `scheduleAutoSave` in `CoGAnalysisSection.tsx` means there's a window where unsaved user edits exist in component state.
**Why it happens:** Interview `onUpdate` callback fires and replaces section state.
**How to avoid:** Implement interview-sourced updates as merge-not-replace when user edits are detected (check if user has focus on any input in the section before applying). Use a `dirty` flag in the section's local state to detect unsaved edits.

### Pitfall 5: Background Research Agent Blocking Interview Progression
**What goes wrong:** If the background research dispatch is awaited or throws an exception that bubbles up, it halts the interview graph.
**Why it happens:** `await researchAgent.dispatch()` inside a graph node.
**How to avoid:** Fire-and-forget the research dispatch inside a `try/catch` with a non-blocking pattern — identical to how `ironclawService.handleMessage()` dispatches specialist work (`.catch(err => console.error(...))`). The graph node returns immediately; research results arrive via a separate WebSocket event.

### Pitfall 6: CoG Tree Node-by-Node Updates via MCP Tool
**What goes wrong:** Each CoG node addition calls `bastion.design.update_section` with `partial: true`. The action pipeline may prompt for confirmation on each update, creating 20+ confirm dialogs for a full CoG tree.
**Why it happens:** Action risk is `medium` → inline confirm required (based on trust preference).
**How to avoid:** Either (a) mark CoG interview-sourced updates with a special flag that the pipeline auto-approves when the interview session is active, or (b) batch CoG updates at section boundary rather than per-node. Option (b) is simpler: accumulate CoG tree in `derivedDesign` state and only push at section review gate.

### Pitfall 7: Skill Handler Missing from `initializeBuiltinHandlers()`
**What goes wrong:** Skill `.md` files are written and registered in DB, but `initializeBuiltinHandlers()` is never updated with the new `createDesignTools()` call. Skills fall back to `executeDynamicSkill()` which works but is much slower.
**Why it happens:** `initializeBuiltinHandlers()` requires a manual addition for each new tool category.
**How to avoid:** Add the `createDesignTools()` registration block to `initializeBuiltinHandlers()` in `skill-handler-registry.ts` as part of the same plan that creates the skill .md files.

---

## Code Examples

Verified patterns from codebase:

### Starting the Interview Graph (mirrors interview-service.ts)
```typescript
// Source: backend/src/doc-intelligence/interview/interview-service.ts lines 316-341
async startDesignInterview(problemSetId: string): Promise<{ message: AIMessage; state: DesignInterviewMeta }> {
  const graph = await getDesignInterviewGraph();
  const config = { configurable: { thread_id: `design-interview-${problemSetId}` } };
  const result = await graph.invoke(
    { messages: [], questionsAsked: 0, derivedDesign: {}, isComplete: false, problemSetId, phase: 'start' as const },
    config
  );
  const lastMessage = result.messages[result.messages.length - 1];
  return { message: lastMessage as AIMessage, state: extractDesignInterviewMeta(result) };
}
```

### Filtering System Messages (critical — Anthropic adapter requirement)
```typescript
// Source: backend/src/doc-intelligence/interview/interview-service.ts lines 162-164
const conversationMessages = state.messages.filter(
  (m) => m.type !== 'system' && !(m instanceof SystemMessage)
);
```

### Publishing WebSocket Event for Real-Time Field Update
```typescript
// Source: backend/src/ironclaw/ironclaw-service.ts lines 83-100
await bus.publish({
  sourceDid: SERVICE_DID,
  sourceType: 'system',
  destinationType: 'channel',
  destinationTarget: `ironclaw.${problemSetId}`,
  messageType: 'design.section_updated',
  payload: { section: 'cog-analysis', data: updatedCoGAnalysis, source: 'interview' },
});
```

### Querying Resource Registry for Resource Allocator Skill
```typescript
// Source: backend/src/resources/resource-registry.ts pattern
const registry = getResourceRegistry();
await registry.ensureInitialized();
const available = await registry.queryByCapability(capability);
const forcesByPhase = mapResourcesToPhases(available, operationalApproach.phases);
```

### Yjs Collaborative Interview State
```typescript
// Source: frontend/src/lib/yjs-hooks.ts (useYjsDocument pattern)
const { getMap, doc } = useYjsDocument({
  documentId: `design-interview-${problemSetId}`,
  planId: problemSetId,
  user: { did: userDid, name: userName, role: userRole, color: '#3B82F6' },
});
const interviewState = getMap<unknown>('interviewState');
const participantRoles = getMap<string>('participantRoles');
```

### Registering New Ironclaw Suggestion Card
```typescript
// Source: backend/src/ironclaw/ironclaw-service.ts (SuggestionPayload pattern)
// When Design tab opens with incomplete sections:
await publishToChannel(problemSetId, 'suggestion', {
  id: randomUUID(),
  type: 'guide_me',
  title: 'Develop Operational Approach',
  description: 'I can walk you through operational design step by step. Want to start?',
  actions: [
    { label: 'Start Interview', value: 'start_design_interview' },
    { label: 'Dismiss', value: 'dismiss' },
  ],
} satisfies SuggestionPayload);
```

### New Skill .md Frontmatter Pattern (campaign-visualizer.md)
```yaml
---
skillId: design-campaign-visualizer
name: campaign_visualizer
description: Generate a comprehensive "placemat" visual of the entire operational plan including CoGs, LOEs, objectives, problem framing, phases, transitions, and decision points.
version: 1.0.0
category: design
tags: [visualization, campaign, placemat, briefing, svg]
inputSchema:
  type: object
  properties:
    problem_set_id:
      type: string
    design:
      type: object
      description: Complete OperationalDesign object
    output_format:
      type: string
      enum: [svg, markdown_spec, both]
      default: both
  required: [problem_set_id, design]
outputSchema:
  type: object
  properties:
    svg:
      type: string
    markdown_spec:
      type: string
      description: Detailed markdown image spec for image AI generation
systemPromptFragment: |
  You can create campaign overview placemat visuals using campaign_visualizer.
  This generates a one-page briefing chart showing CoGs, LOEs, phases, and
  decision points. Use after the design interview is complete.
  Output includes both SVG for in-app rendering and markdown image specs
  for polished image AI generation.
handler: design/campaignVisualizer
---
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual form-filling for Design sections | Conversational interview populating fields | Phase 55 (this phase) | Reduces cognitive load; enforces doctrinal completeness |
| Static Design tab sections | Real-time interview-driven population | Phase 55 | Design and interview are unified |
| Static skills (no design domain) | 4 new design skills: overlay, resource, campaign, risk | Phase 55 | Closes gap between planning artifacts and visual/resource outputs |
| Design standalone, no direct KG grounding | KG-grounded interview + background gap filling | Phase 55 | Interview improves KG as a side effect |

**Deprecated/outdated:**
- Manually sending `sendMessage("Analyze: " + JSON.stringify(cogAnalysis))` (current pattern in CoGAnalysisSection.tsx and OperationalApproachSection.tsx) — replaced by the structured interview flow. The existing buttons remain as fallback.

---

## Integration Map

### New Files to Create
```
backend/src/
  design-interview/
    design-interview-service.ts   # LangGraph graph — mirrors interview-service.ts
    design-interview-prompts.ts   # Section prompts + doctrinal coverage criteria
    design-interview-store.ts     # Resume state, section confirmation tracking
  skills/design/
    overlay-producer.md
    resource-allocator.md
    campaign-visualizer.md
    risk-visualizer.md
  skills/
    design-skills.ts              # createDesignTools() LangChain DynamicStructuredTools

backend/src/api/
  design-interview.ts             # REST routes: /api/design-interview/:problemSetId/*

frontend/src/
  hooks/
    useDesignInterview.ts         # Interview state + field population orchestration
  components/design/
    DesignInterviewProgress.tsx   # Section progress bar (4 sections, doctrinal criteria)
    DesignInterviewGate.tsx       # Per-section review gate: show summary, confirm/revise
```

### Existing Files to Modify
```
backend/src/
  skills/skill-handler-registry.ts  # Add createDesignTools() to initializeBuiltinHandlers()
  ironclaw/tool-bridge.ts           # Add bastion.design.update_section MCP tool
  ironclaw/ironclaw-types.ts        # Add 'design.update_section' risk level
  ironclaw/builder-handlers.ts      # Add handler for design.update_section action
  index.ts                          # Mount design-interview router

frontend/src/components/design/
  CoGAnalysisSection.tsx            # Add "Guide Me" button wired to interview trigger
  ProblemFramingSection.tsx         # Add "Guide Me" button
  LOETimelineSection.tsx            # Add "Guide Me" button
  OperationalApproachSection.tsx    # Add "Guide Me" button + interview narrative injection
```

### Prerequisite Check Pattern
```typescript
// In design-interview-service.ts startInterview():
const scopingContext = await getProblemSetContext(problemSetId);
if (!scopingContext) {
  return {
    blocked: true,
    message: 'Complete problem scoping first before starting the design interview. '
      + 'I can help with that — or I can incorporate scoping into the beginning of our discussion.',
  };
}
```

---

## Open Questions

1. **Background research agent selection**
   - What we know: The doc-intelligence orchestrator has specialist agents; `ironclawService.handleMessage()` dispatches to specialists
   - What's unclear: Which specific agent/specialist should handle mid-interview KG gap research — the researcher specialist from `specialists/researcher.ts` or a new dispatch to the doc-intelligence pipeline?
   - Recommendation: Use `specialists/researcher.ts` as the entry point; fire-and-forget via the existing doc-intelligence orchestrator; results publish to `ironclaw.{problemSetId}` channel as a new `kg.research_complete` message type

2. **Per-answer vs per-section field population timing**
   - What we know: Claude's Discretion; both approaches are technically feasible
   - What's unclear: User experience preference — immediate field population per answer feels more alive but risks confusion if Ironclaw later revises earlier answers during red-team probing
   - Recommendation: Per-section at the review gate confirmation is safer and cleaner UX; per-answer as real-time "preview" with visual distinction (e.g., italicized/greyed) before section confirmation

3. **Confidence threshold for proactive suggestions**
   - What we know: The pattern in problem-framing.ts uses 0-1 confidence with lower/upper bounds
   - What's unclear: What threshold triggers unsolicited proactive suggestions during the interview (vs. only on explicit request)
   - Recommendation: Use lower_bound > 0.75 for proactive; exact value is Claude's Discretion per CONTEXT.md

---

## Validation Architecture

Config does not specify `workflow.nyquist_validation: false`, so this section is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend) / node --test or jest (backend — check backend/package.json) |
| Config file | Check for vitest.config.ts in frontend/ |
| Quick run command | `cd backend && npm test -- --testPathPattern=design-interview` |
| Full suite command | `cd backend && npm test` |

### Phase Requirements → Test Map
| Behavior | Test Type | Notes |
|----------|-----------|-------|
| Design interview starts, first question returned | unit | Test `startDesignInterview()` returns AIMessage |
| Interview resumes from checkpoint after page refresh | unit | Test `getDesignInterviewState()` returns non-null after start |
| Coverage criteria evaluated correctly per section | unit | Test `getSectionCoverage()` with mock derivedDesign |
| Thread ID collision prevention (design vs scoping) | unit | Assert thread_id prefix is `design-interview-` not `interview-` |
| System message filter prevents Anthropic SDK error | unit | Mock LLM, assert no SystemMessage in messages array passed to invoke |
| `bastion.design.update_section` MCP tool registered | unit | Assert tool in BASTION_TOOLS |
| Skill .md files parseable by skill-loader | unit | Parse each design skill .md, assert required fields present |
| Overlay producer returns valid SVG string | unit | Call handler with mock operational approach, assert output contains `<svg` |
| Resource allocator queries registry without throwing | integration | Requires DB — skip in unit |

### Wave 0 Gaps
- [ ] `backend/src/design-interview/design-interview-service.test.ts` — unit tests for graph nodes
- [ ] `backend/src/skills/design-skills.test.ts` — handler output validation

---

## Sources

### Primary (HIGH confidence — verified in codebase)
- `backend/src/doc-intelligence/interview/interview-service.ts` — LangGraph StateGraph pattern (Annotation, StateGraph, MessagesAnnotation, interrupt-resume, PostgresSaver)
- `backend/src/doc-intelligence/interview/interview-prompts.ts` — Prompt structure, coverage tracking pattern
- `backend/src/skills/skill-handler-registry.ts` — Skill registration, dynamic handler fallback, `registerRuntimeSkill()` pattern
- `backend/src/skills/tactical/assess-threat.md` — Canonical skill .md frontmatter format
- `backend/src/ironclaw/tool-bridge.ts` — BASTION_TOOLS list, MCP tool registration pattern
- `backend/src/ironclaw/ironclaw-types.ts` — ACTION_RISK map, `TrustDecision`, `SuggestionPayload`
- `backend/src/ironclaw/ironclaw-service.ts` — `publishToChannel()`, `handleMessage()`, `MessageContext`
- `backend/src/design/types.ts` — `OperationalDesign`, `CoGNode`, `CoGTree`, `ProblemFramingData`, `LineOfEffort`
- `backend/src/design/design-store.ts` — `operational_designs` table schema, `updateSection()` pattern
- `backend/src/orchestration/checkpointer.ts` — `getCheckpointer()`, `PostgresSaver`, `langgraph_checkpoints` schema
- `backend/src/resources/resource-registry.ts` — `ResourceRegistry`, `queryByCapability()`
- `frontend/src/lib/yjs-hooks.ts` — `useYjsDocument`, Yjs+y-websocket integration
- `frontend/src/components/ironclaw/IronclawDrawer.tsx` — Drawer props, suggestion/task panel patterns
- `frontend/src/hooks/useIronclaw.ts` — WebSocket hook, `sendMessage`, `MessageContext`
- `backend/package.json` — `@langchain/langgraph ^1.1.0`, `@langchain/langgraph-checkpoint-postgres ^1.0.0`

### Secondary (MEDIUM confidence)
- JP 5-0 (Joint Planning doctrine) — referenced in codebase comments and type names; doctrinal coverage criteria are interpretive
- Strange's CG-CC-CR-CV framework — referenced in `CoGAnalysisSection.tsx` comment ("Strange's CG-CC-CR-CV Framework")

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in backend/package.json; no speculative additions
- Architecture: HIGH — all patterns verified against actual source files; graph topology design is Claude's Discretion per CONTEXT.md
- Pitfalls: HIGH — each pitfall derived from actual code patterns observed (system message filter, debounce, thread_id prefix, etc.)
- Skill integration: HIGH — skill .md format and handler registration pattern fully documented in codebase

**Research date:** 2026-03-23
**Valid until:** 2026-06-23 (stable stack — LangGraph/LangChain APIs unlikely to break within 90 days)
