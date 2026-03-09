/**
 * Predictive Service - Emerging pattern analysis with confidence scoring
 *
 * Analyzes the knowledge graph to identify trends and emerging patterns
 * in the operational environment. Presents findings as "emerging patterns"
 * (not predictions) with explicit uncertainty quantification per RESEARCH.md
 * recommendations.
 *
 * Phase 40 Plan 08: Strategic Environment Briefing
 */

import { executeReadQuery } from '../../graph/neo4j-client.js';
import { createLLMForAgent } from '../../agents/langgraph/llm-factory.js';

// ============================================================================
// Types
// ============================================================================

export interface EmergingPattern {
  /** Human-readable description of the pattern */
  description: string;
  /** Confidence level 0-1 with explicit caveats */
  confidence: number;
  /** Explanation of confidence level */
  confidenceCaveat: string;
  /** Entity/relationship IDs that support this pattern */
  supportingEvidence: string[];
  /** Estimated timeframe for the pattern */
  timeframe: string;
  /** Potential outcomes if this pattern continues */
  potentialOutcomes: string[];
}

export interface PredictiveAnalysis {
  /** Identified emerging patterns */
  patterns: EmergingPattern[];
  /** Overall assessment of the strategic environment trajectory */
  overallAssessment: string;
  /** Assessment of underlying data quality and completeness */
  dataQuality: string;
}

// ============================================================================
// PredictiveService
// ============================================================================

const SYSTEM_PROMPT = `You are a strategic intelligence analyst identifying emerging patterns in the operational environment. Based on the knowledge graph data, identify trends that may indicate future developments.

Quantify your confidence explicitly. Use language like "moderate confidence based on X corroborating sources" not definitive predictions. If data is insufficient for prediction, say so.

Present findings as "emerging patterns" NOT "predictions". These are observed trends that warrant monitoring, not certainties.

Confidence calibration guidelines:
- 0.0-0.2: Very low -- insufficient data, speculative inference
- 0.2-0.4: Low -- single source or weak correlation
- 0.4-0.6: Moderate -- multiple sources with some corroboration
- 0.6-0.8: High -- multiple reliable sources with strong corroboration
- 0.8-1.0: Very high -- extensive corroboration across highly reliable sources

IMPORTANT: Output your analysis as valid JSON matching this structure exactly:
{
  "patterns": [
    {
      "description": "string",
      "confidence": number,
      "confidenceCaveat": "string",
      "supportingEvidence": ["entity/relationship IDs"],
      "timeframe": "string",
      "potentialOutcomes": ["string"]
    }
  ],
  "overallAssessment": "string",
  "dataQuality": "string"
}`;

/**
 * Analyzes knowledge graph data to identify emerging patterns
 * with calibrated confidence scoring.
 */
