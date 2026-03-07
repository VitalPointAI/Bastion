---
phase: 27-resource-registry-did-plugin-architecture-inserted
plan: 02
subsystem: api
tags: [xstate, zod, plugin-architecture, resource-management, state-machines]

# Dependency graph
requires:
  - phase: 27-resource-registry-did-plugin-architecture-inserted
    plan: 01
    provides: "ResourcePlugin interface, base-plugin.ts, types.ts with 6-category ResourceCategory"
provides:
  - "6 built-in resource plugins (vehicle, sensor, weapon, comms, medical, other)"
  - "Convention-based plugin auto-discovery loader"
  - "Singleton PluginRegistry mapping category to plugin instance"
affects: [27-03, 27-04, 27-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["xstate setup().createMachine() for typed state machines", "Convention-based plugin discovery via filesystem scan", "Singleton registry with lazy initialization (ensureInitialized)"]

key-files:
  created:
    - backend/src/resources/plugins/vehicle-plugin.ts
    - backend/src/resources/plugins/sensor-plugin.ts
    - backend/src/resources/plugins/weapon-plugin.ts
    - backend/src/resources/plugins/comms-plugin.ts
    - backend/src/resources/plugins/medical-plugin.ts
    - backend/src/resources/plugins/other-plugin.ts
    - backend/src/resources/plugins/plugin-loader.ts
    - backend/src/resources/plugins/plugin-registry.ts
  modified: []

key-decisions:
  - "Used xstate v5 setup().createMachine() pattern for fully typed event definitions in each state machine"
  - "Plugin loader skips infrastructure files by baseName matching against SKIP_FILES array"
  - "PluginRegistry uses two-phase init: constructor creates empty map, ensureInitialized() loads plugins once"

patterns-established:
  - "Plugin file naming: {category}-plugin.ts with default export satisfying ResourcePlugin"
  - "State machine states: FMC/PMC/NMC as universal readiness states, with category-specific operational states"
  - "Registry singleton: getPluginRegistry() mirrors getAgentRegistry() pattern"

requirements-completed: [RES-PLUGINS, RES-PLUGIN-DISCOVERY]

# Metrics
duration: 2min
completed: 2026-03-07
---

# Phase 27 Plan 02: Resource Type Plugins and Auto-Discovery Registry Summary

**6 domain-specific resource plugins with zod schemas, xstate state machines, and capability tags, plus convention-based auto-discovery loader and singleton registry**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T00:42:31Z
- **Completed:** 2026-03-07T00:44:56Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created 6 resource plugins each with domain-specific zod validation schemas, xstate state machines, capability arrays, and MIL-STD-2525D SIDC prefixes
- Built convention-based plugin loader that auto-discovers *-plugin.ts files from the plugins directory
- Implemented singleton PluginRegistry with lazy initialization following the established AgentRegistry pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 6 built-in resource plugins** - `4074f29` (feat)
2. **Task 2: Plugin loader and plugin registry** - `f2e676e` (feat)

## Files Created/Modified
- `backend/src/resources/plugins/vehicle-plugin.ts` - Autonomous vehicle plugin with ground/air/maritime/subsurface types, deploy/degrade state machine
- `backend/src/resources/plugins/sensor-plugin.ts` - Sensor platform plugin with radar/EO_IR/SIGINT types, collecting/calibrating states
- `backend/src/resources/plugins/weapon-plugin.ts` - Weapon system plugin with direct/indirect fire types, armed/safe/fired states
- `backend/src/resources/plugins/comms-plugin.ts` - Communications plugin with HF/VHF/UHF/SATCOM types, transmit/receive/jammed states
- `backend/src/resources/plugins/medical-plugin.ts` - Medical facility plugin with aid_station/surgical types, active/contaminated/quarantined states
- `backend/src/resources/plugins/other-plugin.ts` - General-purpose catch-all plugin with engineering/supply/power types
- `backend/src/resources/plugins/plugin-loader.ts` - Convention-based auto-discovery scanning for *-plugin.ts files
- `backend/src/resources/plugins/plugin-registry.ts` - Singleton registry with getPlugin, getAllPlugins, getCategories, validateSpecifications, getStateMachine, getCapabilities

## Decisions Made
- Used xstate v5 `setup().createMachine()` pattern for fully typed event definitions in each state machine -- provides type safety without 14-generic AnyStateMachine workaround
- Plugin loader skips infrastructure files by baseName matching against a SKIP_FILES array rather than hardcoded category list -- more maintainable as new plugins are added
- PluginRegistry uses two-phase init matching AgentRegistry: constructor creates empty map, `ensureInitialized()` loads plugins once on first use

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 6 plugins ready for Plan 03 (resource registration API endpoints) to use for validation and state machine lookup
- Plugin registry provides the API surface Plan 03-05 will consume
- State machines define valid status transitions that the registration API can enforce

---
*Phase: 27-resource-registry-did-plugin-architecture-inserted*
*Completed: 2026-03-07*
