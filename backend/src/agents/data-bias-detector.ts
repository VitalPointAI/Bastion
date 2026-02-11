/**
 * Data Bias Detector Agent
 *
 * Identifies statistical bias, data staleness, coverage gaps, and systematic
 * errors in intelligence data feeds.
 *
 * Purpose: Intelligence analysis quality depends on data quality. This agent
 * flags when the data underlying AI agent outputs may be biased, stale, or
 * incomplete, supporting better human decision-making.
 *
 * INVARIANT 5: All outputs include confidence intervals per governance requirements.
 */

import type { AgentManifest } from './types.js';
import { AgentPhase, AgentCapability, AutonomyLevel, ProposalKind } from './types.js';

// ==========================================================================
// Output Interfaces
// ==========================================================================

/**
 * Types of bias that can be detected in intelligence data.
 */
export type BiasType =
  | 'selection_bias'
  | 'confirmation_bias'
  | 'anchoring_bias'
  | 'survivorship_bias'
  | 'cultural_bias'
  | 'temporal_bias'
  | 'geographic_bias'
  | 'source_bias'
  | 'availability_bias';

/**
 * Individual bias detection result.
 */
export interface DetectedBias {
  /** Type of bias identified */
  biasType: BiasType;
  /** Description of the bias */
  description: string;
  /** Data sources/fields affected */
  affectedData: string[];
  /** Severity classification */
  severity: 'critical' | 'major' | 'minor';
  /** Confidence in bias detection (0-1) */
  detectionConfidence: number;
  /** Confidence interval per INVARIANT 5 */
  confidenceBounds: { lower: number; upper: number };
  /** Suggested mitigation approach */
  mitigationSuggestion: string;
}

/**
 * Staleness analysis for a data source.
 */
export interface StalenessReport {
  /** Data source identifier */
  dataSource: string;
  /** Last update timestamp (epoch ms) */
  lastUpdated: number;
  /** Age in hours */
  ageHours: number;
  /** Configured freshness threshold (hours) */
  freshnessThresholdHours: number;
  /** Whether data is considered stale */
  isStale: boolean;
  /** Impact description if data is stale */
  impactIfStale: string;
}

/**
 * Coverage gap in data collection.
 */
export interface CoverageGap {
  /** Domain or area with coverage gap */
  domain: string;
  /** Expected coverage description */
  expectedCoverage: string;
  /** Actual coverage description */
  actualCoverage: string;
  /** Gap description */
  gapDescription: string;
  /** Impact on analysis quality */
  impactOnAnalysis: string;
  /** Severity classification */
  severity: 'critical' | 'major' | 'minor';
}

/**
 * Complete bias analysis output.
 * Includes confidence intervals per INVARIANT 5.
 */
export interface BiasAnalysisOutput {
  /** Detected biases */
  detectedBiases: DetectedBias[];
  /** Data staleness findings */
  stalenessReports: StalenessReport[];
  /** Coverage gaps identified */
  coverageGaps: CoverageGap[];
  /** Overall data quality score (0-100) */
  dataQualityScore: number;
  /** Confidence in bias analysis completeness (0-1) per INVARIANT 5 */
  analysisConfidence: number;
  /** Summary of findings */
  summary: string;
  /** Recommendations for improving data quality */
  recommendations: string[];
  /** Whether any critical biases were found */
  hasCriticalBiases: boolean;
}

// ==========================================================================
// Agent Manifest
// ==========================================================================

/**
 * Data Bias Detector agent manifest.
 * maxAutonomy: SemiAutonomous - outputs require human review before action.
 */
