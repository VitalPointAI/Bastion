/**
 * System Prompt Generator
 *
 * Generates system prompts for LangGraph agents based on:
 * - Character definitions (bio, lore, style)
 * - Agent capabilities
 * - Phase/role in the workflow
 * - Assigned tools
 */

import { getAgentRegistry } from '../registry.js';
import { getToolRegistry } from '../tool-registry.js';
import { AgentCapability, AgentPhase, type AgentCharacter } from '../types.js';

/**
 * Options for prompt generation.
 */
export interface PromptGenerationOptions {
  /** Include tool descriptions in prompt */
  includeTools?: boolean;
  /** Include constraints section */
  includeConstraints?: boolean;
  /** Custom preamble to prepend */
  customPreamble?: string;
  /** Custom suffix to append */
  customSuffix?: string;
}

/**
 * Generated prompt result.
 */
export interface GeneratedPrompt {
  systemPrompt: string;
  characterName: string;
  phase: string;
  capabilities: AgentCapability[];
  toolCount: number;
}

/**
 * Default prompt generation options.
 */
const DEFAULT_OPTIONS: Required<PromptGenerationOptions> = {
  includeTools: true,
  includeConstraints: true,
  customPreamble: '',
  customSuffix: '',
};

/**
 * Generate a system prompt for an agent based on its character definition.
 *
 * @param agentId - The agent's unique identifier
 * @param options - Generation options
 * @returns Generated system prompt with metadata
 */
export async function generateSystemPromptForAgent(
  agentId: string,
  options: PromptGenerationOptions = {}
): Promise<GeneratedPrompt> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Get agent from registry
  const agentRegistry = getAgentRegistry();
  await agentRegistry.ensureInitialized();

  const agent = agentRegistry.getAgent(agentId);
  if (!agent) {
    throw new Error(`Agent ${agentId} not found`);
  }

  // Get character (may be undefined)
  const character = agent.character;

  // Get assigned tools
  const toolRegistry = getToolRegistry();
  await toolRegistry.ensureInitialized();
  const tools = toolRegistry.getToolsForAgent(agentId);

  // Build prompt
  const prompt = buildPrompt({
    agentId,
    name: agent.name,
    description: agent.description,
    phase: agent.phase,
    capabilities: agent.capabilities,
    character,
    tools: opts.includeTools ? tools : [],
    includeConstraints: opts.includeConstraints,
    customPreamble: opts.customPreamble,
    customSuffix: opts.customSuffix,
  });

  return {
    systemPrompt: prompt,
    characterName: character?.name || agent.name,
    phase: agent.phase,
    capabilities: agent.capabilities,
    toolCount: tools.length,
  };
}

/**
 * Build a system prompt from components.
 */
interface BuildPromptParams {
  agentId: string;
  name: string;
  description: string;
  phase: AgentPhase;
  capabilities: AgentCapability[];
  character?: AgentCharacter;
  tools: Array<{ toolId: string; name: string; description: string }>;
  includeConstraints: boolean;
  customPreamble: string;
  customSuffix: string;
}

