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

// ---------------------------------------------------------------------------
// Known vehicle database — deterministic fast path
// ---------------------------------------------------------------------------

interface VehicleEntry {
  designation: string;
  affiliation: 'hostile' | 'suspect' | 'unknown' | 'friendly';
  symbolSet: string;
  entity: string;
  category: 'mbt' | 'ifv' | 'apc' | 'truck' | 'artillery' | 'air' | 'naval' | 'generic';
  notes: string;
}

const KNOWN_VEHICLES: Record<string, VehicleEntry> = {
  // PLA vehicles
  't-90':    { designation: 'T-90 Main Battle Tank',              affiliation: 'hostile', symbolSet: '15', entity: '120104', category: 'mbt',  notes: 'Russian MBT, composite + Kontakt-5 ERA' },
  't90':     { designation: 'T-90 Main Battle Tank',              affiliation: 'hostile', symbolSet: '15', entity: '120104', category: 'mbt',  notes: 'Russian MBT' },
  'chn-99g': { designation: 'Type 99G Main Battle Tank (ZTZ-99G)',affiliation: 'hostile', symbolSet: '15', entity: '120104', category: 'mbt',  notes: 'PLA advanced MBT, FY-4 ERA + APS' },
  'chn99g':  { designation: 'Type 99G Main Battle Tank (ZTZ-99G)',affiliation: 'hostile', symbolSet: '15', entity: '120104', category: 'mbt',  notes: 'PLA advanced MBT' },
  't72':     { designation: 'T-72 Main Battle Tank',              affiliation: 'hostile', symbolSet: '15', entity: '120104', category: 'mbt',  notes: 'Russian MBT, widely exported' },
  'ztz99':   { designation: 'ZTZ-99 Main Battle Tank',            affiliation: 'hostile', symbolSet: '15', entity: '120104', category: 'mbt',  notes: 'PLA MBT' },
  'type99':  { designation: 'Type 99 Main Battle Tank',           affiliation: 'hostile', symbolSet: '15', entity: '120104', category: 'mbt',  notes: 'PLA MBT' },
  't-99':    { designation: 'Type 99 Main Battle Tank',           affiliation: 'hostile', symbolSet: '15', entity: '120104', category: 'mbt',  notes: 'PLA MBT' },
  'zbd-04':  { designation: 'ZBD-04 Infantry Fighting Vehicle',   affiliation: 'hostile', symbolSet: '15', entity: '120200', category: 'ifv',  notes: 'PLA IFV, 100mm + 30mm' },
  'zbd04':   { designation: 'ZBD-04 Infantry Fighting Vehicle',   affiliation: 'hostile', symbolSet: '15', entity: '120200', category: 'ifv',  notes: 'PLA IFV' },
  'btr-82':  { designation: 'BTR-82 Armored Personnel Carrier',   affiliation: 'hostile', symbolSet: '15', entity: '120200', category: 'apc',  notes: 'Russian APC, 30mm autocannon' },
  'btr82':   { designation: 'BTR-82 Armored Personnel Carrier',   affiliation: 'hostile', symbolSet: '15', entity: '120200', category: 'apc',  notes: 'Russian APC' },
  'bmp-3':   { designation: 'BMP-3 Infantry Fighting Vehicle',    affiliation: 'hostile', symbolSet: '15', entity: '120200', category: 'ifv',  notes: 'Russian IFV, 100mm + 30mm' },
  // Friendly
  'm1':      { designation: 'M1 Abrams Main Battle Tank',         affiliation: 'friendly',symbolSet: '15', entity: '120104', category: 'mbt',  notes: 'US MBT' },
  'lav-25':  { designation: 'LAV-25 Light Armored Vehicle',       affiliation: 'friendly',symbolSet: '15', entity: '120200', category: 'apc',  notes: 'USMC LAV' },
  // Generic
  'tank':            { designation: 'Unknown Tank',                affiliation: 'hostile', symbolSet: '15', entity: '120104', category: 'mbt',     notes: 'Generic tank detection' },
  'armored vehicle': { designation: 'Armored Vehicle',             affiliation: 'hostile', symbolSet: '15', entity: '120200', category: 'generic', notes: 'Generic armored vehicle' },
  'military vehicle':{ designation: 'Military Vehicle',            affiliation: 'hostile', symbolSet: '15', entity: '140000', category: 'truck',   notes: 'Generic military vehicle' },
  'truck':           { designation: 'Truck',                       affiliation: 'unknown', symbolSet: '15', entity: '140000', category: 'truck',   notes: 'Transport vehicle' },
  'airplane':        { designation: 'Fixed Wing Aircraft',         affiliation: 'unknown', symbolSet: '01', entity: '110000', category: 'air',     notes: 'Airborne platform' },
  'helicopter':      { designation: 'Rotary Wing Aircraft',        affiliation: 'unknown', symbolSet: '01', entity: '110100', category: 'air',     notes: 'Rotary-wing platform' },
  'boat':            { designation: 'Surface Vessel',              affiliation: 'unknown', symbolSet: '30', entity: '120000', category: 'naval',   notes: 'Surface vessel' },
};

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
  const key = detectionClass.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim();
  const entry = KNOWN_VEHICLES[key];
  if (!entry) return null;

  // Use the vehicle's defined affiliation — for known threat vehicles
  // (T-90, CHN-99G, etc.) the affiliation stays hostile regardless of
  // confidence. The model was specifically trained on these classes.
  // Only downgrade to unknown for very low confidence generic detections.
  let affiliation = entry.affiliation;
  if (confidence < 0.3) affiliation = 'unknown';

  const identityCode = IDENTITY_CODES[affiliation] ?? '01';

  // Determine echelon from count
  let echelon = '00'; // unspecified
  if (count >= 10) echelon = '15'; // company
  else if (count >= 4) echelon = '14'; // platoon
  else if (count >= 2) echelon = '13'; // section

  // For multiple vehicles, switch to land_unit (10) with echelon
  const symbolSet = count > 1 ? '10' : entry.symbolSet;

  // Build 20-character SIDC
  const sidc = `10${identityCode}${symbolSet}00${echelon}${entry.entity}0000`;

  const confidenceTier: 'high' | 'medium' | 'low' =
    confidence >= 0.85 ? 'high' : confidence >= 0.65 ? 'medium' : 'low';

  return {
    sidc,
    designation: entry.designation,
    affiliation,
    symbol_set: symbolSet === '10' ? 'land_unit' : symbolSet === '15' ? 'land_equipment' : symbolSet === '01' ? 'air' : 'sea_surface',
    entity_description: entry.designation,
    echelon: echelon === '00' ? 'individual' : echelon === '13' ? 'section' : echelon === '14' ? 'platoon' : 'company',
    status: 'present',
    quantity: count,
    confidence_tier: confidenceTier,
    position: position ?? null,
    heading: heading ?? null,
    tactical_notes: `${entry.notes}. ${count > 1 ? `${count}x detected.` : ''} Confidence: ${(confidence * 100).toFixed(0)}%.`,
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
