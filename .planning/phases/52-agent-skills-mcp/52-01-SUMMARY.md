---
phase: 52-agent-skills-mcp
plan: "01"
subsystem: mcp-server
tags: [mcp, agent-tools, docker, sse, did-auth]
dependency_graph:
  requires: []
  provides: [bastion-mcp-container, mcp-sse-transport, bastion-tools-via-mcp]
  affects: [agent-langgraph-workflows, tool-registry, ironclaw-tool-bridge]
tech_stack:
  added: ["@modelcontextprotocol/sdk@1.27.1"]
  patterns: [mcp-low-level-server, sse-transport, did-allowlist-auth, express-router]
key_files:
  created:
    - backend/src/mcp/mcp-server.ts
    - backend/src/mcp/mcp-router.ts
    - backend/src/mcp/index.ts
  modified:
    - docker-compose.yml
    - docker-compose.prod.yml
    - backend/package.json
    - backend/pnpm-lock.yaml
key_decisions:
  - "Used low-level Server API (not McpServer) because BASTION_TOOLS uses raw JSON Schema — avoids Zod conversion layer"
  - "DID allowlist: null in dev mode (open), explicit Set<string> from MCP_ALLOWED_DIDS in prod"
  - "High-risk tools always require explicit allowlist entry regardless of dev mode"
  - "Phase 52 MVP: tool execution is a stub returning acknowledgment — real domain service wiring in subsequent plans"
  - "prod docker-compose.prod.yml reuses GHCR backend image with override command (no separate image needed)"
metrics:
  duration_minutes: 8
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_changed: 7
---

# Phase 52 Plan 01: MCP Server Container Summary

**One-liner:** Standalone bastion-mcp Docker container serving all 10 BASTION_TOOLS via MCP protocol over SSE transport with DID-based authorization.

## What Was Built

The BASTION MCP server is a standalone Express application that implements the Model Context Protocol server using `@modelcontextprotocol/sdk`. It exposes all 10 tools from `BASTION_TOOLS` (imported from `tool-bridge.ts`) to AI agents via HTTP/SSE transport.

### Core components:

**backend/src/mcp/mcp-server.ts** — Low-level MCP `Server` with two request handlers:
- `ListToolsRequestSchema` handler: returns all BASTION tools with their JSON schemas
- `CallToolRequestSchema` handler: validates x-agent-did header, checks DID allowlist, enforces high-risk tool restriction, dispatches to stub executor

**backend/src/mcp/mcp-router.ts** — Express `Router` with:
- `GET /mcp/sse` — SSE connection endpoint; extracts x-agent-did header, spawns dedicated MCP server instance connected via `SSEServerTransport`, session tracked in Map
- `POST /mcp/messages?sessionId=<id>` — JSON-RPC message endpoint; routes to correct session transport
- `GET /mcp/health` — Health check returning tool count and session count

**backend/src/mcp/index.ts** — Docker container entry point on port 3334; creates Express app, mounts mcpRouter, logs 10 tools on startup.

### Docker services:

Both `docker-compose.yml` (dev) and `docker-compose.prod.yml` (prod) have `bastion-mcp` service on port 3334, connected to `bastion-network`, depending on postgres.

## Decisions Made

1. **Low-level Server API over McpServer** — BASTION_TOOLS provides raw JSON Schema objects; McpServer.registerTool() requires Zod schemas. The low-level Server with explicit ListTools/CallTool handlers avoids a Zod conversion layer and keeps schemas as the source of truth in tool-bridge.ts.

2. **Per-connection MCP server instances** — Each SSE connection creates a fresh Server instance connected to its own SSEServerTransport. This aligns with the SSE transport model where each connection owns its protocol state.

3. **DID authorization as header** — Agents present their DID via `x-agent-did` request header. This flows through the SSE handshake and is stored on the session for all subsequent tool calls.

4. **Phase 52 MVP stub executor** — Tool calls return structured acknowledgments. The actual domain service execution (DB queries, problem set operations) will be wired in subsequent plans once the MCP protocol flow is validated end-to-end.

5. **Production uses shared backend image** — `docker-compose.prod.yml` reuses `ghcr.io/vitalpointai/bastion/backend:latest` with `command: node dist/mcp/index.js` override. No separate Docker image needed since the backend image includes all compiled code.

## Deviations from Plan

### Out-of-scope issues deferred

Pre-existing TypeScript errors in `src/ironclaw/builder-handlers.ts`, `src/ironclaw/ironclaw-service.ts`, `src/ironclaw/self-update-service.ts`, and `src/ironclaw/tool-bridge.ts` were present before this plan. Not caused by MCP work. Deferred to ironclaw phase maintenance.

### Docker verification adapted

The plan's verification step `docker compose config --services | grep bastion-mcp` could not run because Docker Desktop is not active in the WSL2 development environment. Verified by YAML grep instead — `bastion-mcp` appears in both compose files at the service definition level.

## Self-Check: PASSED

- FOUND: backend/src/mcp/mcp-server.ts
- FOUND: backend/src/mcp/mcp-router.ts
- FOUND: backend/src/mcp/index.ts
- FOUND: bastion-mcp in docker-compose.yml (2 matches)
- FOUND: bastion-mcp in docker-compose.prod.yml (2 matches)
- FOUND commit: f932275e (Task 1)
- FOUND commit: 2a23f912 (Task 2)
- TypeScript: 0 errors in src/mcp/ files
