/**
 * COP Coordinator - LangGraph StateGraph Orchestrator
 *
 * Orchestrates COP layer generation by routing to domain sub-agents,
 * collecting results, validating CCO compliance, and persisting
 * individual draft layers per warfighting function.
 */

import { Annotation, StateGraph, END } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import { HumanMessage } from '@langchain/core/messages';

import type { COPLayerSpec } from '../layers/layer-types.js';
import type { COPLayer } from '../layers/layer-store.js';
import { layerStore } from '../layers/layer-store.js';
import { validateCCOClass, suggestCCOClass } from '../cco/cco-validator.js';
import { copEventBus } from '../messaging/event-bus.js';
import { EntityLinker } from '../linkage/entity-linker.js';

import type { SubAgentInput, SemanticEntity } from './layer-sub-agents/sub-agent-types.js';
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
  assembledLayers: Annotation<COPLayer[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  status: Annotation<'routing' | 'generating' | 'assembling' | 'validating' | 'complete' | 'error'>({
    reducer: (_prev, next) => next,
    default: () => 'routing' as const,
  }),
  errors: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  targetAgents: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => ALL_AGENT_KEYS,
  }),
  documents: Annotation<SubAgentInput['documents']>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  graphEntities: Annotation<SemanticEntity[]>({
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

  console.log(`[COP] Coordinator received ${state.graphEntities.length} semantic entities`);

  const subAgentInput: SubAgentInput = {
    workspaceId: state.workspaceId,
    sectionId: state.sectionId,
    documents: state.documents,
    graphEntities: state.graphEntities,
  };

  const promises = state.targetAgents.map(async (agentKey) => {
    const agentFn = SUB_AGENT_MAP[agentKey];
    if (!agentFn) {
      return { status: 'rejected' as const, reason: `Unknown agent: ${agentKey}` };
    }

    console.log(`[COP] Invoking ${agentKey} with ${subAgentInput.graphEntities.length} entities`);

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
 * Node 3: Validate CCO - Validate all symbols in each spec have valid CCO classes.
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
    detail: 'Validating CCO classes for all symbols across layer specs',
    workspaceId: state.workspaceId,
    sectionId: state.sectionId,
    timestamp: new Date().toISOString(),
  });

  const validationErrors: string[] = [];

  for (const spec of state.layerSpecs) {
    for (const symbol of spec.symbols) {
      const result = validateCCOClass(symbol.ccoClass);
      if (!result.valid) {
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
 * Node 4: Persist - Create one draft layer per sub-agent spec.
 *
 * Each warfighting function gets its own layer so users can independently
 * toggle visibility and tailor their COP view.
 */
async function persistNode(
  state: COPCoordinatorStateType,
): Promise<Partial<COPCoordinatorStateType>> {
  if (state.layerSpecs.length === 0) {
    copEventBus.emit('layer:generation:complete', {
      layerId: 'none',
      status: 'error',
      error: state.errors.join('; '),
    });

    return {
      status: 'error',
      assembledLayers: [],
      messages: [new HumanMessage('Persist skipped: no specs available')],
    };
  }

  copEventBus.emit('agent:activity', {
    agentId: 'cop-coordinator-001',
    action: 'persisting',
    detail: `Creating ${state.layerSpecs.length} individual draft layers`,
    workspaceId: state.workspaceId,
    sectionId: state.sectionId,
    timestamp: new Date().toISOString(),
  });

  const createdLayers: COPLayer[] = [];

  for (const spec of state.layerSpecs) {
    // Skip empty specs (no symbols, no control measures, no annotations)
    const hasContent = spec.symbols.length > 0 ||
      spec.controlMeasures.length > 0 ||
      (spec.customAnnotations?.length ?? 0) > 0;

    if (!hasContent) continue;

    try {
      const layer = await layerStore.createLayer({
        workspaceId: state.workspaceId,
        sectionId: state.sectionId,
        layerType: spec.layerType,
        spec,
      });
      createdLayers.push(layer);

      copEventBus.emit('agent:activity', {
        agentId: 'cop-coordinator-001',
        action: 'layer_created',
        detail: `Layer ${layer.id} (${spec.layerType}) created with ${spec.symbols.length} symbols`,
        workspaceId: state.workspaceId,
        sectionId: state.sectionId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[COP] Failed to persist ${spec.layerType} layer:`, msg);
    }
  }

  // Run entity linkage across all created layers (best-effort)
  try {
    if (state.triggerContext._entityLinker) {
      const linker = state.triggerContext._entityLinker as EntityLinker;
      for (const layer of createdLayers) {
        if (layer.spec?.symbols?.length) {
          await linker.discoverLinkages(state.workspaceId, layer.spec.symbols);
        }
      }
    }
  } catch {
    // Non-fatal: linkage discovery failed
  }

  for (const layer of createdLayers) {
    copEventBus.emit('layer:generation:complete', {
      layerId: layer.id,
      status: 'success',
    });
  }

  return {
    status: 'complete',
    assembledLayers: createdLayers,
    messages: [new HumanMessage(`${createdLayers.length} layers created as drafts`)],
  };
}

// ---------------------------------------------------------------------------
// Conditional edge: skip to persist with error if zero specs
// ---------------------------------------------------------------------------

function shouldSkipToError(state: COPCoordinatorStateType): string {
  if (state.layerSpecs.length === 0 && state.errors.length > 0) {
    return 'persist';
  }
  return 'validate_cco';
}

// ---------------------------------------------------------------------------
// Graph Construction
// ---------------------------------------------------------------------------

const workflow = new StateGraph(COPCoordinatorState)
  .addNode('route', routeNode)
  .addNode('generate_layers', generateLayersNode)
  .addNode('validate_cco', validateCCONode)
  .addNode('persist', persistNode)
  .addEdge('__start__', 'route')
  .addEdge('route', 'generate_layers')
  .addConditionalEdges('generate_layers', shouldSkipToError, {
    validate_cco: 'validate_cco',
    persist: 'persist',
  })
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
 * Creates one draft layer per warfighting function that has content.
 *
 * @returns Array of created COPLayers (one per warfighting function)
 */
export async function runCOPGeneration(
  workspaceId: string,
  sectionId: string,
  triggeredBy: TriggerType,
  context?: Record<string, unknown>,
): Promise<COPLayer[]> {
  const result = await copCoordinatorGraph.invoke({
    workspaceId,
    sectionId,
    triggeredBy,
    triggerContext: context || {},
    documents: (context?.documents as SubAgentInput['documents']) || [],
    graphEntities: (context?.graphEntities as SemanticEntity[]) || [],
  });

  return result.assembledLayers;
}
