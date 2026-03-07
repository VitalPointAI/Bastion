---
phase: 32-network-device-discovery-and-secure-automatic-resource-onboarding
plan: 02
subsystem: api
tags: [plugins, hot-loading, command-adapter, ironclaw, device-communication]

# Dependency graph
requires:
  - phase: 27-resource-registry
    provides: ResourcePlugin interface and plugin-loader convention
  - phase: 30-ironclaw-agent-integration
    provides: PROTECTED_CONFIG_KEYS and ACTION_RISK system
provides:
  - CommandAdapter interface for bidirectional device-native protocol translation
  - Hot-loading plugin support via generated/ directory with fs.watch
  - Discovery interface restriction keys in Ironclaw protected config
affects: [32-network-device-discovery, ironclaw-agent, resource-plugins]

# Tech tracking
tech-stack:
  added: []
  patterns: [command-adapter-facet, hot-load-plugins, debounced-file-watch]

key-files:
  created: []
  modified:
    - backend/src/resources/plugins/base-plugin.ts
    - backend/src/resources/plugins/plugin-loader.ts
    - backend/src/ironclaw/ironclaw-types.ts

key-decisions:
  - "CommandAdapter uses Buffer | string union for wire format flexibility across protocols"
  - "Hot-loader only watches for .js files (generated plugins are pre-compiled by Ironclaw)"
  - "Debounce at 300ms to handle USB-style rapid enumeration events"

patterns-established:
  - "CommandAdapter facet: optional interface on ResourcePlugin for bidirectional device comms"
  - "Generated plugin directory: generated/ subdirectory scanned alongside static plugins"
  - "Hot-load watcher: fs.watch with debounce + cache-bust import for runtime plugin loading"

requirements-completed: [DISC-03, DISC-04]

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 32 Plan 02: Plugin Extension & Hot-Loading Summary

**CommandAdapter facet on ResourcePlugin for device command translation, hot-load watcher for Ironclaw-generated plugins, and discovery interface protection in PROTECTED_CONFIG_KEYS**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T15:38:43Z
- **Completed:** 2026-03-07T15:41:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extended ResourcePlugin with BastionCommand, CommandResponse, and CommandAdapter types for bidirectional device communication
- Added generated/ directory scanning and watchForNewPlugins() for runtime hot-loading without server restart
- Protected 4 discovery config keys from Ironclaw self-governance and classified 4 discovery actions by risk level

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CommandAdapter facet and hot-load plugin support** - `cb01386` (feat)
2. **Task 2: Add discovery interface protection to Ironclaw config** - `360587e` (feat)

## Files Created/Modified
- `backend/src/resources/plugins/base-plugin.ts` - Added BastionCommand, CommandResponse, CommandAdapter types; optional commandAdapter on ResourcePlugin
- `backend/src/resources/plugins/plugin-loader.ts` - Added loadFromDirectory helper, generated/ dir scanning, watchForNewPlugins with debounced fs.watch
- `backend/src/ironclaw/ironclaw-types.ts` - Added 4 discovery keys to PROTECTED_CONFIG_KEYS, 4 discovery actions to ACTION_RISK

## Decisions Made
- CommandAdapter uses `Buffer | string` union for wire format flexibility across device protocols (binary MQTT vs text HTTP)
- Hot-loader only watches for `.js` files since Ironclaw-generated plugins would be pre-compiled
- 300ms debounce on file watcher to handle rapid USB-style device enumeration events
- Used `Array.from()` instead of spread for Set iteration to avoid TypeScript downlevelIteration requirement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Set spread iteration TypeScript compatibility**
- **Found during:** Task 1 (plugin-loader verification)
- **Issue:** `[...pendingFiles]` Set spread required `--downlevelIteration` flag not set in project tsconfig when checking files individually
- **Fix:** Changed to `Array.from(pendingFiles)` which works without the flag
- **Files modified:** backend/src/resources/plugins/plugin-loader.ts
- **Verification:** `tsc --noEmit --skipLibCheck` passes with no source errors
- **Committed in:** cb01386 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor compatibility fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CommandAdapter interface ready for concrete implementations in device-specific plugins
- generated/ directory created and watched for Ironclaw output
- Discovery actions properly risk-classified for gate enforcement

---
*Phase: 32-network-device-discovery-and-secure-automatic-resource-onboarding*
*Completed: 2026-03-07*
