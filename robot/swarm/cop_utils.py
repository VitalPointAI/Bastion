"""
Swarm COP visualization utilities.

Provides:
  - order_polygon_hull(): sorts member positions by angle from centroid
    in counterclockwise order for non-self-intersecting polygon rendering
  - FORMATION_STATE_COLORS: hex color map for SwarmState COP visual encoding
"""
import math

# ---------------------------------------------------------------------------
# Formation state color mapping
# ---------------------------------------------------------------------------

FORMATION_STATE_COLORS: dict[str, str] = {
    "forming":    "#3b82f6",  # blue  — assembling
    "ready":      "#22c55e",  # green — in position
    "moving":     "#f59e0b",  # amber — en route
    "holding":    "#22c55e",  # green — stationary in formation (same as ready)
    "dispersing": "#6b7280",  # gray  — breaking formation
    "contact":    "#ef4444",  # red   — threat contact
}


# ---------------------------------------------------------------------------
# Polygon hull ordering
# ---------------------------------------------------------------------------

def order_polygon_hull(positions: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """
    Order member positions counterclockwise by angle from centroid.

    Sorts positions by their polar angle from the centroid, producing a
    counterclockwise ordering that avoids self-intersecting polygons when
    drawing swarm formation overlays on the COP.

    Args:
        positions: List of (x, y) or (lat, lng) tuples in any order.

    Returns:
        Same positions sorted in counterclockwise angular order from
        the centroid. Returns empty list for empty input.
    """
    if not positions:
        return []

    # Compute centroid
    cx = sum(p[0] for p in positions) / len(positions)
    cy = sum(p[1] for p in positions) / len(positions)

    # Sort by angle from centroid (counterclockwise = ascending atan2)
    def angle_from_centroid(pos: tuple[float, float]) -> float:
        return math.atan2(pos[1] - cy, pos[0] - cx)

    return sorted(positions, key=angle_from_centroid)
