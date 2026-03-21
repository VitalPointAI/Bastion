---
skillId: tac-engage-target
name: evaluate_engagement
description: Evaluate whether to engage a target based on its position relative to the kill zone, weapons authorization status, weapons range, and tactical conditions. Returns a fire/hold decision with reasoning.
version: 1.0.0
category: tactical
tags: [engagement, fire-control, weapons, kill-zone, authorization]
inputSchema:
  type: object
  properties:
    target_position:
      type: object
      properties:
        x:
          type: number
        y:
          type: number
      required: [x, y]
      description: Current target position
    kill_zone_center:
      type: object
      properties:
        x:
          type: number
        y:
          type: number
      required: [x, y]
      description: Center of the designated kill zone
    kill_zone_radius:
      type: number
      description: Kill zone radius in room units
    weapons_authorized:
      type: boolean
      description: Whether lethal force has been authorized
    firing_positions:
      type: array
      items:
        type: object
        properties:
          x:
            type: number
          y:
            type: number
      description: Friendly firing positions
    target_heading:
      type: number
      description: Target heading in degrees (0=north)
    target_speed:
      type: number
      description: Estimated target speed
  required: [target_position, kill_zone_center, weapons_authorized]
  additionalProperties: false
outputSchema:
  type: object
  properties:
    decision:
      type: string
      enum: [fire, hold, track]
    reasoning:
      type: string
    target_in_kill_zone:
      type: boolean
    distance_to_kill_zone:
      type: number
    estimated_time_to_kill_zone:
      type: number
systemPromptFragment: |
  You can evaluate engagement decisions using evaluate_engagement.
  A target should only be engaged when ALL conditions are met:
  1. Lethal force has been authorized (weapons_authorized=true)
  2. The target is inside the kill zone (distance to center < radius)
  3. Friendly positions have clear fields of fire
  If the target is approaching but not yet in the kill zone, return 'hold'.
  If the target is moving away or no authorization, return 'track'.
handler: tactical/evaluateEngagement
---

## Overview
Evaluates whether conditions are met to engage a detected target. Considers authorization status, target position relative to the kill zone, and tactical conditions. Returns fire/hold/track with reasoning.

## Tactical Context
Engagement discipline is critical. Premature engagement reveals friendly positions before maximum effect. Targets must be allowed to enter the kill zone where crossfire geometry maximizes lethality. Engaging too early wastes the ambush advantage.

## Rules of Engagement
1. NEVER fire without authorization (weapons_authorized must be true)
2. HOLD fire until target enters the kill zone
3. Engage when target is in the kill zone and moving through the crossfire
4. Track targets that are moving away from the kill zone
