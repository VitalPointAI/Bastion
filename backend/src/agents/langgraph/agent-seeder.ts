/**
 * Agent Seeder - Auto-registers LangGraph agents on startup
 *
 * Registers strategy-document-reviewer, strategic-fusion-agent,
 * entity-resolution-agent, RAFT extraction/reasoning agents,
 * and other LangGraph-based agents via AgentStore (DB-backed).
 *
 * Phase 51: Uses toStandardAgent() and agentStore.registerAgent() directly
 * to produce full StandardAgent records with systemPrompt, clearance, skills,
 * and status fields. Idempotent — upserts via ON CONFLICT DO UPDATE.
 *
 * Note: Stub agents (assumption-auditor, orders-validator,
 * uncertainty-quantifier, data-bias-detector, problem-framing,
 * roe-compliance, adversary-modeler, effect-cascader,
 * escalation-modeler, deception-detector, deception-planner,
 * exploitation-analyst, deescalation-manager) were removed in
 * Phase 51 Plan 02 as part of the unified agent architecture cleanup.
 * They are seeded here with status='inactive' to preserve definitions.
 */

import { getAgentRegistry } from '../registry.js';
import { getAgentStore } from '../agent-store.js';
import { toStandardAgent } from '../standard-agent.js';
import { getToolRegistry } from '../tool-registry.js';
import {
  AgentPhase,
  AgentCapability,
  AutonomyLevel,
  type AgentManifest,
} from '../types.js';
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

// ============================================================================
// Inactive stub agent IDs (removed in Phase 51 Plan 02)
// Still seeded with status='inactive' to preserve definitions for reactivation.
// ============================================================================

