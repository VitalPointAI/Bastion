# Phase 22: Training/Operational Global Mode - Research

**Researched:** 2026-03-05
**Domain:** Global application mode management, data isolation, UI state separation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Toggle lives in the header bar (UserStatusBar), always visible regardless of page
- Switching modes requires modal confirmation ("You are switching to OPERATIONAL mode. All actions will affect live data. Confirm?")
- Any authenticated user can toggle their own mode -- no role restriction
- Switching performs a clean context switch: navigates to workspace selector/home, each mode remembers its own last-active workspace independently
- Mode is persisted server-side per user account (not localStorage) -- consistent across devices, backend enforces data boundaries
- Training mode: persistent amber "EXERCISE - EXERCISE - EXERCISE" banner across the top, mimicking standard military exercise message headers
- Operational mode: clean UI with no indicator -- absence of exercise banner IS the indicator
- Banner only -- no theme changes, no accent color modifications. True "train as you fight" philosophy
- All documents/exports generated in training mode are auto-stamped with "EXERCISE" watermark
- Separate workspace sets per mode -- training mode has its own workspaces, operational mode has its own, they never mix
- WorkspaceContext filters workspace list by current user mode
- Loading an exercise scenario auto-generates a training-mode workspace pre-populated with the scenario's environment, forces, and phase structure
- Identical DAO governance process in both modes -- no fast-tracking in training
- Remove Train tab entirely from WorkspaceTabContainer -- training is a MODE, not a tab
- ExerciseDashboard and scenario management move into the training-mode workspace creation flow
- Training workspaces support reset to exercise phase checkpoints for replay and iteration
- Automatic AAR capture: all decisions, AI recommendations, governance votes, and outcomes are logged for post-exercise After-Action Review analysis
- When user logs in, mode defaults to operational (safe default)
- Backend API responses should include mode context so clients can verify they're showing the right data

### Claude's Discretion
- Exact modal confirmation copy and styling
- API endpoint design for mode persistence
- How exercise phase timeline integrates into workspace UI (sidebar, header, etc.)
- AAR data schema and capture mechanism
- Checkpoint/reset implementation details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

This phase introduces a global TRAINING/OPERATIONAL mode toggle that fundamentally changes how the BASTION application separates exercise data from live operational data. The core pattern is a user-level mode flag persisted server-side that acts as a filter across all workspace, data, and API interactions. The "train as you fight" principle means the UI, workflows, governance, and AI agents remain identical between modes -- the only differences are a visual exercise banner, data isolation boundaries, and the availability of training-specific features (checkpoints, reset, AAR).

The implementation touches three layers: (1) a backend mode persistence and enforcement layer adding a `mode` column to `user_profiles` and a mode-aware middleware, (2) a new React context (`ModeContext`) that sits between `UserProvider` and `WorkspaceProvider` in the component hierarchy, and (3) UI changes to `UserStatusBar`, `WorkspaceTabContainer`, `WorkspaceContext`, and `WorkspaceSwitcher` to filter and display mode-appropriate content. The existing exercise infrastructure (29 backend files, ExerciseDashboard, scenario management) provides a rich foundation that gets integrated into the training-mode workspace creation flow rather than living in a separate tab.

The most critical architectural decision is that mode enforcement happens server-side. The backend API must include mode context in responses and reject cross-mode data access attempts. This prevents the dangerous scenario where a frontend bug could show training data in operational mode or vice versa.

**Primary recommendation:** Implement a `ModeContext` provider wrapping `WorkspaceProvider`, backed by a server-side mode field on `user_profiles`, with mode-aware API middleware that filters all workspace and data queries by mode.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | UI framework | Already in use, project standard |
| react-router-dom | 7.0.0 | Routing and navigation | Already in use for workspace routes |
| Express | (project ver) | Backend API framework | Already in use, standard REST patterns |
| PostgreSQL | (project ver) | Mode persistence, AAR data storage | Already in use for all data stores |
| zod | (project ver) | Request validation schemas | Already in use in API routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No new libraries needed | -- | -- | All requirements met by existing stack |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side mode persistence | localStorage | REJECTED by user decision -- must be server-side for cross-device consistency and backend enforcement |
| Separate database per mode | Mode column on workspaces table | Mode column is simpler, workspace table already has workspace_id FK on exercise_scenarios |

