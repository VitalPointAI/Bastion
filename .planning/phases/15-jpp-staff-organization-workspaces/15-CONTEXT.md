# Phase 15: JPP Staff Organization Workspaces - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Reorganize the exercise workspace to mirror Joint staff organization. Provide role-based workspaces (Commander, J1-J6, J35) with templated doctrinal products, cross-staff real-time notifications, AI agent team integration, and strategic direction import from Design tab. Implementation scoped to the Exercise area first, with future extension to remodel the rest of the application.

</domain>

<decisions>
## Implementation Decisions

### Workspace Structure & Navigation
- Vertical sidebar within the exercise area listing available staff roles (Commander, J1, J2, J3, J35, J4, J5, J6)
- Users click a role in the sidebar to load that role's workspace in the main content area
- Free switching between any role workspace — no assignment-based restriction
- Roles are configurable per exercise — exercise creator chooses which roles to enable (could be minimal or full staff)
- Each role workspace opens to a dashboard overview showing: product summary, recent activity, pending notifications, and quick actions

### Doctrinal Product Templates
- Hybrid template approach: structured data fields (dropdowns, tables, maps) for data that feeds other products + freeform rich text sections for narrative analysis
- Products pre-populated from existing exercise data (Phase 14 IPB/COA work) — users refine rather than recreate from scratch
- Cross-product relationships use notification + manual pull: when a source product changes, linked products show a notification badge; user reviews and accepts/rejects the update
- Each role starts with their doctrinal default product set, but can also create custom products from a template library

### Cross-Staff Notifications
- Global notification panel (bell icon) for awareness + inline badges on affected products for context
- Explicit publish trigger — user clicks "Publish" or "Share" when a product is ready; work-in-progress stays private and does not trigger notifications
- Notification action: view diff of what changed in source product + "Integrate" button that pulls relevant changes into user's product with a preview

### Strategic Direction Import
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

</decisions>

<specifics>
## Specific Ideas

- Role sidebar should feel natural within the existing exercise area — extend current UI patterns rather than introducing new navigation paradigms
- Pre-population from Phase 14 data is key: J2 should see existing IPB products, threat assessments, and intelligence summaries immediately available in their workspace
- The publish/notification flow mirrors how real staff sections operate — products are shared when ready, not during draft state
- Commander workspace is the doctrinal entry point for strategic direction, reflecting how guidance flows in real Joint planning (Commander's Intent down to staff)
- AI agent suggestion panel should be collapsible and non-intrusive — human stays in control of when to incorporate agent output

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-jpp-staff-organization-workspaces*
*Context gathered: 2026-03-01*
