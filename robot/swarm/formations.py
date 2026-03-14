"""
Formation geometry engine for swarm coordination.

Computes slot positions for each formation type relative to the leader's
position and heading. All offsets are in room-relative meters; the engine
rotates offsets by the leader's heading so formations orient correctly.

Supported formations:
  - line:          Single file behind the leader
  - wedge:         Inverted V, leader at apex
  - column:        Parallel columns beside the leader
  - echelon_left:  Staggered to the left-rear of leader
  - echelon_right: Staggered to the right-rear of leader
  - vee:           V-shape, leader at rear center
"""
from __future__ import annotations

import math
from typing import List, Tuple

from swarm.models import FormationSlot, FormationType, Position2D


def compute_formation_slots(
    formation: FormationType,
    member_count: int,
    spacing_m: float = 1.0,
) -> List[FormationSlot]:
    """
    Compute formation slots as offsets from the leader (slot 0).

    Offsets are in a leader-relative frame:
      - offset_x: lateral (positive = right of heading)
      - offset_y: longitudinal (positive = forward, negative = behind)

    The leader always occupies slot 0 at (0, 0).

    Args:
        formation: Which formation geometry to use.
        member_count: Total number of robots including the leader.
        spacing_m: Distance between adjacent slots in meters.

    Returns:
        List of FormationSlot with offsets for each member.
    """
    if member_count < 1:
        return []

    # Slot 0 is always the leader at origin
    slots = [FormationSlot(slot_index=0, offset_x=0.0, offset_y=0.0)]

    follower_count = member_count - 1
    if follower_count == 0:
        return slots

    if formation == FormationType.line:
        slots.extend(_line_offsets(follower_count, spacing_m))
    elif formation == FormationType.wedge:
        slots.extend(_wedge_offsets(follower_count, spacing_m))
    elif formation == FormationType.column:
        slots.extend(_column_offsets(follower_count, spacing_m))
    elif formation == FormationType.echelon_left:
        slots.extend(_echelon_offsets(follower_count, spacing_m, left=True))
    elif formation == FormationType.echelon_right:
        slots.extend(_echelon_offsets(follower_count, spacing_m, left=False))
    elif formation == FormationType.vee:
        slots.extend(_vee_offsets(follower_count, spacing_m))

    return slots


def slots_to_world_positions(
    slots: List[FormationSlot],
    leader_pos: Position2D,
    leader_heading: float,
) -> List[Tuple[int, Position2D]]:
    """
    Convert formation slots from leader-relative offsets to world positions.

    Rotates each offset by the leader's heading, then translates to the
    leader's world position.

    Args:
        slots: Formation slots with leader-relative offsets.
        leader_pos: Leader's current world position.
        leader_heading: Leader's heading in degrees (0 = north, 90 = east).

    Returns:
        List of (slot_index, world_position) tuples.
    """
    rad = math.radians(leader_heading)
    cos_h = math.cos(rad)
    sin_h = math.sin(rad)

    result: List[Tuple[int, Position2D]] = []
    for slot in slots:
        # Rotate offset by heading (heading 0 = north = +y axis)
        # Forward (offset_y) maps to north, lateral (offset_x) maps to east
        world_x = leader_pos.x + slot.offset_x * cos_h + slot.offset_y * sin_h
        world_y = leader_pos.y - slot.offset_x * sin_h + slot.offset_y * cos_h
        result.append((slot.slot_index, Position2D(x=round(world_x, 3), y=round(world_y, 3))))

    return result


# ---------------------------------------------------------------------------
# Formation offset generators
# ---------------------------------------------------------------------------


def _line_offsets(n: int, spacing: float) -> List[FormationSlot]:
    """Single file: followers stacked directly behind leader."""
    return [
        FormationSlot(
            slot_index=i + 1,
            offset_x=0.0,
            offset_y=-(i + 1) * spacing,
        )
        for i in range(n)
    ]


def _wedge_offsets(n: int, spacing: float) -> List[FormationSlot]:
    """Inverted V: leader at apex, followers spread behind at 45-degree angles.

    Alternates left and right placement:
      follower 1 → left-rear
      follower 2 → right-rear
      follower 3 → further left-rear
      etc.
    """
    slots: List[FormationSlot] = []
    for i in range(n):
        rank = (i // 2) + 1  # How many rows back
        side = -1 if (i % 2 == 0) else 1  # Left first, then right
        slots.append(
            FormationSlot(
                slot_index=i + 1,
                offset_x=side * rank * spacing * 0.707,  # 45-deg lateral
                offset_y=-rank * spacing * 0.707,         # 45-deg rearward
            )
        )
    return slots


def _column_offsets(n: int, spacing: float) -> List[FormationSlot]:
    """Parallel columns: followers in two columns beside the leader's file.

    Column layout (looking forward):
      Left col   Center (leader)   Right col
      F2         Leader            F1
      F4                           F3
      F6                           F5
    """
    slots: List[FormationSlot] = []
    for i in range(n):
        col_side = 1 if (i % 2 == 0) else -1  # Right first
        row = (i // 2)
        slots.append(
            FormationSlot(
                slot_index=i + 1,
                offset_x=col_side * spacing,
                offset_y=-row * spacing,
            )
        )
    return slots


def _echelon_offsets(n: int, spacing: float, left: bool) -> List[FormationSlot]:
    """Echelon: staggered diagonal to one side of the leader.

    Each follower is one step behind and one step to the side.
    """
    side = -1 if left else 1
    return [
        FormationSlot(
            slot_index=i + 1,
            offset_x=side * (i + 1) * spacing,
            offset_y=-(i + 1) * spacing,
        )
        for i in range(n)
    ]


def _vee_offsets(n: int, spacing: float) -> List[FormationSlot]:
    """V-shape: leader at rear center, followers spread forward.

    Like a wedge but reversed — leader trails, followers push forward.
    Alternates left-forward and right-forward:
      follower 1 → left-forward
      follower 2 → right-forward
      etc.
    """
    slots: List[FormationSlot] = []
    for i in range(n):
        rank = (i // 2) + 1
        side = -1 if (i % 2 == 0) else 1
        slots.append(
            FormationSlot(
                slot_index=i + 1,
                offset_x=side * rank * spacing * 0.707,
                offset_y=rank * spacing * 0.707,  # Forward of leader
            )
        )
    return slots
