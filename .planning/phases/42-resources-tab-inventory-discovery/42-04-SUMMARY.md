---
plan: 42-04
phase: 42-resources-tab-inventory-discovery
status: complete
started: 2026-03-12
completed: 2026-03-12
---

# Plan 42-04 Summary: Network Sub-View

## What Was Built

Network sub-view composing force-directed topology graph and EM spectrum panel side-by-side. EMSpectrumPanel's absolute overlay positioning stripped for inline flex layout. Topology node clicks set selectedResourceId for cross-view ResourceDetailPanel.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | Move NetworkTopologyView and EMSpectrumPanel, fix layout | ✓ |
| 2 | Create NetworkSubView and wire into ResourcesTab | ✓ |

## Commits

- `a00d0b5` feat(42-04): create Network sub-view with topology graph and EM spectrum panel

## Key Files

### Created
- `frontend/src/components/resources/network/NetworkTopologyView.tsx` — moved from cop/, added onNodeClick
- `frontend/src/components/resources/network/EMSpectrumPanel.tsx` — moved from cop/, absolute positioning stripped
- `frontend/src/components/resources/network/NetworkSubView.tsx` — composes both with flex layout

### Modified
- `frontend/src/components/resources/ResourcesTab.tsx` — wired NetworkSubView with connectedCount

## Deviations

- `connected` from useDiscovery is a boolean (WebSocket status), not a device count. Derived `connectedCount` from `devices.filter(d => d.state === 'connected').length` instead.

## Self-Check: PASSED

- [x] NetworkTopologyView moved to resources/network/ with onNodeClick prop
- [x] EMSpectrumPanel moved with absolute positioning stripped (flex-shrink-0 w-80)
- [x] NetworkSubView composes both in horizontal flex layout
- [x] EM Spectrum toggle button in toolbar
- [x] Topology node click sets selectedResourceId via useResourcesContext
- [x] ResourcesTab wires NetworkSubView with hoisted discovery props
- [x] No duplicate useDiscovery calls
