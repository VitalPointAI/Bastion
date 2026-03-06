/**
 * Strategic Context Service (Frontend API Client)
 *
 * Phase 25.3 Plan 05: Provides fetchStrategicContextPreview() to retrieve
 * the assembled strategic context for a problem set from the backend.
 * Used by the StrategicContextPreview component.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface GraphSummaryData {
  topActors: Array<{
    name: string;
    type: string;
    centrality: number;
    temporalRelevance?: string;
  }>;
  keyRelationships: Array<{
    source: string;
    target: string;
    type: string;
    strength: number;
  }>;
  activeTensions: Array<{
    description: string;
    intensity: string;
    domain: string;
    actors: string[];
  }>;
  communityClusters: Array<{
    actors: string[];
    cohesion: number;
  }>;
  summary: string;
}

export interface StrategicContextPreviewData {
  graphSummaries: Record<string, GraphSummaryData>;
  documentSummaries: Array<{
    title: string;
    docType: string;
    extractedData?: unknown;
    textContent?: string;
  }>;
  tokensUsed: number;
  tokenBudget: number;
}

export async function fetchStrategicContextPreview(
  problemSetId: string,
  scenarioPhase?: string,
): Promise<StrategicContextPreviewData | null> {
  const params = scenarioPhase
    ? `?scenarioPhase=${encodeURIComponent(scenarioPhase)}`
    : '';
  const res = await fetch(
    `${API_BASE}/api/strategic-context/preview/${problemSetId}${params}`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.context;
}
