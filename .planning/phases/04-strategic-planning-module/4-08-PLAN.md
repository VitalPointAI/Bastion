---
phase: 04-strategic-planning-module
plan: 08
type: execute
domain: strategic-agents
---

<objective>
Create strategic planning AI agents for OSINT collection and intelligence fusion.

Purpose: Implement multi-agent system for automated intelligence preparation with OSINT collection, threat monitoring, and fusion analysis.
Output: Agent classes with execution framework, orchestration via LangGraph patterns, and integration with admin config.
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
@.planning/phases/03-dao-governance/3-06-SUMMARY.md

**From research (ai_agent_architecture):**
- Tier 1: Collection Agents (fully automated) - OSINT, Document Processor, Threat Monitor
- Tier 2: Analysis Agents (AI + human review) - Fusion, Assessment, Extraction
- Human-in-the-loop checkpoints for all analysis outputs
- Agent outputs include confidence scores and questions for reviewers

**Established patterns:**
- [Phase 3-06]: AgentRegistry with trust tiers and delegation
- [Phase 3-06]: AgentExecutor with capability handlers
- Rule-based analysis with LLM-ready architecture

**From research (dont_hand_roll):**
- Use LangGraph.js patterns for orchestration
- Structured agent output with validation
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create OSINT and Threat Monitor agents</name>
  <files>backend/src/strategic/agents/osint-collector.ts, backend/src/strategic/agents/threat-monitor.ts, backend/src/strategic/agents/types.ts</files>
  <action>
Create backend/src/strategic/agents/ directory.

In types.ts, define agent interfaces:

```typescript
// Agent output wrapper with quality metadata
interface AgentOutput<T> {
  data: T;
  agentId: string;
  agentVersion: string;
  generatedAt: Date;
  confidenceScore: number;
  qualityIndicators: {
    sourceCount: number;
    sourceDiversity: number;
    contradictionCount: number;
    uncertaintyFlags: string[];
  };
  executiveSummary: string;
  keyFindings: string[];
  areasOfUncertainty: string[];
  questionsForReviewer: string[];
  inputSources: string[];
}

// OSINT Report
interface OSINTReport {
  id: string;
  source: string;
  sourceCredibility: number;
  collectedAt: Date;
  content: string;
  summary: string;
  entities: ExtractedEntity[];
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  relevanceScore: number;
  keywords: string[];
  geolocation?: { lat: number; lon: number };
}

interface ExtractedEntity {
  type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'EVENT' | 'WEAPON_SYSTEM' | 'MILITARY_UNIT';
  name: string;
  mentions: number;
  context: string;
}

// Threat Indicator
interface ThreatIndicator {
  id: string;
  type: 'MILITARY_ACTIVITY' | 'POLITICAL_INSTABILITY' | 'ECONOMIC_PRESSURE' | 'CYBER_THREAT' | 'INFORMATION_OPS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  sources: string[];
  firstObserved: Date;
  lastUpdated: Date;
  associatedActors: string[];
  geolocation?: { lat: number; lon: number };
  confidence: number;
}

// Human checkpoint for agent outputs
interface HumanCheckpoint {
  id: string;
  checkpointType: 'REVIEW' | 'APPROVAL' | 'EXCEPTION';
  itemType: string;
  itemId: string;
  itemSummary: string;
  agentAnalysis: string;
  agentRecommendation: string;
  confidenceScore: number;
  flaggedConcerns: string[];
  questionsForReviewer: string[];
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
  assignedTo?: string;
  decision?: {
    action: 'APPROVE' | 'REJECT' | 'REVISE';
    decidedBy: string;
    decidedAt: Date;
    rationale: string;
  };
}
```

In osint-collector.ts:
Create OSINTCollector class:

