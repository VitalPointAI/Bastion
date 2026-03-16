---
phase: 48
slug: robot-swarm-behaviour-end-to-end-demo
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Python)** | pytest (existing in `robot/`) |
| **Framework (TypeScript)** | tsc --noEmit (existing) |
| **Config file** | `robot/conftest.py` (exists) |
| **Quick run command** | `cd /home/vitalpointai/projects/ssr && python -m pytest robot/tests/ -x -q --tb=short` |
| **Full suite command** | `cd /home/vitalpointai/projects/ssr && python -m pytest robot/tests/ -v && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python -m pytest robot/tests/ -x -q --tb=short`
- **After every plan wave:** Run `python -m pytest robot/tests/ -v && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 48-01-01 | 01 | 1 | Formation polygon rendering | unit | `pytest robot/tests/test_swarm_cop.py::test_polygon_hull_ordering -x` | ❌ W0 | ⬜ pending |
| 48-01-02 | 01 | 1 | Formation state colors | unit | `pytest robot/tests/test_swarm_cop.py::test_formation_state_colors -x` | ❌ W0 | ⬜ pending |
| 48-02-01 | 02 | 1 | Coalition caveat blocks US urban advance | unit | `pytest robot/tests/test_coalition_caveat.py::test_us_urban_advance_blocked -x` | ❌ W0 | ⬜ pending |
| 48-02-02 | 02 | 1 | Coalition caveat allows AU recon only | unit | `pytest robot/tests/test_coalition_caveat.py::test_au_recon_only -x` | ❌ W0 | ⬜ pending |
| 48-03-01 | 03 | 1 | Multi-robot confidence fusion | unit | `pytest robot/tests/test_corroboration.py::test_confidence_fusion -x` | ❌ W0 | ⬜ pending |
| 48-04-01 | 04 | 1 | Swarm graph event dedup | unit | `pytest robot/tests/test_swarm_graph.py::test_event_dedup -x` | ❌ W0 | ⬜ pending |
| 48-04-02 | 04 | 1 | National provenance tags | unit | `pytest robot/tests/test_swarm_graph.py::test_national_provenance -x` | ❌ W0 | ⬜ pending |
| 48-XX-XX | XX | X | TypeScript types compile | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `robot/tests/test_swarm_cop.py` — polygon hull ordering, formation state colors
- [ ] `robot/tests/test_coalition_caveat.py` — all three national profiles, block/allow scenarios
- [ ] `robot/tests/test_corroboration.py` — confidence fusion with 2-3 source robots
- [ ] `robot/tests/test_swarm_graph.py` — event MERGE dedup, national provenance tags

*Existing infrastructure covers TypeScript compile verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Smooth interpolated movement on COP map | COP visualization | Requires visual inspection of animation | Open COP, trigger swarm movement, verify no position jumps |
| Formation polygon visual appearance | COP visualization | Visual design judgment | Open COP, verify translucent polygon connects formation members with correct shape |
| Detection attribution toggle | COP visualization | Interactive UI feature | Click toggle, verify attribution lines appear/disappear |
| Movement technique animation | COP visualization | Animated bounding/overwatch visual | Trigger bounding overwatch, verify animated roles alternate |
| Full 10-min demo flow | End-to-end integration | Multi-system orchestration | Run complete demo scenario from directive ingestion to timeline playback |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
