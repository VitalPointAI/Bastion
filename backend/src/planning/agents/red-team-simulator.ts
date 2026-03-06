import { StateGraph, Annotation, MemorySaver } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { RED_TEAM_CHARACTER } from './red-team-character.js';
import { getRedTeamTools } from './red-team-tools.js';
import { buildSystemPrompt } from '../../agents/character-builder.js';
import { coaStore } from '../stores/coa-store.js';

// State annotation
const RedTeamState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  planId: Annotation<string>,
  coaIds: Annotation<string[]>({
    reducer: (prev, next) => next,
    default: () => [],
  }),
  analyzedCoaIds: Annotation<string[]>({
    reducer: (prev, next) => next,
    default: () => [],
  }),
  currentCoaIndex: Annotation<number>({
    reducer: (prev, next) => next,
    default: () => 0,
  }),
  complete: Annotation<boolean>({
    reducer: (prev, next) => next,
    default: () => false,
  }),
});

type RedTeamStateType = typeof RedTeamState.State;

const AGENT_ID = 'did:near:agent-red-team-simulator';

/**
 * Create the Red Team Simulator LangGraph
 */
export function createRedTeamGraph() {
  const model = new ChatAnthropic({
    modelName: 'claude-sonnet-4-20250514',
    temperature: 0.5, // Balanced for realistic analysis
  }).bindTools(getRedTeamTools(AGENT_ID));

  const systemPrompt = buildSystemPrompt(RED_TEAM_CHARACTER);

  // Agent node
  const agent = async (state: RedTeamStateType) => {
    const { messages, planId, coaIds, currentCoaIndex, analyzedCoaIds: _analyzedCoaIds } = state;

    if (currentCoaIndex >= coaIds.length) {
      return { complete: true, messages: [] };
    }

    const currentCoaId = coaIds[currentCoaIndex];

    const prompt = `Analyze COA ${currentCoaId} from the adversary perspective.

1. First, get the situation using get_situation tool with planId: ${planId}
2. Then, get the COA details using get_coa_details tool with coaId: ${currentCoaId}
3. Analyze the COA and identify:
   - What actions would the adversary likely take in response?
   - What vulnerabilities does this COA expose?
   - What specific counter-actions could defeat or degrade this COA?
   - What is the likely outcome if the adversary exploits these weaknesses?
4. Save your analysis using save_red_team_results tool

Be specific and tactical. Think like the enemy commander.`;

    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      ...messages,
      new HumanMessage(prompt),
    ]);

    return { messages: [response] };
  };

  // Tool node
  const tools = getRedTeamTools(AGENT_ID);
  const toolNode = new ToolNode(tools);

  // Check if current COA analysis complete
  const checkProgress = async (state: RedTeamStateType) => {
    const { coaIds, currentCoaIndex, analyzedCoaIds } = state;
    const currentCoaId = coaIds[currentCoaIndex];

    // Check if results were saved
    const coa = await coaStore.findById(currentCoaId);
    const hasResults = coa?.redTeamResults != null;

    if (hasResults) {
      const newAnalyzed = [...analyzedCoaIds, currentCoaId];
      const newIndex = currentCoaIndex + 1;
      const complete = newIndex >= coaIds.length;

      return {
        analyzedCoaIds: newAnalyzed,
        currentCoaIndex: newIndex,
        complete,
      };
    }

    return {};
  };

  // Routing function
  const shouldContinue = (state: RedTeamStateType) => {
    const lastMessage = state.messages[state.messages.length - 1];

    if (lastMessage && 'tool_calls' in lastMessage && Array.isArray(lastMessage.tool_calls)) {
      if (lastMessage.tool_calls.length > 0) {
        return 'tools';
      }
    }

    return 'check';
  };

  const afterCheck = (state: RedTeamStateType) => {
    if (state.complete) {
      return 'end';
    }
    return 'agent';
  };

  // Build graph
  const workflow = new StateGraph(RedTeamState)
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
 * Simulate adversary response to COAs
 */
export async function simulateAdversary(
  planId: string,
  coaIds?: string[],
  threadId?: string
): Promise<{
  analyzedCount: number;
  results: Array<{ coaId: string; vulnerabilityCount: number }>;
}> {
  // Get COAs to analyze
  let targetCoaIds = coaIds;
  if (!targetCoaIds || targetCoaIds.length === 0) {
    const coas = await coaStore.findByPlan(planId);
    targetCoaIds = coas.map(c => c.id);
  }

  const graph = createRedTeamGraph();
  const thread = threadId || `red-team-${planId}-${Date.now()}`;

  const result = await graph.invoke(
    {
      planId,
      coaIds: targetCoaIds,
      messages: [],
    },
    { configurable: { thread_id: thread } }
  );

  // Get results summary
  const results: Array<{ coaId: string; vulnerabilityCount: number }> = [];
  for (const coaId of result.analyzedCoaIds) {
    const coa = await coaStore.findById(coaId);
    if (coa?.redTeamResults) {
      results.push({
        coaId,
        vulnerabilityCount: coa.redTeamResults.vulnerabilities.length,
      });
    }
  }

  return {
    analyzedCount: result.analyzedCoaIds.length,
    results,
  };
}

// Export for orchestration
export const redTeamSimulatorAgent = {
  id: AGENT_ID,
  name: 'Red Team Simulator',
  character: RED_TEAM_CHARACTER,
  createGraph: createRedTeamGraph,
  execute: simulateAdversary,
};
