/**
 * MIDLIFE Categorization Tool
 *
 * Analyzes strategic objectives and determines their MIDLIFE category.
 * MIDLIFE: Military, Information, Diplomatic, Legal, Intelligence, Financial, Economic
 *
 * This tool provides structured, repeatable analysis for categorizing
 * strategic objectives. It can be invoked via MCP or REST API.
 */

import type { MidlifeCategory } from '../schemas/dime.js';

/**
 * Input for MIDLIFE categorization analysis.
 */
export interface MidlifeCategorizeInput {
  objectiveId: string;
  description: string;
  context?: {
    documentLevel?: string;
    dimeCategory?: string;
    keywords?: string[];
  };
}

/**
 * Output from MIDLIFE categorization analysis.
 */
export interface MidlifeCategorizeOutput {
  category: MidlifeCategory;
  confidence: number; // 0-1
  rationale: string;
  alternativeCategories?: Array<{
    category: MidlifeCategory;
    confidence: number;
    reason: string;
  }>;
  indicators: string[]; // Key phrases that influenced decision
}

/**
 * Category criteria for MIDLIFE classification.
 * Each category has keywords, patterns, and distinguishing characteristics.
 */
interface CategoryCriteria {
  category: MidlifeCategory;
  keywords: string[];
  patterns: RegExp[];
  distinguishers: string[];
  weight: number; // Base weight for scoring
}

/**
 * MIDLIFE category criteria definitions.
 * Based on strategic doctrine and national power instruments.
 */
