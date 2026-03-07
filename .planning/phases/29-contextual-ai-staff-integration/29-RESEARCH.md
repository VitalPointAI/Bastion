# Phase 29: Contextual AI Staff Integration - Research

**Researched:** 2026-03-07
**Domain:** Contextual AI assistant UX, workflow-aware agent orchestration, inline recommendation rendering
**Confidence:** HIGH

## Summary

Phase 29 surfaces BASTION's existing 19 AI agent roles as visible, contextual collaborators within the six doctrinal workflow tabs (Understand/Design/Plan/Direct/COP/Assess). The codebase already has substantial infrastructure: an agent registry with manifests and team membership, an agent messaging bus with typed channels, authority/delegation models (ControlPosture, AuthorityDesignation), staff notification patterns with WebSocket real-time delivery, and tab-level notification dropdowns. The primary engineering work is building a new AI panel component system that integrates with existing TabLayout, creating an agent routing configuration that maps agents to tabs by doctrinal alignment, and implementing inline annotation rendering with accept/dismiss/modify/escalate actions.

The architecture must support two distinct panel modes: docked sidebar for process tabs (Design, Plan, Understand) and floating overlay for watch tabs (COP, Assess, Direct). A shared cross-tab state model prevents stovepiping. The existing `useStaffNotifications` hook, `NotificationPanel`, `TabNotificationDropdown`, and `COPAgentActivity` components provide proven patterns for real-time agent output display. The `ContainerAgentPanel` provides the agent assignment UX pattern. The `DecisionGateBanner` and `EscalationPanel` demonstrate inline contextual elements within tabs.

**Primary recommendation:** Build a new `AIStaffPanel` component system with a React context (`AIStaffContext`) that maintains shared cross-tab state, wraps tab content at the `ProblemSetTabContainer` level, and adapts its rendering mode (docked vs floating) based on the active tab. Use the existing WebSocket message bus for real-time agent output delivery. Implement inline annotations as a lightweight overlay system that reads from agent output state.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**AI Panel Placement & Behavior:**
- Context-dependent panel mode: Docked right sidebar for process tabs (Design, Plan, Understand); floating draggable overlay for watch tabs (COP, Assess, Direct)
- Hybrid feed + chat input: Structured priority-ranked feed with chat input at bottom
- Shared state across all tabs: Single continuous AI conversation/feed prevents stovepiping
- Priority-ranked feed: AI determines priority; critical items surface regardless of source tab
- Notification in watch mode: Badge count + color-coded urgency (green/amber/red)

**Agent-to-Tab Routing Logic:**
- Hybrid routing: Static doctrinal defaults + dynamic cross-tab routing + user augmentation
- Each tab starts with doctrinally aligned default agents; users can reassign/add agents
- Full team visibility with lead agent + expandable team detail
- Authority-driven behavior: Full autonomy agents auto-update; restricted agents require human accept/dismiss/modify/escalate

**Inline Recommendations UX:**
- Contextual annotations (Google Docs suggestions pattern) with click-to-expand
- Actions: Accept, Dismiss, Modify (inline editor), Escalate (existing governance system)
- Authority-dependent auto-apply for full autonomy agents
- Change trace: Panel log entry + brief inline highlight that fades after acknowledgment

**Agent Attribution & Confidence:**
- Agent name badge + role icon on every output
- Doctrinal confidence levels: Confirmed, Probable, Possible, Doubtful (not percentages)
- Team attribution: Lead agent default, expandable to full team
- "Show AI contributions" toggle for AI vs human content distinction

### Claude's Discretion
- Exact panel width defaults and resize constraints
- Specific role icons per staff section (J1-J9)
- Animation/transition details for panel open/close and mode switching
- Feed item card design and grouping logic within priority tiers
- Chat input behavior (auto-suggest, context awareness)
- Confidence level threshold mapping (what % maps to Confirmed vs Probable, etc.)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | Component framework | Already in use |
| react-router-dom | 7.0.0 | Tab URL routing | Already drives tab state |
| WebSocket (native) | N/A | Real-time agent output delivery | Already used by useStaffNotifications |
| CSS custom properties | N/A | Theming (--bg-secondary, --accent-blue, etc.) | Project convention |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dompurify | 3.3.2 | Sanitize agent-generated HTML/markdown | Rendering agent text output safely |
| zod | 4.3.5 | Runtime validation of agent output payloads | Validating feed items from WebSocket |

