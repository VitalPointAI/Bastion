/**
 * Perspective Analyst Specialist
 *
 * Instantiated per container category (Friendly/Adversary/Neutral/Partner)
 * to provide multi-viewpoint analysis of documents. Each instance analyzes
 * the same document from a specific perspective, producing implications,
 * opportunities, threats, and unknowns relevant to that viewpoint.
 *
 * The orchestrator creates 1-4 PerspectiveAnalyst instances via the
 * `createPerspectiveAnalysts` factory function, then registers each as
 * a separate LangGraph node for parallel execution.
 */

import { SpecialistBase } from '../specialist-base.js';
import type { SpecialistConfig } from '../specialist-base.js';
import type { ProblemSetContext } from '../schemas.js';
import { PerspectiveAnalysisSchema } from '../schemas.js';
import type { PerspectiveCategory, PerspectiveAnalysis, DocumentType } from '../types.js';
import { SpecialistId } from '../types.js';
import type { BastionState } from '../../orchestration/state.js';

// ============================================================================
// Perspective-specific Focus Guidance
// ============================================================================

/**
 * Guidance templates scoping each perspective's analytical focus.
 * Injected into the system prompt so the LLM concentrates on the
 * correct viewpoint without drifting.
 */
const PERSPECTIVE_FOCUS: Record<PerspectiveCategory, string> = {
  friendly:
    'Focus on own force advantages, vulnerabilities exposed by this document, ' +
    'operational security concerns, force protection implications, and how this ' +
    'information affects friendly courses of action.',
  adversary:
    'Focus on adversary capabilities revealed, intent indicators, potential ' +
    'courses of action, deception indicators, and what this document reveals ' +
    'about adversary decision-making and operational patterns.',
  neutral:
    'Focus on third-party impacts, potential alignment shifts, humanitarian and ' +
    'economic effects, international law implications, and how neutral actors ' +
    'might respond to the events described.',
  partner:
    'Focus on coalition implications, interoperability issues, burden-sharing ' +
    'dynamics, alliance cohesion impacts, and how partner nations\' interests ' +
    'and capabilities are affected.',
};

// ============================================================================
// PerspectiveAnalyst Class
// ============================================================================

/**
 * A specialist that analyzes a document from a single perspective
 * (friendly, adversary, neutral, or partner).
 *
 * Each instance becomes a separate LangGraph node named
 * `perspective-{category}`, enabling parallel fan-out execution.
 */
export class PerspectiveAnalyst extends SpecialistBase {
  readonly perspective: PerspectiveCategory;

  constructor(perspective: PerspectiveCategory) {
    const config: SpecialistConfig = {
      specialistId: SpecialistId.PERSPECTIVE_ANALYST,
      name: `Perspective Analyst (${perspective})`,
      description:
        `Analyzes documents from the ${perspective} perspective, identifying ` +
        'implications, opportunities, threats, and unknowns.',
      systemPrompt: '', // Overridden by getSystemPrompt()
      tools: [],
      clearance: 'UNCLASS',
    };
    super(config);
    this.perspective = perspective;
  }

  /**
   * LangGraph node ID for this perspective instance.
   * Each perspective gets its own node so the orchestrator can fan out.
   */
  get nodeId(): string {
    return `perspective-${this.perspective}`;
  }

  // --------------------------------------------------------------------------
  // System Prompt
  // --------------------------------------------------------------------------

