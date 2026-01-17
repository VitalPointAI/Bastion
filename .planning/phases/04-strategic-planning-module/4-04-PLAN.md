---
phase: 04-strategic-planning-module
plan: 04
type: execute
domain: workflow-engine
---

<objective>
Implement XState v5 approval workflow engine for strategic objectives.

Purpose: Manage multi-stakeholder approval process for extracted strategic objectives with state persistence, audit trail, and escalation logic.
Output: ApprovalWorkflowEngine with XState machines, database persistence, and API integration.
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

# Prior phase context
@.planning/phases/03-dao-governance/3-03-SUMMARY.md

# Relevant source files
@backend/src/strategic/schemas/strategic-objective.ts
@backend/src/lib/database.ts

**From research (architecture_patterns):**
- XState v5 with actor model
- States: DRAFT → SUBMITTED → UNDER_REVIEW → [APPROVED | REJECTED | ESCALATED]
- Persist workflow state to PostgreSQL on every transition
- Idempotent event handling

**From research (dont_hand_roll):**
- Don't build custom state management - use XState v5
- Don't skip persistence - every transition must be logged

**Constraining decisions:**
- [Phase 3-03]: Voting engine patterns with configurable policies
- [4-RESEARCH]: Escalation timeouts by risk level
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install XState v5 and create approval state machine</name>
  <files>backend/package.json, backend/src/strategic/workflows/approval-machine.ts, backend/src/strategic/workflows/types.ts</files>
  <action>
Install XState v5:
```bash
cd backend && pnpm add xstate
```

Create backend/src/strategic/workflows/ directory.

In types.ts:
- ApprovalContext interface:
  - objectiveId: string
  - documentId: string
  - submittedBy: string
  - submittedAt: Date
  - reviewers: string[] // DIDs of required reviewers
  - approvals: ApprovalDecision[]
  - currentReviewerIndex: number
  - riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'
  - escalatedTo?: string
  - escalatedAt?: Date
  - finalDecision?: 'APPROVED' | 'REJECTED'
  - comments: WorkflowComment[]

- ApprovalDecision: { reviewerId: string, decision: 'APPROVE' | 'REJECT' | 'REQUEST_REVISION', comment?: string, decidedAt: Date }
- WorkflowComment: { authorId: string, content: string, createdAt: Date }

- ApprovalEvent type union:
  - { type: 'SUBMIT', objectiveId: string, submittedBy: string, reviewers: string[], riskLevel: string }
  - { type: 'REVIEW', reviewerId: string, decision: 'APPROVE' | 'REJECT' | 'REQUEST_REVISION', comment?: string }
  - { type: 'ESCALATE', reason: string, escalateTo: string }
  - { type: 'WITHDRAW' }
  - { type: 'TIMEOUT' }
  - { type: 'ADD_COMMENT', authorId: string, content: string }

In approval-machine.ts:
Create XState v5 machine using setup():

```typescript
import { setup, assign } from 'xstate';

const approvalMachine = setup({
  types: {
    context: {} as ApprovalContext,
    events: {} as ApprovalEvent,
  },
  guards: {
    allReviewersApproved: ({ context }) =>
      context.approvals.filter(a => a.decision === 'APPROVE').length >= context.reviewers.length,
    hasRejection: ({ context }) =>
      context.approvals.some(a => a.decision === 'REJECT'),
    hasRevisionRequest: ({ context }) =>
      context.approvals.some(a => a.decision === 'REQUEST_REVISION'),
    moreReviewersRemaining: ({ context }) =>
      context.currentReviewerIndex < context.reviewers.length - 1,
  },
  actions: {
    recordApproval: assign({
      approvals: ({ context, event }) => {
        if (event.type !== 'REVIEW') return context.approvals;
        return [...context.approvals, {
          reviewerId: event.reviewerId,
          decision: event.decision,
          comment: event.comment,
          decidedAt: new Date(),
        }];
      },
    }),
    advanceReviewer: assign({
      currentReviewerIndex: ({ context }) => context.currentReviewerIndex + 1,
    }),
    setFinalApproved: assign({ finalDecision: 'APPROVED' as const }),
    setFinalRejected: assign({ finalDecision: 'REJECTED' as const }),
    recordEscalation: assign({
      escalatedTo: ({ event }) => event.type === 'ESCALATE' ? event.escalateTo : undefined,
      escalatedAt: () => new Date(),
    }),
    addComment: assign({
      comments: ({ context, event }) => {
        if (event.type !== 'ADD_COMMENT') return context.comments;
        return [...context.comments, { authorId: event.authorId, content: event.content, createdAt: new Date() }];
      },
    }),
  },
}).createMachine({
  id: 'objectiveApproval',
  initial: 'draft',
  context: {
    objectiveId: '',
    documentId: '',
    submittedBy: '',
    submittedAt: new Date(),
    reviewers: [],
    approvals: [],
    currentReviewerIndex: 0,
    riskLevel: 'LOW' as const,
    comments: [],
  },
  states: {
    draft: {
      on: {
        SUBMIT: {
          target: 'pendingReview',
          actions: assign({
            objectiveId: ({ event }) => event.objectiveId,
            submittedBy: ({ event }) => event.submittedBy,
            reviewers: ({ event }) => event.reviewers,
            riskLevel: ({ event }) => event.riskLevel as any,
            submittedAt: () => new Date(),
          }),
        },
      },
    },
    pendingReview: {
      on: {
        REVIEW: [
          { guard: 'hasRejection', target: 'rejected', actions: ['recordApproval', 'setFinalRejected'] },
          { guard: 'hasRevisionRequest', target: 'pendingRevision', actions: 'recordApproval' },
          { guard: 'allReviewersApproved', target: 'approved', actions: ['recordApproval', 'setFinalApproved'] },
          { guard: 'moreReviewersRemaining', actions: ['recordApproval', 'advanceReviewer'] },
          { actions: 'recordApproval' },
        ],
        WITHDRAW: 'withdrawn',
        ESCALATE: { target: 'escalated', actions: 'recordEscalation' },
        TIMEOUT: 'escalated',
        ADD_COMMENT: { actions: 'addComment' },
      },
    },
    pendingRevision: {
      on: {
        SUBMIT: { target: 'pendingReview', actions: assign({ approvals: [] }) },
        WITHDRAW: 'withdrawn',
      },
    },
    escalated: {
      on: {
        REVIEW: [
          { guard: 'hasRejection', target: 'rejected', actions: ['recordApproval', 'setFinalRejected'] },
          { target: 'approved', actions: ['recordApproval', 'setFinalApproved'] },
        ],
      },
    },
    approved: { type: 'final' },
    rejected: { type: 'final' },
    withdrawn: { type: 'final' },
  },
});

export { approvalMachine };
```

