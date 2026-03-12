"""Tests for mDNS bridge discovery and fallback behavior in mission_client."""
from __future__ import annotations

import asyncio
import os
import sys
import types
import importlib
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Stubs for heavy dependencies not installed in test env
# ---------------------------------------------------------------------------

def _stub_modules():
    """Install lightweight stubs for hardware/serial deps before importing mission_client."""
    # structlog stub
    if "structlog" not in sys.modules:
        structlog = types.ModuleType("structlog")
        structlog.get_logger = lambda name=None: MagicMock()
        structlog.configure = MagicMock()
        structlog.make_filtering_bound_logger = MagicMock(return_value=None)
        structlog.PrintLoggerFactory = MagicMock()
        sys.modules["structlog"] = structlog

    # calibration stub
    if "calibration" not in sys.modules:
        cal = types.ModuleType("calibration")
        cal.load_profile = MagicMock(return_value=MagicMock())
        sys.modules["calibration"] = cal

    # rvr_driver stub
    if "rvr_driver" not in sys.modules:
        rvr = types.ModuleType("rvr_driver")
        rvr.RVRDriver = MagicMock()
        sys.modules["rvr_driver"] = rvr

    # mission_executor stub
    if "mission_executor" not in sys.modules:
        me = types.ModuleType("mission_executor")
        me.MissionExecutor = MagicMock()
        sys.modules["mission_executor"] = me


_stub_modules()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_service_result(address: str = "192.168.1.5", port: int = 8765, relay_port: str = "8765"):
    """Create a minimal ServiceResult-like object."""
    from robot.common.mdns import ServiceResult
    return ServiceResult(
        name="bastion-bridge._bastion._tcp.local.",
        addresses=[address],
        port=port,
        properties={"relay_port": relay_port, "bridge_id": "b1"},
    )


async def _run_discover_bridge(env_overrides: dict, browse_return_value):
    """Import mission_client with given env and run discover_bridge() with mocked browse_service."""
    os.environ.setdefault("BASTION_WS_URL", "ws://cloud:3001")
    for k, v in env_overrides.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v

    import config
    importlib.reload(config)

    # Remove cached mission_client so reimport picks up new config
    sys.modules.pop("mission_client", None)

    with patch("common.mdns.browse_service", new_callable=AsyncMock) as mock_browse:
        mock_browse.return_value = browse_return_value

        import mission_client
        importlib.reload(mission_client)

        result = await mission_client.discover_bridge()

    return result


class TestMdnsFallbackOnTimeout:
    """When browse_service returns empty and BRIDGE_HOST is set, use bridge URL."""

    def test_mdns_fallback_on_timeout(self):
        env = {"BRIDGE_HOST": "192.168.1.50", "BRIDGE_PORT": "8765"}
        result = asyncio.get_event_loop().run_until_complete(
            _run_discover_bridge(env, browse_return_value=[])
        )
        assert result is not None
        assert "192.168.1.50" in result
        assert "8765" in result
        assert result.startswith("ws://")

    def test_mdns_fallback_url_contains_ws_robot_path(self):
        env = {"BRIDGE_HOST": "10.0.0.5", "BRIDGE_PORT": "9000"}
        result = asyncio.get_event_loop().run_until_complete(
            _run_discover_bridge(env, browse_return_value=[])
        )
        assert result is not None
        assert "/ws/robot" in result


class TestMdnsFallbackDirectWhenNoBridge:
    """When browse_service returns empty and no BRIDGE_HOST, return None."""

    def test_mdns_fallback_direct_when_no_bridge(self):
        env = {"BRIDGE_HOST": "", "BRIDGE_PORT": "8765"}
        result = asyncio.get_event_loop().run_until_complete(
            _run_discover_bridge(env, browse_return_value=[])
        )
        assert result is None


class TestMdnsDiscoverySuccess:
    """When browse_service returns a result, extract URL from TXT relay_port."""

    def test_mdns_discovery_returns_bridge_url(self):
        svc = _make_service_result(address="192.168.1.5", relay_port="8765")
        env = {"BRIDGE_HOST": ""}
        result = asyncio.get_event_loop().run_until_complete(
            _run_discover_bridge(env, browse_return_value=[svc])
        )
        assert result is not None
        assert result.startswith("ws://")
        assert "192.168.1.5" in result
        assert "8765" in result
