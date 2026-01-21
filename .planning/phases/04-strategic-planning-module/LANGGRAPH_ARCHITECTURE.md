# LangGraph Agent Architecture for Strategic Planning

## Overview

This document outlines how to build proper AI agents using LangGraph for the strategic planning module. The key insight is that agents need:

1. **A Brain (LLM)** - The reasoning engine that decides what to do
2. **Tools** - Actions the agent can take
3. **State** - Memory/context that persists across turns
4. **Workflow** - The graph structure defining how agents interact

## Current vs. Proposed Architecture

### Current (Rule-Based)
```
User Request → Hardcoded Logic → Result
              (keyword matching)
```

### Proposed (LangGraph)
```
User Request → Agent Loop → Result
               ↓
         [Observe] → [Think] → [Act]
              ↑___________|
                  (repeat until done)
```

## LangGraph Concepts

### 1. State

State is a TypedDict that flows through the graph:

```typescript
// backend/src/agents/langgraph/state.ts
import { Annotation } from "@langchain/langgraph";

export const AgentState = Annotation.Root({
  // Input
  task: Annotation<string>,
  documentId: Annotation<string>,
  objectives: Annotation<Objective[]>,

  // Working memory
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
  }),

  // Tool results
  categoryAssessments: Annotation<CategoryAssessment[]>({
    reducer: (prev, next) => [...prev, ...next],
  }),
  priorityAssessments: Annotation<PriorityAssessment[]>({
    reducer: (prev, next) => [...prev, ...next],
  }),

  // Output
  report: Annotation<StrategyReviewReport | null>,
  status: Annotation<"pending" | "analyzing" | "complete" | "error">,
});
```

### 2. Tools as LangChain Tools

Convert the existing rule-based tools to LangChain tool format:

```typescript
// backend/src/agents/langgraph/tools/midlife-tool.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getMidlifeCategorizer } from "../../strategic/tools/midlife-categorizer.js";

export const categorizeMidlifeTool = tool(
  async ({ objectiveId, description, context }) => {
    const categorizer = getMidlifeCategorizer();
    const result = categorizer.categorize({ objectiveId, description, context });
    return JSON.stringify(result);
  },
  {
    name: "categorize_midlife",
    description: "Analyze a strategic objective and determine its MIDLIFE category (Military, Information, Diplomatic, Legal, Intelligence, Financial, Economic)",
    schema: z.object({
      objectiveId: z.string().describe("Unique identifier for the objective"),
      description: z.string().describe("Full text description of the strategic objective"),
      context: z.object({
        documentLevel: z.string().optional(),
        dimeCategory: z.string().optional(),
        keywords: z.array(z.string()).optional(),
      }).optional(),
    }),
  }
);

export const prioritizeDomainTool = tool(
  async ({ objectives, domain, criteria }) => {
    const prioritizer = getDomainPrioritizer();
    const result = prioritizer.prioritize({ objectives, domain, criteria });
    return JSON.stringify(result);
  },
  {
    name: "prioritize_domain",
    description: "Prioritize a list of strategic objectives within a specific domain",
    schema: z.object({
      objectives: z.array(z.object({
        id: z.string(),
        description: z.string(),
        currentPriority: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      })),
      domain: z.enum(["strategic", "operational", "tactical", "resource"]),
      criteria: z.object({
        urgency: z.number().optional(),
        impact: z.number().optional(),
        feasibility: z.number().optional(),
        risk: z.number().optional(),
        alignment: z.number().optional(),
        dependencies: z.number().optional(),
      }).optional(),
    }),
  }
);
```

### 3. Agent Node (The "Brain")

The agent node uses an LLM to decide what to do:

```typescript
// backend/src/agents/langgraph/nodes/agent.ts
import { ChatAnthropic } from "@langchain/anthropic";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

export function createStrategyReviewerAgent(tools: Tool[]) {
  const model = new ChatAnthropic({
    model: "claude-sonnet-4-20250514",
    temperature: 0,
  });

  const systemPrompt = `You are a Strategy Document Reviewer agent.
Your role is to analyze strategic documents and categorize objectives using the MIDLIFE framework.

MIDLIFE Categories:
- MILITARY: Armed forces, defense capabilities, combat operations
- INFORMATION: Communications, media, cyber influence, narrative control
- DIPLOMATIC: Foreign relations, treaties, alliances, negotiations
- LEGAL: International law, rules of engagement, legal frameworks
- INTELLIGENCE: Collection, analysis, surveillance, reconnaissance
- FINANCIAL: Banking, sanctions, monetary policy, financial warfare
- ECONOMIC: Trade, resources, supply chains, economic statecraft

For each objective:
1. Use the categorize_midlife tool to analyze it
2. Consider the confidence level - flag low confidence for human review
3. Look for patterns across objectives

After categorizing, use prioritize_domain to rank objectives.

