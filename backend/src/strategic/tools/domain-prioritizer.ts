/**
 * Domain Prioritization Tool
 *
 * Generic prioritization logic that ranks strategic objectives based on
 * configurable criteria. Supports different domain-specific weighting presets.
 *
 * Domains: strategic, operational, tactical, resource
 * Criteria: urgency, impact, feasibility, risk, alignment, dependencies
 */

import type { Priority } from '../schemas/strategic-objective.js';

/**
 * Prioritization criteria with weights.
 * Weights should sum to 1.0 for normalized scoring.
 */
export interface PrioritizationCriteria {
  urgency?: number;        // Time-sensitivity (default: 0.15)
  impact?: number;         // Magnitude of effect (default: 0.25)
  feasibility?: number;    // Resource/capability availability (default: 0.20)
  risk?: number;           // Potential negative consequences (default: 0.15)
  alignment?: number;      // Strategic alignment score (default: 0.15)
  dependencies?: number;   // Blocking other objectives (default: 0.10)
  custom?: Array<{
    name: string;
    weight: number;
    description: string;
  }>;
}

/**
 * Input objective for prioritization.
 */
export interface PrioritizeObjective {
  id: string;
  description: string;
  currentPriority?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for prioritization analysis.
 */
export interface PrioritizeInput {
  objectives: PrioritizeObjective[];
  domain: 'strategic' | 'operational' | 'tactical' | 'resource';
  criteria?: PrioritizationCriteria;
}

/**
 * Score breakdown for a single objective.
 */
export interface ScoreBreakdown {
  urgency: number;
  impact: number;
  feasibility: number;
  risk: number;
  alignment: number;
  dependencies: number;
}

/**
 * Ranked objective output.
 */
export interface RankedObjective {
  id: string;
  rank: number;
  score: number;  // 0-100
  breakdown: ScoreBreakdown;
  rationale: string;
  recommendedPriority: Priority;
}

/**
 * Output from prioritization analysis.
 */
export interface PrioritizeOutput {
  rankedObjectives: RankedObjective[];
  summary: string;
  methodology: string;
}

/**
 * Domain-specific default criteria weights.
 */
const DOMAIN_DEFAULTS: Record<string, PrioritizationCriteria> = {
  strategic: {
    urgency: 0.10,
    impact: 0.30,
    feasibility: 0.15,
    risk: 0.15,
    alignment: 0.20,
    dependencies: 0.10,
  },
  operational: {
    urgency: 0.20,
    impact: 0.20,
    feasibility: 0.25,
    risk: 0.15,
    alignment: 0.10,
    dependencies: 0.10,
  },
  tactical: {
    urgency: 0.35,
    impact: 0.15,
    feasibility: 0.25,
    risk: 0.10,
    alignment: 0.05,
    dependencies: 0.10,
  },
  resource: {
    urgency: 0.10,
    impact: 0.20,
    feasibility: 0.35,
    risk: 0.15,
    alignment: 0.10,
    dependencies: 0.10,
  },
};

/**
 * Keywords for detecting criteria scores from objective text.
 */
const CRITERIA_KEYWORDS = {
  urgency: {
    high: ['immediate', 'urgent', 'critical', 'time-sensitive', 'deadline', 'asap', 'now', 'emergency', 'crisis'],
    medium: ['soon', 'near-term', 'short-term', 'priority', 'timely', 'prompt'],
    low: ['long-term', 'eventual', 'future', 'when able', 'as resources permit'],
  },
  impact: {
    high: ['strategic', 'critical', 'essential', 'fundamental', 'decisive', 'game-changing', 'transformative', 'major'],
    medium: ['significant', 'important', 'substantial', 'notable', 'meaningful'],
    low: ['minor', 'incremental', 'limited', 'marginal', 'supplementary'],
  },
  feasibility: {
    high: ['readily available', 'existing capability', 'proven', 'established', 'in place', 'current'],
    medium: ['achievable', 'possible', 'can be developed', 'requires coordination'],
    low: ['challenging', 'difficult', 'limited resources', 'new capability required', 'significant investment'],
  },
  risk: {
    high: ['high risk', 'dangerous', 'volatile', 'uncertain', 'unpredictable', 'significant risk', 'major risk'],
    medium: ['moderate risk', 'some risk', 'potential risk', 'risk mitigation needed'],
    low: ['low risk', 'minimal risk', 'stable', 'predictable', 'controlled'],
  },
  alignment: {
    high: ['directly supports', 'core mission', 'primary objective', 'key priority', 'strategic imperative'],
    medium: ['supports', 'aligns with', 'contributes to', 'related to'],
    low: ['tangential', 'secondary', 'supporting', 'ancillary', 'peripheral'],
  },
  dependencies: {
    high: ['blocking', 'prerequisite', 'critical path', 'enables', 'gateway', 'foundational'],
    medium: ['depends on', 'related to', 'connected', 'influences'],
    low: ['standalone', 'independent', 'self-contained', 'isolated'],
  },
};

/**
 * Domain Prioritizer - ranks objectives based on weighted criteria.
 */
export class DomainPrioritizer {
  private readonly version = '1.0.0';

