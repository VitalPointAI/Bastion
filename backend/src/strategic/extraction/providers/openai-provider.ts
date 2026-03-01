/**
 * OpenAI-Compatible Provider
 * Implements LLMProvider interface for OpenAI and compatible APIs
 *
 * Supports: OpenAI, NEAR AI, Ollama, LocalAI, vLLM, Azure OpenAI
 * All these services implement the OpenAI-compatible chat completions API
 */

import OpenAI from 'openai';
import type { LLMProvider, LLMCompletionRequest, LLMCompletionResponse, LLMContentBlock, ProviderConfig } from './types.js';

const MAX_RETRIES = 4;
const INITIAL_BACKOFF_MS = 3000;

/**
 * Normalise an LLMMessage content value to a plain string for OpenAI-compatible APIs.
 *
 * OpenAI's chat completions API does support image_url content blocks but does NOT
 * support Anthropic-style base64 "document" blocks for PDFs. Vision map extraction
 * (Quick Task 5) always routes through the Anthropic provider, so OpenAI-compatible
 * providers simply extract any text blocks and join them. If no text blocks are found
 * (e.g. document-only content) a placeholder is returned.
 */
function normaliseContent(content: string | LLMContentBlock[]): string {
  if (typeof content === 'string') return content;
  // Extract text blocks; ignore image and document blocks (not supported here)
  const textParts = content
    .filter((b): b is Extract<LLMContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text);
  return textParts.join('\n') || '[Non-text content — not supported by this provider]';
}

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
    // Try with tools first, fall back to plain completion if tools not supported
    if (!request.tools?.length) {
      return await this.completeWithRetry(request, false);
    }

    try {
      return await this.completeWithTools(request);
    } catch (error) {
      // On any failure with tools, retry without tools — many OpenAI-compatible
      // endpoints (NEAR AI, Ollama, etc.) fail or 502 when tools are included
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[${this.name}] Tool calling failed (${message}), retrying without tools`);
      return await this.completeWithRetry(request, false);
    }
  }

  /**
   * Retry a completion with exponential backoff.
   * Handles transient 502/503/429 errors from providers like NEAR AI.
   */
  private async completeWithRetry(request: LLMCompletionRequest, withTools: boolean): Promise<LLMCompletionResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (withTools) {
          return await this.completeWithTools(request);
        } else {
          return await this.completeWithoutTools(request);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const msg = lastError.message;

        // Only retry on transient server errors
        const isTransient = msg.includes('502') || msg.includes('503')
          || msg.includes('429') || msg.includes('unavailable')
          || msg.includes('timeout') || msg.includes('ECONNRESET')
          || msg.includes('rate limit');

        if (!isTransient || attempt === MAX_RETRIES - 1) {
          throw lastError;
        }

        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(`[${this.name}] Attempt ${attempt + 1}/${MAX_RETRIES} failed (${msg}), retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }

    throw lastError!;
  }

  private async completeWithTools(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: request.max_tokens || 4096,
      temperature: request.temperature,
      messages: request.messages.map(m => ({
        role: m.role,
        content: normaliseContent(m.content),
      })),
      tools: request.tools?.map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })),
      tool_choice: request.tool_choice
        ? request.tool_choice.type === 'tool'
          ? { type: 'function' as const, function: { name: request.tool_choice.name } }
          : 'auto' as const
        : undefined,
    });

    const choice = response.choices[0];
    const message = choice?.message;

    // Extract tool call if present
    const toolCall = message?.tool_calls?.[0];
    let toolUse: { name: string; input: Record<string, unknown> } | null = null;

    if (toolCall && toolCall.type === 'function') {
      try {
        toolUse = {
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        };
      } catch {
        console.warn(`[${this.name}] Failed to parse tool call arguments as JSON`);
      }
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

  private async completeWithoutTools(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: request.max_tokens || 16384,
      temperature: request.temperature,
      messages: request.messages.map(m => ({
        role: m.role,
        content: normaliseContent(m.content),
      })),
    });

    const choice = response.choices[0];
    const message = choice?.message;

    return {
      content: message?.content || null,
      tool_use: null,
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0,
      },
    };
  }
}
