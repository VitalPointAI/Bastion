# Phase 56: Visual Operational Approach Editor — Research

**Researched:** 2026-03-25
**Domain:** Interactive map editor with MIL-STD-2525D symbology, dual editing modes (Ironclaw chat + direct manipulation), Yjs collaborative sync
**Confidence:** HIGH — all key libraries already installed and used in production code

## Summary

All required libraries are already installed in the project: `milsymbol@3.0.3`, `leaflet@1.9.4`, `react-leaflet@5.0.0`, `leaflet-draw@1.0.4`, `react-leaflet-draw@0.21.0`, `mgrs@2.1.0`, and `yjs@13.6.29`. There are production-quality examples of every needed pattern in the existing codebase — COASketchMap.tsx demonstrates milsymbol rendering with SVG overlay; AreaStep.tsx demonstrates react-leaflet-draw EditControl; MilSymbolMarker.tsx shows L.divIcon creation from SIDC codes; and the design-interview service shows how Ironclaw tool calls push WebSocket events to the frontend.

The data model requires a single DB migration: adding a `map_overlay` JSONB column to `operational_designs`. The OperationalApproach type in both `backend/src/design/types.ts` and `frontend/src/lib/design-service.ts` must gain a `mapOverlay` optional field. Ironclaw map tools (`bastion.design.map.*`) follow the same pattern as the existing `bastion.design.update_section` tool in `tool-bridge.ts` — they trigger a DB write and WebSocket push so the frontend overlay state updates in real-time. The design tab embeds the map editor inside the existing `OperationalApproachSection`, sitting beneath the current phase/narrative fields.

Yjs collaborative sync for the map overlay should use the existing `design-interview-{problemSetId}` document pattern (phase 55 already established a Yjs document for the design tab), storing `mapOverlay` in a Y.Map on that document. This avoids requiring a new Yjs document or new WebSocket path.

**Primary recommendation:** Implement as 5-6 plans: (1) DB migration + type extension for `mapOverlay`, (2) `OperationalApproachMapEditor` component with read-only symbol display via existing COASketchMap pattern, (3) direct manipulation editing (drag-and-drop + click-to-edit via L.Marker drag, Leaflet.Draw for control measures), (4) Ironclaw map tools registered in `tool-bridge.ts` + `ironclaw-types.ts` + `builder-handlers.ts`, (5) Yjs sync of `mapOverlay` state, (6) symbol picker UI panel.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| milsymbol | 3.0.3 | MIL-STD-2525D/APP-6D symbol rendering | Already used in MilSymbolMarker, COASketchMap |
| leaflet | 1.9.4 | Map rendering | Project standard, used across COP/COA maps |
| react-leaflet | 5.0.0 | React bindings for Leaflet | Project standard |
| leaflet-draw | 1.0.4 | Draw control measures on map | Already used in AreaStep.tsx |
| react-leaflet-draw | 0.21.0 | React component for leaflet-draw EditControl | Already used in AreaStep.tsx |
| mgrs | 2.1.0 | MGRS coordinate conversion | Already used in mgrs-coordinator.ts |
| yjs | 13.6.29 | Collaborative sync | Project standard, used in design interview |
| y-websocket | 3.0.0 | Yjs WebSocket transport | Project standard |

### No New Dependencies Required
All required libraries are installed. No `npm install` needed.

---

## Architecture Patterns

### Recommended Structure
```
frontend/src/
├── components/design/
│   ├── OperationalApproachMapEditor.tsx    # new: main map editor component
│   ├── MapSymbolPicker.tsx                 # new: SIDC/symbol selection panel
│   ├── MapSymbolEditPanel.tsx              # new: click-to-edit symbol properties
│   ├── OperationalApproachSection.tsx      # existing: add map editor beneath narrative
│   └── OperationalApproachMapEditor.css    # new: map editor styles
└── lib/
    └── map-overlay-service.ts              # new: API calls for mapOverlay PATCH

backend/src/
├── design/
│   └── types.ts                            # extend: add MapOverlay, MapSymbol, ControlMeasure
├── design/design-store.ts                  # extend: add map_overlay PATCH
├── api/design.ts                           # extend: add PATCH /api/design/:id/map-overlay
├── ironclaw/
│   ├── tool-bridge.ts                      # extend: add bastion.design.map.* tools
│   ├── ironclaw-types.ts                   # extend: add map action risk levels
│   └── builder-handlers.ts                 # extend: handle design.map.* actions
└── db/migrations/
    └── 043-design-map-overlay.sql          # new: add map_overlay column
```

