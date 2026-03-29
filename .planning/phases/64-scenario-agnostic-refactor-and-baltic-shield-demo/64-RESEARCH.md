# Phase 64: Scenario-Agnostic Refactor & Baltic Shield Demo — Research

**Researched:** 2026-03-29
**Domain:** Coordinate calibration architecture, scenario data modeling, robot mission orchestration, frontend scenario display
**Confidence:** HIGH — all findings from direct source inspection

---

## Summary

The application is tightly coupled to the Pacific Strategy AY26 / Iron Bastion / Taiwan scenario across 28 files in frontend and backend. The coupling falls into six distinct categories: (1) hardcoded calibration constants for Taipei Zhongzheng District, (2) Iron Bastion scenario defaults baked into orchestrator objects, (3) hardcoded team/coalition labels (CJTF WestPAC / PRC/TCC), (4) Pacific Strategy exercise phases as static arrays, (5) ZHONGZHENG_MAP street grid as the only map data for navigation-skill, and (6) theater-specific LLM prompts and fallback data in IPB service.

The good news: a full calibration profile infrastructure already exists. `backend/data/calibration-profiles.json` already has both the `default` (Latvia/EFDL) and `taipei` profiles. The frontend `mgrs-coordinator.ts` already has a `setAOCalibration()` function. The backend `swarm-cop-bridge.ts` already has an optional `calibration` parameter on `roomToGeo()`. The architecture just needs to be wired together so services read from the profile file instead of hardcoded constants, and so scenario-specific strings are loaded from problem set data.

The Baltic Shield scenario data is complete and well-structured: `backend/data/demo-baltic-seed/` has the OPORD, coalition forces JSON, and adversary ORBAT JSON. `scripts/demo-data/` has problem set hierarchy, knowledge graph actors/relationships/tensions, and component plans. The mission sequence (HOLD → RECON → CONTACT → OVERWATCH → ADVANCE → SET → AUTHORIZE → ENGAGE) does not need to change — only the coordinates and vehicle types injected into it need to come from calibration profile and problem set context.

**Primary recommendation:** Build a `CalibrationService` singleton on both backend and frontend that loads from `calibration-profiles.json` at startup (or when a problem set is activated). All coordinate transforms call the service, not module-level constants. Replace `IRON_BASTION_DEFAULTS` with `DEFAULT_MISSION_CONFIG` that derives positions from the loaded calibration. Replace all hardcoded team labels and scenario strings with values fetched from the active problem set's metadata.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SA-64-01 | Centralized CalibrationService — single loader for all coordinate conversion | Calibration profile file already exists with correct Latvia/EFDL bounds; 4 independent duplicated loaders need consolidation |
| SA-64-02 | Scenario-driven team/coalition display names | Labels hardcoded in 4 files; problem set already has `name` and `description` fields that can carry team names |
| SA-64-03 | Shared VehicleDatabase | Two separate tables exist: `KNOWN_VEHICLES` in symbology-skill.ts and `THREAT_CLASS_MAP` in vision-cop-pipeline.ts; mission-simulator.ts also has inline `threatClasses` array |
| SA-64-04 | Generalized mission config | `IRON_BASTION_DEFAULTS` and `startIronBastion()` in mission-sequence-orchestrator.ts; route endpoint `/scenarios/iron-bastion` in robot-routes.ts |
| SA-64-05 | Scenario area map | `ZHONGZHENG_MAP` in navigation-skill.ts drives A* pathfinding; Baltic terrain is open fields (no street grid) — needs different map model |
| SA-64-06 | Theater context from problem set | `THEATER_DEFAULTS` and hardcoded Indo-Pacific LLM prompts in ipb-service.ts (~20 affected lines) |
| SA-64-07 | Exercise phases from problem set | `DEFAULT_EXERCISE_PHASES` array in ExerciseDashboard.tsx hardcoded to Pacific Strategy 6-phase structure |
| SA-64-08 | Threat vector parameterization | `enemy_advance_axis` concept embedded in tactical-skills.ts WEZ logic; `classDesc: 't-99'` hardcoded in autonomous-mission-orchestrator.ts |
| SA-64-09 | Strategic force disposition from problem set | 18 hardcoded force symbols (Taiwan/PLA) in robot-routes.ts `/scenarios/seed-strategic-cop` |
| SA-64-10 | Engagement zoom from live data | `roomToLatLng(2.5, 3.5)` hardcoded in COPGateNotifications.tsx — zoom target should derive from active threat position |
| SA-64-11 | Simulation event parameterization | Recon sweep waypoints hard-coded to Taipei street grid in mission-simulator.ts; `threatClasses: ['CHN-99G', 'T-90']` in two route handlers |
| SA-64-12 | Variable/constant name cleanup | ZHONGZHENG_MAP, IRON_BASTION_DEFAULTS, startIronBastion(), AO_CENTER, DEFAULT_CENTER, CAL_SOUTH/NORTH/WEST/EAST, Pacific Strategy strings |
</phase_requirements>

---

## Standard Stack

### Core (already in use — no new dependencies needed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Node.js `fs/readFileSync` | built-in | Load calibration-profiles.json | Already used in swarm-cop-bridge and robot-mission-service |
| `mgrs` npm package | existing | MGRS ↔ lat/lng conversion | Works across all UTM zones including 34U/35V (Latvia) |
| React Context / useState | existing | Frontend calibration propagation | setAOCalibration() already exported from mgrs-coordinator.ts |

### No New Libraries Required

