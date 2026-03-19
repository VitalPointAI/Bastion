/**
 * StandardAgent Types
 *
 * Phase 51: Unified Agent Architecture
 * Defines the foundational StandardAgent interface that all agents are built from.
 * Extends AgentManifest with operational fields: systemPrompt, clearance, skills,
 * status, and health metrics.
 */

import type { ZodType } from 'zod';
import type { AgentManifest } from './types.js';

// ============================================================================
// Classification Level
// ============================================================================

/**
 * Classification level for information access control.
 */
export type ClassificationLevel = 'Unclassified' | 'CUI' | 'Secret' | 'TopSecret';

// ============================================================================
// Agent Skill
// ============================================================================

/**
 * A discrete capability an agent can exercise, described with Zod schemas
 * for input/output validation.
 */
export interface AgentSkill {
  /** Unique skill identifier (e.g., 'analyze-proposal') */
  skillId: string;
  /** Human-readable skill name */
  name: string;
  /** Description of what this skill does */
  description: string;
  /** Zod schema for validating skill inputs */
  inputSchema: ZodType;
  /** Zod schema for validating skill outputs */
  outputSchema: ZodType;
}

// ============================================================================
// Memory Types
// ============================================================================

/**
 * A single memory entry stored by an agent.
 * - 'knowledge': Long-term factual or doctrinal knowledge (may have embedding)
 * - 'working': Short-term task context (cleared after task completes)
 * - 'episode': Summary of a completed task or interaction
 */
export interface MemoryEntry {
  /** Unique identifier for this memory entry */
  entryId: string;
  /** Agent that owns this memory */
  agentId: string;
  /** Memory type: knowledge, working context, or episode summary */
  memoryType: 'knowledge' | 'working' | 'episode';
  /** Optional category label for grouping (e.g., 'doctrine', 'threat-intel') */
  category?: string;
  /** Text content of the memory */
  content: string;
  /** Vector embedding for semantic recall (knowledge entries only) */
  embedding?: number[];
  /** Importance score from 0 (low) to 1 (high), default 0.5 */
  importance: number;
  /** When this entry was created */
  createdAt: Date;
  /** When this entry was last retrieved */
  lastAccessed?: Date;
  /** Task ID that generated or is associated with this entry */
  taskId?: string;
}

/**
 * Summary of a completed task episode, derived from MemoryEntry (episode type).
 */
export interface EpisodeSummary {
  /** Memory entry ID */
  entryId: string;
  /** Agent that executed the task */
  agentId: string;
  /** Task that generated this episode */
  taskId: string;
  /** Natural-language summary of what happened */
  summary: string;
  /** Outcome descriptor (e.g., 'success', 'partial', 'failed') */
  outcome: string;
  /** When the episode completed */
  timestamp: Date;
}

// ============================================================================
// StandardAgent
// ============================================================================

/**
 * StandardAgent extends AgentManifest with operational runtime fields.
 *
 * Every agent in the system is represented as a StandardAgent. The manifest
 * fields (id, name, capabilities, etc.) come from the existing AgentManifest
 * interface. This extension adds:
 *   - systemPrompt: LLM instruction context
 *   - clearance: maximum classification level accessible
 *   - skills: discrete validated capabilities
 *   - status: operational health state
 *   - health metrics: invocation stats for monitoring
 */
export interface StandardAgent extends AgentManifest {
  /** System prompt provided to the LLM for this agent's context */
  systemPrompt: string;
  /** Highest classification level this agent may access */
  clearance: ClassificationLevel;
  /** Discrete skills (validated capabilities) this agent can exercise */
  skills: AgentSkill[];
  /** Operational status */
  status: 'active' | 'inactive' | 'degraded' | 'error';
  /** When the agent was last activated */
  activatedAt?: Date;
  /** When the agent was deactivated (if inactive) */
  deactivatedAt?: Date;
  /** Timestamp of the most recent invocation */
  lastInvocation?: Date;
  /** Rolling success rate (0 to 1) over recent invocations */
  successRate?: number;
  /** Average response time in milliseconds over recent invocations */
  avgResponseTimeMs?: number;
  /** Validation quality score (0 to 1) from output validators */
  validationScore?: number;
  /** Avatar URL — auto-generated SVG data URI if not set */
  avatarUrl?: string;
}

// ============================================================================
// Helper: toStandardAgent
// ============================================================================

/**
 * Convert an existing AgentManifest into a StandardAgent.
 *
 * Applies sensible defaults for all new fields so legacy manifests can be
 * used anywhere a StandardAgent is expected.
 *
 * @param manifest - Existing agent manifest (from registry)
 * @param extras   - Optional overrides for any StandardAgent field
 * @returns Fully-formed StandardAgent
 *
 * @example
 * const agent = toStandardAgent(manifest, { systemPrompt: 'You are ...' });
 */
export function toStandardAgent(
  manifest: AgentManifest,
  extras?: Partial<StandardAgent>
): StandardAgent {
  const base: StandardAgent = {
    ...manifest,
    systemPrompt: '',
    clearance: 'Unclassified',
    skills: [],
    status: manifest.active ? 'active' : 'inactive',
  };

  if (extras) {
    return { ...base, ...extras };
  }

  return base;
}
