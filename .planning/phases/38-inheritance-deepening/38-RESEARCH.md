# Phase 38: Inheritance Deepening - Research

**Researched:** 2026-03-08
**Domain:** Bidirectional inheritance propagation, FRAGO generation, upward status reporting, change notification UX
**Confidence:** HIGH

## Summary

Phase 38 extends the Phase 26 downward-only strategic environment inheritance to a full bidirectional system. The four capabilities break down into: (1) change notification UX with severity-tiered persistent banners and tab/PS badges, (2) override tracking via extension of the existing RFI system with `modification_request` and `guidance_request` types plus a parent-acknowledgment loop for interpretations, (3) OPORD update propagation with AI-drafted FRAGOs using paragraph-level change detection, and (4) real-time upward status reporting of tactical mission execution to parent COP and Assess tabs via WebSocket.

The existing codebase provides almost all the infrastructure needed. Phase 26 built `InheritanceService` (push invalidation, changelog, acknowledgments), `InheritanceStore` (ancestor/descendant traversal, RFI threads, annotations), and frontend components (`AcknowledgmentBanner`, `ChangelogView`, `RFIThread`, `InheritedContextSection`). The `InheritanceChangelog` already classifies `changeSeverity` as `significant | minor`, and annotations already have `visibility: 'upward' | 'local_only'` and `annotationType: 'inline' | 'interpretation'`. The WebSocket infrastructure uses `ws` with `noServer: true` and centralized upgrade routing in `index.ts`, with 5 existing WS channels. The mission creation system already links child tactical PSes to parent OPORDs via `MissionAssignment` records. The OPORD structure (`OPORDStructure`) provides paragraph-level access for change detection.

**Primary recommendation:** Build incrementally on top of Phase 26's inheritance plumbing. Add a 6th WebSocket channel (`/ws/inheritance`) for real-time status streaming. Extend existing types (add `rfiSubtype` to `InheritanceRFI`, add `acknowledgmentStatus` to annotations) rather than creating parallel systems. Use AI (via existing RAFT template patterns) for FRAGO drafting from OPORD deltas.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Change Notification UX:**
- Persistent banner alert at top of inherited content areas (Understand tab) showing update count and source PS name
- Requires commander acknowledgment to dismiss -- not silently closeable
- Two severity tiers: amber/warning for significant changes (new/removed docs), info-blue for minor changes (edits, graph updates) -- maps to existing `changeSeverity` in `InheritanceChangelog`
- "View Changes" opens a changelog list (timestamps, severity badges, source PS name) -- click item to jump to inherited document
- Tab badge count on Understand tab header visible from any tab; dot indicator on problem set selector for PSes with pending updates

**Override Tracking & Visibility:**
- Inherited context is READ-ONLY at child level -- children cannot arbitrarily modify inherited strategic objectives
- Modification requests flow upward via extended RFI system -- new `modification_request` RFI type added to existing `InheritanceRFI`
- Parent sees modification requests as special RFIs requiring action (approve/deny/discuss via threaded conversation)
- Child interpretations (existing `interpretation` annotation type) are upward-visible by default
- Interpretations require parent acknowledgment -- parent must respond with one of three actions:
  - **Acknowledge** -- interpretation is correct, no further action
  - **Clarify** -- opens an RFI thread with additional guidance
  - **Correct** -- flags interpretation as wrong, child must revise

**OPORD Update Propagation:**
- Parent OPORD changes trigger notification + AI-auto-drafted FRAGO to child missions
- AI detects OPORD delta, drafts FRAGO highlighting changes and implications for subordinate missions
- Parent commander reviews and approves/edits FRAGO before distribution to children
- Mission-relevant sections trigger propagation: Paragraph 2 (Mission), 3 (Execution), 4 (Sustainment) always propagate; Paragraph 1 (Situation) and 5 (C2) propagate only if marked significant
- Child commanders must acknowledge FRAGO and update planning accordingly
- Bottom-up guidance requests supported via `guidance_request` RFI type -- child describes situation change, parent may issue FRAGO in response

**Upward Status Reporting:**
- Real-time streaming of tactical status to parent campaign (not periodic rollups)
- Default view: aggregated summary card per child mission (phase, % complete, key events, resource status, objective progress)
- Drill-down capability: parent can expand into full tactical detail for any child mission
- Status appears in both COP tab (real-time operational picture) and Assess tab (aggregated progress against campaign objectives)
- Graceful DDIL degradation: real-time when connected, automatic fallback to batched/queued updates when connectivity degrades, sync on reconnection -- aligns with Phase 1 DDIL architecture

