---
phase: 03-dao-governance
plan: 07
type: execute
---

<objective>
Create frontend DAO governance components with commander-focused UX.

Purpose: Build intuitive governance UI that feels natural to military commanders — clear actions, context chains, deadlines, and autonomy indicators.
Output: Governance service, ProposalList, ProposalDetail, VotingInterface, and DAODashboard components.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
~/.claude/get-shit-done/references/checkpoints.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03-dao-governance/3-CONTEXT.md
@frontend/src/App.tsx
@frontend/src/lib/identity-service.ts
@frontend/src/components/AuthWrapper.tsx

**Tech stack available:**
- React 19 + TypeScript
- Vite build system
- Privy for authentication
- Existing identity service pattern

**UX requirements from context:**
- Clear action required: what decision, who else must approve, deadline
- Full context chain: how proposal connects to strategic objectives
- Classification-aware view: redaction based on clearance
- Autonomy indicator: show which level applies to each proposal
- Commander-focused: not crypto governance, military decision-making
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create governance service and DAO types</name>
  <files>frontend/src/lib/governance-service.ts, frontend/src/types/dao.ts</files>
  <action>
**types/dao.ts:**
```typescript
// Mirror backend types
export enum AutonomyLevel { ... }
export enum ProposalKind { ... }
export enum ProposalStatus { ... }
export enum ExecutionState { ... }
export enum VoteType { ... }

export interface DAOMetadata {
  daoId: string;
  name: string;
  description: string;
  classification: string;
  defaultAutonomy: AutonomyLevel;
  memberCount: number;
  activeProposalCount: number;
  parentDaoId?: string;
}

export interface Proposal {
  id: number;
  kind: ProposalKind;
  proposer: string;
  description: string;
  classification: string;
  autonomyOverride?: AutonomyLevel;
  status: ProposalStatus;
  votesApprove: number;
  votesReject: number;
  createdAt: number;
  votingDeadline: number;
  executionState: ExecutionState;
  // Computed for UI
  effectiveAutonomy: AutonomyLevel;
  timeRemaining: string;
  requiresMyAction: boolean;
  myVote?: VoteType;
}

export interface Vote {
  voter: string;
  voteType: VoteType;
  weight: number;
  timestamp: number;
}

export interface CoalitionStatus {
  requiredParties: string[];
  approvals: Record<string, { approved: boolean; approvedBy?: string }>;
  allPartiesRequired: boolean;
  isApproved: boolean;
}

export interface ProposalContext {
  parentProposals: Proposal[]; // Linked parent DAO proposals
  relatedProposals: Proposal[]; // Same DAO, related topic
  strategicObjective?: string; // If linked to strategic planning
}
```

**lib/governance-service.ts:**
```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export class GovernanceService {
  private token: string | null = null;

  setAuthToken(token: string) { this.token = token; }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T>

  // DAOs
  async listDAOs(): Promise<DAOMetadata[]>
  async getDAO(daoId: string): Promise<DAOMetadata>
  async getMyDAOs(): Promise<DAOMetadata[]> // DAOs where user is member

  // Proposals
  async listProposals(daoId: string, status?: ProposalStatus): Promise<Proposal[]>
  async getProposal(daoId: string, proposalId: number): Promise<Proposal>
  async getProposalContext(daoId: string, proposalId: number): Promise<ProposalContext>
  async getMyActionRequired(): Promise<Proposal[]> // All proposals needing user action

  // Voting
  async getVotes(daoId: string, proposalId: number): Promise<Vote[]>
  async buildVoteTx(daoId: string, proposalId: number, voteType: VoteType): Promise<TransactionArgs>
  async buildVetoTx(daoId: string, proposalId: number): Promise<TransactionArgs>
  async buildHumanApprovalTx(daoId: string, proposalId: number): Promise<TransactionArgs>

  // Coalition
  async getCoalitionStatus(daoId: string, proposalId: number): Promise<CoalitionStatus>
  async buildCoalitionApprovalTx(daoId: string, proposalId: number, party: string): Promise<TransactionArgs>

  // Helpers
  formatTimeRemaining(deadline: number): string
  getAutonomyLabel(level: AutonomyLevel): string
  getStatusLabel(status: ProposalStatus): string
  getKindLabel(kind: ProposalKind): string
}

export const governanceService = new GovernanceService();
```
  </action>
  <verify>npx tsc --noEmit in frontend directory shows no errors</verify>
  <done>GovernanceService with all API methods, DAO types mirroring backend</done>
</task>

<task type="auto">
  <name>Task 2: Create ProposalList and ProposalDetail components</name>
  <files>frontend/src/components/dao/ProposalList.tsx, frontend/src/components/dao/ProposalDetail.tsx, frontend/src/components/dao/ProposalCard.tsx</files>
  <action>
Create frontend/src/components/dao/ directory:

**ProposalCard.tsx:**
```typescript
interface ProposalCardProps {
  proposal: Proposal;
  onClick: () => void;
}

// Compact card showing:
// - Kind icon/badge (color-coded)
// - Title/description (truncated)
// - Status badge
// - Autonomy indicator (icon: robot for autonomous, human for not)
// - Time remaining (countdown or "URGENT" if < 1hr)
// - "Action Required" badge if requiresMyAction
// - Vote counts (approve/reject bar)
```

