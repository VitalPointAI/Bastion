---
phase: quick-6
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/workspace/CreateWorkspaceWizard.tsx
  - frontend/src/components/workspace/CreateWorkspaceWizard.css
  - frontend/src/components/workspace/WorkspaceSwitcher.tsx
  - frontend/src/components/workspace/WorkspaceSwitcher.css
  - frontend/src/components/UserStatusBar.tsx
  - frontend/src/components/UserStatusBar.css
  - frontend/src/App.tsx
autonomous: false
requirements: [UI-FIX-1, UI-FIX-2, UI-FIX-3]

must_haves:
  truths:
    - "Create Workspace wizard renders with styled step indicators (numbered circles with active/completed states), styled form inputs (dark bg, border, focus ring), and properly separated radio card options"
    - "Workspace switcher no longer consumes a permanent sidebar column; it is accessible from the nav bar area without taking horizontal space"
    - "User dropdown in the nav bar contains a Logout button that signs the user out and redirects to /login"
  artifacts:
    - path: "frontend/src/components/workspace/CreateWorkspaceWizard.css"
      provides: "CSS styles for wizard modal, step indicator, form inputs, radio cards, buttons"
      min_lines: 80
    - path: "frontend/src/components/workspace/CreateWorkspaceWizard.tsx"
      provides: "Wizard component with className refs to new CSS file (no Tailwind classes)"
    - path: "frontend/src/components/workspace/WorkspaceSwitcher.tsx"
      provides: "Workspace switcher as dropdown/popover instead of sidebar"
    - path: "frontend/src/components/UserStatusBar.tsx"
      provides: "Logout button in user dropdown"
      contains: "logout"
  key_links:
    - from: "frontend/src/components/UserStatusBar.tsx"
      to: "frontend/src/hooks/useAuth.tsx"
      via: "useAuth().logout"
      pattern: "useAuth.*logout"
    - from: "frontend/src/App.tsx"
      to: "frontend/src/components/workspace/WorkspaceSwitcher.tsx"
      via: "WorkspaceSwitcher moved from sidebar to header area"
      pattern: "WorkspaceSwitcher"
---

<objective>
Fix three workspace UI issues: (1) restyle the Create Workspace wizard so it renders properly without Tailwind (this project does NOT use Tailwind -- no tailwind.config, no @tailwind directives, no tailwindcss dependency), (2) relocate the WorkspaceSwitcher from a permanent left sidebar to a compact dropdown in the nav bar header, (3) add a logout button to the UserStatusBar dropdown.

Purpose: The wizard currently uses Tailwind utility classes that have no effect since Tailwind is not installed, resulting in unstyled native browser elements. The sidebar wastes horizontal space. Users cannot sign out.

Output: Three fixed components with proper CSS styling matching the existing dark theme (App.css pattern).
</objective>

<execution_context>
@/home/vitalpointai/.claude/get-shit-done/workflows/execute-plan.md
@/home/vitalpointai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/App.tsx
@frontend/src/App.css
@frontend/src/components/workspace/CreateWorkspaceWizard.tsx
@frontend/src/components/workspace/WorkspaceSwitcher.tsx
@frontend/src/components/UserStatusBar.tsx
@frontend/src/components/UserStatusBar.css
@frontend/src/hooks/useAuth.tsx

<interfaces>
From frontend/src/hooks/useAuth.tsx:
```typescript
export interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  accountId: string | null;
  email: string | null;
  login: (codename?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}
export function useAuth(): AuthContextValue;
```

From frontend/src/context/WorkspaceContext (used by WorkspaceSwitcher):
```typescript
// WorkspaceSwitcher uses:
const { memberships, activeWorkspaceId, notificationCounts, primaryWorkspaceId, setActiveWorkspace, refreshMemberships } = useWorkspace();
```