### Pattern 1: SVG Overlay with milsymbol (EXISTING — use exactly as in COASketchMap.tsx)
**What:** milsymbol symbols rendered as `L.svgOverlay` on the Leaflet map bounds
**When to use:** Non-editable display of the current overlay state
**Example:**
```typescript
// Source: frontend/src/components/planning/COASketchMap.tsx (lines 179-209)
const milSymbol = new ms.Symbol(symbol.sidc, {
  size: 30,
  uniqueDesignation: symbol.designation,
});
const symbolImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
symbolImage.setAttribute('href', milSymbol.toDataURL());
// Add to SVG container then: L.svgOverlay(svgContainer, bounds, { interactive: true })
```

### Pattern 2: L.Marker with milsymbol DivIcon for Draggable Symbols (EXISTING — use MilSymbolMarker.tsx pattern)
**What:** Each symbol as a separate L.Marker with a milsymbol DivIcon, enabling Leaflet's built-in drag
**When to use:** Direct manipulation mode — drag-and-drop symbol repositioning
**Example:**
```typescript
// Source: frontend/src/components/mission/map/MilSymbolMarker.tsx (lines 32-47)
const symbol = new ms.Symbol(sidc, { size: 30 });
const icon = L.divIcon({
  className: 'milsymbol-marker',
  html: symbol.asSVG(),
  iconSize: [symbol.getSize().width, symbol.getSize().height],
  iconAnchor: [symbol.getSize().width / 2, symbol.getSize().height / 2],
});
// Then: <Marker position={[lat, lng]} icon={icon} draggable={true} />
// Drag end: eventHandlers={{ dragend: (e) => updateSymbolPosition(id, e.target.getLatLng()) }}
```

### Pattern 3: react-leaflet-draw EditControl for Control Measures (EXISTING — use AreaStep.tsx pattern)
**What:** Leaflet.Draw plugin wrapped in FeatureGroup for drawing polylines and polygons
**When to use:** Drawing phase lines, boundaries, axes of advance, engagement areas, NAIs, FSCMs
**Example:**
```typescript
// Source: frontend/src/components/mission/wizard/steps/AreaStep.tsx (lines 41-64)
import { FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

<FeatureGroup ref={featureGroupRef}>
  <EditControl
    position="topright"
    onCreated={handleCreated}
    onEdited={handleEdited}
    onDeleted={handleDeleted}
    draw={{
      polyline: { shapeOptions: { color: '#0066cc', weight: 2 } },
      polygon: { shapeOptions: { color: '#0066cc', fillOpacity: 0.1 } },
      rectangle: false,
      circle: false,
      circlemarker: false,
      marker: false,
    }}
  />
</FeatureGroup>
```

### Pattern 4: MGRS Coordinate Display (EXISTING — use mgrs-coordinator.ts)
**What:** Convert lat/lng to MGRS string for display in symbol labels and coordinate tooltips
**When to use:** All coordinate display, Ironclaw command parsing ("place at MGRS 52SDE...")
**Example:**
```typescript
// Source: frontend/src/lib/mgrs-coordinator.ts (lines 63-65)
import { latLngToMGRS, mgrsToLatLng } from '../../lib/mgrs-coordinator';
const mgrsStr = latLngToMGRS(lat, lng, 4);   // "52SDE12345678"
const { lat, lng } = mgrsToLatLng('52SDE12345678');
```

### Pattern 5: Ironclaw Tool Registration (EXISTING — follow tool-bridge.ts pattern)
**What:** Register map editing tools in BASTION_TOOLS array in `tool-bridge.ts`, add risk levels to `ironclaw-types.ts`, handle execution in `builder-handlers.ts`
**When to use:** All 6 Ironclaw map tools: add_symbol, move_symbol, remove_symbol, update_symbol, add_control_measure, add_overlay_graphic
**Example:**
```typescript
// Source: backend/src/ironclaw/tool-bridge.ts (lines 158-176) — follow exact same pattern
{
  name: 'bastion.design.map.add_symbol',
  description: 'Add a military symbol to the operational approach map overlay',
  inputSchema: {
    type: 'object',
    properties: {
      problem_set_id: { type: 'string' },
      sidc: { type: 'string', description: 'MIL-STD-2525D SIDC code' },
      designation: { type: 'string', description: 'Unit designation e.g. "1st MarDiv"' },
      lat: { type: 'number' },
      lng: { type: 'number' },
      mgrs: { type: 'string', description: 'MGRS coordinate (alternative to lat/lng)' },
      echelon: { type: 'string' },
    },
    required: ['problem_set_id', 'sidc'],
  },
  riskLevel: 'medium',
},
```

