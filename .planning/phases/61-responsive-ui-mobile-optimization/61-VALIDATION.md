---
phase: 61
slug: responsive-ui-mobile-optimization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 61 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.16 + @testing-library/react |
| **Config file** | `vite.config.ts` (vitest section) + `src/test-setup.ts` |
| **Quick run command** | `cd frontend && bash -lc 'npx vitest run --reporter=verbose 2>&1 \| tail -20'` |
| **Full suite command** | `cd frontend && bash -lc 'npx vitest run --reporter=verbose'` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite + manual browser check at 375px/768px/1280px
- **Before `/gsd:verify-work`:** Full suite must be green + visual sign-off at all four breakpoints
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 61-01-01 | 01 | 1 | RESP-01 | unit | `npx vitest run src/components/ironclaw/IronclawDrawer.test.tsx -x` | ❌ W0 | ⬜ pending |
| 61-01-02 | 01 | 1 | RESP-02 | unit | `npx vitest run src/components/problem-set/OrgTreeSidebar.test.tsx -x` | ❌ W0 | ⬜ pending |
| 61-01-03 | 01 | 1 | RESP-03 | unit | `npx vitest run src/components/problem-set/ProblemSetTabContainer.test.tsx -x` | ❌ W0 | ⬜ pending |
| 61-02-01 | 02 | 2 | RESP-04 | manual | Visual test at 375px, 768px, 1280px | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/components/ironclaw/IronclawDrawer.test.tsx` — stubs for RESP-01 (drawer class structure)
- [ ] `frontend/src/components/problem-set/OrgTreeSidebar.test.tsx` — stubs for RESP-02 (max-w guard)
- [ ] `frontend/src/components/problem-set/ProblemSetTabContainer.test.tsx` — stubs for RESP-03 (tab bar overflow)

*Existing infrastructure (vitest + @testing-library/react) is already installed. No framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All modal/dialog widths use `min(Npx, 95vw)` | RESP-04 | Visual layout verification across viewports | Resize browser to 375px, 768px, 1280px; open each modal type |
| No horizontal scroll on any page at mobile width | RESP-05 | Layout overflow is visual | Set viewport to 375px, navigate all 7 tabs, check no horizontal scroll |
| Tab bar scrollable on narrow screens | RESP-06 | Touch scroll behavior | On mobile viewport, verify tab bar scrolls horizontally with touch |
| IronclawDrawer overlay on tablet | RESP-07 | Layout interaction | At 768-1024px, open Ironclaw drawer, verify it overlays not pushes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
