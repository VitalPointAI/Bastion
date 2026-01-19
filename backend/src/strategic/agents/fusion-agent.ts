/**
 * Fusion Agent
 * Multi-source intelligence fusion with PMESII-PT operational environment analysis
 */

import { randomUUID } from 'crypto';
import { ConfigService, configService } from '../config/index.js';
import type {
  AgentOutput,
  OSINTReport,
  ThreatIndicator,
  HumanCheckpoint,
  StrategicAgent,
} from './types.js';

// ============================================================================
// Fusion-Specific Types
// ============================================================================

/**
 * Impact classification for environment factors
 */
export type EnvironmentImpact = 'FAVORABLE' | 'UNFAVORABLE' | 'NEUTRAL';

/**
 * PMESII-PT Environment Factor
 */
export interface EnvironmentFactor {
  factor: string;
  description: string;
  impact: EnvironmentImpact;
  confidence: number;
  sources: string[];
  lastUpdated: Date;
}

/**
 * PMESII-PT Operational Environment structure
 */
export interface OperationalEnvironment {
  political: EnvironmentFactor[];
  military: EnvironmentFactor[];
  economic: EnvironmentFactor[];
  social: EnvironmentFactor[];
  information: EnvironmentFactor[];
  infrastructure: EnvironmentFactor[];
  physicalEnvironment: EnvironmentFactor[];
  time: EnvironmentFactor[];
}

/**
 * Threat assessment from fusion analysis
 */
export interface ThreatAssessment {
  id: string;
  threatType: string;
  likelihood: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  indicators: string[];
  mitigationOptions: string[];
  confidence: number;
}

/**
 * Opportunity identified through fusion
 */
export interface Opportunity {
  id: string;
  type: string;
  description: string;
  windowOfAction: string;
  requiredResources: string[];
  potentialRisks: string[];
  confidence: number;
}

/**
 * Intelligence gap requiring collection
 */
export interface IntelligenceGap {
  id: string;
  area: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedSources: string[];
  impactIfUnfilled: string;
}

/**
 * Source correlation result
 */
export interface CorrelationResult {
  matches: Array<{
    reportId: string;
    indicatorId: string;
    correlationType: string;
    confidence: number;
  }>;
  contradictions: Array<{
    source1: string;
    source2: string;
    description: string;
  }>;
}

/**
 * Fused Intelligence Product
 * Comprehensive intelligence assessment from multiple sources
 */
export interface FusedIntelligenceProduct {
  id: string;
  createdAt: Date;
  classification: string;

  // PMESII-PT Operational Environment
  operationalEnvironment: OperationalEnvironment;

  threats: ThreatAssessment[];
  opportunities: Opportunity[];
  gaps: IntelligenceGap[];

  overallConfidence: number;
  sourceCount: number;
  sources: string[];

  reviewStatus: 'PENDING' | 'REVIEWED' | 'APPROVED';
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
}

/**
 * Fusion Agent
 * Tier 2 Analysis Agent - AI + human review
 *
 * Responsibilities:
 * - Correlate information across OSINT reports and threat indicators
 * - Build PMESII-PT operational environment picture
 * - Assess threats with likelihood/impact analysis
 * - Identify opportunities and intelligence gaps
 * - Generate human review checkpoints
 */
export class FusionAgent implements StrategicAgent {
  readonly agentId = 'fusion-agent';
  readonly agentVersion = '1.0.0';

  // In-memory store for fused products (production would use database)
  private products: Map<string, FusedIntelligenceProduct> = new Map();
  private checkpoints: Map<string, HumanCheckpoint> = new Map();

  constructor(private config: ConfigService = configService) {}

  /**
   * Check if Fusion Agent is enabled in admin config
   */
  async isEnabled(): Promise<boolean> {
    const agentConfig = await this.config.getAgentConfig();
    return agentConfig.enabledAgents.fusionAgent;
  }

