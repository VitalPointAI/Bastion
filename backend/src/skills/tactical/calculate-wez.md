---
skillId: tac-calculate-wez
name: calculate_weapons_engagement_zone
description: Calculate the Weapons Engagement Zone (WEZ) for a threat — the area where the enemy can effectively engage friendly forces. Returns safe positions that are outside the WEZ or terrain-masked. Use this to verify that planned positions are survivable.
version: 1.0.0
category: tactical
tags: [weapons, engagement-zone, survivability, positioning]
inputSchema:
  type: object
  properties:
    threat_position:
      type: object
      properties:
        x:
          type: number
        y:
          type: number
      required: [x, y]
      description: Enemy position
    threat_type:
      type: string
      description: Enemy vehicle type (e.g., T-90, ZBD-04)
    threat_heading:
      type: number
      description: Enemy heading in degrees (0=north), if known
    friendly_weapon:
      type: string
      description: Friendly weapon system (default anti-tank guided missile)
  required: [threat_position, threat_type]
  additionalProperties: false
outputSchema:
  type: object
  properties:
    threat_type:
      type: string
    wez:
      type: object
      properties:
        max_range:
          type: number
        effective_range:
          type: number
        min_range:
          type: number
    safe_positions:
      type: array
      items:
        type: object
    recommendation:
      type: string
systemPromptFragment: |
  You can calculate Weapons Engagement Zones using calculate_weapons_engagement_zone.
  A WEZ defines where the enemy CAN effectively engage our forces.
  Always verify that planned firing positions are outside the enemy WEZ or
  behind terrain masking (buildings between streets provide defilade in urban terrain).
  Positions behind the threat's frontal arc have reduced reaction time advantage.
handler: tactical/calculateWEZ
---

## Overview
Computes the WEZ boundaries for a specified threat type and position. Considers maximum range, effective range, minimum range, terrain masking (urban building blocks between parallel streets), and frontal arc orientation if heading is known. Returns a list of safe positions at road intersections that are either beyond range or terrain-masked.

## Tactical Context
The WEZ determines where you can and cannot safely position forces. In urban terrain:
- **Range-based safety**: Positions beyond max range are safe from direct fire
- **Terrain masking**: Positions on parallel streets (with a building block between) are defilade even within range
- **Frontal arc**: Positions behind the threat's turret traverse arc have a reaction time advantage
- **Mutual support**: Verify that ALL firing positions are outside the WEZ, not just one

## Constraints
- WEZ is simplified to circular zones (no line-of-sight raytracing)
- Terrain masking assumes building blocks between parallel streets (urban grid)
- Does not account for indirect fire weapons (mortars, artillery)
- Range values are in room coordinates (1 unit ~ 1.2m ground distance)
