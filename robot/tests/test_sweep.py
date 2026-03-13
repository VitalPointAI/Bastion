"""Tests for robot/sweep/path_planner.py: boustrophedon sweep path generation."""
import pytest


AREA_5x5 = {"x_min": 0.0, "y_min": 0.0, "x_max": 5.0, "y_max": 5.0}
AREA_3x10 = {"x_min": 1.0, "y_min": 2.0, "x_max": 4.0, "y_max": 12.0}


class TestSweepGeneratesWaypoints:
    """generate_sweep_path returns non-empty waypoint list for valid areas."""

    def test_sweep_generates_waypoints(self):
        """5x5 area with strip_width=1.0 generates a non-empty waypoint list."""
        from robot.sweep.path_planner import generate_sweep_path
        waypoints = generate_sweep_path(AREA_5x5, strip_width=1.0)
        assert len(waypoints) > 0

    def test_sweep_returns_waypoint_objects(self):
        """generate_sweep_path returns Waypoint objects."""
        from robot.sweep.path_planner import generate_sweep_path
        from robot.models import Waypoint
        waypoints = generate_sweep_path(AREA_5x5, strip_width=1.0)
        for wp in waypoints:
            assert isinstance(wp, Waypoint)
            assert isinstance(wp.x, float)
            assert isinstance(wp.y, float)


class TestSweepFullCoverage:
    """Sweep path waypoints stay within area bounds and cover full area."""

    def test_sweep_waypoints_within_bounds(self):
        """All waypoints are within area bounds."""
        from robot.sweep.path_planner import generate_sweep_path
        area = AREA_5x5
        waypoints = generate_sweep_path(area, strip_width=1.0)
        for wp in waypoints:
            assert area["x_min"] <= wp.x <= area["x_max"], f"x={wp.x} out of bounds"
            assert area["y_min"] <= wp.y <= area["y_max"], f"y={wp.y} out of bounds"

    def test_sweep_first_waypoint_at_y_min(self):
        """First waypoint is at y_min (start of horizontal sweep)."""
        from robot.sweep.path_planner import generate_sweep_path
        waypoints = generate_sweep_path(AREA_5x5, strip_width=1.0)
        assert waypoints[0].y == pytest.approx(AREA_5x5["y_min"])

    def test_sweep_last_row_reaches_y_max(self):
        """Last waypoint row is at or near y_max."""
        from robot.sweep.path_planner import generate_sweep_path
        waypoints = generate_sweep_path(AREA_5x5, strip_width=1.0)
        last_y = waypoints[-1].y
        assert last_y == pytest.approx(AREA_5x5["y_max"])

    def test_sweep_non_square_area(self):
        """Non-square area generates correct waypoints."""
        from robot.sweep.path_planner import generate_sweep_path
        waypoints = generate_sweep_path(AREA_3x10, strip_width=1.0)
        assert len(waypoints) > 0
        for wp in waypoints:
            assert AREA_3x10["x_min"] <= wp.x <= AREA_3x10["x_max"]
            assert AREA_3x10["y_min"] <= wp.y <= AREA_3x10["y_max"]


class TestSweepAlternatesDirection:
    """Sweep path alternates left-to-right and right-to-left (boustrophedon)."""

    def test_sweep_alternates_direction(self):
        """Even rows go x_min->x_max, odd rows go x_max->x_min."""
        from robot.sweep.path_planner import generate_sweep_path
        area = {"x_min": 0.0, "y_min": 0.0, "x_max": 4.0, "y_max": 4.0}
        # 4 strips, each has start and end waypoint
        waypoints = generate_sweep_path(area, strip_width=1.0)
        # Group by y value (each row has 2 waypoints: start and end)
        rows: dict = {}
        for wp in waypoints:
            key = round(wp.y, 6)
            if key not in rows:
                rows[key] = []
            rows[key].append(wp.x)
        sorted_ys = sorted(rows.keys())
        for i, y in enumerate(sorted_ys):
            xs = rows[y]
            if len(xs) >= 2:
                if i % 2 == 0:
                    # Even row: x should go from x_min to x_max (ascending)
                    assert xs[0] <= xs[-1], f"Row {i} at y={y}: expected ascending x, got {xs}"
                else:
                    # Odd row: x should go from x_max to x_min (descending)
                    assert xs[0] >= xs[-1], f"Row {i} at y={y}: expected descending x, got {xs}"


class TestSweepStripWidth:
    """Strip width controls the number of passes (more passes = more waypoints)."""

    def test_sweep_strip_width_controls_passes(self):
        """Smaller strip_width produces more waypoints."""
        from robot.sweep.path_planner import generate_sweep_path
        narrow = generate_sweep_path(AREA_5x5, strip_width=0.5)
        wide = generate_sweep_path(AREA_5x5, strip_width=1.0)
        assert len(narrow) > len(wide)

    def test_sweep_single_strip(self):
        """Area where only one strip fits still produces waypoints."""
        from robot.sweep.path_planner import generate_sweep_path
        # y span = 0.5, strip_width = 1.0 => only one strip
        area = {"x_min": 0.0, "y_min": 0.0, "x_max": 5.0, "y_max": 0.5}
        waypoints = generate_sweep_path(area, strip_width=1.0)
        assert len(waypoints) > 0


class TestSweepVerticalDirection:
    """generate_sweep_path supports vertical direction (sweeps in x)."""

    def test_sweep_vertical_direction(self):
        """direction='vertical' generates waypoints sweeping in x instead of y."""
        from robot.sweep.path_planner import generate_sweep_path
        waypoints = generate_sweep_path(AREA_5x5, strip_width=1.0, direction="vertical")
        assert len(waypoints) > 0

    def test_sweep_vertical_first_waypoint_at_x_min(self):
        """Vertical sweep first waypoint is at x_min."""
        from robot.sweep.path_planner import generate_sweep_path
        waypoints = generate_sweep_path(AREA_5x5, strip_width=1.0, direction="vertical")
        assert waypoints[0].x == pytest.approx(AREA_5x5["x_min"])

    def test_sweep_vertical_last_column_at_x_max(self):
        """Vertical sweep last waypoint column reaches x_max."""
        from robot.sweep.path_planner import generate_sweep_path
        waypoints = generate_sweep_path(AREA_5x5, strip_width=1.0, direction="vertical")
        last_x = waypoints[-1].x
        assert last_x == pytest.approx(AREA_5x5["x_max"])

    def test_sweep_vertical_waypoints_within_bounds(self):
        """Vertical sweep waypoints stay within area bounds."""
        from robot.sweep.path_planner import generate_sweep_path
        area = AREA_5x5
        waypoints = generate_sweep_path(area, strip_width=1.0, direction="vertical")
        for wp in waypoints:
            assert area["x_min"] <= wp.x <= area["x_max"]
            assert area["y_min"] <= wp.y <= area["y_max"]
