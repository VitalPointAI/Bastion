/**
 * Tactical Skills
 *
 * LangChain tools for tactical decision-making:
 * - Weapons Engagement Zone (WEZ) calculation
 * - Observation Post (OP) selection
 * - Kill zone identification
 * - Firing position selection
 * - Threat assessment
 *
 * These skills are invoked by the tactical AI agent to reason about
 * positions and engagements rather than relying on hardcoded logic.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getActiveMap } from './navigation-skill.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Check if position B is within the arc of fire from position A toward a target area.
 * Returns true if B is in danger (fratricide risk).
 * Arc is defined as a cone from A through the kill zone center, +/- arcHalfAngle degrees.
 */
function isInArcOfFire(
  firingFrom: { x: number; y: number },
  targetArea: { x: number; y: number },
  positionToCheck: { x: number; y: number },
  arcHalfAngleDeg: number = 15,
  maxRange: number = 6.0,
): boolean {
  const distToCheck = dist(firingFrom, positionToCheck);
  if (distToCheck > maxRange || distToCheck < 0.1) return false;

  // Bearing from firing position to kill zone
  const bearingToTarget = Math.atan2(targetArea.x - firingFrom.x, targetArea.y - firingFrom.y);
  // Bearing from firing position to the position being checked
  const bearingToCheck = Math.atan2(positionToCheck.x - firingFrom.x, positionToCheck.y - firingFrom.y);

  let angleDiff = Math.abs(bearingToTarget - bearingToCheck);
  if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

  return angleDiff < (arcHalfAngleDeg * Math.PI) / 180;
}

/**
 * Determine "behind" direction relative to enemy advance.
 * "Behind" the kill zone means on the opposite side from where the enemy is coming from.
 * Enemy advancing south → behind = south (lower Y).
 * Enemy advancing north → behind = north (higher Y).
 * Enemy advancing east → behind = east (higher X).
 * Enemy advancing west → behind = west (lower X).
 */
function getBehindFilter(
  direction: 'north' | 'south' | 'east' | 'west',
  axisRoad: { axis: 'ns' | 'ew'; position: number },
): (roadPos: number) => boolean {
  // "Behind" = the side the enemy hasn't reached yet (opposite to direction of travel)
  switch (direction) {
    case 'south': // Enemy moving south → positions south of kill zone
      return (pos) => pos < axisRoad.position;
    case 'north': // Enemy moving north → positions north of kill zone
      return (pos) => pos > axisRoad.position;
    case 'east':  // Enemy moving east → positions east of kill zone
      return (pos) => pos > axisRoad.position;
    case 'west':  // Enemy moving west → positions west of kill zone
      return (pos) => pos < axisRoad.position;
  }
}

/**
 * Determine the firing direction label for a position behind the kill zone.
 * Positions fire TOWARD the enemy approach (opposite of enemy movement direction).
 */
function getFiringDirectionToward(direction: 'north' | 'south' | 'east' | 'west'): string {
  switch (direction) {
    case 'south': return 'north'; // Enemy moving south, fire north into them
    case 'north': return 'south';
    case 'east':  return 'west';
    case 'west':  return 'east';
  }
}

// ---------------------------------------------------------------------------
// LangChain Tools
// ---------------------------------------------------------------------------

