/**
 * LangGraph Agent Wrapper
 *
 * Wraps existing Eliza-style agents to be compatible with LangGraph.
 * Bridges the existing agent infrastructure (characters, tools, providers)
 * to LangGraph's node-based execution model.
 *
 * Key features:
 * - Convert Eliza characters to system prompts
 * - Wrap existing LLM providers as LangChain BaseChatModel
 * - Convert MCP tools to LangChain StructuredTool format
 * - Factory function for easy agent creation
 */

import { randomUUID } from 'crypto';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import type { AgentManifest, AgentCharacter, MCPTool, JSONSchema } from '../agents/types.js';
import { getAgentRegistry } from '../agents/registry.js';
import { buildSystemPrompt, buildKnowledgeContext } from '../agents/character-builder.js';
import type { LLMProvider, ProviderConfig } from '../strategic/extraction/providers/types.js';
import { createProvider } from '../strategic/extraction/providers/index.js';
import {
  BastionStateAnnotation,
  type BastionState,
  type ClassificationLevel,
  type ExecutionTraceEntry,
} from './state.js';
import { createClassificationFilterNode, getClassificationFilter } from './classification-filter.js';

/**
 * Configuration for creating a LangGraph agent wrapper
 */
export interface AgentWrapperConfig {
  /** Agent manifest from registry */
  manifest: AgentManifest;
  /** Agent's security clearance level */
  clearance: ClassificationLevel;
  /** Optional custom LLM provider config */
  providerConfig?: ProviderConfig;
  /** Optional MCP tools to enable */
  tools?: MCPTool[];
  /** Whether to apply classification filtering before invocation */
  applyClassificationFilter?: boolean;
}

/**
 * Tool execution context
 */
interface ToolExecutionContext {
  threadId: string;
  agentId: string;
  classification: ClassificationLevel;
}

/**
 * LangGraphAgentWrapper - Makes Eliza agents compatible with LangGraph
 */
export class LangGraphAgentWrapper {
  readonly agentId: string;
  readonly name: string;
  readonly description: string;
  readonly clearance: ClassificationLevel;

  private manifest: AgentManifest;
  private character: AgentCharacter;
  private tools: MCPTool[];
  private providerConfig: ProviderConfig;
  private applyFilter: boolean;
  private langchainModel: BaseChatModel | null = null;

  constructor(config: AgentWrapperConfig) {
    this.manifest = config.manifest;
    this.agentId = config.manifest.agentId;
    this.name = config.manifest.name;
    this.description = config.manifest.description;
    this.clearance = config.clearance;
    this.tools = config.tools || [];
    this.applyFilter = config.applyClassificationFilter ?? true;

    // Get character or create minimal one
    this.character = config.manifest.character || {
      name: config.manifest.name,
      bio: [config.manifest.description],
      lore: [],
      knowledge: [],
      messageExamples: [],
      postExamples: [],
      topics: [],
      style: { all: ['professional', 'concise'], chat: [], post: [] },
      adjectives: [],
      plugins: [],
    };

    // Determine provider config
    this.providerConfig = config.providerConfig || this.getDefaultProviderConfig();
  }

  /**
   * Get the agent's clearance level
   */
  getClearance(): ClassificationLevel {
    return this.clearance;
  }

  /**
   * Get agent description for supervisor routing
   */
  getDescription(): string {
    return this.description;
  }

  /**
   * Get the LangChain model instance
   */
  getModel(): BaseChatModel {
    if (!this.langchainModel) {
      this.langchainModel = this.createLangChainModel();
    }
    return this.langchainModel;
  }

