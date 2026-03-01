# Phase 15: JPP Staff Organization Workspaces - Context

**Gathered:** 2026-03-01
**Updated:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Reorganize the exercise workspace to mirror Joint staff organization. Provide role-based workspaces (Commander, J1-J6, J35) with templated doctrinal products, cross-staff real-time notifications, AI agent team integration, and strategic direction import from Design tab. Implementation scoped to the Exercise area first, with future extension to remodel the rest of the application.

</domain>

<decisions>
## Implementation Decisions

### Workspace Structure & Navigation
- Vertical sidebar within the exercise area listing available staff roles (Commander, J1, J2, J3, J35, J4, J5, J6)
- Flat list of all roles in sidebar — all visible, simple click navigation (no grouping/collapsing)
- Users click a role in the sidebar to load that role's workspace in the main content area
- Free switching between any role workspace — no assignment-based restriction
- Roles are configurable per exercise — exercise creator chooses which roles to enable via role checklist during creation
- All roles enabled by default — creator can disable roles they don't need

### Role Dashboard
- Each role workspace opens to a task-centric dashboard overview
- Outstanding actions first: pending notifications, draft products needing attention
- Then product summary showing all products with status (draft/published/needs update)
- Recent activity and quick actions available below
- Commander's workspace doubles as the combined staff overview — Commander sees all published products from all roles in addition to their own workspace

### Doctrinal Product Templates
- Hybrid template approach: structured data fields (dropdowns, tables, maps) for data that feeds other products + freeform rich text sections for narrative analysis
- Stacked layout: structured fields on top, freeform narrative below — scroll down to write
- Products pre-populated from existing exercise data (Phase 14 IPB/COA work) as editable drafts — users can immediately edit and publish
- Cross-product relationships use notification + manual pull: when a source product changes, linked products show a notification badge; user reviews and accepts/rejects the update
- Each role starts with their doctrinal default product set, but can also create custom products from a template library
- Publish snapshots only for versioning — only published versions are tracked; drafts are just current state

### Publishing & Distribution
- Explicit publish trigger — user clicks "Publish" when a product is ready; work-in-progress stays private and does not trigger notifications
- Publishing broadcasts to all enabled roles — everyone sees it
- System highlights roles where the product is most relevant

### Cross-Staff Notifications
- Global notification panel (bell icon) shows everything across the exercise — one unified feed
- Filter toggle available to scope to current role workspace
- Notifications persist until explicitly dismissed — user marks them read/done
- Notification action: view diff of what changed in source product + "Integrate" button

### Integration Flow
- Auto-merge with preview: system proposes merged content — user reviews a before/after diff and confirms
- Diff view splits structured field changes (shown as summary table) from narrative text changes (shown as text diff below)

### Strategic Direction Import
- Manual import anytime — "Import Strategic Direction" button available in the exercise to pull latest from Design tab on demand
- Strategic direction imports into the Commander's workspace specifically
- Commander distributes guidance to other roles through the publish/notification system

### AI Agent Panel
- Collapsible right-side panel that slides open alongside the editor — non-intrusive, human stays in control
- On-demand only: user clicks "Generate Suggestion" button — AI stays silent until asked
- Agent teams configured per-role with per-product overrides: each role has a configured agent team (applies to all products), with ability to customize per product if needed
- Accept/reject blocks: suggestion broken into blocks — user accepts or rejects each piece individually

### Claude's Discretion
- Notification delivery mechanism (real-time WebSocket vs poll-based — pick what fits existing architecture)
- Dashboard component styling and exact layout per role
- Exact structured field types per doctrinal product template
- Which doctrinal products to pre-configure for each role (based on JP 5-0 and joint planning doctrine)

</decisions>

<specifics>
## Specific Ideas

- Role sidebar should feel natural within the existing exercise area — extend current UI patterns rather than introducing new navigation paradigms
- Pre-population from Phase 14 data is key: J2 should see existing IPB products, threat assessments, and intelligence summaries immediately available in their workspace as editable drafts
- The publish/notification flow mirrors how real staff sections operate — products are shared when ready, not during draft state
- Commander workspace is the doctrinal entry point for strategic direction, reflecting how guidance flows in real Joint planning (Commander's Intent down to staff)
- Commander's workspace also serves as the combined staff overview — they see all published products from all roles, matching the doctrinal role of the Commander as the integrating authority
- AI agent suggestion panel should feel like a helpful assistant, not an automatic generator — on-demand with accept/reject granularity

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-jpp-staff-organization-workspaces*
*Context gathered: 2026-03-01*
