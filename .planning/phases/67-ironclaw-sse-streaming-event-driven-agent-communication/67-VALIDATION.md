---
phase: 67
slug: ironclaw-sse-streaming-event-driven-agent-communication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 67 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x / vitest |
| **Config file** | `frontend/vitest.config.ts` / `backend/jest.config.js` |
| **Quick run command** | `bash -lc 'cd backend && npx jest --testPathPattern=ironclaw'` |
| **Full suite command** | `bash -lc 'cd backend && npx jest && cd ../frontend && npx vitest run'` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bash -lc 'cd backend && npx jest --testPathPattern=ironclaw'`
- **After every plan wave:** Run `bash -lc 'cd backend && npx jest && cd ../frontend && npx vitest run'`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 67-01-01 | 01 | 1 | SSE endpoint | — | N/A | integration | `bash -lc 'cd backend && npx jest --testPathPattern=sse'` | ❌ W0 | ⬜ pending |
| 67-01-02 | 01 | 1 | event persistence table | — | N/A | integration | `bash -lc 'cd backend && npx jest --testPathPattern=event-store'` | ❌ W0 | ⬜ pending |
| 67-01-03 | 01 | 1 | event types | — | N/A | unit | `bash -lc 'cd backend && npx jest --testPathPattern=event-types'` | ❌ W0 | ⬜ pending |
| 67-01-04 | 01 | 2 | reconnection with last-event-id | — | N/A | integration | `bash -lc 'cd backend && npx jest --testPathPattern=reconnect'` | ❌ W0 | ⬜ pending |
| 67-01-05 | 02 | 2 | frontend EventSource integration | — | N/A | unit | `bash -lc 'cd frontend && npx vitest run --testPathPattern=useIronclaw'` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/ironclaw/__tests__/sse-stream.test.ts` — SSE endpoint and event emission tests
- [ ] `backend/src/ironclaw/__tests__/ironclaw-event-store.test.ts` — event persistence and replay tests
- [ ] `frontend/src/hooks/__tests__/useIronclaw.test.ts` — EventSource lifecycle tests

*Existing infrastructure covers test framework installation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Token-by-token typewriter rendering | D-05 | Visual rendering behavior | Send message, verify text appears word-by-word in browser |
| Clickable delegation link navigation | D-10 | UI navigation behavior | Trigger delegation, click link, verify agent panel opens |
| Reconnection catch-up UX | D-08 | Network interruption simulation | Disconnect network, reconnect, verify missed events appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
