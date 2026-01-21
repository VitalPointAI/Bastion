# Plan 4-11: Strategic Analysis MCP Tools & Review Agent

**Phase:** 4 - Strategic Planning Module
**Depends on:** 4-10, 4.2
**Estimated complexity:** High

## Overview

This plan creates specialized MCP tools for strategic objective analysis and a Strategy Document Review Agent that uses these tools. The tools provide structured, repeatable analysis that agents (or humans via REST API) can invoke for consistent categorization and prioritization of strategic objectives.

## Background

The Phase 4.2 agent framework provides:
- MCP tool registry with assignment to agents
- Agent execution with LLM provider abstraction
- Team orchestration via LangGraph
- ABAC-enforced inter-agent communication
- Per-agent model configuration

This plan builds on that foundation to create domain-specific analysis tools.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     REST API Layer                               │
│   POST /api/strategic/tools/categorize-midlife                  │
│   POST /api/strategic/tools/prioritize-domain                   │
│   POST /api/strategic/agents/review-document                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   MCP Tool Layer                                 │
│   ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│   │ MIDLIFE Categorizer │  │ Domain Prioritizer              │  │
│   │ - Input: objective  │  │ - Input: objectives[], domain   │  │
│   │ - Output: category, │  │ - Output: ranked list with      │  │
│   │   confidence,       │  │   scores and rationale          │  │
│   │   rationale         │  │                                 │  │
│   └─────────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              Strategy Document Review Agent                      │
│   - Registered in AgentRegistry with dedicated DID              │
│   - Uses admin-assigned LLM provider                            │
│   - Has categorize-midlife and prioritize-domain tools          │
│   - Can be triggered auto (post-extraction) or manual           │
│   - Produces structured review report                           │
└─────────────────────────────────────────────────────────────────┘
```

## Key Decisions

### MCP Tool Architecture
- **Decision:** Both REST endpoints AND MCP tool definitions
- **Rationale:** REST enables direct UI usage; MCP enables agent usage via existing framework
- **Implementation:** Single logic class, dual interfaces (Express route + MCP handler)

### Tool Design Philosophy
- Tools are **analysis-only** (no write operations)
- Tools return **structured output** with rationale for transparency
- Tools are **stateless** - each call is independent
- Tools accept **configurable criteria** for flexibility

### Review Agent Integration
- Agent registered via existing admin API
- Auto-trigger via event hook on extraction completion
- Manual trigger via new API endpoint
- Review results stored as assessment record linked to document

## Tasks

### Task 1: MIDLIFE Categorization Tool Core [auto]
Create the core analysis logic for MIDLIFE categorization.

**File:** `backend/src/strategic/tools/midlife-categorizer.ts`

```typescript
interface MidlifeCategorizeInput {
  objectiveId: string;
  description: string;
  context?: {
    documentLevel?: string;
    dimeCategory?: string;
    keywords?: string[];
  };
}

interface MidlifeCategorizeOutput {
  category: MidlifeCategory;
  confidence: number;  // 0-1
  rationale: string;
  alternativeCategories?: Array<{
    category: MidlifeCategory;
    confidence: number;
    reason: string;
  }>;
  indicators: string[];  // Key phrases that influenced decision
}
```

**Analysis Criteria:**
- **MILITARY**: Armed forces, defense capabilities, force posture, military operations, combat power, readiness
- **INFORMATION**: Communications, media, cyber operations, influence, public affairs, narrative control
- **DIPLOMATIC**: Foreign relations, treaties, alliances, negotiations, international cooperation, embassies
- **LEGAL**: International law, domestic law, ROE, legal frameworks, treaties as binding law, jurisdiction
- **INTELLIGENCE**: Collection, analysis, counterintelligence, reconnaissance, ISR, surveillance
- **FINANCIAL**: Banking, sanctions (financial instruments), monetary policy, central banks, financial warfare
- **ECONOMIC**: Trade, resources, development, industrial base, economic statecraft, supply chains

**Key Distinguishers:**
- FINANCIAL vs ECONOMIC: Financial = money/banking systems; Economic = trade/production/resources
- LEGAL vs DIPLOMATIC: Legal = binding rules/enforcement; Diplomatic = relationship-based
- INFORMATION vs INTELLIGENCE: Information = influence/narrative; Intelligence = knowledge/collection
- MILITARY: Only when directly involving armed forces/combat capability

### Task 2: MIDLIFE Tool MCP Registration [auto]
Register the categorizer as an MCP tool in the tool registry.

**Updates:**
- `backend/src/agents/tool-registry.ts` - Add built-in tool registration
- Create MCP-compatible handler that wraps the core logic
- Define JSON Schema for input/output

**MCP Tool Definition:**
```typescript
{
  name: 'categorize-midlife',
  description: 'Analyze a strategic objective and determine its MIDLIFE category',
  category: 'analysis',
  handlerType: 'builtin',
  inputSchema: { /* JSON Schema */ },
  outputSchema: { /* JSON Schema */ },
  did: /* Generated tool DID */
}
```

### Task 3: MIDLIFE Tool REST Endpoint [auto]
Create REST endpoint for direct API/UI access.

**Endpoint:** `POST /api/strategic/tools/categorize-midlife`

**File:** `backend/src/api/strategic-tools.ts`

```typescript
// Request
{
  objectiveId: string;
  // OR provide directly:
  description: string;
  context?: object;
}

