/**
 * Agent Seeder - Auto-registers LangGraph agents on startup
 *
 * Registers strategy-document-reviewer and other LangGraph-based agents
 * in the agent registry, assigns tools, and sets up characters.
 */

import { getAgentRegistry } from '../registry.js';
import { getToolRegistry } from '../tool-registry.js';
import {
  STRATEGY_REVIEWER_MANIFEST,
  STRATEGY_REVIEWER_TOOLS,
  STRATEGY_REVIEWER_CHARACTER,
} from '../../strategic/agents/strategy-reviewer.js';
import type { AgentPhase, AutonomyLevel, ProposalKind } from '../types.js';
import { getReviewCheckpointManager } from './graphs/strategy-reviewer-checkpoint.js';

/**
 * Status of seeding operation.
 */
export interface SeedResult {
  agentId: string;
  registered: boolean;
  toolsAssigned: string[];
  characterSet: boolean;
  error?: string;
}

/**
 * Seed the strategy document reviewer agent.
 */
async function seedStrategyReviewer(): Promise<SeedResult> {
  const result: SeedResult = {
    agentId: 'strategy-document-reviewer',
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent('strategy-document-reviewer');
    if (existing) {
      console.log('[AgentSeeder] strategy-document-reviewer already registered');
      result.registered = true;
      // Still update character if needed
      if (!existing.character) {
        registry.updateAgentCharacter('strategy-document-reviewer', STRATEGY_REVIEWER_CHARACTER);
        result.characterSet = true;
        console.log('[AgentSeeder] Updated character for strategy-document-reviewer');
      }
      return result;
    }

    // Register the agent
    const manifest = {
      ...STRATEGY_REVIEWER_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '', // Will be generated
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log('[AgentSeeder] Registered strategy-document-reviewer');

    // Set character
    registry.updateAgentCharacter('strategy-document-reviewer', STRATEGY_REVIEWER_CHARACTER);
    result.characterSet = true;
    console.log('[AgentSeeder] Set character for strategy-document-reviewer');

    // Assign tools
    const toolRegistry = getToolRegistry();
    await toolRegistry.ensureInitialized();

    for (const toolId of STRATEGY_REVIEWER_TOOLS) {
      try {
        // Check if tool exists
        const tool = toolRegistry.getTool(toolId);
        if (tool) {
          // Check if already assigned
          const agentTools = toolRegistry.getToolsForAgent('strategy-document-reviewer');
          if (!agentTools.some(t => t.toolId === toolId)) {
            toolRegistry.assignToolToAgent(toolId, 'strategy-document-reviewer', 'system');
            result.toolsAssigned.push(toolId);
            console.log(`[AgentSeeder] Assigned tool ${toolId} to strategy-document-reviewer`);
          }
        } else {
          console.warn(`[AgentSeeder] Tool ${toolId} not found in registry`);
        }
      } catch (err) {
        console.warn(`[AgentSeeder] Failed to assign tool ${toolId}:`, err);
      }
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AgentSeeder] Failed to seed strategy-document-reviewer:', error);
    return result;
  }
}

/**
 * Seed all LangGraph-based agents.
 * Call during application startup.
 */
export async function seedLangGraphAgents(): Promise<SeedResult[]> {
  console.log('[AgentSeeder] Starting LangGraph agent seeding...');

  const results: SeedResult[] = [];

  // Initialize review checkpoint manager
  try {
    const checkpointManager = getReviewCheckpointManager();
    await checkpointManager.initialize();
    console.log('[AgentSeeder] Review checkpoint manager initialized');
  } catch (error) {
    console.warn('[AgentSeeder] Review checkpoint manager init warning:', error);
  }

  // Seed strategy reviewer
  const strategyResult = await seedStrategyReviewer();
  results.push(strategyResult);

  // Log summary
  const successful = results.filter(r => r.registered);
  const failed = results.filter(r => r.error);

  console.log(
    `[AgentSeeder] Seeding complete: ${successful.length} registered, ${failed.length} failed`
  );

  if (failed.length > 0) {
    for (const f of failed) {
      console.error(`[AgentSeeder] Failed to seed ${f.agentId}: ${f.error}`);
    }
  }

  return results;
}

/**
 * Get the agent ID used for strategy document review.
 */
export function getStrategyReviewerAgentId(): string {
  return 'strategy-document-reviewer';
}
