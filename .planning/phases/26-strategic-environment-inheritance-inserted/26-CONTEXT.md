# Phase 26: Strategic Environment & Inheritance - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable strategic-level problem sets to serve as context providers, with inheritance mechanisms that propagate directives, policy, intelligence, and strategic guidance to subordinate operational and tactical problem sets. This includes auto-inheritance on creation, update propagation with notifications, context display in child problem sets, and annotation/override capabilities. Does NOT include new strategic document authoring tools, AI agent integration with inherited context, or DAO governance gates on inheritance.

</domain>

<decisions>
## Implementation Decisions

### Inheritance Model
- Auto-inherit from direct parent on problem set creation — no explicit subscription needed for parent-child relationships
- ALL strategic documents cascade down (directives, policy, intel summaries, guidance) — no filtering by document level
- Knowledge graph data (actors, relationships, tensions from Phase 25.3) also cascades alongside documents
- Full chain inheritance: tactical sees both operational parent AND strategic grandparent context, each labeled by source echelon
- Existing cross-workspace subscription system remains for non-parent relationships (e.g., cross-branch intel sharing)

### Update Propagation
- Hybrid timing: push invalidation (mark caches stale immediately when parent changes) with lazy data refresh on-open
- Tiered notifications: banner/toast for significant changes (new directives, policy shifts), badge indicator for minor updates (intel refreshes)
- Both changelog view AND highlight/mark new or changed items — chronological changelog listing changes plus visual indicators on updated items in the inherited context display
- Commander acknowledgment required: child PS commander must formally acknowledge updated strategic context, creating an audit trail. Unacknowledged updates show as pending

### Context Display
- Dedicated "Inherited Strategic Context" section at the top of the Understand tab, collapsible
- Echelon color coding (e.g., strategic = gold, operational = blue, tactical = green) on inherited item borders/badges PLUS source labels (e.g., "From: INDOPACOM (Strategic)")
- Summary cards for each inherited document/graph item: title, source, last updated, brief summary. Click to expand full content
- Context dashboard widget at top of inherited section showing: connected ancestors, sync status, pending acknowledgments, last update time

### Context Override & Annotations
- Both inline annotations (quick sticky-note style comments on inherited items) AND full interpretation documents ("Commander's Interpretation" per inherited item)
- Annotations are local to the child problem set and do NOT modify the source
- Upward visibility by default: parent/higher echelon can view subordinate annotations and interpretations, but child can mark specific annotations as "local only"
- When inherited context is updated at parent, existing annotations are preserved but flagged as "based on previous version" — user reviews and updates or dismisses
- Request for Information (RFI): child can send a "Request Clarification" on inherited items, which notifies the parent PS and creates a thread between echelons

### Claude's Discretion
- Exact echelon color palette choices
- Dashboard widget layout and information density
- How to categorize changes as "significant" vs "minor" for tiered notifications
- RFI thread UI implementation details
- Cache invalidation performance optimization approach

</decisions>

<specifics>
## Specific Ideas

- Notifications should mirror military doctrine where subordinates always receive higher HQ directives — auto-inherit matches "receipt of orders" pattern
- RFI mechanism mirrors real military Request for Information workflows between echelons
- Commander acknowledgment mirrors military "receipt and acknowledgment" of orders/directives
- Full chain visibility ensures battalion-level staff see both division AND corps guidance, just as in real operational planning

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProblemSetSubscriptionStore` (backend/src/problem-set/problem-set-subscription-store.ts): Full pub/sub system with approval flows, cache materialization, version hashing, and stale_at pattern. Can be extended for auto-inheritance
- `StrategicContextPreview` component + `strategic-context-service.ts`: Frontend service for fetching and displaying strategic context previews — can be adapted for inherited context display
- `problem_set_data_cache` table: Already caches publisher data for subscribers with version tracking and stale_at column
- `EscalationPanel` component: Existing escalation UI between parent/child problem sets — pattern for RFI threads

### Established Patterns
- `parentProblemSetId` field on ProblemSet type with echelon hierarchy validation (strategic > operational > tactical) — inheritance chain already modeled
- `validateEchelonHierarchy()` enforces parent-child echelon rules — inheritance follows the same hierarchy
- Subscription approval flow (manual/auto/agent) — auto-inheritance would use 'auto' approval mechanism
- `materializeCache()` and `refreshCacheForPublisher()` — existing cache refresh pattern to extend for inheritance

### Integration Points
- `CreateProblemSetWizard`: Where auto-inheritance subscription would be created on problem set creation
- `UnderstandTab`: Where inherited context section and dashboard widget would be rendered
- `CommanderPanel`: Where acknowledgment actions would be surfaced
- `problem_set_subscriptions` table: Auto-create subscription row when child PS is created with parent

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-strategic-environment-inheritance-inserted*
*Context gathered: 2026-03-06*