export const DATA_BIAS_DETECTOR_MANIFEST: AgentManifest = {
  agentId: 'data-bias-detector',
  name: 'Data Bias Detector',
  description:
    'Identifies statistical bias, data staleness, coverage gaps, and systematic errors in intelligence data feeds to support data quality assessment.',
  phase: AgentPhase.Support,
  capabilities: [AgentCapability.DataBiasDetection],
  maxAutonomy: AutonomyLevel.SemiAutonomous,
  allowedProposalKinds: [],
  requiresHumanApproval: [ProposalKind.StrikeAuthorization],
  createdAt: new Date(),
  createdBy: 'system',
  active: true,
  character: {
    name: 'Data Bias Detector',
    bio: [
      'Statistical analysis specialist focused on data quality and bias detection',
      'Trained in cognitive biases affecting intelligence analysis',
      'Expert in data freshness assessment and coverage analysis',
    ],
    lore: [
      'Developed from lessons learned in intelligence failures attributed to biased data',
      'Incorporates research on confirmation bias, anchoring, and cultural biases in analysis',
      'Uses statistical methods to identify systematic errors in data collection',
    ],
    knowledge: [
      'Selection bias: Non-representative sampling leading to skewed conclusions',
      'Confirmation bias: Preferential collection of evidence supporting existing beliefs',
      'Anchoring bias: Over-reliance on initial information despite contradictory evidence',
      'Survivorship bias: Drawing conclusions from incomplete data (missing failures)',
      'Cultural bias: Misinterpretation due to cultural assumptions and perspectives',
      'Temporal bias: Over-weighting recent events or ignoring time-series patterns',
      'Geographic bias: Uneven collection coverage creating blind spots',
      'Source bias: Over-dependence on specific sources or collection methods',
      'Availability bias: Judging likelihood based on easily recalled information',
      'Data freshness thresholds: Tactical (6h), operational (24h), strategic (7d)',
      'Coverage assessment: Geographic, temporal, source diversity, topic breadth',
    ],
    messageExamples: [],
    postExamples: [],
    topics: [
      'Statistical bias detection',
      'Data quality assessment',
      'Intelligence source evaluation',
      'Coverage gap analysis',
      'Data staleness monitoring',
      'Cognitive bias in analysis',
    ],
    style: {
      all: [
        'Objective and evidence-based',
        'Uses statistical terminology precisely',
        'Quantifies confidence in findings',
        'Identifies specific data quality issues',
        'Recommends concrete mitigation steps',
      ],
      chat: ['Clear and direct', 'Explains bias types simply', 'Provides actionable insights'],
      post: ['Structured analysis', 'Data-driven findings', 'Measurable quality metrics'],
    },
    adjectives: [
      'Analytical',
      'Objective',
      'Thorough',
      'Detail-oriented',
      'Statistically-minded',
      'Quality-focused',
    ],
    plugins: [],
  },
};

// ==========================================================================
// Core Analysis Function
// ==========================================================================

/**
 * Analyze data sources for bias, staleness, and coverage gaps.
 *
 * @param dataSources - Array of data sources with metadata and content
 * @param analysisContext - Context for the analysis (e.g., mission, phase)
 * @returns BiasAnalysisOutput with detected issues and recommendations
 */
