---
phase: quick
plan: 260406-lkq
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/log-monitor/log-monitor-service.ts
  - backend/src/log-monitor/log-parser.ts
  - backend/src/log-monitor/error-investigator.ts
  - backend/src/log-monitor/index.ts
  - backend/src/log-monitor/types.ts
  - scripts/log-monitor.sh
autonomous: true

must_haves:
  truths:
    - "Log monitor tails Docker logs from frontend, backend, ironclaw, and mcp containers in real-time"
    - "Errors and exceptions are detected via pattern matching against known error signatures"
    - "Detected errors are investigated by Claude, which reads relevant source files to understand root cause"
    - "Fixes are submitted as PRs via the existing GitHubService using the ironclaw/ branch prefix and governance guardrails"
    - "Duplicate errors within a cooldown window are deduplicated to prevent PR spam"
  artifacts:
    - path: "backend/src/log-monitor/types.ts"
      provides: "Shared types for log entries, error signatures, investigation results"
    - path: "backend/src/log-monitor/log-parser.ts"
      provides: "Docker log stream parsing and error pattern detection"
    - path: "backend/src/log-monitor/error-investigator.ts"
      provides: "Claude-powered error investigation and fix generation"
    - path: "backend/src/log-monitor/log-monitor-service.ts"
      provides: "Main service: tails containers, coordinates parse -> investigate -> fix -> PR pipeline"
    - path: "backend/src/log-monitor/index.ts"
      provides: "Standalone entry point — runs the service as its own process"
    - path: "scripts/log-monitor.sh"
      provides: "Convenience launcher script"
  key_links:
    - from: "backend/src/log-monitor/log-monitor-service.ts"
      to: "Docker Engine API via /var/run/docker.sock"
      via: "HTTP requests to unix socket (same pattern as self-update-service.ts)"
      pattern: "socketPath.*docker\\.sock"
    - from: "backend/src/log-monitor/error-investigator.ts"
      to: "Anthropic Claude API"
      via: "@anthropic-ai/sdk"
      pattern: "new Anthropic"
    - from: "backend/src/log-monitor/log-monitor-service.ts"
      to: "backend/src/ironclaw/github-service.ts"
      via: "githubService.createPR()"
      pattern: "createPR"
---

<objective>
Build a standalone log monitor agent that watches Docker container logs (frontend, backend, ironclaw, bastion-mcp) for errors, uses Claude to investigate root causes by reading relevant source files, generates fixes, and submits PRs via the existing GitHubService.

Purpose: Automate the detect-investigate-fix cycle for runtime errors across all BASTION containers, reducing manual debugging time and catching issues the moment they appear in logs.

Output: A standalone Node.js service that can run as `node dist/log-monitor/index.js` alongside the existing backend, tailing Docker logs and autonomously creating fix PRs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@backend/src/ironclaw/self-update-service.ts (Docker API via unix socket pattern)
@backend/src/ironclaw/github-service.ts (PR creation, governance guardrails, protected paths)
@backend/src/ironclaw/routine-service.ts (autonomous monitoring pattern)
@docker-compose.yml (container names: bastion-frontend, bastion-backend, bastion-ironclaw, bastion-mcp)

<interfaces>
<!-- From backend/src/ironclaw/github-service.ts -->
```typescript
export interface CreatePRParams {
  title: string;
  description: string;
  branchName: string;
  files: Array<{ path: string; content: string }>;
  baseBranch?: string;
}

export interface CreatePRResult {
  prNumber: number;
  prUrl: string;
  summary: string;
}

// Singleton
export const githubService: GitHubService;
// githubService.createPR(params) — creates PR on ironclaw/ branch prefix
// githubService.isConfigured() — returns true if GITHUB_TOKEN is set
```

<!-- Docker container names from docker-compose.yml -->
Container names to monitor:
- bastion-frontend
- bastion-backend
- bastion-ironclaw
- bastion-mcp
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Types, log parser, and error investigator modules</name>
  <files>
    backend/src/log-monitor/types.ts
    backend/src/log-monitor/log-parser.ts
    backend/src/log-monitor/error-investigator.ts
  </files>
  <action>