  getSystemPrompt(context: ProblemSetContext): string {
    const actors = this.resolveActors(context);

    return [
      `You are analyzing this document from the ${this.perspective} perspective.`,
      `Consider the implications, opportunities, threats, and remaining unknowns ` +
        `from the viewpoint of ${this.perspective} actors in the context of: ` +
        `${context.coreProblem}.`,
      '',
      `Geographic scope: ${context.geographicScope.regions.join(', ')}.`,
      actors ? `Relevant actors for this perspective: ${actors}.` : '',
      '',
      PERSPECTIVE_FOCUS[this.perspective],
      '',
      'Respond with a JSON object containing:',
      '- "perspective": the perspective category',
      '- "implications": array of key implications from this viewpoint',
      '- "opportunities": array of opportunities identified',
      '- "threats": array of threats or risks identified',
      '- "unknowns": array of information gaps or uncertainties',
      '',
      'Be specific and analytical. Ground observations in the document text.',
      'Each array should contain 2-6 substantive items.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  // --------------------------------------------------------------------------
  // Actor Resolution
  // --------------------------------------------------------------------------

  /**
   * Resolve relevant actors from ProblemSetContext for this perspective.
   * Maps perspective categories to the actor focus fields.
   */
  private resolveActors(context: ProblemSetContext): string | null {
    const { actorFocus } = context;

    switch (this.perspective) {
      case 'friendly':
        // Primary actors are typically the friendly force
        return actorFocus.primaryActors.length > 0
          ? actorFocus.primaryActors.join(', ')
          : null;

      case 'adversary':
        // Adversary actors may appear in primaryActors or alliances
        // depending on the problem set scope
        return actorFocus.primaryActors.length > 0
          ? actorFocus.primaryActors.join(', ')
          : null;

      case 'neutral':
        // Neutral actors are those not in primaryActors or excluded
        return actorFocus.excludedActors && actorFocus.excludedActors.length > 0
          ? `Actors not directly involved: ${actorFocus.excludedActors.join(', ')}`
          : null;

      case 'partner':
        // Partner actors from alliances
        if (actorFocus.alliances && actorFocus.alliances.length > 0) {
          return actorFocus.alliances
            .map((a) => `${a.name} (${a.members.join(', ')})`)
            .join('; ');
        }
        return null;

      default:
        return null;
    }
  }

  // --------------------------------------------------------------------------
  // Analysis Execution
  // --------------------------------------------------------------------------

  /**
   * Execute perspective analysis on a document.
   *
   * @param documentText - The document content to analyze
   * @param context - Problem set context for scoping
   * @param documentType - Classification from the document classifier
   * @returns Validated PerspectiveAnalysis or null on error
   */
  async analyze(
    documentText: string,
    context: ProblemSetContext,
    documentType?: DocumentType,
  ): Promise<PerspectiveAnalysis | null> {
    this.setProblemSetContext(context);

    this.reportProgress('analyzing', `Analyzing from ${this.perspective} perspective`);

    const systemPrompt = this.getSystemPrompt(context);

    // Build the user message with document context
    const userMessage = [
      documentType ? `Document type: ${documentType}` : '',
      `Document text:\n${documentText}`,
      '',
      `Analyze this document from the ${this.perspective} perspective.`,
    ]
      .filter(Boolean)
      .join('\n');

    // The actual LLM call is handled by the LangGraph node via the wrapper.
    // This method provides the structured analysis contract for direct invocation.
    const rawOutput = {
      perspective: this.perspective,
      implications: [] as string[],
      opportunities: [] as string[],
      threats: [] as string[],
      unknowns: [] as string[],
      _systemPrompt: systemPrompt,
      _userMessage: userMessage,
    };

    // Validate against schema
    const validation = this.validateOutput(rawOutput, PerspectiveAnalysisSchema);
    if (validation.success) {
      this.reportProgress('complete', `${this.perspective} perspective analysis complete`);
      return validation.data;
    }

    this.reportProgress('error', `Validation failed for ${this.perspective} perspective`);
    return null;
  }

  /**
   * Create a LangGraph node function for this perspective.
   * Overrides base to use the perspective-specific node ID.
   */
  override createNode(): (state: BastionState) => Promise<Partial<BastionState>> {
    return async (state: BastionState): Promise<Partial<BastionState>> => {
      // Delegate to the wrapper's node, which handles LLM invocation,
      // classification filtering, and message accumulation.
      const baseNode = this.wrapper.createNode();
      return baseNode(state);
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create PerspectiveAnalyst instances for the specified perspectives.
 *
 * Called by the orchestrator based on the triage decision. The orchestrator
 * determines which perspectives are relevant:
 * - Intel estimates typically need all four perspectives
 * - Friendly CONOPs may only need friendly + partner
 * - News articles might focus on adversary + neutral
 *
 * @param perspectives - Array of perspective categories to instantiate
 * @returns Array of PerspectiveAnalyst instances ready for node registration
 *
 * @example
 * const analysts = createPerspectiveAnalysts(['friendly', 'adversary', 'neutral', 'partner']);
 * analysts.forEach(a => graph.addNode(a.nodeId, a.createNode()));
 */
export function createPerspectiveAnalysts(
  perspectives: PerspectiveCategory[],
): PerspectiveAnalyst[] {
  return perspectives.map((p) => new PerspectiveAnalyst(p));
}
