---
phase: 61
slug: responsive-ui-mobile-optimization
status: draft
nyquist_compliant: true
wave_0_complete: true
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
| **Quick run command** | `cd frontend && bash -lc 'npx vite build 2>&1 \| tail -5'` |
| **Full suite command** | `cd frontend && bash -lc 'npx vitest run --reporter=verbose'` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick build command (catches broken JSX/CSS)
- **After every plan wave:** Run full vitest suite + manual browser check at 375px/768px/1280px
- **Before `/gsd:verify-work`:** Full suite must be green + visual sign-off at all four breakpoints
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 61-01-01 | 01 | 1 | RESP-01 | build | `npx tsc --noEmit` | pending |
| 61-01-02 | 01 | 1 | RESP-02, RESP-03 | build | `npx vite build 2>&1 \| tail -5` | pending |
| 61-02-01 | 02 | 2 | RESP-04 | build + manual | `npx vite build 2>&1 \| tail -5` + visual at 375px/768px/1280px | pending |

**Rationale:** Responsive UI is primarily visual/CSS work. Unit-testing CSS class presence (e.g., asserting `overflow-x-auto` is in a className) has low ROI — it tests implementation details, not behavior. The `tsc --noEmit` and `vite build` commands catch all structural breakages (broken JSX, invalid CSS, missing imports). Actual responsive correctness is verified visually via the checkpoint in Plan 02.

---

## Wave 0 Requirements

No Wave 0 test stubs required. Responsive CSS changes are verified by:
1. **TypeScript compilation** (`tsc --noEmit`) — catches broken TSX/imports
2. **Vite production build** (`vite build`) — catches broken CSS, invalid class references, build errors
3. **Manual visual testing** at 375px/768px/1024px/1280px — catches layout/overflow issues

This is appropriate because:
- CSS class presence tests are brittle and test implementation, not behavior
- Media query behavior cannot be tested in jsdom (no viewport)
- The checkpoint:human-verify task in Plan 02 provides the authoritative visual sign-off

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

- [x] All tasks have `<automated>` verify commands (tsc/vite build)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No Wave 0 dependencies (build-based verification sufficient for CSS work)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