### Pattern 6: Yjs Collaborative Sync (EXISTING — follow design-interview Phase 55 pattern)
**What:** Store mapOverlay as a Y.Map in the existing `design-interview-{problemSetId}` Yjs document
**When to use:** Multi-user editing so Ironclaw edits and manual edits both appear in real-time
**Example:**
```typescript
// Source: frontend/src/hooks/useDesignInterview.ts — Yjs document established in Phase 55
// Reuse the same doc: documentId = `design-interview-${problemSetId}`
// Store overlay: doc.getMap('mapOverlay') → Y.Map<MapSymbol | ControlMeasure>
// Or use Y.Array: doc.getArray<MapSymbol>('mapSymbols'), doc.getArray<ControlMeasure>('controlMeasures')
```

### Pattern 7: WebSocket Push After Ironclaw Tool Execution (EXISTING — follow ironclaw-service.ts)
**What:** After a map tool executes, publish a `design.map_updated` event via the message bus so the frontend overlay re-renders
**When to use:** Every Ironclaw tool call that modifies `mapOverlay`
**Key reference:** `publishToChannel(problemSetId, 'design.map_updated', { mapOverlay })` in `builder-handlers.ts`

### Anti-Patterns to Avoid
- **Custom drag implementation:** Don't implement drag-and-drop from scratch — use Leaflet's built-in `draggable={true}` on `<Marker>` with `dragend` event handler
- **Separate Yjs document:** Don't create a new `map-overlay-{problemSetId}` document — reuse the design-interview document established in Phase 55 to avoid extra WebSocket connections
- **SVG overlay for editable symbols:** SVG overlay (`L.svgOverlay`) is read-only display; editable symbols must be `L.Marker` instances with DivIcon
- **Backend SIDC validation:** Do not implement server-side SIDC validation — milsymbol handles invalid SIDCs gracefully by rendering a fallback symbol
- **Storing SVG in DB:** Store structured JSON (`MapOverlay` type) in DB, not rendered SVG — the frontend always renders from JSON using milsymbol

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MIL-STD-2525D rendering | Custom SVG generator | milsymbol.js | 2500+ SIDC codes, echelon modifiers, affiliation colors, already installed |
| Map dragging | CSS drag events | Leaflet `draggable` + `dragend` | Handles projection math, touch, boundaries |
| Draw control measures | Custom mouse handlers | leaflet-draw + react-leaflet-draw | Snap-to-vertex, edit/delete, already installed |
| MGRS conversion | Coordinate math | mgrs npm package | Handles all UTM zones, already installed and wired |
| Collaborative state | Custom socket protocol | Yjs + existing y-websocket server | Conflict-free merge, already running |
| Symbol color by affiliation | CSS class lookup | milsymbol affiliation in SIDC | Affiliation code in SIDC position 1 controls color automatically |

**Key insight:** Every library needed for this phase is already installed and used in production. The phase is primarily UI composition and API wiring, not library integration.

---

## MapOverlay Data Model

### Types to Add to `backend/src/design/types.ts` and `frontend/src/lib/design-service.ts`

