/**
 * Anthropic Provider
 * Implements LLMProvider interface for Anthropic Claude models
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMContentBlock,
  ProviderConfig,
} from './types.js';

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(config: ProviderConfig) {
    const key = config.apiKey || process.env.ANTHROPIC_API_KEY;
    const isOAuth = key?.startsWith('sk-ant-oat');

    if (!key) {
      throw new Error('Anthropic API key required: set apiKey in config or ANTHROPIC_API_KEY env var');
    }

    if (isOAuth) {
      // OAuth tokens use Authorization: Bearer + beta header
      this.client = new Anthropic({
        authToken: key,
        defaultHeaders: { 'anthropic-beta': 'oauth-2025-04-20' },
      });
    } else {
      this.client = new Anthropic({ apiKey: key });
    }
    this.model = config.model || 'claude-sonnet-4-20250514';
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    // Extract system message
    const systemMessage = request.messages.find(m => m.role === 'system');
    const nonSystemMessages = request.messages.filter(m => m.role !== 'system');

    // Build Anthropic-specific request
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.max_tokens || 4096,
      system: typeof systemMessage?.content === 'string' ? systemMessage.content : '',
      messages: nonSystemMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string'
          ? m.content
          : (m.content as LLMContentBlock[]).map((block) => {
              if (block.type === 'text') {
                return { type: 'text' as const, text: block.text };
              }
              if (block.type === 'document') {
                return {
                  type: 'document' as const,
                  source: {
                    type: 'base64' as const,
                    media_type: block.source.media_type as 'application/pdf',
                    data: block.source.data,
                  },
                };
              }
              // image block
              return {
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  media_type: block.source.media_type as Anthropic.Base64ImageSource['media_type'],
                  data: block.source.data,
                },
              };
            }),
      })),
      tools: request.tools?.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
      })),
      tool_choice: request.tool_choice,
    });

    // Extract tool use if present
    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    return {
      content: textBlock?.text || null,
      tool_use: toolUseBlock ? {
        name: toolUseBlock.name,
        input: toolUseBlock.input as Record<string, unknown>,
      } : null,
      usage: {
        input_tokens: response.usage?.input_tokens || 0,
        output_tokens: response.usage?.output_tokens || 0,
      },
    };
  }
}
