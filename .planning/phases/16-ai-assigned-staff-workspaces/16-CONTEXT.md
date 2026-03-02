# Phase 16: AI Assigned Staff Workspaces - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the staff role management system to support Human vs AI assignment per position. When a role is assigned to AI, provide a full default agent team with doctrinal identities, configurable composition, ironclaw-based autonomous execution, and a channel interface for human-agent interaction. Human | AI | Disabled state per position; full version history, cross-role coordination, and human-in-the-loop review before publish.

</domain>

<decisions>
## Implementation Decisions

### Human | AI | Disabled toggle
- "Manage Roles" modal gains a third state per position: **Human | AI | Disabled**
- Human = current behavior (workspace shown, human fills it)
- AI = agent team assigned, workspace shows AI-generated products + channel interface
- Disabled = position not staffed

### Workspace visual mode
- Side-by-side layout: product panel (primary/wider) on left or main area, channel/activity feed (narrower) on right
- Products panel is the primary surface — channel feed is a supporting sidebar
- **Initial state (before agents begin):** Agent roster card showing the assigned team (names, ranks, focus areas) with a "Begin" button — no product templates shown until work starts
- **Access control:** Role-based — only the assigned supervisor or commander role can intervene or edit; all others are read-only observers

### Agent task initiation
- Both **manual** (human clicks "Begin" on the roster card) and **event-driven** (auto-trigger on key events)
- Auto-trigger events:
  1. OPORD / scenario package uploaded
  2. Exercise phase changes
  3. Upstream human or AI role publishes a product this role depends on
  4. Commander role issues an explicit directive to this role
- Pause and resume control: humans can pause agent execution mid-task and resume it later
- Concurrent trigger handling: multiple simultaneous triggers **merge context** — one enriched execution run (not duplicated runs)

### Product review & approval
- Review access surfaces in **three places simultaneously**: notification fired, channel feed "Review required" card, and product panel "Pending Review" badge
- Reviewer actions (full set):
  - Approve → publishes immediately
  - Edit then approve → reviewer edits inline, then publishes
  - Request revision → sends feedback back to agent team for another pass
  - Edit then request revision → reviewer makes partial edits, sends back for completion
  - Reject → returns with reason, agents must restart
- Feedback to agents on revision/rejection: **free-text notes + annotated product** (reviewer highlights sections, adds inline comments; agents receive the marked-up version)
- **Full version history:** Every agent draft and revision iteration is stored and visible to reviewers — not just the latest draft

### Cross-role AI coordination
- **Shared context store:** All AI roles write to and read from a shared exercise context object in real-time (not limited to published products only)
- **AI-to-AI tasking:** Supported — via explicit AI-to-AI messages or shared context store writes
- **Full auditability required:** Every AI-to-AI coordination event (who asked who, what was requested, what was returned) is logged and accessible to human observers
- **Waiting behavior:** When blocked on an input from another role, agents display a "Waiting on [Role]: [what's needed]" status in the channel feed, but continue working on all tasks that don't depend on the missing input
- **Coordination observability:** Claude's discretion — surface coordination activity in a way that makes sense given existing workspace patterns (per-role channel and/or unified commander view)

### Default AI agent library
- Generate the full canonical default AI team for **all 31 staff roles** based on doctrinal references
- Minimum 3 agents per role, typically 4–5
- Each agent has a **singular focus** (single responsibility principle)
- Deterministic results — narrow scope, no ambiguity in what each agent does
- Role-appropriate rank, name, branch, and communication style
- Grounded in JP 3-0, JP 5-0, FM 6-0, and relevant functional doctrine
- The planning agent **must** produce this library as part of the plan — not defer to implementation. Library becomes seeded default data in the database.

### Agent identity requirements (per agent)
- `name` — realistic military name (first initial + last name)
- `rank` — appropriate grade (typically O-3 to O-5; CW2–CW4 for technical specialties; E-7 to E-9 for enlisted specialists)
- `branch` / `specialty` — Army/joint branch and functional area
- `focus` — single-sentence description of exactly what this agent does (no overlap with teammates)
- `tools` — list of tool types this agent should have access to
- `personality` — communication style tokens (e.g., concise, analytical, risk-aware, action-oriented)
- `systemPromptHint` — 1–2 sentence persona primer for the LLM system prompt

### Ironclaw integration
- Research `https://github.com/nearai/ironclaw` before planning:
  1. Long-running autonomous vs one-shot tool calls
  2. Message/event stream interface for channel display
  3. Authentication model (NEAR account compatibility)
  4. Context passing (scenario, role, current products) at invocation
- If good fit: integrate as orchestration layer
- If not fit: direct LLM agent loop with multi-turn tool calls, channel-interface designed for future ironclaw migration

### Channel interface design
- Structured activity log (not a general chatbox) per AI-assigned role
- Shows: tasks currently executing, draft products being generated (with review prompts), questions requiring human decision, final product links when complete
- Human intervention points are surfaced explicitly — not buried in feed

### Agent design principles
1. Single responsibility — each agent does exactly one thing
2. Deterministic scope — output is predictable given inputs
3. No overlap — agents on the same team don't duplicate each other's work
4. Escalation path — every agent has a clear condition under which it routes to human review
5. Identity coherence — persona is consistent with functional role and rank

### Claude's Discretion
- Exact layout proportions and breakpoints for the side-by-side workspace
- Where coordination observability surfaces (per-role channel, unified commander view, or both)
- Loading/transition animations when agents begin or pause
- Error state handling when ironclaw or agent execution fails

</decisions>

<specifics>
## Specific Ideas

- Agent roster card as the initial workspace state (not empty templates) — makes the AI assignment feel intentional, not just "nothing there yet"
- Annotated product feedback mirrors how real staff officers mark up documents — familiar workflow for military users
- "Waiting on [Role]: [what's needed]" language in the channel feed mirrors real staff coordination language (RFIs, etc.)
- Merge-context for concurrent triggers prevents duplicate work — treat simultaneous triggers as a richer briefing, not separate tasking

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-ai-assigned-staff-workspaces*
*Context gathered: 2026-03-02*