The refactor is a pure reorganization and parameterization of existing code. The `mgrs` library already handles any UTM zone (Latvia zone 34U/35V is fully supported). No coordinate library changes are needed.

**Installation:** none

---

## Architecture Patterns

### Recommended Structure

```
backend/src/robot/
├── calibration-service.ts     # NEW: singleton CalibrationService
│   ├── loadProfile(name)      # reads calibration-profiles.json
│   ├── getDefaultProfile()    # returns current active profile
│   └── roomToGeo(x, y)       # replaces 4 duplicated implementations
│
├── mission-sequence-orchestrator.ts
│   └── startMissionSequence() # replaces startIronBastion()
│
├── skills/
│   └── navigation-skill.ts
│       ├── EFDL_OPEN_TERRAIN_MAP  # replaces ZHONGZHENG_MAP
│       ├── setActiveMap()         # already exists, just call it
│       └── getActiveMap()         # already exists
│
backend/data/
└── calibration-profiles.json  # already has 'default' (Latvia) and 'taipei' profiles
    # 'default' profile: Latvia EFDL bounds (56.84-56.858°N, 27.688-27.708°E)
    # room_height: 15 (5m x 15m room)

frontend/src/lib/
└── mgrs-coordinator.ts        # setAOCalibration() already exported
    # call on problem set load with active calibration profile
```

### Pattern 1: CalibrationService Singleton (SA-64-01)

**What:** A single module on the backend that loads calibration-profiles.json once and provides `roomToGeo()`. All services import from here instead of duplicating the load logic.

**Current duplication:** Four separate implementations of the same load-and-convert:
- `backend/src/robot/robot-mission-service.ts` (`loadDefaultCalibration()` + `roomToGeo()`)
- `backend/src/robot/swarm-cop-bridge.ts` (`loadDefaultCalibration()` + `roomToGeo()`)
- `backend/src/coordinates/mgrs-coordinator.ts` (class-based, hardcoded constants)
- `backend/src/api/robot-routes.ts` (inline `loadProfiles()`)

**When to use:** All coordinate transforms from room space to lat/lng.

**Pattern:**
```typescript
// Source: direct inspection of backend/src/robot/swarm-cop-bridge.ts (existing pattern)
// NEW: backend/src/robot/calibration-service.ts

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface CalibrationProfile {
  room_width: number;
  room_height: number;
  map_bounds: { north: number; south: number; east: number; west: number };
  label?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CALIBRATION_FILE = join(__dirname, '../../data/calibration-profiles.json');

// Latvia EFDL fallback — matches current calibration-profiles.json 'default'
const LATVIA_EFDL_FALLBACK: CalibrationProfile = {
  room_width: 5,
  room_height: 15,
  map_bounds: { north: 56.8580, south: 56.8400, east: 27.7080, west: 27.6880 },
};

class CalibrationService {
  private profiles: Record<string, CalibrationProfile> = {};
  private loaded = false;

  loadProfiles(): void {
    if (this.loaded) return;
    try {
      if (existsSync(CALIBRATION_FILE)) {
        this.profiles = JSON.parse(readFileSync(CALIBRATION_FILE, 'utf-8'));
      }
    } catch { /* use fallback */ }
    this.loaded = true;
  }

  getProfile(name = 'default'): CalibrationProfile {
    this.loadProfiles();
    return this.profiles[name] ?? LATVIA_EFDL_FALLBACK;
  }

  roomToGeo(x: number, y: number, profileName = 'default'): { lat: number; lng: number } {
    const cal = this.getProfile(profileName);
    const { north, south, east, west } = cal.map_bounds;
    return {
      lat: south + (y / cal.room_height) * (north - south),
      lng: west + (x / cal.room_width) * (east - west),
    };
  }
}

export const calibrationService = new CalibrationService();
```

### Pattern 2: Generalized Mission Config (SA-64-04)

**What:** Replace `IRON_BASTION_DEFAULTS` with `DEFAULT_MISSION_CONFIG` and `startIronBastion()` with `startMissionSequence()`. Positions derived from calibration profile proportions, not hardcoded lat/lng offsets.

**Key insight:** The existing `SequenceConfig` interface already supports full parameterization. `IRON_BASTION_DEFAULTS` just needs to be renamed and made load from calibration context. The Taipei coordinates were `(0.3, 0.5)` homeBase in a `5×10` room. The Baltic config uses a `5×15` room — proportions are similar but the actual geo coordinates differ completely.

**Baltic equivalent positions (room coords, 5×15 room):**
```typescript
// Source: backend/data/demo-baltic-seed/adversary-orbat.json + calibration-profiles.json
// Baltic room: 5m × 15m → Latvia 56.84-56.858°N, 27.688-27.708°E

const DEFAULT_MISSION_CONFIG: SequenceConfig = {
  leaderId: 'robot-lv-01',       // from coalition-forces.json
  followerIds: ['robot-us-01', 'robot-uk-01'],
  problemSetId: 'DEMO-PS-baltic-shield',

  // Home base: SW corner staging area (behind tree line)
  homeBase: { x: 0.5, y: 1.0 },

  // Recon area: UEA open fields (northern sector)
  reconArea: { x_min: 0.5, y_min: 5.0, x_max: 4.5, y_max: 13.0 },

  // Overwatch: northern ridge at 56.852°N
  // room y≈12 → lat≈56.852°N via calibration
  overwatchPosition: { x: 2.5, y: 12.0 },

  // Firing positions: flanking the A12 approach axis
  firingPositions: [
    { x: 1.0, y: 11.0 },   // LV-BOT-01: tree line left flank
    { x: 4.0, y: 11.0 },   // US-BOT-01: ridge right flank
  ],

  reconSpeed: 80,
  advanceSpeed: 120,
  issuedBy: 'did:near:bastion.testnet',
};
```