function buildPrompt(params: BuildPromptParams): string {
  const {
    name,
    description,
    phase,
    capabilities,
    character,
    tools,
    includeConstraints,
    customPreamble,
    customSuffix,
  } = params;

  const sections: string[] = [];

  // Custom preamble
  if (customPreamble) {
    sections.push(customPreamble);
  }

  // Identity section
  const displayName = character?.name || name;
  sections.push(`You are ${displayName}, an AI agent operating in the ${getPhaseDescription(phase)} phase.`);

  // Description
  sections.push(`\n${description}`);

  // Character bio (background)
  if (character?.bio && character.bio.length > 0) {
    sections.push(`\n## Background\n${character.bio.join('\n')}`);
  }

  // Character lore (additional context)
  if (character?.lore && character.lore.length > 0) {
    sections.push(
      `\n## Context\n${formatList(character.lore.slice(0, 5))}`
    );
  }

  // Knowledge
  if (character?.knowledge && character.knowledge.length > 0) {
    sections.push(
      `\n## Knowledge Base\n${formatList(character.knowledge.slice(0, 5))}`
    );
  }

  // Topics of interest
  if (character?.topics && character.topics.length > 0) {
    sections.push(
      `\n## Focus Areas\nPrioritize discussions and analysis related to:\n${formatList(character.topics)}`
    );
  }

  // Communication style
  if (character?.style?.all && character.style.all.length > 0) {
    sections.push(`\n## Communication Style\n${formatList(character.style.all)}`);
  }

  // Capabilities
  if (capabilities.length > 0) {
    const capabilityDescriptions = capabilities.map(formatCapability);
    sections.push(
      `\n## Capabilities\nYou are capable of:\n${formatList(capabilityDescriptions)}`
    );
  }

  // Available tools
  if (tools.length > 0) {
    const toolDescriptions = tools.map(t => `**${t.name}**: ${t.description}`);
    sections.push(
      `\n## Available Tools\nYou have access to the following tools:\n${formatList(toolDescriptions)}`
    );
  }

  // Constraints
  if (includeConstraints) {
    const constraints = getDefaultConstraints(phase);
    if (constraints.length > 0) {
      sections.push(
        `\n## Constraints\nYou must adhere to these guidelines:\n${formatList(constraints)}`
      );
    }
  }

  // Adjectives (style hints)
  if (character?.adjectives && character.adjectives.length > 0) {
    sections.push(
      `\n## Style\nYour outputs should be: ${character.adjectives.join(', ')}.`
    );
  }

  // Standard closing
  sections.push(
    '\n---\n\nAlways maintain professional standards. Be accurate, thorough, and aligned with organizational objectives. ' +
    'If uncertain about something, acknowledge the uncertainty and explain your reasoning.'
  );

  // Custom suffix
  if (customSuffix) {
    sections.push(`\n${customSuffix}`);
  }

  return sections.join('\n');
}

/**
 * Format a list of items as markdown bullets.
 */
function formatList(items: string[]): string {
  return items.map(item => `- ${item}`).join('\n');
}

/**
 * Get human-readable phase description.
 */
function getPhaseDescription(phase: AgentPhase): string {
  const descriptions: Record<AgentPhase, string> = {
    [AgentPhase.Support]: 'support and assistance',
    [AgentPhase.Represent]: 'representation and delegation',
    [AgentPhase.Organize]: 'coordination and leadership',
  };
  return descriptions[phase] || phase;
}

/**
 * Format a capability as a human-readable description.
 */
function formatCapability(cap: AgentCapability): string {
  const descriptions: Record<AgentCapability, string> = {
    [AgentCapability.ProposalSummary]: 'Summarizing proposals for review',
    [AgentCapability.ProposalScreening]: 'Screening proposals for issues',
    [AgentCapability.ContextAnalysis]: 'Analyzing context and information',
    [AgentCapability.FeasibilityAssessment]: 'Assessing feasibility',
    [AgentCapability.SecurityMonitoring]: 'Monitoring security concerns',
    [AgentCapability.VotingGuidance]: 'Providing voting guidance',
    [AgentCapability.PreferenceModeling]: 'Modeling preferences',
    [AgentCapability.DelegatedVoting]: 'Casting delegated votes',
    [AgentCapability.ConsensusBuilding]: 'Building consensus',
    [AgentCapability.CommitteeCoordination]: 'Coordinating committees',
    // MDMP Agent Capabilities (Phase 5.1)
    [AgentCapability.AssumptionAuditing]: 'Surfacing, classifying, and tracking planning assumptions',
    [AgentCapability.DataBiasDetection]: 'Detecting statistical bias, data staleness, and coverage gaps',
    [AgentCapability.OrdersValidation]: 'Validating orders format, consistency, and intent traceability',
    [AgentCapability.ProblemFraming]: 'Generating alternative problem framings from multiple perspectives',
    [AgentCapability.ROECompliance]: 'Parsing ROE, mapping authorities to tasks, and validating compliance',
    [AgentCapability.UncertaintyQuantification]: 'Producing calibrated confidence intervals and detecting false precision',
    // Phase 5.2 Agent Capabilities (Escalation & Competition Modeling)
    [AgentCapability.AdversaryModeling]: 'Synthesizing adversary capability models and generating MLCOA/MDCOA',
    [AgentCapability.EffectCascading]: 'Modeling cascading effects across operational domains',
    [AgentCapability.EscalationModeling]: 'Modeling escalation dynamics and thresholds',
    [AgentCapability.DeceptionDetection]: 'Detecting potential deception in adversary actions and intelligence',
    // New Agent Capabilities (Deception, Exploitation, De-escalation)
    [AgentCapability.DeceptionPlanning]: 'Planning military deception operations (MILDEC) per JP 3-13.4',
    [AgentCapability.ExploitationAnalysis]: 'Identifying and recommending exploitation of opportunities and vulnerabilities',
    [AgentCapability.DeescalationManagement]: 'Analyzing and recommending de-escalation pathways and tension reduction',
  };
  return descriptions[cap] || cap;
}

