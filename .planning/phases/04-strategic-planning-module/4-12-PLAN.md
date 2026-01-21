# Plan 4-12: LangGraph Agent Framework Integration

**Phase:** 4 - Strategic Planning Module
**Depends on:** 4-11, 4.2
**Estimated complexity:** High

## Overview

This plan integrates LangGraph as the AI agent framework, enabling proper agent reasoning with tool use. The key requirement is that **each agent uses its own LLM configuration** from the admin-configured `AgentModelConfig`, not a hardcoded default.

## Background

### Current State
- Rule-based "agents" that use hardcoded keyword matching
- `AgentModelConfig` exists with per-agent `provider`, `model`, `temperature`, `maxTokens`
- `LLMProviderConfig` provides global API keys and defaults
- MCP tools exist (`categorize-midlife`, `prioritize-domain`) but are not AI-powered
- Admin UI can configure LLM settings per agent

### What We're Adding
- LangGraph for proper agent reasoning loops (Observe → Think → Act)
- Dynamic LLM instantiation using admin-configured settings per agent
- Tools wrapped as LangChain tools the LLM can invoke
- Human-in-the-loop checkpoints for review approval
- SSE streaming for real-time agent thinking

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Admin Configuration                              │
│  ┌─────────────────┐  ┌─────────────────────────────────────────────┐  │
│  │ LLMProviderConfig│  │ AgentModelConfig (per agent)                │  │
│  │ - provider       │  │ - agentId: strategy-document-reviewer       │  │
│  │ - apiKey         │  │ - provider: anthropic | openai | near-ai   │  │
│  │ - baseUrl        │  │ - model: claude-sonnet-4-20250514           │  │
│  │ - rateLimits     │  │ - temperature: 0.3                          │  │
│  └─────────────────┘  │ - maxTokens: 4096                            │  │
│                       └─────────────────────────────────────────────────┘
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    LLM Factory (Dynamic Instantiation)                  │
│  createLLMForAgent(agentId) → ChatAnthropic | ChatOpenAI | ChatNearAI  │
│  - Reads AgentModelConfig for agent                                     │
│  - Falls back to LLMProviderConfig global default                       │
│  - Returns properly configured ChatModel instance                       │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         LangGraph Agent                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    StateGraph                                     │   │
│  │  [Start] → [Load Data] → [Agent Node] ←──┐ → [Build Report] → [End]│
│  │                              │           │                        │   │
│  │                         [Tool Call]──────┘                        │   │
│  │                              │                                    │   │
│  │                    categorize-midlife                             │   │
│  │                    prioritize-domain                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Decisions

### LLM Factory Pattern
- **Decision:** Create an `LLMFactory` that dynamically instantiates the correct ChatModel based on agent config
- **Rationale:** Agents must use their configured model, not a hardcoded default
- **Implementation:** Factory reads `AgentModelConfig`, falls back to global, caches instances

### Provider Abstraction
- **Decision:** Support Anthropic, OpenAI, Azure OpenAI, NEAR AI, and local (Ollama)
- **Rationale:** Admin already configures these providers in UI
- **Implementation:** Provider-specific ChatModel classes from LangChain

### Tool Re-use
- **Decision:** Wrap existing rule-based tools as LangChain tools
- **Rationale:** The tools work; we just need LLM to decide when to call them
- **Implementation:** `tool()` wrapper with Zod schemas

### Streaming
- **Decision:** Use LangGraph's `streamEvents` for SSE to frontend
- **Rationale:** Show agent reasoning and tool calls in real-time
- **Implementation:** New streaming endpoint with token/event chunks

## Tasks

### Task 1: Install LangGraph Dependencies [auto]
Add required packages for LangGraph and LangChain.

**Files:**
- `backend/package.json`

**Dependencies:**
```json
{
  "@langchain/core": "^0.3.x",
  "@langchain/anthropic": "^0.3.x",
  "@langchain/openai": "^0.3.x",
  "@langchain/langgraph": "^0.2.x",
  "zod": "^3.x"  // Already have this
}
```

### Task 2: LLM Factory with Per-Agent Configuration [auto]
Create factory that instantiates the correct LLM based on agent's config.

**File:** `backend/src/agents/langgraph/llm-factory.ts`

