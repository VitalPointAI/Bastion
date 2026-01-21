/**
 * Strategic Tools API
 *
 * REST endpoints for strategic analysis tools.
 * Provides direct API access to MCP tools for UI integration.
 */

import express from 'express';
import {
  getMidlifeCategorizer,
  type MidlifeCategorizeInput,
} from '../strategic/tools/midlife-categorizer.js';
import {
  getDomainPrioritizer,
  type PrioritizeInput,
  type PrioritizeObjective,
} from '../strategic/tools/domain-prioritizer.js';
import { objectiveStore } from '../strategic/objectives/index.js';

const router = express.Router();

/**
 * Extract user DID from request headers
 */
function getUserDID(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }

  const xDid = req.headers['x-did'];
  if (typeof xDid === 'string' && xDid.trim()) {
    return xDid.trim();
  }

  const queryDid = req.query.did;
  if (typeof queryDid === 'string' && queryDid.trim()) {
    return queryDid.trim();
  }

  return null;
}

/**
 * POST /api/strategic/tools/categorize-midlife
 *
 * Analyze an objective and determine its MIDLIFE category.
 *
 * Request body:
 * - objectiveId: string (optional if description provided)
 * - description: string (optional if objectiveId provided)
 * - context?: { documentLevel?, dimeCategory?, keywords? }
 *
 * Response:
 * - category: MidlifeCategory
 * - confidence: number (0-1)
 * - rationale: string
 * - alternativeCategories?: Array<{ category, confidence, reason }>
 * - indicators: string[]
 * - toolVersion: string
 */
router.post('/categorize-midlife', async (req, res) => {
  try {
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const { objectiveId, description, context } = req.body;

    // Validate input - need either objectiveId or description
    if (!objectiveId && !description) {
      return res.status(400).json({
        error: 'Either objectiveId or description is required',
      });
    }

    let inputDescription = description;
    let inputContext = context;

    // If objectiveId provided, fetch the objective
    if (objectiveId && !description) {
      const objective = await objectiveStore.getObjective(objectiveId);
      if (!objective) {
        return res.status(404).json({
          error: 'Objective not found',
        });
      }
      inputDescription = objective.description;
      // Build context from objective if not provided
      if (!inputContext) {
        inputContext = {
          dimeCategory: objective.primaryInstrument,
        };
      }
    }

    // Validate description
    if (!inputDescription || typeof inputDescription !== 'string') {
      return res.status(400).json({
        error: 'description must be a non-empty string',
      });
    }

    // Build input
    const input: MidlifeCategorizeInput = {
      objectiveId: objectiveId || 'direct-analysis',
      description: inputDescription,
      context: inputContext,
    };

    // Run categorization
    const categorizer = getMidlifeCategorizer();
    const result = categorizer.categorize(input);

    // Return with tool version
    res.json({
      ...result,
      toolVersion: categorizer.getVersion(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('MIDLIFE categorization failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/strategic/tools/prioritize-domain
 *
 * Prioritize a list of objectives using weighted criteria analysis.
 *
 * Request body:
 * - objectives: Array<{ id, description, currentPriority?, metadata? }>
 * - domain: 'strategic' | 'operational' | 'tactical' | 'resource'
 * - criteria?: { urgency?, impact?, feasibility?, risk?, alignment?, dependencies? }
 *
 * Response:
 * - rankedObjectives: Array<{ id, rank, score, breakdown, rationale, recommendedPriority }>
 * - summary: string
 * - methodology: string
 * - toolVersion: string
 */
router.post('/prioritize-domain', async (req, res) => {
  try {
    const userDID = getUserDID(req);
    if (!userDID) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const { objectives, documentId, domain, criteria } = req.body;

    // Validate domain
    const validDomains = ['strategic', 'operational', 'tactical', 'resource'];
    if (!domain || !validDomains.includes(domain)) {
      return res.status(400).json({
        error: `domain must be one of: ${validDomains.join(', ')}`,
      });
    }

    // Build objectives list
    let objectivesList: PrioritizeObjective[] = [];

    // If objectives array provided, use directly
    if (Array.isArray(objectives) && objectives.length > 0) {
      objectivesList = objectives.map((obj: PrioritizeObjective) => ({
        id: obj.id,
        description: obj.description,
        currentPriority: obj.currentPriority,
        metadata: obj.metadata,
      }));
    }
    // If documentId provided, fetch objectives for that document
    else if (documentId) {
      const docObjectives = await objectiveStore.getObjectivesForDocument(documentId);
      objectivesList = docObjectives.map((obj) => ({
        id: obj.id,
        description: obj.description,
        currentPriority: obj.priority,
        metadata: {
          primaryInstrument: obj.primaryInstrument,
          status: obj.status,
        },
      }));
    } else {
      return res.status(400).json({
        error: 'Either objectives array or documentId is required',
      });
    }

    if (objectivesList.length === 0) {
      return res.status(400).json({
        error: 'No objectives to prioritize',
      });
    }

    // Build input
    const input: PrioritizeInput = {
      objectives: objectivesList,
      domain,
      criteria,
    };

    // Run prioritization
    const prioritizer = getDomainPrioritizer();
    const result = prioritizer.prioritize(input);

    // Return with tool version
    res.json({
      ...result,
      toolVersion: prioritizer.getVersion(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Domain prioritization failed:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
