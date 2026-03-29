---
phase: 63
slug: unified-osint-agent-ingestion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 63 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | See `osint-graph-sync.test.ts` pattern |
| **Quick run command** | `bash -lc 'cd backend && npx vitest run src/osint/'` |
| **Full suite command** | `bash -lc 'cd backend && npx vitest run'` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bash -lc 'cd backend && npx vitest run src/osint/'`
- **After every plan wave:** Run `bash -lc 'cd backend && npx vitest run'`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 63-01-01 | 01 | 1 | OSINT-63-01 | unit (mock graph) | `npx vitest run src/osint/osint-agent-bridge.test.ts` | ❌ W0 | ⬜ pending |
| 63-01-02 | 01 | 1 | OSINT-63-02 | unit | same file | ❌ W0 | ⬜ pending |
| 63-01-03 | 01 | 1 | OSINT-63-04 | unit (spy) | `npx vitest run src/osint/osint-agent-bridge.test.ts` | ❌ W0 | ⬜ pending |
| 63-01-04 | 01 | 1 | OSINT-63-05 | unit | same file | ❌ W0 | ⬜ pending |
| 63-02-01 | 02 | 2 | OSINT-63-03 | compile check | `bash -lc 'cd backend && npx tsc --noEmit'` | N/A | ⬜ pending |
| 63-02-02 | 02 | 2 | OSINT-63-06 | compile check | `bash -lc 'cd backend && npx tsc --noEmit'` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/osint/osint-agent-bridge.test.ts` — covers OSINT-63-01 through OSINT-63-05

*Bridge test file stubs needed before execution.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| NATO ratings appear on OSINT-sourced actors in Brain tab | OSINT-63-07 | Requires visual verification in UI | Open Brain tab, check OSINT actor detail panel for NATO reliability badge |
| TrustAgent correctly flags unknown RSS sources | OSINT-63-08 | Requires live LLM evaluation | Add new unknown RSS feed, verify trust flag on first poll |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
