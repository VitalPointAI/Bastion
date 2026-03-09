---
phase: 33-joint-planning-process-jpp-campaign-plan-framework-with-ends-ways-means-linkage
plan: 03
subsystem: ai-agents
tags: [typescript, agents, mcp-tools, jpp, jp5-0, eliza]

requires:
  - phase: 33-joint-planning-process-jpp-campaign-plan-framework-with-ends-ways-means-linkage
    provides: "JPP types, jppStore, ewmStore"

provides:
  - "7 JPP agent manifests (one per JP 5-0 step)"
  - "6 JPP MCP tools for step product management"
  - "6 E-W-M MCP tools for linkage CRUD and gap analysis"
---

## Self-Check: PASSED

## What Was Built
Created 7 AI agent manifests for all JP 5-0 steps and 12 MCP tool definitions (6 JPP + 6 E-W-M).

### Agent Manifests
- **Step 1 (Planning Initiation):** Commander's Staff Agent — drafts CPG, staff estimates, planning timeline
- **Step 2 (Mission Analysis):** Intel/Ops Agent — conducts IPB, task analysis, mission statement
- **Step 3 (COA Development):** Plans Agent — develops COAs from LOEs, creates E-W-M linkages
- **Step 4 (COA Analysis):** Red Team Agent — wargames COAs, identifies vulnerabilities
- **Step 5 (COA Comparison):** Decision Support Agent — weighted decision matrix
- **Step 6 (COA Approval):** Briefing Agent — commander decision briefing package
- **Step 7 (Plan Development):** Plans Officer — OPLAN/CONPLAN with 5-paragraph order

### MCP Tools
- JPP tools: get_jpp_instance, save_step_product, get_step_products, update_step_status, get_parent_jpp_products, get_loes_from_design
- E-W-M tools: create_ewm_linkage, delete_ewm_linkage, get_ewm_linkages, find_ewm_gaps, update_ewm_allocation, get_ewm_summary

## Key Files

### key-files.created
- backend/src/graph/agents/jpp-planning-init-agent.ts
- backend/src/graph/agents/jpp-mission-analysis-agent.ts
- backend/src/graph/agents/jpp-coa-dev-agent.ts
- backend/src/graph/agents/jpp-coa-analysis-agent.ts
- backend/src/graph/agents/jpp-coa-comparison-agent.ts
- backend/src/graph/agents/jpp-briefing-agent.ts
- backend/src/graph/agents/jpp-plan-dev-agent.ts
- backend/src/graph/tools/jpp-tools.ts
- backend/src/graph/tools/ewm-tools.ts

### key-files.modified
(none)

## Deviations
None — all 3 tasks completed per plan.

## Dependencies Confirmed
- Imports from `../../agents/types.js` for AgentManifest, AgentCharacter, AutonomyLevel
- jpp-tools.ts imports from `../../jpp/types.js` and `../../jpp/jpp-store.js`
- ewm-tools.ts imports from `../../jpp/types.js` and `../../jpp/ewm-store.js`
- get_loes_from_design bridges Design tab via `../../design/design-store.js`
