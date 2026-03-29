/**
 * Navigation Skill
 *
 * Analyzes map/terrain data and computes optimal routes for robot movement.
 * Queries: screening routes, covered approaches, exfiltration, fire-and-maneuver.
 *
 * This skill is invoked by the tactical AI agent — not hardcoded into the orchestrator.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { calibrationService } from '../calibration-service.js';

// ---------------------------------------------------------------------------
// Map data — loaded at startup, could be replaced with a map service
// ---------------------------------------------------------------------------

export interface RoadSegment {
  name: string;
  /** Axis: 'ns' (north-south) or 'ew' (east-west) */
  axis: 'ns' | 'ew';
  /** Fixed coordinate on the perpendicular axis */
  position: number;
  /** Range along the primary axis */
  range: [number, number];
  /** Road class — affects suitability for armor, concealment, etc. */
  roadClass: 'primary' | 'secondary' | 'tertiary' | 'residential' | 'unclassified';
  /** Width in lanes */
  lanes: number;
}

export interface Landmark {
  name: string;
  position: { x: number; y: number };
  type: 'elevated' | 'open_terrain' | 'structure' | 'intersection';
  /** Tactical notes */
  notes: string;
}

export interface MapData {
  name: string;
  bounds: { x_min: number; y_min: number; x_max: number; y_max: number };
  /** Room-to-geo calibration */
  geoBounds: { lat_min: number; lat_max: number; lng_min: number; lng_max: number };
  roads: RoadSegment[];
  landmarks: Landmark[];
}

// ---------------------------------------------------------------------------
// Default area map — open terrain track network (scenario-agnostic)
//
// Uses room dimensions from the active calibration profile.
// Three N-S farm tracks and three E-W movement lines create a 9-intersection
// grid the A* pathfinder can route on — same algorithm that worked on the
// former Taipei street grid.
//
// Room 5m wide × 15m long (Latvia EFDL default):
//   N-S tracks: West Track x=1.0, Center Track x=2.5, East Track x=4.2
//   E-W lines:  South Line y=1.0, Mid Line y=9.5, North Line y=12.5
//   Landmarks:  Northern Ridge, Tree Line Boundary, Staging Area, UEA Center
// ---------------------------------------------------------------------------

function buildDefaultAreaMap(): MapData {
  const { room_width: w, room_height: h, map_bounds } = calibrationService.getProfile();
  return {
    name: 'Unmanned Engagement Area — Open Terrain',
    bounds: { x_min: 0, y_min: 0, x_max: w, y_max: h },
    geoBounds: {
      lat_min: map_bounds.south,
      lat_max: map_bounds.north,
      lng_min: map_bounds.west,
      lng_max: map_bounds.east,
    },
    roads: [
      // N-S farm tracks
      { name: 'West Track',   axis: 'ns', position: w * 0.20, range: [0, h], roadClass: 'unclassified', lanes: 1 },
      { name: 'Center Track', axis: 'ns', position: w * 0.50, range: [0, h], roadClass: 'secondary',    lanes: 1 },
      { name: 'East Track',   axis: 'ns', position: w * 0.84, range: [0, h], roadClass: 'unclassified', lanes: 1 },
      // E-W movement lines
      { name: 'South Line',   axis: 'ew', position: h * 0.07, range: [0, w], roadClass: 'residential',  lanes: 1 },
      { name: 'Mid Line',     axis: 'ew', position: h * 0.63, range: [0, w], roadClass: 'secondary',    lanes: 1 },
      { name: 'North Line',   axis: 'ew', position: h * 0.83, range: [0, w], roadClass: 'primary',      lanes: 2 },
    ],
    landmarks: [
      { name: 'Northern Ridge',       position: { x: w * 0.50, y: h * 0.80 }, type: 'elevated',     notes: 'Elevated ground with clear sight lines south along center track' },
      { name: 'Tree Line Boundary',   position: { x: w * 0.50, y: h * 0.63 }, type: 'open_terrain', notes: 'Vegetation belt — provides concealment from north' },
      { name: 'Staging Area',         position: { x: w * 0.50, y: h * 0.07 }, type: 'structure',    notes: 'Southern staging area — robot home base' },
      { name: 'UEA Center',           position: { x: w * 0.50, y: h * 0.50 }, type: 'intersection', notes: 'Center of Unmanned Engagement Area — mid-point reference' },
    ],
  };
}

