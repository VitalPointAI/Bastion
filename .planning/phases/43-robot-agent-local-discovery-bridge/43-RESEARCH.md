# Phase 43: Robot Agent & Local Discovery Bridge - Research

**Researched:** 2026-03-12
**Domain:** Python asyncio, mDNS/SSDP, WebSocket bridge, Docker networking, edge device onboarding
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Bridge Architecture & Deployment**
- Full edge node role: scanning + relay + local command execution (caches missions, queues commands when cloud is down)
- Python language — same as robot agent, shares code for WebSocket protocol, message types, mDNS (zeroconf)
- CLI-based launch (Docker run with env vars/config file) + optional local web UI enabled via `--ui` flag
- Local web UI: minimal dashboard showing scan results, connected robots, relay status, cloud connectivity (FastAPI)
- Bridge status also visible in Bastion cloud UI as a connected infrastructure resource
- Docker container runs with `--network=host` for full LAN access
- Full network scan — bridge scans for ALL mDNS/SSDP devices on the LAN (not just Bastion-tagged), relays everything to Bastion cloud for Phase 32's acceptance gate to process

**Robot-to-Bridge mDNS Discovery**
- mDNS browse with fallback config: robot uses zeroconf to browse for `_bastion._tcp.local` services; if no bridge found within timeout, falls back to configured bridge IP/hostname from env vars
- Bidirectional discovery: robot advertises `_bastion-robot._tcp.local` AND browses for bridges; bridge also browses for robots. Either side initiates connection — whoever discovers first connects
- Minimal TXT records on bridge advertisement: bridge_id, cloud_url, version
- Dual registration: robot self-registers with cloud through bridge AND bridge also reports discovered robots. Cloud reconciles. If bridge goes down, robot's direct registration is already in place

**Dual-Path Connectivity & Failover**
- Direct path preferred: robot prefers its own outbound WebSocket to cloud. Bridge relay is fallback
- Message ID deduplication: every message includes a unique message_id (UUID). Backend deduplicates — first arrival wins, second is dropped silently
- Fast automatic failover (~5s): robot detects direct connection loss (missed heartbeats or WebSocket close), promotes bridge relay to active within ~5 seconds. No operator intervention needed
- Command queueing with TTL: bridge queues commands from cloud for offline robots. Commands expire after configurable TTL (default 5 minutes). When robot reconnects locally, queued commands are delivered

**Bridge-to-Cloud Authentication**
- Registration flow: bridge starts with a one-time registration token (generated in Bastion UI). On first connect, exchanges it for persistent DID + auth credentials. Combines ease of setup with DID-based security long-term
- Bridge registered as first-class infrastructure resource in Bastion's resource registry (type: 'bridge') with its own DID, capabilities (scanning, relay, queueing), and status. Visible in Resources tab alongside robots and other devices
- Skip DAO acceptance gate: operator explicitly deployed the bridge and generated the registration token — that action IS the approval. Bridge auto-accepted at 'participant' trust tier
- Robot agent upgraded to same registration flow: one-time token → DID pattern, replacing current AUTH_TOKEN shared secret. Consistent auth model across all edge components

### Claude's Discretion
- FastAPI web UI layout and design details
- Exact mDNS browse timeout before fallback (sensible default)
- Command queue storage mechanism (in-memory vs SQLite)
- WebSocket reconnection backoff strategy details
- Bridge container health check implementation
- Exact message_id format (UUID v4 vs monotonic sequence)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 43 adds two complementary systems that form a complete local-to-cloud bridge: (1) an enhanced Python robot agent that discovers bridges via mDNS and authenticates using one-time tokens instead of shared secrets, and (2) a new Docker-based bridge service that scans the LAN for all mDNS/SSDP devices, relays discoveries to Bastion cloud, proxies commands to local robots, and caches missions when cloud connectivity is lost. Both the robot agent and bridge are Python, sharing code for WebSocket protocol, message models (Pydantic), and mDNS utilities (zeroconf).

The existing robot agent (`robot/mission_client.py`) already has the WebSocket client, reconnection backoff, telemetry loop, and mission dispatch. This phase adds a mDNS discovery layer on top of the existing transport. The backend already handles robot WebSocket connections (`robot-ws.ts`), resource registry (`ResourceRegistry`), and discovery ingestion (`discovery-router.ts`). The main backend work is extending `robot-ws.ts` to handle bridge connections, adding message deduplication, exposing a token-generation endpoint, and wiring bridge-relayed device discoveries into Phase 32's acceptance gate pipeline.

The key architectural challenge is the dual-path connection model: both the robot's direct WebSocket and the bridge relay can deliver the same message to the backend simultaneously. Message-level deduplication via UUID is the standard industry pattern, and the existing `robot-types.ts` message system is the right place to add `message_id` fields. The bridge itself is a standalone Python asyncio application that runs as a Docker container with `--network=host`.