**Installation:**
```bash
# No new dependencies required -- all existing libraries sufficient
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
  context/
    ModeContext.tsx              # NEW: Global mode state + toggle + banner control
  components/
    UserStatusBar.tsx            # MODIFY: Add mode toggle button
    ModeConfirmationModal.tsx    # NEW: Confirmation dialog for mode switch
    ExerciseBanner.tsx           # NEW: Amber "EXERCISE" banner component
    workspace/
      WorkspaceTabContainer.tsx  # MODIFY: Remove 'train' tab
      WorkspaceContext.tsx       # MODIFY: Filter memberships by mode
      WorkspaceSwitcher.tsx      # MODIFY: Filter workspace list by mode
      CreateWorkspaceWizard.tsx  # MODIFY: Auto-set mode on new workspace
    exercise/
      ExerciseDashboard.tsx      # MODIFY: Integrate into workspace creation flow

backend/src/
  api/
    user-mode.ts                # NEW: Mode GET/PUT endpoints
    workspaces.ts               # MODIFY: Mode-aware workspace queries
  middleware/
    mode-context.ts             # NEW: Extract mode from user, attach to request
  workspace/
    workspace-store.ts          # MODIFY: Add mode column to workspaces table
    types.ts                    # MODIFY: Add mode to Workspace type
  exercise/
    aar-store.ts                # NEW: After-Action Review data capture
    checkpoint-store.ts         # NEW: Exercise checkpoint/reset state
```

### Pattern 1: Mode Context Provider
**What:** A React context that holds the current mode, provides toggle function, and manages the exercise banner visibility. Sits above WorkspaceProvider in the component tree so workspace filtering can read mode.
**When to use:** Every component that needs to know if the app is in training or operational mode.
**Example:**
```typescript
// frontend/src/context/ModeContext.tsx
type AppMode = 'training' | 'operational';

interface ModeContextType {
  mode: AppMode;
  isTraining: boolean;
  requestModeSwitch: (target: AppMode) => void;  // Opens confirmation modal
  confirmModeSwitch: () => Promise<void>;          // Executes switch after confirmation
  loading: boolean;
}

// Provider hierarchy in App.tsx:
// UserProvider > ModeProvider > WorkspaceProvider > AppContent
```

### Pattern 2: Server-Side Mode Enforcement
**What:** Backend middleware that reads the user's mode from the database and attaches it to the request context. All workspace and data queries filter by this mode.
**When to use:** Every API endpoint that returns workspace-scoped or exercise-scoped data.
**Example:**
```typescript
// backend/src/middleware/mode-context.ts
// Add mode column to user_profiles table:
// ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS app_mode TEXT NOT NULL DEFAULT 'operational';

async function modeMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.accountId) {
    const result = await pool.query(
      'SELECT app_mode FROM user_profiles WHERE near_account_id = $1',
      [req.user.accountId]
    );
    req.userMode = result.rows[0]?.app_mode ?? 'operational';
  }
  next();
}

// All workspace API responses include mode context:
res.json({ ...data, _meta: { mode: req.userMode } });
```

### Pattern 3: Mode-Aware Workspace Filtering
**What:** Workspaces table gains a `mode` column (`'training' | 'operational'`). All workspace queries filter by the user's current mode. WorkspaceContext on the frontend filters memberships by mode before rendering.
**When to use:** WorkspaceContext.loadMemberships, WorkspaceSwitcher, WorkspaceSelector.
**Example:**
```typescript
// backend/src/workspace/workspace-store.ts
async listForUser(userDid: string, mode: AppMode): Promise<Workspace[]> {
  const result = await this.pool.query(
    `SELECT w.* FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_id = w.id
     WHERE wm.user_did = $1 AND w.mode = $2 AND wm.status = 'active'`,
    [userDid, mode]
  );
  return result.rows.map(rowToWorkspace);
}
```