Export the machine and types.
  </action>
  <verify>
```bash
cd backend && npx tsx -e "
import { approvalMachine } from './src/strategic/workflows/approval-machine.js';
console.log('Machine ID:', approvalMachine.id);
console.log('Initial state:', approvalMachine.config.initial);
console.log('States:', Object.keys(approvalMachine.config.states));
"
```
  </verify>
  <done>
- XState v5 installed
- ApprovalContext and ApprovalEvent types defined
- approvalMachine with states: draft, pendingReview, pendingRevision, escalated, approved, rejected, withdrawn
- Guards for reviewer logic
- Actions for state updates
  </done>
</task>

<task type="auto">
  <name>Task 2: Create WorkflowEngine with database persistence</name>
  <files>backend/src/strategic/workflows/engine.ts, backend/src/strategic/workflows/index.ts</files>
  <action>
In engine.ts, create WorkflowEngine class:

```typescript
import { createActor, waitFor, Snapshot } from 'xstate';
import { pool } from '../../lib/database.js';
import { approvalMachine } from './approval-machine.js';
```

On initialization, ensure workflow_states table exists:
```sql
CREATE TABLE IF NOT EXISTS workflow_states (
  id TEXT PRIMARY KEY,
  objective_id TEXT NOT NULL,
  state_value TEXT NOT NULL,
  context JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_objective FOREIGN KEY (objective_id) REFERENCES strategic_objectives(id)
);
CREATE INDEX IF NOT EXISTS idx_workflow_states_objective ON workflow_states(objective_id);

CREATE TABLE IF NOT EXISTS workflow_events (
  id SERIAL PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflow_events_workflow ON workflow_events(workflow_id);
```

Methods:

persistState(workflowId: string, snapshot: Snapshot<any>): Promise<void>
- INSERT or UPDATE workflow_states with serialized snapshot
- Use parameterized query to prevent SQL injection

loadState(workflowId: string): Promise<Snapshot<any> | null>
- SELECT from workflow_states
- Parse and return snapshot, or null if not found

logEvent(workflowId: string, event: ApprovalEvent, actorId: string): Promise<void>
- INSERT into workflow_events for audit trail

getOrCreateActor(objectiveId: string): Promise<Actor>
- workflowId = `approval-${objectiveId}`
- Try to load existing state
- Create actor with restored state or fresh
- Subscribe to state changes for auto-persistence
- Return started actor

sendEvent(objectiveId: string, event: ApprovalEvent, actorId: string): Promise<WorkflowStatus>
- Get or create actor
- Log event to audit table
- Send event to actor
- Wait for stable state
- Return current status

getWorkflowStatus(objectiveId: string): Promise<WorkflowStatus | null>
- Load state and return formatted status
- WorkflowStatus: { state: string, context: ApprovalContext, canTransition: string[], history: WorkflowEvent[] }

getWorkflowHistory(objectiveId: string): Promise<WorkflowEvent[]>
- SELECT from workflow_events ORDER BY created_at

In index.ts:
- Export WorkflowEngine
- Export types and machine
- Export singleton instance: export const workflowEngine = new WorkflowEngine();

Error handling:
- Database errors should be logged and re-thrown
- Actor errors should be caught and logged with context
  </action>
  <verify>
```bash
cd backend && npx tsx -e "
import { WorkflowEngine } from './src/strategic/workflows/index.js';
const engine = new WorkflowEngine();
console.log('WorkflowEngine instantiated');
console.log('Has sendEvent:', typeof engine.sendEvent === 'function');
console.log('Has getWorkflowStatus:', typeof engine.getWorkflowStatus === 'function');
"
```
  </verify>
  <done>
- WorkflowEngine class with PostgreSQL persistence
- workflow_states table for XState snapshots
- workflow_events table for audit trail
- getOrCreateActor restores or creates actors
- sendEvent logs and processes events
- getWorkflowStatus returns current state
- getWorkflowHistory returns audit trail
  </done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cd backend && pnpm build` succeeds without TypeScript errors
- [ ] XState machine has correct state transitions
- [ ] Workflow state persists to database
- [ ] Event history is logged
- [ ] Actor restoration works from saved state
</verification>

<success_criteria>

- XState v5 approval machine with all required states
- Database persistence on every state transition
- Audit trail logging of all events
- Actor restoration from saved state
- Ready for API integration in Plan 4-06
  </success_criteria>

<output>
After completion, create `.planning/phases/04-strategic-planning-module/4-04-SUMMARY.md`
</output>