**Primary recommendation:** Build the bridge as a standalone asyncio Python app (separate `bridge/` directory) that imports shared modules from a `robot/common/` package. Use `zeroconf>=0.148.0` for all mDNS operations, `websockets>=12.0` (already in requirements) for cloud WebSocket, and `fastapi>=0.110` + `uvicorn` for the optional web UI. Launch the bridge as `python bridge_main.py` inside Docker.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zeroconf | >=0.148.0 | mDNS service browse and advertise | De-facto Python mDNS; `AsyncZeroconf` + `AsyncServiceBrowser` integrate cleanly with asyncio; already the natural choice per CONTEXT.md |
| websockets | >=12.0 | WebSocket client (cloud uplink) | Already in `robot/requirements.txt`; proven in `mission_client.py` |
| pydantic | >=2.0 | Message models, config validation | Already in `robot/requirements.txt`; project standard |
| python-dotenv | >=1.0 | Env-based config loading | Already in `robot/requirements.txt` |
| structlog | >=23.0 | Structured logging | Already in `robot/requirements.txt` |
| fastapi | >=0.110 | Optional local web UI | Lightweight; asyncio-native; integrates with uvicorn; appropriate for dashboard |
| uvicorn | >=0.29 | ASGI server for FastAPI | Standard FastAPI deployment server |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ssdp | >=1.0 | SSDP/UPnP M-SEARCH scanning | Use for non-mDNS device scanning (UPnP devices expose themselves via SSDP not mDNS) |
| aiosqlite | >=0.20 | SQLite for command queue persistence | Preferred over in-memory if bridge must survive container restart; use if `--persist-queue` flag set |
| uuid (stdlib) | stdlib | UUID v4 generation for message_id | Built-in; no dep needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zeroconf | aiozeroconf | zeroconf is actively maintained and is the canonical choice; aiozeroconf is a fork, less activity |
| ssdp library | hand-rolled M-SEARCH | ssdp library is asyncio-native; hand-rolled is fragile with multicast edge cases |
| fastapi + uvicorn | aiohttp | FastAPI gives OpenAPI docs for free; project already uses REST/Express conventions that map naturally |
| aiosqlite | in-memory dict | in-memory is simpler and sufficient for default 5-min TTL queue; SQLite only if restart persistence is required |

**Installation (bridge):**
```bash
pip install "zeroconf>=0.148.0" "websockets>=12.0" "pydantic>=2.0" "python-dotenv>=1.0" "structlog>=23.0" "fastapi>=0.110" "uvicorn>=0.29" "ssdp>=1.0"
```

**Installation (robot agent additions):**
```bash
pip install "zeroconf>=0.148.0"
```

---

## Architecture Patterns

### Recommended Project Structure
```
robot/
├── common/                    # Shared package (robot + bridge)
│   ├── __init__.py
│   ├── models.py              # Pydantic message models (existing + new)
│   ├── mdns.py                # AsyncZeroconf helpers: advertise + browse
│   └── ws_protocol.py         # Shared WS send/recv helpers, message_id injection
├── mission_client.py          # Robot agent (existing — extend with mDNS + token auth)
├── config.py                  # Robot config (existing — extend with bridge fallback)
├── requirements.txt           # Add zeroconf
└── ...

bridge/
├── __init__.py
├── bridge_main.py             # Entry point: asyncio.run(main())
├── config.py                  # Bridge env-based config (mirrors robot/config.py pattern)
├── bridge_ws.py               # WebSocket uplink to cloud (outbound)
├── bridge_relay.py            # Robot relay: accept robot WS connections, proxy to cloud
├── scanner.py                 # mDNS + SSDP scan loop, sends to cloud discovery pipeline
├── command_queue.py           # Per-robot TTL queue for offline command buffering
├── ui.py                      # FastAPI app for --ui flag (dashboard)
├── Dockerfile                 # FROM python:3.11-slim, --network=host required at runtime
├── requirements.txt
└── .env.example
```

### Pattern 1: AsyncZeroconf Service Advertise + Browse
**What:** Bridge advertises `_bastion._tcp.local` with TXT records {bridge_id, cloud_url, version}. Robot browses for `_bastion._tcp.local` and also advertises `_bastion-robot._tcp.local`. Bridge browses for `_bastion-robot._tcp.local`. Whoever discovers first initiates the connection.

**When to use:** On startup of both bridge and robot agent. Run browse loop concurrently with main WS loop.