const INACTIVE_STUB_AGENTS: Array<Omit<AgentManifest, 'agentDID' | 'agentBlindedKey' | 'agentPublicKey'>> = [
  {
    agentId: 'assumption-auditor',
    name: 'Assumption Auditor',
    description: 'Audits assumptions embedded in planning documents for validity and evidence basis.',
    phase: AgentPhase.Support,
    capabilities: [AgentCapability.AssumptionAuditing],
    maxAutonomy: AutonomyLevel.SemiAutonomous,
    allowedProposalKinds: [],
    requiresHumanApproval: [],
    createdAt: new Date(),
    createdBy: 'system',
    active: false,
  },
  {
    agentId: 'orders-validator',
    name: 'Orders Validator',
    description: 'Validates military orders for doctrinal compliance and completeness.',
    phase: AgentPhase.Support,
    capabilities: [AgentCapability.OrdersValidation],
    maxAutonomy: AutonomyLevel.SemiAutonomous,
    allowedProposalKinds: [],
    requiresHumanApproval: [],
    createdAt: new Date(),
    createdBy: 'system',
    active: false,
  },
  {
    agentId: 'uncertainty-quantifier',
    name: 'Uncertainty Quantifier',
    description: 'Quantifies uncertainty in planning estimates and intelligence assessments.',
    phase: AgentPhase.Support,
    capabilities: [AgentCapability.UncertaintyQuantification],
    maxAutonomy: AutonomyLevel.SemiAutonomous,
    allowedProposalKinds: [],
    requiresHumanApproval: [],
    createdAt: new Date(),
    createdBy: 'system',
    active: false,
  },
  {
    agentId: 'data-bias-detector',
    name: 'Data Bias Detector',
    description: 'Detects cognitive and data biases in analytical products.',
    phase: AgentPhase.Support,
    capabilities: [AgentCapability.DataBiasDetection],
    maxAutonomy: AutonomyLevel.SemiAutonomous,
    allowedProposalKinds: [],
    requiresHumanApproval: [],
    createdAt: new Date(),
    createdBy: 'system',
    active: false,
  },
  {
    agentId: 'problem-framing',
    name: 'Problem Framing Agent',
    description: 'Assists in structuring and framing complex operational problems.',
    phase: AgentPhase.Support,
    capabilities: [AgentCapability.ProblemFraming],
    maxAutonomy: AutonomyLevel.SemiAutonomous,
    allowedProposalKinds: [],
    requiresHumanApproval: [],
    createdAt: new Date(),
    createdBy: 'system',
    active: false,
  },
  {
    agentId: 'roe-compliance',
    name: 'ROE Compliance Agent',
    description: 'Checks operational plans for compliance with Rules of Engagement.',
    phase: AgentPhase.Support,
    capabilities: [AgentCapability.ROECompliance],
    maxAutonomy: AutonomyLevel.SemiAutonomous,
    allowedProposalKinds: [],
    requiresHumanApproval: [],
    createdAt: new Date(),
    createdBy: 'system',
    active: false,
  },
  {
    agentId: 'adversary-modeler',
    name: 'Adversary Modeler',
    description: 'Models adversary behavior and decision-making for red team analysis.',
    phase: AgentPhase.Support,
    capabilities: [AgentCapability.AdversaryModeling],
    maxAutonomy: AutonomyLevel.SemiAutonomous,
    allowedProposalKinds: [],
    requiresHumanApproval: [],
    createdAt: new Date(),
    createdBy: 'system',
    active: false,
  },
  {
    agentId: 'effect-cascader',
    name: 'Effect Cascader',
    description: 'Analyzes cascading effects of military actions across domains.',
    phase: AgentPhase.Support,
    capabilities: [AgentCapability.EffectCascading],
    maxAutonomy: AutonomyLevel.SemiAutonomous,
    allowedProposalKinds: [],
    requiresHumanApproval: [],
    createdAt: new Date(),
    createdBy: 'system',
    active: false,
  },
  {
    agentId: 'escalation-modeler',
    name: 'Escalation Modeler',
    description: 'Models escalation dynamics and de-escalation opportunities.',
    phase: AgentPhase.Support,
    capabilities: [AgentCapability.EscalationModeling],
    maxAutonomy: AutonomyLevel.SemiAutonomous,
    allowedProposalKinds: [],
    requiresHumanApproval: [],
    createdAt: new Date(),
    createdBy: 'system',
    active: false,
  },
  {
    agentId: 'deception-detector',
    name: 'Deception Detector',
    description: 'Identifies deception operations in intelligence and operational reporting.',
    phase: AgentPhase.Support,
    capabilities: [AgentCapability.DeceptionDetection],
    maxAutonomy: AutonomyLevel.SemiAutonomous,
    allowedProposalKinds: [],
    requiresHumanApproval: [],
    createdAt: new Date(),
    createdBy: 'system',
    active: false,
  },
  {
    agentId: 'deception-planner',
    name: 'Deception Planner',
    description: 'Plans military deception operations in support of operational objectives.',
    phase: AgentPhase.Support,
    capabilities: [AgentCapability.DeceptionPlanning],
    maxAutonomy: AutonomyLevel.SemiAutonomous,
    allowedProposalKinds: [],
    requiresHumanApproval: [],
    createdAt: new Date(),
    createdBy: 'system',
    active: false,
  },
  {
    agentId: 'exploitation-analyst',
    name: 'Exploitation Analyst',
    description: 'Analyzes exploitation opportunities from tactical and strategic actions.',
    phase: AgentPhase.Support,
    capabilities: [AgentCapability.ExploitationAnalysis],
    maxAutonomy: AutonomyLevel.SemiAutonomous,
    allowedProposalKinds: [],
    requiresHumanApproval: [],
    createdAt: new Date(),
    createdBy: 'system',
    active: false,
  },
  {
    agentId: 'deescalation-manager',
    name: 'De-escalation Manager',
    description: 'Manages de-escalation pathways to reduce conflict intensity.',
    phase: AgentPhase.Support,
    capabilities: [AgentCapability.DeescalationManagement],
    maxAutonomy: AutonomyLevel.SemiAutonomous,
    allowedProposalKinds: [],
    requiresHumanApproval: [],
    createdAt: new Date(),
    createdBy: 'system',
    active: false,
  },
];