### No New Dependencies Required
This phase builds on existing infrastructure. No new npm packages needed. The docked/floating panel, drag behavior, and resize handles are implemented with native DOM APIs (mousedown/mousemove/mouseup, CSS resize, transform: translate). The project does not use a component library -- all UI is custom CSS with CSS variables.

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
  components/
    ai-staff/                    # NEW - AI Staff Panel system
      AIStaffPanel.tsx           # Main panel component (mode-switching shell)
      AIStaffPanel.css
      AIStaffDocked.tsx          # Docked sidebar variant (process tabs)
      AIStaffFloating.tsx        # Floating overlay variant (watch tabs)
      AIStaffFloating.css
      AIStaffFeedItem.tsx        # Individual feed item card
      AIStaffFeedItem.css
      AIStaffChatInput.tsx       # Chat input at bottom of panel
      AIStaffTeamBadge.tsx       # Agent name + role icon badge
      AIStaffConfidence.tsx      # Doctrinal confidence badge
      AIStaffTeamDetail.tsx      # Expandable team composition view
      InlineAnnotation.tsx       # Inline recommendation overlay
      InlineAnnotation.css
      AgentRoutingConfig.ts      # Static doctrinal agent-to-tab defaults
      index.ts
  context/
    AIStaffContext.tsx           # NEW - Shared cross-tab AI state
  hooks/
    useAIStaffFeed.ts           # NEW - WebSocket feed subscription + state
    useAgentRouting.ts          # NEW - Tab-aware agent routing logic
    useInlineAnnotations.ts     # NEW - Inline annotation state per content area
  lib/
    ai-staff-service.ts         # NEW - REST API client for AI staff endpoints
backend/src/
  ai-staff/                     # NEW - AI staff backend module
    ai-staff-router.ts          # REST endpoints
    ai-staff-store.ts           # PostgreSQL persistence
    agent-tab-routing.ts        # Server-side routing logic
    feed-priority.ts            # Priority ranking algorithm
```

### Pattern 1: Shared AIStaffContext at ProblemSetTabContainer Level
**What:** A React context provider wrapping all tab content that maintains a single continuous feed, chat history, and agent routing state across all tabs. Each tab reads from the shared context but filters by relevance.
**When to use:** Always -- this is the core architectural pattern preventing stovepiping.
**Example:**
```typescript
// In ProblemSetTabContainer.tsx
import { AIStaffProvider } from '../../context/AIStaffContext';

// Wrap tab content:
<DecisionGateProvider problemSetId={activePsId}>
  <AIStaffProvider problemSetId={activePsId} activeTab={activeTab}>
    {/* existing tab rendering */}
    <AIStaffPanel /> {/* renders docked or floating based on activeTab */}
  </AIStaffProvider>
</DecisionGateProvider>
```

### Pattern 2: Mode-Switching Panel Component
**What:** The AIStaffPanel reads activeTab from context and renders either AIStaffDocked (right sidebar) or AIStaffFloating (draggable overlay) accordingly.
**When to use:** Tab determines mode automatically.
**Example:**
```typescript
const PROCESS_TABS = ['understand', 'design', 'plan'] as const;
const WATCH_TABS = ['cop', 'assess', 'direct'] as const;

