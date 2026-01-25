---
phase: 05-operational-planning-module
plan: 07
subsystem: planning-agents
tags: [langgraph, ai-agent, coa-comparison, doctrine, decision-support]
requires: [05-01-coa-store, 05-05-coa-generator, 05-06-red-team-simulator]
provides:
  - "COA Comparator LangGraph agent with objective scoring"
  - "Weighted scoring formula (suitability 30%, feasibility 25%, acceptability 25%)"
  - "Doctrinal criteria evaluation (feasibility, acceptability, suitability, distinguishability, completeness)"
  - "Rankings and top-ranked COA identification"
affects: [05-08-workflow-orchestration, frontend-planning-ui]
tech-stack:
  added: []
  patterns:
    - "LangGraph agent with progress tracking"
    - "Weighted scoring formula for objective comparison"
    - "Tool-based state updates via check node"
decisions:
  - id: weighted-scoring
    decision: "Suitability weighted highest (30%) in comparison formula"
    rationale: "Suitability (accomplishing the mission) is most critical per JP 5-0 doctrine"
    alternatives: ["Equal weighting", "Commander-configurable weights"]
    date: 2026-01-25
  - id: ranking-after-all-scored
    decision: "Rankings assigned after all COAs scored, not incrementally"
    rationale: "Ensures consistent relative comparison across all COAs"
    alternatives: ["Incremental ranking during scoring"]
    date: 2026-01-25
  - id: objective-character
    decision: "Character explicitly trained to avoid bias and favoritism"
    rationale: "Supports commander decision without making the decision"
    alternatives: ["Advocate character that recommends specific COA"]
    date: 2026-01-25
key-files:
  created:
    - backend/src/planning/agents/coa-comparator-character.ts
    - backend/src/planning/agents/coa-comparator-tools.ts
    - backend/src/planning/agents/coa-comparator.ts
  modified:
    - backend/src/planning/agents/index.ts
metrics:
  duration: 5
  tasks: 2
  commits: 2
  files-created: 3
  files-modified: 1
  completed: 2026-01-25
---

# Phase 05 Plan 07: COA Comparator Agent Summary

**One-liner:** LangGraph agent for objective COA comparison with weighted doctrinal scoring (suitability 30%, feasibility 25%, acceptability 25%)

## What Was Built

Created the COA Comparator AI agent that objectively evaluates and scores Courses of Action against five doctrinal criteria from JP 5-0.

### Character Definition
- **Objective analyst**: Trained to avoid bias and favoritism
- **Doctrinal criteria**: Feasibility, acceptability, suitability, distinguishability, completeness
- **Decision support**: Provides recommendations without making the decision
- **Knowledge base**: Evaluation factors, risk vs. gain, weighted scoring matrices

### Tools (3)
1. **GetAllCOAsTool**: Retrieves all COAs for a plan with red team results
2. **GetMissionCriteriaTool**: Gets mission context and commander guidance
3. **SaveComparisonScoreTool**: Saves weighted scores and rankings to database

### LangGraph Workflow
- **Agent node**: Invokes Claude with system prompt and tools
- **Tool node**: Executes comparison tools
- **Check node**: Tracks progress and determines completion
- **State management**: planId, coaCount, scoredCount, rankings, complete

### Weighted Scoring Formula
```
overallScore = (
  feasibility * 0.25 +
  acceptability * 0.25 +
  suitability * 0.30 +      // Weighted highest
  distinguishability * 0.10 +
  completeness * 0.10
) * 10  // Convert to 0-100 scale
```

## Implementation Notes

### Objective Analysis Character
The character definition emphasizes objectivity and consistency:
- Bio: "Applies doctrinal evaluation criteria consistently and fairly"
- Style: "Uses consistent scoring methodology", "Presents findings objectively"
- Lore: "Never shows favoritism or bias toward any COA"

This ensures the agent supports commander decision-making without overstepping bounds.

### Ranking After All Scored
The workflow scores all COAs before assigning rankings. This ensures:
- Consistent relative comparison across all COAs
- Rankings reflect actual differentiation, not order of evaluation
- Top-ranked COA is genuinely the highest-scoring option

### Red Team Integration
The tools retrieve red team results alongside COA details. The system prompt instructs the agent to "Consider red team results when scoring," ensuring adversary perspective informs feasibility and acceptability assessments.

### Progress Tracking
The check node monitors completion by:
1. Counting COAs for the plan
2. Counting how many have comparisonScore populated
3. Extracting and sorting rankings
4. Signaling completion when all COAs scored

## Decisions Made

### 1. Suitability Weighted Highest (30%)
**Decision:** Suitability receives the highest weight in the scoring formula.

**Rationale:** Per JP 5-0 doctrine, suitability (accomplishing the mission) is the most critical criterion. A COA that doesn't achieve the mission objective is not viable, regardless of how feasible or acceptable it is.

**Alternatives considered:**
- Equal weighting (20% each): Too simplistic, doesn't reflect doctrinal priorities
- Commander-configurable weights: Added complexity without clear benefit for v1

**Impact:** Ensures mission accomplishment is prioritized in objective comparison.

### 2. Rankings Assigned After All Scored
**Decision:** The agent scores all COAs before assigning rankings, rather than ranking incrementally.

