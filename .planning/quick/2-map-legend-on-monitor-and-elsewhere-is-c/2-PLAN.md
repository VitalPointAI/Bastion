---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/validity/ValidityMap.css
  - frontend/src/components/graph/GraphExplorer.css
autonomous: true
requirements: [QUICK-2]

must_haves:
  truths:
    - "Map legend on /monitor is fully visible without clipping at the bottom"
    - "Graph legend on /monitor graph view is fully visible without clipping"
    - "Legends scroll internally when content exceeds available space"
  artifacts:
    - path: "frontend/src/components/validity/ValidityMap.css"
      provides: "Fixed map legend positioning"
    - path: "frontend/src/components/graph/GraphExplorer.css"
      provides: "Fixed graph legend positioning"
  key_links: []
---

<objective>
Fix map legend clipping on /monitor and other views where absolutely-positioned legends extend beyond their container bounds, causing the bottom portion to be hidden.

Purpose: The ValidityMap legend (bottom-left) and GraphExplorer legend (top-right) are absolutely positioned inside containers with overflow:hidden, which clips the legend when it is taller than the available space. The legends have max-height and overflow-y:auto but the calculations are wrong or the parent clipping prevents visibility.
Output: Legends are fully visible and scroll internally when content exceeds space.
</objective>

<execution_context>
@/home/vitalpointai/.claude/get-shit-done/workflows/execute-plan.md
@/home/vitalpointai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/validity/ValidityMap.css
@frontend/src/components/validity/ValidityMap.tsx
@frontend/src/components/graph/GraphExplorer.css
@frontend/src/components/graph/GraphExplorer.tsx
@frontend/src/components/validity/StrategicValidityDashboard.css
@frontend/src/components/tabs/TabLayout.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix ValidityMap legend clipping</name>
  <files>frontend/src/components/validity/ValidityMap.css</files>
  <action>
Fix the `.validity-map .map-legend` CSS to prevent bottom clipping.

Current issue: The legend is positioned `bottom: 20px; left: 20px` inside `.validity-map` which itself sits inside `.fullscreen-view` (overflow: hidden) and `.tab-content` (overflow: auto). The legend's `max-height: calc(100% - 80px)` references the parent height, but when the parent has overflow:hidden, the legend bottom can still extend beyond the visible area.

Changes to `ValidityMap.css`:
1. Change `.map-legend` max-height from `calc(100% - 80px)` to `calc(100% - 40px)` to leave proper margin for top+bottom (20px bottom position + 20px top clearance)
2. Ensure `overflow-y: auto` is present (already is)
3. Add `scrollbar-width: thin` and `scrollbar-color: rgba(74, 158, 255, 0.3) transparent` for Firefox thin scrollbar
4. Add `::-webkit-scrollbar` styles (width: 4px, thumb with rgba(74,158,255,0.3) and border-radius 2px, transparent track) for Chromium browsers

The key insight: the legend is inside `.validity-map` (position:relative, height:100%). The `.map-container` (the Leaflet map) takes the full height. The legend floats over it. The parent chain (.fullscreen-view > .validity-map) clips at the container boundary. The max-height calculation must account for both the bottom offset (20px) AND equivalent top margin so the legend never extends past the top of the container. Use `max-height: calc(100% - 50px)` (20px bottom + 30px top clearance for the legend to not butt against top edge).
  </action>
  <verify>Run `cd /home/vitalpointai/projects/ssr && npx tsc --noEmit --project frontend/tsconfig.json 2>&1 | head -5` to confirm no build issues. Visually inspect that the CSS changes are syntactically valid.</verify>
  <done>ValidityMap legend has corrected max-height constraint and styled thin scrollbars, preventing bottom clipping while allowing scroll for overflow content.</done>
</task>

<task type="auto">
  <name>Task 2: Fix GraphExplorer legend clipping</name>
  <files>frontend/src/components/graph/GraphExplorer.css</files>
  <action>
Fix the `.graph-legend` CSS to prevent bottom clipping in the graph view.

Current issue: The graph legend is positioned `top: 16px; right: 16px` inside `.graph-container` which has `overflow: hidden`. The legend has `max-height: 50vh` but when the graph is rendered inside a split view or a shorter container (e.g., split mode gives half viewport), 50vh can exceed the container height causing bottom clipping.

Changes to `GraphExplorer.css`:
1. Change `.graph-legend` max-height from `50vh` to `calc(100% - 32px)` so it is relative to the actual `.graph-container` height rather than the viewport height. This accounts for 16px top position + 16px bottom clearance.
2. Add `overflow-y: auto` (already present)
3. Change `pointer-events: none` to `pointer-events: auto` so users can scroll the legend if it overflows (currently pointer-events:none prevents scroll interaction)
4. Add `scrollbar-width: thin` and `scrollbar-color: rgba(74, 158, 255, 0.3) transparent` for Firefox
5. Add `.graph-legend::-webkit-scrollbar` (width: 4px), `.graph-legend::-webkit-scrollbar-thumb` (background: rgba(74,158,255,0.3), border-radius: 2px), `.graph-legend::-webkit-scrollbar-track` (background: transparent)
  </action>
  <verify>Run `cd /home/vitalpointai/projects/ssr && npx tsc --noEmit --project frontend/tsconfig.json 2>&1 | head -5` to confirm no build issues. Visually inspect CSS syntax.</verify>
  <done>GraphExplorer legend uses container-relative max-height instead of viewport-relative, has scrollable overflow with thin scrollbar styling, and allows pointer events for scroll interaction.</done>
</task>

</tasks>

<verification>
1. Start dev server: `cd /home/vitalpointai/projects/ssr/frontend && npm run dev`
2. Navigate to /monitor (Map view) - the map legend in bottom-left should be fully visible with all three sections (Events, Actors, Tensions) readable
3. Switch to Graph view - the graph legend in top-right should be fully visible with all sections (Actors, Relationships, Line Style)
4. Switch to Split view - both legends should remain visible and not clip, even in the compressed height
5. Resize browser to smaller height - legends should gain internal scrollbar rather than getting clipped
</verification>

<success_criteria>
- Map legend bottom edge is visible (not clipped by container overflow)
- Graph legend bottom edge is visible in all view modes (map, graph, split)
- Legends scroll internally with thin styled scrollbar when content exceeds available space
- No TypeScript build errors
</success_criteria>

<output>
After completion, create `.planning/quick/2-map-legend-on-monitor-and-elsewhere-is-c/2-SUMMARY.md`
</output>