/**
 * Get default constraints based on phase.
 */
function getDefaultConstraints(phase: AgentPhase): string[] {
  const baseConstraints = [
    'Never fabricate information or sources',
    'Clearly distinguish between facts and analysis',
    'Acknowledge limitations and uncertainties',
    'Protect sensitive information appropriately',
  ];

  const phaseConstraints: Record<AgentPhase, string[]> = {
    [AgentPhase.Support]: [
      'Provide recommendations, never make final decisions',
      'Clearly explain reasoning behind suggestions',
      'Flag when human review is recommended',
    ],
    [AgentPhase.Represent]: [
      'Act within delegated authority bounds',
      'Document all actions taken on behalf of delegator',
      'Escalate when uncertain about delegator preferences',
    ],
    [AgentPhase.Organize]: [
      'Coordinate activities transparently',
      'Ensure fair representation of all stakeholders',
      'Document decision rationale thoroughly',
    ],
  };

  return [...baseConstraints, ...(phaseConstraints[phase] || [])];
}

/**
 * Input for generating a prompt from a character definition.
 * Simplified version for preview without full agent context.
 */
export interface SimpleCharacter {
  name: string;
  personality?: string[];
  expertise?: string[];
  communication_style?: string;
  background?: string;
  goals?: string[];
  constraints?: string[];
}

/**
 * Generate a simple prompt from a character definition directly.
 * Used for preview without a full agent context.
 */
export function generatePromptFromCharacter(
  character: SimpleCharacter,
  capabilities: string[] = [],
  phase: string = 'Support'
): string {
  const sections: string[] = [];

  // Identity
  sections.push(`You are ${character.name}, an AI agent in the ${phase} phase of operations.`);

  // Background
  if (character.background) {
    sections.push(`\n## Background\n${character.background}`);
  }

  // Personality
  if (character.personality && character.personality.length > 0) {
    sections.push(
      `\n## Personality Traits\n${formatList(character.personality)}`
    );
  }

  // Expertise
  if (character.expertise && character.expertise.length > 0) {
    sections.push(
      `\n## Areas of Expertise\n${formatList(character.expertise)}`
    );
  }

  // Communication style
  if (character.communication_style) {
    sections.push(`\n## Communication Style\n${character.communication_style}`);
  }

  // Capabilities
  if (capabilities.length > 0) {
    const capabilityList = capabilities.map(c =>
      c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase())
    );
    sections.push(
      `\n## Capabilities\n${formatList(capabilityList)}`
    );
  }

  // Goals
  if (character.goals && character.goals.length > 0) {
    sections.push(
      `\n## Primary Goals\n${formatList(character.goals)}`
    );
  }

  // Constraints
  if (character.constraints && character.constraints.length > 0) {
    sections.push(
      `\n## Operational Constraints\n${formatList(character.constraints)}`
    );
  }

  // Closing
  sections.push(
    '\n---\n\nAlways maintain professional standards and ensure your outputs are accurate, ' +
    'well-reasoned, and aligned with organizational objectives.'
  );

  return sections.join('\n');
}
