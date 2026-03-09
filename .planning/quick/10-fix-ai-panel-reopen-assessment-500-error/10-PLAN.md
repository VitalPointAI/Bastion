---
phase: quick-10
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/problem-set/ProblemSetTabContainer.tsx
  - frontend/src/hooks/useAIStaffFeed.ts
  - backend/src/assessment/metl-store.ts
  - backend/src/index.ts
autonomous: true
requirements: [FIX-AI-PANEL-REOPEN, FIX-ASSESSMENT-500, FIX-AI-FEED-TYPEERROR, FIX-STRATEGIC-GUIDANCE-404]

must_haves:
  truths:
    - "AI panel can be reopened after closing on process tabs"
    - "Assessment METL tasks endpoint does not 500 on concurrent init"
    - "useAIStaffFeed correctly iterates the feed response"
    - "Strategic guidance API responds with 200 instead of 404"
  artifacts:
    - path: "frontend/src/components/problem-set/ProblemSetTabContainer.tsx"
      provides: "AI panel reopen toggle button in tab bar"
    - path: "frontend/src/hooks/useAIStaffFeed.ts"
      provides: "Correct destructuring of { items } from feed response"
    - path: "backend/src/assessment/metl-store.ts"
      provides: "Mutex-guarded table initialization"
    - path: "backend/src/index.ts"
      provides: "strategicGuidanceRouter mounted at /api/strategic-guidance"
  key_links:
    - from: "ProblemSetTabContainer.tsx"
      to: "AIStaffContext dispatch.setOpen(true)"
      via: "toggle button onClick"
      pattern: "dispatch\\.setOpen\\(true\\)"
    - from: "useAIStaffFeed.ts"
      to: "ai-staff-router GET /feed response"
      via: "response.items destructure"
      pattern: "items.*=.*getFeed"
---

<objective>
Fix four runtime bugs: (1) AI panel cannot reopen after closing, (2) assessment METL 500 from concurrent table init race, (3) useAIStaffFeed TypeError from non-iterable response, (4) strategic-guidance 404s because router was never mounted.

Purpose: Resolve errors visible in browser console and blocking UI functionality.
Output: Four targeted fixes across frontend and backend.
</objective>

<execution_context>
@/home/vitalpointai/.claude/get-shit-done/workflows/execute-plan.md
@/home/vitalpointai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/problem-set/ProblemSetTabContainer.tsx
@frontend/src/hooks/useAIStaffFeed.ts
@frontend/src/context/AIStaffContext.tsx
@frontend/src/components/ai-staff/AIStaffPanel.tsx
@frontend/src/components/ai-staff/AIStaffDocked.tsx
@frontend/src/lib/ai-staff-service.ts
@backend/src/assessment/metl-store.ts
@backend/src/api/assessment-routes.ts
@backend/src/index.ts
@backend/src/strategic/guidance/routes.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix AI panel reopen, useAIStaffFeed TypeError, and strategic-guidance mount</name>
  <files>
    frontend/src/components/problem-set/ProblemSetTabContainer.tsx
    frontend/src/hooks/useAIStaffFeed.ts
    backend/src/index.ts
  </files>
  <action>
**Bug 1 — AI Panel reopen (ProblemSetTabContainer.tsx):**
The AIStaffPanel renders `null` when `isOpen` is false on process tabs (AIStaffPanel.tsx line 19). Closing the panel calls `dispatch.setOpen(false)` but no UI element exists to call `dispatch.setOpen(true)` or `dispatch.togglePanel()`.

Fix: Add a small toggle button in ProblemSetTabContainer.tsx, inside the `<div className="flex flex-1 overflow-hidden min-h-0">` wrapper, positioned at the right edge of the tab content area. The button should only appear on process tabs (understand, design, plan) when the panel is closed. Use the AIStaffContext's `useAIStaff()` for `isOpen` and `useAIStaffDispatch()` for `setOpen`.

Create a small inner component `AIStaffToggle` rendered inside the `AIStaffProvider` (it needs context access). Place it as a sibling before `<AIStaffPanel />` within the flex container. When `isOpen` is false and the active tab is a process tab (check with `isProcessTab` from AgentRoutingConfig), render a vertical edge button (fixed to right side) with an "AI" label and left-pointing chevron. On click, call `dispatch.setOpen(true)`. Import `isProcessTab` from `../ai-staff/AgentRoutingConfig.ts`.

Styling: Use inline styles or Tailwind. Button should be a narrow vertical strip on the right edge (e.g., `w-6 bg-gray-800 border-l border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-xs`). Write "AI" vertically. This ensures the user always has a way to reopen.

**Bug 3 — useAIStaffFeed TypeError (useAIStaffFeed.ts):**
The backend `GET /api/ai-staff/:problemSetId/feed` returns `{ items: [...], total: N }` (see ai-staff-router.ts line 67: `res.json({ items: ranked, total: ranked.length })`). But `useAIStaffFeed.ts` line 204 does `for (const item of items)` where `items` is the full response object (not an array), causing "I is not iterable".

