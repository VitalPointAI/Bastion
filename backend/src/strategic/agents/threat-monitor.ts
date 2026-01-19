/**
 * Threat Monitor Agent
 * Continuous monitoring for threat indicators with alert generation
 */

import { randomUUID } from 'crypto';
import { ConfigService, configService } from '../config/index.js';
import type {
  AgentOutput,
  ThreatIndicator,
  ThreatAlert,
  ThreatType,
  ThreatSeverity,
  ThreatMonitorRequest,
  OSINTReport,
  StrategicAgent,
} from './types.js';

/**
 * Threat classification rules
 * Rule-based threat detection with LLM-ready architecture
 */
interface ThreatRule {
  type: ThreatType;
  keywords: string[];
  severityModifiers: {
    critical: string[];
    high: string[];
  };
}

const THREAT_RULES: ThreatRule[] = [
  {
    type: 'MILITARY_ACTIVITY',
    keywords: ['troop', 'deployment', 'military', 'exercise', 'mobilization', 'naval', 'aircraft', 'missile'],
    severityModifiers: {
      critical: ['nuclear', 'invasion', 'attack', 'strike'],
      high: ['border', 'buildup', 'offensive', 'escalation'],
    },
  },
  {
    type: 'POLITICAL_INSTABILITY',
    keywords: ['coup', 'protest', 'unrest', 'election', 'regime', 'government', 'opposition', 'sanctions'],
    severityModifiers: {
      critical: ['coup', 'overthrow', 'martial law'],
      high: ['mass protest', 'state of emergency', 'violence'],
    },
  },
  {
    type: 'ECONOMIC_PRESSURE',
    keywords: ['sanction', 'trade', 'embargo', 'currency', 'debt', 'inflation', 'supply chain'],
    severityModifiers: {
      critical: ['default', 'collapse', 'blockade'],
      high: ['sanction', 'embargo', 'crisis'],
    },
  },
  {
    type: 'CYBER_THREAT',
    keywords: ['cyber', 'hack', 'breach', 'malware', 'ransomware', 'infrastructure', 'attack'],
    severityModifiers: {
      critical: ['critical infrastructure', 'grid', 'water', 'nuclear'],
      high: ['government', 'defense', 'financial'],
    },
  },
  {
    type: 'INFORMATION_OPS',
    keywords: ['disinformation', 'propaganda', 'influence', 'social media', 'bot', 'narrative', 'psyop'],
    severityModifiers: {
      critical: ['election interference', 'mass manipulation'],
      high: ['coordinated campaign', 'state-sponsored'],
    },
  },
];

/**
 * Threat Monitor Agent
 * Tier 1 Collection Agent - fully automated
 *
 * Responsibilities:
 * - Analyze OSINT reports for threat indicators
 * - Classify threats by type and severity
 * - Generate alerts for HIGH/CRITICAL threats
 * - Track threat evolution over time
 */
export class ThreatMonitor implements StrategicAgent {
  readonly agentId = 'threat-monitor';
  readonly agentVersion = '1.0.0';

  // In-memory store for alerts (production would use database)
  private alerts: Map<string, ThreatAlert> = new Map();

  constructor(private config: ConfigService = configService) {}

  /**
   * Check if Threat Monitor is enabled in admin config
   */
  async isEnabled(): Promise<boolean> {
    const agentConfig = await this.config.getAgentConfig();
    return agentConfig.enabledAgents.threatMonitor;
  }

