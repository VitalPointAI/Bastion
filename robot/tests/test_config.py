"""Tests for robot config: DID auth, bridge fallback, mDNS settings."""
import os
import importlib
import tempfile
import pytest


def _reload_config(**env_overrides):
    """Reload config module with modified env vars. Returns fresh config module.

    Patches ``dotenv.load_dotenv`` to a no-op so the on-disk ``.env`` file
    does not interfere with explicit test env var settings.
    """
    from unittest.mock import patch

    # Save originals
    saved = {}
    for key in list(env_overrides.keys()) + [
        "REGISTRATION_TOKEN", "ROBOT_DID", "DID_FILE",
        "BRIDGE_HOST", "BRIDGE_PORT", "MDNS_BROWSE_TIMEOUT_SEC", "BRIDGE_WS_URL",
        "AUTH_TOKEN", "SWARM_ENABLED", "SWARM_ROLE",
    ]:
        saved[key] = os.environ.get(key)
        if key in env_overrides:
            if env_overrides[key] is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = env_overrides[key]
        else:
            os.environ.pop(key, None)

    # Ensure BASTION_WS_URL is always set (required)
    if "BASTION_WS_URL" not in os.environ:
        os.environ["BASTION_WS_URL"] = "ws://localhost:3001"

    import dotenv
    _orig_load = dotenv.load_dotenv
    dotenv.load_dotenv = lambda *a, **kw: None
    try:
        import config
        importlib.reload(config)
    finally:
        dotenv.load_dotenv = _orig_load

    # Restore originals
    for key, val in saved.items():
        if val is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = val

    return config


class TestConfigRegistrationTokenOptional:
    """REGISTRATION_TOKEN env var is optional — no error if missing."""

    def test_config_registration_token_optional(self):
        cfg = _reload_config()
        # Should not raise even when REGISTRATION_TOKEN is absent
        assert hasattr(cfg, "REGISTRATION_TOKEN")
        assert cfg.REGISTRATION_TOKEN == ""

    def test_config_registration_token_set_when_provided(self):
        cfg = _reload_config(REGISTRATION_TOKEN="my-secret-token")
        assert cfg.REGISTRATION_TOKEN == "my-secret-token"


class TestConfigBridgeFallbackDefaults:
    """BRIDGE_HOST defaults to empty, BRIDGE_PORT defaults to 8765."""

    def test_config_bridge_host_defaults_empty(self):
        cfg = _reload_config()
        assert hasattr(cfg, "BRIDGE_HOST")
        assert cfg.BRIDGE_HOST == ""

    def test_config_bridge_port_defaults_8765(self):
        cfg = _reload_config()
        assert hasattr(cfg, "BRIDGE_PORT")
        assert cfg.BRIDGE_PORT == 8765

    def test_config_bridge_port_is_int(self):
        cfg = _reload_config()
        assert isinstance(cfg.BRIDGE_PORT, int)

    def test_config_bridge_host_set_from_env(self):
        cfg = _reload_config(BRIDGE_HOST="192.168.1.50")
        assert cfg.BRIDGE_HOST == "192.168.1.50"

    def test_config_bridge_port_set_from_env(self):
        cfg = _reload_config(BRIDGE_PORT="9000")
        assert cfg.BRIDGE_PORT == 9000


class TestConfigMdnsTimeout:
    """MDNS_BROWSE_TIMEOUT_SEC defaults to 10.0."""

    def test_config_mdns_timeout_default(self):
        cfg = _reload_config()
        assert hasattr(cfg, "MDNS_BROWSE_TIMEOUT_SEC")
        assert cfg.MDNS_BROWSE_TIMEOUT_SEC == 10.0

    def test_config_mdns_timeout_is_float(self):
        cfg = _reload_config()
        assert isinstance(cfg.MDNS_BROWSE_TIMEOUT_SEC, float)

    def test_config_mdns_timeout_set_from_env(self):
        cfg = _reload_config(MDNS_BROWSE_TIMEOUT_SEC="5.0")
        assert cfg.MDNS_BROWSE_TIMEOUT_SEC == 5.0


class TestConfigDIDFields:
    """ROBOT_DID and DID_FILE are optional config fields."""

    def test_config_robot_did_defaults_empty(self):
        cfg = _reload_config()
        assert hasattr(cfg, "ROBOT_DID")
        assert cfg.ROBOT_DID == ""

    def test_config_did_file_defaults(self):
        cfg = _reload_config()
        assert hasattr(cfg, "DID_FILE")
        assert cfg.DID_FILE == ".robot_did"


class TestConfigDIDPersistence:
    """load_persisted_did and persist_did helpers work correctly."""

    def test_load_persisted_did_returns_empty_when_no_file(self):
        cfg = _reload_config(DID_FILE="/tmp/nonexistent_robot_did_xyz")
        assert cfg.load_persisted_did() == ""

    def test_persist_did_and_load_roundtrip(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".robot_did", delete=False) as f:
            did_path = f.name
        try:
            cfg = _reload_config(DID_FILE=did_path)
            cfg.persist_did("did:bastion:test-robot-123")
            loaded = cfg.load_persisted_did()
            assert loaded == "did:bastion:test-robot-123"
        finally:
            os.unlink(did_path)
