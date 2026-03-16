---
phase: 47
slug: json-ld-semantic-brain-cop-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (TypeScript, existing backend + frontend test suites) |
| **Config file** | `backend/jest.config.ts` / frontend jest config |
| **Quick run command** | `npm test -- --testPathPattern="cop\|raft\|resolution\|confidence\|contradiction\|temporal" --no-coverage` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds (quick), ~120 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="cop|raft|resolution|confidence|contradiction|temporal" --no-coverage`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 47-01-01 | 01 | 1 | JSON-LD context file | unit | `npm test -- --testPathPattern="cco-schema-loader"` | extend existing | ⬜ pending |
| 47-01-02 | 01 | 1 | BFO/CCO ontology mapping | unit | `npm test -- --testPathPattern="cco-schema-loader"` | extend existing | ⬜ pending |
| 47-02-01 | 02 | 1 | Actor migration JSON-LD properties | unit | `npm test -- --testPathPattern="actor-store"` | ❌ W0 | ⬜ pending |
| 47-02-02 | 02 | 1 | Temporal query valid-at-time | unit | `npm test -- --testPathPattern="temporal"` | ❌ W0 | ⬜ pending |
| 47-03-01 | 03 | 1 | Confidence decay formula | unit | `npm test -- --testPathPattern="confidence"` | ❌ W0 | ⬜ pending |
| 47-03-02 | 03 | 1 | Multi-source fusion | unit | `npm test -- --testPathPattern="confidence"` | ❌ W0 | ⬜ pending |
| 47-03-03 | 03 | 1 | Contradiction detection | unit | `npm test -- --testPathPattern="contradiction"` | ❌ W0 | ⬜ pending |
| 47-04-01 | 04 | 1 | Entity resolution hybrid scoring | unit | `npm test -- --testPathPattern="resolution-service"` | extend existing | ⬜ pending |
| 47-05-01 | 05 | 2 | COP layer generation non-empty | integration | `npm test -- --testPathPattern="cop-coordinator"` | update existing | ⬜ pending |
| 47-05-02 | 05 | 2 | Sub-agent semantic query by type | unit | `npm test -- --testPathPattern="sub-agents"` | update existing | ⬜ pending |
| 47-06-01 | 06 | 2 | Brain timeline snapshot | unit | `npm test -- --testPathPattern="useBrainTimeline"` | ❌ W0 | ⬜ pending |
| 47-07-01 | 07 | 2 | Consumer wiring (doc-intel, OSINT, vision) | integration | `npm test -- --testPathPattern="cop\|raft"` | update existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/cop/cco/cco-schema-loader.test.ts` — extend for JSON-LD context loading
- [ ] `backend/src/graph/raft/actor-store.test.ts` — covers JSON-LD property migration + temporal queries
- [ ] `backend/src/graph/confidence-calculator.test.ts` — covers decay formula + fusion formula
- [ ] `backend/src/graph/contradiction-detector.test.ts` — covers :CONTRADICTS creation + temporal overlap
- [ ] `backend/src/graph/resolution/resolution-service.test.ts` — extend for hybrid three-signal scoring
- [ ] `frontend/src/components/brain/hooks/useBrainTimeline.test.ts` — covers validFrom/validTo filter logic

*Existing infrastructure partially covers — extensions and new test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Timeline slider visual playback | Temporal reasoning UI | Visual animation timing | Scrub slider, verify entities fade in/out at correct times |
| COP confidence visual encoding | Confidence on COP | CSS opacity/styling | Verify solid/dashed/dotted symbols match confidence bands |
| Contradiction red pulsing edges | Contradiction detection UI | Visual animation | Create conflicting assertions, verify red pulse in brain viz |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