**Example:**
```python
# Source: python-zeroconf docs, zeroconf>=0.148.0 pattern
from zeroconf.asyncio import AsyncZeroconf, AsyncServiceBrowser, AsyncServiceInfo
import socket, asyncio

# Advertise bridge
async def advertise_bridge(bridge_id: str, port: int, cloud_url: str):
    info = AsyncServiceInfo(
        "_bastion._tcp.local.",
        f"{bridge_id}._bastion._tcp.local.",
        addresses=[socket.inet_aton(get_local_ip())],
        port=port,
        properties={
            b"bridge_id": bridge_id.encode(),
            b"cloud_url": cloud_url.encode(),
            b"version": b"1.0",
        },
    )
    async with AsyncZeroconf() as zc:
        await zc.async_register_service(info)
        await asyncio.sleep(3600)  # keep alive; cancel to unregister

# Browse for bridges (robot side)
class BridgeListener:
    def __init__(self, on_found):
        self._on_found = on_found

    async def async_on_service_state_change(self, zeroconf, service_type, name, state_change):
        from zeroconf import ServiceStateChange
        if state_change == ServiceStateChange.Added:
            info = AsyncServiceInfo(service_type, name)
            await info.async_request(zeroconf, 3000)
            await self._on_found(info)

async def browse_for_bridge(on_found, timeout_sec=10.0):
    async with AsyncZeroconf() as zc:
        listener = BridgeListener(on_found)
        browser = AsyncServiceBrowser(
            zc.zeroconf, "_bastion._tcp.local.", handlers=[listener.async_on_service_state_change]
        )
        await asyncio.sleep(timeout_sec)
        await browser.async_cancel()
```

### Pattern 2: Dual-Path Connection with Message Deduplication
**What:** Robot maintains two WS connections: direct to cloud (preferred) and via bridge relay (fallback). Every outbound message carries a `message_id` (UUID v4). Backend tracks seen message_ids in an in-memory Set with a TTL cleanup, silently drops duplicates.

**When to use:** Any time robot sends a message (telemetry, state update). Bridge transparently relays without modifying message_id.

**Example:**
```python
# Robot — shared ws_protocol helper (robot/common/ws_protocol.py)
import uuid, json

def stamp(msg: dict) -> dict:
    """Inject message_id if not already present."""
    if "message_id" not in msg:
        msg = {**msg, "message_id": str(uuid.uuid4())}
    return msg

async def send_stamped(ws, msg: dict) -> None:
    await ws.send(json.dumps(stamp(msg)))
```

```typescript
// Backend deduplication — extend robot-ws.ts
const seenMessageIds = new Map<string, number>(); // message_id -> timestamp
const DEDUP_WINDOW_MS = 30_000; // 30 seconds

function isDuplicate(messageId: string | undefined): boolean {
  if (!messageId) return false;
  const seen = seenMessageIds.has(messageId);
  if (!seen) {
    seenMessageIds.set(messageId, Date.now());
    // Periodic cleanup (run separately or inline)
  }
  return seen;
}
```

### Pattern 3: One-Time Token → DID Registration Flow
**What:** Admin generates a single-use token in Bastion UI. Bridge/robot starts with `REGISTRATION_TOKEN` env var. On first WS connect, sends `{type: "bridge:register", token: "..."}`. Backend validates token (single-use, expires after 15 min), generates DID via `createResourceDID`, returns `{type: "bridge:registered", did: "...", credentials: {...}}`. Bridge persists DID to local file. Subsequent connects use `{type: "bridge:register", did: "..."}`.

**When to use:** First-time deployment. After DID is persisted, token is discarded.

**Example:**
```typescript
// Backend: generate token (Admin UI endpoint)
// POST /api/admin/bridge-tokens
const token = crypto.randomUUID(); // one-time, 15min TTL
await bridgeTokenStore.create(token, expiresAt);
return { token };

// Backend: consume token on bridge WS register
if (msg.type === 'bridge:register' && msg.token) {
  const valid = await bridgeTokenStore.consume(msg.token); // marks used
  if (!valid) { ws.close(1008, 'invalid token'); return; }
  const resource = await registry.registerResource({
    name: `Bridge ${msg.bridge_id}`,
    category: 'other',
    missionId: 'system',
    specifications: { bridge_id: msg.bridge_id, type: 'bridge' },
    isAutonomous: false,
    capabilities: ['scanning', 'relay', 'queueing'],
  });
  ws.send(JSON.stringify({ type: 'bridge:registered', did: resource.did }));
}
```

### Pattern 4: Command Queue with TTL (Bridge)
**What:** Bridge maintains an in-memory `Map<robot_id, Command[]>`. Each command has a `ttl_expires_at` timestamp. When cloud sends a command for a robot that is not locally connected, it is queued. When robot connects locally, queued commands are delivered in order if not expired.

