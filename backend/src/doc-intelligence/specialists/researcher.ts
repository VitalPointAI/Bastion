/**
 * Autonomous Researcher Specialist
 *
 * Proactively fills knowledge gaps via web search and scheduled OSINT
 * monitoring. Two trigger modes:
 * 1. Gap-triggered: immediate research when extraction reveals gaps
 * 2. Scheduled OSINT: pg-boss periodic job reviewing standing requirements
 *
 * Research products re-enter the document processing pipeline as
 * strategic_documents with source_type='research_brief', ensuring they
 * receive the same triage, extraction, and trust evaluation as any
 * uploaded document.
 *
 * Safeguards prevent infinite loops: depth limits, cooldowns,
 * deduplication, and budget caps per research cycle.
 */

import { SpecialistBase } from '../specialist-base.js';
import type { SpecialistConfig } from '../specialist-base.js';
import type { ProblemSetContext } from '../schemas.js';
import { getPool } from '../../lib/database.js';
import { getSharedBoss } from '../../lib/database.js';
import { createLLMForAgent } from '../../agents/langgraph/llm-factory.js';
import { performWebSearch } from '../web-search.js';

// ============================================================================
// Constants & Configuration
// ============================================================================

/** Maximum recursive research depth (research products can trigger one level of follow-up) */
const MAX_RESEARCH_DEPTH = 2;

/** Minimum time between research cycles for the same gap (milliseconds) */
const RESEARCH_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/** Default maximum API calls per research cycle */
const DEFAULT_MAX_API_CALLS = 10;

/** Default OSINT monitoring cadence (cron expression for daily at 06:00 UTC) */
const DEFAULT_OSINT_CADENCE = '0 6 * * *';

/** pg-boss queue name for research jobs */
const RESEARCH_QUEUE = 'doc-intel-research';

/** pg-boss queue name for OSINT monitoring jobs */
const OSINT_MONITOR_QUEUE = 'doc-intel-osint-monitor';

// ============================================================================
// Types
// ============================================================================

export interface KnowledgeGap {
  gapId: string;
  description: string;
  gapType: 'missing_actor' | 'temporal_gap' | 'unresolved_reference' | 'standing_requirement' | 'low_confidence';
  relatedEntities: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface ResearchQuery {
  query: string;
  gapId: string;
  focusArea: string;
}

export interface ResearchResult {
  gapId: string;
  query: string;
  findings: string;
  sources: ResearchSource[];
  briefMarkdown: string;
}

export interface ResearchSource {
  url: string;
  title: string;
  retrievalDate: string;
  snippet: string;
}

export interface ResearchCycleResult {
  problemSetId: string;
  gapsIdentified: number;
  gapsResearched: number;
  briefsGenerated: number;
  documentsCreated: string[];
  apiCallsUsed: number;
  depth: number;
}

export interface ResearchJobData {
  problemSetId: string;
  gaps: string[];
  depth: number;
  triggeredBy: string;
}

export interface OSINTMonitorJobData {
  problemSetId: string;
}

// ============================================================================
// Researcher Specialist
// ============================================================================

/**
 * Autonomous Researcher that detects knowledge gaps and fills them
 * via web search. Research products are fed back into the document
 * intelligence pipeline for extraction and trust evaluation.
 */
export class Researcher extends SpecialistBase {
  /** Track researched gap IDs to avoid re-researching the same gap */
  private researchedGaps: Map<string, number> = new Map(); // gapId -> timestamp

  /** Budget tracking per cycle */
  private apiCallsThisCycle = 0;
  private maxApiCalls: number;

  constructor(config?: { maxApiCalls?: number }) {
    const specialistConfig: SpecialistConfig = {
      specialistId: 'researcher',
      name: 'Autonomous Researcher',
      description:
        'Proactively identifies knowledge gaps and fills them via OSINT ' +
        'web search. Research products re-enter the processing pipeline ' +
        'with full source attribution and trust evaluation.',
      systemPrompt: '', // Overridden by getSystemPrompt()
      tools: [],
      clearance: 'UNCLASS',
    };

    super(specialistConfig);
    this.maxApiCalls = config?.maxApiCalls ?? DEFAULT_MAX_API_CALLS;
  }

  // --------------------------------------------------------------------------
  // System Prompt
  // --------------------------------------------------------------------------

