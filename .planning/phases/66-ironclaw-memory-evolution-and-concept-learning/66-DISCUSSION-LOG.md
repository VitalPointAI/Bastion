# Phase 66: Ironclaw Memory Evolution, Concept Learning & Reinforcement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 66-ironclaw-memory-evolution-and-concept-learning
**Areas discussed:** Database location, Extraction triggers & scope, Commander feedback UX, Concept dashboard & retrieval

---

## Database Location

| Option | Description | Selected |
|--------|-------------|----------|
| ironclaw-postgres | Already runs pgvector/pgvector:pg16 — zero infra risk. Access via existing DATABASE_URL_IRONCLAW pool. | ✓ |
| coalition_ops (main DB) | Same pool as all other Ironclaw tables. Needs CREATE EXTENSION vector on TimescaleDB — unverified. | |
| You decide | Let Claude choose based on technical merits. | |

**User's choice:** ironclaw-postgres (Recommended)
**Notes:** Zero-risk path chosen — pgvector already available in container.

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-DB text reference | Store problem_set_id as plain TEXT, no FK. Same pattern as routines. | |
| You decide | Let Claude pick the pragmatic approach. | ✓ |

**User's choice:** You decide
**Notes:** Claude discretion — cross-DB text reference, consistent with routines pattern.

---

## Extraction Triggers & Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Idle timeout only | Fire after 5 minutes no messages. Simple and reliable. | |
| Idle timeout + thread close | Both idle and explicit thread switch. | |
| All three triggers | Idle timeout + thread close + session end. Most comprehensive. | ✓ |

**User's choice:** All three triggers
**Notes:** Commander wants maximum extraction coverage.

| Option | Description | Selected |
|--------|-------------|----------|
| 3+ substantive messages | DESIGN.md threshold. Skips greetings. | |
| Any thread with user content | Extract from all threads regardless of length. | ✓ |
| 5+ messages | Higher bar, only meaningful conversations. | |

**User's choice:** Any thread with user content
**Notes:** No minimum message count — even short exchanges may contain valuable insights.

| Option | Description | Selected |
|--------|-------------|----------|
| 10 per hour | DESIGN.md default. Prevents runaway costs. | |
| No limit | Extract whenever triggered. Trust triggers to self-limit. | ✓ |
| You decide | Let Claude set a reasonable limit. | |

**User's choice:** No limit
**Notes:** Haiku cost is negligible. Trust trigger conditions.

---

## Commander Feedback UX

| Option | Description | Selected |
|--------|-------------|----------|
| Thumbs up/down inline | Simple thumbs on activity feed items. Low friction. | |
| 1-5 star rating | More granular but higher friction. | |
| Thumbs + optional comment | Thumbs for quick signal, expandable text for notes. | ✓ |

**User's choice:** Thumbs + optional comment
**Notes:** Best of both worlds — quick signal plus rich feedback when needed.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, dedicated panel | Separate Commander Directives panel in drawer. | ✓ |
| In-chat commands only | Just say priorities in conversation, extracted as preferences. | |
| Both | Panel for persistent directives AND in-chat preferences. | |

**User's choice:** Yes, dedicated panel (Recommended)
**Notes:** Directives panel provides explicit, persistent priority steering separate from conversation flow.

---

## Concept Dashboard & Retrieval

| Option | Description | Selected |
|--------|-------------|----------|
| New drawer tab | Dedicated 'Concepts' tab in IronclawDrawer. Clean separation. | ✓ |
| Extend Memory panel | Add concepts section to existing IronclawMemoryPanel. | |
| You decide | Let Claude choose based on UI complexity. | |

**User's choice:** New drawer tab (Recommended)
**Notes:** Clean separation from existing Memory panel.

| Option | Description | Selected |
|--------|-------------|----------|
| Expandable history | Collapsed default, click to expand version chain. | ✓ |
| Latest only | Show only current version. Simpler. | |
| Side-by-side diff | Previous vs current as diff. More complex. | |

**User's choice:** Expandable history (Recommended)
**Notes:** Full version chain with source threads and confidence changes.

| Option | Description | Selected |
|--------|-------------|----------|
| Top 5 | 5 most relevant concepts. ~500 token budget. | ✓ |
| Top 10 | 10 concepts. ~1000 tokens. Better recall, higher cost. | |
| You decide | Let Claude determine based on token analysis. | |

**User's choice:** Top 5 (Recommended)
**Notes:** Good balance of context richness and prompt token budget.

---

## Claude's Discretion

- Cross-DB problem_set_id reference approach
- Consolidation job frequency
- Embedding model choice (text-embedding-3-large vs -small)
- Idle timeout implementation (frontend timer vs backend heartbeat)
- Session-end detection strategy
- Concept card visual details within UI-SPEC
- Conflict resolution presentation

## Deferred Ideas

None — discussion stayed within phase scope.