```typescript
export interface MapSymbol {
  id: string;
  sidc: string;                      // MIL-STD-2525D SIDC code
  designation: string;               // e.g. "1st MarDiv"
  affiliation: 'friendly' | 'enemy' | 'neutral' | 'unknown';
  lat: number;
  lng: number;
  echelon?: string;
  label?: string;
  additionalInfo?: Record<string, string>;
  createdBy: 'ironclaw' | 'user';
  createdAt: string;
}

export interface ControlMeasure {
  id: string;
  type:
    | 'phase_line'
    | 'boundary'
    | 'axis_of_advance'
    | 'objective'
    | 'engagement_area'
    | 'nai'                          // Named Area of Interest
    | 'fscm'                         // Fire Support Coordination Measure
    | 'flot'                         // Forward Line of Troops
    | 'other';
  label: string;
  affiliation: 'friendly' | 'enemy' | 'neutral';
  geometry: {
    type: 'line' | 'polygon' | 'point';
    coordinates: Array<{ lat: number; lng: number }>;
  };
  createdBy: 'ironclaw' | 'user';
  createdAt: string;
}

export interface MapOverlay {
  symbols: MapSymbol[];
  controlMeasures: ControlMeasure[];
  aoBounds?: {
    southwest: { lat: number; lng: number };
    northeast: { lat: number; lng: number };
  };
  lastUpdatedBy: 'ironclaw' | 'user';
  lastUpdatedAt: string;
}

// OperationalApproach extension:
export interface OperationalApproach {
  phases: Array<{ id: string; name: string; description: string; order: number }>;
  transitions: Array<{ fromPhaseId: string; toPhaseId: string; conditions: string[] }>;
  decisionPoints: Array<{ id: string; label: string; phaseId: string; criteria: string[] }>;
  narrative: string;
  mapOverlay?: MapOverlay;            // NEW in Phase 56
}
```

### DB Migration (043-design-map-overlay.sql)
```sql
-- Migration 043: Add map_overlay to operational_designs
-- Phase 56: Visual Operational Approach Editor
ALTER TABLE operational_designs
  ADD COLUMN IF NOT EXISTS map_overlay JSONB DEFAULT '{"symbols":[],"controlMeasures":[]}'::jsonb;
```

---

## Common Pitfalls

### Pitfall 1: Map Container SSR / Leaflet `window` Access
**What goes wrong:** Leaflet imports fail during SSR or test environments with "window is not defined"
**Why it happens:** Leaflet accesses `window` at import time
**How to avoid:** Already handled in this project — dynamic imports not needed because Vite SPA with no SSR. Import `leaflet/dist/leaflet.css` in the component file, not globally.
**Warning signs:** `TypeError: window is not defined` in test output

### Pitfall 2: react-leaflet MapContainer Must Not Re-Mount
**What goes wrong:** Map flickers or loses state when parent component re-renders
**Why it happens:** `MapContainer` creates a new Leaflet instance on mount; wrapping in a component that conditionally renders causes remount
**How to avoid:** Use `key` prop stability — never change the key. Keep `MapContainer` at a stable level in the component tree. Use refs or Yjs state for map content, not React state that triggers parent re-render.
**Warning signs:** Map "resets" zoom/position on user interaction

### Pitfall 3: Leaflet DivIcon Memory Leak with milsymbol
**What goes wrong:** Large collections of symbols (50+) cause performance issues
**Why it happens:** milsymbol creates DOM elements on every render; SVG string generation is not free
**How to avoid:** Memoize icon creation — cache `L.DivIcon` instances by SIDC+options hash. Use `useMemo` or a `Map<string, L.DivIcon>` cache outside the component render cycle.
**Warning signs:** Render time increases linearly with symbol count

### Pitfall 4: leaflet-draw CSS Missing
**What goes wrong:** Draw toolbar renders without icons (broken image icons)
**Why it happens:** leaflet-draw requires its own CSS that includes icon paths
**How to avoid:** Import `'leaflet-draw/dist/leaflet.draw.css'` in the component file (already done correctly in AreaStep.tsx — follow the same pattern)
**Warning signs:** Draw toolbar buttons show broken images

### Pitfall 5: Ironclaw Tool Schema Validation — MGRS vs LatLng
**What goes wrong:** Tool call fails because Ironclaw provides MGRS string but schema requires lat/lng
**Why it happens:** Commanders naturally use MGRS; lat/lng is the internal representation
**How to avoid:** Accept both in the tool schema — `lat`, `lng` are optional, `mgrs` is optional; builder handler converts MGRS to lat/lng using existing `mgrsToLatLng()` before persisting. Make at least one of the two pairs required via Zod refinement.
**Warning signs:** Tool call returns "missing required field" when MGRS provided