```typescript
interface CreateLLMOptions {
  agentId: string;
  overrides?: {
    temperature?: number;
    maxTokens?: number;
  };
}

async function createLLMForAgent(options: CreateLLMOptions): Promise<BaseChatModel> {
  // 1. Get agent-specific config from configService
  const agentConfig = await configService.getAgentModelConfig(options.agentId);

  // 2. Fall back to global LLM config if agent uses default
  const globalConfig = await configService.getLLMConfig();

  // 3. Determine provider and model
  const provider = agentConfig?.provider || globalConfig.provider;
  const model = agentConfig?.model || globalConfig.models.analysis;
  const temperature = options.overrides?.temperature ?? agentConfig?.temperature ?? 0.3;
  const maxTokens = options.overrides?.maxTokens ?? agentConfig?.maxTokens ?? 4096;
  const apiKey = globalConfig.apiKey;
  const baseUrl = globalConfig.baseUrl;

  // 4. Instantiate correct provider
  switch (provider) {
    case 'anthropic':
      return new ChatAnthropic({ model, temperature, maxTokens, apiKey });
    case 'openai':
      return new ChatOpenAI({ model, temperature, maxTokens, apiKey });
    case 'azure-openai':
      return new ChatOpenAI({ model, temperature, maxTokens, apiKey, configuration: { baseURL: baseUrl } });
    case 'near-ai':
      return new ChatOpenAI({ model, temperature, maxTokens, apiKey, configuration: { baseURL: baseUrl || 'https://api.near.ai/v1' } });
    case 'local':
      return new ChatOllama({ model, temperature, baseUrl: baseUrl || 'http://localhost:11434' });
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
```

### Task 3: LangChain Tool Wrappers [auto]
Wrap existing tools as LangChain tools with proper schemas.

**File:** `backend/src/agents/langgraph/tools/index.ts`

**Tools to wrap:**
- `categorize-midlife` → existing `MidlifeCategorizer`
- `prioritize-domain` → existing `DomainPrioritizer`

```typescript
export const categorizeMidlifeTool = tool(
  async (input) => {
    const categorizer = getMidlifeCategorizer();
    return JSON.stringify(categorizer.categorize(input));
  },
  {
    name: "categorize_midlife",
    description: "Analyze a strategic objective and determine its MIDLIFE category",
    schema: z.object({
      objectiveId: z.string(),
      description: z.string(),
      context: z.object({ ... }).optional(),
    }),
  }
);
```

### Task 4: Agent State Definition [auto]
Define TypedDict state for the strategy reviewer graph.

**File:** `backend/src/agents/langgraph/state.ts`

```typescript
export const StrategyReviewerState = Annotation.Root({
  // Inputs
  documentId: Annotation<string>,
  objectives: Annotation<Objective[]>,

  // Agent memory
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
  }),

  // Results
  categoryAssessments: Annotation<CategoryAssessment[]>({
    reducer: (prev, next) => [...prev, ...next],
  }),
  priorityAssessments: Annotation<PriorityAssessment[]>({
    reducer: (prev, next) => [...prev, ...next],
  }),

  // Output
  report: Annotation<StrategyReviewReport | null>,
  status: Annotation<"loading" | "analyzing" | "complete" | "error">,
  error: Annotation<string | null>,
});
```

### Task 5: Strategy Reviewer Graph [auto]
Build the LangGraph state machine for document review.

**File:** `backend/src/agents/langgraph/graphs/strategy-reviewer.ts`

**Nodes:**
1. `load_objectives` - Load document objectives from store
2. `agent` - LLM reasoning with tool access
3. `build_report` - Compile final report from assessments

**Edges:**
- Start → load_objectives → agent
- agent → agent (loop until done)
- agent → build_report (when analysis complete)
- build_report → End

### Task 6: Human-in-the-Loop Checkpointer [auto]
Add checkpointing for human approval before applying changes.

**File:** `backend/src/agents/langgraph/graphs/strategy-reviewer-hitl.ts`

**Implementation:**
- Use `MemorySaver` checkpointer
- `interruptBefore: ["apply_changes"]`
- Store thread_id for resumption

### Task 7: Agent Seeding on Startup [auto]
Auto-register the strategy-document-reviewer agent with tools.

**File:** `backend/src/agents/langgraph/seeder.ts`

**Seeds:**
```typescript
const BUILTIN_AGENTS = [
  {
    agentId: 'strategy-document-reviewer',
    displayName: 'Strategy Document Reviewer',
    description: 'Reviews strategic documents using MIDLIFE framework',
    tools: ['categorize-midlife', 'prioritize-domain'],
    defaultConfig: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      temperature: 0.3,
      maxTokens: 4096,
    },
  },
];
```

