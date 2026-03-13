"""
Boustrophedon sweep path planner for area coverage missions.

Generates a lawnmower (boustrophedon) pattern of waypoints that fully
covers a rectangular area. Each pass goes end-to-end, alternating
direction on each successive strip.

Used by recon_area and visual_search missions to ensure complete coverage.
"""
from __future__ import annotations

import math
from typing import Dict, List

from robot.models import Waypoint


def generate_sweep_path(
    area: Dict[str, float],
    strip_width: float = 0.3,
    direction: str = "horizontal",
) -> List[Waypoint]:
    """Generate a boustrophedon waypoint path covering a rectangular area.

    Parameters
    ----------
    area:
        Bounding box with keys: x_min, y_min, x_max, y_max (room-relative meters).
    strip_width:
        Distance between parallel sweep passes in meters (default 0.3 m).
    direction:
        "horizontal" sweeps rows in the y-axis direction (each pass goes across x).
        "vertical" sweeps columns in the x-axis direction (each pass goes across y).

    Returns
    -------
    List[Waypoint]
        Ordered list of waypoints forming a boustrophedon coverage path.
        Each strip contributes two waypoints (start and end of the pass).
    """
    x_min = float(area["x_min"])
    y_min = float(area["y_min"])
    x_max = float(area["x_max"])
    y_max = float(area["y_max"])

    waypoints: List[Waypoint] = []

    if direction == "horizontal":
        # Sweep strips along y-axis; each strip crosses x_min -> x_max or vice versa
        y_span = y_max - y_min
        if y_span <= 0 or x_max <= x_min:
            return waypoints

        # Number of strips: at least 1, covering y_min through y_max
        n_strips = max(1, math.ceil(y_span / strip_width) + 1)

        for i in range(n_strips):
            # y position of this strip
            y = y_min + i * strip_width
            y = min(y, y_max)  # clamp to y_max

            if i % 2 == 0:
                # Even pass: left to right
                waypoints.append(Waypoint(x=x_min, y=y))
                waypoints.append(Waypoint(x=x_max, y=y))
            else:
                # Odd pass: right to left (boustrophedon reversal)
                waypoints.append(Waypoint(x=x_max, y=y))
                waypoints.append(Waypoint(x=x_min, y=y))

    else:  # "vertical"
        # Sweep strips along x-axis; each strip crosses y_min -> y_max or vice versa
        x_span = x_max - x_min
        if x_span <= 0 or y_max <= y_min:
            return waypoints

        n_strips = max(1, math.ceil(x_span / strip_width) + 1)

        for i in range(n_strips):
            x = x_min + i * strip_width
            x = min(x, x_max)  # clamp to x_max

            if i % 2 == 0:
                # Even pass: bottom to top
                waypoints.append(Waypoint(x=x, y=y_min))
                waypoints.append(Waypoint(x=x, y=y_max))
            else:
                # Odd pass: top to bottom (boustrophedon reversal)
                waypoints.append(Waypoint(x=x, y=y_max))
                waypoints.append(Waypoint(x=x, y=y_min))

    return waypoints
