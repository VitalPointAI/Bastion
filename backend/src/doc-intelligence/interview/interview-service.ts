/**
 * Interview Service - LangGraph StateGraph for conversational scoping interview
 *
 * Implements an adaptive conversational interview that captures problem set
 * boundaries across geographic scope, temporal range, actor focus, core problem,
 * classification, echelon, standing requirements, and additional nuance.
 *
 * Uses LangGraph StateGraph with PostgreSQL checkpointing for fault tolerance
 * and session resume across page refreshes.
 *
 * The graph uses an interrupt-resume pattern:
 * - Start: invoke graph -> ask_question -> END (returns AI message, waits for user)
 * - Continue: updateState with HumanMessage, then invoke to resume ->
 *   process_answer -> check_complete -> ask_question|summarize -> END
 */

import { Annotation, StateGraph, MessagesAnnotation, END } from '@langchain/langgraph';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { getCheckpointer } from '../../orchestration/checkpointer.js';
import { createLLMForAgent } from '../../agents/langgraph/llm-factory.js';
import { ProblemSetContextSchema, type ProblemSetContext } from '../schemas.js';
import {
  INTERVIEW_SYSTEM_PROMPT,
  INTERVIEW_SUMMARY_PROMPT,
  INTERVIEW_FOLLOW_UP_PROMPT,
  getUncoveredCategories,
} from './interview-prompts.js';
import {
  saveProblemSetContext,
  getProblemSetContext,
  getContextVersion,
} from './interview-store.js';

// ============================================================================
// State Annotation
// ============================================================================

/**
 * Interview state tracks conversation messages, coverage progress,
 * and the partially-derived context extracted from answers so far.
 */
const InterviewStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,

  /** Number of questions asked so far */
  questionsAsked: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),

  /** Partially extracted context from conversation so far */
  derivedContext: Annotation<Record<string, unknown>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),

  /** Whether the interview is considered complete */
  isComplete: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),

  /** The problem set ID being scoped */
  problemSetId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),

  /** Phase: 'start' for initial question, 'continue' for processing answer */
  phase: Annotation<'start' | 'continue'>({
    reducer: (_prev, next) => next,
    default: () => 'start',
  }),
});

type InterviewState = typeof InterviewStateAnnotation.State;

// ============================================================================
// Graph Nodes
// ============================================================================

/**
 * Get a configured LLM for the interview agent.
 */
async function getInterviewLLM() {
  return createLLMForAgent({
    agentId: 'scoping-interview',
    overrides: { temperature: 0.4, maxTokens: 2048 },
  });
}

/**
 * router node - Determines whether to ask the first question or process an answer.
 */
function routeEntry(state: InterviewState): string {
  if (state.phase === 'start') {
    return 'ask_question';
  }
  return 'process_answer';
}

/**
 * ask_question node - Generates the next adaptive interview question.
 * On first call, introduces the interview and asks the opening question.
 * On subsequent calls, uses coverage gaps to determine the next question.
 */
async function askQuestion(state: InterviewState): Promise<Partial<InterviewState>> {
  const llm = await getInterviewLLM();

  if (state.questionsAsked === 0) {
    // First question: introduce and ask about the core problem
    const response = await llm.invoke([
      new SystemMessage(INTERVIEW_SYSTEM_PROMPT),
      new HumanMessage(
        'Begin the scoping interview. Introduce yourself briefly and ask your first question about the core problem or challenge being analyzed.'
      ),
    ]);

    return {
      messages: [response],
      questionsAsked: 1,
    };
  }

  // Subsequent questions: use follow-up prompt with coverage gaps
  const uncovered = getUncoveredCategories(state.derivedContext);
  const followUpPrompt = INTERVIEW_FOLLOW_UP_PROMPT
    .replace('{derivedContext}', JSON.stringify(state.derivedContext, null, 2))
    .replace('{uncoveredCategories}', uncovered.join(', '));

  const messagesForLLM: BaseMessage[] = [
    new SystemMessage(INTERVIEW_SYSTEM_PROMPT + '\n\n' + followUpPrompt),
    ...state.messages,
  ];

  const response = await llm.invoke(messagesForLLM);

  return {
    messages: [response],
    questionsAsked: state.questionsAsked + 1,
  };
}

/**
 * process_answer node - Extracts structured information from the user's response.
 * Updates the derivedContext with any new information captured.
 */
