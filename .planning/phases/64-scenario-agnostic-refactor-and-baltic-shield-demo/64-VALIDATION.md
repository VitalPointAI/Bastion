---
phase: 64
slug: scenario-agnostic-refactor-and-baltic-shield-demo
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 64 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), jest (backend), tsc |
| **Config file** | frontend/vitest.config.ts, backend/jest.config.ts |
| **Quick run command** | `bash -lc 'cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit'` |
| **Full suite command** | `bash -lc 'cd backend && npx jest --passWithNoTests && cd ../frontend && npx vitest run'` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bash -lc 'cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit'`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 64-01-01 | 01 | 1 | SA-64-01 | build+grep | `tsc --noEmit && grep -r "25.042\|25.054\|121.512\|121.518" backend/src/ frontend/src/` | ❌ W0 | ⬜ pending |
| 64-01-02 | 01 | 1 | SA-64-02 | build+grep | `tsc --noEmit && grep -r "CJTF WestPAC\|PRC/TCC" frontend/src/` | ❌ W0 | ⬜ pending |
| 64-01-03 | 01 | 1 | SA-64-03 | build+grep | `tsc --noEmit && grep -rn "KNOWN_VEHICLES\|THREAT_CLASS_MAP" backend/src/ --include="*.ts" \| wc -l` | ❌ W0 | ⬜ pending |
| 64-02-01 | 02 | 2 | SA-64-04 | build | `tsc --noEmit` | ✅ | ⬜ pending |
| 64-02-02 | 02 | 2 | SA-64-05 | build | `tsc --noEmit` | ✅ | ⬜ pending |
| 64-02-03 | 02 | 2 | SA-64-08 | build | `tsc --noEmit` | ✅ | ⬜ pending |
| 64-02-04 | 02 | 2 | SA-64-11 | build | `tsc --noEmit` | ✅ | ⬜ pending |
| 64-03-01 | 03 | 3 | SA-64-06 | build+grep | `tsc --noEmit && grep -r "Taiwan Strait\|Western Pacific\|Indo-Pacific" backend/src/exercise/ frontend/src/` | ❌ W0 | ⬜ pending |
| 64-03-02 | 03 | 3 | SA-64-07 | build | `tsc --noEmit` | ✅ | ⬜ pending |
| 64-03-03 | 03 | 3 | SA-64-09 | build | `tsc --noEmit` | ✅ | ⬜ pending |
| 64-03-04 | 03 | 3 | SA-64-10 | build | `tsc --noEmit` | ✅ | ⬜ pending |
| 64-04-01 | 04 | 4 | SA-64-12 | grep-sweep | `grep -rn "Taipei\|Zhongzheng\|Iron.Bastion\|IRON_BASTION\|ZHONGZHENG\|PRC/TCC\|INDOPACOM\|Pacific Strategy" backend/src/ frontend/src/ --include="*.ts" --include="*.tsx"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Grep-based validation scripts for checking zero hardcoded scenario references after each wave
- [ ] TypeScript compilation check (tsc --noEmit) as the primary "did we break anything" gate

*Existing infrastructure covers most phase requirements — this is a refactoring phase where build success + grep absence are the key validators.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mission sequence runs on Baltic coords | SA-64-04, SA-64-05 | Requires physical robot or simulation | Start mission via API, verify COP shows movement in Latvian coordinates |
| COP map centers on correct location | SA-64-01 | Visual UI verification | Open COP, verify map centers on Latvia (~56.85N, 27.70E) not Taipei |
| Coalition caveats show correct nations | SA-64-02 | Visual UI verification | Open coalition dashboard, verify Latvia/US/UK labels (not TW/US/AU) |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