### Claude's Discretion
- Specific WebSocket/SSE implementation for real-time streaming
- FRAGO template format and AI prompt engineering
- Changelog list UI component design and styling
- Badge/banner animation and interaction details
- Batched update queue implementation for DDIL fallback
- Drill-down UI pattern for upward status (modal vs inline expand vs separate view)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | existing | New tables for FRAGO drafts, status snapshots, interpretation acks; extend existing inheritance tables | All project data in PostgreSQL |
| Express.js | existing | New API routes for FRAGO management, status reporting, interpretation ack | All backend routes use Express + zod |
| ws | existing | New WebSocket channel `/ws/inheritance` for real-time upward status streaming | Already used for 5 WS channels with noServer centralized upgrade pattern |
| React | existing | Enhanced notification banner, badge system, FRAGO review UI, status cards | Frontend is React SPA with inline styles |
| zod | existing | Request validation for all new endpoints | Project standard for API validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| LangChain/OpenAI | existing | AI FRAGO drafting from OPORD deltas | Existing RAFT template + agent pattern for AI generation |
| deep-diff or custom | N/A | OPORD paragraph-level change detection | Compare before/after OPORD JSON structures |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WebSocket for status | SSE (Server-Sent Events) | SSE is simpler but unidirectional; WS needed since status updates flow both ways (parent requests drill-down, child sends updates). Project already uses `ws` extensively. |
| Custom JSON diff for OPORD | `deep-diff` npm package | External dep adds weight; custom paragraph-level diff is simpler since OPORD has known structure with 5 paragraphs. Hand-roll per-paragraph comparison. |
| Polling for status | WebSocket | Polling wastes bandwidth for real-time operational picture. WS consistent with project patterns. |

## Architecture Patterns

### Recommended Project Structure

New files integrate into existing module directories:

```
backend/src/
  inheritance/
    inheritance-service.ts          # EXTEND: FRAGO triggers, interpretation ack, status aggregation
    inheritance-store.ts            # EXTEND: new queries for subtypes, FRAGO records, status
    inheritance-types.ts            # EXTEND: new types for FRAGO, status, interpretation ack
    inheritance-ws.ts               # NEW: WebSocket handler for real-time status streaming
    frago-service.ts                # NEW: OPORD diff detection, AI FRAGO drafting
    status-aggregation-service.ts   # NEW: collect/aggregate child mission status
  api/
    inheritance.ts                  # EXTEND: new routes for FRAGO, interpretation ack, status
frontend/src/
  components/
    inheritance/
      AcknowledgmentBanner.tsx      # EXTEND: severity tiers, non-dismissable for commander ack
      ChangelogView.tsx             # EXTEND: severity badges, click-to-navigate
      InheritedContextSection.tsx   # EXTEND: read-only enforcement, modification request button
      RFIThread.tsx                 # EXTEND: modification_request and guidance_request subtypes
      InterpretationAckPanel.tsx    # NEW: parent view of child interpretations with ack/clarify/correct
      FRAGOReviewPanel.tsx          # NEW: commander reviews AI-drafted FRAGO before distribution
      MissionStatusCard.tsx         # NEW: aggregated child mission status card
      MissionStatusDrilldown.tsx    # NEW: expanded tactical detail for parent drill-down
    cop/
      COPTab.tsx                    # EXTEND: embed MissionStatusCard for child missions
    tabs/
      AssessTab.tsx                 # EXTEND: embed aggregated mission progress section
    problem-set/
      ProblemSetTabContainer.tsx    # EXTEND: add Understand tab badge count for pending updates
      ProblemSetSelector.tsx        # EXTEND: dot indicator for PSes with pending inheritance updates
```

### Pattern 1: Extending InheritanceRFI with Subtypes

**What:** Add `rfi_subtype` column to `inheritance_rfis` table to distinguish between clarification questions, modification requests, and guidance requests.

**When to use:** Any time a new inter-echelon communication type is needed.

