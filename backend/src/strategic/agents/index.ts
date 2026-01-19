/**
 * Strategic Planning AI Agents
 * Multi-agent system for OSINT collection, threat monitoring, and intelligence fusion
 */

import { ConfigService, configService } from '../config/index.js';
import { OSINTCollector, osintCollector } from './osint-collector.js';
import { ThreatMonitor, threatMonitor } from './threat-monitor.js';
import { FusionAgent, fusionAgent } from './fusion-agent.js';
import type {
  AgentOutput,
  OSINTReport,
  ThreatIndicator,
  HumanCheckpoint,
  OSINTCollectionRequest,
  ThreatMonitorRequest,
} from './types.js';
import type { FusedIntelligenceProduct } from './fusion-agent.js';

// Re-export types
export * from './types.js';
export * from './fusion-agent.js';

// Re-export agent classes
export { OSINTCollector, osintCollector } from './osint-collector.js';
export { ThreatMonitor, threatMonitor } from './threat-monitor.js';
export { FusionAgent, fusionAgent } from './fusion-agent.js';

/**
 * Agent execution status
 */
export interface AgentExecutionStatus {
  agentId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Full intelligence cycle result
 */
export interface IntelligenceCycleResult {
  osintOutput: AgentOutput<OSINTReport[]>;
  threatOutput: AgentOutput<ThreatIndicator[]>;
  fusedOutput: AgentOutput<FusedIntelligenceProduct>;
  executionTime: number;
  errors: string[];
}

/**
 * Agent Orchestrator
 * Coordinates multi-agent intelligence cycle
 *
 * Orchestration pattern:
 * 1. OSINT Collector gathers open source intelligence
 * 2. Threat Monitor analyzes for threat indicators
 * 3. Fusion Agent correlates and produces fused intelligence
 */
export class AgentOrchestrator {
  private executionHistory: AgentExecutionStatus[] = [];

  constructor(
    private config: ConfigService = configService,
    private osint: OSINTCollector = osintCollector,
    private threats: ThreatMonitor = threatMonitor,
    private fusion: FusionAgent = fusionAgent
  ) {}

  /**
   * Run full intelligence cycle
   *
   * @param osintRequest - OSINT collection parameters
   * @param threatRequest - Threat monitoring parameters
   * @param documentContext - Optional document context for fusion
   * @returns Complete intelligence cycle results
   */
  async runIntelligenceCycle(
    osintRequest: OSINTCollectionRequest,
    threatRequest: ThreatMonitorRequest,
    documentContext?: string
  ): Promise<IntelligenceCycleResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    // Step 1: OSINT Collection
    let osintOutput: AgentOutput<OSINTReport[]>;
    try {
      this.recordExecution(this.osint.agentId, 'RUNNING');
      osintOutput = await this.osint.collect(osintRequest);
      this.recordExecution(this.osint.agentId, 'COMPLETED');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`OSINT Collection: ${message}`);
      this.recordExecution(this.osint.agentId, 'FAILED', message);
      osintOutput = this.createEmptyOsintOutput();
    }

