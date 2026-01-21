/**
 * Strategic Tools Module
 *
 * MCP-compatible tools for strategic planning analysis.
 * Tools are analysis-only (no write operations), stateless, and return
 * structured output with rationale for transparency.
 */

export {
  MidlifeCategorizer,
  getMidlifeCategorizer,
  type MidlifeCategorizeInput,
  type MidlifeCategorizeOutput,
} from './midlife-categorizer.js';
