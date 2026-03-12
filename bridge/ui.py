"""
FastAPI web UI dashboard for the Bastion local discovery bridge.

Provides a browser-accessible status dashboard and JSON API endpoints
for monitoring bridge operations in real time.

UI is optional — only started when --ui flag or ENABLE_UI=true is set.

Usage (from bridge_main.py):
    from bridge.ui import set_state, start_ui
    set_state(relay=relay, queue=queue, scanner_state=scanner_state, cloud_state=cloud_state)
    asyncio.create_task(start_ui(port=8766))
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level shared state (set by bridge_main.py via set_state())
# ---------------------------------------------------------------------------

_relay = None          # bridge.bridge_relay.RobotRelay
_queue = None          # bridge.command_queue.CommandQueue
_scanner_state: Dict[str, Any] = {
    "last_scan_ts": None,
    "devices": [],
}
_cloud_state: Dict[str, Any] = {
    "connected": False,
    "last_heartbeat": None,
    "bridge_id": "",
    "bridge_did": "",
    "messages_forwarded": 0,
}


def set_state(
    relay=None,
    queue=None,
    scanner_state: Optional[Dict[str, Any]] = None,
    cloud_state: Optional[Dict[str, Any]] = None,
) -> None:
    """Wire shared state objects from bridge_main.py into the UI module.

    Must be called before start_ui().

    Args:
        relay: RobotRelay instance (for connected robot info).
        queue: CommandQueue instance (for queue depth per robot).
        scanner_state: Mutable dict updated by the scanner loop with keys:
            - last_scan_ts (float | None): UNIX epoch of last scan
            - devices (list[dict]): list of discovered devices
        cloud_state: Mutable dict updated by bridge_ws with keys:
            - connected (bool): cloud WS connection state
            - last_heartbeat (float | None): UNIX epoch of last heartbeat
            - bridge_id (str): configured bridge ID
            - bridge_did (str): bridge DID
            - messages_forwarded (int): total relay messages sent to cloud
    """
    global _relay, _queue, _scanner_state, _cloud_state
    if relay is not None:
        _relay = relay
    if queue is not None:
        _queue = queue
    if scanner_state is not None:
        _scanner_state = scanner_state
    if cloud_state is not None:
        _cloud_state = cloud_state


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(title="Bastion Bridge Dashboard", version="1.0.0")


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _format_ts(ts: Optional[float]) -> str:
    """Format a UNIX timestamp to a human-readable UTC string, or 'never'."""
    if ts is None:
        return "never"
    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M:%S UTC")


def _get_robots_data() -> List[Dict[str, Any]]:
    """Return list of connected robot info dicts."""
    if _relay is None:
        return []
    robots = []
    # RobotRelay tracks connected robots in _connected_robots dict
    connected = getattr(_relay, "_connected_robots", {})
    for robot_id, ws in connected.items():
        robots.append({
            "robot_id": robot_id,
            "connected": True,
            "last_heartbeat": _format_ts(None),
            "queued_commands": _queue.size(robot_id) if _queue is not None else 0,
        })
    return robots


def _get_queue_data() -> Dict[str, int]:
    """Return per-robot queue depths."""
    if _queue is None:
        return {}
    queues = getattr(_queue, "_queues", {})
    return {robot_id: len(cmds) for robot_id, cmds in queues.items()}


def _get_devices_data() -> List[Dict[str, Any]]:
    """Return last scan device list, formatted for display."""
    devices = []
    for dev in _scanner_state.get("devices", []):
        raw = dev.get("raw_data", {})
        devices.append({
            "name": raw.get("name", raw.get("friendly_name", "unknown")),
            "address": raw.get("address", raw.get("host", "unknown")),
            "port": raw.get("port", "-"),
            "service_type": raw.get("type", dev.get("raw_identifier", "unknown")),
            "last_seen": _format_ts(_scanner_state.get("last_scan_ts")),
        })
    return devices


def _get_status_data() -> Dict[str, Any]:
    """Aggregate all status data into one dict."""
    robots = _get_robots_data()
    devices = _get_devices_data()
    queue_data = _get_queue_data()
    total_queue_depth = sum(queue_data.values())

    return {
        "cloud": {
            "connected": _cloud_state.get("connected", False),
            "last_heartbeat": _format_ts(_cloud_state.get("last_heartbeat")),
            "bridge_id": _cloud_state.get("bridge_id", ""),
            "bridge_did": _cloud_state.get("bridge_did", ""),
            "messages_forwarded": _cloud_state.get("messages_forwarded", 0),
        },
        "robots": robots,
        "robots_connected": len(robots),
        "devices": devices,
        "devices_found": len(devices),
        "last_scan": _format_ts(_scanner_state.get("last_scan_ts")),
        "queue": queue_data,
        "total_queue_depth": total_queue_depth,
        "server_time": _format_ts(time.time()),
    }


# ---------------------------------------------------------------------------
# HTML Dashboard template
# ---------------------------------------------------------------------------

_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="5">
  <title>Bastion Bridge Dashboard</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: 'Courier New', monospace;
      background: #0d1117;
      color: #c9d1d9;
      padding: 20px;
    }}
    h1 {{
      color: #58a6ff;
      font-size: 1.4rem;
      margin-bottom: 4px;
    }}
    .subtitle {{
      color: #8b949e;
      font-size: 0.8rem;
      margin-bottom: 20px;
    }}
    .cards {{
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }}
    .card {{
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 14px 20px;
      min-width: 160px;
      flex: 1;
    }}
    .card-label {{
      color: #8b949e;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }}
    .card-value {{
      font-size: 1.8rem;
      font-weight: bold;
      color: #f0f6fc;
    }}
    .card-value.green {{ color: #3fb950; }}
    .card-value.red {{ color: #f85149; }}
    .dot {{
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 6px;
    }}
    .dot.green {{ background: #3fb950; }}
    .dot.red {{ background: #f85149; }}
    .section {{
      margin-bottom: 24px;
    }}
    h2 {{
      color: #58a6ff;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 10px;
      padding-bottom: 4px;
      border-bottom: 1px solid #30363d;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }}
    th {{
      text-align: left;
      color: #8b949e;
      font-weight: normal;
      padding: 6px 10px;
      border-bottom: 1px solid #30363d;
    }}
    td {{
      padding: 6px 10px;
      border-bottom: 1px solid #21262d;
    }}
    tr:last-child td {{
      border-bottom: none;
    }}
    .empty {{
      color: #8b949e;
      font-style: italic;
      padding: 10px;
      font-size: 0.85rem;
    }}
    .meta {{
      color: #8b949e;
      font-size: 0.75rem;
      margin-top: 10px;
    }}
    .info-row {{
      display: flex;
      gap: 30px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }}
    .info-item label {{
      color: #8b949e;
      font-size: 0.75rem;
      display: block;
    }}
    .info-item span {{
      font-size: 0.85rem;
      color: #c9d1d9;
    }}
  </style>
</head>
<body>
  <h1>Bastion Bridge Dashboard</h1>
  <div class="subtitle">Auto-refreshes every 5 seconds &mdash; Server time: {server_time}</div>

  <!-- Status cards -->
  <div class="cards">
    <div class="card">
      <div class="card-label">Cloud</div>
      <div class="card-value">
        <span class="dot {cloud_dot}"></span>
        <span class="{cloud_color}">{cloud_status}</span>
      </div>
    </div>
    <div class="card">
      <div class="card-label">Robots Connected</div>
      <div class="card-value">{robots_connected}</div>
    </div>
    <div class="card">
      <div class="card-label">Devices Found</div>
      <div class="card-value">{devices_found}</div>
    </div>
    <div class="card">
      <div class="card-label">Queue Depth</div>
      <div class="card-value">{total_queue_depth}</div>
    </div>
  </div>

  <!-- Bridge Info -->
  <div class="section">
    <h2>Bridge Info</h2>
    <div class="info-row">
      <div class="info-item">
        <label>Bridge ID</label>
        <span>{bridge_id}</span>
      </div>
      <div class="info-item">
        <label>Bridge DID</label>
        <span>{bridge_did}</span>
      </div>
      <div class="info-item">
        <label>Last Heartbeat</label>
        <span>{last_heartbeat}</span>
      </div>
      <div class="info-item">
        <label>Messages Forwarded</label>
        <span>{messages_forwarded}</span>
      </div>
      <div class="info-item">
        <label>Last Scan</label>
        <span>{last_scan}</span>
      </div>
    </div>
  </div>

  <!-- Robots table -->
  <div class="section">
    <h2>Connected Robots</h2>
    {robots_table}
  </div>

  <!-- Devices table -->
  <div class="section">
    <h2>Discovered Devices</h2>
    {devices_table}
  </div>
</body>
</html>"""