**Example:**
```sql
-- Add subtype column to existing RFI table
ALTER TABLE inheritance_rfis
  ADD COLUMN IF NOT EXISTS rfi_subtype TEXT NOT NULL DEFAULT 'clarification';
-- Values: 'clarification' (existing), 'modification_request', 'guidance_request'

-- Add resolution tracking for modification requests
ALTER TABLE inheritance_rfis
  ADD COLUMN IF NOT EXISTS resolution TEXT; -- 'approved' | 'denied' | null
```

```typescript
// Extend InheritanceRFI type
export interface InheritanceRFI {
  // ... existing fields ...
  rfiSubtype: 'clarification' | 'modification_request' | 'guidance_request';
  resolution: 'approved' | 'denied' | null;
}
```

### Pattern 2: Interpretation Acknowledgment Loop

**What:** Parent reviews child interpretations and responds with acknowledge/clarify/correct.

**When to use:** For all upward-visible interpretations.

**Example:**
```sql
-- Track parent acknowledgment of child interpretations
CREATE TABLE IF NOT EXISTS interpretation_acknowledgments (
  id TEXT PRIMARY KEY,
  annotation_id TEXT NOT NULL REFERENCES inheritance_annotations(id) ON DELETE CASCADE,
  parent_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
  action TEXT NOT NULL,  -- 'acknowledge' | 'clarify' | 'correct'
  comment TEXT,          -- optional explanation
  rfi_id TEXT REFERENCES inheritance_rfis(id),  -- linked RFI for 'clarify' action
  acted_by TEXT NOT NULL,
  acted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Pattern 3: OPORD Delta Detection and FRAGO Drafting

**What:** When a parent OPORD is updated, compare paragraph-by-paragraph to detect changes, then use AI to draft a FRAGO for each affected child mission.

**When to use:** On any OPORD save/update in a parent PS that has child missions.

**Example:**
```typescript
// FRAGO draft record
interface FRAGODraft {
  id: string;                       // "FRAGO-{uuid}"
  parentProblemSetId: string;
  childProblemSetId: string;
  sourceOpordVersion: string;       // version hash of updated OPORD
  previousOpordVersion: string;     // version hash of prior OPORD
  changedParagraphs: number[];      // [2, 3] = Mission + Execution changed
  aiDraftContent: string;           // AI-generated FRAGO text
  status: 'draft' | 'approved' | 'distributed' | 'acknowledged';
  approvedBy: string | null;
  distributedAt: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

// Paragraph-level diff
function detectOpordChanges(
  previous: OPORDStructure,
  current: OPORDStructure
): { paragraph: number; severity: 'significant' | 'minor'; summary: string }[] {
  const changes = [];
  // Compare paragraph1_Situation through paragraph5_CommandSignal
  if (JSON.stringify(previous.paragraph2_Mission) !== JSON.stringify(current.paragraph2_Mission)) {
    changes.push({ paragraph: 2, severity: 'significant' as const, summary: 'Mission statement changed' });
  }
  // ... repeat for paragraphs 1, 3, 4, 5
  return changes;
}
```

### Pattern 4: Real-Time Status WebSocket Channel

**What:** New `/ws/inheritance` WebSocket channel for bidirectional status streaming between parent and child PSes.

**When to use:** Parent COP/Assess tabs subscribe; child tactical PSes publish status updates.

**Example:**
```typescript
// Server-side: inheritance-ws.ts
import { WebSocketServer, WebSocket } from 'ws';

interface StatusUpdate {
  type: 'mission_status';
  childProblemSetId: string;
  missionPhase: string;
  percentComplete: number;
  keyEvents: string[];
  resourceStatus: Record<string, string>;
  objectiveProgress: Record<string, number>;
  timestamp: string;
}

// Client subscriptions keyed by parent PS ID
const subscriptions = new Map<string, Set<WebSocket>>();

export function setupInheritanceWebSocket(wss: WebSocketServer): void {
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const parentPsId = url.searchParams.get('parentPsId');
    if (!parentPsId) { ws.close(4000, 'Missing parentPsId'); return; }

    if (!subscriptions.has(parentPsId)) subscriptions.set(parentPsId, new Set());
    subscriptions.get(parentPsId)!.add(ws);

    ws.on('close', () => subscriptions.get(parentPsId)?.delete(ws));
  });
}

// Called by child PS status update endpoints
export function broadcastStatusUpdate(parentPsId: string, update: StatusUpdate): void {
  const subs = subscriptions.get(parentPsId);
  if (!subs) return;
  const msg = JSON.stringify(update);
  for (const ws of subs) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}
