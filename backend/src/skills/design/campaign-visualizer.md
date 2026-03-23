---
skillId: design-campaign-visualizer
name: campaign_visualizer
description: Generate a one-page campaign overview placemat for briefing. Shows CoG trees, Lines of Effort, objectives, problem framing, phase timeline, and decision points in a structured visual layout. Returns SVG and/or a detailed markdown specification for image-AI generation.
version: 1.0.0
category: design
tags: [visualization, campaign, placemat, briefing, svg]
inputSchema:
  type: object
  properties:
    problem_set_id:
      type: string
      description: The problem set (workspace) ID this placemat belongs to
    design:
      type: object
      description: Complete OperationalDesign object — problemFraming, cogAnalysis, linesOfEffort, operationalApproach
    output_format:
      type: string
      enum: [svg, markdown_spec, both]
      description: Output format — svg for Leaflet/UI rendering, markdown_spec for image-AI generation, both for maximum flexibility
  required: [problem_set_id, design]
  additionalProperties: false
outputSchema:
  type: object
  properties:
    svg:
      type: string
      description: SVG placemat (present when output_format is svg or both)
    markdown_spec:
      type: string
      description: Detailed markdown layout specification for image-AI generation (present when output_format is markdown_spec or both)
systemPromptFragment: |
  You can generate a one-page campaign placemat using campaign_visualizer.
  Use this skill when the planner or commander needs a single-page visual that captures
  the entire campaign design for a senior leader brief or battle rhythm product.
  The placemat layout includes:
  - Top-left: Adversary CoG tree (CoG → Critical Capabilities → Requirements → Vulnerabilities)
  - Top-right: Problem statement and desired end state
  - Center: Lines of Effort as parallel horizontal lanes with decisive points marked
  - Bottom: Phase timeline with transitions and decision points annotated
  - Friendly CoG sidebar or inset
  The svg output is suitable for direct display in the UI or export.
  The markdown_spec output is a detailed textual description of the layout, colors, and
  content positions — suitable for passing to an image-AI (DALL-E, Stable Diffusion, etc.)
  to generate a polished final product.
handler: design/campaignVisualizer
---

## Overview
The campaign placemat is the visual artifact that bridges the design process and the
planning process. A well-constructed placemat communicates commander's intent, the
problem structure, how LOEs converge on adversary vulnerabilities, and the overall
campaign timeline in a single briefing-ready slide.

## Design Context
Senior leaders do not read planning documents — they look at placemats and maps.
Ironclaw uses this skill to produce a concise one-page visual that can be briefed
in under 5 minutes. The placemat is the canonical output of the Operational Design
phase before handoff to the planning team.

## Layout Regions (SVG: 1200x850px)
- **Region A (top-left, ~30%)**: Adversary CoG analysis tree
- **Region B (top-right, ~30%)**: Problem framing — current state, desired end state, problem statement
- **Region C (top-center, ~40% height)**: LOE swimlane diagram with decisive points
- **Region D (bottom, full width)**: Phase timeline with transitions and decision points
- **Region E (left sidebar)**: Friendly CoG and supporting task summary

## Constraints
- SVG is schematic — designed for legibility at 1200x850, not for Leaflet map overlay
- markdown_spec is optimized for image-AI prompts and includes color, font, and spacing guidance
- Complex CoG trees with >4 nodes per level are simplified to 3 levels for readability