// Response
{
  category: MidlifeCategory;
  confidence: number;
  rationale: string;
  alternativeCategories: [...];
  indicators: string[];
  toolVersion: string;
}
```

### Task 4: Domain Prioritization Tool Core [auto]
Create generic prioritization logic that works across domains.

**File:** `backend/src/strategic/tools/domain-prioritizer.ts`

```typescript
interface PrioritizeInput {
  objectives: Array<{
    id: string;
    description: string;
    currentPriority?: string;
    metadata?: Record<string, unknown>;
  }>;
  domain: 'strategic' | 'operational' | 'tactical' | 'resource';
  criteria?: PrioritizationCriteria;
}

interface PrioritizationCriteria {
  // Weights (0-1, must sum to 1)
  urgency?: number;        // Time-sensitivity
  impact?: number;         // Magnitude of effect
  feasibility?: number;    // Resource/capability availability
  risk?: number;           // Potential negative consequences
  alignment?: number;      // Strategic alignment score
  dependencies?: number;   // Blocking other objectives
  custom?: Array<{
    name: string;
    weight: number;
    description: string;
  }>;
}

interface PrioritizeOutput {
  rankedObjectives: Array<{
    id: string;
    rank: number;
    score: number;  // 0-100
    breakdown: {
      urgency: number;
      impact: number;
      feasibility: number;
      risk: number;
      alignment: number;
      dependencies: number;
    };
    rationale: string;
    recommendedPriority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  summary: string;
  methodology: string;
}
```

**Domain-Specific Defaults:**
- **Strategic**: Higher weight on impact, alignment, long-term
- **Operational**: Balance of feasibility, timing, resources
- **Tactical**: Urgency-dominant, immediate actionability
- **Resource**: Feasibility-dominant, cost-benefit

### Task 5: Prioritization Tool MCP + REST [auto]
Register prioritizer as MCP tool and create REST endpoint.

**MCP Tool:** `prioritize-domain`
**Endpoint:** `POST /api/strategic/tools/prioritize-domain`

### Task 6: Strategy Document Review Agent Definition [auto]
Create the agent manifest and character definition.

**File:** `backend/src/strategic/agents/strategy-reviewer.ts`

**Agent Manifest:**
```typescript
{
  agentId: 'strategy-document-reviewer',
  displayName: 'Strategy Document Reviewer',
  description: 'Reviews strategic documents and categorizes objectives using MIDLIFE framework',
  phase: 'Support',  // Per NEAR AI Governance Framework
  capabilities: [
    'ObjectiveReview',
    'MidlifeCategorization',
    'PriorityAssessment',
    'DocumentSummary'
  ],
  maxAutonomyLevel: 'SemiAutonomous',  // Requires human approval for changes
  allowedProposalKinds: [],  // Not involved in DAO proposals
  tools: ['categorize-midlife', 'prioritize-domain']
}
```

**Character Definition (Eliza-style):**
```typescript
{
  name: 'Strategy Document Reviewer',
  bio: [
    'Expert in national security strategy analysis',
    'Trained on DIME/MIDLIFE frameworks',
    'Methodical, thorough, evidence-based'
  ],
  lore: [
    'Developed from decades of strategic planning doctrine',
    'Understands joint planning processes (JP 5-0)',
    'Values traceability and audit trails'
  ],
  knowledge: [
    // RAG knowledge about MIDLIFE, strategic planning doctrine
  ],
  style: {
    all: ['analytical', 'precise', 'objective'],
    chat: ['professional', 'thorough']
  },
  adjectives: ['methodical', 'precise', 'analytical', 'thorough']
}
```

### Task 7: Review Agent Execution Logic [auto]
Implement the agent's review workflow.

**File:** `backend/src/strategic/agents/strategy-reviewer-executor.ts`

**Workflow:**
1. Load document and its objectives
2. For each objective without MIDLIFE category (or low confidence):
   - Call `categorize-midlife` tool
   - Store suggested category (not auto-applied)
3. Call `prioritize-domain` on all objectives
4. Generate review report with:
   - Category suggestions with rationale
   - Priority recommendations
   - Conflicting assessments flagged for human review
   - Overall document strategic coherence assessment

**Output:** `StrategyReviewReport`
```typescript
interface StrategyReviewReport {
  id: string;
  documentId: string;
  reviewedAt: Date;
  reviewedBy: string;  // Agent DID
  categoryAssessments: Array<{
    objectiveId: string;
    suggestedCategory: MidlifeCategory;
    currentCategory?: MidlifeCategory;
    confidence: number;
    rationale: string;
    requiresHumanReview: boolean;
  }>;
  priorityAssessments: Array<{
    objectiveId: string;
    suggestedPriority: Priority;
    currentPriority: Priority;
    score: number;
    rationale: string;
  }>;
  documentSummary: {
    totalObjectives: number;
    categoryDistribution: Record<MidlifeCategory, number>;
    coherenceScore: number;  // 0-100
    flags: string[];
  };
  status: 'pending_review' | 'accepted' | 'rejected' | 'partial';
}
```

### Task 8: Review Agent API Endpoints [auto]
Create endpoints to trigger and manage reviews.

**Endpoints:**
- `POST /api/strategic/documents/:documentId/review` - Trigger agent review
- `GET /api/strategic/documents/:documentId/reviews` - List reviews for document
- `GET /api/strategic/reviews/:reviewId` - Get specific review
- `POST /api/strategic/reviews/:reviewId/accept` - Accept all suggestions
- `POST /api/strategic/reviews/:reviewId/accept-partial` - Accept selected suggestions

### Task 9: Document-Agent Assignment [auto]
Enable assigning agents/teams to documents and display assignments on document cards.

**Database Schema:**
```sql
CREATE TABLE document_agent_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES strategic_documents(id) ON DELETE CASCADE,
  agent_id VARCHAR(255) NOT NULL,  -- References agent registry
  team_id VARCHAR(255),            -- Optional team assignment
  assignment_type VARCHAR(50) NOT NULL,  -- 'review', 'monitor', 'analyze'
  status VARCHAR(50) DEFAULT 'assigned',  -- 'assigned', 'active', 'completed', 'paused'
  assigned_by VARCHAR(255) NOT NULL,  -- User DID who made assignment
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ,
  config JSONB DEFAULT '{}'  -- Agent-specific config for this document
);
```

**API Endpoints:**
- `POST /api/strategic/documents/:documentId/agents` - Assign agent/team to document
- `GET /api/strategic/documents/:documentId/agents` - List assigned agents/teams
- `DELETE /api/strategic/documents/:documentId/agents/:assignmentId` - Remove assignment
- `PUT /api/strategic/documents/:documentId/agents/:assignmentId` - Update assignment status

**Frontend Updates:**
- Add agent assignment badges to DocumentList cards
- Show assigned agent names/icons on document cards
- Add "Assign Agent" action button to document card/detail
- AgentAssignmentModal for selecting agents/teams

**Data Structure:**
```typescript
interface DocumentAgentAssignment {
  id: string;
  documentId: string;
  agentId: string;
  teamId?: string;
  assignmentType: 'review' | 'monitor' | 'analyze';
  status: 'assigned' | 'active' | 'completed' | 'paused';
  assignedBy: string;
  assignedAt: Date;
  lastActivityAt?: Date;
  config?: Record<string, unknown>;
  // Populated from agent registry
  agentName?: string;
  agentDisplayName?: string;
  teamName?: string;
}
```

### Task 10: Auto-Review Hook [auto]
Add event hook to trigger review after extraction.

**Implementation:**
- Subscribe to extraction completion event
- Check admin config for auto-review enabled
- Check document agent assignments for auto-triggered agents
- Queue review job (async, non-blocking)
- Notify user when review complete

**Admin Config Addition:**
```typescript
interface AgentConfig {
  // existing fields...
  autoReviewOnExtraction: boolean;
  reviewAgentId: string;  // Default: 'strategy-document-reviewer'
}
```

### Task 11: Review Report UI Components [auto]
Create frontend components to display and act on reviews.

**Components:**
- `ReviewSummary.tsx` - Overview of review findings
- `CategorySuggestions.tsx` - List of category change suggestions
- `PrioritySuggestions.tsx` - List of priority recommendations
- `ReviewActions.tsx` - Accept/reject controls

**Integration:**
- Add "Agent Review" section to document detail view
- Show pending review indicator
- Allow accepting individual or all suggestions

### Task 12: Testing & Validation [checkpoint:human-verify]
Verify complete flow works end-to-end.

**Test Scenarios:**
1. Upload document → Extract objectives → Auto-review triggers
2. Manual review trigger via UI
3. Accept individual category suggestion
4. Accept all suggestions
5. Verify MCP tool direct calls work
6. Verify REST endpoints work
7. Assign agent to document → Verify badge appears on card
8. Assign team to document → Verify team badge appears
9. Remove agent assignment → Verify badge removed

## Files to Create/Modify

### New Files
- `backend/src/strategic/tools/midlife-categorizer.ts`
- `backend/src/strategic/tools/domain-prioritizer.ts`
- `backend/src/strategic/tools/index.ts`
- `backend/src/strategic/agents/strategy-reviewer.ts`
- `backend/src/strategic/agents/strategy-reviewer-executor.ts`
- `backend/src/api/strategic-tools.ts`
- `backend/src/strategic/reviews/store.ts`
- `backend/src/strategic/reviews/types.ts`
- `backend/src/strategic/assignments/store.ts` - Document-agent assignments
- `backend/src/strategic/assignments/types.ts`
- `frontend/src/components/strategic/ReviewSummary.tsx`
- `frontend/src/components/strategic/ReviewSummary.css`
- `frontend/src/components/strategic/CategorySuggestions.tsx`
- `frontend/src/components/strategic/PrioritySuggestions.tsx`
- `frontend/src/components/strategic/ReviewActions.tsx`
- `frontend/src/components/strategic/AgentAssignmentModal.tsx`
- `frontend/src/components/strategic/AgentAssignmentModal.css`
- `frontend/src/components/strategic/AgentBadges.tsx` - Agent badges for document cards

### Modified Files
- `backend/src/api/strategic.ts` - Add review and assignment endpoints
- `backend/src/agents/tool-registry.ts` - Register built-in tools
- `backend/src/strategic/config/schema.ts` - Add auto-review config
- `frontend/src/components/strategic/StrategicDashboard.tsx` - Add review section
- `frontend/src/components/strategic/DocumentList.tsx` - Add agent badges to cards
- `frontend/src/lib/strategic-service.ts` - Add review and assignment API methods
- `frontend/src/lib/types/strategic.ts` - Add DocumentAgentAssignment type

## Testing

- Unit tests for categorization logic (mock LLM responses)
- Unit tests for prioritization scoring
- Integration tests for MCP tool execution
- E2E test for full review workflow

## Success Criteria

1. MIDLIFE categorization tool accurately categorizes objectives with rationale
2. Prioritization tool produces defensible rankings
3. Review agent successfully processes documents end-to-end
4. UI allows reviewing and acting on agent suggestions
5. Auto-review triggers on extraction when enabled
6. All tools accessible via both REST and MCP
7. Document cards display assigned agents/teams
8. Agents/teams can be assigned to documents via UI
9. Assignment status properly tracked (assigned/active/completed)

## Notes

- Tools should be LLM-provider agnostic (use admin-configured provider)
- Maintain audit trail of all tool invocations
- Consider rate limiting for cost control
- Future: Add more specialized tools (conflict detector, gap analyzer)
