/**
 * Map Features to IPB Layers Converter
 *
 * Quick Task 5: Converts the structured output of vision-based map extraction
 * (from ExtractedExerciseData) into IPBLayer[] objects compatible with the
 * ValidityMap rendering component.
 *
 * Mapping rules:
 *   forceDispositions         → type: 'unit',  layerType: 'forces'
 *   keyTerrain / terrain      → type: 'area',  layerType: 'key_terrain'
 *   obstacles                 → type: 'line',  layerType: 'obstacle'
 *   avenuesOfApproach         → type: 'line',  layerType: 'avenue_of_approach'
 *   namedAreasOfInterest      → type: 'area',  layerType: 'nai'
 *   engagementAreas           → type: 'area',  layerType: 'engagement_area'
 */

import { randomUUID } from 'crypto';
import type { IPBLayer, ExtractedExerciseData } from './types.js';

// ─── Internal raw extraction shapes ──────────────────────────────────────────

interface RawTerrainFeature {
  name?: string;
  type?: string;
  description?: string;
  coordinates?: { lat: number; lng: number } | [number, number];
  significance?: string;
}

interface RawAvenueOfApproach {
  name?: string;
  description?: string;
  direction?: string;
  from?: string;
  to?: string;
}

interface RawNAI {
  id?: string;
  name?: string;
  description?: string;
  significance?: string;
  coordinates?: { lat: number; lng: number } | [number, number];
}

interface RawEngagementArea {
  id?: string;
  name?: string;
  description?: string;
  significance?: string;
  coordinates?: { lat: number; lng: number } | [number, number];
}

// ─── Geometry helpers ────────────────────────────────────────────────────────

/**
 * Build a GeoJSON Point from a lat/lng coordinate pair.
 */
function makePoint(lat: number, lng: number): Record<string, unknown> {
  return { type: 'Point', coordinates: [lng, lat] };
}

/**
 * Placeholder point used when a location is named but not geocoded.
 * The `geocodeRequired: true` flag in properties signals downstream systems
 * to resolve the name to a coordinate.
 */
const PLACEHOLDER_POINT: Record<string, unknown> = {
  type: 'Point',
  coordinates: [0, 0],
};

/**
 * Extract a GeoJSON Point from various coordinate representations.
 * Returns undefined if no coordinate can be resolved.
 */
function extractCoordinates(
  coords: { lat: number; lng: number } | [number, number] | undefined
): Record<string, unknown> | undefined {
  if (!coords) return undefined;
  if (Array.isArray(coords)) {
    const [a, b] = coords;
    if (typeof a === 'number' && typeof b === 'number') {
      // Assume [lat, lng] ordering from LLM output
      return makePoint(a, b);
    }
  } else if ('lat' in coords && 'lng' in coords) {
    return makePoint(coords.lat, coords.lng);
  }
  return undefined;
}

// ─── Converters ──────────────────────────────────────────────────────────────

/**
 * Convert forceDispositions from ExtractedExerciseData into 'unit' / 'forces' IPBLayers.
 */
function forceDispositionsToLayers(
  dispositions: ExtractedExerciseData['forceDispositions'],
  team: 'blue' | 'red'
): IPBLayer[] {
  if (!dispositions || dispositions.length === 0) return [];

  return dispositions.map((disp) => {
    const hasLatLng = disp.location && typeof disp.location !== 'string';
    const geometry: Record<string, unknown> = hasLatLng
      ? makePoint(
          (disp.location as { lat: number; lng: number }).lat,
          (disp.location as { lat: number; lng: number }).lng
        )
      : PLACEHOLDER_POINT;

    const properties: Record<string, unknown> = {
      unitName: disp.unitName,
      echelon: disp.echelon,
    };

    if (disp.strength) properties.strength = disp.strength;
    if (disp.equipment?.length) properties.equipment = disp.equipment;

    if (!hasLatLng && disp.location) {
      properties.locationName = disp.location as string;
      properties.geocodeRequired = true;
    }

    return {
      id: randomUUID(),
      name: disp.unitName,
      type: 'unit' as const,
      team,
      layerType: 'forces' as const,
      geometry,
      properties,
      sidc: disp.sidc,
    };
  });
}

/**
 * Convert rawExtraction terrain features into 'area' / 'key_terrain' or 'line' / 'obstacle' IPBLayers.
 */
function terrainFeaturesToLayers(
  rawExtraction: Record<string, unknown>,
  team: 'blue' | 'red'
): IPBLayer[] {
  const layers: IPBLayer[] = [];

  // Handle terrainFeatures array
  const terrainFeatures = rawExtraction.terrainFeatures as RawTerrainFeature[] | undefined;
  if (Array.isArray(terrainFeatures)) {
    for (const feature of terrainFeatures) {
      const name = feature.name ?? feature.type ?? 'Terrain Feature';
      const geometry = extractCoordinates(feature.coordinates) ?? PLACEHOLDER_POINT;
      const properties: Record<string, unknown> = {
        featureType: feature.type ?? 'terrain',
        description: feature.description ?? '',
        significance: feature.significance ?? '',
      };
      if (!extractCoordinates(feature.coordinates) && name) {
        properties.locationName = name;
        properties.geocodeRequired = true;
      }

      // Classify as obstacle if explicitly typed, otherwise key terrain
      const isObstacle =
        feature.type?.toLowerCase().includes('obstacle') ||
        feature.type?.toLowerCase().includes('barrier') ||
        feature.type?.toLowerCase().includes('minefield');

      layers.push({
        id: randomUUID(),
        name,
        type: isObstacle ? 'line' : 'area',
        team,
        layerType: isObstacle ? 'obstacle' : 'key_terrain',
        geometry,
        properties,
      });
    }
  }

  // Also handle a keyTerrain string or array
  const keyTerrain = rawExtraction.keyTerrain;
  if (typeof keyTerrain === 'string' && keyTerrain.trim()) {
    layers.push({
      id: randomUUID(),
      name: 'Key Terrain',
      type: 'area',
      team,
      layerType: 'key_terrain',
      geometry: PLACEHOLDER_POINT,
      properties: {
        description: keyTerrain,
        geocodeRequired: true,
      },
    });
  }

  return layers;
}