const CATEGORY_CRITERIA: CategoryCriteria[] = [
  {
    category: 'MILITARY',
    keywords: [
      'armed forces', 'defense', 'force posture', 'military operations',
      'combat', 'readiness', 'troops', 'battalion', 'regiment', 'division',
      'deployment', 'warfighting', 'deterrence', 'offensive', 'defensive',
      'battlefield', 'tactical', 'strategic strike', 'munitions', 'weapons',
      'defense capabilities', 'force protection', 'military power',
      'army', 'navy', 'air force', 'marines', 'coast guard', 'special forces',
      'joint operations', 'combatant command', 'cocom', 'military aid',
    ],
    patterns: [
      /\b(militar(y|istic)|armed\s+force|combat\s+(power|capability|operations?))\b/i,
      /\b(force\s+(posture|projection|protection|readiness))\b/i,
      /\b(defense\s+(capability|posture|strategy))\b/i,
      /\btroop\s*(deployment|movement|levels?)\b/i,
    ],
    distinguishers: ['Only when directly involving armed forces or combat capability'],
    weight: 1.0,
  },
  {
    category: 'INFORMATION',
    keywords: [
      'communications', 'media', 'cyber operations', 'influence', 'public affairs',
      'narrative', 'messaging', 'propaganda', 'disinformation', 'misinformation',
      'information warfare', 'public diplomacy', 'strategic communications',
      'social media', 'broadcasting', 'press', 'journalism', 'opinion',
      'perception management', 'psychological operations', 'psyops',
      'information operations', 'info ops', 'cyber influence',
    ],
    patterns: [
      /\b(information\s+(warfare|operations?|campaign))\b/i,
      /\b(cyber\s+(influence|operations?|warfare))\b/i,
      /\b(public\s+(affairs?|diplomacy|opinion))\b/i,
      /\b(strategic\s+communications?|strat\s*comm)\b/i,
      /\b(narrative\s+(control|management|campaign))\b/i,
    ],
    distinguishers: ['Focuses on influence and narrative control, not intelligence collection'],
    weight: 1.0,
  },
  {
    category: 'DIPLOMATIC',
    keywords: [
      'foreign relations', 'treaties', 'alliances', 'negotiations', 'cooperation',
      'embassies', 'ambassadors', 'bilateral', 'multilateral', 'summit',
      'diplomatic channels', 'foreign policy', 'state department', 'envoy',
      'international relations', 'diplomatic engagement', 'partnership',
      'coalition', 'allies', 'partner nations', 'diplomatic pressure',
      'statecraft', 'diplomatic initiative', 'foreign minister',
    ],
    patterns: [
      /\b(diplomatic\s+(relations?|channels?|engagement|initiative|pressure))\b/i,
      /\b(foreign\s+(relations?|policy|minister))\b/i,
      /\b(treaty|alliance|coalition)\s*(building|formation|negotiation)/i,
      /\b(bilateral|multilateral)\s+(agreement|cooperation|talks?)\b/i,
    ],
    distinguishers: ['Relationship-based, not binding rules (that would be LEGAL)'],
    weight: 1.0,
  },
  {
    category: 'LEGAL',
    keywords: [
      'international law', 'domestic law', 'rules of engagement', 'ROE',
      'legal framework', 'jurisdiction', 'treaty obligations', 'legal authority',
      'law of armed conflict', 'LOAC', 'law enforcement', 'legal constraints',
      'prosecution', 'court', 'tribunal', 'legal compliance', 'regulatory',
      'legislation', 'statute', 'legal basis', 'lawful', 'legal review',
      'justice', 'judicial', 'legal standards', 'binding law',
    ],
    patterns: [
      /\b(legal\s+(framework|authority|basis|constraints?|review|compliance))\b/i,
      /\b(rules?\s+of\s+engagement|ROE)\b/i,
      /\b(international\s+law|domestic\s+law|LOAC)\b/i,
      /\b(law\s+of\s+(armed\s+)?conflict)\b/i,
      /\b(treaty\s+obligations?|binding\s+law)\b/i,
    ],
    distinguishers: ['Binding rules and enforcement, not relationship-based diplomacy'],
    weight: 1.0,
  },
  {
    category: 'INTELLIGENCE',
    keywords: [
      'collection', 'analysis', 'counterintelligence', 'reconnaissance', 'ISR',
      'surveillance', 'intelligence gathering', 'HUMINT', 'SIGINT', 'OSINT',
      'GEOINT', 'IMINT', 'intelligence community', 'IC', 'CIA', 'NSA', 'DIA',
      'espionage', 'covert', 'clandestine', 'intelligence assessment',
      'threat assessment', 'intelligence estimate', 'classified',
      'intelligence sharing', 'five eyes', 'intel',
    ],
    patterns: [
      /\b(intelligence\s+(collection|gathering|sharing|assessment|estimate|community))\b/i,
      /\b(ISR|HUMINT|SIGINT|OSINT|GEOINT|IMINT)\b/i,
      /\b(counter\s*intelligence|CI)\b/i,
      /\b(reconnaissance|surveillance)\s*(mission|operations?|capability)\b/i,
      /\b(threat\s+assessment|intel\s+estimate)\b/i,
    ],
    distinguishers: ['Knowledge collection and analysis, not information influence'],
    weight: 1.0,
  },
  {
    category: 'FINANCIAL',
    keywords: [
      'banking', 'sanctions', 'monetary policy', 'central bank', 'financial warfare',
      'SWIFT', 'currency', 'financial markets', 'treasury', 'financial system',
      'financial instruments', 'asset freeze', 'financial restrictions',
      'anti-money laundering', 'AML', 'terrorist financing', 'financial pressure',
      'capital controls', 'financial sector', 'banking system',
    ],
    patterns: [
      /\b(financial\s+(warfare|sanctions?|restrictions?|pressure|instruments?))\b/i,
      /\b(banking\s+(system|sector|sanctions?))\b/i,
      /\b(monetary\s+policy|central\s+bank)\b/i,
      /\b(asset\s+(freeze|seizure)|capital\s+controls?)\b/i,
      /\b(SWIFT|AML|terrorist\s+financing)\b/i,
    ],
    distinguishers: ['Money/banking systems, not trade/production (that would be ECONOMIC)'],
    weight: 1.0,
  },
  {
    category: 'ECONOMIC',
    keywords: [
      'trade', 'resources', 'development', 'industrial base', 'economic statecraft',
      'supply chains', 'tariffs', 'export controls', 'commerce', 'market access',
      'economic pressure', 'economic leverage', 'production', 'manufacturing',
      'imports', 'exports', 'trade policy', 'economic growth', 'GDP',
      'economic development', 'trade agreements', 'free trade',
      'economic cooperation', 'resource allocation',
    ],
    patterns: [
      /\b(economic\s+(statecraft|pressure|leverage|development|cooperation))\b/i,
      /\b(trade\s+(policy|agreement|restriction|war))\b/i,
      /\b(supply\s+chain|industrial\s+base)\b/i,
      /\b(export\s+controls?|tariffs?|market\s+access)\b/i,
      /\b(economic\s+sanction|trade\s+sanction)\b/i,
    ],
    distinguishers: ['Trade/production/resources, not money/banking (that would be FINANCIAL)'],
    weight: 1.0,
  },
];

/**
 * MIDLIFE Categorizer - analyzes objectives and determines category.
 */
export class MidlifeCategorizer {
  private readonly version = '1.0.0';