Fix in `useAIStaffFeed.ts`: In both places where `aiStaffService.getFeed()` result is iterated (lines 113 and 204), extract the items array from the response. Change the `getFeed` call handling to account for the response shape:
- Line ~111-114 (refresh callback): Change to `const response = await aiStaffService.getFeed(problemSetId); const items = Array.isArray(response) ? response : (response as any).items ?? [];` then iterate `items`.
- Line ~202-209 (initial fetch): Same pattern — extract `.items` from the response before iterating.

This defensive pattern handles both possible response shapes (direct array or `{items}` wrapper).

**Bug 4 — strategic-guidance 404 (backend/src/index.ts):**
The router at `backend/src/strategic/guidance/routes.ts` exports `strategicGuidanceRouter` but it was never mounted in `index.ts`. The comment in routes.ts says "Mounted at /api/strategic-guidance (wired in a later plan)" — that wiring never happened.

Fix in `backend/src/index.ts`:
1. Add import: `import { strategicGuidanceRouter } from './strategic/guidance/routes.js';`
2. Add mount line after the assessment router mount (line ~210): `app.use('/api/strategic-guidance', strategicGuidanceRouter);`
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr && grep -n "strategicGuidanceRouter" backend/src/index.ts && grep -n "isProcessTab" frontend/src/components/problem-set/ProblemSetTabContainer.tsx && grep -n "\.items" frontend/src/hooks/useAIStaffFeed.ts</automated>
  </verify>
  <done>
    - ProblemSetTabContainer has a toggle button that calls setOpen(true) when AI panel is closed on process tabs
    - useAIStaffFeed extracts .items from the response object before iterating
    - strategicGuidanceRouter is imported and mounted at /api/strategic-guidance in index.ts
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix assessment METL store concurrent init race condition</name>
  <files>backend/src/assessment/metl-store.ts</files>
  <action>
**Bug 2 — Assessment 500 "duplicate key value violates unique constraint pg_type_typname_nsp_index":**
The `METLStore.init()` method (metl-store.ts) uses a simple boolean `this.initialized` to gate table creation. When multiple requests arrive concurrently before init completes, multiple calls pass the `if (!this.initialized)` check and all try to execute `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` simultaneously. While PostgreSQL handles concurrent `CREATE TABLE IF NOT EXISTS` gracefully, concurrent `CREATE INDEX IF NOT EXISTS` on the same table can race on internal type catalog entries, causing the `pg_type_typname_nsp_index` violation.

Fix: Replace the boolean flag with a stored Promise pattern (mutex via Promise deduplication). This ensures only one init executes and all concurrent callers await the same Promise.

Replace the `initialized` and `init()` pattern with:

```typescript
private initPromise: Promise<void> | null = null;

async init(): Promise<void> {
  if (!this.initPromise) {
    this.initPromise = initMETLTables().catch((err) => {
      // Reset on failure so next call retries
      this.initPromise = null;
      throw err;
    });
  }
  return this.initPromise;
}
```

This ensures:
- First call creates the promise and starts init
- Concurrent calls get the same promise and await it
- If init fails, the promise is reset so the next call retries

Also check the other assessment stores for the same pattern. Look at `aar-structured-store.ts`, `moe-store.ts`, `mop-store.ts` — if they have the same `initialized` boolean pattern, apply the same Promise-based fix to prevent the same race condition class.
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr && grep -n "initPromise" backend/src/assessment/metl-store.ts && echo "---" && grep -c "initialized = false" backend/src/assessment/*.ts</automated>
  </verify>
  <done>
    - METLStore.init() uses Promise deduplication instead of boolean flag
    - Concurrent requests to /api/assessment/metl/tasks/problem-set/:id no longer race on table creation
    - Same fix applied to any other assessment stores using the boolean pattern
  </done>
</task>

</tasks>

<verification>
1. `grep -n "strategicGuidanceRouter" backend/src/index.ts` — confirms router is imported and mounted
2. `grep -n "\.items" frontend/src/hooks/useAIStaffFeed.ts` — confirms response destructuring
3. `grep -n "setOpen(true)" frontend/src/components/problem-set/ProblemSetTabContainer.tsx` — confirms reopen button
4. `grep -n "initPromise" backend/src/assessment/metl-store.ts` — confirms Promise-based init
5. Build check: `cd frontend && npx tsc --noEmit 2>&1 | head -20` — no type errors introduced
</verification>

<success_criteria>
- AI panel shows a toggle button on the right edge when closed on process tabs (understand/design/plan)
- useAIStaffFeed correctly handles `{ items: [], total: N }` response shape without TypeError
- Assessment METL store uses Promise-based init preventing concurrent CREATE race conditions
- Strategic guidance routes respond at /api/strategic-guidance/instances/* (no more 404)
- Frontend builds without type errors
</success_criteria>

<output>
After completion, create `.planning/quick/10-fix-ai-panel-reopen-assessment-500-error/10-SUMMARY.md`
</output>
