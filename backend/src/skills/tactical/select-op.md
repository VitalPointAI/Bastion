---
skillId: tac-select-op
name: select_observation_post
description: Select the best observation post (OP) for overwatch. Scores candidates by elevation, sight lines to the threat area, concealment from enemy observation, distance safety, and withdrawal route quality. Returns ranked candidates.
version: 1.0.0
category: tactical
tags: [overwatch, observation, positioning, reconnaissance]
inputSchema:
  type: object
  properties:
    threat_area_center:
      type: object
      properties:
        x:
          type: number
        y:
          type: number
      required: [x, y]
      description: Center of the threat area to observe
    friendly_base:
      type: object
      properties:
        x:
          type: number
        y:
          type: number
      required: [x, y]
      description: Friendly base position for withdrawal route consideration
    min_distance_from_threat:
      type: number
      description: Minimum safe distance from threats (default 1.5 room units)
  required: [threat_area_center, friendly_base]
  additionalProperties: false
outputSchema:
  type: object
  properties:
    candidates:
      type: array
      items:
        type: object
    best:
      type: object
systemPromptFragment: |
  You can find optimal observation posts using select_observation_post.
  An OP should provide elevation advantage, clear sight lines to the threat area,
  concealment from enemy observation, and a viable withdrawal route.
  The leader should occupy the OP before followers move to firing positions.
handler: tactical/selectOP
---

## Overview
Evaluates all landmarks and key intersections in the operational area as potential observation posts. Each candidate is scored on multiple criteria: elevation advantage (+40 for elevated structures), observation distance (optimal 1.5-3.5 units from threat), withdrawal route proximity to base, and concealment from the enemy's likely advance axis (off primary roads).

## Tactical Context
The observation post is the leader's position during the engagement. From the OP, the leader:
- Maintains eyes on the kill zone and threat movement
- Coordinates follower fires
- Calls adjustments to the engagement plan
- Has a viable withdrawal route if the engagement fails

The OP should NOT be in the firing corridor — it should be offset from the engagement axis.

## Constraints
- Elevation data limited to annotated landmarks (no DEM)
- Sight line computation is simplified (no raytracing through buildings)
- Scoring is heuristic-based, not physics-based
- Returns top 5 candidates — the AI should select based on overall plan coherence
