/**
 * OSINT Collector Agent
 * Automated open-source intelligence collection from configured sources
 */

import { randomUUID } from 'crypto';
import { ConfigService, configService } from '../config/index.js';
import type { OSINTSourceConfig } from '../config/types.js';
import type {
  AgentOutput,
  OSINTReport,
  ExtractedEntity,
  Sentiment,
  OSINTCollectionRequest,
  StrategicAgent,
} from './types.js';

/**
 * OSINT Collector Agent
 * Tier 1 Collection Agent - fully automated
 *
 * Responsibilities:
 * - Fetch content from configured OSINT sources (RSS, API, etc.)
 * - Filter content by keywords and regions
 * - Extract entities and sentiment
 * - Generate structured OSINTReport objects
 */
export class OSINTCollector implements StrategicAgent {
  readonly agentId = 'osint-collector';
  readonly agentVersion = '1.0.0';

  constructor(private config: ConfigService = configService) {}

  /**
   * Check if OSINT collector is enabled in admin config
   */
  async isEnabled(): Promise<boolean> {
    const agentConfig = await this.config.getAgentConfig();
    return agentConfig.enabledAgents.osintCollector;
  }

  /**
   * Collect OSINT from configured sources
   *
   * @param request - Collection parameters (keywords, regions)
   * @returns AgentOutput containing OSINT reports with quality metadata
   */
  async collect(request: OSINTCollectionRequest): Promise<AgentOutput<OSINTReport[]>> {
    const { keywords, regions, sourceIds, maxResults = 100 } = request;

    // Check if agent is enabled
    const enabled = await this.isEnabled();
    if (!enabled) {
      return this.wrapOutput([], 'OSINT Collector agent is disabled');
    }

    // Get configured OSINT sources
    const sources = await this.config.getOSINTSources();

    // Filter to enabled sources (and specific IDs if provided)
    let enabledSources = sources.filter(s => s.enabled);
    if (sourceIds && sourceIds.length > 0) {
      enabledSources = enabledSources.filter(s => sourceIds.includes(s.id));
    }

    // Filter by regions if sources have region config
    if (regions.length > 0) {
      enabledSources = enabledSources.filter(s =>
        s.regions.length === 0 || s.regions.some(r => regions.includes(r))
      );
    }

    if (enabledSources.length === 0) {
      return this.wrapOutput([], 'No enabled OSINT sources match the request criteria');
    }

    const reports: OSINTReport[] = [];
    const errors: string[] = [];

    // Collect from each source
    for (const source of enabledSources) {
      try {
        const content = await this.fetchSource(source);
        const filtered = this.filterByKeywords(content, keywords);

        if (filtered.length > 0) {
          const analyzed = await this.analyzeContent(filtered, source, keywords);
          reports.push(...analyzed);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`OSINT collection failed for ${source.name}:`, message);
        errors.push(`${source.name}: ${message}`);
        // Continue with other sources
      }
    }

    // Limit results
    const limitedReports = reports.slice(0, maxResults);

    return this.wrapOutput(
      limitedReports,
      errors.length > 0 ? `Collection completed with ${errors.length} source errors` : undefined
    );
  }

  /**
   * Fetch content from a single OSINT source
   * Stub implementation - production would implement RSS parsing, API calls, etc.
   */
  private async fetchSource(source: OSINTSourceConfig): Promise<string[]> {
    // In production, this would:
    // - RSS: Parse RSS/Atom feeds
    // - API: Call external APIs (news, social media, etc.)
    // - SCRAPE: Web scraping with appropriate rate limiting
    // - MANUAL: Return cached manual entries

    console.log(`Fetching OSINT from source: ${source.name} (${source.type})`);

    // Stub: Return empty for now
    // Full implementation requires:
    // 1. RSS parser (e.g., rss-parser package)
    // 2. HTTP client for APIs
    // 3. Web scraping library
    // 4. Rate limiting per source
    return [];
  }

  /**
   * Filter content by keywords
   */
  private filterByKeywords(content: string[], keywords: string[]): string[] {
    if (keywords.length === 0) {
      return content;
    }

    return content.filter(c =>
      keywords.some(k => c.toLowerCase().includes(k.toLowerCase()))
    );
  }

  /**
   * Analyze content and create OSINT reports
   * Uses rule-based analysis with LLM-ready architecture
   */
  private async analyzeContent(
    content: string[],
    source: OSINTSourceConfig,
    keywords: string[]
  ): Promise<OSINTReport[]> {
    // In production, this would use Instructor for:
    // - Entity extraction (NER)
    // - Sentiment analysis
    // - Relevance scoring
    // - Summary generation

    return content.map((c, i) => ({
      id: `osint-${Date.now()}-${i}-${randomUUID().slice(0, 8)}`,
      source: source.name,
      sourceCredibility: source.credibilityRating,
      collectedAt: new Date(),
      content: c,
      summary: this.generateSummary(c),
      entities: this.extractEntities(c),
      sentiment: this.analyzeSentiment(c),
      relevanceScore: this.calculateRelevance(c, keywords),
      keywords: this.extractKeywords(c, keywords),
    }));
  }