  /**
   * Fuse intelligence from multiple sources
   *
   * @param osintReports - OSINT reports to fuse
   * @param threatIndicators - Threat indicators to correlate
   * @param documentContext - Optional additional context from documents
   * @returns AgentOutput containing fused intelligence product
   */
  async fuse(
    osintReports: OSINTReport[],
    threatIndicators: ThreatIndicator[],
    documentContext?: string
  ): Promise<AgentOutput<FusedIntelligenceProduct>> {
    // Check if agent is enabled
    const enabled = await this.isEnabled();
    if (!enabled) {
      return this.wrapOutput(this.createEmptyProduct(), 'Fusion Agent is disabled');
    }

    // Correlate information across sources
    const correlations = this.findCorrelations(osintReports, threatIndicators);

    // Build operational environment picture (PMESII-PT)
    const opEnv = this.buildOperationalEnvironment(osintReports, correlations);

    // Assess threats
    const threats = this.assessThreats(threatIndicators, correlations);

    // Identify opportunities
    const opportunities = this.identifyOpportunities(osintReports, opEnv);

    // Identify intelligence gaps
    const gaps = this.identifyGaps(opEnv, threats);

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(osintReports, threatIndicators);

    // Collect all unique sources
    const allSources = [
      ...new Set([
        ...osintReports.map(r => r.source),
        ...threatIndicators.flatMap(t => t.sources),
      ]),
    ];

    // Create fused product
    const product: FusedIntelligenceProduct = {
      id: `fused-${Date.now()}-${randomUUID().slice(0, 8)}`,
      createdAt: new Date(),
      classification: 'UNCLASSIFIED', // Would be determined by source classifications
      operationalEnvironment: opEnv,
      threats,
      opportunities,
      gaps,
      overallConfidence,
      sourceCount: osintReports.length + threatIndicators.length,
      sources: allSources,
      reviewStatus: 'PENDING',
    };

    // Store product
    this.products.set(product.id, product);

    // Create human checkpoint for review
    this.createCheckpoint(product, correlations);

    return this.wrapOutput(product);
  }

  /**
   * Get a fused product by ID
   */
  getProduct(id: string): FusedIntelligenceProduct | undefined {
    return this.products.get(id);
  }

  /**
   * List all fused products
   */
  listProducts(status?: 'PENDING' | 'REVIEWED' | 'APPROVED'): FusedIntelligenceProduct[] {
    const all = Array.from(this.products.values());
    if (!status) return all;
    return all.filter(p => p.reviewStatus === status);
  }

  /**
   * Review a fused product
   */
  reviewProduct(
    id: string,
    reviewedBy: string,
    approved: boolean,
    notes?: string
  ): boolean {
    const product = this.products.get(id);
    if (!product) return false;

    product.reviewStatus = approved ? 'APPROVED' : 'REVIEWED';
    product.reviewedBy = reviewedBy;
    product.reviewedAt = new Date();
    product.reviewNotes = notes;

    return true;
  }

  /**
   * Get pending human checkpoints
   */
  getCheckpoints(status?: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED'): HumanCheckpoint[] {
    const all = Array.from(this.checkpoints.values());
    if (!status) return all;
    return all.filter(c => c.status === status);
  }

  /**
   * Resolve a human checkpoint
   */
  resolveCheckpoint(
    id: string,
    decidedBy: string,
    action: 'APPROVE' | 'REJECT' | 'REVISE',
    rationale: string
  ): boolean {
    const checkpoint = this.checkpoints.get(id);
    if (!checkpoint) return false;

    checkpoint.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    checkpoint.decision = {
      action,
      decidedBy,
      decidedAt: new Date(),
      rationale,
    };

    return true;
  }

