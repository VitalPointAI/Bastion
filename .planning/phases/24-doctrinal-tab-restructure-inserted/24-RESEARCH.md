# Phase 24: Doctrinal Tab Restructure - Research

**Researched:** 2026-03-06
**Domain:** React tab navigation restructure, JP 5-0 doctrinal alignment
**Confidence:** HIGH

## Summary

Phase 24 replaces the current 5-tab structure (COP / Decide / Design / Campaign / Overview) with a 6-tab doctrinal lifecycle flow (Understand / Design / Plan / Direct / COP / Assess). This is primarily a reorganization of existing components -- no new functional capabilities are built. The work touches the frontend tab container (`ProblemSetTabContainer.tsx`), three tab component files that get renamed/reorganized, the backend panel config store, the ProblemSetContext notification mapping, and React Router URL handling.

The codebase is well-structured for this change. The `ProblemSetTabContainer` centralizes all tab definitions in a single `PROBLEM_SET_TABS` constant, `TAB_LABELS` map, and `DEFAULT_TAB_ACCESS` role map. The `TabLayout` component is generic and reusable. The backend panel config store has its own `DEFAULT_VISIBILITY_BY_ECHELON` that needs parallel updates. The existing stale-URL redirect pattern (lines 174-178) already handles invalid tab names and can be extended for old-to-new redirects.

**Primary recommendation:** Work from the center outward -- update tab definitions and routing first, then rename/redistribute component files, then update backend config, then handle redirects and notification mappings last.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Strategic Documents (StrategicDashboard) move from Design tab to Understand tab
- Overview tab (ProblemSetDashboard) is removed entirely -- no replacement
- COP tab stays as COP -- unchanged
- All 6 tabs (Understand / Design / Plan / Direct / COP / Assess) visible from day one, even if some only have placeholder content
- Empty tabs show a doctrinal placeholder: brief description of tab's doctrinal purpose, what it will contain, and which future phase delivers it
- Each placeholder includes a visual workflow position indicator -- horizontal progress bar showing Understand > Design > Plan > Direct > COP > Assess with current tab highlighted
- Tab display order: Understand / Design / Plan / Direct / COP / Assess
- Default landing tab: COP (unchanged)
- All roles see all 6 tabs -- no role-based tab restrictions for now
- Old tab URLs (/decide, /campaign, /design, /overview) redirect to the new tab that inherited their content
- Old tab component files (DecideTab.tsx, DesignTab.tsx, CampaignTab.tsx) renamed to new tab identities; old files deleted (clean break)
- Notification badges mapped to new tab names -- update activity-type-to-tab mapping in ProblemSetContext
- Full rename pass across backend: panel config table, activity type mappings, API routes -- complete consistency
- Update both frontend AND backend (panel config API) to reflect new tab names

### Claude's Discretion
- Exact distribution of Decide tab sidebar items (Governance, Proposals, MDMP Workflow, Escalation, Data Sharing) across new tabs -- follow JP 5-0 doctrinal alignment
- Whether missions go in Direct or Plan tab
- Whether ProblemSetDashboard metrics are repurposed as seed content for Assess tab or Assess gets a clean placeholder
- Whether right-aligned tab bar actions (Invite, Members, Directory, Settings, Org) stay in tab bar or move to a separate header area

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI framework | Already in use |
| React Router | 6.x | URL-driven tab state via `useParams`/`useNavigate` | Already in use |
| Tailwind CSS | 3.x | Styling for tab bar, placeholders, progress indicator | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TabLayout | internal | Sidebar + content panel for tabs with sub-navigation | Reuse for tabs that have multiple sidebar items |
| ProblemSetContext | internal | Tab notification state, cross-problem-set updates | Update activity-type-to-tab mapping |

No new dependencies required. This phase uses only existing libraries.

## Architecture Patterns

