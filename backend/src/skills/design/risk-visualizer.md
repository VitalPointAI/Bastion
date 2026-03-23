---
skillId: design-risk-visualizer
name: risk_visualizer
description: Visualize operational risks with mitigations as a 5x5 risk matrix, phase timeline, or LOE-phase heatmap. Maps each risk to its phase, LOE, and decision point. Returns an SVG visualization and a structured risks summary.
version: 1.0.0
category: design
tags: [visualization, risk, matrix, heatmap, mitigation]
inputSchema:
  type: object
  properties:
    problem_set_id:
      type: string
      description: The problem set (workspace) ID this risk visualization belongs to
    operational_approach:
      type: object
      description: OperationalApproach data — phases, transitions, decisionPoints, and optional risks array
    display_format:
      type: string
      enum: [matrix, timeline, heatmap]
      description: Visualization type — matrix (5x5 probability/impact), timeline (risks on phase timeline), heatmap (LOE x Phase concentration grid)
  required: [problem_set_id, operational_approach]
  additionalProperties: false
outputSchema:
  type: object
  properties:
    svg:
      type: string
      description: SVG risk visualization in the requested format
    risks_summary:
      type: array
      description: Array of {risk, phase, loe, mitigation, residual_level} for each identified risk
systemPromptFragment: |
  You can visualize operational risks and mitigations using risk_visualizer.
  Use this skill when the planner or commander wants to understand the risk picture
  across the operational approach — where risks concentrate, what the residual risk is
  after mitigations, and which phases/LOEs carry the highest risk burden.
  Display formats:
  - matrix: Classic 5x5 probability vs. impact grid with color-coded risk dots and labels
  - timeline: Risks plotted along the phase timeline showing when risk is highest
  - heatmap: LOE-by-Phase grid with cell color intensity showing risk concentration
  The risks_summary is always returned regardless of display format — it gives a
  machine-readable structured list of all risks with their mitigations and residual levels.
  Use this skill before briefing the operational approach to the commander to prepare
  a risk annex or RRSO (Risk Reduction and System Optimization) assessment.
handler: design/riskVisualizer
---

## Overview
Risk visualization converts abstract risk statements into actionable visual products.
The 5x5 matrix is the most familiar format for joint planners. The timeline view shows
risk concentration over time. The heatmap reveals which LOE-phase combinations carry
the most risk — a useful tool for resource prioritization.

## Design Context
Risk is inherent to all operations. The planner's job is not to eliminate risk but to
make risk visible, manageable, and acceptable to the commander. Ironclaw uses this skill
to produce risk products that are brief-ready and that directly support the commander's
risk acceptance decision.

## Risk Scoring
- **Probability**: 1 (rare) to 5 (near certain)
- **Impact**: 1 (negligible) to 5 (catastrophic)
- **Risk Level**: Low (1-4), Medium (5-9), High (10-19), Extreme (20-25)
- **Residual Level**: Risk level after mitigation is applied

## Output Structure
- `svg`: Visualization in the requested format (600x600 for matrix, 900x400 for timeline/heatmap)
- `risks_summary`: Array of structured risk records for downstream use in risk annexes

## Constraints
- If no explicit risks are provided in operational_approach, risks are inferred from
  phase transitions, decision point criteria, and narrative keywords
- Risk scoring is heuristic when not explicitly defined in the approach data
- Matrix format supports up to 25 risk items legibly; heatmap up to 5x5 grid