  /**
   * Find correlations between OSINT reports and threat indicators
   */
  private findCorrelations(
    reports: OSINTReport[],
    indicators: ThreatIndicator[]
  ): CorrelationResult {
    const matches: CorrelationResult['matches'] = [];
    const contradictions: CorrelationResult['contradictions'] = [];

    // Match reports to indicators by entities, keywords, and geography
    for (const report of reports) {
      for (const indicator of indicators) {
        // Check for entity matches
        const reportEntities = report.entities.map(e => e.name.toLowerCase());
        const indicatorActors = indicator.associatedActors.map(a => a.toLowerCase());

        const entityMatches = reportEntities.filter(e =>
          indicatorActors.some(a => a.includes(e) || e.includes(a))
        );

        if (entityMatches.length > 0) {
          matches.push({
            reportId: report.id,
            indicatorId: indicator.id,
            correlationType: 'ENTITY_MATCH',
            confidence: Math.min(0.9, 0.5 + entityMatches.length * 0.1),
          });
        }

        // Check for geographic correlation
        if (report.geolocation && indicator.geolocation) {
          const distance = this.calculateDistance(
            report.geolocation,
            indicator.geolocation
          );
          if (distance < 100) { // 100km threshold
            matches.push({
              reportId: report.id,
              indicatorId: indicator.id,
              correlationType: 'GEOGRAPHIC_PROXIMITY',
              confidence: Math.max(0.3, 1 - distance / 100),
            });
          }
        }

        // Check for keyword overlap (content analysis)
        const reportKeywords = new Set(report.keywords.map(k => k.toLowerCase()));
        const indicatorWords = indicator.description.toLowerCase().split(/\s+/);
        const keywordMatches = indicatorWords.filter(w => reportKeywords.has(w));

        if (keywordMatches.length >= 2) {
          matches.push({
            reportId: report.id,
            indicatorId: indicator.id,
            correlationType: 'KEYWORD_OVERLAP',
            confidence: Math.min(0.7, 0.3 + keywordMatches.length * 0.1),
          });
        }
      }
    }

    // Check for contradictions between reports
    for (let i = 0; i < reports.length; i++) {
      for (let j = i + 1; j < reports.length; j++) {
        const r1 = reports[i];
        const r2 = reports[j];

        // Simple contradiction: opposing sentiments on same topic
        if (r1.sentiment !== r2.sentiment && r1.sentiment !== 'NEUTRAL' && r2.sentiment !== 'NEUTRAL') {
          const sharedKeywords = r1.keywords.filter(k => r2.keywords.includes(k));
          if (sharedKeywords.length >= 2) {
            contradictions.push({
              source1: r1.source,
              source2: r2.source,
              description: `Conflicting sentiment on topics: ${sharedKeywords.join(', ')}`,
            });
          }
        }
      }
    }

    return { matches, contradictions };
  }

  /**
   * Build PMESII-PT operational environment
   */
  private buildOperationalEnvironment(
    reports: OSINTReport[],
    correlations: CorrelationResult
  ): OperationalEnvironment {
    // Initialize empty environment
    const env: OperationalEnvironment = {
      political: [],
      military: [],
      economic: [],
      social: [],
      information: [],
      infrastructure: [],
      physicalEnvironment: [],
      time: [],
    };

    // Categorize reports into PMESII-PT dimensions
    // This is a simplified rule-based approach; production would use LLM

    const pmesiiKeywords: Record<keyof OperationalEnvironment, string[]> = {
      political: ['government', 'election', 'policy', 'diplomatic', 'sanctions', 'regime', 'parliament'],
      military: ['military', 'defense', 'troops', 'naval', 'aircraft', 'weapon', 'exercise', 'deployment'],
      economic: ['economic', 'trade', 'currency', 'gdp', 'inflation', 'market', 'supply chain', 'sanctions'],
      social: ['population', 'protest', 'civil', 'ethnic', 'religion', 'migration', 'public opinion'],
      information: ['media', 'cyber', 'propaganda', 'social media', 'disinformation', 'communication'],
      infrastructure: ['infrastructure', 'power', 'grid', 'transport', 'port', 'airport', 'road', 'bridge'],
      physicalEnvironment: ['terrain', 'weather', 'climate', 'geography', 'natural disaster'],
      time: ['deadline', 'timeline', 'schedule', 'window', 'opportunity', 'anniversary'],
    };

    for (const report of reports) {
      const contentLower = report.content.toLowerCase();

      for (const [dimension, keywords] of Object.entries(pmesiiKeywords)) {
        const matchedKeywords = keywords.filter(k => contentLower.includes(k));

        if (matchedKeywords.length > 0) {
          const factor: EnvironmentFactor = {
            factor: matchedKeywords.join(', '),
            description: report.summary,
            impact: this.determineImpact(report.sentiment),
            confidence: report.relevanceScore * report.sourceCredibility,
            sources: [report.source],
            lastUpdated: report.collectedAt,
          };

          env[dimension as keyof OperationalEnvironment].push(factor);
        }
      }
    }

    return env;
  }

