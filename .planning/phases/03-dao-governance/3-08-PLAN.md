---
phase: 03-dao-governance
plan: 08
type: execute
---

<objective>
Integrate Governance Copilot as embedded assistant for proposal explanation and voting guidance.

Purpose: Provide commanders with AI-assisted governance support — summarizing proposals, explaining context, guiding through voting processes, all within the Support phase of the AI Governance Framework.
Output: Governance Copilot component with proposal analysis, context explanation, and voting guidance.
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
@frontend/src/components/dao/ProposalDetail.tsx
@backend/src/agents/executor.ts
@backend/src/agents/registry.ts

**AI Governance Framework - Support Phase:**
- Governance Copilot: summarizes activity, explains proposals, guides voting
- Human-on-the-loop or human-in-the-loop (never autonomous for decisions)
- Provides recommendations, never executes without human action

**Key capabilities:**
- ProposalSummary: Distill proposal into key points
- ContextAnalysis: Show related decisions and strategic context
- Guide users through voting process
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Governance Copilot backend capability handlers</name>
  <files>backend/src/agents/copilot.ts, backend/src/agents/executor.ts</files>
  <action>
**copilot.ts:**
```typescript
import { Proposal, DAOMetadata, ProposalKind, AutonomyLevel } from '../dao/types.js';
import { AgentContext, AgentResult } from './types.js';

export interface ProposalSummaryOutput {
  summary: string;           // 2-3 sentence summary
  keyPoints: string[];       // Bullet points
  impactAssessment: string;  // What happens if approved/rejected
  recommendation?: string;   // Optional voting guidance (never for StrikeAuth)
  warnings: string[];        // Risks or concerns
}

export interface ContextAnalysisOutput {
  relatedProposals: Array<{
    daoId: string;
    proposalId: number;
    summary: string;
    relationship: 'parent' | 'related' | 'dependent';
  }>;
  strategicAlignment: string;  // How this relates to strategic objectives
  precedents: string[];        // Similar past decisions
  contextGaps: string[];       // Information that might be missing
}

export interface VotingGuidanceOutput {
  eligibility: {
    canVote: boolean;
    reason?: string;
  };
  autonomyExplanation: string;  // Explain what the autonomy level means
  coalitionRequirements?: {
    requiredParties: string[];
    myParty?: string;
    explanation: string;
  };
  nextSteps: string[];  // What happens after voting
  deadlineWarning?: string;
}

export class GovernanceCopilot {
  // Generate proposal summary
  async summarizeProposal(
    proposal: Proposal,
    dao: DAOMetadata
  ): Promise<ProposalSummaryOutput> {
    // For v1, use rule-based summarization
    // Later phases can integrate LLM

    const summary = this.generateSummary(proposal);
    const keyPoints = this.extractKeyPoints(proposal);
    const impact = this.assessImpact(proposal, dao);
    const warnings = this.identifyWarnings(proposal);

    // NEVER provide recommendation for StrikeAuthorization
    let recommendation: string | undefined;
    if (proposal.kind !== ProposalKind.StrikeAuthorization) {
      recommendation = this.generateRecommendation(proposal);
    }

    return { summary, keyPoints, impactAssessment: impact, recommendation, warnings };
  }

  // Analyze context
  async analyzeContext(
    proposal: Proposal,
    dao: DAOMetadata,
    relatedProposals: Proposal[]
  ): Promise<ContextAnalysisOutput> {
    const related = relatedProposals.map(p => ({
      daoId: dao.daoId,
      proposalId: p.id,
      summary: this.generateSummary(p),
      relationship: this.determineRelationship(proposal, p)
    }));

    return {
      relatedProposals: related,
      strategicAlignment: this.assessStrategicAlignment(proposal),
      precedents: this.findPrecedents(proposal, relatedProposals),
      contextGaps: this.identifyContextGaps(proposal)
    };
  }

  // Generate voting guidance
  async generateVotingGuidance(
    proposal: Proposal,
    dao: DAOMetadata,
    userRoles: string[],
    userParty?: string
  ): Promise<VotingGuidanceOutput> {
    const canVote = userRoles.length > 0;
    const autonomyExplanation = this.explainAutonomy(
      proposal.effectiveAutonomy || dao.defaultAutonomy
    );

    const nextSteps = this.determineNextSteps(proposal);

    let deadlineWarning: string | undefined;
    const timeLeft = proposal.votingDeadline - Date.now();
    if (timeLeft < 3600000) { // < 1 hour
      deadlineWarning = 'URGENT: Less than 1 hour to vote';
    } else if (timeLeft < 86400000) { // < 24 hours
      deadlineWarning = 'Deadline approaching within 24 hours';
    }

    return {
      eligibility: { canVote, reason: canVote ? undefined : 'No voting role in this DAO' },
      autonomyExplanation,
      coalitionRequirements: this.getCoalitionRequirements(proposal, userParty),
      nextSteps,
      deadlineWarning
    };
  }

  // Helper methods
  private generateSummary(proposal: Proposal): string
  private extractKeyPoints(proposal: Proposal): string[]
  private assessImpact(proposal: Proposal, dao: DAOMetadata): string
  private identifyWarnings(proposal: Proposal): string[]
  private generateRecommendation(proposal: Proposal): string
  private determineRelationship(p1: Proposal, p2: Proposal): 'parent' | 'related' | 'dependent'
  private assessStrategicAlignment(proposal: Proposal): string
  private findPrecedents(proposal: Proposal, others: Proposal[]): string[]
  private identifyContextGaps(proposal: Proposal): string[]
  private explainAutonomy(level: AutonomyLevel): string {
    switch (level) {
      case AutonomyLevel.Autonomous:
        return 'If approved, this proposal will execute automatically without further human action.';
      case AutonomyLevel.SemiAutonomous:
        return 'If approved, there will be a veto window before execution. Council members can veto during this period.';
      case AutonomyLevel.NotAutonomous:
        return 'This proposal requires explicit human approval before execution, even after votes pass.';
    }
  }
  private determineNextSteps(proposal: Proposal): string[]
  private getCoalitionRequirements(proposal: Proposal, userParty?: string): VotingGuidanceOutput['coalitionRequirements']
}

export const governanceCopilot = new GovernanceCopilot();
```

