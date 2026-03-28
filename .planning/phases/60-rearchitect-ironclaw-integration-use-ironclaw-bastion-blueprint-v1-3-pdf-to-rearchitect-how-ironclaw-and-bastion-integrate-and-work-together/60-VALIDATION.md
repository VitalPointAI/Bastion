---
phase: 60
slug: rearchitect-ironclaw-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 60 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (backend), Vitest (frontend) |
| **Config file** | `backend/package.json` test script |
| **Quick run command** | `cd backend && npm test -- --testPathPattern=ironclaw` |
| **Full suite command** | `cd backend && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npm test -- --testPathPattern=ironclaw`
- **After every plan wave:** Run `cd backend && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 60-01-01 | 01 | 1 | RLS isolation | integration | `cd backend && npm test -- --testPathPattern=rls` | ❌ W0 | ⬜ pending |
| 60-02-01 | 02 | 1 | Identity sync | unit | `cd backend && npm test -- --testPathPattern=identity-renderer` | ❌ W0 | ⬜ pending |
| 60-03-01 | 03 | 2 | AgentConfig CRUD | integration | `cd backend && npm test -- --testPathPattern=agent-config` | ❌ W0 | ⬜ pending |
| 60-04-01 | 04 | 2 | MCP DID auth | unit | `cd backend && npm test -- --testPathPattern=did-auth` | ❌ W0 | ⬜ pending |
| 60-05-01 | 05 | 3 | Telegram pairing | integration | `cd backend && npm test -- --testPathPattern=telegram` | ❌ W0 | ⬜ pending |
| 60-06-01 | 06 | 3 | AgentPreviewChat | e2e | `cd backend && npm test -- --testPathPattern=preview-chat` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/ironclaw/identity-renderer.test.ts` — unit tests for USER.md/SOUL.md renderers
- [ ] `backend/src/ironclaw/agent-config.test.ts` — AgentConfig CRUD tests
- [ ] `backend/src/mcp/middleware/did-auth.test.ts` — VC claim middleware tests
- [ ] `backend/database/migrations/ironclaw_workspace_rls.sql` — RLS migration file

*These stubs must be created before execution begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Telegram bot pairing flow | Telegram integration | Requires live Telegram bot token and mobile device | 1. Start bot, 2. Send /pair, 3. Verify DID link |
| AgentPreviewChat streaming | E2E chat | Requires live Ironclaw container | 1. Open drawer, 2. Send message, 3. Verify stream |
| RLS cross-container enforcement | Security | Requires two Docker containers running | 1. Write as user A, 2. Attempt read as user B, 3. Verify blocked |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