  /**
   * Determine impact from sentiment
   */
  private determineImpact(sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'): EnvironmentImpact {
    switch (sentiment) {
      case 'POSITIVE':
        return 'FAVORABLE';
      case 'NEGATIVE':
        return 'UNFAVORABLE';
      default:
        return 'NEUTRAL';
    }
  }

  /**
   * Assess threats from indicators
   */
  private assessThreats(
    indicators: ThreatIndicator[],
    correlations: CorrelationResult
  ): ThreatAssessment[] {
    return indicators.map(indicator => {
      // Find correlating reports
      const relatedMatches = correlations.matches.filter(m => m.indicatorId === indicator.id);
      const corroborated = relatedMatches.length > 0;

      // Determine likelihood from severity and corroboration
      const likelihood = this.severityToLikelihood(indicator.severity, corroborated);

      // Determine impact (would be more sophisticated in production)
      const impact = this.severityToImpact(indicator.severity);

      return {
        id: `assess-${indicator.id}`,
        threatType: indicator.type,
        likelihood,
        impact,
        description: indicator.description,
        indicators: [indicator.id, ...relatedMatches.map(m => m.reportId)],
        mitigationOptions: this.suggestMitigations(indicator.type),
        confidence: corroborated ? Math.min(0.95, indicator.confidence + 0.1) : indicator.confidence,
      };
    });
  }

  /**
   * Convert severity to likelihood
   */
  private severityToLikelihood(
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    corroborated: boolean
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
    const boost = corroborated ? 1 : 0;
    const levels: Array<'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'> = ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
    const severityIndex = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(severity);
    return levels[Math.min(3, severityIndex + boost)];
  }

  /**
   * Convert severity to impact
   */
  private severityToImpact(
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    return severity;
  }

  /**
   * Suggest mitigations by threat type
   */
  private suggestMitigations(threatType: string): string[] {
    const mitigations: Record<string, string[]> = {
      MILITARY_ACTIVITY: [
        'Increase ISR coverage',
        'Review force protection measures',
        'Update contingency plans',
      ],
      POLITICAL_INSTABILITY: [
        'Engage diplomatic channels',
        'Prepare contingency messaging',
        'Review evacuation procedures',
      ],
      ECONOMIC_PRESSURE: [
        'Diversify supply chains',
        'Secure critical stockpiles',
        'Engage economic partners',
      ],
      CYBER_THREAT: [
        'Increase network monitoring',
        'Implement additional security controls',
        'Review incident response plans',
      ],
      INFORMATION_OPS: [
        'Identify and counter false narratives',
        'Prepare public affairs response',
        'Engage trusted media partners',
      ],
    };

    return mitigations[threatType] || ['Conduct further analysis', 'Engage subject matter experts'];
  }

  /**
   * Identify opportunities from OSINT
   */
  private identifyOpportunities(
    reports: OSINTReport[],
    opEnv: OperationalEnvironment
  ): Opportunity[] {
    const opportunities: Opportunity[] = [];

    // Look for favorable conditions
    const favorableFactors = [
      ...opEnv.political.filter(f => f.impact === 'FAVORABLE'),
      ...opEnv.economic.filter(f => f.impact === 'FAVORABLE'),
      ...opEnv.social.filter(f => f.impact === 'FAVORABLE'),
    ];

    for (const factor of favorableFactors) {
      opportunities.push({
        id: `opp-${randomUUID().slice(0, 8)}`,
        type: 'FAVORABLE_CONDITIONS',
        description: `Favorable conditions detected: ${factor.factor}`,
        windowOfAction: 'Assessment required',
        requiredResources: ['Further analysis', 'SME consultation'],
        potentialRisks: ['Conditions may change', 'Incomplete picture'],
        confidence: factor.confidence,
      });
    }

    return opportunities;
  }

