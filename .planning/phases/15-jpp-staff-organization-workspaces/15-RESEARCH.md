# Phase 15: JPP Staff Organization Workspaces - Research

**Researched:** 2026-03-01
**Domain:** Role-based workspace UI restructuring, cross-staff notifications, doctrinal product templates, strategic direction import
**Confidence:** HIGH (codebase well-understood, architecture verified by direct inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Workspace Structure & Navigation**
- Vertical sidebar within the exercise area listing available staff roles (Commander, J1, J2, J3, J35, J4, J5, J6)
- Users click a role in the sidebar to load that role's workspace in the main content area
- Free switching between any role workspace — no assignment-based restriction
- Roles are configurable per exercise — exercise creator chooses which roles to enable (could be minimal or full staff)
- Each role workspace opens to a dashboard overview showing: product summary, recent activity, pending notifications, and quick actions

**Doctrinal Product Templates**
- Hybrid template approach: structured data fields (dropdowns, tables, maps) for data that feeds other products + freeform rich text sections for narrative analysis
- Products pre-populated from existing exercise data (Phase 14 IPB/COA work) — users refine rather than recreate from scratch
- Cross-product relationships use notification + manual pull: when a source product changes, linked products show a notification badge; user reviews and accepts/rejects the update
- Each role starts with their doctrinal default product set, but can also create custom products from a template library

**Cross-Staff Notifications**
- Global notification panel (bell icon) for awareness + inline badges on affected products for context
- Explicit publish trigger — user clicks "Publish" or "Share" when a product is ready; work-in-progress stays private and does not trigger notifications
- Notification action: view diff of what changed in source product + "Integrate" button that pulls relevant changes into user's product with a preview

**Strategic Direction Import**
- Manual import anytime — "Import Strategic Direction" button available in the exercise to pull latest from Design tab on demand
- Strategic direction imports into the Commander's workspace specifically
- Commander distributes guidance to other roles through the publish/notification system

### Claude's Discretion
- Notification delivery mechanism (real-time WebSocket vs poll-based — pick what fits existing architecture)
- Dashboard layout and component design per role
- Exact structured field types per doctrinal product template
- Which doctrinal products to pre-configure for each role (based on JP 5-0 and joint planning doctrine)
- Diff view implementation for cross-staff integration
- Agent suggestion panel layout and interaction patterns

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 15 restructures the Exercise area to mirror the Joint Planning Process (JPP) staff organization. The primary work is UI reorganization — replacing the existing flat tab navigation with a role-sidebar/workspace layout — plus new backend capabilities for staff product storage, publish/notification events, and strategic direction import. No new libraries are needed; the architecture must be built atop existing infrastructure.

The existing codebase provides strong foundations: a `TabLayout` component with a sidebar already exists at `frontend/src/components/tabs/TabLayout.tsx`; the message bus (`MessageBus` with pg-boss) handles async notification routing; WebSocket at `/ws/messages` delivers real-time events; Phase 14 IPB, COA, and order data can be directly queried to pre-populate role workspaces. The strategic Design tab exposes objectives and commander's intent via `strategicRouter` at `/api/strategic/*`.

**Primary recommendation:** Build Phase 15 as a thin layer over Phase 14 infrastructure. The sidebar + role workspace shell is the first and most critical deliverable. Products are rich-text + structured-field composites stored in a single new `staff_products` table, keyed by `(scenario_id, role_key, product_type)`. Notifications flow through the existing message bus on a new `exercise.staff.*` channel family. Pre-population queries Phase 14 tables at workspace load time to avoid data duplication.

---

## Standard Stack

### Core (all already installed — no new packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + TypeScript | 19.x / 5.9 | Frontend components | Project standard |
| Express 5 | ^5.2.1 | Backend API | Project standard |
| PostgreSQL / pg | ^8.16.3 | Staff product persistence | Project standard |
| pg-boss | ^12.5.4 | Notification job queue | Already used in PlanningBoardService |
| ws (WebSocket) | ^8.19.0 | Real-time delivery | Already wired at `/ws/messages` |
| MessageBus | (internal) | Publish/subscribe | Already used for task notifications |
| `TabLayout` component | (internal) | Sidebar navigation | Already exists at `frontend/src/components/tabs/TabLayout.tsx` |

### Supporting (all already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @anthropic-ai/sdk | ^0.71.2 | Agent suggestions per workspace | For AI suggestion panel integration |
| milsymbol | ^3.0.3 | Map overlays in J2 workspace | When rendering force symbol templates |
| react-leaflet | ^5.0.0 | Map views in J2/J3 | When product includes map data |
| zod | ^4.3.5 | Input validation | All API route body parsing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing existing `TabLayout` sidebar | Building new staff sidebar component | New component adds unnecessary complexity; `TabLayout` is exactly the right abstraction |
| Polling for notifications | WebSocket push | WebSocket already exists at `/ws/messages`; polling would be a regression |
| Separate table per role | Single `staff_products` table with `role_key` column | Separate tables are unmaintainable at scale; single table with discriminator is standard PostgreSQL pattern |

**Installation:**
```bash
# No new packages required — all dependencies already installed
```

---

## Architecture Patterns

### Recommended Project Structure

The new files slot into existing directories:

```
backend/
├── src/
│   ├── exercise/
│   │   ├── staff-product-store.ts   # NEW: CRUD for staff_products table
│   │   ├── staff-notification-service.ts  # NEW: publish → notify pipeline
│   │   └── strategic-import-service.ts    # NEW: pull Design tab data into Commander workspace
│   └── api/
│       └── exercise.ts              # MODIFIED: add staff workspace routes
│   database/
│       └── 016-staff-workspaces.sql # NEW: staff_products + staff_notifications tables

frontend/
├── src/
│   ├── components/
│   │   └── exercise/
│   │       ├── StaffWorkspace.tsx            # NEW: role sidebar + workspace shell
│   │       ├── StaffWorkspace.css            # NEW
│   │       ├── RoleDashboard.tsx             # NEW: per-role overview card
│   │       ├── StaffProduct.tsx              # NEW: hybrid template editor
│   │       ├── StaffProduct.css              # NEW
│   │       ├── NotificationPanel.tsx         # NEW: bell icon + notification list
│   │       ├── NotificationPanel.css         # NEW
│   │       ├── ProductDiffView.tsx           # NEW: diff + integrate button
│   │       ├── ProductDiffView.css           # NEW
│   │       └── ExerciseDashboard.tsx         # MODIFIED: replace tab-nav with StaffWorkspace
│   └── services/
│       └── exercise-service.ts               # MODIFIED: add staff workspace API methods
```

### Pattern 1: Role Sidebar with TabLayout Reuse

**What:** Replace ExerciseDashboard's horizontal tab navigation with the existing `TabLayout` sidebar component, configured with staff roles as sidebar items.

**When to use:** This is the correct pattern for Phase 15's vertical sidebar decision.

**Existing component at:** `/home/vitalpointai/projects/ssr/frontend/src/components/tabs/TabLayout.tsx`

```typescript
// TabLayout already has the exact interface needed:
interface SidebarItem {
  id: string;
  label: string;
  tooltip?: string;
}

// Staff roles map directly:
const STAFF_ROLES: SidebarItem[] = [
  { id: 'commander', label: 'Commander', tooltip: 'Commander workspace' },
  { id: 'j2',        label: 'J2 Intelligence', tooltip: 'Intelligence / IPB' },
  { id: 'j3',        label: 'J3 Operations',   tooltip: 'Operations' },
  { id: 'j35',       label: 'J35 Plans',        tooltip: 'Future Plans' },
  { id: 'j4',        label: 'J4 Logistics',     tooltip: 'Sustainment' },
  { id: 'j5',        label: 'J5 Strategic',     tooltip: 'Strategic Plans' },
  { id: 'j6',        label: 'J6 Comms',         tooltip: 'Communications' },
  { id: 'j1',        label: 'J1 Personnel',     tooltip: 'Personnel' },
];
```

**CRITICAL:** The sidebar renders only roles enabled for the current scenario (`scenario.enabledRoles` — new field). The exercise creator configures which roles to include.

### Pattern 2: Staff Product as Hybrid Template

**What:** Each staff product is a JSON document with two parts: `structured` (typed fields like dropdowns, unit tables) and `content` (freeform rich text). Stored in a single `staff_products` table.

**When to use:** All role-specific work products.

**Database schema:**
```sql
CREATE TABLE staff_products (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
    role_key TEXT NOT NULL,           -- 'commander', 'j2', 'j3', etc.
    product_type TEXT NOT NULL,       -- 'threat_assessment', 'coa_sketch', etc.
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'published'
    structured JSONB NOT NULL DEFAULT '{}',
    content TEXT NOT NULL DEFAULT '',      -- rich text / markdown
    published_at TIMESTAMPTZ,
    published_by TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification table for cross-staff integration
CREATE TABLE staff_notifications (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
    source_product_id TEXT NOT NULL REFERENCES staff_products(id) ON DELETE CASCADE,
    source_role TEXT NOT NULL,
    target_role TEXT NOT NULL,
    notification_type TEXT NOT NULL,   -- 'product_published', 'product_updated'
    diff_snapshot JSONB NOT NULL DEFAULT '{}',
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_integrated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Pattern 3: Publish → Notify Pipeline

**What:** When a staff member clicks "Publish", the backend sets `status='published'`, then creates `staff_notifications` rows for each other enabled role in the scenario. The existing MessageBus channel system broadcasts to WebSocket clients.

**When to use:** Every product publish action.

```typescript
// backend/src/exercise/staff-notification-service.ts
class StaffNotificationService {
  async publishProduct(productId: string, publishedBy: string): Promise<void> {
    // 1. Set product status='published', published_at=NOW()
    const product = await this.productStore.publish(productId, publishedBy);

    // 2. Compute diff vs previous published version
    const diff = await this.computeDiff(product);

    // 3. Create staff_notifications rows for all OTHER enabled roles
    const scenario = await this.scenarioStore.findById(product.scenarioId);
    const enabledRoles = scenario.enabledRoles.filter(r => r !== product.roleKey);
    await this.createNotifications(product, enabledRoles, diff);

    // 4. Broadcast via MessageBus to WebSocket clients
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: publishedBy,
      sourceType: 'user',
      destinationType: 'channel',
      destinationTarget: `exercise.staff.${product.scenarioId}`,
      messageType: 'staff.product.published',
      payload: { productId, sourceRole: product.roleKey, title: product.title, diff },
      attributes: { classification: 'UNCLASS', releasability: [], dissemination: [], originator: publishedBy, orcon: false },
    });
  }
}
```

### Pattern 4: Pre-Population from Phase 14 Data

**What:** When a role workspace first loads, it queries existing Phase 14 data to seed products. No data duplication — the workspace is a lens over existing data.

**When to use:** First time a role workspace is opened for a scenario.

```typescript
// J2 workspace pre-population example:
async function seedJ2Workspace(scenarioId: string, exercisePhase: string): Promise<void> {
  // Check if products already exist for this role
  const existing = await staffProductStore.findByRole(scenarioId, 'j2');
  if (existing.length > 0) return; // Already seeded

  // Pull IPB assessments from Phase 14
  const ipbAssessments = await ipbStore.findByScenario(scenarioId, ['blue', 'red', 'controller']);

  // Create pre-populated product records
  for (const ipb of ipbAssessments) {
    await staffProductStore.create({
      scenarioId,
      roleKey: 'j2',
      productType: 'ipb_assessment',
      title: `IPB — ${ipb.perspective === 'own' ? 'Own Forces' : 'Enemy Assessment'} — ${ipb.exercisePhase}`,
      structured: { ipbAssessmentId: ipb.id, team: ipb.team, perspective: ipb.perspective },
      content: ipb.threatAssessment,
      status: 'draft',
      createdBy: 'system',
    });
  }
}
```

**Seeding map by role:**

| Role | Seeds from Phase 14 |
|------|---------------------|
| Commander | Commander decisions (`scenario_coas.commander_decision`), published orders |
| J2 | IPB assessments (`ipb_assessments`), extracted OOB data (`scenario_documents` where type=OOB) |
| J3 | Published OPORD/WARNORD content (`exercise_orders`), planning tasks |
| J35 | COAs (`scenario_coas`) with scores |
| J4 | Sustainment paragraph from published OPORDs |
| J5 | Strategic objectives from Design tab (via strategic import) |
| J6 | Command and signal paragraph from published OPORDs |
| J1 | Personnel tables from scenario documents |

### Pattern 5: Strategic Direction Import

**What:** A button in Commander's workspace triggers a pull from `/api/strategic` endpoints. The result is saved as a Commander workspace product of type `strategic_guidance`.

**When to use:** Once per scenario initialization, or on-demand to pull latest Design tab updates.

```typescript
// frontend call:
async function importStrategicDirection(scenarioId: string): Promise<void> {
  // Pull latest approved objectives from Design tab
  const objectives = await fetch('/api/strategic/objectives?status=APPROVED').then(r => r.json());
  const intent = await fetch('/api/strategic/intent').then(r => r.json());

  // POST to exercise API to create/update Commander's strategic guidance product
  await exerciseService.importStrategicDirection(scenarioId, { objectives, intent });
}
```

Backend endpoint: `POST /api/exercise/scenarios/:id/import-strategic-direction`

### Pattern 6: WebSocket Notification Delivery

**What:** Frontend subscribes to exercise scenario channel on WebSocket connect. Notifications arrive as MessageBus events and update the notification badge count in real time.

**When to use:** This is the correct approach — WebSocket already exists, no polling needed.

```typescript
// frontend hook (custom hook pattern — no new library):
function useStaffNotifications(scenarioId: string) {
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);

  useEffect(() => {
    const ws = new WebSocket(`/ws/messages?did=${userDid}`);

    ws.onopen = () => {
      // Subscribe to scenario-specific exercise channel
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: `exercise.staff.${scenarioId}`
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'message' && msg.data.messageType === 'staff.product.published') {
        // Refresh notifications from REST endpoint
        loadNotifications();
      }
    };

    return () => ws.close();
  }, [scenarioId]);

  return { notifications, unreadCount: notifications.filter(n => !n.isRead).length };
}
```

### Pattern 7: Diff View for Integration

**What:** When a user clicks "Integrate" on a notification, they see a side-by-side or line-by-line diff of what changed in the source product, with field-level accept/reject controls.

**When to use:** All notification integration flows.

**Implementation:** Server-side diff using JSON-diff between previous and new `structured`+`content`. Store as `diff_snapshot JSONB` in `staff_notifications`. Frontend renders diff with green/red highlighting — no external diff library needed, implement a simple field-diff renderer.

```typescript
// Diff snapshot structure stored in staff_notifications.diff_snapshot:
interface DiffSnapshot {
  structuredChanges: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  contentChanged: boolean;
  contentSummary?: string;  // LLM-generated one-line summary of text changes
}
```

### Doctrinal Products by Role (JP 5-0 Basis)

Claude's discretion — recommended based on JP 5-0 joint planning doctrine:

| Role | Doctrinal Products |
|------|--------------------|
| Commander | Commander's Intent, COA Decision, Strategic Guidance (import), WARNORD approval |
| J2 | IPB Assessment, Threat Assessment, OOB, Intelligence Summary, Priority Intelligence Requirements (PIR) |
| J3 | Synchronization Matrix, COA Sketch, Task Organization, Rules of Engagement, Execute Order |
| J35 | COA Development, COA Analysis, Staff Estimate, Campaign Plan draft |
| J4 | Logistics Estimate, CSS Annex, Supply Plan |
| J5 | Strategic Estimate, Strategic Direction (from Design tab), Campaign Objectives |
| J6 | Communications Plan, C2 Architecture, Network Diagram |
| J1 | Personnel Estimate, Manning Status, Casualty Tracking |

### Scenario `enabledRoles` Field

The `exercise_scenarios` table needs a new column:

```sql
ALTER TABLE exercise_scenarios
  ADD COLUMN IF NOT EXISTS enabled_roles TEXT[] NOT NULL DEFAULT '{"commander","j2","j3","j35","j4","j5","j6","j1"}';