  getSystemPrompt(context: ProblemSetContext): string {
    return `You are an OSINT researcher supporting strategic intelligence analysis. Given the problem set context and identified knowledge gaps, find relevant open-source information.

Focus on:
- Geographic scope: ${context.geographicScope.regions.join(', ')} (${context.geographicScope.countries.join(', ')})
- Temporal range: ${context.temporalRange.startDate ?? 'open'} to ${context.temporalRange.endDate ?? 'open'}
- Primary actors: ${context.actorFocus.primaryActors.join(', ')}
- Core problem: ${context.coreProblem}

Prioritize authoritative sources (government publications, established news organizations, academic institutions, recognized think tanks). Always cite sources with URLs and retrieval dates.

When generating research queries:
1. Be specific and targeted to the identified gap
2. Use Boolean operators for precision
3. Include actor names, locations, and timeframes
4. Prefer recent information within the temporal range

When synthesizing findings into a research brief:
1. Lead with the key finding that addresses the gap
2. Cite every claim with its source
3. Note confidence level and source reliability
4. Identify any new gaps or follow-up questions discovered`;
  }

  // --------------------------------------------------------------------------
  // Gap Detection
  // --------------------------------------------------------------------------

  /**
   * Analyze the knowledge graph for a problem set to identify gaps.
   * Checks for: low-confidence entities, unresolved references,
   * unaddressed standing requirements, and temporal gaps.
   */
  async detectGaps(problemSetId: string, context: ProblemSetContext): Promise<KnowledgeGap[]> {
    const pool = getPool();
    const gaps: KnowledgeGap[] = [];

    // 1. Find low-confidence entities in the graph
    const lowConfidence = await pool.query(
      `SELECT id, name, entity_type, confidence
       FROM graph_actors
       WHERE workspace_id = $1
         AND (is_revoked = false OR is_revoked IS NULL)
         AND confidence IS NOT NULL AND confidence < 0.5
       ORDER BY confidence ASC
       LIMIT 20`,
      [problemSetId],
    );

    for (const row of lowConfidence.rows) {
      gaps.push({
        gapId: `low-conf-${row.id}`,
        description: `Low confidence (${row.confidence}) entity: ${row.name} (${row.entity_type})`,
        gapType: 'low_confidence',
        relatedEntities: [row.id],
        priority: row.confidence < 0.3 ? 'high' : 'medium',
      });
    }

    // 2. Check standing requirements from problem set context
    if (context.standingRequirements) {
      for (const req of context.standingRequirements) {
        const gapId = `sr-${Buffer.from(req).toString('base64').slice(0, 16)}`;
        // Check if this requirement has been addressed (has associated documents)
        const addressed = await pool.query(
          `SELECT COUNT(*) as cnt FROM strategic_documents
           WHERE problem_set_id = $1
             AND source_type = 'research_brief'
             AND metadata->>'standing_requirement' = $2`,
          [problemSetId, req],
        );

        if (Number(addressed.rows[0].cnt) === 0) {
          gaps.push({
            gapId,
            description: `Unaddressed standing requirement: ${req}`,
            gapType: 'standing_requirement',
            relatedEntities: [],
            priority: 'high',
          });
        }
      }
    }

    // 3. Find actors referenced but without detailed information
    const sparseActors = await pool.query(
      `SELECT ga.id, ga.name, ga.entity_type
       FROM graph_actors ga
       LEFT JOIN graph_relationships gr ON gr.from_entity_id = ga.id OR gr.to_entity_id = ga.id
       WHERE ga.workspace_id = $1
         AND (ga.is_revoked = false OR ga.is_revoked IS NULL)
       GROUP BY ga.id, ga.name, ga.entity_type
       HAVING COUNT(gr.id) <= 1
       LIMIT 10`,
      [problemSetId],
    );

    for (const row of sparseActors.rows) {
      gaps.push({
        gapId: `sparse-${row.id}`,
        description: `Actor with minimal relationships: ${row.name} (${row.entity_type})`,
        gapType: 'missing_actor',
        relatedEntities: [row.id],
        priority: 'low',
      });
    }

    return gaps;
  }

  // --------------------------------------------------------------------------
  // Research Execution
  // --------------------------------------------------------------------------

