---
skillId: tac-identify-kill-zone
name: identify_kill_zone
description: Identify the optimal kill zone for an ambush given the enemy advance axis. Finds road segments where the enemy is channelized, exposed to flanking fire from perpendicular streets, and has limited escape routes. Returns kill zone location with flanking fire position recommendations.
version: 1.0.0
category: tactical
tags: [ambush, kill-zone, engagement, fire-positions]
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
  required: [enemy_advance_axis, num_firing_positions]
  additionalProperties: false
outputSchema:
  type: object
  properties:
    kill_zone:
      type: object
    recommended_firing_positions:
      type: array
      items:
        type: object
    all_candidates:
      type: array
      items:
        type: object
    tactical_notes:
      type: array
      items:
        type: string
systemPromptFragment: |
  You can identify optimal ambush kill zones using identify_kill_zone.
  A kill zone is where the enemy is channelized on a road, exposed to flanking
  fire from perpendicular streets. The skill returns the kill zone center,
  recommended firing positions on cross-streets, and tactical notes.
  Firing positions should be BEHIND the kill zone (south for south-moving enemy)
  with firing corridors directed INTO the kill zone along perpendicular streets.
handler: tactical/identifyKillZone
---

## Overview
Analyzes the road network to find the optimal ambush location on the enemy's advance axis. Scores each intersection along the axis road by: number of available flanking corridors from perpendicular streets, road class (narrow = better channelization), and centrality within the AO. Returns the best kill zone with recommended firing positions on cross-streets behind the engagement line.

## Tactical Context
A successful ambush requires:
1. **Channelization**: The enemy is confined to a road with no easy escape
2. **Flanking fire**: Fires come from perpendicular streets, not head-on
3. **Mutual defilade**: Firing positions don't expose each other to enemy return fire
4. **Depth**: Firing positions are set back from the kill zone, not adjacent to it

The kill zone should be on the widest road (enemy's likely axis) where it intersects the most perpendicular streets.

## Constraints
- Assumes the enemy advance axis is a straight road (no curved streets)
- Firing positions are at intersections — no mid-block positions
- Does not compute fields of fire or dead space
- Multiple kill zones for L-shaped ambushes require separate calls
