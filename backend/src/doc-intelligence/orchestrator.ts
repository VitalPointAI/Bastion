/**
 * Document Intelligence Orchestrator
 *
 * Central LangGraph StateGraph that triages uploaded documents via LLM
 * and dispatches to appropriate specialist agents. The orchestrator:
 * - Accepts a document with text and metadata
 * - Uses an LLM call to triage (classify type, score relevance, select specialists)
 * - Routes through Format Converter (if needed) and Document Classifier
 * - Fans out to parallel specialists based on triage decision
 * - Assembles a unified DocumentIntelligenceReport from all specialist outputs
 *
 * Uses custom reducers for all state keys updated by parallel specialist nodes
 * to avoid LangGraph "Can receive only one value per step" errors.
 */

import { Annotation, StateGraph, END, START } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { getCheckpointer } from '../orchestration/checkpointer.js';
import type { NATORating } from './source-registry/nato-ratings.js';
import type {
  TriageDecision,
  ExtractedFact,
  PerspectiveAnalysis,
  BiasAssessment,
  CrossDocLink,
  SpecialistResult,
  SpecialistId,
  DocumentIntelligenceReport,
} from './types.js';
import { DocumentType, SpecialistId as SpecialistIds } from './types.js';
import { TriageDecisionSchema } from './schemas.js';
import type { ProblemSetContext } from './schemas.js';

// ============================================================================
// Triage System Prompt
// ============================================================================

const TRIAGE_SYSTEM_PROMPT = `You are a Document Intelligence Orchestrator triaging an incoming document.

Given the document metadata and first 2000 characters, determine:
1. Document type (from taxonomy)
2. Relevance to the problem set scope (0-1)
3. Which specialist agents to invoke

Document Type Taxonomy:
- INTEL_ESTIMATE: Intelligence estimates, threat assessments
- CONOP: Concept of operations, operational plans
- POLICY_PAPER: Policy documents, white papers, strategy documents
- NEWS_ARTICLE: News reports, media coverage
- ACADEMIC_RESEARCH: Research papers, academic publications
- MILITARY_ORDER: Orders, directives, fragmentary orders
- DIPLOMATIC_CABLE: Diplomatic communications
- OSINT_REPORT: Open source intelligence reports
- OTHER: Documents not fitting above categories

Specialist Selection Rules:
- Format Converter: ALWAYS if document appears scanned or non-English
- Document Classifier: ALWAYS
- Fact Extractor: ALWAYS
- Objective Extractor: ONLY for INTEL_ESTIMATE, CONOP, POLICY_PAPER, MILITARY_ORDER
- Perspective Analysts: ALWAYS (instantiated per relevant perspective)
- Bias Identifier: ALWAYS for NEWS_ARTICLE, ACADEMIC_RESEARCH, OSINT_REPORT; OPTIONAL for others
- Cross-Document Linker: ALWAYS (runs after Fact Extractor)
- Quality Assessor: ALWAYS
- Trust Agent: ALWAYS for OSINT_REPORT, NEWS_ARTICLE; when source is unknown

Return JSON with your triage decision.`;

// ============================================================================
// State Annotation with Custom Reducers
// ============================================================================

/**
 * DocIntelligenceStateAnnotation - LangGraph state for the document
 * intelligence pipeline. Uses custom reducers for all keys that may be
 * updated by parallel specialist nodes.
 */
export const DocIntelligenceStateAnnotation = Annotation.Root({
  // Document identity
  documentId: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => '',
  }),
  problemSetId: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => '',
  }),

  // Input data
  documentText: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => '',
  }),
  metadata: Annotation<Record<string, unknown>>({
    reducer: (_current, update) => update,
    default: () => ({}),
  }),
  problemSetContext: Annotation<ProblemSetContext | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),

  // Triage output
  triageDecision: Annotation<TriageDecision | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),

  // Format Converter output
  convertedText: Annotation<string | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),

  // Classifier output
  classification: Annotation<Record<string, unknown> | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),

  // Parallel specialist outputs - use array append reducers
  facts: Annotation<ExtractedFact[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  perspectives: Annotation<PerspectiveAnalysis[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  biasFindings: Annotation<BiasAssessment[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  crossDocLinks: Annotation<CrossDocLink[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  // Quality rating
  qualityRating: Annotation<NATORating | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),

  // Specialist results - merge objects reducer for parallel writes
  specialistResults: Annotation<Record<string, SpecialistResult>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({}),
  }),

  // Final report
  report: Annotation<DocumentIntelligenceReport | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
});

