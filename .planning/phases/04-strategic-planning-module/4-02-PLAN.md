---
phase: 04-strategic-planning-module
plan: 02
type: execute
domain: data-model
---

<objective>
Define the strategic planning data model based on military doctrine (DIME framework, Ends-Ways-Means).

Purpose: Create Zod schemas and TypeScript types that model strategic objectives per JP 5-0, NDS/NMS hierarchy, and provide the foundation for LLM extraction.
Output: Complete data model with Zod schemas for validation, TypeScript types for type safety, and PostgreSQL migrations for persistence.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-strategic-planning-module/4-RESEARCH.md
@.planning/phases/04-strategic-planning-module/4-01-PLAN.md

# Relevant source files
@backend/src/strategic/ingestion/types.ts

**Tech stack available:**
- Zod for schema validation (already installed, used throughout backend)
- PostgreSQL for persistence

**From research (strategic_planning_doctrine):**
- Document hierarchy: NSS → NDS → NMS → GEF → JSCP
- DIME framework: Diplomatic, Informational, Military, Economic
- Ends-Ways-Means doctrine: ends (desired outcomes), ways (strategies), means (resources)
- Risk assessment: 5x5 matrix (likelihood × impact)
- Commander's Intent structure per JP 5-0

**Constraining decisions:**
- [Phase 3-01]: Classification levels as constants (UNCLASS through TOPSECRET)
- [Phase 2-04]: Classification hierarchy numeric levels for comparison
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Zod schemas for DIME and Ends-Ways-Means</name>
  <files>backend/src/strategic/schemas/dime.ts, backend/src/strategic/schemas/ends-ways-means.ts, backend/src/strategic/schemas/index.ts</files>
  <action>
Create backend/src/strategic/schemas/ directory with:

In dime.ts:
- DIMEInstrumentSchema: z.enum(['DIPLOMATIC', 'INFORMATIONAL', 'MILITARY', 'ECONOMIC'])
- DIMEFILInstrumentSchema: extends DIME with 'FINANCIAL', 'INTELLIGENCE', 'LAW_ENFORCEMENT'
- Export types: DIMEInstrument, DIMEFILInstrument

In ends-ways-means.ts:
- EndsSchema: z.object with:
  - description: z.string().describe('Desired end state - what success looks like')
  - conditions: z.array(z.string()).describe('Measurable conditions for success')
  - timeframe: z.string().optional().describe('When to achieve')

- WaysSchema: z.object with:
  - strategies: z.array(z.string()).describe('High-level approaches')
  - concepts: z.array(z.string()).describe('Operational concepts')
  - keyTasks: z.array(z.string()).describe('Essential tasks')

- MeansSchema: z.object with:
  - forces: z.array(z.string()).describe('Military forces')
  - capabilities: z.array(z.string()).describe('Required capabilities')
  - resources: z.array(z.string()).describe('Funding, materiel')

- EndsWaysMeansSchema: z.object combining all three
- Export types: Ends, Ways, Means, EndsWaysMeans

In index.ts:
- Export all schemas and types from both files
- Add barrel exports for convenience

Use .describe() on all Zod fields - these become LLM prompt hints for Instructor-JS extraction.
  </action>
  <verify>
```bash
cd backend && npx tsx -e "
import { DIMEInstrumentSchema, EndsWaysMeansSchema } from './src/strategic/schemas/index.js';
console.log('DIME options:', DIMEInstrumentSchema.options);
console.log('EWM shape:', Object.keys(EndsWaysMeansSchema.shape));
"
```
  </verify>
  <done>
- DIMEInstrumentSchema and DIMEFILInstrumentSchema defined
- EndsSchema, WaysSchema, MeansSchema, EndsWaysMeansSchema defined
- All schemas have .describe() for LLM hints
- Types exported for TypeScript use
  </done>
</task>

<task type="auto">
  <name>Task 2: Create strategic objective and risk assessment schemas</name>
  <files>backend/src/strategic/schemas/strategic-objective.ts, backend/src/strategic/schemas/risk-assessment.ts, backend/src/strategic/schemas/commander-intent.ts</files>
  <action>
In strategic-objective.ts:
- PrioritySchema: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
- ObjectiveStatusSchema: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'OPERATIONALIZED'])
- ExtractedBySchema: z.enum(['HUMAN', 'AI'])

