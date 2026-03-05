/**
 * Shared types for COP layer sub-agents.
 *
 * All sub-agents follow the same pattern: accept SubAgentInput,
 * extract domain-specific entities, and return a COPLayerSpec fragment.
 */

import type { COPSymbolSpec, COPLayerSpec } from '../../layers/layer-types.js';

/**
 * Input provided to every sub-agent by the coordinator.
 */
export interface SubAgentInput {
  workspaceId: string;
  sectionId: string;
  documents: Array<{
    id: string;
    content: string;
    type: string;
  }>;
  graphEntities: Array<{
    id: string;
    name: string;
    type: string;
    properties: Record<string, unknown>;
  }>;
  /** Symbols from other sub-agents if running sequentially */
  existingSymbols?: COPSymbolSpec[];
}

/**
 * Sub-agent function signature.
 */
export type SubAgentFn = (input: SubAgentInput) => Promise<COPLayerSpec>;

/**
 * Create an empty COPLayerSpec for error/fallback scenarios.
 */
export function createEmptyLayerSpec(
  input: SubAgentInput,
  layerType: COPLayerSpec['layerType'],
  agentId: string,
  errorMessage?: string,
): COPLayerSpec {
  return {
    layerId: `${layerType}-${input.sectionId}-${Date.now()}`,
    layerType,
    workspaceId: input.workspaceId,
    sectionId: input.sectionId,
    symbols: [],
    controlMeasures: [],
    customAnnotations: [],
    temporalPhases: [],
    metadata: {
      generatedBy: agentId,
      generatedAt: new Date().toISOString(),
      sourceDocumentIds: input.documents.map(d => d.id),
      ccoValidated: false,
      ...(errorMessage ? { error: errorMessage } as Record<string, string> : {}),
    },
  };
}