### Pitfall 6: Yjs Array vs Map for Overlay State
**What goes wrong:** Collaborative editing produces incorrect merges when symbols deleted/added concurrently
**Why it happens:** Y.Array indices shift on concurrent insertions/deletions
**How to avoid:** Use `Y.Map<MapSymbol>` keyed by symbol `id` for symbols and control measures — concurrent adds/removes on different IDs will not conflict. Never use Y.Array with index-based operations.
**Warning signs:** Symbols appear duplicated or deleted when two users edit simultaneously

### Pitfall 7: action-registry Lock After Startup
**What goes wrong:** New `bastion.design.map.*` action types return 'high' risk (default unknown) at runtime
**Why it happens:** `ActionRegistry.lock()` is called after startup; new types not pre-registered in `ACTION_RISK` map in `ironclaw-types.ts` default to 'high'
**How to avoid:** Add all 6 new action types to `ACTION_RISK` in `ironclaw-types.ts` AND to `CANONICAL_DESCRIPTIONS` in `action-registry.ts` before the lock is called. Risk level should be `medium` for all map editing tools (non-destructive, reversible).

---

## Code Examples

### Symbol SIDC Reference for Common Military Symbols
```typescript
// Source: MIL-STD-2525D SIDC structure (verified against milsymbol.js docs)
// Position 1: S = Space, A = Air, G = Land, S = Sea surface, U = Subsurface, F = SOF
// Position 2: F = Friendly, H = Hostile, N = Neutral, U = Unknown
// Full SIDC for Land Unit Friendly: 'SFGPUCI----E' (Infantry)

// Common SIDCs for operational approach symbology:
const COMMON_SIDCS = {
  LAND_UNIT_FRIENDLY: 'SFGPUCI----E',        // Friendly Infantry
  LAND_UNIT_ENEMY: 'SHGPUCI----E',           // Hostile Infantry
  ARMOR_FRIENDLY: 'SFGPUCA----E',            // Friendly Armor
  AIRCRAFT_FRIENDLY: 'SFAPMFF----E',         // Friendly Fixed Wing
  OBJECTIVE: 'GFGPOAPH--P---',              // Objective (control measure)
  PHASE_LINE: 'GFGPGLP----',               // Phase Line
  AXIS_OF_ADVANCE: 'GFGPOLAC--P---',        // Axis of Advance
};
```

### Draggable Symbol Marker
```typescript
// Pattern for draggable milsymbol marker in OperationalApproachMapEditor
import { Marker } from 'react-leaflet';
import { createMilSymbolIcon } from '../mission/map/MilSymbolMarker';

// Existing createMilSymbolIcon from MilSymbolMarker.tsx returns L.DivIcon
const icon = createMilSymbolIcon(symbol.sidc, {
  uniqueDesignation: symbol.designation,
  size: 30,
});

<Marker
  key={symbol.id}
  position={[symbol.lat, symbol.lng]}
  icon={icon}
  draggable={true}
  eventHandlers={{
    dragend: (e) => {
      const { lat, lng } = e.target.getLatLng();
      onSymbolMove(symbol.id, lat, lng);  // updates local state + Yjs + DB
    },
    click: () => onSymbolClick(symbol.id),  // opens MapSymbolEditPanel
  }}
/>
```

### Ironclaw Tool Handler in builder-handlers.ts
```typescript
// Pattern: handle bastion.design.map.add_symbol
case 'bastion.design.map.add_symbol': {
  const { problem_set_id, sidc, designation, lat: rawLat, lng: rawLng, mgrs: mgrsStr } = action.options;

  let lat = rawLat as number;
  let lng = rawLng as number;
  if (mgrsStr) {
    const coord = mgrsToLatLng(mgrsStr as string);  // from mgrs-coordinator.ts (backend version)
    lat = coord.lat;
    lng = coord.lng;
  }

  const newSymbol: MapSymbol = {
    id: randomUUID(),
    sidc: sidc as string,
    designation: (designation as string) || '',
    affiliation: getSIDCAffiliation(sidc as string),  // parse SIDC position 2
    lat, lng,
    createdBy: 'ironclaw',
    createdAt: new Date().toISOString(),
  };

  // Patch the mapOverlay in DB
  await designStore.addMapSymbol(problem_set_id as string, newSymbol);

  // Push real-time update via WebSocket
  await publishToChannel(problem_set_id as string, 'design.map_updated', { symbol: newSymbol, action: 'add' });

  return { success: true, symbolId: newSymbol.id };
}
```