Be thorough but efficient. Explain your reasoning.`;

  return createReactAgent({
    llm: model,
    tools,
    stateModifier: systemPrompt,
  });
}
```

### 4. The Graph Structure

```typescript
// backend/src/agents/langgraph/graphs/strategy-reviewer.ts
import { StateGraph, END } from "@langchain/langgraph";
import { AgentState } from "../state.js";
import { createStrategyReviewerAgent } from "../nodes/agent.js";
import { categorizeMidlifeTool, prioritizeDomainTool } from "../tools/index.js";

export function createStrategyReviewerGraph() {
  const tools = [categorizeMidlifeTool, prioritizeDomainTool];
  const agent = createStrategyReviewerAgent(tools);

  const workflow = new StateGraph(AgentState)
    // Load objectives node
    .addNode("load_objectives", async (state) => {
      const objectives = await objectiveStore.getObjectivesForDocument(state.documentId);
      return { objectives, status: "analyzing" };
    })

    // Agent reasoning/tool calling node
    .addNode("agent", async (state) => {
      const result = await agent.invoke({
        messages: state.messages,
      });
      return { messages: result.messages };
    })

    // Build final report node
    .addNode("build_report", async (state) => {
      const report = buildReportFromState(state);
      return { report, status: "complete" };
    })

    // Define edges
    .addEdge("__start__", "load_objectives")
    .addEdge("load_objectives", "agent")
    .addConditionalEdges(
      "agent",
      // Check if agent is done or needs more turns
      (state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage.content.includes("ANALYSIS_COMPLETE")) {
          return "build_report";
        }
        return "agent"; // Continue reasoning
      },
      {
        agent: "agent",
        build_report: "build_report",
      }
    )
    .addEdge("build_report", END);

  return workflow.compile();
}
```

## Multi-Agent Architectures

### Supervisor Pattern

For complex workflows, use a supervisor that delegates to specialized agents:

```typescript
// backend/src/agents/langgraph/graphs/strategic-team.ts
import { StateGraph, Annotation } from "@langchain/langgraph";

const TeamState = Annotation.Root({
  task: Annotation<string>,
  documentId: Annotation<string>,
  currentAgent: Annotation<string>,
  agentOutputs: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
  }),
  finalReport: Annotation<unknown>,
});

export function createStrategicTeamGraph() {
  return new StateGraph(TeamState)
    // Supervisor decides which agent to call
    .addNode("supervisor", async (state) => {
      const model = new ChatAnthropic({ model: "claude-sonnet-4-20250514" });

      const decision = await model.invoke([
        new SystemMessage(`You are a team supervisor coordinating strategic analysis.

Available agents:
- categorizer: Analyzes objectives and assigns MIDLIFE categories
- prioritizer: Ranks objectives by strategic importance
- synthesizer: Combines analysis into coherent report

Current state: ${JSON.stringify(state.agentOutputs)}

Decide which agent should work next, or if analysis is complete.
Respond with JSON: { "next": "agent_name" } or { "next": "FINISH" }`),
        new HumanMessage(state.task),
      ]);

      const parsed = JSON.parse(decision.content);
      return { currentAgent: parsed.next };
    })

    // Individual agent nodes
    .addNode("categorizer", createCategorizerSubgraph())
    .addNode("prioritizer", createPrioritizerSubgraph())
    .addNode("synthesizer", createSynthesizerSubgraph())

    // Route based on supervisor decision
    .addConditionalEdges(
      "supervisor",
      (state) => state.currentAgent,
      {
        categorizer: "categorizer",
        prioritizer: "prioritizer",
        synthesizer: "synthesizer",
        FINISH: END,
      }
    )

    // All agents return to supervisor
    .addEdge("categorizer", "supervisor")
    .addEdge("prioritizer", "supervisor")
    .addEdge("synthesizer", "supervisor")

    .compile();
}
```

## Human-in-the-Loop

LangGraph supports checkpoints for human approval:

```typescript
// backend/src/agents/langgraph/graphs/strategy-reviewer-hitl.ts
import { MemorySaver } from "@langchain/langgraph";

export function createHumanInLoopGraph() {
  const checkpointer = new MemorySaver();

  const workflow = new StateGraph(AgentState)
    .addNode("analyze", analyzeNode)
    .addNode("human_review", humanReviewNode)  // Interrupt here
    .addNode("apply_changes", applyChangesNode)

    .addEdge("__start__", "analyze")
    .addEdge("analyze", "human_review")
    .addEdge("human_review", "apply_changes")
    .addEdge("apply_changes", END);

  return workflow.compile({
    checkpointer,
    interruptBefore: ["human_review"],  // Pause for human approval
  });
}

// Usage:
async function runWithHumanApproval(documentId: string) {
  const graph = createHumanInLoopGraph();
  const threadId = crypto.randomUUID();

  // Run until interrupt
  let state = await graph.invoke(
    { documentId, task: "Review objectives" },
    { configurable: { thread_id: threadId } }
  );

  // State is now paused at human_review
  // ... wait for human to approve via API ...

  // Resume after approval
  state = await graph.invoke(
    null,  // Continue from checkpoint
    { configurable: { thread_id: threadId } }
  );

  return state.report;
}
```

