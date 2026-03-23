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
import { createSymbologyTools } from '../robot/skills/symbology-skill.js';
import { createDesignTools } from './design-skills.js';

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
 * Falls back to the dynamic LLM-based handler if no built-in handler exists.
 */
export async function executeSkill(handlerId: string, args: Record<string, unknown>): Promise<string> {
  const handler = handlers.get(handlerId);
  if (handler) return handler(args);

  // Fall back to dynamic handler — looks up the skill definition in the
  // SkillRegistry and uses its systemPromptFragment + inputSchema to
  // construct an LLM call that interprets the skill on the fly.
  return executeDynamicSkill(handlerId, args);
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

  // Symbology tools
  const symTools = createSymbologyTools();
  for (const tool of symTools) {
    const handlerId = symToolHandlerMap[tool.name];
    if (handlerId) {
      registerHandler(handlerId, async (args) => {
        const result = await tool.invoke(args);
        return typeof result === 'string' ? result : JSON.stringify(result);
      });
    }
  }

  // Design tools
  const designTools = createDesignTools();
  for (const tool of designTools) {
    const handlerId = designToolHandlerMap[tool.name];
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

const symToolHandlerMap: Record<string, string> = {
  'classify_and_symbolize': 'symbology/classifyAndSymbolize',
};

const tacToolHandlerMap: Record<string, string> = {
  'assess_threat_capability': 'tactical/assessThreat',
  'calculate_weapons_engagement_zone': 'tactical/calculateWEZ',
  'select_observation_post': 'tactical/selectOP',
  'identify_kill_zone': 'tactical/identifyKillZone',
  'evaluate_engagement': 'tactical/evaluateEngagement',
};

const designToolHandlerMap: Record<string, string> = {
  'overlay_producer': 'design/overlayProducer',
  'resource_allocator': 'design/resourceAllocator',
  'campaign_visualizer': 'design/campaignVisualizer',
  'risk_visualizer': 'design/riskVisualizer',
};

// ---------------------------------------------------------------------------
// Dynamic skill handler — LLM-interpreted execution for runtime-created skills
// ---------------------------------------------------------------------------

/**
 * Execute a skill that has no built-in handler by using the skill's
 * systemPromptFragment and inputSchema to construct an LLM call.
 * This enables Ironclaw-created skills to be immediately executable
 * without a server restart.
 */
async function executeDynamicSkill(handlerId: string, args: Record<string, unknown>): Promise<string> {
  // Look up the skill in the registry by handler ID (stored in metadata.handler)
  const { getSkillRegistry } = await import('../agents/skill-registry.js');
  const registry = getSkillRegistry();
  const allSkills = await registry.listSkills();

  const skill = allSkills.find(
    (s) => (s.metadata as Record<string, unknown>)?.handler === handlerId,
  );

  if (!skill) {
    throw new Error(`No skill found with handler "${handlerId}" — register a handler or create a skill .md file`);
  }

  const promptFragment = skill.systemPromptFragment ?? skill.description;
  const inputSchemaStr = JSON.stringify(skill.inputSchema, null, 2);

  // Use LLM to interpret the skill
  const { createLLMForAgent } = await import('../agents/langgraph/llm-factory.js');
  const { HumanMessage, SystemMessage } = await import('@langchain/core/messages');

  let llm;
  try {
    llm = await createLLMForAgent({ agentId: 'skill-executor' });
  } catch {
    throw new Error(`Cannot execute dynamic skill "${skill.name}" — no LLM available`);
  }

  const response = await llm.invoke([
    new SystemMessage(
      `You are executing a skill called "${skill.name}".\n\n` +
      `Skill description: ${skill.description}\n\n` +
      `Context:\n${promptFragment}\n\n` +
      `Input schema:\n${inputSchemaStr}\n\n` +
      `Execute this skill with the provided arguments and return a JSON result.`,
    ),
    new HumanMessage(
      `Execute with arguments:\n${JSON.stringify(args, null, 2)}`,
    ),
  ]);

  const text = typeof response.content === 'string'
    ? response.content
    : (response.content as Array<{ type: string; text?: string }>).find((b) => b.type === 'text')?.text ?? '';

  return text;
}

// ---------------------------------------------------------------------------
// Runtime skill registration — write .md file + register in DB + add handler
// ---------------------------------------------------------------------------

export interface RuntimeSkillDefinition {
  skillId: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  version?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  systemPromptFragment: string;
  overview?: string;
  tacticalContext?: string;
  constraints?: string;
}

/**
 * Register a new skill at runtime:
 * 1. Writes the .md file to backend/src/skills/{category}/
 * 2. Registers in the SkillRegistry (DB)
 * 3. Registers a dynamic handler (no restart needed)
 *
 * Called by Ironclaw's skill.create builder handler.
 */
export async function registerRuntimeSkill(
  def: RuntimeSkillDefinition,
  createdBy: string,
): Promise<{ skillId: string; filePath: string }> {
  const { writeFileSync, mkdirSync, existsSync } = await import('fs');
  const { join, dirname } = await import('path');
  const { fileURLToPath } = await import('url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const skillsDir = __dirname; // backend/src/skills/

  // Derive handler ID and file path
  const handlerId = `${def.category}/${toCamelCase(def.name)}`;
  const categoryDir = join(skillsDir, def.category);
  const fileName = `${def.name.replace(/_/g, '-')}.md`;
  const filePath = join(categoryDir, fileName);

  // Build .md content
  const inputSchemaYaml = jsonToYamlIndented(def.inputSchema, 2);
  const outputSchemaYaml = def.outputSchema ? jsonToYamlIndented(def.outputSchema, 2) : '';

  let mdContent = `---
skillId: ${def.skillId}
name: ${def.name}
description: ${def.description}
version: ${def.version ?? '1.0.0'}
category: ${def.category}
tags: [${def.tags.join(', ')}]
inputSchema:
${inputSchemaYaml}outputSchema:
${outputSchemaYaml || '  type: object\n'}systemPromptFragment: |
${def.systemPromptFragment.split('\n').map((l) => `  ${l}`).join('\n')}
handler: ${handlerId}
---

## Overview
${def.overview ?? def.description}
`;

  if (def.tacticalContext) {
    mdContent += `\n## Tactical Context\n${def.tacticalContext}\n`;
  }
  if (def.constraints) {
    mdContent += `\n## Constraints\n${def.constraints}\n`;
  }

  // 1. Write .md file locally (best effort — may be read-only in Docker)
  try {
    if (!existsSync(categoryDir)) {
      mkdirSync(categoryDir, { recursive: true });
    }
    writeFileSync(filePath, mdContent, 'utf-8');
    console.log(`[SkillHandlerRegistry] Wrote skill file locally: ${fileName}`);
  } catch (localErr) {
    console.warn(`[SkillHandlerRegistry] Local .md write failed (read-only fs?): ${localErr}`);
  }

  // 1b. Commit .md file to GitHub (git-tracked source of truth)
  const gitPath = `backend/src/skills/${def.category}/${fileName}`;
  try {
    const { githubService } = await import('../ironclaw/github-service.js');
    if (githubService.isConfigured()) {
      await githubService.commitFileToMaster(
        gitPath,
        mdContent,
        `feat(skills): add ${def.name} skill [automated]\n\nCreated by ${createdBy} via Ironclaw skill.create`,
      );
      console.log(`[SkillHandlerRegistry] Committed ${gitPath} to GitHub master`);
    } else {
      console.warn('[SkillHandlerRegistry] GitHub not configured — .md file not committed');
    }
  } catch (gitErr) {
    console.warn(`[SkillHandlerRegistry] GitHub commit failed (non-blocking): ${gitErr}`);
  }

  // 2. Register in DB
  const { getSkillRegistry } = await import('../agents/skill-registry.js');
  const registry = getSkillRegistry();
  await registry.createSkill({
    skillId: def.skillId,
    name: def.name,
    description: def.description,
    version: def.version ?? '1.0.0',
    isEnabled: true,
    inputSchema: def.inputSchema,
    outputSchema: def.outputSchema,
    systemPromptFragment: def.systemPromptFragment,
    toolIds: [],
    metadata: {
      category: def.category,
      tags: def.tags,
      handler: handlerId,
      sourceFile: `${def.category}/${fileName}`,
      createdAt: new Date().toISOString(),
    },
    createdBy,
  });

  // 3. Dynamic handler registered automatically via executeDynamicSkill fallback
  // No explicit registration needed — executeSkill() will find it in the registry

  console.log(`[SkillHandlerRegistry] Runtime skill registered: ${def.skillId} → ${handlerId}`);
  return { skillId: def.skillId, filePath: `${def.category}/${fileName}` };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toCamelCase(snakeStr: string): string {
  return snakeStr.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function jsonToYamlIndented(obj: Record<string, unknown>, indent: number): string {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`${pad}${key}:`);
      lines.push(jsonToYamlIndented(value as Record<string, unknown>, indent + 2));
    } else if (Array.isArray(value)) {
      lines.push(`${pad}${key}: [${value.map((v) => typeof v === 'string' ? v : JSON.stringify(v)).join(', ')}]`);
    } else if (typeof value === 'string') {
      lines.push(`${pad}${key}: ${value}`);
    } else {
      lines.push(`${pad}${key}: ${JSON.stringify(value)}`);
    }
  }

  return lines.join('\n') + '\n';
}
