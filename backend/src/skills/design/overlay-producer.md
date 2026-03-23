---
skillId: design-overlay-producer
name: overlay_producer
description: Generate SVG map overlays for an operational approach, depicting phases as colored regions, lines of effort as directional arrows, decisive points as markers, and boundaries as dashed lines — suitable for rendering on a Leaflet map layer.
version: 1.0.0
category: design
tags: [visualization, map, overlay, operational-approach, svg]
inputSchema:
  type: object
  properties:
    problem_set_id:
      type: string
      description: The problem set (workspace) ID this overlay belongs to
    operational_approach:
      type: object
      description: OperationalApproach data — phases, transitions, decisionPoints, narrative
    loes:
      type: array
      description: Array of LineOfEffort objects with decisive points for geographic mapping
    ao_bounds:
      type: object
      description: Optional bounding box {southwest, northeast} for scaling overlay to AO
  required: [problem_set_id, operational_approach]
  additionalProperties: false
outputSchema:
  type: object
  properties:
    svg:
      type: string
      description: Full SVG string suitable for Leaflet image overlay rendering
    layers:
      type: array
      description: Array of named overlay layers {name, svg} for individual layer toggling
systemPromptFragment: |
  You can produce SVG map overlays of an operational approach using overlay_producer.
  Use this skill when the commander or planner needs a visual map depiction of how the
  operation unfolds across the area of operations (AO). The overlay shows:
  - Phases as colored bands/regions across the AO timeline
  - Lines of Effort (LOEs) as bold directional arrows along axes of advance
  - Decisive Points as labeled diamond markers on each LOE
  - Phase transitions as dashed boundary lines
  - Decision Points as annotated flags
  The output SVG can be draped over the Leaflet map as an image overlay layer.
  Each logical layer (phases, LOEs, decisive points) is also returned separately
  for individual toggling in the COP interface.
handler: design/overlayProducer
---

## Overview
Generates SVG-format map overlays that visually communicate an operational approach on
the Area of Operations map. The overlay is structured as a layered SVG with named groups
for each logical element type, enabling selective display in the COP layer panel.

## Design Context
Operational overlays are the primary visual briefing tool for conveying commander's intent
spatially. This skill produces a structured SVG that Leaflet can render as an image overlay,
giving planners an immediate picture of how the phases, LOEs, and decisive points map to
the physical terrain.

## Output Structure
- `svg`: A single SVG combining all layers, 800x600 viewBox normalized to AO bounds
- `layers`: Array of per-layer SVGs — one per LOE, one for phase boundaries, one for
  decisive points — enabling the COP to toggle individual elements

## Constraints
- SVG is schematic (not geospatially precise) unless ao_bounds provides real coordinates
- Decisive point positions are inferred from LOE order and phase unless explicit coordinates provided
- No base map imagery is included — overlay is transparent for Leaflet layering
