# Phase 38: Inheritance Deepening - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend Phase 26's downward-only strategic environment inheritance to full bidirectional flow. Four capabilities: (1) change notification UX for downward context updates, (2) override tracking via formalized modification requests and interpretation acknowledgment loops, (3) OPORD update propagation with AI-drafted FRAGOs, (4) real-time upward reporting of tactical COP/execution status to parent campaign COP and Assess tabs. No new planning methodologies or tab structures — this deepens existing inheritance plumbing.

</domain>

<decisions>
## Implementation Decisions

### Change Notification UX
- Persistent banner alert at top of inherited content areas (Understand tab) showing update count and source PS name
- Requires commander acknowledgment to dismiss — not silently closeable
- Two severity tiers: amber/warning for significant changes (new/removed docs), info-blue for minor changes (edits, graph updates) — maps to existing `changeSeverity` in `InheritanceChangelog`
- "View Changes" opens a changelog list (timestamps, severity badges, source PS name) — click item to jump to inherited document
- Tab badge count on Understand tab header visible from any tab; dot indicator on problem set selector for PSes with pending updates

### Override Tracking & Visibility
- Inherited context is READ-ONLY at child level — children cannot arbitrarily modify inherited strategic objectives
- Modification requests flow upward via extended RFI system — new `modification_request` RFI type added to existing `InheritanceRFI`
- Parent sees modification requests as special RFIs requiring action (approve/deny/discuss via threaded conversation)
- Child interpretations (existing `interpretation` annotation type) are upward-visible by default
- Interpretations require parent acknowledgment — parent must respond with one of three actions:
  - **Acknowledge** — interpretation is correct, no further action
  - **Clarify** — opens an RFI thread with additional guidance
  - **Correct** — flags interpretation as wrong, child must revise

### OPORD Update Propagation
- Parent OPORD changes trigger notification + AI-auto-drafted FRAGO to child missions
- AI detects OPORD delta, drafts FRAGO highlighting changes and implications for subordinate missions
- Parent commander reviews and approves/edits FRAGO before distribution to children
- Mission-relevant sections trigger propagation: Paragraph 2 (Mission), 3 (Execution), 4 (Sustainment) always propagate; Paragraph 1 (Situation) and 5 (C2) propagate only if marked significant
- Child commanders must acknowledge FRAGO and update planning accordingly
- Bottom-up guidance requests supported via `guidance_request` RFI type — child describes situation change, parent may issue FRAGO in response

### Upward Status Reporting
- Real-time streaming of tactical status to parent campaign (not periodic rollups)
- Default view: aggregated summary card per child mission (phase, % complete, key events, resource status, objective progress)
- Drill-down capability: parent can expand into full tactical detail for any child mission
- Status appears in both COP tab (real-time operational picture) and Assess tab (aggregated progress against campaign objectives)
- Graceful DDIL degradation: real-time when connected, automatic fallback to batched/queued updates when connectivity degrades, sync on reconnection — aligns with Phase 1 DDIL architecture

### Claude's Discretion
- Specific WebSocket/SSE implementation for real-time streaming
- FRAGO template format and AI prompt engineering
- Changelog list UI component design and styling
- Badge/banner animation and interaction details
- Batched update queue implementation for DDIL fallback
- Drill-down UI pattern for upward status (modal vs inline expand vs separate view)

</decisions>

<specifics>
## Specific Ideas

- Inherited context must be read-only at child level — this is a doctrinal constraint, not a UX preference
- FRAGOs are the doctrinally correct mechanism for OPORD changes (not silent rewrites)
- Interpretations flowing upward with required acknowledgment creates a formal feedback loop between echelons
- RFI system serves as the unified communication channel for all inter-echelon exchanges (questions, modification requests, guidance requests)
- Real-time streaming chosen over periodic rollups for operational awareness fidelity

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `InheritanceService` (backend/src/inheritance/inheritance-service.ts): Core inheritance chain creation, `onParentContextChanged` for cache invalidation and activity logging, `acknowledgeContext` for version-tracked acknowledgments
- `InheritanceStore` (backend/src/inheritance/inheritance-store.ts): DB operations for ancestors, descendants, changelog, annotations, acknowledgments
- `InheritanceAnnotation` type: Already has `visibility: 'upward' | 'local_only'` and `annotationType: 'inline' | 'interpretation'` — extend with `override` type
- `InheritanceRFI` type: Threaded RFI system between echelons — extend with `modification_request` and `guidance_request` subtypes
- `InheritanceChangelog`: Already classifies `changeSeverity` as `significant | minor` — maps directly to two-tier notification
- `problemSetActivityStore.log()`: Activity logging used for notifications in descendants
- Mission creation service (backend/src/mission-creation/): Orchestrates PS creation with inheritance chain, WARNO drafting — extend for FRAGO generation

### Established Patterns
- Activity log-based notification: Changes logged via `problemSetActivityStore`, descendants notified through activity entries
- Subscription + cache materialization: `problem_set_data_cache` stores inherited data with `stale_at` for invalidation
- Acknowledgment versioning: Acks track `sourceVersion` to detect what's new since last review
- Auto-approved inheritance subscriptions with `subscription_type = 'inheritance'`

### Integration Points
- Understand tab: Primary surface for change notification banners and inherited context display
- COP tab: Target for upward-reported mission status cards
- Assess tab: Target for aggregated mission progress against campaign objectives
- Problem set selector: Needs dot indicator for pending inheritance updates
- Tab header system: Needs badge count capability for notification indicators
- OPORD document model (Phase 33/35): Paragraph-level change detection needed for propagation rules

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 38-inheritance-deepening*
*Context gathered: 2026-03-08*