export function AIStaffPanel() {
  const { activeTab, isOpen } = useAIStaff();
  if (!isOpen) return null;

  const isProcessTab = PROCESS_TABS.includes(activeTab as any);
  return isProcessTab ? <AIStaffDocked /> : <AIStaffFloating />;
}
```

### Pattern 3: Priority-Ranked Feed with Cross-Tab Items
**What:** Feed items carry a source tab, priority level, and urgency. The feed always shows all items sorted by priority, with critical items from any tab always visible. Lower-priority items from non-active tabs are grouped under a collapsible "Other tabs" section.
**When to use:** Feed rendering in both docked and floating modes.
**Example:**
```typescript
interface AIFeedItem {
  id: string;
  agentId: string;
  teamId?: string;
  sourceTab: ProblemSetTab;
  priority: 'critical' | 'high' | 'medium' | 'low';
  urgency: 'action_required' | 'attention' | 'info';
  content: string;
  contentType: 'recommendation' | 'analysis' | 'warning' | 'status';
  confidence: 'confirmed' | 'probable' | 'possible' | 'doubtful';
  timestamp: string;
  isRead: boolean;
  actions?: FeedItemAction[];
  inlineTarget?: { contentId: string; position: number }; // For inline annotations
}
```

### Pattern 4: Authority-Driven Rendering
**What:** Feed items and inline annotations check the source agent's ControlPosture/AuthorityDesignation to determine whether to show accept/dismiss/modify/escalate buttons or just log auto-applied changes.
**When to use:** Every feed item and inline annotation.
**Example:**
```typescript
// Derived from existing ControlPosture enum in backend/src/mdmp/types.ts
const FULL_AUTONOMY_POSTURES = ['fully_delegated', 'hootl'] as const;