/**
 * Convert rawExtraction avenues of approach into 'line' / 'avenue_of_approach' IPBLayers.
 */
function avenuesOfApproachToLayers(
  rawExtraction: Record<string, unknown>,
  team: 'blue' | 'red'
): IPBLayer[] {
  const avenuesOfApproach = rawExtraction.avenuesOfApproach as RawAvenueOfApproach[] | undefined;
  if (!Array.isArray(avenuesOfApproach)) return [];

  return avenuesOfApproach.map((avenue) => ({
    id: randomUUID(),
    name: avenue.name ?? 'Avenue of Approach',
    type: 'line' as const,
    team,
    layerType: 'avenue_of_approach' as const,
    geometry: PLACEHOLDER_POINT,
    properties: {
      description: avenue.description ?? '',
      direction: avenue.direction ?? '',
      from: avenue.from ?? '',
      to: avenue.to ?? '',
      geocodeRequired: true,
    },
  }));
}

/**
 * Convert rawExtraction NAIs into 'area' / 'nai' IPBLayers.
 */
function namedAreasOfInterestToLayers(
  rawExtraction: Record<string, unknown>,
  team: 'blue' | 'red'
): IPBLayer[] {
  const nais = rawExtraction.namedAreasOfInterest as RawNAI[] | undefined;
  if (!Array.isArray(nais)) return [];

  return nais.map((nai) => {
    const geometry = extractCoordinates(nai.coordinates) ?? PLACEHOLDER_POINT;
    const properties: Record<string, unknown> = {
      significance: nai.significance ?? '',
      description: nai.description ?? '',
    };
    if (!extractCoordinates(nai.coordinates) && (nai.name || nai.id)) {
      properties.locationName = nai.name ?? nai.id ?? '';
      properties.geocodeRequired = true;
    }

    return {
      id: randomUUID(),
      name: nai.name ?? nai.id ?? 'NAI',
      type: 'area' as const,
      team,
      layerType: 'nai' as const,
      geometry,
      properties,
    };
  });
}

/**
 * Convert rawExtraction engagement areas into 'area' / 'engagement_area' IPBLayers.
 */
function engagementAreasToLayers(
  rawExtraction: Record<string, unknown>,
  team: 'blue' | 'red'
): IPBLayer[] {
  const engagementAreas = rawExtraction.engagementAreas as RawEngagementArea[] | undefined;
  if (!Array.isArray(engagementAreas)) return [];

  return engagementAreas.map((ea) => {
    const geometry = extractCoordinates(ea.coordinates) ?? PLACEHOLDER_POINT;
    const properties: Record<string, unknown> = {
      significance: ea.significance ?? '',
      description: ea.description ?? '',
    };
    if (!extractCoordinates(ea.coordinates) && (ea.name || ea.id)) {
      properties.locationName = ea.name ?? ea.id ?? '';
      properties.geocodeRequired = true;
    }

    return {
      id: randomUUID(),
      name: ea.name ?? ea.id ?? 'Engagement Area',
      type: 'area' as const,
      team,
      layerType: 'engagement_area' as const,
      geometry,
      properties,
    };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert structured map extraction data into IPBLayer[] for ValidityMap rendering.
 *
 * Processes all extractable map features:
 *   - forceDispositions → 'unit' / 'forces' layers
 *   - terrainFeatures / keyTerrain → 'area' / 'key_terrain' or 'line' / 'obstacle' layers
 *   - avenuesOfApproach → 'line' / 'avenue_of_approach' layers
 *   - namedAreasOfInterest → 'area' / 'nai' layers
 *   - engagementAreas → 'area' / 'engagement_area' layers
 *
 * Features without explicit coordinates receive a placeholder `[0,0]` geometry
 * with a `geocodeRequired: true` flag in properties so downstream systems can
 * resolve location names to coordinates.
 *
 * @param data  - ExtractedExerciseData from the vision extraction pipeline
 * @param team  - 'blue' or 'red' — used to set the team field on each layer
 * @returns     Array of IPBLayer objects ready for ValidityMap
 */
export function mapFeaturesToIPBLayers(
  data: ExtractedExerciseData,
  team: 'blue' | 'red'
): IPBLayer[] {
  const layers: IPBLayer[] = [];

  // Force dispositions from top-level field
  layers.push(...forceDispositionsToLayers(data.forceDispositions, team));

  // Terrain, avenues, NAIs, and engagement areas come from rawExtraction
  const raw = data.rawExtraction ?? {};

  layers.push(...terrainFeaturesToLayers(raw, team));
  layers.push(...avenuesOfApproachToLayers(raw, team));
  layers.push(...namedAreasOfInterestToLayers(raw, team));
  layers.push(...engagementAreasToLayers(raw, team));

  return layers;
}
