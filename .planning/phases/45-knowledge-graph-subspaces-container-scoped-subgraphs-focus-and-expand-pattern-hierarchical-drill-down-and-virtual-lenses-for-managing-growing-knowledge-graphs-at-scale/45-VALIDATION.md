---
phase: 45
slug: knowledge-graph-subspaces
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (no test runner configured) |
| **Config file** | `frontend/tsconfig.json` |
| **Quick run command** | `cd frontend && npm run typecheck` |
| **Full suite command** | `cd frontend && npm run typecheck && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm run typecheck`
- **After every plan wave:** Run `cd frontend && npm run typecheck && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green + manual smoke test of 4 drill levels
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| SUB-01 | TBD | TBD | Container subspaces auto-populate | manual-only | Visual verification | N/A | ⬜ pending |
| SUB-02 | TBD | TBD | Custom lasso subspace saves/reloads | manual-only | Visual verification | N/A | ⬜ pending |
| SUB-03 | TBD | TBD | Smart subspace re-evaluates on update | unit | `npm run typecheck` | ❌ W0 | ⬜ pending |
| LENS-01 | TBD | TBD | Built-in lenses apply correct filters | manual-only | Visual verification | N/A | ⬜ pending |
| LENS-02 | TBD | TBD | Custom lens saves/loads from PostgreSQL | integration | Requires DB | ❌ W0 | ⬜ pending |
| NHOP-01 | TBD | TBD | N-hop endpoint returns correct nodes | integration | API test against backend | ❌ W0 | ⬜ pending |
| DRILL-01 | TBD | TBD | 4-level drill-down breadcrumb state | unit | `npm run typecheck` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No test runner — TypeScript compile check is primary automated verification
- [ ] N-hop endpoint needs integration test stub once endpoint exists
- [ ] Type check covers state shape correctness for drill-down and lens state

*Existing infrastructure covers TypeScript compile checks. No additional framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Container subspace auto-populate | SUB-01 | 3D visual rendering | Navigate to brain, verify clusters match containers |
| Lasso subspace creation | SUB-02 | Interactive 3D selection | Draw lasso on graph, save subspace, verify reload |
| Built-in lens application | LENS-01 | Visual filter + layout | Apply each J2/J3/J5/Overview lens, verify correct nodes shown |
| Drill-down animations | DRILL-01 | Camera transitions | Double-click cluster, verify smooth zoom + breadcrumb update |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