Create three modules:

**types.ts** — Shared types:
- `MonitoredContainer`: enum/const of container names to watch: `bastion-frontend`, `bastion-backend`, `bastion-ironclaw`, `bastion-mcp`.
- `LogEntry`: `{ container: string; timestamp: Date; level: 'error' | 'warn' | 'info'; message: string; raw: string }`.
- `ErrorSignature`: `{ container: string; pattern: string; fingerprint: string; firstSeen: Date; count: number; sampleLines: string[] }`.
- `InvestigationResult`: `{ error: ErrorSignature; rootCause: string; suggestedFix: string; files: Array<{ path: string; content: string }>; confidence: 'high' | 'medium' | 'low' }`.
- `MonitorConfig`: `{ containers: string[]; errorCooldownMs: number; maxPRsPerHour: number; dryRun: boolean }` with defaults: cooldown 30 min, max 3 PRs/hour, dryRun false.

**log-parser.ts** — `LogParser` class:
- Method `parseLogLine(container: string, line: string): LogEntry | null` — parses Docker log output (format: `YYYY-MM-DDTHH:mm:ss.nnnZ <message>`). Detects error level via patterns:
  - Lines containing `Error:`, `TypeError:`, `ReferenceError:`, `SyntaxError:`, `FATAL`, `ECONNREFUSED`, `ENOENT`, `UnhandledPromiseRejection`, `ERR!`, `panic`, `SIGTERM`, `OOM`, `segfault`
  - Stack trace lines (lines starting with `    at `)
  - Lines with `[ERROR]`, `[error]`, `error:` prefix patterns
  - Exclude known noise: health check failures during startup, connection retries, expected `ECONNREFUSED` during container boot
- Method `computeFingerprint(entry: LogEntry): string` — create a stable hash from error message with variable parts (timestamps, IDs, ports) normalized out, so the same underlying error always produces the same fingerprint.
- Method `isNewError(fingerprint: string): boolean` — check against a `Map<string, Date>` of recently seen fingerprints. Return true only if fingerprint hasn't been seen within `errorCooldownMs`. Auto-prune entries older than 1 hour.
- Method `collectStackTrace(container: string, lines: string[], startIndex: number): string[]` — given the index of an error line, collect subsequent stack trace lines (lines starting with `    at ` or continuation patterns).

**error-investigator.ts** — `ErrorInvestigator` class:
- Constructor takes `anthropicApiKey: string` (from `ANTHROPIC_API_KEY` env var).
- Uses `@anthropic-ai/sdk` (already in backend package.json).
- Method `investigate(error: ErrorSignature): Promise<InvestigationResult>`:
  1. Build a prompt with: the error message, stack trace lines, container name, and the project structure context (the container maps to a known source directory: `bastion-frontend` -> `frontend/src/`, `bastion-backend` -> `backend/src/`, `bastion-ironclaw` -> `ironclaw/`, `bastion-mcp` -> `backend/src/mcp/`).
  2. Extract file paths from the stack trace (parse `at Function (path:line:col)` patterns).
  3. Read those source files from disk using `fs.readFile` (the monitor runs on the host with source access).
  4. Send to Claude (model: `claude-sonnet-4-20250514`) with a system prompt: "You are a senior developer debugging a production error in the BASTION platform. Analyze the error, the relevant source code, and produce a fix. Return JSON with fields: rootCause (string), confidence (high/medium/low), files (array of {path, content} with the COMPLETE corrected file contents). Only include files you are actually changing. If you cannot determine a fix with reasonable confidence, set confidence to 'low' and files to empty array."
  5. Parse the JSON response. If confidence is 'low' or files is empty, log the finding but do not create a PR.
  6. Return `InvestigationResult`.
- Use `max_tokens: 8192` for the response. Set temperature to 0 for deterministic output.
- Wrap in try/catch — log errors but never crash the monitor.
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr && bash -lc 'cd backend && npx tsc --noEmit src/log-monitor/types.ts src/log-monitor/log-parser.ts src/log-monitor/error-investigator.ts 2>&1 | head -30'</automated>
  </verify>
  <done>Three modules compile without errors. LogParser can parse Docker log lines and fingerprint errors. ErrorInvestigator can call Claude API with error context and source files to produce investigation results.</done>
