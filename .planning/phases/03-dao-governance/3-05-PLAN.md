---
phase: 03-dao-governance
plan: 05
type: execute
---

<objective>
Create backend DAO service and REST API endpoints with classification filtering.

Purpose: Expose DAO governance functionality through secure backend APIs that respect clearance levels and integrate with existing identity infrastructure.
Output: DAO service for contract interactions, REST API endpoints, clearance-based response filtering.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03-dao-governance/3-CONTEXT.md
@.planning/phases/02-identity-security-framework/2-07-SUMMARY.md
@backend/src/index.ts
@backend/src/api/identity.ts
@backend/src/security/middleware/zero-trust.ts

**Tech stack available:**
- Express.js with TypeScript
- @near-js/providers for NEAR RPC
- Zero Trust middleware from 2-07
- ABAC core from 2-04
- DID service from 2-03

**Established patterns:**
- REST endpoints in backend/src/api/
- Services in backend/src/lib/ or dedicated folders
- Zero trust middleware for authentication
- Classification-based filtering
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create DAO service for contract interactions</name>
  <files>backend/src/dao/dao-service.ts, backend/src/dao/types.ts</files>
  <action>
Create backend/src/dao/ directory with DAO service:

**types.ts:**
TypeScript interfaces mirroring contract types:
```typescript
export enum AutonomyLevel {
  Autonomous = 'Autonomous',
  SemiAutonomous = 'SemiAutonomous',
  NotAutonomous = 'NotAutonomous'
}

export enum ProposalKind {
  ConfigChange = 'ConfigChange',
  AddMember = 'AddMember',
  RemoveMember = 'RemoveMember',
  Transfer = 'Transfer',
  FunctionCall = 'FunctionCall',
  StrikeAuthorization = 'StrikeAuthorization',
  MissionOrder = 'MissionOrder',
  Custom = 'Custom'
}

export enum ProposalStatus {
  InProgress = 'InProgress',
  Approved = 'Approved',
  Rejected = 'Rejected',
  Removed = 'Removed',
  Expired = 'Expired',
  Failed = 'Failed'
}

export enum ExecutionState {
  Pending = 'Pending',
  ReadyForExecution = 'ReadyForExecution',
  InVetoWindow = 'InVetoWindow',
  AwaitingHumanApproval = 'AwaitingHumanApproval',
  Executed = 'Executed',
  Vetoed = 'Vetoed',
  Rejected = 'Rejected'
}

export enum VoteType {
  Approve = 'Approve',
  Reject = 'Reject',
  Abstain = 'Abstain'
}

export interface DAOConfig { ... }
export interface DAOMetadata { ... }
export interface Proposal { ... }
export interface Vote { ... }
export interface CoalitionProposal { ... }
// ... all types matching contract
```

**dao-service.ts:**
```typescript
import { JsonRpcProvider } from '@near-js/providers';
import { DAOConfig, DAOMetadata, Proposal, ... } from './types.js';

export class DAOService {
  private provider: JsonRpcProvider;
  private contractId: string;

  constructor(rpcUrl: string, contractId: string) {
    this.provider = new JsonRpcProvider({ url: rpcUrl });
    this.contractId = contractId;
  }

  // View methods (no auth required, but filter by clearance)
  async getDAO(daoId: string): Promise<DAOMetadata | null>
  async listDAOs(offset: number, limit: number): Promise<DAOMetadata[]>
  async getProposal(daoId: string, proposalId: number): Promise<Proposal | null>
  async listProposals(daoId: string, offset: number, limit: number): Promise<Proposal[]>
  async getVotes(daoId: string, proposalId: number): Promise<Vote[]>
  async getExecutionState(daoId: string, proposalId: number): Promise<ExecutionState>
  async getMemberRoles(daoId: string, account: string): Promise<string[]>
  async getCoalitionStatus(daoId: string, proposalId: number): Promise<CoalitionProposal | null>

  // Change methods (require signed transaction)
  // These return the transaction args for frontend to sign
  buildCreateDAOTx(config: DAOConfig): TransactionArgs
  buildCreateProposalTx(daoId: string, kind: ProposalKind, description: string, classification: string): TransactionArgs
  buildCastVoteTx(daoId: string, proposalId: number, voteType: VoteType): TransactionArgs
  buildSubmitVetoTx(daoId: string, proposalId: number): TransactionArgs
  buildSubmitHumanApprovalTx(daoId: string, proposalId: number): TransactionArgs
  buildRecordCoalitionApprovalTx(daoId: string, proposalId: number, party: string): TransactionArgs

  // Helper methods
  async getActiveProposalsForAccount(daoId: string, account: string): Promise<Proposal[]>
  async getProposalsAwaitingApproval(daoId: string): Promise<Proposal[]>
  async getProposalsInVetoWindow(daoId: string): Promise<Proposal[]>
}
```

