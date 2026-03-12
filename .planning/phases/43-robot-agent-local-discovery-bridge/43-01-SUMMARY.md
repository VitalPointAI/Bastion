---
phase: 43-robot-agent-local-discovery-bridge
plan: "01"
subsystem: robot-common
tags: [python, robot, mdns, websocket, pydantic, tdd]
dependency_graph:
  requires: []
  provides: [robot.common.models, robot.common.ws_protocol, robot.common.mdns]
  affects: [robot-agent-plan-03, bridge-plan-04]
tech_stack:
  added: [zeroconf>=0.148.0, pytest>=8.0, pytest-asyncio>=0.23]
  patterns: [TDD red-green, AsyncZeroconf context manager, UUID v4 dedup stamping]
key_files:
  created:
    - robot/common/__init__.py
    - robot/common/models.py
    - robot/common/ws_protocol.py
    - robot/common/mdns.py
    - robot/conftest.py
    - robot/pytest.ini
    - robot/tests/__init__.py
    - robot/tests/test_models.py
    - robot/tests/test_ws_protocol.py
    - robot/tests/test_mdns.py
  modified:
    - robot/requirements.txt
decisions:
  - "browse_service uses asyncio.sleep(timeout) then batch-fetches info for discovered names — avoids asyncio.ensure_future race with async context manager teardown"
  - "conftest.py adds project root to sys.path — no pyproject.toml/setup.py needed for test discovery"
  - "mdns.py patches asyncio.sleep in tests for speed — real implementation sleeps full timeout"
  - "models.py redefines StateUpdateMsg/TelemetryMsg/RegisterMsg with message_id rather than subclassing — avoids Pydantic multiple inheritance complexity"
metrics:
  duration_seconds: 235
  completed_date: "2026-03-12"
  tasks_completed: 1
  files_created: 10
  files_modified: 1
requirements_satisfied: [BRIDGE-02, BRIDGE-03, BRIDGE-05]
---

# Phase 43 Plan 01: robot.common Shared Package Summary

**One-liner:** robot.common Python package with Pydantic message models (message_id dedup), UUID v4 stamp helpers, and async mDNS browse/advertise via AsyncZeroconf — 20 tests green.

## What Was Built

The `robot/common/` shared package provides the protocol foundation for both the robot agent (plan 03) and the local discovery bridge (plan 04). Built test-first (TDD).

### Files Created

**`robot/common/__init__.py`**
Package init that re-exports all key symbols from submodules so consumers can do a single `from robot.common import stamp, browse_service, StateUpdateMsg`.

**`robot/common/models.py`**
Extended message models with `message_id: Optional[str] = None` on all outbound types:
- `StateUpdateMsg`, `TelemetryMsg`, `RegisterMsg` — extended versions of base models
- `BridgeRegisterMsg` — bridge-to-cloud registration (type="bridge:register")
- `BridgeDiscoveryReportMsg` — LAN scan results relay (type="bridge:discovery_report")

**`robot/common/ws_protocol.py`**
- `stamp(msg: dict) -> dict` — injects UUID v4 `message_id` if absent; never mutates input
- `send_stamped(ws, msg: dict) -> None` — async helper that stamps then JSON-encodes and sends

**`robot/common/mdns.py`**
- `browse_service(service_type, timeout) -> List[ServiceResult]` — discovers services using AsyncZeroconf + AsyncServiceBrowser, waits for timeout, returns discovered list
- `advertise_service(service_type, name, port, properties, shutdown_event)` — registers via AsyncZeroconf, awaits shutdown event, unregisters cleanly
- `get_local_ip() -> str` — returns first non-loopback IPv4 via UDP socket trick
- `ServiceResult` dataclass with name, addresses, port, properties fields

**`robot/pytest.ini`**
asyncio_mode=auto — all async tests run without explicit event loop management.

**`robot/conftest.py`**
Adds project root to sys.path for `import robot` to resolve when running `pytest` from within `robot/` directory.

**`robot/tests/`**
- `test_models.py` — 8 tests verifying message_id field presence and acceptance on all model types
- `test_ws_protocol.py` — 7 tests covering stamp() injection, preservation, non-mutation, UUID v4 format; plus send_stamped() async coverage
- `test_mdns.py` — 4 tests for browse (found/timeout/empty) and advertise (register/unregister) with mocked AsyncZeroconf

## Test Results

```
20 passed in 0.16s
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] asyncio.ensure_future race with async context manager**
- **Found during:** Task 1 GREEN phase (test_mdns_browse_returns_info)
- **Issue:** Original implementation used `asyncio.ensure_future(_fetch_info(...))` inside the `_Listener.add_service` callback. The futures scheduled via `ensure_future` ran after the `async with AsyncZeroconf()` block closed, so `async_get_service_info` was called on a closed zeroconf instance and results were always empty.
- **Fix:** Changed implementation to collect pending service names synchronously in the listener, then batch-fetch `async_get_service_info` after the sleep, inside the still-open `async with` block.
- **Files modified:** robot/common/mdns.py
- **Commit:** 0bdd77c

**2. [Rule 3 - Blocking] AsyncServiceBrowser mock type mismatch**
- **Found during:** Task 1 GREEN phase (test failure)
- **Issue:** Initial test used `async def fake_browse_factory` as `side_effect` for `AsyncServiceBrowser`. But `AsyncServiceBrowser` is a synchronous constructor, not a coroutine. Python treated the test's side_effect as a coroutine object (never awaited), causing the listener's `add_service` to never be called.
- **Fix:** Changed test mock to a regular `def fake_browser_constructor` that calls `listener.add_service()` synchronously and returns a MagicMock. Also added `patch("robot.common.mdns.asyncio.sleep")` to make browse tests fast.
- **Files modified:** robot/tests/test_mdns.py
- **Commit:** 0bdd77c

**3. [Rule 3 - Blocking] No sys.path configuration for test imports**
- **Found during:** Task 1 GREEN phase (ModuleNotFoundError: No module named 'robot')
- **Issue:** Running `python3 -m pytest` from `robot/` directory meant `import robot` resolved to the `robot/` package itself, not the `robot` package at the project root. There was no pyproject.toml or setup.py to install the package.
- **Fix:** Created `robot/conftest.py` that inserts the project root into `sys.path` before any test imports run.
- **Files modified:** robot/conftest.py (created)
- **Commit:** 0bdd77c

## Self-Check: PASSED

All 11 key files found on disk. Both commits (efa4f1f, 0bdd77c) verified in git log. All 20 tests pass.
