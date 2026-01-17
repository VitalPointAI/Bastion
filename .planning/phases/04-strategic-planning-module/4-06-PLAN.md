---
phase: 04-strategic-planning-module
plan: 06
type: execute
domain: api
---

<objective>
Create REST API endpoints for strategic planning operations.

Purpose: Expose document ingestion, objective extraction, approval workflows, and risk assessment through unified API.
Output: Complete strategic planning API with endpoints for all operations.
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

# Prior plan context
@.planning/phases/04-strategic-planning-module/4-01-PLAN.md
@.planning/phases/04-strategic-planning-module/4-02-PLAN.md
@.planning/phases/04-strategic-planning-module/4-03-PLAN.md
@.planning/phases/04-strategic-planning-module/4-04-PLAN.md
@.planning/phases/04-strategic-planning-module/4-05-PLAN.md

# Relevant source files
@backend/src/api/strategic.ts
@backend/src/strategic/extraction/index.ts
@backend/src/strategic/workflows/index.ts
@backend/src/strategic/assessment/index.ts

**Established patterns:**
- Express 5.x route params require `as string` assertions
- ESM imports with .js extensions
- X-DID header for authentication
- Consistent error response format { error: string }
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create strategic objectives API endpoints</name>
  <files>backend/src/api/strategic.ts, backend/src/strategic/objectives/store.ts</files>
  <action>
First, create backend/src/strategic/objectives/store.ts for objective CRUD:

```sql
CREATE TABLE IF NOT EXISTS strategic_objectives (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES strategic_documents(id),
  source_reference TEXT NOT NULL,
  description TEXT NOT NULL,
  ends_ways_means JSONB NOT NULL,
  primary_instrument TEXT NOT NULL,
  supporting_instruments TEXT[] NOT NULL DEFAULT '{}',
  parent_objective_id TEXT REFERENCES strategic_objectives(id),
  constraints TEXT[] NOT NULL DEFAULT '{}',
  assumptions TEXT[] NOT NULL DEFAULT '{}',
  risks TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  extracted_by TEXT NOT NULL,
  extraction_confidence REAL,
  human_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_objectives_document ON strategic_objectives(document_id);
CREATE INDEX IF NOT EXISTS idx_objectives_status ON strategic_objectives(status);
CREATE INDEX IF NOT EXISTS idx_objectives_parent ON strategic_objectives(parent_objective_id);
```

ObjectiveStore class with methods:
- saveObjective(objective: StrategicObjective): Promise<void>
- saveObjectives(objectives: StrategicObjective[]): Promise<void> - batch insert
- getObjective(id: string): Promise<StrategicObjective | null>
- getObjectivesForDocument(documentId: string): Promise<StrategicObjective[]>
- updateObjective(id: string, updates: Partial<StrategicObjective>): Promise<void>
- deleteObjective(id: string): Promise<void>
- getObjectivesByStatus(status: string): Promise<StrategicObjective[]>

Update backend/src/api/strategic.ts to add objective endpoints:

POST /api/strategic/documents/:documentId/extract
- Trigger LLM extraction for document
- Use ExtractionService.extractFromDocument()
- Save extracted objectives via ObjectiveStore
- Return { objectiveCount, objectives: ObjectiveSummary[] }

GET /api/strategic/documents/:documentId/objectives
- Get all objectives for a document
- Include extraction metadata

GET /api/strategic/objectives
- List all objectives with filters (status, priority, instrument)
- Pagination: limit, offset query params

GET /api/strategic/objectives/:id
- Get single objective with full details

PUT /api/strategic/objectives/:id
- Update objective (human edits)
- Set human_verified = true if edited
- Record verified_by and verified_at

DELETE /api/strategic/objectives/:id
- Soft delete or hard delete (based on status)

POST /api/strategic/objectives/:id/verify
- Mark objective as human-verified
- Body: { verified: boolean }
  </action>
  <verify>
```bash
cd backend && npx tsx -e "
import { ObjectiveStore } from './src/strategic/objectives/store.js';
const store = new ObjectiveStore();
console.log('ObjectiveStore instantiated');
"
```
  </verify>
  <done>
- strategic_objectives table created
- ObjectiveStore with CRUD operations
- POST extract endpoint triggers LLM extraction
- GET/PUT/DELETE for objectives
- Pagination support
- Human verification endpoint
  </done>
</task>

<task type="auto">
  <name>Task 2: Create workflow and risk assessment API endpoints</name>
  <files>backend/src/api/strategic.ts</files>
  <action>
Add workflow endpoints to api/strategic.ts:

POST /api/strategic/objectives/:id/submit
- Submit objective for approval
- Body: { reviewers: string[] } (DIDs of reviewers)
- Use WorkflowEngine.sendEvent with SUBMIT event
- Calculate risk level and include in submission
- Return workflow status

POST /api/strategic/objectives/:id/review
- Submit review decision
- Body: { decision: 'APPROVE' | 'REJECT' | 'REQUEST_REVISION', comment?: string }
- Use WorkflowEngine.sendEvent with REVIEW event
- Return updated workflow status

GET /api/strategic/objectives/:id/workflow
- Get current workflow status
- Include history of all events
- Use WorkflowEngine.getWorkflowStatus()

POST /api/strategic/objectives/:id/workflow/comment
- Add comment to workflow
- Body: { content: string }

