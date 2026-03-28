---
phase: 60-rearchitect-ironclaw-integration
plan: 02
subsystem: api
tags: [mcp, did, vc-claims, tool-catalog, clearance, ironclaw, blueprint]

# Dependency graph
requires:
  - phase: 60-rearchitect-ironclaw-integration
    plan: 01
    provides: "MCP server infrastructure, IronclawClient MCP port config"

provides:
  - "DID VC claim middleware with 1-hour TTL cache and clearance level hierarchy"
  - "5 domain MCP tool groups: knowledge (4 tools), operations (5), calendar (2), resources (3), personnel (3)"
  - "Per-tool clearance gating for personnel tools via PERSONNEL_TOOL_CLEARANCES map"
  - "Merged ALL_TOOLS catalog in mcp-server.ts covering 17+ tools organized by domain"

affects:
  - 60-03
  - 60-04
  - ironclaw-service
  - mcp-server

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Domain-grouped MCP tools in backend/src/mcp/tools/*.ts, each exporting MCPToolDefinition[]"
    - "DID VC claim resolution with 1-hour TTL Map cache in middleware/did-auth.ts"
    - "Per-tool clearance gating: PERSONNEL_TOOL_CLEARANCES map drives requireClearance() calls in mcp-server.ts"
    - "ALL_TOOLS merged array: [...BASTION_TOOLS, ...domainTools] for unified catalog"

key-files:
  created:
    - backend/src/mcp/middleware/did-auth.ts
    - backend/src/mcp/tools/knowledge.ts
    - backend/src/mcp/tools/operations.ts
    - backend/src/mcp/tools/calendar.ts
    - backend/src/mcp/tools/resources.ts
    - backend/src/mcp/tools/personnel.ts
  modified:
    - backend/src/mcp/mcp-server.ts

key-decisions:
  - "Used PERSONNEL_TOOL_CLEARANCES exported map from personnel.ts to declare required clearance per tool name, so mcp-server.ts can look up clearance requirements without hard-coding tool names"
  - "resolveDIDClaims stubs from agent_vc_claims table (created in 60-03) with graceful fallback to empty claims if table does not exist — prevents circular bootstrap dependency"
  - "ALL_TOOLS merged catalog preserves existing BASTION_TOOLS at front so legacy tool routing via toolBridge.handleToolCall() remains unchanged"
  - "isToolAccessAuthorized made async to support DID claim resolution; clearance check only triggered for personnel tools"

patterns-established:
  - "Domain tool group pattern: one file per domain in backend/src/mcp/tools/, exports MCPToolDefinition[]"
  - "Clearance gate pattern: export TOOL_CLEARANCES map alongside tool array; mcp-server looks up by tool name"
  - "DID claim cache pattern: Map<string, {claims, fetchedAt}> with TTL eviction on read"

requirements-completed: [IC-01-MCP-TOOLS, IC-01-DID-AUTH]

# Metrics
duration: 4min
completed: 2026-03-28
---

# Phase 60 Plan 02: MCP Tool Catalog and DID Auth Middleware Summary

**17-tool MCP catalog across 5 domains (knowledge, operations, calendar, resources, personnel) with DID VC claim middleware and clearance-gating for sensitive personnel tools**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-28T13:57:26Z
- **Completed:** 2026-03-28T14:01:26Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- DID VC claim middleware with VCClaim types, ClearanceLevel/StaffSection enums, 1-hour TTL cache, and graceful pre-60-03 bootstrap fallback
- 5 domain tool group modules with 17 tools total organized by domain (knowledge, operations, calendar, resources, personnel)
- Personnel tools annotated with clearance requirements and gated via PERSONNEL_TOOL_CLEARANCES map
- MCP server updated to serve merged ALL_TOOLS catalog and perform async clearance checks before personnel tool execution

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DID auth middleware and 5 tool group modules** - `1a2697dc` (feat)
2. **Task 2: Wire tool groups into MCP server** - `b60ecc59` (feat)

## Files Created/Modified
- `backend/src/mcp/middleware/did-auth.ts` - VCClaim types, resolveDIDClaims with TTL cache, requireClearance, getStaffSection
- `backend/src/mcp/tools/knowledge.ts` - 4 tools: search, get_entity, get_relationships, search_documents
- `backend/src/mcp/tools/operations.ts` - 5 tools: get_problem_set, list_problem_sets, get_operational_design, get_campaign_plan, get_coa
- `backend/src/mcp/tools/calendar.ts` - 2 tools: get_schedule, get_events
- `backend/src/mcp/tools/resources.ts` - 3 tools: list, get_status, search_capabilities
- `backend/src/mcp/tools/personnel.ts` - 3 clearance-gated tools: list_staff (CUI+), get_member (CUI+), get_clearances (SECRET+); exports PERSONNEL_TOOL_CLEARANCES map
- `backend/src/mcp/mcp-server.ts` - Imports all tool groups, builds ALL_TOOLS catalog, async clearance gating for personnel tools

## Decisions Made
- Used `PERSONNEL_TOOL_CLEARANCES` exported map from personnel.ts to declare required clearance per tool name — keeps clearance requirements co-located with tool definitions, mcp-server.ts does not hard-code personnel tool names
- `resolveDIDClaims` stubs from `agent_vc_claims` table with graceful fallback to empty claims when table doesn't exist — prevents bootstrap dependency on 60-03
- Preserved existing `BASTION_TOOLS` at front of `ALL_TOOLS` array so legacy toolBridge routing remains unchanged
- Made `isToolAccessAuthorized` async to support DID claim resolution; clearance check only triggered for tools listed in PERSONNEL_TOOL_CLEARANCES

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect database import path in did-auth.ts**
- **Found during:** Task 2 (TypeScript compile check)
- **Issue:** did-auth.ts imported from `../../db/db.js` which does not exist; actual module is `../../lib/database.ts` exporting `getPool()`
- **Fix:** Changed import to `../../lib/database.js`, used `getPool()` return value for query, added typed row interface `AgentVCClaimRow` to satisfy TypeScript strict mode
- **Files modified:** `backend/src/mcp/middleware/did-auth.ts`
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** `b60ecc59` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug: wrong import path)
**Impact on plan:** Necessary TypeScript correctness fix. No scope creep.

## Issues Encountered
None beyond the auto-fixed import path.

## Next Phase Readiness
- MCP tool catalog is fully registered and accessible to Ironclaw
- DID VC claim middleware ready for integration with agent_vc_claims table (60-03)
- Personnel tools will activate once agent DID claims are populated in the registry
- 60-03 can now create the AgentConfig/agent_vc_claims tables that did-auth.ts queries

---
*Phase: 60-rearchitect-ironclaw-integration*
*Completed: 2026-03-28*
