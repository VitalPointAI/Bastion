/**
 * EFDL (Eastern Flank Deterrent Line) Control Measures Overlay
 *
 * Generates a COP control_measures layer depicting the layered defense
 * architecture for autonomous robot operations along NATO's eastern flank.
 *
 * Based on the EFDL concept (emergentdefense.com):
 * - Multi-domain sensor network + physical barriers + robotic forces
 * - Three-phase defense: robotic engagement → attrition → counteroffensive
 * - Persistent sensors, affordable mass, AI-linked C2
 *
 * The overlay scales from the UEA (Unmanned Engagement Area) calibration
 * profile to show the broader operational context: where our robots operate
 * within the larger defensive architecture.
 *
 * Control measures generated:
 * - EFDL Main Defensive Line (boundary)
 * - Forward Security Zone (50km depth — sensors, obstacles, early warning)
 * - Unmanned Engagement Area (where robotic forces conduct direct fire)
 * - Robotic Kill Zone (the specific engagement area within the UEA)
 * - Fire Support Coordination Line (deconfliction between robotic/manned fires)
 * - Phase Line SENSOR (forward edge of sensor coverage)
 * - Phase Line CONTACT (expected initial enemy contact)
 * - Phase Line ATTRITION (enemy reduced to 30% combat strength)
 * - Rear Area Boundary (manned NATO force counterattack staging)
 */

import { randomUUID } from 'crypto';
import type { COPControlMeasureSpec, COPLayerSpec } from '../cop/layers/layer-types.js';
import { calibrationService } from './calibration-service.js';

// ---------------------------------------------------------------------------
// Geographic helpers
// ---------------------------------------------------------------------------

/**
 * Offset a lat/lng point by approximate km in cardinal directions.
 * Uses simple spherical approximation (accurate enough for overlay display).
 */
function offsetKm(
  lat: number,
  lng: number,
  northKm: number,
  eastKm: number,
): { lat: number; lng: number } {
  const latPerKm = 1 / 111.32;
  const lngPerKm = 1 / (111.32 * Math.cos((lat * Math.PI) / 180));
  return {
    lat: lat + northKm * latPerKm,
    lng: lng + eastKm * lngPerKm,
  };
}

/**
 * Create a rectangular polygon from a center point with width/height in km.
 */
function rectFromCenter(
  center: { lat: number; lng: number },
  widthKm: number,
  heightKm: number,
): Array<{ lat: number; lng: number }> {
  const hw = widthKm / 2;
  const hh = heightKm / 2;
  return [
    offsetKm(center.lat, center.lng, hh, -hw),   // NW
    offsetKm(center.lat, center.lng, hh, hw),    // NE
    offsetKm(center.lat, center.lng, -hh, hw),   // SE
    offsetKm(center.lat, center.lng, -hh, -hw),  // SW
  ];
}

/**
 * Create a line (series of points) at a given north/south offset from center,
 * spanning the full width.
 */
function horizontalLine(
  center: { lat: number; lng: number },
  northOffsetKm: number,
  widthKm: number,
): Array<{ lat: number; lng: number }> {
  const hw = widthKm / 2;
  return [
    offsetKm(center.lat, center.lng, northOffsetKm, -hw),
    offsetKm(center.lat, center.lng, northOffsetKm, hw),
  ];
}

// ---------------------------------------------------------------------------
// EFDL Overlay Generator
// ---------------------------------------------------------------------------

/**
 * Generate EFDL control measures overlay centered on the active calibration
 * profile's map area. The overlay shows the layered defense architecture
 * at operational scale around the tactical UEA.
 *
 * Dimensions (approximate, based on EFDL concept):
 * - Total depth: ~200km (from forward sensors to rear staging)
 * - Forward Security Zone: 50km depth ahead of main line
 * - Unmanned Engagement Area: 20-30km depth (robotic direct fire zone)
 * - Attrition Zone: 50-80km depth (combined fires reduce enemy to 30%)
 * - Rear Area: 50km depth (manned NATO counterattack staging)
 * - Width: ~120km sector frontage (typical brigade+ frontage at this scale)
 *
 * For demo purposes these are scaled down proportionally to be visible
 * around the UEA calibration area while maintaining relative proportions.
 */
