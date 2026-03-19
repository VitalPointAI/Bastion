---
phase: 53
slug: did-governance-architecture-bug-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 53 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), jest (backend where configured), tsc --noEmit |
| **Config file** | `frontend/vitest.config.ts`, `backend/tsconfig.json` |
| **Quick run command** | `bash -lc 'cd backend && npx tsc --noEmit' && bash -lc 'cd frontend && npx tsc --noEmit'` |
| **Full suite command** | `bash -lc 'cd backend && npx tsc --noEmit' && bash -lc 'cd frontend && npx tsc --noEmit'` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run TypeScript compilation check
- **After every plan wave:** Run full compilation for both frontend and backend
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | compilation | `tsc --noEmit` | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DID governance resolves from on-chain document | DID-GOV | Requires blockchain interaction | Create agent, verify DID doc contains governance, modify via DAO, verify pipeline uses new values |
| Decide tab renders pending decisions | DECIDE-TAB | UI interaction | Open Decide tab, verify decisions appear with approve/reject/defer actions |
| Ironclaw surfaces decisions proactively | IRONCLAW-DECIDE | Multi-user workflow | Log in as different roles, verify correct decisions surface per RACI |
| Agent Hub shows matching counts | BUG-FIX | UI verification | Compare Health and Agents tab counts |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