### Pattern 3: EFDL Open Terrain Map (SA-64-05)

**What:** Replace `ZHONGZHENG_MAP` (urban street grid) with `EFDL_OPEN_TERRAIN_MAP` (open agricultural fields + tree lines + farm tracks). Baltic terrain has no street grid — navigation follows tracks and uses field boundaries as terrain features.

**Critical difference:** The ZHONGZHENG_MAP is a grid of intersecting roads. The A* route planner depends on this intersection graph. Baltic terrain is open fields — the navigation model should allow direct-line movement constrained by terrain features (tree lines, ditches) rather than requiring road intersections.

**Baltic terrain features (from OPORD):**
- Open agricultural fields providing 1500m+ LOS (entire room footprint)
- Tree line running N-S at approx room x=2.5 (natural engagement boundary)
- Farm track network roughly N-S and E-W (mobility corridors)
- Gentle ridge at room y≈12 (northern sector observation advantage)

```typescript
// Source: backend/data/demo-baltic-seed/baltic-defense-directive.txt terrain analysis
const EFDL_OPEN_TERRAIN_MAP: MapData = {
  name: 'EFDL Sector Latgale — Unmanned Engagement Area',
  bounds: { x_min: 0, y_min: 0, x_max: 5, y_max: 15 },
  geoBounds: { lat_min: 56.8400, lat_max: 56.8580, lng_min: 27.6880, lng_max: 27.7080 },
  roads: [
    // Farm tracks (N-S mobility corridors)
    { name: 'West Farm Track', axis: 'ns', position: 1.0, range: [0, 15], roadClass: 'unclassified', lanes: 1 },
    { name: 'Central Farm Track', axis: 'ns', position: 2.5, range: [0, 15], roadClass: 'unclassified', lanes: 1 },
    { name: 'East Farm Track (A12 Parallel)', axis: 'ns', position: 4.2, range: [0, 15], roadClass: 'secondary', lanes: 2 },
    // E-W movement lines
    { name: 'Southern Staging Area', axis: 'ew', position: 1.0, range: [0, 5], roadClass: 'unclassified', lanes: 1 },
    { name: 'Tree Line (Engagement Boundary)', axis: 'ew', position: 9.5, range: [0, 5], roadClass: 'unclassified', lanes: 1 },
    { name: 'Forward Edge Farm Track', axis: 'ew', position: 12.5, range: [0, 5], roadClass: 'unclassified', lanes: 1 },
  ],
  landmarks: [
    { name: 'Northern Ridge', position: { x: 2.5, y: 12.0 }, type: 'elevated', notes: 'Gentle ridge at 56.852N — elevated observation advantage, 1500m+ sight lines south' },
    { name: 'Tree Line Boundary', position: { x: 2.5, y: 9.5 }, type: 'open_terrain', notes: 'N-S tree line at grid 56.849N, 27.698E — natural engagement boundary, provides cover' },
    { name: 'Staging Area', position: { x: 2.5, y: 1.0 }, type: 'open_terrain', notes: 'SW staging area behind friendly defensive line' },
    { name: 'UEA Center', position: { x: 2.5, y: 7.5 }, type: 'open_terrain', notes: 'Center of Unmanned Engagement Area — open fields, max detection coverage' },
  ],
};
```

### Pattern 4: Frontend Calibration Initialization (SA-64-01 frontend)

**What:** On problem set load, fetch calibration profile from backend and call `setAOCalibration()`. The function already exists in `frontend/src/lib/mgrs-coordinator.ts`.

```typescript
// Source: frontend/src/lib/mgrs-coordinator.ts (setAOCalibration already exported)
// Call this when active problem set changes:

const profile = await fetch('/api/robot/calibration/profiles/default').then(r => r.json());
setAOCalibration({
  roomW: profile.room_width,
  roomH: profile.room_height,
  south: profile.map_bounds.south,
  north: profile.map_bounds.north,
  west: profile.map_bounds.west,
  east: profile.map_bounds.east,
});
// After this, all roomToLatLng/latLngToMGRS calls use Baltic coordinates
```

### Pattern 5: Scenario-Driven Team Labels (SA-64-02)

**What:** The hardcoded strings "Blue (CJTF WestPAC)" and "Red (PRC/TCC)" appear in 4 places. They should read from scenario/problem-set metadata. For Baltic Shield the labels are "Blue (MNB-LVA)" and "Red (RU WMD)".

**Pattern:** Pass `blueLabel` and `redLabel` as props derived from the problem set name or from a scenario metadata field. Provide sensible generics as fallback: "Blue Force" / "Red Force".

```typescript
// Source: direct inspection of ExerciseDashboard.tsx, OrderEditor.tsx, IPBPanel.tsx
// Replace all 4 occurrences:

// Before:
const teamLabel = order.team === 'blue' ? 'Blue (CJTF WestPAC)' : 'Red (PRC/TCC)';

// After:
const teamLabel = order.team === 'blue'
  ? (scenarioBlueLabel ?? 'Blue Force')
  : (scenarioRedLabel ?? 'Red Force');
// scenarioBlueLabel/redLabel come from problem set metadata or parent problem set
```

### Pattern 6: Theater Context Injection (SA-64-06)

**What:** `ipb-service.ts` has a `THEATER_DEFAULTS` object with Taiwan/Indo-Pacific coordinates and ~30 lines of LLM prompt text hardcoded to the Western Pacific. The fallback extraction also returns Taiwan-specific data.

