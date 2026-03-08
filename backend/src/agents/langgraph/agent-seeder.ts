/**
 * Agent Seeder - Auto-registers LangGraph agents on startup
 *
 * Registers strategy-document-reviewer, strategic-fusion-agent,
 * entity-resolution-agent, RAFT extraction/reasoning agents,
 * Phase 5.1 MDMP Governance Integration agents (assumption-auditor,
 * orders-validator, uncertainty-quantifier, data-bias-detector,
 * problem-framing, roe-compliance), Phase 5.2 Escalation & Competition
 * Modeling agents (adversary-modeler, effect-cascader, escalation-modeler,
 * deception-detector), and other LangGraph-based agents in the agent
 * registry, assigns tools, and sets up characters.
 */

import { getAgentRegistry } from '../registry.js';
import { getToolRegistry } from '../tool-registry.js';
import {
  STRATEGY_REVIEWER_MANIFEST,
  STRATEGY_REVIEWER_TOOLS,
  STRATEGY_REVIEWER_CHARACTER,
} from '../../strategic/agents/strategy-reviewer.js';
import {
  STRATEGIC_FUSION_AGENT_ID,
  STRATEGIC_FUSION_MANIFEST,
  STRATEGIC_FUSION_TOOLS,
  STRATEGIC_FUSION_CHARACTER,
} from '../../graph/agents/strategic-fusion-agent.js';
import {
  ENTITY_RESOLUTION_AGENT_ID,
  ENTITY_RESOLUTION_MANIFEST,
  ENTITY_RESOLUTION_TOOLS,
  ENTITY_RESOLUTION_CHARACTER,
} from '../../graph/agents/entity-resolution-agent.js';
import {
  OSINT_MONITOR_AGENT_ID,
  OSINT_MONITOR_MANIFEST,
  OSINT_MONITOR_TOOLS,
  OSINT_MONITOR_CHARACTER,
} from '../../graph/agents/osint-monitor-agent.js';
import {
  VALIDITY_ASSESSMENT_AGENT_ID,
  VALIDITY_ASSESSMENT_MANIFEST,
  VALIDITY_ASSESSMENT_TOOLS,
  VALIDITY_ASSESSMENT_CHARACTER,
} from '../../graph/agents/validity-assessment-agent.js';
import {
  CONFLICT_DETECTION_AGENT_ID,
  CONFLICT_DETECTION_MANIFEST,
  CONFLICT_DETECTION_TOOLS,
  CONFLICT_DETECTION_CHARACTER,
} from '../../graph/agents/conflict-detection-agent.js';
import {
  RAFT_EXTRACTION_AGENT_ID,
  RAFT_EXTRACTION_MANIFEST,
  RAFT_EXTRACTION_TOOLS,
  RAFT_EXTRACTION_CHARACTER,
} from '../../graph/agents/raft-extraction-agent.js';
import {
  RAFT_REASONING_AGENT_ID,
  RAFT_REASONING_MANIFEST,
  RAFT_REASONING_TOOLS,
  RAFT_REASONING_CHARACTER,
} from '../../graph/agents/raft-reasoning-agent.js';
import { objectiveToolDefinitions } from '../../graph/tools/objective-tools.js';
import { entityToolDefinitions } from '../../graph/tools/entity-tools.js';
import { osintToolDefinitions } from '../../graph/tools/osint-tools.js';
import { validityToolDefinitions } from '../../graph/tools/validity-tools.js';
import { raftToolDefinitions } from '../../graph/tools/raft-tools.js';

import { getReviewCheckpointManager } from './graphs/strategy-reviewer-checkpoint.js';

// Phase 5.1 - MDMP Governance Integration agents
import { ASSUMPTION_AUDITOR_MANIFEST } from '../assumption-auditor.js';
import { ORDERS_VALIDATOR_MANIFEST } from '../orders-validator.js';
import { UNCERTAINTY_QUANTIFIER_MANIFEST } from '../uncertainty-quantifier.js';
import { DATA_BIAS_DETECTOR_MANIFEST } from '../data-bias-detector.js';
import { PROBLEM_FRAMING_AGENT } from '../problem-framing.js';
import { ROE_COMPLIANCE_MANIFEST } from '../roe-compliance.js';

// Phase 5.2 - Escalation & Competition Modeling agents
import { ADVERSARY_MODELER_MANIFEST } from '../adversary-modeler.js';
import { EFFECT_CASCADER_MANIFEST } from '../effect-cascader.js';
import { ESCALATION_MODELER_MANIFEST } from '../escalation-modeler.js';
import { DECEPTION_DETECTOR_MANIFEST } from '../deception-detector.js';