```typescript
class OSINTCollector {
  constructor(private configService: ConfigService) {}

  // Collect from configured OSINT sources
  async collect(keywords: string[], regions: string[]): Promise<AgentOutput<OSINTReport[]>> {
    const sources = await this.configService.getOSINTSources();
    const enabledSources = sources.filter(s => s.enabled);

    const reports: OSINTReport[] = [];

    for (const source of enabledSources) {
      try {
        const content = await this.fetchSource(source);
        const filtered = this.filterByKeywords(content, keywords);
        if (filtered.length > 0) {
          const analyzed = await this.analyzeContent(filtered, source);
          reports.push(...analyzed);
        }
      } catch (error) {
        console.error(`Failed to collect from ${source.name}:`, error);
        // Continue with other sources
      }
    }

    return this.wrapOutput(reports);
  }

  private async fetchSource(source: OSINTSourceConfig): Promise<string[]> {
    // Stub: In production, implement RSS parsing, API calls, etc.
    // For v1, return mock data or simple fetch
    return [];
  }

  private filterByKeywords(content: string[], keywords: string[]): string[] {
    return content.filter(c =>
      keywords.some(k => c.toLowerCase().includes(k.toLowerCase()))
    );
  }

  private async analyzeContent(content: string[], source: OSINTSourceConfig): Promise<OSINTReport[]> {
    // Use Instructor for entity extraction and sentiment analysis
    // Stub for now - full implementation requires LLM integration
    return content.map((c, i) => ({
      id: `osint-${Date.now()}-${i}`,
      source: source.name,
      sourceCredibility: source.credibilityRating,
      collectedAt: new Date(),
      content: c,
      summary: c.slice(0, 200),
      entities: [],
      sentiment: 'NEUTRAL' as const,
      relevanceScore: 0.5,
      keywords: [],
    }));
  }

  private wrapOutput(reports: OSINTReport[]): AgentOutput<OSINTReport[]> {
    return {
      data: reports,
      agentId: 'osint-collector',
      agentVersion: '1.0.0',
      generatedAt: new Date(),
      confidenceScore: reports.length > 0 ? 0.7 : 0,
      qualityIndicators: {
        sourceCount: new Set(reports.map(r => r.source)).size,
        sourceDiversity: 0.5,
        contradictionCount: 0,
        uncertaintyFlags: [],
      },
      executiveSummary: `Collected ${reports.length} OSINT reports`,
      keyFindings: reports.slice(0, 3).map(r => r.summary),
      areasOfUncertainty: [],
      questionsForReviewer: ['Verify source credibility', 'Check for bias'],
      inputSources: reports.map(r => r.source),
    };
  }
}
```

In threat-monitor.ts:
Create ThreatMonitor class with similar structure:
- Continuous monitoring via polling
- Threat indicator extraction
- Severity classification
- Alert generation for HIGH/CRITICAL threats
  </action>
  <verify>
```bash
cd backend && npx tsx -e "
import { OSINTCollector } from './src/strategic/agents/osint-collector.js';
import { ThreatMonitor } from './src/strategic/agents/threat-monitor.js';
console.log('OSINTCollector loaded');
console.log('ThreatMonitor loaded');
"
```
  </verify>
  <done>
- Agent output wrapper with quality metadata
- OSINTReport and ThreatIndicator types
- HumanCheckpoint for agent review
- OSINTCollector with source fetching and analysis stubs
- ThreatMonitor with indicator extraction
- Integration with admin config for source management
  </done>
</task>

<task type="auto">
  <name>Task 2: Create Fusion Agent with multi-source integration</name>
  <files>backend/src/strategic/agents/fusion-agent.ts, backend/src/strategic/agents/index.ts, backend/src/api/strategic-agents.ts</files>
  <action>
In fusion-agent.ts:
Create FusionAgent class for multi-source intelligence fusion:

