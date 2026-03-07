# Phase 29: Contextual AI Staff Integration - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface AI agent output contextually within each doctrinal workflow tab (Understand/Design/Plan/Direct/COP/Assess). Per-tab AI assistants aware of the current workflow phase deliver relevant recommendations, analysis, and automation. Agents become visible collaborators — the right agent surfaces the right insight at the right time. Depends on Phase 24 (tab restructure), Phase 25 (Operational Design), and Phase 4.2 (agent framework).

</domain>

<decisions>
## Implementation Decisions

### AI Panel Placement & Behavior
- **Context-dependent panel mode:**
  - **Process tabs (Design, Plan, Understand):** Docked right sidebar — AI guides the user through the workflow and helps improve content toward submission. Resizable via drag handle, remembers user's preferred width.
  - **Watch tabs (COP, Assess, Direct):** Floating draggable overlay — AI watches and waits, signals when it sees something actionable. Freely draggable to any position.
- **Hybrid feed + chat input:** Structured priority-ranked feed of agent outputs as the main view, with a chat input at the bottom for follow-up questions
- **Shared state across all tabs:** Single continuous AI conversation/feed prevents stovepiping — cross-tab awareness surfaces insights from other workflow phases. Mirrors the asynchronous nature of real planning and operations.
- **Priority-ranked feed:** AI determines priority based on urgency/relevance. Critical items (warnings, blockers) surface regardless of source tab. Lower-priority items grouped below.
- **Notification in watch mode:** Badge count (unread items) + color-coded urgency (green=info, amber=attention, red=action required) on the floating AI icon

### Agent-to-Tab Routing Logic
- **Hybrid routing:** Static doctrinal defaults + dynamic cross-tab routing + user augmentation
  - Each tab starts with doctrinally aligned default agents (e.g., J2 in Understand, J5 in Design)
  - Users can reassign the default agent and add any number of additional agents or teams to augment a tab
  - Tab default agents can recruit and use other available agents or agent teams as needed (e.g., COA Design team: deception agent, factor analysis agent, feasibility agent working together)
- **Full team visibility:** When agents form teams, show the full team composition — who's working together and who contributed what. Transparency aligns with military staff culture.
- **Lead agent with expandable team detail:** Show lead agent by default, click to expand and see full team and individual contributions
- **Authority-driven behavior:**
  - **Full autonomy agents:** Automatically update relevant content, coordinate with other agents and teams, make changes without human approval
  - **Restricted agents (human-in-the-loop):** Surface updates in the priority-ranked feed for human decision via accept/dismiss/modify/escalate
  - Agents work to the maximum level of their granted authorities and delegations, bringing humans in only when required

### Inline Recommendations UX
- **Contextual annotations:** AI recommendations appear as highlighted inline annotations within existing tab content (Google Docs suggestions pattern) — click to expand and see the full recommendation with action buttons
- **Actions on recommendations:** Accept, Dismiss, Modify (inline editor with AI's proposed change), Escalate (route up chain via existing governance/escalation system)
- **Authority-dependent auto-apply:**
  - Full autonomy agents can auto-apply changes without showing accept/dismiss
  - Restricted agents always show accept/dismiss/modify/escalate
  - Consistent with the authority model used for routing
- **Change trace for auto-applied changes:** Both panel log entry (permanent, with agent attribution) + brief inline highlight on changed content (fades after acknowledgment). Maximum visibility with clean final state.

### Agent Attribution & Confidence
- **Agent name badge + role icon:** Every AI output shows the agent's display name (rank + name) and a role-specific icon (e.g., J2 intelligence shield, J4 logistics gear). Clear at a glance who's responsible.
- **Doctrinal confidence levels:** Use military/NATO confidence terminology instead of percentages — Confirmed, Probable, Possible, Doubtful. Maps AI confidence to familiar doctrinal language that military audiences already understand.
- **Team attribution:** Lead agent shown by default, expandable to see full team and each agent's contribution section
- **AI vs human content distinction:** AI content blends in by default (clean final product), with a "Show AI contributions" toggle that highlights all AI-originated content. Audit mode when needed, clean workspace otherwise.

### Claude's Discretion
- Exact panel width defaults and resize constraints
- Specific role icons per staff section (J1-J9)
- Animation/transition details for panel open/close and mode switching
- Feed item card design and grouping logic within priority tiers
- Chat input behavior (auto-suggest, context awareness)
- Confidence level threshold mapping (what % maps to Confirmed vs Probable, etc.)

</decisions>

<specifics>
## Specific Ideas

- "Would like it to be like another team member that is always there and available" — the AI panel should feel like a staff officer sitting next to you, not a tool you invoke
- Agent teaming is central: some tabs (like COA Design) require multiple agents collaborating — deception plan agent, factor analysis agent, feasibility agent, etc. — not just a single assistant
- Shared state prevents planning in stovepipes — cross-tab awareness mirrors how real staff sections need to coordinate asynchronously
- Authority and delegation model drives everything: agents should work to their maximum granted authority, bringing humans in only when the situation exceeds their delegation. This applies to both routing and inline recommendation behavior.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ContainerAgentPanel` (strategic/): Agent assignment panel with assign/remove/toggle-auto-process. Pattern for agent-to-resource binding.
- `AgentRosterCard` (exercise/): Displays agent teams with rank, name, branch, focus. Reusable for team visibility in AI panel.
- `NotificationPanel` (exercise/): Existing notification surfacing pattern — can inform watch-mode notification design
- `EscalationPanel` / `EscalationLadder`: Existing escalation UI — escalate action on recommendations ties directly into this
- `TabNotificationDropdown`: Per-tab notification dropdown — existing pattern for tab-scoped alerts
- `useStaffNotifications` hook: Staff notification subscription hook

### Established Patterns
- `TabLayout`: Sidebar + main content structure per tab. Already supports `decisionHistory` slot. AI panel would be a new right-side slot or peer element.
- `DecisionGateBanner` / `DecisionGateTimeline`: Governance integration within tabs — inline banners and sidebar timelines. Pattern for contextual inline elements.
- `useMode()` context: Global mode toggle (training/operational) — AI panel behavior may vary by mode
- Staff role system: 31 JPP staff roles, 19 AI agent roles already defined with capabilities

### Integration Points
- Each tab component (UnderstandTab, DesignTab, PlanTab, DirectTab, COPTab, AssessTab) needs AI panel integration
- Backend `activity-registry.ts` and `workflow-service.ts` for agent orchestration and MDMP workflow awareness
- `strategicService` API for agent assignment/management
- Existing escalation system for the "Escalate" action on recommendations

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-contextual-ai-staff-integration*
*Context gathered: 2026-03-07*