export function generateEFDLOverlay(profileName = 'default'): COPControlMeasureSpec[] {
  const profile = calibrationService.getProfile(profileName);
  const bounds = profile.map_bounds;

  // Center of the UEA (where our robots actually operate)
  const ueaCenter = {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };

  // Scale factors — the UEA is ~2km × 1.5km in room space.
  // The EFDL operates at 50-150km scale. We'll show the operational
  // context at a scale that's visible when zoomed out from the UEA.
  // Using ~1/10 scale so the overlay is ~20km wide × 50km deep total,
  // visible when zooming out 2-3 levels from the UEA tactical view.
  const sectorWidth = 12;  // km — sector frontage
  const fwdSecurityDepth = 5;  // km — forward security zone
  const ueaDepth = 2;  // km — unmanned engagement area
  const attritionDepth = 5;  // km — attrition zone
  const rearDepth = 5;  // km — rear staging area
  const totalDepth = fwdSecurityDepth + ueaDepth + attritionDepth + rearDepth;

  // The UEA center is within the engagement area. The enemy approaches
  // from the NORTH (toward Russia/Belarus). Defense faces north.
  // Layout (north to south):
  //   PL SENSOR (forward edge)
  //   Forward Security Zone (sensors, obstacles, early warning)
  //   PL CONTACT (expected initial contact)
  //   Unmanned Engagement Area (robotic direct fire)
  //   FSCL (fire support coordination line)
  //   PL ATTRITION (enemy at 30% strength)
  //   Attrition Zone (combined arms fires)
  //   Main Defensive Line (EFDL boundary)
  //   Rear Area (NATO counterattack staging)

  // Position the UEA center at the engagement zone, offset slightly
  // south of the overall center so the security zone extends north
  const defenseCenter = offsetKm(ueaCenter.lat, ueaCenter.lng, -1, 0);

  // North edge = forward, South edge = rear
  const northEdge = totalDepth / 2 + 2; // km north of defense center

  const measures: COPControlMeasureSpec[] = [];

  // ── 1. EFDL SECTOR BOUNDARY ──────────────────────────────────────
  // The overall sector our forces are responsible for
  measures.push({
    id: `efdl-sector-${randomUUID().slice(0, 8)}`,
    type: 'boundary',
    label: 'EFDL SECTOR LATGALE',
    points: rectFromCenter(defenseCenter, sectorWidth, totalDepth),
    style: { color: '#1a1a2e', weight: '3', dashArray: '15,5', fillOpacity: '0.02' },
  });

  // ── 2. FORWARD SECURITY ZONE ─────────────────────────────────────
  // 50km (scaled) depth — persistent sensors, obstacles, early warning
  // Extends from PL SENSOR to PL CONTACT
  const fszNorth = northEdge - 1;
  const fszSouth = fszNorth - fwdSecurityDepth;
  measures.push({
    id: `efdl-fsz-${randomUUID().slice(0, 8)}`,
    type: 'security_zone',
    label: 'FORWARD SECURITY ZONE — Sensors / Obstacles / Early Warning',
    points: [
      offsetKm(defenseCenter.lat, defenseCenter.lng, fszNorth, -sectorWidth / 2),
      offsetKm(defenseCenter.lat, defenseCenter.lng, fszNorth, sectorWidth / 2),
      offsetKm(defenseCenter.lat, defenseCenter.lng, fszSouth, sectorWidth / 2),
      offsetKm(defenseCenter.lat, defenseCenter.lng, fszSouth, -sectorWidth / 2),
    ],
    style: { color: '#ff9800', weight: '2', dashArray: '8,4', fillOpacity: '0.05' },
  });

  // ── 3. UNMANNED ENGAGEMENT AREA (UEA) ────────────────────────────
  // Where robotic forces conduct direct fire — our robots operate here
  const ueaNorth = fszSouth;
  const ueaSouth = ueaNorth - ueaDepth;
  measures.push({
    id: `efdl-uea-${randomUUID().slice(0, 8)}`,
    type: 'engagement_area',
    label: 'EA IRON — Unmanned Engagement Area (Robotic Direct Fire)',
    points: [
      offsetKm(defenseCenter.lat, defenseCenter.lng, ueaNorth, -sectorWidth / 2),
      offsetKm(defenseCenter.lat, defenseCenter.lng, ueaNorth, sectorWidth / 2),
      offsetKm(defenseCenter.lat, defenseCenter.lng, ueaSouth, sectorWidth / 2),
      offsetKm(defenseCenter.lat, defenseCenter.lng, ueaSouth, -sectorWidth / 2),
    ],
    style: { color: '#ef4444', weight: '2', fillOpacity: '0.08' },
  });

  // ── 4. ROBOTIC KILL ZONE ─────────────────────────────────────────
  // The specific kill zone within the UEA where our robot team operates
  // This is approximately the calibration profile area
  measures.push({
    id: `efdl-kz-${randomUUID().slice(0, 8)}`,
    type: 'engagement_area',
    label: 'KZ ALPHA — Robotic Kill Zone (Active)',
    points: [
      { lat: bounds.north, lng: bounds.west },
      { lat: bounds.north, lng: bounds.east },
      { lat: bounds.south, lng: bounds.east },
      { lat: bounds.south, lng: bounds.west },
    ],
    style: { color: '#dc2626', weight: '3', fillOpacity: '0.12' },
  });

  // ── 5. ATTRITION ZONE ────────────────────────────────────────────
  // Combined arms fires zone — enemy reduced to ~30% combat strength
  const azNorth = ueaSouth;
  const azSouth = azNorth - attritionDepth;
  measures.push({
    id: `efdl-az-${randomUUID().slice(0, 8)}`,
    type: 'objective_area',
    label: 'ATTRITION ZONE — Combined Arms Fires (Target: 30% Enemy Strength)',
    points: [
      offsetKm(defenseCenter.lat, defenseCenter.lng, azNorth, -sectorWidth / 2),
      offsetKm(defenseCenter.lat, defenseCenter.lng, azNorth, sectorWidth / 2),
      offsetKm(defenseCenter.lat, defenseCenter.lng, azSouth, sectorWidth / 2),
      offsetKm(defenseCenter.lat, defenseCenter.lng, azSouth, -sectorWidth / 2),
    ],
    style: { color: '#7c3aed', weight: '2', dashArray: '6,3', fillOpacity: '0.05' },
  });

  // ── 6. REAR AREA ─────────────────────────────────────────────────
  // Manned NATO force counterattack staging
  const raNorth = azSouth;
  const raSouth = raNorth - rearDepth;
  measures.push({
    id: `efdl-rear-${randomUUID().slice(0, 8)}`,
    type: 'boundary',
    label: 'REAR AREA — NATO Manned Force Counterattack Staging',
    points: [
      offsetKm(defenseCenter.lat, defenseCenter.lng, raNorth, -sectorWidth / 2),
      offsetKm(defenseCenter.lat, defenseCenter.lng, raNorth, sectorWidth / 2),
      offsetKm(defenseCenter.lat, defenseCenter.lng, raSouth, sectorWidth / 2),
      offsetKm(defenseCenter.lat, defenseCenter.lng, raSouth, -sectorWidth / 2),
    ],
    style: { color: '#0369a1', weight: '2', dashArray: '10,5', fillOpacity: '0.03' },
  });

  // ── 7. PHASE LINES ───────────────────────────────────────────────

  // PL SENSOR — forward edge of persistent sensor coverage
  measures.push({
    id: `efdl-pl-sensor-${randomUUID().slice(0, 8)}`,
    type: 'phase_line',
    label: 'PL SENSOR — Forward Edge Sensor Coverage',
    points: horizontalLine(defenseCenter, fszNorth, sectorWidth),
    style: { color: '#f59e0b', weight: '2', dashArray: '12,4' },
  });

  // PL CONTACT — expected initial enemy contact line
  measures.push({
    id: `efdl-pl-contact-${randomUUID().slice(0, 8)}`,
    type: 'phase_line',
    label: 'PL CONTACT — Expected Initial Contact',
    points: horizontalLine(defenseCenter, fszSouth, sectorWidth),
    style: { color: '#ef4444', weight: '2', dashArray: '12,4' },
  });

  // PL ATTRITION — line where enemy should be at 30% strength
  measures.push({
    id: `efdl-pl-attrition-${randomUUID().slice(0, 8)}`,
    type: 'phase_line',
    label: 'PL ATTRITION — Enemy at 30% Combat Strength',
    points: horizontalLine(defenseCenter, azSouth, sectorWidth),
    style: { color: '#7c3aed', weight: '2', dashArray: '12,4' },
  });

  // ── 8. FIRE SUPPORT COORDINATION LINE ────────────────────────────
  // Deconfliction between robotic autonomous fires and manned long-range fires
  measures.push({
    id: `efdl-fscl-${randomUUID().slice(0, 8)}`,
    type: 'fire_support_coordination_line',
    label: 'FSCL — Robotic/Manned Fire Deconfliction',
    points: horizontalLine(defenseCenter, ueaSouth, sectorWidth),
    style: { color: '#ec4899', weight: '2', dashArray: '20,5,5,5' },
  });

  // ── 9. MAIN DEFENSIVE LINE (EFDL) ───────────────────────────────
  // The primary defensive line — manned NATO forces hold here
  measures.push({
    id: `efdl-mdl-${randomUUID().slice(0, 8)}`,
    type: 'phase_line',
    label: 'EFDL — Main Defensive Line',
    points: horizontalLine(defenseCenter, raNorth, sectorWidth + 2),
    style: { color: '#1e40af', weight: '4', dashArray: '0' },
  });

  // ── 10. ENEMY AXIS OF ADVANCE ────────────────────────────────────
  // Expected enemy armored advance from north (Russia/Belarus)
  measures.push({
    id: `efdl-axis-enemy-${randomUUID().slice(0, 8)}`,
    type: 'axis_of_advance',
    label: 'AXIS RED — Expected Enemy Armored Advance',
    points: [
      offsetKm(defenseCenter.lat, defenseCenter.lng, fszNorth + 2, 0),
      offsetKm(defenseCenter.lat, defenseCenter.lng, fszNorth, 0),
      offsetKm(defenseCenter.lat, defenseCenter.lng, fszSouth, 0.5),
      offsetKm(defenseCenter.lat, defenseCenter.lng, ueaSouth, 0),
    ],
    style: { color: '#dc2626', weight: '3' },
  });

  return measures;
}