  /**
   * Execute a research cycle for identified gaps.
   *
   * For each gap: generate a research query, perform web search,
   * synthesize a research brief, and store it as a strategic document
   * that re-enters the processing pipeline.
   *
   * @param problemSetId - Problem set to research within
   * @param context - Problem set context for scoping
   * @param gaps - Gaps to research (or detect automatically if empty)
   * @param depth - Current recursion depth (must be < MAX_RESEARCH_DEPTH)
   */
  async executeResearchCycle(
    problemSetId: string,
    context: ProblemSetContext,
    gaps: KnowledgeGap[],
    depth = 0,
  ): Promise<ResearchCycleResult> {
    this.setProblemSetContext(context);
    this.apiCallsThisCycle = 0;

    // Enforce depth limit (Pitfall 3: prevent infinite loops)
    if (depth >= MAX_RESEARCH_DEPTH) {
      console.log(`[researcher] Max research depth (${MAX_RESEARCH_DEPTH}) reached, stopping`);
      return {
        problemSetId,
        gapsIdentified: gaps.length,
        gapsResearched: 0,
        briefsGenerated: 0,
        documentsCreated: [],
        apiCallsUsed: 0,
        depth,
      };
    }

    // Auto-detect gaps if none provided
    if (gaps.length === 0) {
      gaps = await this.detectGaps(problemSetId, context);
    }

    // Filter out recently researched gaps (cooldown enforcement)
    const now = Date.now();
    const researchableGaps = gaps.filter((gap) => {
      const lastResearched = this.researchedGaps.get(gap.gapId);
      return !lastResearched || (now - lastResearched) > RESEARCH_COOLDOWN_MS;
    });

    // Sort by priority: high first
    researchableGaps.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });

    const documentsCreated: string[] = [];
    let gapsResearched = 0;

    for (const gap of researchableGaps) {
      // Check budget limit
      if (this.apiCallsThisCycle >= this.maxApiCalls) {
        console.log(`[researcher] Budget limit (${this.maxApiCalls}) reached`);
        break;
      }

      try {
        // Generate research queries
        const queries = await this.generateQueries(gap, context);
        this.apiCallsThisCycle++;

        // Execute searches and synthesize
        const result = await this.executeSearch(queries, gap, context);
        this.apiCallsThisCycle++;

        if (result) {
          // Store as strategic document
          const docId = await this.storeResearchBrief(
            problemSetId,
            result,
            gap,
            depth,
          );
          documentsCreated.push(docId);

          // Mark gap as researched
          this.researchedGaps.set(gap.gapId, Date.now());
          gapsResearched++;
        }
      } catch (error) {
        console.error(`[researcher] Failed to research gap ${gap.gapId}:`, error);
      }
    }

