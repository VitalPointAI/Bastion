---
skillId: design-resource-allocator
name: resource_allocator
description: Query the Resource Registry for available forces, map them to operational phases, and surface allocation shortfalls or conflicts. Returns a phase-by-phase force availability assessment with a plain-language summary.
version: 1.0.0
category: design
tags: [resources, force-allocation, phases, shortfall]
inputSchema:
  type: object
  properties:
    problem_set_id:
      type: string
      description: The problem set (workspace) ID to scope resource queries
    operational_approach:
      type: object
      description: OperationalApproach data — must include phases array
    resource_types:
      type: array
      description: Optional filter — only include these resource categories (e.g., ['armor', 'aviation', 'logistics'])
      items:
        type: string
  required: [problem_set_id, operational_approach]
  additionalProperties: false
outputSchema:
  type: object
  properties:
    phases:
      type: array
      description: Per-phase force allocation — available_forces, required_forces, shortfalls
    summary:
      type: string
      description: Plain-language summary of overall force posture and key shortfalls
systemPromptFragment: |
  You can query real force availability against operational phases using resource_allocator.
  Use this skill when the planner asks whether the force is resourced for a particular phase
  or the overall operation. The skill:
  - Queries the Resource Registry (the single source of truth for registered forces)
  - Maps available resources to each operational phase based on capability type
  - Computes a required force estimate (heuristic based on phase complexity)
  - Identifies shortfalls: resources required but not available or not FMC
  - Returns both machine-readable phase data and a human-readable summary
  Call this skill before finalizing the operational approach to ensure it is feasible
  given the joint force's actual resource posture.
handler: design/resourceAllocator
---

## Overview
Bridges the operational design process with the Resource Registry by answering the
question: "Can the force actually execute this approach as designed?" It queries all
registered resources, maps them to phases, and surfaces gaps before the plan is locked.

## Design Context
Resource feasibility is a planning gate — a beautifully designed operational approach
that cannot be resourced is not a plan, it is an aspiration. Ironclaw uses this skill
to give the planner an early warning of shortfalls so they can either adjust the approach
or formally flag a resource risk to the supported commander.

## Output Structure
- `phases`: Array of `{ phase_name, available_forces, required_forces, shortfalls }`
  where `shortfalls` lists specific capability gaps
- `summary`: One paragraph plain-language assessment suitable for inclusion in a
  Staff Estimate or supporting brief

## Constraints
- Required force estimates are heuristic (based on phase count and description complexity)
  because actual task-organizing is done in the plan phase
- Only queries resources currently registered in the Resource Registry
  (resources not yet onboarded will appear as shortfalls)
- Resource_types filter is OR-based (any matching category is included)
