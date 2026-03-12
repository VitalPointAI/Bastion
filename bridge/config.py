"""
Bridge service configuration.

Loads settings from environment variables (optionally from a .env file).
All optional variables have safe defaults so the bridge can start without
a fully populated .env during development.

Usage:
    from bridge.config import cfg
    print(cfg.CLOUD_WS_URL)
    print(cfg.RELAY_PORT)
"""
from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the directory containing this file (the bridge/ directory).
_env_path = Path(__file__).parent / ".env"
load_dotenv(_env_path, override=False)

logger = logging.getLogger(__name__)


class BridgeConfig:
    """Validated bridge configuration derived from environment variables."""

    # --- Required ---
    CLOUD_WS_URL: str
    BRIDGE_ID: str

    # --- Optional with defaults ---
    REGISTRATION_TOKEN: str
    BRIDGE_DID: str
    DID_FILE: str
    RELAY_PORT: int
    UI_PORT: int
    SCAN_INTERVAL_SEC: float
    SCAN_DURATION_SEC: float
    COMMAND_TTL_SEC: float
    RECONNECT_INITIAL_DELAY: float
    RECONNECT_MAX_DELAY: float
    MDNS_BROWSE_TIMEOUT_SEC: float
    ENABLE_UI: bool

    def __init__(self) -> None:
        # Required
        self.CLOUD_WS_URL = os.environ.get("CLOUD_WS_URL", "")
        self.BRIDGE_ID = os.environ.get("BRIDGE_ID", "")

        # Optional
        self.REGISTRATION_TOKEN = os.environ.get("REGISTRATION_TOKEN", "")
        self.BRIDGE_DID = os.environ.get("BRIDGE_DID", "")
        self.DID_FILE = os.environ.get("DID_FILE", ".bridge_did")
        self.RELAY_PORT = int(os.environ.get("RELAY_PORT", "8765"))
        self.UI_PORT = int(os.environ.get("UI_PORT", "8766"))
        self.SCAN_INTERVAL_SEC = float(os.environ.get("SCAN_INTERVAL_SEC", "60"))
        self.SCAN_DURATION_SEC = float(os.environ.get("SCAN_DURATION_SEC", "30"))
        self.COMMAND_TTL_SEC = float(os.environ.get("COMMAND_TTL_SEC", "300"))
        self.RECONNECT_INITIAL_DELAY = float(os.environ.get("RECONNECT_INITIAL_DELAY", "5.0"))
        self.RECONNECT_MAX_DELAY = float(os.environ.get("RECONNECT_MAX_DELAY", "60.0"))
        self.MDNS_BROWSE_TIMEOUT_SEC = float(os.environ.get("MDNS_BROWSE_TIMEOUT_SEC", "10.0"))
        self.ENABLE_UI = os.environ.get("ENABLE_UI", "false").lower() in ("true", "1", "yes")

        # Load persisted DID if the DID_FILE exists and BRIDGE_DID is not set in env
        if not self.BRIDGE_DID:
            self.BRIDGE_DID = self.load_persisted_did()

    def load_persisted_did(self) -> str:
        """Read the persisted DID from DID_FILE. Returns empty string if not present."""
        did_path = Path(self.DID_FILE)
        if did_path.exists():
            content = did_path.read_text(encoding="utf-8").strip()
            if content:
                logger.info("Loaded persisted DID from %s", self.DID_FILE)
                return content
        return ""

    def persist_did(self, did: str) -> None:
        """Write *did* to DID_FILE for persistence across restarts."""
        did_path = Path(self.DID_FILE)
        did_path.write_text(did.strip(), encoding="utf-8")
        self.BRIDGE_DID = did
        logger.info("Persisted DID to %s", self.DID_FILE)


# Module-level shutdown event — set by signal handlers to trigger graceful shutdown.
shutdown = asyncio.Event()

# Singleton config instance (importable as `from bridge.config import cfg`).
cfg = BridgeConfig()