### Frontend WebSocket Event Listener in OperationalApproachMapEditor
```typescript
// Listen for Ironclaw map updates via existing useIronclaw hook WebSocket
// The useIronclaw hook already handles message bus events — add handler for 'design.map_updated'
useEffect(() => {
  const ws = new WebSocket(...); // re-use existing connection via useIronclaw
  // OR: listen via Yjs observe — when Ironclaw updates DB, it also updates Y.Map
  const symbolsMap = yjsDoc?.getMap<MapSymbol>('mapSymbols');
  symbolsMap?.observe(() => {
    setSymbols(Array.from(symbolsMap.values()));
  });
}, [yjsDoc]);
```

---

## Integration Points (Existing Code)

### Files to Extend (not create from scratch)

| File | What to Add |
|------|-------------|
| `backend/src/design/types.ts` | `MapSymbol`, `ControlMeasure`, `MapOverlay` types; extend `OperationalApproach` with `mapOverlay?` |
| `frontend/src/lib/design-service.ts` | Same type additions; `mapOverlay?` on `OperationalApproach` |
| `backend/src/design/design-store.ts` | `addMapSymbol()`, `moveMapSymbol()`, `removeMapSymbol()`, `updateMapSymbol()`, `addControlMeasure()`, `setMapOverlay()` methods |
| `backend/src/api/design.ts` | `PATCH /api/design/:problemSetId/map-overlay` endpoint |
| `backend/src/ironclaw/tool-bridge.ts` | 6 new `bastion.design.map.*` entries in `BASTION_TOOLS` array |
| `backend/src/ironclaw/ironclaw-types.ts` | 6 new entries in `ACTION_RISK` map + `CANONICAL_DESCRIPTIONS` |
| `backend/src/ironclaw/builder-handlers.ts` | Case handlers for each `bastion.design.map.*` action |
| `frontend/src/components/design/OperationalApproachSection.tsx` | Add `<OperationalApproachMapEditor>` below the narrative textarea |
| `frontend/src/components/tabs/DesignTab.tsx` | Pass `mapOverlay` from `designData.operationalApproach` to section |

### Files to Create

| File | Purpose |
|------|---------|
| `backend/src/db/migrations/043-design-map-overlay.sql` | DB column addition |
| `frontend/src/components/design/OperationalApproachMapEditor.tsx` | Main map editor (MapContainer + symbols + draw) |
| `frontend/src/components/design/MapSymbolPicker.tsx` | Symbol selection panel (search by type/echelon/affiliation) |
| `frontend/src/components/design/MapSymbolEditPanel.tsx` | Click-to-edit symbol properties sidebar |
| `frontend/src/components/design/OperationalApproachMapEditor.css` | Map container sizing, panel layout |
| `frontend/src/lib/map-overlay-service.ts` | API client for map overlay PATCH calls |

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| COASketchMap SVG overlay (read-only) | Interactive Marker + Leaflet.Draw (editable) | Direct manipulation possible |
| Ironclaw chat-only interaction | Dual mode: chat + direct manipulation | Both modes feed same state |
| OperationalApproach text-only fields | mapOverlay JSON field added to model | Spatial data persisted alongside narrative |

**Existing COASketchMap.tsx** is a read-only display component used in the Plan tab for COA visualization. The Phase 56 map editor is a separate editable component for the Design tab. They share the milsymbol + Leaflet patterns but serve different purposes.

---

## Ironclaw Tool Specifications

### Tools to Register in BASTION_TOOLS

| Tool Name | Input | Risk | Purpose |
|-----------|-------|------|---------|
| `bastion.design.map.add_symbol` | `problem_set_id`, `sidc`, `designation`, `lat?`/`lng?`/`mgrs?`, `echelon?` | medium | Add MIL-STD-2525D symbol to overlay |
| `bastion.design.map.move_symbol` | `problem_set_id`, `symbol_id`, `lat?`/`lng?`/`mgrs?` | medium | Move existing symbol to new position |
| `bastion.design.map.remove_symbol` | `problem_set_id`, `symbol_id` | medium | Remove symbol from overlay |
| `bastion.design.map.update_symbol` | `problem_set_id`, `symbol_id`, `sidc?`, `designation?`, `echelon?` | medium | Update symbol properties |
| `bastion.design.map.add_control_measure` | `problem_set_id`, `type`, `label`, `coordinates`, `affiliation?` | medium | Add phase line / boundary / objective / etc. |
| `bastion.design.map.add_overlay_graphic` | `problem_set_id`, `graphic_type`, `label`, `coordinates` | medium | Add annotation graphic |