export class PredictiveService {
  /**
   * Analyze the knowledge graph for a problem set to identify
   * emerging patterns, trends, and potential developments.
   */
  async analyzePatterns(problemSetId: string): Promise<PredictiveAnalysis> {
    const emptyResult: PredictiveAnalysis = {
      patterns: [],
      overallAssessment: 'Insufficient data for pattern analysis.',
      dataQuality: 'No graph data available for this problem set.',
    };

    try {
      // Load recent graph data for this problem set
      const graphData = await this.loadGraphData(problemSetId);

      if (graphData.actorCount === 0) {
        return emptyResult;
      }

      // Use LLM to analyze patterns
      const llm = await createLLMForAgent({
        agentId: 'doc-briefing-predictive',
        overrides: { temperature: 0.3, maxTokens: 4096 },
      });

      const userPrompt = `Analyze the following knowledge graph data for emerging patterns:

ACTORS (${graphData.actorCount} total, showing recent):
${JSON.stringify(graphData.actors, null, 2)}

RELATIONSHIPS (${graphData.relationshipCount} total, showing recent):
${JSON.stringify(graphData.relationships, null, 2)}

TENSIONS (${graphData.tensionCount} total):
${JSON.stringify(graphData.tensions, null, 2)}

DATA CONTEXT:
- Total actors: ${graphData.actorCount}
- Total relationships: ${graphData.relationshipCount}
- Total tensions: ${graphData.tensionCount}
- Data recency: Most recent update at ${graphData.mostRecentUpdate || 'unknown'}

Identify 3-5 emerging patterns. For each, provide confidence based on:
1. Number of corroborating data points
2. Recency of supporting data
3. Diversity of source types`;

      const response = await llm.invoke([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ]);

      const responseText = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      return this.parseAnalysisResponse(responseText);
    } catch (err) {
      console.error('[PredictiveService] Pattern analysis failed:', err);
      return {
        ...emptyResult,
        overallAssessment: 'Pattern analysis unavailable due to service error.',
        dataQuality: 'Unable to assess -- analysis service encountered an error.',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /**
   * Load recent graph entities, relationships, and tensions for analysis.
   */
  private async loadGraphData(problemSetId: string): Promise<{
    actors: Array<{ id: string; name: string; type: string; updatedAt: string }>;
    relationships: Array<{
      id: string; sourceActor: string; targetActor: string;
      type: string; strength: number; description?: string;
    }>;
    tensions: Array<{
      id: string; description: string; intensity: string;
      domain: string; actorNames: string[];
    }>;
    actorCount: number;
    relationshipCount: number;
    tensionCount: number;
    mostRecentUpdate: string | null;
  }> {
    const empty = {
      actors: [] as Array<{ id: string; name: string; type: string; updatedAt: string }>,
      relationships: [] as Array<{
        id: string; sourceActor: string; targetActor: string;
        type: string; strength: number; description?: string;
      }>,
      tensions: [] as Array<{
        id: string; description: string; intensity: string;
        domain: string; actorNames: string[];
      }>,
      actorCount: 0,
      relationshipCount: 0,
      tensionCount: 0,
      mostRecentUpdate: null as string | null,
    };

    try {
      // Get actors with counts
      const actorResult = await executeReadQuery(
        `MATCH (a:Actor)
         WHERE a.workspaceId = $problemSetId
         WITH a ORDER BY a.updatedAt DESC
         WITH collect(a) as allActors
         RETURN size(allActors) as total,
                [a IN allActors[..30] | {
                  id: a.id, name: a.name, type: a.type,
                  updatedAt: a.updatedAt
                }] as recent,
                allActors[0].updatedAt as mostRecent`,
        { problemSetId },
      );

      const actorRow = actorResult.records[0];
      const actorCount = (actorRow?.get('total') as number) ?? 0;
      const actors = (actorRow?.get('recent') as Array<{ id: string; name: string; type: string; updatedAt: string }>) ?? [];
      const mostRecentUpdate = actorRow?.get('mostRecent') as string | null;

      // Get relationships with actor names
      const relResult = await executeReadQuery(
        `MATCH (a:Actor)-[r:RELATES_TO]->(b:Actor)
         WHERE a.workspaceId = $problemSetId OR b.workspaceId = $problemSetId
         WITH r, a, b ORDER BY r.updatedAt DESC
         WITH collect({r: r, a: a, b: b}) as allRels
         RETURN size(allRels) as total,
                [item IN allRels[..30] | {
                  id: item.r.id, sourceActor: item.a.name,
                  targetActor: item.b.name, type: item.r.type,
                  strength: item.r.strength, description: item.r.description
                }] as recent`,
        { problemSetId },
      );

      const relRow = relResult.records[0];
      const relationshipCount = (relRow?.get('total') as number) ?? 0;
      const relationships = (relRow?.get('recent') as Array<{
        id: string; sourceActor: string; targetActor: string;
        type: string; strength: number; description?: string;
      }>) ?? [];

      // Get tensions with actor names
      const tensionResult = await executeReadQuery(
        `MATCH (t:Tension)
         WHERE t.workspaceId = $problemSetId
         OPTIONAL MATCH (a:Actor) WHERE a.id IN t.actorIds
         WITH t, collect(a.name) as actorNames
         RETURN t.id as id, t.description as description,
                t.intensity as intensity, t.domain as domain,
                actorNames
         ORDER BY t.updatedAt DESC
         LIMIT 20`,
        { problemSetId },
      );

      const tensions = tensionResult.records.map(r => ({
        id: r.get('id') as string,
        description: r.get('description') as string,
        intensity: r.get('intensity') as string,
        domain: r.get('domain') as string,
        actorNames: r.get('actorNames') as string[],
      }));

      return {
        actors,
        relationships,
        tensions,
        actorCount,
        relationshipCount,
        tensionCount: tensions.length,
        mostRecentUpdate,
      };
    } catch (err) {
      console.error('[PredictiveService] Graph data loading failed:', err);
      return empty;
    }
  }

  /**
   * Parse the LLM response into a typed PredictiveAnalysis.
   * Handles malformed JSON gracefully.
   */
  private parseAnalysisResponse(responseText: string): PredictiveAnalysis {
    try {
      // Extract JSON from response (may be wrapped in markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          patterns: [],
          overallAssessment: responseText.slice(0, 500),
          dataQuality: 'Response could not be parsed as structured analysis.',
        };
      }

      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

      // Validate and coerce the response
      const patterns: EmergingPattern[] = Array.isArray(parsed.patterns)
        ? (parsed.patterns as Record<string, unknown>[]).map(p => ({
            description: String(p.description ?? ''),
            confidence: Math.min(1, Math.max(0, Number(p.confidence ?? 0))),
            confidenceCaveat: String(p.confidenceCaveat ?? 'No caveat provided'),
            supportingEvidence: Array.isArray(p.supportingEvidence)
              ? (p.supportingEvidence as unknown[]).map(String)
              : [],
            timeframe: String(p.timeframe ?? 'Unknown'),
            potentialOutcomes: Array.isArray(p.potentialOutcomes)
              ? (p.potentialOutcomes as unknown[]).map(String)
              : [],
          }))
        : [];

      return {
        patterns,
        overallAssessment: String(parsed.overallAssessment ?? 'Assessment unavailable.'),
        dataQuality: String(parsed.dataQuality ?? 'Data quality not assessed.'),
      };
    } catch {
      return {
        patterns: [],
        overallAssessment: responseText.slice(0, 500),
        dataQuality: 'Analysis response could not be parsed.',
      };
    }
  }
}