  /**
   * Prioritize a list of objectives.
   */
  prioritize(input: PrioritizeInput): PrioritizeOutput {
    const { objectives, domain, criteria } = input;

    if (objectives.length === 0) {
      return {
        rankedObjectives: [],
        summary: 'No objectives provided for prioritization.',
        methodology: this.buildMethodology(domain, criteria),
      };
    }

    // Merge domain defaults with custom criteria
    const weights = this.mergeWeights(domain, criteria);

    // Score each objective
    const scoredObjectives = objectives.map((obj) => {
      const breakdown = this.scoreObjective(obj, weights);
      const totalScore = this.calculateTotalScore(breakdown, weights);
      return {
        objective: obj,
        breakdown,
        score: totalScore,
      };
    });

    // Sort by score (descending)
    scoredObjectives.sort((a, b) => b.score - a.score);

    // Build ranked output
    const rankedObjectives: RankedObjective[] = scoredObjectives.map((scored, index) => ({
      id: scored.objective.id,
      rank: index + 1,
      score: Math.round(scored.score),
      breakdown: scored.breakdown,
      rationale: this.buildRationale(scored.objective, scored.breakdown, index + 1, scoredObjectives.length),
      recommendedPriority: this.scoreToPriority(scored.score),
    }));

    return {
      rankedObjectives,
      summary: this.buildSummary(rankedObjectives, domain),
      methodology: this.buildMethodology(domain, criteria),
    };
  }

  /**
   * Merge domain defaults with custom criteria.
   */
  private mergeWeights(
    domain: string,
    customCriteria?: PrioritizationCriteria
  ): PrioritizationCriteria {
    const defaults = DOMAIN_DEFAULTS[domain] || DOMAIN_DEFAULTS.operational;
    if (!customCriteria) {
      return defaults;
    }

    return {
      urgency: customCriteria.urgency ?? defaults.urgency,
      impact: customCriteria.impact ?? defaults.impact,
      feasibility: customCriteria.feasibility ?? defaults.feasibility,
      risk: customCriteria.risk ?? defaults.risk,
      alignment: customCriteria.alignment ?? defaults.alignment,
      dependencies: customCriteria.dependencies ?? defaults.dependencies,
      custom: customCriteria.custom,
    };
  }

  /**
   * Score a single objective across all criteria.
   */
  private scoreObjective(
    objective: PrioritizeObjective,
    weights: PrioritizationCriteria
  ): ScoreBreakdown {
    const text = objective.description.toLowerCase();

    return {
      urgency: this.scoreCriterion(text, 'urgency'),
      impact: this.scoreCriterion(text, 'impact'),
      feasibility: this.scoreCriterion(text, 'feasibility'),
      risk: this.scoreRisk(text), // Risk is inverse (lower risk = higher score)
      alignment: this.scoreCriterion(text, 'alignment'),
      dependencies: this.scoreCriterion(text, 'dependencies'),
    };
  }

