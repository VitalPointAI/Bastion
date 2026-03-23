---
phase: 55
slug: ironclaw-guided-design-interview-for-operational-approach-development
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend) / jest (backend) |
| **Config file** | `frontend/vitest.config.ts`, `backend/jest.config.ts` |
| **Quick run command** | `cd backend && npm test -- --testPathPattern=design-interview` |
| **Full suite command** | `cd backend && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npm test -- --testPathPattern=design-interview`
- **After every plan wave:** Run `cd backend && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 55-01-01 | 01 | 1 | Design interview starts | unit | `npm test -- --testPathPattern=design-interview-service` | ❌ W0 | ⬜ pending |
| 55-01-02 | 01 | 1 | Interview resumes from checkpoint | unit | `npm test -- --testPathPattern=design-interview-service` | ❌ W0 | ⬜ pending |
| 55-01-03 | 01 | 1 | Coverage criteria evaluated per section | unit | `npm test -- --testPathPattern=design-interview-service` | ❌ W0 | ⬜ pending |
| 55-01-04 | 01 | 1 | Thread ID collision prevention | unit | `npm test -- --testPathPattern=design-interview-service` | ❌ W0 | ⬜ pending |
| 55-01-05 | 01 | 1 | System message filter | unit | `npm test -- --testPathPattern=design-interview-service` | ❌ W0 | ⬜ pending |
| 55-02-01 | 02 | 1 | update_section MCP tool registered | unit | `npm test -- --testPathPattern=tool-bridge` | ❌ W0 | ⬜ pending |
| 55-03-01 | 03 | 2 | Skill .md files parseable | unit | `npm test -- --testPathPattern=design-skills` | ❌ W0 | ⬜ pending |
| 55-03-02 | 03 | 2 | Overlay producer returns valid SVG | unit | `npm test -- --testPathPattern=design-skills` | ❌ W0 | ⬜ pending |
| 55-03-03 | 03 | 2 | Resource allocator queries registry | integration | `npm test -- --testPathPattern=design-skills` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/design-interview/design-interview-service.test.ts` — stubs for interview graph nodes, checkpoint resume, coverage criteria, thread ID, system message filter
- [ ] `backend/src/skills/design-skills.test.ts` — handler output validation for overlay producer, resource allocator, campaign visualizer, risk visualizer

*Existing test infrastructure covers framework setup; only new test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Ironclaw drawer opens with suggestion card on empty Design tab | Proactive trigger UX | Requires browser rendering + user interaction | Open Design tab with empty sections, verify suggestion card appears |
| Multi-user collaborative interview | Yjs real-time sync | Requires 2 browser sessions | Open same problem set in 2 tabs, verify shared interview state |
| Real-time Design tab field population during interview | Visual update during chat | Requires live WebSocket + UI render | Run interview, verify Design sections update as answers are captured |
| Red team / devil's advocate questioning style | Doctrinal questioning quality | LLM output quality assessment | Run interview, verify challenge-then-recommend pattern in responses |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
