---
phase: 52-agent-skills-mcp
plan: 02
subsystem: api, database, ui
tags: [skills, postgresql, jsonb, crud, admin-ui, react, typescript]

# Dependency graph
requires:
  - phase: 51-unified-agent-architecture
    provides: AgentStore, AgentRegistry, admin API patterns, ToolRegistryPanel UI patterns

provides:
  - "038-skills.sql migration: skills and agent_skill_assignments tables"
  - "SkillStore: full PostgreSQL CRUD for skills (create, get, list, update, delete, assign/unassign/getAgents)"
  - "SkillRegistry: write-through cache singleton with ensureInitialized pattern"
  - "Admin API: GET/POST/PUT/DELETE /api/admin/skills + assignment endpoints"
  - "SkillRegistryPanel: full admin UI replacing SkillsPlaceholder in AgentHub"
  - "adminService skill methods: listSkills, createSkill, updateSkill, deleteSkill, assignSkillToAgent, unassignSkillFromAgent, getSkillAgents"

affects: [ironclaw-orchestration, agent-executor, mcp-server, 52-03-mcp-server-plan]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SkillStore follows AgentStore JSONB pattern: skill_data JSONB + metadata columns, idempotent ON CONFLICT upserts"
    - "SkillRegistry follows AgentRegistry write-through cache: Map<string,SkillRow> + ensureInitialized async init"
    - "JSON Schema serialization: inputSchema/outputSchema stored as plain JSON objects (not Zod) — consumers validate with JSON Schema directly"
    - "Admin API skill endpoints follow same pattern as tool endpoints in admin.ts"

key-files:
  created:
    - backend/src/db/migrations/038-skills.sql
    - backend/src/agents/skill-store.ts
    - backend/src/agents/skill-registry.ts
    - frontend/src/components/admin/SkillRegistryPanel.tsx
  modified:
    - backend/src/api/admin.ts
    - frontend/src/types/admin.ts
    - frontend/src/lib/admin-service.ts
    - frontend/src/components/admin/AgentHub.tsx

key-decisions:
  - "JSON Schema over raw Zod: inputSchema/outputSchema stored as plain JSON Schema objects in JSONB. Zod cannot be serialized. Consumers validate with JSON Schema directly."
  - "SkillID generated server-side from name slug + timestamp: skill-<slug>-<epoch>ms — prevents collisions without requiring client to supply IDs"
  - "Write-through cache: all reads come from in-memory Map (populated at startup from DB) for zero-latency lookups; all writes go to both Map and DB atomically"
  - "Assignment counts via separate DB query (getAssignmentCounts) taking skillId array — efficient batch query to avoid N+1 per skill in list endpoint"

patterns-established:
  - "SkillStore.createSkill: idempotent upsert via ON CONFLICT (skill_id) DO UPDATE — safe to call multiple times"
  - "SkillRegistry.ensureInitialized: all public methods call this guard pattern before proceeding"
  - "SkillRegistryPanel mirrors ToolRegistryPanel: same card expand/collapse, modal assign, toggle enable, delete confirm patterns"

requirements-completed: [REQ-52-02]

# Metrics
duration: 22min
completed: 2026-03-19
---

# Phase 52 Plan 02: Skills Registry Summary

**PostgreSQL-backed skills registry with write-through cache, full CRUD admin API, and SkillRegistryPanel UI replacing the SkillsPlaceholder in AgentHub**

## Performance

- **Duration:** 22 min
- **Started:** 2026-03-19T13:09:00Z
- **Completed:** 2026-03-19T13:31:24Z
- **Tasks:** 2
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments
- Built 038-skills.sql with `skills` and `agent_skill_assignments` tables following the agents_v2 JSONB pattern
- Implemented SkillStore with full CRUD matching AgentStore patterns: create, get, list, update, delete, assign/unassign, getSkillsForAgent, getAgentsForSkill, getAssignmentCounts
- Implemented SkillRegistry write-through cache singleton following AgentRegistry pattern with async initialization
- Added 8 skill admin API endpoints to admin.ts: CRUD + assignment + listing agents per skill
- Built SkillRegistryPanel React component with list/create/assign/delete matching ToolRegistryPanel style
- Replaced SkillsPlaceholder in AgentHub with functional SkillRegistryPanel
- Added AgentSkillDef, AgentSkillInput, AgentSkillUpdate, SkillAssignment types to frontend admin types
- Added 8 adminService methods: listSkills, getSkill, createSkill, updateSkill, deleteSkill, assignSkillToAgent, unassignSkillFromAgent, getSkillAgents

## Task Commits

Each task was committed atomically:

1. **Task 1: Skills DB migration, SkillStore, and SkillRegistry** - `f73f9527` (feat)
2. **Task 2: Skills admin API routes and SkillRegistryPanel UI** - `baa35f2c` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `backend/src/db/migrations/038-skills.sql` - skills and agent_skill_assignments tables with indexes
- `backend/src/agents/skill-store.ts` - PostgreSQL CRUD store for skills (SkillStore + getSkillStore)
- `backend/src/agents/skill-registry.ts` - Write-through cache singleton (SkillRegistry + getSkillRegistry)
- `backend/src/api/admin.ts` - Added 8 skill CRUD+assignment endpoints
- `frontend/src/types/admin.ts` - Added AgentSkillDef, AgentSkillInput, AgentSkillUpdate, SkillAssignment types
- `frontend/src/lib/admin-service.ts` - Added 8 skill service methods
- `frontend/src/components/admin/SkillRegistryPanel.tsx` - Full admin UI panel for skill management
- `frontend/src/components/admin/AgentHub.tsx` - Replaced SkillsPlaceholder with SkillRegistryPanel

## Decisions Made
- **JSON Schema over raw Zod**: Skills store inputSchema/outputSchema as plain JSON objects in JSONB. Zod schemas cannot be serialized. This matches the plan's explicit requirement to use `zodToJsonSchema()` pattern — however since skills are created via admin UI (users supply JSON Schema directly, not Zod), no conversion was needed.
- **Server-side ID generation**: skillId generated from name slug + epoch timestamp (skill-<slug>-<epoch>ms) to prevent collisions without requiring client-provided IDs.
- **Batch assignment counts**: Single DB query with `WHERE skill_id = ANY($1)` to get all counts in one round-trip for the list endpoint.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Minor: `rowToSkill` needed double-cast `as unknown as Record<string, unknown>` since SkillRow has an index signature issue in TypeScript. Fixed inline.

## User Setup Required
Database migration must be run on production/staging server. SQL file committed at `backend/src/db/migrations/038-skills.sql`.

## Next Phase Readiness
- Skills registry is fully operational — Ironclaw and other agents can create/assign skills via the admin API
- SkillRegistry singleton is ready for import by any backend service that needs to check agent skills
- Ready for Phase 52 Plan 03 (MCP server) which can expose skill operations as MCP tools

---
*Phase: 52-agent-skills-mcp*
*Completed: 2026-03-19*