  /**
   * Score a single criterion based on keyword detection.
   */
  private scoreCriterion(
    text: string,
    criterion: keyof typeof CRITERIA_KEYWORDS
  ): number {
    const keywords = CRITERIA_KEYWORDS[criterion];

    // Check high indicators first
    for (const keyword of keywords.high) {
      if (text.includes(keyword.toLowerCase())) {
        return 85 + Math.random() * 10; // 85-95
      }
    }

    // Check medium indicators
    for (const keyword of keywords.medium) {
      if (text.includes(keyword.toLowerCase())) {
        return 55 + Math.random() * 20; // 55-75
      }
    }

    // Check low indicators
    for (const keyword of keywords.low) {
      if (text.includes(keyword.toLowerCase())) {
        return 25 + Math.random() * 20; // 25-45
      }
    }

    // Default to medium if no indicators found
    return 50 + Math.random() * 10; // 50-60
  }

  /**
   * Score risk (inverse - lower risk = higher score).
   */
  private scoreRisk(text: string): number {
    const keywords = CRITERIA_KEYWORDS.risk;

    // High risk = lower score
    for (const keyword of keywords.high) {
      if (text.includes(keyword.toLowerCase())) {
        return 25 + Math.random() * 15; // 25-40
      }
    }

    // Medium risk = medium score
    for (const keyword of keywords.medium) {
      if (text.includes(keyword.toLowerCase())) {
        return 45 + Math.random() * 20; // 45-65
      }
    }

    // Low risk = high score
    for (const keyword of keywords.low) {
      if (text.includes(keyword.toLowerCase())) {
        return 75 + Math.random() * 20; // 75-95
      }
    }

    // Default to medium
    return 55 + Math.random() * 15; // 55-70
  }

