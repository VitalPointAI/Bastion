/**
 * Brain API Router
 *
 * REST endpoints for brain visualization features:
 * annotations, snapshots, historical graph queries,
 * intelligence gap detection, pattern alerts, and NL search.
 */

import { Router, type Request, type Response } from 'express';
import { brainStore } from '../brain/brain-store.js';
import type { CreateAnnotationInput, UpdateAnnotationInput, CreateSnapshotInput } from '../brain/brain-types.js';
import { executeReadQuery } from '../graph/neo4j-client.js';

const router = Router();

/**
 * Helper to extract string value from query param (handles arrays)
 */
function getQueryString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0];
  if (typeof value === 'string') return value;
  return undefined;
}

// =====================
// ANNOTATION ENDPOINTS
// =====================

// GET /api/brain/annotations?problemSetId=X
// Returns annotations for the given problem set visible to the requesting user
router.get('/annotations', async (req: Request, res: Response) => {
  try {
    const problemSetId = getQueryString(req.query.problemSetId);
    if (!problemSetId) {
      return res.status(400).json({ error: 'problemSetId query parameter is required' });
    }
    const userId = (req.headers['x-did'] as string) || 'anonymous';
    const annotations = await brainStore.getAnnotations(problemSetId, userId);
    res.json({ annotations });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/brain/annotations
// Create a new annotation
router.post('/annotations', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-did'] as string) || 'anonymous';
    const input: CreateAnnotationInput = {
      ...req.body,
      createdBy: userId,
    };
    if (!input.nodeId || !input.nodeType || !input.annotationType || !input.problemSetId) {
      return res.status(400).json({ error: 'nodeId, nodeType, annotationType, and problemSetId are required' });
    }
    const annotation = await brainStore.createAnnotation(input);
    res.status(201).json(annotation);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// PUT /api/brain/annotations/:id
// Update an annotation (owner only)
router.put('/annotations/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = (req.headers['x-did'] as string) || 'anonymous';
    const input: UpdateAnnotationInput = req.body;
    const updated = await brainStore.updateAnnotation(id, userId, input);
    if (!updated) {
      return res.status(404).json({ error: 'Annotation not found or not owned by user' });
    }
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// DELETE /api/brain/annotations/:id
// Delete an annotation (owner only)
router.delete('/annotations/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = (req.headers['x-did'] as string) || 'anonymous';
    const deleted = await brainStore.deleteAnnotation(id, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Annotation not found or not owned by user' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// SNAPSHOT ENDPOINTS
// =====================

// GET /api/brain/snapshots?problemSetId=X
router.get('/snapshots', async (req: Request, res: Response) => {
  try {
    const problemSetId = getQueryString(req.query.problemSetId);
    if (!problemSetId) {
      return res.status(400).json({ error: 'problemSetId query parameter is required' });
    }
    const snapshots = await brainStore.getSnapshots(problemSetId);
    res.json({ snapshots });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/brain/snapshots
// Save a new AI context snapshot
router.post('/snapshots', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-did'] as string) || 'anonymous';
    const input: CreateSnapshotInput = {
      ...req.body,
      createdBy: userId,
    };
    if (!input.problemSetId || !input.title || !input.summary) {
      return res.status(400).json({ error: 'problemSetId, title, and summary are required' });
    }
    const snapshot = await brainStore.createSnapshot(input);
    res.status(201).json(snapshot);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// GET /api/brain/snapshots/:id
router.get('/snapshots/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const snapshot = await brainStore.getSnapshot(id);
    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// DELETE /api/brain/snapshots/:id
router.delete('/snapshots/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const deleted = await brainStore.deleteSnapshot(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// HISTORICAL GRAPH ENDPOINT
// =====================

// GET /api/brain/graph-snapshot?problemSetId=X&at=ISO_TIMESTAMP
// Returns the graph state as it existed at the given timestamp
router.get('/graph-snapshot', async (req: Request, res: Response) => {
  try {
    const problemSetId = getQueryString(req.query.problemSetId);
    const at = getQueryString(req.query.at);
    if (!problemSetId || !at) {
      return res.status(400).json({ error: 'problemSetId and at (ISO timestamp) query parameters are required' });
    }
    const graphState = await brainStore.getGraphAtTime(problemSetId, at);
    res.json(graphState);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// GAP DETECTION ENDPOINT
// =====================

// GET /api/brain/gaps?problemSetId=X
// Returns under-connected nodes representing intelligence gaps
router.get('/gaps', async (req: Request, res: Response) => {
  try {
    const problemSetId = getQueryString(req.query.problemSetId);
    if (!problemSetId) {
      return res.status(400).json({ error: 'problemSetId query parameter is required' });
    }
    const report = await brainStore.getIntelligenceGaps(problemSetId);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// PATTERN ALERTS ENDPOINT
// =====================

// GET /api/brain/pattern-alerts?problemSetId=X
// Returns detected trends and anomalies in the graph
router.get('/pattern-alerts', async (req: Request, res: Response) => {
  try {
    const problemSetId = getQueryString(req.query.problemSetId);
    if (!problemSetId) {
      return res.status(400).json({ error: 'problemSetId query parameter is required' });
    }
    const alerts = await brainStore.getPatternAlerts(problemSetId);
    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// =====================
// NATURAL LANGUAGE SEARCH ENDPOINT
// =====================

/**
 * POST /api/brain/nl-search
 *
 * Accepts a natural-language query about the knowledge graph and returns
 * the IDs of nodes that match the query, plus a plain-English interpretation.
 *
 * This is a lightweight NL-to-filter bridge using the Ironclaw LLM gateway.
 * It is NOT the full Ironclaw chat integration — it simply asks the LLM to
 * identify matching node IDs and returns them for graph highlighting.
 *
 * Body: { problemSetId: string; query: string }
 * Response: { matchingNodeIds: string[]; interpretation: string }
 */
router.post('/nl-search', async (req: Request, res: Response) => {
  try {
    const { problemSetId, query } = req.body as { problemSetId?: string; query?: string };

    if (!problemSetId || !query) {
      return res.status(400).json({
        error: 'problemSetId and query are required',
      });
    }

    // ── 1. Fetch graph nodes for the problem set (actors from Neo4j) ──────────
    let nodeList: Array<{ id: string; label: string; type: string; actorCategory?: string }> = [];

    try {
      const result = await executeReadQuery(
        `MATCH (a:Actor)
         WHERE a.workspaceId = $workspaceId
         RETURN a.id AS id, a.name AS name, a.type AS type, a.actor_category AS actorCategory
         LIMIT 500`,
        { workspaceId: problemSetId },
      );

      nodeList = result.records.map((r) => ({
        id: (r.get('id') as string) ?? '',
        label: (r.get('name') as string) ?? '',
        type: (r.get('type') as string) ?? 'entity',
        actorCategory: (r.get('actorCategory') as string | null) ?? undefined,
      })).filter((n) => n.id);
    } catch (graphErr) {
      // Graph query failure is non-fatal — return empty match with friendly message
      console.error('[brain/nl-search] Neo4j query error:', graphErr);
      return res.json({
        matchingNodeIds: [],
        interpretation: 'Search failed — graph data unavailable. Try traditional filters.',
      });
    }

    if (nodeList.length === 0) {
      return res.json({
        matchingNodeIds: [],
        interpretation: 'No graph nodes found for this problem set.',
      });
    }

    // ── 2. Build compact node list for the LLM prompt ─────────────────────────
    const nodeListText = nodeList
      .map((n) => `${n.id} | ${n.label} | ${n.type}${n.actorCategory ? ' | ' + n.actorCategory : ''}`)
      .join('\n');

    // ── 3. Call Ironclaw OpenAI-compatible gateway for one-shot completion ─────
    const ironclawGatewayUrl = process.env.IRONCLAW_GATEWAY_URL ?? 'http://ironclaw:3000';

    const systemPrompt = `You are a knowledge graph search assistant. Given a list of graph nodes and a user query, return the IDs of nodes that semantically match the query. Return JSON only, no other text: { "matchingNodeIds": string[], "interpretation": string }

The interpretation should be a single sentence describing what the results show (e.g. "Showing nodes related to China's naval capabilities").
If no nodes match, return empty matchingNodeIds with a helpful interpretation.`;

    const userMessage = `Graph nodes (format: id | label | type | actorCategory):\n${nodeListText}\n\nUser query: ${query}`;

    let matchingNodeIds: string[] = [];
    let interpretation = '';

    try {
      const llmResponse = await fetch(`${ironclawGatewayUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'ironclaw',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.1,
          max_tokens: 512,
        }),
        signal: AbortSignal.timeout(15_000), // 15-second timeout
      });

      if (!llmResponse.ok) {
        throw new Error(`LLM gateway returned ${llmResponse.status}`);
      }

      const llmData = await llmResponse.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const rawContent = llmData.choices?.[0]?.message?.content ?? '';

      // Extract JSON from response (strip markdown code fences if present)
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          matchingNodeIds?: unknown;
          interpretation?: unknown;
        };

        // Validate returned IDs exist in the node list
        const validIdSet = new Set(nodeList.map((n) => n.id));
        const rawIds = Array.isArray(parsed.matchingNodeIds) ? parsed.matchingNodeIds : [];
        matchingNodeIds = rawIds
          .filter((id): id is string => typeof id === 'string' && validIdSet.has(id));

        interpretation = typeof parsed.interpretation === 'string'
          ? parsed.interpretation
          : `Found ${matchingNodeIds.length} matching node${matchingNodeIds.length !== 1 ? 's' : ''}`;
      }
    } catch (llmErr) {
      console.error('[brain/nl-search] LLM call error:', llmErr);
      // Graceful fallback — don't fail the request
      return res.json({
        matchingNodeIds: [],
        interpretation: 'Search failed — try traditional filters',
      });
    }

    return res.json({ matchingNodeIds, interpretation });
  } catch (error) {
    console.error('[brain/nl-search] Unexpected error:', error);
    res.status(500).json({
      matchingNodeIds: [],
      interpretation: 'Search failed — try traditional filters',
    });
  }
});

export const nlSearchHandler = router;

export default router;
export { router as brainRouter };
