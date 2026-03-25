/**
 * Map Overlay Service
 *
 * Phase 56 Plan 01: API client for map overlay CRUD operations.
 * Wraps PATCH/GET /api/design/:problemSetId/map-overlay endpoints.
 */

import type { MapSymbol, ControlMeasure, MapOverlay } from './design-service.js';

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

async function patchMapOverlay(
  problemSetId: string,
  action: string,
  data: Record<string, unknown>
): Promise<MapOverlay> {
  const res = await fetch(`${API_BASE}/api/design/${problemSetId}/map-overlay`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data }),
  });
  if (!res.ok) throw new Error(`Map overlay action '${action}' failed: ${res.statusText}`);
  return res.json() as Promise<MapOverlay>;
}

/**
 * Get the current map overlay for a problem set.
 */
export async function getMapOverlay(problemSetId: string): Promise<MapOverlay> {
  const res = await fetch(`${API_BASE}/api/design/${problemSetId}/map-overlay`);
  if (!res.ok) throw new Error(`Failed to get map overlay: ${res.statusText}`);
  return res.json() as Promise<MapOverlay>;
}

/**
 * Add a military symbol to the map overlay.
 */
export async function addSymbol(
  problemSetId: string,
  symbol: Omit<MapSymbol, 'id' | 'createdAt'>
): Promise<MapOverlay> {
  return patchMapOverlay(problemSetId, 'add_symbol', symbol as Record<string, unknown>);
}

/**
 * Move an existing symbol to a new position.
 */
export async function moveSymbol(
  problemSetId: string,
  symbolId: string,
  lat: number,
  lng: number
): Promise<MapOverlay> {
  return patchMapOverlay(problemSetId, 'move_symbol', { symbolId, lat, lng });
}

/**
 * Remove a symbol from the map overlay.
 */
export async function removeSymbol(problemSetId: string, symbolId: string): Promise<MapOverlay> {
  return patchMapOverlay(problemSetId, 'remove_symbol', { symbolId });
}

/**
 * Update properties of an existing symbol.
 */
export async function updateSymbol(
  problemSetId: string,
  symbolId: string,
  updates: Partial<MapSymbol>
): Promise<MapOverlay> {
  return patchMapOverlay(problemSetId, 'update_symbol', { symbolId, ...updates } as Record<string, unknown>);
}

/**
 * Add a control measure (phase line, boundary, objective, etc.) to the map overlay.
 */
export async function addControlMeasure(
  problemSetId: string,
  measure: Omit<ControlMeasure, 'id' | 'createdAt'>
): Promise<MapOverlay> {
  return patchMapOverlay(problemSetId, 'add_control_measure', measure as Record<string, unknown>);
}

/**
 * Remove a control measure from the map overlay.
 */
export async function removeControlMeasure(problemSetId: string, measureId: string): Promise<MapOverlay> {
  return patchMapOverlay(problemSetId, 'remove_control_measure', { measureId });
}
