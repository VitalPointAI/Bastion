/**
 * COP Coordinator - LangGraph StateGraph Orchestrator
 *
 * Orchestrates COP layer generation by routing to domain sub-agents,
 * collecting results, assembling layers, validating CCO compliance,
 * and persisting draft layers.
 *
 * Follows the existing StrategyReviewerState LangGraph pattern from
 * backend/src/agents/langgraph/state.ts.
 */

import { Annotation, StateGraph, END } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import { HumanMessage } from '@langchain/core/messages';

import type { COPLayerSpec } from '../layers/layer-types.js';
import type { COPLayer } from '../layers/layer-store.js';
import { layerStore } from '../layers/layer-store.js';
import { LayerAssembler } from '../layers/layer-assembler.js';
import { validateCCOClass, suggestCCOClass } from '../cco/cco-validator.js';
import { copEventBus } from '../messaging/event-bus.js';
import { EntityLinker } from '../linkage/entity-linker.js';

import type { SubAgentInput } from './layer-sub-agents/sub-agent-types.js';
import { forceDispositionAgent } from './layer-sub-agents/force-disposition.js';
import { objectivesOverlayAgent } from './layer-sub-agents/objectives-overlay.js';
import { controlMeasuresAgent } from './layer-sub-agents/control-measures.js';
import { intelOverlayAgent } from './layer-sub-agents/intel-overlay.js';
import { logisticsOverlayAgent } from './layer-sub-agents/logistics-overlay.js';
import { c2OverlayAgent } from './layer-sub-agents/c2-overlay.js';

// ---------------------------------------------------------------------------
// Sub-agent registry
// ---------------------------------------------------------------------------

type TriggerType = 'commit' | 'manual' | 'polling';

const SUB_AGENT_MAP: Record<string, (input: SubAgentInput) => Promise<COPLayerSpec>> = {
  force_disposition: forceDispositionAgent,
  objectives: objectivesOverlayAgent,
  control_measures: controlMeasuresAgent,
  intel: intelOverlayAgent,
  logistics: logisticsOverlayAgent,
  c2: c2OverlayAgent,
};

const ALL_AGENT_KEYS = Object.keys(SUB_AGENT_MAP);

// ---------------------------------------------------------------------------
// State Definition
// ---------------------------------------------------------------------------

/**
 * COP Coordinator State using LangGraph Annotation.Root pattern.
 */
export const COPCoordinatorState = Annotation.Root({
  workspaceId: Annotation<string>,
  sectionId: Annotation<string>,
  triggeredBy: Annotation<TriggerType>,
  triggerContext: Annotation<Record<string, unknown>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  layerSpecs: Annotation<COPLayerSpec[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  assembledLayer: Annotation<COPLayer | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  status: Annotation<'routing' | 'generating' | 'assembling' | 'validating' | 'complete' | 'error'>({
    reducer: (_prev, next) => next,
    default: () => 'routing' as const,
  }),
  errors: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  /** Internal: which sub-agents to invoke (set by route node) */
  targetAgents: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => ALL_AGENT_KEYS,
  }),
  /** Internal: documents to pass to sub-agents */
  documents: Annotation<SubAgentInput['documents']>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  /** Internal: graph entities to pass to sub-agents */
  graphEntities: Annotation<SubAgentInput['graphEntities']>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
});

export type COPCoordinatorStateType = typeof COPCoordinatorState.State;

// ---------------------------------------------------------------------------
// Graph Nodes
// ---------------------------------------------------------------------------

/**
 * Node 1: Route - Determine which sub-agents to invoke based on trigger context.
 */
async function routeNode(
  state: COPCoordinatorStateType,
): Promise<Partial<COPCoordinatorStateType>> {
  copEventBus.emit('agent:activity', {
    agentId: 'cop-coordinator-001',
    action: 'routing',
    detail: `Routing generation request (trigger: ${state.triggeredBy})`,
    workspaceId: state.workspaceId,
    sectionId: state.sectionId,
    timestamp: new Date().toISOString(),
  });

  // Determine target agents from trigger context
  const contextTargets = state.triggerContext.targetAgents as string[] | undefined;
  const targetAgents = contextTargets && contextTargets.length > 0
    ? contextTargets.filter(a => ALL_AGENT_KEYS.includes(a))
    : ALL_AGENT_KEYS;

  return {
    status: 'routing',
    targetAgents,
    messages: [new HumanMessage(`Routing to ${targetAgents.length} sub-agents: ${targetAgents.join(', ')}`)],
  };
}

