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
    description: 'Identify the optimal kill zone for an ambush given the enemy advance axis. A kill zone is a section of road where the enemy is channelized, exposed to flanking fire, and has limited escape routes. Returns the best kill zone with flanking fire position recommendations.',
    schema: z.object({
      enemy_advance_axis: z.object({
        road_name: z.string().describe('Name of the road the enemy is advancing on'),
        direction: z.enum(['north', 'south', 'east', 'west']).describe('Direction of enemy movement'),
      }),
      num_firing_positions: z.number().describe('Number of friendly firing positions to place'),
    }),
    func: async ({ enemy_advance_axis, num_firing_positions }) => {
      const map = getActiveMap();
      const direction = enemy_advance_axis.direction;

      // Find the advance axis road
      const axisRoad = map.roads.find(
        (r) => r.name.toLowerCase().includes(enemy_advance_axis.road_name.toLowerCase()),
      );

      if (!axisRoad) {
        return JSON.stringify({ error: `Road "${enemy_advance_axis.road_name}" not found in map data` });
      }

      // FLANKING AMBUSH: Position firing elements on DIFFERENT roads to create
      // a crossfire perpendicular to the enemy's direction of travel.
      //
      // For E-W axis (enemy moving N→S on Zhongxiao West Rd):
      //   - Kill zone: segment of Zhongxiao between two N-S roads
      //   - Firing pos 1: On western N-S road, south of axis, firing EAST
      //   - Firing pos 2: On eastern N-S road, south of axis, firing WEST
      //   - Creates L-shaped or crossfire ambush
      //
      // For N-S axis (enemy moving E→W):
      //   - Kill zone: segment of the N-S road between two E-W roads
      //   - Firing positions on different E-W roads north and south

      const perpRoads = map.roads.filter((r) => r.axis !== axisRoad.axis)
        .sort((a, b) => a.position - b.position);

      // Find the best pair of perpendicular roads to create a crossfire
      // Kill zone is the segment of the axis road between these two roads
      interface FiringPosition {
        direction: string;
        road: string;
        position: { x: number; y: number };
        firing_direction: string;
      }

      const killZoneCandidates: Array<{
        center: { x: number; y: number };
        cross_street: string;
        flanking_corridors: FiringPosition[];
        score: number;
      }> = [];

      // For each PAIR of perpendicular roads, evaluate the crossfire
      for (let i = 0; i < perpRoads.length; i++) {
        for (let j = i + 1; j < perpRoads.length; j++) {
          const westRoad = perpRoads[i]; // lower position = west (for NS perps) or south (for EW perps)
          const eastRoad = perpRoads[j];

          const gap = eastRoad.position - westRoad.position;
          if (gap < 0.8 || gap > 3.0) continue; // Kill zone too narrow or too wide

          // Kill zone center
          const centerPerp = (westRoad.position + eastRoad.position) / 2;
          const center = axisRoad.axis === 'ew'
            ? { x: centerPerp, y: axisRoad.position }
            : { x: axisRoad.position, y: centerPerp };

          // Find firing positions: on E-W cross-streets set back from the axis
          const flankingCorridors: FiringPosition[] = [];

          if (axisRoad.axis === 'ew') {
            // Enemy on E-W road. N-S perpendicular roads provide flanking corridors.
            // Position on cross-streets (E-W) 1-2 blocks south of the axis
            const crossStreet = map.roads
              .filter((r) => r.axis === 'ew' && r.position < axisRoad.position)
              .sort((a, b) => b.position - a.position) // closest to axis first
              .find((r) => Math.abs(r.position - axisRoad.position) >= 0.5);

            if (crossStreet) {
              // L-SHAPED AMBUSH: Both positions on the SAME side (south/west),
              // separated along the axis, firing in the SAME direction toward
              // the kill zone. No crossing fires through friendly positions.

              // Find two cross-streets south of the axis for separation
              const crossStreets = map.roads
                .filter((r) => r.axis === 'ew' && r.position < axisRoad.position)
                .sort((a, b) => b.position - a.position) // closest to axis first
                .filter((r) => Math.abs(r.position - axisRoad.position) >= 0.5)
                .slice(0, 2);

              // Position 1: west road, closest cross-street — fires NORTH into kill zone
              if (crossStreets[0]) {
                flankingCorridors.push({
                  direction: 'north',
                  road: `${westRoad.name} / ${crossStreets[0].name}`,
                  position: { x: westRoad.position, y: crossStreets[0].position },
                  firing_direction: `Fire north along ${westRoad.name} into kill zone`,
                });
              }

              // Position 2: east road, same or next cross-street — fires NORTH into kill zone
              const cs2 = crossStreets[1] ?? crossStreets[0];
              if (cs2) {
                flankingCorridors.push({
                  direction: 'north',
                  road: `${eastRoad.name} / ${cs2.name}`,
                  position: { x: eastRoad.position, y: cs2.position },
                  firing_direction: `Fire north along ${eastRoad.name} into kill zone`,
                });
              }
            }
          } else {
            // Enemy on N-S road. E-W perpendicular roads provide flanking corridors.
            const crossStreet = map.roads
              .filter((r) => r.axis === 'ns' && r.position > axisRoad.position)
              .sort((a, b) => a.position - b.position)
              .find((r) => Math.abs(r.position - axisRoad.position) >= 0.5);

            if (crossStreet) {
              flankingCorridors.push({
                direction: 'south',
                road: `${crossStreet.name} / ${westRoad.name}`,
                position: { x: crossStreet.position, y: westRoad.position },
                firing_direction: `Fire south along ${crossStreet.name} across kill zone`,
              });
              flankingCorridors.push({
                direction: 'north',
                road: `${crossStreet.name} / ${eastRoad.name}`,
                position: { x: crossStreet.position, y: eastRoad.position },
                firing_direction: `Fire north along ${crossStreet.name} across kill zone`,
              });
            }
          }

          if (flankingCorridors.length < 2) continue;

          let score = 0;
          // Spacing bonus — wider spacing = better crossfire geometry
          score += gap * 10;
          // Center of AO bonus
          const centeredness = 1 - Math.abs(center.x - 2.5) / 2.5;
          score += centeredness * 10;
          // Residential roads bonus (concealment for firing positions)
          if (westRoad.roadClass === 'residential') score += 5;
          if (eastRoad.roadClass === 'residential') score += 5;
          // Crossfire bonus
          score += 20;

          killZoneCandidates.push({
            center,
            cross_street: `${westRoad.name} to ${eastRoad.name}`,
            flanking_corridors: flankingCorridors.slice(0, num_firing_positions),
            score,
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
        } : null,
        recommended_firing_positions: firingPositions,
        all_candidates: killZoneCandidates.slice(0, 5),
        enemy_direction: direction,
        tactical_notes: [
          `Enemy advancing ${direction} on ${axisRoad.name} (${axisRoad.lanes}-lane ${axisRoad.roadClass})`,
          'Firing positions create CROSSFIRE perpendicular to enemy direction of travel',
          'Each position fires ACROSS the kill zone from a different perpendicular road',
          'Ensure firing corridors do not cross each other (mutual defilade)',
          `Space firing positions at least 1.5 room units apart`,
          'Followers hold position and engage targets as they enter the kill zone — do NOT advance toward the enemy',
        ],
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

  return [calculateWEZTool, selectOPTool, identifyKillZoneTool, assessThreatTool];
}