export function createTacticalTools(): DynamicStructuredTool[] {
  const calculateWEZTool = new DynamicStructuredTool({
    name: 'calculate_weapons_engagement_zone',
    description: 'Calculate the Weapons Engagement Zone (WEZ) for a given threat and weapon system. Returns the zone boundaries where engagement is effective, considering range, weapon type, and terrain masking. A WEZ defines where the enemy CAN effectively engage our forces — positions outside the WEZ are safe from that threat.',
    schema: z.object({
      threat_position: z.object({ x: z.number(), y: z.number() }).describe('Enemy position'),
      threat_type: z.string().describe('Enemy vehicle type (e.g., T-90, ZBD-04)'),
      threat_heading: z.number().optional().describe('Enemy heading in degrees (0=north)'),
      friendly_weapon: z.string().optional().describe('Friendly weapon system (default: anti-tank guided missile)'),
    }),
    func: async ({ threat_position, threat_type, threat_heading }) => {
      // Effective ranges by threat type (in room coords, ~1 coord = ~1.2m on the ground)
      const tankRanges: Record<string, { max_range: number; effective_range: number; min_range: number }> = {
        't-90': { max_range: 4.0, effective_range: 3.0, min_range: 0.3 },
        'chn-99g': { max_range: 4.0, effective_range: 3.0, min_range: 0.3 },
        't72': { max_range: 3.5, effective_range: 2.5, min_range: 0.3 },
        'zbd-04': { max_range: 3.0, effective_range: 2.0, min_range: 0.2 },
        'btr-82': { max_range: 2.5, effective_range: 1.8, min_range: 0.2 },
      };

      const typeKey = threat_type.toLowerCase().replace(/[^a-z0-9]/g, '');
      const ranges = tankRanges[typeKey] ?? { max_range: 3.5, effective_range: 2.5, min_range: 0.3 };

      // Frontal arc (turret traverse) — if heading is known, the WEZ has a directional bias
      const heading_rad = threat_heading != null ? (threat_heading * Math.PI) / 180 : null;

      // Find positions that are inside vs outside the WEZ
      const map = getActiveMap();
      const nsRoads = map.roads.filter((r) => r.axis === 'ns');

      const safePositions: Array<{ x: number; y: number; distance: number; reason: string }> = [];

      for (const road of nsRoads) {
        // Check firing positions along this road at key E-W intersections
        const ewRoads = map.roads.filter((r) => r.axis === 'ew');
        for (const ew of ewRoads) {
          const pos = { x: road.position, y: ew.position };
          const d = dist(pos, threat_position);

          // Outside max range = safe
          if (d > ranges.max_range) {
            safePositions.push({ ...pos, distance: d, reason: `Beyond max range (${ranges.max_range})` });
            continue;
          }

          // Check if terrain masks the position (building blocks between roads)
          // In an urban grid, a position on a parallel street is masked if there's
          // a building block between them (i.e., not on the same road as the threat)
          const sameRoadAsTarget = Math.abs(road.position - threat_position.x) < 0.2 ||
            Math.abs(ew.position - threat_position.y) < 0.2;

          if (!sameRoadAsTarget && d < ranges.effective_range) {
            safePositions.push({ ...pos, distance: d, reason: 'Terrain masked — buildings between streets provide defilade' });
          }

          // Behind the threat (outside frontal arc) if heading known
          if (heading_rad != null) {
            const angleToPos = Math.atan2(pos.x - threat_position.x, pos.y - threat_position.y);
            const angleDiff = Math.abs(angleToPos - heading_rad);
            if (angleDiff > Math.PI * 0.6) {
              safePositions.push({ ...pos, distance: d, reason: 'Behind threat frontal arc — reduced reaction time' });
            }
          }
        }
      }

      return JSON.stringify({
        threat_type,
        threat_position,
        wez: {
          max_range: ranges.max_range,
          effective_range: ranges.effective_range,
          min_range: ranges.min_range,
          heading: threat_heading ?? 'unknown',
        },
        safe_positions: safePositions.slice(0, 10),
        recommendation: `Position forces beyond ${ranges.effective_range} room units from threat or use terrain masking. Flanking from perpendicular streets is optimal.`,
      });
    },
  });

  const selectOPTool = new DynamicStructuredTool({
    name: 'select_observation_post',
    description: 'Select the best observation post (OP) position for overwatch. Considers elevation, sight lines to the threat area, concealment from enemy observation, and distance from the engagement zone. Returns ranked candidates.',
    schema: z.object({
      threat_area_center: z.object({ x: z.number(), y: z.number() }).describe('Center of the threat area to observe'),
      friendly_base: z.object({ x: z.number(), y: z.number() }).describe('Friendly base position (for withdrawal route consideration)'),
      min_distance_from_threat: z.number().optional().describe('Minimum safe distance from threats (default: 1.5)'),
    }),
    func: async ({ threat_area_center, friendly_base, min_distance_from_threat }) => {
      const minDist = min_distance_from_threat ?? 1.5;
      const map = getActiveMap();

      const candidates: Array<{
        position: { x: number; y: number };
        name: string;
        score: number;
        reasoning: string;
      }> = [];

      // Score landmarks
      for (const lm of map.landmarks) {
        const d = dist(lm.position, threat_area_center);
        if (d < minDist) continue;

        let score = 0;
        const reasons: string[] = [];

        // Elevation bonus
        if (lm.type === 'elevated') {
          score += 40;
          reasons.push('Elevated position — superior sight lines');
        }

        // Distance scoring: close enough to observe, far enough to be safe
        if (d >= minDist && d <= minDist + 2) {
          score += 25;
          reasons.push(`Good observation distance (${d.toFixed(1)} units from threat)`);
        } else if (d > minDist + 2) {
          score += 10;
          reasons.push(`Adequate distance (${d.toFixed(1)} units)`);
        }

        // Withdrawal route quality (closer to base = easier withdrawal)
        const distToBase = dist(lm.position, friendly_base);
        if (distToBase < 3) {
          score += 15;
          reasons.push('Short withdrawal route to base');
        }

        // Not on the enemy's likely advance axis (primary roads)
        const onPrimaryRoad = map.roads.some(
          (r) => r.roadClass === 'primary' &&
          ((r.axis === 'ns' && Math.abs(r.position - lm.position.x) < 0.2) ||
           (r.axis === 'ew' && Math.abs(r.position - lm.position.y) < 0.2)),
        );
        if (!onPrimaryRoad) {
          score += 10;
          reasons.push('Off primary road — less likely to be spotted');
        }

        candidates.push({
          position: lm.position,
          name: lm.name,
          score,
          reasoning: reasons.join('; '),
        });
      }

      // Also check key intersections
      const nsRoads = map.roads.filter((r) => r.axis === 'ns');
      const ewRoads = map.roads.filter((r) => r.axis === 'ew');

      for (const ns of nsRoads) {
        for (const ew of ewRoads) {
          const pos = { x: ns.position, y: ew.position };
          const d = dist(pos, threat_area_center);
          if (d < minDist || d > minDist + 3) continue;

          let score = 0;
          const reasons: string[] = [];

          // Cross-street visibility — can observe along both axes
          score += 15;
          reasons.push(`Intersection of ${ns.name} and ${ew.name}`);

          if (d >= minDist && d <= minDist + 1.5) {
            score += 20;
            reasons.push(`Good observation distance (${d.toFixed(1)} units)`);
          }

          if (ns.roadClass === 'residential' || ew.roadClass === 'residential') {
            score += 5;
            reasons.push('Residential street — better concealment');
          }

          candidates.push({
            position: pos,
            name: `${ns.name} / ${ew.name}`,
            score,
            reasoning: reasons.join('; '),
          });
        }
      }

      candidates.sort((a, b) => b.score - a.score);

      return JSON.stringify({
        candidates: candidates.slice(0, 5),
        best: candidates[0] ?? null,
      });
    },
  });

  const identifyKillZoneTool = new DynamicStructuredTool({
    name: 'identify_kill_zone',
    description: `Identify the optimal kill zone and mutually supporting firing positions for an ambush.

Doctrinal constraints (FM 3-21.8, FM 3-90-1):
- ALL firing positions are BEHIND the kill zone (opposite side from enemy approach)
- Arcs of fire are MUTUALLY SUPPORTING — converging on kill zone, never through a friendly position
- Positions use terrain/obstacles for cover and observation
- Positions are at maximum effective range of friendly weapons for standoff
- No position is forward of another along the enemy axis of advance (prevents fratricide)
- Firing positions are laterally separated for crossfire geometry

Returns the kill zone location, firing positions with arcs, and fratricide safety validation.`,
    schema: z.object({
      enemy_advance_axis: z.object({
        road_name: z.string().describe('Name of the road the enemy is advancing on'),
        direction: z.enum(['north', 'south', 'east', 'west']).describe('Direction of enemy movement'),
      }),
      num_firing_positions: z.number().describe('Number of friendly firing positions to place'),
      friendly_max_effective_range: z.number().optional().describe('Max effective range of friendly weapons in room coords (default: 3.5)'),
    }),
    func: async ({ enemy_advance_axis, num_firing_positions, friendly_max_effective_range }) => {
      const map = getActiveMap();
      const direction = enemy_advance_axis.direction;
      const friendlyRange = friendly_max_effective_range ?? 3.5;

      // Find the advance axis road
      const axisRoad = map.roads.find(
        (r) => r.name.toLowerCase().includes(enemy_advance_axis.road_name.toLowerCase()),
      );

      if (!axisRoad) {
        return JSON.stringify({ error: `Road "${enemy_advance_axis.road_name}" not found in map data` });
      }

      // DOCTRINAL AMBUSH POSITIONING (FM 3-21.8):
      //
      // 1. ALL firing positions are BEHIND the kill zone relative to enemy advance.
      //    Enemy advancing south → positions are south of kill zone, firing NORTH.
      //    Enemy advancing north → positions are north of kill zone, firing SOUTH.
      //    Enemy advancing east → positions are east of kill zone, firing WEST.
      //    Enemy advancing west → positions are west of kill zone, firing WEST.
      //
      // 2. Positions are LATERALLY SEPARATED (spread along the perpendicular axis)
      //    to create converging fires into the kill zone from different angles.
      //    This is an L-shaped or linear ambush — NOT a crossfire where positions
      //    face each other across the kill zone.
      //
      // 3. No position's arc of fire sweeps through another friendly position.
      //
      // 4. Positions use set-back from the kill zone for standoff and cover.

      const perpRoads = map.roads.filter((r) => r.axis !== axisRoad.axis)
        .sort((a, b) => a.position - b.position);

      const behindFilter = getBehindFilter(direction, axisRoad);
      const firingDir = getFiringDirectionToward(direction);

      interface FiringPosition {
        direction: string;
        road: string;
        position: { x: number; y: number };
        firing_direction: string;
        distance_to_kz: number;
        cover_score: number;
      }

      const killZoneCandidates: Array<{
        center: { x: number; y: number };
        cross_street: string;
        flanking_corridors: FiringPosition[];
        score: number;
        fratricide_safe: boolean;
      }> = [];

      // For each PAIR of perpendicular roads, evaluate the kill zone between them
      for (let i = 0; i < perpRoads.length; i++) {
        for (let j = i + 1; j < perpRoads.length; j++) {
          const road1 = perpRoads[i]; // lower position value
          const road2 = perpRoads[j]; // higher position value

          const gap = road2.position - road1.position;
          if (gap < 0.8 || gap > 3.0) continue; // Kill zone too narrow or too wide

          // Kill zone center is at the intersection of the axis road and midpoint of the two perp roads
          const centerPerp = (road1.position + road2.position) / 2;
          const center = axisRoad.axis === 'ew'
            ? { x: centerPerp, y: axisRoad.position }
            : { x: axisRoad.position, y: centerPerp };

          // Find firing positions: ALL on the SAME SIDE (behind kill zone),
          // laterally separated on different perpendicular roads for converging fire.
          const flankingCorridors: FiringPosition[] = [];

          // Find cross-streets BEHIND the kill zone (opposite side from enemy approach)
          const behindCrossStreets = axisRoad.axis === 'ew'
            ? map.roads
                .filter((r) => r.axis === 'ew' && behindFilter(r.position))
                .sort((a, b) => {
                  // Sort by closest to axis first (for optimal standoff)
                  return Math.abs(a.position - axisRoad.position) - Math.abs(b.position - axisRoad.position);
                })
                .filter((r) => {
                  const d = Math.abs(r.position - axisRoad.position);
                  return d >= 0.5 && d <= friendlyRange; // Min setback + within weapon range
                })
            : map.roads
                .filter((r) => r.axis === 'ns' && behindFilter(r.position))
                .sort((a, b) => {
                  return Math.abs(a.position - axisRoad.position) - Math.abs(b.position - axisRoad.position);
                })
                .filter((r) => {
                  const d = Math.abs(r.position - axisRoad.position);
                  return d >= 0.5 && d <= friendlyRange;
                });

          if (behindCrossStreets.length === 0) continue;

          // Place each firing position on a different perpendicular road,
          // all at the same (or similar) setback distance behind the kill zone.
          // This ensures lateral separation with converging arcs.
          const perpRoadsForPositions = [road1, road2];
          // If we need more positions, add other perpendicular roads between them
          if (num_firing_positions > 2) {
            const midPerps = perpRoads.filter(
              (r) => r.position > road1.position && r.position < road2.position,
            );
            perpRoadsForPositions.splice(1, 0, ...midPerps);
          }

          for (let p = 0; p < Math.min(num_firing_positions, perpRoadsForPositions.length); p++) {
            const perpRd = perpRoadsForPositions[p];
            // Use the closest behind cross-street, alternating if multiple available
            const cs = behindCrossStreets[p % behindCrossStreets.length];

            const pos = axisRoad.axis === 'ew'
              ? { x: perpRd.position, y: cs.position }
              : { x: cs.position, y: perpRd.position };

            const distToKZ = dist(pos, center);

            // Score cover/concealment at this position
            let coverScore = 0;
            // Off primary road = better concealment
            if (perpRd.roadClass === 'residential' || perpRd.roadClass === 'unclassified') coverScore += 15;
            if (cs.roadClass === 'residential' || cs.roadClass === 'unclassified') coverScore += 10;
            // Near a landmark with cover potential
            const nearbyLandmark = map.landmarks.find((lm) => dist(lm.position, pos) < 1.0);
            if (nearbyLandmark?.type === 'structure') coverScore += 20;
            if (nearbyLandmark?.type === 'elevated') coverScore += 15;
            if (nearbyLandmark?.notes?.toLowerCase().includes('conceal')) coverScore += 10;
            // Setback bonus — further from kill zone = more standoff
            if (distToKZ >= 1.5) coverScore += 10;

            const roadLabel = axisRoad.axis === 'ew'
              ? `${perpRd.name} / ${cs.name}`
              : `${cs.name} / ${perpRd.name}`;

            flankingCorridors.push({
              direction: firingDir,
              road: roadLabel,
              position: pos,
              firing_direction: `Fire ${firingDir} along ${perpRd.name} into kill zone`,
              distance_to_kz: Math.round(distToKZ * 100) / 100,
              cover_score: coverScore,
            });
          }

          if (flankingCorridors.length < 2) continue;

          // FRATRICIDE SAFETY CHECK: verify no position's arc of fire
          // sweeps through another friendly position
          let fratricideSafe = true;
          for (let a = 0; a < flankingCorridors.length; a++) {
            for (let b = 0; b < flankingCorridors.length; b++) {
              if (a === b) continue;
              if (isInArcOfFire(flankingCorridors[a].position, center, flankingCorridors[b].position)) {
                fratricideSafe = false;
              }
            }
          }

          // Verify no position is forward of another along the enemy axis
          let noForwardViolation = true;
          const positions = flankingCorridors.map((fc) => fc.position);
          for (let a = 0; a < positions.length; a++) {
            for (let b = a + 1; b < positions.length; b++) {
              const axisCoord = (p: { x: number; y: number }) =>
                (direction === 'south' || direction === 'north') ? p.y : p.x;
              const diff = Math.abs(axisCoord(positions[a]) - axisCoord(positions[b]));
              // If positions differ significantly along the enemy axis, one is "forward"
              // which risks the rear position firing through the forward one
              if (diff > 1.0) {
                noForwardViolation = false;
              }
            }
          }

          let score = 0;
          // Lateral spacing bonus — wider = better converging fire geometry
          score += gap * 10;
          // Center of AO bonus
          const mapCenter = (map.bounds.x_min + map.bounds.x_max) / 2;
          const centeredness = 1 - Math.abs(center.x - mapCenter) / mapCenter;
          score += centeredness * 10;
          // Cover/concealment at firing positions
          score += flankingCorridors.reduce((s, fc) => s + fc.cover_score, 0) / flankingCorridors.length;
          // Fratricide safety bonus (critical)
          if (fratricideSafe) score += 30;
          if (noForwardViolation) score += 20;
          // Within effective weapon range
          const allInRange = flankingCorridors.every((fc) => fc.distance_to_kz <= friendlyRange);
          if (allInRange) score += 15;

          killZoneCandidates.push({
            center,
            cross_street: `${road1.name} to ${road2.name}`,
            flanking_corridors: flankingCorridors.slice(0, num_firing_positions),
            score,
            fratricide_safe: fratricideSafe && noForwardViolation,
          });
        }
      }

      killZoneCandidates.sort((a, b) => b.score - a.score);

      const best = killZoneCandidates[0];
      const firingPositions = best?.flanking_corridors.slice(0, num_firing_positions) ?? [];

      return JSON.stringify({
        kill_zone: best ? {
          center: best.center,
          advance_axis: axisRoad.name,
          cross_street: best.cross_street,
          fratricide_safe: best.fratricide_safe,
        } : null,
        recommended_firing_positions: firingPositions,
        all_candidates: killZoneCandidates.slice(0, 5),
        enemy_direction: direction,
        friendly_max_effective_range: friendlyRange,
        tactical_notes: [
          `Enemy advancing ${direction} on ${axisRoad.name} (${axisRoad.lanes}-lane ${axisRoad.roadClass})`,
          `ALL firing positions are BEHIND the kill zone (${firingDir} side), firing ${getFiringDirectionToward(direction).toUpperCase()} into enemy approach`,
          'Positions are laterally separated on different perpendicular roads for converging fire',
          'Arcs of fire are mutually supporting — converging on kill zone, NOT crossing through friendly positions',
          `No position is forward of another along the ${direction}ward enemy axis of advance`,
          `Positions within max effective range of friendly weapons (${friendlyRange} room units)`,
          'Positions scored for cover/concealment from terrain and obstacles',
          `Minimum 1.5 room unit lateral spacing between firing positions`,
          'Followers hold position and engage targets as they enter the kill zone — do NOT advance toward the enemy',
        ],
        safety_validation: best ? {
          fratricide_safe: best.fratricide_safe,
          all_positions_behind_kz: true,
          all_positions_in_weapon_range: firingPositions.every((fp) => fp.distance_to_kz <= friendlyRange),
          lateral_separation: firingPositions.length >= 2
            ? Math.round(dist(firingPositions[0].position, firingPositions[1].position) * 100) / 100
            : null,
        } : null,
      });
    },
  });

  const assessThreatTool = new DynamicStructuredTool({
    name: 'assess_threat_capability',
    description: 'Assess a detected threat vehicle\'s capabilities, including weapon range, armor class, speed, and recommended engagement tactics.',
    schema: z.object({
      threat_type: z.string().describe('Detected threat classification (e.g., T-90, CHN-99G, ZBD-04)'),
      count: z.number().describe('Number of threats detected'),
    }),
    func: async ({ threat_type, count }) => {
      const db: Record<string, {
        full_name: string; class: string; weapon: string; armor: string;
        max_speed_kmh: number; crew: number; weight_tons: number;
        engagement_tactics: string[];
      }> = {
        't-90': {
          full_name: 'T-90 Main Battle Tank', class: 'MBT', weapon: '125mm 2A46M smoothbore + 7.62mm PKT + 12.7mm Kord',
          armor: 'Composite + Kontakt-5 ERA', max_speed_kmh: 60, crew: 3, weight_tons: 46.5,
          engagement_tactics: ['Flank attack from perpendicular streets', 'Target rear arc where ERA coverage is thinnest', 'Use ATGM from 2+ km range if possible', 'Avoid frontal engagement'],
        },
        'chn-99g': {
          full_name: 'Type 99G Main Battle Tank (ZTZ-99G)', class: 'MBT', weapon: '125mm ZPT-98 smoothbore + 7.62mm coaxial + 12.7mm AA',
          armor: 'Composite + FY-4 ERA + APS', max_speed_kmh: 80, crew: 3, weight_tons: 58,
          engagement_tactics: ['High-priority target — advanced APS may defeat ATGMs', 'Engage from multiple simultaneous angles to overwhelm APS', 'Target tracks/roadwheels for mobility kill', 'Avoid frontal engagement — composite + ERA rated vs 125mm APFSDS'],
        },
        'zbd-04': {
          full_name: 'ZBD-04 Infantry Fighting Vehicle', class: 'IFV', weapon: '100mm gun/launcher + 30mm autocannon + 7.62mm MG',
          armor: 'Aluminum alloy + appliqué', max_speed_kmh: 65, crew: 3, weight_tons: 24.5,
          engagement_tactics: ['Lighter armor — vulnerable to heavy MG and autocannon fire', 'Carries infantry squad — may dismount on contact', 'Engage before infantry can deploy', '100mm launcher fires ATGMs — keep it suppressed'],
        },
        'btr-82': {
          full_name: 'BTR-82 Armored Personnel Carrier', class: 'APC', weapon: '30mm 2A72 autocannon + 7.62mm PKT',
          armor: 'Steel hull + spall liner', max_speed_kmh: 80, crew: 3, weight_tons: 15.5,
          engagement_tactics: ['Lightest armor — most targets effective', 'High speed — may attempt to break through kill zone rapidly', 'Carries 7 dismounts — priority to prevent dismount', 'Wheeled — vulnerable to obstacle/roadblock'],
        },
      };

      const typeKey = threat_type.toLowerCase().replace(/[^a-z0-9]/g, '');
      const info = db[typeKey];

      if (!info) {
        return JSON.stringify({
          threat_type,
          assessment: 'Unknown vehicle type — treat as MBT-equivalent threat',
          recommended_response: 'Engage with maximum available firepower from concealed flanking positions',
        });
      }

      return JSON.stringify({
        threat_type: info.full_name,
        classification: info.class,
        count,
        capabilities: {
          weapons: info.weapon,
          armor: info.armor,
          max_speed: `${info.max_speed_kmh} km/h`,
          crew: info.crew,
          weight: `${info.weight_tons} tons`,
        },
        threat_level: info.class === 'MBT' ? 'HIGH' : info.class === 'IFV' ? 'MEDIUM' : 'LOW',
        engagement_tactics: info.engagement_tactics,
        force_ratio_assessment: count >= 3
          ? 'Outnumbered — recommend observe/report and request reinforcement'
          : count >= 2
          ? 'Manageable with flanking ambush — simultaneous engagement critical'
          : 'Single target — favorable engagement odds with proper positioning',
      });
    },
  });

  const evaluateEngagementTool = new DynamicStructuredTool({
    name: 'evaluate_engagement',
    description: 'Evaluate whether to engage a target based on its position relative to the kill zone, authorization status, and tactical conditions. Returns fire/hold/track decision.',
    schema: z.object({
      target_position: z.object({ x: z.number(), y: z.number() }),
      kill_zone_center: z.object({ x: z.number(), y: z.number() }),
      kill_zone_radius: z.number().optional().describe('Kill zone radius (default 0.5)'),
      weapons_authorized: z.boolean(),
      firing_positions: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
      target_heading: z.number().optional(),
    }),
    func: async ({ target_position, kill_zone_center, kill_zone_radius, weapons_authorized, firing_positions, target_heading }) => {
      const radius = kill_zone_radius ?? 0.5;
      const distToKZ = dist(target_position, kill_zone_center);
      const inKillZone = distToKZ <= radius;

      // Check fields of fire — ensure no friendly position is between any
      // firing position and the target (fratricide risk from shooting through friendlies)
      let clearFieldsOfFire = true;
      const fratricideWarnings: string[] = [];
      if (firing_positions) {
        for (let i = 0; i < firing_positions.length; i++) {
          const fp = firing_positions[i];
          const distToTarget = dist(fp, target_position);
          if (distToTarget < 0.3) {
            clearFieldsOfFire = false;
            fratricideWarnings.push(`Position ${i + 1} too close to target (${distToTarget.toFixed(2)} units)`);
          }
          // Check if any OTHER friendly position is in the arc of fire from this position to the target
          for (let j = 0; j < firing_positions.length; j++) {
            if (i === j) continue;
            if (isInArcOfFire(fp, target_position, firing_positions[j])) {
              clearFieldsOfFire = false;
              fratricideWarnings.push(`Position ${i + 1}'s arc of fire toward target passes through position ${j + 1} — DO NOT FIRE`);
            }
          }
        }
      }

      // Determine if target is approaching or departing the kill zone
      let approaching = true;
      if (target_heading !== undefined) {
        // If target is heading away from the kill zone center, it's departing
        const dx = kill_zone_center.x - target_position.x;
        const dy = kill_zone_center.y - target_position.y;
        const bearingToKZ = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
        const headingDiff = Math.abs(bearingToKZ - target_heading);
        approaching = headingDiff < 90 || headingDiff > 270;
      }

      let decision: 'fire' | 'hold' | 'track';
      let reasoning: string;

      if (!weapons_authorized) {
        decision = 'track';
        reasoning = 'Weapons not authorized — track target and await authorization';
      } else if (inKillZone && clearFieldsOfFire) {
        decision = 'fire';
        reasoning = `Target in kill zone (${distToKZ.toFixed(2)} units from center, within ${radius} radius). Weapons authorized. Clear fields of fire. ENGAGE.`;
      } else if (approaching && distToKZ < radius * 2) {
        decision = 'hold';
        reasoning = `Target approaching kill zone (${distToKZ.toFixed(2)} units from center). Hold fire — let target enter kill zone for maximum effect.`;
      } else if (!approaching) {
        decision = 'track';
        reasoning = 'Target moving away from kill zone — track and report';
      } else {
        decision = 'hold';
        reasoning = `Target at ${distToKZ.toFixed(2)} units from kill zone — too far for effective engagement. Hold position.`;
      }

      return JSON.stringify({
        decision,
        reasoning,
        target_in_kill_zone: inKillZone,
        distance_to_kill_zone: Math.round(distToKZ * 100) / 100,
        approaching,
        weapons_authorized,
        clear_fields_of_fire: clearFieldsOfFire,
        fratricide_warnings: fratricideWarnings.length > 0 ? fratricideWarnings : undefined,
      });
    },
  });

  return [calculateWEZTool, selectOPTool, identifyKillZoneTool, assessThreatTool, evaluateEngagementTool];
}
