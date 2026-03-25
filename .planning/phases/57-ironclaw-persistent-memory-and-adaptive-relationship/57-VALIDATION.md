---
phase: 57
slug: ironclaw-persistent-memory-and-adaptive-relationship
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-25
---

# Phase 57 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (backend), vitest (frontend) |
| **Config file** | `backend/vitest.config.ts` |
| **Quick run command** | `cd backend && npx vitest run --reporter=verbose src/ironclaw/` |
| **Full suite command** | `cd backend && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx vitest run src/ironclaw/`
- **After every plan wave:** Run `cd backend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 57-01-01 | 01 | 1 | Schema, store, outcomes | unit | `vitest run src/ironclaw/ironclaw-memory-store.test.ts` | TDD (created in task) | pending |
| 57-02-01 | 02 | 2 | Memory injection, adaptive | unit | `vitest run src/ironclaw/ironclaw-memory-service.test.ts` | TDD (created in task) | pending |
| 57-02-02 | 02 | 2 | Service wiring | compile | `tsc --noEmit && vitest run src/ironclaw/` | N/A | pending |
| 57-03-01 | 03 | 3 | Memory API + auth isolation | unit | `vitest run src/ironclaw/ironclaw-router.test.ts` | created in task | pending |
| 57-03-02 | 03 | 3 | Memory UI | compile | `cd frontend && tsc --noEmit` | N/A | pending |
| 57-03-03 | 03 | 3 | Memory Panel visual | manual | browser verification | N/A | pending |
| 57-04-01 | 04 | 4 | Cleanup job + startup | compile | `tsc --noEmit && vitest run src/ironclaw/` | N/A | pending |
| 57-04-02 | 04 | 4 | Outcome recording hooks | compile | `tsc --noEmit && vitest run src/ironclaw/` | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/ironclaw/ironclaw-memory-store.test.ts` -- created during 57-01 TDD RED phase (types + store tests)
- [ ] `backend/src/ironclaw/ironclaw-memory-service.test.ts` -- created during 57-02 TDD RED phase (service tests)
- [ ] `backend/src/ironclaw/ironclaw-router.test.ts` -- created during 57-03 Task 1 (auth isolation tests)

*Existing vitest infrastructure covers framework needs. All test files are created within their respective plan tasks (TDD plans create tests as part of the RED phase).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Memory review UI | User can view/edit/delete memories | Visual interaction | Open Ironclaw drawer -> Memory tab -> verify list, edit, delete |
| Adaptive style change | Ironclaw adjusts communication | Requires multi-session observation | Reject 5+ suggestions -> verify reduced proactivity |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
