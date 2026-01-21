/**
 * LangChain Tools Index
 *
 * Exports all LangChain-wrapped tools for use in LangGraph agents.
 */

export {
  categorizeMidlifeTool,
  getMidlifeToolMetadata,
} from './midlife-tool.js';

export {
  prioritizeDomainTool,
  getPrioritizeToolMetadata,
} from './prioritize-tool.js';

/**
 * Get all strategy reviewer tools.
 */
export function getStrategyReviewerTools() {
  return [
    categorizeMidlifeTool,
    prioritizeDomainTool,
  ];
}

import { categorizeMidlifeTool } from './midlife-tool.js';
import { prioritizeDomainTool } from './prioritize-tool.js';
