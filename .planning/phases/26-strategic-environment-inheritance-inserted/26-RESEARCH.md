# Phase 26: Strategic Environment & Inheritance - Research

**Researched:** 2026-03-06
**Domain:** Problem set hierarchy inheritance, strategic context propagation, commander acknowledgment workflows
**Confidence:** HIGH

## Summary

Phase 26 builds a multi-level inheritance system where strategic-level problem sets automatically provide context (directives, policy, intel, knowledge graph data) to subordinate operational and tactical problem sets. The core mechanism extends the existing `ProblemSetSubscriptionStore` pub/sub system with auto-created subscriptions on child problem set creation, push invalidation with lazy refresh, commander acknowledgment workflows, local annotations/interpretations, and Request for Information (RFI) threads between echelons.

The existing codebase provides strong foundations: `parentProblemSetId` field with `validateEchelonHierarchy()` already models the 3-level hierarchy; `ProblemSetSubscriptionStore` handles subscription creation, approval, and cache materialization with version hashing; `CrossProblemSetUpdate` and `TabNotificationDropdown` already deliver cross-problem-set notifications; and the `EscalationPanel` demonstrates parent-child communication patterns. The main new work is: (1) auto-subscription on PS creation, (2) full ancestor chain traversal for multi-level inheritance, (3) context display with echelon color coding in the Understand tab, (4) commander acknowledgment tracking, (5) annotation/interpretation system, and (6) RFI thread mechanism.

**Primary recommendation:** Extend the existing subscription system rather than building a parallel inheritance mechanism. Add an `inheritance_type` column to `problem_set_subscriptions` to distinguish auto-inherited ('inheritance') from manually-requested ('subscription') relationships. Hook auto-subscription creation into the `POST /api/problem-sets` route immediately after problem set creation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Inheritance Model:**
- Auto-inherit from direct parent on problem set creation -- no explicit subscription needed for parent-child relationships
- ALL strategic documents cascade down (directives, policy, intel summaries, guidance) -- no filtering by document level
- Knowledge graph data (actors, relationships, tensions from Phase 25.3) also cascades alongside documents
- Full chain inheritance: tactical sees both operational parent AND strategic grandparent context, each labeled by source echelon
- Existing cross-workspace subscription system remains for non-parent relationships (e.g., cross-branch intel sharing)

**Update Propagation:**
- Hybrid timing: push invalidation (mark caches stale immediately when parent changes) with lazy data refresh on-open
- Tiered notifications: banner/toast for significant changes (new directives, policy shifts), badge indicator for minor updates (intel refreshes)
- Both changelog view AND highlight/mark new or changed items -- chronological changelog listing changes plus visual indicators on updated items in the inherited context display
- Commander acknowledgment required: child PS commander must formally acknowledge updated strategic context, creating an audit trail. Unacknowledged updates show as pending

**Context Display:**
- Dedicated "Inherited Strategic Context" section at the top of the Understand tab, collapsible
- Echelon color coding (e.g., strategic = gold, operational = blue, tactical = green) on inherited item borders/badges PLUS source labels (e.g., "From: INDOPACOM (Strategic)")
- Summary cards for each inherited document/graph item: title, source, last updated, brief summary. Click to expand full content
- Context dashboard widget at top of inherited section showing: connected ancestors, sync status, pending acknowledgments, last update time

**Context Override & Annotations:**
- Both inline annotations (quick sticky-note style comments on inherited items) AND full interpretation documents ("Commander's Interpretation" per inherited item)
- Annotations are local to the child problem set and do NOT modify the source
- Upward visibility by default: parent/higher echelon can view subordinate annotations and interpretations, but child can mark specific annotations as "local only"
- When inherited context is updated at parent, existing annotations are preserved but flagged as "based on previous version" -- user reviews and updates or dismisses
- Request for Information (RFI): child can send a "Request Clarification" on inherited items, which notifies the parent PS and creates a thread between echelons