**ProposalList.tsx:**
```typescript
interface ProposalListProps {
  daoId: string;
  filter?: 'all' | 'active' | 'action-required' | 'my-votes';
}

// Shows:
// - Filter tabs at top
// - List of ProposalCards
// - Empty state with helpful message
// - Loading skeleton
// - "Action Required" section at top if any proposals need attention

// Sort: Action required first, then by deadline (soonest first)
```

**ProposalDetail.tsx:**
```typescript
interface ProposalDetailProps {
  daoId: string;
  proposalId: number;
  onClose: () => void;
}

// Full proposal view with:
// 1. Header: Kind, Status, Classification badge
// 2. Autonomy section:
//    - Current autonomy level with explanation
//    - If StrikeAuthorization: "Human Approval Required" prominent
//    - Veto window countdown if applicable
// 3. Description section
// 4. Context chain:
//    - Parent DAO decision (if linked)
//    - Related proposals
//    - Strategic objective (if linked)
// 5. Coalition status (if coalition proposal):
//    - Required parties with checkmarks
//    - "Awaiting: GBR, AUS" style indicator
// 6. Voting section:
//    - Vote counts with progress bar
//    - List of voters (if permitted by clearance)
//    - My vote status
// 7. Action buttons:
//    - Vote Approve/Reject (if can vote)
//    - Submit Human Approval (if awaiting)
//    - Veto (if in veto window and has permission)
```

Use existing CSS patterns from App.css. Add necessary styles for:
- Autonomy level color coding (green=autonomous, yellow=semi, red=human-required)
- Urgency indicators
- Classification badges
  </action>
  <verify>npm run build in frontend succeeds without errors</verify>
  <done>ProposalList, ProposalCard, ProposalDetail components with commander-focused UX</done>
</task>

<task type="auto">
  <name>Task 3: Create VotingInterface and DAODashboard</name>
  <files>frontend/src/components/dao/VotingInterface.tsx, frontend/src/components/dao/DAODashboard.tsx, frontend/src/components/dao/index.ts</files>
  <action>
**VotingInterface.tsx:**
```typescript
interface VotingInterfaceProps {
  proposal: Proposal;
  coalitionStatus?: CoalitionStatus;
  onVote: (voteType: VoteType) => Promise<void>;
  onVeto?: () => Promise<void>;
  onHumanApproval?: () => Promise<void>;
  onCoalitionApproval?: (party: string) => Promise<void>;
}

// Comprehensive voting UI:
// 1. Current vote tally visualization:
//    - Approve/Reject bar chart
//    - Threshold line marker
//    - Quorum indicator
// 2. My vote status (if already voted)
// 3. Vote buttons:
//    - Large, clear Approve/Reject buttons
//    - Abstain option (smaller)
//    - Disabled if already voted or can't vote
// 4. Coalition approval section (if applicable):
//    - My party identification
//    - "Approve as [USA]" button
//    - Status of other parties
// 5. Human approval section (if AwaitingHumanApproval):
//    - Prominent "AUTHORIZE" button
//    - Warning about consequences for StrikeAuthorization
//    - Requires confirmation dialog
// 6. Veto section (if InVetoWindow and has permission):
//    - Countdown timer
//    - "VETO" button with confirmation
// 7. Transaction status:
//    - Pending indicator
//    - Success/error messages
```

**DAODashboard.tsx:**
```typescript
interface DAODashboardProps {
  daoId?: string; // If not provided, show all user's DAOs
}

// Main governance dashboard:
// 1. Header: "Governance" title with DAO selector dropdown
// 2. Summary cards:
//    - Total active proposals
//    - Proposals requiring my action (highlighted)
//    - My voting participation rate
// 3. "Action Required" section:
//    - List of proposals needing immediate attention
//    - Sorted by urgency (deadline)
// 4. Recent activity feed:
//    - Recent votes by others
//    - Proposals created
//    - Proposals executed
// 5. My DAOs sidebar (if no daoId):
//    - List of DAOs user is member of
//    - Active proposal counts per DAO
```

**index.ts:**
```typescript
export { ProposalList } from './ProposalList';
export { ProposalCard } from './ProposalCard';
export { ProposalDetail } from './ProposalDetail';
export { VotingInterface } from './VotingInterface';
export { DAODashboard } from './DAODashboard';
```

Update App.tsx to add route for DAODashboard:
```typescript
// Add to routes
<Route path="/governance" element={<DAODashboard />} />
<Route path="/governance/:daoId" element={<DAODashboard />} />
```
  </action>
  <verify>npm run build in frontend succeeds, navigate to /governance works</verify>
  <done>VotingInterface with coalition support, DAODashboard as main governance entry point, routes configured</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `npm run build` in frontend succeeds
- [ ] Frontend starts with `npm run dev`
- [ ] /governance route renders DAODashboard
- [ ] ProposalList shows proposals (may be empty initially)
- [ ] Autonomy indicators display correctly
- [ ] Coalition status displays party approvals
- [ ] Action required proposals highlighted
</verification>

<success_criteria>
- All tasks completed
- All verification checks pass
- Commander-focused UX: clear actions, deadlines, autonomy indicators
- Ready for Governance Copilot integration in 3-08
</success_criteria>

<output>
After completion, create `.planning/phases/03-dao-governance/3-07-SUMMARY.md`
</output>
