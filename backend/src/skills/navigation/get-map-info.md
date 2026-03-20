---
skillId: nav-get-map-info
name: get_map_info
description: Get information about the operational area including road network, landmarks, key terrain, intersections, and tactical notes. Use this first to understand the environment before planning routes or positions.
version: 1.0.0
category: navigation
tags: [terrain, map, reconnaissance, situational-awareness]
inputSchema:
  type: object
  properties: {}
  required: []
  additionalProperties: false
outputSchema:
  type: object
  properties:
    area_name:
      type: string
    bounds:
      type: object
    roads:
      type: array
      items:
        type: object
    landmarks:
      type: array
      items:
        type: object
    intersections:
      type: array
      items:
        type: object
    tactical_notes:
      type: array
      items:
        type: string
systemPromptFragment: |
  You have access to operational area map data via the get_map_info skill.
  Call this first to understand the road network, landmarks, intersections,
  and tactical terrain features before making any positional decisions.
  All movement must follow roads — no off-road travel through buildings.
handler: navigation/getMapInfo
---

## Overview
Retrieves structured information about the current operational area. Returns the complete road network (with names, axes, road class, lane count), landmarks (with tactical notes), computed intersections, and doctrinal tactical observations about the terrain.

## Tactical Context
This is always the first skill an agent should call when operating in an unfamiliar area. Understanding the terrain is a prerequisite for route planning, position selection, and engagement planning. The road network defines where movement is possible; landmarks identify key terrain; intersections are the nodes of the movement graph.

## Constraints
- Map data reflects the currently loaded operational area (set by the mission orchestrator)
- Road data is derived from OpenStreetMap and may not reflect recent construction or destruction
- Elevation data is limited to landmark annotations (no DEM)