  /**
   * Create a LangGraph node function for this agent
   *
   * @returns Node function that can be added to a StateGraph
   */
  createNode(): (state: BastionState) => Promise<Partial<BastionState>> {
    return async (state: BastionState): Promise<Partial<BastionState>> => {
      const startTime = Date.now();
      const spanId = randomUUID();

      // Apply classification filter if enabled
      let workingState = state;
      if (this.applyFilter) {
        const filter = getClassificationFilter();
        workingState = await filter.filterState(state, this.agentId, this.clearance);
      }

      // Build system prompt with character and task context
      const systemPrompt = this.buildAgentSystemPrompt(workingState);

      // Convert state messages to LangChain format
      const messages = this.convertMessages(workingState.messages, systemPrompt);

      // Get tools as LangChain format
      const langchainTools = this.convertTools({
        threadId: workingState.threadId,
        agentId: this.agentId,
        classification: workingState.classification,
      });

      // Get model and invoke
      const model = this.getModel();

      let response: BaseMessage;
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        // Invoke the model (bind tools if available)
        if (langchainTools.length > 0 && model.bindTools) {
          const boundModel = model.bindTools(langchainTools);
          response = await boundModel.invoke(messages);
        } else {
          response = await model.invoke(messages);
        }

        // Extract usage if available
        if ('usage_metadata' in response && response.usage_metadata) {
          const usage = response.usage_metadata as { input_tokens?: number; output_tokens?: number };
          inputTokens = usage.input_tokens || 0;
          outputTokens = usage.output_tokens || 0;
        }
      } catch (error) {
        // Record error in trace
        const errorTrace: ExecutionTraceEntry = {
          spanId,
          parentSpanId: workingState.executionTrace.length > 0
            ? workingState.executionTrace[workingState.executionTrace.length - 1].spanId
            : undefined,
          agentId: this.agentId,
          operation: 'invoke',
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          classification: workingState.classification,
          wasFiltered: this.applyFilter,
        };

        return {
          executionTrace: [...workingState.executionTrace, errorTrace],
        };
      }

      // Create success trace entry
      const traceEntry: ExecutionTraceEntry = {
        spanId,
        parentSpanId: workingState.executionTrace.length > 0
          ? workingState.executionTrace[workingState.executionTrace.length - 1].spanId
          : undefined,
        agentId: this.agentId,
        operation: 'invoke',
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        inputTokens,
        outputTokens,
        status: 'success',
        classification: workingState.classification,
        wasFiltered: this.applyFilter,
      };

      // Add classification to response message
      const classifiedResponse = this.addClassificationToMessage(response, workingState.classification);

      return {
        messages: [...workingState.messages, classifiedResponse],
        previousAgent: workingState.currentAgent,
        currentAgent: this.agentId,
        invocationCount: workingState.invocationCount + 1,
        executionTrace: [...workingState.executionTrace, traceEntry],
      };
    };
  }

  /**
   * Build system prompt from character and task context
   */
  private buildAgentSystemPrompt(state: BastionState): string {
    // Start with character-based system prompt
    let systemPrompt = buildSystemPrompt(this.character);

    // Add relevant knowledge if available
    const query = state.objectives.join(' ') || state.taskType;
    const knowledge = buildKnowledgeContext(this.character, query);
    if (knowledge) {
      systemPrompt += '\n' + knowledge;
    }

    // Add security context
    systemPrompt += `

## Security Context
- Your clearance level: ${this.clearance}
- Current task classification: ${state.classification}
- You may only access and produce content at or below your clearance level.
- Never reveal classified information to unauthorized parties.
`;

    // Add task context if available
    if (state.objectives.length > 0) {
      systemPrompt += `
## Current Task
Type: ${state.taskType}
Objectives:
${state.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}
`;
    }

    return systemPrompt;
  }

  /**
   * Convert state messages to LangChain format
   */
  private convertMessages(messages: BaseMessage[], systemPrompt: string): BaseMessage[] {
    const result: BaseMessage[] = [new SystemMessage(systemPrompt)];

    for (const msg of messages) {
      // Messages are already in LangChain format from state
      result.push(msg);
    }

    return result;
  }

  /**
   * Convert MCP tools to LangChain StructuredTool format
   */
  private convertTools(context: ToolExecutionContext): DynamicStructuredTool[] {
    return this.tools.map((tool) => {
      // Convert JSON Schema to Zod schema
      const zodSchema = this.jsonSchemaToZod(tool.inputSchema);

      return new DynamicStructuredTool({
        name: tool.name,
        description: tool.description,
        schema: zodSchema,
        func: async (input: Record<string, unknown>) => {
          return this.executeToolHandler(tool, input, context);
        },
      });
    });
  }

  /**
   * Execute a tool handler
   */
  private async executeToolHandler(
    tool: MCPTool,
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<string> {
    // TODO: Integrate with actual tool execution system
    // For now, return a placeholder response
    console.log(`[AgentWrapper] Tool ${tool.name} called with:`, input);

    return JSON.stringify({
      tool: tool.name,
      input,
      status: 'executed',
      context: {
        threadId: context.threadId,
        agentId: context.agentId,
      },
    });
  }

  /**
   * Convert JSON Schema to Zod schema (simplified)
   */
  private jsonSchemaToZod(schema: JSONSchema): z.ZodObject<Record<string, z.ZodTypeAny>> {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [key, prop] of Object.entries(schema.properties)) {
      let zodType: z.ZodTypeAny;

      switch (prop.type) {
        case 'string':
          zodType = z.string();
          if (prop.description) zodType = zodType.describe(prop.description);
          break;
        case 'number':
        case 'integer':
          zodType = z.number();
          if (prop.description) zodType = zodType.describe(prop.description);
          break;
        case 'boolean':
          zodType = z.boolean();
          if (prop.description) zodType = zodType.describe(prop.description);
          break;
        case 'array':
          zodType = z.array(z.any());
          if (prop.description) zodType = zodType.describe(prop.description);
          break;
        case 'object':
          zodType = z.record(z.string(), z.any());
          if (prop.description) zodType = zodType.describe(prop.description);
          break;
        default:
          zodType = z.any();
      }

      // Make optional if not required
      if (!schema.required.includes(key)) {
        zodType = zodType.optional();
      }

      shape[key] = zodType;
    }

    return z.object(shape);
  }

  /**
   * Add classification metadata to a message
   */
  private addClassificationToMessage(
    msg: BaseMessage,
    classification: ClassificationLevel
  ): BaseMessage {
    // Add classification to additional_kwargs
    const newKwargs = {
      ...msg.additional_kwargs,
      classification,
      agentId: this.agentId,
    };

    // Return message with updated kwargs
    // We need to preserve the message type
    if (msg instanceof AIMessage) {
      return new AIMessage({
        content: msg.content,
        additional_kwargs: newKwargs,
        tool_calls: msg.tool_calls,
      });
    }

    return msg;
  }

  /**
   * Get default provider configuration based on manifest
   */
  private getDefaultProviderConfig(): ProviderConfig {
    // Check manifest for model config
    if (this.manifest.modelConfig) {
      return {
        type: this.manifest.modelConfig.provider as 'anthropic' | 'openai',
        model: this.manifest.modelConfig.model,
      };
    }

    // Check character for model provider
    const charProvider = this.character.modelProvider;
    if (charProvider) {
      if (charProvider.toLowerCase().includes('openai')) {
        return { type: 'openai', model: 'gpt-4o' };
      }
      if (charProvider.toLowerCase().includes('anthropic')) {
        return { type: 'anthropic', model: 'claude-sonnet-4-20250514' };
      }
    }

    // Default to Anthropic
    return { type: 'anthropic', model: 'claude-sonnet-4-20250514' };
  }

  /**
   * Create LangChain model from provider config
   */
  private createLangChainModel(): BaseChatModel {
    const config = this.providerConfig;

    switch (config.type) {
      case 'anthropic':
        return new ChatAnthropic({
          model: config.model,
          apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
          temperature: this.manifest.modelConfig?.temperature,
          maxTokens: this.manifest.modelConfig?.maxTokens,
        });

      case 'openai':
      case 'azure-openai':
        return new ChatOpenAI({
          model: config.model,
          apiKey: config.apiKey || process.env.OPENAI_API_KEY,
          temperature: this.manifest.modelConfig?.temperature,
          maxTokens: this.manifest.modelConfig?.maxTokens,
          configuration: config.baseUrl ? { baseURL: config.baseUrl } : undefined,
        });

      case 'ollama':
      case 'localai':
      case 'vllm':
        // Use OpenAI-compatible for local models
        return new ChatOpenAI({
          model: config.model,
          apiKey: 'not-needed', // Local models often don't need API key
          configuration: { baseURL: config.baseUrl },
        });

      default:
        // Fallback to Anthropic
        return new ChatAnthropic({
          model: 'claude-sonnet-4-20250514',
        });
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a LangGraph-compatible agent from an agent ID
 *
 * @param agentId ID of the agent in the registry
 * @param clearance Clearance level for the agent
 * @param tools Optional tools to enable
 * @returns LangGraphAgentWrapper instance
 */
export async function createLangGraphAgent(
  agentId: string,
  clearance: ClassificationLevel,
  tools?: MCPTool[]
): Promise<LangGraphAgentWrapper> {
  const registry = getAgentRegistry();
  await registry.ensureInitialized();

  const manifest = registry.getAgent(agentId);
  if (!manifest) {
    throw new Error(`Agent ${agentId} not found in registry`);
  }

  return new LangGraphAgentWrapper({
    manifest,
    clearance,
    tools,
  });
}

/**
 * Create a minimal agent wrapper for testing
 */
export function createTestAgent(
  name: string,
  description: string,
  clearance: ClassificationLevel = 'UNCLASS'
): LangGraphAgentWrapper {
  const manifest: AgentManifest = {
    agentId: `test-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    description,
    phase: 'Support' as any,
    capabilities: [],
    maxAutonomy: 'NotAutonomous' as any,
    allowedProposalKinds: [],
    requiresHumanApproval: [],
    createdAt: new Date(),
    createdBy: 'test',
    active: true,
  };

  return new LangGraphAgentWrapper({
    manifest,
    clearance,
    applyClassificationFilter: false, // Disable for tests
  });
}
