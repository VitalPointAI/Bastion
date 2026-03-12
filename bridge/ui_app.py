"""
Compatibility adapter — wires bridge_main.py's create_app(relay, queue) pattern
to the ui.py module that owns the FastAPI app and shared state.

bridge_main.py usage:
    from bridge.ui_app import create_app
    app = create_app(relay, queue)
    config = uvicorn.Config(app, host="0.0.0.0", port=cfg.UI_PORT, ...)
    server = uvicorn.Server(config)
    tasks.append(asyncio.create_task(server.serve(), name="ui-server"))
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from bridge.bridge_relay import RobotRelay
    from bridge.command_queue import CommandQueue

from fastapi import FastAPI


def create_app(relay: "RobotRelay", queue: "CommandQueue") -> FastAPI:
    """Configure the ui module with shared state and return the FastAPI app.

    Args:
        relay: RobotRelay instance tracking connected robots.
        queue: CommandQueue instance for queue depth info.

    Returns:
        Configured FastAPI application instance.
    """
    from bridge.ui import app, set_state

    set_state(relay=relay, queue=queue)
    return app
