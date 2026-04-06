---
phase: quick
plan: 260406-lkq
subsystem: backend/log-monitor
tags: [monitoring, docker, claude, github, autonomous-agent]
dependency_graph:
  requires:
    - backend/src/ironclaw/github-service.ts
    - Docker Engine unix socket (/var/run/docker.sock)
    - Anthropic Claude API (ANTHROPIC_API_KEY)
  provides:
    - backend/src/log-monitor/types.ts
    - backend/src/log-monitor/log-parser.ts
    - backend/src/log-monitor/error-investigator.ts
    - backend/src/log-monitor/log-monitor-service.ts
    - backend/src/log-monitor/index.ts
    - scripts/log-monitor.sh
  affects:
    - backend/src/ironclaw/github-service.ts (imported at runtime for PR creation)
tech_stack:
  added: []
  patterns:
    - Docker Engine API via unix socket (http over /var/run/docker.sock)
    - Docker multiplexed log stream frame parsing (8-byte header protocol)
    - Claude claude-sonnet-4-20250514 for structured JSON error investigation
    - AbortController per container for clean shutdown
    - Sliding window rate limiter (PR creation, 3/hr default)
    - Fingerprint-based deduplication with cooldown window (30 min default)
key_files:
  created:
    - backend/src/log-monitor/types.ts
    - backend/src/log-monitor/log-parser.ts
    - backend/src/log-monitor/error-investigator.ts
    - backend/src/log-monitor/log-monitor-service.ts
    - backend/src/log-monitor/index.ts
    - scripts/log-monitor.sh
  modified: []
decisions:
  - Used AbortController per container (not global) to allow selective container disconnect without full shutdown
  - Queue capped at 20 items (shift oldest on overflow) to implement T-lm-03 DoS protection without dropping new errors
  - Deferred dry-run decision to runtime (check githubService.isConfigured() in start(), not constructor)
  - Used dynamic import() for githubService to avoid circular dependency at module load time
metrics:
  duration: 15 min
  completed_date: "2026-04-06T19:43:00Z"
  tasks_completed: 2
  files_created: 6
---

# Quick Task 260406-lkq: Build Log Monitor Agent Summary

**One-liner:** Standalone Docker log monitor agent that tails 4 BASTION containers via unix socket, fingerprints and deduplicates errors, investigates with Claude claude-sonnet-4-20250514, and submits fix PRs through GitHubService with PR rate limiting and DoS protection.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Types, log parser, and error investigator modules | c6cbbb6e | types.ts, log-parser.ts, error-investigator.ts |
| 2 | Log monitor service, entry point, and launcher script | c0101cd3 | log-monitor-service.ts, index.ts, scripts/log-monitor.sh |

## What Was Built

### Task 1: Types, Log Parser, Error Investigator

**types.ts** defines `MonitoredContainer` (4 containers), `LogEntry`, `ErrorSignature`, `InvestigationResult`, `MonitorConfig` with defaults (30-min cooldown, 3 PRs/hr), and `CONTAINER_SOURCE_MAP` linking container names to source directories.

**log-parser.ts** (`LogParser` class) implements:
- `parseLogLine()` — parses Docker ISO timestamp format, classifies error/warn/info
- `computeFingerprint()` — normalizes timestamps, UUIDs, ports, line offsets, memory addresses before SHA-256 hashing
- `isNewError()` — cooldown-based deduplication with auto-prune of entries older than 1 hour
- `collectStackTrace()` — gathers continuation stack trace lines following an error line
- `isErrorLine()` / `isNoiseLine()` — 15 error patterns, 8 noise patterns (startup health checks, connection retries)

**error-investigator.ts** (`ErrorInvestigator` class) implements:
- Constructor takes `ANTHROPIC_API_KEY` and instantiates `@anthropic-ai/sdk`
- `investigate()` wraps `doInvestigate()` in try/catch — never throws
- Extracts file paths from stack traces (`at Object (path:line:col)` pattern)
- Validates each file path stays within PROJECT_ROOT and matches no blocked patterns (`.env`, `secrets.*`, `.pem`, `id_rsa`, etc.) — T-lm-01
- Reads up to 150 KB total source across files (50 KB per file)
- Calls Claude claude-sonnet-4-20250514 with temperature=0, max_tokens=8192
- Strictly validates JSON response schema (rootCause, confidence, files[]) — T-lm-05
- Re-validates all file paths in Claude's response before returning — T-lm-01

