---
phase: 04-strategic-planning-module
plan: 05
type: execute
domain: risk-assessment
---

<objective>
Implement risk assessment framework with 5x5 matrix and AI-assisted analysis.

Purpose: Provide systematic risk-to-mission and risk-to-force assessment for strategic objectives, with AI-generated assessments that require human review.
Output: RiskAssessmentService with calculation logic, AI assessment generation, and PostgreSQL storage.
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

# Relevant source files (after prior plans complete)
@backend/src/strategic/schemas/risk-assessment.ts
@backend/src/strategic/extraction/extractor.ts
@backend/src/lib/database.ts

**From research (strategic_planning_doctrine):**
- 5x5 risk matrix: Likelihood (5 levels) × Impact (5 levels)
- Risk-to-Mission: probability × impact of not achieving objective
- Risk-to-Force: probability × impact of harm to forces/resources
- Risk decision authority varies by level
- Mitigations tracked with effectiveness and cost

**From research (ai_agent_architecture):**
- Assessment Agent generates risks, humans review
- Auto-flag threshold for high/extreme risks
- Include confidence score and questions for reviewer
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create risk calculation utilities and database storage</name>
  <files>backend/src/strategic/assessment/risk-calculator.ts, backend/src/strategic/assessment/types.ts, backend/src/strategic/assessment/store.ts</files>
  <action>
Create backend/src/strategic/assessment/ directory.

In types.ts:
- Import RiskAssessment type from schemas
- RiskMatrixEntry: { likelihood: string, impact: string, level: string }
- RiskCalculatorResult: { riskLevel: string, factors: string[], recommendations: string[] }
- AIRiskAssessment extends RiskAssessment with:
  - generatedBy: 'AI_AGENT'
  - confidenceScore: number (0-1)
  - questionsForReviewer: string[]
  - autoFlags: { flag: string, reason: string, severity: 'INFO' | 'WARNING' | 'CRITICAL' }[]

In risk-calculator.ts:
Create RISK_MATRIX as 2D lookup table implementing 5x5 matrix from research:

```typescript
const LIKELIHOOD_ORDER = ['RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN'];
const IMPACT_ORDER = ['NEGLIGIBLE', 'MARGINAL', 'MODERATE', 'CRITICAL', 'CATASTROPHIC'];

// Matrix[likelihood_index][impact_index] = risk level
const RISK_MATRIX: RiskLevel[][] = [
  // RARE
  ['LOW', 'LOW', 'LOW', 'LOW', 'MEDIUM'],
  // UNLIKELY
  ['LOW', 'LOW', 'LOW', 'MEDIUM', 'HIGH'],
  // POSSIBLE
  ['LOW', 'LOW', 'MEDIUM', 'HIGH', 'HIGH'],
  // LIKELY
  ['LOW', 'MEDIUM', 'HIGH', 'HIGH', 'EXTREME'],
  // ALMOST_CERTAIN
  ['MEDIUM', 'HIGH', 'HIGH', 'EXTREME', 'EXTREME'],
];
```

Functions:
- calculateRiskLevel(likelihood, impact): RiskLevel - lookup in matrix
- getRiskDecisionAuthority(riskLevel): string - returns authority level per doctrine
  - LOW: 'Staff officer'
  - MEDIUM: 'O-6/GS-15 or designated representative'
  - HIGH: 'General/Flag Officer or SES'
  - EXTREME: 'Commander or designated general/flag officer'
- combineRiskLevels(riskToMission, riskToForce): RiskLevel - returns higher of the two
- shouldAutoFlag(assessment: RiskAssessment): boolean - true if HIGH or EXTREME

In store.ts:
Create RiskAssessmentStore class for PostgreSQL:

Table schema:
```sql
CREATE TABLE IF NOT EXISTS risk_assessments (
  id TEXT PRIMARY KEY,
  objective_id TEXT NOT NULL REFERENCES strategic_objectives(id),
  risk_to_mission JSONB NOT NULL,
  risk_to_force JSONB NOT NULL,
  mitigations JSONB NOT NULL DEFAULT '[]',
  risk_decision TEXT NOT NULL,
  risk_decision_authority TEXT NOT NULL,
  residual_risk TEXT NOT NULL,
  assessed_by TEXT NOT NULL,
  assessed_at TIMESTAMPTZ NOT NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  ai_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_objective ON risk_assessments(objective_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_residual ON risk_assessments(residual_risk);
```

Methods:
- saveAssessment(assessment: RiskAssessment): Promise<void>
- getAssessment(id: string): Promise<RiskAssessment | null>
- getAssessmentsForObjective(objectiveId: string): Promise<RiskAssessment[]>
- updateReview(id: string, reviewedBy: string): Promise<void>
- getHighRiskAssessments(): Promise<RiskAssessment[]> - returns HIGH/EXTREME
  </action>
  <verify>
