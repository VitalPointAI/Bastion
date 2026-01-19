/**
 * OpenAI-Compatible Provider
 * Implements LLMProvider interface for OpenAI and compatible APIs
 *
 * Supports: OpenAI, NEAR AI, Ollama, LocalAI, vLLM, Azure OpenAI
 * All these services implement the OpenAI-compatible chat completions API
 */

import OpenAI from 'openai';
import type { LLMProvider, LLMCompletionRequest, LLMCompletionResponse, ProviderConfig } from './types.js';

export class OpenAICompatibleProvider implements LLMProvider {
  name: string;
  private client: OpenAI;
  private model: string;

  constructor(config: ProviderConfig) {
    this.name = config.type;

    // Determine API key based on provider type
    const apiKey = config.apiKey ||
      (config.type === 'openai' ? process.env.OPENAI_API_KEY : undefined) ||
      (config.type === 'near-ai' ? process.env.NEAR_AI_API_KEY : undefined) ||
      (config.type === 'azure-openai' ? process.env.AZURE_OPENAI_API_KEY : undefined) ||
      'not-needed'; // Ollama, LocalAI, vLLM don't require API key

    // Build base URL
    let baseURL = config.baseUrl;
    if (!baseURL) {
      switch (config.type) {
        case 'openai':
          baseURL = 'https://api.openai.com/v1';
          break;
        case 'near-ai':
          baseURL = 'https://api.near.ai/v1';
          break;
        case 'ollama':
          baseURL = 'http://localhost:11434/v1';
          break;
        case 'localai':
          baseURL = 'http://localhost:8080/v1';
          break;
        case 'vllm':
          baseURL = 'http://localhost:8000/v1';
          break;
        case 'azure-openai':
          throw new Error('Azure OpenAI requires baseUrl in config');
        case 'bedrock':
          throw new Error('AWS Bedrock requires baseUrl in config (use bedrock-runtime endpoint)');
        default:
          baseURL = 'http://localhost:8080/v1';
      }
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
    this.model = config.model;
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    // OpenAI format includes system message inline
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: request.max_tokens || 4096,
      temperature: request.temperature,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      tools: request.tools?.map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })),
      tool_choice: request.tool_choice ? {
        type: 'function' as const,
        function: { name: request.tool_choice.type === 'tool' ? request.tool_choice.name : '' },
      } : undefined,
    });

    const choice = response.choices[0];
    const message = choice?.message;

    // Extract tool call if present (only function type has function property)
    const toolCall = message?.tool_calls?.[0];
    let toolUse: { name: string; input: Record<string, unknown> } | null = null;

    if (toolCall && toolCall.type === 'function') {
      toolUse = {
        name: toolCall.function.name,
        input: JSON.parse(toolCall.function.arguments),
      };
    }

    return {
      content: message?.content || null,
      tool_use: toolUse,
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0,
      },
    };
  }
}