    // Step 2: Threat Monitoring
    let threatOutput: AgentOutput<ThreatIndicator[]>;
    try {
      this.recordExecution(this.threats.agentId, 'RUNNING');
      threatOutput = await this.threats.analyze(osintOutput.data, threatRequest);
      this.recordExecution(this.threats.agentId, 'COMPLETED');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Threat Monitoring: ${message}`);
      this.recordExecution(this.threats.agentId, 'FAILED', message);
      threatOutput = this.createEmptyThreatOutput();
    }

    // Step 3: Intelligence Fusion
    let fusedOutput: AgentOutput<FusedIntelligenceProduct>;
    try {
      this.recordExecution(this.fusion.agentId, 'RUNNING');
      fusedOutput = await this.fusion.fuse(
        osintOutput.data,
        threatOutput.data,
        documentContext
      );
      this.recordExecution(this.fusion.agentId, 'COMPLETED');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Intelligence Fusion: ${message}`);
      this.recordExecution(this.fusion.agentId, 'FAILED', message);
      fusedOutput = this.createEmptyFusionOutput();
    }

    const executionTime = Date.now() - startTime;

    return {
      osintOutput,
      threatOutput,
      fusedOutput,
      executionTime,
      errors,
    };
  }

  /**
   * Run OSINT collection only
   */
  async collectOSINT(request: OSINTCollectionRequest): Promise<AgentOutput<OSINTReport[]>> {
    return this.osint.collect(request);
  }

  /**
   * Run threat analysis on existing reports
   */
  async analyzeThreats(
    reports: OSINTReport[],
    request: ThreatMonitorRequest
  ): Promise<AgentOutput<ThreatIndicator[]>> {
    return this.threats.analyze(reports, request);
  }

  /**
   * Run fusion on existing data
   */
  async fuseIntelligence(
    reports: OSINTReport[],
    indicators: ThreatIndicator[],
    documentContext?: string
  ): Promise<AgentOutput<FusedIntelligenceProduct>> {
    return this.fusion.fuse(reports, indicators, documentContext);
  }

  /**
   * Get agent status
   */
  async getAgentStatus(): Promise<Record<string, { enabled: boolean; version: string }>> {
    const [osintEnabled, threatEnabled, fusionEnabled] = await Promise.all([
      this.osint.isEnabled(),
      this.threats.isEnabled(),
      this.fusion.isEnabled(),
    ]);

    return {
      [this.osint.agentId]: { enabled: osintEnabled, version: this.osint.agentVersion },
      [this.threats.agentId]: { enabled: threatEnabled, version: this.threats.agentVersion },
      [this.fusion.agentId]: { enabled: fusionEnabled, version: this.fusion.agentVersion },
    };
  }

  /**
   * Get pending human checkpoints
   */
  getPendingCheckpoints(): HumanCheckpoint[] {
    return this.fusion.getCheckpoints('PENDING');
  }

  /**
   * Get pending threat alerts
   */
  getPendingAlerts() {
    return this.threats.getAlerts(false);
  }

  /**
   * Acknowledge a threat alert
   */
  acknowledgeAlert(alertId: string, userId: string): boolean {
    return this.threats.acknowledgeAlert(alertId, userId);
  }

  /**
   * Review a fused product
   */
  reviewFusedProduct(
    productId: string,
    reviewedBy: string,
    approved: boolean,
    notes?: string
  ): boolean {
    return this.fusion.reviewProduct(productId, reviewedBy, approved, notes);
  }

  /**
   * Resolve a human checkpoint
   */
  resolveCheckpoint(
    checkpointId: string,
    decidedBy: string,
    action: 'APPROVE' | 'REJECT' | 'REVISE',
    rationale: string
  ): boolean {
    return this.fusion.resolveCheckpoint(checkpointId, decidedBy, action, rationale);
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): AgentExecutionStatus[] {
    return [...this.executionHistory];
  }

  /**
   * Record agent execution
   */
  private recordExecution(
    agentId: string,
    status: 'RUNNING' | 'COMPLETED' | 'FAILED',
    error?: string
  ): void {
    if (status === 'RUNNING') {
      this.executionHistory.push({
        agentId,
        status,
        startedAt: new Date(),
      });
    } else {
      // Update existing entry
      const entry = this.executionHistory
        .reverse()
        .find(e => e.agentId === agentId && e.status === 'RUNNING');
      if (entry) {
        entry.status = status;
        entry.completedAt = new Date();
        if (error) {
          entry.error = error;
        }
      }
    }
  }

  /**
   * Create empty OSINT output for error cases
   */
  private createEmptyOsintOutput(): AgentOutput<OSINTReport[]> {
    return {
      data: [],
      agentId: this.osint.agentId,
      agentVersion: this.osint.agentVersion,
      generatedAt: new Date(),
      confidenceScore: 0,
      qualityIndicators: {
        sourceCount: 0,
        sourceDiversity: 0,
        contradictionCount: 0,
        uncertaintyFlags: ['Agent execution failed'],
      },
      executiveSummary: 'OSINT collection failed',
      keyFindings: [],
      areasOfUncertainty: ['Collection failed - no data available'],
      questionsForReviewer: ['Investigate collection failure'],
      inputSources: [],
    };
  }

  /**
   * Create empty threat output for error cases
   */
  private createEmptyThreatOutput(): AgentOutput<ThreatIndicator[]> {
    return {
      data: [],
      agentId: this.threats.agentId,
      agentVersion: this.threats.agentVersion,
      generatedAt: new Date(),
      confidenceScore: 0,
      qualityIndicators: {
        sourceCount: 0,
        sourceDiversity: 0,
        contradictionCount: 0,
        uncertaintyFlags: ['Agent execution failed'],
      },
      executiveSummary: 'Threat analysis failed',
      keyFindings: [],
      areasOfUncertainty: ['Analysis failed - no data available'],
      questionsForReviewer: ['Investigate analysis failure'],
      inputSources: [],
    };
  }

  /**
   * Create empty fusion output for error cases
   */
  private createEmptyFusionOutput(): AgentOutput<FusedIntelligenceProduct> {
    return {
      data: {
        id: `fused-error-${Date.now()}`,
        createdAt: new Date(),
        classification: 'UNCLASSIFIED',
        operationalEnvironment: {
          political: [],
          military: [],
          economic: [],
          social: [],
          information: [],
          infrastructure: [],
          physicalEnvironment: [],
          time: [],
        },
        threats: [],
        opportunities: [],
        gaps: [],
        overallConfidence: 0,
        sourceCount: 0,
        sources: [],
        reviewStatus: 'PENDING',
      },
      agentId: this.fusion.agentId,
      agentVersion: this.fusion.agentVersion,
      generatedAt: new Date(),
      confidenceScore: 0,
      qualityIndicators: {
        sourceCount: 0,
        sourceDiversity: 0,
        contradictionCount: 0,
        uncertaintyFlags: ['Agent execution failed'],
      },
      executiveSummary: 'Intelligence fusion failed',
      keyFindings: [],
      areasOfUncertainty: ['Fusion failed - no data available'],
      questionsForReviewer: ['Investigate fusion failure'],
      inputSources: [],
    };
  }
}

// Export singleton instance
export const agentOrchestrator = new AgentOrchestrator();
