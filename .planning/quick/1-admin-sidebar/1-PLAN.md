---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/admin/AdminDashboard.tsx
  - frontend/src/components/admin/AdminDashboard.css
autonomous: true
must_haves:
  truths:
    - "Admin dashboard uses sidebar navigation matching TabLayout pattern from Decide/Design/Campaign/Monitor tabs"
    - "All 10 admin panels (LLM Provider, Agents, Agent Management, Tools, Characters, Teams, Workflow, OSINT Sources, Audit Log, Funding) are accessible via sidebar items"
    - "Admin sidebar uses orange accent color consistent with existing admin theme (not blue like operational tabs)"
    - "Sidebar collapses and expands like TabLayout with toggle button"
  artifacts:
    - path: "frontend/src/components/admin/AdminDashboard.tsx"
      provides: "Sidebar-based admin navigation using TabLayout component"
    - path: "frontend/src/components/admin/AdminDashboard.css"
      provides: "Updated styles for sidebar layout, removing horizontal tab styles"
  key_links:
    - from: "frontend/src/components/admin/AdminDashboard.tsx"
      to: "frontend/src/components/tabs/TabLayout.tsx"
      via: "import and render TabLayout with sidebar items"
      pattern: "import.*TabLayout"
---

<objective>
Convert AdminDashboard from horizontal react-tabs navigation to the shared TabLayout sidebar pattern used by all other main tabs (Decide, Design, Campaign, Monitor).

Purpose: The admin dashboard currently uses react-tabs with a horizontal tab bar for 10 panels. With 10 tabs, the horizontal bar is crowded and inconsistent with the sidebar navigation pattern established in Phase 1.4 for all other main sections. Converting to sidebar navigation provides more space for tab labels, better scalability, and visual consistency.

Output: AdminDashboard using TabLayout sidebar with orange accent theming.
</objective>

<execution_context>
@/home/vitalpointai/.claude/get-shit-done/workflows/execute-plan.md
@/home/vitalpointai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/admin/AdminDashboard.tsx
@frontend/src/components/admin/AdminDashboard.css
@frontend/src/components/tabs/TabLayout.tsx
@frontend/src/components/tabs/TabLayout.css
@frontend/src/components/tabs/DecideTab.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Convert AdminDashboard to TabLayout sidebar navigation</name>
  <files>frontend/src/components/admin/AdminDashboard.tsx, frontend/src/components/admin/AdminDashboard.css</files>
  <action>
Refactor AdminDashboard.tsx to replace react-tabs with the shared TabLayout sidebar component:

1. **Replace react-tabs import with TabLayout:**
   - Remove: `import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';`
   - Add: `import { TabLayout, type SidebarItem } from '../tabs/TabLayout.js';`

2. **Define sidebar items array:**
   Create an `ADMIN_ITEMS: SidebarItem[]` array with all 10 panels:
   ```
   { id: 'llm', label: 'LLM Provider', tooltip: 'Configure LLM provider settings' }
   { id: 'agents', label: 'Agents', tooltip: 'Per-agent model configuration' }
   { id: 'agent-management', label: 'Agent Management', tooltip: 'Create and manage agents' }
   { id: 'tools', label: 'Tools', tooltip: 'MCP tool registry' }
   { id: 'characters', label: 'Characters', tooltip: 'Agent character definitions' }
   { id: 'teams', label: 'Teams', tooltip: 'Agent team composition' }
   { id: 'workflow', label: 'Workflow', tooltip: 'Workflow configuration' }
   { id: 'osint', label: 'OSINT Sources', tooltip: 'Open source intelligence feeds' }
   { id: 'audit', label: 'Audit Log', tooltip: 'System audit trail' }
   { id: 'funding', label: 'Funding', tooltip: 'NEAR account funding management' }
   ```

3. **Add selectedView state:**
   `const [selectedView, setSelectedView] = useState<AdminView>('llm');`
   Define `type AdminView = 'llm' | 'agents' | 'agent-management' | 'tools' | 'characters' | 'teams' | 'workflow' | 'osint' | 'audit' | 'funding';`