    return {
      problemSetId,
      gapsIdentified: gaps.length,
      gapsResearched,
      briefsGenerated: documentsCreated.length,
      documentsCreated,
      apiCallsUsed: this.apiCallsThisCycle,
      depth,
    };
  }

  // --------------------------------------------------------------------------
  // Query Generation
  // --------------------------------------------------------------------------

  /**
   * Generate targeted research queries from a knowledge gap using LLM.
   */
  private async generateQueries(
    gap: KnowledgeGap,
    context: ProblemSetContext,
  ): Promise<ResearchQuery[]> {
    try {
      const llm = await createLLMForAgent({ agentId: `doc-${this.specialistId}` });
      const systemPrompt = this.getSystemPrompt(context);

      const response = await llm.invoke([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Generate 2-3 specific web search queries to fill this knowledge gap:

Gap: ${gap.description}
Type: ${gap.gapType}
Related entities: ${gap.relatedEntities.join(', ') || 'none'}

Return JSON array: [{ "query": "search query string", "focusArea": "what aspect this addresses" }]`,
        },
      ]);

      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [{ query: gap.description, gapId: gap.gapId, focusArea: gap.gapType }];

      const parsed = JSON.parse(jsonMatch[0]) as Array<{ query: string; focusArea: string }>;
      return parsed.map((q) => ({
        query: q.query,
        gapId: gap.gapId,
        focusArea: q.focusArea,
      }));
    } catch (error) {
      console.error('[researcher] Query generation failed:', error);
      // Fallback: use gap description as query
      return [{ query: gap.description, gapId: gap.gapId, focusArea: gap.gapType }];
    }
  }

  // --------------------------------------------------------------------------
  // Search Execution
  // --------------------------------------------------------------------------

  /**
   * Execute web searches and synthesize findings into a research brief.
   * Uses LLM to synthesize search results into a structured brief.
   */
  private async executeSearch(
    queries: ResearchQuery[],
    gap: KnowledgeGap,
    context: ProblemSetContext,
  ): Promise<ResearchResult | null> {
    const allSources: ResearchSource[] = [];

    // Execute each query via the web_search tool pattern
    for (const query of queries) {
      if (this.apiCallsThisCycle >= this.maxApiCalls) break;

      try {
        const sources = await this.performWebSearch(query.query);
        allSources.push(...sources);
      } catch (error) {
        console.error(`[researcher] Search failed for query "${query.query}":`, error);
      }
    }

    if (allSources.length === 0) {
      console.log(`[researcher] No search results for gap ${gap.gapId}`);
      return null;
    }

    // Synthesize results into a research brief
    try {
      const llm = await createLLMForAgent({ agentId: `doc-${this.specialistId}` });
      const systemPrompt = this.getSystemPrompt(context);

      const sourceSummary = allSources
        .map((s, i) => `[${i + 1}] ${s.title}\n    URL: ${s.url}\n    Snippet: ${s.snippet}`)
        .join('\n\n');

      const response = await llm.invoke([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Synthesize the following search results into a research brief that addresses this knowledge gap:

Gap: ${gap.description}

Search Results:
${sourceSummary}

Write a concise research brief in Markdown format. Include:
1. Key Finding (1-2 sentences addressing the gap)
2. Detailed Analysis (cite sources by number [1], [2], etc.)
3. Source Reliability Assessment
4. Remaining Unknowns / Follow-up Questions

Return ONLY the Markdown brief content.`,
        },
      ]);
      this.apiCallsThisCycle++;

      const briefMarkdown = typeof response.content === 'string'
        ? response.content
        : String(response.content);

      return {
        gapId: gap.gapId,
        query: queries.map((q) => q.query).join(' | '),
        findings: briefMarkdown.slice(0, 500),
        sources: allSources,
        briefMarkdown,
      };
    } catch (error) {
      console.error('[researcher] Brief synthesis failed:', error);
      return null;
    }
  }

  /**
   * Perform a web search using the tool registry pattern.
   * Returns structured search results with URLs and snippets.
   */
  private async performWebSearch(query: string): Promise<ResearchSource[]> {
    // Use the built-in web_search tool via LLM tool use
    // For now, use the LLM to simulate search (actual tool integration
    // will be wired when tool-registry is connected to specialist agents)
    const pool = getPool();

    // Check if there's an OSINT webhook endpoint configured
    const retrievalDate = new Date().toISOString();

    // Store the search query for audit trail
    await pool.query(
      `INSERT INTO research_queries (query, executed_at, source)
       VALUES ($1, NOW(), 'researcher-specialist')
       ON CONFLICT DO NOTHING`,
      [query],
    ).catch(() => {
      // Table may not exist yet -- non-critical
    });

    // Use pluggable web search (Tavily when configured, placeholder fallback)
    const results = await performWebSearch(query);
    if (results.length > 0) {
      return results;
    }
    // If search returned nothing, provide a minimal entry so the
    // LLM synthesis step still has context to work with.
    return [{
      url: `https://search.example.com/q=${encodeURIComponent(query)}`,
      title: `Research query: ${query}`,
      retrievalDate,
      snippet: `No web search results available for: ${query}`,
    }];
  }

  // --------------------------------------------------------------------------
  // Research Brief Storage
  // --------------------------------------------------------------------------

  /**
   * Store a research brief as a strategic_document so it re-enters
   * the document intelligence pipeline.
   */
  private async storeResearchBrief(
    problemSetId: string,
    result: ResearchResult,
    gap: KnowledgeGap,
    depth: number,
  ): Promise<string> {
    const pool = getPool();

    const metadata = {
      source_type: 'research_brief',
      gap_id: gap.gapId,
      gap_type: gap.gapType,
      gap_description: gap.description,
      research_depth: depth,
      sources: result.sources.map((s) => ({
        url: s.url,
        title: s.title,
        retrievalDate: s.retrievalDate,
      })),
      standing_requirement: gap.gapType === 'standing_requirement' ? gap.description : undefined,
      generated_by: 'researcher-specialist',
      generated_at: new Date().toISOString(),
    };

    const insertResult = await pool.query(
      `INSERT INTO strategic_documents
         (problem_set_id, title, content, source_type, source_url, trust_status, metadata, created_at)
       VALUES ($1, $2, $3, 'research_brief', $4, 'pending_review', $5, NOW())
       RETURNING id`,
      [
        problemSetId,
        `Research Brief: ${gap.description.slice(0, 100)}`,
        result.briefMarkdown,
        result.sources[0]?.url ?? null,
        JSON.stringify(metadata),
      ],
    );

    const docId = insertResult.rows[0].id;
    console.log(`[researcher] Created research brief ${docId} for gap ${gap.gapId}`);

    return String(docId);
  }

  // --------------------------------------------------------------------------
  // pg-boss Integration
  // --------------------------------------------------------------------------

  /**
   * Schedule OSINT monitoring for a problem set.
   * Creates a pg-boss scheduled job with singleton key for deduplication.
   */
  async scheduleOSINTMonitoring(
    problemSetId: string,
    cadence: string = DEFAULT_OSINT_CADENCE,
  ): Promise<void> {
    const boss = await getSharedBoss();

    // Create queue if it doesn't exist
    await boss.createQueue(OSINT_MONITOR_QUEUE);

    // Schedule with singleton key to prevent duplicate monitors
    const singletonKey = `osint-monitor-${problemSetId}`;
    await boss.schedule(
      OSINT_MONITOR_QUEUE,
      cadence,
      { problemSetId } as unknown as object,
      { singletonKey },
    );

    console.log(
      `[researcher] OSINT monitoring scheduled for ${problemSetId} at cadence: ${cadence}`,
    );
  }

  /**
   * Trigger immediate gap research via pg-boss job.
   * Uses singleton key per problem set to deduplicate concurrent triggers.
   */
  async triggerGapResearch(
    problemSetId: string,
    gaps: string[],
    depth = 0,
    triggeredBy = 'system',
  ): Promise<void> {
    const boss = await getSharedBoss();

    // Create queue if it doesn't exist
    await boss.createQueue(RESEARCH_QUEUE);

    const jobData: ResearchJobData = {
      problemSetId,
      gaps,
      depth,
      triggeredBy,
    };

    await boss.send(RESEARCH_QUEUE, jobData as unknown as object, {
      singletonKey: `research-${problemSetId}-${Date.now()}`,
      retryLimit: 2,
      retryDelay: 60, // 60 seconds between retries
    });

    console.log(
      `[researcher] Gap research triggered for ${problemSetId} with ${gaps.length} gaps`,
    );
  }

  /**
   * Register pg-boss workers for research and OSINT monitoring jobs.
   * Called during server startup.
   */
  async registerWorkers(): Promise<void> {
    const boss = await getSharedBoss();
    // Create queues
    await boss.createQueue(RESEARCH_QUEUE);
    await boss.createQueue(OSINT_MONITOR_QUEUE);

    // Research job handler
    await boss.work(RESEARCH_QUEUE, async (jobs: unknown[]) => {
      for (const job of jobs) {
        const data = (job as { data: ResearchJobData }).data;
        console.log(`[researcher] Processing research job for ${data.problemSetId}`);

        try {
          // Load problem set context
          const context = await this.loadProblemSetContext(data.problemSetId);
          if (!context) {
            console.error(`[researcher] No context found for ${data.problemSetId}`);
            return;
          }

          // Convert gap IDs to KnowledgeGap objects
          const gaps: KnowledgeGap[] = data.gaps.map((gapDesc) => ({
            gapId: `manual-${Buffer.from(gapDesc).toString('base64').slice(0, 16)}`,
            description: gapDesc,
            gapType: 'standing_requirement' as const,
            relatedEntities: [],
            priority: 'high' as const,
          }));

          await this.executeResearchCycle(
            data.problemSetId,
            context,
            gaps,
            data.depth,
          );
        } catch (error) {
          console.error(`[researcher] Research job failed:`, error);
        }
      }
    });

    // OSINT monitoring job handler
    await boss.work(OSINT_MONITOR_QUEUE, async (jobs: unknown[]) => {
      for (const job of jobs) {
        const data = (job as { data: OSINTMonitorJobData }).data;
        console.log(`[researcher] OSINT monitoring cycle for ${data.problemSetId}`);

        try {
          const context = await this.loadProblemSetContext(data.problemSetId);
          if (!context) {
            console.error(`[researcher] No context found for ${data.problemSetId}`);
            return;
          }

          // Auto-detect gaps and research them
          await this.executeResearchCycle(
            data.problemSetId,
            context,
            [], // Empty = auto-detect
            0,
          );
        } catch (error) {
          console.error(`[researcher] OSINT monitoring failed:`, error);
        }
      }
    });

    console.log('[researcher] pg-boss workers registered');
  }

  // --------------------------------------------------------------------------
  // Context Loading
  // --------------------------------------------------------------------------

  /**
   * Load ProblemSetContext from the database for a given problem set.
   */
  private async loadProblemSetContext(problemSetId: string): Promise<ProblemSetContext | null> {
    const pool = getPool();

    try {
      const result = await pool.query(
        `SELECT context_json FROM problem_set_contexts
         WHERE problem_set_id = $1
         ORDER BY version DESC LIMIT 1`,
        [problemSetId],
      );

      if (result.rows.length === 0) return null;
      return result.rows[0].context_json as ProblemSetContext;
    } catch {
      console.error(`[researcher] Failed to load context for ${problemSetId}`);
      return null;
    }
  }
}
