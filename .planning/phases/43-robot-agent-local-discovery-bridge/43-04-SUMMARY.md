---
phase: 43-robot-agent-local-discovery-bridge
plan: "04"
subsystem: bridge
tags: [python, bridge, mdns, ssdp, websocket, command-queue, tdd, asyncio]
dependency_graph:
  requires: [43-01]
  provides: [bridge.bridge_main, bridge.bridge_ws, bridge.bridge_relay, bridge.scanner, bridge.command_queue, bridge.mdns_advertise, bridge.config]
  affects: [robot-agent-plan-03, bridge-plan-05, bridge-plan-06]
tech_stack:
  added: [websockets>=12.0, ssdp>=1.0, fastapi>=0.110, uvicorn>=0.29, structlog>=23.0]
  patterns: [TDD red-green, asyncio task fan-out, exponential backoff reconnect, message_id pass-through (no re-stamp), TTL command queue drain-on-connect]
key_files:
  created:
    - bridge/__init__.py
    - bridge/config.py
    - bridge/command_queue.py
    - bridge/scanner.py
    - bridge/bridge_ws.py
    - bridge/bridge_relay.py
    - bridge/mdns_advertise.py
    - bridge/bridge_main.py
    - bridge/requirements.txt
    - bridge/.env.example
    - bridge/pytest.ini
    - bridge/conftest.py
    - bridge/tests/__init__.py
    - bridge/tests/test_command_queue.py
    - bridge/tests/test_scanner.py
    - bridge/tests/test_bridge_relay.py
    - bridge/tests/test_mdns_advertise.py
    - bridge/tests/test_dedup.py
  modified: []
decisions:
  - "bridge/_relay_robot_message preserves original message_id (may be None) — never re-stamps — so cloud dedup logic receives the robot's own UUID rather than a bridge-generated one"
  - "conftest.py adds project root to sys.path (same pattern as robot/conftest.py) — no pyproject.toml needed"
  - "shutdown_event_wait extracted as a thin coroutine wrapper in mdns_advertise.py to allow patch-based test isolation without touching asyncio.Event"
  - "ServiceInfo.type (not .type_) is the correct attribute — zeroconf API uses .type"
  - "test_bridge_relay uses custom _AsyncIterWS class for async for iteration — MagicMock.__aiter__ with sync iter() does not satisfy async for protocol"
metrics:
  duration_seconds: 408
  completed_date: "2026-03-12"
  tasks_completed: 2
  files_created: 18
  files_modified: 0
requirements_satisfied: [BRIDGE-01, BRIDGE-02, BRIDGE-03, BRIDGE-04]
---

# Phase 43 Plan 04: Bridge Service Summary

**One-liner:** Complete bridge Python asyncio service — LAN scanner (mDNS+SSDP), cloud WebSocket uplink with DID registration, local robot relay with TTL command queue, mDNS advertisement — 32 tests green.

## What Was Built

The `bridge/` directory is a standalone Python asyncio application that extends Bastion's reach to the local network. It connects outbound to the cloud, scans the LAN, relays robot traffic, and queues commands for offline robots.

### Architecture

```
bridge_main.py          (entry point, asyncio task fan-out)
  ├── bridge_ws.py      (cloud uplink: register, scan report, receive commands)
  ├── bridge_relay.py   (local WS server: accept robots, proxy to cloud)
  ├── mdns_advertise.py (advertise _bastion._tcp.local, browse for robots)
  ├── command_queue.py  (per-robot TTL queue, drain on robot connect)
  └── scanner.py        (MDNSScanner + SSDPScanner, normalized discovery schema)
      config.py         (env-driven BridgeConfig, DID persistence)
```

### Files Created

**`bridge/config.py`**
Env-driven `BridgeConfig` class. Loads from `.env`. Required: `CLOUD_WS_URL`, `BRIDGE_ID`. Optional: `RELAY_PORT` (8765), `SCAN_INTERVAL_SEC` (60), `COMMAND_TTL_SEC` (300), `RECONNECT_INITIAL_DELAY` (5), etc. `load_persisted_did()` / `persist_did(did)` for DID lifecycle.

**`bridge/command_queue.py`**
`CommandQueue` with `enqueue(robot_id, cmd)`, `drain(robot_id) -> List[dict]` (pops all live, discards expired), `cleanup() -> int` (background sweep), `async cleanup_loop(interval_sec, shutdown)`. Uses `QueuedCommand` dataclass with `ttl_expires_at` epoch float.

