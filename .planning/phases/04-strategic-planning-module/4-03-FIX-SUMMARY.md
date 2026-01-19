# 4-03-FIX Summary: LLM Provider Abstraction

**Type:** FIX
**Duration:** ~15 minutes
**Date:** 2026-01-19

## Objective

Fix UAT issue from plan 4-03: Add LLM provider abstraction layer for multi-provider support instead of hardcoded Anthropic dependency.

## What Was Built

### Provider Abstraction Layer (`backend/src/strategic/extraction/providers/`)

1. **types.ts** - Core provider interface and types
   - `LLMProvider` interface with `complete()` method
   - `LLMCompletionRequest/Response` for standardized API
   - `ProviderConfig` with type discriminator
   - Support for 8 provider types: anthropic, openai, near-ai, ollama, localai, vllm, azure-openai, bedrock

2. **anthropic-provider.ts** - Anthropic Claude provider
   - Wraps existing Anthropic SDK
   - Handles system message extraction (Anthropic-specific format)
   - Maps tool definitions to Anthropic format

3. **openai-provider.ts** - OpenAI-compatible provider
   - Single provider covering OpenAI, NEAR AI, Ollama, LocalAI, vLLM, Azure OpenAI
   - Auto-detects default base URLs per provider type
   - Maps tool calls to OpenAI function calling format

4. **index.ts** - Factory and registry
   - `createProvider()` factory function
   - `DEFAULT_CONFIGS` for all 8 providers
   - `getDefaultConfig()` helper

### ExtractionService Refactoring

- Removed direct Anthropic SDK dependency
- Now accepts `ProviderConfig` instead of model string
- Uses provider-agnostic `LLMCompletionRequest`
- Backward compatible (defaults to Anthropic)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| b00fe31 | feat | Define LLM provider interface and types |
| 216b04a | feat | Implement Anthropic provider |
| 68306d5 | feat | Implement OpenAI-compatible provider |
| 90fa1ed | feat | Create provider factory and registry |
| 5a6001c | refactor | ExtractionService uses provider abstraction |
| 37ab483 | docs | Update exports and add provider documentation |

## Key Files Changed

- `backend/src/strategic/extraction/providers/types.ts` (new)
- `backend/src/strategic/extraction/providers/anthropic-provider.ts` (new)
- `backend/src/strategic/extraction/providers/openai-provider.ts` (new)
- `backend/src/strategic/extraction/providers/index.ts` (new)
- `backend/src/strategic/extraction/extractor.ts` (modified)
- `backend/src/strategic/extraction/types.ts` (modified)
- `backend/src/strategic/extraction/index.ts` (modified)

## Usage Examples

```typescript
// Default Anthropic provider
const service = new ExtractionService();

// Use Ollama for local extraction
const service = new ExtractionService({
  provider: { type: 'ollama', model: 'llama3.2' }
});

// Use NEAR AI for private inference
const service = new ExtractionService({
  provider: { type: 'near-ai', model: 'qwen2.5-72b-instruct', apiKey: process.env.NEAR_AI_API_KEY }
});

// Use OpenAI
const service = new ExtractionService({
  provider: { type: 'openai', model: 'gpt-4o', apiKey: process.env.OPENAI_API_KEY }
});
```

## Decisions Made

1. **Single OpenAI-compatible class** - One provider covers OpenAI, NEAR AI, Ollama, LocalAI, vLLM since they all implement the OpenAI API format
2. **Type guard for tool calls** - OpenAI SDK v6.16.0 has union type for tool_calls requiring explicit type check
3. **Audit log records provider name** - Changed from model string to provider name for clarity

## Issues Resolved

- **UAT-001 (Major):** ExtractionService hardcoded to Anthropic Claude - Now supports 8 providers with factory pattern

## Deferred

None - all planned work completed.
