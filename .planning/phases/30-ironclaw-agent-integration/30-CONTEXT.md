# Phase 30: Ironclaw Agent Integration - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate an Ironclaw agent (NEAR AI) as a chief-of-staff capability that can execute system changes, code modifications (via PR/CI-CD), and problem set configuration on behalf of authorized users with tiered permissions. The agent becomes the unified AI surface in BASTION, absorbing the per-tab AI staff system into a single orchestrated interface.

</domain>

<decisions>
## Implementation Decisions

### Conversation & Command Interface
- Ironclaw replaces/absorbs the per-tab AI staff system as the single unified AI surface
- Dedicated floating button + slide-out drawer panel, always accessible regardless of tab
- Visible delegation to specialist agents: when Ironclaw routes to a specialist (e.g., J2 Intel), the specialist's response appears attributed in the chat
- Users can @mention specific agents for direct specialist interaction within the same panel — both user and Ironclaw see/remember these exchanges
- Step-by-step streaming for multi-step action execution (each step appears as it happens)
- Proactive suggestions appear as in-chat suggestion cards with accept/dismiss buttons
- Persistent conversation history per problem set across sessions

### Permission Boundaries & Escalation
- Always confirm by default — every action requires explicit user confirmation initially
- Users can grant "always allow" for specific action types (yes/no/always pattern, like current Ironclaw agent approvals)
- "Always allow" trust stored per-user per-problem-set in a user preferences table
- Scope escalation prevention: hard block + escalation option via existing Gate system when user tries to act outside their problem set
- No extra authentication for system admin actions — role is sufficient, confirmation gates still apply
- Ambiguous scope (current PS vs children): agent always asks to clarify, never assumes

### Action Execution & Safety Gates
- Hybrid gate approach: lightweight inline confirms in chat for low/medium-risk actions, full Decision Gates (Phase 28) for high-impact and destructive actions
- Full Decision Gates get escalation, timeout, and blockchain audit trail capabilities
- Audit trail: PostgreSQL as primary detailed log for all actions, periodic blockchain hash anchoring for tamper-proof verification (no per-action on-chain cost)

### Code Change Pipeline
- Full code changes allowed — agent can propose any code change via PR with mandatory review
- GitHub platform: PRs created via GitHub API, CI/CD via GitHub Actions
- Change preview: high-level summary in Ironclaw panel + link to full diff on GitHub
- Auto-deploy on merge: merged PRs trigger automatic deployment, agent reports deployment status
- Emergency mode: system admin can fast-track changes with extra audit trail logging, auto-reverts if CI fails

### Self-Update Capability
- Ironclaw must keep itself up to date with new releases automatically
- When a new release is detected and applied, Ironclaw informs the system admin what updated and what new features or changes occurred as a result
- Update notifications appear in the Ironclaw panel as system-level messages to the system admin
- Update process should be non-disruptive (graceful restart or hot-reload where possible)

### Claude's Discretion
- Failure handling strategy per action type (rollback vs stop-and-report)
- Rate limiting design (per-action-type limits vs global cooldown)
- Exact floating button placement to avoid conflicts with other UI elements
- Loading/progress visual patterns for streamed actions
- Blockchain anchoring frequency and batch size
- Emergency mode guard rails and justification requirements
- Self-update mechanism details (polling interval, rollback on failed update, changelog parsing)

</decisions>

<specifics>
## Specific Ideas

- "Always allow" pattern should mirror current Ironclaw agent approval UX (yes/no/always) — users already understand this interaction
- Chief of staff metaphor: Ironclaw orchestrates, specialist agents execute. Users talk to one entity that marshals the right staff
- @mention syntax for direct specialist access within unified panel — both user and Ironclaw maintain shared memory of these exchanges
- Floating button approach chosen but needs careful placement to not conflict with other AI agent integrations throughout BASTION

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/ai-staff/`: Full AI staff system (feed, annotations, chat, tab routing) — Ironclaw will absorb and extend this
- `backend/src/ai-staff/ai-staff-store.ts`: PostgreSQL store with feed CRUD, chat history, tab routing — conversation persistence can build on this
- `backend/src/gates/gate-service.ts`: Decision Gate lifecycle (create, submit, approve, reject, override, escalate, timeout) — reuse for high-impact action confirmation
- `backend/src/security/zero-trust-middleware.ts`: DID-based auth + ABAC enforcement — use for permission tier validation
- `backend/src/gates/gate-service.ts:canActOnGate()`: Role-based gate permissions (commander/xo vs member) — maps to system admin vs PS admin tiers

### Established Patterns
- Singleton store pattern: `aiStaffStore`, `gateStore`, `gateService` — follow for new Ironclaw stores
- `getPool()` database access pattern from `lib/database.ts`
- Gate escalation with parent problem set lookup via inheritance store
- WebSocket integration for real-time updates (ai-staff-router.ts)

### Integration Points
- AI staff chat tables (`ai_staff_chat`, `ai_staff_feed`) — extend or replace for Ironclaw conversation history
- Decision Gates table (`decision_gates`) — create gates for high-impact agent actions
- Zero Trust middleware chain — wrap Ironclaw endpoints with `zeroTrustAuth()` + permission tier check
- Problem set hierarchy (`inheritance-store.ts`) — scope validation for agent actions
- Resource registry (Phase 27) — agent manages resources/identities within scoped problem sets

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-ironclaw-agent-integration*
*Context gathered: 2026-03-07*