function isAutoApply(controlPosture: string): boolean {
  return FULL_AUTONOMY_POSTURES.includes(controlPosture as any);
}
```

### Pattern 5: WebSocket Channel for AI Staff Feed
**What:** Extend existing WebSocket message bus with a new channel `ai.staff.{problemSetId}` for real-time feed updates. Follows the exact same pattern as `useStaffNotifications` (subscribe on mount, exponential backoff reconnect, optimistic local state).
**When to use:** Real-time delivery of agent outputs to the panel.
**Example:**
```typescript
// Same pattern as useStaffNotifications.ts lines 75-130
// Channel: `ai.staff.${problemSetId}`
// Message types: 'ai.feed.new', 'ai.feed.update', 'ai.annotation.new'
```

### Anti-Patterns to Avoid
- **Per-tab isolated state:** Each tab having its own feed/context. The CONTEXT.md explicitly requires shared cross-tab state to prevent stovepiping.
- **Polling for feed updates:** Use WebSocket, not polling. The project already has WebSocket infrastructure. (COPAgentActivity uses polling as fallback -- avoid repeating this for the primary feed.)
- **Building a custom drag library:** Use native mousedown/mousemove/mouseup for the floating overlay. CSS `position: fixed` + `transform: translate(x, y)` is sufficient.
- **Separate chat and feed state:** The feed and chat share one unified conversation model. Chat responses appear as new feed items, not in a separate view.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time delivery | Custom polling loop | Existing WebSocket message bus + `useStaffNotifications` pattern | Already proven, handles reconnect/backoff |
| Agent registry lookup | Duplicate agent data on frontend | Fetch from existing `/api/strategic/agents` endpoint | Single source of truth in backend AgentRegistry |
| Team membership | New team state management | Existing TeamRegistry + team-registry.ts | Teams already managed server-side |
| Escalation flow | New escalation UI | Existing `EscalationPanel` / `EscalationLadder` | Already integrated with governance system |
| Notification badges | New badge system | Extend existing `NotificationBadge` component pattern | Consistent UX across the app |
| Content sanitization | Custom HTML escaping | DOMPurify (already installed) | Agent text output may contain markdown/HTML |
| Agent authority checks | Hardcoded permission lists | Read from `agentSupport.controlPosture` in MDMP activity registry | Authority model already defined doctrinally |

**Key insight:** The project already has ~80% of the backend infrastructure for this phase. The AgentRegistry, TeamRegistry, MessageBus, WebSocket delivery, and authority model are all in place. The primary work is frontend: building the panel UI, creating the shared context, and wiring the inline annotation system.

## Common Pitfalls

### Pitfall 1: TabLayout CSS Conflict with Right-Side Panel
**What goes wrong:** The existing TabLayout uses `flex: 1` on `.tab-content` and has a left sidebar. Adding a right-side docked panel breaks the flex layout, causing content to overflow or the panel to collapse.
**Why it happens:** TabLayout was designed for left-sidebar-only layouts.
**How to avoid:** For process tabs, wrap TabLayout content in a new flex container: `[TabLayout (existing flex)] [AIStaffDocked (new right panel)]`. The AIStaffDocked sits as a sibling to TabLayout, not inside it. This means the integration point is in each tab's parent -- the rendering switch in ProblemSetTabContainer.
**Warning signs:** Content area shrinks to zero width; horizontal scrollbar appears.

### Pitfall 2: Shared State Causes Excessive Re-Renders
**What goes wrong:** Every feed item update re-renders all tab content because the AIStaffContext changes.
**Why it happens:** React context propagates to all consumers on any state change.
**How to avoid:** Split AIStaffContext into two contexts: `AIStaffStateContext` (feed items, rarely changes shape) and `AIStaffDispatchContext` (actions like markRead, addMessage). Use `useSyncExternalStore` or memoize feed arrays with reference equality checks. The feed items array should only update when items actually change.
**Warning signs:** Typing in chat input causes visible lag; tab content flickers on every feed update.

### Pitfall 3: Floating Overlay Z-Index Wars
**What goes wrong:** The floating AI panel in watch mode gets hidden behind modals, dropdowns, or the Leaflet map in COP tab.
**Why it happens:** Leaflet creates its own stacking context with high z-index values. Other dropdowns and modals also compete.
**How to avoid:** Use a dedicated z-index tier. Audit existing z-index values in the project. The floating panel should be in a portal (`createPortal` to document.body) with a z-index between the app content and modals. Recommended: `z-index: 900` (below modal overlays at 1000+, above map at ~400-600).
**Warning signs:** Panel disappears when opening map layers; panel blocks modal close buttons.

### Pitfall 4: WebSocket Channel Overload
**What goes wrong:** AI agents generating rapid output flood the WebSocket channel with feed items, causing UI jank and excessive renders.
**Why it happens:** Some agents (especially autonomous ones like OSINT monitor, strategic fusion) can produce many outputs in short bursts.
**How to avoid:** Implement server-side throttling: batch agent outputs into 2-second windows before publishing to WebSocket. On the client, use a message queue that processes feed updates in requestAnimationFrame batches (max 5 items per frame).
**Warning signs:** Browser tab becomes unresponsive during agent bursts; WebSocket backpressure warnings.

### Pitfall 5: Inline Annotation Positioning Drift
**What goes wrong:** Inline annotations reference a position in content that has since changed (due to edits, other agent updates, or re-renders), causing annotations to appear in the wrong location.
**Why it happens:** Content is dynamic, but annotations store a static position reference.
**How to avoid:** Use content-addressable anchoring (reference a stable ID like a paragraph key or element data-attribute) rather than character offset positioning. Store `contentId` (stable element identifier) rather than absolute text position. If the target element is removed, show the annotation as "orphaned" in the feed panel instead.
**Warning signs:** Annotations appear in wrong sections; annotations disappear without being dismissed.

## Code Examples

### Agent-to-Tab Doctrinal Routing Defaults
```typescript
// Based on existing STAFF_ROLE_CONFIG in frontend/src/types/exercise.ts
// and AgentRole enum in backend/src/mdmp/types.ts

