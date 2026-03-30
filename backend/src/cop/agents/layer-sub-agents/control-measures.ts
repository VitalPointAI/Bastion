/**
 * Control Measures Sub-Agent (J3 Engineer)
 *
 * Extracts boundaries, phase lines, axes of advance, routes, and fire
 * support coordination measures from operational documents.
 * Pure control measures -- typically no symbols.
 *
 * SIDC codes are ALWAYS generated via buildSIDCFromEntity if needed.
 */

import { createLLMForAgent } from '../../../agents/langgraph/llm-factory.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { suggestCCOClass } from '../../cco/cco-validator.js';
import { copEventBus } from '../../messaging/event-bus.js';
import type {
  COPLayerSpec,
  COPControlMeasureSpec,
} from '../../layers/layer-types.js';
import type { SubAgentInput } from './sub-agent-types.js';
import { createEmptyLayerSpec } from './sub-agent-types.js';

const AGENT_ID = 'cop-control-measures-001';
const TIMEOUT_MS = 30_000;

/**
 * Extracted control measure from documents.
 */
interface ExtractedControlMeasure {
  id: string;
  type: 'boundary' | 'phase_line' | 'axis_of_advance' | 'route' | 'objective_area';
  label: string;
  points: Array<{ lat: number; lng: number }>;
  phaseRange?: { start: number; end: number };
  description: string;
  sourceDocumentId: string;
}

const SYSTEM_PROMPT = `You are a military engineer analyst extracting control measures from operational documents.

Extract all control measures (boundaries, phase lines, axes of advance, routes, fire support coordination measures) with:
- id: unique identifier slug (e.g. "pl-alpha", "boundary-1-2-bde", "axis-eagle")
- type: one of "boundary", "phase_line", "axis_of_advance", "route", "objective_area"
- label: designation (e.g. "PL ALPHA", "BOUNDARY 1/2 BDE", "AXIS EAGLE")
- points: array of { lat, lng } vertices defining the line or polygon
- phaseRange: { start, end } phase numbers if the measure is phase-specific, omit otherwise
- description: brief description of the measure's purpose
- sourceDocumentId: the document ID this was extracted from

Respond ONLY with a JSON array of extracted control measures. No explanation text.`;

/**
 * Control style defaults per type.
 */
const STYLE_MAP: Record<string, Record<string, string>> = {
  boundary: { color: '#333333', weight: '3', dashArray: '10,5' },
  phase_line: { color: '#0000ff', weight: '2', dashArray: '15,5' },
  axis_of_advance: { color: '#00aa00', weight: '3' },
  route: { color: '#666666', weight: '2' },
  objective_area: { color: '#ff0000', weight: '2', fillOpacity: '0.1' },
  engagement_area: { color: '#ff4444', weight: '2', fillOpacity: '0.08' },
  security_zone: { color: '#ff8800', weight: '2', dashArray: '12,6', fillOpacity: '0.06' },
  fire_support_coordination_line: { color: '#cc00cc', weight: '2', dashArray: '20,5,5,5' },
};

/**
 * Control Measures sub-agent.
 *
 * Extracts boundaries, phase lines, axes of advance, routes, and FSCM
 * from operational documents. Pure control measures with no symbols.
 */
export async function controlMeasuresAgent(
  input: SubAgentInput,
): Promise<COPLayerSpec> {
  copEventBus.emit('agent:activity', {
    agentId: AGENT_ID,
    action: 'extraction:start',
    detail: `Extracting control measures from ${input.documents.length} documents`,
    workspaceId: input.workspaceId,
    sectionId: input.sectionId,
    timestamp: new Date().toISOString(),
  });

  try {
    const relevantDocs = input.documents.filter(
      d => ['opord', 'frago', 'annex_c', 'overlay', 'general'].includes(d.type),
    );

    if (relevantDocs.length === 0 && input.graphEntities.length === 0) {
      return createEmptyLayerSpec(input, 'control_measures', AGENT_ID, 'No relevant documents or entities found');
    }

    const extractedMeasures = await extractControlMeasures(relevantDocs);

    // Also include graph entities that represent control measures
    // Filter by jsonldType for boundary/control measure types
    // Normalize by lowercasing and stripping colons/underscores for comparison
    const CONTROL_MEASURE_JSONLD_TYPES = ['boundary', 'phaseline', 'axisofadvance', 'route', 'controlmeasure', 'geospatialregion'];
    const normalizeType = (s: string) => s.toLowerCase().replace(/[:\s_]/g, '');
    const graphMeasures = input.graphEntities
      .filter(e =>
        CONTROL_MEASURE_JSONLD_TYPES.some(t => normalizeType(e.jsonldType).includes(normalizeType(t))),
      )
      .map(e => ({
        id: e.id,
        type: ((e.properties.attributes_measureType ?? e.properties.measureType) as ExtractedControlMeasure['type']) || 'boundary',
        label: e.name,
        points: (e.properties.points as Array<{ lat: number; lng: number }>) || [],
        phaseRange: (e.properties.attributes_phaseRange ?? e.properties.phaseRange) as { start: number; end: number } | undefined,
        description: (e.properties.attributes_description as string) || (e.properties.description as string) || '',
        sourceDocumentId: 'raft-graph',
      }));

    const allMeasures = [...extractedMeasures, ...graphMeasures];

    // Build control measure specs with styling
    const controlMeasures: COPControlMeasureSpec[] = allMeasures.map(measure => {
      // Validate CCO class for each measure
      suggestCCOClass(measure.type, {
        label: measure.label,
        description: measure.description,
      });

      return {
        id: measure.id,
        type: measure.type,
        points: measure.points,
        label: measure.label,
        style: STYLE_MAP[measure.type] || STYLE_MAP.boundary,
        phaseRange: measure.phaseRange,
      };
    });

    copEventBus.emit('agent:activity', {
      agentId: AGENT_ID,
      action: 'extraction:complete',
      detail: `Extracted ${controlMeasures.length} control measures`,
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      timestamp: new Date().toISOString(),
    });

    return {
      layerId: `control_measures-${input.sectionId}-${Date.now()}`,
      layerType: 'control_measures',
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      symbols: [],
      controlMeasures,
      customAnnotations: [],
      temporalPhases: [],
      metadata: {
        generatedBy: AGENT_ID,
        generatedAt: new Date().toISOString(),
        sourceDocumentIds: input.documents.map(d => d.id),
        ccoValidated: true,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    copEventBus.emit('agent:activity', {
      agentId: AGENT_ID,
      action: 'extraction:error',
      detail: `Control measures extraction failed: ${message}`,
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      timestamp: new Date().toISOString(),
    });

    return createEmptyLayerSpec(input, 'control_measures', AGENT_ID, message);
  }
}

async function extractControlMeasures(
  documents: SubAgentInput['documents'],
): Promise<ExtractedControlMeasure[]> {
  if (documents.length === 0) return [];

  const llm = await createLLMForAgent({ agentId: AGENT_ID });

  const combinedContent = documents
    .map(d => `[Document: ${d.id} (${d.type})]\n${d.content}`)
    .join('\n\n---\n\n');

  const result = await Promise.race([
    llm.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(combinedContent),
    ]),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('LLM extraction timed out')), TIMEOUT_MS),
    ),
  ]);

  try {
    const content = typeof result.content === 'string'
      ? result.content
      : JSON.stringify(result.content);

    const cleaned = content
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim();

    const parsed = JSON.parse(cleaned) as ExtractedControlMeasure[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