**Integration:** Call from server startup

### Task 8: Streaming API Endpoint [auto]
Create SSE endpoint for real-time agent reasoning.

**File:** Update `backend/src/api/strategic.ts`

**Endpoint:** `GET /api/strategic/documents/:documentId/review/stream`

**Events:**
- `thinking` - LLM reasoning tokens
- `tool_call` - Tool invocation started
- `tool_result` - Tool completed with result
- `assessment` - Category/priority assessment added
- `complete` - Final report ready
- `error` - Error occurred

### Task 9: Update Review Executor to Use Graph [auto]
Replace rule-based executor with LangGraph execution.

**File:** Update `backend/src/strategic/agents/strategy-reviewer-executor.ts`

```typescript
async reviewDocument(documentId: string, options: ReviewOptions): Promise<StrategyReviewReport> {
  const graph = await createStrategyReviewerGraph(AGENT_ID);

  const result = await graph.invoke({
    documentId,
    objectives: [],
    messages: [],
    categoryAssessments: [],
    priorityAssessments: [],
    report: null,
    status: 'loading',
    error: null,
  });

  return result.report;
}
```

### Task 10: Admin API for Agent Model Config [auto]
Ensure admin can configure model per agent via existing endpoints.

**File:** Verify `backend/src/api/admin.ts`

**Endpoints:**
- `GET /api/admin/agents/:agentId/model-config`
- `PUT /api/admin/agents/:agentId/model-config`

**Verify:**
- Config stored in `agent_model_configs` table
- UI can read/write per-agent model settings

### Task 11: Frontend Streaming Integration [auto]
Update ReviewPanel to consume SSE stream and show agent thinking.

**File:** Update `frontend/src/components/strategic/ReviewPanel.tsx`

**Features:**
- Show "Agent is thinking..." with live tokens
- Display tool calls as they happen
- Progress indicator for multi-step analysis
- Handle stream errors gracefully

### Task 12: Agent Builder Wizard Backend [auto]
Create comprehensive agent creation API with character support.

**File:** `backend/src/api/agent-builder.ts`

**Endpoints:**
- `POST /api/admin/agents/build` - Create agent with full definition
- `GET /api/admin/agents/:id/preview-prompt` - Preview generated system prompt
- `POST /api/admin/agents/:id/test-chat` - Test agent with sample message
- `GET /api/admin/tools` - List available tools for assignment

**Schema additions:**
- Extend AgentManifest to include `character` and `tools` fields
- Add `AgentBuilderSchema` for full agent definition validation

### Task 13: Agent Builder Wizard Frontend [auto]
Build multi-step wizard UI for creating agents.

**File:** `frontend/src/components/admin/AgentBuilderWizard.tsx`

**Steps:**
1. **Identity** - Name, description, type, phase, autonomy
2. **Personality** - Bio, lore, knowledge (textarea arrays)
3. **Tools** - Multi-select from tool registry with permission config
4. **LLM Config** - Provider, model, temperature, max tokens
5. **Examples** - Message example pairs for few-shot learning
6. **Review** - System prompt preview, config summary, test chat, deploy

**Features:**
- Step-by-step wizard with progress indicator
- Back/Next navigation with validation per step
- Live system prompt preview as fields change
- Test chat modal to verify agent behavior
- Save as draft / Deploy buttons

### Task 14: Tool Assignment Integration [auto]
Connect agents to tools in registry with ABAC permissions.

**File:** `backend/src/agents/tool-assignment.ts`

**Features:**
- `assignToolsToAgent(agentId, toolIds[])`
- `getAgentTools(agentId)` - Returns full tool definitions
- `validateToolPermissions(agentId, toolId, action)` - ABAC check
- Store assignments in `agent_tool_assignments` table

**Schema:**
```sql
CREATE TABLE agent_tool_assignments (
  id UUID PRIMARY KEY,
  agent_id VARCHAR(64) NOT NULL,
  tool_id VARCHAR(64) NOT NULL,
  permissions JSONB DEFAULT '[]',
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by VARCHAR(256),
  UNIQUE(agent_id, tool_id)
);
```

### Task 15: System Prompt Generation [auto]
Generate system prompts from character definitions.

