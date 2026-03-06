# Phase 24: Doctrinal Tab Restructure - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current problem set tab structure (COP / Decide / Design / Campaign / Overview) with a doctrinal lifecycle flow (Understand / Design / Plan / Direct / COP / Assess). Reorganize existing components into doctrinally-aligned tabs. This phase does NOT build new functionality for any tab — it restructures the shell and relocates existing content.

</domain>

<decisions>
## Implementation Decisions

### Content mapping
- Strategic Documents (StrategicDashboard) move from Design tab to Understand tab
- Overview tab (ProblemSetDashboard) is removed entirely — no replacement
- Decide tab contents (Governance, Proposals, MDMP, Escalation, Data Sharing) distributed by doctrinal function — Claude's discretion on exact mapping
- Campaign tab missions — Claude's discretion on whether they land in Direct or Plan, based on JP 5-0 alignment
- COP tab stays as COP — unchanged

### New tab shells
- All 6 tabs (Understand / Design / Plan / Direct / COP / Assess) visible from day one, even if some only have placeholder content
- Empty tabs show a doctrinal placeholder: brief description of the tab's doctrinal purpose, what it will contain, and which future phase delivers it
- Each placeholder includes a visual workflow position indicator — a horizontal progress bar showing Understand > Design > Plan > Direct > COP > Assess with the current tab highlighted

### Tab ordering & role access
- Tab display order: Understand / Design / Plan / Direct / COP / Assess
- Default landing tab: COP (unchanged)
- All roles see all 6 tabs — no role-based tab restrictions for now
- Update both frontend AND backend (panel config API) to reflect new tab names

### Transition handling
- Old tab URLs (/decide, /campaign, /design, /overview) redirect to the new tab that inherited their content
- Old tab component files (DecideTab.tsx, DesignTab.tsx, CampaignTab.tsx) renamed to new tab identities; old files deleted (clean break)
- Notification badges mapped to new tab names — update activity-type-to-tab mapping in ProblemSetContext
- Full rename pass across backend: panel config table, activity type mappings, API routes — complete consistency

### Claude's Discretion
- Exact distribution of Decide tab sidebar items (Governance, Proposals, MDMP Workflow, Escalation, Data Sharing) across new tabs — follow JP 5-0 doctrinal alignment
- Whether missions go in Direct or Plan tab
- Whether ProblemSetDashboard metrics are repurposed as seed content for Assess tab or Assess gets a clean placeholder
- Whether right-aligned tab bar actions (Invite, Members, Directory, Settings, Org) stay in tab bar or move to a separate header area

</decisions>

<specifics>
## Specific Ideas

- Workflow position indicator on placeholder tabs — horizontal progress showing the full doctrinal lifecycle with current position highlighted
- Placeholders should educate users about the planning process even before tabs are functional
- This restructure sets the foundation for Phases 25-29 which build real content into each tab

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TabLayout` component (frontend/src/components/tabs/TabLayout.tsx): Generic sidebar + content layout, reusable for new tabs
- `ProblemSetTabContainer` (frontend/src/components/problem-set/ProblemSetTabContainer.tsx): Central tab shell — primary file to restructure
- `COPTab`: Stays unchanged, already well-structured
- `NotificationBadge` + `TabNotificationDropdown`: Reusable for new tab notification system

### Established Patterns
- URL-driven tab state via React Router params (`useParams`, `useNavigate`)
- Role-gated tab access via `DEFAULT_TAB_ACCESS` map (to be simplified to all-access)
- Backend-driven panel config with client-side fallback (`problemSetService.getPanelConfig`)
- Tab content rendered via conditional `renderTabContent()` function
- Stale URL redirect pattern already exists (line 174-178) — extend for old tab names

### Integration Points
- `ProblemSetContext`: `tabNotifications` mapping needs activity types remapped to new tab names
- Backend panel config API: needs new tab names in response
- React Router routes: need new tab URL segments registered
- `CrossProblemSetLayerToggle`: references old tab names ('monitor') — needs update

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-doctrinal-tab-restructure-inserted*
*Context gathered: 2026-03-06*