**Rationale:** Ensures consistent relative comparison. If COA 1 gets ranked #1 before COA 2 is scored, and COA 2 scores higher, the ranking would be incorrect.

**Alternatives considered:**
- Incremental ranking: Simpler flow but requires re-ranking after each new COA

**Impact:** Rankings accurately reflect relative comparison across all COAs.

### 3. Objective Character (Not Advocate)
**Decision:** Character trained to provide objective comparison without advocating for a specific COA.

**Rationale:** Maintains commander decision authority. The agent supports decision-making by providing objective analysis, not by making the decision itself.

**Alternatives considered:**
- Advocate character: Would recommend a specific COA, potentially biasing commander decision
- Passive reporter: Would present scores without analysis or context

**Impact:** Agent provides valuable decision support while respecting command authority.

## Integration Points

### Upstream Dependencies
- **05-01 COA Store**: Provides `updateComparisonScore()` method
- **05-05 COA Generator**: Generates the COAs to be compared
- **05-06 Red Team Simulator**: Provides red team results for consideration

### Downstream Consumers
- **05-08 Workflow Orchestration**: Will invoke compareCOAs() in planning workflow
- **Frontend Planning UI**: Will display comparison scores and rankings
- **Commander Dashboard**: Will present top-ranked COA for approval

## Testing Strategy

### Unit Tests (Future)
- Character validation: Objective tone, no bias
- Weighted scoring formula: Correct calculation
- Tool schemas: Valid input/output types
- Ranking logic: Consistent ordering

### Integration Tests (Future)
- End-to-end comparison: Generate 3 COAs → compare → verify rankings
- Red team integration: Ensure red team results influence scores
- Mission criteria: Verify commander guidance considered

### Manual Verification
1. Create 3 COAs with varying characteristics
2. Run compareCOAs(planId)
3. Verify all 5 criteria scored with rationale
4. Verify weighted overall score calculated correctly
5. Verify rankings assigned (1, 2, 3)
6. Verify top-ranked COA returned

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

### Blockers
None.

### Concerns
- **Character consistency**: Need to validate character produces objective analysis across diverse scenarios
- **Scoring calibration**: May need to tune weights based on commander feedback
- **Red team weight**: Currently implicit - may need explicit weight for red team influence

### Recommendations
1. **Add explanation generation**: Tool should generate human-readable comparison summary
2. **Support sensitivity analysis**: Allow adjusting weights to show impact on rankings
3. **Track confidence scores**: Agent should indicate confidence in its assessments

## Lessons Learned

### What Went Well
- Character definition captures objective analysis mindset effectively
- Weighted formula reflects doctrinal priorities clearly
- Tools provide clean interface to COA and mission data
- Progress tracking ensures all COAs scored before completion

### What Could Be Improved
- Could add validation to ensure all 5 criteria scored for each COA
- Could add checks for score consistency (e.g., high suitability should correlate with high overall)
- Could add comparison matrix generation for human-readable output

### For Next Time
- Consider adding batch scoring optimization for large COA sets
- Add support for commander-provided comparison guidance
- Include sensitivity analysis in initial implementation

## Files Changed

### Created (3 files)
1. `backend/src/planning/agents/coa-comparator-character.ts` (95 lines)
   - Objective analysis character definition
   - Five doctrinal criteria in knowledge base
   - Message examples showing objective comparison

2. `backend/src/planning/agents/coa-comparator-tools.ts` (137 lines)
   - GetAllCOAsTool: Retrieve COAs with red team results
   - GetMissionCriteriaTool: Get mission criteria and commander guidance
   - SaveComparisonScoreTool: Save weighted scores and rankings
   - getCOAComparatorTools factory function

3. `backend/src/planning/agents/coa-comparator.ts` (187 lines)
   - LangGraph workflow with agent, tool, and check nodes
   - ComparatorState annotation with progress tracking
   - compareCOAs() execution function
   - coaComparatorAgent export for orchestration

### Modified (1 file)
1. `backend/src/planning/agents/index.ts` (18 lines)
   - Exported COA_COMPARATOR_CHARACTER
   - Exported coaComparatorAgent, compareCOAs, createCOAComparatorGraph
   - Exported getCOAComparatorTools

## Commits

1. **f7cbcf6** - feat(05-07): create COA Comparator character and tools
   - Objective analysis character for doctrinal comparison
   - Five comparison criteria in knowledge base
   - GetAllCOAsTool to retrieve COAs with red team results
   - GetMissionCriteriaTool for mission context
   - SaveComparisonScoreTool with weighted scoring formula
   - Suitability weighted highest at 30%

2. **f00cbad** - feat(05-07): create COA Comparator LangGraph agent
   - LangGraph workflow with objective scoring
   - Weighted scoring formula (suitability 30%, feasibility 25%, acceptability 25%)
   - Rankings assigned after all COAs scored
   - Progress tracking with check node
   - Returns top-ranked COA with comparison results
   - Exported from agents module

## Success Criteria Met

- [x] Consistent scoring methodology
- [x] Five doctrinal criteria evaluated
- [x] Rationale provided for each score (in tool schema)
- [x] Rankings support commander decision
- [x] All three agents exported from module

---

**Phase 05 Progress:** 5/13 plans complete (38%)
**Next:** 05-08 Workflow Orchestration (JP 5-0 step-by-step automation)