**File:** `backend/src/agents/langgraph/prompt-builder.ts`

**Features:**
- `buildSystemPrompt(agent)` - Combines character fields into prompt
- `buildToolsSection(tools[])` - Formats tool descriptions
- `buildExamplesSection(examples[])` - Formats few-shot examples
- Template customization per agent type

### Task 16: Testing & Documentation [checkpoint:human-verify]
Verify complete LangGraph integration and Agent Builder work end-to-end.

**Test Scenarios:**
1. **Agent Builder Flow:**
   - Create new agent via wizard
   - Configure personality with bio, lore, knowledge
   - Assign tools (categorize-midlife, prioritize-domain)
   - Configure LLM (try different providers)
   - Add message examples
   - Preview system prompt
   - Test chat with sample message
   - Deploy agent

2. **Agent Execution:**
   - Assign new agent to document
   - Trigger review
   - Verify streaming shows agent reasoning
   - Verify tool calls appear in stream
   - Verify final report is accurate

3. **Configuration:**
   - Change agent model in admin
   - Verify next review uses new model
   - Test human-in-the-loop approval flow

## Files to Create

### LangGraph Core
- `backend/src/agents/langgraph/llm-factory.ts` - Dynamic LLM instantiation
- `backend/src/agents/langgraph/tools/index.ts` - LangChain tool exports
- `backend/src/agents/langgraph/tools/midlife-tool.ts` - MIDLIFE tool wrapper
- `backend/src/agents/langgraph/tools/prioritize-tool.ts` - Prioritization wrapper
- `backend/src/agents/langgraph/state.ts` - Agent state definitions
- `backend/src/agents/langgraph/graphs/strategy-reviewer.ts` - Main graph
- `backend/src/agents/langgraph/graphs/strategy-reviewer-hitl.ts` - HITL version
- `backend/src/agents/langgraph/seeder.ts` - Agent seeding logic
- `backend/src/agents/langgraph/index.ts` - Module exports

### Agent Builder
- `backend/src/api/agent-builder.ts` - Builder API endpoints
- `backend/src/agents/tool-assignment.ts` - Tool-agent assignment logic
- `backend/src/agents/langgraph/prompt-builder.ts` - System prompt generation
- `frontend/src/components/admin/AgentBuilderWizard.tsx` - Multi-step wizard
- `frontend/src/components/admin/AgentBuilderWizard.css` - Wizard styles
- `frontend/src/components/admin/steps/IdentityStep.tsx` - Step 1
- `frontend/src/components/admin/steps/PersonalityStep.tsx` - Step 2
- `frontend/src/components/admin/steps/ToolsStep.tsx` - Step 3
- `frontend/src/components/admin/steps/LLMConfigStep.tsx` - Step 4
- `frontend/src/components/admin/steps/ExamplesStep.tsx` - Step 5
- `frontend/src/components/admin/steps/ReviewStep.tsx` - Step 6

## Files to Modify

- `backend/package.json` - Add LangGraph dependencies
- `backend/src/server.ts` - Call seeder on startup
- `backend/src/api/strategic.ts` - Add streaming endpoint
- `backend/src/api/admin.ts` - Mount agent-builder routes
- `backend/src/agents/types.ts` - Extend AgentManifest with character/tools
- `backend/src/strategic/agents/strategy-reviewer-executor.ts` - Use graph
- `backend/src/strategic/config/service.ts` - Add `getAgentModelConfig()` helper
- `frontend/src/components/strategic/ReviewPanel.tsx` - Streaming UI
- `frontend/src/components/admin/AgentManagementPanel.tsx` - Add Builder button

## Success Criteria

### LangGraph Integration
1. Agent uses admin-configured LLM (not hardcoded)
2. Changing agent model in admin takes effect on next review
3. LangGraph reasoning loop works with tool calls
4. Streaming shows real-time agent thinking
5. Human-in-the-loop pause works for approval
6. Built-in agent auto-seeds on startup
7. Multiple providers supported (Anthropic, OpenAI, NEAR AI, local)

### Agent Builder
8. Can create new agent via wizard with all fields
9. Personality fields (bio, lore, knowledge, style) persist correctly
10. Tools can be assigned from registry
11. System prompt preview updates in real-time
12. Test chat sends message and shows response
13. Deployed agent appears in agent list and can be assigned to documents

## Notes

