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

export default router;
