---
skillId: nav-plan-route
name: plan_route
description: Compute a road-following route between two points using A* pathfinding on the intersection graph. Routes only turn at intersections and never cut through buildings. Supports concealment preference and position avoidance.
version: 1.0.0
category: navigation
tags: [routing, pathfinding, movement, concealment]
inputSchema:
  type: object
  properties:
    from_x:
      type: number
      description: Start position X coordinate
    from_y:
      type: number
      description: Start position Y coordinate
    to_x:
      type: number
      description: Destination X coordinate
    to_y:
      type: number
      description: Destination Y coordinate
    avoid_positions:
      type: array
      items:
        type: object
        properties:
          x:
            type: number
          y:
            type: number
      description: Positions to avoid (enemy locations, other friendly routes)
    prefer_concealment:
      type: boolean
      description: Prefer narrow residential streets over wide arterials for concealment
  required: [from_x, from_y, to_x, to_y]
  additionalProperties: false
outputSchema:
  type: object
  properties:
    waypoints:
      type: array
      items:
        type: object
        properties:
          x:
            type: number
          y:
            type: number
    total_distance:
      type: number
    segment_count:
      type: number
systemPromptFragment: |
  You can compute road-following routes using the plan_route skill.
  Routes follow the street grid and only turn at intersections.
  Use prefer_concealment=true for tactical advance on narrow residential streets.
  Use avoid_positions to route around known enemy positions or other friendly routes.
  Always plan different routes for advance and withdrawal when possible.
handler: navigation/planRoute
---

## Overview
Computes an optimal road-following route between two positions using A* pathfinding on the intersection graph. The algorithm considers edge weights modified by concealment preference (penalizes wide primary roads) and position avoidance (penalizes proximity to specified coordinates).

## Tactical Context
- **Advance routes**: Use `prefer_concealment=true` to stay on residential side streets
- **Withdrawal routes**: Should use different roads than the advance route — pass the advance route's waypoints as `avoid_positions`
- **Multiple elements**: When planning routes for multiple followers, pass earlier followers' routes as `avoid_positions` to prevent congestion
- **Flanking approaches**: Plan routes that approach the objective from different axes

## Constraints
- All routes follow the road grid — no shortcuts through building blocks
- Routes turn only at computed intersections
- The A* heuristic is Euclidean distance — routes are near-optimal but not guaranteed shortest
- Maximum route length is bounded by the AO dimensions
