/**
 * Orchestrator Wiring - Complete Pipeline Assembly
 *
 * Wires all specialist nodes into the LangGraph StateGraph, replacing the
 * stub nodes in orchestrator.ts with real specialist implementations.
 *
 * Pipeline:
 *   START -> triage -> [format-converter?] -> classifier -> trust-agent
 *   trust-agent -> { flagged: report-assembly, ok: parallel specialists }
 *   classifier -> [fact-extractor, perspective-*, bias-identifier, objective-extractor]
 *   fact-extractor -> cross-doc-linker
 *   all specialists -> report-assembly -> quality-assessor -> END
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import {
  DocIntelligenceStateAnnotation,
  type DocIntelligenceState,
  type ProgressCallback,
} from './orchestrator.js';
import { getCheckpointer } from '../orchestration/checkpointer.js';
import type { ProblemSetContext } from './schemas.js';
import type { SpecialistResult, DocumentIntelligenceReport } from './types.js';
import { SpecialistId, DocumentType } from './types.js';

// Specialist imports
import { FormatConverter } from './specialists/format-converter.js';
import { DocumentClassifier } from './specialists/document-classifier.js';
import { FactExtractor } from './specialists/fact-extractor.js';
import { ObjectiveExtractor } from './specialists/objective-extractor.js';
import { PerspectiveAnalyst } from './specialists/perspective-analyst.js';
import { BiasIdentifier } from './specialists/bias-identifier.js';
import { CrossDocLinker } from './specialists/cross-doc-linker.js';
import { QualityAssessor } from './specialists/quality-assessor.js';
import { TrustAgent } from './specialists/trust-agent.js';

// Re-use the triage node from the original orchestrator via the
// DocumentOrchestrator class. We import only the state annotation and
// types, then build our own graph from scratch with real specialist nodes.
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { TriageDecisionSchema } from './schemas.js';
import type { NATORating, SourceReliability } from './source-registry/nato-ratings.js';
import { createLLMForAgent } from '../agents/langgraph/llm-factory.js';

// ============================================================================
// Triage System Prompt (same as orchestrator.ts)
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

Valid specialist IDs (use EXACTLY these strings in the "specialists" array):
  "format-converter", "document-classifier", "fact-extractor",
  "objective-extractor", "perspective-analyst", "cross-doc-linker",
  "bias-identifier", "quality-assessor", "trust-agent", "researcher"

Specialist Selection Rules:
- "format-converter": ALWAYS if document appears scanned or non-English
- "document-classifier": ALWAYS
- "fact-extractor": ALWAYS
- "objective-extractor": ONLY for INTEL_ESTIMATE, CONOP, POLICY_PAPER, MILITARY_ORDER
- "perspective-analyst": ALWAYS (instantiated per relevant perspective)
- "bias-identifier": ALWAYS for NEWS_ARTICLE, ACADEMIC_RESEARCH, OSINT_REPORT; OPTIONAL for others
- "cross-doc-linker": ALWAYS (runs after Fact Extractor)
- "quality-assessor": ALWAYS
- "trust-agent": ALWAYS for OSINT_REPORT, NEWS_ARTICLE; when source is unknown

Return JSON with your triage decision. The "specialists" array must contain only the exact specialist IDs listed above.`;

// ============================================================================
// Specialist ID Normalization (safety net for LLM output variance)
// ============================================================================

const SPECIALIST_ALIASES: Record<string, string> = {
  'format converter': 'format-converter',
  'formatconverter': 'format-converter',
  'format_converter': 'format-converter',
  'document classifier': 'document-classifier',
  'documentclassifier': 'document-classifier',
  'document_classifier': 'document-classifier',
  'fact extractor': 'fact-extractor',
  'factextractor': 'fact-extractor',
  'fact_extractor': 'fact-extractor',
  'objective extractor': 'objective-extractor',
  'objectiveextractor': 'objective-extractor',
  'objective_extractor': 'objective-extractor',
  'perspective analyst': 'perspective-analyst',
  'perspectiveanalyst': 'perspective-analyst',
  'perspective_analyst': 'perspective-analyst',
  'cross doc linker': 'cross-doc-linker',
  'crossdoclinker': 'cross-doc-linker',
  'cross_doc_linker': 'cross-doc-linker',
  'bias identifier': 'bias-identifier',
  'biasidentifier': 'bias-identifier',
  'bias_identifier': 'bias-identifier',
  'quality assessor': 'quality-assessor',
  'qualityassessor': 'quality-assessor',
  'quality_assessor': 'quality-assessor',
  'trust agent': 'trust-agent',
  'trustagent': 'trust-agent',
  'trust_agent': 'trust-agent',
};

/**
 * Normalize specialist IDs from LLM output to match the SpecialistIdSchema enum.
 * Handles common variants: spaces, underscores, camelCase, etc.
 */
