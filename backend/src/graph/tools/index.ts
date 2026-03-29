/**
 * Graph Tools Index
 *
 * MCP tools for RAFT graph operations including:
 * - Objective queries and fusion
 * - Entity resolution and deduplication
 * - OSINT event management and evidence linking
 * - Validity scoring and alerting
 * - RAFT graph operations (actors, relationships, tensions, algorithms)
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

export {
  raftToolDefinitions,
  raftToolHandlers,
} from './raft-tools.js';

export {
  resourceToolDefinitions,
} from './resource-tools.js';

export {
  jppToolDefinitions,
  jppToolHandlers,
} from './jpp-tools.js';

export {
  ewmToolDefinitions,
  ewmToolHandlers,
} from './ewm-tools.js';

export {
  intelligenceGapToolDefinitions,
  intelligenceGapToolHandlers,
  pirToolDefinitions,
  pirToolHandlers,
} from './intelligence-gap-tools.js';

import { objectiveToolDefinitions } from './objective-tools.js';
import { entityToolDefinitions } from './entity-tools.js';
import { osintToolDefinitions } from './osint-tools.js';
import { validityToolDefinitions } from './validity-tools.js';
import { raftToolDefinitions } from './raft-tools.js';
import { resourceToolDefinitions } from './resource-tools.js';
import { jppToolDefinitions } from './jpp-tools.js';
import { ewmToolDefinitions } from './ewm-tools.js';
import { intelligenceGapToolDefinitions, pirToolDefinitions } from './intelligence-gap-tools.js';

/**
 * All fusion tool definitions for registration
 */
export const allFusionToolDefinitions = [
  ...objectiveToolDefinitions,
  ...entityToolDefinitions,
  ...osintToolDefinitions,
  ...validityToolDefinitions,
  ...raftToolDefinitions,
  ...resourceToolDefinitions,
  ...jppToolDefinitions,
  ...ewmToolDefinitions,
  ...intelligenceGapToolDefinitions,
  ...pirToolDefinitions,
];