</task>

<task type="auto">
  <name>Task 2: Log monitor service, entry point, and launcher script</name>
  <files>
    backend/src/log-monitor/log-monitor-service.ts
    backend/src/log-monitor/index.ts
    scripts/log-monitor.sh
  </files>
  <action>
**log-monitor-service.ts** — `LogMonitorService` class (singleton pattern like other services):

- Constructor takes `MonitorConfig` (with defaults).
- Uses the Docker Engine API via `/var/run/docker.sock` unix socket (same pattern as `self-update-service.ts` `dockerApi` method). Do NOT use `child_process` to shell out to `docker logs`.
- Private method `tailContainer(containerName: string): void`:
  1. Make HTTP GET to `/containers/{containerName}/logs?follow=true&stdout=true&stderr=true&since={startTimestamp}&tail=100` via the unix socket.
  2. The response is a stream — Docker multiplexes stdout/stderr with an 8-byte header per frame (see Docker API docs: first byte is stream type, bytes 4-7 are uint32 big-endian frame size).
  3. Parse the multiplexed stream: strip the 8-byte header from each frame, decode the payload as UTF-8 text, split by newlines.
  4. For each line, call `logParser.parseLogLine(containerName, line)`.
  5. If it's an error entry, compute fingerprint. If `isNewError(fingerprint)` returns true:
     a. Collect stack trace context (grab surrounding lines).
     b. Build an `ErrorSignature` with sample lines.
     c. Queue for investigation.
  6. On stream error or close, log a warning and reconnect after 5 seconds.

- Private method `processErrorQueue(): void`:
  1. Runs on a 10-second interval.
  2. Dequeues errors one at a time.
  3. Check PR rate limit (max `config.maxPRsPerHour` PRs in the last hour, tracked in a `Date[]` sliding window).
  4. Call `errorInvestigator.investigate(error)`.
  5. If result has `confidence !== 'low'` and `files.length > 0`:
     a. If `config.dryRun`, log the proposed fix but do not create PR.
     b. Otherwise, import `githubService` from `../ironclaw/github-service.js` and call `createPR()` with:
        - `title`: `fix(log-monitor): ${error.container} — ${truncated error message}`
        - `branchName`: `log-monitor/${error.fingerprint.slice(0, 8)}-${Date.now()}`
        - `description`: Markdown with error details, root cause analysis, confidence level, container, timestamp, and sample log lines.
        - `files`: The corrected files from the investigation.
     c. Log the PR URL.
  6. If investigation throws or returns low confidence, log and skip.

- Method `start(): Promise<void>`:
  1. Validate Docker socket accessible (`fs.access('/var/run/docker.sock')`). If not, log error and exit — the service requires Docker socket mount.
  2. Validate `ANTHROPIC_API_KEY` is set. If not, log error and exit.
  3. Check `githubService.isConfigured()`. If not, log warning: "GITHUB_TOKEN not set — running in dry-run mode (no PRs will be created)" and force `config.dryRun = true`.
  4. Start `tailContainer()` for each container in `config.containers`.
  5. Start `processErrorQueue()` interval.
  6. Log startup message with monitored containers list.

- Method `stop(): Promise<void>`:
  1. Abort all active HTTP streams (use `AbortController` per tail connection).
  2. Clear the queue processing interval.
  3. Log shutdown.

**index.ts** — Standalone entry point:
```typescript
import { LogMonitorService } from './log-monitor-service.js';
const service = new LogMonitorService();
process.on('SIGINT', () => { void service.stop().then(() => process.exit(0)); });
process.on('SIGTERM', () => { void service.stop().then(() => process.exit(0)); });
void service.start();
```

**scripts/log-monitor.sh** — Convenience launcher:
```bash
#!/usr/bin/env bash
set -euo pipefail
# Start the log monitor agent
# Requires: Docker socket access, ANTHROPIC_API_KEY, optionally GITHUB_TOKEN
cd "$(dirname "$0")/.."
exec node dist/log-monitor/index.js "$@"
```
Make it executable (`chmod +x`).

