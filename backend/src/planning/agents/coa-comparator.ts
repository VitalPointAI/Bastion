import { StateGraph, Annotation, MemorySaver } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/dist/prebuilt/index.js';
import { COA_COMPARATOR_CHARACTER } from './coa-comparator-character.js';
import { getCOAComparatorTools } from './coa-comparator-tools.js';
import { buildSystemPrompt } from '../../agents/character-builder.js';
import { coaStore } from '../stores/coa-store.js';

// State annotation
const ComparatorState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  planId: Annotation<string>,
  coaCount: Annotation<number>({
    reducer: (prev, next) => next,
    default: () => 0,
  }),
  scoredCount: Annotation<number>({
    reducer: (prev, next) => next,
    default: () => 0,
  }),
  rankings: Annotation<Array<{ coaId: string; rank: number; score: number }>>({
    reducer: (prev, next) => next,
    default: () => [],
  }),
  complete: Annotation<boolean>({
    reducer: (prev, next) => next,
    default: () => false,
  }),
});

type ComparatorStateType = typeof ComparatorState.State;

const AGENT_ID = 'did:near:agent-coa-comparator';

/**
 * Create the COA Comparator LangGraph
 */
export function createCOAComparatorGraph() {
  const model = new ChatAnthropic({
    modelName: 'claude-sonnet-4-20250514',
    temperature: 0.3, // Lower temperature for consistent scoring
  }).bindTools(getCOAComparatorTools(AGENT_ID));

  const systemPrompt = buildSystemPrompt(COA_COMPARATOR_CHARACTER);

  // Agent node
  const agent = async (state: ComparatorStateType) => {
    const { messages, planId, scoredCount, coaCount } = state;

    const prompt = scoredCount === 0
      ? `Compare all COAs for plan ${planId}.

1. First, get all COAs using get_all_coas tool
2. Get mission criteria using get_mission_criteria tool
3. Score EACH COA against the five criteria:
   - Feasibility (0-10): Can we do it with available resources?
   - Acceptability (0-10): Is the cost worth the expected outcome?
   - Suitability (0-10): Does it accomplish the mission?
   - Distinguishability (0-10): Is it clearly different from other COAs?
   - Completeness (0-10): Does it address who, what, when, where, why, how?
4. Consider red team results when scoring
5. Assign rankings (1 = best) after scoring all COAs
6. Save each COA's score using save_comparison_score tool

Be objective and consistent. Provide clear rationale for each score.`
      : `Continue scoring COAs. You have scored ${scoredCount} of ${coaCount}.`;

    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      ...messages,
      new HumanMessage(prompt),
    ]);

    return { messages: [response] };
  };

  // Tool node
  const tools = getCOAComparatorTools(AGENT_ID);
  const toolNode = new ToolNode(tools);

  // Check progress
  const checkProgress = async (state: ComparatorStateType) => {
    const coas = await coaStore.findByPlan(state.planId);
    const coaCount = coas.length;
    const scoredCount = coas.filter(c => c.comparisonScore != null).length;
    const complete = scoredCount >= coaCount && coaCount > 0;

    // Build rankings
    const rankings = coas
      .filter(c => c.comparisonScore != null)
      .map(c => ({
        coaId: c.id,
        rank: c.comparisonScore!.ranking,
        score: c.comparisonScore!.overallScore,
      }))
      .sort((a, b) => a.rank - b.rank);

    return {
      coaCount,
      scoredCount,
      complete,
      rankings,
    };
  };

  // Routing function
  const shouldContinue = (state: ComparatorStateType) => {
    const lastMessage = state.messages[state.messages.length - 1];

    if (lastMessage && 'tool_calls' in lastMessage && Array.isArray(lastMessage.tool_calls)) {
      if (lastMessage.tool_calls.length > 0) {
        return 'tools';
      }
    }

    return 'check';
  };

  const afterCheck = (state: ComparatorStateType) => {
    if (state.complete) {
      return 'end';
    }
    return 'agent';
  };

  // Build graph
  const workflow = new StateGraph(ComparatorState)
    .addNode('agent', agent)
    .addNode('tools', toolNode)
    .addNode('check', checkProgress)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      check: 'check',
    })
    .addEdge('tools', 'check')
    .addConditionalEdges('check', afterCheck, {
      agent: 'agent',
      end: '__end__',
    });

  return workflow.compile({
    checkpointer: new MemorySaver(),
  });
}

/**
 * Compare COAs for a plan
 */
export async function compareCOAs(
  planId: string,
  threadId?: string
): Promise<{
  comparedCount: number;
  rankings: Array<{ coaId: string; rank: number; score: number }>;
  topRanked: { coaId: string; score: number } | null;
}> {
  const graph = createCOAComparatorGraph();
  const thread = threadId || `coa-compare-${planId}-${Date.now()}`;

  const result = await graph.invoke(
    {
      planId,
      messages: [],
    },
    { configurable: { thread_id: thread } }
  );

  return {
    comparedCount: result.scoredCount,
    rankings: result.rankings,
    topRanked: result.rankings.length > 0 ? result.rankings[0] : null,
  };
}

// Export for orchestration
export const coaComparatorAgent = {
  id: AGENT_ID,
  name: 'COA Comparator',
  character: COA_COMPARATOR_CHARACTER,
  createGraph: createCOAComparatorGraph,
  execute: compareCOAs,
};