  /**
   * Analyze OSINT reports for threat indicators
   *
   * @param reports - OSINT reports to analyze
   * @param request - Monitoring parameters
   * @returns AgentOutput containing threat indicators with quality metadata
   */
  async analyze(
    reports: OSINTReport[],
    request: ThreatMonitorRequest
  ): Promise<AgentOutput<ThreatIndicator[]>> {
    const { regions, threatTypes, severityThreshold = 'LOW' } = request;

    // Check if agent is enabled
    const enabled = await this.isEnabled();
    if (!enabled) {
      return this.wrapOutput([], 'Threat Monitor agent is disabled');
    }

    if (reports.length === 0) {
      return this.wrapOutput([], 'No OSINT reports provided for analysis');
    }

    const indicators: ThreatIndicator[] = [];

    // Analyze each report for threats
    for (const report of reports) {
      const detected = this.detectThreats(report);

      // Filter by requested threat types
      const filtered = threatTypes && threatTypes.length > 0
        ? detected.filter(d => threatTypes.includes(d.type))
        : detected;

      indicators.push(...filtered);
    }

    // Filter by severity threshold
    const severityOrder: ThreatSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const thresholdIndex = severityOrder.indexOf(severityThreshold);
    const filteredBySeverity = indicators.filter(
      i => severityOrder.indexOf(i.severity) >= thresholdIndex
    );

    // Deduplicate and merge similar indicators
    const merged = this.mergeIndicators(filteredBySeverity);

    // Generate alerts for HIGH/CRITICAL threats
    const highSeverity = merged.filter(i =>
      i.severity === 'HIGH' || i.severity === 'CRITICAL'
    );
    for (const indicator of highSeverity) {
      this.generateAlert(indicator);
    }

    return this.wrapOutput(merged);
  }

  /**
   * Run monitoring cycle (for scheduled execution)
   *
   * @param request - Monitoring parameters
   * @returns AgentOutput containing threat indicators
   */
  async monitor(request: ThreatMonitorRequest): Promise<AgentOutput<ThreatIndicator[]>> {
    // In production, this would:
    // 1. Trigger OSINT collection
    // 2. Analyze collected reports
    // 3. Compare with historical indicators
    // 4. Generate trend analysis

    // Stub: Return empty result
    return this.wrapOutput([], 'Monitoring cycle completed - no new data');
  }