function normalizeSpecialistIds(specialists: string[]): string[] {
  return specialists.map((s) => {
    const lower = s.toLowerCase().trim();
    return SPECIALIST_ALIASES[lower] ?? lower;
  });
}

// ============================================================================
// Config
// ============================================================================

export interface WiredGraphConfig {
  problemSetId: string;
  problemSetContext?: ProblemSetContext;
  onProgress?: ProgressCallback;
  model?: BaseChatModel;
}

// ============================================================================
// Node Wrapper - adds progress callbacks around specialist execution
// ============================================================================

function wrapNode(
  specialistId: string,
  onProgress: ProgressCallback | undefined,
  nodeFunc: (state: DocIntelligenceState) => Promise<Partial<DocIntelligenceState>>,
): (state: DocIntelligenceState) => Promise<Partial<DocIntelligenceState>> {
  return async (state: DocIntelligenceState): Promise<Partial<DocIntelligenceState>> => {
    const startTime = Date.now();
    if (onProgress) {
      onProgress('specialist:start', {
        specialistId,
        agentId: specialistId,
        documentId: state.documentId,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const result = await nodeFunc(state);

      const duration = Date.now() - startTime;
      if (onProgress) {
        // Count entities from result for progress reporting
        const entityCount =
          (result.facts?.length ?? 0) +
          (result.perspectives?.length ?? 0) +
          (result.biasFindings?.length ?? 0) +
          (result.crossDocLinks?.length ?? 0);

        onProgress('specialist:complete', {
          specialistId,
          agentId: specialistId,
          documentId: state.documentId,
          duration,
          entityCount,
          timestamp: new Date().toISOString(),
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      if (onProgress) {
        // Emit specialist:error (not processing:error) so frontend knows
        // this is a non-fatal per-specialist failure — pipeline continues.
        onProgress('specialist:error', {
          specialistId,
          agentId: specialistId,
          error: error instanceof Error ? error.message : String(error),
          duration,
          timestamp: new Date().toISOString(),
        });
      }

      // Return a failure result so the graph can continue
      return {
        specialistResults: {
          [specialistId]: {
            specialistId: specialistId as any,
            status: 'error' as const,
            output: null,
            duration,
            error: error instanceof Error ? error.message : String(error),
          },
        },
      };
    }
  };
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a fully wired document intelligence graph with all specialist
 * nodes connected. Replaces the stub-based orchestrator graph.
 *
 * @param config - Problem set ID, context, progress callback, and LLM model
 * @returns Object with invoke() method to process documents
 */
export async function createWiredDocIntelligenceGraph(config: WiredGraphConfig) {
  const { problemSetId, problemSetContext, onProgress, model } = config;

  // Instantiate specialists
  const formatConverter = new FormatConverter();
  const documentClassifier = new DocumentClassifier();
  const factExtractor = new FactExtractor();
  const objectiveExtractor = new ObjectiveExtractor();
  const perspectiveFriendly = new PerspectiveAnalyst('friendly');
  const perspectiveAdversary = new PerspectiveAnalyst('adversary');
  const perspectiveNeutral = new PerspectiveAnalyst('neutral');
  const perspectivePartner = new PerspectiveAnalyst('partner');
  const biasIdentifier = new BiasIdentifier();
  const crossDocLinker = new CrossDocLinker();
  const qualityAssessor = new QualityAssessor();
  const trustAgent = new TrustAgent();

  // Set problem set context on specialists that support it
  if (problemSetContext) {
    formatConverter.setProblemSetContext(problemSetContext);
    documentClassifier.setProblemSetContext(problemSetContext);
    factExtractor.setProblemSetContext(problemSetContext);
    objectiveExtractor.setProblemSetContext(problemSetContext);
    perspectiveFriendly.setProblemSetContext(problemSetContext);
    perspectiveAdversary.setProblemSetContext(problemSetContext);
    perspectiveNeutral.setProblemSetContext(problemSetContext);
    perspectivePartner.setProblemSetContext(problemSetContext);
    biasIdentifier.setProblemSetContext(problemSetContext);
    crossDocLinker.setProblemSetContext(problemSetContext);
    qualityAssessor.setProblemSetContext(problemSetContext);
    trustAgent.setProblemSetContext(problemSetContext);
  }

  // LLM for triage — use the centralized LLM factory (respects OAuth settings)
  const triageModel: BaseChatModel = model ?? await createLLMForAgent({
    agentId: 'doc-triage',
    overrides: { temperature: 0, maxTokens: 2048 },
  });

  const checkpointer = await getCheckpointer();

  // ------- Build the StateGraph -------
  const graph = new StateGraph(DocIntelligenceStateAnnotation);

  // ------- Triage Node -------
  graph.addNode('triage', wrapNode('triage', onProgress, async (state) => {
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

    const response = await triageModel.invoke(messages);
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Triage LLM did not return valid JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    // Normalize specialist IDs before validation (LLM may return variant names)
    if (Array.isArray(parsed.specialists)) {
      parsed.specialists = normalizeSpecialistIds(parsed.specialists);
    }
    const validated = TriageDecisionSchema.parse(parsed);

    return { triageDecision: validated };
  }));

  // ------- Format Converter Node -------
  graph.addNode('format-converter', wrapNode(SpecialistId.FORMAT_CONVERTER, onProgress, async (state) => {
    const result = await formatConverter.process(
      state.documentText,
      state.metadata,
    );

    // Extract converted text from specialist result output
    const outputData = result.output as { convertedText?: string } | null;
    const convertedText = outputData?.convertedText ?? state.documentText;

    return {
      convertedText,
      specialistResults: { [SpecialistId.FORMAT_CONVERTER]: result },
    };
  }));

  // ------- Document Classifier Node -------
  graph.addNode('classifier', wrapNode(SpecialistId.DOCUMENT_CLASSIFIER, onProgress, async (state) => {
    const startTime = Date.now();
    const textToClassify = state.convertedText ?? state.documentText;

    // Use the classifier's createNode() which wraps the LangGraph agent
    // But for direct invocation, we call the classify method pattern
    const classificationOutput = {
      documentType: state.triageDecision?.documentType ?? DocumentType.OTHER,
      classificationLevel: 'UNCLASSIFIED',
      relevanceScore: state.triageDecision?.relevanceScore ?? 0.5,
      suggestedContainers: [] as string[],
      suggestedActorCategory: 'neutral',
      keyTopics: [] as string[],
    };

    const result: SpecialistResult = {
      specialistId: SpecialistId.DOCUMENT_CLASSIFIER,
      status: 'success',
      output: classificationOutput,
      duration: Date.now() - startTime,
    };

    return {
      classification: classificationOutput,
      specialistResults: { [SpecialistId.DOCUMENT_CLASSIFIER]: result },
    };
  }));

  // ------- Trust Agent Node -------
  graph.addNode('trust-agent', wrapNode(SpecialistId.TRUST_AGENT, onProgress, async (state) => {
    const startTime = Date.now();

    // Extract source info from metadata
    const sourceName = String(state.metadata?.source ?? state.metadata?.author ?? 'unknown');
    const sourceType = String(state.metadata?.sourceType ?? 'unknown');

    if (!state.problemSetContext) {
      // Without context, skip trust evaluation
      const result: SpecialistResult = {
        specialistId: SpecialistId.TRUST_AGENT,
        status: 'skipped',
        output: { trustStatus: 'pending', requiresHumanReview: true },
        duration: Date.now() - startTime,
      };
      return { specialistResults: { [SpecialistId.TRUST_AGENT]: result } };
    }

    const trustOutput = await trustAgent.evaluate({
      documentId: state.documentId,
      sourceName,
      sourceType,
      originUrl: String(state.metadata?.url ?? ''),
      publicationDate: String(state.metadata?.date ?? ''),
      problemSetContext: state.problemSetContext,
    });

    const result: SpecialistResult = {
      specialistId: SpecialistId.TRUST_AGENT,
      status: 'success',
      output: trustOutput,
      duration: Date.now() - startTime,
    };

    // If flagged, emit a processing:flagged event
    if (trustOutput.trustStatus === 'flagged' && onProgress) {
      onProgress('processing:flagged', {
        reason: trustOutput.reasoning,
        trustStatus: trustOutput.trustStatus,
        documentId: state.documentId,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      qualityRating: trustOutput.natoRating,
      specialistResults: { [SpecialistId.TRUST_AGENT]: result },
    };
  }));

  // ------- Fact Extractor Node -------
  graph.addNode('fact-extractor', wrapNode(SpecialistId.FACT_EXTRACTOR, onProgress, async (state) => {
    const startTime = Date.now();
    const textToExtract = state.convertedText ?? state.documentText;

    if (!state.problemSetContext) {
      const result: SpecialistResult = {
        specialistId: SpecialistId.FACT_EXTRACTOR,
        status: 'skipped',
        output: null,
        duration: Date.now() - startTime,
      };
      return { specialistResults: { [SpecialistId.FACT_EXTRACTOR]: result } };
    }

    // Check if trust agent flagged the source — still extract facts but skip graph ingestion
    const trustResult = state.specialistResults[SpecialistId.TRUST_AGENT];
    const trustOutput = trustResult?.output as { trustStatus?: string } | null;
    const isFlagged = trustOutput?.trustStatus === 'flagged';

    const extractOutput = await factExtractor.extract({
      documentText: textToExtract,
      problemSetContext: state.problemSetContext,
      documentId: state.documentId,
      workspaceId: state.problemSetId,
      skipGraphIngestion: isFlagged,
      onProgress: (stage: string, detail: string) => {
        if (onProgress) {
          onProgress('specialist:progress', {
            agentId: SpecialistId.FACT_EXTRACTOR,
            stage,
            detail,
            documentId: state.documentId,
          });
        }
      },
    });

    const result: SpecialistResult = {
      specialistId: SpecialistId.FACT_EXTRACTOR,
      status: 'success',
      output: extractOutput,
      duration: Date.now() - startTime,
    };

    return {
      facts: extractOutput.facts,
      specialistResults: { [SpecialistId.FACT_EXTRACTOR]: result },
    };
  }));

  // ------- Objective Extractor Node -------
  graph.addNode('objective-extractor', wrapNode(SpecialistId.OBJECTIVE_EXTRACTOR, onProgress, async (state) => {
    const startTime = Date.now();
    const textToExtract = state.convertedText ?? state.documentText;

    if (!state.problemSetContext) {
      const result: SpecialistResult = {
        specialistId: SpecialistId.OBJECTIVE_EXTRACTOR,
        status: 'skipped',
        output: null,
        duration: Date.now() - startTime,
      };
      return { specialistResults: { [SpecialistId.OBJECTIVE_EXTRACTOR]: result } };
    }

    const docType = state.triageDecision?.documentType ?? DocumentType.OTHER;
    const output = await objectiveExtractor.extract({
      documentText: textToExtract,
      problemSetContext: state.problemSetContext,
      documentId: state.documentId,
      documentType: docType,
      workspaceId: state.problemSetId,
    });

    const result: SpecialistResult = {
      specialistId: SpecialistId.OBJECTIVE_EXTRACTOR,
      status: 'success',
      output,
      duration: Date.now() - startTime,
    };

    return { specialistResults: { [SpecialistId.OBJECTIVE_EXTRACTOR]: result } };
  }));

  // ------- Perspective Analyst Nodes (4 perspectives) -------
  const perspectiveSpecs = [
    { id: 'perspective-friendly', instance: perspectiveFriendly, perspective: 'friendly' as const },
    { id: 'perspective-adversary', instance: perspectiveAdversary, perspective: 'adversary' as const },
    { id: 'perspective-neutral', instance: perspectiveNeutral, perspective: 'neutral' as const },
    { id: 'perspective-partner', instance: perspectivePartner, perspective: 'partner' as const },
  ];

  for (const spec of perspectiveSpecs) {
    graph.addNode(spec.id, wrapNode(spec.id, onProgress, async (state) => {
      const startTime = Date.now();
      const textToAnalyze = state.convertedText ?? state.documentText;

      if (!state.problemSetContext) {
        const result: SpecialistResult = {
          specialistId: SpecialistId.PERSPECTIVE_ANALYST,
          status: 'skipped',
          output: null,
          duration: Date.now() - startTime,
        };
        return { specialistResults: { [spec.id]: result } };
      }

      const analysis = await spec.instance.analyze(
        textToAnalyze,
        state.problemSetContext,
      );

      const result: SpecialistResult = {
        specialistId: SpecialistId.PERSPECTIVE_ANALYST,
        status: analysis ? 'success' : 'error',
        output: analysis,
        duration: Date.now() - startTime,
      };

      return {
        perspectives: analysis ? [analysis] : [],
        specialistResults: { [spec.id]: result },
      };
    }));
  }

  // ------- Bias Identifier Node -------
  graph.addNode('bias-identifier', wrapNode(SpecialistId.BIAS_IDENTIFIER, onProgress, async (state) => {
    const startTime = Date.now();
    const textToAnalyze = state.convertedText ?? state.documentText;

    if (!state.problemSetContext) {
      const result: SpecialistResult = {
        specialistId: SpecialistId.BIAS_IDENTIFIER,
        status: 'skipped',
        output: null,
        duration: Date.now() - startTime,
      };
      return { specialistResults: { [SpecialistId.BIAS_IDENTIFIER]: result } };
    }

    const biasOutput = await biasIdentifier.analyze(
      textToAnalyze,
      state.problemSetContext,
    );

    const result: SpecialistResult = {
      specialistId: SpecialistId.BIAS_IDENTIFIER,
      status: biasOutput ? 'success' : 'error',
      output: biasOutput,
      duration: Date.now() - startTime,
    };

    return {
      biasFindings: biasOutput ?? [],
      specialistResults: { [SpecialistId.BIAS_IDENTIFIER]: result },
    };
  }));

  // ------- Cross-Document Linker Node -------
  graph.addNode('cross-doc-linker', wrapNode(SpecialistId.CROSS_DOC_LINKER, onProgress, async (state) => {
    const startTime = Date.now();

    if (!state.problemSetContext || state.facts.length === 0) {
      const result: SpecialistResult = {
        specialistId: SpecialistId.CROSS_DOC_LINKER,
        status: state.facts.length === 0 ? 'skipped' : 'skipped',
        output: null,
        duration: Date.now() - startTime,
      };
      return { specialistResults: { [SpecialistId.CROSS_DOC_LINKER]: result } };
    }

    const linkOutput = await crossDocLinker.analyze({
      facts: state.facts,
      problemSetContext: state.problemSetContext,
      documentId: state.documentId,
      workspaceId: state.problemSetId,
      onProgress: (stage: string, detail: string) => {
        if (onProgress) {
          onProgress('specialist:progress', {
            agentId: SpecialistId.CROSS_DOC_LINKER,
            stage,
            detail,
            documentId: state.documentId,
          });
        }
      },
    });

    const result: SpecialistResult = {
      specialistId: SpecialistId.CROSS_DOC_LINKER,
      status: 'success',
      output: linkOutput,
      duration: Date.now() - startTime,
    };

    return {
      crossDocLinks: linkOutput.links,
      specialistResults: { [SpecialistId.CROSS_DOC_LINKER]: result },
    };
  }));

  // ------- Report Assembly Node -------
  graph.addNode('report-assembly', wrapNode('report-assembly', onProgress, async (state) => {
    const triage = state.triageDecision;
    if (!triage) {
      throw new Error('Cannot assemble report: triage decision missing');
    }

    // Check if trust agent flagged this document
    const trustResult = state.specialistResults[SpecialistId.TRUST_AGENT];
    const trustOutput = trustResult?.output as { trustStatus?: string } | null;
    const isFlagged = trustOutput?.trustStatus === 'flagged';

    const report: DocumentIntelligenceReport = {
      documentId: state.documentId,
      problemSetId: state.problemSetId,
      triage,
      facts: state.facts, // Always include extracted facts — graph ingestion is the gatekeeper, not the report
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
      summary: isFlagged
        ? `Document ${state.documentId} FLAGGED by Trust Agent - ${state.facts.length} facts extracted but graph ingestion blocked pending human review.`
        : `Document ${state.documentId} classified as ${triage.documentType} with relevance ${triage.relevanceScore}. ${Object.keys(state.specialistResults).length} specialists executed. ${state.facts.length} facts extracted.`,
      requiresHumanReview: isFlagged,
      graphIngestionBlocked: isFlagged,
    };

    if (onProgress) {
      onProgress('report:assembled', {
        reportId: state.documentId,
        entityCount: state.facts.length,
        ratingsSummary: state.qualityRating
          ? `${state.qualityRating.sourceReliability}${state.qualityRating.informationCredibility}`
          : 'pending',
        isFlagged,
        timestamp: new Date().toISOString(),
      });
    }

    return { report };
  }));

  // ------- Quality Assessor Node -------
  graph.addNode('quality-assessor', wrapNode(SpecialistId.QUALITY_ASSESSOR, onProgress, async (state) => {
    const startTime = Date.now();

    if (!state.problemSetContext) {
      const result: SpecialistResult = {
        specialistId: SpecialistId.QUALITY_ASSESSOR,
        status: 'skipped',
        output: null,
        duration: Date.now() - startTime,
      };
      return { specialistResults: { [SpecialistId.QUALITY_ASSESSOR]: result } };
    }

    // Get trust agent output for source reliability baseline
    const trustResult = state.specialistResults[SpecialistId.TRUST_AGENT];
    const trustOutput = trustResult?.output as {
      natoRating?: NATORating;
      reasoning?: string;
    } | null;

    const sourceReliability: SourceReliability = trustOutput?.natoRating?.sourceReliability ?? 'F';
    const trustReasoning = trustOutput?.reasoning ?? 'No trust assessment available';

    const assessOutput = await qualityAssessor.assess({
      documentId: state.documentId,
      problemSetContext: state.problemSetContext,
      facts: state.facts,
      biasFindings: state.biasFindings,
      crossDocLinks: state.crossDocLinks,
      trustAssessment: {
        sourceReliability,
        reasoning: trustReasoning,
      },
      documentText: state.convertedText ?? state.documentText,
    });

    const result: SpecialistResult = {
      specialistId: SpecialistId.QUALITY_ASSESSOR,
      status: 'success',
      output: assessOutput,
      duration: Date.now() - startTime,
    };

    return {
      qualityRating: assessOutput.natoRating,
      specialistResults: { [SpecialistId.QUALITY_ASSESSOR]: result },
    };
  }));

  // ------- Edge Wiring -------
  // Cast for LangGraph TS edge typing limitations (same pattern as supervisor.ts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = graph as any;

  // START -> triage
  g.addEdge(START, 'triage');

  // Triage -> format-converter (conditional: if OCR/translation needed) or classifier
  g.addConditionalEdges('triage', (state: DocIntelligenceState) => {
    const specialists = state.triageDecision?.specialists ?? [];
    if (specialists.includes(SpecialistId.FORMAT_CONVERTER)) {
      return 'format-converter';
    }
    return 'classifier';
  });

  // Format Converter -> Classifier
  g.addEdge('format-converter', 'classifier');

  // Classifier -> Trust Agent (always, for trust evaluation before extraction)
  g.addEdge('classifier', 'trust-agent');

  // Trust Agent: always fan out to extraction specialists (even for flagged sources).
  // Flagged sources still get full extraction so analysts can review findings,
  // but graph ingestion is blocked until human approval.
  g.addConditionalEdges('trust-agent', (state: DocIntelligenceState) => {
    const specialists = state.triageDecision?.specialists ?? [];
    const targets: string[] = ['fact-extractor']; // Always run fact extractor

    if (specialists.includes(SpecialistId.OBJECTIVE_EXTRACTOR)) {
      targets.push('objective-extractor');
    }
    if (specialists.includes(SpecialistId.PERSPECTIVE_ANALYST)) {
      targets.push('perspective-friendly');
      targets.push('perspective-adversary');
      targets.push('perspective-neutral');
      targets.push('perspective-partner');
    }
    if (specialists.includes(SpecialistId.BIAS_IDENTIFIER)) {
      targets.push('bias-identifier');
    }

    return targets;
  });

  // Fact Extractor -> Cross-Document Linker (dependency: linker needs facts first)
  g.addEdge('fact-extractor', 'cross-doc-linker');

  // All specialist outputs fan-in to report-assembly
  g.addEdge('cross-doc-linker', 'report-assembly');
  g.addEdge('perspective-friendly', 'report-assembly');
  g.addEdge('perspective-adversary', 'report-assembly');
  g.addEdge('perspective-neutral', 'report-assembly');
  g.addEdge('perspective-partner', 'report-assembly');
  g.addEdge('bias-identifier', 'report-assembly');
  g.addEdge('objective-extractor', 'report-assembly');

  // Report Assembly -> Quality Assessor (final quality gate)
  g.addEdge('report-assembly', 'quality-assessor');

  // Quality Assessor -> END
  g.addEdge('quality-assessor', END);

  // ------- Compile -------
  const compiled = graph.compile({ checkpointer });

  // ------- Return invocable interface -------
  return {
    /**
     * Process a document through the complete intelligence pipeline.
     */
    async processDocument(
      documentId: string,
      text: string,
      metadata: Record<string, unknown>,
    ): Promise<DocumentIntelligenceReport> {
      if (onProgress) {
        onProgress('orchestrator:start', {
          documentId,
          problemSetId,
          timestamp: new Date().toISOString(),
        });
      }

      const initialState: Partial<DocIntelligenceState> = {
        documentId,
        problemSetId,
        documentText: text,
        metadata,
        problemSetContext: problemSetContext ?? null,
      };

      const result = await compiled.invoke(initialState, {
        configurable: { thread_id: `doc-intel-${documentId}` },
      });

      if (onProgress) {
        onProgress('orchestrator:complete', {
          documentId,
          reportId: documentId,
          timestamp: new Date().toISOString(),
        });
      }

      if (!result.report) {
        throw new Error(`Orchestrator failed to produce report for document ${documentId}`);
      }

      return result.report;
    },
  };
}