def _build_robots_table(robots: List[Dict[str, Any]]) -> str:
    if not robots:
        return '<div class="empty">No robots currently connected.</div>'
    rows = ""
    for r in robots:
        rows += f"""
      <tr>
        <td>{r['robot_id']}</td>
        <td><span class="dot green"></span>Connected</td>
        <td>{r['last_heartbeat']}</td>
        <td>{r['queued_commands']}</td>
      </tr>"""
    return f"""<table>
      <thead>
        <tr>
          <th>Robot ID</th>
          <th>Connection</th>
          <th>Last Heartbeat</th>
          <th>Queued Commands</th>
        </tr>
      </thead>
      <tbody>{rows}
      </tbody>
    </table>"""


def _build_devices_table(devices: List[Dict[str, Any]]) -> str:
    if not devices:
        return '<div class="empty">No devices discovered yet. Scan may be in progress.</div>'
    rows = ""
    for d in devices:
        rows += f"""
      <tr>
        <td>{d['name']}</td>
        <td>{d['address']}</td>
        <td>{d['port']}</td>
        <td>{d['service_type']}</td>
        <td>{d['last_seen']}</td>
      </tr>"""
    return f"""<table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Address</th>
          <th>Port</th>
          <th>Service Type</th>
          <th>Last Seen</th>
        </tr>
      </thead>
      <tbody>{rows}
      </tbody>
    </table>"""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def dashboard() -> HTMLResponse:
    """Render the HTML status dashboard."""
    data = _get_status_data()
    cloud_connected = data["cloud"]["connected"]

    html = _HTML_TEMPLATE.format(
        server_time=data["server_time"],
        cloud_dot="green" if cloud_connected else "red",
        cloud_color="green" if cloud_connected else "red",
        cloud_status="Connected" if cloud_connected else "Disconnected",
        robots_connected=data["robots_connected"],
        devices_found=data["devices_found"],
        total_queue_depth=data["total_queue_depth"],
        bridge_id=data["cloud"]["bridge_id"] or "not set",
        bridge_did=data["cloud"]["bridge_did"] or "not assigned",
        last_heartbeat=data["cloud"]["last_heartbeat"],
        messages_forwarded=data["cloud"]["messages_forwarded"],
        last_scan=data["last_scan"],
        robots_table=_build_robots_table(data["robots"]),
        devices_table=_build_devices_table(data["devices"]),
    )
    return HTMLResponse(content=html)


@app.get("/api/status")
async def api_status() -> JSONResponse:
    """Return full dashboard status as JSON."""
    return JSONResponse(content=_get_status_data())


@app.get("/api/devices")
async def api_devices() -> JSONResponse:
    """Return the last scan device list as JSON."""
    return JSONResponse(content=_get_devices_data())


@app.get("/api/robots")
async def api_robots() -> JSONResponse:
    """Return connected robot list as JSON."""
    return JSONResponse(content=_get_robots_data())


@app.get("/api/queue")
async def api_queue() -> JSONResponse:
    """Return per-robot command queue depths as JSON."""
    return JSONResponse(content=_get_queue_data())


# ---------------------------------------------------------------------------
# Server startup helper (called from bridge_main.py)
# ---------------------------------------------------------------------------

async def start_ui(port: int = 8766) -> None:
    """Start the FastAPI dashboard with uvicorn, integrated with the current event loop.

    Args:
        port: TCP port to listen on. Defaults to 8766 (cfg.UI_PORT default).
    """
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=port,
        log_level="warning",
        access_log=False,
    )
    server = uvicorn.Server(config)
    logger.info("ui: starting dashboard on http://0.0.0.0:%d", port)
    await server.serve()