export type DocIntelligenceState = typeof DocIntelligenceStateAnnotation.State;

// ============================================================================
// Progress callback type
// ============================================================================

export type ProgressCallback = (event: string, data: Record<string, unknown>) => void;

// ============================================================================
// Document Orchestrator
// ============================================================================

/**
 * Document Intelligence Orchestrator.
 *
 * Creates and manages the LangGraph StateGraph that triages documents
 * and coordinates specialist agent execution.
 */
export class DocumentOrchestrator {
  private problemSetId: string;
  private problemSetContext: ProblemSetContext | null = null;
  private onProgress: ProgressCallback | null = null;
  private model: BaseChatModel;

  constructor(config: {
    problemSetId: string;
    problemSetContext?: ProblemSetContext;
    onProgress?: ProgressCallback;
    model?: BaseChatModel;
  }) {
    this.problemSetId = config.problemSetId;
    this.problemSetContext = config.problemSetContext ?? null;
    this.onProgress = config.onProgress ?? null;

    // Default to Claude for triage LLM
    this.model = config.model ?? new ChatAnthropic({
      model: 'claude-sonnet-4-20250514',
      temperature: 0,
      maxTokens: 2048,
    });
  }

  /**
   * Process a document through the intelligence pipeline.
   *
   * @param documentId - Unique document identifier
   * @param text - Extracted document text (may be empty for scanned docs)
   * @param metadata - Document metadata (filename, size, upload source, etc.)
   * @returns Assembled DocumentIntelligenceReport
   */
  async processDocument(
    documentId: string,
    text: string,
    metadata: Record<string, unknown>,
  ): Promise<DocumentIntelligenceReport> {
    this.emitProgress('orchestrator:start', { documentId, problemSetId: this.problemSetId });

    const graph = await this.createGraph();

    const initialState: Partial<DocIntelligenceState> = {
      documentId,
      problemSetId: this.problemSetId,
      documentText: text,
      metadata,
      problemSetContext: this.problemSetContext,
    };

    const result = await graph.invoke(initialState, {
      configurable: { thread_id: `doc-intel-${documentId}` },
    });

    this.emitProgress('orchestrator:complete', { documentId, reportId: documentId });

    if (!result.report) {
      throw new Error(`Orchestrator failed to produce report for document ${documentId}`);
    }

    return result.report;
  }

