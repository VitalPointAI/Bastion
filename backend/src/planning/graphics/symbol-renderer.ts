/**
 * Military Symbol Renderer
 *
 * Phase 05 Plan 10: Renders MIL-STD-2525D symbols using milsymbol library
 */

import { Symbol as MilSymbol } from 'milsymbol';

export interface SymbolOptions {
  size?: number;
  uniqueDesignation?: string;
  higherFormation?: string;
  staffComments?: string;
  additionalInfo?: string;
  hostile?: boolean;
}

/**
 * Render military symbol to data URL
 */
export function renderSymbol(sidc: string, options: SymbolOptions = {}): string {
  const symbol = new MilSymbol(sidc, {
    size: options.size || 30,
    uniqueDesignation: options.uniqueDesignation,
    higherFormation: options.higherFormation,
    staffComments: options.staffComments,
    additionalInformation: options.additionalInfo,
  });

  return symbol.toDataURL();
}

/**
 * Get symbol anchor point
 */
export function getSymbolAnchor(sidc: string, size: number = 30): { x: number; y: number } {
  const symbol = new MilSymbol(sidc, { size });
  const anchor = symbol.getAnchor();
  return { x: anchor.x, y: anchor.y };
}

/**
 * Get symbol size
 */
export function getSymbolSize(sidc: string, size: number = 30): { width: number; height: number } {
  const symbol = new MilSymbol(sidc, { size });
  const s = symbol.getSize();
  return { width: s.width, height: s.height };
}

// Common SIDC codes for operational graphics (MIL-STD-2525D)
export const GRAPHIC_SIDC = {
  // Tactical Graphics - Points
  OBJECTIVE: 'G*GPGPO---****X', // Objective
  TARGET: 'G*GPGPT---****X', // Target
  NAMED_AREA: 'G*GPGPF---****X', // Named Area of Interest
  DECISION_POINT: 'G*GPGPP---****X', // Decision Point

  // Tactical Graphics - Lines
  PHASE_LINE: 'G*GPGLP---****X', // Phase Line
  FINAL_COORDINATION_LINE: 'G*GPGLF---****X', // FCL
  LIMIT_OF_ADVANCE: 'G*GPGLL---****X', // LOA
  LINE_OF_DEPARTURE: 'G*GPGLD---****X', // LD
  FORWARD_LINE_OF_TROOPS: 'G*GPGLFL--****X', // FLOT

  // Tactical Graphics - Areas
  ASSEMBLY_AREA: 'G*GPGAA---****X', // Assembly Area
  ATTACK_POSITION: 'G*GPGAP---****X', // Attack Position
  AXIS_OF_ADVANCE: 'G*GPGAX---****X', // Axis of Advance
  OBJECTIVE_AREA: 'G*GPGAO---****X', // Objective Area
  ENGAGEMENT_AREA: 'G*GPGAE---****X', // Engagement Area
};