### Recommended Approach
```
frontend/src/components/tabs/
├── UnderstandTab.tsx    # NEW: StrategicDashboard (moved from DesignTab)
├── DesignTab.tsx        # REPURPOSED: empty placeholder (content removed to Understand)
├── PlanTab.tsx          # NEW: replaces CampaignTab or placeholder
├── DirectTab.tsx        # NEW: replaces CampaignTab or placeholder
├── COPTab.tsx           # UNCHANGED (lives in ../cop/)
├── AssessTab.tsx        # NEW: clean placeholder
├── DoctrinalPlaceholder.tsx  # NEW: reusable placeholder component
├── TabLayout.tsx        # UNCHANGED
└── TabLayout.css        # UNCHANGED

Old files to DELETE:
├── CampaignTab.tsx      # Content moved to Plan or Direct
├── MonitorTab.tsx       # Already dead (Phase 21 removed Monitor)
├── TrainTab.tsx         # Already dead (Phase 22 removed Train)
```

### Pattern 1: Centralized Tab Definitions
**What:** All tab identity lives in `ProblemSetTabContainer.tsx` constants -- `PROBLEM_SET_TABS`, `TAB_LABELS`, `DEFAULT_TAB_ACCESS`.
**When to use:** Always -- this is the single source of truth.
**Example:**
```typescript
// Current (to be replaced):
const PROBLEM_SET_TABS = ['cop', 'decide', 'design', 'campaign', 'overview'] as const;

// New:
const PROBLEM_SET_TABS = ['understand', 'design', 'plan', 'direct', 'cop', 'assess'] as const;
type ProblemSetTab = typeof PROBLEM_SET_TABS[number];

const TAB_LABELS: Record<ProblemSetTab, string> = {
  understand: 'Understand',
  design: 'Design',
  plan: 'Plan',
  direct: 'Direct',
  cop: 'COP',
  assess: 'Assess',
};
```

### Pattern 2: Doctrinal Placeholder Component
**What:** A reusable placeholder for tabs that don't have content yet, showing doctrinal purpose and workflow position.
**When to use:** For any tab that lacks functional content (Design, Plan, Direct, Assess at minimum).
**Example:**
```typescript
interface DoctrinalPlaceholderProps {
  tabId: string;
  tabName: string;
  description: string;      // Doctrinal purpose of this tab
  futureContent: string;    // What it will contain
  deliveredBy: string;      // Which future phase delivers it
}

// The workflow position indicator is a horizontal bar:
// Understand > Design > Plan > Direct > COP > Assess
// with the current tab highlighted via a distinct style
```

### Pattern 3: Old URL Redirect Map
**What:** Extend the existing stale-URL redirect (line 174-178 of ProblemSetTabContainer) to map old tab slugs to new ones.
**When to use:** For backward compatibility with bookmarks and any hardcoded links.
**Example:**
```typescript
const OLD_TAB_REDIRECTS: Record<string, ProblemSetTab> = {
  'decide': 'direct',      // or wherever Decide content lands
  'campaign': 'plan',      // or 'direct' depending on mission placement
  'overview': 'cop',       // Overview removed; default to COP
  'monitor': 'cop',        // Already dead but handle gracefully
  'train': 'cop',          // Already dead but handle gracefully
};

// In the stale-URL redirect effect:
useEffect(() => {
  if (urlTab && !PROBLEM_SET_TABS.includes(urlTab as ProblemSetTab) && problemSetId) {
    const redirect = OLD_TAB_REDIRECTS[urlTab] ?? 'cop';
    navigate(`/problem-set/${problemSetId}/${redirect}`, { replace: true });
  }
}, [urlTab, problemSetId, navigate]);
```

### Anti-Patterns to Avoid
- **Partial rename:** Do NOT leave old tab names in backend while updating frontend -- causes silent failures when panel config returns tab names the frontend doesn't recognize.
- **Role-gating complexity now:** The user explicitly decided all roles see all 6 tabs. Do NOT preserve the complex `DEFAULT_TAB_ACCESS` per-role map -- simplify to all-access. Keep the structure so role-gating can be restored later, but default everyone to all tabs.
- **Building new tab content:** This phase restructures the shell only. Do NOT build functional content for Understand, Plan, Direct, or Assess beyond relocating existing components.

## JP 5-0 Doctrinal Alignment (Claude's Discretion Recommendations)

### Decide Tab Content Distribution

Based on JP 5-0 (Joint Planning) doctrinal alignment:

