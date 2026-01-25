/**
 * COA Generator Agent
 *
 * Phase 05 Plan 05: LangGraph agent for automated COA generation
 */

import { StateGraph, Annotation, MemorySaver } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { COA_GENERATOR_CHARACTER } from './coa-generator-character.js';
import { getCOAGeneratorTools } from './coa-generator-tools.js';
import { buildSystemPrompt } from '../../agents/character-builder.js';
import { coaStore } from '../stores/coa-store.js';

// State annotation
const COAGeneratorState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  planId: Annotation<string>,
  targetCount: Annotation<number>({
    reducer: (prev, next) => next,
    default: () => 3, // Minimum per doctrine
  }),
  generatedCount: Annotation<number>({
    reducer: (prev, next) => next,
    default: () => 0,
  }),
  complete: Annotation<boolean>({
    reducer: (prev, next) => next,
    default: () => false,
  }),
  confidence: Annotation<number>({
    reducer: (prev, next) => next,
    default: () => 0,
  }),
});

type COAGeneratorStateType = typeof COAGeneratorState.State;

const AGENT_ID = 'did:near:agent-coa-generator';

/**
 * Create the COA Generator LangGraph
 */
export function createCOAGeneratorGraph() {
  // Get LLM from agent configuration
  const model = new ChatAnthropic({
    modelName: 'claude-sonnet-4-20250514',
    temperature: 0.7, // Some creativity for distinct COAs
  }).bindTools(getCOAGeneratorTools(AGENT_ID));

  const systemPrompt = buildSystemPrompt(COA_GENERATOR_CHARACTER);

  // Agent node
  const agent = async (state: COAGeneratorStateType) => {
    const { messages, planId, targetCount, generatedCount } = state;

    const prompt = generatedCount === 0
      ? `Generate ${targetCount} distinct Courses of Action for plan ${planId}.
         First, get the mission context using the get_mission_context tool.
         Then generate each COA using the save_coa tool.
         Ensure each COA is clearly distinguishable from the others.
         Each COA must be suitable, feasible, acceptable, distinguishable, and complete.`
      : `Continue generating COAs. You have generated ${generatedCount} of ${targetCount}.
         Check existing COAs to ensure distinctiveness.`;

    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      ...messages,
      new HumanMessage(prompt),
    ]);

    return { messages: [response] };
  };

  // Tool node
  const tools = getCOAGeneratorTools(AGENT_ID);
  const toolNode = new ToolNode(tools);

  // Check completion
  const checkComplete = async (state: COAGeneratorStateType) => {
    const count = await coaStore.countByPlan(state.planId);
    const complete = count >= state.targetCount;

    return {
      generatedCount: count,
      complete,
      confidence: complete ? 80 : 0, // Base confidence when complete
    };
  };

  // Routing function
  const shouldContinue = (state: COAGeneratorStateType) => {
    const lastMessage = state.messages[state.messages.length - 1];

    if (lastMessage && 'tool_calls' in lastMessage && Array.isArray(lastMessage.tool_calls)) {
      if (lastMessage.tool_calls.length > 0) {
        return 'tools';
      }
    }

    if (state.complete) {
      return 'end';
    }

    return 'check';
  };

  // Build graph
  const workflow = new StateGraph(COAGeneratorState)
    .addNode('agent', agent)
    .addNode('tools', toolNode)
    .addNode('check', checkComplete)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      check: 'check',
      end: '__end__',
    })
    .addEdge('tools', 'check')
    .addConditionalEdges('check', (state) => state.complete ? 'end' : 'agent', {
      agent: 'agent',
      end: '__end__',
    });

  return workflow.compile({
    checkpointer: new MemorySaver(),
  });
}

/**
 * Generate COAs for a plan
 */
export async function generateCOAs(
  planId: string,
  targetCount: number = 3,
  threadId?: string
): Promise<{
  coaCount: number;
  confidence: number;
  messages: BaseMessage[];
}> {
  const graph = createCOAGeneratorGraph();
  const thread = threadId || `coa-gen-${planId}-${Date.now()}`;

  const result = await graph.invoke(
    {
      planId,
      targetCount: Math.max(3, targetCount), // Enforce minimum
      messages: [],
    },
    { configurable: { thread_id: thread } }
  );

  return {
    coaCount: result.generatedCount,
    confidence: result.confidence,
    messages: result.messages,
  };
}

// Export for orchestration
export const coaGeneratorAgent = {
  id: AGENT_ID,
  name: 'COA Generator',
  character: COA_GENERATOR_CHARACTER,
  createGraph: createCOAGeneratorGraph,
  execute: generateCOAs,
};