  /**
   * Detect threats in a single OSINT report
   */
  private detectThreats(report: OSINTReport): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];
    const contentLower = report.content.toLowerCase();

    for (const rule of THREAT_RULES) {
      // Check if any keywords match
      const matchedKeywords = rule.keywords.filter(k =>
        contentLower.includes(k.toLowerCase())
      );

      if (matchedKeywords.length === 0) {
        continue;
      }

      // Determine severity
      const severity = this.determineSeverity(contentLower, rule);

      // Create indicator
      indicators.push({
        id: `threat-${Date.now()}-${randomUUID().slice(0, 8)}`,
        type: rule.type,
        severity,
        description: this.generateDescription(report, rule.type, matchedKeywords),
        sources: [report.source],
        firstObserved: new Date(),
        lastUpdated: new Date(),
        associatedActors: this.extractActors(report),
        geolocation: report.geolocation,
        confidence: this.calculateConfidence(report, matchedKeywords.length),
      });
    }

    return indicators;
  }

  /**
   * Determine threat severity based on content
   */
  private determineSeverity(content: string, rule: ThreatRule): ThreatSeverity {
    // Check for critical modifiers
    if (rule.severityModifiers.critical.some(m => content.includes(m.toLowerCase()))) {
      return 'CRITICAL';
    }

    // Check for high modifiers
    if (rule.severityModifiers.high.some(m => content.includes(m.toLowerCase()))) {
      return 'HIGH';
    }

    // Default based on keyword density
    const keywordMatches = rule.keywords.filter(k => content.includes(k.toLowerCase())).length;
    if (keywordMatches >= 3) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Generate threat description
   */
  private generateDescription(
    report: OSINTReport,
    threatType: ThreatType,
    keywords: string[]
  ): string {
    const typeLabel = threatType.replace(/_/g, ' ').toLowerCase();
    return `Potential ${typeLabel} detected. ` +
      `Keywords: ${keywords.join(', ')}. ` +
      `Source: ${report.source}. ` +
      `Summary: ${report.summary}`;
  }

  /**
   * Extract actor names from report
   */
  private extractActors(report: OSINTReport): string[] {
    // Use extracted entities if available
    const actors = report.entities
      .filter(e => e.type === 'PERSON' || e.type === 'ORGANIZATION' || e.type === 'MILITARY_UNIT')
      .map(e => e.name);

    return actors;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(report: OSINTReport, keywordMatches: number): number {
    // Base confidence from source credibility
    let confidence = report.sourceCredibility;

    // Boost for multiple keyword matches
    confidence += Math.min(0.2, keywordMatches * 0.05);

    // Cap at 0.95 (never 100% confident)
    return Math.min(0.95, confidence);
  }

  /**
   * Merge similar threat indicators
   */
  private mergeIndicators(indicators: ThreatIndicator[]): ThreatIndicator[] {
    const merged: Map<string, ThreatIndicator> = new Map();

    for (const indicator of indicators) {
      // Group by type + severity
      const key = `${indicator.type}-${indicator.severity}`;

      if (merged.has(key)) {
        const existing = merged.get(key)!;
        // Merge sources
        existing.sources = [...new Set([...existing.sources, ...indicator.sources])];
        // Merge actors
        existing.associatedActors = [...new Set([...existing.associatedActors, ...indicator.associatedActors])];
        // Update confidence (average)
        existing.confidence = (existing.confidence + indicator.confidence) / 2;
        // Update description with count
        existing.description = `Multiple ${indicator.type.replace(/_/g, ' ').toLowerCase()} indicators detected from ${existing.sources.length} sources.`;
      } else {
        merged.set(key, { ...indicator });
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Generate alert for high-severity threat
   */
  private generateAlert(indicator: ThreatIndicator): ThreatAlert {
    const alert: ThreatAlert = {
      id: `alert-${Date.now()}-${randomUUID().slice(0, 8)}`,
      indicatorId: indicator.id,
      severity: indicator.severity,
      title: `${indicator.severity} ${indicator.type.replace(/_/g, ' ')} Alert`,
      description: indicator.description,
      recommendedActions: this.getRecommendedActions(indicator),
      generatedAt: new Date(),
      acknowledged: false,
    };

    this.alerts.set(alert.id, alert);
    console.log(`Generated ${indicator.severity} threat alert: ${alert.id}`);

    return alert;
  }

  /**
   * Get recommended actions for threat type
   */
  private getRecommendedActions(indicator: ThreatIndicator): string[] {
    const baseActions = [
      'Verify threat through additional sources',
      'Assess potential impact on operations',
      'Brief relevant stakeholders',
    ];

    const typeSpecificActions: Record<ThreatType, string[]> = {
      MILITARY_ACTIVITY: [
        'Update force posture assessment',
        'Review contingency plans',
      ],
      POLITICAL_INSTABILITY: [
        'Monitor diplomatic channels',
        'Assess impact on regional stability',
      ],
      ECONOMIC_PRESSURE: [
        'Evaluate supply chain vulnerabilities',
        'Assess financial exposure',
      ],
      CYBER_THREAT: [
        'Increase network monitoring',
        'Review incident response procedures',
      ],
      INFORMATION_OPS: [
        'Identify narrative and target audience',
        'Prepare counter-messaging if appropriate',
      ],
    };

    return [...baseActions, ...(typeSpecificActions[indicator.type] || [])];
  }

  /**
   * Get pending alerts
   */
  getAlerts(acknowledged?: boolean): ThreatAlert[] {
    const allAlerts = Array.from(this.alerts.values());

    if (acknowledged === undefined) {
      return allAlerts;
    }

    return allAlerts.filter(a => a.acknowledged === acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, userId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    return true;
  }

  /**
   * Wrap indicators in AgentOutput with quality metadata
   */
  private wrapOutput(
    indicators: ThreatIndicator[],
    note?: string
  ): AgentOutput<ThreatIndicator[]> {
    const uniqueSources = new Set(indicators.flatMap(i => i.sources));
    const avgConfidence = indicators.length > 0
      ? indicators.reduce((sum, i) => sum + i.confidence, 0) / indicators.length
      : 0;

    // Count by severity
    const bySeverity = {
      CRITICAL: indicators.filter(i => i.severity === 'CRITICAL').length,
      HIGH: indicators.filter(i => i.severity === 'HIGH').length,
      MEDIUM: indicators.filter(i => i.severity === 'MEDIUM').length,
      LOW: indicators.filter(i => i.severity === 'LOW').length,
    };

    return {
      data: indicators,
      agentId: this.agentId,
      agentVersion: this.agentVersion,
      generatedAt: new Date(),
      confidenceScore: avgConfidence,
      qualityIndicators: {
        sourceCount: uniqueSources.size,
        sourceDiversity: Math.min(1, uniqueSources.size / Math.max(3, indicators.length)),
        contradictionCount: 0,
        uncertaintyFlags: note ? [note] : [],
      },
      executiveSummary: this.generateExecutiveSummary(indicators, bySeverity),
      keyFindings: this.extractKeyFindings(indicators),
      areasOfUncertainty: this.identifyUncertainties(indicators),
      questionsForReviewer: this.generateReviewQuestions(indicators),
      inputSources: Array.from(uniqueSources),
    };
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(
    indicators: ThreatIndicator[],
    bySeverity: Record<ThreatSeverity, number>
  ): string {
    if (indicators.length === 0) {
      return 'No threat indicators detected in the analyzed content.';
    }

    const parts: string[] = [];
    parts.push(`Detected ${indicators.length} threat indicators.`);

    if (bySeverity.CRITICAL > 0) {
      parts.push(`${bySeverity.CRITICAL} CRITICAL.`);
    }
    if (bySeverity.HIGH > 0) {
      parts.push(`${bySeverity.HIGH} HIGH.`);
    }
    if (bySeverity.MEDIUM > 0) {
      parts.push(`${bySeverity.MEDIUM} MEDIUM.`);
    }

    return parts.join(' ');
  }

  /**
   * Extract key findings
   */
  private extractKeyFindings(indicators: ThreatIndicator[]): string[] {
    // Prioritize by severity
    const sorted = [...indicators].sort((a, b) => {
      const order: ThreatSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      return order.indexOf(a.severity) - order.indexOf(b.severity);
    });

    return sorted.slice(0, 5).map(i =>
      `${i.severity} ${i.type.replace(/_/g, ' ')}: ${i.description.slice(0, 100)}...`
    );
  }

  /**
   * Identify areas of uncertainty
   */
  private identifyUncertainties(indicators: ThreatIndicator[]): string[] {
    const uncertainties: string[] = [];

    // Low confidence indicators
    const lowConfidence = indicators.filter(i => i.confidence < 0.5);
    if (lowConfidence.length > 0) {
      uncertainties.push(`${lowConfidence.length} indicators have low confidence scores`);
    }

    // Single-source indicators
    const singleSource = indicators.filter(i => i.sources.length === 1);
    if (singleSource.length > 0) {
      uncertainties.push(`${singleSource.length} indicators based on single source`);
    }

    return uncertainties;
  }

  /**
   * Generate questions for human reviewer
   */
  private generateReviewQuestions(indicators: ThreatIndicator[]): string[] {
    const questions: string[] = [];

    const critical = indicators.filter(i => i.severity === 'CRITICAL');
    if (critical.length > 0) {
      questions.push('Validate CRITICAL threat assessments against additional intelligence');
    }

    if (indicators.length > 0) {
      questions.push('Verify threat actor attributions');
      questions.push('Assess potential false positive rate');
      questions.push('Check for corroborating classified intelligence');
    }

    return questions;
  }
}

// Export singleton instance
export const threatMonitor = new ThreatMonitor();