Use `@near-js/providers` for RPC calls (consistent with 2-08 migration).
  </action>
  <verify>npx tsc --noEmit shows no TypeScript errors</verify>
  <done>DAOService with view methods and transaction builders for all contract operations</done>
</task>

<task type="auto">
  <name>Task 2: Create REST API endpoints with classification filtering</name>
  <files>backend/src/api/dao.ts, backend/src/index.ts</files>
  <action>
Create backend/src/api/dao.ts with REST endpoints:

**Endpoints:**

DAO Management:
- GET /api/dao - List all DAOs (filtered by user clearance)
- GET /api/dao/:daoId - Get DAO details
- POST /api/dao - Create DAO (returns tx for signing)
- PUT /api/dao/:daoId/config - Update config (returns tx)

Proposals:
- GET /api/dao/:daoId/proposals - List proposals (filtered by classification)
- GET /api/dao/:daoId/proposals/:proposalId - Get proposal details
- POST /api/dao/:daoId/proposals - Create proposal (returns tx)
- GET /api/dao/:daoId/proposals/:proposalId/votes - Get votes

Voting:
- POST /api/dao/:daoId/proposals/:proposalId/vote - Cast vote (returns tx)
- POST /api/dao/:daoId/proposals/:proposalId/veto - Submit veto (returns tx)
- POST /api/dao/:daoId/proposals/:proposalId/approve - Human approval (returns tx)

Coalition:
- GET /api/dao/:daoId/proposals/:proposalId/coalition - Get coalition status
- POST /api/dao/:daoId/proposals/:proposalId/coalition/approve - Party approval (returns tx)

Roles:
- GET /api/dao/:daoId/members/:account/roles - Get member roles
- POST /api/dao/:daoId/members/:account/roles - Assign role (returns tx)

**Classification Filtering:**
Use zero-trust middleware to get user's subject attributes, then filter:

```typescript
import { getSubjectAttributes } from '../security/middleware/zero-trust.js';
import { canAccessClassification } from '../identity/abac-core.js';

async function filterByClassification<T extends { classification: string }>(
  items: T[],
  subjectAttributes: SubjectAttributes
): Promise<T[]> {
  return items.filter(item =>
    canAccessClassification(subjectAttributes, item.classification)
  );
}
```

Apply to:
- listDAOs - filter DAOs by their classification
- listProposals - filter proposals by their classification
- getProposal - return 403 if user can't access classification

**Response format:**
```typescript
interface DAOResponse<T> {
  success: boolean;
  data?: T;
  transaction?: TransactionArgs; // For write operations
  error?: string;
}
```

Mount router in index.ts:
```typescript
import daoRouter from './api/dao.js';
app.use('/api/dao', daoRouter);
```
  </action>
  <verify>curl http://localhost:3001/api/dao returns JSON response (empty array OK)</verify>
  <done>REST API endpoints for all DAO operations, classification filtering applied, integrated with zero-trust middleware</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `npx tsc --noEmit` passes without errors
- [ ] Backend starts without errors
- [ ] GET /api/dao returns 200 (may be empty)
- [ ] POST endpoints return transaction args structure
- [ ] Classification filtering prevents access to higher-classified proposals
- [ ] Zero-trust middleware authenticates all requests
</verification>

<success_criteria>
- All tasks completed
- All verification checks pass
- Backend DAO API ready for frontend integration in 3-07
- Classification-based access control working
</success_criteria>

<output>
After completion, create `.planning/phases/03-dao-governance/3-05-SUMMARY.md`
</output>