```

### Pattern 5: DDIL Graceful Degradation

**What:** Batch status updates when WebSocket connectivity degrades; sync on reconnection.

**When to use:** Automatically when WS connection drops or latency exceeds threshold.

**Example:**
```typescript
// Client-side queue for DDIL fallback
class StatusUpdateQueue {
  private queue: StatusUpdate[] = [];
  private connected = false;

  enqueue(update: StatusUpdate) {
    if (this.connected) {
      this.send(update);
    } else {
      this.queue.push(update);
    }
  }

  onReconnect() {
    this.connected = true;
    // Flush queued updates
    const batch = this.queue.splice(0);
    if (batch.length > 0) this.sendBatch(batch);
  }

  onDisconnect() { this.connected = false; }
}
```

### Anti-Patterns to Avoid

- **Auto-overwriting inherited context:** Inherited content is READ-ONLY at child level. Never allow silent changes -- all modifications go through modification request RFIs. This is a doctrinal constraint.
- **Silent OPORD updates:** OPORD changes must produce FRAGOs (Fragmentary Orders) per doctrine, not silently rewrite child missions. The commander must review before distribution.
- **Polling for real-time status:** Use WebSocket for operational picture fidelity. Polling introduces unacceptable latency for C2 applications.
- **Dismissable notification banners without ack:** The current `AcknowledgmentBanner` has a dismiss button. Phase 38 requires commander acknowledgment to dismiss -- not silently closeable. Remove or gate the dismiss button behind ack.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket management | Custom WS reconnection logic | Extend existing `ws` + `noServer` pattern in `index.ts` | 5 channels already use this exact pattern; add a 6th |
| AI text generation | Custom LLM integration | Existing RAFT template pattern (`backend/src/raft/templates/`) | FRAGO drafting follows same pattern as OPORD generation |
| Notification badges | New badge component | Existing `NotificationBadge` component + `tabNotifications` in `ProblemSetContext` | Already supports count, pulse animation, "99+" |
| RFI threading | New messaging system | Extend existing `InheritanceRFI` + `RFIMessage` system | RFI threading already works; just add subtype column |
| Ancestor/descendant traversal | New tree walking | Existing `getAncestorChain()` and `getDescendantProblemSetIds()` recursive CTEs | Proven, depth-limited to 3 |

**Key insight:** Phase 26 built the full inheritance plumbing. Phase 38 is about extending existing types and adding new flows on top -- not rebuilding infrastructure.

## Common Pitfalls

### Pitfall 1: Breaking Existing AcknowledgmentBanner Dismiss Behavior
**What goes wrong:** The current banner has a dismiss button that lets users close it without acknowledging. Phase 38 requires commander acknowledgment to dismiss.
**Why it happens:** Refactoring existing component without understanding the new constraint.
**How to avoid:** Remove the "Dismiss" button for inheritance notifications. Keep it only for non-critical info-blue minor updates. Amber/significant updates require the "Acknowledge" button.
**Warning signs:** Users can close banners without the backend recording an acknowledgment.

### Pitfall 2: FRAGO Generation Without Commander Gate
**What goes wrong:** AI-drafted FRAGOs are automatically distributed to child missions without parent commander review.
**Why it happens:** Treating FRAGO generation as fire-and-forget like notification logging.
**How to avoid:** FRAGO goes through explicit: draft -> commander review -> approve/edit -> distribute -> child acknowledge. Never auto-distribute.
**Warning signs:** Child PSes receive FRAGOs with `status: 'draft'`.

### Pitfall 3: WebSocket Channel Conflict in Upgrade Handler
**What goes wrong:** New WS channel interferes with existing 5 channels because the centralized upgrade handler in `index.ts` is not updated.
**Why it happens:** Adding WS server with `{ server, path }` instead of `{ noServer: true }`.
**How to avoid:** Follow the exact pattern: create `new WebSocketServer({ noServer: true })`, add to `wsServers` object, add `else if` clause in the `server.on('upgrade')` handler.
**Warning signs:** "HTTP/1.1 400 Bad Request" errors on existing WS connections.

### Pitfall 4: OPORD Diff Sensitivity Too High
**What goes wrong:** Whitespace or formatting changes trigger FRAGO generation, flooding child missions with irrelevant updates.
**Why it happens:** Using raw JSON.stringify comparison without normalization.
**How to avoid:** Normalize OPORD structures before comparison (trim whitespace, sort arrays, ignore formatting-only changes). Only trigger FRAGO for semantic content changes.
**Warning signs:** High volume of FRAGOs with `changedParagraphs` but no meaningful content differences.

### Pitfall 5: Status Update Storm
**What goes wrong:** Every micro-change in child mission status triggers a WebSocket broadcast, overwhelming parent COP.
**Why it happens:** Broadcasting every field change individually instead of debouncing/batching.
**How to avoid:** Debounce status updates on the client side (500ms-1s). Send full status snapshots rather than individual field changes. On the server, aggregate before broadcast.
**Warning signs:** Parent COP renders become sluggish; WS message queue grows.

### Pitfall 6: Read-Only Enforcement Only in UI
**What goes wrong:** Inherited context is read-only in the UI but the API still accepts mutations, creating a bypass.
**Why it happens:** Enforcing business rules only in frontend components.
**How to avoid:** Backend API routes must reject direct mutation of inherited documents. Add middleware that checks `subscription_type = 'inheritance'` and blocks writes to source data from child PSes.
**Warning signs:** Direct API calls can modify inherited content.

## Code Examples

### Extending the Upgrade Handler for New WS Channel

```typescript
// In backend/src/index.ts — add to wsServers object and upgrade handler
const wsServers = {
  messages: new WebSocketServer({ noServer: true }),
  orchestration: new WebSocketServer({ noServer: true }),
  collab: new WebSocketServer({ noServer: true }),
  resources: new WebSocketServer({ noServer: true }),
  discovery: new WebSocketServer({ noServer: true }),
  inheritance: new WebSocketServer({ noServer: true }),  // NEW
};

