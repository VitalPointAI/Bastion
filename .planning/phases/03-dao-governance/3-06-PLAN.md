---
phase: 03-dao-governance
plan: 06
type: execute
---

<objective>
Create agent infrastructure with registry, trust tiers, delegation boundaries, and execution framework for AI governance agents.

Purpose: Establish the foundation for AI agents to participate in governance according to the NEAR AI Governance Framework (Support → Represent → Organize phases).
Output: Agent registry, trust tier management, delegation boundaries, agent execution framework ready for Support-phase agents.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03-dao-governance/3-CONTEXT.md
@backend/src/index.ts
@backend/src/dao/dao-service.ts

**AI Governance Framework from context:**
- Support agents: Minimize cognitive cost (Governance Copilot, Proposal Screening)
- Represent agents: Maximize representation (Digital Twins, future)
- Organize agents: Maximize intelligence (Flash Committees, future)

**Agent trust tiers mapped to autonomy:**
- Support → Semi-autonomous or Not autonomous
- Represent → Semi-autonomous with delegation
- Organize → Can be Autonomous within boundaries

**Key agents for Phase 3:**
- Governance Copilot, Proposal Screening, Context Gaps, Feasibility
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create agent registry and trust tier management</name>
  <files>backend/src/agents/registry.ts, backend/src/agents/types.ts</files>
  <action>
Create backend/src/agents/ directory with agent infrastructure:

**types.ts:**
```typescript
export enum AgentPhase {
  Support = 'Support',     // AI Assistants - support human decisions
  Represent = 'Represent', // AI Proxies - proxy human decisions
  Organize = 'Organize'    // AI Leaders - make decisions, coordinate
}

export enum AgentCapability {
  // Support phase
  ProposalSummary = 'ProposalSummary',
  ProposalScreening = 'ProposalScreening',
  ContextAnalysis = 'ContextAnalysis',
  FeasibilityAssessment = 'FeasibilityAssessment',
  SecurityMonitoring = 'SecurityMonitoring',

  // Represent phase (future)
  PreferenceModeling = 'PreferenceModeling',
  DelegatedVoting = 'DelegatedVoting',

  // Organize phase (future)
  ConsensusBuilding = 'ConsensusBuilding',
  CommitteeCoordination = 'CommitteeCoordination'
}

export interface AgentManifest {
  agentId: string;
  name: string;
  description: string;
  phase: AgentPhase;
  capabilities: AgentCapability[];
  maxAutonomy: AutonomyLevel;
  allowedProposalKinds: ProposalKind[]; // Which proposal types it can act on
  requiresHumanApproval: ProposalKind[]; // Always needs human for these
  createdAt: Date;
  createdBy: string;
  active: boolean;
}

export interface AgentDelegation {
  delegationId: string;
  agentId: string;
  delegatorDID: string; // Human who delegated
  daoId: string;
  scope: DelegationScope;
  maxAutonomy: AutonomyLevel;
  expiresAt?: Date;
  createdAt: Date;
  revoked: boolean;
}

export interface DelegationScope {
  proposalKinds: ProposalKind[]; // Which types agent can act on
  maxClassification: string; // Highest classification agent can access
  excludeStrikeAuth: boolean; // Always true for v1
}

export interface AgentAction {
  actionId: string;
  agentId: string;
  daoId: string;
  proposalId?: number;
  actionType: AgentActionType;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  autonomyUsed: AutonomyLevel;
  humanApproved: boolean;
  timestamp: Date;
}

export enum AgentActionType {
  AnalyzeProposal = 'AnalyzeProposal',
  ScreenProposal = 'ScreenProposal',
  SummarizeActivity = 'SummarizeActivity',
  AssessFeasibility = 'AssessFeasibility',
  IdentifyContextGaps = 'IdentifyContextGaps',
  RecommendVote = 'RecommendVote', // Support only - never executes
  CastDelegatedVote = 'CastDelegatedVote' // Represent phase
}
```

**registry.ts:**
```typescript
export class AgentRegistry {
  private agents: Map<string, AgentManifest> = new Map();
  private delegations: Map<string, AgentDelegation[]> = new Map();
  private actionLog: AgentAction[] = [];

  // Agent registration
  registerAgent(manifest: AgentManifest): void
  getAgent(agentId: string): AgentManifest | undefined
  listAgents(phase?: AgentPhase): AgentManifest[]
  deactivateAgent(agentId: string): void

  // Delegation management
  createDelegation(delegation: Omit<AgentDelegation, 'delegationId' | 'createdAt' | 'revoked'>): string
  getDelegationsForAgent(agentId: string): AgentDelegation[]
  getDelegationsForDelegator(delegatorDID: string): AgentDelegation[]
  getDelegationsForDAO(daoId: string): AgentDelegation[]
  revokeDelegation(delegationId: string): void

  // Permission checks
  canAgentActOnProposal(agentId: string, daoId: string, proposal: Proposal): boolean
    // Check: agent active, has delegation for this DAO, proposal kind in scope,
    // classification within scope, not strike auth if excludeStrikeAuth

  getEffectiveAutonomy(agentId: string, daoId: string, proposalKind: ProposalKind): AutonomyLevel
    // Return minimum of: agent's maxAutonomy, delegation's maxAutonomy, DAO's default
    // Strike auth always returns NotAutonomous

  // Action logging (audit trail)
  logAction(action: Omit<AgentAction, 'actionId' | 'timestamp'>): string
  getActionsForAgent(agentId: string, limit?: number): AgentAction[]
  getActionsForProposal(daoId: string, proposalId: number): AgentAction[]
}
```