**`bridge/scanner.py`**
`MDNSScanner.scan(duration_sec)` — browses 18 common mDNS service types concurrently via AsyncZeroconf + AsyncServiceBrowser. `SSDPScanner.scan(timeout_sec)` — ssdp M-SEARCH for "ssdp:all". Both normalize to `{transport_type, raw_identifier, raw_data, origin}`. `run_full_scan()` merges both and deduplicates by `raw_identifier`.

**`bridge/bridge_ws.py`**
`bridge_cloud_loop(cfg, relay, scanner_run, queue)` — connects to `{CLOUD_WS_URL}/ws/bridge`, sends `bridge:register` (DID or token), persists received DID, then runs `_receive_loop` (routes `mission:assign` to robot or enqueues) and `_scan_report_loop` (sends `bridge:discovery_report` every SCAN_INTERVAL_SEC) concurrently. Exponential backoff on disconnect. `_relay_robot_message(ws, robot_msg, bridge_id)` — wraps in `bridge:robot_relay` envelope, preserves original `message_id` (may be None).

**`bridge/bridge_relay.py`**
`RobotRelay` class with `_connected_robots` dict, `is_robot_connected(robot_id)`, `send_to_robot(robot_id, msg)`. `_handle_robot_connection(robot_ws, queue)` — on `robot:register`, drains queue and delivers commands; forwards all messages to cloud via `_relay_robot_message`. `robot_relay_server(cfg, relay, queue, shutdown)` — websockets.serve() wrapper.

**`bridge/mdns_advertise.py`**
`advertise_bridge(cfg, shutdown)` — registers `{BRIDGE_ID}._bastion._tcp.local.` with TXT records (bridge_id, cloud_url, version, relay_port), starts browse for `_bastion-robot._tcp.local.`, unregisters on shutdown. `shutdown_event_wait(event)` extracted as thin coroutine for testability.

**`bridge/bridge_main.py`**
`async main()` — validates config, creates `CommandQueue` + `RobotRelay`, wires SIGINT/SIGTERM to shutdown event, spawns asyncio tasks for cloud uplink, robot relay, mDNS advertise, queue cleanup (and optional UI). `argparse` `--ui` flag. `asyncio.run(main())` at bottom.

**`bridge/requirements.txt`**
zeroconf, websockets, pydantic, python-dotenv, structlog, fastapi, uvicorn, ssdp, pytest, pytest-asyncio.

**Tests (18 test functions across 5 files):**
- `test_command_queue.py` — 12 tests: enqueue order, TTL expiry, drain clears, cleanup, cleanup_loop
- `test_scanner.py` — 7 tests: MDNSScanner returns normalized dicts, SSDPScanner returns normalized dicts, run_full_scan merges and deduplicates
- `test_bridge_relay.py` — 7 tests: is_robot_connected, send_to_robot, queue drain on connect, message forwarding, disconnect cleanup
- `test_mdns_advertise.py` — 4 tests: correct service type, TXT records, unregister on shutdown, robot browser initiated
- `test_dedup.py` — 4 tests: message_id preserved, None passed through, no new stamp injected, bridge_id included

## Test Results

```
32 passed in 0.49s
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ServiceInfo.type vs .type_ attribute**
- **Found during:** Task 2, test_mdns_advertise.py GREEN phase
- **Issue:** Test asserted `call_args.type_` but zeroconf `ServiceInfo` exposes `.type` (no underscore).
- **Fix:** Changed test assertion to `call_args.type`.
- **Files modified:** bridge/tests/test_mdns_advertise.py
- **Commit:** 5dce99f

**2. [Rule 3 - Blocking] MagicMock.__aiter__ incompatible with async for protocol**
- **Found during:** Task 2, test_bridge_relay.py RED phase
- **Issue:** `_make_ws` set `ws.__aiter__ = MagicMock(return_value=iter(messages))`. Python's `async for` calls `__aiter__()` then `__anext__()`. A sync iterator does not satisfy the async iterator protocol, so `_handle_robot_connection`'s `async for raw in robot_ws` consumed no messages.
- **Fix:** Replaced `_make_ws` helper with `_AsyncIterWS` class that properly implements `__aiter__` and `async def __anext__`.
- **Files modified:** bridge/tests/test_bridge_relay.py
- **Commit:** 5dce99f

**3. [Rule 2 - Missing Critical] conftest.py for bridge/ test discovery**
- **Found during:** Task 1 RED phase (ModuleNotFoundError: No module named 'bridge.command_queue')
- **Issue:** Same sys.path issue as plan 01 — running pytest from bridge/ directory doesn't resolve `import bridge.*` without the project root on sys.path.
- **Fix:** Created `bridge/conftest.py` that inserts project root into sys.path (same pattern as robot/conftest.py).
- **Files modified:** bridge/conftest.py (created)
- **Commit:** b164ea0

## Self-Check: PASSED
