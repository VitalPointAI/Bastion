---
phase: 52
slug: agent-skills-mcp
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 52 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), jest (backend — via tsc + node test runner) |
| **Config file** | `frontend/vitest.config.ts`, `backend/tsconfig.json` |
| **Quick run command** | `bash -lc 'cd backend && npx tsc --noEmit' && bash -lc 'cd frontend && npx eslint .'` |
| **Full suite command** | `bash -lc 'cd backend && npx tsc --noEmit' && bash -lc 'npm --prefix frontend run build'` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command (tsc + eslint)
- **After every plan wave:** Run full suite command (tsc + build)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 52-01-01 | 01 | 1 | REQ-52-01 | integration | MCP server starts + tool listing | ❌ W0 | ⬜ pending |
| 52-01-02 | 01 | 1 | REQ-52-01 | integration | Agent connects to MCP + executes tool | ❌ W0 | ⬜ pending |
| 52-02-01 | 02 | 1 | REQ-52-02 | unit | Skill CRUD store operations | ❌ W0 | ⬜ pending |
| 52-02-02 | 02 | 2 | REQ-52-02 | e2e | Admin UI skill create/assign | ❌ W0 | ⬜ pending |
| 52-03-01 | 03 | 2 | REQ-52-03 | integration | Ironclaw action card → agent.create executes | ❌ W0 | ⬜ pending |
| 52-03-02 | 03 | 2 | REQ-52-03 | integration | Ironclaw action card → skill.create executes | ❌ W0 | ⬜ pending |
| 52-04-01 | 04 | 3 | REQ-52-04 | integration | Suggestion with targetField → field updated | ❌ W0 | ⬜ pending |
| 52-04-02 | 04 | 3 | REQ-52-04 | integration | Permission check blocks unauthorized field write | ❌ W0 | ⬜ pending |
| 52-05-01 | 05 | 3 | REQ-52-05 | integration | Task lifecycle: create → dispatch → collect → apply | ❌ W0 | ⬜ pending |
| 52-05-02 | 05 | 3 | REQ-52-05 | e2e | Multi-step task with approval checkpoint | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] MCP server test harness (connection + tool execution mock)
- [ ] Skill store unit test stubs
- [ ] Ironclaw action handler test fixtures
- [ ] Field write-back integration test setup
- [ ] Task orchestrator lifecycle test stubs

*Existing tsc + eslint + build infrastructure covers compilation verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MCP server Docker container starts | REQ-52-01 | Container orchestration | `docker compose up bastion-mcp` — verify healthy |
| Ironclaw drawer shows task progress | REQ-52-05 | UI visual | Assign task, watch progress in drawer |
| Permission-gated field writes | REQ-52-04 | Role-based auth | Test as Commander vs Staff Officer |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