/** Scenario area map — replaced via setActiveMap() when a scenario loads. */
const DEFAULT_AREA_MAP: MapData = buildDefaultAreaMap();

let scenarioAreaMap: MapData = DEFAULT_AREA_MAP;

export function setActiveMap(map: MapData): void {
  scenarioAreaMap = map;
}

export function getActiveMap(): MapData {
  return scenarioAreaMap;
}

// ---------------------------------------------------------------------------
// Route computation helpers
// ---------------------------------------------------------------------------

interface Intersection {
  x: number;
  y: number;
  roads: string[];
}

function findIntersections(map: MapData): Intersection[] {
  const intersections: Intersection[] = [];
  const nsRoads = map.roads.filter((r) => r.axis === 'ns');
  const ewRoads = map.roads.filter((r) => r.axis === 'ew');

  for (const ns of nsRoads) {
    for (const ew of ewRoads) {
      // Check if they actually overlap
      if (
        ns.position >= ew.range[0] && ns.position <= ew.range[1] &&
        ew.position >= ns.range[0] && ew.position <= ns.range[1]
      ) {
        intersections.push({
          x: ns.position,
          y: ew.position,
          roads: [ns.name, ew.name],
        });
      }
    }
  }
  return intersections;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function findNearestIntersection(
  point: { x: number; y: number },
  intersections: Intersection[],
): Intersection {
  let best = intersections[0];
  let bestDist = Infinity;
  for (const ix of intersections) {
    const d = distance(point, ix);
    if (d < bestDist) { bestDist = d; best = ix; }
  }
  return best;
}

/**
 * Compute a road-following route between two points via intersections.
 * Uses a simple greedy A* on the intersection graph.
 */
function computeRoute(
  from: { x: number; y: number },
  to: { x: number; y: number },
  intersections: Intersection[],
  options?: { avoidPositions?: Array<{ x: number; y: number }>; preferConcealment?: boolean },
): Array<{ x: number; y: number }> {
  // If origin and destination are close, go direct — no pathfinding needed
  if (distance(from, to) < 0.5) return [to];

  const start = findNearestIntersection(from, intersections);
  const end = findNearestIntersection(to, intersections);

  if (distance(start, end) < 0.2) return [to];

  // Build adjacency: two intersections are adjacent if they share a road
  // (same NS road x-coord or same EW road y-coord)
  const adj = new Map<string, string[]>();
  const key = (ix: Intersection) => `${ix.x},${ix.y}`;

  for (const ix of intersections) {
    adj.set(key(ix), []);
  }

  for (let i = 0; i < intersections.length; i++) {
    for (let j = i + 1; j < intersections.length; j++) {
      const a = intersections[i];
      const b = intersections[j];
      // Adjacent if same x (shared NS road) or same y (shared EW road)
      if (Math.abs(a.x - b.x) < 0.01 || Math.abs(a.y - b.y) < 0.01) {
        // Check no other intersection between them on the same axis
        const between = intersections.filter((c) => {
          if (Math.abs(a.x - b.x) < 0.01 && Math.abs(c.x - a.x) < 0.01) {
            return (c.y > Math.min(a.y, b.y) && c.y < Math.max(a.y, b.y));
          }
          if (Math.abs(a.y - b.y) < 0.01 && Math.abs(c.y - a.y) < 0.01) {
            return (c.x > Math.min(a.x, b.x) && c.x < Math.max(a.x, b.x));
          }
          return false;
        });
        if (between.length === 0) {
          adj.get(key(a))!.push(key(b));
          adj.get(key(b))!.push(key(a));
        }
      }
    }
  }

  // A* search
  const ixMap = new Map(intersections.map((ix) => [key(ix), ix]));
  const startKey = key(start);
  const endKey = key(end);

  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([[startKey, distance(start, end)]]);
  const cameFrom = new Map<string, string>();
  const open = new Set<string>([startKey]);

  while (open.size > 0) {
    // Pick node with lowest fScore
    let current = '';
    let bestF = Infinity;
    for (const k of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < bestF) { bestF = f; current = k; }
    }

    if (current === endKey) {
      // Reconstruct path — exclude start intersection.
      // The robot moves from its current position directly toward the
      // first intersection on the route. No snapping to a start intersection.
      const path: Array<{ x: number; y: number }> = [];
      let c = endKey;
      while (c !== startKey) {
        const ix = ixMap.get(c)!;
        path.unshift({ x: ix.x, y: ix.y });
        c = cameFrom.get(c)!;
      }
      // Add exact destination if it differs from the last waypoint
      const last = path[path.length - 1];
      if (!last || distance(last, to) > 0.1) {
        path.push(to);
      }
      return path;
    }

    open.delete(current);
    const currentIx = ixMap.get(current)!;

    for (const neighborKey of (adj.get(current) ?? [])) {
      const neighborIx = ixMap.get(neighborKey)!;

      // Cost: distance + penalty for positions near avoidPositions
      let cost = distance(currentIx, neighborIx);
      if (options?.avoidPositions) {
        for (const avoid of options.avoidPositions) {
          const d = distance(neighborIx, avoid);
          if (d < 0.5) cost += 2.0; // Heavy penalty near positions to avoid
        }
      }
      // Prefer residential streets for concealment
      if (options?.preferConcealment) {
        const onPrimary = scenarioAreaMap.roads.some(
          (r) => r.roadClass === 'primary' &&
          ((r.axis === 'ns' && Math.abs(r.position - neighborIx.x) < 0.1) ||
           (r.axis === 'ew' && Math.abs(r.position - neighborIx.y) < 0.1)),
        );
        if (onPrimary) cost += 1.5;
      }

      const tentative = (gScore.get(current) ?? Infinity) + cost;
      if (tentative < (gScore.get(neighborKey) ?? Infinity)) {
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentative);
        fScore.set(neighborKey, tentative + distance(neighborIx, end));
        open.add(neighborKey);
      }
    }
  }

  // Fallback: direct waypoints via nearest intersections
  return [{ x: start.x, y: start.y }, to];
}

