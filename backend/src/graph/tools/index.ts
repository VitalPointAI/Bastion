/**
 * Graph Tools Index
 *
 * MCP tools for RAFT graph operations including:
 * - Objective queries and fusion
 * - Entity resolution and deduplication
 */

export {
  objectiveToolDefinitions,
  objectiveToolHandlers,
} from './objective-tools.js';

export {
  entityToolDefinitions,
  entityToolHandlers,
} from './entity-tools.js';

import { objectiveToolDefinitions } from './objective-tools.js';
import { entityToolDefinitions } from './entity-tools.js';

/**
 * All fusion tool definitions for registration
 */
export const allFusionToolDefinitions = [
  ...objectiveToolDefinitions,
  ...entityToolDefinitions,
];