### Pattern 4: Exercise Banner Component
**What:** Fixed-position amber banner at the top of the viewport, always visible in training mode. Uses CSS `position: sticky` or a layout slot above the header.
**When to use:** Rendered by ModeContext when `mode === 'training'`.
**Example:**
```typescript
// frontend/src/components/ExerciseBanner.tsx
export function ExerciseBanner() {
  return (
    <div className="exercise-banner" role="status" aria-live="polite">
      EXERCISE - EXERCISE - EXERCISE
    </div>
  );
}

// CSS:
// .exercise-banner {
//   background: #D97706;  /* amber-600 */
//   color: #000;
//   font-weight: 700;
//   text-align: center;
//   padding: 4px 0;
//   letter-spacing: 0.15em;
//   font-size: 0.75rem;
//   position: sticky;
//   top: 0;
//   z-index: 9999;
// }
```

### Pattern 5: AAR Event Capture
**What:** An append-only audit log table that captures every significant action in training mode: decisions, AI recommendations, governance votes, outcomes. Keyed by training workspace ID.
**When to use:** Insert on every action that creates or modifies operational data within a training-mode workspace.
**Example:**
```typescript
// backend/src/exercise/aar-store.ts
interface AAREvent {
  id: string;
  workspaceId: string;
  scenarioId: string;
  exercisePhase: string;
  eventType: 'decision' | 'ai_recommendation' | 'governance_vote' | 'outcome' | 'phase_change';
  actorDid: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}
```

### Pattern 6: Checkpoint/Reset for Training Workspaces
**What:** Snapshot workspace state at phase boundaries. Reset restores workspace to a checkpoint, discarding subsequent changes.
**When to use:** Training workspaces only. Phase transitions create automatic checkpoints. Users can manually trigger reset to any checkpoint.
**Example:**
```typescript
// backend/src/exercise/checkpoint-store.ts
interface ExerciseCheckpoint {
  id: string;
  workspaceId: string;
  scenarioId: string;
  exercisePhase: string;
  snapshotData: Record<string, unknown>;  // Serialized workspace state
  createdAt: Date;
}
```

### Anti-Patterns to Avoid
- **Mode in localStorage:** User decision explicitly requires server-side persistence. localStorage can desync across tabs/devices and cannot enforce backend data boundaries.
- **Per-workspace mode toggle:** Mode is GLOBAL per user, not per workspace. A single user must never be in training mode in one workspace and operational in another -- this prevents mixing.
- **Theme changes for training mode:** Decision explicitly states banner only, no theme/accent changes. "Train as you fight" means visual identity stays the same.
- **Role-gating the mode toggle:** Decision explicitly states any authenticated user can toggle. Do not add role checks.
- **Soft-deleting on reset:** Checkpoint reset should restore state, not delete training data. AAR events must persist even after reset.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirmation modal | Custom modal from scratch | Existing project modal patterns (if any) or simple React portal | Focus on mode logic, not modal mechanics |
| Database migrations | Manual ALTER TABLE in code | Existing `initWorkspaceTables` pattern with `ADD COLUMN IF NOT EXISTS` | Project uses idempotent table init pattern already |
| Mode state management | Redux/Zustand state | React Context (ModeContext) | Project uses React Context exclusively; no state library in deps |
| API validation | Manual request parsing | zod schemas (already used in all API routes) | Consistent with existing validation patterns |

**Key insight:** This phase is primarily a data architecture and filtering concern, not a UI widget challenge. The bulk of complexity is in ensuring server-side data isolation, not in building toggle buttons.

## Common Pitfalls

### Pitfall 1: Mode Desync Between Frontend and Backend
**What goes wrong:** Frontend shows training-mode workspaces but backend returns operational data, or vice versa.
**Why it happens:** Mode is changed on one device but cached on another; API calls don't include mode verification.
**How to avoid:** Backend includes `_meta.mode` in every workspace API response. Frontend ModeContext verifies received mode matches expected mode. If mismatch, force a mode refresh.
**Warning signs:** Users seeing workspaces from the wrong mode in the switcher.

### Pitfall 2: Stale Workspace List After Mode Switch
**What goes wrong:** After toggling mode, the workspace list still shows workspaces from the previous mode.
**Why it happens:** WorkspaceContext caches memberships and doesn't re-fetch on mode change.
**How to avoid:** ModeContext.confirmModeSwitch must call WorkspaceContext.refreshMemberships after the mode API call succeeds. Navigate to workspace selector (home) to force fresh state.
**Warning signs:** Workspace count not changing after mode toggle.

