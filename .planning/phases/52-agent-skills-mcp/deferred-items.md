# Deferred Items — Phase 52

## Pre-existing TypeScript Errors (Out of Scope)

These errors existed in the codebase BEFORE Plan 52-03 was executed.
They are caused by `SuggestionPayload` being added to `IronclawChatMessage`
in `ironclaw-types.ts` (by a prior linter/plan), but callers not yet updated.

### Affected Files

- `backend/src/ironclaw/ironclaw-service.ts` — missing `suggestion` field on
  chat message creation calls (lines 334, 385)
- `backend/src/ironclaw/ironclaw-service.ts` — variable used before declaration
  (`messageContent` at line 212)
- `backend/src/ironclaw/self-update-service.ts` — missing `suggestion` field
  on chat message creation (line 287)
- `backend/src/mcp/mcp-server.ts` — MCP SDK API mismatch (tool registration
  callback signature changed in newer SDK version, line 138)

### Action Required

These should be addressed in a dedicated plan for ironclaw-service and
self-update-service updates (add `suggestion: null` to all chat message
creation calls, fix `messageContent` scope issue, update mcp-server.ts
tool registration to new SDK API).