From frontend/src/components/workspace/CreateWorkspaceWizard.tsx:
```typescript
interface Props {
  onClose: () => void;
  onCreated: (workspaceId: string) => void;
  parentWorkspaceId?: string;
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restyle CreateWorkspaceWizard and relocate WorkspaceSwitcher</name>
  <files>
    frontend/src/components/workspace/CreateWorkspaceWizard.tsx,
    frontend/src/components/workspace/CreateWorkspaceWizard.css,
    frontend/src/components/workspace/WorkspaceSwitcher.tsx,
    frontend/src/components/workspace/WorkspaceSwitcher.css,
    frontend/src/App.tsx
  </files>
  <action>
    CRITICAL: This project does NOT have Tailwind CSS installed. All Tailwind utility classes (bg-gray-900, rounded-xl, text-white, etc.) are no-ops. Replace with plain CSS using className + a dedicated CSS file, matching the existing dark theme from App.css (--bg-primary, --bg-secondary, rgba patterns).

    **CreateWorkspaceWizard restyle:**
    1. Create `CreateWorkspaceWizard.css` with styles for:
       - `.wizard-overlay` — fixed inset-0 z-50, dark backdrop (bg-black bg-opacity-70)
       - `.wizard-modal` — dark bg (#1a1a2e or var(--bg-secondary)), border (rgba(255,255,255,0.15)), rounded corners, shadow, max-width 500px, padding
       - `.wizard-header` — flex row, justify-between, white text, close button
       - `.step-indicator` — flex row of numbered circles: `.step-circle` (w 28px h 28px, rounded-full, centered text), `.step-circle.active` (bg blue-600, white text), `.step-circle.completed` (bg blue-900, blue-300 text, checkmark), `.step-circle.upcoming` (bg gray-700, gray-400 text), `.step-connector` (line between circles)
       - `.wizard-input` — dark bg (#2a2a3e), border, rounded, padding, white text, focus ring (blue)
       - `.wizard-textarea` — same as input but multi-line
       - `.wizard-select` — same as input for select elements
       - `.wizard-label` — small text, gray-300 color, margin-bottom
       - `.type-card-group` — flex row with gap for workspace type cards
       - `.type-card` — flex-1, flex-col, centered, padding, rounded-lg, border, cursor-pointer. `.type-card.selected` gets blue border + blue bg tint. Each card has `.type-card-name` (font-semibold) and `.type-card-desc` (small gray text below)
       - `.radio-option` — for classification/invite mode: flex row with gap, padding, rounded-lg, border, cursor pointer. `.radio-option.selected` blue border. Contains `.radio-dot` (styled radio), `.radio-label` (white, medium), `.radio-desc` (gray, small)
       - `.wizard-review` — bg slightly lighter, rounded, padding, rows of label-value pairs
       - `.wizard-footer` — flex justify-between, top border, margin-top. `.wizard-btn-cancel` (text gray, hover white), `.wizard-btn-back` (bg gray-700, white text, rounded), `.wizard-btn-next` / `.wizard-btn-create` (bg blue-600, white text, rounded, disabled state)
       - `.wizard-error` — red bg tint, red border, red text
       - `.wizard-warning` — yellow bg tint, yellow border, yellow text

    2. Rewrite `CreateWorkspaceWizard.tsx` to replace ALL Tailwind className strings with the new CSS class names. Import `./CreateWorkspaceWizard.css`. Keep ALL existing logic, state management, validation, and event handlers EXACTLY as-is. Only change the JSX className attributes and the style patterns. For the radio inputs in the workspace type section, keep them visually hidden (use CSS `.sr-only` equivalent) so the card itself acts as the clickable element. Ensure the workspace type cards show the type name AND the description text on SEPARATE lines (this was the "OrganizationTop-level" bug -- the two spans need display:flex flex-direction:column or display:block).

    **WorkspaceSwitcher relocation:**
    3. Create `WorkspaceSwitcher.css` with styles for a dropdown/popover pattern:
       - `.ws-switcher` — relative positioning (for dropdown anchoring)
       - `.ws-switcher-trigger` — a button styled like the existing nav buttons (matching `.nav-button` style from App.css), showing the active workspace abbreviation or "WS" if none
       - `.ws-switcher-dropdown` — absolute positioned below trigger, dark bg, border, rounded, shadow, z-index 1000, max-height 400px with overflow-y auto
       - `.ws-item` — flex row, workspace icon + name + type badge, hover highlight, click to switch
       - `.ws-item.active` — highlighted/selected state
       - `.ws-create-btn` — "+" button at bottom of dropdown list

    4. Rewrite `WorkspaceSwitcher.tsx` to render as a dropdown button instead of an `<aside>` sidebar:
       - Change from `<aside style="width: 64px; minHeight: 100vh">` to a relative-positioned container with a trigger button and a dropdown panel
       - Trigger button shows the active workspace abbreviation (2-letter) or a generic workspace icon
       - Clicking the trigger toggles the dropdown open/closed
       - Dropdown lists all workspaces (same sorted order, same icons/badges/notifications)
       - Clicking a workspace calls handleWorkspaceClick and closes the dropdown
       - "+" create button at the bottom still opens the CreateWorkspaceWizard modal
       - Close dropdown on click outside (same pattern as UserStatusBar)
       - Keep ALL existing logic for sorting, navigation, workspace creation, NotificationBadge

    5. Update `App.tsx`:
       - Move `<WorkspaceSwitcher />` from the flex sidebar layout (line 152) into the header `<nav className="app-nav">` section, placing it BEFORE the nav-spacer div (around line 138). This puts it in the nav bar with the other buttons.
       - Remove the outer flex wrapper div (lines 150-178) that created the sidebar + content layout. Instead, just render `<main className="app-main">` directly after the header.
       - Keep all routing logic exactly as-is.
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr/frontend && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - CreateWorkspaceWizard renders with styled dark modal: numbered step circles (not raw text), styled inputs (dark bg with border, not native browser chrome), workspace type cards showing "Organization" and "Top-level" on separate lines (not jammed "OrganizationTop-level"), styled buttons
    - WorkspaceSwitcher renders as a dropdown button in the nav bar, not a permanent 64px sidebar column
    - All existing functionality preserved (workspace creation, switching, notifications)
  </done>
</task>

<task type="auto">
  <name>Task 2: Add logout button to UserStatusBar dropdown</name>
  <files>
    frontend/src/components/UserStatusBar.tsx,
    frontend/src/components/UserStatusBar.css
  </files>
  <action>
    1. In `UserStatusBar.tsx`:
       - Import `useAuth` from `../hooks/useAuth`
       - Import `useNavigate` from `react-router-dom`
       - Extract `logout` from `useAuth()` inside the component
       - Add a logout handler: `const handleLogout = async () => { await logout(); navigate('/login'); };`
       - After the `.dropdown-details` div (line 107), add a new section with class `.dropdown-actions`:
         ```
         <div className="dropdown-actions">
           <button className="logout-btn" onClick={handleLogout}>
             Sign Out
           </button>
         </div>
         ```

    2. In `UserStatusBar.css`, add styles:
       - `.dropdown-actions` — padding 12px 16px, border-top 1px solid rgba(255,255,255,0.1)
       - `.logout-btn` — width 100%, padding 8px 16px, background rgba(239,68,68,0.15) (red tint), color #ef4444, border 1px solid rgba(239,68,68,0.3), border-radius 8px, cursor pointer, font-size 13px, font-weight 500, transition all 0.2s
       - `.logout-btn:hover` — background rgba(239,68,68,0.25), border-color rgba(239,68,68,0.5)
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr/frontend && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - UserStatusBar dropdown shows a "Sign Out" button at the bottom with red-tinted styling
    - Clicking Sign Out calls useAuth().logout() and navigates to /login
    - Button matches the dark theme aesthetic (red accent on dark background)
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Restyled Create Workspace wizard (plain CSS replacing broken Tailwind classes), relocated WorkspaceSwitcher from sidebar to nav bar dropdown, and added logout button to user dropdown.
  </what-built>
  <how-to-verify>
    1. Start the frontend dev server: `cd frontend && npm run dev`
    2. Log in and verify:
       - The left sidebar column (64px workspace switcher) is GONE -- content takes full width
       - In the nav bar, there is a workspace switcher button -- click it to see the dropdown with your workspaces and the "+" create button
    3. Click the "+" button in the workspace dropdown:
       - Verify the Create Workspace modal appears with STYLED step indicators (numbered blue circles, not raw "1 2 3" text)
       - Verify form inputs have dark backgrounds with borders (not unstyled native browser inputs)
       - Verify workspace type cards show labels on separate lines: "Organization" / "Top-level" (not "OrganizationTop-level")
       - Click through Step 2 and verify radio options for Classification and Invite Mode are properly styled cards with labels and descriptions separated
    4. Click your user avatar/name in the top-right:
       - Verify the dropdown shows account details AND a red-tinted "Sign Out" button at the bottom
       - Click "Sign Out" and verify you are redirected to /login
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues to fix</resume-signal>
</task>

</tasks>

<verification>
- TypeScript compilation passes with no errors
- CreateWorkspaceWizard.css file exists with wizard styling classes
- WorkspaceSwitcher.css file exists with dropdown styling classes
- No Tailwind utility classes remain in CreateWorkspaceWizard.tsx or WorkspaceSwitcher.tsx
- App.tsx no longer renders WorkspaceSwitcher in a sidebar flex layout
- UserStatusBar.tsx imports useAuth and calls logout
</verification>

<success_criteria>
- Create Workspace wizard is fully styled with dark theme (step circles, styled inputs, separated radio labels, styled buttons)
- Workspace switcher is a compact dropdown in the nav bar, not a 64px permanent sidebar
- Logout button exists in user dropdown and successfully signs out + redirects to /login
- All existing workspace functionality (create, switch, notifications) still works
</success_criteria>

<output>
After completion, create `.planning/quick/6-fix-workspace-ui-restyle-create-wizard-r/6-SUMMARY.md`
</output>