Important implementation notes:
- The Docker log stream uses the multiplexed format when attached to both stdout and stderr. Each frame has an 8-byte header: byte 0 = stream type (0=stdin, 1=stdout, 2=stderr), bytes 1-3 = 0, bytes 4-7 = uint32 big-endian size of the frame payload. Read the header, extract size, read that many bytes as the frame content.
- Use `http.request` with `socketPath: '/var/run/docker.sock'` just like `self-update-service.ts` does, but instead of collecting the full response, process it as a stream.
- The `since` parameter should be set to the current Unix timestamp at service start so it only processes new logs.
- Each tail connection should have its own `AbortController` signal for clean shutdown.
- Error queue is a simple `ErrorSignature[]` array — push to back, shift from front.
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr && bash -lc 'cd backend && npx tsc --noEmit src/log-monitor/index.ts 2>&1 | head -30'</automated>
  </verify>
  <done>
    - `node dist/log-monitor/index.js` starts the log monitor service and begins tailing all 4 containers.
    - Errors detected in logs are fingerprinted, deduplicated, investigated via Claude, and result in PRs (or dry-run logs if GITHUB_TOKEN is not set).
    - `scripts/log-monitor.sh` is executable and launches the service.
    - Service handles SIGINT/SIGTERM for clean shutdown.
    - Docker multiplexed log stream is correctly parsed (8-byte header stripped).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Log monitor -> Docker socket | Reads container logs via privileged unix socket |
| Log monitor -> Anthropic API | Sends error context + source code snippets to external LLM |
| Log monitor -> GitHub API | Creates branches and PRs via GITHUB_TOKEN |
| Source file reads | Monitor reads local source files to provide context to Claude |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-lm-01 | Information Disclosure | error-investigator.ts | mitigate | Only send file contents from the project directory; never send .env files, secrets, or credentials. Validate file paths are within project root before reading. |
| T-lm-02 | Elevation of Privilege | log-monitor-service.ts | accept | Docker socket access is inherently privileged; service runs with same permissions as the docker group. This is the standard Docker monitoring pattern. |
| T-lm-03 | Denial of Service | log-monitor-service.ts | mitigate | Rate limit PRs to maxPRsPerHour (default 3). Deduplicate errors via fingerprint cooldown (30 min). Prevent investigation queue from growing unbounded (cap at 20 items). |
| T-lm-04 | Tampering | github-service.ts | accept | PRs go through existing governance guardrails (PROTECTED_FILE_PATHS in github-service.ts blocks agent modifications to auth, gates, CI/CD, docker, package.json). PRs require human review before merge. |
| T-lm-05 | Spoofing | error-investigator.ts | mitigate | Claude response is parsed as JSON with strict schema validation. Malformed responses are logged and discarded, not applied. |
</threat_model>

<verification>
1. TypeScript compiles: `cd backend && npx tsc --noEmit` passes with no errors in log-monitor/ files
2. Service starts: `node dist/log-monitor/index.js` logs container tailing messages (requires Docker socket)
3. Dry-run mode: Without GITHUB_TOKEN, service logs "running in dry-run mode" and does not attempt PR creation
4. Error detection: Inject a test error line and verify fingerprinting and deduplication work
5. scripts/log-monitor.sh is executable
</verification>

<success_criteria>
- Log monitor service compiles and runs as standalone process
- Tails all 4 container logs (frontend, backend, ironclaw, mcp) via Docker socket API
- Detects errors using comprehensive pattern matching with noise filtering
- Deduplicates repeated errors using stable fingerprinting with cooldown
- Investigates errors using Claude with relevant source file context
- Creates fix PRs via existing GitHubService (respects governance guardrails)
- Rate-limited to prevent PR spam (default 3/hour)
- Graceful degradation: dry-run mode when GITHUB_TOKEN missing, logs-only when ANTHROPIC_API_KEY missing
- Clean shutdown on SIGINT/SIGTERM
</success_criteria>

<output>
After completion, create `.planning/quick/260406-lkq-build-log-monitor-agent-for-frontend-bac/260406-lkq-SUMMARY.md`
</output>
