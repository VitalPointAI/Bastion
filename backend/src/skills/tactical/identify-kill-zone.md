---
skillId: tac-identify-kill-zone
name: identify_kill_zone
description: Identify the optimal kill zone and mutually supporting firing positions for an ambush. Enforces doctrinal constraints (FM 3-21.8, FM 3-90-1) including fratricide prevention, arc-of-fire validation, terrain/cover scoring, and weapon range standoff. Direction-agnostic — works for any enemy axis of advance.
version: 2.0.0
category: tactical
tags: [ambush, kill-zone, engagement, fire-positions, fratricide-prevention, doctrine]
inputSchema:
  type: object
  properties:
    enemy_advance_axis:
      type: object
      properties:
        road_name:
          type: string
          description: Name of the road the enemy is advancing on
        direction:
          type: string
          enum: [north, south, east, west]
          description: Direction of enemy movement
      required: [road_name, direction]
    num_firing_positions:
      type: number
      description: Number of friendly firing positions to place
    friendly_max_effective_range:
      type: number
      description: Max effective range of friendly weapons in room coords (default 3.5)
  required: [enemy_advance_axis, num_firing_positions]
  additionalProperties: false
outputSchema:
  type: object
  properties:
    kill_zone:
      type: object
      description: Kill zone center, axis, and fratricide safety flag
    recommended_firing_positions:
      type: array
      items:
        type: object
        description: Position with arc direction, cover score, distance to KZ
    safety_validation:
      type: object
      description: Fratricide safety, weapon range, lateral separation checks
    tactical_notes:
      type: array
      items:
        type: string
systemPromptFragment: |
  You can identify optimal ambush kill zones using identify_kill_zone.
  The skill enforces doctrinal constraints (FM 3-21.8, FM 3-90-1):
  - ALL firing positions are BEHIND the kill zone (opposite side from enemy approach)
  - Arcs of fire converge on the kill zone — never through a friendly position
  - No position is forward of another along the enemy axis of advance
  - Positions scored for cover/concealment from terrain and obstacles
  - Positions placed within max effective range of friendly weapons
  The output includes a safety_validation block confirming fratricide safety.
handler: tactical/identifyKillZone
---

## Overview
Analyzes the road network to find the optimal ambush location on the enemy's advance axis. Positions all firing elements on the SAME SIDE (behind the kill zone relative to enemy movement), laterally separated on different perpendicular roads for converging fire. Validates fratricide safety by checking arcs of fire and forward positioning. Scores positions for cover, concealment, and weapon range standoff.

## Tactical Context (FM 3-21.8, FM 3-90-1)
A successful ambush requires:
1. **Channelization**: The enemy is confined to a road with no easy escape
2. **Mutually supporting fire**: Arcs of fire from each position converge on the kill zone from different angles
3. **Fratricide prevention**: No position fires through another friendly position; no position is forward of another along the enemy axis
4. **Cover and observation**: Positions use terrain, structures, or vegetation for concealment while maintaining clear observation of the kill zone
5. **Standoff**: Positions are at or near maximum effective range of friendly weapons
6. **Depth**: Firing positions are set back from the kill zone, not adjacent to it

## Direction-Agnostic Positioning
The skill works for any enemy direction of advance:
- Enemy advancing south → positions south, fire north
- Enemy advancing north → positions north, fire south
- Enemy advancing east → positions east, fire west
- Enemy advancing west → positions west, fire east

## Safety Validation
The output includes a `safety_validation` block with:
- `fratricide_safe`: Whether all arcs of fire are clear of friendly positions
- `all_positions_behind_kz`: Whether all positions are behind the kill zone
- `all_positions_in_weapon_range`: Whether all positions are within max effective range
- `lateral_separation`: Distance between firing positions

## Constraints
- Assumes the enemy advance axis is a straight road (no curved streets)
- Firing positions are at intersections — no mid-block positions
- Arc of fire check uses 15-degree half-angle cone
- Cover scoring is heuristic based on road class and nearby landmarks
