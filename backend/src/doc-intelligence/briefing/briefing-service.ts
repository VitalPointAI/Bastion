/**
 * Briefing Service - On-demand narrative strategic environment briefing
 *
 * Transforms raw graph data and strategic context into consumable intelligence
 * summaries. Integrates with StrategicContextService for structured data,
 * ChangeTracker for per-user delta detection, and PredictiveService for
 * emerging pattern analysis.
 *
 * Phase 40 Plan 08: Strategic Environment Briefing
 */

import { randomUUID } from 'crypto';
import { getPool } from '../../lib/database.js';
import { createLLMForAgent } from '../../agents/langgraph/llm-factory.js';
import { StrategicContextService } from '../../exercise/strategic-context-service.js';
import type { StrategicEnvironmentContext } from '../../exercise/strategic-context-service.js';
import { problemSetSubscriptionStore } from '../../problem-set/problem-set-subscription-store.js';
import { containerStore } from '../../strategic/containers/index.js';
import { graphSummaryService } from '../../exercise/graph-summary-service.js';
import { ChangeTracker } from './change-tracker.js';
import { PredictiveService } from './predictive-service.js';
import type { ChangeSet } from './change-tracker.js';
import type { PredictiveAnalysis } from './predictive-service.js';

// ============================================================================
// Types
// ============================================================================

export interface BriefingSection {
  title: string;
  content: string;
}

export interface StrategicBriefing {
  /** Unique briefing ID */
  id: string;
  /** Problem set this briefing covers */
  problemSetId: string;
  /** Who requested this briefing */
  requestedBy: string;
  /** When the briefing was generated */
  generatedAt: Date;
  /** Narrative sections of the briefing */
  sections: BriefingSection[];
  /** Full narrative text (concatenated sections) */
  narrativeText: string;
  /** Metadata: entity IDs referenced in the briefing */
  referencedEntityIds: string[];
  /** Metadata: document sources cited */
  sourcesCited: string[];
  /** Confidence scores from predictive analysis */
  confidenceScores: Array<{ pattern: string; confidence: number }>;
  /** Whether this is the user's first briefing */
  isFirstBriefing: boolean;
  /** Change summary (null if first briefing) */
  changeSummary: string | null;
}

export interface BriefingRecord {
  id: string;
  problemSetId: string;
  requestedBy: string;
  generatedAt: Date;
  /** Stored as abbreviated text for history listing */
  executiveSummary: string;
}

// ============================================================================
// Constants
// ============================================================================

const BRIEFING_SYSTEM_PROMPT = `You are a senior intelligence briefer preparing a strategic environment briefing. Write in clear, concise military prose. Use the NATO reporting format where appropriate. Annotate claims with source reliability ratings. Highlight what has changed since the requester's last access. Present emerging patterns with explicit confidence levels. Flag intelligence gaps that need attention.

Structure your briefing with the following sections:
1. EXECUTIVE SUMMARY - 2-3 sentence overview of the current strategic environment
2. KEY DEVELOPMENTS - What has changed since the last briefing (skip if first briefing)
3. STRATEGIC LANDSCAPE - Actors, relationships, tensions organized by the problem set scope
4. EMERGING PATTERNS - Trends with confidence annotations
5. INTELLIGENCE GAPS - Areas where information is insufficient or contradictory
6. RECOMMENDATIONS - Suggested focus areas based on gaps and patterns

Output your briefing as valid JSON with this structure:
{
  "sections": [
    { "title": "EXECUTIVE SUMMARY", "content": "..." },
    { "title": "KEY DEVELOPMENTS", "content": "..." },
    { "title": "STRATEGIC LANDSCAPE", "content": "..." },
    { "title": "EMERGING PATTERNS", "content": "..." },
    { "title": "INTELLIGENCE GAPS", "content": "..." },
    { "title": "RECOMMENDATIONS", "content": "..." }
  ],
  "referencedEntityIds": ["ACT-...", "REL-..."],
  "sourcesCited": ["document titles or IDs"]
}`;

// ============================================================================
// BriefingService
// ============================================================================

/**
 * Generates narrative strategic environment briefings by combining
 * structured context data, change detection, and predictive analytics.
 */
