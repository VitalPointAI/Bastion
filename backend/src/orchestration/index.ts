/**
 * Orchestration Module
 *
 * LangGraph integration for multi-agent orchestration with:
 * - PostgresSaver checkpointing for state persistence
 * - Classification-aware state filtering (ABAC enforcement)
 * - Supervisor pattern for hierarchical agent coordination
 * - CrewAI-style execution patterns (sequential, parallel, hierarchical)
 * - Comprehensive observability and tracing
 * - Human-in-the-loop checkpoints for oversight
 *
 * Architecture:
 * - Wraps existing Eliza-style agents as LangGraph-compatible nodes
 * - Preserves existing DID, ABAC, and provider infrastructure
 * - State filtering happens BEFORE every agent invocation
 * - All filtering decisions are audited
 *
 * @module orchestration
 */

// Exports will be enabled as modules are implemented
// See each module for specific exports

// Placeholder to verify LangGraph imports work
import type { StateGraph } from '@langchain/langgraph';
import type { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { ChatAnthropic } from '@langchain/anthropic';
import type { ChatOpenAI } from '@langchain/openai';

// Type re-exports for verification
export type { StateGraph, PostgresSaver, ChatAnthropic, ChatOpenAI };