// ---------------------------------------------------------------------------
// LangChain Tools
// ---------------------------------------------------------------------------

export function createNavigationTools(): DynamicStructuredTool[] {
  const intersections = findIntersections(scenarioAreaMap);

  const planRouteTool = new DynamicStructuredTool({
    name: 'plan_route',
    description: 'Compute a road-following route between two points. Routes follow the street grid and only turn at intersections. Optionally avoid specific positions and prefer concealed (residential) streets.',
    schema: z.object({
      from_x: z.number().describe('Start position X coordinate'),
      from_y: z.number().describe('Start position Y coordinate'),
      to_x: z.number().describe('Destination X coordinate'),
      to_y: z.number().describe('Destination Y coordinate'),
      avoid_positions: z.array(z.object({ x: z.number(), y: z.number() })).optional().describe('Positions to avoid (enemy locations, other friendly routes)'),
      prefer_concealment: z.boolean().optional().describe('Prefer narrow residential streets over wide arterials'),
    }),
    func: async ({ from_x, from_y, to_x, to_y, avoid_positions, prefer_concealment }) => {
      const route = computeRoute(
        { x: from_x, y: from_y },
        { x: to_x, y: to_y },
        intersections,
        { avoidPositions: avoid_positions, preferConcealment: prefer_concealment },
      );
      const totalDist = route.reduce((sum, wp, i) => {
        if (i === 0) return sum + distance({ x: from_x, y: from_y }, wp);
        return sum + distance(route[i - 1], wp);
      }, 0);
      return JSON.stringify({
        waypoints: route,
        total_distance: Math.round(totalDist * 100) / 100,
        segment_count: route.length,
      });
    },
  });

  const findScreenRouteTool = new DynamicStructuredTool({
    name: 'plan_screening_route',
    description: 'Plan a reconnaissance screening route that sweeps across the area of operations. The route covers the width of the AO while staying at or behind a specified screen line. Returns a zigzag pattern following the road grid.',
    schema: z.object({
      start_x: z.number().describe('Screening start position X'),
      start_y: z.number().describe('Screening start position Y'),
      screen_line_y: z.number().describe('Maximum Y (north) the screen should reach — the forward edge'),
      ao_x_min: z.number().describe('Western boundary of the screening area'),
      ao_x_max: z.number().describe('Eastern boundary of the screening area'),
    }),
    func: async ({ start_x: _start_x, start_y, screen_line_y, ao_x_min, ao_x_max }) => {
      // Build a zigzag route across the AO using E-W roads
      const ewRoads = scenarioAreaMap.roads
        .filter((r) => r.axis === 'ew' && r.position >= start_y && r.position <= screen_line_y)
        .sort((a, b) => a.position - b.position);

      const nsRoads = scenarioAreaMap.roads
        .filter((r) => r.axis === 'ns' && r.position >= ao_x_min && r.position <= ao_x_max)
        .sort((a, b) => a.position - b.position);

      const route: Array<{ x: number; y: number }> = [];
      let goingEast = true;

      for (const ew of ewRoads) {
        // First waypoint on each E-W road: approach from the start X
        // so the robot goes north first before zigzagging east-west
        if (route.length === 0) {
          // Go straight north to the first road at the start X position
          route.push({ x: _start_x, y: ew.position });
        }
        if (goingEast) {
          for (const ns of nsRoads) {
            route.push({ x: ns.position, y: ew.position });
          }
        } else {
          for (let i = nsRoads.length - 1; i >= 0; i--) {
            route.push({ x: nsRoads[i].position, y: ew.position });
          }
        }
        goingEast = !goingEast;
      }

      return JSON.stringify({
        waypoints: route,
        screen_width: ao_x_max - ao_x_min,
        screen_depth: screen_line_y - start_y,
        roads_covered: ewRoads.map((r) => r.name),
      });
    },
  });

  const getMapInfoTool = new DynamicStructuredTool({
    name: 'get_map_info',
    description: 'Get information about the operational area: road network, landmarks, key terrain, and tactical notes. Use this to understand the environment before planning routes or positions.',
    schema: z.object({}),
    func: async () => {
      return JSON.stringify({
        area_name: scenarioAreaMap.name,
        bounds: scenarioAreaMap.bounds,
        roads: scenarioAreaMap.roads.map((r) => ({
          name: r.name,
          axis: r.axis,
          position: r.position,
          class: r.roadClass,
          lanes: r.lanes,
        })),
        landmarks: scenarioAreaMap.landmarks,
        intersections: intersections.map((ix) => ({
          position: { x: ix.x, y: ix.y },
          roads: ix.roads,
        })),
        tactical_notes: [
          `${scenarioAreaMap.roads.find((r) => r.roadClass === 'primary')?.name ?? 'Primary road'} is the widest road — likely axis of advance for armored vehicles`,
          'Residential side streets provide concealment and flanking opportunities',
          'Movement MUST follow roads — robots cannot traverse through buildings',
          'Intersections provide both cover positions and firing corridors along street axes',
        ],
      });
    },
  });

  return [planRouteTool, findScreenRouteTool, getMapInfoTool];
}
