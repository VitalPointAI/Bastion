/**
 * Operational Graphics Generator
 *
 * Phase 05 Plan 10: Auto-generates GeoJSON overlays for operational graphics
 * (phase lines, objectives, boundaries) from plan data
 */

import { planStore } from '../stores/plan-store.js';
import { coaStore } from '../stores/coa-store.js';
import { GRAPHIC_SIDC, renderSymbol } from './symbol-renderer.js';

export interface OperationalGraphic {
  id: string;
  type: 'point' | 'line' | 'polygon';
  graphicType: string;
  sidc: string;
  name: string;
  geometry: GeoJSONGeometry;
  properties: Record<string, unknown>;
  symbolDataUrl?: string;
}

interface GeoJSONGeometry {
  type: 'Point' | 'LineString' | 'Polygon';
  coordinates: number[] | number[][] | number[][][];
}

export interface OperationalOverlay {
  planId: string;
  planName: string;
  graphics: OperationalGraphic[];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  generatedAt: Date;
}

/**
 * Generate operational graphics overlay from plan data
 */
export async function generateOperationalGraphics(
  planId: string,
  areaOfOperations?: { center: [number, number]; radius: number }
): Promise<OperationalOverlay> {
  const plan = await planStore.findById(planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);

  const coas = await coaStore.findByPlan(planId);
  const selectedCOA = coas.find(c => c.selected);

  const graphics: OperationalGraphic[] = [];

  // Default AO center if not provided
  const aoCenter = areaOfOperations?.center || [0, 0];
  const aoRadius = areaOfOperations?.radius || 0.1; // degrees

  // Generate phase lines from execution phases
  const phases = plan.execution?.conceptOfOperations?.phases || [];
  phases.forEach((phase, i) => {
    const lat = aoCenter[1] - aoRadius + (i * aoRadius * 2 / (phases.length || 1));
    graphics.push({
      id: `PL-${i + 1}`,
      type: 'line',
      graphicType: 'Phase Line',
      sidc: GRAPHIC_SIDC.PHASE_LINE,
      name: `PL ${String.fromCharCode(65 + i)}`, // PL A, PL B, etc.
      geometry: {
        type: 'LineString',
        coordinates: [
          [aoCenter[0] - aoRadius, lat],
          [aoCenter[0] + aoRadius, lat],
        ],
      },
      properties: {
        phase: phase.name,
        purpose: phase.purpose,
        description: `Phase Line ${String.fromCharCode(65 + i)} - ${phase.name}`,
      },
    });
  });

  // Generate objectives from selected COA tasks
  if (selectedCOA) {
    selectedCOA.tasks.forEach((task, i) => {
      // Distribute objectives in a grid pattern
      const row = Math.floor(i / 3);
      const col = i % 3;
      const lat = aoCenter[1] + (row - 1) * (aoRadius / 2);
      const lng = aoCenter[0] + (col - 1) * (aoRadius / 2);

      const sidc = GRAPHIC_SIDC.OBJECTIVE;
      graphics.push({
        id: `OBJ-${i + 1}`,
        type: 'point',
        graphicType: 'Objective',
        sidc,
        name: `OBJ ${task.unitId}`,
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        properties: {
          unitId: task.unitId,
          task: task.task,
          purpose: task.purpose,
        },
        symbolDataUrl: renderSymbol(sidc, {
          uniqueDesignation: `OBJ ${i + 1}`,
          staffComments: task.unitId,
        }),
      });
    });

    // Generate axis of advance for decisive operation
    if (selectedCOA.decisiveOperation) {
      graphics.push({
        id: 'AXIS-MAIN',
        type: 'line',
        graphicType: 'Axis of Advance (Main)',
        sidc: GRAPHIC_SIDC.AXIS_OF_ADVANCE,
        name: 'MAIN EFFORT',
        geometry: {
          type: 'LineString',
          coordinates: [
            [aoCenter[0] - aoRadius * 0.8, aoCenter[1] - aoRadius * 0.8],
            [aoCenter[0], aoCenter[1]],
            [aoCenter[0] + aoRadius * 0.5, aoCenter[1] + aoRadius * 0.5],
          ],
        },
        properties: {
          description: selectedCOA.decisiveOperation,
          type: 'main_effort',
        },
      });
    }

    // Generate engagement areas from risks with enemy positions
    selectedCOA.risks?.forEach((risk, i) => {
      if (risk.description?.toLowerCase().includes('enemy') ||
          risk.description?.toLowerCase().includes('ambush')) {
        graphics.push({
          id: `EA-${i + 1}`,
          type: 'polygon',
          graphicType: 'Engagement Area',
          sidc: GRAPHIC_SIDC.ENGAGEMENT_AREA,
          name: `EA ${i + 1}`,
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [aoCenter[0] + i * 0.02, aoCenter[1] + 0.01],
              [aoCenter[0] + i * 0.02 + 0.02, aoCenter[1] + 0.01],
              [aoCenter[0] + i * 0.02 + 0.02, aoCenter[1] - 0.01],
              [aoCenter[0] + i * 0.02, aoCenter[1] - 0.01],
              [aoCenter[0] + i * 0.02, aoCenter[1] + 0.01],
            ]],
          },
          properties: {
            risk: risk.description,
            mitigation: risk.mitigation,
          },
        });
      }
    });
  }

  // Calculate bounds
  let north = -90, south = 90, east = -180, west = 180;
  graphics.forEach(g => {
    if (g.geometry.type === 'Point') {
      const [lng, lat] = g.geometry.coordinates as number[];
      north = Math.max(north, lat);
      south = Math.min(south, lat);
      east = Math.max(east, lng);
      west = Math.min(west, lng);
    } else if (g.geometry.type === 'LineString') {
      (g.geometry.coordinates as number[][]).forEach(([lng, lat]) => {
        north = Math.max(north, lat);
        south = Math.min(south, lat);
        east = Math.max(east, lng);
        west = Math.min(west, lng);
      });
    } else if (g.geometry.type === 'Polygon') {
      (g.geometry.coordinates as number[][][])[0].forEach(([lng, lat]) => {
        north = Math.max(north, lat);
        south = Math.min(south, lat);
        east = Math.max(east, lng);
        west = Math.min(west, lng);
      });
    }
  });

  // Handle empty graphics case
  if (graphics.length === 0) {
    north = aoCenter[1] + aoRadius;
    south = aoCenter[1] - aoRadius;
    east = aoCenter[0] + aoRadius;
    west = aoCenter[0] - aoRadius;
  }

  return {
    planId,
    planName: plan.name,
    graphics,
    bounds: { north, south, east, west },
    generatedAt: new Date(),
  };
}

/**
 * Export graphics as GeoJSON FeatureCollection
 */
export function graphicsToGeoJSON(overlay: OperationalOverlay): object {
  return {
    type: 'FeatureCollection',
    features: overlay.graphics.map(g => ({
      type: 'Feature',
      id: g.id,
      geometry: g.geometry,
      properties: {
        id: g.id,
        name: g.name,
        graphicType: g.graphicType,
        sidc: g.sidc,
        symbolDataUrl: g.symbolDataUrl,
        ...g.properties,
      },
    })),
  };
}