export class BriefingService {
  private changeTracker: ChangeTracker;
  private predictiveService: PredictiveService;

  constructor() {
    this.changeTracker = new ChangeTracker();
    this.predictiveService = new PredictiveService();
  }

  /**
   * Generate a full strategic environment briefing for a user/agent.
   *
   * Flow:
   * 1. Assemble structured context via StrategicContextService
   * 2. Detect changes since user's last access
   * 3. Run predictive analytics
   * 4. Transform everything into narrative via LLM
   * 5. Record access and persist briefing
   */
  async generateBriefing(
    problemSetId: string,
    requestedBy: string,
  ): Promise<StrategicBriefing> {
    const briefingId = `BRF-${randomUUID()}`;
    const now = new Date();

    // Step 1: Assemble structured strategic context
    const contextService = new StrategicContextService(
      problemSetSubscriptionStore,
      containerStore,
      graphSummaryService,
    );
    let strategicContext: StrategicEnvironmentContext;
    try {
      strategicContext = await contextService.assembleContext(problemSetId);
    } catch (err) {
      console.error('[BriefingService] Context assembly failed:', err);
      strategicContext = {
        graphSummaries: {},
        documentSummaries: [],
        tokensUsed: 0,
        tokenBudget: 8000,
      };
    }

    // Step 2: Check for changes since last access
    const lastAccess = await this.changeTracker.getLastAccess(problemSetId, requestedBy);
    const isFirstBriefing = lastAccess === null;

    let changeSet: ChangeSet | null = null;
    if (!isFirstBriefing && lastAccess) {
      const hasChanges = await this.changeTracker.hasChanges(problemSetId, requestedBy);
      if (hasChanges) {
        changeSet = await this.changeTracker.getChangesSince(
          problemSetId,
          lastAccess.accessedAt,
        );
      }
    }

    // Step 3: Predictive analytics
    let predictiveAnalysis: PredictiveAnalysis;
    try {
      predictiveAnalysis = await this.predictiveService.analyzePatterns(problemSetId);
    } catch (err) {
      console.error('[BriefingService] Predictive analysis failed:', err);
      predictiveAnalysis = {
        patterns: [],
        overallAssessment: 'Predictive analysis unavailable.',
        dataQuality: 'Unable to assess data quality.',
      };
    }

    // Step 4: Generate narrative via LLM
    const briefing = await this.generateNarrative(
      problemSetId,
      requestedBy,
      briefingId,
      now,
      strategicContext,
      changeSet,
      predictiveAnalysis,
      isFirstBriefing,
      lastAccess?.accessedAt ?? null,
    );

    // Step 5: Record access with current graph hash
    const currentHash = await this.changeTracker.computeGraphHash(problemSetId);
    await this.changeTracker.recordAccess(problemSetId, requestedBy, currentHash);

    // Step 6: Persist briefing to history
    await this.persistBriefing(briefing);

    return briefing;
  }

