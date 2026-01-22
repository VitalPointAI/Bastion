/**
 * Graph Tools Index
 *
 * MCP tools for RAFT graph operations including:
 * - Objective queries and fusion
 * - Entity resolution and deduplication
 * - OSINT event management and evidence linking
 * - Validity scoring and alerting
 */

export {
  objectiveToolDefinitions,
  objectiveToolHandlers,
} from './objective-tools.js';

export {
  entityToolDefinitions,
  entityToolHandlers,
} from './entity-tools.js';

export {
  osintToolDefinitions,
  osintToolHandlers,
} from './osint-tools.js';

export {
  validityToolDefinitions,
  validityToolHandlers,
} from './validity-tools.js';

import { objectiveToolDefinitions } from './objective-tools.js';
import { entityToolDefinitions } from './entity-tools.js';
import { osintToolDefinitions } from './osint-tools.js';
import { validityToolDefinitions } from './validity-tools.js';

/**
 * All fusion tool definitions for registration
 */
export const allFusionToolDefinitions = [
  ...objectiveToolDefinitions,
  ...entityToolDefinitions,
  ...osintToolDefinitions,
  ...validityToolDefinitions,
];