**Baltic replacement:**
```typescript
// Source: direct inspection of backend/src/exercise/ipb-service.ts lines 110-262
// Replace THEATER_DEFAULTS with:
const THEATER_DEFAULTS = {
  center: { lat: 56.85, lng: 27.70 },      // Latgale, Latvia
  operationalArea: { lat: 56.85, lng: 27.70 },
  adversaryStaging: { lat: 57.10, lng: 28.20 }, // Eastern approach (Russian side)
};
// Replace Indo-Pacific LLM prompt text with Baltic-appropriate theater context
// The fallback IPB data should reference Baltic/NATO geography, not Taiwan Strait
```

### Anti-Patterns to Avoid

- **Don't fork the orchestrators:** Do not create a separate `BalticShieldOrchestrator` — parameterize the existing ones
- **Don't hardcode Baltic coordinates:** Just as Taipei coordinates were hardcoded, don't hardcode Latvia coordinates — use the calibration profile
- **Don't require problem set DB access in robot services:** Robot services run before DB is needed; calibration comes from the JSON file, not a DB query
- **Don't rename the mission phases:** The HOLD/RECON/CONTACT/OVERWATCH/ADVANCE/SET/AUTHORIZE/ENGAGE phases are scenario-agnostic — keep them
- **Don't make CalibrationService async:** Synchronous file read at startup is fine; makes all call sites simpler

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MGRS for Latvia zone | Custom UTM zone 34U/35V math | `mgrs` npm library (already used) | The library handles all zones; Latvia MGRS just works |
| Open-terrain A* pathfinding | New pathfinding algorithm | Extend existing `computeRoute()` with open-terrain waypoints | Baltic terrain uses the same room-coord grid; farm tracks become "roads" in MapData |
| VehicleDatabase | Third table | Merge KNOWN_VEHICLES + THREAT_CLASS_MAP into single exported const | Both tables already have the same structure; one is a subset of the other |
| Frontend scenario fetching | New API endpoint | Baltic scenario metadata lives in JSON files already seeded | Problem set already has `description`, `name`, and seed data structures |

---

## Common Pitfalls

### Pitfall 1: Calibration-profiles.json fallback hardcoded to Taipei in 2 files

**What goes wrong:** `robot-mission-service.ts` and `swarm-cop-bridge.ts` both have a hardcoded fallback that returns Taipei coordinates when the calibration file can't be loaded. After SA-64-01, the fallback should be Latvia (which IS the `default` profile in calibration-profiles.json).

**How to avoid:** After creating `calibration-service.ts`, do a grep for the old Taipei constants (`25.0540`, `121.5180`, `25.0420`, `121.5120`) to confirm all uses are eliminated. The calibration-profiles.json `default` key is already Latvia — the hardcoded fallback in TypeScript is the only place with stale Taipei constants.

**Files to check:** `robot-mission-service.ts` line ~83, `swarm-cop-bridge.ts` line ~47, `robot-routes.ts` line ~40.

### Pitfall 2: Navigation-skill intersection graph will be empty for Baltic terrain

**What goes wrong:** The `findIntersections()` function builds a graph from all N-S × E-W road crossings. If only 3 N-S farm tracks and 3 E-W tracks are defined, only 9 intersections exist. In open terrain with no roads, the A* planner falls back to direct-line waypoints between the nearest intersections — which is actually correct behavior for open fields.

**How to avoid:** Add enough farm track entries to `EFDL_OPEN_TERRAIN_MAP` to give the A* planner reasonable waypoints. Test by running `startMissionSequence()` with `simulate=true` — the robots should traverse the open field rather than getting stuck with zero-waypoint routes.

### Pitfall 3: Mission simulator recon path references Taipei streets

**What goes wrong:** `mission-simulator.ts` lines 113-136 hardcode a Taipei Zhongzheng street sweep as the recon path for `recon_area` commands. With Baltic terrain, this path would try to navigate streets that don't exist in the EFDL map — resulting in a disconnected route.

**How to avoid:** Replace the hardcoded waypoints array with a call to `navigation-skill.createNavigationTools()` (already exists), or generate a simpler grid sweep from the `reconArea` bounds. For open terrain, a straight back-and-forth grid sweep is tactically correct (no streets to follow).

### Pitfall 4: COPGateNotifications hardcoded zoom center

**What goes wrong:** `COPGateNotifications.tsx` calls `roomToLatLng(2.5, 3.5)` which hardcodes the zoom target to the Taipei AO center. After calibration update, this will correctly convert to a Baltic position — but only if `setAOCalibration()` has been called before the gate notification fires.