| Current Decide Item | Recommended New Tab | JP 5-0 Rationale |
|---------------------|---------------------|-------------------|
| Governance Overview | **Direct** | Governance is commander's authority to direct -- aligns with command authority functions |
| Proposals & Voting | **Direct** | Proposals are decision instruments used to authorize and direct action |
| MDMP Workflow | **Plan** | MDMP is the planning methodology -- belongs squarely in the planning phase |
| Escalation | **Direct** | Escalation routes decisions up the chain of command -- a directing function |
| Data Sharing (Subscriptions) | **Understand** | Information sharing feeds situational understanding |

### Mission Placement

**Recommendation: Missions go in Plan tab.** JP 5-0 defines planning as developing courses of action and producing plans/orders. Missions are the output of planning. "Direct" is about issuing orders and executing -- missions are created in Plan, then executed from Direct. However, since Direct will initially be richer (governance + proposals + escalation), placing missions in Plan gives it meaningful content and better balances the tabs.

### ProblemSetDashboard Disposition

**Recommendation: Assess gets a clean placeholder.** The Overview/ProblemSetDashboard was a map view with activity feeds -- it doesn't cleanly map to "assessment" in the doctrinal sense (which involves measuring effectiveness against objectives). Repurposing it would create misleading content. A clean placeholder with a description of what assessment means doctrinally is more valuable.

### Right-Aligned Tab Bar Actions

**Recommendation: Keep in tab bar.** The actions (Invite, Members, Directory, Settings, Org) are problem-set-level operations, not tab-specific. They currently work well in the tab bar's right-aligned area and don't conflict with the new tab names. Moving them to a separate header would add visual complexity for no functional gain.

## Content Mapping Summary

| New Tab | URL Slug | Content | Source |
|---------|----------|---------|--------|
| **Understand** | `understand` | StrategicDashboard + Data Sharing (Subscriptions) | DesignTab + DecideTab sidebar item |
| **Design** | `design` | Placeholder (Phase 25 delivers Operational Design) | Empty |
| **Plan** | `plan` | Missions (MissionList/Detail/Wizard) + MDMP Workflow | CampaignTab + DecideTab sidebar item |
| **Direct** | `direct` | Governance + Proposals + Escalation | DecideTab sidebar items |
| **COP** | `cop` | COPTab (unchanged) | COPTab |
| **Assess** | `assess` | Clean placeholder (Phase 28+ delivers assessment) | New |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab notification system | Custom notification routing | Existing `tabNotifications` in ProblemSetContext -- just remap activity types | Notification infrastructure already works; only the type-to-tab mapping needs updating |
| Tab layout with sidebar | Custom sidebar layout | Existing `TabLayout` component | Already handles collapse, item selection, responsive |
| URL tab routing | Custom route handling | React Router `:tab` param pattern already in App.tsx | Pattern works, just change valid tab values |
| Backend panel config | Custom config system | Existing `ProblemSetPanelConfigStore` -- update default visibility maps | Upsert/getOrCreate pattern handles migration automatically |

## Common Pitfalls

### Pitfall 1: Backend Panel Config Stale Data
**What goes wrong:** Existing problem sets have panel configs persisted in PostgreSQL with old tab names (overview, decide, campaign). After frontend update, these configs return tab names the frontend doesn't recognize, so tabs silently disappear.
**Why it happens:** `getOrCreateDefault()` only creates defaults for NEW problem sets. Existing ones return stale data.
**How to avoid:** Write a DB migration (024-doctrinal-tabs.sql) that updates `panel_visibility` JSONB in `problem_set_panel_config` table to replace old tab names with new ones. Also update the `default_tab` column.
**Warning signs:** Users on existing problem sets see fewer tabs than expected after deploy.

### Pitfall 2: Notification Badge Mapping Gaps
**What goes wrong:** Activity types in `ProblemSetContext` map to old tab names ('escalations', 'directives', 'intelligence'). These don't match new tab slugs, so notification badges stop appearing.
**Why it happens:** The `activityTypeToTab` mapping in ProblemSetContext uses hardcoded strings that must match the tab keys in `PROBLEM_SET_TABS`.
**How to avoid:** Update `activityTypeToTab` in ProblemSetContext to use new tab slugs. Note the current mapping uses 'escalations'/'directives'/'intelligence' which don't even match current tab names -- they were never wired to badges properly. Map them to the correct new tabs.
**Warning signs:** No notification badges appear on any tab.