### Claude's Discretion
- Exact echelon color palette choices
- Dashboard widget layout and information density
- How to categorize changes as "significant" vs "minor" for tiered notifications
- RFI thread UI implementation details
- Cache invalidation performance optimization approach

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | existing | New tables for acknowledgments, annotations, RFIs, changelog | Already the project DB; all existing stores follow this pattern |
| Express.js | existing | API routes for inheritance, acknowledgments, annotations | All backend routes use Express router pattern |
| React | existing | Frontend components for inherited context display | Frontend is React SPA |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | existing | Request validation schemas for new endpoints | All API routes use zod validation |
| crypto (Node built-in) | existing | Version hashing for cache invalidation | Already used in ProblemSetSubscriptionStore |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Polling for updates | WebSocket/SSE | Real-time but adds complexity; polling with stale_at is simpler and consistent with existing pattern |
| Separate inheritance table | Extended subscription table | Subscription table already has the right shape; adding a column is cleaner |

## Architecture Patterns

### Database Schema Additions

```sql
-- 1. Extend subscriptions to distinguish inheritance from manual subscription
ALTER TABLE problem_set_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_type TEXT NOT NULL DEFAULT 'subscription';
-- Values: 'inheritance' (auto from parent-child) or 'subscription' (manual cross-branch)

-- 2. Commander acknowledgment tracking
CREATE TABLE IF NOT EXISTS inheritance_acknowledgments (
  id TEXT PRIMARY KEY,                    -- "IACK-{uuid}"
  problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
  source_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
  source_version TEXT NOT NULL,           -- version hash from cache
  acknowledged_by TEXT NOT NULL,          -- DID of commander
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(problem_set_id, source_problem_set_id, source_version)
);

-- 3. Annotations on inherited items
CREATE TABLE IF NOT EXISTS inheritance_annotations (
  id TEXT PRIMARY KEY,                    -- "IANN-{uuid}"
  problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
  source_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
  target_item_id TEXT NOT NULL,           -- ID of inherited doc/graph item
  target_item_type TEXT NOT NULL,         -- 'strategic_document' | 'graph_summary'
  annotation_type TEXT NOT NULL,          -- 'inline' | 'interpretation'
  content TEXT NOT NULL,
  based_on_version TEXT,                  -- source version when annotation was created
  is_stale BOOLEAN NOT NULL DEFAULT false, -- flagged when source updates
  visibility TEXT NOT NULL DEFAULT 'upward', -- 'upward' | 'local_only'
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. RFI (Request for Information) threads
CREATE TABLE IF NOT EXISTS inheritance_rfis (
  id TEXT PRIMARY KEY,                    -- "IRFI-{uuid}"
  requesting_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
  target_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
  target_item_id TEXT NOT NULL,           -- inherited item being questioned
  target_item_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',    -- 'open' | 'responded' | 'closed'
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS inheritance_rfi_messages (
  id TEXT PRIMARY KEY,                    -- "IRFIM-{uuid}"
  rfi_id TEXT NOT NULL REFERENCES inheritance_rfis(id) ON DELETE CASCADE,
  author_did TEXT NOT NULL,
  author_problem_set_id TEXT NOT NULL,    -- which PS the author is responding from
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Inheritance changelog
CREATE TABLE IF NOT EXISTS inheritance_changelog (
  id TEXT PRIMARY KEY,                    -- "ICLOG-{uuid}"
  source_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL,              -- 'document_added' | 'document_updated' | 'graph_updated' | 'document_removed'
  change_severity TEXT NOT NULL DEFAULT 'minor', -- 'significant' | 'minor'
  item_id TEXT NOT NULL,
  item_title TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Recommended Project Structure
```
backend/src/
  inheritance/
    inheritance-store.ts          # CRUD for acknowledgments, annotations, RFIs, changelog
    inheritance-service.ts        # Business logic: auto-subscribe, propagate, traverse ancestors
    inheritance-types.ts          # TypeScript interfaces
  api/
    inheritance.ts                # Express routes for inheritance endpoints

