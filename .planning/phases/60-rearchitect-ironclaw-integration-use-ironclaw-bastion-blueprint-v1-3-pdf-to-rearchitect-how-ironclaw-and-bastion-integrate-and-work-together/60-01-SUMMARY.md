---
phase: 60-rearchitect-ironclaw-integration
plan: "01"
subsystem: ironclaw-infrastructure
tags: [rls, postgresql, security, mcp, docker, ironclaw]
dependency_graph:
  requires: []
  provides: [IC-00-RLS, IC-00-DOCKER, IC-00-MCP-REG]
  affects: [backend/src/ironclaw/ironclaw-client.ts, docker-compose.yml]
tech_stack:
  added: [pg Pool transactional SET LOCAL, PostgreSQL RLS policies]
  patterns: [withDIDScope transaction wrapper, parameterised SET LOCAL, DID-to-slug utility]
key_files:
  created:
    - backend/src/db/migrations/047-ironclaw-workspace-rls.sql
    - backend/src/db/migrations/048-ironclaw-users-lookup.sql
  modified:
    - backend/src/ironclaw/ironclaw-client.ts
    - docker-compose.yml
decisions:
  - "SET LOCAL always wrapped in explicit BEGIN/COMMIT via withDIDScope to prevent cross-user contamination in connection pool"
  - "MCP port changed from 3334 to 4000 to match blueprint http://bastion:4000/mcp convention"
  - "pg Pool lazily initialised only when DATABASE_URL_IRONCLAW env var is present"
metrics:
  duration: "2 min"
  completed_date: "2026-03-28"
  tasks: 2
  files: 4
---

# Phase 60 Plan 01: Ironclaw Infrastructure Foundation Summary

PostgreSQL RLS per-user DID isolation, ironclaw_users lookup table, transactional SET LOCAL in IronclawClient, and MCP port reconciliation (3334→4000) with startup registration method.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create RLS migration and ironclaw_users lookup table | 3c5117c2 | 047-ironclaw-workspace-rls.sql, 048-ironclaw-users-lookup.sql |
| 2 | Update IronclawClient with transactional SET LOCAL and reconcile MCP port | 80c4b3e5 | ironclaw-client.ts, docker-compose.yml |

## What Was Built

### Migration 047: Ironclaw Workspace RLS (ironclaw-postgres)
- `ALTER TABLE workspace ADD COLUMN IF NOT EXISTS owner_did TEXT`
- `ALTER TABLE workspace ENABLE ROW LEVEL SECURITY`
- Three RLS policies scoped by `current_setting('app.current_did_slug', true)`:
  - `workspace_read_own` (FOR SELECT)
  - `workspace_write_own` (FOR INSERT WITH CHECK)
  - `workspace_update_own` (FOR UPDATE USING + WITH CHECK)
- `CREATE INDEX idx_workspace_owner_did ON workspace(owner_did)` for policy performance
- All policies allow `owner_did = 'shared'` and null-slug passthrough for backward compatibility

### Migration 048: ironclaw_users Lookup Table (ironclaw-postgres)
- `CREATE TABLE IF NOT EXISTS ironclaw_users (did_slug TEXT PRIMARY KEY, did TEXT UNIQUE NOT NULL, near_account TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`
- Maps NEAR accounts to DID slugs for RLS enforcement

### IronclawClient Changes
- `withDIDScope<T>(didSlug, fn)` — acquires dedicated pool connection, `BEGIN`, `SET LOCAL app.current_did_slug = $1` (parameterised), runs `fn(client)`, `COMMIT`; `ROLLBACK` on error, `release()` in `finally`
- `setCurrentDID(didSlug, client)` — `SET LOCAL` on caller-managed transaction client; caller owns BEGIN/COMMIT
- `registerMcpServer(mcpUrl?)` — sends `/mcp add bastion-core <url>` via webhook; defaults to `MCP_BASTION_URL` env or `http://bastion-mcp:4000/mcp`
- `sendMessage(threadId, content, didSlug?)` — wraps dispatch in `withDIDScope` when `didSlug` provided
- `export function didToSlug(did)` — `did:near:alice.near` → `alice-near`
- Pool lazily initialised from `DATABASE_URL_IRONCLAW` or `IRONCLAW_DB_URL` env var

### docker-compose.yml Changes
- `bastion-mcp` port: `3334:3334` → `4000:4000`, `MCP_PORT=4000`
- Added `MCP_BASTION_URL: http://bastion-mcp:4000/mcp` to `ironclaw` service environment

## Decisions Made

1. **Transactional SET LOCAL is mandatory** — A plain `SET` (without `LOCAL`) in a pooled connection persists for the connection's lifetime, causing cross-user contamination. `withDIDScope` enforces `BEGIN`/`SET LOCAL`/`COMMIT` atomically.

2. **Port 3334 → 4000** — Blueprint specifies `http://bastion:4000/mcp`; reconciled docker-compose to match. `bastion-mcp` is already on `ironclaw-network` so the internal URL is `http://bastion-mcp:4000/mcp`.

3. **Lazy pool initialisation** — Pool only created when `DATABASE_URL_IRONCLAW` is set; avoids startup errors in environments where Ironclaw PostgreSQL is not configured.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All created files exist on disk. Both task commits (3c5117c2, 80c4b3e5) present in git log.