```typescript
interface FusedIntelligenceProduct {
  id: string;
  createdAt: Date;
  classification: string;

  // PMESII-PT Operational Environment
  operationalEnvironment: {
    political: EnvironmentFactor[];
    military: EnvironmentFactor[];
    economic: EnvironmentFactor[];
    social: EnvironmentFactor[];
    information: EnvironmentFactor[];
    infrastructure: EnvironmentFactor[];
    physicalEnvironment: EnvironmentFactor[];
    time: EnvironmentFactor[];
  };

  threats: ThreatAssessment[];
  opportunities: Opportunity[];
  gaps: IntelligenceGap[];

  overallConfidence: number;
  sourceCount: number;
  sources: string[];

  reviewStatus: 'PENDING' | 'REVIEWED' | 'APPROVED';
  reviewedBy?: string;
  reviewNotes?: string;
}

interface EnvironmentFactor {
  factor: string;
  description: string;
  impact: 'FAVORABLE' | 'UNFAVORABLE' | 'NEUTRAL';
  confidence: number;
  sources: string[];
  lastUpdated: Date;
}

class FusionAgent {
  constructor(
    private osintCollector: OSINTCollector,
    private threatMonitor: ThreatMonitor
  ) {}

  async fuse(
    osintReports: OSINTReport[],
    threatIndicators: ThreatIndicator[],
    documentContext?: string
  ): Promise<AgentOutput<FusedIntelligenceProduct>> {

    // Correlate information across sources
    const correlations = this.findCorrelations(osintReports, threatIndicators);

    // Build operational environment picture (PMESII-PT)
    const opEnv = await this.buildOperationalEnvironment(osintReports, correlations);

    // Assess threats
    const threats = this.assessThreats(threatIndicators, correlations);

    // Identify opportunities
    const opportunities = this.identifyOpportunities(osintReports);

    // Identify intelligence gaps
    const gaps = this.identifyGaps(opEnv, threats);

    const product: FusedIntelligenceProduct = {
      id: `fused-${Date.now()}`,
      createdAt: new Date(),
      classification: 'UNCLASSIFIED',
      operationalEnvironment: opEnv,
      threats,
      opportunities,
      gaps,
      overallConfidence: this.calculateOverallConfidence(osintReports, threatIndicators),
      sourceCount: osintReports.length + threatIndicators.length,
      sources: [...new Set([
        ...osintReports.map(r => r.source),
        ...threatIndicators.map(t => t.sources).flat()
      ])],
      reviewStatus: 'PENDING',
    };

    return {
      data: product,
      agentId: 'fusion-agent',
      agentVersion: '1.0.0',
      generatedAt: new Date(),
      confidenceScore: product.overallConfidence,
      qualityIndicators: {
        sourceCount: product.sourceCount,
        sourceDiversity: this.calculateSourceDiversity(product.sources),
        contradictionCount: correlations.contradictions.length,
        uncertaintyFlags: gaps.map(g => g.description),
      },
      executiveSummary: this.generateExecutiveSummary(product),
      keyFindings: this.extractKeyFindings(product),
      areasOfUncertainty: gaps.map(g => g.description),
      questionsForReviewer: this.generateReviewQuestions(product),
      inputSources: product.sources,
    };
  }

  // Stub methods for full implementation
  private findCorrelations(reports, indicators) { return { matches: [], contradictions: [] }; }
  private async buildOperationalEnvironment(reports, correlations) { /* ... */ }
  private assessThreats(indicators, correlations) { return []; }
  private identifyOpportunities(reports) { return []; }
  private identifyGaps(opEnv, threats) { return []; }
  private calculateOverallConfidence(reports, indicators) { return 0.6; }
  private calculateSourceDiversity(sources) { return sources.length > 3 ? 0.8 : 0.5; }
  private generateExecutiveSummary(product) { return 'Fused intelligence product ready for review'; }
  private extractKeyFindings(product) { return []; }
  private generateReviewQuestions(product) { return ['Validate source credibility', 'Check for information gaps']; }
}
```

In index.ts:
- Export all agent classes
- Create AgentOrchestrator class that coordinates agents
- Singleton instances for each agent type

In api/strategic-agents.ts:
Create API endpoints for agent operations:

POST /api/strategic/agents/osint/collect
- Trigger OSINT collection
- Body: { keywords: string[], regions: string[] }
- Return: AgentOutput<OSINTReport[]>

POST /api/strategic/agents/threats/monitor
- Trigger threat monitoring run
- Return: AgentOutput<ThreatIndicator[]>

POST /api/strategic/agents/fuse
- Trigger intelligence fusion
- Body: { osintReportIds?: string[], threatIndicatorIds?: string[], context?: string }
- Return: AgentOutput<FusedIntelligenceProduct>

GET /api/strategic/agents/fused/:id
- Get fused intelligence product
- Include review status

POST /api/strategic/agents/fused/:id/review
- Review fused product
- Body: { approved: boolean, notes?: string }
- Set reviewStatus

GET /api/strategic/agents/checkpoints
- List pending human checkpoints
- Filter by status, agent

Mount in index.ts at /api/strategic/agents.
  </action>
  <verify>
```bash
cd backend && npx tsx -e "
import { FusionAgent } from './src/strategic/agents/fusion-agent.js';
import strategicAgentsRouter from './src/api/strategic-agents.js';
console.log('FusionAgent loaded');
console.log('Strategic agents router loaded');
"
```
  </verify>
  <done>
- FusedIntelligenceProduct with PMESII-PT structure
- FusionAgent with correlation and analysis
- AgentOrchestrator for coordination
- API endpoints for agent operations
- Human review checkpoints for fused products
- Integration with existing agent infrastructure
  </done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cd backend && pnpm build` succeeds without TypeScript errors
- [ ] Agent classes instantiate correctly
- [ ] API endpoints respond to requests
- [ ] Agent outputs include quality metadata
- [ ] Human checkpoints created for analysis outputs
</verification>

<success_criteria>

- OSINTCollector with source integration
- ThreatMonitor with indicator extraction
- FusionAgent with PMESII-PT analysis
- Agent output wrapper with quality metadata
- Human review checkpoints
- API endpoints for agent operations
- Ready for frontend integration in Plan 4-09
  </success_criteria>

<output>
After completion, create `.planning/phases/04-strategic-planning-module/4-08-SUMMARY.md`
</output>