/**
 * Generate a full COP layer spec containing the EFDL overlay.
 */
export function generateEFDLLayerSpec(
  problemSetId: string,
  profileName = 'default',
): COPLayerSpec {
  const measures = generateEFDLOverlay(profileName);

  return {
    layerId: `efdl-overlay-${randomUUID().slice(0, 8)}`,
    layerType: 'control_measures',
    workspaceId: problemSetId,
    sectionId: 'efdl-operational-context',
    symbols: [],
    controlMeasures: measures,
    customAnnotations: [],
    temporalPhases: [
      {
        phaseNumber: 1,
        label: 'Phase 1 — Robotic Engagement',
        description: 'Multi-domain sensors detect threats; robotic forces conduct direct fire while providing targeting to long-range fires',
      },
      {
        phaseNumber: 2,
        label: 'Phase 2 — Attrition',
        description: 'Enemy force reduced to approximately 30% remaining combat strength through combined robotic and long-range fires',
      },
      {
        phaseNumber: 3,
        label: 'Phase 3 — Counteroffensive',
        description: 'Manned NATO forces conduct localized counterattacks and initiate general counteroffensive',
      },
    ],
    metadata: {
      generatedBy: 'efdl-overlay-generator',
      generatedAt: new Date().toISOString(),
      sourceDocumentIds: [],
      ccoValidated: false,
    },
  };
}
