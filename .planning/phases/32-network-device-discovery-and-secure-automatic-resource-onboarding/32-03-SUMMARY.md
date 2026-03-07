---
phase: 32-network-device-discovery-and-secure-automatic-resource-onboarding
plan: 03
subsystem: discovery
tags: [ble, wifi, mdns, ssdp, usb, serialport, tak, cot, scanner, transport]

requires:
  - phase: 32-network-device-discovery-and-secure-automatic-resource-onboarding
    provides: "TransportScanner interface, DiscoveryEvent type, ScannerConfig type from types.ts"
provides:
  - "BLEScanner - Bluetooth Low Energy device discovery via @stoprocent/noble"
  - "WiFiScanner - Combined mDNS + SSDP/UPnP network device discovery"
  - "USBScanner - USB/Serial port enumeration via serialport"
  - "TAKScanner - TAK CoT SA message listener on TCP/UDP"
  - "BaseScanner abstract class with lifecycle hooks"
  - "DEFAULT_SCAN_INTERVALS per transport type"
affects: [32-04-discovery-engine, 32-05-fingerprinting, 32-06-onboarding-pipeline]

tech-stack:
  added: ["@stoprocent/noble", "multicast-dns", "node-ssdp", "serialport", "@tak-ps/node-cot", "@types/multicast-dns", "@types/node-ssdp"]
  patterns: ["BaseScanner abstract class with lifecycle hooks", "Dynamic import with try/catch for DDIL graceful degradation", "EventEmitter-based scanner with standardized DiscoveryEvent emission"]

key-files:
  created:
    - "backend/src/discovery/scanners/scanner-interface.ts"
    - "backend/src/discovery/scanners/ble-scanner.ts"
    - "backend/src/discovery/scanners/wifi-scanner.ts"
    - "backend/src/discovery/scanners/usb-scanner.ts"
    - "backend/src/discovery/scanners/tak-scanner.ts"
  modified:
    - "backend/package.json"
    - "backend/pnpm-lock.yaml"

key-decisions:
  - "Used dynamic import with try/catch for all native modules to enable DDIL graceful degradation"
  - "Used any-typed CoT constructor to avoid type incompatibility with node-cot optional fields"
  - "Used npm install as fallback when pnpm blocked by root-owned .ignored directory"

patterns-established:
  - "BaseScanner: Abstract class extending EventEmitter with onStart/onStop/onPause/onResume hooks"
  - "DDIL degradation: Dynamic import at module level, isAvailable getter checks module loaded"
  - "Scan cycle pattern: periodic intervals with 80/20 scan/rest ratio for BLE"

requirements-completed: [DISC-05, DISC-06]

duration: 9min
completed: 2026-03-07
---

# Phase 32 Plan 03: Transport Scanners Summary

**Four transport scanners (BLE, WiFi/mDNS+SSDP, USB/Serial, TAK/CoT) with BaseScanner lifecycle abstraction and DDIL graceful degradation**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-07T15:45:59Z
- **Completed:** 2026-03-07T15:54:56Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- BaseScanner abstract class with start/stop/pause/resume lifecycle hooks and DEFAULT_SCAN_INTERVALS
- BLE scanner using @stoprocent/noble with periodic scan cycles, RSSI, and advertisement data extraction
- WiFi scanner combining multicast-dns (PTR/SRV/A/TXT records) and node-ssdp (M-SEARCH) discovery
- USB scanner with serialport-based polling, debounce for stable detection, and lost event emission
- TAK scanner with TCP server (port 8087) and UDP socket (port 6969) for CoT SA messages
- All scanners gracefully degrade when hardware or native modules are unavailable

## Task Commits

Each task was committed atomically:

1. **Task 1: Install transport scanning dependencies and create scanner interface module** - `350acd9` (feat)
2. **Task 2: Implement all four transport scanner modules** - `4255425` (feat)

## Files Created/Modified
- `backend/src/discovery/scanners/scanner-interface.ts` - BaseScanner abstract class, type re-exports, DEFAULT_SCAN_INTERVALS
- `backend/src/discovery/scanners/ble-scanner.ts` - BLE scanner via @stoprocent/noble with periodic scan cycles
- `backend/src/discovery/scanners/wifi-scanner.ts` - Combined mDNS + SSDP/UPnP WiFi device discovery
- `backend/src/discovery/scanners/usb-scanner.ts` - USB/Serial port enumeration with debounce and lost detection
- `backend/src/discovery/scanners/tak-scanner.ts` - TAK CoT XML message listener on TCP/UDP ports
- `backend/package.json` - Added 5 production deps and 2 dev type deps
- `backend/pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Used dynamic `await import()` with try/catch at module level for all native dependencies to enable graceful degradation in DDIL environments where native modules may not be available
- Used `any` typing for CoT constructor to avoid type mismatch with node-cot's optional `how` field in event attributes
- Used `* as` imports for Node built-ins (net, dgram, os) compatible with bundler moduleResolution

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used npm install as fallback for pnpm permission issue**
- **Found during:** Task 1
- **Issue:** pnpm install failed due to root-owned `.ignored` directory in node_modules preventing file renames
- **Fix:** Used npm install to get dependencies in node_modules, then ran pnpm lockfile-only to update pnpm-lock.yaml
- **Files modified:** backend/package.json, backend/pnpm-lock.yaml
- **Verification:** Dependencies present in node_modules, lockfile updated
- **Committed in:** 350acd9

**2. [Rule 1 - Bug] Fixed TypeScript compilation errors in scanner modules**
- **Found during:** Task 2
- **Issue:** Type incompatibilities with node-cot CoTInstance interface (optional `how` field), multicast-dns Answer type missing `data` property, and default import syntax for Node built-ins
- **Fix:** Used any-typed CoT class, relaxed mDNS response typing, switched to `* as` namespace imports
- **Files modified:** tak-scanner.ts, wifi-scanner.ts
- **Verification:** `tsc --noEmit --project tsconfig.json` exits 0
- **Committed in:** 4255425

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for functionality. No scope creep.

## Issues Encountered
- Root-owned `.ignored` directory in backend/node_modules blocked pnpm install. Worked around with npm install for modules + pnpm lockfile-only for lockfile generation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four transport scanners ready for integration into the Discovery Engine (Plan 04)
- Scanners emit standardized DiscoveryEvent objects compatible with fingerprinting pipeline
- BaseScanner pattern established for any future transport additions

---
*Phase: 32-network-device-discovery-and-secure-automatic-resource-onboarding*
*Completed: 2026-03-07*