  /**
   * Identify intelligence gaps
   */
  private identifyGaps(
    opEnv: OperationalEnvironment,
    threats: ThreatAssessment[]
  ): IntelligenceGap[] {
    const gaps: IntelligenceGap[] = [];

    // Check for empty PMESII-PT dimensions
    const dimensions = Object.entries(opEnv) as Array<[string, EnvironmentFactor[]]>;

    for (const [dimension, factors] of dimensions) {
      if (factors.length === 0) {
        gaps.push({
          id: `gap-${randomUUID().slice(0, 8)}`,
          area: dimension.toUpperCase(),
          description: `No information collected on ${dimension} dimension`,
          priority: 'MEDIUM',
          suggestedSources: ['Expand OSINT collection', 'Request HUMINT'],
          impactIfUnfilled: `Unable to assess ${dimension} factors for operational environment`,
        });
      }
    }

    // Check for low-confidence threats
    const lowConfidenceThreats = threats.filter(t => t.confidence < 0.5);
    for (const threat of lowConfidenceThreats) {
      gaps.push({
        id: `gap-${randomUUID().slice(0, 8)}`,
        area: 'THREAT_VALIDATION',
        description: `Low confidence on ${threat.threatType} threat`,
        priority: threat.impact === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        suggestedSources: ['Additional OSINT', 'Request classified intelligence'],
        impactIfUnfilled: `Cannot reliably assess ${threat.threatType} threat`,
      });
    }

    return gaps;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(
    reports: OSINTReport[],
    indicators: ThreatIndicator[]
  ): number {
    if (reports.length === 0 && indicators.length === 0) {
      return 0;
    }

    const reportAvg = reports.length > 0
      ? reports.reduce((sum, r) => sum + r.sourceCredibility * r.relevanceScore, 0) / reports.length
      : 0;

    const indicatorAvg = indicators.length > 0
      ? indicators.reduce((sum, i) => sum + i.confidence, 0) / indicators.length
      : 0;

    // Weighted average favoring more sources
    const totalSources = reports.length + indicators.length;
    return (reportAvg * reports.length + indicatorAvg * indicators.length) / totalSources;
  }

  /**
   * Calculate distance between two geolocations (Haversine formula)
   */
  private calculateDistance(
    loc1: { lat: number; lon: number },
    loc2: { lat: number; lon: number }
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(loc2.lat - loc1.lat);
    const dLon = this.toRad(loc2.lon - loc1.lon);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(loc1.lat)) * Math.cos(this.toRad(loc2.lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Create empty product for error cases
   */
  private createEmptyProduct(): FusedIntelligenceProduct {
    return {
      id: `fused-empty-${Date.now()}`,
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
    };
  }

  /**
   * Create human checkpoint for fused product review
   */
  private createCheckpoint(
    product: FusedIntelligenceProduct,
    correlations: CorrelationResult
  ): void {
    const checkpoint: HumanCheckpoint = {
      id: `checkpoint-${product.id}`,
      checkpointType: 'REVIEW',
      itemType: 'FusedIntelligenceProduct',
      itemId: product.id,
      itemSummary: `Fused intelligence from ${product.sourceCount} sources`,
      agentAnalysis: this.generateAnalysisSummary(product),
      agentRecommendation: product.threats.length > 0
        ? 'Review threat assessments and validate correlations'
        : 'Low threat level detected - verify completeness',
      confidenceScore: product.overallConfidence,
      flaggedConcerns: [
        ...correlations.contradictions.map(c => `Contradiction: ${c.description}`),
        ...product.gaps.filter(g => g.priority === 'CRITICAL').map(g => `Critical gap: ${g.description}`),
      ],
      questionsForReviewer: this.generateReviewQuestions(product),
      status: 'PENDING',
      createdAt: new Date(),
    };

    this.checkpoints.set(checkpoint.id, checkpoint);
  }

  /**
   * Generate analysis summary for checkpoint
   */
  private generateAnalysisSummary(product: FusedIntelligenceProduct): string {
    const parts: string[] = [];

    parts.push(`Analyzed ${product.sourceCount} sources.`);

    const criticalThreats = product.threats.filter(t => t.impact === 'CRITICAL');
    if (criticalThreats.length > 0) {
      parts.push(`${criticalThreats.length} CRITICAL threat(s) identified.`);
    }

    if (product.gaps.length > 0) {
      parts.push(`${product.gaps.length} intelligence gap(s) identified.`);
    }

    return parts.join(' ');
  }

  /**
   * Generate review questions
   */
  private generateReviewQuestions(product: FusedIntelligenceProduct): string[] {
    const questions: string[] = [];

    if (product.threats.length > 0) {
      questions.push('Validate threat assessments against known intelligence');
    }

    if (product.gaps.filter(g => g.priority === 'CRITICAL').length > 0) {
      questions.push('Prioritize collection requirements for critical gaps');
    }

    if (product.overallConfidence < 0.5) {
      questions.push('Assess whether additional sources are needed before acting');
    }

    questions.push('Verify PMESII-PT categorization is accurate');
    questions.push('Check for any overlooked correlations');

    return questions;
  }

  /**
   * Wrap product in AgentOutput with quality metadata
   */
  private wrapOutput(
    product: FusedIntelligenceProduct,
    note?: string
  ): AgentOutput<FusedIntelligenceProduct> {
    return {
      data: product,
      agentId: this.agentId,
      agentVersion: this.agentVersion,
      generatedAt: new Date(),
      confidenceScore: product.overallConfidence,
      qualityIndicators: {
        sourceCount: product.sourceCount,
        sourceDiversity: this.calculateSourceDiversity(product.sources),
        contradictionCount: 0, // Would be tracked during fusion
        uncertaintyFlags: note
          ? [note]
          : product.gaps.filter(g => g.priority === 'CRITICAL').map(g => g.description),
      },
      executiveSummary: this.generateExecutiveSummary(product),
      keyFindings: this.extractKeyFindings(product),
      areasOfUncertainty: product.gaps.map(g => g.description),
      questionsForReviewer: this.generateReviewQuestions(product),
      inputSources: product.sources,
    };
  }

  /**
   * Calculate source diversity
   */
  private calculateSourceDiversity(sources: string[]): number {
    if (sources.length === 0) return 0;
    // Simple diversity: more unique sources = higher diversity
    return Math.min(1, sources.length / 5);
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(product: FusedIntelligenceProduct): string {
    const parts: string[] = [];

    parts.push(`Fused intelligence product from ${product.sourceCount} sources.`);

    const criticalThreats = product.threats.filter(t => t.impact === 'CRITICAL');
    const highThreats = product.threats.filter(t => t.impact === 'HIGH');

    if (criticalThreats.length > 0) {
      parts.push(`CRITICAL: ${criticalThreats.length} critical threat(s).`);
    }
    if (highThreats.length > 0) {
      parts.push(`${highThreats.length} high-impact threat(s).`);
    }

    if (product.opportunities.length > 0) {
      parts.push(`${product.opportunities.length} opportunity(ies) identified.`);
    }

    parts.push(`Overall confidence: ${(product.overallConfidence * 100).toFixed(0)}%.`);

    return parts.join(' ');
  }

  /**
   * Extract key findings
   */
  private extractKeyFindings(product: FusedIntelligenceProduct): string[] {
    const findings: string[] = [];

    // Critical threats first
    for (const threat of product.threats.filter(t => t.impact === 'CRITICAL')) {
      findings.push(`CRITICAL: ${threat.description.slice(0, 100)}...`);
    }

    // High threats
    for (const threat of product.threats.filter(t => t.impact === 'HIGH')) {
      findings.push(`HIGH: ${threat.description.slice(0, 100)}...`);
    }

    // Opportunities
    for (const opp of product.opportunities.slice(0, 2)) {
      findings.push(`Opportunity: ${opp.description.slice(0, 100)}...`);
    }

    return findings.slice(0, 5);
  }
}

// Export singleton instance
export const fusionAgent = new FusionAgent();
