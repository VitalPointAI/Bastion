/**
 * Deterministic MIL-STD-2525D SIDC Builder
 *
 * Generates 20-character Symbol Identification Codes from entity attributes.
 * SIDC codes are ALWAYS generated deterministically from lookup maps --
 * never by LLM. This ensures MIL-STD-2525D compliance without hallucination.
 *
 * 20-digit SIDC structure (MIL-STD-2525D):
 *   Pos 1-2:   Version (always '10' for 2525D)
 *   Pos 3-4:   Standard Identity
 *   Pos 5-6:   Symbol Set
 *   Pos 7:     Status
 *   Pos 8:     HQ/TF/FD
 *   Pos 9-10:  Echelon/Amplifier
 *   Pos 11-16: Entity code (6 digits)
 *   Pos 17-18: Modifier 1 (2 digits)
 *   Pos 19-20: Modifier 2 (2 digits)
 */

// ---------------------------------------------------------------------------
// Lookup maps
// ---------------------------------------------------------------------------

/** Standard Identity (positions 3-4) */
export const IDENTITY_MAP = {
  unknown: '01',
  assumed_friendly: '02',
  friendly: '03',
  neutral: '04',
  suspect: '05',
  hostile: '06',
} as const;

/** Symbol Set (positions 5-6) */
export const SYMBOL_SET_MAP = {
  air: '01',
  space: '05',
  land_unit: '10',
  land_equipment: '15',
  land_installation: '20',
  sea_mine: '25',
  sea_surface: '30',
  subsurface: '35',
  activity: '40',
} as const;

/** Status (position 7) */
export const STATUS_MAP = {
  present: '0',
  planned: '1',
  anticipated: '2',
  fully_capable: '3',
} as const;

/** HQ/Task Force/Feint Dummy (position 8) */
export const HQ_TF_FD_MAP = {
  none: '0',
  hq: '1',
  task_force: '2',
  feint_dummy: '3',
  hq_task_force: '4',
} as const;

/** Echelon/Amplifier (positions 9-10) */
export const ECHELON_MAP = {
  unspecified: '00',
  team: '11',
  squad: '12',
  section: '13',
  platoon: '14',
  company: '15',
  battalion: '16',
  regiment: '17',
  brigade: '18',
  division: '19',
  corps: '20',
  army: '21',
} as const;

/** Entity codes (positions 11-16) -- common military entity types */
export const ENTITY_CODE_MAP: Record<string, string> = {
  headquarters: '110000',
  infantry: '110100',
  armor: '110200',
  artillery: '110300',
  air_defense: '110400',
  engineer: '110500',
  signal: '110600',
  logistics: '110700',
  medical: '110800',
  military_intel: '110900',
  reconnaissance: '111000',
  aviation: '111100',
  special_operations: '111200',
  chemical: '111300',
  military_police: '111400',
  civil_affairs: '111500',
  electronic_warfare: '111600',
  fire_support: '111700',
  air_assault: '111800',
  airborne: '111900',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Identity = keyof typeof IDENTITY_MAP;
export type SymbolSet = keyof typeof SYMBOL_SET_MAP;
export type Status = keyof typeof STATUS_MAP;
export type HqTfFd = keyof typeof HQ_TF_FD_MAP;
export type Echelon = keyof typeof ECHELON_MAP;

export interface SIDCParams {
  identity: Identity;
  symbolSet: SymbolSet;
  status: Status;
  hqTfFd: HqTfFd;
  echelon: Echelon;
  /** 6-digit entity code */
  entityCode: string;
  /** 2-digit modifier 1 (default '00') */
  modifier1?: string;
  /** 2-digit modifier 2 (default '00') */
  modifier2?: string;
}

// ---------------------------------------------------------------------------
// Affiliation mapping (maps frontend Affiliation type to SIDC identity)
// ---------------------------------------------------------------------------

const AFFILIATION_TO_IDENTITY: Record<string, Identity> = {
  friendly: 'friendly',
  enemy: 'hostile',
  hostile: 'hostile',
  neutral: 'neutral',
  unknown: 'unknown',
};

// ---------------------------------------------------------------------------
// Entity type to symbol set mapping
// ---------------------------------------------------------------------------

const ENTITY_TYPE_TO_SYMBOL_SET: Record<string, SymbolSet> = {
  infantry: 'land_unit',
  armor: 'land_unit',
  artillery: 'land_unit',
  air_defense: 'land_unit',
  engineer: 'land_unit',
  signal: 'land_unit',
  logistics: 'land_unit',
  medical: 'land_unit',
  military_intel: 'land_unit',
  headquarters: 'land_unit',
  reconnaissance: 'land_unit',
  aviation: 'air',
  special_operations: 'land_unit',
  chemical: 'land_unit',
  military_police: 'land_unit',
  civil_affairs: 'land_unit',
  electronic_warfare: 'land_unit',
  fire_support: 'land_unit',
  air_assault: 'land_unit',
  airborne: 'land_unit',
};

// ---------------------------------------------------------------------------
// Core builder
// ---------------------------------------------------------------------------

/**
 * Build a 20-character MIL-STD-2525D SIDC code from structured params.
 * Result is always exactly 20 digits, deterministic, no LLM involvement.
 */
export function buildSIDC(params: SIDCParams): string {
  const version = '10';
  const identity = IDENTITY_MAP[params.identity];
  const symbolSet = SYMBOL_SET_MAP[params.symbolSet];
  const status = STATUS_MAP[params.status];
  const hqTfFd = HQ_TF_FD_MAP[params.hqTfFd];
  const echelon = ECHELON_MAP[params.echelon];
  const entityCode = params.entityCode.padStart(6, '0').slice(0, 6);
  const mod1 = (params.modifier1 ?? '00').padStart(2, '0').slice(0, 2);
  const mod2 = (params.modifier2 ?? '00').padStart(2, '0').slice(0, 2);

  const sidc = `${version}${identity}${symbolSet}${status}${hqTfFd}${echelon}${entityCode}${mod1}${mod2}`;

  if (sidc.length !== 20) {
    throw new Error(
      `SIDC must be exactly 20 characters, got ${sidc.length}: ${sidc}`
    );
  }
  if (!/^\d{20}$/.test(sidc)) {
    throw new Error(`SIDC must contain only digits: ${sidc}`);
  }

  return sidc;
}

/**
 * Convenience function: maps high-level entity attributes to SIDCParams
 * and calls buildSIDC. Uses sensible defaults for optional fields.
 */
export function buildSIDCFromEntity(entity: {
  type: string;
  affiliation: string;
  echelon?: string;
  functionCode?: string;
  status?: string;
}): string {
  const identity = AFFILIATION_TO_IDENTITY[entity.affiliation] ?? 'unknown';
  const symbolSet = ENTITY_TYPE_TO_SYMBOL_SET[entity.type] ?? 'land_unit';
  const status = (entity.status as Status) ?? 'present';
  const echelon = (entity.echelon as Echelon) ?? 'unspecified';
  const entityCode =
    entity.functionCode ?? ENTITY_CODE_MAP[entity.type] ?? '110000';

  return buildSIDC({
    identity,
    symbolSet,
    status,
    hqTfFd: 'none',
    echelon,
    entityCode,
    modifier1: '00',
    modifier2: '00',
  });
}
