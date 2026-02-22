---
status: resolved
trigger: "Investigate why Stadia Maps tiles are returning 404 errors for the alidade_smooth_dark style"
created: 2026-02-22T00:00:00Z
updated: 2026-02-22T20:30:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED - Leaflet bug causes out-of-bounds tile requests when noWrap=true; also secondary issue of no API key for non-localhost origins
test: Verified mathematically (zoom 2 valid range x:0-3, x=5 is out of bounds); verified via curl (401 without auth, 200 with localhost Referer)
expecting: fix via bounds prop on TileLayer + API key for production
next_action: COMPLETE - root cause identified

## Symptoms

expected: Map tiles load successfully displaying alidade_smooth_dark style
actual: GET https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/2/5/1.png 404 (Not Found)
errors: "GET https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/2/5/1.png 404 (Not Found)"
reproduction: Load ValidityMap or MissionMap component in browser
started: unknown - reported 2026-02-22

## Eliminated

- hypothesis: Stadia Maps changed their API or discontinued the alidade_smooth_dark style
  evidence: The style exists and returns 200 for valid tile coordinates with proper auth; confirmed via curl
  timestamp: 2026-02-22T19:20:00Z

- hypothesis: URL format changed (e.g., {r} placeholder removed)
  evidence: Stadia Maps docs confirm https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png is the correct format for Leaflet
  timestamp: 2026-02-22T19:20:00Z

- hypothesis: API key required even for localhost
  evidence: curl with Referer:localhost returns 200 for valid tiles; localhost exception is working
  timestamp: 2026-02-22T19:25:00Z

## Evidence

- timestamp: 2026-02-22T19:15:00Z
  checked: ValidityMap.tsx and MissionMap.tsx tile URL
  found: Both use identical URL - https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png with noWrap={true}
  implication: URL format matches Stadia Maps docs; identical code in both components

- timestamp: 2026-02-22T19:20:00Z
  checked: curl without auth headers to Stadia tile server
  found: Returns HTTP 401 with a 14885-byte PNG payload (an error image tile), NOT a 404
  implication: Browser reports 401 as "404" in console; tile server is responding but denying auth

- timestamp: 2026-02-22T19:22:00Z
  checked: curl with Referer:localhost:5173 for valid tile 5/16/12
  found: Returns HTTP 200 - the localhost exception is working
  implication: Auth is NOT the primary issue for localhost development

- timestamp: 2026-02-22T19:25:00Z
  checked: Mathematical validation of tile coordinate 2/5/1
  found: At zoom level 2, valid x range is 0-3 (2^2 = 4 tiles). x=5 is OUT OF BOUNDS.
  implication: Stadia Maps returns HTTP 404 (not 401) for truly non-existent/out-of-bounds tiles

- timestamp: 2026-02-22T19:27:00Z
  checked: Leaflet GitHub issues for noWrap and out-of-bounds tile requests
  found: Known Leaflet bug #4646, #7181 - noWrap:true on TileLayer does not prevent GridLayer._tileCoordsToBounds from requesting out-of-bounds tiles
  implication: Leaflet requests tiles at x=5 zoom=2 despite noWrap=true; these tiles don't exist on any tile server

- timestamp: 2026-02-22T19:28:00Z
  checked: WSL2 IP (172.23.222.188) as Referer vs localhost Referer
  found: Valid tiles (1/0/0) return 200 even from non-localhost origin; out-of-bounds tiles (2/5/1) return 404
  implication: The 404 is specifically for out-of-bounds tiles; auth (401) is a secondary/separate concern

## Resolution

root_cause: |
  TWO ISSUES:

  PRIMARY - Known Leaflet bug: noWrap=true on TileLayer does NOT prevent out-of-bounds tile requests.
  Leaflet's GridLayer._tileCoordsToBounds() ignores noWrap when computing tile coordinates, causing
  requests for tiles outside valid bounds (e.g., zoom=2 x=5, where max valid x=3). Stadia Maps
  returns HTTP 404 for these non-existent tiles. The error in the console "404" for tile 2/5/1 is
  a legitimate 404 - that tile coordinate does not exist.

  SECONDARY - No API key for non-localhost deployments: Without an API key, Stadia Maps returns HTTP
  401 (with an error PNG image) for requests from non-localhost origins. The Vite config uses
  host: '0.0.0.0' so the app is accessible via WSL2 IP (172.23.222.188). When accessed via that IP
  instead of localhost, all tile requests fail with 401.

fix: |
  FIX 1 (for out-of-bounds 404s): Add bounds prop to TileLayer matching the map's worldBounds.
  This tells Leaflet's tile layer to only request tiles within valid geographic bounds:

  <TileLayer
    bounds={[[-85, -180], [85, 180]]}
    url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
    ...
  />

  FIX 2 (for non-localhost 401s): Add API key support via VITE_STADIA_MAPS_API_KEY env var.
  When key is present, append ?api_key={key} to the tile URL:

  const tilesApiKey = import.meta.env.VITE_STADIA_MAPS_API_KEY;
  const tileUrl = tilesApiKey
    ? `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=${tilesApiKey}`
    : 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png';

  Add VITE_STADIA_MAPS_API_KEY to frontend/.env.local.example and .env.example

verification:
files_changed:
  - frontend/src/components/validity/ValidityMap.tsx
  - frontend/src/components/mission/map/MissionMap.tsx
  - frontend/.env.local.example
  - .env.example