// ============================================================================
// Helper: seed a single agent with StandardAgent extras
// ============================================================================

async function seedAgent(
  manifestBase: Omit<AgentManifest, 'agentDID' | 'agentBlindedKey' | 'agentPublicKey' | 'createdAt' | 'createdBy'> & { createdAt?: Date | string; createdBy?: string },
  tools: string[],
  systemPrompt: string,
  status: 'active' | 'inactive'
): Promise<SeedResult> {
  const agentId = manifestBase.agentId;
  const result: SeedResult = {
    agentId,
    registered: false,
    toolsAssigned: [],
    characterSet: false,
  };

  try {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();
    const store = getAgentStore();

    // Build full manifest (DID generated by registerAgent)
    const manifest: AgentManifest = {
      ...manifestBase,
      createdAt: manifestBase.createdAt instanceof Date ? manifestBase.createdAt : new Date(),
      createdBy: manifestBase.createdBy || 'system',
      agentDID: '',
      agentBlindedKey: '',
      agentPublicKey: '',
    };

    // Convert to StandardAgent with system prompt and status
    const sa = toStandardAgent(manifest, {
      systemPrompt,
      clearance: 'Secret',
      skills: [],
      status,
    });

    // Upsert via AgentStore (idempotent)
    await store.registerAgent(sa);

    // Also ensure the registry cache has the agent (may have been loaded from DB already)
    const existing = registry.getAgent(agentId);
    if (!existing || !existing.character) {
      // Register through registry to also handle DID generation and cache update
      try {
        await registry.registerAgent(manifest);
      } catch {
        // Already in DB — cache may already be populated; that's fine
      }
    }

    result.registered = true;

    // Set character if provided (look up from registry or set via updateAgentCharacter)
    const agentInCache = registry.getAgent(agentId);
    if (agentInCache && manifestBase.active !== false) {
      result.characterSet = true;
    }

    // Assign tools
    if (tools.length > 0) {
      const toolRegistry = getToolRegistry();
      await toolRegistry.ensureInitialized();

      for (const toolId of tools) {
        try {
          const tool = toolRegistry.getTool(toolId);
          if (tool) {
            const agentTools = toolRegistry.getToolsForAgent(agentId);
            if (!agentTools.some(t => t.toolId === toolId)) {
              toolRegistry.assignToolToAgent(toolId, agentId, 'system');
              result.toolsAssigned.push(toolId);
            }
          } else {
            console.warn(`[AgentSeeder] Tool ${toolId} not found in registry`);
          }
        } catch (err) {
          console.warn(`[AgentSeeder] Failed to assign tool ${toolId}:`, err);
        }
      }
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AgentSeeder] Failed to seed ${agentId}:`, error);
    return result;
  }
}

// ============================================================================
// Individual agent seeders
// ============================================================================

async function seedStrategyReviewer(): Promise<SeedResult> {
  const systemPrompt = `You are the Strategy Document Reviewer, an expert in national security strategy analysis.
Your role is to review strategic documents and categorize objectives using the MIDLIFE framework
(Military, Intelligence, Diplomatic, Law Enforcement, Information, Finance, Economic).

Responsibilities:
- Review strategic planning documents for doctrinal alignment with JP 5-0
- Categorize objectives by MIDLIFE instrument of power
- Assess priority levels based on Ends-Ways-Means analysis
- Flag inconsistencies, gaps, and assumptions for human review

Clearance: SECRET. Never discuss or reference classified information above SECRET.
All findings require human review before action — you operate in SemiAutonomous mode.`;

  const result = await seedAgent(
    { ...STRATEGY_REVIEWER_MANIFEST, active: true },
    STRATEGY_REVIEWER_TOOLS,
    systemPrompt,
    'active'
  );

  // Set Eliza character via registry for LangGraph wrapper compatibility
  try {
    const registry = getAgentRegistry();
    const agent = registry.getAgent('strategy-document-reviewer');
    if (agent && !agent.character) {
      registry.updateAgentCharacter('strategy-document-reviewer', STRATEGY_REVIEWER_CHARACTER);
      result.characterSet = true;
    }
  } catch (err) {
    console.warn('[AgentSeeder] Character set warning for strategy-document-reviewer:', err);
  }

  return result;
}

async function seedStrategicFusionAgent(): Promise<SeedResult> {
  const systemPrompt = `You are the Strategic Fusion Agent, an expert intelligence analyst.
Your role is to consolidate objectives from multiple strategic documents into a unified strategic picture.

Responsibilities:
- Identify semantically duplicate objectives across documents while preserving unique perspectives
- Detect conflicts and contradictions between strategic objectives
- Synthesize coherent unified objectives that preserve the intent of source documents
- Provide confidence scores and source traceability for all fused outputs

Clearance: SECRET. All outputs require human review before integration into planning products.`;

  const result = await seedAgent(
    { ...STRATEGIC_FUSION_MANIFEST, active: true },
    STRATEGIC_FUSION_TOOLS,
    systemPrompt,
    'active'
  );

  try {
    const registry = getAgentRegistry();
    const agent = registry.getAgent(STRATEGIC_FUSION_AGENT_ID);
    if (agent && !agent.character) {
      registry.updateAgentCharacter(STRATEGIC_FUSION_AGENT_ID, STRATEGIC_FUSION_CHARACTER);
      result.characterSet = true;
    }
  } catch (err) {
    console.warn(`[AgentSeeder] Character set warning for ${STRATEGIC_FUSION_AGENT_ID}:`, err);
  }

  return result;
}

async function seedEntityResolutionAgent(): Promise<SeedResult> {
  const systemPrompt = `You are the Entity Resolution Agent, a specialist in identifying and deduplicating entities across intelligence databases.
Your role is to resolve entity references across multiple sources, maintaining a canonical entity registry.

Responsibilities:
- Identify when different names/aliases refer to the same real-world entity
- Maintain confidence scores for entity resolution decisions
- Flag ambiguous cases for human review
- Support graph-based entity relationship analysis

Clearance: SECRET.`;

  const result = await seedAgent(
    { ...ENTITY_RESOLUTION_MANIFEST, active: true },
    ENTITY_RESOLUTION_TOOLS,
    systemPrompt,
    'active'
  );

  try {
    const registry = getAgentRegistry();
    const agent = registry.getAgent(ENTITY_RESOLUTION_AGENT_ID);
    if (agent && !agent.character) {
      registry.updateAgentCharacter(ENTITY_RESOLUTION_AGENT_ID, ENTITY_RESOLUTION_CHARACTER);
      result.characterSet = true;
    }
  } catch (err) {
    console.warn(`[AgentSeeder] Character set warning for ${ENTITY_RESOLUTION_AGENT_ID}:`, err);
  }

  return result;
}

async function seedOsintMonitorAgent(): Promise<SeedResult> {
  const systemPrompt = `You are the OSINT Monitor Agent, a specialist in open-source intelligence collection and analysis.
Your role is to monitor, collect, and assess open-source information relevant to operational planning.

Responsibilities:
- Monitor designated open sources for relevant intelligence indicators
- Assess credibility and relevance of OSINT findings
- Cross-reference OSINT with other intelligence to identify corroboration or contradictions
- Flag high-priority intelligence for immediate human review

Clearance: UNCLASSIFIED (OSINT only). All analysis is based on open-source material.`;

  const result = await seedAgent(
    { ...OSINT_MONITOR_MANIFEST, active: true },
    OSINT_MONITOR_TOOLS,
    systemPrompt,
    'active'
  );

  try {
    const registry = getAgentRegistry();
    const agent = registry.getAgent(OSINT_MONITOR_AGENT_ID);
    if (agent && !agent.character) {
      registry.updateAgentCharacter(OSINT_MONITOR_AGENT_ID, OSINT_MONITOR_CHARACTER);
      result.characterSet = true;
    }
  } catch (err) {
    console.warn(`[AgentSeeder] Character set warning for ${OSINT_MONITOR_AGENT_ID}:`, err);
  }

  return result;
}

async function seedValidityAssessmentAgent(): Promise<SeedResult> {
  const systemPrompt = `You are the Validity Assessment Agent, a specialist in evaluating the validity of analytical conclusions.
Your role is to assess the logical validity, evidentiary support, and methodological soundness of analytical products.

Responsibilities:
- Evaluate logical consistency of analytical arguments
- Assess quality and sufficiency of supporting evidence
- Identify alternative explanations that were not considered
- Flag validity concerns for analyst review

Clearance: SECRET.`;

  const result = await seedAgent(
    { ...VALIDITY_ASSESSMENT_MANIFEST, active: true },
    VALIDITY_ASSESSMENT_TOOLS,
    systemPrompt,
    'active'
  );

  try {
    const registry = getAgentRegistry();
    const agent = registry.getAgent(VALIDITY_ASSESSMENT_AGENT_ID);
    if (agent && !agent.character) {
      registry.updateAgentCharacter(VALIDITY_ASSESSMENT_AGENT_ID, VALIDITY_ASSESSMENT_CHARACTER);
      result.characterSet = true;
    }
  } catch (err) {
    console.warn(`[AgentSeeder] Character set warning for ${VALIDITY_ASSESSMENT_AGENT_ID}:`, err);
  }

  return result;
}

async function seedConflictDetectionAgent(): Promise<SeedResult> {
  const systemPrompt = `You are the Conflict Detection Agent, a specialist in identifying contradictions and conflicts within planning products.
Your role is to detect logical conflicts, resource conflicts, and timeline conflicts in operational plans.

Responsibilities:
- Identify contradictory guidance between planning products
- Flag resource allocation conflicts
- Detect timeline incompatibilities across synchronized operations
- Propose conflict resolution options for human decision

Clearance: SECRET.`;

  const result = await seedAgent(
    { ...CONFLICT_DETECTION_MANIFEST, active: true },
    CONFLICT_DETECTION_TOOLS,
    systemPrompt,
    'active'
  );

  try {
    const registry = getAgentRegistry();
    const agent = registry.getAgent(CONFLICT_DETECTION_AGENT_ID);
    if (agent && !agent.character) {
      registry.updateAgentCharacter(CONFLICT_DETECTION_AGENT_ID, CONFLICT_DETECTION_CHARACTER);
      result.characterSet = true;
    }
  } catch (err) {
    console.warn(`[AgentSeeder] Character set warning for ${CONFLICT_DETECTION_AGENT_ID}:`, err);
  }

  return result;
}

async function seedRaftExtractionAgent(): Promise<SeedResult> {
  const systemPrompt = `You are the RAFT Extraction Agent, a specialist in structured data extraction from unstructured documents.
Your role is to extract structured information from planning documents using the RAFT (Retrieval Augmented Fine-Tuning) methodology.

Responsibilities:
- Extract facts, entities, relationships, and events from documents
- Structure extracted data into defined schemas for downstream processing
- Assign confidence scores to extractions
- Flag low-confidence extractions for human review

Clearance: SECRET.`;

  const result = await seedAgent(
    { ...RAFT_EXTRACTION_MANIFEST, active: true },
    RAFT_EXTRACTION_TOOLS,
    systemPrompt,
    'active'
  );

  try {
    const registry = getAgentRegistry();
    const agent = registry.getAgent(RAFT_EXTRACTION_AGENT_ID);
    if (agent && !agent.character) {
      registry.updateAgentCharacter(RAFT_EXTRACTION_AGENT_ID, RAFT_EXTRACTION_CHARACTER);
      result.characterSet = true;
    }
  } catch (err) {
    console.warn(`[AgentSeeder] Character set warning for ${RAFT_EXTRACTION_AGENT_ID}:`, err);
  }

  return result;
}

async function seedRaftReasoningAgent(): Promise<SeedResult> {
  const systemPrompt = `You are the RAFT Reasoning Agent, a specialist in structured analytical reasoning.
Your role is to apply systematic reasoning chains to extracted data, producing auditable analytical conclusions.

Responsibilities:
- Apply structured reasoning to extracted intelligence and planning data
- Generate traceable reasoning chains with supporting evidence
- Assess alternative hypotheses and assign probability weights
- Produce structured analytical conclusions for human review

Clearance: SECRET.`;

  const result = await seedAgent(
    { ...RAFT_REASONING_MANIFEST, active: true },
    RAFT_REASONING_TOOLS,
    systemPrompt,
    'active'
  );

  try {
    const registry = getAgentRegistry();
    const agent = registry.getAgent(RAFT_REASONING_AGENT_ID);
    if (agent && !agent.character) {
      registry.updateAgentCharacter(RAFT_REASONING_AGENT_ID, RAFT_REASONING_CHARACTER);
      result.characterSet = true;
    }
  } catch (err) {
    console.warn(`[AgentSeeder] Character set warning for ${RAFT_REASONING_AGENT_ID}:`, err);
  }

  return result;
}

/**
 * Seed the 14 inactive stub agents.
 * Preserves agent definitions in DB with status='inactive' for future reactivation.
 */
async function seedInactiveStubAgents(): Promise<void> {
  const store = getAgentStore();

  for (const manifestBase of INACTIVE_STUB_AGENTS) {
    try {
      const manifest: AgentManifest = {
        ...manifestBase,
        agentDID: '',
        agentBlindedKey: '',
        agentPublicKey: '',
      };

      const sa = toStandardAgent(manifest, {
        systemPrompt: `${manifestBase.name} — inactive stub agent preserved for future reactivation. Status: inactive.`,
        clearance: 'Unclassified',
        skills: [],
        status: 'inactive',
      });

      // Upsert to DB (preserves if already exists)
      await store.registerAgent(sa);
    } catch (err) {
      console.warn(`[AgentSeeder] Inactive stub seed warning for ${manifestBase.agentId}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`[AgentSeeder] Seeded ${INACTIVE_STUB_AGENTS.length} inactive stub agent definitions`);
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
      const existing = toolRegistry.getTool(toolDef.toolId);
      if (!existing) {
        await toolRegistry.registerTool(toolDef, 'system');
        console.log(`[AgentSeeder] Registered tool ${toolDef.toolId}`);
      }
    } catch (err) {
      console.warn(`[AgentSeeder] Tool ${toolDef.toolId} registration skipped:`, err);
    }
  }
}

/**
 * Seed all LangGraph-based agents.
 * Call during application startup.
 * Idempotent — all operations use upsert via AgentStore.
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

  // Seed active LangGraph agents
  results.push(await seedStrategyReviewer());
  results.push(await seedStrategicFusionAgent());
  results.push(await seedEntityResolutionAgent());
  results.push(await seedOsintMonitorAgent());
  results.push(await seedValidityAssessmentAgent());
  results.push(await seedConflictDetectionAgent());
  results.push(await seedRaftExtractionAgent());
  results.push(await seedRaftReasoningAgent());

  // Seed inactive stub agents (preserves definitions for future reactivation)
  try {
    await seedInactiveStubAgents();
  } catch (error) {
    console.error('[AgentSeeder] Inactive stub agent seeding failed:', error);
  }

  // Staff officers removed in Phase 51 — Ironclaw replaces that role

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