  /**
   * Categorize a strategic objective.
   * Analyzes text for category indicators and returns structured output.
   */
  categorize(input: MidlifeCategorizeInput): MidlifeCategorizeOutput {
    const { description, context } = input;
    const textToAnalyze = description.toLowerCase();

    // Score each category
    const scores: Array<{
      category: MidlifeCategory;
      score: number;
      indicators: string[];
    }> = [];

    for (const criteria of CATEGORY_CRITERIA) {
      const { category, keywords, patterns } = criteria;
      let score = 0;
      const indicators: string[] = [];

      // Check keywords
      for (const keyword of keywords) {
        if (textToAnalyze.includes(keyword.toLowerCase())) {
          score += 1;
          indicators.push(keyword);
        }
      }

      // Check patterns
      for (const pattern of patterns) {
        const match = description.match(pattern);
        if (match) {
          score += 2; // Patterns are weighted higher
          indicators.push(match[0]);
        }
      }

      // Apply context boost if DIME category aligns
      if (context?.dimeCategory) {
        const dimeMapping: Record<string, MidlifeCategory[]> = {
          'DIPLOMATIC': ['DIPLOMATIC', 'LEGAL'],
          'INFORMATIONAL': ['INFORMATION', 'INTELLIGENCE'],
          'MILITARY': ['MILITARY', 'INTELLIGENCE'],
          'ECONOMIC': ['ECONOMIC', 'FINANCIAL'],
        };
        const alignedCategories = dimeMapping[context.dimeCategory] || [];
        if (alignedCategories.includes(category)) {
          score += 1;
        }
      }

      scores.push({ category, score, indicators });
    }

    // Sort by score
    scores.sort((a, b) => b.score - a.score);

    // Calculate confidence
    const topScore = scores[0].score;
    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
    const confidence = totalScore > 0
      ? Math.min(0.95, (topScore / Math.max(totalScore, 1)) * (1 + Math.log10(Math.max(topScore, 1)) / 10))
      : 0.3;

    // Build rationale
    const topCategory = scores[0];
    const criteria = CATEGORY_CRITERIA.find(c => c.category === topCategory.category);
    const rationale = this.buildRationale(topCategory, scores, criteria);

    // Build alternative categories (top 2 alternatives)
    const alternatives = scores
      .slice(1, 3)
      .filter(s => s.score > 0)
      .map(s => ({
        category: s.category,
        confidence: totalScore > 0 ? s.score / totalScore : 0,
        reason: `Found indicators: ${s.indicators.slice(0, 3).join(', ')}`,
      }));

    return {
      category: topCategory.category,
      confidence: Math.round(confidence * 100) / 100,
      rationale,
      alternativeCategories: alternatives.length > 0 ? alternatives : undefined,
      indicators: topCategory.indicators.slice(0, 5),
    };
  }

  /**
   * Build rationale explaining the categorization decision.
   */
  private buildRationale(
    topCategory: { category: MidlifeCategory; score: number; indicators: string[] },
    allScores: Array<{ category: MidlifeCategory; score: number }>,
    criteria?: CategoryCriteria
  ): string {
    const parts: string[] = [];

    // Main classification statement
    parts.push(`Classified as ${topCategory.category} based on ${topCategory.indicators.length} indicators.`);

    // Top indicators
    if (topCategory.indicators.length > 0) {
      const topIndicators = topCategory.indicators.slice(0, 3);
      parts.push(`Key indicators: "${topIndicators.join('", "')}".`);
    }

    // Distinguishing factor if close competition
    const secondScore = allScores[1]?.score || 0;
    if (secondScore > 0 && topCategory.score - secondScore <= 2) {
      const secondCategory = allScores[1].category;
      parts.push(
        `Distinguished from ${secondCategory} which also scored ${secondScore} points.`
      );
      if (criteria?.distinguishers[0]) {
        parts.push(`Note: ${criteria.distinguishers[0]}.`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Get tool version for audit trail.
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * Get tool metadata for MCP registration.
   */
  getToolMetadata() {
    return {
      name: 'categorize-midlife',
      description: 'Analyze a strategic objective and determine its MIDLIFE category',
      category: 'analysis' as const,
      version: this.version,
      inputSchema: {
        type: 'object' as const,
        properties: {
          objectiveId: {
            type: 'string',
            description: 'Unique identifier for the objective',
          },
          description: {
            type: 'string',
            description: 'Full text description of the strategic objective',
          },
          context: {
            type: 'object',
            description: 'Optional context for categorization',
            properties: {
              documentLevel: {
                type: 'string',
                description: 'Level of source document (e.g., NSS, NDS)',
              },
              dimeCategory: {
                type: 'string',
                description: 'Existing DIME categorization if available',
              },
              keywords: {
                type: 'array',
                items: { type: 'string' },
                description: 'Additional keywords from document',
              },
            },
          },
        },
        required: ['objectiveId', 'description'],
      },
      outputSchema: {
        type: 'object' as const,
        properties: {
          category: {
            type: 'string',
            enum: ['MILITARY', 'INFORMATION', 'DIPLOMATIC', 'LEGAL', 'INTELLIGENCE', 'FINANCIAL', 'ECONOMIC'],
            description: 'MIDLIFE category',
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Confidence score (0-1)',
          },
          rationale: {
            type: 'string',
            description: 'Explanation for categorization',
          },
          alternativeCategories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                confidence: { type: 'number' },
                reason: { type: 'string' },
              },
            },
            description: 'Alternative categories considered',
          },
          indicators: {
            type: 'array',
            items: { type: 'string' },
            description: 'Key phrases that influenced decision',
          },
        },
        required: ['category', 'confidence', 'rationale', 'indicators'],
      },
    };
  }
}

// Singleton instance
let categorizerInstance: MidlifeCategorizer | null = null;

/**
 * Get or create the MIDLIFE categorizer singleton.
 */
export function getMidlifeCategorizer(): MidlifeCategorizer {
  if (!categorizerInstance) {
    categorizerInstance = new MidlifeCategorizer();
  }
  return categorizerInstance;
}
