---
phase: 65-ironclaw-autonomous-operations
plan: 02
subsystem: ironclaw-mcp
tags: [mcp-tools, autonomous-intelligence, brain-curation, ironclaw]
dependency_graph:
  requires: []
  provides:
    - bastion.intel.web_search MCP tool
    - bastion.intel.create_research_event MCP tool
    - bastion.intel.process_osint_event MCP tool
    - bastion.intel.detect_conflicts MCP tool
    - bastion.intel.draft_situation_assessment MCP tool
    - bastion.autonomous.log_activity MCP tool
    - bastion.autonomous.send_alert MCP tool
    - bastion.brain.evaluate_relevance MCP tool
    - bastion.brain.augment_slice MCP tool
    - bastion.brain.prune_slice MCP tool
    - bastion.brain.get_slice_stats MCP tool
  affects:
    - backend/src/mcp/mcp-server.ts (ALL_TOOLS expanded by 11)
    - backend/src/ironclaw/tool-bridge.ts (BASTION_TOOLS expanded by 11)
    - backend/src/ironclaw/builder-handlers.ts (11 new handlers)
tech_stack:
  added: []
  patterns:
    - MCPToolDefinition[] export pattern (matches knowledge.ts/operations.ts)
    - ActionHandler pattern with dynamic imports for lazy loading
    - Neo4j containerIds array mutation for brain slice curation
    - WebSocket publish via getMessageBus() for activity/alert push
key_files:
  created:
    - backend/src/mcp/tools/intelligence.ts
  modified:
    - backend/src/ironclaw/tool-bridge.ts
    - backend/src/mcp/mcp-server.ts
    - backend/src/ironclaw/builder-handlers.ts
decisions:
  - "Tool definitions are duplicated between BASTION_TOOLS (tool-bridge.ts) and intelligenceTools (intelligence.ts) — this matches the existing architecture where BASTION_TOOLS drives action pipeline risk registration and the domain tool groups drive MCP discovery"
  - "Telegram alert uses secondary message bus channel (ironclaw.telegram.{psId}) rather than direct bot API call — avoids needing to enumerate all paired chats from builder-handlers"
  - "Brain curation uses Neo4j containerIds array mutation (UNWIND + SET) — same pattern used elsewhere in the codebase for slice membership"
metrics:
  duration: 18
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_modified: 4
---

# Phase 65 Plan 02: Autonomous Intelligence MCP Tools Summary

11 new MCP tool definitions and handlers giving Ironclaw autonomous intelligence research, conflict detection, situation assessment drafting, activity logging, alerting, and brain slice curation via containerIds mutations.

## What Was Built

### Task 1: Create intelligence MCP tool handlers

Created `backend/src/mcp/tools/intelligence.ts` following the MCPToolDefinition[] export pattern from `knowledge.ts`. Defines 11 tools in the `intelligenceTools` array:

**Web Intelligence:**
- `bastion.intel.web_search` (medium) — wraps `performWebSearch()` from `doc-intelligence/web-search.ts`
- `bastion.intel.create_research_event` (medium) — creates synthetic OSINTEvent via `osintEventStore.createEvent()`
- `bastion.intel.process_osint_event` (medium) — triggers `processOSINTEventThroughAgents()` with synthetic feed config

**Analysis:**
- `bastion.intel.detect_conflicts` (low) — Cypher query for opposing-sentiment RELATES_TO relationships in slice
- `bastion.intel.draft_situation_assessment` (low) — aggregates recent OSINT events, active PIRs, intelligence gaps into structured JSON

**Autonomous Activity:**
- `bastion.autonomous.log_activity` (low) — persists to `autonomousActivityStore`, pushes to `ironclaw.{psId}` WebSocket channel
- `bastion.autonomous.send_alert` (medium) — pushes to WebSocket; publishes to Telegram channel for critical/urgent

**Brain Curation:**
- `bastion.brain.evaluate_relevance` (low) — Cypher query for global actors not in slice but connected to slice actors
- `bastion.brain.augment_slice` (medium) — UNWIND + SET to add psId to containerIds array
- `bastion.brain.prune_slice` (medium) — UNWIND + SET to remove psId from containerIds array
- `bastion.brain.get_slice_stats` (low) — 5 Cypher queries: slice count, global count, rel count, oldest updatedAt, orphan count

### Task 2: Register tools in tool-bridge and MCP server

- Added all 11 tool definitions to `BASTION_TOOLS` array in `tool-bridge.ts` (makes them available for action pipeline risk registration)
- Imported `intelligenceTools` in `mcp-server.ts` and spread into `ALL_TOOLS` (makes them discoverable via MCP SSE)
- Added 11 handler functions to `builder-handlers.ts` with full domain logic and `BUILDER_HANDLERS` dispatch table entries

## Verification

- `tsc --noEmit` passes with zero errors across all modified files
- All 11 tool names present in `BASTION_TOOLS`, `intelligenceTools`, and `BUILDER_HANDLERS`
- Risk levels correct: web_search=medium, create_research_event=medium, process_osint_event=medium, detect_conflicts=low, draft_situation_assessment=low, log_activity=low, send_alert=medium, evaluate_relevance=low, augment_slice=medium, prune_slice=medium, get_slice_stats=low

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed GapReport.getGapReport → getIntelligenceGaps**
- **Found during:** Task 1 implementation
- **Issue:** Plan referenced `brainStore.getGapReport()` but the actual method is `brainStore.getIntelligenceGaps()`. Also, GapReport items have `missingConnectionTypes`/`actualConnections` fields, not `gapType`/`severity`
- **Fix:** Used correct method and field names from brain-types.ts
- **Files modified:** builder-handlers.ts

**2. [Rule 1 - Bug] Fixed OSINTFeedConfig.sourceType incompatibility**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified `sourceType: 'other'` but `FeedSourceType` does not include `'other'` (valid values: `argus_webhook | rss | api | simulated`). Followed same `as any` pattern used in gap-filler-service.ts for synthetic feeds
- **Fix:** Changed to `sourceType: 'simulated'` with `any` cast (same pattern as gap-filler-service.ts)
- **Files modified:** builder-handlers.ts

**3. [Rule 1 - Bug] telegramBotService.broadcastAlert() does not exist**
- **Found during:** Task 1 implementation
- **Issue:** Plan referenced `telegramBotService.broadcastAlert()` but TelegramBotService only exposes `sendNotification(chatId, text)` and doesn't have a method to enumerate all paired commanders for a problem set
- **Fix:** Publish to `ironclaw.telegram.{psId}` message bus channel instead — Telegram delivery can be wired to that channel by the router layer
- **Files modified:** builder-handlers.ts

## Self-Check: PASSED

- [x] backend/src/mcp/tools/intelligence.ts — exists
- [x] backend/src/ironclaw/builder-handlers.ts — exists and modified
- [x] backend/src/ironclaw/tool-bridge.ts — exists and modified
- [x] backend/src/mcp/mcp-server.ts — exists and modified
- [x] commit c598fa7a — feat(65-02): create intelligence MCP tool handlers
- [x] commit 2aaac3ff — feat(65-02): register 11 autonomous intelligence tools in MCP server and tool-bridge
- [x] tsc --noEmit passes with zero errors