**When to use:** Any cloud-to-robot command routed through bridge when robot is not locally connected.

**Example:**
```python
# bridge/command_queue.py
import asyncio, time
from dataclasses import dataclass, field
from typing import List

@dataclass
class QueuedCommand:
    payload: dict
    ttl_expires_at: float  # epoch seconds

class CommandQueue:
    def __init__(self, default_ttl_sec: float = 300.0):
        self._queues: dict[str, List[QueuedCommand]] = {}
        self._default_ttl = default_ttl_sec

    def enqueue(self, robot_id: str, command: dict) -> None:
        cmd = QueuedCommand(payload=command, ttl_expires_at=time.time() + self._default_ttl)
        self._queues.setdefault(robot_id, []).append(cmd)

    def drain(self, robot_id: str) -> List[dict]:
        now = time.time()
        cmds = self._queues.pop(robot_id, [])
        live = [c.payload for c in cmds if c.ttl_expires_at > now]
        expired = len(cmds) - len(live)
        if expired:
            # log expired commands
            pass
        return live
```

### Pattern 5: Bridge Scan Results → Phase 32 Discovery Pipeline
**What:** Bridge calls `POST /api/discovery/report` (or a new `/api/discovery/bridge-report` endpoint) with discovered devices. The payload matches the existing `ClientDiscoverySchema`. Discovery router ingests as `origin: 'remote'` devices and runs them through Phase 32's acceptance gate pipeline unchanged.

**When to use:** Every scan cycle (configurable interval, default 60s). Both mDNS and SSDP results are normalized to the same discovery schema before relay.

**Example:**
```python
# bridge/scanner.py — normalize and relay
async def relay_discovery(cloud_ws, devices: list[dict]) -> None:
    msg = {
        "type": "bridge:discovery_report",
        "bridge_id": cfg.BRIDGE_ID,
        "devices": devices,  # each: {transport_type, raw_identifier, raw_data, signal_strength}
        "scanned_at": datetime.utcnow().isoformat(),
        "message_id": str(uuid.uuid4()),
    }
    await cloud_ws.send(json.dumps(msg))
```

### Anti-Patterns to Avoid
- **Modifying message_id in bridge relay:** The bridge must pass `message_id` through unchanged. The backend dedup window is keyed on the original robot-generated ID. If the bridge re-stamps, dedup breaks.
- **Using bridge network mode other than `--network=host`:** Docker's default bridge network does not receive multicast UDP (mDNS is 224.0.0.251:5353). Without `--network=host`, zeroconf cannot receive mDNS packets on Linux. This is a hard requirement.
- **Blocking asyncio event loop in scanner:** mDNS browse and SSDP M-SEARCH use UDP multicast. Run them as asyncio tasks, not in threads. Blocking will cause the cloud WS heartbeat to miss and trigger a false failover.
- **Storing registration token in code:** Token is deployment-time only. Never hardcode. Always from env var, consumed once, then replaced by DID.
- **Queuing commands without TTL:** Without TTL, a robot that is offline for hours will receive a flood of stale commands on reconnect. Always enforce TTL before delivery.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| mDNS advertise/browse | Custom UDP multicast code | `zeroconf` (AsyncZeroconf) | RFC 6762 mDNS has many edge cases: conflict resolution, probing, TTL refresh, IPv6. zeroconf handles all of it |
| SSDP discovery | Raw UDP socket M-SEARCH loop | `ssdp` library | UPnP M-SEARCH response parsing, timeout management, multicast group join — all handled |
| UUID message IDs | Custom sequence counters | `uuid.uuid4()` (stdlib) | UUIDs are stateless, collision-resistant, no coordination needed across direct + relay paths |
| WebSocket reconnection | Custom timer loop | `websockets` built-in + existing `mission_client.py` backoff pattern | Already proven in codebase; just reuse the pattern |
| DID generation | Custom key derivation | `createResourceDID` (backend/src/resources/resource-did.ts) | HKDF pattern already established for agents and resources |
| Token expiry tracking | In-memory dict | Small DB table (bridge_tokens) | Tokens must survive backend restart; in-memory does not |

**Key insight:** The mDNS and SSDP protocol implementations have subtle timing, caching, and multicast group join requirements that are extremely hard to get right with raw sockets. The zeroconf library has years of edge case handling. Any hand-rolled implementation will fail on non-standard LAN configurations (VLANs, multi-interface hosts, IPv6-only segments).

---

## Common Pitfalls