frontend/src/
  components/
    inheritance/
      InheritedContextSection.tsx  # Top-level collapsible section in Understand tab
      InheritedContextSection.css
      ContextDashboardWidget.tsx   # Dashboard widget showing ancestors, sync status
      InheritedItemCard.tsx        # Summary card for each inherited doc/graph item
      AnnotationPanel.tsx          # Inline annotations + interpretation documents
      RFIThread.tsx                # RFI thread UI between echelons
      AcknowledgmentBanner.tsx     # Pending acknowledgment banner
      ChangelogView.tsx            # Chronological changelog of inherited changes
  lib/
    inheritance-service.ts         # Frontend API client for inheritance endpoints
```

### Pattern 1: Auto-Inheritance on Problem Set Creation
**What:** When a child problem set is created with a parent, automatically create a subscription row with `subscription_type = 'inheritance'`, `approval_status = 'approved'`, and `data_types = ['*']` (all types). Then walk the ancestor chain to also create inheritance subscriptions to grandparent/great-grandparent.
**When to use:** In the `POST /api/problem-sets` route, immediately after `problemSetStore.createProblemSet()`.
**Example:**
```typescript
// In POST /api/problem-sets handler, after problem set creation:
if (body.parentProblemSetId) {
  // Walk ancestor chain and create inheritance subscriptions
  await inheritanceService.createInheritanceChain(problemSet.id, body.parentProblemSetId, userDid);
}
```

### Pattern 2: Push Invalidation with Lazy Refresh
**What:** When a parent's strategic documents or graph data change, immediately mark all descendant caches as stale (set `stale_at = NOW()` on `problem_set_data_cache`). Log a changelog entry. When a child PS opens the Understand tab, check for stale caches and refresh them.
**When to use:** On any write to `strategic_documents` or graph data for a problem set that has child subscribers.
**Example:**
```typescript
// After updating a strategic document in the parent PS:
async function onParentContextChanged(
  publisherProblemSetId: string,
  changeType: string,
  changeSeverity: 'significant' | 'minor',
  itemId: string,
  itemTitle: string,
) {
  // 1. Mark all descendant caches as stale
  await inheritanceStore.markDescendantCachesStale(publisherProblemSetId);

  // 2. Log changelog entry
  await inheritanceStore.logChangelog(publisherProblemSetId, changeType, changeSeverity, itemId, itemTitle);

  // 3. Log activity for notification system
  const descendants = await inheritanceStore.getDescendantProblemSetIds(publisherProblemSetId);
  for (const descendantId of descendants) {
    await problemSetActivityStore.log(
      descendantId,
      changeSeverity === 'significant' ? 'strategic_context_major_update' : 'strategic_context_minor_update',
      'system',
      null,
      { sourceProblemSetId: publisherProblemSetId, changeType, itemId, itemTitle },
    );
  }
}
```

### Pattern 3: Ancestor Chain Traversal
**What:** Recursive CTE query to walk up the parent chain from any problem set to find all ancestors.
**When to use:** Building the full inherited context view, populating the dashboard widget.
**Example:**
```sql
-- Get all ancestors of a problem set (ordered from immediate parent to root)
WITH RECURSIVE ancestors AS (
  SELECT id, name, echelon, parent_problem_set_id, 1 AS depth
  FROM problem_sets
  WHERE id = $1
  UNION ALL
  SELECT ps.id, ps.name, ps.echelon, ps.parent_problem_set_id, a.depth + 1
  FROM problem_sets ps
  JOIN ancestors a ON ps.id = a.parent_problem_set_id
)
SELECT id, name, echelon, depth FROM ancestors WHERE depth > 1 ORDER BY depth ASC;
```

### Pattern 4: Commander Acknowledgment
**What:** When inherited context updates, the child PS commander must acknowledge receipt. Unacknowledged updates show as pending with a banner.
**When to use:** After stale caches are refreshed and new version is detected.
**Example:**
```typescript
// Check for pending acknowledgments
async function getPendingAcknowledgments(problemSetId: string): Promise<PendingAck[]> {
  // Compare current cache versions with latest acknowledgment versions
  // Return list of source PSes with unacknowledged updates
}
```

### Anti-Patterns to Avoid
- **Eager full refresh on every parent change:** Don't fetch and rebuild all descendant caches synchronously on every parent update. Use the stale_at pattern for lazy refresh.
- **Separate inheritance data store from subscription system:** Don't duplicate the subscription/cache tables. Extend the existing `problem_set_subscriptions` and `problem_set_data_cache` tables.
- **Annotations modifying source data:** Annotations must be strictly local to the child PS. Never write back to the parent's `strategic_documents` table.
- **Deep recursive queries without depth limits:** Always limit ancestor/descendant traversal to max depth 3 (strategic > operational > tactical). The hierarchy enforces this, but queries should still include a depth guard.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version tracking | Custom diff engine | SHA-256 hash of document timestamps (existing pattern in `materializeCache`) | Version comparison only needs equality check, not full diff |
| Notification delivery | Custom WebSocket system | Existing `CrossProblemSetUpdate` + polling via `ProblemSetContext` | Already works, just needs new activity types |
| Echelon hierarchy validation | New hierarchy checker | Existing `validateEchelonHierarchy()` from types.ts | Already enforces strategic > operational > tactical |
| Ancestor traversal | Application-level recursion | PostgreSQL recursive CTE | Single query, depth-bounded, database-level |
| Cache invalidation | Custom pub/sub system | Existing `stale_at` column + `refreshCacheForPublisher()` pattern | Phase 25.3 already built this |

**Key insight:** This phase is fundamentally an extension of Phase 23's subscription system and Phase 25.3's cache materialization. The subscription table, cache table, and notification pipeline already exist -- Phase 26 adds auto-creation, full chain traversal, acknowledgments, and annotations on top.

## Common Pitfalls

### Pitfall 1: Circular Inheritance
**What goes wrong:** If the hierarchy is misconfigured, a problem set could inherit from itself via a cycle.
**Why it happens:** Although `validateEchelonHierarchy()` prevents strategic->tactical->strategic cycles, defensive coding is needed.
**How to avoid:** The recursive CTE for ancestor traversal should include a depth limit (max 3) and a cycle-detection `WHERE id NOT IN (visited)` guard.
**Warning signs:** Infinite loops in ancestor queries, duplicate items in inherited context.

### Pitfall 2: N+1 Query Explosion on Inherited Context Load
**What goes wrong:** Loading inherited context for a tactical PS with many ancestor documents triggers dozens of individual queries.
**Why it happens:** Naively fetching each ancestor's documents one at a time.
**How to avoid:** Batch-fetch all ancestor subscriptions and their cached data in a single query. Use the existing `problem_set_data_cache` table which already aggregates by source.
**Warning signs:** Slow Understand tab load times, many DB queries in logs.

### Pitfall 3: Stale Annotations After Parent Update
**What goes wrong:** User makes an annotation on inherited item, parent updates the item, annotation becomes misleading.
**Why it happens:** Annotation references a specific version of the inherited content.
**How to avoid:** Store `based_on_version` in annotations. When source version changes, set `is_stale = true` on affected annotations. UI shows "based on previous version" warning.
**Warning signs:** Annotations appearing on content that no longer matches.

### Pitfall 4: Missing Auto-Subscription on Existing Problem Sets
**What goes wrong:** Phase 26 adds auto-inheritance, but existing parent-child problem sets created before Phase 26 have no inheritance subscriptions.
**Why it happens:** Auto-subscription only triggers on creation.
**How to avoid:** Include a one-time migration/backfill that creates inheritance subscriptions for all existing parent-child relationships.
**Warning signs:** Existing operational/tactical problem sets show no inherited context.

### Pitfall 5: Notification Flood from Bulk Document Updates
**What goes wrong:** Updating 10 strategic documents at once generates 10 notification activities for every descendant PS.
**Why it happens:** Each document change triggers individual notification.
**How to avoid:** Debounce/batch notifications. When multiple changes occur within a short window (e.g., 30 seconds), consolidate into a single "multiple updates" notification.
**Warning signs:** Users see a wall of near-identical notifications.

## Code Examples

### Auto-Inheritance Subscription Creation
```typescript
// backend/src/inheritance/inheritance-service.ts
async function createInheritanceChain(
  childProblemSetId: string,
  parentProblemSetId: string,
  requestedBy: string,
): Promise<void> {
  // Walk up the ancestor chain
  const ancestors = await getAncestorChain(parentProblemSetId);
  // ancestors = [parentId, grandparentId, ...]

  const allAncestors = [parentProblemSetId, ...ancestors.map(a => a.id)];

  for (const ancestorId of allAncestors) {
    await problemSetSubscriptionStore.createSubscription({
      subscriberProblemSetId: childProblemSetId,
      publisherProblemSetId: ancestorId,
      dataTypes: ['*'], // all types for inheritance
      approvalMechanism: 'auto',
      requestedBy,
    });

    // Auto-approve immediately
    // (The subscription store creates with 'pending' status,
    //  so we immediately approve for inheritance type)
    const sub = await problemSetSubscriptionStore.listBySubscriber(childProblemSetId);
    const inheritanceSub = sub.find(s => s.publisherProblemSetId === ancestorId);
    if (inheritanceSub) {
      await problemSetSubscriptionStore.updateApprovalStatus(
        inheritanceSub.id,
        'approved',
        'system',
      );
    }
  }
}
```

### Echelon Color Coding (Frontend)
```typescript
// Echelon color palette (Claude's discretion choice)
const ECHELON_COLORS = {
  strategic: {
    border: '#D4A843',   // Gold
    bg: 'rgba(212, 168, 67, 0.1)',
    badge: 'bg-yellow-700 text-yellow-100',
    label: 'Strategic',
  },
  operational: {
    border: '#3B82F6',   // Blue
    bg: 'rgba(59, 130, 246, 0.1)',
    badge: 'bg-blue-700 text-blue-100',
    label: 'Operational',
  },
  tactical: {
    border: '#22C55E',   // Green
    bg: 'rgba(34, 197, 94, 0.1)',
    badge: 'bg-green-700 text-green-100',
    label: 'Tactical',
  },
} as const;
```

### Notification Severity Classification
```typescript
// Claude's discretion: categorize changes as significant vs minor
const SIGNIFICANT_CHANGE_TYPES = [
  'document_added',        // New directive, policy, or guidance document
  'document_removed',      // Withdrawal of directive
  'graph_major_update',    // Major changes to actor relationships or tensions
] as const;