  /**
   * Generate summary (stub - would use LLM)
   */
  private generateSummary(content: string): string {
    // Stub: First 200 chars
    return content.length > 200 ? content.slice(0, 200) + '...' : content;
  }

  /**
   * Extract entities (stub - would use NER model)
   */
  private extractEntities(content: string): ExtractedEntity[] {
    // Stub: Return empty
    // Production would use:
    // - spaCy via API
    // - Hugging Face transformers
    // - OpenAI function calling
    return [];
  }

  /**
   * Analyze sentiment (stub - would use sentiment model)
   */
  private analyzeSentiment(content: string): Sentiment {
    // Stub: Default to neutral
    // Production would use sentiment analysis model
    return 'NEUTRAL';
  }

  /**
   * Calculate relevance score based on keyword matching
   */
  private calculateRelevance(content: string, keywords: string[]): number {
    if (keywords.length === 0) {
      return 0.5;
    }

    const contentLower = content.toLowerCase();
    const matchCount = keywords.filter(k =>
      contentLower.includes(k.toLowerCase())
    ).length;

    return Math.min(1, matchCount / keywords.length);
  }

  /**
   * Extract matched keywords from content
   */
  private extractKeywords(content: string, searchKeywords: string[]): string[] {
    const contentLower = content.toLowerCase();
    return searchKeywords.filter(k => contentLower.includes(k.toLowerCase()));
  }

  /**
   * Wrap reports in AgentOutput with quality metadata
   */
  private wrapOutput(
    reports: OSINTReport[],
    note?: string
  ): AgentOutput<OSINTReport[]> {
    const uniqueSources = new Set(reports.map(r => r.source));
    const avgCredibility = reports.length > 0
      ? reports.reduce((sum, r) => sum + r.sourceCredibility, 0) / reports.length
      : 0;

    return {
      data: reports,
      agentId: this.agentId,
      agentVersion: this.agentVersion,
      generatedAt: new Date(),
      confidenceScore: reports.length > 0 ? Math.min(0.9, avgCredibility) : 0,
      qualityIndicators: {
        sourceCount: uniqueSources.size,
        sourceDiversity: this.calculateSourceDiversity(reports),
        contradictionCount: 0, // Would be calculated by fusion agent
        uncertaintyFlags: note ? [note] : [],
      },
      executiveSummary: this.generateExecutiveSummary(reports),
      keyFindings: reports.slice(0, 5).map(r => r.summary),
      areasOfUncertainty: this.identifyUncertainties(reports),
      questionsForReviewer: this.generateReviewQuestions(reports),
      inputSources: Array.from(uniqueSources),
    };
  }

  /**
   * Calculate source diversity score
   */
  private calculateSourceDiversity(reports: OSINTReport[]): number {
    if (reports.length === 0) return 0;

    const uniqueSources = new Set(reports.map(r => r.source));
    // More diverse sources = higher score
    return Math.min(1, uniqueSources.size / Math.max(3, reports.length / 5));
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(reports: OSINTReport[]): string {
    if (reports.length === 0) {
      return 'No OSINT reports collected matching the specified criteria.';
    }

    const uniqueSources = new Set(reports.map(r => r.source));
    const avgRelevance = reports.reduce((sum, r) => sum + r.relevanceScore, 0) / reports.length;

    return `Collected ${reports.length} OSINT reports from ${uniqueSources.size} sources. ` +
      `Average relevance score: ${(avgRelevance * 100).toFixed(1)}%.`;
  }

  /**
   * Identify areas of uncertainty
   */
  private identifyUncertainties(reports: OSINTReport[]): string[] {
    const uncertainties: string[] = [];

    // Low credibility sources
    const lowCredibility = reports.filter(r => r.sourceCredibility < 0.5);
    if (lowCredibility.length > 0) {
      uncertainties.push(`${lowCredibility.length} reports from low-credibility sources`);
    }

    // Low relevance content
    const lowRelevance = reports.filter(r => r.relevanceScore < 0.3);
    if (lowRelevance.length > 0) {
      uncertainties.push(`${lowRelevance.length} reports with low relevance scores`);
    }

    return uncertainties;
  }

  /**
   * Generate questions for human reviewer
   */
  private generateReviewQuestions(reports: OSINTReport[]): string[] {
    const questions: string[] = [];

    if (reports.length === 0) {
      questions.push('Are the configured OSINT sources appropriate for this topic?');
      questions.push('Should additional keywords be used?');
    } else {
      questions.push('Verify source credibility ratings are accurate');
      questions.push('Check for potential bias in collected content');
      questions.push('Validate entity extractions against known databases');
    }

    return questions;
  }
}

// Export singleton instance
export const osintCollector = new OSINTCollector();