/**
 * Node 2: Generate Layers - Invoke sub-agents in parallel.
 */
async function generateLayersNode(
  state: COPCoordinatorStateType,
): Promise<Partial<COPCoordinatorStateType>> {
  copEventBus.emit('agent:activity', {
    agentId: 'cop-coordinator-001',
    action: 'generating',
    detail: `Invoking ${state.targetAgents.length} sub-agents in parallel`,
    workspaceId: state.workspaceId,
    sectionId: state.sectionId,
    timestamp: new Date().toISOString(),
  });

  const subAgentInput: SubAgentInput = {
    workspaceId: state.workspaceId,
    sectionId: state.sectionId,
    documents: state.documents,
    graphEntities: state.graphEntities,
  };

  // Invoke selected sub-agents in parallel with 30s timeout each
  const promises = state.targetAgents.map(async (agentKey) => {
    const agentFn = SUB_AGENT_MAP[agentKey];
    if (!agentFn) {
      return { status: 'rejected' as const, reason: `Unknown agent: ${agentKey}` };
    }

    copEventBus.emit('agent:activity', {
      agentId: `cop-${agentKey}`,
      action: 'start',
      detail: `Sub-agent ${agentKey} starting extraction`,
      workspaceId: state.workspaceId,
      sectionId: state.sectionId,
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await Promise.race([
        agentFn(subAgentInput),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Sub-agent ${agentKey} timed out`)), 30_000),
        ),
      ]);

      copEventBus.emit('agent:activity', {
        agentId: `cop-${agentKey}`,
        action: 'complete',
        detail: `Sub-agent ${agentKey} completed with ${result.symbols.length} symbols`,
        workspaceId: state.workspaceId,
        sectionId: state.sectionId,
        timestamp: new Date().toISOString(),
      });

      return { status: 'fulfilled' as const, value: result };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return { status: 'rejected' as const, reason: errorMsg };
    }
  });

  const results = await Promise.all(promises);

  const specs: COPLayerSpec[] = [];
  const errors: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      specs.push(result.value);
    } else {
      errors.push(`${state.targetAgents[i]}: ${result.reason}`);
    }
  }

  return {
    status: 'generating',
    layerSpecs: specs,
    errors,
    messages: [new HumanMessage(`Generated ${specs.length} layer specs, ${errors.length} errors`)],
  };
}

/**
 * Node 3: Assemble - Merge sub-agent outputs into a single spec.
 */
async function assembleNode(
  state: COPCoordinatorStateType,
): Promise<Partial<COPCoordinatorStateType>> {
  if (state.layerSpecs.length === 0) {
    return {
      status: 'error',
      errors: ['No layer specs produced by any sub-agent'],
      messages: [new HumanMessage('Assembly skipped: no specs to assemble')],
    };
  }

  copEventBus.emit('agent:activity', {
    agentId: 'cop-coordinator-001',
    action: 'assembling',
    detail: `Assembling ${state.layerSpecs.length} sub-agent specs`,
    workspaceId: state.workspaceId,
    sectionId: state.sectionId,
    timestamp: new Date().toISOString(),
  });

  const assembler = new LayerAssembler();
  const _assembled = assembler.assemble(state.layerSpecs);

  return {
    status: 'assembling',
    messages: [new HumanMessage(`Assembled ${_assembled.symbols.length} symbols, ${_assembled.controlMeasures.length} control measures`)],
  };
}

/**
 * Node 4: Validate CCO - Validate all symbols have valid CCO classes.
 */
async function validateCCONode(
  state: COPCoordinatorStateType,
): Promise<Partial<COPCoordinatorStateType>> {
  if (state.layerSpecs.length === 0) {
    return { status: 'error' };
  }

  copEventBus.emit('agent:activity', {
    agentId: 'cop-coordinator-001',
    action: 'validating',
    detail: 'Validating CCO classes for all symbols',
    workspaceId: state.workspaceId,
    sectionId: state.sectionId,
    timestamp: new Date().toISOString(),
  });

  // Re-assemble to get final spec
  const assembler = new LayerAssembler();
  const assembled = assembler.assemble(state.layerSpecs);

  const validationErrors: string[] = [];

  for (const symbol of assembled.symbols) {
    const result = validateCCOClass(symbol.ccoClass);
    if (!result.valid) {
      // Attempt to fix by suggesting a class
      const suggested = suggestCCOClass(symbol.designation, {
        entityId: symbol.entityId,
        affiliation: symbol.affiliation,
      });
      symbol.ccoClass = suggested;
      validationErrors.push(
        `Symbol ${symbol.entityId} had invalid CCO class, replaced with ${suggested}`,
      );
    }
  }

  return {
    status: 'validating',
    errors: validationErrors,
    messages: [new HumanMessage(
      validationErrors.length > 0
        ? `CCO validation: ${validationErrors.length} classes corrected`
        : 'CCO validation: all classes valid',
    )],
  };
}

/**
 * Node 5: Persist - Create draft layer and run entity linkage.
 */
async function persistNode(
  state: COPCoordinatorStateType,
): Promise<Partial<COPCoordinatorStateType>> {
  if (state.status === 'error' && state.layerSpecs.length === 0) {
    // Persist with error status
    copEventBus.emit('layer:generation:complete', {
      layerId: 'none',
      status: 'error',
      error: state.errors.join('; '),
    });

    return {
      status: 'error',
      assembledLayer: null,
      messages: [new HumanMessage('Persist skipped: no specs available')],
    };
  }

  copEventBus.emit('agent:activity', {
    agentId: 'cop-coordinator-001',
    action: 'persisting',
    detail: 'Creating draft layer and running entity linkage',
    workspaceId: state.workspaceId,
    sectionId: state.sectionId,
    timestamp: new Date().toISOString(),
  });

  // Final assembly
  const assembler = new LayerAssembler();
  const assembled = assembler.assemble(state.layerSpecs);

  // Create draft layer
  const layer = await layerStore.createLayer({
    workspaceId: state.workspaceId,
    sectionId: state.sectionId,
    layerType: 'force_disposition', // Primary layer type
    spec: assembled,
  });

  // Run entity linkage (best-effort, don't fail on linkage errors)
  try {
    // EntityLinker requires Neo4j driver and embeddings -- will be initialized
    // by the caller or skipped if not available
    if (state.triggerContext._entityLinker) {
      const linker = state.triggerContext._entityLinker as EntityLinker;
      await linker.discoverLinkages(state.workspaceId, assembled.symbols);
    }
  } catch {
    // Non-fatal: linkage discovery failed
  }

  copEventBus.emit('layer:generation:complete', {
    layerId: layer.id,
    status: 'success',
  });

  return {
    status: 'complete',
    assembledLayer: layer,
    messages: [new HumanMessage(`Layer ${layer.id} created as draft`)],
  };
}

// ---------------------------------------------------------------------------
// Conditional edge: skip to persist with error if zero specs
// ---------------------------------------------------------------------------

function shouldSkipToError(state: COPCoordinatorStateType): string {
  if (state.layerSpecs.length === 0 && state.errors.length > 0) {
    return 'persist';
  }
  return 'assemble';
}

// ---------------------------------------------------------------------------
// Graph Construction
// ---------------------------------------------------------------------------

const workflow = new StateGraph(COPCoordinatorState)
  .addNode('route', routeNode)
  .addNode('generate_layers', generateLayersNode)
  .addNode('assemble', assembleNode)
  .addNode('validate_cco', validateCCONode)
  .addNode('persist', persistNode)
  .addEdge('__start__', 'route')
  .addEdge('route', 'generate_layers')
  .addConditionalEdges('generate_layers', shouldSkipToError, {
    assemble: 'assemble',
    persist: 'persist',
  })
  .addEdge('assemble', 'validate_cco')
  .addEdge('validate_cco', 'persist')
  .addEdge('persist', END);

/**
 * Compiled COP Coordinator StateGraph.
 */
export const copCoordinatorGraph = workflow.compile();

// ---------------------------------------------------------------------------
// Convenience function
// ---------------------------------------------------------------------------

/**
 * Run COP layer generation for a workspace section.
 *
 * @param workspaceId - Workspace to generate for
 * @param sectionId - Section scope
 * @param triggeredBy - What triggered this generation
 * @param context - Optional trigger context (targetAgents, documents, etc.)
 * @returns The assembled COPLayer or null on error
 */
export async function runCOPGeneration(
  workspaceId: string,
  sectionId: string,
  triggeredBy: TriggerType,
  context?: Record<string, unknown>,
): Promise<COPLayer | null> {
  const result = await copCoordinatorGraph.invoke({
    workspaceId,
    sectionId,
    triggeredBy,
    triggerContext: context || {},
    documents: (context?.documents as SubAgentInput['documents']) || [],
    graphEntities: (context?.graphEntities as SubAgentInput['graphEntities']) || [],
  });

  return result.assembledLayer;
}