### Pitfall 1: Docker mDNS Fails Without `--network=host`
**What goes wrong:** zeroconf in the container cannot receive mDNS packets from the LAN. All browse operations time out, no devices are discovered.
**Why it happens:** Docker's default bridge network does not route UDP multicast (224.0.0.251). The container is isolated from LAN multicast traffic.
**How to avoid:** Always launch bridge container with `--network=host`. This is a locked decision in CONTEXT.md. Add validation in bridge startup: log a warning if the container cannot bind to a non-loopback interface.
**Warning signs:** `ServiceBrowser` returns no services even though devices are visible with `avahi-browse` on the host.

### Pitfall 2: Duplicate Messages After Direct + Bridge Path Both Deliver
**What goes wrong:** Backend processes the same robot telemetry twice, causing double-writes to DB, double activity feed entries, or wrong resource status transitions.
**Why it happens:** Both the robot's direct WS and the bridge relay can deliver the same message within milliseconds of each other if the robot's direct connection is slow but not fully lost.
**How to avoid:** Add `message_id` to every outbound Python model. Implement dedup Map in `robot-ws.ts` with a 30-second window. Keep dedup map in the `RobotMissionService` singleton (already a singleton — safe to add state there). Run periodic cleanup every 60s.
**Warning signs:** Activity feed shows duplicate `robot_mission_executing` entries for the same mission within seconds.

### Pitfall 3: One-Time Token Not Invalidated Server-Side
**What goes wrong:** A leaked registration token can be used by an attacker to register a rogue bridge.
**Why it happens:** Tokens are invalidated only in-memory, not persisted. Backend restart resets the used-token set, making tokens reusable.
**How to avoid:** Store used tokens in a DB table (`bridge_tokens`) with a `used_at` timestamp. Use the existing `getPool()` pattern. Token is consumed (marked used) in a transaction with DID registration.
**Warning signs:** Bridge re-registration with same token succeeds after backend restart.

### Pitfall 4: mDNS Browse Timeout Too Short for Noisy LAN
**What goes wrong:** Robot falls back to manual bridge IP before mDNS discovery completes on a busy network where initial mDNS responses are delayed.
**Why it happens:** mDNS discovery relies on multicast — on high-traffic or switched networks, responses can take 3-5 seconds.
**How to avoid:** Default browse timeout should be 10 seconds (not the 3s typical of single-lookup). Make it configurable via `MDNS_BROWSE_TIMEOUT_SEC` env var. If no bridge found within timeout, fall back to `BRIDGE_HOST`/`BRIDGE_PORT` env vars.
**Warning signs:** Robots always connect via manual IP even though a bridge is on the same LAN.

### Pitfall 5: Command Queue Grows Unbounded During Extended Offline Period
**What goes wrong:** Bridge accumulates thousands of stale commands for a robot that has been offline for hours. On reconnect, the robot receives a flood of expired (but not-yet-cleaned) commands.
**Why it happens:** Queue cleanup only happens at drain time. If drain is never called (robot stays offline), queue grows forever.
**How to avoid:** Run a background cleanup task in the bridge that evicts expired commands every 60 seconds, independent of robot reconnection. Log evictions at WARN level.
**Warning signs:** Bridge memory usage grows over multi-hour offline periods.

### Pitfall 6: Robot Agent Message ID Missing on State Update / Auth Request
**What goes wrong:** Dedup drops real state transitions because message_id was absent and backend treated it as a known-seen null.
**Why it happens:** Dedup logic checks `message_id` field; if absent, defaults to treating message as non-deduplicatable (pass through). But if the null-check is inverted, it silently drops.
**How to avoid:** Backend dedup: only deduplicate messages that HAVE a message_id. Messages without message_id always pass through (with a WARN log). Add message_id to all Python Pydantic models in this phase. Existing models without it are legacy — do not break them retroactively.
**Warning signs:** State updates are silently dropped; robot shows wrong state in UI.

---

## Code Examples

Verified patterns from existing codebase and official sources:

### Existing: Robot WebSocket Registration (robot/mission_client.py — current)
```python
# Current pattern — AUTH_TOKEN shared secret (to be replaced with DID)
reg = RegisterMsg(
    robot_id=cfg.ROBOT_ID,
    auth_token=cfg.AUTH_TOKEN,
    capabilities=["patrol_route", "find_engage"],
)
await _ws_send(ws, reg.model_dump(mode="json"))
```

### New: Robot Registration with DID (Phase 43 pattern)
```python
# New: first-time registration (has token, no DID)
if cfg.REGISTRATION_TOKEN and not cfg.ROBOT_DID:
    reg = {
        "type": "robot:register",
        "robot_id": cfg.ROBOT_ID,
        "token": cfg.REGISTRATION_TOKEN,
        "capabilities": cfg.CAPABILITIES,
    }
else:
    # Subsequent: use persisted DID
    reg = {
        "type": "robot:register",
        "robot_id": cfg.ROBOT_ID,
        "did": cfg.ROBOT_DID,
        "capabilities": cfg.CAPABILITIES,
    }
await _ws_send(ws, reg)
```

