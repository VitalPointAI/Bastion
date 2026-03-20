/**
 * Skill Handler Registry
 *
 * Maps handler identifiers (from .md skill files) to TypeScript execution functions.
 * The .md file declares WHAT the skill does; the handler implements HOW.
 *
 * Handler format in .md: "category/functionName"
 *   e.g., "navigation/planRoute" → calls the plan_route LangChain tool
 *
 * When the tactical AI (or any agent) invokes a skill, the runtime:
 *   1. Looks up the skill in SkillRegistry (for schema, prompt fragment)
 *   2. Looks up the handler here (for execution)
 *   3. Validates input against inputSchema
 *   4. Calls the handler function
 *   5. Returns the result
 */

import { createNavigationTools } from '../robot/skills/navigation-skill.js';
import { createTacticalTools } from '../robot/skills/tactical-skills.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillHandler = (args: Record<string, unknown>) => Promise<string>;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const handlers = new Map<string, SkillHandler>();

/**
 * Register a handler function for a skill.
 * @param handlerId - The handler identifier (matches `handler` field in .md)
 * @param fn - The execution function
 */
export function registerHandler(handlerId: string, fn: SkillHandler): void {
  handlers.set(handlerId, fn);
}

/**
 * Get a handler by its identifier.
 */
export function getHandler(handlerId: string): SkillHandler | undefined {
  return handlers.get(handlerId);
}

/**
 * Execute a skill by handler ID.
 */
export async function executeSkill(handlerId: string, args: Record<string, unknown>): Promise<string> {
  const handler = handlers.get(handlerId);
  if (!handler) {
    throw new Error(`No handler registered for "${handlerId}"`);
  }
  return handler(args);
}

/**
 * List all registered handler IDs.
 */
export function listHandlers(): string[] {
  return [...handlers.keys()];
}

// ---------------------------------------------------------------------------
// Bootstrap — register all built-in handlers from LangChain tools
// ---------------------------------------------------------------------------

/**
 * Initialize all built-in skill handlers.
 * Wraps existing LangChain DynamicStructuredTool instances as skill handlers.
 * Call once at startup after skill files are loaded.
 */
export function initializeBuiltinHandlers(): void {
  // Navigation tools
  const navTools = createNavigationTools();
  for (const tool of navTools) {
    const handlerId = navToolHandlerMap[tool.name];
    if (handlerId) {
      registerHandler(handlerId, async (args) => {
        const result = await tool.invoke(args);
        return typeof result === 'string' ? result : JSON.stringify(result);
      });
    }
  }

  // Tactical tools
  const tacTools = createTacticalTools();
  for (const tool of tacTools) {
    const handlerId = tacToolHandlerMap[tool.name];
    if (handlerId) {
      registerHandler(handlerId, async (args) => {
        const result = await tool.invoke(args);
        return typeof result === 'string' ? result : JSON.stringify(result);
      });
    }
  }

  console.log(`[SkillHandlerRegistry] Initialized ${handlers.size} built-in handlers`);
}

// Maps LangChain tool names → handler IDs (from .md files)
const navToolHandlerMap: Record<string, string> = {
  'get_map_info': 'navigation/getMapInfo',
  'plan_route': 'navigation/planRoute',
  'plan_screening_route': 'navigation/planScreeningRoute',
};

const tacToolHandlerMap: Record<string, string> = {
  'assess_threat_capability': 'tactical/assessThreat',
  'calculate_weapons_engagement_zone': 'tactical/calculateWEZ',
  'select_observation_post': 'tactical/selectOP',
  'identify_kill_zone': 'tactical/identifyKillZone',
};
