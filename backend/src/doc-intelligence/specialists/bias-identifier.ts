/**
 * Bias Identifier Specialist
 *
 * Detects framing, propaganda, information operations (IO) markers, and
 * cognitive biases in documents. Uses a six-category taxonomy:
 *
 * 1. Source Framing - emphasis/omission patterns
 * 2. Propaganda Indicators - emotional language, loaded terms, etc.
 * 3. Information Operations (IO) Markers - coordinated messaging signals
 * 4. Selection Bias - perspectives/facts included vs excluded
 * 5. Confirmation Bias Risk - reinforcing assumptions without new evidence
 * 6. Cultural/Ideological Lens - author worldview indicators
 *
 * Each detected bias receives a severity rating (low/medium/high/critical),
 * supporting evidence quoted from the document, and a recommendation for
 * how analysts should adjust their interpretation.
 *
 * Invocation rules:
 * - ALWAYS for NEWS_ARTICLE, ACADEMIC_RESEARCH, OSINT_REPORT
 * - OPTIONAL for other types (per orchestrator triage decision)
 * - For MILITARY_ORDER and friendly CONOPs, focuses on planning assumptions
 *   and cognitive biases rather than propaganda
 */

import { SpecialistBase } from '../specialist-base.js';
import type { SpecialistConfig } from '../specialist-base.js';
import type { ProblemSetContext } from '../schemas.js';
import { BiasAssessmentSchema } from '../schemas.js';
import type { BiasAssessment, BiasSeverity, DocumentType } from '../types.js';
import { SpecialistId, DocumentType as DocType } from '../types.js';
import type { BastionState } from '../../orchestration/state.js';
import { z } from 'zod';

// ============================================================================
// Bias Taxonomy
// ============================================================================

/**
 * The six-category bias detection taxonomy.
 * Each category has a description for the LLM and specific detection guidance.
 */
export const BIAS_TAXONOMY = {
  SOURCE_FRAMING: {
    label: 'Source Framing',
    description:
      'How is information presented? What emphasis or omission patterns exist? ' +
      'Look for selective presentation of facts, misleading framing of events, ' +
      'or asymmetric treatment of different actors.',
  },
  PROPAGANDA_INDICATORS: {
    label: 'Propaganda Indicators',
    description:
      'Emotional language, appeals to authority, strawman arguments, loaded terms, ' +
      'bandwagon appeals, false dichotomies, and other rhetorical manipulation techniques.',
  },
  IO_MARKERS: {
    label: 'Information Operations (IO) Markers',
    description:
      'Coordinated messaging patterns, amplification signals, timing correlation ' +
      'with events, narrative seeding, astroturfing indicators, and state-sponsored ' +
      'information warfare signatures.',
  },
  SELECTION_BIAS: {
    label: 'Selection Bias',
    description:
      'What perspectives or facts are included vs excluded? Is the sample of ' +
      'evidence representative? Are counterarguments addressed or ignored?',
  },
  CONFIRMATION_BIAS_RISK: {
    label: 'Confirmation Bias Risk',
    description:
      'Does this document reinforce existing assumptions without providing new ' +
      'evidence? Does it align suspiciously well with a particular narrative ' +
      'without acknowledging uncertainty?',
  },
  CULTURAL_IDEOLOGICAL_LENS: {
    label: 'Cultural/Ideological Lens',
    description:
      'What worldview does the author operate from? What cultural, political, or ' +
      'institutional biases might shape the analysis? Is there an implicit normative ' +
      'framework that colors the presentation?',
  },
} as const;

export type BiasTaxonomyCategory = keyof typeof BIAS_TAXONOMY;

/**
 * Document types that ALWAYS trigger bias identification.
 */
const ALWAYS_ANALYZE_TYPES: DocumentType[] = [
  DocType.NEWS_ARTICLE,
  DocType.ACADEMIC_RESEARCH,
  DocType.OSINT_REPORT,
];

/**
 * Document types where bias detection focuses on planning assumptions
 * and cognitive biases rather than propaganda/IO markers.
 */
const PLANNING_BIAS_TYPES: DocumentType[] = [
  DocType.MILITARY_ORDER,
  DocType.CONOP,
];

// ============================================================================
// BiasIdentifier Class
// ============================================================================

/**
 * Specialist agent that examines documents for biases, propaganda indicators,
 * and information operation markers. Produces severity-rated findings with
 * evidence and recommendations.
 */
export class BiasIdentifier extends SpecialistBase {
  constructor() {
    const config: SpecialistConfig = {
      specialistId: SpecialistId.BIAS_IDENTIFIER,
      name: 'Bias Identifier',
      description:
        'Detects framing, propaganda, IO markers, and cognitive biases in documents. ' +
        'Produces severity-rated findings with evidence and analyst recommendations.',
      systemPrompt: '', // Overridden by getSystemPrompt()
      tools: [],
      clearance: 'UNCLASS',
    };
    super(config);
  }