POST /api/strategic/objectives/:id/workflow/escalate
- Escalate to higher authority
- Body: { reason: string, escalateTo: string }

Add risk assessment endpoints:

POST /api/strategic/objectives/:id/assess
- Generate AI risk assessment
- Optional body: { context?: string } for additional context
- Use RiskAssessmentService.generateAIAssessment()
- Return AI assessment with questions for reviewer

GET /api/strategic/objectives/:id/risk
- Get risk assessments for objective
- Use RiskAssessmentStore.getAssessmentsForObjective()

POST /api/strategic/objectives/:id/risk
- Create manual risk assessment
- Body: RiskAssessment input
- Use RiskAssessmentService.createAssessment()

PUT /api/strategic/risk/:assessmentId/review
- Review and approve/modify risk assessment
- Body: { approved: boolean, modifications?: Partial<RiskAssessment> }
- Use RiskAssessmentService.reviewAssessment()

GET /api/strategic/risk/high-risk
- Get all HIGH/EXTREME risk assessments pending review
- Use RiskAssessmentStore.getHighRiskAssessments()

Error handling:
- 404 for not found resources
- 400 for invalid input (use Zod validation)
- 403 for unauthorized actions
- 500 for internal errors (log details, return generic message)
  </action>
  <verify>
```bash
cd backend && npx tsx -e "
import strategicRouter from './src/api/strategic.js';
// Check routes exist
console.log('Strategic router loaded');
"
```

Or test with curl:
```bash
curl http://localhost:3001/api/strategic/objectives -H 'X-DID: test'
```
  </verify>
  <done>
- Workflow submission endpoint
- Review decision endpoint
- Workflow status and history endpoints
- Comment and escalation endpoints
- AI risk assessment generation endpoint
- Manual risk assessment CRUD
- High-risk pending review list
- All endpoints follow consistent patterns
  </done>
</task>

<task type="auto">
  <name>Task 3: Create commander's intent endpoints</name>
  <files>backend/src/strategic/intent/store.ts, backend/src/api/strategic.ts</files>
  <action>
Create backend/src/strategic/intent/store.ts:

```sql
CREATE TABLE IF NOT EXISTS commander_intents (
  id TEXT PRIMARY KEY,
  objective_id TEXT NOT NULL REFERENCES strategic_objectives(id),
  purpose TEXT NOT NULL,
  key_tasks TEXT[] NOT NULL,
  end_state TEXT NOT NULL,
  expanded_purpose TEXT,
  rationale TEXT,
  key_decisions TEXT[],
  anti_goals TEXT[],
  constraints TEXT[],
  source_objective_id TEXT NOT NULL,
  issued_by TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  classification TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_intents_objective ON commander_intents(objective_id);
CREATE INDEX IF NOT EXISTS idx_intents_issued_by ON commander_intents(issued_by);
```

IntentStore class with:
- saveIntent(intent: CommanderIntent): Promise<void>
- getIntent(id: string): Promise<CommanderIntent | null>
- getIntentsForObjective(objectiveId: string): Promise<CommanderIntent[]>
- updateIntent(id: string, updates: Partial<CommanderIntent>): Promise<void>

Add API endpoints to strategic.ts:

POST /api/strategic/objectives/:id/intent
- Create commander's intent from approved objective
- Only allowed for APPROVED objectives
- Body: CommanderIntent input (purpose, keyTasks, endState, etc.)
- Auto-populate sourceObjectiveId from path
- Return created intent

GET /api/strategic/objectives/:id/intent
- Get commander's intents for objective

PUT /api/strategic/intent/:intentId
- Update commander's intent
- Record modification history

POST /api/strategic/objectives/:id/intent/generate
- AI-assist intent generation from objective
- Use Instructor-JS to draft intent based on objective EWM
- Return draft for human review/editing

GET /api/strategic/objectives/:id/operationalize
- Get readiness status for operationalization
- Check: objective APPROVED, risk assessed and accepted, intent drafted
- Return { ready: boolean, blockers: string[] }

POST /api/strategic/objectives/:id/operationalize
- Mark objective as OPERATIONALIZED
- Update status
- Create planning directive (simple JSON structure for Phase 5 input)
- Return { status: 'OPERATIONALIZED', planningDirectiveId }
  </action>
  <verify>
```bash
cd backend && npx tsx -e "
import { IntentStore } from './src/strategic/intent/store.js';
const store = new IntentStore();
console.log('IntentStore instantiated');
"
```
  </verify>
  <done>
- commander_intents table created
- IntentStore with CRUD operations
- Intent creation endpoint (from approved objectives)
- AI-assisted intent generation
- Operationalization readiness check
- Operationalization endpoint for Phase 5 handoff
  </done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cd backend && pnpm build` succeeds without TypeScript errors
- [ ] All endpoints respond correctly to requests
- [ ] Authentication required on all endpoints
- [ ] Error responses follow consistent format
- [ ] Database tables created correctly
</verification>

<success_criteria>

- Complete strategic planning API
- Document upload and extraction endpoints
- Objective CRUD with verification
- Workflow submission and review endpoints
- Risk assessment generation and review
- Commander's intent management
- Operationalization endpoint for Phase 5 handoff
  </success_criteria>

<output>
After completion, create `.planning/phases/04-strategic-planning-module/4-06-SUMMARY.md`
</output>
