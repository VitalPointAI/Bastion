/**
 * Strategic Objective Extraction Module
 * LLM-powered extraction with multi-provider support
 *
 * Supported providers:
 * - Anthropic Claude (default)
 * - OpenAI GPT models
 * - NEAR AI
 * - Ollama (local)
 * - LocalAI (local)
 * - vLLM (local)
 * - Azure OpenAI
 * - AWS Bedrock
 *
 * Exports:
 * - ExtractionService for document processing
 * - Provider factory and types
 * - Zod schemas for validation
 * - TypeScript types
 *
 * @example
 * // Use default Anthropic provider
 * const service = new ExtractionService();
 *
 * @example
 * // Use Ollama for local extraction
 * const service = new ExtractionService({
 *   provider: { type: 'ollama', model: 'llama3.2' }
 * });
 *
 * @example
 * // Use NEAR AI
 * const service = new ExtractionService({
 *   provider: { type: 'near-ai', model: 'qwen2.5-72b-instruct', apiKey: process.env.NEAR_AI_API_KEY }
 * });
 */

// Service
export { ExtractionService } from './extractor.js';

// Provider factory and types
export {
  createProvider,
  getDefaultConfig,
  DEFAULT_CONFIGS,
  AnthropicProvider,
  OpenAICompatibleProvider,
} from './providers/index.js';

export type {
  LLMProvider,
  LLMMessage,
  LLMToolDefinition,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMToolUse,
  ProviderType,
  ProviderConfig,
} from './providers/types.js';

// Schemas
export {
  ExtractedObjectiveSchema,
  ChunkExtractionResultSchema,
  DocumentExtractionResultSchema,
} from './schemas.js';

// Types
export type {
  ExtractedObjective,
  ChunkExtractionResult,
  DocumentExtractionResult,
  ExtractionAuditEntry,
  ExtractionConfig,
  ExtractionResult,
  ExtractionProgress,
  ExtractionProgressCallback,
} from './types.js';