export async function analyzeBias(
  dataSources: Array<{
    sourceId: string;
    sourceType: string;
    lastUpdated: number;
    content: string;
  }>,
  analysisContext: string
): Promise<BiasAnalysisOutput> {
  // Rule-based analysis for v1 (LLM integration in future phases)
  const detectedBiases: DetectedBias[] = [];
  const stalenessReports: StalenessReport[] = [];
  const coverageGaps: CoverageGap[] = [];

  // Analyze staleness
  const now = Date.now();
  for (const source of dataSources) {
    const ageMs = now - source.lastUpdated;
    const ageHours = ageMs / (1000 * 60 * 60);

    // Determine freshness threshold based on source type
    let freshnessThresholdHours = 168; // 7 days default (strategic)
    if (source.sourceType.toLowerCase().includes('tactical')) {
      freshnessThresholdHours = 6;
    } else if (source.sourceType.toLowerCase().includes('operational')) {
      freshnessThresholdHours = 24;
    }

    const isStale = ageHours > freshnessThresholdHours;

    stalenessReports.push({
      dataSource: source.sourceId,
      lastUpdated: source.lastUpdated,
      ageHours: Math.round(ageHours * 100) / 100,
      freshnessThresholdHours,
      isStale,
      impactIfStale: isStale
        ? 'Analysis may be based on outdated intelligence; validate with current sources'
        : 'Data is within freshness threshold',
    });

    // Detect temporal bias if data is stale
    if (isStale) {
      detectedBiases.push({
        biasType: 'temporal_bias',
        description: `Data source ${source.sourceId} is ${Math.round(ageHours)} hours old, exceeding freshness threshold of ${freshnessThresholdHours} hours`,
        affectedData: [source.sourceId],
        severity: ageHours > freshnessThresholdHours * 2 ? 'critical' : 'major',
        detectionConfidence: 0.95,
        confidenceBounds: { lower: 0.9, upper: 0.98 },
        mitigationSuggestion: 'Update data from current sources or adjust analysis to account for time lag',
      });
    }
  }

  // Simple heuristics for other bias types (v1 implementation)
  // In production, would use LLM analysis with specific prompts per bias type

  // Check for source diversity (source bias)
  const sourceTypes = new Set(dataSources.map((s) => s.sourceType));
  if (sourceTypes.size < 3 && dataSources.length > 3) {
    detectedBiases.push({
      biasType: 'source_bias',
      description: `Limited source diversity: only ${sourceTypes.size} source types represented`,
      affectedData: dataSources.map((s) => s.sourceId),
      severity: 'major',
      detectionConfidence: 0.85,
      confidenceBounds: { lower: 0.75, upper: 0.92 },
      mitigationSuggestion: 'Incorporate diverse intelligence sources (HUMINT, SIGINT, IMINT, OSINT)',
    });
  }

  // Check for geographic coverage (geographic bias)
  const hasGeographicKeywords = dataSources.some(
    (s) =>
      s.content.toLowerCase().includes('region') ||
      s.content.toLowerCase().includes('area') ||
      s.content.toLowerCase().includes('location')
  );
  if (!hasGeographicKeywords && analysisContext.toLowerCase().includes('geographic')) {
    coverageGaps.push({
      domain: 'Geographic Coverage',
      expectedCoverage: 'Multiple geographic regions for comprehensive assessment',
      actualCoverage: 'Limited geographic indicators in data',
      gapDescription: 'Insufficient geographic diversity in intelligence collection',
      impactOnAnalysis: 'May miss regional variations or localized threats',
      severity: 'major',
    });
  }

  // Calculate overall data quality score
  const staleCount = stalenessReports.filter((r) => r.isStale).length;
  const biasCount = detectedBiases.length;
  const gapCount = coverageGaps.length;

  let dataQualityScore = 100;
  dataQualityScore -= staleCount * 15; // -15 per stale source
  dataQualityScore -= biasCount * 10; // -10 per detected bias
  dataQualityScore -= gapCount * 8; // -8 per coverage gap
  dataQualityScore = Math.max(0, Math.min(100, dataQualityScore));

  // Determine if critical biases exist
  const hasCriticalBiases = detectedBiases.some((b) => b.severity === 'critical');

  // Generate summary
  let summary = `Analyzed ${dataSources.length} data sources. `;
  summary += `Data quality score: ${dataQualityScore}/100. `;
  summary += `Found ${detectedBiases.length} biases, ${stalenessReports.filter((r) => r.isStale).length} stale sources, ${coverageGaps.length} coverage gaps.`;
  if (hasCriticalBiases) {
    summary += ' CRITICAL biases detected - immediate review required.';
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (staleCount > 0) {
    recommendations.push(`Update ${staleCount} stale data sources with current intelligence`);
  }
  if (sourceTypes.size < 3) {
    recommendations.push('Diversify intelligence sources to reduce source bias');
  }
  if (coverageGaps.length > 0) {
    recommendations.push('Address coverage gaps in data collection to improve completeness');
  }
  if (detectedBiases.length === 0 && staleCount === 0 && coverageGaps.length === 0) {
    recommendations.push('Data quality is good; maintain current collection practices');
  }
  if (hasCriticalBiases) {
    recommendations.push('PRIORITY: Address critical biases before using data for decision-making');
  }

  // Analysis confidence (INVARIANT 5)
  // Higher confidence with more data, lower with limited sources
  let analysisConfidence = 0.7; // Base confidence
  if (dataSources.length >= 5) analysisConfidence += 0.15;
  if (sourceTypes.size >= 3) analysisConfidence += 0.1;
  if (dataSources.length < 2) analysisConfidence -= 0.2;
  analysisConfidence = Math.max(0.3, Math.min(0.95, analysisConfidence));

  return {
    detectedBiases,
    stalenessReports,
    coverageGaps,
    dataQualityScore,
    analysisConfidence,
    summary,
    recommendations,
    hasCriticalBiases,
  };
}

// ==========================================================================
// Export
// ==========================================================================

export const dataBiasDetector = {
  manifest: DATA_BIAS_DETECTOR_MANIFEST,
  analyzeBias,
};