```

Default is all roles. Exercise creator unchecks roles they don't need. This is stored directly on the scenario record, editable in the Create Scenario modal (Phase 15 plan adds a role-selection step to the modal).

### Anti-Patterns to Avoid

- **Separate tables per role:** Do not create `j2_products`, `j3_products` etc. Use a single `staff_products` table with `role_key` discriminator. Adding a new role requires zero schema changes.
- **Duplicating Phase 14 data:** Do not copy IPB/COA data into `staff_products`. Pre-populate with references (via `structured.ipbAssessmentId`) then load live data when rendering. Staff edits and narrative live in `staff_products.content`.
- **Tight coupling to perspective (blue/red):** Staff workspaces transcend the blue/red information barrier — staff roles work within the blue team's planning. The existing `req.visibleTeams` middleware still applies to document queries, but staff products themselves are workspace state, not barrier-separated.
- **Blocking publish on validation:** Do not gate the publish button on completeness. Users publish when ready. Trust the doctrinal workflow.
- **Full-page navigation for role switching:** Role switch must be client-side only (no page reload). Load role workspace data asynchronously after selecting from sidebar.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sidebar navigation | Custom sidebar | `TabLayout` at `frontend/src/components/tabs/TabLayout.tsx` | Already exists, tested, follows project CSS patterns |
| Real-time notification delivery | Custom polling | Existing `/ws/messages` WebSocket + MessageBus `subscribe` | Already built in messaging API |
| Background job scheduling | Custom timers | `pg-boss` queue via `getMessageBus()` | Already used for task delivery in PlanningBoardService |
| JSON diff computation | Custom recursive differ | Simple field-by-field compare on `structured` JSONB + text comparison on `content` | The diff is shallow (flat JSONB fields + text). No complex tree-diff library needed. |
| Rich text editing | Custom textarea | Standard `<textarea>` with markdown conventions | Project consistently uses plain textareas for narrative content (see `COAScoringPanel`, `OrderEditor` narrative fields). Don't introduce a heavy editor. |

**Key insight:** Phase 15 is 80% UI reorganization using already-built infrastructure. Resist the urge to add complexity.

---

## Common Pitfalls

### Pitfall 1: Re-implementing the Tab System

**What goes wrong:** Building a new sidebar+content shell instead of reusing `TabLayout`.

**Why it happens:** Developer doesn't know `TabLayout` exists or thinks exercise needs its own version.

**How to avoid:** The `StaffWorkspace` component should import `TabLayout` and pass staff roles as `SidebarItem[]`. The CONTEXT.md decision matches `TabLayout`'s API exactly (vertical sidebar, click to load content).

**Warning signs:** Any new CSS for sidebar collapsed/expanded state — `TabLayout` already handles this.

### Pitfall 2: Notification Schema Mismatch with MessageBus

**What goes wrong:** Custom notification system that bypasses MessageBus, creating two delivery paths.

**Why it happens:** MessageBus's `CreateMessageInput` type looks heavyweight; developer shortcuts with a simple REST poll.

**How to avoid:** Use MessageBus + WebSocket for real-time push, but also persist to `staff_notifications` table for history/badge counts. REST endpoint for loading historical notifications, WebSocket for real-time arrivals. See existing pattern in `PlanningBoardService.publishOrder()` which uses both.

**Warning signs:** Any `setInterval` polling in frontend notification code.

### Pitfall 3: ExerciseDashboard Rewrite Instead of Extension

**What goes wrong:** Completely replacing `ExerciseDashboard.tsx` rather than restructuring it to host `StaffWorkspace` as a mode.

**Why it happens:** Phase 15 changes the main content area, but `ExerciseDashboard` also has the scenario selector, perspective toggle, phase navigation, and controller toggle — all still needed.

**How to avoid:** Keep the `ExerciseDashboard` header row (scenario selector, perspective toggle, phase nav). Replace only the tab nav + content area below it with `StaffWorkspace`. The staff workspace renders within the existing scenario/phase context.

**Warning signs:** Removing the `scenario-selector`, `perspective-toggle`, or `phase-indicator` elements from `ExerciseDashboard.tsx`.

### Pitfall 4: Pre-Population Data Duplication

**What goes wrong:** Copying all IPB/COA content into `staff_products` records, creating sync problems when Phase 14 data changes.

**Why it happens:** Developer wants self-contained workspace; seems cleaner to copy.

**How to avoid:** Pre-populate `staff_products` with reference IDs in `structured` field (e.g., `{ ipbAssessmentId: "...", coaId: "..." }`). Load the referenced Phase 14 record at render time. Only staff edits/narrative live in `staff_products.content`.

**Warning signs:** Any `INSERT INTO staff_products ... SELECT ... FROM ipb_assessments` bulk copy pattern.

### Pitfall 5: Missing `enabled_roles` Filter in Sidebar

**What goes wrong:** All 8 roles always shown in sidebar regardless of exercise creator's configuration.

**Why it happens:** Easy to forget `enabledRoles` during implementation.

**How to avoid:** The `StaffWorkspace` component receives `scenario.enabledRoles` as a prop. Filter `STAFF_ROLES` array before rendering sidebar items. The Create Scenario modal should include a role-selection step with checkboxes.

### Pitfall 6: Strategic Import API Auth Mismatch

**What goes wrong:** The strategic import service can't query `/api/strategic/*` from within the backend (needs its own pool query, not HTTP call).

**Why it happens:** Thinking of `/api/strategic` as an external service rather than internal store.

**How to avoid:** `StrategicImportService` should directly import and use `objectiveStore`, `intentStore` from `backend/src/strategic/objectives/index.ts` and `backend/src/strategic/intent/index.ts` — not make HTTP calls to itself.

---

## Code Examples

Verified from codebase inspection:

### Reusing TabLayout for Staff Sidebar

```typescript
// Source: /home/vitalpointai/projects/ssr/frontend/src/components/tabs/TabLayout.tsx
import { TabLayout, type SidebarItem } from '../tabs/TabLayout';

const STAFF_ROLES: SidebarItem[] = [
  { id: 'commander', label: 'Commander' },
  { id: 'j2',        label: 'J2 Intelligence' },
  { id: 'j3',        label: 'J3 Operations' },
  { id: 'j35',       label: 'J35 Plans' },
  { id: 'j4',        label: 'J4 Logistics' },
  { id: 'j5',        label: 'J5 Strategic' },
  { id: 'j6',        label: 'J6 Comms' },
  { id: 'j1',        label: 'J1 Personnel' },
];

export function StaffWorkspace({ scenario, perspective, exercisePhase }: StaffWorkspaceProps) {
  const [activeRole, setActiveRole] = useState<string>('commander');
  const enabledItems = STAFF_ROLES.filter(r => scenario.enabledRoles.includes(r.id));

  return (
    <TabLayout
      items={enabledItems}
      selectedItem={activeRole}
      onSelectItem={setActiveRole}
    >
      <RoleWorkspaceContent
        roleKey={activeRole}
        scenarioId={scenario.id}
        exercisePhase={exercisePhase}
        perspective={perspective}
      />
    </TabLayout>
  );
}
```

### MessageBus Channel Subscribe Pattern

```typescript
// Source: /home/vitalpointai/projects/ssr/backend/src/messaging/message-bus.ts
// Source: /home/vitalpointai/projects/ssr/backend/src/api/messaging.ts (WebSocket pattern)

// Backend: publish to exercise staff channel
await bus.publish({
  sourceDid: publishedBy,
  sourceType: 'user',
  destinationType: 'channel',
  destinationTarget: `exercise.staff.${scenarioId}`,
  messageType: 'staff.product.published',
  payload: { productId, sourceRole, title, unreadCount },
  attributes: {
    classification: 'UNCLASS',
    releasability: [],
    dissemination: [],
    originator: publishedBy,
    orcon: false,
  },
});

// Frontend: subscribe to channel via WebSocket
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: `exercise.staff.${scenarioId}`
}));
```

### Express Route Pattern (from exercise.ts)

```typescript
// Source: /home/vitalpointai/projects/ssr/backend/src/api/exercise.ts
// All new routes follow this exact pattern:

exerciseRouter.post('/scenarios/:id/staff-products', async (req: Request, res: Response) => {
  try {
    const { roleKey, productType, title, structured, content } = req.body;
    // validate required fields...
    const product = await staffProductStore.create({
      scenarioId: req.params.id,
      roleKey,
      productType,
      title,
      structured: structured ?? {},
      content: content ?? '',
      status: 'draft',
      createdBy: (req.headers['x-did'] as string) || 'anonymous',
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed' });
  }
});
```

### Strategic Import (Internal Store Query)

```typescript
// Source: /home/vitalpointai/projects/ssr/backend/src/strategic/objectives/store.ts
// Source: /home/vitalpointai/projects/ssr/backend/src/strategic/intent/store.ts

// StrategicImportService — queries stores directly, not via HTTP
import { objectiveStore } from '../strategic/objectives/index.js';
import { intentStore } from '../strategic/intent/index.js';

class StrategicImportService {
  async importToCommanderWorkspace(scenarioId: string, importedBy: string): Promise<StaffProduct> {
    // Get approved strategic objectives from Design tab
    const objectives = await objectiveStore.findByStatus('APPROVED');
    const intent = await intentStore.findLatest(); // most recent commander's intent

    // Create or update Commander's strategic guidance product
    const existing = await staffProductStore.findOne(scenarioId, 'commander', 'strategic_guidance');

    const structured = {
      objectiveCount: objectives.length,
      objectives: objectives.map(o => ({ id: o.id, description: o.description, priority: o.priority })),
      intentId: intent?.id,
    };
    const content = this.buildGuidanceNarrative(objectives, intent);

    if (existing) {
      return staffProductStore.update(existing.id, { structured, content });
    }
    return staffProductStore.create({
      scenarioId,
      roleKey: 'commander',
      productType: 'strategic_guidance',
      title: 'Strategic Direction',
      structured,
      content,
      status: 'draft',
      createdBy: importedBy,
    });
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ExerciseDashboard horizontal tabs | StaffWorkspace vertical sidebar (role-based) | Phase 15 | Doctrinal alignment — mirrors real JPP staff structure |
| Generic exercise tabs (IPB, COAs, Orders) | Role-specific product workspaces | Phase 15 | Each role sees only their doctrinally-relevant products |
| No cross-staff visibility | Publish + notification + integrate flow | Phase 15 | Models real staff information sharing behavior |
| Strategic documents isolated in Design tab | Import button pulls Design tab data into Commander workspace | Phase 15 | Closes loop: strategy → exercise planning |

---

## Implementation Scope — Plan Breakdown Guidance

Research suggests these logical implementation units (planner will determine exact plan count and sequencing):

**Unit A — Database + Backend Foundation**
- `016-staff-workspaces.sql` migration (`staff_products`, `staff_notifications` tables + `enabled_roles` column on `exercise_scenarios`)
- `StaffProductStore` class (CRUD)
- `StaffNotificationService` (publish → notify pipeline, diff computation)
- `StrategicImportService` (pull from objectiveStore/intentStore)
- New REST routes in `exercise.ts` for staff products, notifications, and strategic import

**Unit B — Exercise Shell Restructure**
- `StaffWorkspace.tsx` + CSS (wraps `TabLayout` with role sidebar)
- `RoleDashboard.tsx` (per-role overview: product summary cards, recent activity, notification count)
- Modify `ExerciseDashboard.tsx` to replace tab-nav+content with `StaffWorkspace`
- Add `enabledRoles` to Create Scenario modal (role selection checkboxes)
- Update `exercise-service.ts` with staff product/notification API methods
- Update `ExerciseScenario` type with `enabledRoles`

**Unit C — Role Workspaces + Product Templates**
- `StaffProduct.tsx` + CSS (hybrid structured-field + rich text editor)
- Per-role product type definitions (what structured fields each product type has)
- Pre-population logic (seed J2 from IPB, J3/J35 from COA/orders, Commander from decisions)
- Initial Commander and J2 workspace implementations (highest priority)
- Remaining role workspaces (J3, J35, J4, J5, J6, J1)

**Unit D — Notifications + Diff Integration**
- `NotificationPanel.tsx` + CSS (bell icon, badge count, notification list)
- `ProductDiffView.tsx` + CSS (side-by-side diff, integrate button)
- WebSocket subscription hook for real-time badge updates
- Backend: mark-read, integrate endpoints

**Unit E — Strategic Direction Import + Agent Panel**
- "Import Strategic Direction" button in Commander workspace
- Strategic import endpoint wired end-to-end
- Collapsible AI agent suggestion panel (placeholder with interaction pattern)

---

## Open Questions

1. **Agent Suggestion Panel Implementation**
   - What we know: CONTEXT.md says "collapsible and non-intrusive, human stays in control"
   - What's unclear: Should this be a live AI call per product, or a pre-generated suggestion stored server-side? What model/agent configuration?
   - Recommendation: Implement as a "Generate Suggestion" button that calls the existing LLM config (same pattern as IPB assembly and COA scoring). Cache result in `staff_products.structured.agentSuggestion`. This keeps it non-intrusive and matches existing patterns.

2. **`enabled_roles` Default for Existing Scenarios**
   - What we know: The migration adds `enabled_roles` with a default of all 8 roles
   - What's unclear: Do existing Phase 14 scenarios get all roles enabled, or do they need to opt in?
   - Recommendation: Default to all roles for backward compatibility (`'{"commander","j2","j3","j35","j4","j5","j6","j1"}'`). Users can disable roles they don't want.

3. **J2 Pre-population Timing**
   - What we know: Pre-population should happen "the first time a workspace is opened"
   - What's unclear: Should this be triggered by the first GET to the workspace endpoint, or explicitly by the user?
   - Recommendation: Trigger on first GET to `/api/exercise/scenarios/:id/staff-workspaces/j2/products` — if empty, run seeding, then return seeded results. Idempotent (check before seeding).

4. **Diff View for Text Content (`content` field)**
   - What we know: `structured` diffs are field-level. `content` is freeform text.
   - What's unclear: Line-level diff for large narrative text is complex to render.
   - Recommendation: For `content` changes, show a one-paragraph AI-generated summary of what changed (stored in `diff_snapshot.contentSummary`) rather than a line-diff. Only show full text diff for small products. This matches the "view diff of what changed" decision without requiring a diff library.

---

## Sources

### Primary (HIGH confidence — codebase verified 2026-03-01)

| File | What Was Verified |
|------|------------------|
| `/home/vitalpointai/projects/ssr/frontend/src/components/tabs/TabLayout.tsx` | SidebarItem interface, collapsed/expanded state, exact reuse pattern |
| `/home/vitalpointai/projects/ssr/frontend/src/components/exercise/ExerciseDashboard.tsx` | Current tab structure, header layout, what to preserve vs replace |
| `/home/vitalpointai/projects/ssr/backend/src/messaging/message-bus.ts` | MessageBus.publish(), channel routing, deliverToChannel() signature |
| `/home/vitalpointai/projects/ssr/backend/src/api/messaging.ts` | WebSocket setup at `/ws/messages`, subscribe/unsubscribe protocol |
| `/home/vitalpointai/projects/ssr/backend/src/api/exercise.ts` | Route pattern, middleware, existing store instantiation |
| `/home/vitalpointai/projects/ssr/backend/src/exercise/types.ts` | All Phase 14 domain types available for pre-population |
| `/home/vitalpointai/projects/ssr/backend/database/014-exercise-tables.sql` | Exact schema of existing exercise tables for pre-population queries |
| `/home/vitalpointai/projects/ssr/backend/src/strategic/objectives/store.ts` | objectiveStore interface — confirmed direct import is correct pattern |
| `/home/vitalpointai/projects/ssr/backend/src/strategic/intent/store.ts` | intentStore interface — CommanderIntent type verified |
| `/home/vitalpointai/projects/ssr/frontend/src/App.tsx` | Navigation structure, exercise route isolation pattern |
| `/home/vitalpointai/projects/ssr/.planning/phases/14-friendly-adversary-ipb-complete-cycle/14-06-SUMMARY.md` | Confirmed what Phase 14 built and what data is available |
| `/home/vitalpointai/projects/ssr/frontend/package.json` | All frontend dependencies — confirmed no new libraries needed |
| `/home/vitalpointai/projects/ssr/backend/package.json` | All backend dependencies — confirmed pg-boss, ws, anthropic already present |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All dependencies confirmed present in package.json; no new packages required
- Architecture: HIGH — All patterns verified by direct codebase inspection; TabLayout reuse confirmed; MessageBus/WebSocket pattern verified
- Pitfalls: HIGH — All pitfalls derived from actual code structure; specifically the TabLayout reuse pitfall and strategic import pitfall are codebase-specific
- Doctrinal product templates: MEDIUM — JP 5-0 basis is well-established doctrine; specific field-level template design is Claude's discretion per CONTEXT.md

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable stack — only internal codebase changes could invalidate)