// New agents - Deception, Exploitation, De-escalation
import { DECEPTION_PLANNER_MANIFEST } from '../deception-planner.js';
import { EXPLOITATION_ANALYST_MANIFEST } from '../exploitation-analyst.js';
import { DEESCALATION_MANAGER_MANIFEST } from '../deescalation-manager.js';

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
 * Seed the strategic fusion agent.
 */
async function seedStrategicFusionAgent(): Promise<SeedResult> {
  const result: SeedResult = {
    agentId: STRATEGIC_FUSION_AGENT_ID,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(STRATEGIC_FUSION_AGENT_ID);
    if (existing) {
      console.log(`[AgentSeeder] ${STRATEGIC_FUSION_AGENT_ID} already registered`);
      result.registered = true;
      if (!existing.character) {
        registry.updateAgentCharacter(STRATEGIC_FUSION_AGENT_ID, STRATEGIC_FUSION_CHARACTER);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${STRATEGIC_FUSION_AGENT_ID}`);
      }
      return result;
    }

    // Register the agent
    const manifest = {
      ...STRATEGIC_FUSION_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${STRATEGIC_FUSION_AGENT_ID}`);

    // Set character
    registry.updateAgentCharacter(STRATEGIC_FUSION_AGENT_ID, STRATEGIC_FUSION_CHARACTER);
    result.characterSet = true;
    console.log(`[AgentSeeder] Set character for ${STRATEGIC_FUSION_AGENT_ID}`);

    // Assign tools
    const toolRegistry = getToolRegistry();
    await toolRegistry.ensureInitialized();

    for (const toolId of STRATEGIC_FUSION_TOOLS) {
      try {
        const tool = toolRegistry.getTool(toolId);
        if (tool) {
          const agentTools = toolRegistry.getToolsForAgent(STRATEGIC_FUSION_AGENT_ID);
          if (!agentTools.some(t => t.toolId === toolId)) {
            toolRegistry.assignToolToAgent(toolId, STRATEGIC_FUSION_AGENT_ID, 'system');
            result.toolsAssigned.push(toolId);
            console.log(`[AgentSeeder] Assigned tool ${toolId} to ${STRATEGIC_FUSION_AGENT_ID}`);
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
    console.error(`[AgentSeeder] Failed to seed ${STRATEGIC_FUSION_AGENT_ID}:`, error);
    return result;
  }
}

/**
 * Seed the entity resolution agent.
 */
async function seedEntityResolutionAgent(): Promise<SeedResult> {
  const result: SeedResult = {
    agentId: ENTITY_RESOLUTION_AGENT_ID,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(ENTITY_RESOLUTION_AGENT_ID);
    if (existing) {
      console.log(`[AgentSeeder] ${ENTITY_RESOLUTION_AGENT_ID} already registered`);
      result.registered = true;
      if (!existing.character) {
        registry.updateAgentCharacter(ENTITY_RESOLUTION_AGENT_ID, ENTITY_RESOLUTION_CHARACTER);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${ENTITY_RESOLUTION_AGENT_ID}`);
      }
      return result;
    }

    // Register the agent
    const manifest = {
      ...ENTITY_RESOLUTION_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${ENTITY_RESOLUTION_AGENT_ID}`);

    // Set character
    registry.updateAgentCharacter(ENTITY_RESOLUTION_AGENT_ID, ENTITY_RESOLUTION_CHARACTER);
    result.characterSet = true;
    console.log(`[AgentSeeder] Set character for ${ENTITY_RESOLUTION_AGENT_ID}`);

    // Assign tools
    const toolRegistry = getToolRegistry();
    await toolRegistry.ensureInitialized();

    for (const toolId of ENTITY_RESOLUTION_TOOLS) {
      try {
        const tool = toolRegistry.getTool(toolId);
        if (tool) {
          const agentTools = toolRegistry.getToolsForAgent(ENTITY_RESOLUTION_AGENT_ID);
          if (!agentTools.some(t => t.toolId === toolId)) {
            toolRegistry.assignToolToAgent(toolId, ENTITY_RESOLUTION_AGENT_ID, 'system');
            result.toolsAssigned.push(toolId);
            console.log(`[AgentSeeder] Assigned tool ${toolId} to ${ENTITY_RESOLUTION_AGENT_ID}`);
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
    console.error(`[AgentSeeder] Failed to seed ${ENTITY_RESOLUTION_AGENT_ID}:`, error);
    return result;
  }
}

/**
 * Seed the OSINT Monitor agent.
 */
async function seedOsintMonitorAgent(): Promise<SeedResult> {
  const result: SeedResult = {
    agentId: OSINT_MONITOR_AGENT_ID,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(OSINT_MONITOR_AGENT_ID);
    if (existing) {
      console.log(`[AgentSeeder] ${OSINT_MONITOR_AGENT_ID} already registered`);
      result.registered = true;
      if (!existing.character) {
        registry.updateAgentCharacter(OSINT_MONITOR_AGENT_ID, OSINT_MONITOR_CHARACTER);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${OSINT_MONITOR_AGENT_ID}`);
      }
      return result;
    }

    // Register the agent
    const manifest = {
      ...OSINT_MONITOR_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${OSINT_MONITOR_AGENT_ID}`);

    // Set character
    registry.updateAgentCharacter(OSINT_MONITOR_AGENT_ID, OSINT_MONITOR_CHARACTER);
    result.characterSet = true;
    console.log(`[AgentSeeder] Set character for ${OSINT_MONITOR_AGENT_ID}`);

    // Assign tools
    const toolRegistry = getToolRegistry();
    await toolRegistry.ensureInitialized();

    for (const toolId of OSINT_MONITOR_TOOLS) {
      try {
        const tool = toolRegistry.getTool(toolId);
        if (tool) {
          const agentTools = toolRegistry.getToolsForAgent(OSINT_MONITOR_AGENT_ID);
          if (!agentTools.some(t => t.toolId === toolId)) {
            toolRegistry.assignToolToAgent(toolId, OSINT_MONITOR_AGENT_ID, 'system');
            result.toolsAssigned.push(toolId);
            console.log(`[AgentSeeder] Assigned tool ${toolId} to ${OSINT_MONITOR_AGENT_ID}`);
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
    console.error(`[AgentSeeder] Failed to seed ${OSINT_MONITOR_AGENT_ID}:`, error);
    return result;
  }
}

/**
 * Seed the Validity Assessment agent.
 */
async function seedValidityAssessmentAgent(): Promise<SeedResult> {
  const result: SeedResult = {
    agentId: VALIDITY_ASSESSMENT_AGENT_ID,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(VALIDITY_ASSESSMENT_AGENT_ID);
    if (existing) {
      console.log(`[AgentSeeder] ${VALIDITY_ASSESSMENT_AGENT_ID} already registered`);
      result.registered = true;
      if (!existing.character) {
        registry.updateAgentCharacter(VALIDITY_ASSESSMENT_AGENT_ID, VALIDITY_ASSESSMENT_CHARACTER);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${VALIDITY_ASSESSMENT_AGENT_ID}`);
      }
      return result;
    }

    // Register the agent
    const manifest = {
      ...VALIDITY_ASSESSMENT_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${VALIDITY_ASSESSMENT_AGENT_ID}`);

    // Set character
    registry.updateAgentCharacter(VALIDITY_ASSESSMENT_AGENT_ID, VALIDITY_ASSESSMENT_CHARACTER);
    result.characterSet = true;
    console.log(`[AgentSeeder] Set character for ${VALIDITY_ASSESSMENT_AGENT_ID}`);

    // Assign tools
    const toolRegistry = getToolRegistry();
    await toolRegistry.ensureInitialized();

    for (const toolId of VALIDITY_ASSESSMENT_TOOLS) {
      try {
        const tool = toolRegistry.getTool(toolId);
        if (tool) {
          const agentTools = toolRegistry.getToolsForAgent(VALIDITY_ASSESSMENT_AGENT_ID);
          if (!agentTools.some(t => t.toolId === toolId)) {
            toolRegistry.assignToolToAgent(toolId, VALIDITY_ASSESSMENT_AGENT_ID, 'system');
            result.toolsAssigned.push(toolId);
            console.log(`[AgentSeeder] Assigned tool ${toolId} to ${VALIDITY_ASSESSMENT_AGENT_ID}`);
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
    console.error(`[AgentSeeder] Failed to seed ${VALIDITY_ASSESSMENT_AGENT_ID}:`, error);
    return result;
  }
}

/**
 * Seed the Conflict Detection agent.
 */
async function seedConflictDetectionAgent(): Promise<SeedResult> {
  const result: SeedResult = {
    agentId: CONFLICT_DETECTION_AGENT_ID,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(CONFLICT_DETECTION_AGENT_ID);
    if (existing) {
      console.log(`[AgentSeeder] ${CONFLICT_DETECTION_AGENT_ID} already registered`);
      result.registered = true;
      if (!existing.character) {
        registry.updateAgentCharacter(CONFLICT_DETECTION_AGENT_ID, CONFLICT_DETECTION_CHARACTER);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${CONFLICT_DETECTION_AGENT_ID}`);
      }
      return result;
    }

    // Register the agent
    const manifest = {
      ...CONFLICT_DETECTION_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${CONFLICT_DETECTION_AGENT_ID}`);

    // Set character
    registry.updateAgentCharacter(CONFLICT_DETECTION_AGENT_ID, CONFLICT_DETECTION_CHARACTER);
    result.characterSet = true;
    console.log(`[AgentSeeder] Set character for ${CONFLICT_DETECTION_AGENT_ID}`);

    // Assign tools
    const toolRegistry = getToolRegistry();
    await toolRegistry.ensureInitialized();

    for (const toolId of CONFLICT_DETECTION_TOOLS) {
      try {
        const tool = toolRegistry.getTool(toolId);
        if (tool) {
          const agentTools = toolRegistry.getToolsForAgent(CONFLICT_DETECTION_AGENT_ID);
          if (!agentTools.some(t => t.toolId === toolId)) {
            toolRegistry.assignToolToAgent(toolId, CONFLICT_DETECTION_AGENT_ID, 'system');
            result.toolsAssigned.push(toolId);
            console.log(`[AgentSeeder] Assigned tool ${toolId} to ${CONFLICT_DETECTION_AGENT_ID}`);
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
    console.error(`[AgentSeeder] Failed to seed ${CONFLICT_DETECTION_AGENT_ID}:`, error);
    return result;
  }
}

/**
 * Seed the RAFT Extraction agent.
 */
async function seedRaftExtractionAgent(): Promise<SeedResult> {
  const result: SeedResult = {
    agentId: RAFT_EXTRACTION_AGENT_ID,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(RAFT_EXTRACTION_AGENT_ID);
    if (existing) {
      console.log(`[AgentSeeder] ${RAFT_EXTRACTION_AGENT_ID} already registered`);
      result.registered = true;
      if (!existing.character) {
        registry.updateAgentCharacter(RAFT_EXTRACTION_AGENT_ID, RAFT_EXTRACTION_CHARACTER);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${RAFT_EXTRACTION_AGENT_ID}`);
      }
      return result;
    }

    // Register the agent
    const manifest = {
      ...RAFT_EXTRACTION_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${RAFT_EXTRACTION_AGENT_ID}`);

    // Set character
    registry.updateAgentCharacter(RAFT_EXTRACTION_AGENT_ID, RAFT_EXTRACTION_CHARACTER);
    result.characterSet = true;
    console.log(`[AgentSeeder] Set character for ${RAFT_EXTRACTION_AGENT_ID}`);

    // Assign tools
    const toolRegistry = getToolRegistry();
    await toolRegistry.ensureInitialized();

    for (const toolId of RAFT_EXTRACTION_TOOLS) {
      try {
        const tool = toolRegistry.getTool(toolId);
        if (tool) {
          const agentTools = toolRegistry.getToolsForAgent(RAFT_EXTRACTION_AGENT_ID);
          if (!agentTools.some(t => t.toolId === toolId)) {
            toolRegistry.assignToolToAgent(toolId, RAFT_EXTRACTION_AGENT_ID, 'system');
            result.toolsAssigned.push(toolId);
            console.log(`[AgentSeeder] Assigned tool ${toolId} to ${RAFT_EXTRACTION_AGENT_ID}`);
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
    console.error(`[AgentSeeder] Failed to seed ${RAFT_EXTRACTION_AGENT_ID}:`, error);
    return result;
  }
}

/**
 * Seed the RAFT Reasoning agent.
 */
async function seedRaftReasoningAgent(): Promise<SeedResult> {
  const result: SeedResult = {
    agentId: RAFT_REASONING_AGENT_ID,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(RAFT_REASONING_AGENT_ID);
    if (existing) {
      console.log(`[AgentSeeder] ${RAFT_REASONING_AGENT_ID} already registered`);
      result.registered = true;
      if (!existing.character) {
        registry.updateAgentCharacter(RAFT_REASONING_AGENT_ID, RAFT_REASONING_CHARACTER);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${RAFT_REASONING_AGENT_ID}`);
      }
      return result;
    }

    // Register the agent
    const manifest = {
      ...RAFT_REASONING_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${RAFT_REASONING_AGENT_ID}`);

    // Set character
    registry.updateAgentCharacter(RAFT_REASONING_AGENT_ID, RAFT_REASONING_CHARACTER);
    result.characterSet = true;
    console.log(`[AgentSeeder] Set character for ${RAFT_REASONING_AGENT_ID}`);

    // Assign tools
    const toolRegistry = getToolRegistry();
    await toolRegistry.ensureInitialized();

    for (const toolId of RAFT_REASONING_TOOLS) {
      try {
        const tool = toolRegistry.getTool(toolId);
        if (tool) {
          const agentTools = toolRegistry.getToolsForAgent(RAFT_REASONING_AGENT_ID);
          if (!agentTools.some(t => t.toolId === toolId)) {
            toolRegistry.assignToolToAgent(toolId, RAFT_REASONING_AGENT_ID, 'system');
            result.toolsAssigned.push(toolId);
            console.log(`[AgentSeeder] Assigned tool ${toolId} to ${RAFT_REASONING_AGENT_ID}`);
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
    console.error(`[AgentSeeder] Failed to seed ${RAFT_REASONING_AGENT_ID}:`, error);
    return result;
  }
}

// ==========================================================================
// Phase 5.1 - MDMP Governance Integration Agent Seeders
// ==========================================================================

/**
 * Seed the Assumption Auditor agent.
 */
async function seedAssumptionAuditorAgent(): Promise<SeedResult> {
  const agentId = ASSUMPTION_AUDITOR_MANIFEST.agentId;
  const result: SeedResult = {
    agentId,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(agentId);
    if (existing) {
      console.log(`[AgentSeeder] ${agentId} already registered`);
      result.registered = true;
      if (!existing.character && ASSUMPTION_AUDITOR_MANIFEST.character) {
        registry.updateAgentCharacter(agentId, ASSUMPTION_AUDITOR_MANIFEST.character);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${agentId}`);
      }
      return result;
    }

    // Register the agent
    const manifest = {
      ...ASSUMPTION_AUDITOR_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${agentId}`);

    // Set character
    if (ASSUMPTION_AUDITOR_MANIFEST.character) {
      registry.updateAgentCharacter(agentId, ASSUMPTION_AUDITOR_MANIFEST.character);
      result.characterSet = true;
      console.log(`[AgentSeeder] Set character for ${agentId}`);
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AgentSeeder] Failed to seed ${agentId}:`, error);
    return result;
  }
}

/**
 * Seed the Orders Validator agent.
 */
async function seedOrdersValidatorAgent(): Promise<SeedResult> {
  const agentId = ORDERS_VALIDATOR_MANIFEST.agentId;
  const result: SeedResult = {
    agentId,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(agentId);
    if (existing) {
      console.log(`[AgentSeeder] ${agentId} already registered`);
      result.registered = true;
      return result;
    }

    // Register the agent
    const manifest = {
      ...ORDERS_VALIDATOR_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${agentId}`);

    // No character defined for this agent

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AgentSeeder] Failed to seed ${agentId}:`, error);
    return result;
  }
}

/**
 * Seed the Uncertainty Quantifier agent.
 */
async function seedUncertaintyQuantifierAgent(): Promise<SeedResult> {
  const agentId = UNCERTAINTY_QUANTIFIER_MANIFEST.agentId;
  const result: SeedResult = {
    agentId,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(agentId);
    if (existing) {
      console.log(`[AgentSeeder] ${agentId} already registered`);
      result.registered = true;
      if (!existing.character && UNCERTAINTY_QUANTIFIER_MANIFEST.character) {
        registry.updateAgentCharacter(agentId, UNCERTAINTY_QUANTIFIER_MANIFEST.character);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${agentId}`);
      }
      return result;
    }

    // Register the agent
    const manifest = {
      ...UNCERTAINTY_QUANTIFIER_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${agentId}`);

    // Set character
    if (UNCERTAINTY_QUANTIFIER_MANIFEST.character) {
      registry.updateAgentCharacter(agentId, UNCERTAINTY_QUANTIFIER_MANIFEST.character);
      result.characterSet = true;
      console.log(`[AgentSeeder] Set character for ${agentId}`);
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AgentSeeder] Failed to seed ${agentId}:`, error);
    return result;
  }
}

/**
 * Seed the Data Bias Detector agent.
 */
async function seedDataBiasDetectorAgent(): Promise<SeedResult> {
  const agentId = DATA_BIAS_DETECTOR_MANIFEST.agentId;
  const result: SeedResult = {
    agentId,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(agentId);
    if (existing) {
      console.log(`[AgentSeeder] ${agentId} already registered`);
      result.registered = true;
      if (!existing.character && DATA_BIAS_DETECTOR_MANIFEST.character) {
        registry.updateAgentCharacter(agentId, DATA_BIAS_DETECTOR_MANIFEST.character);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${agentId}`);
      }
      return result;
    }

    // Register the agent
    const manifest = {
      ...DATA_BIAS_DETECTOR_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${agentId}`);

    // Set character
    if (DATA_BIAS_DETECTOR_MANIFEST.character) {
      registry.updateAgentCharacter(agentId, DATA_BIAS_DETECTOR_MANIFEST.character);
      result.characterSet = true;
      console.log(`[AgentSeeder] Set character for ${agentId}`);
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AgentSeeder] Failed to seed ${agentId}:`, error);
    return result;
  }
}

/**
 * Seed the Problem Framing agent.
 */
async function seedProblemFramingAgent(): Promise<SeedResult> {
  const agentId = PROBLEM_FRAMING_AGENT.agentId;
  const result: SeedResult = {
    agentId,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(agentId);
    if (existing) {
      console.log(`[AgentSeeder] ${agentId} already registered`);
      result.registered = true;
      if (!existing.character && PROBLEM_FRAMING_AGENT.character) {
        registry.updateAgentCharacter(agentId, PROBLEM_FRAMING_AGENT.character);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${agentId}`);
      }
      return result;
    }

    // Register the agent
    const manifest = {
      ...PROBLEM_FRAMING_AGENT,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${agentId}`);

    // Set character
    if (PROBLEM_FRAMING_AGENT.character) {
      registry.updateAgentCharacter(agentId, PROBLEM_FRAMING_AGENT.character);
      result.characterSet = true;
      console.log(`[AgentSeeder] Set character for ${agentId}`);
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AgentSeeder] Failed to seed ${agentId}:`, error);
    return result;
  }
}

/**
 * Seed the ROE Compliance agent.
 */
async function seedRoeComplianceAgent(): Promise<SeedResult> {
  const agentId = ROE_COMPLIANCE_MANIFEST.agentId;
  const result: SeedResult = {
    agentId,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(agentId);
    if (existing) {
      console.log(`[AgentSeeder] ${agentId} already registered`);
      result.registered = true;
      return result;
    }

    // Register the agent
    const manifest = {
      ...ROE_COMPLIANCE_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${agentId}`);

    // No character defined for this agent

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AgentSeeder] Failed to seed ${agentId}:`, error);
    return result;
  }
}

// ==========================================================================
// Phase 5.2 - Escalation & Competition Modeling Agent Seeders
// ==========================================================================

/**
 * Seed the Adversary Modeler agent.
 */
async function seedAdversaryModelerAgent(): Promise<SeedResult> {
  const agentId = ADVERSARY_MODELER_MANIFEST.agentId;
  const result: SeedResult = {
    agentId,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(agentId);
    if (existing) {
      console.log(`[AgentSeeder] ${agentId} already registered`);
      result.registered = true;
      if (!existing.character && ADVERSARY_MODELER_MANIFEST.character) {
        registry.updateAgentCharacter(agentId, ADVERSARY_MODELER_MANIFEST.character);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${agentId}`);
      }
      return result;
    }

    // Register the agent
    const manifest = {
      ...ADVERSARY_MODELER_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${agentId}`);

    // Set character
    if (ADVERSARY_MODELER_MANIFEST.character) {
      registry.updateAgentCharacter(agentId, ADVERSARY_MODELER_MANIFEST.character);
      result.characterSet = true;
      console.log(`[AgentSeeder] Set character for ${agentId}`);
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AgentSeeder] Failed to seed ${agentId}:`, error);
    return result;
  }
}

/**
 * Seed the Effect Cascader agent.
 */
async function seedEffectCascaderAgent(): Promise<SeedResult> {
  const agentId = EFFECT_CASCADER_MANIFEST.agentId;
  const result: SeedResult = {
    agentId,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(agentId);
    if (existing) {
      console.log(`[AgentSeeder] ${agentId} already registered`);
      result.registered = true;
      if (!existing.character && EFFECT_CASCADER_MANIFEST.character) {
        registry.updateAgentCharacter(agentId, EFFECT_CASCADER_MANIFEST.character);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${agentId}`);
      }
      return result;
    }

    // Register the agent
    const manifest = {
      ...EFFECT_CASCADER_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${agentId}`);

    // Set character
    if (EFFECT_CASCADER_MANIFEST.character) {
      registry.updateAgentCharacter(agentId, EFFECT_CASCADER_MANIFEST.character);
      result.characterSet = true;
      console.log(`[AgentSeeder] Set character for ${agentId}`);
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AgentSeeder] Failed to seed ${agentId}:`, error);
    return result;
  }
}

/**
 * Seed the Escalation Modeler agent.
 */
async function seedEscalationModelerAgent(): Promise<SeedResult> {
  const agentId = ESCALATION_MODELER_MANIFEST.agentId;
  const result: SeedResult = {
    agentId,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(agentId);
    if (existing) {
      console.log(`[AgentSeeder] ${agentId} already registered`);
      result.registered = true;
      if (!existing.character && ESCALATION_MODELER_MANIFEST.character) {
        registry.updateAgentCharacter(agentId, ESCALATION_MODELER_MANIFEST.character);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${agentId}`);
      }
      return result;
    }

    // Register the agent
    const manifest = {
      ...ESCALATION_MODELER_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${agentId}`);

    // Set character
    if (ESCALATION_MODELER_MANIFEST.character) {
      registry.updateAgentCharacter(agentId, ESCALATION_MODELER_MANIFEST.character);
      result.characterSet = true;
      console.log(`[AgentSeeder] Set character for ${agentId}`);
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AgentSeeder] Failed to seed ${agentId}:`, error);
    return result;
  }
}

/**
 * Seed the Deception Detector agent.
 */
async function seedDeceptionDetectorAgent(): Promise<SeedResult> {
  const agentId = DECEPTION_DETECTOR_MANIFEST.agentId;
  const result: SeedResult = {
    agentId,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    // Check if already registered
    const existing = registry.getAgent(agentId);
    if (existing) {
      console.log(`[AgentSeeder] ${agentId} already registered`);
      result.registered = true;
      if (!existing.character && DECEPTION_DETECTOR_MANIFEST.character) {
        registry.updateAgentCharacter(agentId, DECEPTION_DETECTOR_MANIFEST.character);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${agentId}`);
      }
      return result;
    }

    // Register the agent
    const manifest = {
      ...DECEPTION_DETECTOR_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${agentId}`);

    // Set character
    if (DECEPTION_DETECTOR_MANIFEST.character) {
      registry.updateAgentCharacter(agentId, DECEPTION_DETECTOR_MANIFEST.character);
      result.characterSet = true;
      console.log(`[AgentSeeder] Set character for ${agentId}`);
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AgentSeeder] Failed to seed ${agentId}:`, error);
    return result;
  }
}

// ==========================================================================
// New Agents - Deception Planner, Exploitation Analyst, De-escalation Manager
// ==========================================================================

/**
 * Seed the Deception Planner agent.
 */
async function seedDeceptionPlannerAgent(): Promise<SeedResult> {
  const agentId = DECEPTION_PLANNER_MANIFEST.agentId;
  const result: SeedResult = {
    agentId,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    const existing = registry.getAgent(agentId);
    if (existing) {
      console.log(`[AgentSeeder] ${agentId} already registered`);
      result.registered = true;
      if (!existing.character && DECEPTION_PLANNER_MANIFEST.character) {
        registry.updateAgentCharacter(agentId, DECEPTION_PLANNER_MANIFEST.character);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${agentId}`);
      }
      return result;
    }

    const manifest = {
      ...DECEPTION_PLANNER_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${agentId}`);

    if (DECEPTION_PLANNER_MANIFEST.character) {
      registry.updateAgentCharacter(agentId, DECEPTION_PLANNER_MANIFEST.character);
      result.characterSet = true;
      console.log(`[AgentSeeder] Set character for ${agentId}`);
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AgentSeeder] Failed to seed ${agentId}:`, error);
    return result;
  }
}

/**
 * Seed the Exploitation Analyst agent.
 */
async function seedExploitationAnalystAgent(): Promise<SeedResult> {
  const agentId = EXPLOITATION_ANALYST_MANIFEST.agentId;
  const result: SeedResult = {
    agentId,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    const existing = registry.getAgent(agentId);
    if (existing) {
      console.log(`[AgentSeeder] ${agentId} already registered`);
      result.registered = true;
      if (!existing.character && EXPLOITATION_ANALYST_MANIFEST.character) {
        registry.updateAgentCharacter(agentId, EXPLOITATION_ANALYST_MANIFEST.character);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${agentId}`);
      }
      return result;
    }

    const manifest = {
      ...EXPLOITATION_ANALYST_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${agentId}`);

    if (EXPLOITATION_ANALYST_MANIFEST.character) {
      registry.updateAgentCharacter(agentId, EXPLOITATION_ANALYST_MANIFEST.character);
      result.characterSet = true;
      console.log(`[AgentSeeder] Set character for ${agentId}`);
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AgentSeeder] Failed to seed ${agentId}:`, error);
    return result;
  }
}

/**
 * Seed the De-escalation Manager agent.
 */
async function seedDeescalationManagerAgent(): Promise<SeedResult> {
  const agentId = DEESCALATION_MANAGER_MANIFEST.agentId;
  const result: SeedResult = {
    agentId,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();

    const existing = registry.getAgent(agentId);
    if (existing) {
      console.log(`[AgentSeeder] ${agentId} already registered`);
      result.registered = true;
      if (!existing.character && DEESCALATION_MANAGER_MANIFEST.character) {
        registry.updateAgentCharacter(agentId, DEESCALATION_MANAGER_MANIFEST.character);
        result.characterSet = true;
        console.log(`[AgentSeeder] Updated character for ${agentId}`);
      }
      return result;
    }

    const manifest = {
      ...DEESCALATION_MANAGER_MANIFEST,
      createdAt: new Date(),
      createdBy: 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    await registry.registerAgent(manifest);
    result.registered = true;
    console.log(`[AgentSeeder] Registered ${agentId}`);

    if (DEESCALATION_MANAGER_MANIFEST.character) {
      registry.updateAgentCharacter(agentId, DEESCALATION_MANAGER_MANIFEST.character);
      result.characterSet = true;
      console.log(`[AgentSeeder] Set character for ${agentId}`);
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AgentSeeder] Failed to seed ${agentId}:`, error);
    return result;
  }
}

/**
 * Register fusion MCP tools in the tool registry.
 */
async function registerFusionTools(): Promise<void> {
  const toolRegistry = getToolRegistry();
  await toolRegistry.ensureInitialized();

  const allTools = [
    ...objectiveToolDefinitions,
    ...entityToolDefinitions,
    ...osintToolDefinitions,
    ...validityToolDefinitions,
    ...raftToolDefinitions,
  ];

  for (const toolDef of allTools) {
    try {
      // Check if already registered
      const existing = toolRegistry.getTool(toolDef.toolId);
      if (!existing) {
        await toolRegistry.registerTool(toolDef, 'system');
        console.log(`[AgentSeeder] Registered tool ${toolDef.toolId}`);
      }
    } catch (err) {
      // Tool might already exist, that's ok
      console.warn(`[AgentSeeder] Tool ${toolDef.toolId} registration skipped:`, err);
    }
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

  // Register fusion MCP tools first
  try {
    await registerFusionTools();
    console.log('[AgentSeeder] Fusion MCP tools registered');
  } catch (error) {
    console.warn('[AgentSeeder] Fusion tools registration warning:', error);
  }

  // Seed strategy reviewer
  const strategyResult = await seedStrategyReviewer();
  results.push(strategyResult);

  // Seed strategic fusion agent
  const fusionResult = await seedStrategicFusionAgent();
  results.push(fusionResult);

  // Seed entity resolution agent
  const entityResult = await seedEntityResolutionAgent();
  results.push(entityResult);

  // Seed OSINT monitor agent
  const osintResult = await seedOsintMonitorAgent();
  results.push(osintResult);

  // Seed validity assessment agent
  const validityResult = await seedValidityAssessmentAgent();
  results.push(validityResult);

  // Seed conflict detection agent
  const conflictResult = await seedConflictDetectionAgent();
  results.push(conflictResult);

  // Seed RAFT extraction agent
  const raftExtractionResult = await seedRaftExtractionAgent();
  results.push(raftExtractionResult);

  // Seed RAFT reasoning agent
  const raftReasoningResult = await seedRaftReasoningAgent();
  results.push(raftReasoningResult);

  // Seed Phase 5.1 - MDMP Governance Integration agents
  const assumptionAuditorResult = await seedAssumptionAuditorAgent();
  results.push(assumptionAuditorResult);

  const ordersValidatorResult = await seedOrdersValidatorAgent();
  results.push(ordersValidatorResult);

  const uncertaintyQuantifierResult = await seedUncertaintyQuantifierAgent();
  results.push(uncertaintyQuantifierResult);

  const dataBiasDetectorResult = await seedDataBiasDetectorAgent();
  results.push(dataBiasDetectorResult);

  const problemFramingResult = await seedProblemFramingAgent();
  results.push(problemFramingResult);

  const roeComplianceResult = await seedRoeComplianceAgent();
  results.push(roeComplianceResult);

  // Seed Phase 5.2 - Escalation & Competition Modeling agents
  const adversaryModelerResult = await seedAdversaryModelerAgent();
  results.push(adversaryModelerResult);

  const effectCascaderResult = await seedEffectCascaderAgent();
  results.push(effectCascaderResult);

  const escalationModelerResult = await seedEscalationModelerAgent();
  results.push(escalationModelerResult);

  const deceptionDetectorResult = await seedDeceptionDetectorAgent();
  results.push(deceptionDetectorResult);

  // Seed new agents - Deception Planner, Exploitation Analyst, De-escalation Manager
  const deceptionPlannerResult = await seedDeceptionPlannerAgent();
  results.push(deceptionPlannerResult);

  const exploitationAnalystResult = await seedExploitationAnalystAgent();
  results.push(exploitationAnalystResult);

  const deescalationManagerResult = await seedDeescalationManagerAgent();
  results.push(deescalationManagerResult);

  // Seed all 108 JPP staff agents from agent-library.ts
  // These are required for the validation runner (Phase 31) to invoke staff agents
  try {
    const { seedStaffAgents } = await import('./staff-agent-seeder.js');
    await seedStaffAgents();
  } catch (error) {
    console.error('[AgentSeeder] Staff agent seeding failed:', error);
  }

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