### Pitfall 3: Orphaned Training Workspaces
**What goes wrong:** Exercise scenario creates a training workspace, but the workspace has no mode column set, making it invisible in both modes.
**Why it happens:** Workspace creation path doesn't set the mode column, or migration didn't backfill existing workspaces.
**How to avoid:** (1) Default mode to 'operational' in the migration for existing workspaces. (2) Exercise scenario workspace creation explicitly sets mode='training'. (3) CreateWorkspaceWizard reads current mode from ModeContext.
**Warning signs:** Workspace count drops after migration; training workspaces not appearing.

### Pitfall 4: AAR Data Lost on Checkpoint Reset
**What goes wrong:** Resetting to a checkpoint also deletes the AAR events generated after that checkpoint.
**Why it happens:** Reset deletes or overwrites data without preserving the audit trail.
**How to avoid:** AAR events are in a separate table, never deleted by checkpoint reset. Checkpoint reset only restores workspace operational state (COAs, orders, products), not the AAR log.
**Warning signs:** AAR analysis showing incomplete data after exercises that involved resets.

### Pitfall 5: Train Tab Removal Breaking Existing Bookmarks/URLs
**What goes wrong:** Users who bookmarked `/workspace/:id/train` get a 404 or broken state.
**Why it happens:** Removing 'train' from WORKSPACE_TABS without adding a redirect.
**How to avoid:** Add a fallback in WorkspaceTabContainer that redirects unknown tab URLs to the default tab ('cop').
**Warning signs:** 404 errors in browser console for train tab URLs.

### Pitfall 6: Exercise Banner Overlapping Header
**What goes wrong:** The exercise banner pushes content down or overlaps the header bar, causing layout shifts.
**Why it happens:** Banner inserted without adjusting the overall layout flow.
**How to avoid:** Place the banner ABOVE the header in the DOM, as a fixed-height element in the flex layout. Adjust `app-header` top position or use a wrapper div.
**Warning signs:** Content jumping when entering/leaving training mode; header partially hidden.

## Code Examples

### Mode Toggle in UserStatusBar
```typescript
// frontend/src/components/UserStatusBar.tsx (additions)
import { useMode } from '../context/ModeContext';

export function UserStatusBar() {
  const { mode, isTraining, requestModeSwitch } = useMode();
  // ... existing code ...

  return (
    <div className="user-status-bar" ref={dropdownRef}>
      {/* Mode toggle button - always visible */}
      <button
        className={`mode-toggle ${isTraining ? 'mode-training' : 'mode-operational'}`}
        onClick={() => requestModeSwitch(isTraining ? 'operational' : 'training')}
        title={`Switch to ${isTraining ? 'Operational' : 'Training'} mode`}
      >
        {isTraining ? 'TRAINING' : 'OPERATIONAL'}
      </button>
      {/* ... existing user status trigger ... */}
    </div>
  );
}
```

### Mode API Endpoints
```typescript
// backend/src/api/user-mode.ts
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth-instance.js';
import { getPool } from '../lib/database.js';

const router = Router();

const ModeSchema = z.object({
  mode: z.enum(['training', 'operational']),
});

// GET /api/user-mode — get current mode
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT app_mode FROM user_profiles WHERE near_account_id = $1',
    [req.user.accountId]
  );
  res.json({ mode: result.rows[0]?.app_mode ?? 'operational' });
});

// PUT /api/user-mode — set mode
router.put('/', requireAuth, async (req: Request, res: Response) => {
  const { mode } = ModeSchema.parse(req.body);
  const pool = getPool();
  await pool.query(
    'UPDATE user_profiles SET app_mode = $1, updated_at = NOW() WHERE near_account_id = $2',
    [mode, req.user.accountId]
  );
  res.json({ mode });
});

export default router;
```

### WorkspaceContext Mode Filtering
```typescript
// frontend/src/context/WorkspaceContext.tsx (modifications)
import { useMode } from './ModeContext';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { mode } = useMode();
  // ... existing state ...

  const loadMemberships = useCallback(async () => {
    if (!isAuthenticated || !userDID) return;
    setLoading(true);
    try {
      // Pass mode to API so backend filters by workspace mode
      const result = await workspaceService.listMyMemberships(userDID, mode);
      setMemberships(result);
      return result;
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, userDID, mode]); // mode in dependency array

  // Re-fetch when mode changes
  useEffect(() => {
    void loadMemberships();
  }, [loadMemberships]);
  // ...
}
```

