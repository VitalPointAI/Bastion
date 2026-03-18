---
phase: 51
slug: unified-agent-architecture
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), jest (backend) |
| **Config file** | `frontend/vitest.config.ts`, `backend/jest.config.ts` |
| **Quick run command** | `cd frontend && npx vitest run --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `cd frontend && npx vitest run && cd ../backend && npx jest --passWithNoTests` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 51-01-01 | 01 | 1 | Standard agent base | unit | `npx jest --testPathPattern=agent-store` | ❌ W0 | ⬜ pending |
| 51-01-02 | 01 | 1 | Persistent memory | unit | `npx jest --testPathPattern=agent-memory` | ❌ W0 | ⬜ pending |
| 51-02-01 | 02 | 1 | Agent CRUD API | integration | `npx jest --testPathPattern=agent-api` | ❌ W0 | ⬜ pending |
| 51-03-01 | 03 | 2 | Agent dashboard UI | component | `npx vitest run --testPathPattern=AgentDashboard` | ❌ W0 | ⬜ pending |
| 51-04-01 | 04 | 2 | Team designer UI | component | `npx vitest run --testPathPattern=TeamDesigner` | ❌ W0 | ⬜ pending |
| 51-05-01 | 05 | 3 | Ironclaw delegation | integration | `npx jest --testPathPattern=ironclaw-delegation` | ❌ W0 | ⬜ pending |
| 51-06-01 | 06 | 3 | AI panel removal | component | `npx vitest run --testPathPattern=IronclawPanel` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/agents/__tests__/agent-store.test.ts` — stubs for DB-backed agent store
- [ ] `backend/src/agents/__tests__/agent-memory.test.ts` — stubs for persistent memory
- [ ] `frontend/src/components/admin/__tests__/AgentDashboard.test.tsx` — stubs for dashboard

*Test files created during plan execution.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Agent dashboard UX flow | Admin dashboard | Visual/interaction quality | Create agent, edit config, toggle active, verify health panel updates |
| Team designer drag-and-drop | Team designer UI | Complex interaction | Drag agents into team, assign leader, test workflow |
| Ironclaw delegation end-to-end | Ironclaw consolidation | Requires sidecar | Send "assign escalation-modeler" via chat, verify delegation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
