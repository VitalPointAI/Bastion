---
skillId: nav-plan-screening-route
name: plan_screening_route
description: Plan a reconnaissance screening route that sweeps across the area of operations. Creates a zigzag pattern following the road grid to cover the width of the AO while staying behind a forward screen line.
version: 1.0.0
category: navigation
tags: [reconnaissance, screening, patrol, coverage]
inputSchema:
  type: object
  properties:
    start_x:
      type: number
      description: Screening start position X
    start_y:
      type: number
      description: Screening start position Y
    screen_line_y:
      type: number
      description: Maximum Y (north) the screen should reach — the forward edge
    ao_x_min:
      type: number
      description: Western boundary of the screening area
    ao_x_max:
      type: number
      description: Eastern boundary of the screening area
  required: [start_x, start_y, screen_line_y, ao_x_min, ao_x_max]
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
    screen_width:
      type: number
    screen_depth:
      type: number
    roads_covered:
      type: array
      items:
        type: string
systemPromptFragment: |
  You can plan reconnaissance screening routes using plan_screening_route.
  A screen covers the width of the AO in a zigzag pattern along cross-streets,
  advancing forward toward the screen line. The recce vehicle should detect
  threats well before they enter the kill zone.
handler: navigation/planScreeningRoute
---

## Overview
Generates a systematic zigzag sweep pattern across the AO using east-west cross-streets. The pattern covers the full width (all north-south roads) at each depth level, advancing northward toward the screen line. This ensures maximum area coverage for threat detection.

## Tactical Context
A reconnaissance screen is the first phase of any engagement. The lead vehicle sweeps the AO to detect enemy forces at maximum range — ideally several kilometers ahead of the main body. Detection at range gives the commander time to position followers into firing positions before the enemy reaches the kill zone.

## Constraints
- The screen pattern stays behind the screen_line_y — the recce vehicle does not advance beyond it
- Coverage depends on the road grid density — gaps between roads are not covered
- The vehicle is exposed during cross-street movement — speed is critical
- Detection capability is simulated based on proximity to the recon area boundary