async function processAnswer(state: InterviewState): Promise<Partial<InterviewState>> {
  const llm = await getInterviewLLM();

  const extractionPrompt = `Based on the full conversation so far, extract what you know into partial JSON categories.
Return ONLY valid JSON with these possible top-level keys:
geographicScope, temporalRange, actorFocus, coreProblem, classificationCeiling, echelon, standingRequirements, additionalNuance

Only include keys where you have extracted information. For example:
{"coreProblem": "China's militarization of the South China Sea", "geographicScope": {"regions": ["Indo-Pacific"], "countries": ["China", "Taiwan", "Philippines"]}}

Current partial context: ${JSON.stringify(state.derivedContext)}`;

  // Filter out any SystemMessages from conversation history — Anthropic requires
  // system messages to be first only
  const conversationMessages = state.messages.filter(
    (m) => !(m instanceof SystemMessage)
  );
  const response = await llm.invoke([
    new SystemMessage(extractionPrompt),
    ...conversationMessages,
  ]);

  let updatedContext = { ...state.derivedContext };
  try {
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ||
      content.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      const extracted = JSON.parse(jsonMatch[1]);
      // Deep merge: new information overlays existing
      updatedContext = deepMerge(updatedContext, extracted);
    }
  } catch {
    // If extraction fails, keep existing context
    console.warn('[InterviewService] Failed to extract context from answer');
  }

  return {
    derivedContext: updatedContext,
  };
}

/**
 * check_complete node - Determines if all interview categories have been covered.
 */
async function checkComplete(state: InterviewState): Promise<Partial<InterviewState>> {
  const uncovered = getUncoveredCategories(state.derivedContext);

  // Consider complete if:
  // 1. All categories covered, OR
  // 2. At least 6 questions asked and core categories covered
  const coresCovered =
    !uncovered.includes('geographicScope') &&
    !uncovered.includes('actorFocus') &&
    !uncovered.includes('coreProblem');

  const isComplete =
    uncovered.length === 0 ||
    (state.questionsAsked >= 6 && coresCovered && uncovered.length <= 2);

  return { isComplete };
}

/**
 * summarize node - Generates a final summary for user confirmation.
 */
async function summarize(state: InterviewState): Promise<Partial<InterviewState>> {
  const llm = await getInterviewLLM();

  const summaryMessages: BaseMessage[] = [
    new SystemMessage(
      INTERVIEW_SYSTEM_PROMPT + '\n\n' +
      'The interview is now complete. Provide a clear, organized summary of everything captured across all categories. Ask the user to confirm or make corrections.'
    ),
    ...state.messages,
  ];

  const response = await llm.invoke(summaryMessages);

  return {
    messages: [response],
    isComplete: true,
  };
}

// ============================================================================
// Router functions
// ============================================================================

function routeAfterCheck(state: InterviewState): string {
  return state.isComplete ? 'summarize' : 'ask_question';
}

// ============================================================================
// Graph Builder
// ============================================================================

/**
 * Build the interview StateGraph.
 * Uses a phase-based routing pattern:
 * - phase='start': __start__ -> ask_question -> __end__
 * - phase='continue': __start__ -> process_answer -> check_complete -> ask_question|summarize -> __end__
 */
async function buildInterviewGraph() {
  const checkpointer = await getCheckpointer();

  const graph = new StateGraph(InterviewStateAnnotation)
    .addNode('ask_question', askQuestion)
    .addNode('process_answer', processAnswer)
    .addNode('check_complete', checkComplete)
    .addNode('summarize', summarize)
    // Entry routing based on phase
    .addConditionalEdges('__start__', routeEntry, {
      ask_question: 'ask_question',
      process_answer: 'process_answer',
    })
    .addEdge('ask_question', '__end__')
    .addEdge('process_answer', 'check_complete')
    .addConditionalEdges('check_complete', routeAfterCheck, {
      ask_question: 'ask_question',
      summarize: 'summarize',
    })
    .addEdge('summarize', '__end__');

  return graph.compile({ checkpointer });
}

// Cached compiled graph
let compiledGraph: Awaited<ReturnType<typeof buildInterviewGraph>> | null = null;

async function getGraph() {
  if (!compiledGraph) {
    compiledGraph = await buildInterviewGraph();
  }
  return compiledGraph;
}

// ============================================================================
// Interview Service
// ============================================================================

/**
 * InterviewService provides the public API for the scoping interview.
 *
 * - startInterview: Begins a new interview, returns first AI question
 * - continueInterview: Processes user message, returns next AI question or summary
 * - getInterviewState: Returns current state for resume
 * - completeInterview: Validates and stores ProblemSetContext
 */
