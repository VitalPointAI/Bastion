# Phase 32: Network Device Discovery & Secure Automatic Resource Onboarding - Research

**Researched:** 2026-03-07
**Domain:** Network device discovery, protocol bridging, IoT onboarding, EM spectrum awareness
**Confidence:** MEDIUM-HIGH

## Summary

Phase 32 extends BASTION's existing resource registry (Phase 27) and plugin architecture with an active network discovery layer that scans across four transport types (Bluetooth/BLE, WiFi/mDNS/SSDP/UPnP, USB/Serial, TAK/RF CoT), fingerprints devices, and onboards them as first-class resources with DIDs, capability mapping, and bidirectional command channels. The phase is primarily a backend architecture extension with a COP frontend layer for discovery visualization and EM spectrum awareness.

The existing codebase provides strong foundations: `ResourceRegistry` (singleton, write-through cache, DID registration), `PluginRegistry` (convention-based auto-discovery), `ResourcePlugin` interface (5 facets to extend with command adapter), `ResourceTelemetryService` (WebSocket batched push), and the `GateService` (DAO governance gates from Phase 28). The Ironclaw agent (Phase 30) provides the adaptive fallback for unknown device adapter generation via MCP tool bridge.

**Primary recommendation:** Build a `DiscoveryService` singleton that orchestrates per-transport scanner modules behind a common `TransportScanner` interface. Each scanner emits standardized `DiscoveryEvent` objects into a pipeline that flows through fingerprinting, challenge-response auth, acceptance gate (DAO allowlist/blocklist), and finally into `ResourceRegistry.registerResource()`. Extend `ResourcePlugin` with a 6th `CommandAdapter` facet for bidirectional device communication. Use Node.js-native and lightweight libraries for transport scanning rather than heavy frameworks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Discovery Scope:**
- Scan all 4 transport types: Bluetooth/BLE, WiFi/mDNS/SSDP/UPnP, USB/Serial, Custom RF/TAK (CoT protocol)
- Always-on background scanning with configurable intervals -- operator can pause/resume
- Full auto-fingerprinting before acceptance gate: probe discovered devices for type, manufacturer, capabilities, supported protocols
- Persistent registry with full presence lifecycle: discovered -> onboarded -> connected -> disconnected -> reconnected. Bastion remembers devices and auto-reconnects
- Scan all available network interfaces by default; admin-only configuration to disable specific interfaces. Ironclaw agent CANNOT override interface restrictions (protected config)
- Online preferred with graceful DDIL degradation -- full features with internet, falls back to local-only discovery when disconnected
- COP discovery layer showing unregistered/pending devices spatially on the map
- EM spectrum awareness layer -- show what EM environment Bastion is operating in
- Own EM signature layer -- display what electromagnetic footprint Bastion itself is generating