  /**
   * Build the LangGraph StateGraph for document intelligence processing.
   */
  private async createGraph() {
    const checkpointer = await getCheckpointer();
    const orchestrator = this;

    const graph = new StateGraph(DocIntelligenceStateAnnotation);

    // ------- Triage Node -------
    graph.addNode('triage', async (state: DocIntelligenceState) => {
      orchestrator.emitProgress('specialist:start', {
        agentId: 'triage',
        documentId: state.documentId,
        timestamp: new Date().toISOString(),
      });

      const preview = state.documentText.slice(0, 2000);
      const contextInfo = state.problemSetContext
        ? `\n\nProblem Set Context:\n- Geographic scope: ${state.problemSetContext.geographicScope.regions.join(', ')}\n- Temporal range: ${state.problemSetContext.temporalRange.startDate ?? 'open'} to ${state.problemSetContext.temporalRange.endDate ?? 'open'}\n- Primary actors: ${state.problemSetContext.actorFocus.primaryActors.join(', ')}\n- Core problem: ${state.problemSetContext.coreProblem}`
        : '';

      const messages: BaseMessage[] = [
        new SystemMessage(TRIAGE_SYSTEM_PROMPT),
        new HumanMessage(
          `Document Metadata: ${JSON.stringify(state.metadata)}\n\nDocument Preview (first 2000 chars):\n${preview}${contextInfo}\n\nReturn your triage decision as JSON with keys: documentType, relevanceScore, specialists, reasoning`
        ),
      ];

      const response = await orchestrator.model.invoke(messages);
      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Parse JSON from LLM response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Triage LLM did not return valid JSON');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = TriageDecisionSchema.parse(parsed);

      orchestrator.emitProgress('specialist:complete', {
        agentId: 'triage',
        documentId: state.documentId,
        result: { documentType: validated.documentType, relevanceScore: validated.relevanceScore },
        timestamp: new Date().toISOString(),
      });

      return { triageDecision: validated };
    });

    // ------- Format Converter Node (stub - implemented by specialist in Task 2) -------
    graph.addNode('format-converter', async (state: DocIntelligenceState) => {
      orchestrator.emitProgress('specialist:start', {
        agentId: SpecialistIds.FORMAT_CONVERTER,
        documentId: state.documentId,
        timestamp: new Date().toISOString(),
      });

      // Placeholder: actual FormatConverter specialist registered via team-setup
      // This node will be replaced when specialists are wired in
      const startTime = Date.now();
      const result: SpecialistResult = {
        specialistId: SpecialistIds.FORMAT_CONVERTER,
        status: 'success',
        output: { convertedText: state.documentText, language: 'en', hasOCR: false, tables: [], charts: [] },
        duration: Date.now() - startTime,
      };

      orchestrator.emitProgress('specialist:complete', {
        agentId: SpecialistIds.FORMAT_CONVERTER,
        documentId: state.documentId,
        duration: result.duration,
        timestamp: new Date().toISOString(),
      });

      return {
        convertedText: state.documentText,
        specialistResults: { [SpecialistIds.FORMAT_CONVERTER]: result },
      };
    });

    // ------- Document Classifier Node (stub - implemented by specialist in Task 2) -------
    graph.addNode('classifier', async (state: DocIntelligenceState) => {
      orchestrator.emitProgress('specialist:start', {
        agentId: SpecialistIds.DOCUMENT_CLASSIFIER,
        documentId: state.documentId,
        timestamp: new Date().toISOString(),
      });

      const startTime = Date.now();
      const classificationOutput = {
        documentType: state.triageDecision?.documentType ?? DocumentType.OTHER,
        classificationLevel: 'UNCLASSIFIED',
        relevanceScore: state.triageDecision?.relevanceScore ?? 0.5,
        suggestedContainers: [],
        suggestedActorCategory: 'neutral',
        keyTopics: [],
      };

      const result: SpecialistResult = {
        specialistId: SpecialistIds.DOCUMENT_CLASSIFIER,
        status: 'success',
        output: classificationOutput,
        duration: Date.now() - startTime,
      };

      orchestrator.emitProgress('specialist:complete', {
        agentId: SpecialistIds.DOCUMENT_CLASSIFIER,
        documentId: state.documentId,
        duration: result.duration,
        timestamp: new Date().toISOString(),
      });

      return {
        classification: classificationOutput,
        specialistResults: { [SpecialistIds.DOCUMENT_CLASSIFIER]: result },
      };
    });

    // ------- Parallel Specialist Stubs -------
    // These will be replaced by actual specialist implementations in later plans.

    graph.addNode('fact-extractor', async (state: DocIntelligenceState) => {
      orchestrator.emitProgress('specialist:start', {
        agentId: SpecialistIds.FACT_EXTRACTOR,
        documentId: state.documentId,
        timestamp: new Date().toISOString(),
      });
      const startTime = Date.now();
      const result: SpecialistResult = {
        specialistId: SpecialistIds.FACT_EXTRACTOR,
        status: 'skipped',
        output: null,
        duration: Date.now() - startTime,
      };
      return { specialistResults: { [SpecialistIds.FACT_EXTRACTOR]: result } };
    });

    graph.addNode('perspective-analyst', async (state: DocIntelligenceState) => {
      orchestrator.emitProgress('specialist:start', {
        agentId: SpecialistIds.PERSPECTIVE_ANALYST,
        documentId: state.documentId,
        timestamp: new Date().toISOString(),
      });
      const startTime = Date.now();
      const result: SpecialistResult = {
        specialistId: SpecialistIds.PERSPECTIVE_ANALYST,
        status: 'skipped',
        output: null,
        duration: Date.now() - startTime,
      };
      return { specialistResults: { [SpecialistIds.PERSPECTIVE_ANALYST]: result } };
    });

    graph.addNode('bias-identifier', async (state: DocIntelligenceState) => {
      orchestrator.emitProgress('specialist:start', {
        agentId: SpecialistIds.BIAS_IDENTIFIER,
        documentId: state.documentId,
        timestamp: new Date().toISOString(),
      });
      const startTime = Date.now();
      const result: SpecialistResult = {
        specialistId: SpecialistIds.BIAS_IDENTIFIER,
        status: 'skipped',
        output: null,
        duration: Date.now() - startTime,
      };
      return { specialistResults: { [SpecialistIds.BIAS_IDENTIFIER]: result } };
    });

    graph.addNode('objective-extractor', async (state: DocIntelligenceState) => {
      orchestrator.emitProgress('specialist:start', {
        agentId: SpecialistIds.OBJECTIVE_EXTRACTOR,
        documentId: state.documentId,
        timestamp: new Date().toISOString(),
      });
      const startTime = Date.now();
      const result: SpecialistResult = {
        specialistId: SpecialistIds.OBJECTIVE_EXTRACTOR,
        status: 'skipped',
        output: null,
        duration: Date.now() - startTime,
      };
      return { specialistResults: { [SpecialistIds.OBJECTIVE_EXTRACTOR]: result } };
    });

    graph.addNode('cross-doc-linker', async (state: DocIntelligenceState) => {
      orchestrator.emitProgress('specialist:start', {
        agentId: SpecialistIds.CROSS_DOC_LINKER,
        documentId: state.documentId,
        timestamp: new Date().toISOString(),
      });
      const startTime = Date.now();
      const result: SpecialistResult = {
        specialistId: SpecialistIds.CROSS_DOC_LINKER,
        status: 'skipped',
        output: null,
        duration: Date.now() - startTime,
      };
      return { specialistResults: { [SpecialistIds.CROSS_DOC_LINKER]: result } };
    });

    graph.addNode('quality-assessor', async (state: DocIntelligenceState) => {
      orchestrator.emitProgress('specialist:start', {
        agentId: SpecialistIds.QUALITY_ASSESSOR,
        documentId: state.documentId,
        timestamp: new Date().toISOString(),
      });
      const startTime = Date.now();
      const result: SpecialistResult = {
        specialistId: SpecialistIds.QUALITY_ASSESSOR,
        status: 'skipped',
        output: null,
        duration: Date.now() - startTime,
      };
      return { specialistResults: { [SpecialistIds.QUALITY_ASSESSOR]: result } };
    });

    graph.addNode('trust-agent', async (state: DocIntelligenceState) => {
      orchestrator.emitProgress('specialist:start', {
        agentId: SpecialistIds.TRUST_AGENT,
        documentId: state.documentId,
        timestamp: new Date().toISOString(),
      });
      const startTime = Date.now();
      const result: SpecialistResult = {
        specialistId: SpecialistIds.TRUST_AGENT,
        status: 'skipped',
        output: null,
        duration: Date.now() - startTime,
      };
      return { specialistResults: { [SpecialistIds.TRUST_AGENT]: result } };
    });

    // ------- Report Assembly Node -------
    graph.addNode('report-assembly', async (state: DocIntelligenceState) => {
      orchestrator.emitProgress('specialist:start', {
        agentId: 'report-assembly',
        documentId: state.documentId,
        timestamp: new Date().toISOString(),
      });

      const triage = state.triageDecision;
      if (!triage) {
        throw new Error('Cannot assemble report: triage decision missing');
      }

      const report: DocumentIntelligenceReport = {
        documentId: state.documentId,
        problemSetId: state.problemSetId,
        triage,
        facts: state.facts,
        perspectives: state.perspectives,
        biasFindings: state.biasFindings,
        qualityRating: state.qualityRating ?? {
          sourceReliability: 'F' as const,
          informationCredibility: 6,
          assessedBy: 'doc-orchestrator',
          assessedAt: new Date().toISOString(),
          reasoning: 'Quality assessment not yet completed',
        },
        crossDocLinks: state.crossDocLinks,
        summary: `Document ${state.documentId} classified as ${triage.documentType} with relevance ${triage.relevanceScore}. ${Object.keys(state.specialistResults).length} specialists executed.`,
      };

      orchestrator.emitProgress('report:assembled', {
        reportId: state.documentId,
        entityCount: state.facts.length,
        specialistCount: Object.keys(state.specialistResults).length,
        timestamp: new Date().toISOString(),
      });

      return { report };
    });

    // ------- Edges -------
    // Cast graph for edge methods -- LangGraph TS types cannot infer node names
    // at compile time. Same pattern used in supervisor.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = graph as any;

    // Start -> Triage
    g.addEdge(START, 'triage');

    // Conditional: Triage -> Format Converter (if needed) or Classifier
    g.addConditionalEdges('triage', (state: DocIntelligenceState) => {
      const specialists = state.triageDecision?.specialists ?? [];
      if (specialists.includes(SpecialistIds.FORMAT_CONVERTER)) {
        return 'format-converter';
      }
      return 'classifier';
    });

    // Format Converter -> Classifier
    g.addEdge('format-converter', 'classifier');

    // After Classifier: fan out to parallel specialists
    g.addConditionalEdges('classifier', (state: DocIntelligenceState) => {
      const specialists = state.triageDecision?.specialists ?? [];
      const targets: string[] = [];

      // Always run fact extractor
      if (specialists.includes(SpecialistIds.FACT_EXTRACTOR) || true) {
        targets.push('fact-extractor');
      }
      if (specialists.includes(SpecialistIds.PERSPECTIVE_ANALYST)) {
        targets.push('perspective-analyst');
      }
      if (specialists.includes(SpecialistIds.BIAS_IDENTIFIER)) {
        targets.push('bias-identifier');
      }
      if (specialists.includes(SpecialistIds.OBJECTIVE_EXTRACTOR)) {
        targets.push('objective-extractor');
      }
      if (specialists.includes(SpecialistIds.QUALITY_ASSESSOR)) {
        targets.push('quality-assessor');
      }
      if (specialists.includes(SpecialistIds.TRUST_AGENT)) {
        targets.push('trust-agent');
      }

      // Ensure at least fact-extractor runs
      if (targets.length === 0) {
        targets.push('fact-extractor');
      }

      return targets;
    });

    // Cross-Document Linker depends on Fact Extractor
    g.addEdge('fact-extractor', 'cross-doc-linker');

    // All specialist outputs fan-in to report assembly
    g.addEdge('cross-doc-linker', 'report-assembly');
    g.addEdge('perspective-analyst', 'report-assembly');
    g.addEdge('bias-identifier', 'report-assembly');
    g.addEdge('objective-extractor', 'report-assembly');
    g.addEdge('quality-assessor', 'report-assembly');
    g.addEdge('trust-agent', 'report-assembly');

    // Report assembly -> END
    g.addEdge('report-assembly', END);

    return graph.compile({ checkpointer });
  }

  /**
   * Emit a progress event via the callback if configured.
   */
  private emitProgress(event: string, data: Record<string, unknown>): void {
    if (this.onProgress) {
      this.onProgress(event, data);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a document intelligence graph for external invocation.
 *
 * @param config - Configuration including problemSetId and optional callbacks
 * @returns DocumentOrchestrator instance ready to process documents
 */
export function createDocIntelligenceGraph(config: {
  problemSetId: string;
  problemSetContext?: ProblemSetContext;
  onProgress?: ProgressCallback;
  model?: BaseChatModel;
}): DocumentOrchestrator {
  return new DocumentOrchestrator(config);
}