export const DEFAULT_TAB_AGENTS: Record<string, string[]> = {
  understand: [
    'strategic_fusion',    // J2 - Intelligence fusion
    'osint_monitor',       // J2 - OSINT collection
    'entity_resolution',   // J2 - Entity resolution
    'data_bias_detector',  // QA - Data quality
    'raft_extraction',     // J2 - Document extraction
  ],
  design: [
    'problem_framing',     // J5 - Problem framing
    'cog_analysis',        // J5 - Center of gravity analysis (from agents/)
    'loe_gap_analysis',    // J5 - Lines of effort gap analysis
    'assumption_auditor',  // J5 - Assumption management
    'narrative_synthesis',  // J5 - Narrative synthesis
  ],
  plan: [
    'coa_generator',       // J35 - COA generation
    'red_team_simulator',  // Red team - Adversary COA
    'adversary_modeler',   // J2 - Adversary modeling
    'effect_cascader',     // J3 - Effect cascading
    'escalation_modeler',  // J5 - Escalation dynamics
    'roe_compliance',      // SJA - ROE compliance
  ],
  direct: [
    'orders_validator',    // J3 - Orders validation
    'conflict_detection',  // J3 - Conflict detection
    'deception_detector',  // J2 - Deception detection
  ],
  cop: [
    'strategic_fusion',    // J2 - COP intelligence layer
    'osint_monitor',       // J2 - OSINT feed
    'coalition_health',    // J9 - Coalition monitoring
  ],
  assess: [
    'assumption_auditor',  // J5 - Assumption revalidation
    'effect_cascader',     // J3 - Effect assessment
    'escalation_modeler',  // J5 - Escalation assessment
  ],
};
```

### Doctrinal Confidence Level Mapping
```typescript
// Maps AI confidence scores to NATO/military confidence terminology
// Reference: JP 2-0, Intelligence, Chapter III (Analytic Confidence)

export type DoctrinalConfidence = 'confirmed' | 'probable' | 'possible' | 'doubtful';

export function toDoctrinalConfidence(score: number): DoctrinalConfidence {
  if (score >= 0.85) return 'confirmed';
  if (score >= 0.60) return 'probable';
  if (score >= 0.30) return 'possible';
  return 'doubtful';
}

export const CONFIDENCE_STYLES: Record<DoctrinalConfidence, { label: string; color: string }> = {
  confirmed: { label: 'Confirmed', color: 'var(--accent-green, #22c55e)' },
  probable:  { label: 'Probable',  color: 'var(--accent-blue, #3b82f6)' },
  possible:  { label: 'Possible',  color: 'var(--accent-yellow, #eab308)' },
  doubtful:  { label: 'Doubtful',  color: 'var(--accent-red, #ef4444)' },
};
```

### Feed Item Priority and Urgency Rendering
```typescript
// Urgency badge rendering - matches CONTEXT.md color spec
export const URGENCY_STYLES: Record<string, { label: string; className: string }> = {
  action_required: { label: 'Action Required', className: 'urgency-red' },
  attention:       { label: 'Attention',       className: 'urgency-amber' },
  info:            { label: 'Info',             className: 'urgency-green' },
};

// CSS for urgency badges:
// .urgency-red { background: var(--status-red); color: white; }
// .urgency-amber { background: var(--status-amber); color: black; }
// .urgency-green { background: var(--status-green); color: white; }
```

### Inline Annotation Component Pattern
```typescript
// Google Docs suggestions pattern - highlight with click-to-expand
interface InlineAnnotationProps {
  annotationId: string;
  agentId: string;
  agentDisplayName: string;
  content: string;
  suggestedChange?: string;
  confidence: DoctrinalConfidence;
  isAutoApply: boolean;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onModify: (id: string, newContent: string) => void;
  onEscalate: (id: string) => void;
}

// Rendered as a highlighted span wrapping the target content,
// with a popover on click showing the full recommendation + action buttons.
// If isAutoApply, show as already-applied with a subtle highlight that fades.
```

### Panel Width and Resize (Docked Mode)
```typescript
// Recommended defaults (Claude's discretion area)
const PANEL_DEFAULTS = {
  defaultWidth: 360,    // px - comfortable for feed items
  minWidth: 280,        // px - minimum readable width
  maxWidth: 600,        // px - don't consume more than ~40% viewport
  storageKey: 'bastion-ai-panel-width', // localStorage for persistence
};