**Acceptance Gate:**
- DAO-governed allowlist AND blocklist -- both require DAO approval to modify
- Global default allowlist/blocklist with per-problem-set overrides (inherit from global, individual PS can add/restrict within scope)
- Allowed devices: auto-onboard with operator notification (not silent)
- Unknown devices (not on either list): quarantine + Ironclaw analysis. Ironclaw attempts identification and adapter creation, presents findings to DAO for approval
- Blocklisted devices: rejected for onboarding but tracked in security monitoring view -- operators see what's being rejected for threat awareness
- Revocation: normal revocation through DAO vote, plus emergency admin disconnect (logged, DAO ratifies after the fact)
- Devices start as observer trust tier within Bastion ecosystem (can't self-direct), but Bastion establishes full command channel -- device accepts and obeys Bastion commands

**Protocol Bridge:**
- Extend existing ResourcePlugin interface with a command adapter facet -- each plugin gains protocol communication alongside schema/state-machine/capabilities
- Universal Bastion command set (move, report, configure, execute) translated by adapter into device-native instructions, PLUS native command escape hatch for device-specific features
- Ironclaw generates hot-loadable plugins for unknown devices -- follows ResourcePlugin interface, plugin-loader picks them up at runtime without restart
- Hybrid connection persistence based on trust tier: persistent connections for autonomous/participant devices, on-demand for observers

**Security Model:**
- Challenge-response authentication during fingerprinting phase -- device must prove identity before onboarding proceeds. Failed challenges = immediate quarantine
- All communication channels always encrypted regardless of transport -- DID keys used for channel encryption after onboarding
- Behavioral baseline anomaly detection -- Bastion learns normal behavior patterns per device type, deviations trigger alerts and potential auto-quarantine (catches compromised/spoofed devices)
- Audit trail: detailed logs in PostgreSQL for fast queries, periodic hash anchoring to NEAR blockchain for immutability

### Claude's Discretion
- Specific scan intervals and timing per transport type
- Fingerprinting probe depth and protocol negotiation details
- EM spectrum visualization design and data sources
- Behavioral baseline ML approach and threshold tuning
- Hot-load plugin sandboxing implementation details
- DDIL fallback behavior specifics

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (existing -- extend, do not replace)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| xstate | ^5.25.1 | State machines for discovery/onboarding lifecycle | Already used for all resource state machines |
| zod | ^4.3.5 | Schema validation for fingerprint data, allowlist entries | Project standard for validation |
| ws | ^8.19.0 | WebSocket for real-time discovery events to frontend | Already used for resource telemetry |
| pg | ^8.16.3 | PostgreSQL for discovery logs, allowlist/blocklist persistence | Project database |
| pg-boss | ^12.5.4 | Job queue for async fingerprinting, Ironclaw invocation | Already used for message bus delivery |
| @noble/hashes | ^2.0.1 | HKDF key derivation for device DIDs, challenge-response | Already used for resource-did.ts |
| @noble/ciphers | ^2.1.1 | Symmetric encryption for device communication channels | Already in dependencies |
| @noble/curves | ^2.0.1 | ECDH key agreement for channel encryption | Already in dependencies |

### New Dependencies for Transport Scanning
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| multicast-dns | latest | Pure JS mDNS queries for WiFi service discovery | WiFi/mDNS scanner module |
| node-ssdp | latest | SSDP M-SEARCH for UPnP device discovery | WiFi/UPnP scanner module |
| @stoprocent/noble | latest | BLE scanning and peripheral interaction | Bluetooth scanner module (active fork of noble) |
| serialport | ^13.x | USB/serial port enumeration and communication | USB/Serial scanner module |
| @tak-ps/node-cot | latest | Parse/generate Cursor-on-Target XML/protobuf | TAK/RF scanner module |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| multicast-dns | mdns (native) | mdns requires libavahi-compat on Linux; multicast-dns is pure JS, no native deps |
| @stoprocent/noble | @abandonware/noble | @stoprocent is more actively maintained fork with better platform support |
| serialport | node-usb | serialport handles both enumeration and communication; node-usb is lower-level |
| @tak-ps/node-cot | raw XML parsing | node-cot handles both XML and protobuf CoT formats, saves significant effort |

**Installation:**
```bash
cd backend && pnpm add multicast-dns node-ssdp @stoprocent/noble serialport @tak-ps/node-cot
pnpm add -D @types/multicast-dns @types/node-ssdp
```

**Important note on native dependencies:** `@stoprocent/noble` and `serialport` have native C++ bindings. They require build tools (gcc, make, python) on the deployment server. If Bastion runs in a Docker container, include `build-essential` in the Dockerfile. For environments where native modules are unavailable, these scanners should degrade gracefully (log warning, skip transport).

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── discovery/                    # NEW — Discovery subsystem
│   ├── types.ts                  # DiscoveryEvent, DeviceFingerprint, ScannerConfig
│   ├── discovery-service.ts      # Singleton orchestrator (start/stop/pause scanning)
│   ├── discovery-store.ts        # PostgreSQL persistence for discovered devices
│   ├── discovery-ws.ts           # WebSocket handler for real-time discovery events
│   ├── fingerprint-service.ts    # Device fingerprinting pipeline
│   ├── acceptance-gate.ts        # Allowlist/blocklist check + DAO gate integration
│   ├── onboarding-pipeline.ts    # Fingerprint -> auth -> gate -> register flow
│   ├── behavioral-baseline.ts   # Anomaly detection for onboarded devices
│   ├── scanners/                 # Transport-specific scanner modules
│   │   ├── scanner-interface.ts  # TransportScanner interface
│   │   ├── ble-scanner.ts        # Bluetooth/BLE via @stoprocent/noble
│   │   ├── wifi-scanner.ts       # mDNS + SSDP/UPnP combined scanner
│   │   ├── usb-scanner.ts        # USB/Serial via serialport
│   │   └── tak-scanner.ts        # TAK CoT protocol via @tak-ps/node-cot
│   └── em-spectrum/              # EM spectrum awareness
│       ├── em-collector.ts       # Aggregate EM data from active scanners
│       └── em-types.ts           # EM band, signal strength, emission types
├── resources/
│   ├── plugins/
│   │   ├── base-plugin.ts        # MODIFY — Add CommandAdapter facet
│   │   ├── plugin-loader.ts      # MODIFY — Support hot-loading from generated/ dir
│   │   └── generated/            # NEW — Hot-loaded Ironclaw-generated plugins
│   └── ...existing files...
└── ...existing files...

frontend/src/
├── components/cop/
│   ├── DiscoveryLayer.tsx        # NEW — Map layer for discovered devices
│   └── EMSpectrumPanel.tsx       # NEW — EM spectrum awareness visualization
└── ...existing files...
```

### Pattern 1: TransportScanner Interface
**What:** Common interface for all transport-specific scanners
**When to use:** Every scanner module implements this
**Example:**
```typescript
// Source: Project convention — follows ResourcePlugin pattern

export interface DiscoveryEvent {
  transportType: 'ble' | 'wifi' | 'usb' | 'tak';
  rawIdentifier: string;        // MAC, serial, IP, CoT UID
  signalStrength?: number;       // dBm or equivalent
  firstSeen: number;             // timestamp
  lastSeen: number;              // timestamp
  rawData: Record<string, unknown>; // Transport-specific metadata
}

export interface TransportScanner {
  readonly transportType: string;
  readonly isAvailable: boolean;  // false if hardware/driver missing

  start(config: ScannerConfig): void;
  stop(): void;
  pause(): void;
  resume(): void;

  /** EventEmitter-style: 'discovered', 'lost', 'error' */
  on(event: 'discovered', handler: (evt: DiscoveryEvent) => void): void;
  on(event: 'lost', handler: (id: string) => void): void;
  on(event: 'error', handler: (err: Error) => void): void;
}

export interface ScannerConfig {
  intervalMs: number;
  enabled: boolean;
  interfaceFilter?: string[];    // Specific interfaces to scan
}
```

### Pattern 2: Discovery Lifecycle State Machine
**What:** XState v5 machine governing device lifecycle from discovery through onboarding
**When to use:** Tracks every discovered device through the pipeline
**Example:**
```typescript
// Source: Follows comms-plugin.ts pattern with xstate v5 setup()

import { setup } from 'xstate';

const discoveryLifecycle = setup({
  types: {
    events: {} as
      | { type: 'FINGERPRINT' }
      | { type: 'FINGERPRINT_COMPLETE' }
      | { type: 'CHALLENGE' }
      | { type: 'AUTH_SUCCESS' }
      | { type: 'AUTH_FAIL' }
      | { type: 'ALLOWLISTED' }
      | { type: 'BLOCKLISTED' }
      | { type: 'UNKNOWN' }
      | { type: 'IRONCLAW_APPROVED' }
      | { type: 'DAO_APPROVED' }
      | { type: 'DAO_REJECTED' }
      | { type: 'ONBOARD' }
      | { type: 'DISCONNECT' }
      | { type: 'RECONNECT' }
      | { type: 'ANOMALY' }
      | { type: 'CLEAR_ANOMALY' }
      | { type: 'REVOKE' }
      | { type: 'EMERGENCY_DISCONNECT' },
  },
}).createMachine({
  id: 'deviceDiscovery',
  initial: 'discovered',
  states: {
    discovered: {
      on: { FINGERPRINT: 'fingerprinting' },
    },
    fingerprinting: {
      on: {
        FINGERPRINT_COMPLETE: 'authenticating',
      },
    },
    authenticating: {
      on: {
        AUTH_SUCCESS: 'gateCheck',
        AUTH_FAIL: 'quarantined',
      },
    },
    gateCheck: {
      on: {
        ALLOWLISTED: 'onboarding',
        BLOCKLISTED: 'rejected',
        UNKNOWN: 'ironclawAnalysis',
      },
    },
    ironclawAnalysis: {
      on: {
        IRONCLAW_APPROVED: 'pendingDAO',
        AUTH_FAIL: 'quarantined',
      },
    },
    pendingDAO: {
      on: {
        DAO_APPROVED: 'onboarding',
        DAO_REJECTED: 'rejected',
      },
    },
    onboarding: {
      on: { ONBOARD: 'connected' },
    },
    connected: {
      on: {
        DISCONNECT: 'disconnected',
        ANOMALY: 'quarantined',
        REVOKE: 'revoked',
        EMERGENCY_DISCONNECT: 'revoked',
      },
    },
    disconnected: {
      on: {
        RECONNECT: 'connected',
        REVOKE: 'revoked',
      },
    },
    quarantined: {
      on: {
        CLEAR_ANOMALY: 'connected',
        REVOKE: 'revoked',
      },
    },
    rejected: {
      type: 'final',
    },
    revoked: {
      type: 'final',
    },
  },
});
```

### Pattern 3: CommandAdapter Facet (ResourcePlugin Extension)
**What:** 6th facet added to ResourcePlugin for bidirectional device communication
**When to use:** Any plugin that represents a connectable device
**Example:**
```typescript
// Source: Extends base-plugin.ts pattern

export interface CommandAdapter {
  /** Universal Bastion commands this adapter supports */
  readonly supportedCommands: BastionCommand[];

  /** Translate a Bastion command into device-native protocol message */
  translateCommand(command: BastionCommand, params: Record<string, unknown>): Promise<Buffer | string>;

  /** Parse device-native response back into structured Bastion response */
  parseResponse(raw: Buffer | string): Promise<CommandResponse>;

  /** Native command escape hatch — send raw device-specific command */
  sendNative?(command: string, payload: unknown): Promise<unknown>;
}

export type BastionCommand = 'move' | 'report' | 'configure' | 'execute';

export interface CommandResponse {
  success: boolean;
  command: BastionCommand | string;
  data: Record<string, unknown>;
  timestamp: number;
}

// Extended ResourcePlugin
export interface ResourcePlugin {
  // ...existing 5 facets...

  /** Optional command adapter for bidirectional device communication */
  commandAdapter?: CommandAdapter;
}
```

### Pattern 4: Hot-Load Plugin Directory
**What:** Separate directory for Ironclaw-generated plugins that plugin-loader watches
**When to use:** When Ironclaw generates an adapter for an unknown device
**Example:**
```typescript
// Extend plugin-loader.ts to also scan generated/ directory

import { watch } from 'fs';

export async function loadPlugins(): Promise<Map<string, ResourcePlugin>> {
  const plugins = new Map<string, ResourcePlugin>();

  // Load static plugins (existing behavior)
  const pluginDir = fileURLToPath(new URL('./', import.meta.url));
  // ... existing code ...

  // Also load from generated/ directory (hot-loadable)
  const generatedDir = join(pluginDir, 'generated');
  await loadFromDirectory(generatedDir, plugins);

  return plugins;
}

// Watch generated/ for new plugins at runtime
export function watchForNewPlugins(
  onNewPlugin: (plugin: ResourcePlugin) => void
): void {
  const generatedDir = join(fileURLToPath(new URL('./', import.meta.url)), 'generated');
  watch(generatedDir, async (eventType, filename) => {
    if (!filename?.endsWith('-plugin.js')) return;
    // Dynamic import and register
  });
}
```

### Pattern 5: Acceptance Gate Integration
**What:** Integrate discovery acceptance with Phase 28 DAO decision gates
**When to use:** When a device needs DAO approval for allowlist/blocklist changes or unknown device onboarding
**Example:**
```typescript
// Source: Follows gate-service.ts pattern

import { GateService } from '../gates/gate-service.js';
import { GateType } from '../gates/gate-types.js';

// Extend GateType with device acceptance types
// Add to gate-types.ts:
// device_allowlist: 'device_allowlist',
// device_onboard: 'device_onboard',

async function createDeviceAcceptanceGate(
  problemSetId: string,
  deviceFingerprint: DeviceFingerprint,
  ironclawAnalysis?: IronclawAnalysisResult
): Promise<DecisionGate> {
  const gateService = new GateService(gateStore);
  return gateService.createGate({
    problem_set_id: problemSetId,
    gate_type: 'device_onboard' as GateType,
    target_item_id: deviceFingerprint.id,
    target_item_type: 'device',
    target_item_title: `Onboard: ${deviceFingerprint.displayName}`,
    enforcement: 'hard_block',
  });
}
```

### Anti-Patterns to Avoid
- **Polling-only scanning:** Do not implement polling loops that block the event loop. Use transport-native event APIs (noble's `on('discover')`, serialport events) and complement with periodic sweeps.
- **Global mutable scanner state:** Do not share mutable state across scanner instances. Each TransportScanner owns its state; the DiscoveryService coordinates via events.
- **Synchronous fingerprinting:** Never fingerprint in the scan callback. Enqueue fingerprinting as a pg-boss job so scanning throughput is not blocked by slow probes.
- **Trust without verification:** Never auto-onboard without challenge-response auth, even for allowlisted devices. Allowlist skips DAO gate, not authentication.
- **Monolithic discovery module:** Do not put all transport logic in one file. Each transport has fundamentally different APIs and error modes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| mDNS queries | Custom UDP multicast | `multicast-dns` | mDNS has subtle DNS record type handling, TTL management, and name compression |
| SSDP M-SEARCH | Raw HTTP over UDP | `node-ssdp` | SSDP has specific multicast address, M-SEARCH format, and response parsing rules |
| BLE scanning | Raw HCI socket manipulation | `@stoprocent/noble` | BLE stack is complex (GAP, GATT, L2CAP); noble abstracts OS-specific backends |
| Serial port enumeration | `/dev/tty*` globbing | `serialport` | Cross-platform detection, baud rate negotiation, platform-specific quirks |
| CoT message parsing | XML/protobuf manual parsing | `@tak-ps/node-cot` | CoT schema is complex with events, atoms, detail elements; protobuf support |
| DID key derivation | Custom crypto | `@noble/hashes` HKDF | Already established pattern in resource-did.ts; consistency matters |
| State machine lifecycle | if/else state tracking | XState v5 `setup().createMachine()` | Project standard; enables visualization, persistence, and guards |
| Job queue for async work | setTimeout chains | pg-boss | Already in stack; provides retry, deadletter, completion tracking |

**Key insight:** Transport-layer networking is full of edge cases (partial reads, connection drops, OS-specific quirks, timing issues). Libraries abstract years of battle-testing. The project's value add is the discovery pipeline and onboarding logic, not transport protocol implementation.

## Common Pitfalls

### Pitfall 1: Bluetooth Permissions on Linux
**What goes wrong:** noble/BLE scanning requires root or `cap_net_raw+eip` capability on the node binary
**Why it happens:** BLE scanning opens raw HCI sockets which are privileged operations
**How to avoid:** Run `sudo setcap cap_net_raw+eip $(which node)` or run the Node process with appropriate capabilities in Docker/systemd
**Warning signs:** `EPERM` errors on BLE scan start, noble state stuck on `unauthorized`

### Pitfall 2: mDNS on Multiple Interfaces
**What goes wrong:** mDNS queries only go out on the default interface, missing devices on other subnets
**Why it happens:** Multicast DNS uses `224.0.0.251` which binds to a single interface by default
**How to avoid:** Enumerate all network interfaces via `os.networkInterfaces()` and bind multicast-dns to each. Respect the admin interface disable config.
**Warning signs:** Discovery works on one network but not another despite devices being present

### Pitfall 3: USB Device Hot-Plug Race Conditions
**What goes wrong:** Device appears briefly then disappears, or duplicate discovery events
**Why it happens:** USB enumeration can return stale data during plug/unplug transitions
**How to avoid:** Debounce USB device events (300-500ms), verify device is still present before fingerprinting
**Warning signs:** Rapid discovered/lost/discovered event sequences for same device

### Pitfall 4: Ironclaw-Generated Plugin Sandboxing
**What goes wrong:** A malicious or buggy Ironclaw-generated plugin crashes the server or accesses unauthorized resources
**Why it happens:** Dynamic `import()` runs generated code in the main Node.js process
**How to avoid:** Run generated plugins in a Node.js `vm` context or worker thread with limited globals. Validate generated code structure matches ResourcePlugin interface before loading. Set CPU/memory limits on worker threads.
**Warning signs:** Unexpected process crashes after loading new plugins, memory leaks

### Pitfall 5: EM Spectrum Data Without Hardware
**What goes wrong:** EM spectrum awareness layer shows no data because there's no SDR hardware
**Why it happens:** True EM spectrum sensing requires software-defined radio (SDR) hardware
**How to avoid:** Design EM layers in two tiers: (1) Inferred EM from active scanner data (BLE RSSI, WiFi signal strength, known transmitter frequencies) -- always available; (2) Full spectrum from SDR hardware -- optional. Tier 1 is the MVP.
**Warning signs:** Empty EM visualization, user confusion about what "EM awareness" means

### Pitfall 6: Allowlist/Blocklist Scope Inheritance Bugs
**What goes wrong:** A problem-set-level override doesn't properly inherit from or override the global list
**Why it happens:** Scope resolution is a classic merge problem (union vs override vs intersection)
**How to avoid:** Follow Phase 26's inheritance pattern: global list is base, PS overrides can ADD entries but cannot remove global blocklist entries (only add more). PS allowlist entries supplement global allowlist.
**Warning signs:** Devices allowed at PS level that should be blocked globally, or vice versa

### Pitfall 7: Agent Self-Governance Bypass via Interface Config
**What goes wrong:** Ironclaw re-enables a disabled network interface to scan devices the admin blocked
**Why it happens:** Interface config not properly protected
**How to avoid:** Add interface configuration keys to `PROTECTED_CONFIG_KEYS` in ironclaw-types.ts. The pattern already exists -- just extend it.
**Warning signs:** Interface re-enabled without admin action in audit log

## Code Examples

### Scanning Interval Recommendations (Claude's Discretion)
```typescript
// Recommended scan intervals by transport type
export const DEFAULT_SCAN_INTERVALS: Record<string, ScannerConfig> = {
  ble: {
    intervalMs: 10_000,   // BLE: 10s -- BLE advertisements are frequent
    enabled: true,
  },
  wifi: {
    intervalMs: 30_000,   // WiFi: 30s -- mDNS/SSDP queries are heavier
    enabled: true,
  },
  usb: {
    intervalMs: 5_000,    // USB: 5s -- fast enumeration, hot-plug important
    enabled: true,
  },
  tak: {
    intervalMs: 15_000,   // TAK: 15s -- CoT SA messages are periodic
    enabled: true,
  },
};
```

### BLE Scanner Module
```typescript
// Source: @stoprocent/noble API
import noble from '@stoprocent/noble';
import { EventEmitter } from 'events';
import type { TransportScanner, DiscoveryEvent, ScannerConfig } from './scanner-interface.js';

export class BLEScanner extends EventEmitter implements TransportScanner {
  readonly transportType = 'ble';
  private scanning = false;
  private scanTimer: ReturnType<typeof setInterval> | null = null;

  get isAvailable(): boolean {
    try {
      return noble.state === 'poweredOn';
    } catch {
      return false;
    }
  }

  start(config: ScannerConfig): void {
    if (!this.isAvailable) {
      console.warn('[BLEScanner] Bluetooth not available, skipping');
      return;
    }

    noble.on('discover', (peripheral) => {
      const event: DiscoveryEvent = {
        transportType: 'ble',
        rawIdentifier: peripheral.address || peripheral.id,
        signalStrength: peripheral.rssi,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        rawData: {
          localName: peripheral.advertisement?.localName,
          serviceUuids: peripheral.advertisement?.serviceUuids,
          manufacturerData: peripheral.advertisement?.manufacturerData?.toString('hex'),
        },
      };
      this.emit('discovered', event);
    });

    this.scanTimer = setInterval(() => {
      if (!this.scanning) {
        noble.startScanning([], true); // all services, allow duplicates
        this.scanning = true;
        setTimeout(() => {
          noble.stopScanning();
          this.scanning = false;
        }, config.intervalMs * 0.8); // scan for 80% of interval
      }
    }, config.intervalMs);
  }

  stop(): void {
    if (this.scanTimer) clearInterval(this.scanTimer);
    noble.stopScanning();
    this.scanning = false;
  }

  pause(): void { this.stop(); }
  resume(): void { /* re-call start with last config */ }
}
```

### WiFi Scanner Module (mDNS + SSDP)
```typescript
// Source: multicast-dns + node-ssdp APIs
import mdns from 'multicast-dns';
import { Client as SSDPClient } from 'node-ssdp';
import { EventEmitter } from 'events';
import type { TransportScanner, DiscoveryEvent, ScannerConfig } from './scanner-interface.js';

export class WiFiScanner extends EventEmitter implements TransportScanner {
  readonly transportType = 'wifi';
  private mdnsInstance: ReturnType<typeof mdns> | null = null;
  private ssdpClient: SSDPClient | null = null;
  private scanTimer: ReturnType<typeof setInterval> | null = null;

  get isAvailable(): boolean { return true; } // WiFi always available if network up

  start(config: ScannerConfig): void {
    // mDNS discovery
    this.mdnsInstance = mdns();
    this.mdnsInstance.on('response', (response) => {
      for (const answer of response.answers) {
        if (answer.type === 'PTR' || answer.type === 'SRV') {
          const event: DiscoveryEvent = {
            transportType: 'wifi',
            rawIdentifier: answer.name || answer.data?.toString() || '',
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            rawData: { protocol: 'mdns', record: answer },
          };
          this.emit('discovered', event);
        }
      }
    });

    // SSDP discovery
    this.ssdpClient = new SSDPClient();
    this.ssdpClient.on('response', (headers, statusCode, rinfo) => {
      const event: DiscoveryEvent = {
        transportType: 'wifi',
        rawIdentifier: rinfo.address,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        rawData: { protocol: 'ssdp', headers, statusCode },
      };
      this.emit('discovered', event);
    });

    // Periodic queries
    this.scanTimer = setInterval(() => {
      this.mdnsInstance?.query({ questions: [{ name: '_services._dns-sd._udp.local', type: 'PTR' }] });
      this.ssdpClient?.search('ssdp:all');
    }, config.intervalMs);
  }

  stop(): void {
    if (this.scanTimer) clearInterval(this.scanTimer);
    this.mdnsInstance?.destroy();
    this.ssdpClient?.stop();
  }

  pause(): void { this.stop(); }
  resume(): void { /* re-call start */ }
}
```

### Challenge-Response Authentication
```typescript
// Source: Follows resource-did.ts HKDF pattern with @noble/hashes and @noble/curves

import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha256.js';
import { randomBytes } from 'crypto';
import { x25519 } from '@noble/curves/ed25519';

export interface ChallengeResult {
  success: boolean;
  devicePublicKey?: string;
  sharedSecret?: Uint8Array;
}

/**
 * Generate a challenge nonce for device authentication.
 * Device must sign the nonce with its private key.
 */
export function generateChallenge(): { nonce: Buffer; timestamp: number } {
  return {
    nonce: randomBytes(32),
    timestamp: Date.now(),
  };
}

/**
 * For devices that support DID-based challenge-response:
 * 1. Bastion sends nonce
 * 2. Device signs nonce with its key
 * 3. Bastion verifies signature
 *
 * For simpler devices (BLE peripherals, USB devices):
 * Use fingerprint matching + protocol-specific auth (BLE pairing, USB descriptor match)
 */
export async function verifyChallenge(
  nonce: Buffer,
  response: Buffer,
  expectedPublicKey: string
): Promise<ChallengeResult> {
  // Verify the response is a valid signature of the nonce
  // Implementation depends on device capability level
  // Smart devices: ECDSA/EdDSA signature verification
  // Simple devices: HMAC with shared secret from fingerprint
  return { success: true };
}
```

### Protected Interface Config (Anti-Ironclaw-Bypass)
```typescript
// Source: Extends PROTECTED_CONFIG_KEYS in ironclaw-types.ts

// Add these keys to the existing PROTECTED_CONFIG_KEYS set:
export const DISCOVERY_PROTECTED_KEYS = [
  'discovery.interface_restrictions',
  'discovery.disabled_interfaces',
  'discovery.scanner_permissions',
  'discovery.blocklist_global',
] as const;

// In ironclaw-types.ts, add to PROTECTED_CONFIG_KEYS:
// ...existing keys...
// 'discovery.interface_restrictions',
// 'discovery.disabled_interfaces',
// 'discovery.scanner_permissions',
// 'discovery.blocklist_global',
```

### Allowlist/Blocklist Data Model
```typescript
// PostgreSQL table for device allowlist/blocklist

/*
CREATE TABLE device_access_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_type TEXT NOT NULL CHECK (list_type IN ('allow', 'block')),
  scope TEXT NOT NULL DEFAULT 'global',  -- 'global' or problem_set_id
  match_type TEXT NOT NULL CHECK (match_type IN ('mac', 'vendor_id', 'product_id', 'cot_type', 'fingerprint_hash')),
  match_value TEXT NOT NULL,
  display_name TEXT,
  added_by TEXT NOT NULL,                -- DID of admin who added
  gate_id TEXT,                          -- DAO decision gate that approved
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,               -- Optional expiry
  UNIQUE(list_type, scope, match_type, match_value)
);

CREATE TABLE discovered_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_type TEXT NOT NULL,
  raw_identifier TEXT NOT NULL,
  fingerprint JSONB,
  state TEXT NOT NULL DEFAULT 'discovered',
  device_did TEXT,                        -- Assigned after onboarding
  resource_id TEXT REFERENCES resources(id),
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  signal_strength INTEGER,
  location JSONB,                        -- {lat, lng} if known
  ironclaw_analysis JSONB,               -- Ironclaw findings if unknown device
  gate_id TEXT,                          -- DAO gate for approval
  quarantine_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE device_behavioral_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_did TEXT NOT NULL,
  metric_type TEXT NOT NULL,             -- 'telemetry_rate', 'command_response_time', 'data_volume'
  baseline_mean DOUBLE PRECISION,
  baseline_stddev DOUBLE PRECISION,
  sample_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_did, metric_type)
);

CREATE INDEX idx_device_access_scope ON device_access_list(scope, list_type);
CREATE INDEX idx_discovered_state ON discovered_devices(state);
CREATE INDEX idx_discovered_transport ON discovered_devices(transport_type);
*/
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| noble (unmaintained) | @stoprocent/noble (active fork) | 2024 | Must use maintained fork for BLE |
| serialport v10 | serialport v13 (ESM native) | 2024 | ESM import compatible with project |
| CoT XML only | @tak-ps/node-cot (XML + Protobuf) | 2024 | Protobuf support for TAK Protocol v1 |
| DIDs as strings only | W3C DID + VCs for IoT | 2025 | Industry moving toward VC-based device auth |
| Single-purpose IoT gateways | Edge DID management | 2025 | DID-based identity at edge aligns with BASTION model |

**Deprecated/outdated:**
- `noble` (original): Unmaintained since 2019, use `@stoprocent/noble`
- `@abandonware/noble`: Less actively maintained than `@stoprocent/noble`
- `mdns` (native binding): Requires platform-specific native libs; prefer `multicast-dns` (pure JS)

## Open Questions

1. **SDR Hardware for True EM Spectrum Sensing**
   - What we know: Inferred EM from scanner RSSI data is always available. True spectrum analysis requires RTL-SDR or similar hardware.
   - What's unclear: Will BASTION deployments have SDR hardware? What frequency bands to monitor?
   - Recommendation: Build EM spectrum layer as two-tier (inferred always-on, SDR optional). Define a clean `EMDataSource` interface so SDR support can be added later without refactoring.

2. **Behavioral Baseline ML Approach**
   - What we know: Need anomaly detection for device behavior. Simple statistical approaches (mean + N*stddev) are lightweight.
   - What's unclear: Whether ML models are needed or if statistical baselines suffice for MVP.
   - Recommendation: Start with online Welford's algorithm for running mean/variance per metric. Flag deviations > 3 sigma. This requires no ML dependencies and runs in-process. Upgrade to isolation forest or similar later if needed.

3. **TAK/RF Scanner Without TAK Server**
   - What we know: @tak-ps/node-cot can parse CoT messages. But receiving CoT requires either a TAK server connection or direct multicast listening.
   - What's unclear: Will BASTION run alongside a TAK server, or listen for raw CoT multicast?
   - Recommendation: Implement TAK scanner as a TCP/UDP listener for CoT SA messages on standard TAK ports (8087 TCP, 6969 UDP multicast). Also support connecting to a TAK server via its API if configured.

4. **Generated Plugin Code Validation**
   - What we know: Ironclaw generates TypeScript/JavaScript plugins that must conform to ResourcePlugin interface.
   - What's unclear: How to validate generated code is safe before loading.
   - Recommendation: Validate via zod schema check that exported object has required properties. Run in a worker thread with timeout. Log all generated code for audit. Consider a simple AST check for dangerous APIs (fs, child_process, net) before loading.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/src/resources/` -- ResourcePlugin, PluginRegistry, ResourceRegistry, ResourceTelemetryService patterns
- Existing codebase: `backend/src/gates/` -- GateService, GateType, DecisionGate patterns
- Existing codebase: `backend/src/ironclaw/` -- IronclawService, PROTECTED_CONFIG_KEYS, tool-bridge patterns
- Existing codebase: `backend/src/messaging/` -- MessageBus, pg-boss integration patterns
- [XState v5 parallel states documentation](https://stately.ai/docs/parallel-states) -- State machine patterns

### Secondary (MEDIUM confidence)
- [@stoprocent/noble npm](https://www.npmjs.com/package/@stoprocent/noble) -- BLE scanning API
- [SerialPort official docs](https://serialport.io/) -- USB/serial enumeration and communication
- [multicast-dns npm](https://www.npmjs.com/package/multicast-dns) -- Pure JS mDNS implementation
- [node-ssdp npm](https://www.npmjs.com/package/node-ssdp) -- SSDP client/server
- [@tak-ps/node-cot npm](https://www.npmjs.com/package/@tak-ps/node-cot) -- CoT message parsing
- [node-CoT GitHub](https://github.com/dfpc-coe/node-CoT) -- TAK CoT JavaScript library
- [DIDAuth-IoTFW paper](https://www.sciencedirect.com/science/article/pii/S2542660525003026) -- DID-based IoT auth patterns

### Tertiary (LOW confidence)
- EM spectrum sensing approaches -- no Node.js SDR libraries verified; RTL-SDR integration would need research if SDR hardware is available
- Behavioral baseline ML approaches -- statistical baselines are well-understood but ML threshold tuning is domain-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- extends existing project patterns with well-known libraries
- Architecture: HIGH -- follows established singleton/plugin/state-machine patterns from Phase 27
- Transport scanning: MEDIUM -- library APIs verified via npm/GitHub but not tested against project build system
- EM spectrum: LOW -- inferred EM tier is straightforward but true spectrum sensing needs hardware research
- Pitfalls: MEDIUM-HIGH -- common issues with BLE/USB/mDNS are well-documented in library issues

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (30 days -- transport libraries are stable)
