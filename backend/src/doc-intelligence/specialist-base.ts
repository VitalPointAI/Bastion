/**
 * Specialist Base Class
 *
 * Abstract base for all document intelligence specialist agents.
 * Wraps LangGraphAgentWrapper to provide common patterns:
 * - Zod output validation via safeParse
 * - Progress reporting for SSE streaming
 * - Problem set context injection into system prompts
 * - LangGraph node creation for StateGraph registration
 */

import type { ZodType } from 'zod';
import { LangGraphAgentWrapper } from '../orchestration/agent-wrapper.js';
import type { AgentManifest, MCPTool } from '../agents/types.js';
import { AgentPhase, AgentCapability } from '../agents/types.js';
import { AutonomyLevel } from '../dao/types.js';
import type { ClassificationLevel } from '../orchestration/state.js';
import type { BastionState } from '../orchestration/state.js';
import type { SpecialistId } from './types.js';
import type { ProblemSetContext } from './schemas.js';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for creating a specialist agent.
 */
export interface SpecialistConfig {
  specialistId: SpecialistId;
  name: string;
  description: string;
  systemPrompt: string;
  tools: MCPTool[];
  clearance: ClassificationLevel;
}

// ============================================================================
// Specialist Base Class
// ============================================================================

/**
 * Abstract base class for document intelligence specialist agents.
 *
 * Subclasses MUST implement `getSystemPrompt()` to inject problem set
 * context into agent prompts. The base class handles LangGraph node
 * creation, output validation, and progress reporting.
 *
 * @example
 * class FactExtractorSpecialist extends SpecialistBase {
 *   getSystemPrompt(context: ProblemSetContext): string {
 *     return `Extract facts relevant to: ${context.coreProblem}`;
 *   }
 * }
 */
export abstract class SpecialistBase {
  readonly specialistId: SpecialistId;
  readonly name: string;

  protected wrapper: LangGraphAgentWrapper;
  protected problemSetContext: ProblemSetContext | null = null;

  constructor(config: SpecialistConfig) {
    this.specialistId = config.specialistId;
    this.name = config.name;

    // Build an AgentManifest for the wrapper
    const manifest: AgentManifest = {
      agentId: `doc-${config.specialistId}`,
      name: config.name,
      description: config.description,
      phase: AgentPhase.Support,
      capabilities: [AgentCapability.ContextAnalysis],
      maxAutonomy: AutonomyLevel.NotAutonomous,
      allowedProposalKinds: [],
      requiresHumanApproval: [],
      createdAt: new Date(),
      createdBy: 'doc-intelligence-team',
      active: true,
    };

    this.wrapper = new LangGraphAgentWrapper({
      manifest,
      clearance: config.clearance,
      tools: config.tools,
      applyClassificationFilter: true,
    });
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Create a LangGraph node function for StateGraph registration.
   *
   * @returns Node function compatible with `graph.addNode()`
   */
  createNode(): (state: BastionState) => Promise<Partial<BastionState>> {
    return this.wrapper.createNode();
  }

  /**
   * Set the problem set context for this specialist.
   * Called by the orchestrator before processing begins.
   */
  setProblemSetContext(context: ProblemSetContext): void {
    this.problemSetContext = context;
  }

  /**
   * Get the current problem set context.
   */
  getProblemSetContext(): ProblemSetContext | null {
    return this.problemSetContext;
  }

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------

  /**
   * Validate specialist output against a Zod schema.
   * Returns a discriminated result -- callers must handle the error case.
   *
   * @param output - Raw output to validate (typically parsed LLM JSON)
   * @param schema - Zod schema to validate against
   * @returns SafeParseReturnType with success/error discriminant
   */
  validateOutput<T>(
    output: unknown,
    schema: ZodType<T>,
  ): { success: true; data: T } | { success: false; error: unknown } {
    const result = schema.safeParse(output);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
  }

  // --------------------------------------------------------------------------
  // Progress Reporting
  // --------------------------------------------------------------------------

  /**
   * Report progress for SSE streaming to the Mission Control UI.
   *
   * @param stage - Current processing stage name
   * @param detail - Human-readable detail about current progress
   * @param callback - Optional callback (typically the SSE send function)
   */
  reportProgress(
    stage: string,
    detail: string,
    callback?: (event: { type: string; data: Record<string, unknown> }) => void,
  ): void {
    if (callback) {
      callback({
        type: 'specialist:progress',
        data: {
          specialistId: this.specialistId,
          name: this.name,
          stage,
          detail,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // --------------------------------------------------------------------------
  // Abstract Methods
  // --------------------------------------------------------------------------

  /**
   * Generate the system prompt for this specialist, injecting problem set
   * context so the agent's analysis is scoped appropriately.
   *
   * Subclasses MUST override this to provide specialist-specific prompts.
   *
   * @param context - The problem set context from the scoping interview
   * @returns Complete system prompt string for the LLM
   */
  abstract getSystemPrompt(context: ProblemSetContext): string;
}