### Train Tab Removal
```typescript
// frontend/src/components/workspace/WorkspaceTabContainer.tsx
// BEFORE:
const WORKSPACE_TABS = ['cop', 'decide', 'design', 'campaign', 'train', 'overview'] as const;

// AFTER:
const WORKSPACE_TABS = ['cop', 'decide', 'design', 'campaign', 'overview'] as const;

// Also remove from DEFAULT_TAB_ACCESS for all roles
// Also remove TrainTab import and its case in the tab content renderer
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Train tab inside workspace | Global mode toggle | Phase 22 | Exercise/training is a mode, not a feature tab |
| Exercise scenarios independent of workspaces | Exercise scenarios create training workspaces | Phase 22 | Training uses the same workspace UX as operations |
| No data isolation between exercise and operational | Mode column on workspaces table + API filtering | Phase 22 | Prevents mixing training and operational data |

**Deprecated/outdated:**
- `TrainTab` component: Will be removed; functionality absorbed into training-mode workspace creation
- `WORKSPACE_TABS` including 'train': Train tab replaced by mode concept

## Open Questions

1. **Checkpoint Data Granularity**
   - What we know: Training workspaces should support reset to exercise phase checkpoints
   - What's unclear: How much workspace state to snapshot -- all products? All COAs? DAO proposals? The workspace database has many related tables (members, products, orders, tasks, COAs, IPB assessments)
   - Recommendation: Start with snapshotting exercise-scoped data only (scenario phases, products, COAs, orders, tasks). Workspace membership and governance state should NOT reset -- only the "planning content" resets.

2. **Existing Exercise Scenarios Migration**
   - What we know: There are existing exercise scenarios (e.g., Pacific Strategy AY26) that predate the workspace system
   - What's unclear: Whether existing scenarios need migration to training-mode workspaces or can remain as legacy
   - Recommendation: Existing scenarios remain accessible through the training-mode workspace creation flow. When a user creates a workspace from an existing scenario, it creates a new training workspace populated with scenario data.

3. **AAR Capture Granularity**
   - What we know: AAR should capture decisions, AI recommendations, governance votes, and outcomes
   - What's unclear: Whether to capture at the API request level (every write) or at the domain event level (significant actions only)
   - Recommendation: Domain event level. Add AAR event insertion to key action handlers: COA decisions, order publications, governance votes, AI role runs, phase transitions. Not every minor edit.

4. **Exercise Phase Timeline UI Location**
   - What we know: Phase control and exercise timeline should live within the workspace UI
   - What's unclear: Exactly where -- COP sidebar, a header sub-bar, or embedded in the workspace dashboard
   - Recommendation: Add exercise phase controls as a collapsible section in the COP sidebar for training-mode workspaces. This keeps the main tab structure clean while making phase control accessible.

## Sources

### Primary (HIGH confidence)
- Project codebase analysis:
  - `frontend/src/context/WorkspaceContext.tsx` -- workspace state management patterns
  - `frontend/src/context/UserContext.tsx` -- user identity context pattern
  - `frontend/src/components/UserStatusBar.tsx` -- header component where toggle lives
  - `frontend/src/components/workspace/WorkspaceTabContainer.tsx` -- tab system with role gating
  - `backend/src/workspace/workspace-store.ts` -- workspace CRUD with idempotent table init
  - `backend/src/workspace/types.ts` -- workspace type definitions
  - `backend/src/api/user-profile.ts` -- user profile table structure (mode column target)
  - `backend/src/api/workspaces.ts` -- workspace API patterns with zod validation
  - `backend/src/exercise/types.ts` -- exercise scenario types and staff role config
  - `frontend/src/App.tsx` -- component hierarchy and routing structure

### Secondary (MEDIUM confidence)
- CONTEXT.md user decisions -- all architectural choices locked by user discussion

### Tertiary (LOW confidence)
- None -- this phase is primarily internal architecture using existing project patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries; entirely existing project stack
- Architecture: HIGH - Patterns directly derived from existing codebase analysis (WorkspaceContext, UserContext, workspace-store idempotent init)
- Pitfalls: HIGH - Derived from analysis of actual data flow between frontend contexts and backend API responses

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable -- no external dependencies to track)