- StrategicObjectiveSchema: z.object with:
  - id: z.string()
  - documentId: z.string().describe('Source document ID')
  - sourceReference: z.string().describe('Page/section in source')
  - description: z.string().describe('Full text of the strategic objective')
  - endsWaysMeans: EndsWaysMeansSchema
  - primaryInstrument: DIMEInstrumentSchema.describe('Primary DIME category')
  - supportingInstruments: z.array(DIMEInstrumentSchema).default([])
  - parentObjectiveId: z.string().optional()
  - childObjectiveIds: z.array(z.string()).default([])
  - constraints: z.array(z.string()).describe('ROE, policy, legal constraints')
  - assumptions: z.array(z.string()).describe('Planning assumptions')
  - risks: z.array(z.string()).describe('Identified risks')
  - status: ObjectiveStatusSchema.default('DRAFT')
  - extractedBy: ExtractedBySchema
  - extractionConfidence: z.number().min(0).max(1).optional()
  - humanVerified: z.boolean().default(false)
  - createdAt: z.date()
  - updatedAt: z.date()

In risk-assessment.ts:
- LikelihoodSchema: z.enum(['ALMOST_CERTAIN', 'LIKELY', 'POSSIBLE', 'UNLIKELY', 'RARE'])
- ImpactSchema: z.enum(['CATASTROPHIC', 'CRITICAL', 'MODERATE', 'MARGINAL', 'NEGLIGIBLE'])
- RiskLevelSchema: z.enum(['EXTREME', 'HIGH', 'MEDIUM', 'LOW'])
- RiskDecisionSchema: z.enum(['ACCEPT', 'AVOID', 'TRANSFER', 'MITIGATE'])

- RiskDimensionSchema: z.object with:
  - likelihood: LikelihoodSchema
  - impact: ImpactSchema
  - riskLevel: RiskLevelSchema.describe('Derived from 5x5 matrix')
  - factors: z.array(z.string())

- MitigationSchema: z.object with:
  - description: z.string()
  - effectiveness: z.enum(['HIGH', 'MEDIUM', 'LOW'])
  - resourceCost: z.enum(['HIGH', 'MEDIUM', 'LOW'])
  - accepted: z.boolean().default(false)

- RiskAssessmentSchema: z.object with:
  - id: z.string()
  - objectiveId: z.string()
  - riskToMission: RiskDimensionSchema
  - riskToForce: RiskDimensionSchema
  - mitigations: z.array(MitigationSchema).default([])
  - riskDecision: RiskDecisionSchema
  - riskDecisionAuthority: z.string().describe('Who can accept this risk level')
  - residualRisk: RiskLevelSchema
  - assessedBy: z.string()
  - assessedAt: z.date()
  - reviewedBy: z.string().optional()
  - reviewedAt: z.date().optional()

Add helper function: calculateRiskLevel(likelihood, impact) => RiskLevel using 5x5 matrix from research.

In commander-intent.ts:
- CommanderIntentSchema: z.object with:
  - id: z.string()
  - objectiveId: z.string()
  - purpose: z.string().describe('Why we are conducting this operation')
  - keyTasks: z.array(z.string()).describe('What must be accomplished')
  - endState: z.string().describe('Conditions that define success')
  - expandedPurpose: z.string().optional()
  - rationale: z.string().optional().describe('Why this approach was chosen')
  - keyDecisions: z.array(z.string()).optional()
  - antiGoals: z.array(z.string()).optional().describe('Outcomes to explicitly avoid')
  - constraints: z.array(z.string()).optional()
  - sourceObjectiveId: z.string()
  - issuedBy: z.string()
  - issuedAt: z.date()
  - classification: z.string()

Update index.ts to export all new schemas and types.
  </action>
  <verify>
```bash
cd backend && npx tsx -e "
import { StrategicObjectiveSchema, RiskAssessmentSchema, CommanderIntentSchema, calculateRiskLevel } from './src/strategic/schemas/index.js';
console.log('Strategic Objective fields:', Object.keys(StrategicObjectiveSchema.shape).length);
console.log('Risk Assessment fields:', Object.keys(RiskAssessmentSchema.shape).length);
console.log('Sample risk calc:', calculateRiskLevel('LIKELY', 'CRITICAL'));
"
```
  </verify>
  <done>
- StrategicObjectiveSchema with DIME, EWM, status, and hierarchy
- RiskAssessmentSchema with 5x5 matrix support
- CommanderIntentSchema per JP 5-0 doctrine
- calculateRiskLevel helper function
- All schemas exported from index.ts
  </done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cd backend && pnpm build` succeeds without TypeScript errors
- [ ] All schemas parse valid data correctly
- [ ] All schemas reject invalid data
- [ ] Types are properly inferred from Zod schemas
- [ ] Risk level calculation follows 5x5 matrix
</verification>

<success_criteria>

- DIME and Ends-Ways-Means schemas defined with .describe() hints
- Strategic objective schema captures full doctrine
- Risk assessment schema supports 5x5 matrix evaluation
- Commander's intent schema matches JP 5-0
- All schemas ready for Instructor-JS extraction
  </success_criteria>

<output>
After completion, create `.planning/phases/04-strategic-planning-module/4-02-SUMMARY.md`
</output>