// ... existing setup calls ...
setupInheritanceWebSocket(wsServers.inheritance);  // NEW

// In upgrade handler, add:
} else if (pathname === '/ws/inheritance') {
  wsServers.inheritance.handleUpgrade(request, socket, head, (ws) => {
    wsServers.inheritance.emit('connection', ws, request);
  });
}
```

### Non-Dismissable Commander Acknowledgment Banner

```typescript
// Enhanced AcknowledgmentBanner — severity-tiered, non-dismissable for significant
interface EnhancedAcknowledgmentBannerProps {
  pendingAcks: PendingAck[];
  changelogEntries: ChangelogEntry[];
  onAcknowledge: (sourceProblemSetId: string) => void;
  onViewChanges: () => void;
}

// Amber banner for significant changes — NO dismiss button
// Info-blue for minor changes — dismiss allowed
// Tab badge: count of unacknowledged sources
```

### FRAGO Draft from OPORD Delta (RAFT Template Pattern)

```typescript
// backend/src/raft/templates/frago-generation.ts
// Follow existing pattern from mdmp-opord-generation.ts
export const fragoGenerationTemplate = {
  systemPrompt: `You are a military staff officer drafting a Fragmentary Order (FRAGO).
Given the changes between a previous and updated OPORD, draft a FRAGO that:
1. States which paragraphs changed
2. Summarizes each change concisely
3. States implications for subordinate missions
4. Provides updated guidance or tasks as applicable
Format per FM 5-0 FRAGO standard.`,

  userPromptTemplate: (context: {
    previousOpord: Partial<OPORDStructure>;
    currentOpord: Partial<OPORDStructure>;
    changedParagraphs: number[];
    childMissionStatement: string;
    childTaskStatement: string;
  }) => `...`,
};
```

### Mission Status Snapshot Type

```typescript
// Status snapshot published by child missions via WS
interface MissionStatusSnapshot {
  childProblemSetId: string;
  childProblemSetName: string;
  missionState: 'planning' | 'active' | 'complete' | 'archived';
  mdmpPhase: string;              // current MDMP step
  percentComplete: number;         // 0-100
  keyEvents: Array<{
    timestamp: string;
    description: string;
    severity: 'info' | 'warning' | 'critical';
  }>;
  resourceStatus: {
    personnel: { assigned: number; available: number };
    equipment: { operational: number; total: number };
    supplies: Record<string, string>;  // class -> status
  };
  objectiveProgress: Array<{
    objectiveId: string;
    objectiveName: string;
    status: 'not_started' | 'in_progress' | 'achieved' | 'failed';
    percentComplete: number;
  }>;
  lastUpdated: string;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Downward-only inheritance (Phase 26) | Bidirectional with ack loops | Phase 38 | Full echelon communication |
| Dismissable notification banners | Commander-ack-required banners | Phase 38 | Audit trail for context awareness |
| No OPORD change propagation | AI-drafted FRAGO with commander gate | Phase 38 | Doctrinal compliance |
| No upward status visibility | Real-time WS streaming to parent COP | Phase 38 | Operational picture completeness |
| Single RFI type (clarification) | Three subtypes (clarification, modification_request, guidance_request) | Phase 38 | Full inter-echelon communication |

## Open Questions

1. **OPORD Storage Location**
   - What we know: OPORD structure is defined in `opord-template.ts`, and `order-store.ts` handles exercise orders. Mission assignments link child PSes to parent OPORDs via `MissionAssignment`.
   - What's unclear: Where exactly the "current OPORD" for a problem set is stored and versioned for diff purposes. May need to add explicit OPORD versioning.
   - Recommendation: Check if the planning document store or `exercise_orders` table holds the current OPORD for diff comparison. May need a `problem_set_opords` table or column.

2. **Status Snapshot Frequency**
   - What we know: User wants real-time streaming, not periodic rollups.
   - What's unclear: What triggers a status snapshot update -- every MDMP step transition? Manual update? Timer?
   - Recommendation: Trigger on meaningful state changes (MDMP phase transition, objective status change, key event). Debounce at 1-second intervals. Allow manual "push status" button.

3. **DDIL Implementation Depth**
   - What we know: User wants DDIL graceful degradation. The sensors module has basic DDIL concepts.
   - What's unclear: How deep the DDIL implementation needs to be for this phase vs. future phases.
   - Recommendation: Implement client-side queue with localStorage persistence. Auto-flush on reconnect. This covers 80% of DDIL use cases without complex distributed systems work.

## Sources

### Primary (HIGH confidence)
- `backend/src/inheritance/inheritance-service.ts` -- Core inheritance service with push invalidation, changelog, activity notification
- `backend/src/inheritance/inheritance-store.ts` -- All DB operations: ancestor/descendant CTEs, changelog, annotations, RFIs, acknowledgments
- `backend/src/inheritance/inheritance-types.ts` -- Type definitions for all inheritance entities
- `backend/src/index.ts` lines 210-260 -- WebSocket centralized upgrade handler pattern (5 channels, noServer: true)
- `backend/src/resources/resource-ws.ts` -- Cleanest WS channel implementation to follow as template
- `frontend/src/components/inheritance/AcknowledgmentBanner.tsx` -- Current dismissable banner (needs modification)
- `frontend/src/components/problem-set/ProblemSetTabContainer.tsx` -- Tab badge system with NotificationBadge, tabNotifications
- `backend/src/mission-creation/mission-creation-types.ts` -- MissionAssignment links child PS to parent OPORD
- `backend/src/planning/documents/templates/opord-template.ts` -- OPORDStructure with 5 paragraphs for diff detection
- `backend/src/exercise/order-store.ts` -- CRUD for exercise orders (WARNORD, OPORD, FRAGO)
- `frontend/src/components/cop/COPTab.tsx` -- COP tab structure for embedding mission status cards
- `frontend/src/components/tabs/AssessTab.tsx` -- Assess tab structure for embedding aggregated progress
- `frontend/src/components/problem-set/NotificationBadge.tsx` -- Reusable badge component with pulse animation

### Secondary (MEDIUM confidence)
- `backend/src/raft/templates/mdmp-opord-generation.ts` -- RAFT template pattern for AI generation (template for FRAGO generation)
- Phase 26 RESEARCH.md -- Established patterns for inheritance architecture

### Tertiary (LOW confidence)
- DDIL patterns -- Based on project memory reference to Phase 1 DDIL architecture; actual DDIL implementation may be minimal

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, patterns well-established
- Architecture: HIGH -- extending existing Phase 26 system with clear patterns
- Change notification UX: HIGH -- existing components (AcknowledgmentBanner, NotificationBadge) provide templates
- OPORD/FRAGO propagation: MEDIUM -- OPORD storage/versioning needs validation during implementation
- WebSocket for status: HIGH -- exact pattern exists in 5 other channels
- DDIL degradation: MEDIUM -- simple client-side queue approach is sound but not battle-tested in this codebase

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable domain, internal architecture)