  // --------------------------------------------------------------------------
  // System Prompt
  // --------------------------------------------------------------------------

  getSystemPrompt(context: ProblemSetContext): string {
    return this.buildSystemPrompt(context);
  }

  /**
   * Build the system prompt, optionally adjusted for planning documents
   * where propaganda detection is less relevant than assumption analysis.
   */
  private buildSystemPrompt(
    context: ProblemSetContext,
    documentType?: DocumentType,
  ): string {
    const isPlanningDoc = documentType != null && PLANNING_BIAS_TYPES.includes(documentType);

    const taxonomyBlock = Object.values(BIAS_TAXONOMY)
      .map((cat) => `- **${cat.label}**: ${cat.description}`)
      .join('\n');

    const basePrompt = [
      'You are an intelligence analyst specializing in information quality and source analysis.',
      isPlanningDoc
        ? `Examine this ${documentType} for planning assumptions, cognitive biases, ` +
          'and analytical blind spots. Focus on assumptions that may be untested, ' +
          'groupthink indicators, and optimism/pessimism bias rather than propaganda.'
        : `Examine this document for potential biases, propaganda indicators, and ` +
          'information operation markers. Rate each finding by severity.',
      '',
      `Context: ${context.coreProblem}`,
      `Geographic scope: ${context.geographicScope.regions.join(', ')}`,
      '',
      'Use this bias detection taxonomy:',
      taxonomyBlock,
      '',
      'For each detected bias, provide:',
      '- "biasType": one of the taxonomy categories above (use the label)',
      '- "severity": "low" | "medium" | "high" | "critical"',
      '- "evidence": a direct quote or specific reference from the document',
      '- "recommendation": how an analyst should adjust their interpretation',
      '',
      'Be thorough but avoid false positives -- not every perspective is bias.',
      'Return a JSON array of bias findings. If no significant biases are detected,',
      'return an empty array.',
    ];

    return basePrompt.join('\n');
  }

  // --------------------------------------------------------------------------
  // Analysis Execution
  // --------------------------------------------------------------------------

  /**
   * Execute bias analysis on a document.
   *
   * @param documentText - The document content to analyze
   * @param context - Problem set context for scoping
   * @param documentType - Classification from the document classifier
   * @returns Validated BiasAssessment array or null on error
   */
  async analyze(
    documentText: string,
    context: ProblemSetContext,
    documentType?: DocumentType,
  ): Promise<BiasAssessment[] | null> {
    this.setProblemSetContext(context);

    this.reportProgress('analyzing', 'Scanning for biases and IO markers');

    const systemPrompt = this.buildSystemPrompt(context, documentType);

    // Build user message
    const userMessage = [
      documentType ? `Document type: ${documentType}` : '',
      `Document text:\n${documentText}`,
      '',
      'Analyze this document for biases using the taxonomy provided.',
    ]
      .filter(Boolean)
      .join('\n');

    // The actual LLM call is handled by the LangGraph node via the wrapper.
    // This method provides the structured analysis contract for direct invocation.
    const rawOutput: BiasAssessment[] = [];

    // Validate against schema (array of BiasAssessment)
    const arraySchema = z.array(BiasAssessmentSchema);
    const validation = this.validateOutput(rawOutput, arraySchema);
    if (validation.success) {
      this.reportProgress(
        'complete',
        `Bias analysis complete: ${validation.data.length} findings`,
      );
      return validation.data;
    }

    this.reportProgress('error', 'Bias assessment validation failed');
    return null;
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  /**
   * Check if a document type should always trigger bias identification.
   */
  static shouldAlwaysAnalyze(documentType: DocumentType): boolean {
    return ALWAYS_ANALYZE_TYPES.includes(documentType);
  }

  /**
   * Check if bias analysis should focus on planning assumptions
   * rather than propaganda/IO markers.
   */
  static isPlanningDocument(documentType: DocumentType): boolean {
    return PLANNING_BIAS_TYPES.includes(documentType);
  }

  /**
   * Get the bias taxonomy categories for reference.
   */
  static getTaxonomy(): typeof BIAS_TAXONOMY {
    return BIAS_TAXONOMY;
  }

  /**
   * Create a LangGraph node function for the bias identifier.
   */
  override createNode(): (state: BastionState) => Promise<Partial<BastionState>> {
    return async (state: BastionState): Promise<Partial<BastionState>> => {
      const baseNode = this.wrapper.createNode();
      return baseNode(state);
    };
  }
}