### Existing: ResourceRegistry.registerResource (backend pattern)
```typescript
// Source: backend/src/resources/resource-registry.ts (existing)
const registered = await registry.registerResource({
  name: `Robot ${robotId}`,
  category: 'vehicles',
  missionId: 'system',
  specifications: { robot_id: robotId, type: 'autonomous_ground_vehicle', connection: 'websocket' },
  isAutonomous: true,
  capabilities: capabilities.length > 0 ? capabilities : ['patrol', 'ISR'],
});
// Bridge uses same pattern with category: 'other', type: 'bridge'
```

### New: Bridge WS Connection (bridge/bridge_ws.py)
```python
# Source: mirrors robot/mission_client.py pattern exactly
import asyncio, json, websockets, structlog
from .command_queue import CommandQueue

log = structlog.get_logger(__name__)

async def bridge_cloud_loop(cfg, robot_relay, scanner, queue: CommandQueue):
    url = f"{cfg.CLOUD_WS_URL}/ws/bridge"
    delay = cfg.RECONNECT_INITIAL_DELAY

    while not cfg.shutdown.is_set():
        try:
            async with websockets.connect(url) as ws:
                await _register(ws, cfg)
                receive_task = asyncio.create_task(_receive_loop(ws, queue, robot_relay))
                report_task = asyncio.create_task(_scan_report_loop(ws, scanner))
                done, pending = await asyncio.wait(
                    [receive_task, report_task],
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for t in pending:
                    t.cancel()
                delay = cfg.RECONNECT_INITIAL_DELAY  # reset on successful connection
        except Exception as exc:
            log.warning("bridge.cloud_disconnected", error=str(exc), retry_in=delay)

        await asyncio.sleep(delay)
        delay = min(delay * 2, cfg.RECONNECT_MAX_DELAY)
```

