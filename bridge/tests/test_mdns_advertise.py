"""
Tests for bridge.mdns_advertise.advertise_bridge.

Mocks AsyncZeroconf to verify:
  - async_register_service is called with correct service type and TXT records
  - Setting the shutdown event triggers async_unregister_service
  - Browse for _bastion-robot._tcp.local. is initiated
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest


def _make_cfg(bridge_id="bridge-test", relay_port=8765, cloud_ws_url="wss://bastion.example.com"):
    cfg = MagicMock()
    cfg.BRIDGE_ID = bridge_id
    cfg.RELAY_PORT = relay_port
    cfg.CLOUD_WS_URL = cloud_ws_url
    return cfg


class TestAdvertiseBridge:
    async def test_registers_correct_service_type(self):
        """advertise_bridge calls async_register_service with _bastion._tcp.local."""
        from bridge.mdns_advertise import advertise_bridge

        shutdown = asyncio.Event()

        azc_instance = AsyncMock()
        azc_instance.async_register_service = AsyncMock()
        azc_instance.async_unregister_service = AsyncMock()

        async def fake_wait(*args, **kwargs):
            pass

        with (
            patch("bridge.mdns_advertise.AsyncZeroconf") as MockAZC,
            patch("bridge.mdns_advertise.AsyncServiceBrowser", return_value=MagicMock()),
            patch("bridge.mdns_advertise.shutdown_event_wait", side_effect=fake_wait),
        ):
            MockAZC.return_value.__aenter__ = AsyncMock(return_value=azc_instance)
            MockAZC.return_value.__aexit__ = AsyncMock(return_value=False)
            shutdown.set()

            cfg = _make_cfg()
            await advertise_bridge(cfg, shutdown)

        azc_instance.async_register_service.assert_awaited_once()
        call_args = azc_instance.async_register_service.await_args.args[0]
        assert "_bastion._tcp.local." in call_args.type

    async def test_txt_records_contain_required_fields(self):
        """TXT records include bridge_id, cloud_url, version, relay_port."""
        from bridge.mdns_advertise import advertise_bridge

        shutdown = asyncio.Event()
        shutdown.set()

        azc_instance = AsyncMock()
        azc_instance.async_register_service = AsyncMock()
        azc_instance.async_unregister_service = AsyncMock()

        with (
            patch("bridge.mdns_advertise.AsyncZeroconf") as MockAZC,
            patch("bridge.mdns_advertise.AsyncServiceBrowser", return_value=MagicMock()),
            patch("bridge.mdns_advertise.shutdown_event_wait", new_callable=AsyncMock),
        ):
            MockAZC.return_value.__aenter__ = AsyncMock(return_value=azc_instance)
            MockAZC.return_value.__aexit__ = AsyncMock(return_value=False)

            cfg = _make_cfg(bridge_id="bx-1", relay_port=8765, cloud_ws_url="wss://cloud.test")
            await advertise_bridge(cfg, shutdown)

        info = azc_instance.async_register_service.await_args.args[0]
        # properties are stored as bytes->bytes in ServiceInfo
        props = {
            k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v
            for k, v in info.properties.items()
        }
        assert props.get("bridge_id") == "bx-1"
        assert props.get("cloud_url") == "wss://cloud.test"
        assert props.get("version") == "1.0"
        assert props.get("relay_port") == "8765"

    async def test_unregisters_on_shutdown(self):
        """Shutdown event triggers async_unregister_service."""
        from bridge.mdns_advertise import advertise_bridge

        shutdown = asyncio.Event()

        azc_instance = AsyncMock()
        azc_instance.async_register_service = AsyncMock()
        azc_instance.async_unregister_service = AsyncMock()

        async def immediate_shutdown_wait(event):
            # Simulate that the event is already set
            pass

        with (
            patch("bridge.mdns_advertise.AsyncZeroconf") as MockAZC,
            patch("bridge.mdns_advertise.AsyncServiceBrowser", return_value=MagicMock()),
            patch("bridge.mdns_advertise.shutdown_event_wait", side_effect=immediate_shutdown_wait),
        ):
            MockAZC.return_value.__aenter__ = AsyncMock(return_value=azc_instance)
            MockAZC.return_value.__aexit__ = AsyncMock(return_value=False)

            cfg = _make_cfg()
            await advertise_bridge(cfg, shutdown)

        azc_instance.async_unregister_service.assert_awaited_once()

    async def test_browses_for_bastion_robot_service(self):
        """advertise_bridge initiates browse for _bastion-robot._tcp.local."""
        from bridge.mdns_advertise import advertise_bridge

        shutdown = asyncio.Event()
        shutdown.set()

        azc_instance = AsyncMock()
        azc_instance.async_register_service = AsyncMock()
        azc_instance.async_unregister_service = AsyncMock()

        browser_calls = []

        def fake_browser(azc, svc_type, listener, **kwargs):
            browser_calls.append(svc_type)
            return MagicMock()

        with (
            patch("bridge.mdns_advertise.AsyncZeroconf") as MockAZC,
            patch("bridge.mdns_advertise.AsyncServiceBrowser", side_effect=fake_browser),
            patch("bridge.mdns_advertise.shutdown_event_wait", new_callable=AsyncMock),
        ):
            MockAZC.return_value.__aenter__ = AsyncMock(return_value=azc_instance)
            MockAZC.return_value.__aexit__ = AsyncMock(return_value=False)

            cfg = _make_cfg()
            await advertise_bridge(cfg, shutdown)

        assert "_bastion-robot._tcp.local." in browser_calls