  /**
   * Get past briefings for a user on a problem set.
   */
  async getBriefingHistory(
    problemSetId: string,
    requestedBy: string,
  ): Promise<BriefingRecord[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, problem_set_id, requested_by, generated_at, executive_summary
       FROM strategic_briefings
       WHERE problem_set_id = $1 AND requested_by = $2
       ORDER BY generated_at DESC
       LIMIT 20`,
      [problemSetId, requestedBy],
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      problemSetId: row.problem_set_id as string,
      requestedBy: row.requested_by as string,
      generatedAt: new Date(row.generated_at as string),
      executiveSummary: row.executive_summary as string,
    }));
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /**
   * Use LLM to transform structured data into a narrative briefing.
   */
  private async generateNarrative(
    problemSetId: string,
    requestedBy: string,
    briefingId: string,
    generatedAt: Date,
    strategicContext: StrategicEnvironmentContext,
    changeSet: ChangeSet | null,
    predictiveAnalysis: PredictiveAnalysis,
    isFirstBriefing: boolean,
    lastAccessDate: Date | null,
  ): Promise<StrategicBriefing> {
    try {
      const llm = await createLLMForAgent({
        agentId: 'doc-briefing-narrator',
        overrides: { temperature: 0.4, maxTokens: 4096 },
      });

      // Build the data payload for the LLM
      const dataPayload: Record<string, unknown> = {
        problemSetId,
        isFirstBriefing,
        lastAccessDate: lastAccessDate?.toISOString() ?? null,
        strategicContext: {
          graphSummaries: strategicContext.graphSummaries,
          documentCount: strategicContext.documentSummaries.length,
          documents: strategicContext.documentSummaries.slice(0, 10),
          decisions: strategicContext.decisionSummary ?? null,
        },
        predictiveAnalysis: {
          patterns: predictiveAnalysis.patterns,
          overallAssessment: predictiveAnalysis.overallAssessment,
          dataQuality: predictiveAnalysis.dataQuality,
        },
      };

      if (changeSet) {
        dataPayload.changes = {
          newEntities: changeSet.newEntities.slice(0, 20),
          modifiedEntities: changeSet.modifiedEntities.slice(0, 20),
          newRelationships: changeSet.newRelationships.slice(0, 20),
          revokedEntities: changeSet.revokedEntities.slice(0, 10),
          changeSummary: changeSet.summary,
        };
      }

      const userPrompt = `Generate a strategic environment briefing based on the following data:\n\n${JSON.stringify(dataPayload, null, 2)}`;

      const response = await llm.invoke([
        { role: 'system', content: BRIEFING_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ]);

      const responseText = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      return this.parseBriefingResponse(
        responseText,
        briefingId,
        problemSetId,
        requestedBy,
        generatedAt,
        isFirstBriefing,
        changeSet?.summary ?? null,
        predictiveAnalysis,
      );
    } catch (err) {
      console.error('[BriefingService] Narrative generation failed:', err);
      // Return a minimal briefing on LLM failure
      return this.buildFallbackBriefing(
        briefingId,
        problemSetId,
        requestedBy,
        generatedAt,
        strategicContext,
        changeSet,
        predictiveAnalysis,
        isFirstBriefing,
      );
    }
  }

  /**
   * Parse the LLM response into a structured StrategicBriefing.
   */
  private parseBriefingResponse(
    responseText: string,
    briefingId: string,
    problemSetId: string,
    requestedBy: string,
    generatedAt: Date,
    isFirstBriefing: boolean,
    changeSummary: string | null,
    predictiveAnalysis: PredictiveAnalysis,
  ): StrategicBriefing {
    let sections: BriefingSection[] = [];
    let referencedEntityIds: string[] = [];
    let sourcesCited: string[] = [];

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

        if (Array.isArray(parsed.sections)) {
          sections = (parsed.sections as Record<string, unknown>[]).map(s => ({
            title: String(s.title ?? 'Untitled'),
            content: String(s.content ?? ''),
          }));
        }

        if (Array.isArray(parsed.referencedEntityIds)) {
          referencedEntityIds = (parsed.referencedEntityIds as unknown[]).map(String);
        }

        if (Array.isArray(parsed.sourcesCited)) {
          sourcesCited = (parsed.sourcesCited as unknown[]).map(String);
        }
      }
    } catch {
      // If parsing fails, treat entire response as narrative
      sections = [{ title: 'BRIEFING', content: responseText }];
    }

    if (sections.length === 0) {
      sections = [{ title: 'BRIEFING', content: responseText }];
    }

    const narrativeText = sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n');

    const confidenceScores = predictiveAnalysis.patterns.map(p => ({
      pattern: p.description.slice(0, 100),
      confidence: p.confidence,
    }));

    return {
      id: briefingId,
      problemSetId,
      requestedBy,
      generatedAt,
      sections,
      narrativeText,
      referencedEntityIds,
      sourcesCited,
      confidenceScores,
      isFirstBriefing,
      changeSummary,
    };
  }

  /**
   * Build a minimal briefing when LLM is unavailable.
   */
  private buildFallbackBriefing(
    briefingId: string,
    problemSetId: string,
    requestedBy: string,
    generatedAt: Date,
    strategicContext: StrategicEnvironmentContext,
    changeSet: ChangeSet | null,
    predictiveAnalysis: PredictiveAnalysis,
    isFirstBriefing: boolean,
  ): StrategicBriefing {
    const sections: BriefingSection[] = [];

    // Executive summary from available data
    const graphCount = Object.keys(strategicContext.graphSummaries).length;
    const docCount = strategicContext.documentSummaries.length;
    sections.push({
      title: 'EXECUTIVE SUMMARY',
      content: `Strategic environment briefing based on ${graphCount} graph containers and ${docCount} documents. ${
        isFirstBriefing ? 'This is your first briefing for this problem set.' : ''
      }`,
    });

    // Key developments
    if (changeSet) {
      sections.push({
        title: 'KEY DEVELOPMENTS',
        content: changeSet.summary,
      });
    }

    // Strategic landscape
    const containerNames = Object.keys(strategicContext.graphSummaries);
    sections.push({
      title: 'STRATEGIC LANDSCAPE',
      content: containerNames.length > 0
        ? `Analysis covers the following domains: ${containerNames.join(', ')}.`
        : 'No graph data available for strategic landscape analysis.',
    });

    // Emerging patterns
    if (predictiveAnalysis.patterns.length > 0) {
      const patternText = predictiveAnalysis.patterns
        .map(p => `- ${p.description} (confidence: ${(p.confidence * 100).toFixed(0)}% -- ${p.confidenceCaveat})`)
        .join('\n');
      sections.push({
        title: 'EMERGING PATTERNS',
        content: patternText,
      });
    } else {
      sections.push({
        title: 'EMERGING PATTERNS',
        content: 'Insufficient data for pattern analysis.',
      });
    }

    // Intelligence gaps
    sections.push({
      title: 'INTELLIGENCE GAPS',
      content: 'Automated narrative generation unavailable. Manual review of graph data recommended.',
    });

    const narrativeText = sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n');

    return {
      id: briefingId,
      problemSetId,
      requestedBy,
      generatedAt,
      sections,
      narrativeText,
      referencedEntityIds: [],
      sourcesCited: [],
      confidenceScores: predictiveAnalysis.patterns.map(p => ({
        pattern: p.description.slice(0, 100),
        confidence: p.confidence,
      })),
      isFirstBriefing,
      changeSummary: changeSet?.summary ?? null,
    };
  }

  /**
   * Persist a briefing to the database for history tracking.
   * Creates the table if it does not exist (graceful degradation).
   */
  private async persistBriefing(briefing: StrategicBriefing): Promise<void> {
    const pool = getPool();
    try {
      // Ensure table exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS strategic_briefings (
          id TEXT PRIMARY KEY,
          problem_set_id TEXT NOT NULL,
          requested_by TEXT NOT NULL,
          generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          executive_summary TEXT NOT NULL,
          narrative_text TEXT NOT NULL,
          sections JSONB NOT NULL DEFAULT '[]',
          referenced_entity_ids TEXT[] NOT NULL DEFAULT '{}',
          sources_cited TEXT[] NOT NULL DEFAULT '{}',
          confidence_scores JSONB NOT NULL DEFAULT '[]',
          is_first_briefing BOOLEAN NOT NULL DEFAULT false,
          change_summary TEXT
        )
      `);

      // Extract executive summary from sections
      const execSummary = briefing.sections
        .find(s => s.title === 'EXECUTIVE SUMMARY')?.content ?? briefing.narrativeText.slice(0, 500);

      await pool.query(
        `INSERT INTO strategic_briefings
         (id, problem_set_id, requested_by, generated_at, executive_summary,
          narrative_text, sections, referenced_entity_ids, sources_cited,
          confidence_scores, is_first_briefing, change_summary)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          briefing.id,
          briefing.problemSetId,
          briefing.requestedBy,
          briefing.generatedAt.toISOString(),
          execSummary,
          briefing.narrativeText,
          JSON.stringify(briefing.sections),
          briefing.referencedEntityIds,
          briefing.sourcesCited,
          JSON.stringify(briefing.confidenceScores),
          briefing.isFirstBriefing,
          briefing.changeSummary,
        ],
      );
    } catch (err) {
      // Non-fatal -- briefing is still returned even if persistence fails
      console.error('[BriefingService] Briefing persistence failed:', err);
    }
  }
}