// Resize handle: 4px drag zone on left edge of docked panel
// CSS: cursor: col-resize; position: absolute; left: 0; width: 4px; height: 100%;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dedicated "Agent" tab | Contextual AI in every tab | This phase | Agents visible where work happens |
| Agent output behind the scenes | Priority-ranked feed + inline annotations | This phase | AI becomes a visible collaborator |
| Per-role isolated notifications | Shared cross-tab AI feed | This phase | Prevents planning stovepipes |
| Percentage confidence | Doctrinal confidence levels | This phase | Military audience familiarity |

## Open Questions

1. **Backend feed persistence model**
   - What we know: Feed items need to be stored server-side so they persist across page reloads and are available to other users in the same problem set.
   - What's unclear: Whether to use a new `ai_staff_feed` PostgreSQL table or extend the existing `staff_notifications` table with additional columns.
   - Recommendation: New table. The feed has different semantics (priority, confidence, inline targets, team attribution) that don't map well to the existing notification schema. Keep it clean.

2. **Chat input backend processing**
   - What we know: Users can type follow-up questions in the chat input. These need to be routed to the appropriate agent.
   - What's unclear: Whether the chat goes through the existing LangGraph agent executor pipeline or needs a new lightweight endpoint.
   - Recommendation: Route through existing agent executor. The chat message creates a task assigned to the current tab's lead agent, who processes it and publishes the response as a new feed item.

3. **Agent output generation trigger**
   - What we know: Agents need to produce contextual output when the user navigates to a tab or when underlying data changes.
   - What's unclear: Whether agents should proactively generate output on tab switch or only when explicitly triggered / when data changes.
   - Recommendation: Data-change-driven, not tab-switch-driven. Agents produce output when their watched data changes (document uploads, design saves, COA updates). Tab switching just shows the existing feed filtered by relevance. This avoids expensive LLM calls on every tab click.

4. **Inline annotation scope for Phase 29**
   - What we know: Full Google Docs-style inline suggestions require deep integration with each content component (text editors, form fields, map elements).
   - What's unclear: How deeply to integrate inline annotations in this phase vs. treating some content areas as annotation-ready and others as feed-only.
   - Recommendation: Start with feed-only for all tabs, then add inline annotations to text-heavy sections (Problem Framing in Design, Strategic Documents in Understand) as the first integration points. Map/graph components get feed-panel-only annotations initially.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `frontend/src/components/tabs/TabLayout.tsx` - tab layout structure
- Codebase inspection: `frontend/src/hooks/useStaffNotifications.ts` - WebSocket notification pattern
- Codebase inspection: `backend/src/agents/registry.ts` - agent registration and management
- Codebase inspection: `backend/src/agents/team-registry.ts` - team management
- Codebase inspection: `backend/src/agents/agent-messaging.ts` - agent message bus
- Codebase inspection: `backend/src/mdmp/types.ts` - AgentRole enum (19 roles), ControlPosture, AuthorityDesignation
- Codebase inspection: `backend/src/mdmp/activity-registry.ts` - MDMP activity + agent configuration
- Codebase inspection: `frontend/src/components/problem-set/ProblemSetTabContainer.tsx` - tab container integration point
- Codebase inspection: `frontend/src/components/cop/COPAgentActivity.tsx` - agent activity feed pattern
- Codebase inspection: `frontend/src/components/exercise/AgentRosterCard.tsx` - agent team display
- Codebase inspection: `frontend/src/components/strategic/ContainerAgentPanel.tsx` - agent assignment UX
- Codebase inspection: `frontend/src/components/problem-set/TabNotificationDropdown.tsx` - tab notification pattern

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions - user-locked implementation choices
- Existing project patterns for CSS variables, component organization, and state management

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies
- Architecture: HIGH - patterns derived directly from existing codebase inspection
- Pitfalls: HIGH - identified from actual codebase constraints (TabLayout flex, z-index, WebSocket patterns)
- Agent routing: MEDIUM - doctrinal defaults are reasonable but may need user validation
- Inline annotations: MEDIUM - scope may need refinement based on which content components support it

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable - internal architecture, no external dependency churn)