### New: mDNS Scan in Bridge (bridge/scanner.py)
```python
# Source: zeroconf>=0.148.0 AsyncServiceBrowser pattern
from zeroconf.asyncio import AsyncZeroconf, AsyncServiceBrowser, AsyncServiceInfo
from zeroconf import ServiceStateChange
import asyncio, structlog

log = structlog.get_logger(__name__)

class MDNSScanner:
    def __init__(self):
        self._discovered = {}

    async def scan(self, duration_sec: float = 30.0) -> list[dict]:
        results = []

        async def on_change(zeroconf, service_type, name, state_change):
            if state_change == ServiceStateChange.Added:
                info = AsyncServiceInfo(service_type, name)
                await info.async_request(zeroconf, 3000)
                results.append({
                    "transport_type": "wifi",
                    "raw_identifier": name,
                    "raw_data": {
                        "addresses": info.parsed_addresses(),
                        "port": info.port,
                        "properties": {k.decode(): v.decode() if isinstance(v, bytes) else v
                                       for k, v in (info.properties or {}).items()},
                        "service_type": service_type,
                    },
                })

        async with AsyncZeroconf() as zc:
            # Browse ALL service types (full scan)
            browser = AsyncServiceBrowser(
                zc.zeroconf,
                ["_http._tcp.local.", "_bastion._tcp.local.", "_bastion-robot._tcp.local."],
                handlers=[on_change],
            )
            await asyncio.sleep(duration_sec)
            await browser.async_cancel()

        return results
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AUTH_TOKEN shared secret for robots | One-time token → DID pattern | Phase 43 | Eliminates shared secret; each edge component has unique cryptographic identity |
| Robot connects only direct to cloud | Dual-path: direct + bridge relay | Phase 43 | Resilience; bridge provides LAN-local command path when WAN is degraded |
| No LAN device scanning | Docker bridge scans entire LAN via mDNS + SSDP, relays to Phase 32 | Phase 43 | Bridge acts as remote scanning arm; extends Phase 32's discovery to user's local network |
| Bridge = Raspberry Pi (hardware) | Bridge = Docker container (software) | Phase 43 | Hardware-independent deployment; Pi remains recommended for production ops |

**Deprecated/outdated:**
- `AUTH_TOKEN` shared secret in `robot/config.py`: replaced by `REGISTRATION_TOKEN` (one-time) + persisted DID. The old `auth_token` field in `RegisterMsg` (robot/models.py) should be removed or deprecated.

---

## Existing Codebase Integration Map

This section maps which existing files need to be modified vs which are new:

### Backend — Modify Existing
| File | Change |
|------|--------|
| `backend/src/robot/robot-ws.ts` | Add `/ws/bridge` handler alongside `/ws/robot`; add message dedup Map; route bridge-relayed robot messages through existing `handleRobotMessage` |
| `backend/src/robot/robot-mission-service.ts` | Add bridge awareness to `dispatchMission` (try direct WS first, fall back to bridge relay); add dedup logic |
| `backend/src/robot/robot-types.ts` | Add `message_id?: string` to all message interfaces; add `BridgeRegisterMsg`, `BridgeRegisteredMsg` types |
| `backend/src/resources/types.ts` | Add `'bridge'` to `ResourceCategory` or use `'other'` with `type: 'bridge'` in specifications |

### Backend — New Files
| File | Purpose |
|------|---------|
| `backend/src/robot/bridge-ws.ts` | WebSocket handler for `/ws/bridge`; handles bridge registration, scan report ingestion, robot relay |
| `backend/src/robot/bridge-token-store.ts` | DB-backed one-time token store with expiry; `create()`, `consume()` methods |
| `backend/src/robot/bridge-router.ts` | REST: `POST /api/admin/bridge-tokens` (generate token), `GET /api/bridge/status` |

### Robot Python — Modify Existing
| File | Change |
|------|--------|
| `robot/config.py` | Add `REGISTRATION_TOKEN`, `ROBOT_DID`, `DID_FILE`, `BRIDGE_HOST`, `BRIDGE_PORT`, `MDNS_BROWSE_TIMEOUT_SEC` |
| `robot/models.py` | Add `message_id: Optional[str]` to all message types; update `RegisterMsg` to support token-or-DID auth |
| `robot/mission_client.py` | Add mDNS browse phase before `connect_and_run`; add bridge fallback path; add `message_id` stamping |

### New Python — Bridge (`bridge/` directory)
| File | Purpose |
|------|---------|
| `bridge/bridge_main.py` | Entry point; wires all components; handles `--ui` flag |
| `bridge/config.py` | Env-based config for bridge |
| `bridge/bridge_ws.py` | Cloud WebSocket uplink |
| `bridge/bridge_relay.py` | Local WebSocket server for robots to connect through bridge |
| `bridge/scanner.py` | mDNS + SSDP scan loop |
| `bridge/command_queue.py` | TTL command queue |
| `bridge/mdns_advertise.py` | Bridge mDNS advertisement |
| `bridge/ui.py` | FastAPI dashboard (conditional on `--ui`) |
| `bridge/Dockerfile` | Container definition |
| `bridge/requirements.txt` | Bridge dependencies |
| `bridge/.env.example` | Config documentation |

### Shared Code — Extract from robot/
| Action | Detail |
|--------|--------|
| Create `robot/common/` package | Move message model definitions, WS send helpers, mDNS utilities to `robot/common/`. Both `robot/` and `bridge/` import from it. Alternatively, install as editable local package. |

---

## Open Questions

1. **Bridge local relay port**
   - What we know: bridge accepts robot WebSocket connections locally (robots connect to bridge which proxies to cloud)
   - What's unclear: what port does the bridge listen on locally? This needs to be in bridge TXT records so robots auto-configure.
   - Recommendation: Default `BRIDGE_RELAY_PORT=8765`; include in mDNS TXT record as `relay_port`.

2. **Shared code packaging — `robot/common/` vs flat copy**
   - What we know: bridge and robot share models and mDNS utilities
   - What's unclear: whether to use a proper `pyproject.toml` local package or just copy files
   - Recommendation: Use flat copy to `bridge/common/` for now (simpler Docker build); defer proper packaging. Both directories maintain their own `requirements.txt`.

3. **Discovery transport type for bridge-relayed mDNS devices**
   - What we know: existing `TransportType` has `ble`, `wifi`, `usb`, `tak`
   - What's unclear: should bridge-discovered devices use `'wifi'` transport type or a new `'mdns'`/`'remote'` type?
   - Recommendation: Use `'wifi'` for now (mDNS devices are on WiFi/LAN); add `origin: 'bridge'` to the raw_data field for traceability in Phase 32's pipeline. Avoids changing the TransportType enum.

4. **FastAPI UI — should it share the relay port or run on a separate port?**
   - What we know: `--ui` flag enables a minimal FastAPI dashboard
   - What's unclear: whether UI and robot relay share a port (using path routing) or separate ports
   - Recommendation: Separate ports (e.g., relay on 8765, UI on 8766). Simpler to reason about; avoids WebSocket + HTTP routing conflicts. Both configurable via env.

---

## Validation Architecture

> `workflow.nyquist_validation` key is absent from `.planning/config.json` — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (Python); no existing test infra detected in robot/ |
| Config file | None — Wave 0 creates `robot/pytest.ini` and `bridge/pytest.ini` |
| Quick run command | `cd robot && pytest tests/ -x -q` |
| Full suite command | `cd robot && pytest tests/ && cd ../bridge && pytest tests/` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| — | mDNS browse finds bridge within timeout | unit (mock zeroconf) | `pytest bridge/tests/test_scanner.py::test_mdns_browse -x` | Wave 0 |
| — | mDNS advertise registers service with correct TXT records | unit | `pytest bridge/tests/test_mdns_advertise.py::test_advertise_txt -x` | Wave 0 |
| — | Command queue: enqueue, TTL expiry, drain | unit | `pytest bridge/tests/test_command_queue.py -x` | Wave 0 |
| — | message_id dedup: second arrival silently dropped | unit | `pytest bridge/tests/test_dedup.py::test_duplicate_dropped -x` | Wave 0 |
| — | One-time token consumed on first use, rejected on second | unit | `pytest backend/tests/robot/test_bridge_token_store.ts` (Jest) | Wave 0 |
| — | Robot direct-path failover to bridge within 5s | integration (manual) | manual | manual-only |
| — | Bridge relayed robot message reaches cloud handler | integration | `pytest bridge/tests/test_bridge_relay.py -x` | Wave 0 |
| — | SSDP scanner returns devices | unit (mock socket) | `pytest bridge/tests/test_scanner.py::test_ssdp_scan -x` | Wave 0 |
| — | Fallback to manual bridge IP when mDNS times out | unit | `pytest robot/tests/test_mdns_fallback.py -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd robot && pytest tests/ -x -q` or `cd bridge && pytest tests/ -x -q` (whichever is relevant)
- **Per wave merge:** `cd robot && pytest tests/ && cd ../bridge && pytest tests/`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `robot/pytest.ini` — pytest + pytest-asyncio config
- [ ] `robot/tests/__init__.py` — test package
- [ ] `robot/tests/test_mdns_fallback.py` — covers mDNS browse timeout + fallback
- [ ] `bridge/pytest.ini` — bridge test config
- [ ] `bridge/tests/__init__.py`
- [ ] `bridge/tests/test_command_queue.py` — covers TTL queue behavior
- [ ] `bridge/tests/test_scanner.py` — covers mDNS + SSDP scan (mocked)
- [ ] `bridge/tests/test_mdns_advertise.py` — covers bridge advertisement
- [ ] `bridge/tests/test_bridge_relay.py` — covers relay forwarding
- [ ] `bridge/tests/test_dedup.py` — covers message_id deduplication
- [ ] Framework install: `pip install pytest pytest-asyncio` — not detected in robot/requirements.txt

---

## Sources

### Primary (HIGH confidence)
- `python-zeroconf` PyPI (`zeroconf>=0.148.0`, Oct 2025) — AsyncZeroconf, AsyncServiceBrowser, async_register_service API
- `websockets` (>=12.0) — already in robot/requirements.txt; well-established
- Existing codebase: `robot/mission_client.py`, `robot/models.py`, `robot/config.py`, `robot/requirements.txt` — direct inspection
- Existing codebase: `backend/src/robot/robot-ws.ts`, `robot-mission-service.ts`, `robot-types.ts` — direct inspection
- Existing codebase: `backend/src/resources/resource-registry.ts`, `resource-did.ts`, `types.ts` — direct inspection
- Existing codebase: `backend/src/discovery/discovery-router.ts`, `discovery-store.ts`, `acceptance-gate.ts` — direct inspection

### Secondary (MEDIUM confidence)
- Docker `--network=host` required for mDNS multicast — verified via multiple Docker community sources and Medium article; consistent with zeroconf's multicast requirements
- `ssdp` PyPI library — asyncio SSDP scanner; verified via PyPI and GitHub; maintained as of 2025
- Message deduplication via UUID + server-side Set — verified via multiple distributed systems architecture sources

### Tertiary (LOW confidence)
- FastAPI version recommendation (>=0.110) — based on project's existing TypeScript REST patterns and 2024-2025 FastAPI release cadence; not verified against project package.json/pyproject.toml
- 10-second mDNS browse timeout recommendation — based on network engineering knowledge; no specific empirical source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing requirements.txt confirmed; zeroconf 0.148.0 verified on PyPI; all other libs already in project or well-established
- Architecture patterns: HIGH — based on direct codebase inspection of existing robot/ and backend/ code; patterns mirror what is already proven in the project
- Pitfalls: HIGH — Docker mDNS multicast issue is well-documented community knowledge; other pitfalls derived from direct code inspection
- Integration map: HIGH — file paths verified by direct filesystem inspection

**Research date:** 2026-03-12
**Valid until:** 2026-06-12 (stable libraries; Docker behavior for mDNS is stable; zeroconf API stable)
