/**
 * COP Layer Assembler.
 *
 * Merges multiple sub-agent layer specs into a single assembled COPLayerSpec.
 * Handles deduplication of symbols by entityId (keeps highest confidence),
 * concatenation of control measures and annotations, and union of temporal phases.
 */
import type { COPLayerSpec, COPSymbolSpec, COPPhaseSpec } from './layer-types.js';

export class LayerAssembler {
  /**
   * Assemble multiple sub-agent specs into a single merged spec.
   *
   * - Symbols: concatenate and deduplicate by entityId (keep highest confidence)
   * - Control measures: concatenate (no dedup -- different types)
   * - Custom annotations: concatenate
   * - Temporal phases: merge by phaseNumber (union, first-seen wins on collision)
   * - Metadata: set generatedBy to coordinator, union sourceDocumentIds
   */
  assemble(subAgentSpecs: COPLayerSpec[]): COPLayerSpec {
    if (subAgentSpecs.length === 0) {
      throw new Error('Cannot assemble empty spec list');
    }

    // Use first spec as base for layerId, layerType, workspaceId, sectionId
    const base = subAgentSpecs[0];

    // Merge symbols with dedup by entityId
    const symbolMap = new Map<string, COPSymbolSpec>();
    for (const spec of subAgentSpecs) {
      for (const symbol of spec.symbols) {
        const existing = symbolMap.get(symbol.entityId);
        if (!existing || symbol.confidence > existing.confidence) {
          symbolMap.set(symbol.entityId, symbol);
        }
      }
    }

    // Concatenate control measures
    const controlMeasures = subAgentSpecs.flatMap(s => s.controlMeasures);

    // Concatenate custom annotations
    const customAnnotations = subAgentSpecs.flatMap(s => s.customAnnotations);

    // Merge temporal phases by phaseNumber (union)
    const phaseMap = new Map<number, COPPhaseSpec>();
    for (const spec of subAgentSpecs) {
      for (const phase of spec.temporalPhases) {
        if (!phaseMap.has(phase.phaseNumber)) {
          phaseMap.set(phase.phaseNumber, phase);
        }
      }
    }
    const temporalPhases = Array.from(phaseMap.values()).sort(
      (a, b) => a.phaseNumber - b.phaseNumber,
    );

    // Union of source document IDs
    const sourceDocIds = new Set<string>();
    for (const spec of subAgentSpecs) {
      for (const docId of spec.metadata.sourceDocumentIds) {
        sourceDocIds.add(docId);
      }
    }

    return {
      layerId: base.layerId,
      layerType: base.layerType,
      workspaceId: base.workspaceId,
      sectionId: base.sectionId,
      symbols: Array.from(symbolMap.values()),
      controlMeasures,
      customAnnotations,
      temporalPhases,
      metadata: {
        generatedBy: 'cop-coordinator-001',
        generatedAt: new Date().toISOString(),
        sourceDocumentIds: Array.from(sourceDocIds),
        ccoValidated: subAgentSpecs.every(s => s.metadata.ccoValidated),
      },
    };
  }
}