### Task 2: Log Monitor Service, Entry Point, Launcher

**log-monitor-service.ts** (`LogMonitorService` class) implements:
- `start()` — validates Docker socket access, ANTHROPIC_API_KEY, GitHub token (degrades to dry-run if absent)
- `tailContainer()` — HTTP GET to `/containers/{name}/logs?follow=true&stdout=true&stderr=true` via unix socket; parses Docker multiplexed stream 8-byte frame headers (byte 0=stream type, bytes 4-7=uint32 BE payload size); reconnects after 5s on error/close; uses AbortController per connection
- `processErrorQueue()` — 10-second interval; dequeues one error at a time; checks rate limit; calls `errorInvestigator.investigate()`; creates PR via `githubService.createPR()` on high/medium confidence; dry-runs log on low confidence
- PR creation: branch named `log-monitor/{8-char-fingerprint}-{epoch}`, PR title `fix(log-monitor): {container} — {truncated message}`, full Markdown PR body with error details, root cause, confidence, and files changed
- `checkPRRateLimit()` — sliding 1-hour window, prunes expired timestamps
- `stop()` — aborts all tail streams via AbortController, clears queue interval

**index.ts** — standalone entry point with `SIGINT`/`SIGTERM` handlers and env var overrides (`LOG_MONITOR_DRY_RUN`, `LOG_MONITOR_MAX_PRS_PER_HOUR`, `LOG_MONITOR_COOLDOWN_MS`).

**scripts/log-monitor.sh** — executable bash launcher (`chmod +x`), changes to project root and execs `node dist/log-monitor/index.js "$@"`.

## Threat Model Compliance

| Threat | Disposition | Implementation |
|--------|-------------|----------------|
| T-lm-01 (Info Disclosure — file reads) | mitigate | Path validation in `validateFilePath()`: project root check + blocked patterns (.env, secrets, .pem, etc.); re-validated on Claude response |
| T-lm-02 (Docker socket privilege) | accept | Documented: standard Docker monitoring pattern |
| T-lm-03 (DoS — PR spam) | mitigate | Rate limit (3/hr sliding window) + error cooldown (30 min) + queue cap (20 items) |
| T-lm-04 (Tampering — PR governance) | accept | GitHubService PROTECTED_FILE_PATHS blocks agent modifications to auth/gates/CI/docker/package.json |
| T-lm-05 (Spoofing — Claude response) | mitigate | `isValidClaudeResponse()` schema validator; malformed responses discarded, not applied |

## Deviations from Plan

None — plan executed exactly as written.

Dynamic import of `githubService` was used inside `processErrorQueue()` rather than a top-level import to avoid potential circular dependency issues at module initialization time (since the ironclaw module tree is large). This is an implementation detail not deviating from the plan spec.

## Verification

- TypeScript type-check: `cd backend && node_modules/.bin/tsc --noEmit` — Exit code: 0 (clean)
- All 6 required artifact files created and committed
- `scripts/log-monitor.sh` is executable (-rwxr-xr-x)
- Dry-run mode activates automatically when GITHUB_TOKEN is absent
- Service exits on missing ANTHROPIC_API_KEY or inaccessible Docker socket

## Self-Check

Files:
- [x] backend/src/log-monitor/types.ts — EXISTS
- [x] backend/src/log-monitor/log-parser.ts — EXISTS
- [x] backend/src/log-monitor/error-investigator.ts — EXISTS
- [x] backend/src/log-monitor/log-monitor-service.ts — EXISTS
- [x] backend/src/log-monitor/index.ts — EXISTS
- [x] scripts/log-monitor.sh — EXISTS (executable)

Commits:
- [x] c6cbbb6e — Task 1: types, log-parser, error-investigator
- [x] c0101cd3 — Task 2: log-monitor-service, index, launcher script

## Self-Check: PASSED