Update executor.ts to use GovernanceCopilot for its capability handlers.
  </action>
  <verify>npx tsc --noEmit shows no TypeScript errors</verify>
  <done>GovernanceCopilot with rule-based summarization, context analysis, voting guidance; no recommendations for StrikeAuth</done>
</task>

<task type="auto">
  <name>Task 2: Create frontend Copilot component and integrate with ProposalDetail</name>
  <files>frontend/src/components/dao/CopilotPanel.tsx, frontend/src/components/dao/ProposalDetail.tsx</files>
  <action>
**CopilotPanel.tsx:**
```typescript
interface CopilotPanelProps {
  daoId: string;
  proposalId: number;
  expanded?: boolean;
  onToggle?: () => void;
}

// Collapsible AI assistant panel showing:
// 1. Header: "AI Assistant" with collapse toggle
// 2. Summary section:
//    - Key points as bullets
//    - Impact assessment
//    - Warnings (highlighted in yellow/red)
// 3. Context section:
//    - Related proposals (clickable links)
//    - Strategic alignment note
//    - Context gaps (things to consider)
// 4. Voting guidance:
//    - Eligibility status
//    - Autonomy explanation with icon
//    - Coalition requirements (if applicable)
//    - Next steps after voting
//    - Deadline warning (prominent if urgent)
// 5. Recommendation (if not StrikeAuth):
//    - "Based on context, consider..." style guidance
//    - Never prescriptive, always "consider" language
// 6. For StrikeAuthorization:
//    - Prominent notice: "Strike authorization decisions require human judgment"
//    - No recommendation shown
//    - Extra warnings about consequences

// Visual design:
// - Distinct styling (different background) to show it's AI-generated
// - Clear "AI Assistant" branding
// - Disclaimer: "AI analysis - verify before deciding"
```

**API integration:**
```typescript
// Add to governance-service.ts
async getCopilotAnalysis(daoId: string, proposalId: number): Promise<{
  summary: ProposalSummaryOutput;
  context: ContextAnalysisOutput;
  guidance: VotingGuidanceOutput;
}>

// Calls backend endpoint
GET /api/agents/governance-copilot/analyze?daoId={daoId}&proposalId={proposalId}
```

**Update ProposalDetail.tsx:**
- Add CopilotPanel as collapsible sidebar or bottom section
- Default expanded for complex proposals (coalition, strike auth)
- Show loading state while copilot analyzes
- Cache analysis to avoid re-fetching

**Styling:**
- Add copilot-specific styles to highlight AI content
- Use different font or subtle background
- Warning badges for StrikeAuthorization
  </action>
  <verify>npm run build succeeds, ProposalDetail shows CopilotPanel</verify>
  <done>CopilotPanel component integrated with ProposalDetail, special handling for StrikeAuthorization</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Governance Copilot AI assistant for DAO governance</what-built>
  <how-to-verify>
    1. Start backend: cd backend && npm run dev
    2. Start frontend: cd frontend && npm run dev
    3. Navigate to /governance in browser
    4. Create or view a proposal (may need to create test data)
    5. Verify CopilotPanel appears with:
       - Summary with key points
       - Context analysis
       - Voting guidance
       - Autonomy explanation
    6. If StrikeAuthorization proposal available:
       - Verify NO recommendation shown
       - Verify "requires human judgment" notice
    7. Verify AI assistant styling is distinct
    8. Verify deadline warnings appear for urgent proposals
  </how-to-verify>
  <resume-signal>Type "approved" to continue, or describe issues to fix</resume-signal>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `npm run build` succeeds in both backend and frontend
- [ ] Copilot analysis endpoint returns structured data
- [ ] CopilotPanel renders in ProposalDetail
- [ ] StrikeAuthorization proposals show no recommendations
- [ ] AI content is visually distinct from regular content
- [ ] Human verification checkpoint passed
</verification>

<success_criteria>
- All tasks completed
- All verification checks pass
- Governance Copilot provides helpful context without overstepping
- StrikeAuthorization maintains human-only decision authority
- Phase 3 complete
</success_criteria>

<output>
After completion, create `.planning/phases/03-dao-governance/3-08-SUMMARY.md` with:
- Phase complete status
- All 8 plans accomplished
- Key capabilities: DAO creation, proposals, voting, coalition, agents, copilot
- Ready for Phase 4: Strategic Planning Module
</output>