**How to avoid:** Ensure `setAOCalibration()` is called on app startup (in a layout component or the COP view's useEffect), not lazily when a gate arrives. The zoom coordinates will then auto-correct via the calibration.

### Pitfall 5: seed-strategic-cop route has 18 hardcoded Taiwan/PLA symbols

**What goes wrong:** `POST /scenarios/seed-strategic-cop` builds a hardcoded array of ROC/PLA symbols at Taiwan coordinates. Running this for a Baltic Shield problem set would plant Taiwan units on a Latvia map.

**How to avoid:** This endpoint needs to either: (a) detect the problem set's theater from metadata and return the right symbols, or (b) be replaced entirely with a seed that reads from `adversary-orbat.json` and `coalition-forces.json`. The Baltic seed data already exists in `backend/data/demo-baltic-seed/`.

### Pitfall 6: VehicleDatabase merge must preserve both key formats

**What goes wrong:** `KNOWN_VEHICLES` (symbology-skill.ts) and `THREAT_CLASS_MAP` (vision-cop-pipeline.ts) both use lowercased keys like `'t-90'`, `'chn-99g'`. `mission-simulator.ts` passes values like `'CHN-99G'`, `'T-90'` (uppercase). Both the lookup in symbology-skill (lowercases before lookup) and the Baltic adversary types (`'t-72'`, `'bmp-3'`, `'btr-82'`, `'t-80'`) must be in the merged database.

**Baltic vehicle types needed:** `t-72`, `t72`, `bmp-3`, `bmp3`, `btr-82`, `btr82`, `t-80`, `t80` — all already present in `KNOWN_VEHICLES` via existing entries.

### Pitfall 7: AWC_POSITION_TEMPLATE uses PLA titles in TeamRoster

**What goes wrong:** `TeamRoster.tsx` has an `AWC_POSITION_TEMPLATE` with `'PLA Air Force Planner'` and `'PLA Rocket Force Planner'` as red-side position titles. This only matters when loading the template via "Load AWC Template" button.

**How to avoid:** Rename these to generic labels: `'Red Air Force Planner'` / `'Red Rocket Force Planner'` or `'Adversary Air Planner'` / `'Adversary SRBM Planner'`.

---

## Code Examples

### Current Calibration Pattern (4 duplicated implementations)

```typescript
// Source: backend/src/robot/swarm-cop-bridge.ts (representative duplicate)
// This exact pattern is in robot-mission-service.ts AND swarm-cop-bridge.ts
function loadDefaultCalibration(): CalibrationProfile {
  try {
    if (existsSync(CALIBRATION_FILE)) {
      const profiles = JSON.parse(readFileSync(CALIBRATION_FILE, 'utf-8'));
      if (profiles.default) return profiles.default;
    }
  } catch { /* fallback below */ }
  return {
    room_width: 5,
    room_height: 10,  // BUG: should be 15 after calibration-profiles.json update
    map_bounds: { north: 25.0540, south: 25.0420, east: 121.5180, west: 121.5120 }, // BUG: Taipei
  };
}
```

### Target: Unified CalibrationService

```typescript
// Source: pattern from swarm-cop-bridge.ts, generalized
// backend/src/robot/calibration-service.ts (NEW FILE)
// Import in robot-mission-service, swarm-cop-bridge, mgrs-coordinator BE:
import { calibrationService } from './calibration-service.js';
const geo = calibrationService.roomToGeo(x, y); // uses Latvia profile by default
```

### Frontend Calibration Init (from existing setAOCalibration API)

```typescript
// Source: frontend/src/lib/mgrs-coordinator.ts (setAOCalibration already exported)
// Call in COP map init useEffect or app layout:
useEffect(() => {
  fetch('/api/robot/calibration/profiles/default')
    .then(r => r.json())
    .then(profile => {
      setAOCalibration({
        roomW: profile.room_width,
        roomH: profile.room_height,
        south: profile.map_bounds.south,
        north: profile.map_bounds.north,
        west:  profile.map_bounds.west,
        east:  profile.map_bounds.east,
      });
    });
}, []);
```

### COPMapView DEFAULT_CENTER (SA-64-01 + SA-64-12)

```typescript
// Source: frontend/src/components/cop/COPMapView.tsx line 279
// Before:
const DEFAULT_CENTER: [number, number] = [25.0, 121.5];
// After (Latvia center from calibration-profiles.json 'default' map_bounds):
const DEFAULT_CENTER: [number, number] = [56.849, 27.698];
// OR: derive dynamically from loaded calibration profile
```

### Mission Sequence rename (SA-64-04 + SA-64-12)

```typescript
// Source: backend/src/robot/mission-sequence-orchestrator.ts lines 84-127
// Rename:
//   IRON_BASTION_DEFAULTS → DEFAULT_MISSION_CONFIG
//   startIronBastion()    → startMissionSequence()
//   Route: /scenarios/iron-bastion → /scenarios/mission-sequence

// The SequenceConfig interface needs no changes — it's already fully generic
// Just rename the constant and populate with Baltic defaults
```

### Route Rename (SA-64-04 + SA-64-12)

```typescript
// Source: backend/src/api/robot-routes.ts line 520
// Before: robotRouter.post('/scenarios/iron-bastion', ...)
// After:  robotRouter.post('/scenarios/mission-sequence', ...)
// Keep old route as alias for backward compatibility if needed

// MissionSequencePanel.tsx line 151:
// Before: const url = type === 'scripted' ? '/api/robot/scenarios/iron-bastion' : ...
// After:  const url = type === 'scripted' ? '/api/robot/scenarios/mission-sequence' : ...
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Taipei defaults baked in | Latvia defaults in calibration-profiles.json | Phase 63 or prior | File has correct Latvia profile but TypeScript fallbacks haven't been updated |
| No setAOCalibration in frontend | `setAOCalibration()` exported from mgrs-coordinator.ts | Prior phase | Just needs to be called at startup |
| No roomToGeo optional param | `swarm-cop-bridge.ts` exports `roomToGeo(x, y, calibration?)` | Phase 48 | Optional calibration param enables injection |
| Iron Bastion as the only mission | Generic SequenceConfig interface | Phase 6-48 | Interface is already parameterized; only defaults are scenario-specific |

**Deprecated/outdated:**
- Taipei hardcoded fallback in robot-mission-service.ts and swarm-cop-bridge.ts: should use Latvia
- `/scenarios/iron-bastion` endpoint: rename to `/scenarios/mission-sequence`
- `IRON_BASTION_DEFAULTS`: rename to `DEFAULT_MISSION_CONFIG`
- `startIronBastion()`: rename to `startMissionSequence()`
- `ZHONGZHENG_MAP`: rename to `SCENARIO_AREA_MAP`, initialize with `EFDL_OPEN_TERRAIN_MAP`

---

## Detailed File-by-File Findings

### Backend Files

**`backend/src/coordinates/mgrs-coordinator.ts`**
- Constants: `CAL_SOUTH = 25.0420`, `CAL_NORTH = 25.0540`, `CAL_WEST = 121.5120`, `CAL_EAST = 121.5180`, `ROOM_W = 5`, `ROOM_H = 10`
- All hardcoded at module level — not loaded from calibration-profiles.json
- Fix: Load from `calibrationService.getProfile()` on first use, or make this file delegate to calibration-service

**`backend/src/robot/robot-mission-service.ts`**
- `loadDefaultCalibration()` function with Taipei fallback (lines 74-86)
- `roomToGeo()` function using the loaded calibration (line 89-96)
- Fix: Replace both with `calibrationService.roomToGeo()`

**`backend/src/robot/swarm-cop-bridge.ts`**
- Same `loadDefaultCalibration()` + `roomToGeo()` duplication as above (lines 38-63)
- The exported `roomToGeo(x, y, calibration?)` signature is correct; fix the fallback only
- Fix: Import from `calibration-service.ts`

**`backend/src/api/robot-routes.ts`**
- Line 40: fallback in `loadProfiles()` has Taipei defaults
- Line 535: `threatClasses: ['CHN-99G', 'T-90']` (PRC tanks)
- Line 623: same threatClasses
- Lines 917-938: 18 hardcoded Taiwan/PLA force disposition symbols
- Line 543: `sourceAuthority: 'Pacific Strategy AY26 Exercise'`
- Fix: Update default to Latvia, replace threatClasses with Baltic types, replace force disposition seed with Baltic data

**`backend/src/robot/mission-sequence-orchestrator.ts`**
- `IRON_BASTION_DEFAULTS` (line 84) — all coordinates map to Taipei streets
- `startIronBastion()` (line 140) — name is scenario-specific
- Comment on line 6-15: "The Iron Bastion scenario" — needs updating
- Fix: Rename constant and method; replace Taipei room coords with Baltic equivalents

**`backend/src/robot/mission-simulator.ts`**
- Lines 113-136: hardcoded Taipei recon path (11 Zhongzheng street waypoints)
- Line 203: `threatClasses ?? ['CHN-99G', 'T-90']` default
- Fix: Replace street waypoints with open-field grid sweep; update default threatClasses

**`backend/src/robot/autonomous-mission-orchestrator.ts`**
- `AUTO_DEFAULTS` (line 106) — Taipei room coordinates; `simulate: true`
- Lines 419, 498, 1794: `classDesc: 't-99'` hardcoded as simulated threat type
- Fix: Rename `AUTO_DEFAULTS` → `DEFAULT_AUTO_CONFIG`; update coordinates; replace 't-99' with Baltic vehicles

**`backend/src/robot/skills/navigation-skill.ts`**
- `ZHONGZHENG_MAP` (line 49) — 12 Taipei streets + 4 landmarks
- `let activeMap = ZHONGZHENG_MAP` (line 77) — module-level state
- `setActiveMap()` and `getActiveMap()` already exported — just need Baltic map data
- Fix: Rename `ZHONGZHENG_MAP` → `EFDL_OPEN_TERRAIN_MAP`, define Baltic terrain features

**`backend/src/robot/skills/tactical-skills.ts`**
- Reads `getActiveMap()` — will automatically use Baltic map once navigation-skill is updated
- Tank ranges table includes `t-90`, `chn-99g`, etc. — needs `t-72b3m`, `t-80bvm`
- Fix: Add Baltic adversary entries to `tankRanges` table

**`backend/src/robot/skills/symbology-skill.ts`**
- `KNOWN_VEHICLES` table (line 26-52): labeled "PLA vehicles" at top
- T-72, BMP-3, BTR-82 already present (good for Baltic)
- Missing: `t-72b3m`, `t-80bvm`, `t80bvm` variants
- Fix: Add Baltic-specific entries; merge with THREAT_CLASS_MAP in vision-cop-pipeline.ts

**`backend/src/robot/vision-cop-pipeline.ts`**
- `THREAT_CLASS_MAP` (line 31): duplicate of KNOWN_VEHICLES with different interface
- Has T-90, CHN-99G, ZTZ-99, ZBD-04, BTR-82 — has BTR-82 and BMP-3 for Baltic
- Missing: T-72, T-72B3M, T-80BVM explicit entries
- Fix: Consolidate with KNOWN_VEHICLES; add Baltic vehicle types

**`backend/src/exercise/ipb-service.ts`**
- `THEATER_DEFAULTS` (line 112): `{ center: {lat: 24.5, lng: 120}, taiwanStrait: {lat: 24.0, lng: 119.5} }`
- LLM system prompt (line 231-262): ~30 lines of Indo-Pacific/Taiwan Strait geography
- Fallback IPB (line 852-885): Taiwan-specific key terrain and NAIs
- Fix: Replace with Baltic/EUCOM theater defaults and NATO Eastern Flank geography

**`backend/src/osint/osint-graph-sync.ts`**
- `KNOWN_LOCATIONS` (line 24): heavily Indo-Pacific biased; Latvia already present (line 165)
- Need to add more Eastern European locations for Baltic Shield scenario
- Fix: Expand KNOWN_LOCATIONS with Baltic/Eastern European entries (Riga, Daugavpils, Pskov, etc.)

**`backend/src/validation/fixture-generator.ts`**
- Lines 120, 144: `scenario: 'Pacific Strategy AY26'` as scenario name in test fixtures
- Fix: Generalize to use problem set name from DB or pass scenario name as parameter

### Frontend Files

**`frontend/src/components/cop/COPMapView.tsx`**
- Line 279: `DEFAULT_CENTER: [number, number] = [25.0, 121.5]` (Taiwan)
- Fix: Update to Baltic center `[56.849, 27.698]` OR load from calibration profile

**`frontend/src/components/cop/MissionSequencePanel.tsx`**
- Line 79: `AO_CENTER: [number, number] = [25.045, 121.515]` (Taipei)
- Line 80: `AO_ZOOM = 17`
- Line 151: URL path `/api/robot/scenarios/iron-bastion`
- Line 170: `onZoomToAO?.(AO_CENTER[0], AO_CENTER[1], AO_ZOOM)` — zooms to Taipei
- Fix: Load AO center from calibration profile; update endpoint URL

**`frontend/src/components/cop/COPGateNotifications.tsx`**
- Lines 33-35: Inline calibration constants (Taipei)
- Lines 37-41: `roomToLatLng()` using those constants
- Line 68: `roomToLatLng(2.5, 3.5)` hardcoded engagement zoom
- Fix: Import `setAOCalibration/roomToLatLng` from mgrs-coordinator.ts; compute zoom from live threat position

**`frontend/src/components/exercise/ExerciseDashboard.tsx`**
- Lines 72-79: `DEFAULT_EXERCISE_PHASES` hardcoded to Pacific Strategy 6 phases
- Lines 633-642: "Blue (CJTF WestPAC)" and "Red (PRC/TCC)" labels
- Fix: Load phases from problem set metadata; load team labels from scenario config or fallback to generic

**`frontend/src/components/exercise/OrderEditor.tsx`**
- Lines 727, 1062: `teamLabel` computed as "Blue (CJTF WestPAC)" / "Red (PRC/TCC)"
- Fix: Accept `blueLabel` and `redLabel` as optional props; fall back to "Blue Force" / "Red Force"

**`frontend/src/components/exercise/IPBPanel.tsx`**
- Line 463: `perspectiveLabel` = "Blue Force (CJTF WestPAC)" / "Red Force (PRC/TCC)"
- Fix: Same approach as OrderEditor — accept optional labels

**`frontend/src/components/exercise/TeamRoster.tsx`**
- Lines 151-159: `'PLA Air Force Planner'`, `'PLA Rocket Force Planner'` in AWC template
- Fix: Rename to `'Adversary Air Planner'`, `'Adversary Fires Planner'`

**`frontend/src/lib/governance-service.ts`**
- Lines 147, 159, 288, 668: Mock data with "Indo-Pacific Coalition Command", "Taiwan Strait patrol" etc.
- Fix: Update mock/demo data to Baltic Shield coalition context

**`frontend/src/lib/mgrs-coordinator.ts`**
- Line 30: `DEFAULT_CALIBRATION` set to Taipei values
- `setAOCalibration()` already exported (line 42) — just needs to be called
- Fix: Update `DEFAULT_CALIBRATION` to Latvia values; document that `setAOCalibration()` should be called on app init

**`frontend/src/components/tabs/CreateScenarioPanel.tsx`**
- Line 130: placeholder `"e.g. Pacific Strategy AY26"`
- Fix: Change placeholder to generic `"e.g. Baltic Shield AY26"` or `"e.g. Operation Baltic Shield"`

**`frontend/src/components/admin/TeamDesignerPanel.tsx`**
- Lines 969, 979: Placeholder text references "Pacific AY26" and "Taiwan Strait"
- Fix: Update placeholders to Baltic Shield context

**`frontend/src/components/direct/CoalitionCaveatDashboard.tsx`**
- Line 52: `Taiwan: '\u{1F1F9}\u{1F1FC}'` in NATION_FLAGS
- Fix: Replace Taiwan flag with Baltic Shield nations: Latvia (LV), United States (US), United Kingdom (UK)

---

## Open Questions

1. **Is `setActiveMap()` called at startup or lazily?**
   - What we know: `navigation-skill.ts` exports `setActiveMap()` and initializes with `ZHONGZHENG_MAP`
   - What's unclear: Where/when `setActiveMap()` is currently called (if ever — it may never be called and always use the default)
   - Recommendation: Call `setActiveMap(EFDL_OPEN_TERRAIN_MAP)` at server startup in the robot service initialization path

2. **Does the A* pathfinder work for open-terrain (no intersections)?**
   - What we know: `computeRoute()` falls back to `[start, to]` when no path found through intersections
   - What's unclear: Whether 3 N-S × 3 E-W farm tracks (9 intersections) is enough for realistic Baltic routes
   - Recommendation: Test with `simulate=true`; if paths are too sparse, add more farm track entries to `EFDL_OPEN_TERRAIN_MAP`

3. **How should exercise phases be stored for Baltic Shield?**
   - What we know: `DEFAULT_EXERCISE_PHASES` is a static array in ExerciseDashboard.tsx; exercises (linked scenarios) have a `exercisePhases` field
   - What's unclear: Whether the Baltic Shield problem set seed data includes exercise phases
   - Recommendation: Baltic Shield has 3 tactical phases (SENSOR SWEEP / POSITION IN DEPTH / ENGAGE IF AUTHORIZED) — these should be in the problem set seed, loaded dynamically

4. **Should `/scenarios/iron-bastion` be removed or kept as alias?**
   - What we know: Frontend MissionSequencePanel calls this URL
   - What's unclear: Whether any external integrations (e.g., the physical robot mission client) use the old URL
   - Recommendation: Keep old URL as a deprecated alias pointing to the new `/scenarios/mission-sequence` endpoint; both can call the same handler

---

## Validation Architecture

`workflow.nyquist_validation` is not set in `.planning/config.json` — treat as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript compiler + existing integration tests |
| Config file | `tsconfig.json` (root), `backend/tsconfig.json`, `frontend/tsconfig.json` |
| Quick run command | `cd /home/vitalpointai/projects/ssr && npm run build 2>&1 \| tail -20` |
| Full suite command | `cd /home/vitalpointai/projects/ssr && npm run build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SA-64-01 | `calibrationService.roomToGeo()` returns Latvia lat/lng not Taipei | smoke | `curl /api/robot/calibration/profiles/default` returns Latvia bounds | ✅ (API route exists) |
| SA-64-02 | Team labels read from scenario, not hardcoded | visual | Manual — render ExerciseDashboard with Baltic problem set | ❌ manual-only |
| SA-64-03 | Single VehicleDatabase contains T-72B3M, BMP-3, BTR-82 | unit | TypeScript compile check (merged type imports) | ❌ Wave 0 |
| SA-64-04 | `/scenarios/mission-sequence` starts Baltic defaults | smoke | `curl -X POST /api/robot/scenarios/mission-sequence?simulate=true` | ❌ Wave 0 (new route) |
| SA-64-05 | `getActiveMap()` returns EFDL map with farm tracks | unit | Verify map name !== 'Taipei Zhongzheng' | ❌ Wave 0 |
| SA-64-06 | IPB fallback uses Baltic theater coords not Taiwan | smoke | Check `THEATER_DEFAULTS.center` values | ❌ Wave 0 |
| SA-64-07 | Baltic problem set loads 3 tactical phases | smoke | `GET /api/exercise/scenarios/{id}` returns Baltic phases | ❌ Wave 0 (seed needed) |
| SA-64-08 | T-72B3M classified correctly in COP pipeline | unit | `classifyKnownVehicle('t-72')` returns hostile MBT | ❌ Wave 0 |
| SA-64-09 | `seed-strategic-cop` seeds Baltic symbols, not Taiwan | smoke | POST seed-strategic-cop, check returned symbols | ❌ Wave 0 |
| SA-64-10 | Gate zoom uses live threat position, not hardcoded | visual | Manual — trigger gate, verify map zooms to threat area | ❌ manual-only |
| SA-64-11 | Simulator generates Baltic recon path | smoke | Start simulate, observe robot waypoints in telemetry | ❌ Wave 0 |
| SA-64-12 | No `IRON_BASTION`, `ZHONGZHENG`, `WestPAC`, `PRC/TCC` strings in code | static | `grep -r "IRON_BASTION\|ZHONGZHENG\|WestPAC\|PRC/TCC" src/` → 0 results | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run build` (TypeScript compile catches regressions)
- **Per wave merge:** Full build + smoke tests (manual curl to key endpoints)
- **Phase gate:** Full suite green + manual Baltic Shield demo walkthrough before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/robot/calibration-service.ts` — covers SA-64-01
- [ ] `backend/src/robot/skills/vehicle-database.ts` — merged KNOWN_VEHICLES + THREAT_CLASS_MAP, covers SA-64-03
- [ ] `scripts/demo-data/` Baltic seed ingestion script — covers SA-64-07, SA-64-09
- [ ] `grep -r "IRON_BASTION\|ZHONGZHENG\|WestPAC\|PRC.TCC\|CHN-99G\|25\\.042\|121\\.51" src/` baseline check script — covers SA-64-12

---

## Sources

### Primary (HIGH confidence)
- Direct file inspection: `backend/src/robot/swarm-cop-bridge.ts` — calibration duplication pattern confirmed
- Direct file inspection: `backend/src/robot/mission-sequence-orchestrator.ts` — `IRON_BASTION_DEFAULTS`, `startIronBastion()`
- Direct file inspection: `backend/src/robot/skills/navigation-skill.ts` — `ZHONGZHENG_MAP` full structure
- Direct file inspection: `backend/data/calibration-profiles.json` — Latvia profile already exists with correct bounds
- Direct file inspection: `backend/data/demo-baltic-seed/` — all Baltic seed data confirmed present
- Direct file inspection: `frontend/src/lib/mgrs-coordinator.ts` — `setAOCalibration()` already exported
- Direct file inspection: `backend/src/api/robot-routes.ts` — `/scenarios/iron-bastion`, threatClasses, seed-strategic-cop

### Secondary (MEDIUM confidence)
- Direct inspection of `backend/src/exercise/ipb-service.ts` (grep pattern confirmed ~20 Indo-Pacific references)
- Direct inspection of `frontend/src/components/exercise/` (all 4 team label locations confirmed)

### Tertiary (LOW confidence — none)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all findings from direct source code inspection
- Architecture: HIGH — patterns derived from existing code, not speculation
- Pitfalls: HIGH — each pitfall identified from specific file/line evidence
- Baltic data completeness: HIGH — all seed files exist and were read

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (30 days — stable codebase)
