/**
 * Military Symbology Skill
 *
 * Determines the correct MIL-STD-2525D SIDC for a vision detection.
 * Fast deterministic path for known vehicles; LLM fallback for unknowns.
 *
 * Used by the vision-cop-pipeline to produce render-ready symbols.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { vehicleDatabase } from '../vehicle-database.js';

// Standard Identity codes (positions 3-4)
const IDENTITY_CODES: Record<string, string> = {
  unknown: '01',
  assumed_friendly: '02',
  friendly: '03',
  neutral: '04',
  suspect: '05',
  hostile: '06',
};

// ---------------------------------------------------------------------------
// Core classification function
// ---------------------------------------------------------------------------

export interface SymbolResult {
  sidc: string;
  designation: string;
  affiliation: string;
  symbol_set: string;
  entity_description: string;
  echelon: string;
  status: string;
  quantity: number;
  confidence_tier: 'high' | 'medium' | 'low';
  position: { lat: number; lng: number } | null;
  heading: number | null;
  tactical_notes: string;
}

/**
 * Classify a detection and produce a render-ready symbol spec.
 * Deterministic for known vehicles; returns null for unknowns (caller should use LLM).
 */
export function classifyKnownVehicle(
  detectionClass: string,
  confidence: number,
  count: number,
  position?: { lat: number; lng: number },
  heading?: number,
): SymbolResult | null {
  const entry = vehicleDatabase.getByClassification(detectionClass);
  if (!entry || !entry.mil2525_symbol_set || !entry.mil2525_entity) return null;

  // Use the vehicle's defined affiliation — for known threat vehicles
  // (T-90, CHN-99G, etc.) the affiliation stays hostile regardless of
  // confidence. The model was specifically trained on these classes.
  // Only downgrade to unknown for very low confidence generic detections.
  let affiliation: 'hostile' | 'suspect' | 'unknown' | 'friendly' =
    entry.threat_class === 'neutral' ? 'unknown' : entry.threat_class;
  if (confidence < 0.3) affiliation = 'unknown';

  const identityCode = IDENTITY_CODES[affiliation] ?? '01';

  // Determine echelon from count
  let echelon = '00'; // unspecified
  if (count >= 10) echelon = '15'; // company
  else if (count >= 4) echelon = '14'; // platoon
  else if (count >= 2) echelon = '13'; // section

  // For multiple vehicles, switch to land_unit (10) with echelon
  const symbolSet = count > 1 ? '10' : entry.mil2525_symbol_set;

  // Build 20-character SIDC
  const sidc = `10${identityCode}${symbolSet}00${echelon}${entry.mil2525_entity}0000`;

  const confidenceTier: 'high' | 'medium' | 'low' =
    confidence >= 0.85 ? 'high' : confidence >= 0.65 ? 'medium' : 'low';

  return {
    sidc,
    designation: entry.name,
    affiliation,
    symbol_set: symbolSet === '10' ? 'land_unit' : symbolSet === '15' ? 'land_equipment' : symbolSet === '01' ? 'air' : 'sea_surface',
    entity_description: entry.name,
    echelon: echelon === '00' ? 'individual' : echelon === '13' ? 'section' : echelon === '14' ? 'platoon' : 'company',
    status: 'present',
    quantity: count,
    confidence_tier: confidenceTier,
    position: position ?? null,
    heading: heading ?? null,
    tactical_notes: `${entry.description ?? entry.name}. ${count > 1 ? `${count}x detected.` : ''} Confidence: ${(confidence * 100).toFixed(0)}%.`,
  };
}

// ---------------------------------------------------------------------------
// LangChain Tool
// ---------------------------------------------------------------------------

export function createSymbologyTools(): DynamicStructuredTool[] {
  const classifyTool = new DynamicStructuredTool({
    name: 'classify_and_symbolize',
    description: 'Given a vision detection (class description, confidence, count, position), determine the correct MIL-STD-2525D SIDC code, affiliation, echelon, status, and tactical notes. Returns a render-ready symbol specification for the COP.',
    schema: z.object({
      detection_class: z.string().describe('Vision system class label'),
      confidence: z.number().describe('Detection confidence 0.0-1.0'),
      count: z.number().optional().describe('Number detected (default 1)'),
      detected_position: z.object({
        lat: z.number(),
        lng: z.number(),
      }).optional().describe('Geographic position'),
      estimated_heading: z.number().optional().describe('Heading in degrees'),
      context: z.string().optional().describe('Additional context'),
    }),
    func: async ({ detection_class, confidence, count, detected_position, estimated_heading, context }) => {
      const qty = count ?? 1;

      // Try deterministic fast path first
      const result = classifyKnownVehicle(
        detection_class,
        confidence,
        qty,
        detected_position,
        estimated_heading,
      );

      if (result) {
        return JSON.stringify(result);
      }

      // Unknown vehicle — construct a best-guess response
      // In production, this would call the LLM via executeDynamicSkill
      const affiliation = confidence >= 0.7 ? 'hostile' : confidence >= 0.5 ? 'suspect' : 'unknown';
      const identityCode = IDENTITY_CODES[affiliation] ?? '01';
      const fallback: SymbolResult = {
        sidc: `10${identityCode}150000120100${count && count > 1 ? '00' : '00'}00`,
        designation: `Unknown: ${detection_class}`,
        affiliation,
        symbol_set: 'land_equipment',
        entity_description: `Unclassified detection: ${detection_class}`,
        echelon: 'individual',
        status: 'present',
        quantity: qty,
        confidence_tier: confidence >= 0.85 ? 'high' : confidence >= 0.65 ? 'medium' : 'low',
        position: detected_position ?? null,
        heading: estimated_heading ?? null,
        tactical_notes: `Unknown class "${detection_class}". ${context ?? ''}. Confidence: ${(confidence * 100).toFixed(0)}%. Requires manual classification.`,
      };

      return JSON.stringify(fallback);
    },
  });

  return [classifyTool];
}