---

## Open Questions

1. **AO Bounds Source**
   - What we know: `COASketchMap` uses `aoBounds` from the sketch data; problem sets have `areaOfOperations` GeoJSON polygon
   - What's unclear: Does the current `OperationalDesign` model include AO bounds, or must it be fetched from the problem set?
   - Recommendation: Fetch `aoBounds` from the problem set's `areaOfOperations` GeoJSON in the DesignTab and pass to the map editor; also store in `MapOverlay.aoBounds` for Ironclaw context

2. **Yjs Document Choice: Reuse vs New**
   - What we know: Phase 55 established `design-interview-{problemSetId}` Yjs doc for collaborative interview
   - What's unclear: Whether the Yjs sync server supports documents not tied to `operational_plans` table (the existing `yjs-provider.ts` requires `plan_id` references)
   - Recommendation: Create a separate simple Yjs hook for the map overlay that uses the existing y-websocket server but does NOT persist to `yjs_documents` table (map state persists via PostgreSQL `map_overlay` column); Yjs is used only for real-time sync, not persistence

3. **Symbol Picker UX Scope**
   - What we know: milsymbol supports thousands of SIDCs across all domains
   - What's unclear: How many symbols to expose in the picker UI for an operational approach editor (land/air/sea only? friendly/enemy only?)
   - Recommendation: Limit to ~20 most common operational approach symbols (friendly/enemy infantry, armor, artillery, aviation, objectives, boundaries, phase lines, axes of advance) with a free-text SIDC entry field for advanced use

---

## Sources

### Primary (HIGH confidence)
- `/home/vitalpointai/projects/ssr/frontend/src/components/planning/COASketchMap.tsx` — milsymbol SVG overlay production pattern
- `/home/vitalpointai/projects/ssr/frontend/src/components/mission/map/MilSymbolMarker.tsx` — milsymbol DivIcon creation
- `/home/vitalpointai/projects/ssr/frontend/src/components/mission/wizard/steps/AreaStep.tsx` — react-leaflet-draw EditControl pattern
- `/home/vitalpointai/projects/ssr/frontend/src/lib/mgrs-coordinator.ts` — MGRS conversion API
- `/home/vitalpointai/projects/ssr/backend/src/ironclaw/tool-bridge.ts` — Ironclaw tool registration pattern
- `/home/vitalpointai/projects/ssr/backend/src/ironclaw/ironclaw-types.ts` — ACTION_RISK registration pattern
- `/home/vitalpointai/projects/ssr/backend/src/design/types.ts` — OperationalDesign type to extend
- `/home/vitalpointai/projects/ssr/backend/src/design/design-store.ts` — PostgreSQL store pattern
- `/home/vitalpointai/projects/ssr/backend/src/collaboration/yjs-provider.ts` — Yjs document provider
- `/home/vitalpointai/projects/ssr/frontend/src/hooks/useDesignInterview.ts` — Yjs doc reuse pattern (Phase 55)
- `/home/vitalpointai/projects/ssr/frontend/src/components/tabs/DesignTab.tsx` — Where to embed the map editor
- `/home/vitalpointai/projects/ssr/frontend/src/components/design/OperationalApproachSection.tsx` — Section to extend
- Installed package versions: milsymbol@3.0.3, leaflet@1.9.4, react-leaflet@5.0.0, leaflet-draw@1.0.4, react-leaflet-draw@0.21.0, mgrs@2.1.0

### Secondary (MEDIUM confidence)
- milsymbol documentation patterns — verified against installed 3.0.3 source in node_modules

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries installed, verified with package.json
- Architecture: HIGH — direct inspection of existing patterns in production code
- Pitfalls: HIGH — derived from existing code patterns and known Leaflet/milsymbol behavior
- Data model: HIGH — extends existing well-understood types

**Research date:** 2026-03-25
**Valid until:** 2026-06-01 (stable libraries; milsymbol, leaflet-draw do not release frequently)
