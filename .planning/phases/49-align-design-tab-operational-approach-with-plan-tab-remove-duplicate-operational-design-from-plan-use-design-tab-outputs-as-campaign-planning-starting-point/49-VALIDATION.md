---
phase: 49
slug: align-design-tab-operational-approach-with-plan-tab-remove-duplicate-operational-design-from-plan-use-design-tab-outputs-as-campaign-planning-starting-point
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 49 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc) + manual browser verification |
| **Config file** | tsconfig.json (existing) |
| **Quick run command** | `cd /home/vitalpointai/projects/ssr && npx tsc --noEmit` |
| **Full suite command** | TypeScript check + manual UI verification of Design→Plan flow |
| **Estimated runtime** | ~30 seconds (tsc) |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run TypeScript check + full browser smoke test of Design→Plan flow
- **Before `/gsd:verify-work`:** Full suite must be green + manual verification of revision workflow
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SG Step 2 removal | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DesignContextPanel empty state | manual | Browser inspection | N/A | ⬜ pending |
| TBD | TBD | TBD | DesignContextPanel read-only | manual | Browser inspection | N/A | ⬜ pending |
| TBD | TBD | TBD | Revision creates gate + record | manual | Browser + DB | N/A | ⬜ pending |
| TBD | TBD | TBD | StrategicAlignment step visible | manual | Browser navigation | N/A | ⬜ pending |
| TBD | TBD | TBD | COADevelopment LOEs from Design | manual | Browser inspection | N/A | ⬜ pending |
| TBD | TBD | TBD | OperationalApproach.tsx deleted | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No automated test framework configured — rely on TypeScript compilation + manual verification throughout

*Existing infrastructure covers compilation checks. Manual verification required for UI behavior.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DesignContextPanel renders with empty design data | Graceful empty state | UI visual behavior | Navigate to Plan tab JPP Step 2 with no Design data saved; verify placeholder shown |
| DesignContextPanel read-only enforcement | No edit in Plan tab | UI interaction behavior | Click on Design-sourced fields in Plan tab; verify no edit capability |
| Propose Revision creates governance gate | Fork-and-merge workflow | E2E workflow spanning DB + UI | Click "Propose Revision" in Plan tab; verify decision_gates and design_revisions records created |
| StrategicAlignment step renders correctly | SG restructure | UI navigation behavior | Navigate to strategic-echelon Plan tab; verify 3-step flow: Assessment → Alignment → Directive |
| Design→Plan auto-sync updates in real time | Auto-sync replaces push | Real-time UI behavior | Modify Design tab artifact; verify Plan tab reflects change without manual action |
| DAO approval merges revision back to Design | Governance-gated merge | Full governance lifecycle | Submit revision proposal, approve via DAO, verify Design tab updated |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
