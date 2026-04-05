---
phase: 66
slug: ironclaw-memory-evolution-and-concept-learning
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 66 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.2 (backend and frontend) |
| **Config file** | `backend/vitest.config.ts` (if present), `frontend/vite.config.ts` |
| **Quick run command** | `cd backend && npx vitest run --testPathPattern=ironclaw-concept` |
| **Full suite command** | `cd backend && npx vitest run && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx vitest run --testPathPattern=ironclaw-concept`
- **After every plan wave:** Run `cd backend && npx vitest run && cd ../frontend && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 66-01-01 | 01 | 1 | SC-01 | T-66-01..04 | user_did scoping, parameterized queries | unit | `npx vitest run --testPathPattern=concept-store` | -- W0 | pending |
| 66-01-02 | 01 | 1 | SC-01 | T-66-01..02 | user_did extraction from auth | integration | `npx vitest run --testPathPattern=concept-router` | -- W0 | pending |
| 66-02-01 | 02 | 1 | SC-07 | — | N/A | unit | `npx vitest run --testPathPattern=extraction` | -- W0 | pending |
| 66-02-02 | 02 | 1 | SC-07 | — | N/A | unit | `npx vitest run --testPathPattern=activity-store` | -- W0 | pending |
| 66-03-01 | 03 | 2 | SC-01 | — | N/A | integration | `npx vitest run --testPathPattern=retrieval` | -- W0 | pending |
| 66-03-02 | 03 | 2 | SC-01 | — | N/A | integration | `npx vitest run --testPathPattern=ironclaw-store` | -- W0 | pending |
| 66-04-01 | 04 | 2 | SC-01, SC-06 | — | N/A | integration | `npx vitest run --testPathPattern=ironclaw-service` | -- W0 | pending |
| 66-04-02 | 04 | 2 | SC-06 | — | N/A | integration | `npx vitest run --testPathPattern=ironclaw-service` | -- W0 | pending |
| 66-05-01 | 05 | 2 | SC-02, SC-09 | T-66-12..13 | user_did scoped fetches | component | `npx vitest run --testPathPattern=ConceptsPanel` | -- W0 | pending |
| 66-05-02 | 05 | 2 | SC-02, SC-09 | T-66-13 | type-validated POST | component | `npx vitest run --testPathPattern=DirectivesPanel` | -- W0 | pending |
| 66-06-01 | 06 | 3 | SC-04, SC-08 | T-66-14..15 | LLM output not eval'd | unit | `npx vitest run --testPathPattern=consolidation` | -- W0 | pending |
| 66-06-02 | 06 | 3 | SC-08 | T-66-15 | audit trail on decision paths | unit | `npx vitest run --testPathPattern=decision-path` | -- W0 | pending |
| 66-07-01 | 07 | 3 | SC-03 | T-66-16..17 | best-effort, non-blocking | integration | `npx vitest run --testPathPattern=sidecar-sync` | -- W0 | pending |
| 66-07-02 | 07 | 3 | SC-03 | T-66-16 | fire-and-forget wiring | integration | `npx vitest run --testPathPattern=sidecar-sync` | -- W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/ironclaw/__tests__/concept-store.test.ts` — stubs for concept CRUD, version chains, semantic search
- [ ] `backend/src/ironclaw/__tests__/concept-extraction.test.ts` — stubs for post-conversation extraction
- [ ] `backend/src/ironclaw/__tests__/concept-retrieval.test.ts` — stubs for learned context injection
- [ ] `backend/src/ironclaw/__tests__/concept-consolidation.test.ts` — stubs for cross-thread consolidation

*Existing vitest infrastructure covers backend. Frontend vitest already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidecar REPL memory commands | SC-03 | Requires running Ironclaw sidecar | Start sidecar, send /memory forget via FIFO, verify response |
| Embedding quality assessment | SC-06 | Subjective quality evaluation | Review 10 extracted concepts for accuracy and relevance |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
