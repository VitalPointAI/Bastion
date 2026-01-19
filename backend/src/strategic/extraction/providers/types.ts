/**
 * LLM Provider Abstraction
 * Enables multi-provider support: Anthropic, OpenAI, Ollama, LocalAI, vLLM, etc.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  tool_choice?: { type: 'tool'; name: string } | { type: 'auto' };
  max_tokens?: number;
  temperature?: number;
}

export interface LLMToolUse {
  name: string;
  input: Record<string, unknown>;
}

export interface LLMCompletionResponse {
  content: string | null;
  tool_use: LLMToolUse | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface LLMProvider {
  name: string;
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
}

export type ProviderType = 'anthropic' | 'openai' | 'near-ai' | 'ollama' | 'localai' | 'vllm' | 'azure-openai' | 'bedrock';

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;        // Cloud providers
  baseUrl?: string;       // Self-hosted (Ollama, LocalAI, vLLM)
  model: string;          // Model name/ID
  maxRetries?: number;
  timeout?: number;       // Request timeout in ms
}