### Pitfall 3: Forgetting Dead Tab References
**What goes wrong:** Old tab names ('monitor', 'train') still referenced in backend panel config defaults and possibly other files.
**Why it happens:** These tabs were removed in Phases 21/22 but references persist in configuration.
**How to avoid:** Do a full codebase grep for all old tab names: 'monitor', 'train', 'decide', 'campaign', 'overview' and update every reference.
**Warning signs:** Console warnings, 404-like behavior, or TypeScript type errors.

### Pitfall 4: Tab Component Import Paths
**What goes wrong:** After renaming DecideTab.tsx to DirectTab.tsx, import paths in ProblemSetTabContainer break at runtime.
**Why it happens:** File renames require updating all import statements.
**How to avoid:** Rename files AND update all imports in ProblemSetTabContainer.tsx in the same commit. TypeScript compiler will catch missing imports.
**Warning signs:** Build fails with module-not-found errors.

## Code Examples

### New Tab Container renderTabContent
```typescript
function renderTabContent() {
  switch (activeTab) {
    case 'understand':
      return <UnderstandTab problemSetId={displayId} />;
    case 'design':
      return <DoctrinalPlaceholder
        tabId="design"
        tabName="Design"
        description="Operational Design translates strategic guidance into an operational approach. This is where commanders and planners develop the broad concept for achieving objectives."
        futureContent="Operational design workspace with center of gravity analysis, lines of effort/operation, decisive points, and operational approach visualization."
        deliveredBy="Phase 25"
      />;
    case 'plan':
      return <PlanTab problemSetId={displayId} daoId={activeProblemSet?.daoId} />;
    case 'direct':
      return <DirectTab problemSetId={displayId} daoId={activeProblemSet?.daoId} />;
    case 'cop':
      return <COPTab problemSetId={displayId} />;
    case 'assess':
      return <DoctrinalPlaceholder
        tabId="assess"
        tabName="Assess"
        description="Assessment measures progress toward accomplishing objectives and determines the effectiveness of ongoing operations. It enables adaptation of plans and operations."
        futureContent="Measures of effectiveness (MOEs), measures of performance (MOPs), assessment dashboards, and reframing triggers."
        deliveredBy="Phase 28+"
      />;
    default:
      return null;
  }
}
```

### DoctrinalPlaceholder Component Structure
```typescript
const ALL_TABS = ['understand', 'design', 'plan', 'direct', 'cop', 'assess'] as const;
const TAB_DISPLAY = {
  understand: 'Understand',
  design: 'Design',
  plan: 'Plan',
  direct: 'Direct',
  cop: 'COP',
  assess: 'Assess',
};

function DoctrinalPlaceholder({ tabId, tabName, description, futureContent, deliveredBy }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center max-w-2xl mx-auto">
      {/* Workflow position indicator */}
      <div className="flex items-center gap-1 mb-8 w-full max-w-lg">
        {ALL_TABS.map((t, i) => (
          <Fragment key={t}>
            <div className={`flex-1 py-1.5 rounded text-xs font-medium ${
              t === tabId
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400'
            }`}>
              {TAB_DISPLAY[t]}
            </div>
            {i < ALL_TABS.length - 1 && (
              <span className="text-gray-600 text-xs">{'>'}</span>
            )}
          </Fragment>
        ))}
      </div>

      <h2 className="text-xl font-semibold text-gray-200 mb-3">{tabName}</h2>
      <p className="text-sm text-gray-400 mb-6">{description}</p>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 w-full">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Coming in {deliveredBy}</h3>
        <p className="text-xs text-gray-500">{futureContent}</p>
      </div>
    </div>
  );
}
```

### Backend Panel Config Migration
```sql
-- 024-doctrinal-tabs.sql
-- Migrate panel_visibility JSONB from old tab names to new doctrinal tabs

-- Update panel_visibility: replace old tab name arrays with new ones
-- All roles now see all tabs (user decision), so simplify
UPDATE problem_set_panel_config
SET panel_visibility = (
  SELECT jsonb_object_agg(
    role_name,
    '["understand","design","plan","direct","cop","assess"]'::jsonb
  )
  FROM jsonb_each(panel_visibility) AS x(role_name, tabs)
),
default_tab = 'cop',
updated_at = NOW();

-- Also update the column default
ALTER TABLE problem_set_panel_config
  ALTER COLUMN default_tab SET DEFAULT 'cop';
```