```bash
cd backend && npx tsx -e "
import { calculateRiskLevel, getRiskDecisionAuthority, shouldAutoFlag } from './src/strategic/assessment/risk-calculator.js';
console.log('LIKELY + CRITICAL =', calculateRiskLevel('LIKELY', 'CRITICAL'));
console.log('Authority for HIGH:', getRiskDecisionAuthority('HIGH'));
console.log('Should flag HIGH:', shouldAutoFlag({ residualRisk: 'HIGH' } as any));
"
```
  </verify>
  <done>
- 5x5 RISK_MATRIX implemented correctly
- calculateRiskLevel function
- getRiskDecisionAuthority per doctrine
- shouldAutoFlag for HIGH/EXTREME risks
- RiskAssessmentStore with PostgreSQL CRUD
- risk_assessments table with indexes
  </done>
</task>

<task type="auto">
  <name>Task 2: Create AI-assisted risk assessment service</name>
  <files>backend/src/strategic/assessment/service.ts, backend/src/strategic/assessment/index.ts</files>
  <action>
In service.ts, create RiskAssessmentService class:

```typescript
import Instructor from '@instructor-ai/instructor';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
```

Define AI extraction schema for risk assessment:
```typescript
const AIRiskInputSchema = z.object({
  riskToMission: z.object({
    likelihood: LikelihoodSchema,
    impact: ImpactSchema,
    factors: z.array(z.string()).describe('Contributing factors to this risk'),
  }),
  riskToForce: z.object({
    likelihood: LikelihoodSchema,
    impact: ImpactSchema,
    factors: z.array(z.string()).describe('Contributing factors to this risk'),
  }),
  mitigations: z.array(z.object({
    description: z.string(),
    effectiveness: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    resourceCost: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  })),
  assumptions: z.array(z.string()).describe('Assumptions underlying this assessment'),
  uncertainties: z.array(z.string()).describe('Areas of uncertainty'),
  questionsForReviewer: z.array(z.string()).describe('Questions for human reviewer to consider'),
  confidenceScore: z.number().min(0).max(1),
});
```

Methods:

generateAIAssessment(objective: StrategicObjective, context?: string): Promise<AIRiskAssessment>
- Use Instructor to generate risk assessment
- System prompt: Risk assessment analyst, 5x5 matrix, military doctrine
- Include objective description, ends-ways-means, constraints
- Calculate riskLevel using matrix
- Add auto-flags for HIGH/EXTREME
- Return AIRiskAssessment with questionsForReviewer

System prompt:
```
You are a military risk assessment analyst evaluating strategic objectives.

Use the 5x5 Risk Matrix:
- Likelihood: RARE, UNLIKELY, POSSIBLE, LIKELY, ALMOST_CERTAIN
- Impact: NEGLIGIBLE, MARGINAL, MODERATE, CRITICAL, CATASTROPHIC

Assess two risk dimensions:
1. Risk-to-Mission: Probability and impact of failing to achieve the objective
2. Risk-to-Force: Probability and impact of harm to forces, resources, or capabilities

For each risk:
- Identify specific factors contributing to the risk
- Propose mitigations with effectiveness and resource cost
- Flag uncertainties honestly

Be conservative: when uncertain, assess higher risk.
Always include questions for human reviewers to validate your assessment.
```

createAssessment(objectiveId: string, assessedBy: string, input?: Partial<RiskAssessment>): Promise<RiskAssessment>
- Either use provided input or generate via AI
- Calculate derived fields (riskLevel, authority)
- Save to database
- Return complete assessment

reviewAssessment(assessmentId: string, reviewerId: string, approved: boolean, modifications?: Partial<RiskAssessment>): Promise<RiskAssessment>
- Load assessment
- Apply any modifications
- Mark as reviewed
- Update database
- Return updated assessment

In index.ts:
- Export RiskAssessmentService, RiskAssessmentStore, calculators
- Export singleton: export const riskAssessmentService = new RiskAssessmentService();
  </action>
  <verify>
```bash
cd backend && npx tsx -e "
import { RiskAssessmentService } from './src/strategic/assessment/index.js';
const service = new RiskAssessmentService();
console.log('RiskAssessmentService instantiated');
console.log('Has generateAIAssessment:', typeof service.generateAIAssessment === 'function');
console.log('Has createAssessment:', typeof service.createAssessment === 'function');
"
```
  </verify>
  <done>
- RiskAssessmentService with AI-assisted assessment generation
- Instructor-JS integration for structured risk extraction
- Risk matrix calculation for derived fields
- Auto-flagging for high-risk assessments
- Human review workflow support
- Database persistence for assessments
  </done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cd backend && pnpm build` succeeds without TypeScript errors
- [ ] Risk matrix calculation matches 5x5 doctrine
- [ ] AI assessment generation produces valid schema output
- [ ] Database storage and retrieval works
- [ ] High-risk auto-flagging works correctly
</verification>

<success_criteria>

- 5x5 risk matrix fully implemented
- Risk-to-Mission and Risk-to-Force both calculated
- AI-assisted assessment generation with confidence scores
- Questions for reviewer generated automatically
- Auto-flagging of HIGH/EXTREME risks
- Ready for API integration in Plan 4-06
  </success_criteria>

<output>
After completion, create `.planning/phases/04-strategic-planning-module/4-05-SUMMARY.md`
</output>
