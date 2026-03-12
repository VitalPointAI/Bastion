---
phase: 43
slug: robot-agent-local-discovery-bridge
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 43 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x + pytest-asyncio (Python); Jest (backend TS) |
| **Config file** | None -- Wave 0 creates `robot/pytest.ini` and `bridge/pytest.ini` |
| **Quick run command** | `cd robot && pytest tests/ -x -q` |
| **Full suite command** | `cd robot && pytest tests/ && cd ../bridge && pytest tests/` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd robot && pytest tests/ -x -q` or `cd bridge && pytest tests/ -x -q` (whichever is relevant)
- **After every plan wave:** Run `cd robot && pytest tests/ && cd ../bridge && pytest tests/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 43-01-01 | 01 | 1 | -- | unit | `pytest robot/tests/test_models.py -x` | W0 | pending |
| 43-01-02 | 01 | 1 | -- | unit | `pytest robot/tests/test_ws_protocol.py -x` | W0 | pending |
| 43-01-03 | 01 | 1 | -- | unit | `pytest robot/tests/test_mdns.py -x` | W0 | pending |
| 43-04-01 | 04 | 2 | -- | unit | `pytest bridge/tests/test_command_queue.py -x` | W0 | pending |
| 43-04-02 | 04 | 2 | -- | unit | `pytest bridge/tests/test_scanner.py -x` | W0 | pending |
| 43-04-03 | 04 | 2 | -- | unit | `pytest bridge/tests/test_bridge_relay.py -x` | W0 | pending |
| 43-04-04 | 04 | 2 | -- | unit | `pytest bridge/tests/test_mdns_advertise.py -x` | W0 | pending |
| 43-04-05 | 04 | 2 | -- | unit | `pytest bridge/tests/test_dedup.py -x` | W0 | pending |
| 43-03-01 | 03 | 1 | -- | unit | `pytest robot/tests/test_mdns_fallback.py -x` | W0 | pending |
| 43-05-01 | 05 | 2 | -- | manual | manual | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `robot/pytest.ini` -- pytest + pytest-asyncio config (Plan 01)
- [ ] `robot/tests/__init__.py` -- test package (Plan 01)
- [ ] `robot/tests/test_models.py` -- covers message models with message_id (Plan 01)
- [ ] `robot/tests/test_ws_protocol.py` -- covers stamp() behavior (Plan 01)
- [ ] `robot/tests/test_mdns.py` -- covers mDNS browse/advertise with mocked zeroconf (Plan 01)
- [ ] `robot/tests/test_mdns_fallback.py` -- covers mDNS browse timeout + fallback (Plan 03)
- [ ] `bridge/pytest.ini` -- bridge test config (Plan 04)
- [ ] `bridge/tests/__init__.py` -- bridge test package (Plan 04)
- [ ] `bridge/tests/test_command_queue.py` -- covers TTL queue behavior (Plan 04 Task 1)
- [ ] `bridge/tests/test_scanner.py` -- covers mDNS + SSDP scan, mocked (Plan 04 Task 1)
- [ ] `bridge/tests/test_bridge_relay.py` -- covers relay forwarding (Plan 04 Task 2)
- [ ] `bridge/tests/test_mdns_advertise.py` -- covers bridge mDNS advertisement (Plan 04 Task 2)
- [ ] `bridge/tests/test_dedup.py` -- covers message_id pass-through in relay (Plan 04 Task 2)
- [ ] Framework install: `pip install pytest pytest-asyncio` -- not detected in robot/requirements.txt

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Robot direct-path failover to bridge within 5s | -- | Requires real network topology with bridge running | 1. Start bridge Docker container. 2. Start robot agent with direct WS. 3. Kill direct WS endpoint. 4. Verify robot connects via bridge within 5s. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