Create default Support-phase agents:
- governance-copilot: ProposalSummary, ContextAnalysis
- proposal-screener: ProposalScreening
- context-analyzer: ContextAnalysis, IdentifyContextGaps
- feasibility-assessor: FeasibilityAssessment
  </action>
  <verify>npx tsc --noEmit shows no TypeScript errors</verify>
  <done>AgentRegistry with manifest, delegation, and action logging; default Support agents registered</done>
</task>

<task type="auto">
  <name>Task 2: Create agent execution framework and API endpoints</name>
  <files>backend/src/agents/executor.ts, backend/src/api/agents.ts, backend/src/index.ts</files>
  <action>
**executor.ts:**
```typescript
export interface AgentContext {
  agent: AgentManifest;
  delegation: AgentDelegation;
  dao: DAOMetadata;
  proposal?: Proposal;
  userDID: string;
}

export interface AgentResult {
  success: boolean;
  actionId: string;
  output: Record<string, unknown>;
  requiresHumanApproval: boolean;
  suggestedAction?: string;
}

export class AgentExecutor {
  constructor(
    private registry: AgentRegistry,
    private daoService: DAOService
  ) {}

  // Execute agent capability
  async executeCapability(
    agentId: string,
    capability: AgentCapability,
    daoId: string,
    proposalId: number | null,
    input: Record<string, unknown>
  ): Promise<AgentResult>
    // 1. Validate agent has this capability
    // 2. Check delegation allows this action
    // 3. Get effective autonomy
    // 4. Execute capability handler
    // 5. Log action
    // 6. Return result with requiresHumanApproval flag

  // Capability handlers (stubs for now, AI integration in later phases)
  private async handleProposalSummary(ctx: AgentContext): Promise<Record<string, unknown>>
    // Return { summary: string, keyPoints: string[], recommendation: string }
    // Stub: extract from proposal description

  private async handleProposalScreening(ctx: AgentContext): Promise<Record<string, unknown>>
    // Return { passed: boolean, issues: string[], suggestions: string[] }
    // Stub: basic validation checks

  private async handleContextAnalysis(ctx: AgentContext): Promise<Record<string, unknown>>
    // Return { relatedProposals: Proposal[], contextGaps: string[] }
    // Stub: query recent proposals in same DAO

  private async handleFeasibilityAssessment(ctx: AgentContext): Promise<Record<string, unknown>>
    // Return { feasible: boolean, risks: string[], benefits: string[] }
    // Stub: basic risk keywords

  // Bulk operations
  async analyzeAllActiveProposals(agentId: string, daoId: string): Promise<AgentResult[]>
}
```

**api/agents.ts:**
```typescript
// Agent Registry
GET /api/agents - List all agents
GET /api/agents/:agentId - Get agent details
POST /api/agents - Register new agent (admin only)
PUT /api/agents/:agentId/deactivate - Deactivate agent

// Delegations
GET /api/agents/:agentId/delegations - Get delegations for agent
POST /api/agents/:agentId/delegations - Create delegation (requires user DID)
DELETE /api/agents/delegations/:delegationId - Revoke delegation

// Execution
POST /api/agents/:agentId/execute - Execute capability
  Body: { capability, daoId, proposalId?, input }
  Returns: AgentResult

// Action log
GET /api/agents/:agentId/actions - Get action history
GET /api/dao/:daoId/proposals/:proposalId/agent-actions - Get agent actions for proposal
```

Mount in index.ts:
```typescript
import agentRouter from './api/agents.js';
app.use('/api/agents', agentRouter);
```
  </action>
  <verify>curl http://localhost:3001/api/agents returns list of default agents</verify>
  <done>AgentExecutor with capability handlers, REST API, action logging for audit trail</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `npx tsc --noEmit` passes without errors
- [ ] Backend starts without errors
- [ ] GET /api/agents returns default Support agents
- [ ] Agent delegation creates valid delegation record
- [ ] Agent execution logs actions for audit
- [ ] Strike authorization proposals blocked from agent autonomous action
- [ ] Effective autonomy respects minimum of agent/delegation/DAO settings
</verification>

<success_criteria>
- All tasks completed
- All verification checks pass
- Agent infrastructure ready for Governance Copilot in 3-08
- Audit trail captures all agent actions
</success_criteria>

<output>
After completion, create `.planning/phases/03-dao-governance/3-06-SUMMARY.md`
</output>