  /**
   * Calculate weighted total score.
   */
  private calculateTotalScore(
    breakdown: ScoreBreakdown,
    weights: PrioritizationCriteria
  ): number {
    const score =
      (breakdown.urgency * (weights.urgency || 0)) +
      (breakdown.impact * (weights.impact || 0)) +
      (breakdown.feasibility * (weights.feasibility || 0)) +
      (breakdown.risk * (weights.risk || 0)) +
      (breakdown.alignment * (weights.alignment || 0)) +
      (breakdown.dependencies * (weights.dependencies || 0));

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Convert score to priority level.
   */
  private scoreToPriority(score: number): Priority {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Build rationale for a ranked objective.
   */
  private buildRationale(
    objective: PrioritizeObjective,
    breakdown: ScoreBreakdown,
    rank: number,
    total: number
  ): string {
    const parts: string[] = [];

    // Rank statement
    parts.push(`Ranked ${rank} of ${total}.`);

    // Top scoring criteria
    const criteria = [
      { name: 'impact', score: breakdown.impact },
      { name: 'urgency', score: breakdown.urgency },
      { name: 'alignment', score: breakdown.alignment },
      { name: 'feasibility', score: breakdown.feasibility },
      { name: 'risk management', score: breakdown.risk },
      { name: 'dependencies', score: breakdown.dependencies },
    ].sort((a, b) => b.score - a.score);

    const top = criteria[0];
    parts.push(`Highest score in ${top.name} (${Math.round(top.score)}).`);

    // Lowest scoring if notable
    const lowest = criteria[criteria.length - 1];
    if (lowest.score < 40) {
      parts.push(`Lower score in ${lowest.name} (${Math.round(lowest.score)}).`);
    }

    // Current priority comparison
    if (objective.currentPriority) {
      const recommended = this.scoreToPriority(
        this.calculateTotalScore(breakdown, DOMAIN_DEFAULTS.operational)
      );
      if (recommended !== objective.currentPriority) {
        parts.push(`Consider updating priority from ${objective.currentPriority} to ${recommended}.`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Build summary for the prioritization.
   */
  private buildSummary(
    rankedObjectives: RankedObjective[],
    domain: string
  ): string {
    if (rankedObjectives.length === 0) {
      return 'No objectives were prioritized.';
    }

    const criticalCount = rankedObjectives.filter(o => o.recommendedPriority === 'CRITICAL').length;
    const highCount = rankedObjectives.filter(o => o.recommendedPriority === 'HIGH').length;
    const mediumCount = rankedObjectives.filter(o => o.recommendedPriority === 'MEDIUM').length;
    const lowCount = rankedObjectives.filter(o => o.recommendedPriority === 'LOW').length;

    const parts: string[] = [];
    parts.push(`Prioritized ${rankedObjectives.length} objectives for ${domain} domain.`);

    if (criticalCount > 0) {
      parts.push(`${criticalCount} critical priority.`);
    }
    if (highCount > 0) {
      parts.push(`${highCount} high priority.`);
    }
    if (mediumCount > 0) {
      parts.push(`${mediumCount} medium priority.`);
    }
    if (lowCount > 0) {
      parts.push(`${lowCount} low priority.`);
    }

    // Top objective
    const top = rankedObjectives[0];
    parts.push(`Top priority: "${top.id}" with score ${top.score}.`);

    return parts.join(' ');
  }

  /**
   * Build methodology explanation.
   */
  private buildMethodology(
    domain: string,
    customCriteria?: PrioritizationCriteria
  ): string {
    const weights = this.mergeWeights(domain, customCriteria);
    const parts: string[] = [];

    parts.push(`Domain: ${domain}.`);
    parts.push('Weighted criteria scoring:');
    parts.push(`- Impact: ${((weights.impact || 0) * 100).toFixed(0)}%`);
    parts.push(`- Urgency: ${((weights.urgency || 0) * 100).toFixed(0)}%`);
    parts.push(`- Feasibility: ${((weights.feasibility || 0) * 100).toFixed(0)}%`);
    parts.push(`- Risk: ${((weights.risk || 0) * 100).toFixed(0)}%`);
    parts.push(`- Alignment: ${((weights.alignment || 0) * 100).toFixed(0)}%`);
    parts.push(`- Dependencies: ${((weights.dependencies || 0) * 100).toFixed(0)}%`);

    if (customCriteria?.custom?.length) {
      for (const custom of customCriteria.custom) {
        parts.push(`- ${custom.name}: ${(custom.weight * 100).toFixed(0)}%`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Get tool version.
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * Get tool metadata for MCP registration.
   */
  getToolMetadata() {
    return {
      name: 'prioritize-domain',
      description: 'Prioritize strategic objectives using weighted criteria analysis',
      category: 'analysis' as const,
      version: this.version,
      inputSchema: {
        type: 'object' as const,
        properties: {
          objectives: {
            type: 'array',
            description: 'List of objectives to prioritize',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Objective ID' },
                description: { type: 'string', description: 'Objective description' },
                currentPriority: { type: 'string', description: 'Current priority level' },
                metadata: { type: 'object', description: 'Additional metadata' },
              },
              required: ['id', 'description'],
            },
          },
          domain: {
            type: 'string',
            enum: ['strategic', 'operational', 'tactical', 'resource'],
            description: 'Domain for weighting presets',
          },
          criteria: {
            type: 'object',
            description: 'Optional custom criteria weights',
            properties: {
              urgency: { type: 'number', minimum: 0, maximum: 1 },
              impact: { type: 'number', minimum: 0, maximum: 1 },
              feasibility: { type: 'number', minimum: 0, maximum: 1 },
              risk: { type: 'number', minimum: 0, maximum: 1 },
              alignment: { type: 'number', minimum: 0, maximum: 1 },
              dependencies: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
        },
        required: ['objectives', 'domain'],
      },
      outputSchema: {
        type: 'object' as const,
        properties: {
          rankedObjectives: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                rank: { type: 'integer' },
                score: { type: 'number' },
                breakdown: { type: 'object' },
                rationale: { type: 'string' },
                recommendedPriority: { type: 'string' },
              },
            },
          },
          summary: { type: 'string' },
          methodology: { type: 'string' },
        },
        required: ['rankedObjectives', 'summary', 'methodology'],
      },
    };
  }
}

// Singleton instance
let prioritizerInstance: DomainPrioritizer | null = null;

/**
 * Get or create the domain prioritizer singleton.
 */
export function getDomainPrioritizer(): DomainPrioritizer {
  if (!prioritizerInstance) {
    prioritizerInstance = new DomainPrioritizer();
  }
  return prioritizerInstance;
}