## Integration with Admin UI

### Agent Registration

```typescript
// backend/src/agents/langgraph/registry.ts
interface LangGraphAgentDefinition {
  id: string;
  name: string;
  description: string;
  graphFactory: () => CompiledStateGraph;
  tools: string[];  // Tool IDs
  defaultModel: string;
  supportsStreaming: boolean;
  requiresApproval: boolean;
}

const BUILTIN_AGENTS: LangGraphAgentDefinition[] = [
  {
    id: "strategy-document-reviewer",
    name: "Strategy Document Reviewer",
    description: "Reviews strategic documents and categorizes objectives using MIDLIFE framework",
    graphFactory: createStrategyReviewerGraph,
    tools: ["categorize-midlife", "prioritize-domain"],
    defaultModel: "claude-sonnet-4-20250514",
    supportsStreaming: true,
    requiresApproval: true,
  },
];

// Seed agents on startup
export async function seedBuiltinAgents(registry: AgentRegistry) {
  for (const def of BUILTIN_AGENTS) {
    const existing = registry.getAgent(def.id);
    if (!existing) {
      await registry.registerAgent({
        agentId: def.id,
        displayName: def.name,
        description: def.description,
        // ... other manifest fields
      });

      // Assign tools
      for (const toolId of def.tools) {
        await registry.assignToolToAgent(def.id, toolId);
      }
    }
  }
}
```

### Admin API for Model Configuration

```typescript
// backend/src/api/admin-agents.ts
router.put('/agents/:agentId/model', async (req, res) => {
  const { agentId } = req.params;
  const { modelId, temperature, maxTokens } = req.body;

  // Validate model is available
  const providers = await getLLMProviders();
  const modelExists = providers.some(p =>
    p.models.some(m => m.id === modelId)
  );

  if (!modelExists) {
    return res.status(400).json({ error: 'Model not found' });
  }

  // Update agent config
  await agentRegistry.updateAgentConfig(agentId, {
    model: modelId,
    temperature,
    maxTokens,
  });

  res.json({ success: true });
});
```

## Streaming Responses

LangGraph supports streaming for real-time UI updates:

```typescript
// backend/src/api/strategic-agents.ts
router.get('/documents/:documentId/review/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const graph = createStrategyReviewerGraph();

  for await (const event of graph.streamEvents(
    { documentId: req.params.documentId },
    { version: "v2" }
  )) {
    if (event.event === "on_chat_model_stream") {
      // Stream LLM tokens
      res.write(`event: token\ndata: ${JSON.stringify({
        content: event.data.chunk.content
      })}\n\n`);
    }

    if (event.event === "on_tool_end") {
      // Tool completed
      res.write(`event: tool_complete\ndata: ${JSON.stringify({
        tool: event.name,
        result: event.data.output,
      })}\n\n`);
    }
  }

  res.write('event: complete\ndata: {}\n\n');
  res.end();
});
```

## File Structure

```
backend/src/agents/
├── langgraph/
│   ├── state.ts              # Shared state definitions
│   ├── tools/
│   │   ├── index.ts          # Tool exports
│   │   ├── midlife-tool.ts   # MIDLIFE categorization tool
│   │   └── prioritize-tool.ts # Prioritization tool
│   ├── nodes/
│   │   ├── agent.ts          # ReAct agent node
│   │   └── processors.ts     # Data processing nodes
│   ├── graphs/
│   │   ├── strategy-reviewer.ts      # Single agent graph
│   │   ├── strategy-reviewer-hitl.ts # With human approval
│   │   └── strategic-team.ts         # Multi-agent supervisor
│   └── registry.ts           # Agent registration/seeding
```

## Dependencies

Add to package.json:

```json
{
  "dependencies": {
    "@langchain/anthropic": "^0.3.x",
    "@langchain/core": "^0.3.x",
    "@langchain/langgraph": "^0.2.x",
    "zod": "^3.x"
  }
}
```

## Next Steps

1. **Install LangGraph** - Add dependencies
2. **Create base tools** - Wrap existing categorizer/prioritizer as LangChain tools
3. **Build simple graph** - Single agent with tools
4. **Add streaming** - SSE endpoint for real-time UI
5. **Human-in-the-loop** - Checkpoints for approval workflow
6. **Multi-agent** - Supervisor pattern for complex analysis
7. **Admin UI** - Model selection, tool assignment

## References

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [LangGraph Multi-Agent Tutorial](https://langchain-ai.github.io/langgraph/tutorials/multi_agent/multi-agent-collaboration/)
- [Human-in-the-Loop](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/breakpoints/)
