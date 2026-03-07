# Phase 31: AI Agent Validation & Compliance Testing - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish quantitative validation for BASTION's AI agents across three pillars — determinism, reliability, and authority compliance. Includes a test framework, metrics pipeline, validation dashboard, threshold alerting, and automated circuit breaker with fallback. This phase does NOT add new agent capabilities or modify agent behavior — it validates existing agents.

</domain>

<decisions>
## Implementation Decisions

### Test Scenario Design
- Golden prompt library approach — curated input/expected-output pairs stored as JSON/YAML fixtures
- All 19 agent roles get test scenarios from day one (no phased rollout)
- Fixtures stored in `backend/src/validation/fixtures/`, one file per agent role
- Run count configurable per role (higher-stakes roles like ROE Compliance get more runs)
- Fixtures include embedded doctrinal reference material (JP 3-0, JP 5-0 excerpts) for reliability scoring
- Red-team adversarial prompts included: 2-3 scenarios per role attempting privilege escalation, scope creep, or unauthorized actions
- Test execution: scheduled periodic runs (e.g., nightly/every 6 hours) plus manual trigger from dashboard
- Results stored in dedicated PostgreSQL validation tables AND critical alerts posted to AI staff feed (AIFeedItemRow)

### Scoring & Thresholds
- Dual-layer scoring approach:
  - **Structured output diff** for agents producing JSON (COP layers, entity extractions) — field-by-field comparison
  - **Semantic similarity** (embedding-based, 0.0-1.0) for free-text agents — score method varies by role
- Dual-layer evaluation:
  - **Functional assertions** (code-based): schema validation, required doctrine citations present, authority boundaries respected, required terminology used
  - **LLM-as-judge with rubric**: semantic correctness, doctrinal reasoning quality, contextual appropriateness
  - Disagreements between functional and LLM scores flagged for human review
  - LLM evaluator consistency tracked over time to detect evaluator drift
- Two-tier alert levels: warning (flag for review, agent stays active) and critical (circuit breaker eligible)
- All thresholds admin-configurable per category, per agent, and per agent team via admin UI

### Dashboard & Metrics
- Dashboard lives as a tab within existing admin/settings area
- Main view: agent grid with health cards — name, role, health dot (green/yellow/red), last test run, sparkline trends per score category
- Drill-down view: time-series line charts per score category with warning/critical threshold lines overlaid, plus scrollable test run log with expandable details (inputs, outputs, scores)
- Inline health indicators (green/yellow/red dots) appear at ALL agent touchpoints: AI staff feed items, inline annotations, chat messages, team roster, agent configuration panels
- Dashboard dynamically reflects all registered agents/teams — grows as agents are added
- Enforced minimum test scenarios (e.g., 3-5 golden prompts) required before any agent can be activated — system blocks activation without tests
- **Rich visualizations are critical** — this dashboard is a trust artifact for decision makers evaluating BASTION for wider adoption
- **Export capability required** — detailed agent validation/verification data must be exportable (PDF reports, CSV data) for leadership review and compliance documentation

### Circuit Breaker Behavior
- Disable behavior is category-dependent and admin-configurable:
  - Authority violations default to immediate disable
  - Determinism/reliability failures default to grace period
  - Admin can override defaults per category in settings
- Notifications: in-app alerts (critical items posted to AI staff feed) PLUS configurable external webhook (Slack, email, PagerDuty)
- Reinstatement: two paths available
  - **Standard path**: admin reviews failure details, adjusts agent, triggers re-test — agent reinstated only if re-test passes
  - **Admin override**: force-reinstate with mandatory justification note, logged for audit trail
- When an agent is disabled, a designated fallback agent takes over its responsibilities to maintain team coverage
- All circuit breaker actions (disable, reinstate, override) logged in audit trail

### Claude's Discretion
- Exact database schema design for validation tables
- Chart library and visualization implementation details
- Webhook integration specifics
- Fallback agent selection logic
- Scheduled job implementation (cron, pg_cron, or application-level scheduler)
- Fixture file format details (JSON vs YAML)
- Export report formatting and layout

</decisions>

<specifics>
## Specific Ideas

- "Good visualizations in the dashboard and access to detailed agent validation/verification data (including export) will be a key topic and concern that will need to satisfy decision makers before a system like BASTION could be used widely"
- Validation is a REQUIREMENT for agent registration — creating an agent or team must include test scenarios; it's not optional
- The system must handle dynamic agent populations — agents/teams added or removed over time, dashboard reflects current state
- Dual evaluation layer (functional + LLM) addresses the trust question: functional assertions verify what code can, LLM-as-judge handles semantic quality, and disagreements surface for human review

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AgentManifest`, `AgentPhase`, `AgentCapability`, `AutonomyLevel` types (`backend/src/agents/types.ts`) — define all 19 agent roles and their permission boundaries
- `StaffAgentDef` pattern (`backend/src/exercise/agent-library.ts`, `backend/src/cop/agents/agent-definitions.ts`) — agent definition structure to align test fixtures with
- `AIFeedItemRow` with priority/urgency/confidence types (`backend/src/ai-staff/ai-staff-types.ts`) — reuse for posting critical validation alerts to staff feed
- `ActionRiskLevel`, `ACTION_RISK` map, `ActionLogEntry` (`backend/src/ironclaw/ironclaw-types.ts`) — existing authority/risk classification to test against
- `AgentWrapperConfig` and LangGraph integration (`backend/src/orchestration/agent-wrapper.ts`) — agent execution wrapper where validation hooks could integrate
- Agent registry (`backend/src/agents/registry.ts`) — central registry where activation gating can be enforced

### Established Patterns
- Const objects (not enums) per `erasableSyntaxOnly` convention — use for validation status types
- PostgreSQL for persistent storage — validation results tables follow existing patterns
- AI staff feed system for surfacing agent-generated content — validation alerts reuse this channel
- Trust/approval system with risk levels — authority compliance tests validate against these existing boundaries

### Integration Points
- Agent registry — enforce minimum test requirement before agent activation
- AI staff feed — post critical validation alerts as feed items
- Agent display components (feed items, annotations, chat, roster, config panels) — add health indicator dots
- Admin settings area — add validation dashboard tab
- Agent/team creation flow — require test fixture submission

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-ai-agent-validation-compliance-testing*
*Context gathered: 2026-03-07*