const MINOR_CHANGE_TYPES = [
  'document_updated',      // Minor edits to existing documents
  'graph_minor_update',    // Small graph data changes
  'intel_refresh',         // Routine intelligence updates
] as const;

function classifyChangeSeverity(changeType: string): 'significant' | 'minor' {
  if ((SIGNIFICANT_CHANGE_TYPES as readonly string[]).includes(changeType)) return 'significant';
  return 'minor';
}
```

### Inherited Context API Response Shape
```typescript
interface InheritedContextResponse {
  ancestors: Array<{
    problemSetId: string;
    name: string;
    echelon: 'strategic' | 'operational' | 'tactical';
    depth: number; // 1 = parent, 2 = grandparent
  }>;
  inheritedDocuments: Array<{
    id: string;
    title: string;
    docType: string;     // 'directive' | 'policy' | 'intel_summary' | 'guidance'
    summary: string;
    sourceProblemSetId: string;
    sourceProblemSetName: string;
    sourceEchelon: string;
    lastUpdated: string;
    isNew: boolean;       // true if added since last acknowledgment
    isUpdated: boolean;   // true if modified since last acknowledgment
  }>;
  inheritedGraphSummaries: Array<{
    containerName: string;
    summary: GraphSummaryData;
    sourceProblemSetId: string;
    sourceProblemSetName: string;
    sourceEchelon: string;
    lastUpdated: string;
  }>;
  syncStatus: {
    lastSyncAt: string | null;
    hasStaleCaches: boolean;
    pendingAcknowledgments: number;
  };
  changelog: Array<{
    id: string;
    changeType: string;
    changeSeverity: string;
    itemTitle: string;
    summary: string;
    createdAt: string;
    sourceProblemSetName: string;
  }>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual subscription for all data sharing | Auto-inheritance for parent-child + manual for cross-branch | Phase 26 | Parent-child relationships get automatic context propagation |
| No acknowledgment tracking | Commander acknowledgment with audit trail | Phase 26 | Creates doctrinal "receipt and acknowledgment" pattern |
| No annotation capability on inherited items | Inline annotations + interpretation documents | Phase 26 | Enables local context interpretation without modifying source |

## Open Questions

1. **Backfill strategy for existing problem sets**
   - What we know: Existing parent-child problem sets have no inheritance subscriptions
   - What's unclear: How many existing PS relationships exist, whether backfill should be a migration or on-demand
   - Recommendation: Create a SQL migration that inserts inheritance subscriptions for all existing parent-child pairs, and immediately materializes their caches

2. **Graph summary inheritance granularity**
   - What we know: Phase 25.3 graph summaries are per-container, and containers are linked to environments which are linked to problem sets
   - What's unclear: Whether graph data should be inherited as the summary (text) or as raw graph entities (actors, relationships, tensions)
   - Recommendation: Inherit the summary representation (consistent with how cached docs work), not raw entities. Raw entities would require duplicating the graph data store.

3. **Performance of full-chain refresh**
   - What we know: A strategic PS could have many operational children, each with tactical children (fan-out)
   - What's unclear: At scale, how many descendants could a single strategic PS have
   - Recommendation: For the current exercise scope (1 strategic, a few operational, maybe a dozen tactical), eager descendant cache invalidation is fine. If scale becomes a concern, use pg-boss queue for async invalidation.

## Sources

### Primary (HIGH confidence)
- `backend/src/problem-set/problem-set-subscription-store.ts` - Full subscription system with cache materialization, version hashing, stale_at pattern
- `backend/src/problem-set/types.ts` - Echelon hierarchy validation, ProblemSet type with parentProblemSetId
- `backend/src/problem-set/problem-set-store.ts` - Problem set CRUD, listChildProblemSets, parent_problem_set_id FK
- `backend/src/api/problem-sets.ts` - API routes for PS creation, subscription management, hierarchy validation
- `backend/src/exercise/strategic-context-service.ts` - Context assembly with token budgeting
- `frontend/src/context/ProblemSetContext.tsx` - CrossProblemSetUpdate type, notification polling
- `frontend/src/components/tabs/UnderstandTab.tsx` - Current understand tab structure with sidebar items
- `frontend/src/components/problem-set/EscalationPanel.tsx` - Parent-child communication UI pattern
- `frontend/src/components/problem-set/CreateProblemSetWizard.tsx` - PS creation flow with parent selection
- `frontend/src/components/problem-set/TabNotificationDropdown.tsx` - Cross-PS notification UI

### Secondary (MEDIUM confidence)
- `frontend/src/components/strategic/StrategicContextPreview.tsx` - Reusable strategic context display patterns
- `frontend/src/components/problem-set/CommanderPanel.tsx` - Commander actions and hierarchy display

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, pure extension of existing patterns
- Architecture: HIGH - Database schema extensions follow established ID/table patterns, API routes follow existing Express router conventions
- Pitfalls: HIGH - Derived from direct code analysis of existing subscription/cache system
- Annotations/RFI: MEDIUM - New feature area with some design decisions still open (UI density, thread UX)

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable domain, internal system)