4. **Replace the Tabs/TabList/TabPanel structure:**
   Keep the dashboard-header (h1 + Refresh Cache button) as-is above the TabLayout.
   Wrap the panel content area in TabLayout:
   ```tsx
   <TabLayout items={ADMIN_ITEMS} selectedItem={selectedView} onSelectItem={(id) => setSelectedView(id as AdminView)}>
     {selectedView === 'llm' && <LLMConfigPanel />}
     {selectedView === 'agents' && <AgentConfigPanel />}
     {selectedView === 'agent-management' && <AgentManagementPanel />}
     {selectedView === 'tools' && <ToolRegistryPanel />}
     {selectedView === 'characters' && <CharacterBuilderPanel />}
     {selectedView === 'teams' && <TeamComposerPanel />}
     {selectedView === 'workflow' && <WorkflowConfigPanel />}
     {selectedView === 'osint' && <OSINTSourcePanel />}
     {selectedView === 'audit' && <AuditLogPanel />}
     {selectedView === 'funding' && <FundingPanel />}
   </TabLayout>
   ```

5. **Update AdminDashboard.css:**
   - Remove the entire `.admin-tabs`, `.admin-tab-list`, `.admin-tab`, `.admin-tab--selected` sections (horizontal tab navigation styles) since they are no longer used.
   - Remove `.admin-tab-panel` and `.admin-tab-panel--selected` styles.
   - Add admin-specific sidebar override styles to use orange accent instead of blue:
     ```css
     /* Admin sidebar orange accent override */
     .admin-dashboard .sidebar-item.active {
       color: var(--accent-orange, #ffa500);
       border-left-color: var(--accent-orange, #ffa500);
     }
     .admin-dashboard .sidebar-item:hover {
       color: var(--accent-orange, #ffa500);
     }
     ```
   - Keep all other existing styles (loading, access-denied, config-panel, forms, tables, modals, agent cards, tool cards, team cards, etc.) untouched.
   - Ensure `.admin-dashboard` layout works with the new flex structure: the dashboard should be `display: flex; flex-direction: column;` with the header at top and the TabLayout filling the remaining space. Add `flex: 1; min-height: 0; display: flex;` to the wrapper around TabLayout so it fills the available vertical space.

6. **Keep all loading/access-denied states identical** - only the authenticated admin view changes its navigation pattern.

Do NOT modify any of the child panel components (LLMConfigPanel, AgentConfigPanel, etc.) - they remain unchanged.
Do NOT modify TabLayout.tsx or TabLayout.css - the shared component stays generic.
  </action>
  <verify>
    Run `cd /home/vitalpointai/projects/ssr/frontend && npx tsc --noEmit` to confirm no TypeScript errors.
    Run `cd /home/vitalpointai/projects/ssr/frontend && npx vite build` to confirm build succeeds.
    Visually: Admin dashboard shows sidebar on the left with 10 items, orange accent on active item, content area on right showing the selected panel.
  </verify>
  <done>
    AdminDashboard renders with TabLayout sidebar instead of horizontal react-tabs. All 10 admin panels accessible via sidebar. Orange accent theme preserved. Sidebar collapses/expands. Build passes without errors. No changes to child panel components or shared TabLayout component.
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes in frontend directory
- `npx vite build` succeeds in frontend directory
- AdminDashboard imports TabLayout (not react-tabs for navigation)
- All 10 panel components still rendered and accessible
- Orange accent color used for active sidebar item (not blue)
- Loading and access-denied states unchanged
</verification>

<success_criteria>
Admin dashboard uses sidebar navigation consistent with Decide/Design/Campaign/Monitor tabs. All 10 admin panels remain accessible. Orange accent theming maintained. No regressions in child panel components.
</success_criteria>

<output>
After completion, create `.planning/quick/1-admin-sidebar/1-SUMMARY.md`
</output>