- Keep existing rule-based tools as the "action" layer - LLM just decides when to call them
- Cache LLM instances per agent config hash to avoid recreation overhead
- Rate limiting should respect `LLMProviderConfig.maxRequestsPerMinute`
- Audit all LLM calls with agent ID, tokens used, cost estimate

## Dependencies

This plan assumes completion of:
- 4-11: Review agent definition, tools, API endpoints
- 4.2: Agent registry infrastructure

## Agent Builder Architecture

The Agent Builder provides a complete workflow for creating, configuring, and deploying new agents.

### Builder Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Agent Builder Wizard                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Step 1: Identity          │  Step 2: Personality      │  Step 3: Tools     │
│  ─────────────────         │  ─────────────────────    │  ─────────────     │
│  • Agent ID (auto)         │  • Bio (array)            │  • Select tools    │
│  • Display Name            │  • Lore/backstory         │  • Configure perms │
│  • Description             │  • Knowledge entries      │  • Test tool calls │
│  • Type/Phase              │  • Style (all/chat/post)  │                    │
│  • Autonomy Level          │  • Adjectives             │                    │
├────────────────────────────┼───────────────────────────┼────────────────────┤
│  Step 4: LLM Config        │  Step 5: Examples         │  Step 6: Review    │
│  ─────────────────         │  ─────────────────        │  ─────────────     │
│  • Provider selection      │  • Message examples       │  • System prompt   │
│  • Model selection         │  • Few-shot pairs         │  • Config summary  │
│  • Temperature             │  • Response style demos   │  • Test chat       │
│  • Max tokens              │                           │  • Deploy          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Agent Definition Structure

```typescript
interface AgentDefinition {
  // Identity
  agentId: string;              // Auto-generated or custom
  displayName: string;
  description: string;
  type: 'governance' | 'strategic' | 'operational' | 'custom';
  phase: 'Support' | 'Represent' | 'Organize';
  maxAutonomy: AutonomyLevel;

  // Character (Eliza-compatible)
  character: {
    name: string;
    bio: string[];              // Biography entries
    lore: string[];             // Backstory/history
    knowledge: string[];        // RAG-ready facts
    style: {
      all: string[];            // Universal style traits
      chat: string[];           // Chat-specific
      post: string[];           // Social/report style
    };
    adjectives: string[];       // Personality descriptors
    messageExamples: Array<{    // Few-shot examples
      role: 'user' | 'assistant';
      content: string;
    }[]>;
  };

  // Tools - which MCP tools this agent can invoke
  tools: string[];              // Tool IDs from registry
  toolPermissions: Record<string, string[]>;  // Per-tool ABAC permissions

  // LLM Configuration
  modelConfig: {
    provider: LLMProvider;
    model: string;
    temperature: number;
    maxTokens: number;
    useGlobalDefault: boolean;
  };

  // Workflow (optional - for agents that use LangGraph)
  graphId?: string;             // LangGraph workflow ID
  capabilities: string[];       // Legacy capability list
}
```

### System Prompt Generation

The builder generates a system prompt from the character definition:

```typescript
function generateSystemPrompt(agent: AgentDefinition): string {
  const { character } = agent;

  let prompt = `You are ${character.name}.\n\n`;

  // Bio
  if (character.bio.length > 0) {
    prompt += `## Background\n${character.bio.join('\n')}\n\n`;
  }

  // Lore
  if (character.lore.length > 0) {
    prompt += `## History\n${character.lore.join('\n')}\n\n`;
  }

  // Knowledge
  if (character.knowledge.length > 0) {
    prompt += `## Knowledge\n${character.knowledge.join('\n')}\n\n`;
  }

  // Style
  if (character.style.all.length > 0) {
    prompt += `## Communication Style\n${character.style.all.join('\n')}\n\n`;
  }

  // Adjectives
  if (character.adjectives.length > 0) {
    prompt += `Personality: ${character.adjectives.join(', ')}\n\n`;
  }

  // Tools section
  if (agent.tools.length > 0) {
    prompt += `## Available Tools\nYou have access to the following tools:\n`;
    // Tool descriptions populated at runtime from registry
  }

  return prompt;
}
```

## Future Extensions

- Multi-agent supervisor pattern for complex analysis
- Custom tool creation via admin UI
- Agent conversation memory (RAG integration)
- Cost tracking and budgeting per agent
- Agent templates/presets for common use cases
- Agent cloning and versioning
- A/B testing between agent configurations