export class InterviewService {
  /**
   * Start a new interview for a problem set.
   * Returns the first AI message (introduction and opening question).
   */
  async startInterview(problemSetId: string): Promise<{
    message: AIMessage;
    state: { questionsAsked: number; isComplete: boolean; derivedContext: Record<string, unknown> };
  }> {
    const graph = await getGraph();

    const config = {
      configurable: { thread_id: `interview-${problemSetId}` },
    };

    const result = await graph.invoke(
      {
        messages: [],
        questionsAsked: 0,
        derivedContext: {},
        isComplete: false,
        problemSetId,
        phase: 'start' as const,
      },
      config
    );

    const lastMessage = result.messages[result.messages.length - 1];

    return {
      message: lastMessage as AIMessage,
      state: {
        questionsAsked: result.questionsAsked,
        isComplete: result.isComplete,
        derivedContext: result.derivedContext,
      },
    };
  }

  /**
   * Continue an existing interview with a user message.
   * Adds the user message to state, then processes through
   * process_answer -> check_complete -> ask_question|summarize.
   */
  async continueInterview(
    problemSetId: string,
    userMessage: string
  ): Promise<{
    message: AIMessage;
    state: { questionsAsked: number; isComplete: boolean; derivedContext: Record<string, unknown> };
  }> {
    const graph = await getGraph();

    const config = {
      configurable: { thread_id: `interview-${problemSetId}` },
    };

    // Invoke graph with phase='continue' and the new human message
    // The router will direct to process_answer
    const result = await graph.invoke(
      {
        messages: [new HumanMessage(userMessage)],
        phase: 'continue' as const,
      },
      config
    );

    const lastMessage = result.messages[result.messages.length - 1];

    return {
      message: lastMessage as AIMessage,
      state: {
        questionsAsked: result.questionsAsked,
        isComplete: result.isComplete,
        derivedContext: result.derivedContext,
      },
    };
  }

  /**
   * Get the current interview state for resume/display.
   */
  async getInterviewState(problemSetId: string): Promise<{
    messages: BaseMessage[];
    questionsAsked: number;
    isComplete: boolean;
    derivedContext: Record<string, unknown>;
  } | null> {
    const graph = await getGraph();

    const config = {
      configurable: { thread_id: `interview-${problemSetId}` },
    };

    try {
      const state = await graph.getState(config);
      if (!state || !state.values || (state.values as InterviewState).messages.length === 0) {
        return null;
      }
      const values = state.values as InterviewState;
      return {
        messages: values.messages,
        questionsAsked: values.questionsAsked,
        isComplete: values.isComplete,
        derivedContext: values.derivedContext,
      };
    } catch {
      return null;
    }
  }

  /**
   * Complete the interview: extract ProblemSetContext from conversation,
   * validate via Zod, and persist to database.
   */
  async completeInterview(problemSetId: string): Promise<ProblemSetContext> {
    const graph = await getGraph();
    const llm = await getInterviewLLM();

    const config = {
      configurable: { thread_id: `interview-${problemSetId}` },
    };

    // Get the full conversation
    const state = await graph.getState(config);
    if (!state || !state.values) {
      throw new Error('No interview state found for this problem set');
    }
    const values = state.values as InterviewState;

    // Use LLM to extract structured ProblemSetContext
    // Filter out SystemMessages from conversation — Anthropic requires system first only
    const conversationOnly = values.messages.filter(
      (m: BaseMessage) => !(m instanceof SystemMessage)
    );
    const extractionMessages: BaseMessage[] = [
      new SystemMessage(INTERVIEW_SUMMARY_PROMPT),
      ...conversationOnly,
    ];

    const response = await llm.invoke(extractionMessages);
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    // Parse JSON from response
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ||
      content.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      throw new Error('Failed to extract ProblemSetContext from interview conversation');
    }

    const rawContext = JSON.parse(jsonMatch[1]);

    // Get current version for increment
    const currentVersion = await getContextVersion(problemSetId);

    // Build full context object
    const contextData = {
      ...rawContext,
      problemSetId,
      updatedAt: new Date().toISOString(),
      version: currentVersion + 1,
      // Ensure defaults
      classificationCeiling: rawContext.classificationCeiling || 'UNCLASSIFIED',
      echelon: rawContext.echelon || 'strategic',
    };

    // Validate via Zod
    const validated = ProblemSetContextSchema.safeParse(contextData);
    if (!validated.success) {
      throw new Error(
        `ProblemSetContext validation failed: ${JSON.stringify(validated.error)}`
      );
    }

    // Persist to database
    await saveProblemSetContext(validated.data);

    return validated.data;
  }
}

// ============================================================================
// Utility: Deep merge objects
// ============================================================================

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const targetVal = target[key];
    const sourceVal = source[key];

    if (
      targetVal &&
      sourceVal &&
      typeof targetVal === 'object' &&
      typeof sourceVal === 'object' &&
      !Array.isArray(targetVal) &&
      !Array.isArray(sourceVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      );
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
}