## Files That Need Changes

### Frontend (primary)
| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/src/components/problem-set/ProblemSetTabContainer.tsx` | **Major edit** | New tab constants, new renderTabContent, new redirects, simplified role access |
| `frontend/src/components/tabs/DecideTab.tsx` | **Delete** | Content split to DirectTab + PlanTab + UnderstandTab |
| `frontend/src/components/tabs/DesignTab.tsx` | **Delete** | StrategicDashboard moved to UnderstandTab |
| `frontend/src/components/tabs/CampaignTab.tsx` | **Delete** | Missions moved to PlanTab |
| `frontend/src/components/tabs/UnderstandTab.tsx` | **Create** | StrategicDashboard + Data Sharing |
| `frontend/src/components/tabs/PlanTab.tsx` | **Create** | Missions + MDMP Workflow |
| `frontend/src/components/tabs/DirectTab.tsx` | **Create** | Governance + Proposals + Escalation |
| `frontend/src/components/tabs/AssessTab.tsx` | **Create** | Clean placeholder |
| `frontend/src/components/tabs/DoctrinalPlaceholder.tsx` | **Create** | Reusable placeholder with workflow indicator |
| `frontend/src/context/ProblemSetContext.tsx` | **Edit** | Update activityTypeToTab mapping |

### Backend
| File | Change Type | Description |
|------|-------------|-------------|
| `backend/src/problem-set/problem-set-panel-config-store.ts` | **Major edit** | New DEFAULT_VISIBILITY_BY_ECHELON with all 6 tabs, new default_tab values |
| `backend/src/db/migrations/024-doctrinal-tabs.sql` | **Create** | Migrate existing panel_visibility data |

### Cleanup
| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/src/components/tabs/MonitorTab.tsx` | **Delete** | Already dead since Phase 21 |
| `frontend/src/components/tabs/TrainTab.tsx` | **Delete** | Already dead since Phase 22 |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-role tab visibility | All roles see all tabs | Phase 24 (this phase) | Simplifies DEFAULT_TAB_ACCESS to a single all-access list |
| 5 tabs (COP/Decide/Design/Campaign/Overview) | 6 tabs (Understand/Design/Plan/Direct/COP/Assess) | Phase 24 (this phase) | Aligns with JP 5-0 doctrinal lifecycle |
| Overview as default tab | COP as default tab | Phase 21 | Already done, maintained |

## Open Questions

1. **Existing panel_visibility JSONB in production**
   - What we know: Existing problem sets have persisted configs with old tab names
   - What's unclear: How many existing records exist in production; whether any have been manually customized
   - Recommendation: Migration script should handle all cases by replacing all role arrays with the full 6-tab list (per user decision of all-roles-see-all-tabs)

2. **Activity type notification mapping completeness**
   - What we know: Current mapping uses 'escalations'/'directives'/'intelligence' which don't directly match tab slugs
   - What's unclear: Whether these badge counts ever worked correctly with the current tab structure
   - Recommendation: Map `escalation_received` to 'direct', `directive_received` to 'direct', and `data_change`/`subscription_*` to 'understand'

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `ProblemSetTabContainer.tsx` (431 lines) -- complete tab infrastructure
- Direct code inspection of `DecideTab.tsx`, `DesignTab.tsx`, `CampaignTab.tsx` -- content to redistribute
- Direct code inspection of `ProblemSetPanelConfigStore` -- backend panel config with default visibility maps
- Direct code inspection of `ProblemSetContext.tsx` -- notification badge mapping
- Direct code inspection of `App.tsx` -- React Router route definitions

### Secondary (MEDIUM confidence)
- JP 5-0 doctrinal alignment for content distribution -- based on military planning doctrine knowledge

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed, all existing patterns inspected
- Architecture: HIGH -- all source files read and understood, clear refactoring path
- Content mapping: HIGH -- user locked most decisions, discretion items have clear doctrinal basis
- Pitfalls: HIGH -- database migration risk and notification mapping verified through code inspection

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- internal reorganization only, no external dependencies)
